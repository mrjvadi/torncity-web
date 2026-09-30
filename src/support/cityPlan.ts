// The plan of the Support city: a street grid from the road kit, the lots
// between the streets, and which kit building stands on which lot. Services
// take the lots that suit them (the bank and the reserve in the middle, the
// terminals and the barracks on the outskirts), the companies of the city
// come next, the rest is filler by distance from the centre, and some lots
// stay parks. All of it is a pure function of the seed, so a player and their
// neighbour see the same city.

import {
  fits, generateNetwork, planLots, planRoadTiles, seededRng,
  type BuildingKit, type Category, type Fit, type Lot, type Network, type RoadKit, type RoadTile,
} from './cityKit'
import { SERVICES, type SupportService } from './services'

/** One tile of the road kit blown up to 13.5 m. */
export const ROAD_SCALE = 5
export const ROAD_TOP = 0.0526 * ROAD_SCALE

export interface CompanyRef { id: string; name: string }

export type PlacedKind = 'service' | 'company' | 'filler' | 'park'

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

export interface CityPlan {
  net: Network
  M: number
  span: number
  tiles: RoadTile[]
  lots: Lot[]
  placed: Placed[]
}

const GAP = 3

export function planCity(roads: RoadKit, bkit: BuildingKit, companies: CompanyRef[], seed = 7): CityPlan {
  const R = seededRng(seed)
  const net = generateNetwork(R, { nodesX: 6, nodesZ: 6, spacing: 8, extra: 0.8 })
  const M = roads.module * ROAD_SCALE
  const tiles = planRoadTiles(roads, net, R, 0.6)
  const lots = planLots(net, M, R, { curb: 0.11, maxLot: 66 })
  const span = Math.max(net.w, net.h) * M

  const centre = lots.map((l, i) => ({ i, d: Math.hypot(l[0] + l[2] / 2, l[1] + l[3] / 2) })).sort((a, b) => a.d - b.d)
  const rad = Math.hypot(net.w * M, net.h * M) / 2
  const used = new Set<number>()
  const chosen: Record<string, number> = {}
  const placed: Placed[] = []

  const pick = (cands: Fit[]): Fit => {
    cands.sort((a, b) => ((chosen[a.b.id] ?? 0) - (chosen[b.b.id] ?? 0)) + (R() - 0.5) * 1.6 - (a.s - b.s) * 0.4)
    const c = cands[0]
    chosen[c.b.id] = (chosen[c.b.id] ?? 0) + 1
    return c
  }
  const put = (order: { i: number }[], cats: Category[], make: (lot: Lot, fit: Fit) => Partial<Placed> & { key: string; kind: PlacedKind }): boolean => {
    for (const { i } of order) {
      if (used.has(i)) continue
      const cands = fits(bkit, cats, lots[i], GAP)
      if (!cands.length) continue
      const fit = pick(cands)
      used.add(i)
      const lot = lots[i]
      placed.push({ lot, x: lot[0] + lot[2] / 2, z: lot[1] + lot[3] / 2, fit, ...make(lot, fit) })
      return true
    }
    return false
  }

  const inner = SERVICES.filter((s) => !s.outer)
  const outer = SERVICES.filter((s) => s.outer)
  const far = [...centre].reverse()
  for (const s of inner) if (!put(centre, s.cats, () => ({ key: 'svc:' + s.id, kind: 'service', service: s }))) put(centre, ['apartment', 'office', 'small'], () => ({ key: 'svc:' + s.id, kind: 'service', service: s }))
  for (const s of outer) if (!put(far, s.cats, () => ({ key: 'svc:' + s.id, kind: 'service', service: s }))) put(far, ['factory', 'small', 'apartment'], () => ({ key: 'svc:' + s.id, kind: 'service', service: s }))
  for (const c of companies.slice(0, 24)) put(centre, ['office', 'factory', 'small'], () => ({ key: 'co:' + c.id, kind: 'company', company: c }))

  // the rest: filler by distance from the centre, parks at the edge
  let n = 0
  for (const { i, d } of centre) {
    if (used.has(i)) continue
    const lot = lots[i]
    const dist = d / rad + (R() - 0.5) * 0.22
    const mk = (kind: PlacedKind, fit?: Fit): Placed => ({ key: `${kind}:${n++}`, kind, lot, x: lot[0] + lot[2] / 2, z: lot[1] + lot[3] / 2, fit })
    if (dist > 0.4 && R() < 0.16) { placed.push(mk('park')); continue }
    const cat: Category = dist < 0.3 ? 'tower' : dist < 0.48 ? (R() < 0.6 ? 'office' : 'apartment') : dist < 0.72 ? (R() < 0.55 ? 'apartment' : 'office') : (R() < 0.75 ? 'factory' : 'small')
    let cands = fits(bkit, [cat], lot, GAP)
    if (!cands.length) cands = fits(bkit, ['office', 'apartment', 'factory', 'small'], lot, GAP, 60)
    if (!cands.length) { placed.push(mk('park')); continue }
    placed.push(mk('filler', pick(cands)))
  }
  return { net, M, span, tiles, lots, placed }
}
