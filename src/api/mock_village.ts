// Offline village for ?mock=1: the world, the layout (with ETag/304), the
// player roster, the village commands with their refusals and views, and a
// live event feed on the settlement bus (client-api.md sections 4.3, 5.4,
// 5.5). Everything here is a stand-in for the server: shapes follow the
// contract, values are plausible Persian sample data.

import { SOCIETY_CONTENT, mergeTables } from './mock_society'
import { ECONOMY_CONTENT } from './mock_economy'
import { COMPANIES_CONTENT } from './mock_companies'
import type {
  BuildingState, LayoutBuilding, LayoutLot, SettlementEvent, SettlementPlayers, VillageLayout, BootstrapSettlement,
} from './types'
import { LIFE_CONTENT } from './mock_life'
import { publishSettlement } from './settlementBus'
import { latLonToTile, offsetLatLon } from '../village/geo'
import { MOCK_WORLD, mockChunkBytes, mockHeight, mockVillagePlace, RIVER_GY, RIVER_HALF_TILES, MOCK_FACE } from './mock_village_world'

import { MOCK_VILLAGE_IDS } from './mock_village_ids'
import { mockLaborCommand, laborProgressLines } from './mock_labor'
import { A, back, confirmA, mockOk, mockRefusal, refreshA, type MockAct } from './mock_neutral'
import type {
  BatchLotFailure, BuildMenuView, BuildingView, ConstructionProgressView, DonateView, GridGrowView, KnowledgeListView, LandCell, LandView, LotBatchConfirmView,
  LotBuyView, LotConfirmView, LotGridView, MaterialBuyView, MaterialsView, MineView, Named, PrivateConfirmView, PrivateLotsView, PrivateMenuView, PromotionView,
  ResidenceView, SettlementWhoView, TermsView, VillageNeed, VillageOverviewView, WorkView,
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
  { code: 'civic_hall', fa: 'خانهٔ دهیاری', en: 'Civic hall', fp: [2, 2], cost: 1000, time: 7200, role: '', materials: [['timber', 'چوب', 5]] },
  { code: 'village_house', fa: 'خانهٔ روستایی', en: 'Village house', fp: [1, 1], cost: 700, time: 2700, role: '', materials: [['timber', 'چوب', 2]] },
  { code: 'housing_block', fa: 'آپارتمان', en: 'Housing block', fp: [2, 2], cost: 3000, time: 10800, role: '', materials: [['timber', 'چوب', 40]] },
  { code: 'park', fa: 'پارک', en: 'Park', fp: [2, 2], cost: 800, time: 3600, role: '' },
  { code: 'watch_hut', fa: 'نگهبانی محله', en: 'Watch hut', fp: [1, 1], cost: 400, time: 1800, role: 'security' },
  { code: 'militia_camp', fa: 'اردوگاه سواران محلی', en: 'Militia camp', fp: [2, 1], cost: 500, time: 2700, role: 'security' },
  { code: 'carpentry_workshop', fa: 'کارگاه نجاری', en: 'Carpentry workshop', fp: [2, 2], cost: 1500, time: 5400, role: 'craft', materials: [['timber', 'چوب', 4]] },
  { code: 'smithy', fa: 'آهنگری', en: 'Smithy', fp: [2, 2], cost: 1800, time: 6000, role: 'craft', needs: ['metallurgy'] },
  { code: 'shaft_well', fa: 'چاه قنات', en: 'Qanat well', fp: [1, 1], cost: 300, time: 1200, role: 'water_infra' },
  { code: 'farm_canal', fa: 'مزرعهٔ نهری', en: 'Canal farm', fp: [3, 3], cost: 2200, time: 7200, role: 'food' },
  { code: 'health_house', fa: 'خانهٔ بهداشت', en: 'Health house', fp: [2, 2], cost: 1200, time: 4800, role: 'health' },
  { code: 'teaching_circle', fa: 'کلاس درس', en: 'Village classroom', fp: [1, 1], cost: 200, time: 1500, role: 'education' },
  { code: 'barter_post', fa: 'بازارچه', en: 'Village market', fp: [1, 1], cost: 250, time: 1200, role: 'market' },
  { code: 'woodcutter_camp', fa: 'کارگاه هیزم‌شکنی', en: "Woodcutter's camp", fp: [2, 2], cost: 900, time: 3600, role: 'craft' },
  { code: 'granary', fa: 'انبار غله', en: 'Granary', fp: [1, 1], cost: 700, time: 3000, role: 'storage' },
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
  st.lots = makeLots(place.origin, [[4, 0, 11]])
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
  st.roads = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 }))
  st.otherBuildings = [mk('civic_hall', 1, 1, 'built'), mk('farm_canal', 2, 2, 'built'), mk('watch_hut', 0, 4, 'built')]
  st.know = [
    { code: 'fire_making', state: 'held', cost: 0, time: 0, buy: 0, missing: [], terrain: true },
    { code: 'archery', state: 'held', cost: 0, time: 0, buy: 0, missing: [], terrain: true },
    { code: 'irrigation', state: 'researching', cost: 3200, time: 5400, buy: 8000, missing: [], terrain: true, finish: now + 41 * 60000 },
    { code: 'masonry', state: 'available', cost: 4000, time: 3600, buy: 9500, missing: [], terrain: true },
    { code: 'writing', state: 'available', cost: 2600, time: 4200, buy: 7200, missing: [], terrain: true },
    { code: 'metallurgy', state: 'locked', cost: 7000, time: 9000, buy: 0, missing: ['masonry'], terrain: true },
    { code: 'geometry', state: 'locked', cost: 6000, time: 7200, buy: 0, missing: [], terrain: false },
  ]
  for (const b of st.buildings) if (b.state === 'under_construction') schedule(b)
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

