// The new UI's screens. Each area lives in src/next/screens/<area>/index.ts and exports `server` (components keyed by
// the server's `screen` name, the one in a command's answer) and/or `local` (client-only screens by name). They are
// collected here automatically: adding an area needs no edit of this file. A server screen with no component here is
// drawn by the generic screen (screens/Generic.tsx).

import type { ComponentType } from 'react'
import type { CommandResponse } from '../api/types'

export interface NScreenProps {
  /** the answer of the command that opened the screen (null for a client-only screen) */
  response: CommandResponse | null
  loading: boolean
  /** the route's arguments (a client-only screen's own, or the command's) */
  args?: Record<string, string>
}
export type NScreen = ComponentType<NScreenProps>
export interface NArea { server?: Record<string, NScreen>; local?: Record<string, NScreen> }

export const SERVER: Record<string, NScreen> = {}
export const LOCAL: Record<string, NScreen> = {}

const areas = import.meta.glob<NArea>('./screens/*/index.ts', { eager: true, import: 'default' })
for (const [path, area] of Object.entries(areas)) {
  for (const [k, c] of Object.entries(area.server ?? {})) {
    if (SERVER[k] && import.meta.env.DEV) console.warn(`[next] server screen ${k} registered twice (${path})`)
    SERVER[k] = c
  }
  for (const [k, c] of Object.entries(area.local ?? {})) {
    if (LOCAL[k] && import.meta.env.DEV) console.warn(`[next] local screen ${k} registered twice (${path})`)
    LOCAL[k] = c
  }
}
