// Offline village for ?mock=1: the world, the layout (with ETag/304), the
// player roster, the village commands with their refusals and views, and a
// live event feed on the settlement bus (client-api.md sections 4.3, 5.4,
// 5.5). Everything here is a stand-in for the server: shapes follow the
// contract, values are plausible Persian sample data.

import { SOCIETY_CONTENT, mergeTables } from './mock_society'
import { ECONOMY_CONTENT } from './mock_economy'
import { COMPANIES_CONTENT } from './mock_companies'
import { MILITARY_CONTENT } from './mock_military'
import { P1_CONTENT } from './mock_p0'
import type {
  BuildingState, LayoutBuilding, LayoutFarm, LayoutLot, SettlementEvent, SettlementPlayers, VillageLayout, BootstrapSettlement,
} from './types'
import { LIFE_CONTENT } from './mock_life'
import { ACTIVITIES_CONTENT } from './mock_act_content'
import { publishSettlement } from './settlementBus'
import type { BuildingOverlay, ElectionData, GoalData } from '../state/syncTypes'
import { latLonToTile, offsetLatLon } from '../village/geo'
import { MOCK_WORLD, mockChunkBytes, mockHeight, mockVillagePlace, RIVER_GY, RIVER_HALF_TILES, MOCK_FACE } from './mock_village_world'

import { MOCK_VILLAGE_IDS } from './mock_village_ids'
import * as landMock from './mock_village_land'
import { mockLaborCommand, laborProgressLines } from './mock_labor'
import { landOn, withGridLand, ringLots, woods, obstructedAt, clearCommand } from './mock_village_woods'
import { ALL_PERMISSIONS, MOCK_ZONE, mockCharter } from './mock_charter'
import { A, back, confirmA, mockOk, mockRefusal, refreshA, type MockAct } from './mock_neutral'
import type {
  BatchLotFailure, BuildMenuView, BuildingView, WorkNode, WorkSlot, ConstructionProgressView, DonateView, KnowledgeListView, LandCell, LotCell, LandView, LotAccessView, LotRepairView, LotBatchConfirmView,
  LotBuyView, LotConfirmView, LotGridView, MaterialBuyView, MaterialsView, MineView, Named, PrivateConfirmView, PrivateLotsView, PrivateMenuView, PromotionView, DevelopmentView,
  ResidenceView, SettlementWhoView, TermsView, Prerequisite, VillageNeed, VillageOverviewView, WorkView,
} from './views.gen'
const OWN_ID = MOCK_VILLAGE_IDS.own
const OTHER_ID = MOCK_VILLAGE_IDS.other
const GRID = 5
/** The grid's side now: the base plus the expansions bought. */
const size = () => GRID + st.growth
/** A gentler limit than the server's 15 so the offline hills stay buildable-looking. */
const SLOPE_LIMIT = 8

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

// -- catalogue -----------------------------------------------------------------

interface CatEntry { capExempt?: boolean; code: string; fa: string; en: string; fp: [number, number]; cost: number; time: number; role: string; needs?: string[]; materials?: [string, string, number][] }

const CAT: CatEntry[] = [
  { code: 'road', fa: 'جاده', en: 'Road', fp: [1, 1], cost: 50, time: 600, role: '', capExempt: true },
  { code: 'civic_hall', fa: 'شهرداری', en: 'City hall', fp: [2, 2], cost: 1000, time: 7200, role: '', materials: [['timber', 'چوب', 5]] },
  { code: 'village_house', fa: 'خانهٔ کوچک', en: 'Village house', fp: [1, 1], cost: 700, time: 2700, role: '', materials: [['timber', 'چوب', 2]] },
  { code: 'housing_block', fa: 'آپارتمان', en: 'Housing block', fp: [2, 2], cost: 3000, time: 10800, role: '', materials: [['timber', 'چوب', 40]] },
  { code: 'park', fa: 'پارک', en: 'Park', fp: [2, 2], cost: 800, time: 3600, role: '' },
  { code: 'watch_hut', fa: 'نگهبانی محله', en: 'Watch hut', fp: [1, 1], cost: 400, time: 1800, role: 'security' },
  { code: 'militia_camp', fa: 'اردوگاه سواران محلی', en: 'Militia camp', fp: [2, 1], cost: 500, time: 2700, role: 'security' },
  { code: 'carpentry_workshop', fa: 'کارگاه نجاری', en: 'Carpentry workshop', fp: [2, 2], cost: 1500, time: 5400, role: 'craft', materials: [['timber', 'چوب', 4]] },
  { code: 'smithy', fa: 'آهنگری', en: 'Smithy', fp: [2, 2], cost: 1800, time: 6000, role: 'craft', needs: ['metallurgy'] },
  { code: 'shaft_well', fa: 'چاه قنات', en: 'Qanat well', fp: [1, 1], cost: 300, time: 1200, role: 'water_infra' },
  { code: 'farm_canal', fa: 'مزرعهٔ نهری', en: 'Canal farm', fp: [3, 3], cost: 2200, time: 7200, role: 'food' },
  { code: 'farm_dry', fa: 'مزرعهٔ دیم', en: 'مزرعهٔ دیم', fp: [3, 3], cost: 1800, time: 6000, role: 'food' },
  { code: 'canal_channel', fa: 'کانال آبرسانی', en: 'کانال آبرسانی', fp: [1, 1], cost: 500, time: 3600, role: 'water_infra' },
  { code: 'water_mill', fa: 'آسیاب آبی', en: 'آسیاب آبی', fp: [2, 2], cost: 2600, time: 7200, role: 'craft' },
  { code: 'mill', fa: 'آسیاب', en: 'آسیاب', fp: [2, 2], cost: 1600, time: 5400, role: 'craft' },
  { code: 'pasture_range', fa: 'چراگاه', en: 'چراگاه', fp: [3, 3], cost: 1200, time: 4800, role: 'food' },
  { code: 'health_house', fa: 'خانهٔ بهداشت', en: 'Health house', fp: [2, 2], cost: 1200, time: 4800, role: 'health' },
  { code: 'teaching_circle', fa: 'کلاس درس', en: 'Village classroom', fp: [1, 1], cost: 200, time: 1500, role: 'education' },
  { code: 'barter_post', fa: 'بازارچه', en: 'Village market', fp: [1, 1], cost: 250, time: 1200, role: 'market' },
  { code: 'woodcutter_camp', fa: 'کارگاه هیزم‌شکنی', en: "Woodcutter's camp", fp: [2, 2], cost: 900, time: 3600, role: 'craft' },
  { code: 'forester_lodge', fa: 'نهالستان', en: 'Forester lodge', fp: [2, 2], cost: 400, time: 3600, role: 'craft' },
  { code: 'paper_mill', fa: 'کارگاه کاغذسازی', en: 'Paper mill', fp: [2, 2], cost: 1600, time: 5400, role: 'craft' },
  { code: 'clay_pit', fa: 'گودال گل', en: 'Clay pit', fp: [2, 2], cost: 700, time: 2700, role: 'extraction' },
  { code: 'tool_workshop', fa: 'کارگاه ابزارسازی', en: 'Tool workshop', fp: [2, 2], cost: 1500, time: 5400, role: 'craft' },
  { code: 'pottery_kiln', fa: 'کوره سفالگری', en: 'Pottery kiln', fp: [2, 2], cost: 1200, time: 4800, role: 'craft' },
  { code: 'granary', fa: 'انبار غله', en: 'Granary', fp: [1, 1], cost: 700, time: 3000, role: 'storage' },
  { code: 'mill', fa: 'آسیاب', en: 'Mill', fp: [2, 2], cost: 1400, time: 5400, role: 'food' },
  { code: 'bakery', fa: 'نانوایی', en: 'Bakery', fp: [2, 2], cost: 1600, time: 5400, role: 'food' },
  { code: 'charcoal_clamp', fa: 'کورهٔ زغال', en: 'Charcoal clamp', fp: [2, 2], cost: 900, time: 3600, role: 'craft' },
  { code: 'iron_pit', fa: 'معدن آهن', en: 'Iron pit', fp: [2, 2], cost: 1500, time: 5400, role: 'extraction' },
  { code: 'bloomery', fa: 'کورهٔ آهن‌گدازی', en: 'Bloomery', fp: [2, 2], cost: 2000, time: 6600, role: 'craft' },
  { code: 'tannery', fa: 'دباغی', en: 'Tannery', fp: [2, 2], cost: 1700, time: 5400, role: 'craft' },
  { code: 'brickworks', fa: 'آجرپزی', en: 'Brickworks', fp: [2, 2], cost: 1500, time: 5400, role: 'craft' },
  { code: 'teahouse_inn', fa: 'مسافرخانه', en: 'Inn', fp: [2, 2], cost: 2200, time: 7200, role: 'hospitality' },
  { code: 'bank', fa: 'بانک', en: 'Bank', fp: [3, 3], cost: 50000, time: 36000, role: '', needs: ['writing'] },
  { code: 'school', fa: 'مدرسه', en: 'School', fp: [3, 3], cost: 9000, time: 14400, role: 'education', needs: ['writing'] },
]
/** The services of the central city and the village building role that gives the village that service itself. */
const SUPPORT_SERVICES = [{ service: 'bank', role: '' }, { service: 'market', role: 'market' }, { service: 'knowledge', role: 'education' }, { service: 'hospital', role: 'health' }]
const KNOW_EN: Record<string, string> = {
  fire_making: 'Fire making', masonry: 'Masonry', irrigation: 'Irrigation', writing: 'Writing', metallurgy: 'Metallurgy', geometry: 'Geometry', archery: 'Archery', carpentry: 'Carpentry',
}
export const KNOW_NAMES: Record<string, string> = {
  carpentry: 'نجاری',
  fire_making: 'آتش‌افروزی', masonry: 'سنگ‌تراشی', irrigation: 'آبیاری', writing: 'خط و نوشتن', metallurgy: 'فلزکاری', geometry: 'هندسه', archery: 'کمانداری',
}
const CONCURRENT_CAP = 3
/** ?role=resident: the viewer is a normal resident, not the head. */
const IS_HEAD = (() => { try { return new URLSearchParams(location.search).get('role') !== 'resident' } catch { return true } })()

// -- state ------------------------------------------------------------------------

interface MBuilding { id: string; type: string; x: number; y: number; w: number; h: number; rotated: boolean; state: BuildingState; started?: number; finish?: number; seed: number; priv?: boolean; owner?: string; mine?: boolean }
interface Knowledge { code: string; state: 'held' | 'researching' | 'available' | 'locked'; cost: number; time: number; buy: number; missing: string[]; terrain: boolean; finish?: number }

const st = {
  seq: 1790724836000,
  ver: 1,
  growth: 0,
  treasury: 24600,
  literacy: 34,
  buildings: [] as MBuilding[],
  roads: [] as { x: number; y: number }[],
  lots: [] as LayoutLot[][],
  otherLots: [] as LayoutLot[][],
  otherBuildings: [] as MBuilding[],
  know: [] as Knowledge[],
  ready: false,
  nextId: 100,
  timers: new Map<string, number>(),
}

function lotNoise(x: number, y: number, s: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
  return (h - Math.floor(h)) * 2 - 1
}

function makeLots(origin: { lat: number; lon: number }, bump: [number, number, number][], n = GRID): LayoutLot[][] {
  const lot = MOCK_WORLD.lot_m
  const rows: LayoutLot[][] = []
  const heights: number[][] = []
  const wet: boolean[][] = []
  for (let y = 0; y < n; y++) {
    heights.push([]); wet.push([])
    for (let x = 0; x < n; x++) {
      const ll = offsetLatLon(origin.lat, origin.lon, x * lot, y * lot, MOCK_WORLD.planet_radius_km)
      const t = latLonToTile(ll.lat, ll.lon, MOCK_WORLD.chunk.max_lod, MOCK_WORLD.chunk.tile_edge)
      let h = mockHeight(t.gx, t.gy) + lotNoise(x, y, 1) * 0.9
      for (const [bx, by, bh] of bump) if (bx === x && by === y) h += bh
      heights[y].push(Math.round(h * 100) / 100)
      wet[y].push(t.face === MOCK_FACE && Math.abs(t.gy - RIVER_GY) < RIVER_HALF_TILES)
    }
  }
  for (let y = 0; y < n; y++) {
    const row: LayoutLot[] = []
    for (let x = 0; x < n; x++) {
      let slope = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
        slope = Math.max(slope, Math.abs(heights[y][x] - heights[ny][nx]))
      }
      slope = Math.round(slope * 10) / 10
      // (the offline river only crosses the founding lots; bought land is dry ground)
      const river = wet[y][x] && x < GRID && y < GRID
      const tags = ['temperate_grassland']
      if (river) tags.push('river_lot')
      if (slope > SLOPE_LIMIT) tags.push('sloped_lot')
      row.push({
        height_m: heights[y][x], slope_m: slope, buildable: !river && slope <= SLOPE_LIMIT, biome: 'temperate_grassland',
        ...(river ? { water: 'river' as const } : {}), tags,
      })
    }
    rows.push(row)
  }
  return rows
}

function init() {
  if (st.ready) return
  st.ready = true
  const place = mockVillagePlace(GRID)
  // ?grow=N opens the mock with N extra rows and columns of bought land (the land screens' demo)
  try { st.growth = Math.max(0, Math.min(6, Number(new URLSearchParams(location.search).get('grow') ?? 0) || 0)) } catch { /* no window */ }
  st.lots = makeLots(place.origin, [[4, 0, 11]], GRID + st.growth)
  const lot = MOCK_WORLD.lot_m
  const shifted = offsetLatLon(place.origin.lat, place.origin.lon, 9 * lot, 5 * lot, MOCK_WORLD.planet_radius_km)
  st.otherLots = makeLots(shifted, [], GRID)
  const now = Date.now()
  const mk = (type: string, x: number, y: number, state: BuildingState, extra: Partial<MBuilding> = {}): MBuilding => {
    const e = CAT.find((c) => c.code === type)!
    const rotated = !!extra.rotated
    return { id: `b-${st.nextId++}`, type, x, y, w: rotated ? e.fp[1] : e.fp[0], h: rotated ? e.fp[0] : e.fp[1], rotated, state, seed: 2891077541 + x * 977 + y * 131, ...extra }
  }
  st.buildings = [
    mk('civic_hall', 0, 3, 'built'),
    mk('watch_hut', 3, 3, 'built'),
    mk('granary', 3, 4, 'built'),
    mk('teaching_circle', 4, 3, 'built'),
    mk('carpentry_workshop', 0, 0, 'under_construction', { started: now - 14 * 60000, finish: now + 21 * 60000 }),
    mk('militia_camp', 2, 3, 'under_construction', { rotated: true, started: now - 32 * 60000, finish: now + 13 * 60000 }),
  ]
  // ?farm=<stage> stands a farm on the grid (idle, sowing, growing, ripe, overripe, harvested, rotted, legacy, dry): the field is drawn by that stage
  const farmStage = (() => { try { return new URLSearchParams(location.search).get('farm') } catch { return null } })()
  if (farmStage) st.buildings.push({ ...mk('farm_canal', 2, 0, 'built'), id: `fx-farm-${farmStage}`, w: 3, h: 2 })
  st.roads = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 }))
  st.otherBuildings = [mk('civic_hall', 1, 1, 'built'), mk('farm_canal', 2, 2, 'built'), mk('watch_hut', 0, 4, 'built')]
  st.know = [
    { code: 'fire_making', state: 'held', cost: 0, time: 0, buy: 0, missing: [], terrain: true },
    { code: 'archery', state: 'held', cost: 0, time: 0, buy: 0, missing: [], terrain: true },
    { code: 'irrigation', state: 'researching', cost: 3200, time: 172800, buy: 8000, missing: [], terrain: true, finish: now + 53 * 3600000 },
    { code: 'masonry', state: 'available', cost: 28000, time: 86400, buy: 224000, missing: [], terrain: true },
    { code: 'writing', state: 'available', cost: 2600, time: 43200, buy: 7200, missing: [], terrain: true },
    { code: 'metallurgy', state: 'locked', cost: 7000, time: 345600, buy: 0, missing: ['masonry'], terrain: true },
    { code: 'geometry', state: 'locked', cost: 6000, time: 129600, buy: 0, missing: [], terrain: false },
  ]
  for (const b of st.buildings) if (b.state === 'under_construction') schedule(b)
  // ?plan=1 opens the mock with a road already drawn out of the grid (the land tool's demo for a resident)
  try {
    if (new URLSearchParams(location.search).get('plan') === '1') {
      const dr = landMock.draft(landHost, { x: -9, y: 8 }, 'path')
      if (!dr.error) landMock.store(dr)
    }
    // ?lot=...: a built cottage of mine on lot (2,0), for the lot manager
    if (new URLSearchParams(location.search).has('lot')) st.buildings.push({ id: 'b-lot-1', type: 'cottage', x: 2, y: 0, w: 1, h: 1, rotated: false, state: 'built', seed: 55101, priv: true, owner: 'تو', mine: true })
    // ?lot=many: six managed buildings of different looks next to the unmanaged ones
    if (new URLSearchParams(location.search).get('lot') === 'many') for (const [i, [x, y]] of ([[3, 0], [4, 0], [2, 1], [3, 1], [4, 1], [4, 4]] as [number, number][]).entries()) st.buildings.push({ id: `b-look-${i + 2}`, type: 'cottage', x, y, w: 1, h: 1, rotated: false, state: 'built', seed: 55100 + i * 13, priv: true, owner: 'تو', mine: true })
    // ?live=1: the shape of the real Marco Polo: a built road column north out of the grid (x 10, y 16..29), a store and a watch hut
    // on it, and open lots along it
    if (new URLSearchParams(location.search).get('live') === '1') {
      const id = `plan-${landMock.land.next++}`
      const cells = Array.from({ length: 14 }, (_, i) => ({ x: 10, y: 16 + i, plan: id, built: true, height_m: 3 }))
      const plan = { id, cls: 'path', to: { x: 10, y: 29 }, cells }
      landMock.land.plans.push(plan)
      for (const c of cells) landMock.land.cells.set(landMock.keyOf(c.x, c.y), c)
      for (let y = 16; y <= 29; y++) for (const x of [9, 11, 8, 12]) {
        if ((x === 8 && y === 29) || (x === 11 && y === 28)) continue
        landMock.land.open.set(landMock.keyOf(x, y), { x, y, plan: id, serves: { x: 10, y }, dist: Math.abs(x - 10), buildable: true, height_m: 3, slope_m: 0.2 })
      }
      st.buildings.push(mk('watch_hut', 11, 28, 'built'))
      st.buildings.push(mk('health_house', 7, 29, 'built', { w: 2, h: 1 }))
    }
  } catch { /* no window */ }
}

