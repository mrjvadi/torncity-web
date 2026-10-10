// The citizen loop's view of the layout (contract 1.4): what a tapped lot is
// (free to buy, the viewer's own, someone else's, built on) and the tint of
// the land map. Pure functions over the layout the server last sent.

import type { LandStuff, LayoutBuilding, VillageLayout } from '../../api/types'
import {
  TONE_BRIDGE, TONE_LOCKED, TONE_NEEDS, TONE_NONE, TONE_OK, TONE_OWN, TONE_OWN_LOCKED, TONE_TAKEN,
} from '../../village/lotOverlay'

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

/** How each lot is served by road (docs/adr/0043), by "x,y": the access kinds of settlement.land
 * (road, needs_road, needs_bridge, none) for the free lots and the viewer's bare lots. */
export type LotAccessMap = ReadonlyMap<string, string>

/** The tint of the land map: free lots green when a road touches them, yellow when a road must be
 * laid, blue when it crosses water, red when none can reach them; the viewer's own gold (orange
 * when no road touches the lot), others' grey-blue; everything else (water, buildings) untinted. */
export function tonesForLand(layout: VillageLayout, access?: LotAccessMap): Uint8Array {
  const n = layout.grid.lots
  const out = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = classifyLot(layout, x, y)
      const a = access?.get(`${x},${y}`)
      let tone = TONE_NONE
      if (k.kind === 'free') tone = a === 'needs_road' ? TONE_NEEDS : a === 'needs_bridge' ? TONE_BRIDGE : a === 'none' ? TONE_LOCKED : TONE_OK
      else if (k.kind === 'mine') tone = a && a !== 'road' ? TONE_OWN_LOCKED : TONE_OWN
      else if (k.kind === 'taken') tone = TONE_TAKEN
      out[y * n + x] = tone
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

/** The trees and rocks the server counts on a lot of the grid, the woodland ring or the open land (ADR 0065); null when the lot is not in the layout. */
export function landAt(layout: VillageLayout, x: number, y: number): LandStuff | null {
  const g = layout.lots[y]?.[x]
  if (g) return g
  const r = layout.ring?.lots?.find((l) => l.x === x && l.y === y)
  if (r) return r
  return layout.land?.open?.find((l) => l.x === x && l.y === y) ?? null
}

/** What a clearing order asks for on a lot: both when both stand, else the one that does; null when nothing stands. */
export function clearWhat(l: LandStuff | null): 'trees' | 'rocks' | 'all' | null {
  const t = (l?.trees ?? 0) > 0, r = (l?.rocks ?? 0) > 0
  return t && r ? 'all' : t ? 'trees' : r ? 'rocks' : null
}
