import type { ScreenSet } from '../types'
import { FlowHost, registerWrite } from '../village/flow'
import { COMPANY_SCREENS } from './companies'
import { MANAGE_SCREENS } from './manage'
import { PRODUCTION_SCREENS } from './production'
import { DESIGN_SCREENS } from './design'
import { RECRUIT_SCREENS } from './recruit'
import { isCompanyWrite } from './wording'

// The companies, production and recruitment area (docs/adr/0039-presentation-split.md): every screen draws from its
// view and its actions alone, and the flow host (village/flow.tsx) keeps the answer on show, turns an action into a
// read (opens the screen through the shell) or a write (runs it here, once, and shows the answer).
registerWrite(isCompanyWrite)

const screens: ScreenSet = {
  SERVER: Object.fromEntries(
    [...COMPANY_SCREENS, ...MANAGE_SCREENS, ...PRODUCTION_SCREENS, ...DESIGN_SCREENS, ...RECRUIT_SCREENS].map((name) => [name, FlowHost]),
  ),
  LOCAL: {},
}

export default screens