function layoutFor(id: string): VillageLayout {
  init()
  const own = id === OWN_ID
  const place = mockVillagePlace(GRID)
  const lot = MOCK_WORLD.lot_m
  const origin = own ? place.origin : offsetLatLon(place.origin.lat, place.origin.lon, 9 * lot, 5 * lot, MOCK_WORLD.planet_radius_km)
  const centre = own ? place.centre : { ...offsetLatLon(place.centre.lat, place.centre.lon, 9 * lot, 5 * lot, MOCK_WORLD.planet_radius_km), chunk: place.centre.chunk }
  const list = own ? st.buildings : st.otherBuildings.filter((b) => b.state === 'built')
  const roads = own ? st.roads : []
  const detail = own ? 'full' : 'coarse'
  seedCitizen()
  const ver = own ? `${IS_HEAD ? 'h' : 'm'}${st.ver}` : `p${st.ver}`
  const buildings: LayoutBuilding[] = list.map((b) => toLayoutBuilding(b, own))
  for (const r of roads) buildings.push({ type: 'road', x: r.x, y: r.y, w: 1, h: 1, rotated: false, state: 'built', visual_seed: 7, ...(own ? { id: `road-${r.x}-${r.y}` } : {}) })
  return {
    version: ver, detail,
    viewer: { member: own, can_place: own && IS_HEAD, ...(own ? { resident: true } : {}) },
    settlement: { id, code: own ? 'v-k3x9' : 'v-q7m2', name: own ? 'آمل' : 'سرخه', tier: 'village', world_cell: own ? 18211 : 18990, centre },
    grid: { lots: own ? size() : GRID, lot_m: lot, origin, slope_limit: SLOPE_LIMIT },
    lots: own ? st.lots : st.otherLots,
    buildings,
    ...(own ? { roads, tenure: cz.tenure.map((l) => ({ x: l.x, y: l.y, tenure: 'freehold' as const, mine: l.mine, owner: l.owner })), terms: { lot_price: LOT_PRICE, permit_fee: PERMIT_FEE, tax_bps: TAX_BPS } } : {}),
  }
}

