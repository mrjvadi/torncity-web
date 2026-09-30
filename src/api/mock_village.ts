// Offline village for ?mock=1: the world, the layout (with ETag/304), the
// player roster, the village commands with their refusals and views, and a
// live event feed on the settlement bus (client-api.md sections 4.3, 5.4,
// 5.5). Everything here is a stand-in for the server: shapes follow the
// contract, values are plausible Persian sample data.

import type {
  BuildingState, LayoutBuilding, LayoutLot, SettlementEvent, SettlementPlayers, VillageLayout, BootstrapSettlement,
} from './types'
import { publishSettlement } from './settlementBus'
import { latLonToTile, offsetLatLon } from '../village/geo'
import { MOCK_WORLD, mockChunkBytes, mockHeight, mockVillagePlace, RIVER_GY, RIVER_HALF_TILES, MOCK_FACE } from './mock_village_world'

import { MOCK_VILLAGE_IDS } from './mock_village_ids'
const OWN_ID = MOCK_VILLAGE_IDS.own
const OTHER_ID = MOCK_VILLAGE_IDS.other
const GRID = 5
/** A gentler limit than the server's 15 so the offline hills stay buildable-looking. */
const SLOPE_LIMIT = 8

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

// -- catalogue -----------------------------------------------------------------

interface CatEntry { code: string; fa: string; en: string; fp: [number, number]; cost: number; time: number; role: string; needs?: string[]; materials?: [string, string, number][] }