function schedule(b: MBuilding) {
  if (!b.finish) return
  const delay = Math.max(1000, b.finish - Date.now())
  const t = window.setTimeout(() => finish(b.id), delay)
  st.timers.set(b.id, t)
}

function versions() {
  return { head: `h${st.ver}`, member: `m${st.ver}`, public: `p${st.ver}` }
}

function emit(ev: Omit<SettlementEvent, 'settlement_id' | 'seq' | 'at'> & { settlement_id?: string }) {
  st.seq += 1
  publishSettlement({ settlement_id: OWN_ID, seq: st.seq, at: new Date().toISOString(), ...ev } as SettlementEvent)
}

function finish(id: string) {
  const b = st.buildings.find((x) => x.id === id)
  if (!b || b.state !== 'under_construction') return
  b.state = 'built'
  delete b.started
  delete b.finish
  st.ver++
  emit({ type: 'build_finished', building_id: b.id, type_code: b.type, layout_version: versions() })
}

// -- layout -----------------------------------------------------------------------------

function toLayoutBuilding(b: MBuilding, full: boolean): LayoutBuilding {
  const out: LayoutBuilding = { type: b.type, x: b.x, y: b.y, w: b.w, h: b.h, rotated: b.rotated, state: b.state, visual_seed: b.seed }
  if (full) {
    out.id = b.id
    if (b.started) out.started_at = new Date(b.started).toISOString()
    if (b.finish) out.finish_at = new Date(b.finish).toISOString()
    if (b.priv) { out.private = true; out.owner = b.owner; out.mine = !!b.mine }
  }
  return out
}

/** The crops of the farms of the mock grid, as the layout carries them (ADR 0067). */
function layoutFarms(): LayoutFarm[] | undefined {
  const out: LayoutFarm[] = []
  for (const b of st.buildings) {
    if (!/^farm_/.test(b.type) || b.state !== 'built') continue
    const f = b2Work(b.type, b.id).farm
    if (!f) continue
    out.push({ building: b.id, stage: f.stage, rainfed: f.rainfed, legacy: f.legacy, sow_done: f.sow_done, sow_need: f.sow_need, tended: f.tended, tend_max: f.tend_max, harvest_done: f.harvest_done, harvest_need: f.harvest_need, ripe_at: f.ripe_at, spoil_at: f.spoil_at })
  }
  return out.length ? out : undefined
}

function layoutFor(id: string): VillageLayout {
  init()
  const own = id === OWN_ID
  const place = mockVillagePlace(GRID)
  const lot = MOCK_WORLD.lot_m
  const origin = own ? place.origin : offsetLatLon(place.origin.lat, place.origin.lon, 9 * lot, 5 * lot, MOCK_WORLD.planet_radius_km)
  const centre = own ? place.centre : { ...offsetLatLon(place.centre.lat, place.centre.lon, 9 * lot, 5 * lot, MOCK_WORLD.planet_radius_km), chunk: place.centre.chunk }
  const list = own ? st.buildings : st.otherBuildings.filter((b) => b.state === 'built')
  // a laid road beyond the first grid is in `roads` and `buildings` like any road (the real layout does the same)
  const roads = own ? [...st.roads, ...[...landMock.land.cells.values()].filter((c) => c.built).map((c) => ({ x: c.x, y: c.y }))] : []
  const detail = own ? 'full' : 'coarse'
  seedCitizen()
  const ver = own ? `${IS_HEAD ? 'h' : 'm'}${st.ver}` : `p${st.ver}`
  const buildings: LayoutBuilding[] = list.map((b) => toLayoutBuilding(b, own))
  const outerLand = own ? landMock.layoutLand() : undefined
  for (const r of roads) buildings.push({ type: 'road', x: r.x, y: r.y, w: 1, h: 1, rotated: false, state: 'built', visual_seed: 7, ...(own ? { id: `road-${r.x}-${r.y}` } : {}) })
  return {
    version: ver, detail,
    viewer: { member: own, can_place: own && IS_HEAD, ...(own ? { resident: true } : {}) },
    settlement: { id, code: own ? 'v-k3x9' : 'v-q7m2', name: own ? 'آمل' : 'سرخه', tier: 'city', world_cell: own ? 18211 : 18990, centre },
    grid: { lots: own ? size() : GRID, lot_m: lot, origin, slope_limit: SLOPE_LIMIT },
    lots: own ? (landOn() ? withGridLand(st.lots) : st.lots) : st.otherLots,
    ...(own ? { farms: layoutFarms() } : {}),
    ...(own && landOn() ? { ring: { depth: 3, lots: ringLots(size()) }, woods: woods() } : {}),
    buildings,
    ...(own ? { roads, ...(outerLand ? { land: outerLand } : {}), tenure: cz.tenure.map((l) => ({ x: l.x, y: l.y, tenure: 'freehold' as const, mine: l.mine, owner: l.owner })), terms: { lot_price: LOT_PRICE, permit_fee: PERMIT_FEE, tax_bps: TAX_BPS } } : {}),
  }
}

export function mockBootstrapSettlement(): BootstrapSettlement {
  init()
  const place = mockVillagePlace(GRID)
  return {
    id: OWN_ID, code: 'v-k3x9', name: 'آمل', tier: 'city', world_cell: 18211,
    centre: place.centre, is_head: IS_HEAD, permissions: IS_HEAD ? ALL_PERMISSIONS : [], resident: true, emblem: { shape: 'shield', color_a: 'crimson', color_b: 'gold', icon: 'wheat' }, grid_lots: size(), layout_path: `/api/v1/settlements/${OWN_ID}/layout`,
  }
}

// -- roster -------------------------------------------------------------------------------------

function roster(): SettlementPlayers {
  const players = [
    { id: 'mock-1', name: 'سارا', code: 'K7Q2M9A', visible: true, online: true, activity: 'idle', activity_label: 'آنلاین', place: 'city_centre' },
    { id: 'p-2', name: 'رضا', code: 'R4T8W1C', visible: true, online: true, activity: 'building', activity_label: 'در حال ساخت', place: 'city_centre' },
    { id: 'p-3', name: 'مریم', code: 'M2X9K5D', visible: true, online: true, activity: 'working', activity_label: 'در حال کار', place: 'harbour' },
    { id: 'p-4', name: 'علی', code: 'A8L3Q6E', visible: true, online: false, activity: 'idle', activity_label: 'آفلاین', place: 'old_town' },
    { id: 'p-5', name: 'نسیم', code: 'N5B1V7F', visible: true, online: false, activity: 'studying', activity_label: 'در حال آموزش' },
    { id: 'p-6', name: 'بهرام', code: 'B9C4Z2G', visible: false },
  ]
  return { settlement_id: OWN_ID, seq: st.seq, online: 3, hidden: false, players }
}

// -- views ---------------------------------------------------------------------------------------

/** What the real server sends as the authored name of content: English. The web must not show it
 * (it resolves names from the catalogue), so the mock sends English on purpose. */
function nameOf(code: string): Named { const e = CAT.find((c) => c.code === code) ?? citizenEntry(code); return { code, name: e?.en ?? code } }
function kn(code: string): Named { return { code, name: KNOW_EN[code] ?? code } }
const GOODS_EN: Record<string, string> = { charcoal: 'زغال', bloom: 'آهن اسفنجی', bricks: 'آجر', leather: 'چرم', bark: 'پوست درخت', flour: 'آرد', water: 'آب', wool: 'پشم', firewood: 'هیزم', clay: 'گل رس', pots: 'کوزه', hide: 'پوست', rag: 'کهنه', paper: 'کاغذ', tools: 'ابزار', timber: 'Timber', stone: 'Stone', iron_bar: 'Iron bar', wheat: 'Wheat' }
/** The server's estimate of the wait for a build of this much worker effort (a crew of two). */
const waitOf = (effort: number) => { const shifts = Math.ceil(effort / 60), crew = 2; return { seconds: Math.ceil(shifts / crew) * 60, shifts, crew, shift_seconds: 60 } }
const N = (code: string, name: string): Named => ({ code, name })
const goods = (code: string): Named => ({ code, name: GOODS_EN[code] ?? code })

function refusal(kind: string, o: Parameters<typeof mockRefusal>[1] = {}) {
  return mockRefusal(kind, { back: { command: 'settlement.overview', args: null }, ...o })
}

/** A lot named by the number pair or by the token the server's own buttons carry ("3-1", "3-1-r"). */
function lotArg(args: Record<string, unknown>): { x: number; y: number; rotated: boolean } | null {
  if (typeof args.lot === 'string') {
    const m = /^(m?\d+)-(m?\d+)(-r)?$/.exec(args.lot.trim())
    const num = (s: string) => (s.startsWith('m') ? -Number(s.slice(1)) : Number(s))
    return m ? { x: num(m[1]), y: num(m[2]), rotated: !!m[3] } : null
  }
  const x = Number(args.x), y = Number(args.y)
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  return { x, y, rotated: args.rotated === true || args.rotated === 'true' || args.rotated === '1' || args.rotated === 1 }
}
const coord = (v: number) => (v < 0 ? `m${-v}` : String(v))
const token = (x: number, y: number, rotated = false) => `${coord(x)}-${coord(y)}${rotated ? '-r' : ''}`

const MAKERS: Record<string, string[]> = { timber: ['woodcutter_camp', 'carpentry_workshop'] }
const MARKET_PRICE: Record<string, number> = { timber: 22, stone: 30, iron_bar: 64 }

/** The materials a building needs that the village store lacks, as the refusal names them. */
function materialNeeds(e: CatEntry): VillageNeed[] {
  const out: VillageNeed[] = []
  for (const [code, , qty] of e.materials ?? []) {
    const have = MAT_STOCK[code] ?? 0
    if (have >= qty) continue
    out.push({
      kind: 'material', item: goods(code), options: null, have, need: qty,
      makers: (MAKERS[code] ?? []).map((b) => ({ building: nameOf(b), built: st.buildings.some((x) => x.type === b && x.state === 'built') })),
      price: MARKET_PRICE[code] ?? 0,
    })
  }
  return out
}
const matLines = (e: CatEntry) => (e.materials ? e.materials.map(([c, , q]) => ({ component: goods(c), quantity: q })) : null)

function running() { return st.buildings.filter((b) => b.type !== 'road' && (b.state === 'under_construction' || b.state === 'planned')).length }
function unmet(e: CatEntry): string[] { return (e.needs ?? []).filter((n) => st.know.find((k) => k.code === n)?.state !== 'held') }

function occupiedMap(): boolean[][] {
  const m: boolean[][] = Array.from({ length: size() }, () => Array(size()).fill(false))
  for (const b of st.buildings) for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (xx >= 0 && yy >= 0 && xx < size() && yy < size()) m[yy][xx] = true
  for (const r of st.roads) m[r.y][r.x] = true
  return m
}

function lotsView(code: string, rotate: boolean, from = '') {
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found')
  const miss = unmet(e)
  const short = materialNeeds(e)
  if (miss.length || short.length) {
    return refusal(miss.length ? 'prerequisite' : 'materials', {
      action: 'build', subject: nameOf(code),
      needs: [...miss.map((m): VillageNeed => ({ kind: 'knowledge', item: kn(m), options: null, have: 0, need: 0, makers: null, price: 0 })), ...short],
    })
  }
  const w = rotate ? e.fp[1] : e.fp[0], h = rotate ? e.fp[0] : e.fp[1]
  const occ = occupiedMap()
  const roads = new Set(st.roads.map((r) => `${r.x},${r.y}`))
  const cellState = (x: number, y: number) => {
    if (roads.has(`${x},${y}`)) return 'road'
    if (occ[y][x]) return 'occupied'
    const l = st.lots[y][x]
    if (l.water) return 'water'
    if (!l.buildable) return 'steep'
    return 'free'
  }
  const fits = (x: number, y: number) => {
    if (x + w > size() || y + h > size()) return false
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (cellState(xx, yy) !== 'free') return false
    return true
  }
  const rows = st.lots.map((row, y) => row.map((_, x) => ({ x, y, state: cellState(x, y), own: false, fits: fits(x, y) })))
  const multi = !!e.capExempt && e.fp[0] === 1 && e.fp[1] === 1
  const m = /^(\d+)-(\d+)/.exec(from)
  const line = !multi ? '' : from === 'line' ? 'line' : m ? 'end' : ''
  const outerFits = (x: number, y: number) => {
    if (multi) return outerFree(x, y, 1, 1) === null
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (outerFree(xx, yy, 1, 1) !== null && !inGridMock(xx, yy)) return false
    return !(inGridMock(x, y) && !fits(x, y)) && outerFree(x, y, w, h) === null
  }
  const view: LotGridView = {
    outer: landMock.land.plans.length ? outerPickerCells(outerFits) : null,
    settlement_name: 'آمل', building: nameOf(code), can_rotate: e.fp[0] !== e.fp[1], rotated: rotate, grid_lots: size(), rows, multi, line,
    from: m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 }, win_x: 0, win_y: 0,
  }
  const acts: MockAct[] = []
  if (multi && !line) acts.push(A('lots.line', 'settlement.build.lots', { code, rotate: '0', from: 'line' }))
  if (view.can_rotate) acts.push(A('lots.rotate', 'settlement.build.lots', { code, rotate: rotate ? '0' : '1' }))
  return mockOk('settlement_build_lots', view, [...acts, back('settlement.build'), refreshA('settlement.build.lots', { code })])
}

function progressView() {
  const going = st.buildings.filter((b) => b.state === 'under_construction' || b.state === 'planned').sort((a, b) => (a.finish ?? 0) - (b.finish ?? 0))
  const lines: ConstructionProgressView['lines'] = [
    ...going.map((b) => ({
      id: b.id, building: nameOf(b.type), lot_x: b.x, lot_y: b.y, state: b.state === 'planned' ? 'queued' : 'building', finish_at: b.finish ? new Date(b.finish).toISOString() : null,
      left_seconds: Math.max(0, Math.round(((b.finish ?? Date.now()) - Date.now()) / 1000)), by_work: false, progress_bps: 0, done_minutes: 0, required_minutes: 0, left_minutes: 0,
    })),
    // buildings raised by work: no timer, only hours of workers (the labour mock keeps them)
    ...laborProgressLines().map((l) => ({
      id: l.id, building: nameOf(l.code), lot_x: l.x, lot_y: l.y, state: 'building', finish_at: null, left_seconds: 0, by_work: true,
      progress_bps: Math.floor((l.done * 10000) / l.required), done_minutes: l.done, required_minutes: l.required, left_minutes: l.required - l.done,
    })),
  ]
  const standing = st.buildings.filter((b) => b.state === 'built' && b.type !== 'road' && !b.priv).map((b) => ({ id: b.id, building: nameOf(b.type), lot_x: b.x, lot_y: b.y }))
  const view: ConstructionProgressView = { name: 'آمل', lines: lines.length ? lines : null, standing: standing.length ? standing : null }
  const acts: MockAct[] = []
  for (const l of lines ?? []) {
    if (l.by_work) acts.push(A('construction.site', 'settlement.labor.site', { id: l.id }, { subject: l.building.code }))
    else if (l.building.code !== 'road') acts.push(A('construction.open', 'settlement.building.view', { building_id: l.id }, { subject: l.building.code }))
  }
  for (const b of standing) acts.push(A('construction.standing', 'settlement.building.view', { building_id: b.id }, { subject: b.building.code }))
  return mockOk('settlement_construction_progress', view, [...acts, back('settlement.overview'), refreshA('settlement.build.progress')])
}

const KNOW_UNLOCKS: Record<string, { kind: string; item: Named }[]> = {
  masonry: [{ kind: 'building', item: { code: 'masonry_workshop', name: 'کارگاه سنگ‌تراشی' } }, { kind: 'knowledge', item: kn('metallurgy') }],
  writing: [{ kind: 'course', item: { code: 'bookkeeping', name: 'دفترداری' } }],
  irrigation: [{ kind: 'building', item: { code: 'canal_channel', name: 'آبراههٔ آبیاری' } }],
}

function knowledgeView() {
  const now = Date.now()
  const run = st.know.find((k) => k.state === 'researching')
  const view: KnowledgeListView = {
    name: 'آمل', treasury: st.treasury, literacy_percent: st.literacy,
    projects: run ? [{ knowledge: kn(run.code), slot: 'free', speed_bps: 10000, finish_at: new Date(run.finish ?? now).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? now) - now) / 1000)) }] : null, capacity: 2,
    running: run ? { slot: 'free', speed_bps: 10000, knowledge: kn(run.code), finish_at: new Date(run.finish ?? now).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? now) - now) / 1000)) } : null,
    // what this land can never allow is never listed (ADR 0033 5.2)
    lines: st.know.filter((k) => k.terrain || k.state === 'held').map((k) => ({
      knowledge: kn(k.code), state: k.state, research_cost: k.cost, research_time_seconds: k.time, buy_price: k.buy,
      missing: k.missing.length ? k.missing.map(kn) : null, terrain_ok: k.terrain, unlocks: KNOW_UNLOCKS[k.code] ?? null,
      needs: k.missing.length ? [...k.missing.map((m) => ({ kind: 'knowledge', item: kn(m), role: '', tier: 0, have: 0, need: 1, how: 'research', where: '', options: [kn(m)], makers: null, price: 0 })), { kind: 'building', item: nameOf('carpentry_workshop'), role: 'craft', tier: 0, have: 0, need: 1, how: 'build', where: '', options: [nameOf('carpentry_workshop')], makers: null, price: 0 }] : null, speed_bps: k.code === 'masonry' ? 11300 : 10000, ahead_bps: k.code === 'masonry' ? 13000 : k.code === 'writing' ? 10000 : 10000, discount_bps: k.code === 'masonry' ? 1200 : 0, share_bps: k.code === 'masonry' && new URLSearchParams(location.search).get('res') === 'pact' ? 2000 : 0, slot: 'free', field: 'craft',
    })),
    currency: { code: 'AML', name: 'سکهٔ آمل', symbol: '' },
    hidden: 3,
  }
  const acts: MockAct[] = []
  for (const k of st.know.filter((x) => x.state === 'available')) {
    acts.push(A('', 'settlement.knowledge.research', { code: k.code }, { subject: k.code }))
    if (k.buy > 0) acts.push(A('', 'settlement.knowledge.buy', { code: k.code }, { subject: k.code }))
  }
  return mockOk('settlement_knowledge_list', view, [...acts, back('settlement.overview'), refreshA('settlement.knowledge')])
}

/** The development readout (G1, `settlement.development.view` -> `village_development`): what the city carries against what
 * it can carry, the service buildings it has, and what could be added next. No stage word, no act. */