export function mockBootstrapSettlement(): BootstrapSettlement {
  init()
  const place = mockVillagePlace(GRID)
  return {
    id: OWN_ID, code: 'v-k3x9', name: 'آمل', tier: 'village', world_cell: 18211,
    centre: place.centre, is_head: IS_HEAD, resident: true, emblem: { shape: 'shield', color_a: 'crimson', color_b: 'gold', icon: 'wheat' }, grid_lots: size(), layout_path: `/api/v1/settlements/${OWN_ID}/layout`,
  }
}

// -- roster -------------------------------------------------------------------------------------

function roster(): SettlementPlayers {
  const players = [
    { id: 'mock-1', name: 'سارا', code: 'K7Q2M9A', visible: true, online: true, activity: 'idle', activity_label: 'آنلاین', place: 'city_centre' },
    { id: 'p-2', name: 'رضا', code: 'R4T8W1C', visible: true, online: true, activity: 'building', activity_label: 'در حال ساخت', place: 'city_centre' },
    { id: 'p-3', name: 'مریم', code: 'M2X9K5D', visible: true, online: true, activity: 'working', activity_label: 'در حال کار', place: 'harbour' },
    { id: 'p-4', name: 'علی', code: 'A8L3Q6E', visible: true, online: false, activity: 'idle', activity_label: 'آفلاین', place: 'old_town' },
    { id: 'p-5', name: 'نسیم', code: 'N5B1V7F', visible: true, online: false, activity: 'studying', activity_label: 'در حال تحصیل' },
    { id: 'p-6', name: 'بهرام', code: 'B9C4Z2G', visible: false },
  ]
  return { settlement_id: OWN_ID, seq: st.seq, online: 3, hidden: false, players }
}

// -- views ---------------------------------------------------------------------------------------

/** What the real server sends as the authored name of content: English. The web must not show it
 * (it resolves names from the catalogue), so the mock sends English on purpose. */
function nameOf(code: string): Named { const e = CAT.find((c) => c.code === code) ?? citizenEntry(code); return { code, name: e?.en ?? code } }
function kn(code: string): Named { return { code, name: KNOW_EN[code] ?? code } }
const GOODS_EN: Record<string, string> = { timber: 'Timber', stone: 'Stone', iron_bar: 'Iron bar', wheat: 'Wheat' }
const goods = (code: string): Named => ({ code, name: GOODS_EN[code] ?? code })

function refusal(kind: string, o: Parameters<typeof mockRefusal>[1] = {}) {
  return mockRefusal(kind, { back: { command: 'settlement.overview', args: null }, ...o })
}

/** A lot named by the number pair or by the token the server's own buttons carry ("3-1", "3-1-r"). */
function lotArg(args: Record<string, unknown>): { x: number; y: number; rotated: boolean } | null {
  if (typeof args.lot === 'string') {
    const m = /^(\d+)-(\d+)(-r)?$/.exec(args.lot.trim())
    return m ? { x: +m[1], y: +m[2], rotated: !!m[3] } : null
  }
  const x = Number(args.x), y = Number(args.y)
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  return { x, y, rotated: args.rotated === true || args.rotated === 'true' || args.rotated === '1' || args.rotated === 1 }
}
const token = (x: number, y: number, rotated = false) => `${x}-${y}${rotated ? '-r' : ''}`

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
  for (const b of st.buildings) for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) m[yy][xx] = true
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
  const view: LotGridView = {
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

function knowledgeView() {
  const now = Date.now()
  const run = st.know.find((k) => k.state === 'researching')
  const view: KnowledgeListView = {
    name: 'آمل', treasury: st.treasury, literacy_percent: st.literacy,
    running: run ? { knowledge: kn(run.code), finish_at: new Date(run.finish ?? now).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? now) - now) / 1000)) } : null,
    lines: st.know.map((k) => ({ knowledge: kn(k.code), state: k.state, research_cost: k.cost, research_time_seconds: k.time, buy_price: k.buy, missing: k.missing.length ? k.missing.map(kn) : null, terrain_ok: k.terrain })),
    hidden: 3,
  }
  const acts: MockAct[] = []
  for (const k of st.know.filter((x) => x.state === 'available')) {
    acts.push(A('', 'settlement.knowledge.research', { code: k.code }, { subject: k.code }))
    if (k.buy > 0) acts.push(A('', 'settlement.knowledge.buy', { code: k.code }, { subject: k.code }))
  }
  return mockOk('settlement_knowledge_list', view, [...acts, back('settlement.overview'), refreshA('settlement.knowledge')])
}

