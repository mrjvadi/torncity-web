import type { ScreenSet } from '../types'
import family from './family'
import dating from './dating'
import chats from './chats'
import onboarding from './onboarding'
import combat from './combat'
import press from './press'
import casino from './casino'
import misc from './misc'

// This area's screens: SERVER by the server's screen name (real,
// server-backed features — war/military, friends/search), LOCAL by a
// client-only name (previews of features the server does not have yet).
// The shell looks both up (../registry.ts).
const parts: ScreenSet[] = [family, dating, chats, onboarding, combat, press, casino, misc]

const screens: ScreenSet = {
  SERVER: Object.assign({}, ...parts.map((p) => p.SERVER)),
  LOCAL: Object.assign({}, ...parts.map((p) => p.LOCAL)),
}

export default screens
