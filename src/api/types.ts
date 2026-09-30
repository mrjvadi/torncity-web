// Shapes from client-api.md. Kept loose (unknown/optional-heavy) since
// "a client must ignore keys it does not know" and views keep growing.

export interface Player {
  id: string
  code: string
  name: string
  lang: string
  city_code?: string
  city?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  player: Player
}

export interface ActionInput {
  field: string
  text?: boolean
}

export interface Action {
  label: string
  command?: string
  args?: Record<string, string>
  input?: ActionInput
  url?: string
  row: number
  kind: 'primary' | 'secondary' | 'danger' | 'navigation' | 'back' | 'confirm' | string
  icon?: string
  group?: string
}

export interface Notice {
  text: string
  alert: boolean
}

export interface CommandResponse {
  ok: boolean
  request_id?: string
  screen: string
  text?: string
  view?: Record<string, unknown>
  actions?: Action[]
  notice?: Notice
  error?: { code: string; message: string }
}

export interface RealtimeToken {
  token: string
  expires_at: string
  user?: string
  channels?: string[]
  channel?: string
}

/** What a player's Centrifugo channel carries for a "vitals" publication
 * (client-api.md §5.3): a full snapshot, not a diff, of the numbers the HUD
 * shows. */
export interface RealtimeVitals {
  type: 'vitals'
  cash: number
  bank: number
  energy: number
  max_energy: number
  health: number
  max_health: number
  xp: number
  level: number
  unread: number
}

export interface RankInfo {
  code: string
  name: string
  emoji?: string
}

export interface ProfileView {
  name: string
  code: string
  avatar?: string
  city_code: string
  city: string
  place?: { code: string; name: string }
  level: number
  xp: number
  next_level_xp: number
  energy: number
  max_energy: number
  energy_full_in_seconds: number
  health: number
  max_health: number
  cash: number
  bank: number
  travelling: boolean
  rank?: RankInfo
  jail?: { city_code: string; city: string; remaining_seconds: number; ends_at: string } | null
  hospital?: { city_code: string; city: string; remaining_seconds: number; ends_at: string } | null
  [key: string]: unknown
}

export interface Bootstrap {
  player: Player
  content_version: number
  languages: { code: string; name: string }[]
  cities: { code: string; name: string }[]
  places: { code: string; name: string }[]
  server_time: string
  realtime: boolean
  /** The player's own settlement (contract 1.1); absent when they belong to none. */
  settlement?: BootstrapSettlement
}

export interface CityPlot {
  id: string
  x: number
  y: number
  w: number
  h: number
  kind: 'place' | 'company' | 'decor'
  model?: string
  rot?: number
  ref?: { table?: string; code?: string; company_id?: string; owner?: string }
  name?: { fa?: string; en?: string }
}

export interface CityMap {
  city: string
  version: number
  grid: { w: number; h: number }
  water?: { side: string; width: number } | null
  roads: [number, number][]
  plots: CityPlot[]
}

export interface AssetManifestEntry {
  path: string
  type: string
  sha256: string
}

export interface AssetManifest {
  assets: Record<string, AssetManifestEntry>
}

export interface ModelPart {
  at: [number, number]
  rotate: number
  size: number
  mesh: string
}

export interface ModelLibrary {
  models: Record<string, { parts: ModelPart[] }>
}

// -- The world and the village (client-api.md section 4.3, contract 1.2) -----

export interface BootstrapSettlement {
  id: string
  code: string
  name: string
  tier: 'village' | 'town' | 'city' | string
  world_cell: number
  centre: PlaceRef
  is_head: boolean
  resident: boolean
  grid_lots: number
  layout_path: string
}

export interface ChunkAddrRef { face: number; lod: number; x: number; y: number }

export interface PlaceRef { lat: number; lon: number; chunk?: ChunkAddrRef }

export interface WorldBiome { index: number; code: string; water?: boolean; color: string }

/** GET /api/v1/world */
export interface WorldInfo {
  id: string
  seed: string
  generator_version: number
  params_hash: string
  chunk_codec_version: number
  chunk: { faces: number; tile_edge: number; min_lod: number; max_lod: number; header_bytes: number; tile_bytes: number }
  tile_m: number
  lot_m: number
  lots_per_tile: number
  planet_radius_km: number
  biomes: WorldBiome[]
  chunk_path: string
  created_at: string
}

export type LotWater = 'ocean' | 'lake' | 'river' | 'stream'

export interface LayoutLot {
  height_m: number
  slope_m: number
  buildable: boolean
  biome: string
  water?: LotWater
  tags?: string[]
}