/** `?promo=met` shows a village that has taken every step to the next tier. */
const PROMO_MET = (() => { try { return new URLSearchParams(location.search).get('promo') === 'met' } catch { return false } })()

function promotionView(): PromotionView {
  const met = PROMO_MET
  const crit = (kind: string, current: number, required: number, role = '') => ({ kind, role, current: met ? required : current, required, met: met || current >= required })
  const criteria = [
    crit('residents', 2, 12), crit('literacy', st.literacy * 100, 5000), crit('buildings', st.buildings.filter((b) => b.state === 'built' && b.type !== 'road').length, 6),
    crit('knowledge', 2, 4), crit('role', 1, 1, 'education'), crit('role', 0, 1, 'health'), crit('treasury', st.treasury, 20000),
  ]
  return { village: 'آمل', from: 'village', to: 'town', criteria, met: criteria.every((c) => c.met), can_promote: IS_HEAD, office: '', settlement_id: OWN_ID }
}

function overviewView() {
  const stands = st.buildings.filter((b) => b.state === 'built')
  const promo = promotionView()
  const view: VillageOverviewView = {
    name: 'آمل', tier: 'village', population: 2, population_cap: 8,
    food_percent: 72, job_percent: 55, service_percent: 40, happiness_percent: 63, security_percent: 48, literacy_percent: st.literacy,
    resident: true, settlement_id: OWN_ID, treasury: st.treasury, is_head: IS_HEAD, support: { code: 'support', name: 'Support', services: SUPPORT_SERVICES.filter((s) => !s.role || !stands.some((b) => CAT.find((c) => c.code === b.type)?.role === s.role)).map((s) => s.service) }, promotion: promo,
    buildings: stands.map((b) => ({ role: CAT.find((c) => c.code === b.type)?.role ?? '', building: nameOf(b.type), tier: 1 })),
  }
  const acts: MockAct[] = [
    A('citizen.land', 'settlement.land'), A('citizen.build_house', 'settlement.private'), A('citizen.mine', 'settlement.mine'), A('village.work', 'settlement.work'),
    A('village.donate', 'settlement.donate'), A('village.who', 'settlement.who'),
    A('village.knowledge', 'settlement.knowledge'), A('village.progress', 'settlement.build.progress'), A('village.materials', 'settlement.materials'),
    ...(IS_HEAD ? [A('village.build', 'settlement.build'), A('village.terms', 'settlement.terms')] : []),
    promo.met && promo.can_promote ? A('village.promote', 'settlement.promote') : A('village.promotion', 'settlement.promotion.view'),
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
      building: nameOf(e.code), role: e.role, state: miss.length ? 'locked' : 'available', cost_money: e.cost, build_time_seconds: e.time,
      missing: miss.length ? miss.map(kn) : null, missing_buildings: null, materials: matLines(e),
      short: short.length ? short.map((n) => ({ component: n.item, quantity: n.need - n.have })) : null,
    }
  })
  const view: BuildMenuView = { name: 'آمل', treasury: st.treasury, running_builds: running(), concurrent_cap: CONCURRENT_CAP, lines }
  const acts = lines.filter((l) => l.state === 'available').map((l) => A('build.place', 'settlement.build.lots', { code: l.building.code }, { subject: l.building.code }))
  return mockOk('settlement_build_menu', view, [...acts, A('build.grow', 'settlement.grid.grow'), back('settlement.overview'), refreshA('settlement.build')])
}

