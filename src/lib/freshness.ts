// Telegram's in-app browser (on iOS above all) may keep showing a page it
// loaded earlier even though the server answers index.html with no-cache.
// So the app checks for itself: it fetches the current index.html past every
// cache, reads which entry script it names, and if that is not the script
// running now, reloads onto the new build. The URL's hash (Telegram's launch
// data) is kept; a guard stops a reload loop if a cache keeps lying.

/** The commit this build is made from (debug detail). */
export const BUILD_ID: string = __BUILD_ID__
/** The version players see: 1.2.<n>, n grows with every commit. */
export const APP_VERSION: string = __APP_VERSION__

const GUARD = 'tc-fresh-reload'
const ENTRY = /assets\/index-[\w-]+\.js/

function runningEntry(): string | null {
  for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    const m = s.src.match(ENTRY)
    if (m) return m[0]
  }
  return null
}

export async function reloadIfStale(): Promise<void> {
  const running = runningEntry()
  if (!running) return
  let html: string
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?fresh=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    html = await res.text()
  } catch {
    return
  }
  const latest = html.match(ENTRY)?.[0]
  if (!latest || latest === running) return
  try {
    const last = Number(sessionStorage.getItem(GUARD) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(GUARD, String(Date.now()))
  } catch {
    // no storage: still reload once; a loop needs a cache that keeps lying
  }
  const url = new URL(location.href)
  url.searchParams.set('v', latest.slice(13, -3))
  location.replace(url.toString())
}

/** Check now, and again whenever the player comes back to the app. */
export function watchForNewBuild(): void {
  if (import.meta.env.DEV) return
  void reloadIfStale()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reloadIfStale()
  })
}
