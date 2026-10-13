// The city panel's sections (web map 6.2): where the old village menu's «شهر» entries went. The panel (`city_panel`)
// lists them; the desktop rail shows the same list under «شهر». Nothing here is a ring verb.

import type { Key } from '../../i18n'
import { holds } from '../../lib/permissions'

export interface CityItem {
  key: string
  /** the group it sits in, in the rail and in the panel's tiles */
  group: CityGroup
  label: Key
  /** a local screen... */
  local?: string
  args?: Record<string, string>
  /** ...or a server command whose screen opens */
  command?: string
  icon: string
  /** only for a holder of this charter permission (bootstrap `permissions`, owner rule P28) */
  perm?: string
  /** not for the head: the head cannot leave while holding the office */
  notHead?: boolean
  /** only for a resident */
  resident?: boolean
}

/** The four groups of the «شهر» list (the desktop rail and the city panel's tiles): about twenty-three entries were too many to scan in one run.
 * Every entry is in exactly one group; a group with no entry for this viewer is not drawn. */
export type CityGroup = 'town' | 'land' | 'economy' | 'order'
export const CITY_GROUPS: { key: CityGroup; label: Key }[] = [
  { key: 'town', label: 'city.group.town' },
  { key: 'land', label: 'city.group.land' },
  { key: 'economy', label: 'city.group.economy' },
  { key: 'order', label: 'city.group.order' },
]

export const CITY_ITEMS: CityItem[] = [
  // the town itself: facts, people, knowledge, what is going up, leaving
  { key: 'status', group: 'town', label: 'city.status', local: 'city_panel', icon: 'scroll' },
  { key: 'who', group: 'town', label: 'village.btn.who', local: 'village_who', icon: 'people' },
  { key: 'knowledge', group: 'town', label: 'village.btn.knowledge', local: 'village_knowledge', icon: 'book' },
  { key: 'progress', group: 'town', label: 'village.btn.progress', local: 'village_progress', icon: 'hammer' },
  { key: 'charter', group: 'town', label: 'city.charter', command: 'settlement.charter.view', icon: 'banner', resident: true },
  { key: 'leave', group: 'town', label: 'menu.leave', command: 'settlement.leave', icon: 'cross', resident: true, notHead: true },
  // land and building: the registry, the mine, the road, the rail, the chain, the great works
  { key: 'registry', group: 'land', label: 'city.registry', command: 'settlement.land.registry', icon: 'scroll', resident: true },
  { key: 'terms', group: 'land', label: 'menu.terms', command: 'settlement.terms', icon: 'scroll', perm: 'lot.sell' },
  { key: 'mining', group: 'land', label: 'city.mining', command: 'settlement.mining', icon: 'tool', resident: true },
  { key: 'haul', group: 'land', label: 'city.haul', command: 'settlement.haul', icon: 'road', resident: true },
  { key: 'rail', group: 'land', label: 'city.rail', command: 'settlement.rail', icon: 'road', resident: true },
  { key: 'chain', group: 'land', label: 'city.chain', command: 'settlement.chain', icon: 'gears', resident: true },
  { key: 'projects', group: 'land', label: 'city.projects', command: 'settlement.project', icon: 'hammer', resident: true },
  // the town's money and goods: the purse, the store, rights, tenders, loans, insurance
  { key: 'treasury', group: 'economy', label: 'city.treasury', local: 'village_overview', icon: 'coin' },
  { key: 'storage', group: 'economy', label: 'storage.open', local: 'village_storage', icon: 'chest' },
  { key: 'licences', group: 'economy', label: 'city.licences', command: 'settlement.licence', icon: 'scroll', resident: true },
  { key: 'tenders', group: 'economy', label: 'city.tenders', command: 'settlement.tender', icon: 'hammer', resident: true },
  { key: 'debts', group: 'economy', label: 'city.debts', command: 'settlement.debt', icon: 'coin', resident: true },
  { key: 'insurance', group: 'economy', label: 'city.insurance', command: 'settlement.insurance', icon: 'cross', resident: true },
  // politics and safety: the law and its courts, raids, other towns, treaties, the bureau
  { key: 'law', group: 'order', label: 'city.law', command: 'settlement.law', icon: 'crime', resident: true },
  { key: 'raid', group: 'order', label: 'city.raid', command: 'settlement.raid', icon: 'warn', resident: true },
  { key: 'unions', group: 'order', label: 'city.unions', command: 'settlement.union', icon: 'banner', resident: true },
  { key: 'treaties', group: 'order', label: 'city.treaties', command: 'settlement.treaty', icon: 'scroll', resident: true },
  { key: 'intel', group: 'order', label: 'city.intel', command: 'settlement.intel', icon: 'lock', resident: true },
]

/** The entries a viewer sees: head-only ones for the head, resident-only ones for a resident (the server's flags). */
export function cityItemsFor(s: { is_head?: boolean; resident?: boolean; permissions?: string[] }): CityItem[] {
  return CITY_ITEMS.filter((it) => !(it.perm && !holds(s.permissions, it.perm)) && !(it.notHead && s.is_head) && !(it.resident && s.resident === false))
}
