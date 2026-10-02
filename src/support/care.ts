// What kind of place of care the settlement the player stands in actually has, read from the server's health
// home (`health.home`: its facilities, and where the player is sent when none stands here). The glossary: a
// health house is «خانهٔ بهداشت»; «بیمارستان» is only a hospital's name. Which one a screen says follows the
// building that stands there, never a size or tier label.

import { useEffect, useSyncExternalStore } from 'react'
import * as api from '../api/client'
import { locationKey } from './location'
import { useSessionOptional } from '../state/SessionContext'

/** `health_house`: a health house stands here; `hospital`: the place has its own hospital; `none`: neither (clinics
 * only, or nothing); `unknown`: not read yet. */
export type Care = 'health_house' | 'hospital' | 'none' | 'unknown'

interface HealthHome { facilities?: { kind: string }[] | null; refer?: unknown }

const cache = new Map<string, Care>()
const inflight = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

export function careOf(v: HealthHome | undefined): Care {
  if (!v) return 'none'
  if ((v.facilities ?? []).some((f) => f.kind === 'health_house')) return 'health_house'
  return v.refer ? 'none' : 'hospital'
}

function ensure(key: string): void {
  if (cache.has(key) || inflight.has(key)) return
  inflight.add(key)
  api.runCommand('health.home', {})
    .then((r) => { cache.set(key, r.ok === false ? 'none' : careOf(r.view as HealthHome | undefined)) })
    .catch(() => { cache.set(key, 'none') })
    .finally(() => { inflight.delete(key); version++; listeners.forEach((l) => l()) })
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => version

/** The care of the place the player stands in. Reading it starts the one read of `health.home` (once per place). */
export function useCare(): Care {
  const b = useSessionOptional()?.bootstrap
  const key = `${locationKey(b)}|${b?.settlement?.id ?? ''}`
  useSyncExternalStore(subscribe, snapshot)
  useEffect(() => { if (b) ensure(key) }, [b, key])
  return cache.get(key) ?? 'unknown'
}

/** How a line that stands for the place of care is worded: the hospital's own word only where there is a hospital,
 * the health house's where one stands, a plain word for treatment otherwise. */
export const careWord = (c: Care): 'hospital' | 'house' | 'plain' => (c === 'hospital' ? 'hospital' : c === 'health_house' ? 'house' : 'plain')