function developmentView() {
  const stands = st.buildings.filter((b) => b.state === 'built')
  const roles = new Map<string, number>()
  for (const b of stands) {
    const role = CAT.find((c) => c.code === b.type)?.role
    if (role) roles.set(role, Math.max(roles.get(role) ?? 0, 1))
  }
  const view: DevelopmentView = {
    village: 'آمل', settlement_id: OWN_ID,
    dimensions: [
      { code: 'people', load: 2, capacity: 8 },
      { code: 'buildings', load: stands.filter((b) => b.type !== 'road').length, capacity: 0 },
      { code: 'knowledge', load: st.know.filter((k) => k.state === 'held').length, capacity: 0 },
    ],
    roles: [...roles.entries()].map(([role, level]) => ({ role, level })),
    next: [{ kind: 'research', code: 'irrigation', name: 'Irrigation' }, { kind: 'build', code: 'school', name: 'School' }],
  }
  return mockOk('village_development', view, [back('settlement.overview'), refreshA('settlement.development.view')])
}

function overviewView() {
  const stands = st.buildings.filter((b) => b.state === 'built')
  const view: VillageOverviewView = {
    services: [
      { building: N('watch_hut', 'نگهبانی محله'), service: 'local_security', held: true, idle: '', grace: false, grace_until: null, needs: null },
      { building: N('health_house', 'خانهٔ بهداشت'), service: 'primary_care', held: true, idle: '', grace: true, grace_until: new Date(Date.now() + 6 * 86400_000).toISOString(), needs: [{ component: goods('rag'), quantity: 1 }, { component: N('water', 'آب'), quantity: 2 }] },
      { building: N('teahouse_inn', 'مسافرخانه'), service: 'lodging_and_tea', held: false, idle: 'no_supplies', grace: false, grace_until: null, needs: [{ component: N('bread', 'نان'), quantity: 2 }, { component: N('water', 'آب'), quantity: 3 }, { component: goods('firewood'), quantity: 1 }] },
    ],
    name: 'آمل', tier: 'city', development: true, population: 2, population_cap: 8,
    food_percent: 72, job_percent: 55, service_percent: 40, happiness_percent: 63, security_percent: 48, literacy_percent: st.literacy, promotion: null, zone_minutes: MOCK_ZONE,
    resident: true, settlement_id: OWN_ID, treasury: st.treasury, is_head: IS_HEAD, support: { code: 'support', name: 'Support', services: SUPPORT_SERVICES.filter((s) => !s.role || !stands.some((b) => CAT.find((c) => c.code === b.type)?.role === s.role)).map((s) => s.service) },
    buildings: stands.map((b) => ({ role: CAT.find((c) => c.code === b.type)?.role ?? '', building: nameOf(b.type), tier: 1 })),
  }
  const acts: MockAct[] = [
    A('citizen.land', 'settlement.land'), A('citizen.build_house', 'settlement.private'), A('citizen.mine', 'settlement.mine'), A('village.work', 'settlement.work'),
    A('village.donate', 'settlement.donate'), A('village.who', 'settlement.who'),
    A('village.knowledge', 'settlement.knowledge'), A('village.progress', 'settlement.build.progress'), A('village.materials', 'settlement.materials'),
    ...(IS_HEAD ? [A('village.build', 'settlement.build'), A('village.terms', 'settlement.terms')] : []),
    A('village.leave', 'settlement.leave', undefined, { kind: 'danger' }),
    ...['bank', 'market', 'jobs', 'knowledge', 'hospital', 'jail'].map((c) => A(`support.${c}`, 'travel.options', { city: 'support' }, { subject: 'support' })),
  ]
  return mockOk('village_overview', view, [...acts, back('player.profile.get'), refreshA('settlement.overview')])
}

function menuView() {
  const lines = CAT.map((e) => {
    const miss = unmet(e)
    const short = materialNeeds(e)
    return {
      building: nameOf(e.code), role: e.role, category: ({ '': 'public', security: 'security', craft: 'production', water_infra: 'farming', food: 'farming', market: 'shops', housing: 'housing', storage: 'construction' } as Record<string, string>)[e.role] ?? 'other', state: miss.length ? 'locked' : 'available', cost_money: e.cost, build_time_seconds: e.time, expected_wait: waitOf(e.time),
      missing: miss.length ? miss.map(kn) : null, missing_buildings: null, materials: matLines(e),
      short: short.length ? short.map((n) => ({ component: n.item, quantity: n.need - n.have })) : null,
    }
  })
  const view: BuildMenuView = { name: 'آمل', treasury: st.treasury, running_builds: running(), concurrent_cap: CONCURRENT_CAP, lines }
  const acts = lines.filter((l) => l.state === 'available').map((l) => A('build.place', 'settlement.build.lots', { code: l.building.code }, { subject: l.building.code }))
  return mockOk('settlement_build_menu', view, [...acts, back('settlement.overview'), refreshA('settlement.build')])
}

function place(args: Record<string, unknown>) {
  const code = String(args.code ?? '')
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found')
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y, rotated } = at
  const w = rotated ? e.fp[1] : e.fp[0], h = rotated ? e.fp[0] : e.fp[1]
  const beyond = x < 0 || y < 0 || x + w > size() || y + h > size()
  // ADR 0067: a water mill stands beside water or a water work; a pasture needs open land round it
  if (code === 'water_mill') return refusal('needs_near')
  if (code === 'pasture_range') return refusal('no_grazing')
  if (landOn() && code !== 'road') {
    const cells: { x: number; y: number }[] = []
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) cells.push({ x: xx, y: yy })
    const ob = obstructedAt(cells, size())
    if (ob) return refusal('obstructed', { obstacles: ob, action: 'build', subject: nameOf(code) })
  }
  if (beyond) {
    const why = outerFree(x, y, w, h)
    if (why) return refusal(why)
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (tenureAt(xx, yy)) return refusal('citizen_lot_private')
  } else {
    const occ = occupiedMap()
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (!st.lots[yy][xx].buildable) return refusal('unbuildable')
        if (occ[yy][xx]) return refusal('occupied')
      }
    }
  }
  const miss = unmet(e)
  const short = materialNeeds(e)
  if (miss.length || short.length) {
    return refusal(miss.length ? 'prerequisite' : 'materials', {
      action: 'build', subject: nameOf(code),
      needs: [...miss.map((m): VillageNeed => ({ kind: 'knowledge', item: kn(m), options: null, have: 0, need: 0, makers: null, price: 0 })), ...short],
    })
  }
  if (code !== 'road' && running() >= CONCURRENT_CAP) return refusal('concurrent_cap')
  let street: { x: number; y: number }[] | 'none' = code === 'road' ? [] : beyond ? 'none' : planAutoRoads(x, y, w, h)
  let fee = 0
  if (beyond && code !== 'road') {
    // the road of a building out there: the lane and the unlaid stretch of the drawn road
    let best: MAcc | null = null
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const a = outerAcc(xx, yy)
      if (a && (!best || a.cost < best.cost)) best = a
    }
    street = best ? best.path : 'none'
    fee = best?.cost ?? 0
  }
  if (street === 'none') return refusal('no_road')
  if (!beyond) fee = street.length * AUTO_ROAD_FEE
  if (st.treasury < e.cost + fee) return refusal('insufficient_funds')
  if (args.confirm !== 'confirm') {
    const view: LotConfirmView = {
      settlement_name: 'آمل', building: nameOf(code), x, y, rotated, cost_money: e.cost + fee, auto_roads: street.length,
      materials: matLines(e), build_time_seconds: e.time, expected_wait: waitOf(e.time),
    }
    return mockOk('settlement_build_confirm', view, [confirmA('settlement.build.place', { code, lot: token(x, y, rotated) }), back('settlement.build.lots', { code })])
  }
  st.treasury -= e.cost + fee
  for (const [c, , q] of e.materials ?? []) MAT_STOCK[c] = Math.max(0, (MAT_STOCK[c] ?? 0) - q)
  // the game lays the connecting street at once
  const laid = street.map((q) => {
    const r = mkRoad(q.x, q.y, 'built'); st.buildings.push(r)
    const cell = landMock.land.cells.get(landMock.keyOf(q.x, q.y))
    if (cell) cell.built = true
    return { building_id: r.id, lot_x: q.x, lot_y: q.y }
  })
  // the mock builds faster than the real duration so a demo sees it finish
  const sec = Math.min(90, Math.max(25, Math.round(e.time / 120)))
  const started = Date.now()
  const b: MBuilding = { id: `b-${st.nextId++}`, type: code, x, y, w, h, rotated, state: 'under_construction', started, finish: started + sec * 1000, seed: 118034 + st.nextId * 31 }
  st.buildings.push(b)
  st.ver++
  schedule(b)
  emit({ type: 'build_started', building_id: b.id, type_code: code, lot_x: x, lot_y: y, rotated, finish_at: new Date(b.finish!).toISOString(), ...(laid.length ? { auto_roads: laid } : {}), layout_version: versions() })
  return progressView()
}

function cancelOrDemolish(args: Record<string, unknown>, demolish: boolean) {
  const b = st.buildings.find((x) => x.id === String(args.id ?? ''))
  if (!b) return refusal('not_found')
  if (demolish && b.state !== 'built') return refusal('not_demolishable')
  if (!demolish && b.state !== 'under_construction' && b.state !== 'planned') return refusal('not_cancellable')
  const e = CAT.find((c) => c.code === b.type)
  st.buildings = st.buildings.filter((x) => x.id !== b.id)
  const t = st.timers.get(b.id)
  if (t) { clearTimeout(t); st.timers.delete(b.id) }
  if (demolish && e) st.treasury += Math.round(e.cost * 0.3)
  st.ver++
  emit({ type: demolish ? 'build_salvaged' : 'build_cancelled', building_id: b.id, type_code: b.type, layout_version: versions() })
  return demolish ? overviewView() : progressView()
}

function knowledgeAct(args: Record<string, unknown>, buy: boolean) {
  const k = st.know.find((x) => x.code === String(args.code ?? ''))
  if (!k) return refusal('not_found')
  if (k.state === 'held') return refusal('already_owned')
  if (k.state === 'researching' || (!buy && st.know.some((x) => x.state === 'researching'))) return refusal('busy')
  if (k.state === 'locked' || (buy && !k.buy)) return refusal('not_available')
  const price = buy ? k.buy : k.cost
  if (st.treasury < price) return refusal('insufficient_funds')
  st.treasury -= price
  if (buy) {
    k.state = 'held'
    unlock()
    emit({ type: 'knowledge_bought', code: k.code })
  } else {
    k.state = 'researching'
    // shortened for the demo
    k.finish = Date.now() + Math.min(k.time, 45) * 1000
    emit({ type: 'research_started', research_id: `r-${k.code}`, code: k.code, finish_at: new Date(k.finish).toISOString() })
    window.setTimeout(() => {
      k.state = 'held'
      st.literacy = Math.min(100, st.literacy + 3)
      unlock()
      emit({ type: 'research_finished', code: k.code })
      emit({ type: 'literacy_changed', literacy_share_bps: st.literacy * 100 })
    }, Math.max(1000, k.finish - Date.now()))
  }
  return knowledgeView()
}

function unlock() {
  for (const k of st.know) {
    if (k.state === 'locked' && k.terrain) {
      k.missing = k.missing.filter((m) => st.know.find((x) => x.code === m)?.state !== 'held')
      if (k.missing.length === 0) k.state = 'available'
    }
  }
}

let cash = 12450
function donate(args: Record<string, unknown>) {
  const view = (amount: number): DonateView => ({ village: 'آمل', amount, presets: [250, 1000, 5000], min: 100, max: 100000, treasury: st.treasury, cash, settlement_id: OWN_ID })
  const raw = String(args.amount ?? '')
  if (!raw) return mockOk('village_donate_menu', view(0), [250, 1000, 5000].map((p) => A('donate.amount', 'settlement.donate', { amount: String(p) })).concat([back('settlement.overview')]))
  const amount = Number(raw)
  if (!(amount >= 100 && amount <= 100000)) return refusal('donate_range', { min: 100, max: 100000, back: { command: 'settlement.donate', args: null } })
  if (args.confirm !== 'confirm') {
    if (cash < amount) return refusal('donate_no_cash', { back: { command: 'settlement.donate', args: null } })
    return mockOk('village_donate_confirm', view(amount), [confirmA('settlement.donate', { amount: String(amount) }), back('settlement.donate')])
  }
  if (cash < amount) return refusal('donate_no_cash')
  cash -= amount
  st.treasury += amount
  return mockOk('village_donate_done', view(amount), [A('village.overview', 'settlement.overview')])
}

// -- the citizen loop (contract 1.4): land, a private house, one's own property ----------
// ?role=resident opens the village as a normal resident (not the head), the
// player this feature is for; without it the viewer is the head, who lives
// here too. Prices follow configs/config.yml (settlement.citizen_*).

let LOT_PRICE = 400, PERMIT_FEE = 100, TAX_BPS = 200
const MAX_LOTS = 3, TIMBER_UNIT = 18

interface MLot { x: number; y: number; owner: string; mine: boolean }
const cz = { tenure: [] as MLot[], cash: 12450, lastRest: 0, seeded: false, debt: 340, debtPeriods: 2 }

const CITIZEN_CAT: CatEntry[] = [
  { code: 'cottage', fa: 'کلبهٔ چوبی', en: 'Cottage', fp: [1, 1], cost: 800, time: 7200, role: '', materials: [['timber', 'الوار', 3]] },
  { code: 'village_house', fa: 'خانهٔ کوچک', en: 'Village house', fp: [1, 1], cost: 1800, time: 14400, role: '', needs: ['carpentry'], materials: [['timber', 'الوار', 8]] },
  { code: 'home_workshop', fa: 'کارگاه خانگی', en: 'Home workshop', fp: [2, 1], cost: 1500, time: 10800, role: 'craft', needs: ['carpentry'], materials: [['timber', 'الوار', 6]] },
  { code: 'market_stall', fa: 'غرفهٔ بازار', en: 'Market stall', fp: [1, 1], cost: 500, time: 3600, role: 'market', materials: [['timber', 'الوار', 2]] },
]
const HOMES = new Set(['cottage', 'village_house'])

function citizenEntry(code: string): CatEntry | undefined { return CITIZEN_CAT.find((c) => c.code === code) }

function seedCitizen() {
  if (cz.seeded) return
  cz.seeded = true
  const occ = occupiedMap()
  const free: [number, number][] = []
  for (let y = 0; y < size(); y++) for (let x = 0; x < size(); x++) if (st.lots[y][x].buildable && !occ[y][x]) free.push([x, y])
  // a lot the viewer bought before the rule, no road touching it (?legacy=1): the fixes' demo
  if (new URLSearchParams(location.search).get('legacy') === '1') {
    let worst: [number, number] | null = null, cost = -1
    for (const [x, y] of free) {
      const a = mockAccess(x, y)
      if (a.kind !== 'road' && a.kind !== 'none' && a.cost > cost) { cost = a.cost; worst = [x, y] }
    }
    if (worst) cz.tenure.push({ x: worst[0], y: worst[1], owner: 'تو', mine: true })
  }
  // ?enclose=1 (with ?grow=3): the corner lot (7,0) is closed in by Sara's lot below it and the viewer's own lot
  // beside it, so no public road reaches it, and the viewer's own lot is the only way in (the carve demo)
  if (new URLSearchParams(location.search).get('enclose') === '1' && size() >= 8) {
    cz.tenure.push({ x: 6, y: 0, owner: 'تو', mine: true }, { x: 7, y: 1, owner: 'سارا', mine: false })
  }
  // a neighbour, Sara, already owns two lots and lives in one
  const picks = free.filter(([x, y]) => !tenureAt(x, y)).slice(-2)
  picks.forEach(([x, y], i) => {
    cz.tenure.push({ x, y, owner: 'سارا', mine: false })
    if (i === 0) {
      const e = citizenEntry('cottage')!
      st.buildings.push({ id: `b-${st.nextId++}`, type: 'cottage', x, y, w: e.fp[0], h: e.fp[1], rotated: false, state: 'built', seed: 55103 + x * 7 + y, priv: true, owner: 'سارا', mine: false })
    }
  })
}

function tenureAt(x: number, y: number) { return cz.tenure.find((l) => l.x === x && l.y === y) }
function bill(e: CatEntry) {
  const mats = (e.materials ?? []).map(([code, name, need]) => ({ component: { code, name }, need, have: 0, buy: need, buy_cost: need * TIMBER_UNIT }))
  const materials_cost = mats.reduce((s, m) => s + m.buy_cost, 0)
  return { mats, materials_cost, total: e.cost + PERMIT_FEE + materials_cost }
}
function citizenUnmet(e: CatEntry): boolean { return unmet(e).length > 0 }

// -- the land beyond the first grid (ADR 0044 5.5): a road opens the land it reaches -------------------------

const inGridMock = (x: number, y: number) => x >= 0 && y >= 0 && x < size() && y < size()

function lotGround(x: number, y: number): { height: number; wet: boolean } {
  const place = mockVillagePlace(GRID)
  const ll = offsetLatLon(place.origin.lat, place.origin.lon, x * MOCK_WORLD.lot_m, y * MOCK_WORLD.lot_m, MOCK_WORLD.planet_radius_km)
  const t = latLonToTile(ll.lat, ll.lon, MOCK_WORLD.chunk.max_lod, MOCK_WORLD.chunk.tile_edge)
  return { height: mockHeight(t.gx, t.gy) + lotNoise(x, y, 1) * 0.9, wet: t.face === MOCK_FACE && Math.abs(t.gy - RIVER_GY) < RIVER_HALF_TILES }
}

const landHost: landMock.LandHost = {
  gridSize: () => size(),
  height: (x, y) => (inGridMock(x, y) ? st.lots[y][x].height_m : lotGround(x, y).height),
  wet: (x, y) => (inGridMock(x, y) ? !!st.lots[y][x].water : lotGround(x, y).wet),
  blocked: (x, y) => st.buildings.some((b) => b.type !== 'road' && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || !!tenureAt(x, y),
  anchors: () => {
    const out = st.roads.map((r) => ({ x: r.x, y: r.y }))
    for (const b of st.buildings) {
      if (b.type === 'road') out.push({ x: b.x, y: b.y })
      if (b.type === 'civic_hall') for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) out.push({ x: xx, y: yy })
    }
    return out
  },
  roadCost: 10, crossCost: 60, slopeLimit: 8,
}

/** The road a lot beyond the grid needs, as the access screens read it. */
function outerAcc(x: number, y: number): MAcc | null {
  const a = landMock.accessOf(landHost, x, y)
  if (!a) return null
  return { kind: a.kind, roads: a.roads, crossings: a.crossings, cost: a.cost, path: a.path, carved: [] }
}

