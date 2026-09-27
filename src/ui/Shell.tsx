import { useState } from 'react'
import Hud from './Hud'
import Dock, { type TabKey } from './Dock'
import GenericScreen from './GenericScreen'
import CityView from './CityView'
import MenuSheet from './MenuSheet'
import BottomSheet from './BottomSheet'
import { useSession } from '../state/SessionContext'
import { useScreen } from '../state/useScreen'
import type { Action } from '../api/types'
import { LOCAL_SCREENS, SERVER_SCREENS } from '../screens/registry'

const TAB_COMMAND: Record<TabKey, string> = {
  profile: 'player.profile.get',
  activity: 'job.status',
  city: '',
  market: 'market.list',
  society: 'faction.mine',
}

/** A tab opens its hub (a local screen) when one is registered. */
const TAB_HUB: Partial<Record<TabKey, string>> = {
  activity: 'activity_hub',
  market: 'economy_hub',
  society: 'society_hub',
}

type ScreenKey = { command: string; args?: Record<string, string>; local?: string }

export default function Shell() {
  const { profile, exec, signOut } = useSession()
  const [tab, setTab] = useState<TabKey>('city')
  const [screenKey, setScreenKey] = useState<ScreenKey>({ command: TAB_COMMAND.city })
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

  function selectTab(next: TabKey) {
    setTab(next)
    const hub = TAB_HUB[next]
    if (hub && LOCAL_SCREENS[hub]) setScreenKey({ command: '', local: hub })
    else setScreenKey({ command: TAB_COMMAND[next] })
  }

  function run(command: string, args?: Record<string, string>) {
    setScreenKey({ command, args })
  }

  function openLocal(name: string, args?: Record<string, string>) {
    setScreenKey({ command: '', local: name, args })
  }

  async function onAction(a: Action) {
    if (!a.command) return
    const res = await exec(a.command, a.args ?? {})
    if (res) setScreenKey({ command: a.command, args: a.args })
  }

  const isLocal = !!screenKey.local
  const isCity = !isLocal && screenKey.command === TAB_COMMAND.city
  const { response, loading } = useScreen(isCity || isLocal ? null : screenKey.command, screenKey.args)
  const Local = isLocal ? LOCAL_SCREENS[screenKey.local!] : undefined
  const Native = !isLocal && response?.screen ? SERVER_SCREENS[response.screen] : undefined
  const props = { response: isLocal ? null : response, loading, onAction, run, openLocal, localArgs: screenKey.args }

  return (
    <div className="shell">
      <Hud
        profile={profile}
        unread={0}
        onBank={() => onAction({ label: '', command: 'bank.show', row: 0, kind: 'navigation' })}
        onBell={() => setBellOpen(true)}
        onMenu={() => setMenuOpen(true)}
        onAvatar={() => selectTab('profile')}
      />
      <main className="shell-main">
        {isCity ? <CityView />
          : Local ? <Local {...props} />
            : Native ? <Native {...props} />
              : <GenericScreen response={response} loading={loading} onAction={onAction} />}
      </main>
      <Dock active={tab} onSelect={selectTab} />

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPick={(command) => { setTab('profile'); setScreenKey({ command }) }}
        onSignOut={signOut}
      />
      <BottomSheet open={bellOpen} onClose={() => setBellOpen(false)} title="اعلان‌ها">
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '12px 0' }}>اعلانی وجود ندارد.</p>
      </BottomSheet>

      <style>{`
        .shell { display: flex; flex-direction: column; height: 100%; }
        .shell-main { flex: 1; display: flex; flex-direction: column; min-height: 0; }
      `}</style>
    </div>
  )
}
