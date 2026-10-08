// A small page-side reporter: sends window errors, unhandled rejections,
// webglcontextlost and boot milestones to the server as a beacon so the
// owner can see what broke on a phone we can't attach a debugger to.

const ENDPOINT = 'https://apimmo.ir404.site/api/v1/client-log'
const SESSION = cryptoRandomId()

function cryptoRandomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

// only the real site reports: a local preview or a mock-mode check would fill the live log with test runs
const SILENT = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  || new URLSearchParams(location.search).get('mock') === '1'

export function report(kind: string, message: string, extra?: Record<string, unknown>): void {
  if (new URLSearchParams(location.search).get('mock') === '1') console.warn('[report]', kind, message)
  if (SILENT) return
  try {
    const body = JSON.stringify({
      kind,
      message: extra ? `${message} ${JSON.stringify(extra)}` : message,
      agent: navigator.userAgent,
      // never the #fragment: inside Telegram it carries the signed launch data, which must not reach a log
      page: location.origin + location.pathname + location.search,
      session: SESSION,
    })
    const blob = new Blob([body], { type: 'text/plain' })
    if (!navigator.sendBeacon(ENDPOINT, blob)) {
      fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  } catch {
    // never let the reporter itself throw
  }
}

export function installGlobalReporter(): void {
  window.addEventListener('error', (e) => {
    report('window_error', e.message || 'error', {
      src: e.filename,
      line: e.lineno,
      col: e.colno,
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    report('unhandled_rejection', message)
  })
}
