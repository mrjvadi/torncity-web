// What a tap on a building offers: at most five verbs, «اطلاعات» first, the building's main verb as the gold primary.
// The verbs are the server's own list for THIS viewer (the building overlay of the settlement summary: `actions`);
// this file only turns each verb into the button and the screen it opens, and orders them. Nothing is offered that
// the server did not list, and a verb this client does not know is left out.

import type { LayoutBuilding } from '../../api/types'
import { t } from '../../i18n'
import type { BuildingOverlay } from '../../state/syncTypes'
import type { RingAction } from '../../ui/v6/MapOverlays'

export interface RingHandlers {
  info: () => void
  upgrade: () => void
  site: () => void
  open: (screen: string) => void
  mine: () => void
  run: (command: string) => void
}

export function ringActions(b: LayoutBuilding, ov: BuildingOverlay | null, h: RingHandlers): RingAction[] {
  const acts: RingAction[] = [{ id: 'info', label: t('v6.ring.info'), icon: 'info', kind: 'info', onClick: h.info }]
  const has = (a: BuildingOverlay['actions'][number]) => !!ov?.actions.includes(a)
  let hasPrimary = false
  const primary = (a: Omit<RingAction, 'kind'>) => { acts.push(hasPrimary ? a : { ...a, kind: 'primary' }); hasPrimary = true }

  if (has('help_build') && b.id) {
    primary({ id: 'site', label: t('v6.ring.help_build'), icon: 'hammer', onClick: h.site })
  } else if (b.private && b.mine) {
    primary({ id: 'mine', label: t('v6.ring.mine'), icon: 'bag', onClick: h.mine })
  } else {
    if (has('treasury')) primary({ id: 'status', label: t('v6.ring.status'), icon: 'scroll', onClick: () => h.open('village_overview') })
    if (has('take_shift')) primary({ id: 'shift', label: t('v6.ring.shift'), icon: 'tool', onClick: () => h.run('settlement.work') })
    if (ov?.role === 'storage') primary({ id: 'storage', label: t('v6.ring.storage'), icon: 'chest', onClick: () => h.open('village_storage') })
    if (ov?.role === 'education') primary({ id: 'learn', label: t('v6.ring.learn'), icon: 'book', onClick: () => h.run('education.list') })
    if (has('research')) acts.push({ id: 'knowledge', label: t('v6.ring.knowledge'), icon: 'book', onClick: () => h.open('village_knowledge') })
    if (has('elections')) acts.push({ id: 'elections', label: t('v6.ring.elections'), icon: 'ballot', onClick: () => h.run('election.list') })
    if (has('workers')) acts.push({ id: 'workers', label: t('v6.ring.workers'), icon: 'people', onClick: () => h.run('settlement.labor.board') })
    if (has('road')) acts.push({ id: 'road', label: t('v6.ring.road'), icon: 'road', onClick: h.info })
  }

  // the upgrade verb is the server's; the arrow (can_upgrade) decides whether it can be pressed now
  if (has('upgrade')) {
    const up: RingAction = { id: 'up', label: t('v6.ring.up'), icon: 'up', onClick: h.upgrade }
    acts.push(hasPrimary ? up : { ...up, kind: 'primary' })
  }
  return acts.slice(0, 5)
}
