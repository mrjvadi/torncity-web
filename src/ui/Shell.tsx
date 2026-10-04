import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { takeResume, saveResume } from '../i18n/resume'
import { Screen } from '../kit'
import GenericScreen from './GenericScreen'
import { cityItemsFor } from '../screens/village/cityItems'
import { pushNativeBack, hasNativeBack } from '../lib/nativeBack'
import { SideCtx, type Side } from '../state/SideContext'
import { useSession } from '../state/SessionContext'
import { seedScreen, useScreen } from '../state/useScreen'
import type { Action } from '../api/types'
import { LOCAL_SCREENS, SERVER_SCREENS } from '../screens/registry'
import { foundingDraftFromLaunch } from '../lib/telegram'
import * as api from '../api/client'
import { t, type Key } from '../i18n'
import { useLive } from '../lib/live'
import { syncStore } from '../state/store'
import { HOME_SCREENS, homeScreen, locationKey } from '../support/location'
import { useToast } from '../state/ToastContext'
import { NavCtx } from '../state/NavContext'
import { useVillage } from '../village/useVillage'
import { useCare, careWord } from '../support/care'
import { ACTIVITY_ENTRIES, ECONOMY_ENTRIES, SOCIETY_ENTRIES } from '../screens/native/kit/hubs'
import type { HubView, ActivitiesHubView } from '../api/views.gen'
import { HudBar, WipColumn, EventsColumn, QuestStrip, PhoneDock, NavRail, DockedPanel, TipHost, type DockTab, type RailSection } from './v6/parts'
import { useDesktop, useHud, usePortrait, useWip, useEvents, useQuest, useTicker } from './v6/hooks'
import { ChromeCtx, type Chrome } from './v6/chrome'
import './v6/v6.css'
import './v6/inner.css'

export type TabKey = 'profile' | 'activity' | 'city' | 'market' | 'society'
const TAB_ORDER: TabKey[] = ['profile', 'activity', 'city', 'market', 'society']

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

const TAB_ICON: Record<TabKey, string> = { profile: 'user', activity: 'tool', city: 'house', market: 'bag', society: 'banner' }
const TAB_LABEL: Record<TabKey, Key> = { profile: 'shell.tab.profile', activity: 'shell.tab.activity', city: 'shell.tab.city', market: 'shell.tab.market', society: 'shell.tab.society' }

/** Screens that fill the area edge to edge (3D views), without the screen frame. */
const FULL_BLEED = new Set(['village_home', 'support_home', 'support_journey', 'village_visit'])

type ScreenKey = { command: string; args?: Record<string, string>; local?: string }

const HUB_TAB: Record<string, TabKey> = { activity_hub: 'activity', economy_hub: 'market', society_hub: 'society' }
/** Which command families belong to which tab. Commands in two places (the village's work page) are left out: they keep the tab. */
const FAMILY_TAB: Record<string, TabKey> = {
  player: 'profile', skills: 'profile', life: 'profile',
  job: 'activity', education: 'activity', health: 'activity', crime: 'activity', mission: 'activity', activities: 'activity',
  market: 'market', bank: 'market', loan: 'market', save: 'market', inventory: 'market', company: 'market', property: 'market', stock: 'market', shop: 'market', auction: 'market', economy: 'market', insure: 'market', gold: 'market',
  faction: 'society', inbox: 'society', social: 'society', election: 'society', gov: 'society', law: 'society', war: 'society', military: 'society', diplomacy: 'society', society: 'society',
  settlement: 'city', place: 'city', city: 'city', map: 'city', travel: 'city',
}
/** The tab a screen belongs to, or null when it belongs to none in particular. */
function tabOfScreen(k: ScreenKey): TabKey | null {
  if (k.local) return HUB_TAB[k.local] ?? 'city'
  if (k.command === 'life.top') return 'activity'
  return FAMILY_TAB[k.command.split('.')[0]] ?? null
}

/** The entries the server lists in a hub for where the player stands, for the desktop rail's sub-items. One read
 * per hub, again when the place changes. The client holds no rule about which exist. */
