import type { ComponentType } from 'react'
import type { Action, CommandResponse } from '../api/types'

/** What every screen gets from the shell. A server screen gets the answer
 * of the command that opened it; a local screen (a hub, a preview) gets
 * null and draws itself. */
export interface ScreenProps {
  response: CommandResponse | null
  loading: boolean
  /** Runs an action from a server answer (asks first for danger/confirm and
   * input the way GenericScreen does, when the screen wants that). */
  onAction: (action: Action) => void
  /** Opens the screen a command answers with. */
  run: (command: string, args?: Record<string, string>) => void
  /** Opens a client-only screen by name (LOCAL registry). */
  openLocal: (name: string, args?: Record<string, string>) => void
  /** A local screen's own arguments. */
  localArgs?: Record<string, string>
}

export type ScreenComponent = ComponentType<ScreenProps>

/** A screen area's registrations. SERVER: keyed by the server's `screen`
 * name (api/client-api.md section 3); LOCAL: client-only screens by name. */
export interface ScreenSet {
  SERVER: Record<string, ScreenComponent>
  LOCAL: Record<string, ScreenComponent>
}
