// The new UI's shell (2026-10, written from scratch). Five tabs, a history inside each, Telegram's BackButton as the
// one way back, one place that runs server actions (asking first for danger and for input values), and the chrome:
// the HUD always, my work / events / the quest card over the world, the floating dock.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Action, CommandResponse } from '../api/types'
import { useSession } from '../state/SessionContext'
import { seedScreen, useScreen } from '../state/useScreen'
import { syncStore } from '../state/store'
import { useLive } from '../lib/live'
import { pushNativeBack, hasNativeBack } from '../lib/nativeBack'
import { getTelegramWebApp } from '../lib/telegram'
import { useVillage } from '../village/useVillage'
import { useEvents, useHud, usePortrait, useQuest, useTicker, useWip, type EventSlot, type WipSlot } from '../ui/v6/hooks'
import { actionLabel } from '../screens/village/wording'
import { t } from '../i18n'
import { NavCtx, TAB_ROOT, sameRoute, tabOf, type Nav, type Route, type Tab } from './nav'
import { LOCAL, SERVER } from './registry'
import { Dock, EventRail, Hud, QuestCard, WorkRail } from './chrome'
import { Button, Buttons, Confirm, Empty, Loading, Page, Sheet } from './ui'
import Generic from './screens/Generic'
import './next.css'
import './shell.css'

const DOCK_LABEL: Record<Tab, string> = {
  me: 'shell.tab.profile', activity: 'shell.tab.activity', city: 'shell.tab.city', economy: 'shell.tab.market', society: 'shell.tab.society',
}

/** One screen: a client-only screen by name, or a command's answer drawn by its screen (the generic one when the
 * area has none yet). A view that counts a time is read again when its first countdown ends. */
