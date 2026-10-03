// Offline roads that open land (ADR 0044 5.5), for ?mock=1. The server routes a road over the world's tiles and
// then lot by lot; the mock draws a straight staircase from the nearest road or hall to the chosen lot, which is
// enough for the screens to have something real to show: a quote, a stored plan, the lots along it for sale, the
// road laid by the first purchase, a tile of water that costs more.

import type { LandCell, RoadClassOption, RoadQuoteView } from './views.gen'
import type { LayoutLand, LayoutOpenLot, LayoutRoadCell, LayoutRoadPlan } from './types'

export interface MCell { x: number; y: number; plan: string; built: boolean; water?: 'stream' | 'river'; height_m: number }
export interface MOpen { x: number; y: number; plan: string; serves: { x: number; y: number }; dist: number; buildable: boolean; reason?: 'water' | 'steep'; height_m: number; slope_m: number }
export interface MPlan { id: string; cls: string; to: { x: number; y: number }; cells: MCell[] }

export const land = { plans: [] as MPlan[], cells: new Map<string, MCell>(), open: new Map<string, MOpen>(), next: 1 }
export const keyOf = (x: number, y: number) => `${x},${y}`

/** What the mock village tells the land about itself. */
export interface LandHost {
  gridSize(): number
  height(x: number, y: number): number
  wet(x: number, y: number): boolean
  /** A building, a hall or somebody's lot: a road cannot go there. */
  blocked(x: number, y: number): boolean
  anchors(): { x: number; y: number }[]
  roadCost: number
  crossCost: number
  slopeLimit: number
}

export const DEPTH = 2
export const MAX_LOTS = 1500
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]

const inGrid = (h: LandHost, x: number, y: number) => x >= 0 && y >= 0 && x < h.gridSize() && y < h.gridSize()

export interface Draft {
  error?: string
  cls: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  cells: MCell[]
  open: MOpen[]
  climb: number
  maxGrade: number
}

/** A road from the nearest road or hall to (tx, ty). */
export function draft(h: LandHost, to: { x: number; y: number }, cls: string): Draft {
  const d: Draft = { cls, from: { x: 0, y: 0 }, to, cells: [], open: [], climb: 0, maxGrade: 0 }
  const anchors = [...h.anchors(), ...[...land.cells.values()].map((c) => ({ x: c.x, y: c.y }))]
  if (!anchors.length) return { ...d, error: 'road_no_network' }
  if (anchors.some((a) => a.x === to.x && a.y === to.y)) return { ...d, error: 'road_same' }
  let best = anchors[0], bd = Infinity
  for (const a of anchors) {
    const dd = (a.x - to.x) ** 2 + (a.y - to.y) ** 2
    if (dd < bd || (dd === bd && (a.y < best.y || (a.y === best.y && a.x < best.x)))) { best = a; bd = dd }
  }
  d.from = best
  if (h.blocked(to.x, to.y) && !land.cells.has(keyOf(to.x, to.y))) return { ...d, error: 'road_end_blocked' }
  const lotM = 30.5
  const cells = new Map<string, MCell>()
  let x = best.x, y = best.y
  const total = { x: Math.abs(to.x - x), y: Math.abs(to.y - y) }
  let run = 0, last = h.height(x, y)
  for (let guard = 0; (x !== to.x || y !== to.y) && guard < 10_000; guard++) {
    const mx = Math.abs(to.x - x), my = Math.abs(to.y - y)
    if (mx > 0 && (my === 0 || mx * Math.max(1, total.y) >= my * Math.max(1, total.x))) x += Math.sign(to.x - x)
    else y += Math.sign(to.y - y)
    const k = keyOf(x, y)
    const existing = land.cells.get(k)
    if (existing) { run = 0; last = existing.height_m; continue }
    if (h.blocked(x, y)) return { ...d, error: 'road_no_route' }
    const height = h.height(x, y)
    const wet = h.wet(x, y)
    run = wet ? run + 1 : 0
    if (run > 2) return { ...d, error: 'road_no_bridge' }
    if (height > last) d.climb += height - last
    d.maxGrade = Math.max(d.maxGrade, Math.round((Math.abs(height - last) / lotM) * 10_000))
    last = height
    cells.set(k, { x, y, plan: '', built: false, ...(wet ? { water: 'stream' as const } : {}), height_m: Math.round(height * 100) / 100 })
    if (cells.size > MAX_LOTS) return { ...d, error: 'road_too_long' }
  }
  if (!cells.size) return { ...d, error: 'road_same' }
  d.cells = [...cells.values()]
  // the lots along the roads (the new ones and the old ones) open for sale, DEPTH lots deep
  const roadSet = new Set<string>([...land.cells.keys(), ...cells.keys()])
  const seen = new Set<string>()
  let frontier = [...roadSet].map((k) => { const [a, b] = k.split(',').map(Number); return { x: a, y: b, serves: { x: a, y: b } } })
  for (let dist = 1; dist <= DEPTH; dist++) {
    const next: typeof frontier = []
    for (const f of frontier) {
      for (const [dx, dy] of DIRS) {
        const a = f.x + dx, b = f.y + dy, k = keyOf(a, b)
        if (roadSet.has(k) || seen.has(k) || inGrid(h, a, b)) continue
        seen.add(k)
        next.push({ x: a, y: b, serves: f.serves })
        if (land.open.has(k)) continue
        const hh = h.height(a, b)
        let slope = 0
        for (const [ex, ey] of DIRS) slope = Math.max(slope, Math.abs(hh - h.height(a + ex, b + ey)))
        const wet = h.wet(a, b)
        const steep = slope > h.slopeLimit * 3
        d.open.push({
          x: a, y: b, plan: '', serves: f.serves, dist, buildable: !wet && !steep, ...(wet ? { reason: 'water' as const } : steep ? { reason: 'steep' as const } : {}),
          height_m: Math.round(hh * 100) / 100, slope_m: Math.round(slope * 10) / 10,
        })
      }
    }
    frontier = next
  }
  return d
}