function place(args: Record<string, unknown>) {
  const code = String(args.code ?? '')
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found')
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y, rotated } = at
  const w = rotated ? e.fp[1] : e.fp[0], h = rotated ? e.fp[0] : e.fp[1]
  if (x < 0 || y < 0 || x + w > size() || y + h > size()) return refusal('out_of_bounds')
  const occ = occupiedMap()
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (!st.lots[yy][xx].buildable) return refusal('unbuildable')
      if (occ[yy][xx]) return refusal('occupied')
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
  const street = code === 'road' ? [] : planAutoRoads(x, y, w, h)
  if (street === 'none') return refusal('no_road')
  const fee = street.length * AUTO_ROAD_FEE
  if (st.treasury < e.cost + fee) return refusal('insufficient_funds')
  if (args.confirm !== 'confirm') {
    const view: LotConfirmView = {
      settlement_name: 'آمل', building: nameOf(code), x, y, rotated, cost_money: e.cost + fee, auto_roads: street.length,
      materials: matLines(e), build_time_seconds: e.time,
    }
    return mockOk('settlement_build_confirm', view, [confirmA('settlement.build.place', { code, lot: token(x, y, rotated) }), back('settlement.build.lots', { code })])
  }
  st.treasury -= e.cost + fee
  for (const [c, , q] of e.materials ?? []) MAT_STOCK[c] = Math.max(0, (MAT_STOCK[c] ?? 0) - q)
  // the game lays the connecting street at once
  const laid = street.map((q) => { const r = mkRoad(q.x, q.y, 'built'); st.buildings.push(r); return { building_id: r.id, lot_x: q.x, lot_y: q.y } })
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
  { code: 'cottage', fa: 'کلبهٔ روستایی', en: 'Cottage', fp: [1, 1], cost: 800, time: 7200, role: '', materials: [['timber', 'الوار', 3]] },
  { code: 'village_house', fa: 'خانهٔ روستایی', en: 'Village house', fp: [1, 1], cost: 1800, time: 14400, role: '', needs: ['carpentry'], materials: [['timber', 'الوار', 8]] },
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
  // a neighbour, Sara, already owns two lots and lives in one
  const picks = free.slice(-2)
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

function lotBuy(args: Record<string, unknown>) {
  seedCitizen()
  const at = lotArg(args)
  if (!at) return refusal('not_found')
  const { x, y } = at
  if (x < 0 || y < 0 || x >= size() || y >= size()) return refusal('not_found')
  if (tenureAt(x, y)) return refusal('citizen_lot_taken', { back: { command: 'settlement.land', args: null } })
  if (!st.lots[y][x].buildable) return refusal('unbuildable')
  if (occupiedMap()[y][x]) return refusal('occupied')
  if (cz.tenure.filter((l) => l.mine).length >= MAX_LOTS) return refusal('citizen_lot_limit', { back: { command: 'settlement.land', args: null } })
  if (cz.cash < LOT_PRICE) return refusal('citizen_no_cash', { back: { command: 'settlement.land', args: null } })
  const view = (cashNow: number, treasury: number): LotBuyView => ({ village: 'آمل', settlement_id: OWN_ID, x, y, price: LOT_PRICE, cash: cashNow, treasury })
  if (args.confirm !== 'confirm') return mockOk('settlement_lot_buy_confirm', view(cz.cash, st.treasury), [confirmA('settlement.lot.buy', { lot: token(x, y) }), back('settlement.land')])
  cz.cash -= LOT_PRICE
  st.treasury += LOT_PRICE
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
    const state = roads.has(`${x},${y}`) ? 'road' : own ? (own.mine ? 'mine' : 'taken') : b ? 'building' : l.water ? 'water' : !l.buildable ? 'steep' : occ[y][x] ? 'building' : 'free'
    return { x, y, state, owner: own && !own.mine ? own.owner : '', building: b ? b.type : '' }
  }))
  const owned = cz.tenure.filter((l) => l.mine).length
  const free = rows.flat().filter((c) => c.state === 'free').length
  const view: LandView = { village: 'آمل', settlement_id: OWN_ID, grid_lots: size(), rows, price: LOT_PRICE, cash: cz.cash, owned, max: MAX_LOTS, can_buy: owned < MAX_LOTS && cz.cash >= LOT_PRICE, free_lots: free }
  return mockOk('settlement_land', view, [...(owned > 0 ? [A('citizen.build_house', 'settlement.private')] : []), back('settlement.overview'), refreshA('settlement.land')])
}

