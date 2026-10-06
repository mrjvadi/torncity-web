// The offline (?mock=1) server of state sync (client-api.md section 5.6): the
// player's entities, their update log with pts, GET /state, GET /updates,
// the records a command causes, and a socket that pushes them — with the
// faults a real network has (a lost publication, two arriving out of order),
// so the store's gap and duplicate rules run in every mock session. Other
// sources change the player too (a payment from someone else, energy spent
// in Telegram, the village finishing a building without its publication), so
// the HUD, the profile, the bank and the village visibly follow without a
// refresh.
//
// Handles for screenshots and checks: window.__sync.tick('income' | 'energy' | 'item'
// | 'village' | 'inbox' | 'skill'), .drop(), .reorder(), .chaos(on),
// .stats().

import { syncStore } from '../state/store'
import type { SyncDifference, SyncKind, SyncPublication, SyncRecord, SyncSnapshot } from '../state/syncTypes'
import { mockBuildingOverlays, mockElection, mockGoal, mockVillageQuietChange, mockVillageSummary } from './mock_village'

const PLAYER = 'mock-1'
let EPOCH = '1'
const FEE_BPS = 150

interface Held { v: number; d: unknown }
const ents = new Map<SyncKind, Map<string, Held>>()
const log: SyncRecord[] = []
let pts = 0
let started = false
let socket = false
let dropNext = 0
let reorderNext = false
let chaos = true
let published = 0
let lost = 0
let swapped = 0
let held: SyncPublication | null = null
let reqSeq = 0

function iso(ms = Date.now()): string { return new Date(ms).toISOString() }

function byKind(kind: SyncKind): Map<string, Held> {
  let m = ents.get(kind)
  if (!m) {
    m = new Map()
    ents.set(kind, m)
  }
  return m
}

function put(kind: SyncKind, id: string, d: unknown, cause?: string): SyncRecord {
  const m = byKind(kind)
  const v = (m.get(id)?.v ?? 0) + 1
  m.set(id, { v, d })
  pts++
  const r: SyncRecord = { pts, type: `${kind}.set`, entity: kind, id, v, op: 'set', data: d, at: iso(), ...(cause ? { cause } : {}) }
  log.push(r)
  return r
}

function patch<T>(kind: SyncKind, id: string, fn: (d: T) => T, cause?: string): SyncRecord | null {
  const cur = byKind(kind).get(id)
  if (!cur) return null
  return put(kind, id, fn(structuredClone(cur.d) as T), cause)
}

function drop(kind: SyncKind, id: string, cause?: string): SyncRecord | null {
  const m = byKind(kind)
  const cur = m.get(id)
  if (!cur) return null
  m.delete(id)
  pts++
  const r: SyncRecord = { pts, type: `${kind}.del`, entity: kind, id, v: cur.v + 1, op: 'del', at: iso(), ...(cause ? { cause } : {}) }
  log.push(r)
  return r
}

interface Wallet { currency: string; cash: number; bank: number; premium: boolean; primary: boolean }
interface Inv { item: string; qty: number; holdings: Record<string, number>; pieces: { id: string; holding: string; quality: number; uses_left: number | null }[] }
interface Inbox { unread: number; latest: string[] }
interface Notice { kind: string; category: string; screen: string; view: unknown; created_at: string; read: boolean; instant: boolean }

