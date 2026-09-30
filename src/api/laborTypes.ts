// The labour market's views (api/client-api.md, settlement.labor.*).

import type { Named } from './types'

export interface LaborMarketView {
  housing: number
  pool: number
  available: number
  working: number
  vacancies: number
  tightness_bps: number
  level: 'slack' | 'balanced' | 'tight' | 'short' | string
  npc_wage: number
  min_wage: number
}

export interface LaborJobView {
  id: string
  building_id: string
  building: Named
  kind: 'construction' | 'production' | string
  employer_kind: 'settlement' | 'player' | string
  employer: string
  wage: number
  left: number
  total: number
  progress_bps: number
  left_minutes: number
  workers: number
  npc_crew: number
  can_take: boolean
  mine: boolean
  points: number
}

export interface LaborShiftView {
  id: string
  building: Named
  kind: string
  worker: string
  worker_npc: boolean
  level: string
  finish_at: string
  left_seconds: number
  wage: number
  points: number
}

export interface LaborBoardView {
  village: string
  jobs: LaborJobView[] | null
  market: LaborMarketView
  working: LaborShiftView | null
  resident: boolean
  sites: { id: string; building: Named; progress_bps: number }[] | null
}

export interface LaborSiteView {
  village: string
  building: Named
  id: string
  status: 'building' | 'complete' | string
  progress_bps: number
  required_minutes: number
  done_minutes: number
  left_minutes: number
  job: LaborJobView | null
  workers: LaborShiftView[] | null
  market: LaborMarketView
  can_work: boolean
  work_wage: number
  work_points: number
  working: LaborShiftView | null
  can_employ: boolean
  can_post: boolean
  hire_presets: number[] | null
  wage_presets: { percent: number; wage: number }[] | null
  npc_available: number
  npc_wage: number
  just: string
}

export interface LaborMineView {
  village: string
  shifts: number
  earned: number
  level: 'apprentice' | 'journeyman' | 'master' | string
  productivity_bps: number
  next_level: string
  next_shifts: number
  working: LaborShiftView | null
  market: LaborMarketView
}