function privateMenu() {
  seedCitizen()
  const owned = cz.tenure.filter((l) => l.mine)
  const occ = occupiedMap()
  const freeOwn = owned.filter((l) => !occ[l.y][l.x]).length
  const lines = CITIZEN_CAT.filter((e) => !citizenUnmet(e)).map((e) => {
    const b = bill(e)
    return {
      building: nameOf(e.code), home: HOMES.has(e.code), class: e.role || 'residential', cost_money: e.cost, permit_fee: PERMIT_FEE,
      materials: b.mats, build_time_seconds: e.time, footprint_w: e.fp[0], footprint_h: e.fp[1], total: b.total, affordable: cz.cash >= b.total,
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
  const view: PrivateLotsView = { village: 'آمل', building: nameOf(code), can_rotate: e.fp[0] !== e.fp[1], rotated, grid_lots: size(), rows }
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
      if (xx >= size() || yy >= size()) return refusal('out_of_bounds')
      if (occ[yy][xx]) return refusal('occupied')
      if (!tenureAt(xx, yy)?.mine) return refusal('citizen_not_owner', { back: { command: 'settlement.private', args: null } })
    }
  }
  if (citizenUnmet(e)) return refusal('prerequisite')
  const b = bill(e)
  if (cz.cash < b.total) return refusal('citizen_no_cash', { back: { command: 'settlement.private', args: null } })
  if (args.confirm !== 'confirm') {
    const view: PrivateConfirmView = { village: 'آمل', building: nameOf(code), x, y, rotated, cost_money: e.cost, permit_fee: PERMIT_FEE, materials: b.mats, materials_cost: b.materials_cost, total: b.total, cash: cz.cash, build_time_seconds: e.time }
    return mockOk('settlement_private_confirm', view, [confirmA('settlement.private.place', { code, lot: token(x, y, rotated) }), back('settlement.private.lots', { code })])
  }
  cz.cash -= b.total
  st.treasury += PERMIT_FEE
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
    return { x: l.x, y: l.y, building: b ? b.type : '', state: b ? (b.state === 'built' ? 'built' : 'building') : '', finish_at: b?.finish ? new Date(b.finish).toISOString() : null, left_seconds: b?.finish ? Math.max(0, Math.round((b.finish - now) / 1000)) : 0 }
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

// -- promotion, residence ---------------------------------------------------------------------------------------
function promotionScreen(kind: 'view' | 'ask' | 'done') {
  const v = promotionView()
  if (kind === 'view') return mockOk('village_promotion', v, [...(v.met && v.can_promote ? [A('village.promote', 'settlement.promote')] : []), back('settlement.overview'), refreshA('settlement.promotion.view')])
  if (!v.met) return refusal('not_available')
  if (!v.can_promote) return refusal('not_office_holder')
  if (kind === 'ask') return mockOk('village_promote_confirm', v, [confirmA('settlement.promote'), back('settlement.overview')])
  return mockOk('village_promoted', { ...v, from: 'town', to: 'town' }, [A('village.build', 'settlement.build'), A('village.knowledge', 'settlement.knowledge'), back('settlement.overview'), refreshA('settlement.overview')])
}

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
  { id: 'wp-3', code: 'carpentry_workshop', produces: [['timber', 2]] as [string, number][], consumes: [['wheat', 1]] as [string, number][], wage: 36, shift: 3600, workers: 2 },
]
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
    places: WORKPLACES.map((p) => ({ id: p.id, building: nameOf(p.code), produces: lines(p.produces), consumes: lines(p.consumes), wage: p.wage, shift_seconds: p.shift, workers: p.workers, busy: p.id === mine?.id ? 1 : 0, ready: true })),
    mine: mine ? { building: nameOf(mine.code), finish_at: new Date(wk.shift!.finish).toISOString(), left_seconds: Math.round((wk.shift!.finish - Date.now()) / 1000), wage: mine.wage, produces: lines(mine.produces) } : null,
    suggest: null, started: !!place, used: Object.values(MAT_STOCK).reduce((a, b) => a + b, 0), capacity: MAT_BASE_CAP,
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
const GROW_LOT_PRICE = 50
const GROW_STEP_BPS = 500
const GROW_MAX = 41

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

function buildingView(args: Record<string, unknown>) {
  const id = String(args.building_id ?? '')
  const b = st.buildings.find((x) => x.id === id) ?? (() => {
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
    stock: null, stock_used: 0, stock_capacity: 0, literacy_percent: 0, teaching: false, treasury: 0, population: 0, research: null, has_upgrade: false, upgrades: null,
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
      const run = st.know.find((k) => k.state === 'researching')
      view.research = run ? { knowledge: kn(run.code), finish_at: new Date(run.finish ?? Date.now()).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? Date.now()) - Date.now()) / 1000)) } : null
    }
    if (role === 'education') {
      view.has_upgrade = true
      if (mode === 'up') {
        const sc = CAT.find((c) => c.code === 'school')!
        const miss = unmet(sc)
        view.upgrades = [{ building: nameOf('school'), tier: 2, cost_money: sc.cost, build_time_seconds: sc.time, available: miss.length === 0, missing: miss.length ? miss.map(kn) : null, needs_tier: '' }]
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

function growView(args: Record<string, unknown>) {
  const side = size()
  if (side + 1 > GROW_MAX) return refusal('grid_max')
  const lotsGained = 2 * side + 1
  const price = Math.floor((lotsGained * GROW_LOT_PRICE * (10_000 + GROW_STEP_BPS * st.growth)) / 10_000)
  if (args.confirm !== 'confirm') {
    const view: GridGrowView = { settlement_name: 'آمل', side, new_side: side + 1, lots_gained: lotsGained, buildable_gained: Math.round(lotsGained * 0.82), price, treasury: st.treasury }
    return mockOk('settlement_grid_grow', view, [confirmA('settlement.grid.grow'), back('settlement.build')])
  }
  if (st.treasury < price) return refusal('insufficient_funds')
  st.treasury -= price
  st.growth++
  const place = mockVillagePlace(GRID)
  st.lots = makeLots(place.origin, [[4, 0, 11]], size())
  st.ver++
  emit({ type: 'grid_grown', grid_lots: size(), layout_version: versions() })
  return menuView()
}

// -- storage and market (settlement.materials, .buy) ---------------------------------------------
const MARKET = [
  { item: goods('timber'), price: 22 },
  { item: goods('stone'), price: 30 },
  { item: goods('iron_bar'), price: 64 },
]
const MAT_STOCK: Record<string, number> = { timber: 15, stone: 8 }
const MAT_BASE_CAP = 100
function materialsView(bought?: { item: Named; qty: number; total: number }) {
  const used = Object.values(MAT_STOCK).reduce((a, b) => a + b, 0)
  const stock = Object.keys(MAT_STOCK).sort().map((c) => ({ item: goods(c), qty: MAT_STOCK[c] }))
  const view: MaterialsView = { village: 'آمل', treasury: st.treasury, stock: stock.length ? stock : null, used, capacity: MAT_BASE_CAP, market: MARKET, can_buy: IS_HEAD, presets: [5, 10, 25], bought: bought ?? null }
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

export function mockVillageCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  if (!command.startsWith('settlement.')) return null
  if (command.startsWith('settlement.labor.')) return mockLaborCommand(command, args)
  init()
  switch (command) {
    case 'settlement.overview': return overviewView()
    case 'settlement.materials': return materialsView()
    case 'settlement.materials.buy': return materialsBuy(args)
    case 'settlement.build': return menuView()
    case 'settlement.build.lots': return lotsView(String(args.code ?? ''), args.rotate === '1' || args.rotate === 1 || args.rotate === true, String(args.from ?? ''))
    case 'settlement.build.place': return place(args)
    case 'settlement.build.place_many': return placeMany(args)
    case 'settlement.building.view': return buildingView(args)
    case 'settlement.grid.grow': return growView(args)
    case 'settlement.build.cancel': return cancelOrDemolish(args, false)
    case 'settlement.build.demolish': return cancelOrDemolish(args, true)
    case 'settlement.build.progress': return progressView()
    case 'settlement.knowledge': return knowledgeView()
    case 'settlement.knowledge.research': return knowledgeAct(args, false)
    case 'settlement.knowledge.buy': return knowledgeAct(args, true)
    case 'settlement.donate': return donate(args)
    case 'settlement.lot.buy': return lotBuy(args)
    case 'settlement.private': return privateMenu()
    case 'settlement.private.place': return privatePlace(args)
    case 'settlement.mine': return mineView('')
    case 'settlement.home.rest': return homeRest()
    case 'settlement.who': return whoView()
    case 'settlement.land': return landView()
    case 'settlement.private.lots': return privateLots(args)
    case 'settlement.tax.pay': return taxPay()
    case 'settlement.terms': return termsView(args)
    case 'settlement.promotion.view': return promotionScreen('view')
    case 'settlement.promote': return promotionScreen(args.confirm === 'confirm' ? 'done' : 'ask')
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
      entries: mergeTables(mergeTables(SOCIETY_CONTENT.entries, COMPANIES_CONTENT), {
        settlement_building: [...CAT, ...CITIZEN_CAT].map((c) => ({ code: c.code, name: { en: c.en, fa: c.fa }, category: c.role, footprint: c.fp, ...(c.capExempt ? { cap_exempt: true } : {}) })),
        // the names of everything else the village screens mention, in both languages (the web never shows the view's authored English)
        city: [{ code: 'calderis', name: { en: 'Calderis', fa: 'کالدریس' } }, { code: 'support', name: { en: 'Central City', fa: 'شهر مرکزی' } }],
        place: [{ code: 'old_town', name: { en: 'Old Town', fa: 'مرکز شهر' } }, { code: 'harbour', name: { en: 'Harbour', fa: 'بندر' } }, ...ECONOMY_CONTENT.place],
        component: [{ code: 'timber', name: { en: 'Timber', fa: 'الوار' } }, { code: 'stone', name: { en: 'Stone', fa: 'سنگ' } }, { code: 'iron_bar', name: { en: 'Iron bar', fa: 'شمش آهن' } }],
        item: [{ code: 'wheat', name: { en: 'Wheat', fa: 'گندم' } }, { code: 'bread', name: { en: 'Bread', fa: 'نان' } }, { code: 'bandage', name: { en: 'Bandage', fa: 'باند' } }, ...ECONOMY_CONTENT.item.filter((i) => i.code !== 'bread')],
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
        ...LIFE_CONTENT,
      }),
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
    const etag = `"${layout.version}.${layout.detail}"`
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

