import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/i18n.css'
import './styles/shell-fix.css'
import { installGlobalReporter, report } from './lib/reporter'
import { watchForNewBuild } from './lib/freshness'

installGlobalReporter()

const params = new URLSearchParams(location.search)
async function boot() {
  // The mock API chunk and the Telegram WebApp script are independent —
  // fetch them together instead of one after the other, so a slow
  // connection pays for the slower of the two, not both.
  const mockReady = params.get('mock') === '1'
    ? import('./api/mock').then(({ installMockApi }) => installMockApi())
    : Promise.resolve()

  // Load the Telegram WebApp script same-origin, never from telegram.org —
  // it is filtered in Iran and a synchronous load from there would freeze
  // the page. Safe to skip outside Telegram. index.html preloads this same
  // URL as early as the HTML parser sees it, so by the time this script tag
  // is created the fetch is often already done.
  const telegramReady = new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.src = '/telegram-web-app.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
    setTimeout(resolve, 1200)
  })

  await Promise.all([mockReady, telegramReady])

  report('boot', 'main mounted')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  if (params.get('mock') !== '1') watchForNewBuild()
}

void boot()
