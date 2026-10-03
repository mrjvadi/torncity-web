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

/** True when `lang` really is what the next page load will read back. */
export function isStored(lang: Lang): boolean {
  return readStored() === lang
}

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

/** A figure in the player's script: Persian digits in the Persian UI (a number given to a string is always display text). */
function digits(s: string): string {
  return isRtl() ? s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) : s
}

const missingKeys = new Set<string>()

export function t(key: Key, params?: Record<string, string | number>): string {
  let s: string | undefined = (current === 'en' ? EN[key] : undefined) ?? FA[key]
  if (s === undefined) {
    // a key with no words is a gap to fix, never text for a player: it is dropped (and shown in the dev console)
    if (import.meta.env.DEV && !missingKeys.has(key)) { missingKeys.add(key); console.warn(`[i18n] missing key: ${key}`) }
    return ''
  }
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(typeof v === 'number' ? digits(String(v)) : String(v))
  return s
}

/** True when a string with this key exists in the active language tables. */
export function hasKey(key: string): boolean {
  return key in FA || (current === 'en' && key in EN)
}

/** The text for a server refusal by its `error.code`; `args` are the data the
 * server sent with it ({min}, {max}, {remaining}...). A code this client has no
 * wording for falls back to the legacy sentence the server may still send, and
 * then to a generic line. */
export function refusalText(code: string | undefined, serverMessage?: string, args?: Record<string, unknown>): string {
  const key = `refusal.${code ?? ''}`
  if (code && hasKey(key)) {
    const params: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(args ?? {})) if (typeof v === 'string' || typeof v === 'number') params[k] = v
    // the server's bounds are money; a wait comes as whole seconds
    for (const k of ['min', 'max', 'fee', 'cash']) if (typeof params[k] === 'number') params[k] = `${Number(params[k]).toLocaleString('en-US')} ${t('unit.money')}`
    const wait = typeof params.remaining_seconds === 'number' ? params.remaining_seconds : params.wait_seconds
    if (typeof wait === 'number') {
      const s = Math.max(0, Math.round(wait))
      params.time = s >= 3600 ? t('time.h', { n: Math.ceil(s / 3600) }) : s >= 60 ? t('time.m', { n: Math.ceil(s / 60) }) : t('time.s', { n: s })
    }
    return t(key as Key, params)
  }
  return serverMessage && serverMessage.trim() ? serverMessage : t('refusal.unknown')
}

/** The line for a notice: the legacy sentence when the server still sends one, else this client's
 * own wording of its `code` (keys `notice.<code>`); empty when there is neither. */
export function noticeText(n: { text?: string; code?: string; args?: Record<string, unknown> }): string {
  if (n.text && n.text.trim()) return n.text
  const key = `notice.${n.code ?? ''}`
  if (!n.code || !hasKey(key)) return ''
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(n.args ?? {})) if (typeof v === 'string' || typeof v === 'number') params[k] = v
  return t(key as Key, params)
}

/** Picks the text for the active language from a {fa, en} pair (content
 * that carries both, like the city map's plot names). */
export function pick(pair: { fa?: string; en?: string } | string | undefined | null): string {
  if (!pair) return ''
  if (typeof pair === 'string') return pair
  return (current === 'en' ? pair.en ?? pair.fa : pair.fa ?? pair.en) ?? ''
}
