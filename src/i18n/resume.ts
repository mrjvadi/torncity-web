// Remembers the open screen across the restart a language switch causes.
// The shell saves its screen as it changes; changeLanguage() marks the next
// load as a resume, and the shell reads it back once.

const KEY = 'tc.resume'
const FLAG = 'tc.resume.now'

export function saveResume(v: { tab: string; screen: unknown }): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)) } catch { /* no storage: start on the home view */ }
}

export function markResume(): void {
  try { sessionStorage.setItem(FLAG, '1') } catch { /* ignore */ }
}

export function takeResume(): { tab?: string; screen?: unknown } | null {
  try {
    if (sessionStorage.getItem(FLAG) !== '1') return null
    sessionStorage.removeItem(FLAG)
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
