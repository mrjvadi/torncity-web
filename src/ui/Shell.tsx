import { useEffect, useRef, useState } from 'react'
import { takeResume, saveResume } from '../i18n/resume'
import Hud from './Hud'
import { Emboss } from '../kit'
import Dock, { type TabKey } from './Dock'
import GenericScreen from './GenericScreen'
import { Screen } from '../kit'
import MenuSheet from './MenuSheet'
import BottomSheet from './BottomSheet'
import { useSession } from '../state/SessionContext'
import { useScreen } from '../state/useScreen'
import type { Action } from '../api/types'
import { LOCAL_SCREENS, SERVER_SCREENS } from '../screens/registry'
import { foundingDraftFromLaunch } from '../lib/telegram'
import * as api from '../api/client'
import { t } from '../i18n'

/** The village tab: the player's village, or the call to found one. Support
 * is a journey away, never a tab. */
const VILLAGE_TAB = 'village'

const TAB_COMMAND: Record<TabKey, string> = {
  profile: 'player.profile.get',
  activity: 'job.status',
  city: VILLAGE_TAB,
  market: 'market.list',
  society: 'faction.mine',
}

/** A tab opens its hub (a local screen) when one is registered. */
const TAB_HUB: Partial<Record<TabKey, string>> = {
  activity: 'activity_hub',
  market: 'economy_hub',
  society: 'society_hub',
}

/** The starter city, whose services are a journey from a village. */
function supportCity(b: { cities: { code: string; name: string }[] } | null | undefined) {
  const c = b?.cities.find((x) => x.code === 'support')
  return { code: c?.code ?? 'support', name: c?.name ?? 'Support' }
}

type ScreenKey = { command: string; args?: Record<string, string>; local?: string }

export default function Shell() {
  const { profile, unread, exec, signOut, bootstrap } = useSession()
  // a language switch restarts the page: come back to the same screen
  const resumed = useRef(takeResume()).current
  const [tab, setTab] = useState<TabKey>((resumed?.tab as TabKey | undefined) ?? 'city')
  // The group's «تکمیل اطلاعات روستا» button opens the game with the draft's id
  // as the start parameter: land on the founding form.
  const [screenKey, setScreenKey] = useState<ScreenKey>(() => {
    if (resumed?.screen) return resumed.screen as ScreenKey
    const draft = foundingDraftFromLaunch()
    if (draft) return { command: '', local: 'founding_form', args: { draft } }
    return { command: '', local: bootstrap?.settlement ? 'village_home' : 'village_call' }
  })
  useEffect(() => { saveResume({ tab, screen: screenKey }) }, [tab, screenKey])
  const [menuOpen, setMenuOpen] = useState(false)

  // Opened without the parameter (the link was lost, or the game came from the
  // bot's chat): a player with no village who has an open founding draft of
  // their own lands on its form.
  const hasVillage = !!bootstrap?.settlement
  useEffect(() => {
    if (hasVillage || screenKey.local) return
    let cancelled = false
    void api.runCommand('settlement.found.draft', {}).then((r) => {
      const state = (r.view as { state?: string } | undefined)?.state
      if (!cancelled && r.ok && state === 'mine') setScreenKey({ command: '', local: 'founding_form', args: {} })
    }).catch(() => undefined)
    return () => { cancelled = true }
    // once, at entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectTab(next: TabKey) {
    setTab(next)
    const hub = TAB_HUB[next]
    if (next === 'city') setScreenKey({ command: '', local: hasVillage ? 'village_home' : 'village_call' })
    else if (hub && LOCAL_SCREENS[hub]) setScreenKey({ command: '', local: hub })
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
  const { response, loading } = useScreen(isLocal ? null : screenKey.command, screenKey.args)
  const Local = isLocal ? LOCAL_SCREENS[screenKey.local!] : undefined
  const Native = !isLocal && response?.screen ? SERVER_SCREENS[response.screen] : undefined
  const props = { response: isLocal ? null : response, loading, onAction, run, openLocal, localArgs: screenKey.args }

  return (
    <div className="shell">
      <Hud
        profile={profile}
        onBank={() => onAction({ label: '', command: 'bank.show', row: 0, kind: 'navigation' })}
        onAvatar={() => selectTab('profile')}
      />
      <main className="shell-main">
        {screenKey.local === 'village_home' && bootstrap?.settlement && (
          <button className="vm-btn" onClick={() => setMenuOpen(true)} aria-label={t('village.menu.title')}>
            <Emboss name="menu" palette="gold" size={22} />
          </button>
        )}
        {screenKey.local === 'village_home' && Local ? <Local {...props} />
          : (
            <Screen>
              {Local ? <Local {...props} />
                : Native ? <Native {...props} />
                  : <GenericScreen response={response} loading={loading} onAction={onAction} />}
            </Screen>
          )}
      </main>
      <Dock active={tab} onSelect={selectTab} badge={{ society: unread }} />

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        village={bootstrap?.settlement ? { name: bootstrap.settlement.name, isHead: bootstrap.settlement.is_head, support: supportCity(bootstrap) } : undefined}
        onVillage={(local, args) => { setTab('city'); openLocal(local, args) }}
        onTravel={(city) => { setTab('profile'); run('travel.options', { city }) }}
      />
      <style>{`
        .shell { display: flex; flex-direction: column; height: 100%; }
        .shell-main { position: relative; flex: 1; display: flex; flex-direction: column; min-height: 0; }
        /* the village menu: one small round button on the village view */
        .vm-btn { position: absolute; z-index: 4; right: 10px; bottom: 44px; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(7,10,20,0.55); border: 1.5px solid rgba(255,214,107,0.55); backdrop-filter: blur(3px); }
        .vm-btn:active { transform: translateY(1px); }
      `}</style>
    </div>
  )
}
