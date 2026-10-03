// The land the roads opened beyond the first grid (ADR 0044 5.5): pure functions over the layout and the
// answers of the land and build commands. Lot coordinates are absolute and may be negative (west and south of
// the first grid); the first grid's own lots stay in the dense arrays the other helpers read.

import type { LandCell, LotCell, LotGridView, VillageLayout } from '../../api/types'
import type { OuterCell } from '../../village/landOverlay'
import {
  TONE_BAD, TONE_BRIDGE, TONE_LOCKED, TONE_NEEDS, TONE_OK, TONE_OWN, TONE_OWN_LOCKED, TONE_PICK, TONE_TAKEN,
} from '../../village/lotOverlay'
import { buildingAt, type LotAccessMap } from './citizen'

export type OuterKind =
  | { kind: 'free' }
  | { kind: 'mine' }
  | { kind: 'taken'; owner?: string }
  | { kind: 'building' }
  | { kind: 'road'; built: boolean }
  | { kind: 'water' }
  | { kind: 'steep' }
  | { kind: 'closed' }

const key = (x: number, y: number) => `${x},${y}`

/** Whether a lot lies in the first grid. */
export function inFirstGrid(layout: VillageLayout, x: number, y: number): boolean {
  const n = layout.grid.lots
  return x >= 0 && y >= 0 && x < n && y < n
}

/** What a lot beyond the first grid is to this viewer. A lot no road opened is `closed`. */
export function classifyOuter(layout: VillageLayout, x: number, y: number): OuterKind {
  const land = layout.land
  if (!land) return { kind: 'closed' }
  const cell = land.cells.find((c) => c.x === x && c.y === y)
  if (cell) return { kind: 'road', built: cell.built }
  const open = land.open.find((o) => o.x === x && o.y === y)
  if (!open) return { kind: 'closed' }
  if (buildingAt(layout, x, y)) return { kind: 'building' }
  const t = (layout.tenure ?? []).find((l) => l.x === x && l.y === y)
  if (t) return t.mine ? { kind: 'mine' } : { kind: 'taken', owner: t.owner }
  if (open.reason === 'water') return { kind: 'water' }
  if (open.reason === 'steep') return { kind: 'steep' }
  return { kind: 'free' }
}

/** The tint of every lot the roads opened, by what the lot is (the build menu and the road tool). */
export function outerFromLayout(layout: VillageLayout): OuterCell[] {
  const land = layout.land
  if (!land) return []
  const out: OuterCell[] = []
  for (const c of land.cells) out.push({ x: c.x, y: c.y, tone: c.built ? TONE_TAKEN : TONE_PICK })
  for (const o of land.open) {
    const k = classifyOuter(layout, o.x, o.y)
    out.push({ x: o.x, y: o.y, tone: k.kind === 'free' ? TONE_OK : k.kind === 'water' || k.kind === 'steep' ? TONE_BAD : TONE_TAKEN })
  }
  return out
}

/** The land map: free lots by how a road serves them (the land screen's access answer), the viewer's own gold. */
export function outerForLand(layout: VillageLayout, access?: LotAccessMap): OuterCell[] {
  const land = layout.land
  if (!land) return []
  const out: OuterCell[] = []
  for (const c of land.cells) out.push({ x: c.x, y: c.y, tone: c.built ? TONE_TAKEN : TONE_PICK })
  for (const o of land.open) {
    const k = classifyOuter(layout, o.x, o.y)
    const a = access?.get(key(o.x, o.y))
    let tone = TONE_TAKEN
    if (k.kind === 'free') tone = a === 'needs_road' ? TONE_NEEDS : a === 'needs_bridge' ? TONE_BRIDGE : a === 'none' ? TONE_LOCKED : TONE_OK
    else if (k.kind === 'mine') tone = a && a !== 'road' ? TONE_OWN_LOCKED : TONE_OWN
    else if (k.kind === 'water' || k.kind === 'steep') tone = TONE_BAD
    out.push({ x: o.x, y: o.y, tone })
  }
  return out
}

/** The lot of a build answer at (x, y), in the first grid or beyond it. */
export function lotCellAt(lots: LotGridView, x: number, y: number): LotCell | undefined {
  const n = lots.grid_lots
  if (x >= 0 && y >= 0 && x < n && y < n) return lots.rows?.[y]?.[x]
  return outerIndex(lots).get(key(x, y))
}

const indexes = new WeakMap<object, Map<string, LotCell>>()
function outerIndex(lots: LotGridView): Map<string, LotCell> {
  let m = indexes.get(lots)
  if (!m) {
    m = new Map()
    for (const c of lots.outer ?? []) m.set(key(c.x, c.y), c)
    indexes.set(lots, m)
  }
  return m
}

/** The tint of the build picker for the lots beyond the first grid. */
export function outerFromLots(lots: LotGridView, picks: { x: number; y: number }[] = [], bad: { x: number; y: number }[] = []): OuterCell[] {
  const out: OuterCell[] = []
  for (const c of lots.outer ?? []) {
    out.push({ x: c.x, y: c.y, tone: c.fits ? TONE_OK : c.state === 'water' || c.state === 'steep' ? TONE_BAD : c.state === 'planned' ? TONE_PICK : TONE_TAKEN })
  }
  const picked = new Set(picks.map((p) => key(p.x, p.y)))
  const refused = new Set(bad.map((p) => key(p.x, p.y)))
  return out.map((c) => (picked.has(key(c.x, c.y)) ? { ...c, tone: TONE_PICK } : refused.has(key(c.x, c.y)) ? { ...c, tone: TONE_BAD } : c))
}

/** The access of every free lot the land screen reports beyond the first grid, by "x,y". */
export function outerAccess(cells: readonly LandCell[] | null | undefined): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of cells ?? []) if (c.access) m.set(key(c.x, c.y), c.access)
  return m
}
