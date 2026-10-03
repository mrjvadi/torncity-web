// "Never decrement a value the server sent once." A view says "remaining_seconds: 90" at the moment it was made. The
// client turns that, once, into an absolute end time on the server's clock (receipt time + seconds) and from then on
// every read of the field answers `end - serverNow()`. So a countdown shown by any screen moves with the shared
// ticker without the screen holding its own timer, and it survives a throttled or backgrounded page.
//
// Only fields that count a REMAINING time (they go down) or an ELAPSED time (they go up) are live; a duration
// (`duration_seconds`, `build_time_seconds`) never is. Values read inside a live view are numbers like before.

import { useEffect, useRef } from 'react'
import { serverNow } from '../village/clock'
import { useSecondWhen, onResync } from './ticker'

const DOWN = /^(remaining|left|cooling_for|cooldown_left|rest_wait|valid|travel_remaining)_seconds$|(^|_)in_seconds$/
const UP = /(^|_)(ago|since|age)_seconds$/

interface Anchor { end: number; up: boolean }
const anchors = new WeakMap<object, Map<string, Anchor>>()
const proxies = new WeakMap<object, object>()

/** A remaining-time field. Two names are ambiguous on their own and count down only in the shape that makes them a
 * remaining time: a `wait_seconds` of a requirement of kind time/cooldown (elsewhere it is a journey's length), and a
 * `cooldown_seconds` next to a `ready_at` (elsewhere it is a cooldown's length). */
function isDown(o: Record<string, unknown>, k: string): boolean {
  if (DOWN.test(k)) return true
  if (k === 'wait_seconds') return o.kind === 'time' || o.kind === 'cooldown'
  if (k === 'cooldown_seconds') return typeof o.ready_at === 'string'
  return false
}

/** Walks a view once: anchors every live field to the server clock. Returns the raw counts. */
function scan(raw: unknown, at: number, acc: { down: number; up: number }, seen: Set<object>): void {
  if (!raw || typeof raw !== 'object' || seen.has(raw as object)) return
  seen.add(raw as object)
  if (Array.isArray(raw)) { for (const x of raw) scan(x, at, acc, seen); return }
  const o = raw as Record<string, unknown>
  let m: Map<string, Anchor> | undefined
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) {
      const down = isDown(o, k), up = !down && UP.test(k)
      if ((down || up) && (v > 0 || up)) {
        ;(m ??= new Map()).set(k, { end: up ? at - v * 1000 : at + v * 1000, up })
        if (down) acc.down++; else acc.up++
      }
    } else scan(v, at, acc, seen)
  }
  if (m) anchors.set(o, m)
}

function wrap<T>(raw: T): T {
  if (!raw || typeof raw !== 'object') return raw
  const o = raw as unknown as object
  const hit = proxies.get(o)
  if (hit) return hit as T
  const p = new Proxy(o, {
    get(target, key, recv) {
      const a = typeof key === 'string' ? anchors.get(target)?.get(key) : undefined
      if (a) {
        const now = serverNow()
        return a.up ? Math.max(0, Math.floor((now - a.end) / 1000)) : Math.max(0, Math.ceil((a.end - now) / 1000))
      }
      const v = Reflect.get(target, key, recv)
      return v && typeof v === 'object' ? wrap(v) : v
    },
  })
  proxies.set(o, p)
  return p as T
}

/** Makes a command's view live (anchors its remaining/elapsed fields); a view with none is returned as it is. */
export function liveView<T>(view: T): T {
  if (!view || typeof view !== 'object') return view
  const acc = { down: 0, up: 0 }
  scan(view, serverNow(), acc, new Set())
  if (acc.down + acc.up === 0) return view
  return wrap(view)
}

/** The seconds until the first still-counting-down field of a view reaches zero (Infinity if none). */
export function secondsToFirstDone(view: unknown): number {
  let best = Infinity
  const seen = new Set<object>()
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object' || seen.has(x as object)) return
    seen.add(x as object)
    if (Array.isArray(x)) { x.forEach(walk); return }
    const o = x as Record<string, unknown>
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (typeof v === 'number' && isDown(o, k) && v > 0) best = Math.min(best, v)
      else if (v && typeof v === 'object') walk(v)
    }
  }
  walk(view)
  return best
}

/** Re-renders the caller every second while `view` holds a live field, and calls `onDone` ONCE when its earliest
 * countdown reaches zero (to re-read the view or pull the state-sync store), so the screen shows the finished state
 * without a manual refresh. No polling: one call per crossing. */
export function useLive(view: unknown, onDone?: () => void): void {
  const on = secondsToFirstDone(view) !== Infinity || hasUp(view)
  useSecondWhen(on)
  const done = useRef(onDone); done.current = onDone
  const armedFor = useRef<unknown>(null)
  // arm: remember which view had a positive countdown; once it hits 0, fire
  const left = secondsToFirstDone(view)
  const hadTime = useRef(false)
  if (armedFor.current !== view) { armedFor.current = view; hadTime.current = false }
  if (left !== Infinity) hadTime.current = true
  useEffect(() => {
    if (hadTime.current && left === Infinity) { hadTime.current = false; done.current?.() }
  })
  useEffect(() => onResync(() => done.current?.()), [])
}

function hasUp(view: unknown): boolean {
  const seen = new Set<object>()
  const walk = (x: unknown): boolean => {
    if (!x || typeof x !== 'object' || seen.has(x as object)) return false
    seen.add(x as object)
    if (Array.isArray(x)) return x.some(walk)
    const o = x as Record<string, unknown>
    return Object.keys(o).some((k) => (typeof o[k] === 'number' && UP.test(k)) || walk(o[k]))
  }
  return walk(view)
}
