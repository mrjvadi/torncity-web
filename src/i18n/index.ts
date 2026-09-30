// The client's one place for user-facing text, in two languages: Persian
// (default, right-to-left) and English (left-to-right). A key missing from
// the active table falls back to Persian and then to the key itself, so a
// gap is visible, never blank. Digits are Western in both languages.
//
// The language lives in this module (one small store), is persisted in
// localStorage (every access guarded), and is applied to <html lang dir>.
// Whoever changes it goes through changeLanguage() in ./sync, which also
// tells the server so the bot and the web agree.

import { useSyncExternalStore } from 'react'
import { fa, type Key as CoreKey } from './fa'
import { en } from './en'
import { uiFa, type UiKey } from './ui.fa'
import { uiEn } from './ui.en'

export type Lang = 'fa' | 'en'
export type Key = CoreKey | UiKey
export const LANGS: Lang[] = ['fa', 'en']
export const LANG_NAME: Record<Lang, string> = { fa: 'فارسی', en: 'English' }

const FA: Record<string, string> = { ...fa, ...uiFa }
const EN: Record<string, string> = { ...en, ...uiEn }
const LS_LANG = 'tc.lang'

function isLang(v: unknown): v is Lang {
  return v === 'fa' || v === 'en'
}

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(LS_LANG)
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

let current: Lang = readStored() ?? 'fa'
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function isRtl(lang: Lang = current): boolean {
  return lang === 'fa'
}

/** Puts the language on <html> so CSS (direction, fonts) follows it. */
export function applyDocumentLang(lang: Lang = current): void {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.lang = lang
  el.dir = isRtl(lang) ? 'rtl' : 'ltr'
}

/** Sets the language locally (store, storage, <html>) and re-renders the
 * app. It does not tell the server; use changeLanguage() for that. */
export function setLang(lang: Lang, persist = true): void {
  if (!isLang(lang)) return
  if (persist) {
    try { localStorage.setItem(LS_LANG, lang) } catch { /* private mode: keep it in memory */ }
  }
  if (lang === current) { applyDocumentLang(lang); return }
  current = lang
  applyDocumentLang(lang)
  listeners.forEach((l) => l())
}

/** Subscribes a component to language changes; returns the active language. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    getLang,
    getLang,
  )
}

applyDocumentLang()

export function t(key: Key, params?: Record<string, string | number>): string {
  let s: string = (current === 'en' ? EN[key] : undefined) ?? FA[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** The text for a server refusal by its `error.code`, falling back to the
 * server's own sentence (already in the player's language) and then a
 * generic line. */
export function refusalText(code: string | undefined, serverMessage?: string): string {
  const key = `refusal.${code ?? ''}` as Key
  if (code && (key in FA)) return t(key)
  return serverMessage && serverMessage.trim() ? serverMessage : t('refusal.unknown')
}

/** Picks the text for the active language from a {fa, en} pair (content
 * that carries both, like the city map's plot names). */
export function pick(pair: { fa?: string; en?: string } | string | undefined | null): string {
  if (!pair) return ''
  if (typeof pair === 'string') return pair
  return (current === 'en' ? pair.en ?? pair.fa : pair.fa ?? pair.en) ?? ''
}
