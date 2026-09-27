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

const TAB_COMMAND: Record<TabKey, string> = {
  profile: 'player.profile.get',
  activity: 'job.status',
  city: '',
  market: 'market.list',
  society: 'faction.mine',
}

export default function Shell() {
  const { profile, exec, signOut } = useSession()
  const [tab, setTab] = useState<TabKey>('city')
  const [screenKey, setScreenKey] = useState<{ command: string; args?: Record<string, string> }>({ command: TAB_COMMAND.city })
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

  function selectTab(next: TabKey) {
    setTab(next)
    setScreenKey({ command: TAB_COMMAND[next] })
  }

  async function onAction(a: Action) {
    if (!a.command) return
    const res = await exec(a.command, a.args ?? {})
    if (res) setScreenKey({ command: a.command, args: a.args })
  }

  const isCity = screenKey.command === TAB_COMMAND.city
  const { response, loading } = useScreen(isCity ? null : screenKey.command, screenKey.args)

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
        {isCity ? <CityView /> : <GenericScreen response={response} loading={loading} onAction={onAction} />}
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
