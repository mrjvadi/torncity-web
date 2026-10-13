import type { NArea } from '../../registry'
import CityPanel from './CityPanel'
import Building from './Building'
import Law from './Law'
import { Development, Knowledge, LocalKnowledge, LocalOverview, LocalProgress, LocalWho, Overview, Progress, Who } from './Town'

// «شهر»: the town as a whole (the city panel and the screens it opens), one building, the law and its courts.
const area: NArea = {
  server: {
    settlement_building_view: Building,
    settlement_law: Law,
    village_overview: Overview,
    village_development: Development,
    settlement_knowledge_list: Knowledge,
    settlement_who: Who,
    settlement_construction_progress: Progress,
  },
  local: {
    city_panel: CityPanel,
    village_overview: LocalOverview,
    village_knowledge: LocalKnowledge,
    village_who: LocalWho,
    village_progress: LocalProgress,
  },
}
export default area
