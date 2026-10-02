import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { adoptServerLanguage } from '../i18n/sync'
import { noticeText, refusalText } from '../i18n'
import * as api from '../api/client'
import type { Bootstrap, CommandResponse, ProfileView, RealtimeVitals } from '../api/types'
import type { RealtimeHandle, RealtimeNotice } from '../api/realtime'
import { genericLine, noticeLine, type Namer } from '../notices/wording'
import { contentName, loadContent } from '../village/useVillage'
import { report } from '../lib/reporter'
import { friendlyError } from '../lib/errors'
import { initTelegram, telegramInitData } from '../lib/telegram'
import { useToast, type ToastApi } from './ToastContext'
import { setServerTime } from '../village/clock'
import { syncStore } from './store'
import { useStoreFigures } from './useSync'
import { idbPersistence, persistenceEnabled } from './persist'

type Status = 'checking' | 'signed_out' | 'signing_in' | 'signed_in'

// The fields a "vitals" publication and a command's own view agree on
// naming exactly the same way (client-api.md §3 and §5.3), so one patch
// function serves both sources.
const VITALS_KEYS = [
  'name', 'level', 'xp', 'next_level_xp', 'energy', 'max_energy', 'energy_full_in_seconds',
  'health', 'max_health', 'cash', 'bank', 'rank', 'nerve', 'max_nerve', 'nerve_full_in_seconds',
] as const

// Which of those a command's view may set, by the screen it answers with.
// Only screens whose view is the player's OWN numbers qualify: the same key
// names mean something else elsewhere (a crime result's `level` is the
// level reached, 0 if none; a faction's `bank` is the faction's treasury; a
// card's `name` is another player's).
const VIEW_VITALS: Record<string, readonly string[]> = {
  profile: VITALS_KEYS,
  dashboard: VITALS_KEYS,
  bank: ['cash', 'bank'],
  job_status: ['energy', 'max_energy', 'energy_full_in_seconds'],
  hospital: ['health', 'max_health'],
}

interface SessionApi {
  status: Status
  bootstrap: Bootstrap | null
  profile: ProfileView | null
  /** Unread notices (client-api.md §5.3's "inbox", and every "vitals"
   * snapshot): kept here so whoever wires the bell badge has one source,
   * live over the socket when it is up and no staler than the last poll
   * otherwise. */
  unread: number
  error: string | null
  inTelegram: boolean
  loginWithCode: (code: string) => Promise<void>
  loginWithTelegram: () => Promise<void>
  signOut: () => void
  refreshProfile: () => Promise<void>
  /** Reads the bootstrap again (the player's settlement appears after founding). */
  refreshBootstrap: () => Promise<void>
  /** The store (state/store.ts) is the source of the player's numbers: the
   * server serves state sync (bootstrap.features.updates). */
  synced: boolean
  exec: (command: string, args?: Record<string, string>) => Promise<CommandResponse | null>
}

const Ctx = createContext<SessionApi | null>(null)

export function useSession(): SessionApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside provider')
  return v
}

/** The session when there is one (a screen drawn outside the shell has none). */
export function useSessionOptional(): SessionApi | null {
  return useContext(Ctx)
}

/** A notice pushed by the server, shown as a toast: worded by this client from the notice's code and
 * facts, its colour from the code, and a tap opens where the notice points. */
