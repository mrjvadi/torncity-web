// Navigation of the new UI: five tabs, a history inside each, and one way to run a server action. Screens reach it
// with useNav(). The route is either a server command (its answer picks the screen) or a client-only screen by name.

import { createContext, useContext } from 'react'
import type { Action } from '../api/types'

export type Tab = 'me' | 'activity' | 'city' | 'economy' | 'society'
export const TABS: Tab[] = ['me', 'activity', 'city', 'economy', 'society']

export interface Route { cmd?: string; local?: string; args?: Record<string, string> }

/** Where each tab starts. */
export const TAB_ROOT: Record<Tab, Route> = {
  me: { cmd: 'player.profile.get' },
  activity: { local: 'activity' },
  city: { local: 'game' },
  economy: { local: 'economy' },
  society: { local: 'society' },
}

/** Which tab a command belongs to, by its family; a command in no family keeps the current tab. */
const FAMILY: Record<string, Tab> = {
  player: 'me', skills: 'me', life: 'me', achievement: 'me', device: 'me', map: 'me',
  job: 'activity', education: 'activity', health: 'activity', crime: 'activity', mission: 'activity', activities: 'activity', leaderboard: 'activity',
  market: 'economy', bank: 'economy', loan: 'economy', save: 'economy', inventory: 'economy', company: 'economy', property: 'economy', stock: 'economy',
  shop: 'economy', auction: 'economy', economy: 'economy', insure: 'economy', gold: 'economy', fx: 'economy',
  faction: 'society', inbox: 'society', social: 'society', election: 'society', gov: 'society', law: 'society', war: 'society', military: 'society', diplomacy: 'society', society: 'society',
  settlement: 'city', place: 'city', city: 'city', travel: 'city',
}
const LOCAL_TAB: Record<string, Tab> = { activity: 'activity', economy: 'economy', society: 'society', game: 'city', city_panel: 'city' }

export function tabOf(r: Route): Tab | null {
  if (r.local) return LOCAL_TAB[r.local] ?? null
  return FAMILY[(r.cmd ?? '').split('.')[0]] ?? null
}

export function sameRoute(a: Route, b: Route): boolean {
  return (a.cmd ?? '') === (b.cmd ?? '') && (a.local ?? '') === (b.local ?? '') && JSON.stringify(a.args ?? {}) === JSON.stringify(b.args ?? {})
}

export interface Nav {
  tab: Tab
  route: Route
  /** at the tab's own start screen (nothing to go back to) */
  atRoot: boolean
  /** opens the screen a command answers with */
  run: (cmd: string, args?: Record<string, string>) => void
  /** opens a client-only screen */
  open: (local: string, args?: Record<string, string>) => void
  back: () => void
  selectTab: (tab: Tab) => void
  /** runs a server action: asks first for danger/confirm, asks for the value of an input, then runs it and shows
   * the screen it answers with (or reloads the open one when it is the same) */
  act: (a: Action) => void
  /** reads the open screen's command again */
  reload: () => void
}

export const NavCtx = createContext<Nav | null>(null)

export function useNav(): Nav {
  const n = useContext(NavCtx)
  if (!n) throw new Error('useNav outside the new shell')
  return n
}
