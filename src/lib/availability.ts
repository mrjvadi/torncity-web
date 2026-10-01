// What the data says exists where (configs/content/availability.yml, served beside the content
// catalogue): the stage each feature becomes available at. The client lists a feature only once the
// player's settlement has reached its stage, and never hardcodes a tier (CLAUDE.md section 2).

import { useEffect, useState } from 'react'
import * as api from '../api/client'
import { useSession } from '../state/SessionContext'

export interface AvailabilityTag {
  kind: string
  code: string
  stage: string
}

/** The stages in the order a settlement grows through them; support is the neutral city, which is a city. */
const ORDER = ['village', 'town', 'city', 'country']

let loaded: Promise<AvailabilityTag[]> | null = null

export function loadAvailability(): Promise<AvailabilityTag[]> {
  if (!loaded) {
    loaded = api.getContent().then((c) => (c as { availability?: AvailabilityTag[] } | null)?.availability ?? []).catch(() => {
      loaded = null
      return [] as AvailabilityTag[]
    })
  }
  return loaded
}

/** True when a settlement of this tier has reached the stage. */
export function reached(tier: string, stage: string): boolean {
  // a city belongs to a country (governance: city -> country), so a city player already has the national
  // level around them: parliament, ministries, foreign policy, war. Below a city there is none yet.
  if (tier === 'city' && stage === 'country') return true
  const have = ORDER.indexOf(tier), need = ORDER.indexOf(stage)
  return need >= 0 && have >= need
}

/** The player's own stage: their settlement's tier, or a city (the neutral city and the old cities). */
export function useStage(): string {
  const { bootstrap } = useSession()
  return bootstrap?.settlement?.tier ?? 'city'
}

/** Whether the feature exists for this player: null while the data is not here yet. */
export function useAvailable(kind: string, code: string): boolean | null {
  const stage = useStage()
  const [tags, setTags] = useState<AvailabilityTag[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadAvailability().then((t) => { if (!cancelled) setTags(t) })
    return () => { cancelled = true }
  }, [])
  if (tags === null) return null
  const tag = tags.find((x) => x.kind === kind && x.code === code)
  return tag ? reached(stage, tag.stage) : false
}
