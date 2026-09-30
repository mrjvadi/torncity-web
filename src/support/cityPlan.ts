// The plan of the Support city: a street grid from the road kit, the lots
// between the streets, and which kit building stands on which lot.
//
// The city is laid out in districts around a central square, with room
// between the buildings (a lot is a paved plot with a lawn margin and street
// trees, the building fills part of it):
//   civic & finance   around the central square: reserve bank, bank, city
//                     hall, exchange, auction house, loan office
//   commerce          east: market, shops, knowledge shop, registry, jobs
//   public services   west: hospital, university, skills school, police
//   residential       north: property office, housing, apartment blocks
//   transport         south edge: bus terminal, train station, airport
//   outskirts         jail, barracks
// Companies of the city take the lots after the services; the rest is filler
// by distance from the centre, with parks. All of it is a pure function of
// the seed, so a player and their neighbour see the same city.

import {
  fits, generateNetwork, planLots, planRoadTiles, seededRng,
  type BuildingKit, type Category, type Fit, type Lot, type Network, type RoadKit, type RoadTile,
} from './cityKit'
import { SERVICES, type SupportService } from './services'

/** One tile of the road kit blown up to 8.6 m: a street of 7-9 m with its sidewalks. */
export const ROAD_SCALE = 3.2
export const ROAD_TOP = 0.0526 * ROAD_SCALE

export interface CompanyRef { id: string; name: string }

export type PlacedKind = 'service' | 'company' | 'filler' | 'park' | 'plaza'

export interface Placed {
  key: string
  kind: PlacedKind
  lot: Lot
  x: number
  z: number
  fit?: Fit
  service?: SupportService
  company?: CompanyRef
}

export interface TreeSpot { x: number; z: number; k: number }

export interface CityPlan {
  net: Network
  M: number
  span: number
  tiles: RoadTile[]
  lots: Lot[]
  placed: Placed[]
  trees: TreeSpot[]
}

/** free ground left around a building, in metres of lot */
const GAP = 14
const MIN_SCALE = 0.5

/** Where each service's district is, as a fraction of the city's span (x east, z south). */
const ANCHOR: Record<string, [number, number]> = {
  reserve: [0, 0], bank: [0, 0], cityhall: [0, 0], exchange: [0, 0], auction: [0, 0], loan: [0, 0],
  market: [0.27, -0.05], shops: [0.27, -0.05], knowledge: [0.27, -0.05], companies: [0.27, -0.05], jobs: [0.27, -0.05],
  hospital: [-0.27, -0.05], university: [-0.27, -0.05], training: [-0.27, -0.05], police: [-0.27, -0.05], missions: [-0.27, -0.05],
  property: [-0.02, -0.3], housing: [-0.02, -0.3],
  bus: [0.05, 0.42], train: [0.22, 0.42], airport: [0.44, 0.3], jail: [-0.44, 0.32], barracks: [-0.44, -0.3],
}
const COMPANY_ANCHOR: [number, number] = [0.34, 0.16]