/** Building states a layout reports. */
export type BuildingState = 'planned' | 'under_construction' | 'built' | 'damaged' | 'ruin'

export interface LayoutBuilding {
  /** Absent in the coarse view. */
  id?: string
  type: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
  state: BuildingState
  started_at?: string
  finish_at?: string
  damage_bps?: number
  visual_seed: number
}

/** GET /api/v1/settlements/{id}/layout */
export interface VillageLayout {
  version: string
  detail: 'full' | 'coarse'
  viewer: { member: boolean; can_place: boolean }
  settlement: { id: string; code: string; name: string; tier: string; world_cell: number; centre: PlaceRef }
  grid: { lots: number; lot_m: number; origin: { lat: number; lon: number }; slope_limit: number }
  lots: LayoutLot[][]
  buildings: LayoutBuilding[]
  roads?: { x: number; y: number }[]
}

export type PresenceActivity = 'idle' | 'travelling' | 'working' | 'studying' | 'training' | 'hospital' | 'jail' | 'building' | 'fighting'

export interface PlayerStatus {
  id: string
  name?: string
  code?: string
  visible: boolean
  online?: boolean
  activity?: PresenceActivity | string
  activity_label?: string
  place?: string
}

/** GET /api/v1/settlements/{id}/players */
export interface SettlementPlayers {
  settlement_id: string
  seq: number
  online: number
  hidden: boolean
  players: PlayerStatus[]
}

export interface LayoutVersions { head: string; member: string; public: string }

/** What arrives on settlement:<id> (section 5.4). */
export interface SettlementEvent {
  type:
    | 'build_started' | 'build_finished' | 'build_cancelled' | 'build_salvaged'
    | 'research_started' | 'research_finished' | 'knowledge_bought' | 'literacy_changed'
    | 'head_changed' | 'member_joined' | 'member_left'
  settlement_id: string
  seq: number
  at: string
  building_id?: string
  type_code?: string
  lot_x?: number
  lot_y?: number
  rotated?: boolean
  finish_at?: string
  layout_version?: LayoutVersions
  research_id?: string
  code?: string
  literacy_share_bps?: number
  office?: string
  vacated?: boolean
  layout_stale?: boolean
  player_id?: string
  player_name?: string
  via?: 'travel' | 'residence'
}

// -- Village views (Go XxxView structs, snake_case, durations as *_seconds) --

export interface Named { code: string; name: string }

export interface VillageOverviewView {
  name: string
  tier: string
  population: number
  population_cap: number
  food_percent: number
  job_percent: number
  service_percent: number
  happiness_percent: number
  security_percent: number
  literacy_percent: number
  treasury: number
  buildings: { role: string; building: Named; tier: number }[] | null
}

export interface BuildLineView {
  building: Named
  role: string
  state: 'available' | 'locked' | string
  cost_money: number
  build_time_seconds: number
  missing: Named[] | null
}

export interface BuildMenuView {
  name: string
  treasury: number
  running_builds: number
  concurrent_cap: number
  lines: BuildLineView[] | null
}

export interface LotCellView { x: number; y: number; state: 'free' | 'occupied' | 'water' | 'steep' | 'road' | string; fits: boolean }

export interface LotGridView {
  settlement_name: string
  building: Named
  can_rotate: boolean
  rotated: boolean
  grid_lots: number
  rows: LotCellView[][]
}

export interface LotConfirmView {
  settlement_name: string
  building: Named
  x: number
  y: number
  rotated: boolean
  cost_money: number
  materials: { component: Named; quantity: number }[] | null
  build_time_seconds: number
}

export interface ConstructionLineView {
  building: Named
  lot_x: number
  lot_y: number
  state: 'queued' | 'building' | string
  finish_at: string | null
  left_seconds: number
}

export interface ConstructionProgressView { name: string; lines: ConstructionLineView[] | null }

export interface KnowledgeLineView {
  knowledge: Named
  state: 'held' | 'researching' | 'available' | 'locked' | string
  research_cost: number
  research_time_seconds: number
  buy_price: number
  missing: Named[] | null
  terrain_ok: boolean
}

export interface KnowledgeListView {
  name: string
  treasury: number
  literacy_percent: number
  running: { knowledge: Named; finish_at: string | null; left_seconds: number } | null
  lines: KnowledgeLineView[] | null
  hidden: number
}

export interface VillageRefusalView { kind: string; back: string }

/** One settlement_building entry of the content catalogue (section 4.1). */
export interface CatalogueBuilding {
  code: string
  name: Record<string, string>
  category?: string
  footprint: [number, number]
}
