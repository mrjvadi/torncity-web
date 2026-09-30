import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './state/SessionContext'
import { ToastProvider } from './state/ToastContext'
import Login from './ui/Login'
import Shell from './ui/Shell'
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

function Root() {
  const { status } = useSession()
  const screens = useScreensReady()
  if (status === 'signed_in') return screens ? <Shell /> : <div className="boot-blank" />
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
