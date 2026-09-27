import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../api/client'
import type { Bootstrap, CommandResponse, ProfileView } from '../api/types'
import { report } from '../lib/reporter'
import { friendlyError } from '../lib/errors'
import { initTelegram, telegramInitData } from '../lib/telegram'
import { useToast } from './ToastContext'

type Status = 'checking' | 'signed_out' | 'signing_in' | 'signed_in'

interface SessionApi {
  status: Status
  bootstrap: Bootstrap | null
  profile: ProfileView | null
  error: string | null
  inTelegram: boolean
  loginWithCode: (code: string) => Promise<void>
  loginWithTelegram: () => Promise<void>
  signOut: () => void
  refreshProfile: () => Promise<void>
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
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const inTelegram = useRef(!!telegramInitData()).current

  const afterSignedIn = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        api.getBootstrap(),
        api.runCommand('player.profile.get'),
      ])
      setBootstrap(b)
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
    setBootstrap(null)
    setProfile(null)
    setStatus('signed_out')
  }, [])

  // The HUD's numbers follow every answer that carries them (api.onView),
  // and are re-read every minute and whenever the player comes back to the
  // app, so they never disagree with the screen in front of them.
  useEffect(() => {
    const keys = ['name', 'level', 'xp', 'next_level_xp', 'energy', 'max_energy', 'energy_full_in_seconds',
      'health', 'max_health', 'cash', 'bank', 'rank', 'nerve', 'max_nerve', 'nerve_full_in_seconds']
    return api.onView((view) => {
      const patch: Record<string, unknown> = {}
      for (const k of keys) if (view[k] !== undefined && view[k] !== null) patch[k] = view[k]
      if (Object.keys(patch).length > 0) {
        setProfile((p) => (p ? ({ ...p, ...patch } as ProfileView) : p))
      }
    })
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.runCommand('player.profile.get')
      if (p.ok && p.view) setProfile(p.view as unknown as ProfileView)
    } catch {
      // keep the last known profile
    }
  }, [])

  useEffect(() => {
    if (status !== 'signed_in') return
    const tick = window.setInterval(() => { void refreshProfile() }, 60_000)
    const back = () => { if (document.visibilityState === 'visible') void refreshProfile() }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [status, refreshProfile])

  const exec = useCallback(async (command: string, args: Record<string, string> = {}) => {
    try {
      const res = await api.runCommand(command, args, `web-${Date.now().toString(36)}`)
      if (!res.ok && res.error) {
        toast.push(res.error.message)
      } else if (res.notice) {
        toast.push(res.notice.text)
      }
      void refreshProfile()
      return res
    } catch (e) {
      toast.push(friendlyError(e))
      report('command', `${command} failed: ${String(e)}`)
      return null
    }
  }, [refreshProfile, toast])

  return (
    <Ctx.Provider value={{ status, bootstrap, profile, error, inTelegram, loginWithCode, loginWithTelegram, signOut, refreshProfile, exec }}>
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