function haveKnowledge(code: string): boolean { return st.know.find((k) => k.code === code)?.state === 'held' }

function roadPlan(args: Record<string, unknown>) {
  if (!IS_HEAD) return refusal('not_office_holder')
  const x = Number(args.x), y = Number(args.y)
  const to = typeof args.to === 'string' ? lotArg({ lot: args.to }) : Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null
  if (!to) return refusal('not_found', { back: { command: 'settlement.land', args: null } })
  const cls = String(args.class || 'path')
  const def = landMock.CLASSES.find((c) => c.code === cls)
  if (!def) return refusal('not_found', { back: { command: 'settlement.land', args: null } })
  if (def.needs.some((k) => !haveKnowledge(k))) return refusal('road_class_locked', { back: { command: 'settlement.land', args: null } })
  const dr = landMock.draft(landHost, { x: to.x, y: to.y }, cls)
  if (dr.error) return refusal(dr.error, { back: { command: 'settlement.land', args: null } })
  const view = landMock.quoteView(landHost, dr, 'آمل', OWN_ID, haveKnowledge)
  if (args.confirm !== 'confirm') {
    return mockOk('settlement_road_quote', view, [confirmA('settlement.road.plan', { to: token(to.x, to.y), class: cls }), back('settlement.land')])
  }
  const plan = landMock.store(dr)
  view.plan_id = plan.id
  st.ver++
  emit({ type: 'land_changed', layout_version: versions() })
  return mockOk('settlement_road_planned', view, [A('citizen.more_land', 'settlement.land'), back('settlement.land')])
}

function roadCancel(args: Record<string, unknown>) {
  if (!IS_HEAD) return refusal('not_office_holder')
  const id = String(args.id ?? '')
  const plan = landMock.land.plans.find((p) => p.id === id)
  if (!plan) return refusal('not_found', { back: { command: 'settlement.land', args: null } })
  const sold = [...landMock.land.open.values()].some((o) => o.plan === id && (tenureAt(o.x, o.y) || st.buildings.some((b) => b.x === o.x && b.y === o.y)))
  if (plan.cells.some((c) => c.built) || sold) return refusal('road_in_use', { back: { command: 'settlement.land', args: null } })
  landMock.land.plans = landMock.land.plans.filter((p) => p.id !== id)
  for (const c of plan.cells) landMock.land.cells.delete(landMock.keyOf(c.x, c.y))
  for (const [k, o] of landMock.land.open) if (o.plan === id) landMock.land.open.delete(k)
  st.ver++
  emit({ type: 'land_changed', layout_version: versions() })
  return mockOk('settlement_road_cancelled', { settlement_name: 'آمل', plan_id: id, lots: plan.cells.length }, [back('settlement.land')])
}

/** The land screen's and the pickers' view of the lots beyond the grid. */
function outerLandCells(): LandCell[] {
  const out: LandCell[] = []
  for (const c of landMock.land.cells.values()) out.push({ x: c.x, y: c.y, state: c.built ? 'road' : 'planned', owner: '', building: c.built ? 'road' : '', access: '', roads: 0, crossings: 0, cost: 0 })
  for (const o of landMock.land.open.values()) {
    const own = tenureAt(o.x, o.y)
    const b = st.buildings.find((q) => q.type !== 'road' && o.x >= q.x && o.x < q.x + q.w && o.y >= q.y && o.y < q.y + q.h)
    const state = own ? (own.mine ? 'mine' : 'taken') : b ? 'building' : o.reason === 'water' ? 'water' : o.reason === 'steep' ? 'steep' : 'free'
    const cell: LandCell = { x: o.x, y: o.y, state, owner: own && !own.mine ? own.owner : '', building: b ? b.type : '', access: '', roads: 0, crossings: 0, cost: 0 }
    if (state === 'free' || (state === 'mine' && !b)) {
      const a = outerAcc(o.x, o.y)
      if (a) { cell.access = a.kind; cell.roads = a.roads; cell.crossings = a.crossings; cell.cost = a.cost }
    }
    out.push(cell)
  }
  return out
}

function outerPickerCells(fits: (x: number, y: number) => boolean, own = false): LotCell[] {
  const out: LotCell[] = []
  for (const c of landMock.land.cells.values()) out.push({ x: c.x, y: c.y, state: c.built ? 'road' : 'planned', own: false, fits: false })
  for (const o of landMock.land.open.values()) {
    const b = st.buildings.some((q) => o.x >= q.x && o.x < q.x + q.w && o.y >= q.y && o.y < q.y + q.h)
    const state = b ? 'occupied' : o.reason === 'water' ? 'water' : o.reason === 'steep' ? 'steep' : 'free'
    out.push({ x: o.x, y: o.y, state, own: own && !!tenureAt(o.x, o.y)?.mine, fits: state === 'free' && fits(o.x, o.y) })
  }
  return out
}

/** A footprint on the land beyond the grid: every lot of it open, buildable and free. */
function outerFree(x: number, y: number, w: number, h: number): string | null {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (inGridMock(xx, yy)) continue
    if (landMock.land.cells.has(landMock.keyOf(xx, yy))) return 'occupied'
    const o = landMock.land.open.get(landMock.keyOf(xx, yy))
    if (!o) return 'out_of_bounds'
    if (!o.buildable) return 'unbuildable'
    if (st.buildings.some((q) => xx >= q.x && xx < q.x + q.w && yy >= q.y && yy < q.y + q.h)) return 'occupied'
  }
  return null
}

// -- lot access (docs/adr/0043): a lot is sold only when a road can reach it ---------------------------
// The mock follows the server's rules in small: the road is laid over public lots at AUTO_ROAD_FEE a lot,
// water costs CROSS_FEE a lot (at most MAX_CROSS in one road), another resident's lot or a building is
// never crossed, and the buyer's own lots only with their consent (carve). The server plans by cost;
// this only has to look the same.

const CROSS_FEE = 60
const MAX_CROSS = 2
const DIRS4: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]

interface MAcc { kind: 'road' | 'needs_road' | 'needs_bridge' | 'none'; roads: number; crossings: number; cost: number; path: { x: number; y: number }[]; carved: { x: number; y: number }[] }

function netCells(): Set<string> {
  const net = new Set<string>(st.roads.map((r) => `${r.x},${r.y}`))
  for (const b of st.buildings) {
    if (b.type === 'road') net.add(`${b.x},${b.y}`)
    if (b.type === 'civic_hall') for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) net.add(`${xx},${yy}`)
  }
  return net
}

function mockAccess(x: number, y: number, carve = false): MAcc {
  // land beyond the first grid is served by its road's plan, not by the grid's router
  if (!inGridMock(x, y)) return outerAcc(x, y) ?? { kind: 'none', roads: 0, crossings: 0, cost: 0, path: [], carved: [] }
  const n = size()
  const occ = occupiedMap()
  const net = netCells()
  const touches = (a: number, b: number) => DIRS4.some(([dx, dy]) => net.has(`${a + dx},${b + dy}`))
  if (touches(x, y)) return { kind: 'road', roads: 0, crossings: 0, cost: 0, path: [], carved: [] }
  // 0 no, 1 public, 2 water, 3 own (carve)
  const enter = (a: number, b: number): number => {
    if (a < 0 || b < 0 || a >= n || b >= n || (a === x && b === y) || occ[b][a] || net.has(`${a},${b}`)) return 0
    const t = tenureAt(a, b)
    if (t) return carve && t.mine && st.lots[b][a].buildable ? 3 : 0
    if (st.lots[b][a].buildable) return 1
    return st.lots[b][a].water ? 2 : 0
  }
  const weight = (k: number) => (k === 2 ? 60 : k === 3 ? 500 : 10)
  const dist = new Map<string, number>(), prev = new Map<string, string>()
  const open: { k: string; c: number; a: number; b: number; w: number }[] = []
  const push = (a: number, b: number, w: number, c: number, from?: string) => {
    const k = `${a},${b},${w}`
    if ((dist.get(k) ?? Infinity) <= c) return
    dist.set(k, c); if (from) prev.set(k, from)
    open.push({ k, c, a, b, w })
  }
  for (const [dx, dy] of DIRS4) {
    const kind = enter(x + dx, y + dy)
    if (kind && (kind !== 2 || MAX_CROSS >= 1)) push(x + dx, y + dy, kind === 2 ? 1 : 0, weight(kind))
  }
  while (open.length) {
    open.sort((p, q) => p.c - q.c || p.b - q.b || p.a - q.a)
    const it = open.shift()!
    if (it.c > (dist.get(it.k) ?? Infinity)) continue
    if (touches(it.a, it.b)) {
      const path: { x: number; y: number }[] = []
      let k: string | undefined = it.k
      while (k) { const [pa, pb] = k.split(',').map(Number); path.push({ x: pa, y: pb }); k = prev.get(k) }
      path.reverse()
      const crossings = path.filter((p) => !st.lots[p.y][p.x].buildable).length
      const carved = path.filter((p) => !!tenureAt(p.x, p.y))
      const cost = (path.length - crossings) * AUTO_ROAD_FEE + crossings * CROSS_FEE
      return { kind: crossings > 0 ? 'needs_bridge' : 'needs_road', roads: path.length - crossings, crossings, cost, path, carved }
    }
    for (const [dx, dy] of DIRS4) {
      const a = it.a + dx, b = it.b + dy
      const kind = enter(a, b)
      if (!kind) continue
      const w = it.w + (kind === 2 ? 1 : 0)
      if (w > MAX_CROSS) continue
      push(a, b, w, it.c + weight(kind), it.k)
    }
  }
  return { kind: 'none', roads: 0, crossings: 0, cost: 0, path: [], carved: [] }
}

const accessOf = (a: MAcc) => ({
  kind: a.kind, roads: a.roads + a.carved.length, crossings: a.crossings, cost: a.cost,
  carved: a.carved.length ? a.carved : null, path: a.path.length ? a.path : null,
})

function onOffer(x: number, y: number): boolean {
  if (!inGridMock(x, y)) return outerFree(x, y, 1, 1) === null && !tenureAt(x, y)
  return x >= 0 && y >= 0 && x < size() && y < size() && st.lots[y][x].buildable && !occupiedMap()[y][x] && !tenureAt(x, y)
}

function nearbyLots(x: number, y: number) {
  const out: { x: number; y: number; distance: number; access: ReturnType<typeof accessOf> }[] = []
  for (let yy = 0; yy < size(); yy++) for (let xx = 0; xx < size(); xx++) {
    if (!onOffer(xx, yy) || (xx === x && yy === y)) continue
    const a = mockAccess(xx, yy)
    if (a.kind !== 'none') out.push({ x: xx, y: yy, distance: Math.abs(xx - x) + Math.abs(yy - y), access: accessOf(a) })
  }
  out.sort((p, q) => (p.access.kind === 'road' ? 0 : 1) - (q.access.kind === 'road' ? 0 : 1) || p.distance - q.distance || p.y - q.y || p.x - q.x)
  return out.slice(0, 3)
}

/** The road of a connection: the carved lots go back to the village, the path is laid as finished road. */
function layAccess(a: MAcc) {
  for (const p of a.carved) cz.tenure = cz.tenure.filter((l) => !(l.x === p.x && l.y === p.y))
  for (const p of a.path) {
    st.buildings.push(mkRoad(p.x, p.y, 'built'))
    // a lot of a drawn road (ADR 0044 5.5) is laid by this
    const cell = landMock.land.cells.get(landMock.keyOf(p.x, p.y))
    if (cell) cell.built = true
  }
}

function lotAccessView(x: number, y: number): LotAccessView {
  const base = mockAccess(x, y)
  const carve = base.kind === 'none' ? mockAccess(x, y, true) : null
  const mineLot = tenureAt(x, y)?.mine
  return {
    village: 'آمل', settlement_id: OWN_ID, x, y, own: !!mineLot, price: mineLot ? LOT_PRICE : 0, refund: mineLot ? LOT_PRICE : 0, cash: cz.cash,
    access: accessOf(base), carve: carve && carve.kind !== 'none' && carve.carved.length ? accessOf(carve) : null,
    nearby: !mineLot && base.kind !== 'road' && base.kind !== 'needs_road' ? nearbyLots(x, y) : null, building: { code: '', name: '' },
  }
}

function lotAccessActions(v: LotAccessView): MockAct[] {
  const tok = token(v.x, v.y)
  const a: MockAct[] = []
  if (v.own && v.access.kind !== 'road') {
    if (v.access.kind === 'needs_road' || v.access.kind === 'needs_bridge') a.push({ ...confirmA('settlement.lot.repair', { lot: tok, option: 'connect' }), id: 'lot.connect' })
    if (v.carve) a.push({ ...confirmA('settlement.lot.repair', { lot: tok, option: 'carve' }), id: 'lot.carve' })
    if (v.refund > 0) a.push({ ...confirmA('settlement.lot.repair', { lot: tok, option: 'refund' }), id: 'lot.refund', kind: 'danger' })
  }
  a.push(back('settlement.land'))
  return a
}

function lotAccess(args: Record<string, unknown>) {
  seedCitizen()
  const at = lotArg(args)
  if (!at || (inGridMock(at.x, at.y) ? false : !landMock.land.open.has(landMock.keyOf(at.x, at.y))) || at.x >= size() && inGridMock(at.x, at.y) || at.y >= size() && inGridMock(at.x, at.y)) return refusal('not_found')
  const v = lotAccessView(at.x, at.y)
  return mockOk('settlement_lot_access', v, lotAccessActions(v))
}

function lotRepair(args: Record<string, unknown>) {
  seedCitizen()
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y } = at
  const mine = tenureAt(x, y)?.mine
  if (!mine) return refusal('citizen_not_owner', { back: { command: 'settlement.mine', args: null } })
  if (args.confirm !== 'confirm') return lotAccess(args)
  const option = String(args.option ?? '')
  let paid = 0, refund = 0, acc: MAcc | null = null
  if (option === 'connect' || option === 'carve') {
    acc = mockAccess(x, y, option === 'carve')
    if (acc.kind === 'road' || acc.kind === 'none' || (option === 'carve' && !acc.carved.length)) return refusal('citizen_no_option', { back: { command: 'settlement.mine', args: null } })
    if (cz.cash < acc.cost) return refusal('citizen_no_cash', { back: { command: 'settlement.mine', args: null } })
    cz.cash -= acc.cost; paid = acc.cost
    layAccess(acc)
  } else if (option === 'refund') {
    if (mockAccess(x, y).kind === 'road') return refusal('citizen_no_option', { back: { command: 'settlement.mine', args: null } })
    if (st.treasury < LOT_PRICE) return refusal('citizen_refund_treasury', { back: { command: 'settlement.mine', args: null } })
    cz.cash += LOT_PRICE; st.treasury -= LOT_PRICE; refund = LOT_PRICE
    cz.tenure = cz.tenure.filter((l) => !(l.x === x && l.y === y))
  } else return refusal('citizen_no_option', { back: { command: 'settlement.mine', args: null } })
  st.ver++
  emit({ type: 'lot_repaired', lot_x: x, lot_y: y, layout_version: versions() })
  const view: LotRepairView = {
    village: 'آمل', settlement_id: OWN_ID, x, y, option, paid, refund, cash: cz.cash,
    roads: acc ? acc.path.length - acc.crossings : 0, crossings: acc?.crossings ?? 0, carved: acc?.carved.length ?? 0,
  }
  return mockOk('settlement_lot_repair_done', view, [A('citizen.build_house', 'settlement.private'), A('citizen.mine', 'settlement.mine'), back('settlement.land')])
}

function lotBuy(args: Record<string, unknown>) {
  seedCitizen()
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y } = at
  const outerLot = !inGridMock(x, y)
  if (outerLot && !landMock.land.open.has(landMock.keyOf(x, y))) return refusal('out_of_bounds')
  if (tenureAt(x, y)) return refusal('citizen_lot_taken', { back: { command: 'settlement.land', args: null } })
  if (outerLot) {
    const why = outerFree(x, y, 1, 1)
    if (why) return refusal(why)
  } else {
    if (!st.lots[y][x].buildable) return refusal('unbuildable')
    if (occupiedMap()[y][x]) return refusal('occupied')
  }
  if (cz.tenure.filter((l) => l.mine).length >= MAX_LOTS) return refusal('citizen_lot_limit', { back: { command: 'settlement.land', args: null } })
  if (cz.cash < LOT_PRICE) return refusal('citizen_no_cash', { back: { command: 'settlement.land', args: null } })
  if (tenureAt(x, y)) return refusal('citizen_lot_taken')
  const carveAsked = args.road === 'carve' || args.confirm === 'carve'
  const confirmed = args.confirm === 'confirm'
  const base = mockAccess(x, y)
  const carveAcc = base.kind === 'none' ? mockAccess(x, y, true) : null
  const carveOk = !!carveAcc && carveAcc.kind !== 'none' && carveAcc.carved.length > 0
  const chosen = carveAsked && carveOk ? carveAcc! : base
  const total = LOT_PRICE + chosen.cost
  const view = (cashNow: number, treasury: number): LotBuyView => ({
    village: 'آمل', settlement_id: OWN_ID, x, y, price: LOT_PRICE, cash: cashNow, treasury,
    access: accessOf(chosen), carve: carveOk ? accessOf(carveAcc!) : null, nearby: chosen.kind === 'none' ? nearbyLots(x, y) : null,
    road: carveAsked && carveOk ? 'carve' : '', total,
  })
  if (chosen.kind === 'none') {
    if (confirmed) return refusal('citizen_no_access', { back: { command: 'settlement.land', args: null } })
    const acts: MockAct[] = []
    if (carveOk) acts.push({ ...A('lot.carve', 'settlement.lot.buy', { lot: token(x, y), confirm: 'carve' }) })
    return mockOk('settlement_lot_buy_confirm', view(cz.cash, st.treasury), [...acts, back('settlement.land')])
  }
  if (cz.cash < total) return refusal('citizen_no_cash', { back: { command: 'settlement.land', args: null } })
  if (!confirmed) return mockOk('settlement_lot_buy_confirm', view(cz.cash, st.treasury), [confirmA('settlement.lot.buy', { lot: token(x, y), ...(carveAsked && carveOk ? { road: 'carve' } : {}) }), back('settlement.land')])
  cz.cash -= total
  st.treasury += LOT_PRICE
  layAccess(chosen)
  cz.tenure.push({ x, y, owner: 'تو', mine: true })
  st.ver++
  emit({ type: 'lot_bought', lot_x: x, lot_y: y, layout_version: versions() })
  return mockOk('settlement_lot_buy_done', view(cz.cash, st.treasury), [A('citizen.build_house', 'settlement.private'), A('citizen.more_land', 'settlement.land'), back('settlement.land')])
}

