import type { ScreenSet } from '../types'

// Register this area's screens here: SERVER by the server's screen name,
// LOCAL by a client-only name. The shell looks both up (../registry.ts).
const screens: ScreenSet = { SERVER: {}, LOCAL: {} }
export default screens
