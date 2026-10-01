import type { ScreenSet } from '../types'
import { SocietyHost, registerSociety, type SocScreen } from './host'
import { GOVERNANCE_SCREENS } from './governance'
import { ELECTION_SCREENS } from './elections'
import { FACTION_SCREENS } from './factions'
import { DIPLOMACY_SCREENS } from './diplomacy'
import { LEGISLATURE_SCREENS } from './legislature'
import { PEOPLE_SCREENS } from './people'

// Politics and society (docs/adr/0039-presentation-split.md): every screen of the area draws from
// its view and its actions alone. One host serves them all (host.tsx); this file names the screens.
const all: Record<string, SocScreen> = {
  ...GOVERNANCE_SCREENS, ...ELECTION_SCREENS, ...FACTION_SCREENS, ...DIPLOMACY_SCREENS, ...LEGISLATURE_SCREENS, ...PEOPLE_SCREENS,
}
registerSociety(all)

export const SOCIETY_SCREEN_NAMES = Object.keys(all)

const screens: ScreenSet = {
  SERVER: Object.fromEntries(SOCIETY_SCREEN_NAMES.map((name) => [name, SocietyHost])),
  LOCAL: {},
}

export default screens
