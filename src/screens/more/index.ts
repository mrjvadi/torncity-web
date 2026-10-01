import type { ScreenSet } from '../types'
import './more.css'

import { CrimeDetail, CrimeResult, CrimeStarted } from './Crime'
import { JobOpenings, JobDetail } from './Jobs'
import Settings from './Settings'
import Skills from './Skills'
import Achievements from './Achievements'
import PlayerCard from './Card'

// Native layouts for server screens the base areas (native/, features/) do
// not cover yet — see the gap analysis in the commit history of this
// folder. Reuses the kit at ../native/kit; see ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    crime_detail: CrimeDetail,
    crime_result: CrimeResult,
    crime_started: CrimeStarted,
    job_openings: JobOpenings,
    job_detail: JobDetail,
    settings: Settings,
    skills: Skills,
    achievements: Achievements,
    card: PlayerCard,
  },
  LOCAL: {},
}

export default screens