export function planCity(roads: RoadKit, bkit: BuildingKit, companies: CompanyRef[], seed = 7): CityPlan {
  const R = seededRng(seed)
  // a full street grid: nodes 12 cells (104 m) apart, every edge kept
  const net = generateNetwork(R, { nodesX: 7, nodesZ: 7, spacing: 12, extra: 1 })
  const M = roads.module * ROAD_SCALE
  const tiles = planRoadTiles(roads, net, R, 0.6)
  const lots = planLots(net, M, R, { curb: 0.11, maxLot: 54 })
  const span = Math.max(net.w, net.h) * M

  const cx = (l: Lot) => l[0] + l[2] / 2, cz = (l: Lot) => l[1] + l[3] / 2
  const byDist = (ax: number, az: number) => lots.map((l, i) => ({ i, d: Math.hypot(cx(l) - ax, cz(l) - az) })).sort((a, b) => a.d - b.d)
  const centre = byDist(0, 0)
  const rad = Math.hypot(net.w * M, net.h * M) / 2
  const used = new Set<number>()
  const chosen: Record<string, number> = {}
  const placed: Placed[] = []
  const mk = (i: number, extra: Omit<Placed, 'lot' | 'x' | 'z'>): Placed => ({ lot: lots[i], x: cx(lots[i]), z: cz(lots[i]), ...extra })

  // the central square: the four lots around the crossing in the middle
  for (const { i } of centre.slice(0, 4)) { used.add(i); placed.push(mk(i, { key: `plaza:${i}`, kind: 'plaza' })) }

  const pick = (cands: Fit[]): Fit => {
    cands.sort((a, b) => ((chosen[a.b.id] ?? 0) - (chosen[b.b.id] ?? 0)) + (R() - 0.5) * 1.6 - (a.s - b.s) * 0.4)
    const c = cands[0]
    chosen[c.b.id] = (chosen[c.b.id] ?? 0) + 1
    return c
  }
  const put = (order: { i: number }[], cats: Category[], extra: Omit<Placed, 'lot' | 'x' | 'z' | 'fit'>): boolean => {
    for (const { i } of order) {
      if (used.has(i)) continue
      const cands = fits(bkit, cats, lots[i], GAP, Infinity, MIN_SCALE)
      if (!cands.length) continue
      used.add(i)
      placed.push(mk(i, { ...extra, fit: pick(cands) }))
      return true
    }
    return false
  }

  const order = [...SERVICES].sort((a, b) => b.weight - a.weight)
  for (const s of order) {
    const [ax, az] = ANCHOR[s.id] ?? [0, 0]
    const near = byDist(ax * span, az * span)
    const extra = { key: 'svc:' + s.id, kind: 'service' as const, service: s }
    if (!put(near, s.cats, extra)) put(near, ['apartment', 'office', 'small', 'factory'], extra)
  }
  const coNear = byDist(COMPANY_ANCHOR[0] * span, COMPANY_ANCHOR[1] * span)
  for (const c of companies.slice(0, 24)) put(coNear, ['office', 'factory', 'small'], { key: 'co:' + c.id, kind: 'company', company: c })

  // the rest: filler by distance from the centre, parks between
  let n = 0
  for (const { i, d } of centre) {
    if (used.has(i)) continue
    const dist = d / rad + (R() - 0.5) * 0.2
    const nk = (kind: PlacedKind, fit?: Fit): Placed => mk(i, { key: `${kind}:${n++}`, kind, fit })
    if (R() < (dist > 0.3 ? 0.24 : 0.12)) { placed.push(nk('park')); continue }
    const cat: Category = dist < 0.28 ? 'tower' : dist < 0.45 ? (R() < 0.55 ? 'office' : 'apartment') : dist < 0.7 ? (R() < 0.6 ? 'apartment' : 'office') : (R() < 0.7 ? 'factory' : 'small')
    let cands = fits(bkit, [cat], lots[i], GAP, Infinity, MIN_SCALE)
    if (!cands.length) cands = fits(bkit, ['office', 'apartment', 'factory', 'small'], lots[i], GAP, 70, MIN_SCALE)
    if (!cands.length) { placed.push(nk('park')); continue }
    placed.push(nk('filler', pick(cands)))
  }

  // street trees along the lot edges
  const trees: TreeSpot[] = []
  for (const p of placed) {
    if (p.kind === 'park' || p.kind === 'plaza') continue
    const [lx, lz, lw, ld] = p.lot
    const inset = 2.6
    for (let t = 6; t < lw - 3; t += 15) { if (R() < 0.7) trees.push({ x: lx + t, z: lz + inset, k: 0.55 + R() * 0.3 }); if (R() < 0.7) trees.push({ x: lx + t, z: lz + ld - inset, k: 0.55 + R() * 0.3 }) }
  }
  return { net, M, span, tiles, lots, placed, trees }
}
