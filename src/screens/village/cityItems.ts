// The city panel's sections (web map 6.2): where the old village menu's «شهر» entries went. The panel (`city_panel`)
// lists them; the desktop rail shows the same list under «شهر». Nothing here is a ring verb.

import type { Key } from '../../i18n'
import { holds } from '../../lib/permissions'

export interface CityItem {
  key: string
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

export const CITY_ITEMS: CityItem[] = [
  { key: 'status', label: 'city.status', local: 'city_panel', icon: 'scroll' },
  { key: 'who', label: 'village.btn.who', local: 'village_who', icon: 'people' },
  { key: 'knowledge', label: 'village.btn.knowledge', local: 'village_knowledge', icon: 'book' },
  { key: 'progress', label: 'village.btn.progress', local: 'village_progress', icon: 'hammer' },
  { key: 'treasury', label: 'city.treasury', local: 'village_overview', icon: 'coin' },
  { key: 'storage', label: 'storage.open', local: 'village_storage', icon: 'chest' },
  { key: 'terms', label: 'menu.terms', command: 'settlement.terms', icon: 'scroll', perm: 'lot.sell' },
  { key: 'charter', label: 'city.charter', command: 'settlement.charter.view', icon: 'banner', resident: true },
  { key: 'leave', label: 'menu.leave', command: 'settlement.leave', icon: 'cross', resident: true, notHead: true },
]

/** The entries a viewer sees: head-only ones for the head, resident-only ones for a resident (the server's flags). */
export function cityItemsFor(s: { is_head?: boolean; resident?: boolean; permissions?: string[] }): CityItem[] {
  return CITY_ITEMS.filter((it) => !(it.perm && !holds(s.permissions, it.perm)) && !(it.notHead && s.is_head) && !(it.resident && s.resident === false))
}
