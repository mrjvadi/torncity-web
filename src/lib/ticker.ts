// ONE shared one-second ticker for the whole app. Every countdown reads the server's clock when it draws
// (`serverNow()` = this device's clock plus the offset measured against the server), so a tick never counts anything
// down by itself: a missed tick, a throttled background tab or a device clock that is minutes off cannot make a timer
// wrong, only a moment late. The interval runs only while someone listens and the page is visible; coming back to
// the page (visibilitychange, focus, the Mini App's `activated`) ticks at once and asks listeners to resync.
// Sources (read): MDN Page Visibility API - timers in a hidden page are throttled, so stop and resume on
// visibilitychange; MDN setInterval - the real delay may be longer than asked, so never count the calls.

import { useEffect, useSyncExternalStore } from 'react'
import { serverNow } from '../village/clock'

let n = 0
let timer: number | null = null
const subs = new Set<() => void>()
const resyncs = new Set<() => void>()

function fire() { n++; subs.forEach((f) => f()) }
function start() { if (timer === null && subs.size > 0 && !document.hidden) timer = window.setInterval(fire, 1000) }
function stop() { if (timer !== null) { window.clearInterval(timer); timer = null } }

function wake() {
  if (document.hidden) { stop(); return }
  fire()
  start()
  resyncs.forEach((f) => f())
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener('pageshow', wake)
  const tg = (window as unknown as { Telegram?: { WebApp?: { onEvent?: (e: string, f: () => void) => void } } }).Telegram?.WebApp
  tg?.onEvent?.('activated', wake)
}

/** Listens to the shared ticker; returns the unsubscribe. */
export function subscribeTick(cb: () => void): () => void {
  subs.add(cb)
  start()
  return () => { subs.delete(cb); if (subs.size === 0) stop() }
}

/** Asks to be told when the page comes back (so a view can be re-read once). */
export function onResync(cb: () => void): () => void {
  resyncs.add(cb)
  return () => { resyncs.delete(cb) }
}

/** The tick count: a component that reads it re-renders every second. */
export function useSecond(): number {
  return useSyncExternalStore(subscribeTick, () => n, () => n)
}

/** The server's time in ms, re-read every second. */
export function useServerNow(): number {
  useSecond()
  return serverNow()
}

/** Subscribes only while `on` is true. */
export function useSecondWhen(on: boolean): void {
  useEffect(() => (on ? subscribeTick(() => undefined) : undefined), [on])
  // re-render with the tick when on
  useSyncExternalStore(on ? subscribeTick : noop, () => (on ? n : 0), () => 0)
}
const noop = () => () => undefined

/** Test hook: ticks once by hand. */
export function _tickForTest() { fire() }