/** The land as a resident sees it: every lot by what it is, the viewer's own marked. */
function landView() {
  seedCitizen()
  const occ = occupiedMap()
  const roads = new Set(st.roads.map((r) => `${r.x},${r.y}`))
  const rows: LandCell[][] = st.lots.map((row, y) => row.map((l, x) => {
    const own = tenureAt(x, y)
    const b = st.buildings.find((q) => q.type !== 'road' && x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h)
    const state = roads.has(`${x},${y}`) || st.buildings.some((q) => q.type === 'road' && q.x === x && q.y === y) ? 'road' : own ? (own.mine ? 'mine' : 'taken') : b ? 'building' : l.water ? 'water' : !l.buildable ? 'steep' : occ[y][x] ? 'building' : 'free'
    const cell: LandCell = { x, y, state, owner: own && !own.mine ? own.owner : '', building: b ? b.type : '', access: '', roads: 0, crossings: 0, cost: 0 }
    if (state === 'free' || (state === 'mine' && !b)) {
      const a = mockAccess(x, y)
      cell.access = a.kind; cell.roads = a.roads; cell.crossings = a.crossings; cell.cost = a.cost
    }
    return cell
  }))
  const owned = cz.tenure.filter((l) => l.mine).length
  const free = rows.flat().filter((c) => c.state === 'free').length
  const served = rows.flat().filter((c) => c.state === 'free' && c.access !== 'none').length
  const outer = outerLandCells()
  const outerFree_ = outer.filter((c) => c.state === 'free').length
  const outerServed = outer.filter((c) => c.state === 'free' && c.access !== 'none').length
  const roadLines = landMock.land.plans.map((p) => {
    const lots = [...landMock.land.open.values()].filter((o) => o.plan === p.id && o.buildable)
    return {
      id: p.id, class: { code: p.cls, name: p.cls === 'track' ? 'جادهٔ خاکی' : 'راه مالرو' }, lots: p.cells.length, built: p.cells.filter((c) => c.built).length,
      open: lots.filter((o) => !tenureAt(o.x, o.y) && !st.buildings.some((b) => b.x === o.x && b.y === o.y)).length, sold: lots.filter((o) => tenureAt(o.x, o.y)).length,
      to: { x: p.to.x, y: p.to.y }, cancellable: !p.cells.some((c) => c.built) && !lots.some((o) => tenureAt(o.x, o.y)),
    }
  })
  const view: LandView = {
    village: 'آمل', settlement_id: OWN_ID, grid_lots: size(), rows, price: LOT_PRICE, cash: cz.cash, owned, max: MAX_LOTS,
    can_buy: owned < MAX_LOTS && cz.cash >= LOT_PRICE && (served > 0 || outerServed > 0), free_lots: free + outerFree_, served_lots: served + outerServed,
    outer: outer.length ? outer : null, roads: roadLines.length ? roadLines : null, can_draw: IS_HEAD,
  }
  return mockOk('settlement_land', view, [...(owned > 0 ? [A('citizen.build_house', 'settlement.private')] : []), back('settlement.overview'), refreshA('settlement.land')])
}

function privateMenu() {
  seedCitizen()
  const owned = cz.tenure.filter((l) => l.mine)
  const occ = occupiedMap()
  const standsAt = (x: number, y: number) => (inGridMock(x, y) ? occ[y][x] : st.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h))
  const freeOwn = owned.filter((l) => !standsAt(l.x, l.y)).length
  const lines = CITIZEN_CAT.filter((e) => !citizenUnmet(e)).map((e) => {
    const b = bill(e)
    return {
      building: nameOf(e.code), home: HOMES.has(e.code), class: e.role || 'residential', cost_money: e.cost, permit_fee: PERMIT_FEE,
      materials: b.mats, build_time_seconds: e.time, expected_wait: waitOf(e.time), footprint_w: e.fp[0], footprint_h: e.fp[1], total: b.total, affordable: cz.cash >= b.total,
    }
  })
  const view: PrivateMenuView = { village: 'آمل', settlement_id: OWN_ID, cash: cz.cash, owned_lots: owned.length, free_lots: freeOwn, lines }
  const acts: MockAct[] = []
  if (owned.length === 0) return mockOk('settlement_private_menu', view, [A('citizen.land', 'settlement.land'), back('settlement.overview')])
  for (const l of lines) if (freeOwn > 0 && l.affordable) acts.push(A('citizen.place', 'settlement.private.lots', { code: l.building.code }, { subject: l.building.code }))
  if (freeOwn === 0) acts.push(A('citizen.more_land', 'settlement.land'))
  return mockOk('settlement_private_menu', view, [...acts, back('settlement.overview'), refreshA('settlement.private')])
}

function privateLots(args: Record<string, unknown>) {
  seedCitizen()
  const code = String(args.code ?? '')
  const e = citizenEntry(code)
  if (!e) return refusal('not_found')
  const rotated = args.rotate === '1' || args.rotate === 1 || args.rotate === true
  const w = rotated ? e.fp[1] : e.fp[0], h = rotated ? e.fp[0] : e.fp[1]
  const occ = occupiedMap()
  const roads = new Set(st.roads.map((r) => `${r.x},${r.y}`))
  const stateOf = (x: number, y: number) => (roads.has(`${x},${y}`) ? 'road' : occ[y][x] ? 'occupied' : st.lots[y][x].water ? 'water' : !st.lots[y][x].buildable ? 'steep' : 'free')
  const fits = (x: number, y: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx >= size() || yy >= size() || occ[yy][xx] || !tenureAt(xx, yy)?.mine) return false
    }
    return true
  }
  const rows = st.lots.map((row, y) => row.map((_, x) => ({ x, y, state: stateOf(x, y), own: fits(x, y), fits: fits(x, y) })))
  const outerFits = (x: number, y: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (inGridMock(xx, yy) ? occ[yy][xx] : outerFree(xx, yy, 1, 1) !== null) return false
      if (!tenureAt(xx, yy)?.mine) return false
    }
    return true
  }
  const view: PrivateLotsView = {
    village: 'آمل', building: nameOf(code), can_rotate: e.fp[0] !== e.fp[1], rotated, grid_lots: size(), rows,
    outer: landMock.land.plans.length ? outerPickerCells(outerFits, true) : null,
  }
  return mockOk('settlement_private_lots', view, [...(view.can_rotate ? [A('lots.rotate', 'settlement.private.lots', { code, rotate: rotated ? '0' : '1' })] : []), back('settlement.private'), refreshA('settlement.private.lots', { code })])
}

function privatePlace(args: Record<string, unknown>) {
  seedCitizen()
  const code = String(args.code ?? '')
  const e = citizenEntry(code)
  if (!e) return refusal('not_found')
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y, rotated } = at
  const w = rotated ? e.fp[1] : e.fp[0], h = rotated ? e.fp[0] : e.fp[1]
  const occ = occupiedMap()
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (inGridMock(xx, yy)) { if (occ[yy][xx]) return refusal('occupied') } else {
        const why = outerFree(xx, yy, 1, 1)
        if (why) return refusal(why)
      }
      if (!tenureAt(xx, yy)?.mine) return refusal('citizen_not_owner', { back: { command: 'settlement.private', args: null } })
    }
  }
  if (citizenUnmet(e)) return refusal('prerequisite')
  // no road can be laid to the lot: the answer is the lot's own fixes, never a dead end
  const beyond = x < 0 || y < 0 || x + w > size() || y + h > size()
  let outerRoad: MAcc | null = null
  if (beyond) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const a = outerAcc(xx, yy)
      if (a && (!outerRoad || a.cost < outerRoad.cost)) outerRoad = a
    }
  }
  if (beyond ? !outerRoad : planAutoRoads(x, y, w, h) === 'none') {
    const v = lotAccessView(x, y)
    v.building = nameOf(code)
    return mockOk('settlement_lot_access', v, lotAccessActions(v))
  }
  const b = bill(e)
  if (cz.cash < b.total) return refusal('citizen_no_cash', { back: { command: 'settlement.private', args: null } })
  if (args.confirm !== 'confirm') {
    const view: PrivateConfirmView = { village: 'آمل', building: nameOf(code), x, y, rotated, cost_money: e.cost, permit_fee: PERMIT_FEE, materials: b.mats, materials_cost: b.materials_cost, total: b.total, cash: cz.cash, build_time_seconds: e.time, expected_wait: waitOf(e.time) }
    return mockOk('settlement_private_confirm', view, [confirmA('settlement.private.place', { code, lot: token(x, y, rotated) }), back('settlement.private.lots', { code })])
  }
  cz.cash -= b.total
  st.treasury += PERMIT_FEE
  // a building out there brings the unlaid stretch of its road
  if (outerRoad) layAccess(outerRoad)
  const sec = 40
  const started = Date.now()
  const nb: MBuilding = { id: `b-${st.nextId++}`, type: code, x, y, w, h, rotated, state: 'under_construction', started, finish: started + sec * 1000, seed: 77021 + st.nextId * 17, priv: true, owner: 'تو', mine: true }
  st.buildings.push(nb)
  st.ver++
  schedule(nb)
  emit({ type: 'build_started', building_id: nb.id, type_code: code, lot_x: x, lot_y: y, rotated, finish_at: new Date(nb.finish!).toISOString(), layout_version: versions() })
  return mineView('')
}

function mineView(notice: string) {
  seedCitizen()
  const now = Date.now()
  const mineB = st.buildings.filter((b) => b.priv && b.mine)
  const lots = cz.tenure.filter((l) => l.mine).map((l) => {
    const b = mineB.find((x) => l.x >= x.x && l.x < x.x + x.w && l.y >= x.y && l.y < x.y + x.h)
    const acc = b ? null : mockAccess(l.x, l.y)
    return { x: l.x, y: l.y, access: acc ? acc.kind : '', cost: acc ? acc.cost : 0, building: b ? b.type : '', state: b ? (b.state === 'built' ? 'built' : 'building') : '', finish_at: b?.finish ? new Date(b.finish).toISOString() : null, left_seconds: b?.finish ? Math.max(0, Math.round((b.finish - now) / 1000)) : 0 }
  })
  const home = mineB.find((b) => b.state === 'built' && HOMES.has(b.type))
  const assessed = cz.tenure.filter((l) => l.mine).length * LOT_PRICE + mineB.reduce((q, b) => q + (citizenEntry(b.type)?.cost ?? 0) + (citizenEntry(b.type)?.materials ?? []).reduce((m, [, , n]) => m + n * 15, 0), 0)
  const wait = Math.max(0, Math.round((cz.lastRest + 6 * 3600_000 - now) / 1000))
  const view: MineView = {
    village: 'آمل', settlement_id: OWN_ID, cash: cz.cash, lots: lots.length ? lots : null, home: home ? nameOf(home.type) : null, can_rest: !!home && wait === 0, rest_wait_seconds: wait,
    assessed, tax_per_period: Math.floor(assessed * TAX_BPS / 10000), tax_bps: TAX_BPS, debt: cz.debt, debt_periods: cz.debtPeriods, notice,
  }
  const acts: MockAct[] = [A('citizen.land', 'settlement.land'), A('citizen.build_house', 'settlement.private')]
  if (home) acts.push(A('citizen.rest', 'settlement.home.rest'))
  if (cz.debt > 0) acts.push(A('citizen.pay_tax', 'settlement.tax.pay'))
  return mockOk('settlement_mine', view, [...acts, back('settlement.overview'), refreshA('settlement.mine')])
}

function homeRest() {
  const v = mineView('') as { view: { home: unknown; can_rest: boolean } }
  if (!v.view.home) return refusal('citizen_no_house', { back: { command: 'settlement.mine', args: null } })
  if (!v.view.can_rest) return refusal('citizen_rest_wait', { remaining: Math.max(1, Math.round((cz.lastRest + 6 * 3600_000 - Date.now()) / 1000)), back: { command: 'settlement.mine', args: null } })
  cz.lastRest = Date.now()
  return mineView('rested')
}

function taxPay() {
  if (cz.debt <= 0) return refusal('citizen_no_debt', { back: { command: 'settlement.mine', args: null } })
  if (cz.cash < cz.debt) return mineView('tax_none')
  cz.cash -= cz.debt
  st.treasury += cz.debt
  cz.debt = 0
  cz.debtPeriods = 0
  return mineView('tax_paid')
}

// -- the head's terms ------------------------------------------------------------------------------------------
function termsView(args: Record<string, unknown>) {
  if (!IS_HEAD) return refusal('not_office_holder')
  const lot = args.lot_price !== undefined ? Number(args.lot_price) : undefined
  const permit = args.permit_fee !== undefined ? Number(args.permit_fee) : undefined
  const tax = args.tax_bps !== undefined ? Number(args.tax_bps) : undefined
  if (lot !== undefined) { if (!(lot >= 100 && lot <= 5000)) return refusal('citizen_terms_range'); LOT_PRICE = lot }
  if (permit !== undefined) { if (!(permit >= 0 && permit <= 1000)) return refusal('citizen_terms_range'); PERMIT_FEE = permit }
  if (tax !== undefined) { if (!(tax >= 0 && tax <= 1000)) return refusal('citizen_terms_range'); TAX_BPS = tax; st.ver++ }
  if (lot !== undefined) st.ver++
  const view: TermsView = {
    village: 'آمل', settlement_id: OWN_ID, lot_price: LOT_PRICE, lot_price_min: 100, lot_price_max: 5000, permit_fee: PERMIT_FEE, permit_fee_max: 1000, tax_bps: TAX_BPS, tax_bps_max: 1000,
    lot_presets: [200, 400, 800, 1500], permit_presets: [0, 100, 250, 500], tax_presets: [0, 100, 200, 400], default_lot_price: 400, default_permit: 100, default_tax_bps: 200,
  }
  // the real server names the levers by position (a known mismatch with the routing's argument names, reported to the Go side)
  const lever = (id: string, key: string, p: number) => A(id, 'settlement.terms', { [key]: String(p) })
  return mockOk('settlement_terms', view, [
    ...view.lot_presets!.map((p) => lever('terms.lot_price', 'lot_price', p)), ...view.permit_presets!.map((p) => lever('terms.permit_fee', 'permit_fee', p)),
    ...view.tax_presets!.map((p) => lever('terms.tax_bps', 'tax_bps', p)), back('settlement.overview'), refreshA('settlement.terms'),
  ])
}

// -- residence ---------------------------------------------------------------------------------------------------
function residence(leaving: boolean, args: Record<string, unknown>) {
  const view: ResidenceView = { leaving, village: 'آمل', home: 'شهر مرکزی', home_code: 'support', cooldown_seconds: 86400, population: 3, settlement_id: OWN_ID }
  const cmd = leaving ? 'settlement.leave' : 'settlement.join'
  if (leaving && IS_HEAD) return refusal('holds_office')
  if (args.confirm !== 'confirm') return mockOk('village_residence_confirm', view, [confirmA(cmd), back('settlement.overview')])
  return mockOk('village_residence_done', view, [A('village.overview', 'settlement.overview')])
}

// -- work: the village's workplaces and the viewer's own shift ----------------------------------------------------------
const WORKPLACES = [
  { id: 'wp-1', code: 'woodcutter_camp', produces: [['timber', 3]] as [string, number][], consumes: [] as [string, number][], wage: 30, shift: 3600, workers: 3 },
  { id: 'wp-2', code: 'farm_canal', produces: [['wheat', 12]] as [string, number][], consumes: [] as [string, number][], wage: 24, shift: 5400, workers: 4 },
  { id: 'wp-4', code: 'smithy', produces: [['tools', 1]] as [string, number][], consumes: [['charcoal', 2], ['bloom', 1]] as [string, number][], wage: 60, shift: 3600, workers: 2 },
  { id: 'wp-5', code: 'tannery', produces: [['leather', 2]] as [string, number][], consumes: [['hide', 2]] as [string, number][], wage: 44, shift: 2700, workers: 2 },
  { id: 'wp-4', code: 'mill', produces: [['flour', 16]] as [string, number][], consumes: [['wheat', 20]] as [string, number][], wage: 30, shift: 3600, workers: 2 },
  { id: 'wp-3', code: 'carpentry_workshop', produces: [['timber', 2]] as [string, number][], consumes: [['wheat', 1]] as [string, number][], wage: 36, shift: 3600, workers: 2 },
]
/** ?personal=1: the grace of ADR 0055 runs and the viewer lacks the smith's level and the reading class */
const PERSONAL_ON = (() => { try { return new URLSearchParams(location.search).get('personal') === '1' } catch { return false } })()
const wk = { shift: null as null | { id: string; finish: number } }

function workView(args: Record<string, unknown>) {
  const place = WORKPLACES.find((p) => p.id === String(args.id ?? ''))
  if (args.id && !place) return refusal('not_workplace')
  if (place) {
    if (wk.shift && wk.shift.finish > Date.now()) return refusal('already_working')
    wk.shift = { id: place.id, finish: Date.now() + 3600_000 }
  }
  const mine = wk.shift && wk.shift.finish > Date.now() ? WORKPLACES.find((p) => p.id === wk.shift!.id)! : null
  const lines = (l: [string, number][]) => (l.length ? l.map(([c, q]) => ({ component: goods(c), quantity: q })) : null)
  const view: WorkView = {
    village: 'آمل', resident: true,
    places: WORKPLACES.map((p) => ({ id: p.id, building: nameOf(p.code), produces: lines(p.produces), consumes: lines(p.consumes), wage: p.wage, shift_seconds: p.shift, workers: p.workers, busy: p.id === mine?.id ? 1 : 0, ready: true, farm: p.code === 'farm_canal' ? b2Work('farm_canal', 'fx-farm-growing').farm : null, mill: p.code === 'mill' ? b2Work('mill', 'fx-mill-toll').mill : null, personal: PERSONAL_ON && p.code === 'smithy' ? [{ kind: 'level', item: { code: '', name: '' }, have: 1, need: 3, how: '' }, { kind: 'skill', item: { code: 'mechanics', name: 'mechanics' }, have: 0, need: 1, how: 'train' }, { kind: 'certificate', item: { code: 'first_aid', name: 'first_aid' }, have: 0, need: 1, how: 'train' }] : PERSONAL_ON && p.code === 'carpentry_workshop' ? [{ kind: 'literacy', item: { code: 'reading_writing', name: 'reading_writing' }, have: 0, need: 1, how: 'train' }] : null })),
    mine: mine ? { building: nameOf(mine.code), finish_at: new Date(wk.shift!.finish).toISOString(), left_seconds: Math.round((wk.shift!.finish - Date.now()) / 1000), wage: mine.wage, produces: lines(mine.produces) } : null,
    suggest: null, personal_until: PERSONAL_ON ? new Date(Date.now() + 5 * 86400_000).toISOString() : null, started: !!place, used: Object.values(MAT_STOCK).reduce((a, b) => a + b, 0), capacity: MAT_BASE_CAP,
  }
  const acts: MockAct[] = []
  if (!mine) for (const p of WORKPLACES) acts.push(A('work.start', 'settlement.work', { id: p.id }, { subject: p.code }))
  acts.push(A('village.materials', 'settlement.materials'), A('village.build', 'settlement.build'), back('settlement.overview'), refreshA('settlement.work'))
  return mockOk(place ? 'village_work_started' : 'village_work', view, acts)
}

