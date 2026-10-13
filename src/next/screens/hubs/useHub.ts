// A hub's entries: the server lists which exist for where the player stands (activities.hub, economy.hub,
// society.hub); the client only dresses them (entries.ts). An entry the server does not list is not shown.

import { useCallback, useEffect, useState } from 'react'
import * as api from '../../../api/client'
import type { Key } from '../../../i18n'

export interface HubEntry { code: string; command: string }
export type HubLoad = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; entries: HubEntry[]; place?: unknown }

export function useHub(command: string): { load: HubLoad; retry: () => void } {
  const [load, setLoad] = useState<HubLoad>({ state: 'loading' })
  const retry = useCallback(() => {
    setLoad({ state: 'loading' })
    api.runCommand(command, {})
      .then((r) => {
        const v = r.view as { entries?: HubEntry[]; place?: unknown } | undefined
        setLoad(r.ok !== false && v ? { state: 'ready', entries: v.entries ?? [], place: v.place } : { state: 'failed' })
      })
      .catch(() => setLoad({ state: 'failed' }))
  }, [command])
  useEffect(retry, [retry])
  return { load, retry }
}

export interface EntryLook { icon: string; title: Key; sub?: Key }

/** How each hub entry looks in the new UI: its 3D icon and its name (the words are the app's existing ones). */
export const ENTRY: Record<string, EntryLook> = {
  // activities.hub
  work: { icon: 'work', title: 'hub.job' },
  learn: { icon: 'study', title: 'hub.education' },
  health: { icon: 'health', title: 'hub.health' },
  training: { icon: 'x_muscle', title: 'hub.training' },
  crime: { icon: 'crime', title: 'hub.crime' },
  missions: { icon: 'missions', title: 'hub.missions' },
  rankings: { icon: 'trophy', title: 'hub.leaderboard' },
  // economy.hub
  inventory: { icon: 'm_backpack', title: 'hub.inventory' },
  market: { icon: 'market', title: 'hub.market' },
  storehouse: { icon: 'box', title: 'hub.storehouse' },
  bank: { icon: 'bank', title: 'hub.bank' },
  companies: { icon: 'factory', title: 'hub.companies' },
  property: { icon: 'house', title: 'hub.property' },
  stocks: { icon: 'chart', title: 'hub.stocks' },
  // society.hub
  inbox: { icon: 'inbox', title: 'hub.inbox' },
  faction: { icon: 'x_flag', title: 'hub.faction' },
  friends: { icon: 'society', title: 'hub.friends' },
  elections: { icon: 'vote', title: 'hub.elections' },
  government: { icon: 'gavel', title: 'hub.government' },
  unions: { icon: 'world', title: 'hub.unions' },
  war: { icon: 'swords', title: 'hub.war' },
}
