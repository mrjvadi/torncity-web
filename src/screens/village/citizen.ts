// The citizen loop's view of the layout (contract 1.4): what a tapped lot is
// (free to buy, the viewer's own, someone else's, built on) and the tint of
// the land map. Pure functions over the layout the server last sent.

import type { LayoutBuilding, VillageLayout } from '../../api/types'
import { TONE_NONE, TONE_OK, TONE_OWN, TONE_TAKEN } from '../../village/lotOverlay'

export type LotKind =
  | { kind: 'free' }
  | { kind: 'mine' }
  | { kind: 'taken'; owner?: string }
  | { kind: 'building'; building: LayoutBuilding }
  | { kind: 'blocked' }

/** The building whose footprint covers a lot, if any. */
export function buildingAt(layout: VillageLayout, x: number, y: number): LayoutBuilding | null {
  for (const b of layout.buildings) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b
  }
  return null
}

/** What a lot is to this viewer. A building on it comes first; then who owns
 * it; then whether it can be bought at all. */
export function classifyLot(layout: VillageLayout, x: number, y: number): LotKind {
  if (x < 0 || y < 0 || y >= layout.lots.length || x >= (layout.lots[y]?.length ?? 0)) return { kind: 'blocked' }
  const b = buildingAt(layout, x, y)
  if (b) return { kind: 'building', building: b }
  const t = (layout.tenure ?? []).find((l) => l.x === x && l.y === y)
  if (t) return t.mine ? { kind: 'mine' } : { kind: 'taken', owner: t.owner }
  return layout.lots[y][x].buildable ? { kind: 'free' } : { kind: 'blocked' }
}

/** The tint of the land map: free lots green, the viewer's own gold, others'
 * grey-blue; everything else (water, buildings) untinted. */
export function tonesForLand(layout: VillageLayout): Uint8Array {
  const n = layout.grid.lots
  const out = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = classifyLot(layout, x, y)
      out[y * n + x] = k.kind === 'free' ? TONE_OK : k.kind === 'mine' ? TONE_OWN : k.kind === 'taken' ? TONE_TAKEN : TONE_NONE
    }
  }
  return out
}

/** How many lots the viewer owns that carry no building: where a house can go. */
export function freeOwnLots(layout: VillageLayout): number {
  let n = 0
  for (const t of layout.tenure ?? []) if (t.mine && classifyLot(layout, t.x, t.y).kind === 'mine') n++
  return n
}