function whoView() {
  const r = roster()
  const view: SettlementWhoView = {
    name: 'آمل', online: r.players.filter((p) => p.online).map((p) => ({ name: p.name ?? '', activity: String(p.activity ?? 'idle'), place: p.place === 'city_centre' ? '' : p.place ?? '' })),
    offline: r.players.filter((p) => !p.online).length,
  }
  return mockOk('settlement_who', view, [back('settlement.overview'), refreshA('settlement.who')])
}

const homeCall = () => mockOk('village_home_call', {}, [A('village.found', 'settlement.found.draft'), back('player.profile.get')])
const homeNone = () => mockOk('village_home_none', {}, [back('player.profile.get')])


// -- roads: automatic and in batches (contract 1.4) ------------------------------------------

const AUTO_ROAD_FEE = 10

function isRoadAt(x: number, y: number): boolean {
  return st.roads.some((r) => r.x === x && r.y === y) || st.buildings.some((b) => b.type === 'road' && b.x === x && b.y === y)
}

/** The street a new building needs: a breadth-first walk (the server plans by cost; the mock only has to look
 * plausible) from the free lots beside the footprint to a lot beside a road or the hall. */
function planAutoRoads(x: number, y: number, w: number, h: number): { x: number; y: number }[] | 'none' {
  const n = size()
  const occ = occupiedMap()
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) occ[yy][xx] = true
  const hall = st.buildings.find((b) => b.type === 'civic_hall')
  const inNet = (a: number, b: number) => isRoadAt(a, b) || (!!hall && a >= hall.x && a < hall.x + hall.w && b >= hall.y && b < hall.y + hall.h)
  const touches = (a: number, b: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inNet(a + dx, b + dy))
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (touches(xx, yy)) return []
  const free = (a: number, b: number) => a >= 0 && b >= 0 && a < n && b < n && st.lots[b][a].buildable && !occ[b][a]
  const prev = new Map<string, string | null>()
  const queue: [number, number][] = []
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const a = xx + dx, b = yy + dy
      if (free(a, b) && !prev.has(`${a},${b}`)) { prev.set(`${a},${b}`, null); queue.push([a, b]) }
    }
  }
  while (queue.length) {
    const [a, b] = queue.shift()!
    if (touches(a, b)) {
      const path: { x: number; y: number }[] = []
      let k: string | null = `${a},${b}`
      while (k) { const [px, py] = k.split(',').map(Number); path.push({ x: px, y: py }); k = prev.get(k) ?? null }
      return path.reverse()
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const a2 = a + dx, b2 = b + dy
      if (free(a2, b2) && !prev.has(`${a2},${b2}`)) { prev.set(`${a2},${b2}`, `${a},${b}`); queue.push([a2, b2]) }
    }
  }
  return 'none'
}

function mkRoad(x: number, y: number, state: BuildingState, finishIn?: number): MBuilding {
  const now = Date.now()
  return {
    id: `b-${st.nextId++}`, type: 'road', x, y, w: 1, h: 1, rotated: false, state, seed: 7 + x * 31 + y,
    ...(state === 'under_construction' ? { started: now, finish: now + (finishIn ?? 30_000) } : {}),
  }
}

function placeMany(args: Record<string, unknown>) {
  const code = String(args.code ?? '')
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found')
  const lots: { x: number; y: number }[] = []
  const tok = (v: unknown) => { const m = /^(\d+)-(\d+)/.exec(String(v ?? '')); return m ? { x: +m[1], y: +m[2] } : null }
  const f = tok(args.from), t2 = tok(args.to)
  if (f && t2) {
    // the two ends of a straight line (the web draws a row: horizontal or vertical)
    const dx = Math.sign(t2.x - f.x), dy = Math.sign(t2.y - f.y)
    if (dx !== 0 && dy !== 0) return refusal('not_found')
    for (let x = f.x, y = f.y; ; x += dx, y += dy) { lots.push({ x, y }); if (x === t2.x && y === t2.y) break }
  } else {
    const raw = Array.isArray(args.lots) ? args.lots : []
    for (const l of raw) {
      const tk = typeof l === 'string' ? l.split('-').map(Number) : [Number((l as { x: number }).x), Number((l as { y: number }).y)]
      if (!Number.isInteger(tk[0]) || !Number.isInteger(tk[1])) return refusal('not_found')
      if (!lots.some((q) => q.x === tk[0] && q.y === tk[1])) lots.push({ x: tk[0], y: tk[1] })
    }
  }
  if (!lots.length) return refusal('not_found')
  if (e.fp[0] !== 1 || e.fp[1] !== 1 || !e.capExempt) return refusal('not_available')
  const occ = occupiedMap()
  const bad: BatchLotFailure[] = []
  for (const l of lots) {
    if (l.x < 0 || l.y < 0 || l.x >= size() || l.y >= size()) bad.push({ ...l, kind: 'out_of_bounds' })
    else if (occ[l.y][l.x]) bad.push({ ...l, kind: 'occupied' })
    else if (!st.lots[l.y][l.x].buildable) bad.push({ ...l, kind: 'unbuildable' })
  }
  if (bad.length) return refusal('batch', { lots: bad })
  const total = e.cost * lots.length
  if (st.treasury < total) return refusal('insufficient_funds')
  if (args.confirm !== 'confirm') {
    const view: LotBatchConfirmView = { settlement_name: 'آمل', building: nameOf(code), lots, count: lots.length, cost_money: total, materials: null, build_time_seconds: e.time }
    const a = lots[0], z = lots[lots.length - 1]
    return mockOk('settlement_build_batch_confirm', view, [confirmA('settlement.build.place_many', { code, from: token(a.x, a.y), to: token(z.x, z.y) }), back('settlement.build')])
  }
  st.treasury -= total
  const made = lots.map((l) => { const b = mkRoad(l.x, l.y, 'under_construction', 25_000); st.buildings.push(b); schedule(b); return b })
  st.ver++
  emit({
    type: 'build_batch_started', type_code: code, count: made.length,
    buildings: made.map((b) => ({ building_id: b.id, lot_x: b.x, lot_y: b.y })), finish_at: new Date(made[0].finish!).toISOString(), layout_version: versions(),
  })
  return progressView()
}

// -- the building panel ----------------------------------------------------------------------

const EFFECTS: Record<string, { target: string; value: number }[]> = {
  watch_hut: [{ target: 'local_security_bps', value: 300 }],
  militia_camp: [{ target: 'local_security_bps', value: 350 }],
  village_house: [{ target: 'housing_capacity', value: 4 }],
  housing_block: [{ target: 'housing_capacity', value: 20 }],
  park: [{ target: 'happiness_bps', value: 150 }],
  farm_canal: [{ target: 'food_coverage_bps', value: 700 }],
}
const STOCK = [{ item: goods('timber'), kind: 'component', qty: 15 }, { item: goods('stone'), kind: 'component', qty: 8 }, { item: goods('wheat'), kind: 'item', qty: 120 }]

function panelKind(type: string, role: string): string {
  if (type === 'road') return 'road'
  if (type === 'civic_hall') return 'civic_hall'
  if (role === 'storage') return 'storage'
  if (role === 'education') return 'school'
  if (role === 'security') return 'security'
  return 'generic'
}

// W1 fixtures: fx-woodcutter-idle (no crew, nobody), fx-woodcutter-crew (2 labourers + 1 resident), fx-woodcutter-paused (budget spent), a granary, a road
// B2 fixtures (ADR 0067): fx-farm-<stage> (idle, sowing, growing, ripe, overripe, harvested, rotted, legacy, dry, nowater, noseed), fx-water-<on|off|worn>,
// fx-mill-<toll|nograin>, fx-pasture-<ok|short>
const b2 = { sown: new Set<string>(), have: 40, toll: 500 }
const iso = (ms: number) => new Date(Date.now() + ms).toISOString()
function b2Work(type: string, id: string): Pick<WorkNode, 'farm' | 'mill' | 'water' | 'grazing'> {
  const none = { farm: null, mill: null, water: null, grazing: null }
  const canal = { code: 'canal_channel', name: 'کانال آبرسانی' }
  if (type.startsWith('farm_') || /^fx-farm-/.test(id)) {
    let stage = (id.match(/^fx-farm-([a-z]+)/)?.[1]) ?? 'growing'
    if (b2.sown.has(id)) stage = 'sowing'
    const legacy = stage === 'legacy', dry = stage === 'dry'
    const st = ['legacy', 'dry', 'nowater', 'noseed'].includes(stage) ? (legacy ? 'idle' : 'growing') : stage
    const sowing = st === 'sowing'
    const farm = {
      stage: st, rainfed: dry, legacy, legacy_until: legacy ? iso(5 * 86400_000) : null,
      sow_done: st === 'idle' ? 0 : sowing ? 3 : 8, sow_need: 8, tended: st === 'growing' ? 2 : st === 'idle' || sowing ? 0 : 6, tend_max: 6, harvest_done: st === 'harvested' ? 12 : st === 'ripe' ? 4 : st === 'overripe' ? 4 : 0, harvest_need: 12,
      ripe_at: st === 'growing' ? iso(3.5 * 3600_000) : st === 'ripe' ? iso(-3600_000) : st === 'overripe' ? iso(-13 * 3600_000) : null,
      spoil_at: st === 'ripe' ? iso(11 * 3600_000) : st === 'overripe' ? iso(-1 * 3600_000) : st === 'growing' ? iso(15.5 * 3600_000) : null,
      seed: 25, seed_have: stage === 'noseed' ? 6 : 40, expected: st === 'idle' ? 0 : 168,
      factors: { soil: 9000, water: stage === 'nowater' ? 6000 : dry ? 8000 : 10000, tending: 10000 - (st === 'growing' ? 400 : 0), loss: st === 'overripe' ? 1000 : st === 'rotted' ? 10000 : 0 },
      water: dry ? null : { work: stage === 'nowater' ? null : canal, served: stage !== 'nowater', open: stage !== 'nowater', condition_bps: 8200, reason: stage === 'nowater' ? 'not_served' : '' },
      can_sow: (st === 'idle' || st === 'harvested' || st === 'rotted') && !legacy && stage !== 'noseed',
    }
    return { ...none, farm }
  }
  if (type === 'canal_channel' || /^fx-water-/.test(id)) {
    const k = id.match(/^fx-water-([a-z]+)/)?.[1] ?? 'on'
    return { ...none, water: { open: k !== 'off', condition_bps: k === 'worn' ? 3400 : 8200, serves: k === 'off' ? [{ code: 'f1', name: 'مزرعهٔ نهری' }] : [{ code: 'f1', name: 'مزرعهٔ نهری' }, { code: 'f2', name: 'شالیزار' }] } }
  }
  if (type === 'mill' || type === 'water_mill' || /^fx-mill-/.test(id)) {
    const k = id.match(/^fx-mill-([a-z]+)/)?.[1] ?? 'toll'
    return { ...none, mill: { toll_bps: b2.toll, min_bps: 333, max_bps: 1000, can_set: k !== 'viewer', batch: 20, have: k === 'nograin' ? 5 : b2.have, toll_units: Math.round(20 * b2.toll / 1000) / 10 } }
  }
  if (type === 'pasture_range' || /^fx-pasture-/.test(id)) {
    const ok = !/^fx-pasture-short/.test(id)
    return { ...none, grazing: { open: ok ? 11 : 4, need: 6, radius: 4 } }
  }
  return none
}

function workNode(type: string, id: string): WorkNode {
  const n = workNode0(type, id)
  // ?tools=bare (worn out: 60 percent output) | ok (tools in store) | none (the building uses no tool)
  const tools = (() => { try { return new URLSearchParams(location.search).get('tools') ?? 'none' } catch { return 'none' } })()
  const wears = tools !== 'none' && n.kind === 'production'
  return { ...n, ...b2Work(type, id), knowledge_bps: n.kind === 'production' ? 700 : 0, meal_points: n.meal_points ?? 0, food_shifts: n.food_shifts ?? 0, condition: n.condition ?? null,
    tool_wear_bps: wears ? 1000 : 0, tools_have: tools === 'ok' ? 3 : 0, bare_hands: tools === 'bare' && wears, bare_hands_bps: wears ? 6000 : 0 }
}
function workNode0(type: string, id: string): Omit<WorkNode, 'water' | 'mill' | 'farm' | 'grazing' | 'meal_points' | 'food_shifts' | 'condition' | 'tool_wear_bps' | 'tools_have' | 'bare_hands' | 'bare_hands_bps' | 'knowledge_bps'> & Partial<Pick<WorkNode, 'meal_points' | 'food_shifts' | 'condition'>> {
  const timber = goods('timber')
  if (type === 'road') return { kind: 'none', status: 'idle', reasons: [{ code: 'no_function', item: null, class: '', have: 0, need: 0 }], slots: null, filled: 0, max: 0, shift_seconds: 0, wage: 0, inputs: null, outputs: null, storage_class: '', storage_free: 0, job: null, if_unstaffed: '' }
  if (type === 'granary' || type === 'storehouse') return { kind: 'storage', status: 'idle', reasons: [{ code: 'no_keeper', item: null, class: 'food', have: 0, need: 0 }], slots: [{ role: 'storekeeper', worker: 'empty', name: '' }], filled: 0, max: 1, shift_seconds: 0, wage: 40, inputs: null, outputs: null, storage_class: 'food', storage_free: 62, job: null, if_unstaffed: 'base_room' }
  const food = id.includes('nofood') ? 0 : 12
  const real: Record<string, { inputs: { item: Named; qty: number }[] | null; outputs: { item: Named; qty: number }[]; cls: string }> = {
    clay_pit: { inputs: null, outputs: [{ item: goods('clay'), qty: 6 }], cls: 'bulk' },
    pottery_kiln: { inputs: [{ item: goods('clay'), qty: 3 }, { item: goods('firewood'), qty: 2 }], outputs: [{ item: goods('pots'), qty: 2 }], cls: 'goods' },
    paper_mill: { inputs: [{ item: goods('rag'), qty: 4 }, { item: goods('firewood'), qty: 1 }], outputs: [{ item: goods('paper'), qty: 3 }], cls: 'goods' },
    tool_workshop: { inputs: [{ item: goods('timber'), qty: 2 }, { item: goods('stone'), qty: 1 }], outputs: [{ item: goods('tools'), qty: 1 }], cls: 'goods' },
  }
  const rl = real[type]
  const base = { meal_points: 2, food_shifts: food, kind: 'production', shift_seconds: 3600 * 2, wage: 30, inputs: rl?.inputs ?? null, outputs: rl?.outputs ?? [{ item: timber, qty: 4 }], storage_class: rl?.cls ?? 'bulk', storage_free: 24, if_unstaffed: 'idle', max: 3 }
  const seat = (worker: string, name = ''): WorkSlot => ({ role: 'woodcutter', worker, name })
  const cd = (bps: number, extra: Partial<NonNullable<WorkNode['condition']>> = {}): WorkNode['condition'] => ({ bps, decay_bps_per_day: 50, output_bps: bps >= 5000 ? 10000 : bps >= 2500 ? 7500 : 0, closed: bps < 2500, can_repair: bps < 7000, repair_shifts: Math.ceil((10000 - bps) / 1000), repair_materials: [{ item: timber, qty: 4 }, { item: goods('stone'), qty: 2 }], repair_job: null, ...extra })
  const idle = { ...base, status: 'idle', reasons: [{ code: 'no_staff', item: null, class: '', have: 0, need: 3 }], slots: [seat('empty'), seat('empty'), seat('empty')], filled: 0, job: null }
  if (id.includes('worn')) return { ...idle, condition: cd(4000) }
  if (id.includes('closed')) return { ...idle, reasons: [{ code: 'needs_repair', item: null, class: '', have: 0, need: 0 }], condition: cd(1800) }
  if (id.includes('repairing')) return { ...idle, condition: cd(3000, { repair_job: { id: 'job-rep', wage: 30, npc_crew: 2, shifts_left: 5, priority: 4, paused: '' } }) }
  if (id.includes('nofood')) return { ...idle, status: 'paused', reasons: [{ code: 'no_food', item: null, class: '', have: 0, need: 2 }], job: { id: 'job-1', wage: 30, npc_crew: 2, shifts_left: 9, priority: 4, paused: 'no_food' } }
  if (id.includes('paused')) return { ...base, status: 'paused', reasons: [{ code: 'budget_spent', item: null, class: '', have: 0, need: 0 }, { code: 'storage_full', item: null, class: 'bulk', have: 1, need: 4 }], slots: [seat('empty'), seat('empty'), seat('empty')], filled: 0, job: { id: 'job-1', wage: 30, npc_crew: 2, shifts_left: 0, priority: 4, paused: 'budget_spent' } }
  if (id.includes('crew')) return { ...base, status: 'working', reasons: null, slots: [seat('npc'), seat('npc'), seat('player', 'کاوه')], filled: 3, job: { id: 'job-1', wage: 30, npc_crew: 2, shifts_left: 14, priority: 4, paused: '' } }
  return { ...base, status: 'idle', reasons: [{ code: 'no_staff', item: null, class: '', have: 0, need: 3 }], slots: [seat('empty'), seat('empty'), seat('empty')], filled: 0, job: null }
}

