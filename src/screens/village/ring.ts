// What a tap on a building offers: at most five verbs, «اطلاعات» first, the building's main verb as the gold primary.
// The verbs follow what the server says about THIS viewer (the building's panel: can_manage, has_upgrade, kind) and the
// building's own kind; nothing is offered that the viewer may not do, and nothing is invented for a kind the client does
// not know (it gets «اطلاعات» and, if the server allows it, «ارتقا»).

import type { BuildingPanelView, LayoutBuilding } from '../../api/types'
import { t } from '../../i18n'
import type { RingAction } from '../../ui/v6/MapOverlays'

export interface RingHandlers {
  info: () => void
  upgrade: () => void
  site: () => void
  open: (screen: string) => void
  mine: () => void
  run: (command: string) => void
}

export function ringActions(b: LayoutBuilding, panel: BuildingPanelView | null, h: RingHandlers): RingAction[] {
  const going = b.state === 'under_construction' || b.state === 'planned'
  const acts: RingAction[] = [{ id: 'info', label: t('v6.ring.info'), icon: 'info', kind: 'info', onClick: h.info }]
  const kind = panel?.kind ?? (b.type === 'road' ? 'road' : 'generic')
  let hasPrimary = false
  const primary = (a: Omit<RingAction, 'kind'>) => { acts.push({ ...a, kind: 'primary' }); hasPrimary = true }

  if (going) {
    if (b.id) primary({ id: 'site', label: t('v6.ring.help_build'), icon: 'hammer', onClick: h.site })
  } else if (b.private && b.mine) {
    primary({ id: 'mine', label: t('v6.ring.mine'), icon: 'bag', onClick: h.mine })
  } else if (kind === 'storage') {
    primary({ id: 'storage', label: t('v6.ring.storage'), icon: 'chest', onClick: () => h.open('village_storage') })
  } else if (kind === 'civic_hall') {
    primary({ id: 'status', label: t('v6.ring.status'), icon: 'scroll', onClick: () => h.open('village_overview') })
    acts.push({ id: 'knowledge', label: t('v6.ring.knowledge'), icon: 'book', onClick: () => h.open('village_knowledge') })
    acts.push({ id: 'storage', label: t('v6.ring.storage'), icon: 'chest', onClick: () => h.open('village_storage') })
  } else if (kind === 'school') {
    primary({ id: 'learn', label: t('v6.ring.learn'), icon: 'book', onClick: () => h.run('education.list') })
  }

  // the upgrade is offered only to the viewer the server lets manage this building
  if (!going && panel?.can_manage && panel.has_upgrade) {
    const up: RingAction = { id: 'up', label: t('v6.ring.up'), icon: 'up', onClick: h.upgrade }
    acts.push(hasPrimary ? up : { ...up, kind: 'primary' })
  }
  return acts.slice(0, 5)
}
