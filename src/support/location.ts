// Where the player is: in Support (the neutral city), in a village (their own
// or a foreign one they travelled to), or on the road. The server is adding a
// `location` field to the bootstrap and a list of travel destinations; until
// it lands this file is the contract the client codes against (see
// docs/support-city.md) and a bootstrap without `location` behaves as before:
// the village tab shows the player's own village (or the call to found one).

import type { Bootstrap, EmblemCodes } from '../api/types'

export type LocationKind = 'city' | 'settlement' | 'travelling'

export interface Destination {
  kind: 'city' | 'village'
  /** `support`, or the village's code */
  code: string
  name: string
  settlement_id?: string
  emblem?: EmblemCodes
  motto?: string
  tier?: string
}

export interface PlayerLocation {
  kind: LocationKind
  code: string
  name: string
  settlement_id?: string
  /** while travelling */
  from?: Destination
  to?: Destination
  mode_code?: string
  mode_name?: string
  remaining_seconds?: number
  total_seconds?: number
  arrives_at?: string
}

/** A place a player can travel to (`travel.destinations`). */
export interface TravelDestination extends Destination {
  distance_km: number
  duration_seconds?: number
  fare?: number
}

export function locationOf(b: Bootstrap | null | undefined): PlayerLocation | null {
  return (b as { location?: PlayerLocation } | null | undefined)?.location ?? null
}

export interface HomeScreen { local: string; args?: Record<string, string> }

/** The screen the village tab shows for where the player is. */
export function homeScreen(b: Bootstrap | null | undefined): HomeScreen {
  const loc = locationOf(b)
  const own = b?.settlement
  if (!loc) return { local: own ? 'village_home' : 'village_call' }
  if (loc.kind === 'travelling') return { local: 'support_journey' }
  if (loc.kind === 'city') return { local: 'support_home' }
  if (own && (!loc.settlement_id || loc.settlement_id === own.id)) return { local: 'village_home' }
  if (loc.settlement_id) return { local: 'village_visit', args: { id: loc.settlement_id } }
  return { local: own ? 'village_home' : 'village_call' }
}

export const HOME_SCREENS = new Set(['village_home', 'village_call', 'support_home', 'support_journey', 'village_visit'])

/** A stable key of the location, to notice it changed. */
export function locationKey(b: Bootstrap | null | undefined): string {
  const l = locationOf(b)
  return l ? `${l.kind}:${l.code}:${l.settlement_id ?? ''}` : ''
}
