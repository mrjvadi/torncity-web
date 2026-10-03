// Telegram's native BackButton, wired once for the whole app (P18: one back control only). Whoever needs "back" pushes a
// handler (the shell for an open screen, a popup for its dismiss); the newest handler answers the press, and the button
// shows exactly while at least one handler is waiting. Outside Telegram nothing happens and the screens draw their own
// back control.

import { getTelegramWebApp } from './telegram'

const stack: (() => void)[] = []
let bound = false
const listeners = new Set<() => void>()

function button() {
  const wa = getTelegramWebApp()
  return wa && wa.initData ? wa.BackButton ?? null : null
}

/** True inside the real Telegram client (a Mini App has init data and the native button). */
export function hasNativeBack(): boolean {
  return button() !== null
}

function sync() {
  const bb = button()
  if (!bb) return
  try {
    if (!bound) { bb.onClick(() => stack[stack.length - 1]?.()); bound = true }
    if (stack.length) bb.show(); else bb.hide()
  } catch { /* best effort */ }
  listeners.forEach((l) => l())
}

/** Registers a back handler; returns the function that removes it. */
export function pushNativeBack(handler: () => void): () => void {
  stack.push(handler)
  sync()
  return () => {
    const i = stack.indexOf(handler)
    if (i >= 0) stack.splice(i, 1)
    sync()
  }
}