const CAT: CatEntry[] = [
  { code: 'road', fa: 'جاده', en: 'Road', fp: [1, 1], cost: 50, time: 600, role: '' },
  { code: 'civic_hall', fa: 'خانهٔ دهیاری', en: 'Civic hall', fp: [2, 2], cost: 1000, time: 7200, role: '', materials: [['timber', 'چوب', 5]] },
  { code: 'housing_block', fa: 'بلوک مسکونی', en: 'Housing block', fp: [2, 2], cost: 3000, time: 10800, role: '', materials: [['timber', 'چوب', 10]] },
  { code: 'park', fa: 'پارک', en: 'Park', fp: [2, 2], cost: 800, time: 3600, role: '' },
  { code: 'watch_hut', fa: 'برج نگهبانی', en: 'Watch hut', fp: [1, 1], cost: 400, time: 1800, role: 'security' },
  { code: 'militia_camp', fa: 'اردوگاه میلیشیا', en: 'Militia camp', fp: [2, 1], cost: 500, time: 2700, role: 'security' },
  { code: 'carpentry_workshop', fa: 'کارگاه نجاری', en: 'Carpentry workshop', fp: [2, 2], cost: 1500, time: 5400, role: 'craft', materials: [['timber', 'چوب', 4]] },
  { code: 'smithy', fa: 'آهنگری', en: 'Smithy', fp: [2, 2], cost: 1800, time: 6000, role: 'craft', needs: ['metallurgy'] },
  { code: 'shaft_well', fa: 'چاه قنات', en: 'Shaft well', fp: [1, 1], cost: 300, time: 1200, role: 'water_infra' },
  { code: 'farm_canal', fa: 'مزرعهٔ کانالی', en: 'Canal farm', fp: [3, 3], cost: 2200, time: 7200, role: 'food' },
  { code: 'health_house', fa: 'خانهٔ بهداشت', en: 'Health house', fp: [2, 2], cost: 1200, time: 4800, role: 'health' },
  { code: 'teaching_circle', fa: 'حلقهٔ آموزش', en: 'Teaching circle', fp: [1, 1], cost: 200, time: 1500, role: 'education' },
  { code: 'barter_post', fa: 'پایگاه تهاتر', en: 'Barter post', fp: [1, 1], cost: 250, time: 1200, role: 'market' },
  { code: 'granary', fa: 'انبار غله', en: 'Granary', fp: [1, 1], cost: 700, time: 3000, role: 'storage' },
  { code: 'bank', fa: 'بانک', en: 'Bank', fp: [3, 3], cost: 50000, time: 36000, role: '', needs: ['writing'] },
  { code: 'school', fa: 'مدرسه', en: 'School', fp: [3, 3], cost: 9000, time: 14400, role: 'education', needs: ['writing'] },
]
const KNOW_NAMES: Record<string, string> = {
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

function makeLots(origin: { lat: number; lon: number }, bump: [number, number, number][]): LayoutLot[][] {
  const lot = MOCK_WORLD.lot_m
  const rows: LayoutLot[][] = []
  const heights: number[][] = []
  const wet: boolean[][] = []
  for (let y = 0; y < GRID; y++) {
    heights.push([]); wet.push([])
    for (let x = 0; x < GRID; x++) {
      const ll = offsetLatLon(origin.lat, origin.lon, x * lot, y * lot, MOCK_WORLD.planet_radius_km)
      const t = latLonToTile(ll.lat, ll.lon, MOCK_WORLD.chunk.max_lod, MOCK_WORLD.chunk.tile_edge)
      let h = mockHeight(t.gx, t.gy) + lotNoise(x, y, 1) * 0.9
      for (const [bx, by, bh] of bump) if (bx === x && by === y) h += bh
      heights[y].push(Math.round(h * 100) / 100)
      wet[y].push(t.face === MOCK_FACE && Math.abs(t.gy - RIVER_GY) < RIVER_HALF_TILES)
    }
  }
  for (let y = 0; y < GRID; y++) {
    const row: LayoutLot[] = []
    for (let x = 0; x < GRID; x++) {
      let slope = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue
        slope = Math.max(slope, Math.abs(heights[y][x] - heights[ny][nx]))
      }
      slope = Math.round(slope * 10) / 10
      const river = wet[y][x]
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
  st.otherLots = makeLots(shifted, [])
  const now = Date.now()
  const mk = (type: string, x: number, y: number, state: BuildingState, extra: Partial<MBuilding> = {}): MBuilding => {
    const e = CAT.find((c) => c.code === type)!
    const rotated = !!extra.rotated
    return { id: `b-${st.nextId++}`, type, x, y, w: rotated ? e.fp[1] : e.fp[0], h: rotated ? e.fp[0] : e.fp[1], rotated, state, seed: 2891077541 + x * 977 + y * 131, ...extra }
  }
  st.buildings = [
    mk('civic_hall', 0, 3, 'built'),
    mk('watch_hut', 3, 3, 'built'),
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
    grid: { lots: GRID, lot_m: lot, origin, slope_limit: SLOPE_LIMIT },
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
    centre: place.centre, is_head: IS_HEAD, resident: true, emblem: { shape: 'shield', color_a: 'crimson', color_b: 'gold', icon: 'wheat' }, grid_lots: GRID, layout_path: `/api/v1/settlements/${OWN_ID}/layout`,
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

function nameOf(code: string) { const e = CAT.find((c) => c.code === code) ?? citizenEntry(code); return { code, name: e?.fa ?? code } }
function kn(code: string) { return { code, name: KNOW_NAMES[code] ?? code } }
const back = (command: string) => ({ label: 'بازگشت', command, row: 9, kind: 'back', icon: 'action:player' })

function refusal(kind: string, text: string) {
  return {
    ok: false, screen: 'village_refusal', text,
    view: { kind, back: '' },
    error: { code: `village_${kind}`, message: text },
    actions: [back('settlement.overview')],
  }
}

function running() { return st.buildings.filter((b) => b.state === 'under_construction' || b.state === 'planned').length }
function unmet(e: CatEntry): string[] { return (e.needs ?? []).filter((n) => st.know.find((k) => k.code === n)?.state !== 'held') }

function occupiedMap(): boolean[][] {
  const m: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false))
  for (const b of st.buildings) for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) m[yy][xx] = true
  for (const r of st.roads) m[r.y][r.x] = true
  return m
}

function lotsView(code: string, rotate: boolean) {
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found', 'این ساختمان شناخته نشد.')
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
    if (x + w > GRID || y + h > GRID) return false
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (cellState(xx, yy) !== 'free') return false
    return true
  }
  const rows = st.lots.map((row, y) => row.map((_, x) => ({ x, y, state: cellState(x, y), fits: fits(x, y) })))
  return {
    ok: true, screen: 'settlement_build_lots', text: 'قطعه را انتخاب کن',
    view: { settlement_name: 'آمل', building: nameOf(code), can_rotate: e.fp[0] !== e.fp[1], rotated: rotate, grid_lots: GRID, rows },
    actions: [back('settlement.build')],
  }
}

