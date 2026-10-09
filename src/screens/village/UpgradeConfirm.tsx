// «ارتقا» from the ring: ONE centred card with everything about the upgrade (cost, materials, time, what it gives, every requirement marked
// met or missing with how to get it), built from the server's own answer (settlement.building.view, mode up) by UpgradeDetail.tsx.
// The button starts the same build the old upgrade list started and is greyed out, with its reason, while anything is missing.

import { useEffect, useState } from 'react'
import type { BuildingPanelView, CatalogueBuilding, LayoutBuilding } from '../../api/types'
import { t } from '../../i18n'
import { ConfirmPopup } from '../../ui/v6/parts'
import { buildingName, useContentNames, useVillageCommand } from '../../village/useVillage'
import { UpgradeCard, fromBuildingUpgrade, type UpgradeHandlers } from './UpgradeDetail'

export type UpgradeScreen = 'village_knowledge' | 'village_storage' | 'village_overview'

export function useUpgradeHandlers(cat: Map<string, CatalogueBuilding>, onOpen: (s: UpgradeScreen) => void, onBuild: (code?: string) => void, onClose: () => void, go: (code: string) => void, onRun?: (command: string) => void): UpgradeHandlers {
  const names = useContentNames()
  const leave = (fn: () => void) => () => { onClose(); fn() }
  return {
    names, bname: (code, name) => buildingName(cat, code, name),
    openKnowledge: leave(() => onOpen('village_knowledge')), openStorage: leave(() => onOpen('village_storage')), openTreasury: leave(() => onOpen('village_overview')),
    openBuild: (code) => leave(() => onBuild(code))(), go,
    openLearn: leave(() => onRun?.('education.list')), openTravel: leave(() => onRun?.('travel.destinations')),
  }
}

export default function UpgradeConfirm({ building: b, cat, onBuild, onOpen, onRun, onClose }: {
  building: LayoutBuilding
  cat: Map<string, CatalogueBuilding>
  onBuild: (code: string) => void
  onOpen: (screen: UpgradeScreen) => void
  onRun?: (command: string) => void
  onClose: () => void
}) {
  const cmd = useVillageCommand()
  const [panel, setPanel] = useState<BuildingPanelView | null>(null)
  useEffect(() => {
    let cancelled = false
    void cmd('settlement.building.view', { building_id: b.id!, mode: 'up' }, { silent: true }).then((r) => {
      if (!cancelled && r.ok && r.res?.view) setPanel(r.res.view as unknown as BuildingPanelView)
    })
    return () => { cancelled = true }
  }, [b.id, cmd])
  const h = useUpgradeHandlers(cat, onOpen, (c) => c && onBuild(c), onClose, (c) => onBuild(c), onRun)
  const name = buildingName(cat, b.type, panel?.building.name)
  const ups = panel?.upgrades ?? []
  // the first upgrade this viewer can start now, else the first one (its unmet requirements are the rows)
  const u = ups.find((x) => x.available) ?? ups[0]
  if (!panel) return <ConfirmPopup title={t('v6.up.title', { name })} primary={t('v6.up.go')} disabledReason={t('common.loading')} onPrimary={onClose} onClose={onClose} />
  if (!u) return <ConfirmPopup title={t('v6.up.title', { name })} note={t('building.upgrade.none')} primary={t('v6.up.go')} disabledReason={t('building.upgrade.none')} onPrimary={onClose} onClose={onClose} />
  return <UpgradeCard m={fromBuildingUpgrade(u, h)} onClose={onClose} />
}
