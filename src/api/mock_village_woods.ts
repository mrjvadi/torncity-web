// The land of the mock village (ADR 0065), with ?mock=1&land=1 (the countryside a third gone) or land=full (untouched): trees, rocks, stumps and
// saplings on the grid and on the woodland ring, a place refusal `obstructed`, and the clearing order and its cancel.
import { A, back, mockOk } from './mock_neutral'
import type { LayoutLot, LayoutRingLot } from './types'
import type { ClearOrderView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('land') ?? '' } catch { return '' } }
export const landOn = () => mode() !== ''
const h = (x: number, y: number, k: number) => { let v = Math.imul(x + 40, 73856093) ^ Math.imul(y + 40, 19349663) ^ Math.imul(k, 83492791); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296 }
const ordered = new Map<string, { trees: boolean; rocks: boolean }>()
const cleared = new Set<string>()

const stuff = (x: number, y: number, ring: boolean, biome: string) => {
  const key = `${x},${y}`
  const core = !ring && x >= 1 && x <= 3 && y >= 1 && y <= 3
  const wooded = /forest/.test(biome)
  let trees = 0, rocks = 0, stumps = 0
  const max = ring ? 6 : 3
  for (let k = 0; k < max; k++) if (h(x, y, k) < (ring ? 0.62 : wooded ? 0.35 : 0.1)) trees++
  for (let k = 0; k < 2; k++) if (h(x, y, 10 + k) < 0.14) rocks++
  if (h(x, y, 20) < 0.3) stumps = 1 + Math.floor(h(x, y, 21) * 3)
  if (core || cleared.has(key)) { trees = 0; rocks = 0 }
  const o = ordered.get(key)
  const saplings = ring && h(x, y, 30) < 0.12 ? [{ stage: 0.2 + h(x, y, 31) * 0.6 }] : []
  return { trees, rocks, stumps, saplings, ordered: o ? { trees: o.trees, rocks: o.rocks } : { trees: false, rocks: false }, obstructed: trees > 0 || rocks > 0 }
}

export const landAtMock = (x: number, y: number, biome = 'temperate_forest') => stuff(x, y, x < 0 || y < 0 || x > 6 || y > 6, biome)

export function withGridLand(lots: LayoutLot[][]): LayoutLot[][] {
  return lots.map((row, y) => row.map((l, x) => ({ ...l, ...stuff(x, y, false, l.biome) })))
}

export function ringLots(n: number): LayoutRingLot[] {
  const out: LayoutRingLot[] = []
  const depth = 3
  for (let y = -depth; y < n + depth; y++) for (let x = -depth; x < n + depth; x++) {
    if (x >= 0 && x < n && y >= 0 && y < n) continue
    out.push({ x, y, height_m: 1790, slope_m: 1.2, biome: 'temperate_forest', ...stuff(x, y, true, 'temperate_forest') })
  }
  return out
}

export const woods = () => ({ mark: `m${cleared.size}${ordered.size}`, forest_remaining_bps: mode() === 'full' ? 10000 : 5200 })

/** The place refusal of an obstructed lot, or null. */
export function obstructedAt(lots: { x: number; y: number }[], n: number) {
  for (const p of lots) {
    if (p.x < 0 || p.y < 0 || p.x >= n || p.y >= n) continue
    const s = stuff(p.x, p.y, false, 'temperate_forest')
    if (s.obstructed) return { x: p.x, y: p.y, trees: s.trees, rocks: s.rocks, can_order: true }
  }
  return null
}

export function clearCommand(command: string, args: Record<string, unknown>) {
  const x = Number(args.x), y = Number(args.y)
  const key = `${x},${y}`
  const s = stuff(x, y, x < 0 || y < 0 || x > 6 || y > 6, 'temperate_forest')
  const view = (cancelled: boolean): ClearOrderView => ({ village: 'آمل', x, y, trees: s.trees, rocks: s.rocks, order_trees: ordered.get(key)?.trees ?? false, order_rocks: ordered.get(key)?.rocks ?? false, cancelled, private: false })
  if (command === 'settlement.clear.order') {
    const what = String(args.what ?? 'all')
    ordered.set(key, { trees: what !== 'rocks', rocks: what !== 'trees' })
    return mockOk('clear_order', view(false), [A('clear.cancel', 'settlement.clear.cancel', { x: String(x), y: String(y) }, { kind: 'danger' }), back('settlement.overview')])
  }
  ordered.delete(key)
  return mockOk('clear_order', view(true), [back('settlement.overview')])
}
