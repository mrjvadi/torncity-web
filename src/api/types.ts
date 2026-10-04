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
  /** Telegram's button text. The neutral contract (client-api 1.4) sends none for
   * a migrated screen: the web words an action by its `id` (screens/village/actionLabel.ts). */
  label?: string
  /** What the action is, by meaning ("citizen.land", "back", "confirm"); empty = the command. */
  id?: string
  /** The content code the action is about (a building, a knowledge, an item). */
  subject?: string
  command?: string
  args?: Record<string, string>
  input?: ActionInput
  url?: string
  /** Keyboard row of the legacy contract; absent for a migrated screen. */
  row?: number
  kind: 'primary' | 'secondary' | 'danger' | 'navigation' | 'back' | 'confirm' | string
  icon?: string
  group?: string
}

export interface Notice {
  /** The legacy sentence; a migrated screen sends `code` and `args` instead. */
  text?: string
  code?: string
  args?: Record<string, unknown>
  alert: boolean
}

/** A refusal: a stable `code` and data (`args`); `message` is the legacy sentence. */
export interface ApiErrorBody {
  code: string
  message?: string
  args?: Record<string, unknown>
}

export interface CommandResponse {
  ok: boolean
  request_id?: string
  screen: string
  text?: string
  view?: Record<string, unknown>
  actions?: Action[]
  notice?: Notice
  error?: ApiErrorBody
  /** (contract 1.6) the state sync records this command caused, when ready in time */
  updates?: import('../state/syncTypes').CommandUpdates
}

export interface RealtimeToken {
  token: string
  expires_at: string
  user?: string
  channels?: string[]
  channel?: string
  /** (contract 1.6) the player's channel carries state sync publications */
  updates?: boolean
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
  /** (contract 1.6) the optional parts this server serves; `updates` is state sync */
  features?: { updates?: boolean }
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
  /** always "city" since the promotion ladder was retired: kept for the layout hash, never used for text */
  tier: string
  world_cell: number
  centre: PlaceRef
  /** holds any office of the charter */
  is_head: boolean
  /** the permissions the player holds here (the charter's atomic codes, `fiscal.set:sales_tax` style for a scoped one) */
  permissions?: string[]
  resident: boolean
  grid_lots: number
  layout_path: string
  /** The founding form's choices (contract 1.3); absent on an older village. */
  emblem?: EmblemCodes
  motto?: string
  currency?: { code: string; name: string; symbol: string }
}

// -- The founding form (client-api.md section 4.4, contract 1.3) ---------------

/** A village emblem: four codes of the catalogue, drawn as an SVG. */
export interface EmblemCodes {
  shape: string
  color_a: string
  color_b: string
  icon: string
}

/** A shape, colour or icon of the emblem: the server sends its code (and a colour's hex); the client names it. */
export interface FoundingChoice { code: string; hex?: string }

export interface FoundingLimits {
  name_min: number
  name_max: number
  motto_max: number
  currency_name_min: number
  currency_name_max: number
  currency_code_len: number
  currency_symbol_max: number
}

export type FoundingState = 'mine' | 'other' | 'expired' | 'founded'

/** `founding_form`: what the form needs. */
export interface FoundingFormView {
  state: FoundingState
  draft: string
  expires_at: string
  founder: string
  suggested_name: string
  default_emblem: EmblemCodes
  limits: FoundingLimits
  shapes: FoundingChoice[]
  palette: FoundingChoice[]
  icons: FoundingChoice[]
  neutral_currency: string
  settlement_id?: string
  settlement_name?: string
}

export interface FoundingProblem { field: string; code: string }

/** The form fields a problem can name. */
export type FoundingField = 'name' | 'motto' | 'currency_name' | 'currency_code' | 'currency_symbol' | 'emblem'

/** What `settlement.found.submit` takes. */
export interface FoundingSubmitArgs {
  draft: string
  name: string
  motto: string
  currency_name: string
  currency_code: string
  currency_symbol: string
  shape: string
  color_a: string
  color_b: string
  icon: string
  check?: string
}

/** `settlement_founded`. */
export interface SettlementFoundedView {
  name: string
  settlement_id: string
  emblem: EmblemCodes
  motto?: string
  currency_name?: string
  currency_code?: string
  currency_symbol?: string
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
  /** A resident's building (contract 1.4, members only): its owner's name and
   * whether it is the viewer's own. */
  private?: boolean
  owner?: string
  mine?: boolean
}