function ScreenHost({ route, again, onDone }: { route: Route; again: number; onDone: () => void }) {
  const { response, loading } = useScreen(route.local ? null : route.cmd ?? null, route.args, again)
  useLive(route.local ? null : response?.view, onDone)
  if (route.local) {
    const L = LOCAL[route.local]
    return L ? <L response={null} loading={false} args={route.args} /> : <Page title={t('common.soon_title')}><Empty icon="x_sparkles">{t('common.soon')}</Empty></Page>
  }
  if (!response) return <Page title="">{loading ? <Loading /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>
  const S = response.screen ? SERVER[response.screen] : undefined
  return S ? <S response={response} loading={loading} args={route.args} /> : <Generic response={response} loading={loading} args={route.args} />
}

export default function NextShell() {
  const { profile, unread, exec, bootstrap } = useSession()

  // -- navigation ------------------------------------------------------------------------------------------
  // ?mock=1&open=<command> (&args={"id":"..."}) or open=local:<name> opens a screen straight, for checks and screenshots
  const [first] = useState<Route>(() => {
    const q = new URLSearchParams(location.search)
    const open = q.get('mock') === '1' ? q.get('open') : null
    if (!open) return TAB_ROOT.city
    try {
      const args = q.get('args') ? JSON.parse(q.get('args')!) as Record<string, string> : undefined
      return open.startsWith('local:') ? { local: open.slice(6), args } : { cmd: open, args }
    } catch { return TAB_ROOT.city }
  })
  const [tab, setTab] = useState<Tab>(() => tabOf(first) ?? 'city')
  const [route, setRoute] = useState<Route>(first)
  const [hist, setHist] = useState<Route[]>([])
  const [again, setAgain] = useState(0)
  const atRoot = sameRoute(route, TAB_ROOT[tab])

  const go = useCallback((next: Route) => {
    const nt = tabOf(next) ?? tab
    if (nt !== tab) { setTab(nt); setHist(sameRoute(next, TAB_ROOT[nt]) ? [] : [TAB_ROOT[nt]]); setRoute(next); return }
    if (sameRoute(next, route)) { setAgain((n) => n + 1); return }
    setHist((h) => (sameRoute(next, TAB_ROOT[tab]) ? [] : [...h.slice(-19), route]))
    setRoute(next)
  }, [tab, route])
  const back = useCallback(() => {
    if (hist.length) { setRoute(hist[hist.length - 1]); setHist(hist.slice(0, -1)) }
    else setRoute(TAB_ROOT[tab])
  }, [hist, tab])
  const selectTab = useCallback((k: Tab) => {
    if (k === tab && atRoot) { if (k === 'city') window.dispatchEvent(new Event('tc:recentre')); return }
    setTab(k); setHist([]); setRoute(TAB_ROOT[k])
  }, [tab, atRoot])

  // Telegram's BackButton is the one way back inside Telegram
  const backRef = useRef(back); backRef.current = back
  useEffect(() => {
    if (atRoot || !hasNativeBack()) return
    return pushNativeBack(() => backRef.current())
  }, [atRoot])

  // -- running a server action -----------------------------------------------------------------------------
  const [ask, setAsk] = useState<{ a: Action; kind: 'confirm' | 'input' } | null>(null)
  const [value, setValue] = useState('')
  const runAction = useCallback(async (a: Action, extra?: Record<string, string>) => {
    if (!a.command) return
    const args = { ...(a.args ?? {}), ...(extra ?? {}) }
    const res: CommandResponse | null = await exec(a.command, args)
    if (!res) return
    seedScreen(a.command, args, res)
    go({ cmd: a.command, args })
  }, [exec, go])
  const act = useCallback((a: Action) => {
    if (a.url) { const wa = getTelegramWebApp(); if (wa?.openLink) wa.openLink(a.url); else window.open(a.url, '_blank', 'noopener'); return }
    if (a.kind === 'back') { back(); return }
    if (a.input) { setValue(''); setAsk({ a, kind: 'input' }); return }
    if (a.kind === 'danger' || a.kind === 'confirm') { setAsk({ a, kind: 'confirm' }); return }
    void runAction(a)
  }, [back, runAction])

  const nav = useMemo<Nav>(() => ({
    tab, route, atRoot,
    run: (cmd, args) => go({ cmd, args }),
    open: (local, args) => go({ local, args }),
    back, selectTab, act,
    reload: () => setAgain((n) => n + 1),
  }), [tab, route, atRoot, go, back, selectTab, act])

  // -- the chrome's data -------------------------------------------------------------------------------------
  const village = useVillage(bootstrap?.settlement?.id)
  const layout = village.layout
  const hud = useHud(profile)
  const portrait = usePortrait(profile?.name ?? '')
  const wip = useWip(layout, !!layout?.viewer.can_place || !!layout?.viewer.resident)
  const events = useEvents()
  const quest = useQuest()
  const news = useTicker()
  const inWorld = route.local === 'game'

  const openWork = (s: WipSlot) => {
    if (s.key === 'shift') nav.run('job.status')
    else if (s.key === 'study') nav.run('education.list')
    else nav.open('city_panel')
  }
  const openEvent = (e: EventSlot) => (e.open.command ? nav.run(e.open.command) : nav.open(e.open.local ?? 'city_panel'))
  const labels = useMemo(() => Object.fromEntries(Object.entries(DOCK_LABEL).map(([k, v]) => [k, t(v as 'shell.tab.city')])) as Record<Tab, string>, [])

  return (
    <NavCtx.Provider value={nav}>
      <div className="n-app">
        <ScreenHost key={`${route.cmd ?? ''}|${route.local ?? ''}|${JSON.stringify(route.args ?? {})}`} route={route} again={again}
          onDone={() => { void syncStore.pull().catch(() => undefined); setAgain((n) => n + 1) }} />

        <Hud hud={hud} name={profile?.name ?? ''} portrait={portrait} onFace={() => selectTab('me')} onPurse={() => nav.run('bank.show')} onGem={() => nav.run('bank.show')} />

        {inWorld && (
          <>
            <WorkRail slots={wip} onOpen={openWork} />
            <EventRail events={events} onOpen={openEvent} />
            <QuestCard quest={quest} news={news}
              onQuest={() => { const c = quest?.command ?? 'settlement.development.view'; if (c === 'settlement.development.view') nav.open('city_panel'); else nav.run(c) }}
              onNews={() => nav.run('inbox.show')} />
          </>
        )}

        <Dock active={tab} labels={labels} unread={unread} onSelect={selectTab} onLong={(k) => { if (k === 'city' && bootstrap?.settlement) nav.open('city_panel') }} />

        {ask?.kind === 'confirm' && (
          <Confirm title={actionLabel(ask.a)} icon="x_wanted" danger={ask.a.kind === 'danger'} confirm={t('common.confirm')}
            onConfirm={() => { const a = ask.a; setAsk(null); void runAction(a) }} onClose={() => setAsk(null)}>
            <p className="n-text">{t('common.sure')}</p>
          </Confirm>
        )}
        {ask?.kind === 'input' && ask.a.input && (
          <Sheet title={actionLabel(ask.a)} onClose={() => setAsk(null)}>
            <label className="n-field">
              <span>{actionLabel(ask.a)}</span>
              {ask.a.input.text
                ? <textarea className="n-input" rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
                : <input className="n-input" inputMode="numeric" dir="ltr" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d۰-۹]/g, ''))} />}
            </label>
            <Buttons lead>
              <Button disabled={!value.trim()} onClick={() => { const a = ask.a; const field = a.input!.field; setAsk(null); void runAction(a, { [field]: value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) }) }}>{t('common.confirm')}</Button>
              <Button kind="ghost" onClick={() => setAsk(null)}>{t('common.cancel')}</Button>
            </Buttons>
          </Sheet>
        )}
      </div>
    </NavCtx.Provider>
  )
}
