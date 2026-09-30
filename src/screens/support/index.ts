import type { ScreenSet } from '../types'
import SupportHome from './SupportHome'
import { SupportJourney, SupportSoon, SupportTravel, VillageVisit } from './Travel'

// Support, the neutral city: its 3D home with every service as a building,
// the travel screens and the visit of a foreign village. See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {},
  LOCAL: {
    support_home: SupportHome,
    support_travel: SupportTravel,
    support_journey: SupportJourney,
    support_soon: SupportSoon,
    village_visit: VillageVisit,
  },
}

export default screens
