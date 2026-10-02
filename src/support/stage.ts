// The stage of the place the player stands in, for wording that differs by stage. The glossary: «بیمارستان»
// is a city's (and the central city's) place of care; in a village or a town it is «خانهٔ بهداشت».

import type { Bootstrap } from '../api/types'
import { useSessionOptional } from '../state/SessionContext'

export type Stage = 'village' | 'town' | 'city'

/** The stage of where the player stands: the central city and a city are `city`; else the tier the server sends for
 * the place (or for the player's own settlement), a village when it says nothing. */
export function stageOf(b: Bootstrap | null | undefined): Stage {
  const x = b as { location?: { kind?: string; tier?: string }; settlement?: { tier?: string } } | null | undefined
  if (x?.location?.kind === 'city') return 'city'
  const tier = x?.location?.tier ?? x?.settlement?.tier
  return tier === 'city' || tier === 'country' ? 'city' : tier === 'town' ? 'town' : 'village'
}

export function usePlaceStage(): Stage {
  return stageOf(useSessionOptional()?.bootstrap)
}

/** A hospital stands only in a city (and the central city). */
export const hasHospital = (stage: Stage): boolean => stage === 'city'
