import type { ScreenProps } from '../types'
import ServerHub from './ServerHub'
import { SOCIETY_ENTRIES } from './kit/hubs'

/** The Society hub: the entries the server lists for where the player stands (`society.hub`). In a village the
 * government is the village head's «دهیاری», not a city government. */
export default function SocietyHub({ run }: ScreenProps) {
  return (
    <ServerHub
      command="society.hub" title="hub.society" tone="violet" look={SOCIETY_ENTRIES} run={run}
      rename={(code, place) => (code === 'government' && place.tier === 'village' ? 'hub.government_village' : undefined)}
    />
  )
}
