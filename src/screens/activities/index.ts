import type { ScreenSet } from '../types'
import { FlowHost, registerFlow, registerWrites, type FlowScreen } from '../village/flow'
import { CRIME_SCREENS, CRIME_WRITES } from './crime'
import { WORK_SCREENS, WORK_WRITES } from './work'
import { HEALTH_SCREENS, HEALTH_WRITES } from './health'
import './activities.css'

// The activities (docs/adr/0039-presentation-split.md, docs/adr/0038): crime, work, study, skills, health and
// missions, drawn from their neutral views. Like the life area, one host (the village flow host) keeps the answer
// on show: a read opens the screen its command answers, a write runs here with an idempotency key.
// The older native layouts (crime hub and list, job status, education, hospital, mission board) keep their own
// files in ../native and read the same views; every other screen of the area is here.

const FLOWS = { ...CRIME_SCREENS, ...WORK_SCREENS, ...HEALTH_SCREENS } as unknown as Record<string, FlowScreen>

registerFlow(FLOWS)
registerWrites([...CRIME_WRITES, ...WORK_WRITES, ...HEALTH_WRITES])

const screens: ScreenSet = {
  SERVER: Object.fromEntries(Object.keys(FLOWS).map((name) => [name, FlowHost])),
  LOCAL: {},
}

export default screens
