// A thin wrapper around window.Telegram.WebApp. The script is loaded
// same-origin (see index.html loader in main.tsx) from
// https://webomm.ir404.site/telegram-web-app.js — never from telegram.org.

interface TelegramWebApp {
  initData: string
  colorScheme: string
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  openTelegramLink?(url: string): void
  openLink?(url: string): void
  isVersionAtLeast?(version: string): boolean
  requestFullscreen?(): void
  lockOrientation?(): void
  isFullscreen?: boolean
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export function initTelegram(): void {
  const wa = getTelegramWebApp()
  if (!wa) return
  try {
    wa.ready()
    wa.expand()
    // Full screen (Bot API 8.0): the game takes the whole display, without
    // Telegram's header; --safe-t keeps the HUD clear of its buttons. On a
    // phone only, and upright, as the game is laid out.
    if (wa.isVersionAtLeast?.('8.0') && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      wa.requestFullscreen?.()
      wa.lockOrientation?.()
    }
    wa.disableVerticalSwipes?.()
    wa.setHeaderColor?.('#080b16')
    wa.setBackgroundColor?.('#080b16')
  } catch {
    // best effort — the app works without it
  }
}

export function telegramInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

/** The start parameter the game was opened with: Telegram's own
 * `start_param` of a direct-link Mini App (t.me/<bot>?startapp=<param>), or
 * the `tgWebAppStartParam` launch parameter it also travels as, or - in a
 * plain browser - `?startapp=` / `?found=`. Empty when there is none. */
export function launchStartParam(): string {
  const wa = getTelegramWebApp() as unknown as { initDataUnsafe?: { start_param?: string } } | null
  const fromTelegram = wa?.initDataUnsafe?.start_param
  if (fromTelegram) return fromTelegram
  const read = (q: string) => {
    const p = new URLSearchParams(q)
    return p.get('tgWebAppStartParam') || p.get('startapp') || ''
  }
  const fromUrl = read(window.location.search) || read(window.location.hash.replace(/^#/, ''))
  if (fromUrl) return fromUrl
  const found = new URLSearchParams(window.location.search).get('found')
  return found ? `found_${found.replace(/-/g, '')}` : ''
}

/** The founding draft a launch asks for (start parameter `found_<id>`), or
 * '' - the id comes without dashes and is sent to the server as it is. */
export function foundingDraftFromLaunch(): string {
  const m = /^found_([0-9a-fA-F]{32})$/.exec(launchStartParam())
  return m ? m[1].toLowerCase() : ''
}
