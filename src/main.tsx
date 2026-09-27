import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { installGlobalReporter, report } from './lib/reporter'

installGlobalReporter()

const params = new URLSearchParams(location.search)
async function boot() {
  if (params.get('mock') === '1') {
    const { installMockApi } = await import('./api/mock')
    installMockApi()
  }

  // Load the Telegram WebApp script same-origin, never from telegram.org —
  // it is filtered in Iran and a synchronous load from there would freeze
  // the page. Safe to skip outside Telegram.
  await new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.src = '/telegram-web-app.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
    setTimeout(resolve, 1200)
  })

  report('boot', 'main mounted')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
