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