function progressView() {
  const lines = st.buildings.filter((b) => b.state === 'under_construction' || b.state === 'planned')
    .sort((a, b) => (a.finish ?? 0) - (b.finish ?? 0))
    .map((b) => ({ building: nameOf(b.type), lot_x: b.x, lot_y: b.y, state: b.state === 'planned' ? 'queued' : 'building', finish_at: b.finish ? new Date(b.finish).toISOString() : null, left_seconds: Math.max(0, Math.round(((b.finish ?? Date.now()) - Date.now()) / 1000)) }))
  return { ok: true, screen: 'settlement_construction_progress', text: 'ساخت‌وساز', view: { name: 'آمل', lines: lines.length ? lines : null }, actions: [back('settlement.overview')] }
}

function knowledgeView() {
  const now = Date.now()
  const run = st.know.find((k) => k.state === 'researching')
  return {
    ok: true, screen: 'settlement_knowledge_list', text: 'دانش',
    view: {
      name: 'آمل', treasury: st.treasury, literacy_percent: st.literacy,
      running: run ? { knowledge: kn(run.code), finish_at: new Date(run.finish ?? now).toISOString(), left_seconds: Math.max(0, Math.round(((run.finish ?? now) - now) / 1000)) } : null,
      lines: st.know.map((k) => ({ knowledge: kn(k.code), state: k.state, research_cost: k.cost, research_time_seconds: k.time, buy_price: k.buy, missing: k.missing.length ? k.missing.map(kn) : null, terrain_ok: k.terrain })),
      hidden: 3,
    },
    actions: [back('settlement.overview')],
  }
}

function overviewView() {
  const stands = st.buildings.filter((b) => b.state === 'built')
  return {
    ok: true, screen: 'village_overview', text: 'آمل',
    view: {
      name: 'آمل', tier: 'village', population: 34, population_cap: 60,
      food_percent: 72, job_percent: 55, service_percent: 40, happiness_percent: 63, security_percent: 48, literacy_percent: st.literacy,
      treasury: st.treasury, resident: true, support: { code: 'support', name: 'ساپورت' },
      buildings: stands.map((b) => ({ role: CAT.find((c) => c.code === b.type)?.role ?? '', building: nameOf(b.type), tier: 1 })),
    },
    actions: [back('player.profile.get')],
  }
}

function menuView() {
  const lines = CAT.filter((e) => e.code !== 'road' || true).map((e) => {
    const miss = unmet(e)
    return { building: nameOf(e.code), role: e.role, state: miss.length ? 'locked' : 'available', cost_money: e.cost, build_time_seconds: e.time, missing: miss.length ? miss.map(kn) : null }
  })
  return { ok: true, screen: 'settlement_build_menu', text: 'ساخت', view: { name: 'آمل', treasury: st.treasury, running_builds: running(), concurrent_cap: CONCURRENT_CAP, lines }, actions: [back('settlement.overview')] }
}

