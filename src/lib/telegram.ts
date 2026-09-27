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