function init(): void {
  if (started) return
  started = true
  const now = Date.now()
  put('player', PLAYER, { name: 'سارا', code: 'K7Q2M9A', lang: 'fa', status: 'active', level: 7, xp: 5400, next_level_xp: 6500, rank: 'breadwinner' })
  put('vitals', PLAYER, {
    energy: { value: 70, max: 100, as_of: iso(now - 20 * 60000), regen: { amount: 5, every_seconds: 900, bps: 10000 } },
    nerve: { value: 14, max: 20, as_of: iso(now - 4 * 60000), regen: { amount: 1, every_seconds: 300, bps: 10000 } },
    health: { value: 88, max: 100, as_of: iso(now - 20 * 60000) },
  })
  put('wallet', 'SUP', { currency: 'SUP', cash: 12450, bank: 86300, premium: false, primary: true })
  if (new URLSearchParams(location.search).get('cur') !== 'none') put('wallet', 'MKP', { currency: 'MKP', cash: 320, bank: 0, premium: false, primary: false, local: true, name: 'مارک پولو' })
  put('wallet', 'NIL', { currency: 'NIL', cash: 40, bank: 0, premium: true, primary: false })
  const inv = (item: string, qty: number): Inv => ({ item, qty, holdings: { carried: qty }, pieces: [] })
  put('inventory', 'bread', inv('bread', 6))
  put('inventory', 'soda', inv('soda', 4))
  put('inventory', 'pill', inv('pill', 2))
  put('inventory', 'ring', inv('ring', 1))
  put('inventory', 'pistol', { item: 'pistol', qty: 1, holdings: { carried: 1 }, pieces: [{ id: 'pc-1', holding: 'carried', quality: 72, uses_left: null }] })
  put('skill', 'trading', { skill: 'trading', level: 3, xp: 410 })
  put('skill', 'driving', { skill: 'driving', level: 1, xp: 40 })
  // my work in progress: a shift and a course (?wip=0 turns them off, for the idle-slot shots)
  if (new URLSearchParams(location.search).get('wip') !== '0') {
    put('timed_action', 'ta-shift', { kind: 'work_shift', ref_type: 'job', ref_id: 'woodcutter', state: 'running', started_at: iso(now - 600000), finish_at: iso(now + 1450000) })
    put('timed_action', 'ta-study', { kind: 'education', ref_type: 'course', ref_id: 'accounting', state: 'running', started_at: iso(now - 600000), finish_at: iso(now + 4325000) })
  }
  put('location', 'self', { city: 'calderis', place: 'old_town', settlement: '', travel: null, walk: null })
  put('notice', 'n-1', { kind: 'bank.payment_received', category: 'finance', screen: 'payment_notice', view: { payer_name: 'کاوه', payer_code: 'B3C4D5F', method: 'card', amount: 12500 }, created_at: iso(now - 300000), read: false, instant: false } as Notice)
  put('inbox', 'self', { unread: 1, latest: ['n-1'] } as Inbox)
  const s = mockVillageSummary()
  put('residence', 'self', { settlement: s.id, code: s.code, name: s.name, tier: s.tier, is_head: s.viewer === 'head', resident: true })
  put('settlement', s.id, summaryData())
  put('relations', 'self', { friends: [], faction: null, presence: 'everyone' })
  const g = mockGoal()
  if (g) put('goal', 'self', g)
}

function summaryData(): unknown {
  const s = mockVillageSummary()
  return { id: s.id, code: s.code, name: s.name, tier: s.tier, viewer: s.viewer, grid_lots: s.grid_lots, layout_version: s.layout_version,
    treasury: { currency: 'SUP', balance: s.treasury }, knowledge: s.knowledge, research: s.research,
    election: mockElection(), buildings: mockBuildingOverlays() }
}

/** GET /state */
export function mockState(): SyncSnapshot {
  init()
  // the village moves by its own commands too: the summary follows it
  refreshSettlement()
  const entities: SyncSnapshot['entities'] = {}
  for (const [kind, m] of ents) {
    const out: Record<string, { v: number; d: unknown }> = {}
    for (const [id, h] of m) out[id] = { v: h.v, d: h.d }
    entities[kind] = out
  }
  return { pts, epoch: EPOCH, server_time: iso(), entities, channels: {} }
}

/** GET /updates?since= */
export function mockUpdates(since: number, epoch: string): SyncDifference {
  init()
  if ((epoch && epoch !== EPOCH) || since > pts || since < 0) return { pts, updates: [], more: false, reset: true, reason: epoch !== EPOCH ? 'epoch' : 'ahead', epoch: EPOCH }
  const updates = log.filter((r) => r.pts > since).slice(0, 100)
  return { pts, updates, more: updates.length > 0 && updates[updates.length - 1].pts < pts, epoch: EPOCH }
}

function refreshSettlement(cause?: string): SyncRecord | null {
  const s = mockVillageSummary()
  const cur = byKind('settlement').get(s.id)?.d
  const next = summaryData()
  if (cur && JSON.stringify(cur) === JSON.stringify(next)) return null
  // the goal follows the village (its promotion progress); its record goes out with the summary's
  const g = mockGoal(), had = byKind('goal').get('self')
  if (g && JSON.stringify(had?.d) !== JSON.stringify(g)) publish([put('goal', 'self', g, cause)])
  else if (!g && had) { const r = drop('goal', 'self', cause); if (r) publish([r]) }
  return put('settlement', s.id, next, cause)
}