function place(args: Record<string, unknown>) {
  const code = String(args.code ?? '')
  const e = CAT.find((c) => c.code === code)
  if (!e) return refusal('not_found', 'این ساختمان شناخته نشد.')
  const x = Number(args.x), y = Number(args.y)
  const rotated = args.rotated === true || args.rotated === 'true' || args.rotated === '1' || args.rotated === 1
  if (!Number.isInteger(x) || !Number.isInteger(y)) return refusal('not_found', 'قطعه‌ی نامعتبر.')
  const w = rotated ? e.fp[1] : e.fp[0], h = rotated ? e.fp[0] : e.fp[1]
  if (x < 0 || y < 0 || x + w > GRID || y + h > GRID) return refusal('out_of_bounds', 'ساختمان از محدوده‌ی روستا بیرون می‌زند.')
  const occ = occupiedMap()
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (!st.lots[yy][xx].buildable) return refusal('unbuildable', '🌊 روی این قطعه نمی‌توان ساخت.')
      if (occ[yy][xx]) return refusal('occupied', 'این قطعه پیش‌تر ساخته شده است.')
    }
  }
  const miss = unmet(e)
  if (miss.length) return refusal('prerequisite', `پیش‌نیاز ناقص است: ${miss.map((m) => KNOW_NAMES[m] ?? m).join('، ')}`)
  if (running() >= CONCURRENT_CAP) return refusal('concurrent_cap', 'همزمان بیش از این نمی‌توان ساخت.')
  if (st.treasury < e.cost) return refusal('insufficient_funds', 'خزانه‌ی روستا برای این ساخت کافی نیست.')
  if (args.confirm !== 'confirm') {
    return {
      ok: true, screen: 'settlement_build_confirm', text: 'تأیید ساخت',
      view: {
        settlement_name: 'آمل', building: nameOf(code), x, y, rotated, cost_money: e.cost,
        materials: e.materials ? e.materials.map(([c, n, q]) => ({ component: { code: c, name: n }, quantity: q })) : null,
        build_time_seconds: e.time,
      },
      actions: [back('settlement.build')],
    }
  }
  st.treasury -= e.cost
  // the mock builds faster than the real duration so a demo sees it finish
  const sec = Math.min(90, Math.max(25, Math.round(e.time / 120)))
  const started = Date.now()
  const b: MBuilding = { id: `b-${st.nextId++}`, type: code, x, y, w, h, rotated, state: 'under_construction', started, finish: started + sec * 1000, seed: 118034 + st.nextId * 31 }
  st.buildings.push(b)
  st.ver++
  schedule(b)
  emit({ type: 'build_started', building_id: b.id, type_code: code, lot_x: x, lot_y: y, rotated, finish_at: new Date(b.finish!).toISOString(), layout_version: versions() })
  return progressView()
}

function cancelOrDemolish(args: Record<string, unknown>, demolish: boolean) {
  const b = st.buildings.find((x) => x.id === String(args.id ?? ''))
  if (!b) return refusal('not_found', 'ساختمان پیدا نشد.')
  if (demolish && b.state !== 'built') return refusal('not_demolishable', 'فقط ساختمان تمام‌شده را می‌توان تخریب کرد.')
  if (!demolish && b.state !== 'under_construction' && b.state !== 'planned') return refusal('not_cancellable', 'فقط ساختمانِ درحال‌ساخت را می‌توان لغو کرد.')
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
  if (!k) return refusal('not_found', 'این دانش شناخته نشد.')
  if (k.state === 'held') return refusal('already_owned', 'روستا از پیش این دانش را دارد.')
  if (k.state === 'researching' || (!buy && st.know.some((x) => x.state === 'researching'))) return refusal('busy', 'روستا همین حالا در حال پژوهش است.')
  if (k.state === 'locked' || (buy && !k.buy)) return refusal('not_available', 'این دانش هنوز در دسترس نیست.')
  const price = buy ? k.buy : k.cost
  if (st.treasury < price) return refusal('insufficient_funds', 'خزانه‌ی روستا کافی نیست.')
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
  const view = (amount: number) => ({ village: 'آمل', amount, presets: [250, 1000, 5000], min: 100, max: 100000, treasury: st.treasury, cash, settlement_id: OWN_ID })
  const raw = String(args.amount ?? '')
  if (!raw) return { ok: true, screen: 'village_donate_menu', text: 'کمک به خزانه', view: view(0), actions: [back('settlement.overview')] }
  const amount = Number(raw)
  if (!(amount >= 100 && amount <= 100000)) return refusal('donate_range', 'مبلغ کمک باید بین ۱۰۰ و ۱۰۰٬۰۰۰ باشد.')
  if (args.confirm !== 'confirm') {
    if (cash < amount) return refusal('donate_no_cash', 'پول نقد شما کافی نیست.')
    return { ok: true, screen: 'village_donate_confirm', text: 'تأیید', view: view(amount), actions: [back('settlement.donate')] }
  }
  if (cash < amount) return refusal('donate_no_cash', 'پول نقد شما کافی نیست.')
  cash -= amount
  st.treasury += amount
  return { ok: true, screen: 'village_donate_done', text: 'ممنون', view: view(amount), actions: [back('settlement.overview')] }
}

