import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from '../api/client'
import type { Bootstrap, CommandResponse, ProfileView } from '../api/types'
import { report } from '../lib/reporter'
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
      setError(e instanceof Error ? e.message : String(e))
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
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
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
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [afterSignedIn])

  const signOut = useCallback(() => {
    void api.logout()
    setBootstrap(null)
    setProfile(null)
    setStatus('signed_out')
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.runCommand('player.profile.get')
      if (p.ok && p.view) setProfile(p.view as unknown as ProfileView)
    } catch {
      // keep the last known profile
    }
  }, [])

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
      toast.push(e instanceof Error ? e.message : 'خطای شبکه')
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
