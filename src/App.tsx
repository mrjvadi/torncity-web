import { SessionProvider, useSession } from './state/SessionContext'
import { ToastProvider } from './state/ToastContext'
import Login from './ui/Login'
import Shell from './ui/Shell'

function Root() {
  const { status } = useSession()
  if (status === 'signed_in') return <Shell />
  if (status === 'checking') return <div className="boot-blank" />
  return <Login />
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </ToastProvider>
  )
}
