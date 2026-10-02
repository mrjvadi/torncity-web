import type { ScreenSet } from '../types'
import { FlowHost, registerWrite } from '../village/flow'
import { FORCES_SCREENS } from './forces'
import { PROCURE_SCREENS } from './procure'
import { WAR_SCREENS } from './war'
import { LICENCE_SCREENS } from './licences'
import { isMilitaryWrite } from './wording'

// The military, war and defence area (docs/adr/0039-presentation-split.md): every screen draws from its
// view and its actions alone, and the flow host (village/flow.tsx) keeps the answer on show, turns an
// action into a read (opens the screen through the shell) or a write (runs it here, once, and shows the
// answer). The army, war, procurement and defence licences are country-level: the entry screens carry the
// "not available here" answer in a village or a town.
registerWrite(isMilitaryWrite)

const screens: ScreenSet = {
  SERVER: Object.fromEntries([...FORCES_SCREENS, ...PROCURE_SCREENS, ...WAR_SCREENS, ...LICENCE_SCREENS].map((name) => [name, FlowHost])),
  LOCAL: {},
}

export default screens
