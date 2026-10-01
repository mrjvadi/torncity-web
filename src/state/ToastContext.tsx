// Toasts: short messages over the screen, coloured by meaning (green good,
// blue neutral, amber careful, red only for a refusal or an error), with an
// icon per type, the proto's dark gold-rimmed face, auto-dismiss and a tap to
// close (or to open the related screen when the message names one).
//
// A message that is not the answer to something the player just did (a
// village event, a realtime push) is shown ONCE: it is remembered by kind and
// text in sessionStorage, so leaving a screen and coming back cannot show it
// again. Messages from the player's own commands (`user: true`) always show.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../ui/Icon'
import { t } from '../i18n'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export interface ToastOptions {
  kind?: ToastKind
  /** the answer to something the player just did: never suppressed as a repeat */
  user?: boolean
  /** a stable identity when the source has one (else kind + text) */
  key?: string
  /** a screen the toast opens when tapped */
  command?: string
  args?: Record<string, string>
}

interface ToastItem { id: number; text: string; kind: ToastKind; command?: string; args?: Record<string, string> }

type Opener = (command: string, args?: Record<string, string>) => void

export interface ToastApi {
  push: (text: string, opts?: ToastOptions) => void
  /** the shell says how to open a screen from a toast */
  bindOpener: (fn: Opener | null) => void
}

const ToastCtx = createContext<ToastApi>({ push: () => {}, bindOpener: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastCtx)
}

const SEEN_KEY = 'tc.toast.seen'
const SEEN_TTL = 30 * 60 * 1000
const memorySeen = new Map<string, number>()

function seenBefore(key: string): boolean {
  const now = Date.now()
  let store: Record<string, number> = {}
  try { store = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '{}') } catch { /* memory only */ }
  for (const [k, v] of memorySeen) store[k] = Math.max(store[k] ?? 0, v)
  for (const k of Object.keys(store)) if (now - store[k] > SEEN_TTL) delete store[k]
  const hit = key in store
  if (!hit) {
    store[key] = now
    memorySeen.set(key, now)
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(store)) } catch { /* memory only */ }
  }
  return hit
}

const LEAD = /^[\s\p{Extended_Pictographic}️‍]+/u
/** Raw codes in quotes (a catalogue name that was not found) are not for players. */
function scrub(text: string): string {
  return text.replace(/[«"“]([a-z][a-z0-9]*(?:[_.][a-z0-9]+)+|[a-z]{1,24}\d*)[»"”]/g, t('toast.unnamed')).replace(LEAD, '').trim()
}

const ICON: Record<ToastKind, { name: string; palette: 'emerald' | 'sapphire' | 'amber' | 'ruby' }> = {
  success: { name: 'check', palette: 'emerald' },
  info: { name: 'inbox', palette: 'sapphire' },
  warning: { name: 'm_hand', palette: 'amber' },
  error: { name: 'm_stop', palette: 'ruby' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const opener = useRef<Opener | null>(null)
  const lastUser = useRef({ text: '', at: 0 })

  const drop = useCallback((id: number) => setItems((cur) => cur.filter((x) => x.id !== id)), [])

  const push = useCallback((raw: string, opts: ToastOptions = {}) => {
    // The colour comes from what the message is (a notice's code, a refusal), never from its words.
    const kind = opts.kind ?? 'info'
    const text = scrub(raw)
    if (!text) return
    if (opts.user) {
      const now = Date.now()
      if (lastUser.current.text === text && now - lastUser.current.at < 1200) return // a double tap
      lastUser.current = { text, at: now }
    } else if (seenBefore(opts.key ?? `${kind}|${text}`)) return
    const id = ++counter.current
    setItems((cur) => [...cur.slice(-2), { id, text, kind, command: opts.command, args: opts.args }])
    setTimeout(() => drop(id), kind === 'error' ? 5200 : 3800)
  }, [drop])

  const bindOpener = useCallback((fn: Opener | null) => { opener.current = fn }, [])

  // mock mode only: lets the smoke tests and screenshots raise a toast
  useEffect(() => {
    if (new URLSearchParams(location.search).get('mock') === '1') (window as unknown as { __toast?: unknown }).__toast = push
  }, [push])

  return (
    <ToastCtx.Provider value={{ push, bindOpener }}>
      {children}
      <div className="toast-layer">
        {items.map((it) => (
          <button
            key={it.id} className={`toast toast-${it.kind}`}
            onClick={() => { drop(it.id); if (it.command) opener.current?.(it.command, it.args) }}
          >
            <span className="toast-icon"><Icon name={ICON[it.kind].name} palette={ICON[it.kind].palette} size={20} /></span>
            <span className="toast-text" dir="auto">{it.text}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
