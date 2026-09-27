// A small dev-only harness this area owns, for screenshotting a single
// feature screen without going through login/session/Shell (none of which
// this area may edit). Open with e.g.:
//   /src/screens/features/dev/harness.html?screen=casino
//   /src/screens/features/dev/harness.html?screen=friends&kind=server
// `kind` defaults to "local"; for "server" the screen is fed the matching
// mock answer from ../../../api/mock_features.ts.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../styles/global.css'
import { LOCAL_SCREENS, SERVER_SCREENS } from '../../registry'
import { mockFeatureCommand } from '../../../api/mock_features'
import type { CommandResponse } from '../../../api/types'

const params = new URLSearchParams(location.search)
const name = params.get('screen') ?? 'family'
const kind = params.get('kind') === 'server' ? 'server' : 'local'
const table = kind === 'server' ? SERVER_SCREENS : LOCAL_SCREENS
const Comp = table[name]

// mockFeatureCommand keys off the *command*, which for a wired view (like
// friends/search) is not the same as the *screen* name it answers with
// (screen "friends" comes from command "social.friend.list"). Everywhere
// else (military.*/war.*) the command IS the screen.
const SCREEN_TO_COMMAND: Record<string, { command: string; args?: Record<string, string> }> = {
  friends: { command: 'social.friend.list' },
  search: { command: 'social.search', args: { query: '@kaveh' } },
}

function noop() {}

function Harness() {
  if (!Comp) {
    return (
      <div style={{ color: '#fff', padding: 24, fontFamily: 'sans-serif' }}>
        Unknown {kind} screen: <b>{name}</b>
        <br />Known: {Object.keys(table).join(', ')}
      </div>
    )
  }
  const mapped = SCREEN_TO_COMMAND[name]
  const response: CommandResponse | null = kind === 'server'
    ? mockFeatureCommand(mapped?.command ?? name, mapped?.args)
    : null
  return (
    <div className="shell" style={{ height: '100%' }}>
      <main className="shell-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Comp response={response} loading={false} onAction={noop} run={noop} openLocal={noop} localArgs={{}} />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Harness /></StrictMode>,
)