/** A command's effect on the player's state, and its own records on the answer. */
export function mockSyncCommand<T extends Record<string, unknown>>(command: string, args: Record<string, unknown> | undefined, body: T): T {
  init()
  const requestId = (body.request_id as string | undefined) ?? `mreq-${++reqSeq}`
  const amount = Number(String(args?.amount ?? '0').replace(/[^\d]/g, '')) || 0
  const recs: SyncRecord[] = []
  const add = (r: SyncRecord | null) => { if (r) recs.push(r) }
  if (body.ok !== false) {
    switch (command) {
      case 'bank.deposit':
        add(patch<Wallet>('wallet', 'SUP', (w) => (amount && amount <= w.cash ? { ...w, cash: w.cash - amount, bank: w.bank + amount } : w), requestId))
        break
      case 'bank.withdraw': {
        const fee = Math.floor((amount * FEE_BPS) / 10000)
        add(patch<Wallet>('wallet', 'SUP', (w) => (amount && amount <= w.bank ? { ...w, cash: w.cash + amount - fee, bank: w.bank - amount } : w), requestId))
        break
      }
      case 'inventory.use': {
        const code = String(args?.item ?? '')
        const cur = byKind('inventory').get(code)?.d as Inv | undefined
        if (cur && cur.qty <= 1) add(drop('inventory', code, requestId))
        else if (cur) add(patch<Inv>('inventory', code, (i) => ({ ...i, qty: i.qty - 1, holdings: { ...i.holdings, carried: i.qty - 1 } }), requestId))
        break
      }
      case 'inbox.read': {
        // one notice only: it is read, the count falls by one, every other notice stays unread
        const id = String(args?.id ?? '')
        const held = byKind('notice').get(id)
        if (held && !(held.d as Notice).read) {
          add(patch<Notice>('notice', id, (n) => ({ ...n, read: true }), requestId))
          add(patch<Inbox>('inbox', 'self', (b) => ({ ...b, unread: Math.max(0, b.unread - 1) }), requestId))
        }
        break
      }
      case 'inbox.read_all': {
        for (const [id, h] of [...byKind('notice')]) {
          if (!(h.d as Notice).read) add(patch<Notice>('notice', id, (n) => ({ ...n, read: true }), requestId))
        }
        add(patch<Inbox>('inbox', 'self', (b) => ({ ...b, unread: 0 }), requestId))
        break
      }
      default:
        if (command.startsWith('settlement.')) add(refreshSettlement(requestId))
    }
  }
  if (recs.length === 0) return body
  publish(recs)
  return { ...body, request_id: requestId, updates: { pts, records: recs } }
}

// -- the socket ------------------------------------------------------------------------------

function deliver(p: SyncPublication): void {
  published++
  window.setTimeout(() => syncStore.receive(p), 60)
}

function publish(records: SyncRecord[]): void {
  if (!socket || records.length === 0) return
  const p: SyncPublication = { type: 'updates', from: records[0].pts, to: records[records.length - 1].pts, updates: records }
  if (dropNext > 0) {
    dropNext--
    lost++
    return
  }
  if (reorderNext && !held) {
    reorderNext = false
    held = p
    window.setTimeout(() => { if (held === p) { held = null; deliver(p) } }, 200)
    return
  }
  deliver(p)
  if (held) {
    // the one held back arrives after the later one: out of order
    const late = held
    held = null
    swapped++
    window.setTimeout(() => deliver(late), 30)
  }
}

type Tick = 'income' | 'energy' | 'village' | 'inbox' | 'skill' | 'item'
const TICKS: Tick[] = ['income', 'energy', 'village', 'inbox', 'skill']
let nextTick = 0

/** Something changed the player from elsewhere (another player, a Telegram
 * command, the village), as the projector would publish it. */