async function showNoticeWith(n: RealtimeNotice, push: ToastApi['push']): Promise<void> {
  const entries = await loadContent().catch(() => ({} as Awaited<ReturnType<typeof loadContent>>))
  const names: Namer = (tables, code, authored) => contentName(entries, tables, code, authored)
  const line = (n.screen && n.view ? noticeLine(n.screen, n.view, names) : null) ?? genericLine()
  const go = n.actions?.[0]
  const args = go?.args ? Object.fromEntries(Object.entries(go.args).map(([k, v]) => [k, String(v)])) : undefined
  push(line.text, {
    kind: line.tone,
    key: n.id ? `notice|${n.id}` : `notice|${n.kind}|${n.screen ?? ''}|${JSON.stringify(n.view ?? null)}`,
    command: go?.command ?? (n.screen ? undefined : 'inbox.show'),
    args,
  })
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Whether the realtime socket is actually connected right now: only used
  // to lengthen the HTTP poll below, never to gate anything correctness
  // depends on (a client without it must work exactly as before this
  // feature).
  const [live, setLive] = useState(false)
  const [synced, setSynced] = useState(false)
  const realtimeRef = useRef<RealtimeHandle | null>(null)
  const toast = useToast()
  const showNotice = useCallback((n: RealtimeNotice) => showNoticeWith(n, toast.push), [toast.push])
  // mock mode only: lets the checks and screenshots push any notice the server could (window.__notice('payment_notice'))
  useEffect(() => {
    if (new URLSearchParams(location.search).get('mock') !== '1') return
    ;(window as unknown as { __notice?: unknown }).__notice = (screen: string) => {
      void import('../api/mock_notices').then((m) => {
        const x = m.mockNotice(screen)
        if (x) void showNotice({ kind: x.kind, screen: x.screen, view: x.view, actions: [] })
      })
    }
  }, [showNotice])
  const inTelegram = useRef(!!telegramInitData()).current

  // state sync: subscribe (the realtime effect below), read the snapshot,
  // apply what arrived meanwhile (store.ts). In mock mode the mock server's
  // stream stands in for the socket.
  const startSync = useCallback((playerId: string) => {
    setSynced(true)
    const mock = new URLSearchParams(location.search).get('mock') === '1'
    void syncStore.start(playerId, { getState: api.getState, getUpdates: api.getUpdates },
      persistenceEnabled() ? idbPersistence : null).then(() => {
      if (mock) void import('../api/mock_sync').then((m) => m.attachMockSocket())
    }).catch((e) => report('sync', 'state sync failed to start: ' + String(e)))
  }, [])

  const afterSignedIn = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        api.getBootstrap(),
        api.runCommand('player.profile.get'),
      ])
      // the server's language wins, so the bot and the web agree
      await adoptServerLanguage(b.player?.lang)
      setBootstrap(b)
      setServerTime(b.server_time)
      if (p.ok && p.view) setProfile(p.view as unknown as ProfileView)
      if (b.features?.updates && b.player?.id) startSync(b.player.id)
      setStatus('signed_in')
      report('boot', 'signed in and bootstrapped')
    } catch (e) {
      report('boot', 'bootstrap failed: ' + String(e))
      setError(friendlyError(e))
      setStatus('signed_out')
    }
  }, [startSync])

  useEffect(() => {
    initTelegram()
    if (api.isLoggedIn()) {
      void afterSignedIn()
    } else if (inTelegram) {
      setStatus('signed_out')
      void loginWithTelegram()
    } else {
      setStatus('signed_out')
    }
    report('boot', 'app started')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loginWithCode = useCallback(async (code: string) => {
    setStatus('signing_in')
    setError(null)
    try {
      await api.loginWithLinkCode(code, deviceName())
      await afterSignedIn()
    } catch (e) {
      setStatus('signed_out')
      setError(friendlyError(e))
      throw e
    }
  }, [afterSignedIn])

  const loginWithTelegram = useCallback(async () => {
    const initData = telegramInitData()
    if (!initData) return
    setStatus('signing_in')
    setError(null)
    try {
      await api.loginWithTelegram(initData, 'Telegram')
      await afterSignedIn()
    } catch (e) {
      setStatus('signed_out')
      setError(friendlyError(e))
    }
  }, [afterSignedIn])

  const signOut = useCallback(() => {
    syncStore.forget()
    setSynced(false)
    void api.logout()
    realtimeRef.current?.disconnect()
    realtimeRef.current = null
    setLive(false)
    setBootstrap(null)
    setProfile(null)
    setUnread(0)
    setStatus('signed_out')
  }, [])

  // The HUD's numbers follow every answer that carries them (api.onView),
  // and are re-read every minute and whenever the player comes back to the
  // app, so they never disagree with the screen in front of them.
  useEffect(() => {
    return api.onView((view, screen) => {
      const keys = VIEW_VITALS[screen]
      if (!keys) return
      const patch: Record<string, unknown> = {}
      for (const k of keys) if (view[k] !== undefined && view[k] !== null) patch[k] = view[k]
      // a screen that carries no energy (an unemployed job status) sends 0 of 0: that is not the player's energy
      if (patch.max_energy === 0) { delete patch.max_energy; delete patch.energy; delete patch.energy_full_in_seconds }
      if (Object.keys(patch).length > 0) {
        setProfile((p) => (p ? ({ ...p, ...patch } as ProfileView) : p))
      }
    })
  }, [])

  // The same numbers also follow the realtime channel (client-api.md §5.3),
  // when the server says it is available and the socket manages to connect
  // — from ANY source, not only this tab's own commands: a Telegram action,
  // another device, energy regen. Connected lazily (api/realtime.ts is a
  // dynamic import) only once signed in, and torn down on sign-out or
  // unmount. A failure anywhere in this path is silent: the poll below
  // never stops being the fallback.
  useEffect(() => {
    if (status !== 'signed_in' || !bootstrap?.realtime) return
    let cancelled = false
    void (async () => {
      const { connectRealtime } = await import('../api/realtime')
      const viaStore = !!bootstrap?.features?.updates
      const handle = await connectRealtime(
        (v: RealtimeVitals) => {
          setProfile((p) => (p ? {
            ...p,
            cash: v.cash, bank: v.bank, energy: v.energy, max_energy: v.max_energy,
            health: v.health, max_health: v.max_health, xp: v.xp, level: v.level,
          } : p))
          setUnread(v.unread)
        },
        (u: number) => setUnread(u),
        (isLive: boolean) => setLive(isLive),
        // with state sync a notice toasts from the store, once per id; the
        // legacy publication (no id) would show it a second time
        viaStore ? undefined : (n) => { void showNotice(n) },
      )
      if (cancelled) {
        handle?.disconnect()
        return
      }
      realtimeRef.current = handle
    })()
    return () => {
      cancelled = true
      realtimeRef.current?.disconnect()
      realtimeRef.current = null
      setLive(false)
    }
  }, [status, bootstrap?.realtime, bootstrap?.features?.updates])

  // state sync: the store's instant notices toast here, each once
  useEffect(() => {
    if (!synced) return
    return syncStore.onNotice(({ id, data }) => {
      void showNotice({ kind: data.kind, screen: data.screen || undefined, view: data.view ?? undefined, actions: [], id })
    })
  }, [synced, showNotice])

  // Presence (client-api.md section 5.5): a player counts as online for
  // `ttl_seconds` after any signed-in call, so while the app is open but idle
  // the heartbeat is sent every half of that. Paused while the tab is hidden.
  useEffect(() => {
    if (status !== 'signed_in') return
    let stopped = false
    let timer = 0
    let ttl = 30
    const beat = async () => {
      if (stopped) return
      if (!document.hidden) {
        try {
          const r = await api.heartbeat()
          if (r && typeof r.ttl_seconds === 'number' && r.ttl_seconds > 0) ttl = r.ttl_seconds
        } catch {
          // best effort: the next call of any kind counts as well
        }
      }
      if (!stopped) timer = window.setTimeout(() => void beat(), Math.max(5, ttl / 2) * 1000)
    }
    void beat()
    const back = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void beat() } }
    document.addEventListener('visibilitychange', back)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [status])

  const refreshBootstrap = useCallback(async () => {
    try {
      setBootstrap(await api.getBootstrap())
    } catch {
      // keep the last bootstrap
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.runCommand('player.profile.get')
      if (p.ok && p.view) setProfile(p.view as unknown as ProfileView)
    } catch {
      // keep the last known profile
    }
  }, [])

  // The poll: every 60s normally, the fallback and the only source when the
  // socket cannot connect at all; stretched to 3 minutes while the socket
  // is actually live, since it is then telling us the same numbers sooner.
  useEffect(() => {
    if (status !== 'signed_in') return
    const interval = live ? 180_000 : 60_000
    const tick = window.setInterval(() => { void refreshProfile() }, interval)
    const back = () => { if (document.visibilityState === 'visible') void refreshProfile() }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [status, refreshProfile, live])

  const exec = useCallback(async (command: string, args: Record<string, string> = {}) => {
    try {
      const res = await api.runCommand(command, args, `web-${Date.now().toString(36)}`)
      // only the answer to a command the player just ran is toasted here;
      // background refreshes (refreshProfile, screens' own fetches) never are
      if (!res.ok && res.error) {
        toast.push(refusalText(res.error.code, res.error.message, res.error.args), { kind: 'error', user: true })
      } else if (res.notice) {
        const text = noticeText(res.notice)
        if (text) toast.push(text, { kind: res.notice.alert ? 'warning' : 'success', user: true })
      }
      void refreshProfile()
      return res
    } catch (e) {
      toast.push(friendlyError(e), { kind: 'error', user: true })
      report('command', `${command} failed: ${String(e)}`)
      return null
    }
  }, [refreshProfile, toast])

  // With state sync the HUD's and the profile's numbers are the store's (the
  // command's own view still carries what the store does not: the city's
  // name, the needs, the work); the poll stays as the fallback (ADR 0034,
  // P4 removes it).
  const figures = useStoreFigures(synced ? bootstrap?.player?.id : undefined)
  const shownProfile = useMemo(() => mergeFigures(profile, figures), [profile, figures])
  const shownUnread = figures ? figures.unread : unread

  return (
    <Ctx.Provider value={{ status, bootstrap, profile: shownProfile, unread: shownUnread, error, inTelegram, loginWithCode, loginWithTelegram, signOut, refreshProfile, refreshBootstrap, exec, synced }}>
      {children}
    </Ctx.Provider>
  )
}

/** The command's profile view with the store's figures laid over it, key
 * for key; the rank keeps the view's authored name when the code agrees. */
function mergeFigures(profile: ProfileView | null, f: ReturnType<typeof useStoreFigures>): ProfileView | null {
  if (!f) return profile
  const base = (profile ?? { code: '', city_code: '', city: '', travelling: false }) as ProfileView
  const rank = f.rank && base.rank?.code === f.rank.code ? base.rank : (f.rank ?? base.rank)
  return {
    ...base, name: f.name || base.name, level: f.level, xp: f.xp, next_level_xp: f.next_level_xp, rank,
    energy: f.energy, max_energy: f.max_energy, energy_full_in_seconds: f.energy_full_in_seconds,
    health: f.health, max_health: f.max_health, nerve: f.nerve, max_nerve: f.max_nerve,
    nerve_full_in_seconds: f.nerve_full_in_seconds, cash: f.cash, bank: f.bank, pending_money: f.pending_money,
  } as ProfileView
}

function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone Web'
  if (/Android/.test(ua)) return 'Android Web'
  return 'Web'
}
