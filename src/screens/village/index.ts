import type { ScreenSet } from '../types'
import VillageHome from './VillageHome'
import VillageCall from './VillageCall'
import { Knowledge, Overview, Progress, Who } from './Status'
import Storage from './Storage'
import { LaborBoard, LaborMine, LaborSiteScreen } from './Labor'
import { FlowHost, NATIVE } from './flow'
import { FLOW_SCREENS } from './screens'

// The village: a local home screen (the 3D view) and the status screens,
// which are also the layouts of the server screens the same commands answer
// with (client-api.md section 4.3). See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    ...Object.fromEntries(FLOW_SCREENS.map((name) => [name, FlowHost])),
    village_overview: Overview,
    settlement_construction_progress: Progress,
    settlement_knowledge_list: Knowledge,
    village_materials: Storage,
    labor_board: LaborBoard,
    labor_site: LaborSiteScreen,
    labor_mine: LaborMine,
  },
  LOCAL: {
    village_home: VillageHome,
    village_call: VillageCall,
    village_overview: Overview,
    village_progress: Progress,
    village_knowledge: Knowledge,
    village_who: Who,
    village_labor: LaborBoard,
    village_storage: Storage,
  },
}

// a write that answers one of these hands over to its own layout (flow.tsx)
for (const name of ['village_overview', 'settlement_construction_progress', 'settlement_knowledge_list', 'village_materials', 'labor_board', 'labor_site', 'labor_mine']) {
  NATIVE[name] = screens.SERVER[name]
}

export default screens
