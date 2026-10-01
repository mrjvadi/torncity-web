import type { ScreenSet } from '../types'
import { FlowHost, registerFlow, registerWrites, type FlowScreen } from '../village/flow'
import { TRAVEL_SCREENS } from './travel'
import { PERSON_SCREENS } from './person'
import { THING_SCREENS } from './things'
import './life.css'

// The life area (docs/adr/0039-presentation-split.md): the screens of the player's own place, journeys,
// life, devices, bag and property, drawn from their neutral views. One host (the village flow host) keeps
// the answer on show: a read opens the screen its command answers, a write runs here with an idempotency
// key and shows its answer (the result, or the refusal with the way on).

const FLOWS = { ...TRAVEL_SCREENS, ...PERSON_SCREENS, ...THING_SCREENS } as unknown as Record<string, FlowScreen>

registerFlow(FLOWS)

// the commands of this area that change the world; a departure is a write only once a way to pay is chosen
registerWrites([
  'inventory.use', 'inventory.give', 'life.sleep', 'life.avatar', 'life.bio', 'property.purchase', 'property.buy', 'property.rent',
  'property.sell', 'property.let', 'property.cancel', 'property.rest', 'device.revoke', 'player.language.set', 'player.presence.set',
])
registerWrites(['travel.start'], (a) => !!a.args?.method)
registerWrites(['inventory.drop', 'property.leave'], (a) => !!a.args?.confirm)

const screens: ScreenSet = {
  SERVER: Object.fromEntries(Object.keys(FLOWS).map((name) => [name, FlowHost])),
  LOCAL: {},
}

export default screens
