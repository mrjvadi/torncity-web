import type { ScreenSet } from '../types'
import VillageHome from './VillageHome'
import { Knowledge, Overview, Progress, Who } from './Status'

// The village: a local home screen (the 3D view) and the status screens,
// which are also the layouts of the server screens the same commands answer
// with (client-api.md section 4.3). See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    village_overview: Overview,
    settlement_construction_progress: Progress,
    settlement_knowledge_list: Knowledge,
  },
  LOCAL: {
    village_home: VillageHome,
    village_overview: Overview,
    village_progress: Progress,
    village_knowledge: Knowledge,
    village_who: Who,
  },
}

export default screens