export function mockTick(kind?: Tick): void {
  init()
  const k = kind ?? TICKS[nextTick++ % TICKS.length]
  const recs: SyncRecord[] = []
  const add = (r: SyncRecord | null) => { if (r) recs.push(r) }
  const now = Date.now()
  switch (k) {
    case 'income': {
      add(patch<Wallet>('wallet', 'SUP', (w) => ({ ...w, bank: w.bank + 350 })))
      const id = `n-${pts + 1}`
      add(put('notice', id, { kind: 'bank.payment_received', category: 'finance', screen: 'payment_notice',
        view: { payer_name: 'کاوه', payer_code: 'B3C4D5F', method: 'card', amount: 350 }, created_at: iso(now), read: true, instant: true } as Notice))
      add(patch<Inbox>('inbox', 'self', (b) => ({ ...b, latest: [id, ...b.latest].slice(0, 50) })))
      break
    }
    case 'energy':
      add(patch('vitals', PLAYER, (v: { energy: { value: number; as_of: string } }) => ({ ...v, energy: { ...v.energy, value: Math.max(0, v.energy.value - 15), as_of: iso(now) } })))
      break
    case 'village':
      mockVillageQuietChange()
      add(refreshSettlement())
      break
    case 'inbox': {
      const id = `n-${pts + 1}`
      add(put('notice', id, { kind: 'achievement.awarded', category: 'achievements', screen: 'achievement_notice',
        view: { achievement: { code: 'first_job', name: 'first_job' }, cash: 500, withheld: 0 }, created_at: iso(now), read: false, instant: false } as Notice))
      add(patch<Inbox>('inbox', 'self', (b) => ({ unread: b.unread + 1, latest: [id, ...b.latest].slice(0, 50) })))
      add(patch<Wallet>('wallet', 'SUP', (w) => ({ ...w, cash: w.cash + 500 })))
      break
    }
    case 'skill':
      add(patch('skill', 'trading', (s: { xp: number; level: number }) => ({ ...s, xp: s.xp + 25 })))
      add(patch('player', PLAYER, (p: { xp: number }) => ({ ...p, xp: p.xp + 60 })))
      break
    case 'item': {
      // bread bought at the bazaar from Telegram, and a new item given by a friend
      add(patch<Inv>('inventory', 'bread', (i) => ({ ...i, qty: i.qty + 3, holdings: { ...i.holdings, carried: i.qty + 3 } })))
      if (!byKind('inventory').has('bandage')) add(put('inventory', 'bandage', { item: 'bandage', qty: 2, holdings: { carried: 2 }, pieces: [] } as Inv))
      break
    }
  }
  if (chaos && Math.random() < 0.15) dropNext = 1
  if (chaos && Math.random() < 0.15) reorderNext = true
  publish(recs)
}

let ambient = 0

/** The mock "socket": connected once the store has started. */
export function attachMockSocket(): void {
  init()
  socket = true
  syncStore.setLive(true)
  window.clearInterval(ambient)
  // ambient changes only on request (?mock=1&live=1): checks and screenshots stay deterministic
  if (new URLSearchParams(window.location.search).has('live')) {
    ambient = window.setInterval(() => { if (document.visibilityState === 'visible') mockTick() }, 15000)
  }
  ;(window as unknown as { __sync?: unknown }).__sync = {
    tick: (k?: Tick) => mockTick(k),
    drop: (n = 1) => { dropNext += n },
    reorder: () => { reorderNext = true },
    chaos: (on: boolean) => { chaos = on },
    stop: () => window.clearInterval(ambient),
    socket: (on: boolean) => { socket = on; syncStore.setLive(on) },
    /** The log is rebuilt (a new epoch): every client resets to a snapshot. */
    newEpoch: () => { EPOCH = String(Number(EPOCH) + 1) },
    /** A client this far behind is told to reset (Telegram's differenceTooLong). */
    pull: () => syncStore.pull(),
    stats: () => ({ pts, published, lost, swapped, store: { ...syncStore.counters, pts: syncStore.currentPts() } }),
    /** What the store shows for one entity, and what is under an overlay. */
    entity: (kind: SyncKind, id: string) => syncStore.getView().entities.get(kind)?.get(id),
    pending: () => [...syncStore.getView().pending],
    /** Whether the store's copy equals the mock server's, entity by entity. */
    same: () => {
      const v = syncStore.getView()
      const diff: string[] = []
      for (const [kind, m] of ents) for (const [id, h] of m) {
        if (JSON.stringify(v.entities.get(kind)?.get(id)) !== JSON.stringify(h.d)) diff.push(`${kind}/${id}`)
      }
      for (const [kind, m] of v.entities) for (const id of m.keys()) if (!ents.get(kind)?.has(id)) diff.push(`extra ${kind}/${id}`)
      return { equal: diff.length === 0 && syncStore.currentPts() === pts, diff, storePts: syncStore.currentPts(), serverPts: pts }
    },
  }
}
