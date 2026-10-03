// The shapes of client state sync (api/client-api.md section 5.6, contract
// 1.6; docs/adr/0034): the snapshot, the update log's records, the push and
// the data of each kind of entity. Neutral data only: codes, numbers, ids
// and instants, which this client words itself.

export type SyncKind =
  | 'player' | 'vitals' | 'wallet' | 'inventory' | 'skill' | 'timed_action' | 'location' | 'inbox' | 'notice'
  | 'residence' | 'settlement' | 'relations' | 'goal'

export type SyncOp = 'set' | 'patch' | 'del'

export interface SyncRecord {
  pts: number
  type: string
  entity: SyncKind
  id: string
  v: number
  op: SyncOp
  data?: unknown
  at: string
  /** the request id of the command that made the change */
  cause?: string
}

export interface SyncSnapshot {
  pts: number
  epoch: string
  server_time: string
  entities: Partial<Record<SyncKind, Record<string, { v: number; d: unknown }>>>
  channels: Record<string, number>
}

export interface SyncDifference {
  pts: number
  updates: SyncRecord[]
  more: boolean
  reset?: boolean
  reason?: 'too_long' | 'epoch' | 'ahead'
  epoch: string
}

export interface SyncPublication {
  type: 'updates' | 'updates_too_long'
  from: number
  to: number
  updates?: SyncRecord[]
}

export interface CommandUpdates {
  pts: number
  records: SyncRecord[]
}

// -- the data of each kind ----------------------------------------------------

export interface PlayerData {
  name: string
  code: string
  lang: string
  status: string
  level: number
  xp: number
  next_level_xp: number
  /** life_rank code */
  rank: string
}

export interface Regen { amount: number; every_seconds: number; bps: number }
export interface Meter { value: number; max: number; as_of: string | null; regen?: Regen }
export interface VitalsData { energy: Meter; nerve: Meter; health: Meter }

export interface WalletData { currency: string; cash: number; bank: number; premium: boolean; primary: boolean }

export interface PieceData { id: string; holding: string; quality: number; uses_left: number | null }
export interface InventoryData { item: string; qty: number; holdings: Record<string, number>; pieces: PieceData[] }

export interface SkillData { skill: string; level: number; xp: number }

export interface TimedActionData {
  kind: string
  ref_type: string
  ref_id: string
  state: string
  started_at: string
  finish_at: string
}

export interface LocationData {
  city: string
  place: string
  settlement: string
  travel: { from: string; to: string; mode: string; departed_at: string; arrives_at: string } | null
  walk: { from: string; to: string; started_at: string; arrives_at: string } | null
}

export interface InboxData { unread: number; latest: string[] }

export interface NoticeData {
  kind: string
  category: string
  screen: string
  view: unknown
  created_at: string
  read: boolean
  instant: boolean
}

export interface ResidenceData { settlement: string; code: string; name: string; tier: string; is_head: boolean; resident: boolean }

export interface ElectionData { office: string; opens_at: string; candidacy_ends_at: string; voting_ends_at: string }

/** The verbs a viewer may perform on a building (the server's list; the client keeps no per-kind table). */
export type BuildingAction =
  | 'info' | 'upgrade' | 'demolish' | 'cancel' | 'workers' | 'take_shift' | 'help_build' | 'treasury' | 'research' | 'elections' | 'road'

export type BuildingReason = 'no_road' | 'no_staff' | 'storage_full' | 'no_input' | 'damaged'

export interface BuildingOverlay {
  id: string
  /** the level in the role's ladder; 0 outside one (the road, the hall) */
  tier: number
  role?: string
  status: 'working' | 'idle' | 'building'
  reasons: BuildingReason[]
  can_upgrade: boolean
  actions: BuildingAction[]
  staff?: { have: number; need: number }
  /** reserved: never sent yet (no building holds its own output) */
  output_ready?: { good: string; amount: number }
}

/** The next goal for the quest strip: "<source>.<kind>" with its args, progress against a target, and where to go. */
export interface GoalData {
  code: string
  args: Record<string, string>
  progress: number
  target: number
  go_to: string
}

export interface SettlementData {
  id: string
  code: string
  name: string
  tier: string
  viewer: 'head' | 'member' | 'public'
  grid_lots: number
  layout_version: string
  treasury: { currency: string; balance: number } | null
  knowledge: number
  research: { code: string; finish_at: string } | null
  /** the open election: the candidacy runs to candidacy_ends_at, then the vote to voting_ends_at (members only) */
  election: ElectionData | null
  /** what THIS viewer may do with each building and how it stands; a building with no entry is «info» only */
  buildings: BuildingOverlay[]
}

export interface RelationsData {
  friends: string[]
  faction: { id: string; rank: string } | null
  presence: string
}

export interface KindData {
  player: PlayerData
  vitals: VitalsData
  wallet: WalletData
  inventory: InventoryData
  skill: SkillData
  timed_action: TimedActionData
  location: LocationData
  inbox: InboxData
  notice: NoticeData
  residence: ResidenceData
  settlement: SettlementData
  relations: RelationsData
  goal: GoalData
}
