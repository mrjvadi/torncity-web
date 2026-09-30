import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { adoptServerLanguage } from '../i18n/sync'
import * as api from '../api/client'
import type { Bootstrap, CommandResponse, ProfileView, RealtimeVitals } from '../api/types'
import type { RealtimeHandle } from '../api/realtime'
import { report } from '../lib/reporter'
import { friendlyError } from '../lib/errors'
import { initTelegram, telegramInitData } from '../lib/telegram'
import { useToast } from './ToastContext'
import { setServerTime } from '../village/clock'

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
  exec: (command: string, args?: Record<string, string>) => Promise<CommandResponse | null>
}

const Ctx = createContext<SessionApi | null>(null)

export function useSession(): SessionApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside provider')
  return v
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
  const realtimeRef = useRef<RealtimeHandle | null>(null)
  const toast = useToast()
  const inTelegram = useRef(!!telegramInitData()).current

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
      setStatus('signed_in')
      report('boot', 'signed in and bootstrapped')
    } catch (e) {
      report('boot', 'bootstrap failed: ' + String(e))
      setError(friendlyError(e))
      setStatus('signed_out')
    }
  }, [])

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
  }, [status, bootstrap?.realtime])

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
        toast.push(res.error.message, { kind: 'error', user: true })
      } else if (res.notice) {
        toast.push(res.notice.text, { kind: res.notice.alert ? 'warning' : undefined, user: true })
      }
      void refreshProfile()
      return res
    } catch (e) {
      toast.push(friendlyError(e), { kind: 'error', user: true })
      report('command', `${command} failed: ${String(e)}`)
      return null
    }
  }, [refreshProfile, toast])

  return (
    <Ctx.Provider value={{ status, bootstrap, profile, unread, error, inTelegram, loginWithCode, loginWithTelegram, signOut, refreshProfile, refreshBootstrap, exec }}>
      {children}
    </Ctx.Provider>
  )
}

function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone Web'
  if (/Android/.test(ua)) return 'Android Web'
  return 'Web'
}