/** ?up=ok | know | bld | mat | money | learn | all: an upgrade line in the server's real shape (materials, shifts, staff, upkeep, effects, capacity, ready, needs[] with how and where) */
function upgradeLine(code: string, tier: number, secs: number) {
  const m = (() => { try { return new URLSearchParams(location.search).get('up') ?? 'know' } catch { return 'know' } })()
  const all = m === 'all', P = (kind: string, item: Named, o: Partial<Prerequisite> = {}): Prerequisite => ({ kind, item, role: '', tier: 0, have: 0, need: 1, how: '', where: '', options: null, makers: null, price: 0, ...o })
  const needs: Prerequisite[] = []
  if (m === 'know' || all) needs.push(P('knowledge', kn('irrigation'), { how: 'research', options: [kn('irrigation')] }), P('knowledge', kn('masonry'), { how: 'research', options: [kn('masonry')] }))
  else needs.push(P('knowledge', kn('irrigation'), { have: 1, how: 'research' }))
  if (m === 'bld' || all) needs.push(P('building', nameOf('carpentry_workshop'), { how: 'build', role: 'craft', options: [nameOf('carpentry_workshop')] }))
  needs.push(P('item', goods('timber'), { have: m === 'mat' || all ? 4 : 12, need: 12, how: 'buy', price: 22, makers: [{ building: nameOf('woodcutter_camp'), built: true }] }))
  needs.push(P('item', goods('stone'), { have: 6, need: 6, how: 'buy', price: 30 }))
  if (m === 'learn' || all) needs.push(P('literacy', { code: 'literacy', name: 'سواد' }, { have: 3400, need: 5000, how: 'train' }))
  if (all) needs.push(P('terrain', { code: 'river', name: 'کنار رودخانه' }, { how: 'travel', where: 'سرخه' }))
  const short = m === 'money' || all
  needs.push(P('money', { code: 'sup', name: 'ساپ' }, { have: short ? 1500 : 12000, need: 4800, how: 'donate' }))
  const ok = needs.every((n) => n.have >= n.need)
  return {
    building: nameOf(code), tier, cost_money: 4800, build_time_seconds: secs, expected_wait: waitOf(secs), available: ok, ready: ok, missing: null,
    materials: [{ item: goods('timber'), qty: 12 }, { item: goods('stone'), qty: 6 }], shifts: 9, needs,
    staff: [{ role: { code: 'clerk', name: 'منشی' }, slots: 2, wage_bps: 10000, shift_hours: 2 }], upkeep_money: 90, consumes: [{ item: goods('timber'), qty: 2 }],
    effects: [{ target: 'housing_capacity', value: 4 }, { target: 'happiness_bps', value: 300 }], capacity: [{ kind: 'research_slots', code: '', value: 1 }, { kind: 'storage', code: 'food', value: 80 }],
  }
}

function buildingView(args: Record<string, unknown>) {
  const id = String(args.building_id ?? '')
  const b = st.buildings.find((x) => x.id === id) ?? (() => {
    const fx = id.match(/^fx-(woodcutter|granary|road|clay|kiln|paper|tools|farm|water|mill|pasture)/)
    if (fx) return { id, type: ({ woodcutter: 'woodcutter_camp', clay: 'clay_pit', kiln: 'pottery_kiln', paper: 'paper_mill', tools: 'tool_workshop', farm: 'farm_canal', water: 'canal_channel', mill: 'water_mill', pasture: 'pasture_range' } as Record<string, string>)[fx[1]] ?? fx[1], x: 5, y: 5, w: 2, h: 2, rotated: false, state: 'built', seed: 7 } as MBuilding
    const m = id.match(/^road-(\d+)-(\d+)$/)
    return m ? ({ id, type: 'road', x: +m[1], y: +m[2], w: 1, h: 1, rotated: false, state: 'built', seed: 7 } as MBuilding) : undefined
  })()
  if (!b) return refusal('not_found')
  const e = CAT.find((c) => c.code === b.type) ?? citizenEntry(b.type)
  const role = e?.role ?? ''
  const kind = panelKind(b.type, role)
  const going = b.state === 'under_construction' || b.state === 'planned'
  const mode = args.mode === 'up' ? 'up' : args.mode === 'dm' ? 'dm' : args.mode === 'cx' ? 'cx' : ''
  const view: BuildingView = {
    id: b.id, building: nameOf(b.type), role, tier: 1, kind, state: going ? 'building' : 'complete', mode, x: b.x, y: b.y, w: b.w, h: b.h, rotated: b.rotated,
    upkeep: b.type === 'road' ? 2 : 20, effects: EFFECTS[b.type] ?? null, can_manage: !b.priv || !!b.mine, started_at: null, finish_at: null, left_seconds: 0, progress_percent: 0,
    stock: null, stock_used: 0, stock_capacity: 0, literacy_percent: 0, teaching: false, treasury: 0, population: 0, research: null, has_upgrade: false, upgrades: null, shop: null,
    work: going ? null : workNode(b.type, id),
  }
  if (going) {
    const started = b.started ?? Date.now(), finish = b.finish ?? Date.now()
    view.started_at = new Date(started).toISOString()
    view.finish_at = new Date(finish).toISOString()
    view.left_seconds = Math.max(0, Math.round((finish - Date.now()) / 1000))
    view.progress_percent = Math.max(0, Math.min(100, Math.round(((Date.now() - started) / Math.max(1, finish - started)) * 100)))
  } else {
    if (kind === 'storage') { view.stock = STOCK; view.stock_used = Object.values(MAT_STOCK).reduce((a, q) => a + q, 0); view.stock_capacity = MAT_BASE_CAP }
    if (kind === 'school') { view.literacy_percent = st.literacy; view.teaching = true }
    if (kind === 'civic_hall') {
      view.treasury = st.treasury; view.population = 2
      // the hall can be upgraded once the village knows irrigation (a requirement left unmet, for the confirm popup)
      view.tier = 2; view.has_upgrade = true
      if (mode === 'up') view.upgrades = [upgradeLine('civic_hall', 3, 3600)]
      const run = st.know.find((k) => k.state === 'researching')
      view.research = run ? { knowledge: kn(run.code), finish_at: new Date(run.finish ?? Date.now()).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? Date.now()) - Date.now()) / 1000)) } : null
    }
    if (role === 'education') {
      view.has_upgrade = true
      if (mode === 'up') {
        const sc = CAT.find((c) => c.code === 'school')!
        const miss = unmet(sc)
        view.upgrades = [upgradeLine('school', 2, sc.time)]
      }
    }
  }
  const acts: MockAct[] = []
  if (mode === 'dm') acts.push(A('building.demolish_yes', 'settlement.build.demolish', { id: b.id }, { kind: 'danger' }), back('settlement.building.view', { building_id: b.id }))
  else if (mode === 'cx') acts.push(A('building.cancel_yes', 'settlement.build.cancel', { id: b.id }, { kind: 'danger' }), back('settlement.building.view', { building_id: b.id }))
  else if (mode === 'up') {
    for (const u of view.upgrades ?? []) if (u.available) acts.push(A('build.place', 'settlement.build.lots', { code: u.building.code }, { subject: u.building.code }))
    acts.push(back('settlement.building.view', { building_id: b.id }))
  } else {
    if (!going && kind === 'civic_hall') acts.push(A('village.overview', 'settlement.overview'), A('village.knowledge', 'settlement.knowledge'), A('village.build', 'settlement.build'), A('village.progress', 'settlement.build.progress'))
    if (view.can_manage) {
      if (going) acts.push(A('building.cancel', 'settlement.building.view', { building_id: b.id, mode: 'cx' }, { kind: 'danger' }))
      else if (view.has_upgrade) acts.push(A('building.upgrade', 'settlement.building.view', { building_id: b.id, mode: 'up' }))
      if (!going) acts.push(A('building.demolish', 'settlement.building.view', { building_id: b.id, mode: 'dm' }, { kind: 'danger' }))
    }
    acts.push(back('settlement.build.progress'), refreshA('settlement.building.view', { building_id: b.id }))
  }
  return mockOk('settlement_building_view', view, acts)
}

// -- land -------------------------------------------------------------------------------------------

// -- storage and market (settlement.materials, .buy) ---------------------------------------------
const MARKET = [
  { item: goods('timber'), price: 22 },
  { item: goods('stone'), price: 30 },
  { item: goods('iron_bar'), price: 64 },
  { item: goods('tools'), price: 40 },
  { item: goods('paper'), price: 25 },
  { item: goods('wheat'), price: 9 },
]
const MAT_STOCK: Record<string, number> = { timber: 95, stone: 48, firewood: 12, clay: 9, tools: 2, rag: 6, hide: 3, pots: 4, paper: 1 }
const MAT_BASE_CAP = 60
function materialsView(bought?: { item: Named; qty: number; total: number }) {
  const used = Object.values(MAT_STOCK).reduce((a, b) => a + b, 0)
  const stock = Object.keys(MAT_STOCK).sort().map((c) => ({ item: goods(c), qty: MAT_STOCK[c] }))
  // ?stor=grace (default, Marco Polo during the grace), after (the grace is over), fresh (a new city: communal room only)
  const mode = (() => { try { return new URLSearchParams(location.search).get('stor') ?? 'grace' } catch { return 'grace' } })()
  const bulkB = goods('storehouse'), stack = [goods('storehouse')]
  const standIn = (() => { try { return new URLSearchParams(location.search).get('standin') ?? '' } catch { return '' } })()
  const si = standIn === '1' ? { stand_ins: [{ item: goods('paper'), stand: goods('wool') }, { item: goods('firewood'), stand: goods('timber') }], stand_in_until: new Date(Date.now() + 9 * 86400_000).toISOString() } : { stand_ins: null, stand_in_until: null }
  const view: MaterialsView = mode === 'fresh'
    ? { village: 'آمل', treasury: 0, stock: [{ item: goods('wheat'), qty: 30 }], used: 30, capacity: 120, over: 0, transition: null,
      classes: [{ class: 'bulk', used: 0, capacity: 20, reserved: 0, over: 0, borrowed: 0, build: null }, { class: 'food', used: 30, capacity: 120, reserved: 0, over: 0, borrowed: 0, build: null }, { class: 'goods', used: 0, capacity: 20, reserved: 0, over: 0, borrowed: 0, build: null }],
      stores: [{ building: goods('granary'), kept: false, communal_room: 100, grace_until: null }, { building: goods('storehouse'), kept: false, communal_room: 100, grace_until: null }], wage: 40, spoil_bps: 5, market: MARKET, can_buy: IS_HEAD, presets: [5, 10, 25], bought: bought ?? null, ...si }
    : (() => {
      const after = mode === 'after'
      const cls = after
        ? [{ class: 'bulk', used: 156, capacity: 60, reserved: 0, over: 96, borrowed: 0, build: [bulkB] }, { class: 'food', used: 40, capacity: 100, reserved: 0, over: 0, borrowed: 0, build: null }, { class: 'goods', used: 25, capacity: 20, reserved: 0, over: 5, borrowed: 0, build: stack }]
        : [{ class: 'bulk', used: 156, capacity: 156, reserved: 0, over: 0, borrowed: 96, build: null }, { class: 'food', used: 40, capacity: 100, reserved: 0, over: 0, borrowed: 0, build: null }, { class: 'goods', used: 25, capacity: 25, reserved: 0, over: 0, borrowed: 5, build: null }]
      return { village: 'مارکو پلو', treasury: st.treasury, stock: [{ item: goods('timber'), qty: 53 }, { item: goods('stone'), qty: 25 }, { item: goods('wool'), qty: 25 }, { item: goods('wheat'), qty: 40 }], used: 221, capacity: after ? 180 : 281, over: after ? 101 : 0,
        transition: after ? null : { until: '2026-10-17T00:00:00Z' }, classes: cls,
        stores: [{ building: goods('granary'), kept: true, communal_room: 0, grace_until: null }, { building: goods('granary'), kept: false, communal_room: 100, grace_until: null }], wage: 40, spoil_bps: 5, market: MARKET, can_buy: IS_HEAD, presets: [5, 10, 25], bought: bought ?? null, ...si } as MaterialsView
    })()
  const acts: MockAct[] = []
  if (IS_HEAD) for (const l of MARKET) for (const q of [5, 10, 25]) acts.push(A('materials.buy', 'settlement.materials.buy', { item: l.item.code, qty: String(q) }, { subject: l.item.code }))
  return mockOk('village_materials', view, [...acts, A('village.work', 'settlement.work'), A('village.build', 'settlement.build'), back('settlement.overview'), refreshA('settlement.materials')])
}
function materialsBuy(args: Record<string, unknown>) {
  const line = MARKET.find((m) => m.item.code === String(args.item ?? ''))
  const qty = Number(args.qty)
  if (!line || !(qty >= 1)) return refusal('not_found')
  const total = line.price * qty
  const used = Object.values(MAT_STOCK).reduce((a, b) => a + b, 0)
  if (used + qty > MAT_BASE_CAP) return refusal('storage_full', { back: { command: 'settlement.materials', args: null } })
  if (args.confirm !== 'confirm') {
    const view: MaterialBuyView = { village: 'آمل', item: line.item, qty, unit: line.price, total, treasury: st.treasury, free: MAT_BASE_CAP - used }
    return mockOk('village_materials_buy_confirm', view, [confirmA('settlement.materials.buy', { item: line.item.code, qty: String(qty) }), back('settlement.materials')])
  }
  if (st.treasury < total) return refusal('insufficient_funds', { back: { command: 'settlement.materials', args: null } })
  st.treasury -= total
  MAT_STOCK[line.item.code] = (MAT_STOCK[line.item.code] ?? 0) + qty
  return materialsView({ item: line.item, qty, total })
}

const SHOP_SH = { code: 'food.staples', group: 'food', label: 'خوراک پایه', group_label: 'item_shelf_group.food' }
function shopView() {
  const view: Record<string, unknown> = {
    village: 'آمل', building: true, closed: '', next_delivery: new Date(Date.now() + 3 * 3600_000).toISOString(), delivery_hour: 6, zone_minutes: MOCK_ZONE, wage: 40,
    tax_bps: 300, tax_max_bps: 1000, tax_presets: [0, 300, 500, 1000], price_cap_bps: 12000, cap_min_bps: 10000, cap_max_bps: 15000, cap_presets: [10500, 12000, 15000],
    can_set_cap: IS_HEAD, presets: [1, 5, 10], resident: true,
    lines: [
      { item: goods('rice'), kind: 'item', shelf: SHOP_SH, price: 13, reference: 12, stock: 40, left_today: 6, fits: 12, max_buy: 6, tradable: true },
      { item: goods('tea'), kind: 'item', shelf: SHOP_SH, price: 9, reference: 8, stock: 0, left_today: 0, fits: 12, max_buy: 0, tradable: true },
      { item: goods('bandage'), kind: 'item', shelf: { code: 'medicine.first_aid', group: 'medicine', label: 'کمک‌های اولیه', group_label: 'item_shelf_group.medicine' }, price: 28, reference: 24, stock: 9, left_today: 2, fits: 0, max_buy: 0, tradable: false },
    ],
    locked: [{ item: goods('timber'), kind: 'component', shelf: SHOP_SH, needs_buildings: [goods('woodcutter_camp')], needs_knowledge: null }],
    free_space: 6, capacity: 20, free_g: 9000,
    repairs: [{ item: goods('bag_sack'), serial: 'sk-1a2b', slot: 'back', wear: 40, wear_max: 100, torn: false, cost: 12 }], can_repair: true, cash: 800, bought: null, mended: null,
  }
  return mockOk('village_shop', view as never, [back('settlement.overview'), refreshA('settlement.shop')])
}
function shopBuy(args: Record<string, unknown>) {
  const qty = Number(args.qty ?? 1)
  const unit = 13
  if (args.method) return shopView()
  return mockOk('village_shop_checkout', {
    village: 'آمل', item: goods(String(args.item ?? 'rice')), kind: 'item', qty, unit, total: unit * qty, tax: Math.round(unit * qty * 0.03), tax_bps: 300, stock: 40,
    space: qty, free_space: 6, grams: qty * 1000, payment: { amount: unit * qty, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 800, bank: 3000 }, nonce: 'sn1',
  }, [A('shop.pay', 'settlement.shop.buy', { item: String(args.item ?? 'rice'), qty: String(qty), method: 'cash', nonce: 'sn1' }, { kind: 'confirm' }),
    A('shop.pay', 'settlement.shop.buy', { item: String(args.item ?? 'rice'), qty: String(qty), method: 'card', nonce: 'sn1' }, { kind: 'confirm' }), back('settlement.shop')])
}
function moneyView() {
  const none = (() => { try { return new URLSearchParams(location.search).get('cur') === 'none' } catch { return false } })()
  return mockOk('village_money', {
    village: 'آمل', chartered: none ? null : { r0: 10, x_ref_ppm: 1_000_000, supply: 49750, pot_sup: 5000, treasury_units: 40000, status: 'chartered', basis_sup: 4800, excess_sup: 200, market_cap_sup: 4975, coverage_bps: 10050, coverage_known: true, stabilisation_units: 0, macro: null, trend: null }, can_charter: none && IS_HEAD,
    currency: { code: none ? 'SUP' : 'MKP', name: none ? 'ساپ' : 'مارک پولو', symbol: '', issued: !none }, market: 'none', reserve: 'none', nil_unit_sup: 1000, nil_per_unit_micro: 2400,
    examples: [{ amount: 100, nil_micro: 240 }, { amount: 1000, nil_micro: 2400 }], treasury: st.treasury, treasury_nil_micro: st.treasury * 2400, output: 1800, output_nil_micro: 4320000, output_days: 7,
    residents: 9, basket: [{ item: goods('rice'), kind: 'item', week_milli: 1400, reference: 12, price: 13, on_shelf: true }, { item: goods('tea'), kind: 'item', week_milli: 200, reference: 8, price: 9, on_shelf: false }], index_bps: 10800, cover_bps: 7500,
  }, [back('settlement.shop'), refreshA('settlement.money'), ...(none && IS_HEAD ? [A('currency.charter', 'settlement.currency.charter')] : []), ...(none ? [] : [A('currency.desk', 'settlement.currency.desk'), A('fx.book', 'fx.book'), A('currency.reserve', 'settlement.currency.reserve')])])
}
// the desk: ?desk=empty for a treasury with no units; the head (default) may set the fee, ?role=resident may not
let deskFeeBps = 30
function deskView(args: Record<string, unknown>, stage: 'menu' | 'ask' | 'done' = 'menu') {
  const empty = (() => { try { return new URLSearchParams(location.search).get('desk') === 'empty' } catch { return false } })()
  const rate = 10, cashSup = 12450, cashUnits = 320, deskUnits = empty ? 0 : 40000, deskSup = 9000
  const side = String(args.side ?? 'buy') === 'sell' ? 'sell' : 'buy'
  const amount = Number(args.amount ?? 0)
  let fee = 0, units = 0, sup = 0
  if (side === 'buy') { fee = Math.ceil(amount * deskFeeBps / 10000); units = Math.floor((amount - fee) * rate) } else { fee = Math.ceil(amount * deskFeeBps / 10000); sup = Math.floor((amount - fee) / rate) }
  const view = { village: 'آمل', name: 'مارک پولو', symbol: 'MKP', stage, side, amount, sup, units, fee, fee_bps: deskFeeBps, r0: 10, x_ref_ppm: 1_000_000, cash_sup: cashSup, cash_units: cashUnits, desk_units: deskUnits, desk_sup: deskSup, slippage_bps: 100,
    presets_sup: [100, 1000, 10000], presets_units: [1000, 10000, 100000], can_set_fee: IS_HEAD, can_buy: !empty, can_sell: deskSup > 0, min_fee_bps: 10, max_fee_bps: 300 }
  if (stage === 'ask') return mockOk('village_currency_desk', view, [confirmA('settlement.currency.desk', { side, amount: String(amount), quote: String(side === 'buy' ? units : sup) }), back('settlement.currency.desk')])
  return mockOk('village_currency_desk', view, [back('settlement.money'), refreshA('settlement.currency.desk')])
}
function charterView(args: Record<string, unknown>) {
  const r0 = Number(args.r0 ?? 10)
  const view = { village: 'آمل', name: 'مارک پولو', symbol: 'MKP', stage: 'ask', treasury: st.treasury, fee: 1000, min_deposit: 5000, deposit: 5000, r0, r0_options: [1, 10, 100], mint_fee_bps: 50, units: Math.floor(5000 * r0 * 0.995), can_pay: st.treasury >= 6000, supply: 0, pot_sup: 0, x_ref_ppm: 1_000_000 }
  return mockOk('village_currency_charter', view, [confirmA('settlement.currency.charter', { r0: String(r0), deposit: '5000' }), back('settlement.money')])
}

