import { useEffect, useRef, useState } from 'react'
import { takeResume, saveResume } from '../i18n/resume'
import Hud from './Hud'
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
import { HOME_SCREENS, homeScreen, locationKey } from '../support/location'

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

/** Screens that fill the area edge to edge (3D views), without the screen frame. */
const FULL_BLEED = new Set(['village_home', 'support_home', 'support_journey', 'village_visit'])

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
    const h = homeScreen(bootstrap)
    return { command: '', local: h.local, args: h.args }
  })
  useEffect(() => { saveResume({ tab, screen: screenKey }) }, [tab, screenKey])
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

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

  // Where the player is (Support, a village, on the road) decides what the
  // village tab shows: when it changes under a home screen, follow it.
  const locKey = locationKey(bootstrap)
  useEffect(() => {
    if (!locKey || tab !== 'city' || !screenKey.local || !HOME_SCREENS.has(screenKey.local)) return
    const h = homeScreen(bootstrap)
    if (h.local !== screenKey.local || h.args?.id !== screenKey.args?.id) setScreenKey({ command: '', local: h.local, args: h.args })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey])

  function selectTab(next: TabKey) {
    setTab(next)
    const hub = TAB_HUB[next]
    if (next === 'city') { const h = homeScreen(bootstrap); setScreenKey({ command: '', local: h.local, args: h.args }) }
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
        unread={unread}
        onBank={() => onAction({ label: '', command: 'bank.show', row: 0, kind: 'navigation' })}
        onBell={() => setBellOpen(true)}
        onMenu={() => setMenuOpen(true)}
        onAvatar={() => selectTab('profile')}
      />
      <main className="shell-main">
        {screenKey.local && FULL_BLEED.has(screenKey.local) && Local ? <Local {...props} />
          : (
            <Screen>
              {Local ? <Local {...props} />
                : Native ? <Native {...props} />
                  : <GenericScreen response={response} loading={loading} onAction={onAction} />}
            </Screen>
          )}
      </main>
      <Dock active={tab} onSelect={selectTab} />

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPick={(command) => { setTab('profile'); setScreenKey({ command }) }}
        village={bootstrap?.settlement ? { name: bootstrap.settlement.name, isHead: bootstrap.settlement.is_head, support: supportCity(bootstrap) } : undefined}
        onVillage={(local, args) => { setTab('city'); openLocal(local, args) }}
        onTravel={() => { setTab('city'); openLocal('support_travel') }}
        onSignOut={signOut}
      />
      <BottomSheet open={bellOpen} onClose={() => setBellOpen(false)} title={t('shell.bell')}>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '12px 0' }}>{t('shell.bell_empty')}</p>
      </BottomSheet>

      <style>{`
        .shell { display: flex; flex-direction: column; height: 100%; }
        .shell-main { flex: 1; display: flex; flex-direction: column; min-height: 0; }
      `}</style>
    </div>
  )
}
