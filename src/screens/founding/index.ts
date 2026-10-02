import type { ScreenSet } from '../types'
import FoundingForm from './FoundingForm'
import { FoundDraft, Founded, FoundingChecked, FoundingRefusal } from './FoundingScreens'

// The founding form: a local screen the group's Mini App button opens
// (client-api.md section 4.4), and the server's other founding screens, drawn
// from their views. See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    settlement_found_draft: FoundDraft,
    // `settlement.found.draft` answers with the form itself
    founding_form: FoundingForm,
    founding_checked: FoundingChecked,
    founding_refusal: FoundingRefusal,
    settlement_refusal: FoundingRefusal,
    settlement_founded: Founded,
  },
  LOCAL: { founding_form: FoundingForm },
}

export default screens