// -- the citizen loop (contract 1.4): land, a private house, one's own property ----------
// ?role=resident opens the village as a normal resident (not the head), the
// player this feature is for; without it the viewer is the head, who lives
// here too. Prices follow configs/config.yml (settlement.citizen_*).

const LOT_PRICE = 400, PERMIT_FEE = 100, TAX_BPS = 200, MAX_LOTS = 3, TIMBER_UNIT = 18

interface MLot { x: number; y: number; owner: string; mine: boolean }
const cz = { tenure: [] as MLot[], cash: 5000, lastRest: 0, seeded: false }

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
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (st.lots[y][x].buildable && !occ[y][x]) free.push([x, y])
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
  const x = Number(args.x), y = Number(args.y)
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= GRID || y >= GRID) return refusal('not_found', 'قطعهٔ نامعتبر.')
  if (tenureAt(x, y)) return refusal('citizen_lot_taken', 'این زمین را همین حالا کس دیگری خرید. زمین دیگری انتخاب کن.')
  if (!st.lots[y][x].buildable) return refusal('unbuildable', '🌊 روی این قطعه نمی‌توان ساخت.')
  if (occupiedMap()[y][x]) return refusal('occupied', 'این قطعه پیش‌تر ساخته شده است.')
  if (cz.tenure.filter((l) => l.mine).length >= MAX_LOTS) return refusal('citizen_lot_limit', 'به سقف زمین‌های شخصی رسیده‌ای؛ اول روی زمین‌هایت بساز.')
  if (cz.cash < LOT_PRICE) return refusal('citizen_no_cash', 'پولت برای این کار کافی نیست.')
  const view = (cash: number, treasury: number) => ({ village: 'آمل', settlement_id: OWN_ID, x, y, price: LOT_PRICE, cash, treasury })
  if (args.confirm !== 'confirm') return { ok: true, screen: 'settlement_lot_buy_confirm', text: 'خرید زمین', view: view(cz.cash, st.treasury), actions: [back('settlement.land')] }
  cz.cash -= LOT_PRICE
  st.treasury += LOT_PRICE
  cz.tenure.push({ x, y, owner: 'تو', mine: true })
  st.ver++
  emit({ type: 'lot_bought', lot_x: x, lot_y: y, layout_version: versions() })
  return { ok: true, screen: 'settlement_lot_buy_done', text: 'زمین مال توست', view: view(cz.cash, st.treasury), actions: [back('settlement.land')] }
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
  return { ok: true, screen: 'settlement_private_menu', text: 'ساخت‌وساز شخصی', view: { village: 'آمل', cash: cz.cash, owned_lots: owned.length, free_lots: freeOwn, lines }, actions: [back('settlement.overview')] }
}

function privatePlace(args: Record<string, unknown>) {
  seedCitizen()
  const code = String(args.code ?? '')
  const e = citizenEntry(code)
  if (!e) return refusal('not_found', 'این ساختمان شناخته نشد.')
  const x = Number(args.x), y = Number(args.y)
  if (!Number.isInteger(x) || !Number.isInteger(y)) return refusal('not_found', 'قطعهٔ نامعتبر.')
  const occ = occupiedMap()
  for (let yy = y; yy < y + e.fp[1]; yy++) {
    for (let xx = x; xx < x + e.fp[0]; xx++) {
      if (xx >= GRID || yy >= GRID) return refusal('out_of_bounds', 'ساختمان از محدودهٔ روستا بیرون می‌زند.')
      if (occ[yy][xx]) return refusal('occupied', 'این قطعه پیش‌تر ساخته شده است.')
      if (!tenureAt(xx, yy)?.mine) return refusal('citizen_not_owner', 'این زمین مال تو نیست؛ فقط روی زمین خودت می‌توانی بسازی.')
    }
  }
  if (citizenUnmet(e)) return refusal('prerequisite', 'دانش یا ساختمانِ پیش‌نیاز کامل نیست.')
  const b = bill(e)
  if (cz.cash < b.total) return refusal('citizen_no_cash', 'پولت برای این کار کافی نیست.')
  if (args.confirm !== 'confirm') {
    return {
      ok: true, screen: 'settlement_private_confirm', text: 'تأیید ساخت',
      view: { village: 'آمل', building: nameOf(code), x, y, rotated: false, cost_money: e.cost, permit_fee: PERMIT_FEE, materials: b.mats, materials_cost: b.materials_cost, total: b.total, cash: cz.cash, build_time_seconds: e.time },
      actions: [back('settlement.private.lots')],
    }
  }
  cz.cash -= b.total
  st.treasury += PERMIT_FEE
  const sec = 40
  const started = Date.now()
  const nb: MBuilding = { id: `b-${st.nextId++}`, type: code, x, y, w: e.fp[0], h: e.fp[1], rotated: false, state: 'under_construction', started, finish: started + sec * 1000, seed: 77021 + st.nextId * 17, priv: true, owner: 'تو', mine: true }
  st.buildings.push(nb)
  st.ver++
  schedule(nb)
  emit({ type: 'build_started', building_id: nb.id, type_code: code, lot_x: x, lot_y: y, rotated: false, finish_at: new Date(nb.finish!).toISOString(), layout_version: versions() })
  return mineView('')
}

