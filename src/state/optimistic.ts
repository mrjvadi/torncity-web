// The optimistic changes (docs/adr/0034 section 4): for a few cheap,
// predictable commands the store shows the expected result at once, as an
// overlay on top of the confirmed copy, until the records the command caused
// arrive. The server stays the authority: whatever it answers replaces the
// guess, and a refused command takes the overlay away.
//
// Only commands whose effect is plain arithmetic on what the store holds are
// here: a deposit or a withdrawal, using up one item, marking the inbox
// read. (Equipping, the ADR's third example, has no command in the game yet;
// a rule is one entry in this table when it does.)

import { entitiesOf, primaryWallet, syncStore, type OverlayPatch } from './store'
import type { KindData } from './syncTypes'

type Patch = OverlayPatch
type Rule = (args: Record<string, unknown>) => Patch[]

/** Values a screen knows and the arithmetic needs (the bank's withdrawal fee). */
const hints = new Map<string, Record<string, number>>()
export function setOptimisticHint(command: string, values: Record<string, number>): void {
  hints.set(command, values)
}

function amountOf(args: Record<string, unknown>): number {
  const n = Number(String(args.amount ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function walletPatch(fn: (w: KindData['wallet']) => KindData['wallet'] | null): Patch[] {
  const w = primaryWallet(syncStore.getView())
  if (!w) return []
  const next = fn(w)
  if (!next) return []
  return [{ kind: 'wallet', id: w.currency, fn: (d) => (d ? fn(d as KindData['wallet']) ?? d : d) }]
}

const RULES: Record<string, Rule> = {
  'bank.deposit': (args) => {
    const a = amountOf(args)
    return a ? walletPatch((w) => (a <= w.cash ? { ...w, cash: w.cash - a, bank: w.bank + a } : null)) : []
  },
  'bank.withdraw': (args) => {
    const a = amountOf(args)
    const fee = Math.floor((a * (hints.get('bank.withdraw')?.fee_bps ?? 0)) / 10000)
    return a ? walletPatch((w) => (a <= w.bank ? { ...w, cash: w.cash + a - fee, bank: w.bank - a } : null)) : []
  },
  'inventory.use': (args) => {
    const item = String(args.item ?? '')
    if (!item) return []
    const view = syncStore.getView()
    const hit = entitiesOf(view, 'inventory').find(([code, d]) => code === item || d.pieces.some((p) => p.id === item))
    if (!hit) return []
    const [code] = hit
    return [{
      kind: 'inventory', id: code, fn: (d) => {
        const inv = d as KindData['inventory'] | undefined
        if (!inv) return inv
        if (inv.qty <= 1) return undefined
        const pieces = inv.pieces.filter((p) => p.id !== item)
        return { ...inv, qty: inv.qty - 1, pieces }
      },
    }]
  },
  'inbox.read_all': () => {
    const view = syncStore.getView()
    const out: Patch[] = [{ kind: 'inbox', id: 'self', fn: (d) => (d ? { ...(d as KindData['inbox']), unread: 0 } : d) }]
    for (const [id, n] of entitiesOf(view, 'notice')) {
      if (!n.read) out.push({ kind: 'notice', id, fn: (d) => (d ? { ...(d as KindData['notice']), read: true } : d) })
    }
    return out
  },
}

/** Before a command is sent: its overlay, if it has a rule. */
export function beforeCommand(command: string, args: Record<string, unknown>, key: string | undefined): void {
  const rule = RULES[command]
  if (!rule || !key || !syncStore.isReady()) return
  syncStore.addOverlay(key, command, rule(args))
}