export const CLASSES = [
  { code: 'path', name: 'راه مالرو', needs: [] as string[] },
  { code: 'track', name: 'جادهٔ خاکی', needs: ['masonry'] },
]

export function quoteView(h: LandHost, dr: Draft, village: string, id: string, have: (k: string) => boolean): RoadQuoteView {
  const crossings = dr.cells.filter((c) => c.water).length
  const options: RoadClassOption[] = CLASSES.map((c) => {
    const missing = c.needs.filter((k) => !have(k))
    return { class: { code: c.code, name: c.name }, lot_cost: Math.round(h.roadCost * (c.code === 'track' ? 1.5 : 1)), available: missing.length === 0, missing: missing.map((k) => ({ code: k, name: k })) }
  })
  const mult = dr.cls === 'track' ? 1.5 : 1
  const lotCost = Math.round(h.roadCost * mult)
  const crossCost = Math.round(h.crossCost * mult)
  const cls = CLASSES.find((c) => c.code === dr.cls) ?? CLASSES[0]
  const state = (o: MOpen): LandCell['state'] => (o.reason === 'water' ? 'water' : o.reason === 'steep' ? 'steep' : 'free')
  return {
    settlement_name: village, settlement_id: id, plan_id: '', from: dr.from, to: dr.to, class: { code: cls.code, name: cls.name }, options,
    lots: dr.cells.length, crossings, length_m: Math.round(dr.cells.length * 30.5), climb_m: Math.round(dr.climb), max_grade_bps: dr.maxGrade,
    lot_cost: lotCost, crossing_cost: crossCost, full_cost: (dr.cells.length - crossings) * lotCost + crossings * crossCost,
    opens: dr.open.length, usable: dr.open.filter((o) => o.buildable).length, water: dr.open.filter((o) => o.reason === 'water').length,
    steep: dr.open.filter((o) => o.reason === 'steep').length,
    path: dr.cells.map((c) => ({ x: c.x, y: c.y })),
    open_cells: dr.open.map((o) => ({ x: o.x, y: o.y, state: state(o), owner: '', building: '', access: '', roads: 0, crossings: 0, cost: 0 })),
  }
}

/** Stores a drafted road. */
export function store(dr: Draft): MPlan {
  const id = `plan-${land.next++}`
  const plan: MPlan = { id, cls: dr.cls, to: dr.to, cells: dr.cells.map((c) => ({ ...c, plan: id })) }
  land.plans.push(plan)
  plan.cells.forEach((c) => land.cells.set(keyOf(c.x, c.y), c))
  for (const o of dr.open) land.open.set(keyOf(o.x, o.y), { ...o, plan: id })
  return plan
}

/** The plan with the cell chain from its start: the cells to lay for `serves` are every unbuilt cell up to it. */
export function chainFor(serves: { x: number; y: number }): MCell[] {
  const c = land.cells.get(keyOf(serves.x, serves.y))
  if (!c) return []
  const plan = land.plans.find((p) => p.id === c.plan)
  if (!plan) return []
  const upto = plan.cells.findIndex((q) => q.x === c.x && q.y === c.y)
  return plan.cells.slice(0, upto + 1).filter((q) => !q.built)
}

export interface OuterAccess { kind: 'road' | 'needs_road' | 'needs_bridge'; roads: number; crossings: number; cost: number; path: { x: number; y: number }[]; chain: MCell[] }

/** How a lot beyond the grid is served: the lane to the road cell (depth - 1 lots) and the unlaid road up to it. */
export function accessOf(h: LandHost, x: number, y: number): OuterAccess | null {
  const o = land.open.get(keyOf(x, y))
  if (!o) return null
  const chain = chainFor(o.serves)
  const crossings = chain.filter((c) => c.water).length
  const lane = o.dist - 1
  const roads = chain.length - crossings + lane
  const cost = roads * h.roadCost + crossings * h.crossCost
  const path = [...chain.map((c) => ({ x: c.x, y: c.y }))]
  // the lane: straight from the lot to its road cell
  for (let i = 1; i <= lane; i++) path.push({ x: o.x + Math.sign(o.serves.x - o.x) * Math.min(i, Math.abs(o.serves.x - o.x)), y: o.y + (o.serves.x === o.x ? Math.sign(o.serves.y - o.y) * i : 0) })
  return { kind: cost === 0 ? 'road' : crossings > 0 ? 'needs_bridge' : 'needs_road', roads, crossings, cost, path, chain }
}

/** The land as the layout carries it (members). */
export function layoutLand(): LayoutLand | undefined {
  if (!land.plans.length) return undefined
  const plans: LayoutRoadPlan[] = land.plans.map((p) => ({ id: p.id, class: p.cls, lots: p.cells.length, to_x: p.to.x, to_y: p.to.y }))
  const cells: LayoutRoadCell[] = [...land.cells.values()].map((c) => ({ x: c.x, y: c.y, plan: c.plan, built: c.built, ...(c.water ? { water: c.water } : {}), height_m: c.height_m }))
  const open: LayoutOpenLot[] = [...land.open.values()].map((o) => ({ x: o.x, y: o.y, buildable: o.buildable, ...(o.reason ? { reason: o.reason } : {}), height_m: o.height_m, slope_m: o.slope_m, biome: 'temperate_grassland', tags: o.reason === 'steep' ? ['sloped_lot'] : [] }))
  return { plans, cells, open }
}
