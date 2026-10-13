// «من» (the Me tab): the profile (its root) and the screens opened from it.

import type { NArea } from '../../registry'
import Profile from './Profile'
import Skills from './Skills'
import Achievements from './Achievements'
import Card from './Card'
import Settings from './Settings'
import Life from './Life'

const area: NArea = {
  server: { profile: Profile, skills: Skills, achievements: Achievements, card: Card, settings: Settings, life: Life },
}
export default area
