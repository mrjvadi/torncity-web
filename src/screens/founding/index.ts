import type { ScreenSet } from '../types'
import FoundingForm from './FoundingForm'

// The founding form: a local screen the group's Mini App button opens
// (client-api.md section 4.4). See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {},
  LOCAL: { founding_form: FoundingForm },
}

export default screens
