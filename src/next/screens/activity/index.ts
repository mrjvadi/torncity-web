// The «فعالیت» area of the new UI: work, learning, health and training, crime, missions and the rankings, drawn from
// the server's neutral views. The tab's own hub (local `activity`) lives in ../hubs.
import type { NArea } from '../../registry'
import { WORK } from './work'
import { STUDY } from './study'
import { HEALTH } from './health'
import { CRIME } from './crime'
import { MISSIONS } from './missions'
import { REFUSALS } from './refusal'

const area: NArea = { server: { ...WORK, ...STUDY, ...HEALTH, ...CRIME, ...MISSIONS, ...REFUSALS } }
export default area
