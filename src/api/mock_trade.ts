// The trade desk (settlement.trade), ?tr=: none (nothing on sale), surplus (default: timber and wheat on sale with surplus and a past market day),
// noclerk (the last market day found no clerk), wage (no wage), nopost (no barter post). ?role=resident: read only.
import { back, mockOk, refreshA } from './mock_neutral'
import type { TradeDeskView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('tr') ?? 'surplus' } catch { return 'surplus' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const head = () => { try { return new URLSearchParams(location.search).get('role') !== 'resident' } catch { return true } }
const on = new Map<string, number>()

function desk(): TradeDeskView {
  const m = mode()
  if (m === 'surplus' && on.size === 0) { on.set('timber', 30); on.set('wheat', 60) }
  const g = (code: string, name: string, stock: number, ref: number) => {
    const keep = on.get(code)
    return { item: N(code, name), stock, reference: ref, unit: Math.round(ref * 0.9), on: keep !== undefined, keep: keep ?? 0, surplus: keep !== undefined ? Math.max(0, stock - keep) : 0 }
  }
  const items = [g('wheat', 'گندم', 120, 9), g('timber', 'چوب', 40, 14), g('stone', 'سنگ', 18, 30), g('wool', 'پشم', 6, 40), g('plank', 'تخته', 0, 28), g('brick', 'آجر', 12, 22), g('cloth', 'پارچه', 3, 70)]
  const sold = { outcome: 'sold', gross: 117 + 540, wage: 120, at: iso(-20), lines: [{ item: N('timber', 'چوب'), qty: 9, unit: 13 }, { item: N('wheat', 'گندم'), qty: 60, unit: 8 }] }
  const last = m === 'none' ? null : m === 'noclerk' ? { outcome: 'no_clerk', gross: 0, wage: 0, at: iso(-20), lines: null } : m === 'wage' ? { outcome: 'no_wage', gross: 0, wage: 0, at: iso(-20), lines: null } : sold
  return { name: 'آمل', has_post: m !== 'nopost', cap: 80, price_bps: 9000, prospect: [...on].reduce((a, [c, k]) => a + Math.max(0, (items.find((i) => i.item.code === c)?.stock ?? 0) - k), 0), items, last, may_order: head(), keep_presets: [0, 10, 30, 100],
    next_at: m === 'nopost' ? null : iso(6), clerk: m === 'nopost' ? null : { seat_building: N('barter_post', 'بازارچه'), filled: m !== 'noclerk', wage: 120, staffed_by: m !== 'noclerk' ? 'npc' : '' } } as TradeDeskView
}

export function mockTradeCommand(command: string, args: Record<string, unknown>) {
  if (command !== 'settlement.trade') return null
  if (args.action === 'keep') on.set(String(args.code), Number(args.n ?? 0))
  if (args.action === 'off') on.delete(String(args.code))
  return mockOk('trade', desk(), [back('settlement.materials'), refreshA('settlement.trade')])
}
