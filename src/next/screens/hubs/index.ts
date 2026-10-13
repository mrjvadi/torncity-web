import type { NArea } from '../../registry'
import { ActivityHub, EconomyHub, SocietyHub } from './Hubs'

const area: NArea = { local: { activity: ActivityHub, economy: EconomyHub, society: SocietyHub } }
export default area
