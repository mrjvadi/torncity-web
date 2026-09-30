// Where publications of a settlement's Centrifugo channel (client-api.md
// section 5.4) are handed to whoever is watching that village. The realtime
// connection publishes here; the offline mock publishes here too, so the
// village store has a single way in.

import type { SettlementEvent } from './types'

type Listener = (ev: SettlementEvent) => void

const listeners = new Map<string, Set<Listener>>()

export function subscribeSettlement(settlementId: string, fn: Listener): () => void {
  let set = listeners.get(settlementId)
  if (!set) {
    set = new Set()
    listeners.set(settlementId, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
  }
}

export function publishSettlement(ev: SettlementEvent): void {
  const set = listeners.get(ev.settlement_id)
  if (!set) return
  for (const fn of [...set]) {
    try {
      fn(ev)
    } catch {
      // one listener's failure must not stop the others
    }
  }
}

/** True when the channel is being delivered by a live socket; the store
 * polls the layout gently when it is not. */
let live = false
const liveListeners = new Set<(v: boolean) => void>()
export function setSettlementLive(v: boolean): void {
  if (live === v) return
  live = v
  for (const fn of liveListeners) fn(v)
}
export function isSettlementLive(): boolean { return live }
export function onSettlementLive(fn: (v: boolean) => void): () => void {
  liveListeners.add(fn)
  return () => liveListeners.delete(fn)
}
