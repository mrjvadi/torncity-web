// The neutral answer of the presentation split (docs/adr/0039-presentation-split.md) for the mock: a screen
// name, a view typed by the generated Go view, and actions that carry an `id`, a `command`, named `args`,
// a `kind`, an `icon` and a `subject`; never a `text`, a `label` or a `row`. A refusal is `ok: false`
// with a code and data, and its view still says what is missing. The mock answers like the real server
// does once the operator has emptied `client.legacy_text_screens`, so `?mock=1` exercises the real thing.

import type { BatchLotFailure, Named, Ref, ScreenViews, VillageNeed, VillageRefusalView } from './views.gen'

export interface MockAct {
  id?: string
  command: string
  args?: Record<string, string>
  kind: string
  icon: string
  subject?: string
  /** An action the player types the last value of (an amount, a name). */
  input?: { field: string; text?: boolean }
}

/** An action. An empty `id` is left out, as the server leaves it out for a command without a name. */
export function A(id: string, command: string, args?: Record<string, string>, o: { kind?: string; subject?: string } = {}): MockAct {
  const kind = o.kind ?? (id === 'back' ? 'back' : id === 'refresh' ? 'navigation' : id === 'confirm' ? 'confirm' : 'secondary')
  return { ...(id ? { id } : {}), command, ...(args ? { args } : {}), kind, icon: 'action:default', ...(o.subject ? { subject: o.subject } : {}) }
}

export const back = (command: string, args?: Record<string, string>) => A('back', command, args)
export const refreshA = (command: string, args?: Record<string, string>) => A('refresh', command, args)
export const confirmA = (command: string, args: Record<string, string> = {}) => A('confirm', command, { ...args, confirm: 'confirm' })

export function mockOk<K extends keyof ScreenViews>(screen: K, view: ScreenViews[K], actions: MockAct[] = []) {
  return { ok: true, request_id: 'mock', screen: screen as string, view, actions }
}

interface RefusalOptions {
  back?: Ref
  args?: Record<string, unknown>
  needs?: VillageNeed[]
  action?: string
  subject?: Named
  lots?: BatchLotFailure[]
  min?: number
  max?: number
  remaining?: number
  actions?: MockAct[]
}

/** What a refused command offers next, from what it is missing (internal/presentation/village/screens.go). */
function needsActions(needs: VillageNeed[]): MockAct[] {
  const out: MockAct[] = []
  const seen = new Set<string>()
  const add = (a: MockAct) => { const k = `${a.id}|${a.command}|${JSON.stringify(a.args)}|${a.subject}`; if (!seen.has(k)) { seen.add(k); out.push(a) } }
  for (const n of needs) {
    if (n.kind === 'material') {
      for (const m of n.makers ?? []) {
        if (m.built) add(A('needs.work', 'settlement.work', undefined, { subject: m.building.code }))
        else add(A('needs.build', 'settlement.build.lots', { code: m.building.code }, { subject: m.building.code }))
      }
      if (n.price > 0) add(A('needs.buy', 'settlement.materials.buy', { item: n.item.code, qty: String(Math.max(1, n.need - n.have)) }, { subject: n.item.code }))
    } else if (n.kind === 'knowledge') {
      add(A('needs.knowledge', 'settlement.knowledge'))
    } else {
      for (const o of (n.options ?? []).slice(0, 3)) add(A('needs.build', 'settlement.build.lots', { code: o.code }, { subject: o.code }))
    }
  }
  if (needs.length) add(A('village.materials', 'settlement.materials'))
  return out
}

export function mockRefusal(kind: string, o: RefusalOptions = {}) {
  const needs = o.needs ?? []
  const view: VillageRefusalView = {
    kind, back: o.back ?? { command: 'settlement.overview', args: null }, remaining_seconds: o.remaining ?? 0, min: o.min ?? 0, max: o.max ?? 0,
    lots: o.lots ?? null, action: o.action ?? '', subject: o.subject ?? { code: '', name: '' }, needs: needs.length ? needs : null,
  }
  const args: Record<string, unknown> = { ...(o.min || o.max ? { min: o.min ?? 0, max: o.max ?? 0 } : {}), ...(o.remaining ? { remaining_seconds: o.remaining } : {}), ...(o.args ?? {}) }
  return {
    ok: false, request_id: 'mock', screen: 'village_refusal', view,
    error: { code: `village_${kind}`, ...(Object.keys(args).length ? { args } : {}) },
    actions: [...needsActions(needs), ...(o.actions ?? []), back(view.back.command)],
  }
}