export function mockVillageCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  if (!command.startsWith('settlement.')) return null
  if (command.startsWith('settlement.labor.')) return mockLaborCommand(command, args)
  init()
  switch (command) {
    case 'settlement.overview': return overviewView()
    case 'settlement.materials': return materialsView()
    case 'settlement.materials.buy': return materialsBuy(args)
    case 'settlement.shop': return shopView()
    case 'settlement.shop.buy': return shopBuy(args)
    case 'settlement.shop.cap': case 'settlement.shop.tax': return shopView()
    case 'settlement.money': return moneyView()
    case 'settlement.currency.charter': return charterView(args)
    case 'settlement.currency.desk': return args.confirm ? deskView(args, 'done') : args.amount ? deskView(args, 'ask') : deskView(args)
    case 'settlement.currency.fee': { deskFeeBps = Math.max(10, Math.min(300, Number(args.bps ?? 30))); return deskView({}) }
    case 'settlement.build': return menuView()
    case 'settlement.build.lots': return lotsView(String(args.code ?? ''), args.rotate === '1' || args.rotate === 1 || args.rotate === true, String(args.from ?? ''))
    case 'settlement.clear.order': case 'settlement.clear.cancel': { const r = clearCommand(command, args); emit({ type: 'land_changed', kind: 'ordered', x: Number(args.x), y: Number(args.y), layout_version: versions() }); return r }
    case 'settlement.farm.sow': {
      const fid = String(args.id ?? '')
      const f = b2Work('farm_canal', fid).farm
      if (!f) return refusal('farm_not_farm')
      if (f.legacy) return refusal('farm_legacy')
      if (!f.can_sow) return refusal('farm_busy')
      b2.sown.add(fid); st.ver++
      emit({ type: 'land_changed', kind: 'farm_sown', x: 2, y: 0, layout_version: versions() })
      return mockOk('farm_sow', { village: 'آمل', farm: nameOf('farm_canal'), line: b2Work('farm_canal', fid).farm! }, [back('settlement.overview')])
    }
    case 'settlement.mill.toll': {
      const bps = Number(args.bps)
      if (!(bps >= 333 && bps <= 1000)) return refusal('toll_range')
      b2.toll = bps
      return mockOk('mill_toll', { village: 'آمل', toll_bps: bps, min_bps: 333, max_bps: 1000 }, [back('settlement.overview')])
    }
    case 'settlement.mill.grind': {
      if (b2.have < 20) return refusal('mill_no_grain')
      b2.have -= 20
      return workView({})
    }
    case 'settlement.build.place': return place(args)
    case 'settlement.build.place_many': return placeMany(args)
    case 'settlement.building.view': return buildingView(args)
    case 'settlement.road.plan': return roadPlan(args)
    case 'settlement.road.cancel': return roadCancel(args)
    case 'settlement.build.cancel': return cancelOrDemolish(args, false)
    case 'settlement.build.demolish': return cancelOrDemolish(args, true)
    case 'settlement.build.progress': return progressView()
    case 'settlement.knowledge': return knowledgeView()
    case 'settlement.knowledge.research': return knowledgeAct(args, false)
    case 'settlement.knowledge.buy': return knowledgeAct(args, true)
    case 'settlement.donate': return donate(args)
    case 'settlement.lot.buy': return lotBuy(args)
    case 'settlement.lot.access': return lotAccess(args)
    case 'settlement.lot.repair': return lotRepair(args)
    case 'settlement.private': return privateMenu()
    case 'settlement.private.place': return privatePlace(args)
    case 'settlement.mine': return mineView('')
    case 'settlement.home.rest': return homeRest()
    case 'settlement.who': return whoView()
    case 'settlement.land': return landView()
    case 'settlement.private.lots': return privateLots(args)
    case 'settlement.tax.pay': return taxPay()
    case 'settlement.terms': return termsView(args)
    case 'settlement.timezone.set': case 'settlement.charter.view': case 'settlement.charter.office.save': case 'settlement.charter.office.close': case 'settlement.charter.appoint': case 'settlement.charter.dismiss': case 'settlement.charter.resign': case 'settlement.charter.election.open': case 'settlement.charter.stand': case 'settlement.charter.vote': case 'settlement.charter.recall.start': case 'settlement.charter.recall.sign': return mockCharter(command, args, IS_HEAD)
    case 'settlement.development.view': return developmentView()
    case 'settlement.promotion.view': case 'settlement.promote': return developmentView()
    case 'settlement.join': return residence(false, args)
    case 'settlement.leave': return residence(true, args)
    case 'settlement.work': return workView(args)
    case 'settlement.home': return homeCall()
    case 'settlement.home.none': return homeNone()
    default: return null
  }
}

/** REST routes of the world and the village; null when the path is not one. */
export function mockVillageRoute(path: string, method: string, headers: Headers): Response | null {
  if (path === '/api/v1/world') return json(MOCK_WORLD)
  if (path === '/api/v1/content') {
    return json({
      version: 'v1', langs: ['en', 'fa'],
      availability: SOCIETY_CONTENT.availability,
      entries: mergeTables(ACTIVITIES_CONTENT, mergeTables(P1_CONTENT, mergeTables(MILITARY_CONTENT, mergeTables(mergeTables(SOCIETY_CONTENT.entries, COMPANIES_CONTENT), mergeTables({
        settlement_building: [{ code: 'storehouse', name: { en: 'Storehouse', fa: 'انبار کالا' }, category: 'storage', footprint: [2, 2] }, { code: 'stall', name: { en: 'Stall', fa: 'دکه' }, category: 'market', footprint: [1, 1] }, ...[...CAT, ...CITIZEN_CAT].map((c) => ({ code: c.code, name: { en: c.en, fa: c.fa }, category: c.role, footprint: c.fp, ...(c.capExempt ? { cap_exempt: true } : {}) }))],
        // the names of everything else the village screens mention, in both languages (the web never shows the view's authored English)
        city: [{ code: 'calderis', name: { en: 'Calderis', fa: 'کالدریس' } }, { code: 'support', name: { en: 'Central City', fa: 'شهر مرکزی' } }],
        place: [{ code: 'old_town', name: { en: 'Old Town', fa: 'مرکز شهر' } }, { code: 'harbour', name: { en: 'Harbour', fa: 'بندر' } }, ...ECONOMY_CONTENT.place],
        component: [{ code: 'wool', name: { en: 'Wool', fa: 'پشم' } }, { code: 'firewood', name: { en: 'Firewood', fa: 'هیزم' } }, { code: 'clay', name: { en: 'Clay', fa: 'گِل رس' } }, { code: 'pots', name: { en: 'Pots', fa: 'ظرف سفالی' } }, { code: 'hide', name: { en: 'Hide', fa: 'پوست خام' } }, { code: 'rag', name: { en: 'Rags', fa: 'پارچهٔ کهنه' } }, { code: 'charcoal', name: { en: 'Charcoal', fa: 'زغال' } }, { code: 'bloom', name: { en: 'Bloom iron', fa: 'آهن اسفنجی' } }, { code: 'bricks', name: { en: 'Bricks', fa: 'آجر' } }, { code: 'leather', name: { en: 'Leather', fa: 'چرم' } }, { code: 'bark', name: { en: 'Bark', fa: 'پوست درخت' } }, { code: 'flour', name: { en: 'Flour', fa: 'آرد' } }, { code: 'water', name: { en: 'Water', fa: 'آب' } }, { code: 'paper', name: { en: 'Paper', fa: 'کاغذ' } }, { code: 'tools', name: { en: 'Tools', fa: 'ابزار' } }, { code: 'timber', name: { en: 'Timber', fa: 'الوار' } }, { code: 'stone', name: { en: 'Stone', fa: 'سنگ' } }, { code: 'iron_bar', name: { en: 'Iron bar', fa: 'شمش آهن' } }],
        item: [{ code: 'tea', name: { en: 'Tea', fa: 'چای' } }, { code: 'bag_sack', name: { en: 'Sack', fa: 'کیسه' } }, { code: 'wheat', name: { en: 'Wheat', fa: 'گندم' } }, { code: 'bread', name: { en: 'Bread', fa: 'نان' } }, { code: 'bandage', name: { en: 'Bandage', fa: 'باند' } }, { code: 'soda', name: { en: 'Soda', fa: 'نوشابه' } }, { code: 'pill', name: { en: 'Pill', fa: 'قرص' } }, { code: 'ring', name: { en: 'Ring', fa: 'انگشتر' } }, { code: 'pistol', name: { en: 'Pistol', fa: 'کلت' } }, ...ECONOMY_CONTENT.item.filter((i) => i.code !== 'bread')],
        item_shelf_group: [['food', 'خوراک', 'Food'], ['medicine', 'دارو و کمک‌های اولیه', 'Medicine'], ['materials', 'مصالح و مواد', 'Materials'], ['tools', 'ابزار', 'Tools'], ['bags', 'کیف و بار', 'Bags']].map(([code, fa, en]) => ({ code, name: { en, fa } })),
        shop: ECONOMY_CONTENT.shop, budget_line: ECONOMY_CONTENT.budget_line, company_type: ECONOMY_CONTENT.company_type,
        // what the pushed notices name (api/client-api.md section 4.1)
        crime: [{ code: 'pickpocket', name: { en: 'Pickpocketing', fa: 'جیب‌بری' } }, { code: 'warehouse_heist', name: { en: 'Warehouse heist', fa: 'دزدی از انبار' } }],
        achievement: [{ code: 'first_job', name: { en: 'First job', fa: 'اولین کار' } }],
        mission: [{ code: 'deliver_flour', name: { en: 'Deliver the flour', fa: 'رساندن آرد' } }],
        property_type: [{ code: 'cottage', name: { en: 'Cottage', fa: 'کلبه' } }, ...ECONOMY_CONTENT.property_type],
        treaty_type: [{ code: 'trade', name: { en: 'trade treaty', fa: 'پیمان تجاری' } }],
        loan_product: ECONOMY_CONTENT.loan_product,
        insurance_product: [{ code: 'property_cover', name: { en: 'Property cover', fa: 'بیمهٔ ملک' } }, ...ECONOMY_CONTENT.insurance_product],
        office: [{ code: 'mayor', name: { en: 'Mayor', fa: 'شهردار' } }, { code: 'deputy_mayor', name: { en: 'Deputy mayor', fa: 'معاون شهردار' } }, { code: 'city_council', name: { en: 'City council', fa: 'شورای شهر' } }],
        skill: [{ code: 'baking', name: { en: 'Baking', fa: 'نانوایی' } }],
        life_rank: [{ code: 'merchant', name: { en: 'Merchant', fa: 'بازرگان' } }, { code: 'citizen', name: { en: 'Citizen', fa: 'شهروند' } }],
        knowledge: Object.keys(KNOW_NAMES).map((k) => ({ code: k, name: { en: KNOW_EN[k] ?? k, fa: KNOW_NAMES[k] } })),
        // what the life area names: cities, places, ways to travel, ranks, goods, property...
      } as Record<string, { code: string; name: { en: string; fa: string } }[]>, LIFE_CONTENT))))),
    })
  }
  let m = path.match(/^\/api\/v1\/world\/chunks\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  if (m) {
    const bytes = mockChunkBytes(+m[1], +m[2], +m[3], +m[4])
    return bytes ? new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/vnd.torncity.chunk' } }) : json({ ok: false, error: { code: 'bad_chunk', message: 'bad chunk' } }, 400)
  }
  m = path.match(/^\/api\/v1\/settlements\/([^/]+)\/layout$/)
  if (m) {
    const id = decodeURIComponent(m[1])
    if (id !== OWN_ID && id !== OTHER_ID) return json({ ok: false, error: { code: 'not_found', message: 'not found' } }, 404)
    const layout = layoutFor(id)
    const etag = `"${layout.version}.${layout.detail}${layout.woods ? '.' + layout.woods.mark : ''}"`
    if (headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } })
    return json(layout, 200, { ETag: etag, 'Cache-Control': 'private, no-cache' })
  }
  m = path.match(/^\/api\/v1\/settlements\/([^/]+)\/players$/)
  if (m) {
    init()
    return decodeURIComponent(m[1]) === OWN_ID ? json(roster()) : json({ ok: false, error: { code: 'not_in_settlement', message: 'forbidden' } }, 403)
  }
  if (path === '/api/v1/realtime/heartbeat' && method === 'POST') return json({ ok: true, ttl_seconds: 30 })
  m = path.match(/^\/api\/v1\/players\/([^/]+)\/status$/)
  if (m) {
    const p = roster().players.find((x) => x.id === decodeURIComponent(m![1]))
    return p ? json(p) : json({ id: m[1], visible: false })
  }
  return null
}

/** Handles for tests and screenshots (mock mode only). */
export function installVillageMockHandles(): void {
  ;(window as unknown as { __villageMock?: unknown }).__villageMock = {
    state: st,
    /** Publishes an event as the server would. */
    emit: (type: SettlementEvent['type'], extra: Record<string, unknown> = {}) => emit({ type, ...extra } as never),
    /** Skips the counter ahead, as a lost publication would. */
    skipSeq: (n = 3) => { st.seq += n },
    /** Changes the layout behind the store's back (as another device would). */
    finishNext: () => { const b = st.buildings.find((x) => x.state === 'under_construction'); if (b) finish(b.id) },
    ids: { own: OWN_ID, other: OTHER_ID },
  }
}

// -- state sync (client-api.md 5.6): the settlement summary the mock server's log carries -------

/** The own village as the store's `settlement` entity shows it to this viewer. */
export function mockVillageSummary(): {
  id: string; code: string; name: string; tier: string; viewer: 'head' | 'member'; grid_lots: number; layout_version: string
  treasury: number; knowledge: number; research: { code: string; finish_at: string } | null
} {
  init()
  const run = st.know.find((k) => k.state === 'researching' && k.finish)
  return {
    research: run ? { code: run.code, finish_at: new Date(run.finish!).toISOString() } : null,
    id: OWN_ID, code: 'v-k3x9', name: 'آمل', tier: 'village', viewer: IS_HEAD ? 'head' : 'member', grid_lots: size(),
    layout_version: `${IS_HEAD ? 'h' : 'm'}${st.ver}`, treasury: st.treasury,
    knowledge: st.know.filter((k) => k.state === 'held').length,
  }
}

/** The server's per-viewer building overlay (settlement.buildings of state sync), as the mock village knows it: the head
 * acts on the village's buildings, a resident on their own and on the shared ones they may use; a standing road has none. */
export function mockBuildingOverlays(): BuildingOverlay[] {
  init()
  const out: BuildingOverlay[] = []
  for (const b of st.buildings) {
    if (b.type === 'road') continue
    const e = CAT.find((c) => c.code === b.type) ?? citizenEntry(b.type)
    const role = e?.role ?? ''
    const manage = b.priv ? !!b.mine : IS_HEAD
    const o: BuildingOverlay = { id: b.id, tier: b.type === 'civic_hall' ? 2 : 1, ...(role ? { role } : {}), status: 'working', reasons: [], can_upgrade: false, actions: ['info'] }
    if (b.state === 'under_construction' || b.state === 'planned') {
      o.status = 'building'
      o.actions.push('help_build')
      if (manage) o.actions.push('workers', 'cancel')
    } else {
      if (b.type === 'civic_hall') {
        o.actions.push('treasury')
        if (IS_HEAD) o.actions.push('research')
        if (mockElection()) o.actions.push('elections')
        if (manage) o.actions.push('upgrade') // the hall's next step waits for irrigation: the verb stays, the arrow does not
      }
      if (role === 'education' && manage) {
        o.actions.push('upgrade')
        const sc = CAT.find((c) => c.code === 'school')!
        o.can_upgrade = unmet(sc).length === 0 && st.treasury >= sc.cost
      }
      if (role === 'security' && manage) { o.actions.push('upgrade'); o.can_upgrade = true } // so the mock shows the one arrow a head is entitled to
      if (b.type === 'woodcutter_camp') { o.staff = { have: 0, need: 3 }; o.status = 'idle'; o.reasons = ['no_staff']; o.actions.push('take_shift') }
      if (manage && b.type !== 'civic_hall') o.actions.push('demolish')
    }
    out.push(o)
  }
  return out
}

const MOCK_T0 = Date.now()

/** The open election of the village: the mock has one, ending in two hours (`?election=0` has none). */
export function mockElection(): ElectionData | null {
  try { if (new URLSearchParams(location.search).get('election') === '0') return null } catch { /* none */ }
  return { office: 'village_head', opens_at: new Date(MOCK_T0 - 86_400_000).toISOString(), candidacy_ends_at: new Date(MOCK_T0 + 40 * 60_000).toISOString(), voting_ends_at: new Date(MOCK_T0 + 2 * 3_600_000).toISOString() }
}

/** The next goal the server would send: for the head, the first suggestion of the development readout (a mission would come first
 * when one is running); residents get none. */
export function mockGoal(): GoalData | null {
  init()
  if (!IS_HEAD) return null
  return { code: 'growth.build', args: { code: 'school' }, progress: 0, target: 1, go_to: 'settlement:development.view' }
}

/** A change the settlement channel never announced (its publication was lost): only the
 * store's summary can tell the village screen its layout is stale. */
export function mockVillageQuietChange(): boolean {
  init()
  const b = st.buildings.find((x) => x.state === 'under_construction')
  if (!b) return false
  const t = st.timers.get(b.id)
  if (t) window.clearTimeout(t)
  b.state = 'built'
  delete b.started
  delete b.finish
  st.ver++
  return true
}

