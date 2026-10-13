import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './state/SessionContext'
import { ToastProvider } from './state/ToastContext'
import Login from './ui/Login'
import Shell from './ui/Shell'
import NextShell from './next/Shell'
import { screensReady } from './screens/registry'
import { useLang } from './i18n'

/** True once the native/feature screen chunks (registry.ts) have landed.
 * They start fetching at boot, in parallel with login, so this is normally
 * already true by the time it matters; this only guards the rare case of a
 * very slow connection so Shell never renders before SERVER_SCREENS /
 * LOCAL_SCREENS are filled in. */
function useScreensReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    screensReady.then(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])
  return ready
}

/** The new UI (src/next) is opened with ?ui=next and stays on for this device; ?ui=old goes back to the old one. */
function useNextUi(): boolean {
  const [on] = useState(() => {
    const q = new URLSearchParams(location.search).get('ui')
    try {
      if (q === 'next') localStorage.setItem('tc.ui', 'next')
      if (q === 'old') localStorage.removeItem('tc.ui')
      return localStorage.getItem('tc.ui') === 'next'
    } catch {
      return q === 'next'
    }
  })
  return on
}

function Root() {
  const { status } = useSession()
  const screens = useScreensReady()
  const next = useNextUi()
  if (status === 'signed_in') return screens ? (next ? <NextShell /> : <Shell />) : <div className="boot-blank" />
  if (status === 'checking') return <div className="boot-blank" />
  return <Login />
}

export default function App() {
  // A language change remounts the screens (they refetch in the new language)
  const lang = useLang()
  return (
    <ToastProvider>
      <SessionProvider>
        <Root key={lang} />
      </SessionProvider>
    </ToastProvider>
  )
}
