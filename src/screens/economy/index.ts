import type { ScreenSet } from '../types'
import { FlowHost, registerWrite } from '../village/flow'
import { BANK_SCREENS } from './bank'
import { FINANCE_SCREENS } from './finance'
import { EXCHANGE_SCREENS } from './exchange'
import { TRADE_SCREENS } from './trade'
import { AUCTION_SCREENS } from './auctions'
import { isEcoWrite } from './wording'

// The economy and finance area (docs/adr/0039-presentation-split.md): every screen draws from its view and
// its actions alone, and the flow host (village/flow.tsx) keeps the answer on show, turns an action into a
// read (opens the screen through the shell) or a write (runs it here, once, and shows the answer).
registerWrite(isEcoWrite)

const screens: ScreenSet = {
  SERVER: Object.fromEntries(
    [...BANK_SCREENS, ...FINANCE_SCREENS, ...EXCHANGE_SCREENS, ...TRADE_SCREENS, ...AUCTION_SCREENS].map((name) => [name, FlowHost]),
  ),
  LOCAL: {},
}

export default screens
