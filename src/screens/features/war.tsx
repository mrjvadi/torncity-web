import { useEffect } from 'react'
import type { ScreenComponent } from '../types'
import NativeText from './kit/NativeText'
import { Scroll, Card } from './kit/parts'
import Skeleton from '../../ui/Skeleton'

// The armed forces and war (docs/adr/0022): real, server-side commands.
// The client is not given a structured view for them yet (client-api.md
// §3.1), so every one of these screens is NativeText — the server's own
// text and actions in the feature's card language — registered under the
// exact screen name the server answers with (screen = the command, since
// resp.Screen is empty for these — internal/clientapi/bridge.go).

const MILITARY_SCREENS = [
  'military.ministry', 'military.forces', 'military.branch', 'military.station',
  'military.procure', 'military.buy', 'military.licences', 'military.licence',
]

const WAR_SCREENS = [
  'war.board', 'war.declare', 'war.join', 'war.propose', 'war.answer',
  'war.resume', 'war.room', 'war.target', 'war.launch',
]

const SERVER: Record<string, ScreenComponent> = {}
for (const name of [...MILITARY_SCREENS, ...WAR_SCREENS]) SERVER[name] = NativeText

/** The dock's entry point: opens the real military hub (the ministry),
 * which itself links to the forces and the war board. */
const WarEntry: ScreenComponent = ({ run, loading }) => {
  useEffect(() => { run('military.ministry') }, [run])
  if (!loading) return null
  return <Scroll><Card><Skeleton lines={5} /></Card></Scroll>
}

const LOCAL: Record<string, ScreenComponent> = { war: WarEntry }

export default { SERVER, LOCAL }