function useHubEntries(enabled: boolean, placeKey: string) {
  const [hubs, setHubs] = useState<Record<string, { code: string; command: string }[]>>({})
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const one = async (name: string, command: string) => {
      const r = await api.runCommand(command, {}).catch(() => null)
      const v = r && r.ok !== false ? (r.view as unknown as HubView | ActivitiesHubView | undefined) : undefined
      if (cancelled || !v) return
      setHubs((h) => ({ ...h, [name]: (v.entries ?? []).map((e) => ({ code: e.code, command: e.command })) }))
    }
    void one('activity', 'activities.hub'); void one('market', 'economy.hub'); void one('society', 'society.hub')
    return () => { cancelled = true }
  }, [enabled, placeKey])
  return { hubs }
}

function LiveBoundary({ view, onDone, children }: { view: unknown; onDone: () => void; children: () => ReactNode }) {
  useLive(view, onDone)
  return <>{children()}</>
}

export default function Shell() {
  const { profile, unread, exec, bootstrap } = useSession()
  const desktop = useDesktop()
  // a language switch restarts the page: come back to the same screen
  const resumed = useRef(takeResume()).current
  const [tabState, setTab] = useState<TabKey>((resumed?.tab as TabKey | undefined) ?? 'city')
  // The group's «تکمیل اطلاعات روستا» button opens the game with the draft's id
  // as the start parameter: land on the founding form.
  const [screenKey, setScreenKey] = useState<ScreenKey>(() => {
    if (resumed?.screen) return resumed.screen as ScreenKey
    // ?mock=1&open=<command> (&args={"id":"..."}) opens a screen straight, for screenshots of the mock
    const q = new URLSearchParams(location.search)
    if (q.get('mock') === '1' && q.get('open')) {
      try {
        const open = q.get('open')!
        const args = q.get('args') ? JSON.parse(q.get('args')!) : undefined
        // ?open=local:city_panel opens a client-only screen
        return open.startsWith('local:') ? { command: '', local: open.slice(6), args } : { command: open, args }
      } catch { /* a bad hook is ignored */ }
    }
    const draft = foundingDraftFromLaunch()
    if (draft) return { command: '', local: 'founding_form', args: { draft } }
    const h = homeScreen(bootstrap)
    return { command: '', local: h.local, args: h.args }
  })
  // The lit tab follows the screen on show, whichever way it was reached (dock, rail, tile, menu, toast, back, deep link).
  // A screen that belongs to no single tab keeps the last one.
  const tab = tabOfScreen(screenKey) ?? tabState
  useEffect(() => { if (tab !== tabState) setTab(tab) }, [tab, tabState])
  useEffect(() => { saveResume({ tab, screen: screenKey }) }, [tab, screenKey])

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
  // the screens opened on the way, so the header's back returns to the previous one
  const toastApi = useToast()
  useEffect(() => { toastApi.bindOpener((command, args) => run(command, args)); return () => toastApi.bindOpener(null) })
  const [hist, setHist] = useState<ScreenKey[]>([])

  /** The screen a tab opens on. */
  function rootOf(k: TabKey): ScreenKey {
    const hub = TAB_HUB[k]
    if (k === 'city') { const h = homeScreen(bootstrap); return { command: '', local: h.local, args: h.args } }
    if (hub && LOCAL_SCREENS[hub]) return { command: '', local: hub }
    return { command: TAB_COMMAND[k] }
  }
  const sameKey = (a: ScreenKey, b: ScreenKey) => a.command === b.command && (a.local ?? '') === (b.local ?? '') && JSON.stringify(a.args ?? {}) === JSON.stringify(b.args ?? {})
  const atRoot = sameKey(screenKey, rootOf(tab))

  function navigate(next: ScreenKey) {
    if (sameKey(next, screenKey)) { setScreenKey(next); return }
    setHist(sameKey(next, rootOf(tab)) ? [] : (h) => [...h.slice(-19), screenKey])
    setScreenKey(next)
  }

  function goBack() {
    if (hist.length) { setScreenKey(hist[hist.length - 1]); setHist(hist.slice(0, -1)) }
    else selectTab(tab)
  }

  function selectTab(next: TabKey) {
    setHist([])
    setTab(next)
    const hub = TAB_HUB[next]
    if (next === 'city') { const h = homeScreen(bootstrap); setScreenKey({ command: '', local: h.local, args: h.args }) }
    else if (hub && LOCAL_SCREENS[hub]) setScreenKey({ command: '', local: hub })
    else setScreenKey({ command: TAB_COMMAND[next] })
  }

  function run(command: string, args?: Record<string, string>) {
    navigate({ command, args })
  }

  function openLocal(name: string, args?: Record<string, string>) {
    navigate({ command: '', local: name, args })
  }

  // bumped when an action's answer is for the screen already open
  const [again, setAgain] = useState(0)
  async function onAction(a: Action) {
    if (!a.command) return
    const res = await exec(a.command, a.args ?? {})
    if (!res) return
    // the answer is shown as it is: the command is not run a second time to draw its screen
    seedScreen(a.command, a.args, res)
    const next = { command: a.command, args: a.args }
    if (sameKey(next, screenKey)) setAgain((n) => n + 1)
    else navigate(next)
  }

  // -- what is on screen -------------------------------------------------------------------------------
  // A phone shows one screen at a time. A desktop keeps the world (the village or the city) always drawn and docks
  // every other screen beside it, so opening something never throws the world away.
  const nativeBack = hasNativeBack()
  const goBackRef = useRef(goBack); goBackRef.current = goBack
  // Telegram's native BackButton is the one back control on a phone inside Telegram (P18)
  useEffect(() => {
    if (atRoot || !nativeBack) return
    return pushNativeBack(() => goBackRef.current())
  }, [atRoot, nativeBack])
  // the desktop dock offered to the village page: one object's panel (a building's) docks beside the world
  const [side, setSide] = useState<{ title: string; onClose: () => void } | null>(null)
  const [sideEl, setSideEl] = useState<HTMLElement | null>(null)
  const claimSide = useCallback((title: string, onClose: () => void) => {
    const me = { title, onClose }
    setSide(me)
    return () => setSide((cur) => (cur === me ? null : cur))
  }, [])
  const sideApi = useMemo<Side>(() => ({ el: sideEl, desktop, claim: claimSide }), [sideEl, desktop, claimSide])
  const home = homeScreen(bootstrap)
  const homeIsWorld = FULL_BLEED.has(home.local)
  const screenIsWorld = !!screenKey.local && FULL_BLEED.has(screenKey.local)
  const splitWorld = desktop && homeIsWorld
  const worldKey: ScreenKey | null = splitWorld ? (screenIsWorld ? screenKey : { command: '', local: home.local, args: home.args }) : null
  const contentKey: ScreenKey | null = splitWorld && screenIsWorld ? null : screenKey
  const panelOpen = splitWorld && !screenIsWorld
  const sideOpen = desktop && splitWorld && !!side && !panelOpen
  const worldShown = worldKey ?? (screenIsWorld ? screenKey : null)
  const ownVillageHome = !!worldShown && worldShown.local === 'village_home' && !worldShown.args?.id

  const isLocal = !!contentKey?.local
  const { response, loading } = useScreen(contentKey && !isLocal ? contentKey.command : null, contentKey?.args, again)
  const props = { response: isLocal ? null : response, loading, onAction, run, openLocal, localArgs: contentKey?.args }
  const Local = contentKey?.local ? LOCAL_SCREENS[contentKey.local] : undefined
  const Native = contentKey && !isLocal && response?.screen ? SERVER_SCREENS[response.screen] : undefined
  const drawContent = (): ReactNode => !contentKey ? null
    : contentKey.local && FULL_BLEED.has(contentKey.local) && Local ? <Local {...props} />
      : (
        <Screen>
          {Local ? <Local {...props} />
            : Native ? <Native {...props} />
              : <GenericScreen response={response} loading={loading} onAction={onAction} />}
        </Screen>
      )
  // a screen whose view counts a time (remaining / elapsed) is drawn again every second by the shared ticker; when its
  // first countdown ends the view is read once more (and the state-sync store pulled), so it shows the finished state
  const content: ReactNode = <LiveBoundary view={isLocal ? null : response?.view} onDone={() => { void syncStore.pull().catch(() => undefined); if (!isLocal) setAgain((n) => n + 1) }}>{drawContent}</LiveBoundary>
  const WorldLocal = worldKey?.local ? LOCAL_SCREENS[worldKey.local] : undefined
  const world: ReactNode = worldKey && WorldLocal ? <WorldLocal response={null} loading={false} onAction={onAction} run={run} openLocal={openLocal} localArgs={worldKey.args} /> : null

  // -- the shell's own data (all from the state-sync store, the session and the village) --------------------
  const settlementId = bootstrap?.settlement?.id
  const village = useVillage(settlementId)
  const layout = village.layout
  const hud = useHud(profile)
  const portrait = usePortrait(profile?.name ?? '')
  const canBuild = !!layout?.viewer.can_place || !!layout?.viewer.resident
  const wip = useWip(layout, canBuild)
  const events = useEvents()
  const quest = useQuest()
  const ticker = useTicker()

  function openWip(s: { key: string; idle: boolean }) {
    if (s.key === 'shift') run('job.status')
    else if (s.key === 'study') run('education.list')
    else if (layout?.viewer.can_place) openLocal('village_home', { build: '1' })
    else if (s.idle) openLocal('village_home', { land: '1' })
    else openLocal('village_progress')
  }
  const openEvent = (e: { open: { command?: string; local?: string } }) => (e.open.command ? run(e.open.command) : openLocal(e.open.local!))

  // -- the chrome's rectangles, for the 3D view and the ring ----------------------------------------------------
  const els = useRef<{ hud: HTMLElement | null; info: HTMLElement | null; dock: HTMLElement | null; wip: HTMLElement | null; events: HTMLElement | null }>({ hud: null, info: null, dock: null, wip: null, events: null })
  const listeners = useRef(new Set<() => void>())
  const chrome = useMemo<Chrome>(() => ({
    desktop,
    hud: () => els.current.hud?.getBoundingClientRect() ?? null,
    bottom: () => {
      // a strip that is not laid out (zero height, e.g. while it is hidden) is not chrome: its empty rect at the page top
      // once made the 3D view re-frame itself to nothing, which was the «ساخت» jump
      const lay = (r: DOMRect | undefined) => (r && r.height > 0 ? r : undefined)
      const a = lay(els.current.info?.getBoundingClientRect()), d = lay(els.current.dock?.getBoundingClientRect())
      if (a && d) return new DOMRect(d.left, Math.min(a.top, d.top), d.width, d.bottom - Math.min(a.top, d.top))
      return a ?? d ?? null
    },
    sides: () => [els.current.wip, els.current.events].flatMap((e) => (e && e.getBoundingClientRect().width > 0 ? [e.getBoundingClientRect()] : [])),
    subscribe: (cb) => { listeners.current.add(cb); return () => { listeners.current.delete(cb) } },
  }), [desktop])
  const wipCount = wip.length, evCount = events.length, hasQ = !!quest, hasT = !!ticker
  useEffect(() => {
    const fire = () => listeners.current.forEach((cb) => cb())
    const id = requestAnimationFrame(fire)
    window.addEventListener('resize', fire)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', fire) }
  }, [wipCount, evCount, hasQ, hasT, desktop, ownVillageHome])

  // -- desktop: the rail's sections, the keyboard -------------------------------------------------------------------
  const { hubs } = useHubEntries(desktop, `${locKey}|${settlementId ?? ''}`)
  const care = useCare()
  const placeWord = t('shell.tab.city')
  const tabLabel = (k: TabKey) => (k === 'city' ? placeWord : t(TAB_LABEL[k]))

  const sections: RailSection[] = TAB_ORDER.map((k, i) => {
    const items: RailSection['items'] = []
    const hubItems = (table: Record<string, { title: Key }>, name: string, title?: (code: string) => Key | undefined) => {
      for (const e of hubs[name] ?? []) {
        const look = table[e.code]
        if (!look) continue
        items.push({ key: e.code, label: t(title?.(e.code) ?? look.title), on: contentKey?.command === e.command, onClick: () => run(e.command) })
      }
    }
    if (k === 'profile') {
      items.push({ key: 'skills', label: t('profile.skills'), on: contentKey?.command === 'skills.list', onClick: () => run('skills.list') })
      items.push({ key: 'life', label: t('profile.life'), on: contentKey?.command === 'life.me', onClick: () => run('life.me') })
      items.push({ key: 'card', label: t('profile.card'), on: contentKey?.command === 'life.card', onClick: () => run('life.card') })
      items.push({ key: 'settings', label: t('settings.title'), on: contentKey?.command === 'player.settings', onClick: () => run('player.settings') })
    } else if (k === 'activity') {
      hubItems(ACTIVITY_ENTRIES, 'activity', (c) => (c === 'health' && careWord(care) === 'hospital' ? 'hub.hospital' : undefined))
    } else if (k === 'market') {
      hubItems(ECONOMY_ENTRIES, 'market')
    } else if (k === 'society') {
      hubItems(SOCIETY_ENTRIES, 'society')
    } else if (bootstrap?.settlement) {
      const s = bootstrap.settlement
      if (layout?.viewer.can_place && homeIsWorld) items.push({ key: 'build', label: t('v6.rail.build'), onClick: () => openLocal('village_home', { build: '1' }) })
      for (const it of cityItemsFor(s)) {
        const isCmd = !!it.command
        items.push({
          key: it.key, label: t(it.label),
          on: isCmd ? contentKey?.command === it.command : contentKey?.local === it.local && JSON.stringify(contentKey?.args ?? {}) === JSON.stringify(it.args ?? {}),
          onClick: () => (isCmd ? run(it.command!) : openLocal(it.local!, it.args)),
        })
      }
    }
    return { key: k, icon: TAB_ICON[k], label: tabLabel(k), kbd: String(i + 1), items, onSelect: () => selectTab(k) }
  })

  const stateRef = useRef({ panelOpen, canPlace: !!layout?.viewer.can_place, homeIsWorld, sideClose: null as (() => void) | null })
  stateRef.current = { panelOpen, canPlace: !!layout?.viewer.can_place, homeIsWorld, sideClose: sideOpen && side ? side.onClose : null }
  const selectTabRef = useRef(selectTab); selectTabRef.current = selectTab
  const openLocalRef = useRef(openLocal); openLocalRef.current = openLocal
  useEffect(() => {
    if (!desktop) return
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tg = e.target as HTMLElement | null
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return
      const m = /^Digit([1-5])$/.exec(e.code)
      if (m) { selectTabRef.current(TAB_ORDER[+m[1] - 1]); return }
      if (e.code === 'KeyM') { selectTabRef.current('city'); return }
      if (e.code === 'KeyB' && stateRef.current.canPlace && stateRef.current.homeIsWorld) { openLocalRef.current('village_home', { build: '1' }); return }
      // Escape closes the popup first (it handles itself), then the ring (the village view handles that), then the panel
      if (e.key === 'Escape' && !document.querySelector('.v6-scrim, .v6-ring, .pp-overlay')) {
        if (stateRef.current.panelOpen) selectTabRef.current('city')
        else stateRef.current.sideClose?.()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [desktop])

  // the docked panel's breadcrumb: the section, then the open screen's own title (read from its header)
  const panelBody = useRef<HTMLDivElement | null>(null)
  const [screenTitle, setScreenTitle] = useState('')
  const readTitle = useCallback(() => {
    const el = panelBody.current?.querySelector('.cx-hdr-title, .k-ribbon-title')
    setScreenTitle((el?.textContent ?? '').trim())
  }, [])
  useEffect(() => {
    setScreenTitle('')
    const host = panelBody.current
    if (!host || !panelOpen) return
    readTitle()
    const mo = new MutationObserver(readTitle)
    mo.observe(host, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [panelOpen, screenKey, readTitle])

  const tabs: DockTab[] = TAB_ORDER.map((k) => ({ key: k, icon: TAB_ICON[k], label: tabLabel(k), dot: k === 'society' ? unread : 0 }))
  // the place slot again at the world home re-centres the world; a long press opens the city panel; any other slot navigates
  // in ONE tap (nothing is open that could swallow it: the village menu is gone)
  function onDock(k: string) {
    if (k === 'city' && tab === 'city' && atRoot && homeIsWorld && bootstrap?.settlement) { window.dispatchEvent(new Event('tc:recentre')); return }
    selectTab(k as TabKey)
  }
  function onDockLong(k: string) { if (k === 'city' && bootstrap?.settlement) openLocal('city_panel') }

  const showWorldChrome = ownVillageHome
  const kind = worldShown ? 'world' : 'screen'
  const onBank = () => void onAction({ label: '', command: 'bank.show', row: 0, kind: 'navigation' })

  return (
    <NavCtx.Provider value={{ back: atRoot ? null : goBack, hideBack: nativeBack || (desktop && hist.length < 2) }}>
      <SideCtx.Provider value={sideApi}>
      <ChromeCtx.Provider value={chrome}>
        <div className="v6 v6-app" data-panel={panelOpen || sideOpen ? 'open' : 'closed'} data-desk={desktop ? '1' : '0'}>
          <main className="v6-main" data-kind={kind}>
            {splitWorld ? world : content}
          </main>
          {kind === 'world' && !desktop && <><div className="v6-shade-top" /><div className="v6-shade-bot" /></>}

          <HudBar
            hud={hud} name={profile?.name ?? ''} portrait={portrait}
            onAvatar={() => selectTab('profile')} onBank={onBank} innerRef={(e) => { els.current.hud = e }}
          >
            {desktop && showWorldChrome && <EventsColumn events={events} desktop onOpen={openEvent} />}
          </HudBar>

          {showWorldChrome && !desktop && (
            <>
              <WipColumn slots={wip} onOpen={openWip} ownRef={(e) => { els.current.wip = e }} />
              <EventsColumn events={events} desktop={false} onOpen={openEvent} ownRef={(e) => { els.current.events = e }} />
            </>
          )}
          {showWorldChrome && (
            <QuestStrip
              quest={quest} ticker={ticker}
              onQuest={() => { const c = quest?.command ?? 'settlement.development.view'; if (c === 'settlement.development.view') openLocal('city_panel'); else run(c) }} onTicker={() => run('inbox.show')}
              ownRef={(e) => { els.current.info = e }}
            />
          )}

          {!desktop && <PhoneDock tabs={tabs} active={tab} onSelect={onDock} onLong={onDockLong} ownRef={(e) => { els.current.dock = e }} />}

          {desktop && (
            <NavRail sections={sections} active={tab} brand={bootstrap?.settlement?.name ?? t('v6.brand')} sub={profile?.name}>
              {wip.length > 0 && (
                <div className="v6-rail-wip">
                  <h5>{t('v6.wip.title')}</h5>
                  <WipColumn slots={wip} onOpen={openWip} />
                </div>
              )}
            </NavRail>
          )}
          {panelOpen && (
            <DockedPanel
              crumbs={[{ label: tabLabel(tab), onClick: () => selectTab(tab) }, ...(screenTitle && !atRoot ? [{ label: screenTitle }] : [])]}
              onClose={() => selectTab('city')}
            >
              <div ref={panelBody} style={{ display: 'contents' }}>{content}</div>
            </DockedPanel>
          )}

          {sideOpen && side && (
            <DockedPanel crumbs={[{ label: tabLabel('city'), onClick: side.onClose }, { label: side.title }]} onClose={side.onClose}>
              <div ref={setSideEl} className="v6-side-slot" />
            </DockedPanel>
          )}
          <TipHost />
        </div>
      </ChromeCtx.Provider>
      </SideCtx.Provider>
    </NavCtx.Provider>
  )
}
