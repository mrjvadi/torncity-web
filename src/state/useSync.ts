// React's side of the store (store.ts): selectors through
// useSyncExternalStore, so a screen re-renders only when what it reads
// changes, and the figures many screens show (the HUD's money and vitals,
// the profile's identity) computed in one place, with regen counted here on
// the server's clock — the server sends no tick.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { entityOf, primaryWallet, syncStore, type StoreView } from './store'
export { primaryWallet }
import type { KindData, Meter, SyncKind } from './syncTypes'
import { serverNow } from '../village/clock'
import { useServerNow } from '../lib/ticker'

export function useStoreView(): StoreView {
  return useSyncExternalStore(syncStore.subscribe, syncStore.getView, syncStore.getView)
}

/** One entity (undefined until the store has it). */
export function useEntity<K extends SyncKind>(kind: K, id: string | undefined): KindData[K] | undefined {
  const get = () => (id ? entityOf(syncStore.getView(), kind, id) : undefined)
  return useSyncExternalStore(syncStore.subscribe, get, get)
}

/** Whether an entity shows an optimistic change not confirmed yet. */
export function usePending(kind: SyncKind, id: string | undefined): boolean {
  const get = () => (id ? syncStore.getView().pending.has(`${kind}/${id}`) : false)
  return useSyncExternalStore(syncStore.subscribe, get, get)
}

/** A meter's value now: what was stored at as_of plus the whole regen ticks
 * since, on the server's clock. */
export function meterNow(m: Meter | undefined, now: number): { value: number; fullIn: number } {
  if (!m) return { value: 0, fullIn: 0 }
  const r = m.regen
  if (!r || !m.as_of || r.amount <= 0 || r.every_seconds <= 0 || m.value >= m.max) {
    return { value: Math.min(m.value, m.max), fullIn: 0 }
  }
  const bps = r.bps > 0 ? r.bps : 10000
  const elapsed = Math.max(0, (now - Date.parse(m.as_of)) / 1000) * (bps / 10000)
  const ticks = Math.floor(elapsed / r.every_seconds)
  const value = Math.min(m.max, m.value + ticks * r.amount)
  if (value >= m.max) return { value, fullIn: 0 }
  const missingTicks = Math.ceil((m.max - value) / r.amount)
  const tickReal = (r.every_seconds * 10000) / bps
  const intoTick = (elapsed - ticks * r.every_seconds) * 10000 / bps
  return { value, fullIn: Math.max(0, Math.round(missingTicks * tickReal - intoTick)) }
}

/** A clock that ticks every `ms`, for figures that move with time. */
export function useTick(ms: number): number {
  const now = useServerNow()
  return ms > 1000 ? Math.floor(now / ms) * ms : now
}


/** What the HUD and the profile's header show, from the store; null until
 * the store holds the player. Field names are the profile view's, so it
 * lays over a command's view key for key. */
export interface StoreFigures {
  name: string
  level: number
  xp: number
  next_level_xp: number
  rank: { code: string; name: string } | undefined
  energy: number
  max_energy: number
  energy_full_in_seconds: number
  health: number
  max_health: number
  nerve: number
  max_nerve: number
  nerve_full_in_seconds: number
  cash: number
  bank: number
  unread: number
  pending_money: boolean
}

export function useStoreFigures(playerId: string | undefined): StoreFigures | null {
  const view = useStoreView()
  const now = useTick(5000)
  return useMemo(() => {
    if (!view.ready || !playerId) return null
    const p = entityOf(view, 'player', playerId)
    const vit = entityOf(view, 'vitals', playerId)
    if (!p || !vit) return null
    const w = primaryWallet(view)
    const inbox = entityOf(view, 'inbox', 'self')
    const energy = meterNow(vit.energy, now)
    const nerve = meterNow(vit.nerve, now)
    const health = meterNow(vit.health, now)
    return {
      name: p.name, level: p.level, xp: p.xp, next_level_xp: p.next_level_xp,
      rank: p.rank ? { code: p.rank, name: '' } : undefined,
      energy: energy.value, max_energy: vit.energy.max, energy_full_in_seconds: energy.fullIn,
      health: health.value, max_health: vit.health.max,
      nerve: nerve.value, max_nerve: vit.nerve.max, nerve_full_in_seconds: nerve.fullIn,
      cash: w?.cash ?? 0, bank: w?.bank ?? 0,
      unread: inbox?.unread ?? 0,
      pending_money: !!w && view.pending.has(`wallet/${w.currency}`),
    }
  }, [view, now, playerId])
}