/** One lot that has an owner (contract 1.4, members only); any lot not listed
 * is commons, on sale at `terms.lot_price`. */
export interface LayoutTenure { x: number; y: number; tenure: 'freehold' | 'leased'; mine: boolean; owner?: string }

/** What a lot, a permit and the property tax cost in this village. */
export interface LayoutTerms { lot_price: number; permit_fee: number; tax_bps: number }

/** GET /api/v1/settlements/{id}/layout */
export interface VillageLayout {
  version: string
  detail: 'full' | 'coarse'
  viewer: { member: boolean; can_place: boolean; resident?: boolean }
  settlement: { id: string; code: string; name: string; tier: string; world_cell: number; centre: PlaceRef }
  grid: { lots: number; lot_m: number; origin: { lat: number; lon: number }; slope_limit: number }
  lots: LayoutLot[][]
  buildings: LayoutBuilding[]
  roads?: { x: number; y: number }[]
  tenure?: LayoutTenure[]
  terms?: LayoutTerms
  /** The land the roads opened beyond the first grid (ADR 0044 5.5), for a member. */
  land?: LayoutLand
}

/** A road drawn out of the first grid. */
export interface LayoutRoadPlan { id: string; class: string; lots: number; to_x: number; to_y: number }
/** One lot of a drawn road; `built` once a buyer's purchase laid it. Lot coordinates may be negative. */
export interface LayoutRoadCell { x: number; y: number; plan: string; built: boolean; water?: 'stream' | 'river'; height_m: number }
/** A lot a road opened; `reason` says why a lot cannot be used ('water' or 'steep'). */
export interface LayoutOpenLot {
  x: number; y: number; buildable: boolean; reason?: 'water' | 'steep'
  height_m: number; slope_m: number; biome?: string; water?: string; tags?: string[]
}
export interface LayoutLand { plans: LayoutRoadPlan[]; cells: LayoutRoadCell[]; open: LayoutOpenLot[] }

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
    | 'build_started' | 'build_finished' | 'build_cancelled' | 'build_salvaged' | 'build_batch_started' | 'land_changed'
    | 'research_started' | 'research_finished' | 'knowledge_bought' | 'literacy_changed'
    | 'head_changed' | 'member_joined' | 'member_left' | 'lot_bought' | 'lot_repaired'
  settlement_id: string
  seq: number
  at: string
  building_id?: string
  type_code?: string
  lot_x?: number
  lot_y?: number
  rotated?: boolean
  finish_at?: string
  /** build_batch_started: how many, and which. */
  count?: number
  buildings?: { building_id: string; lot_x: number; lot_y: number }[]
  grid_lots?: number
  /** build_started: the roads the game laid with the building, finished at once. */
  auto_roads?: { building_id: string; lot_x: number; lot_y: number }[]
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

// -- Village views: generated from the Go view types (views.gen.ts, do not edit) --
// The names below are the ones the village code already uses.

export type {
  Named, VillageOverviewView, DonateView, BuildMenuView, LotGridView, LotCell, LandCell, LotConfirmView, RoadQuoteView, RoadCancelledView, RoadPlanLine,
  ConstructionProgressView, KnowledgeListView, LotBuyView, LotAccessView, LotRepairView, PrivateMenuView, PrivateConfirmView, MineView,
  MaterialBuyView as MaterialBuyConfirmView, MaterialsView as VillageMaterialsView, BuildingView as BuildingPanelView,
  LotBatchConfirmView as BatchConfirmView, VillageRefusalView, PromotionView, ResidenceView, WorkView, TermsView,
  LandView, SettlementWhoView, PrivateLotsView, VillageNeed, ScreenViews,
  BuildLine as BuildLineView, LotCell as LotCellView, ConstructionLine as ConstructionLineView, KnowledgeLine as KnowledgeLineView,
  PrivateMaterial as PrivateMaterialView, PrivateLine as PrivateLineView, MineLot as MineLotView,
  MaterialStockLine as MaterialStockLineView, MaterialMarketLine as MaterialMarketLineView, MaterialBought as MaterialBoughtView,
} from './views.gen'

/** One settlement_building entry of the content catalogue (section 4.1). */
export interface CatalogueBuilding {
  code: string
  name: Record<string, string>
  category?: string
  footprint: [number, number]
  /** Free of the concurrent-construction cap, so it can be laid many at a time (roads). */
  cap_exempt?: boolean
}