function mineView(notice: string) {
  seedCitizen()
  const now = Date.now()
  const mineB = st.buildings.filter((b) => b.priv && b.mine)
  const lots = cz.tenure.filter((l) => l.mine).map((l) => {
    const b = mineB.find((x) => l.x >= x.x && l.x < x.x + x.w && l.y >= x.y && l.y < x.y + x.h)
    return { x: l.x, y: l.y, ...(b ? { building: b.type, state: b.state, left_seconds: b.finish ? Math.max(0, Math.round((b.finish - now) / 1000)) : 0 } : {}) }
  })
  const home = mineB.find((b) => b.state === 'built' && HOMES.has(b.type))
  const assessed = cz.tenure.filter((l) => l.mine).length * LOT_PRICE + mineB.reduce((s, b) => s + (citizenEntry(b.type)?.cost ?? 0) + (citizenEntry(b.type)?.materials ?? []).reduce((m, [, , n]) => m + n * 15, 0), 0)
  const wait = Math.max(0, Math.round((cz.lastRest + 6 * 3600_000 - now) / 1000))
  return {
    ok: true, screen: 'settlement_mine', text: 'دارایی من',
    view: {
      village: 'آمل', settlement_id: OWN_ID, cash: cz.cash, lots, home: home ? nameOf(home.type) : null, can_rest: !!home && wait === 0, rest_wait_seconds: wait,
      assessed, tax_per_period: Math.floor(assessed * TAX_BPS / 10000), tax_bps: TAX_BPS, debt: 0, debt_periods: 0, ...(notice ? { notice } : {}),
    },
    actions: [back('settlement.overview')],
  }
}

function homeRest() {
  const v = mineView('') as { view: { home: unknown; can_rest: boolean } }
  if (!v.view.home) return refusal('citizen_no_house', 'برای استراحت اول باید خانه‌ات ساخته شود.')
  if (!v.view.can_rest) return refusal('citizen_rest_wait', 'هنوز سرحال هستی؛ کمی بعد دوباره استراحت کن.')
  cz.lastRest = Date.now()
  return mineView('rested')
}

export function mockVillageCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  if (!command.startsWith('settlement.')) return null
  init()
  switch (command) {
    case 'settlement.overview': return overviewView()
    case 'settlement.build': return menuView()
    case 'settlement.build.lots': return lotsView(String(args.code ?? ''), args.rotate === '1' || args.rotate === 1 || args.rotate === true)
    case 'settlement.build.place': return place(args)
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
    case 'settlement.who': return { ok: true, screen: 'settlement_who', text: 'ساکنان', actions: [back('settlement.overview')] }
    default: return null
  }
}

/** REST routes of the world and the village; null when the path is not one. */
export function mockVillageRoute(path: string, method: string, headers: Headers): Response | null {
  if (path === '/api/v1/world') return json(MOCK_WORLD)
  if (path === '/api/v1/content') {
    return json({
      version: 'v1', langs: ['en', 'fa'],
      entries: { settlement_building: [...CAT, ...CITIZEN_CAT].map((c) => ({ code: c.code, name: { en: c.en, fa: c.fa }, category: c.role, footprint: c.fp })) },
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

