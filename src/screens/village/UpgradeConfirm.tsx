// «ارتقا»: the confirm for a building's upgrade, in the v6 shape (P15): the title, what it costs and how long it
// takes, every requirement as a tick or as a red row that leads to what unblocks it, and one gold button that is
// clearly greyed out, with its reason, while a requirement is unmet. All of it is the server's own answer
// (settlement.building.view, mode up); the button starts the same build the old upgrade list started.

import { buildText, workText } from '../../lib/duration'
import { useEffect, useState } from 'react'
import type { BuildingPanelView, CatalogueBuilding, LayoutBuilding } from '../../api/types'
import { t } from '../../i18n'
import { ConfirmPopup, type ConfirmRow } from '../../ui/v6/parts'
import { buildingName, useContentNames, useVillageCommand } from '../../village/useVillage'
import { money } from '../native/kit/format'
import { durationText } from './common'

export default function UpgradeConfirm({ building: b, cat, onBuild, onOpen, onClose }: {
  building: LayoutBuilding
  cat: Map<string, CatalogueBuilding>
  onBuild: (code: string) => void
  onOpen: (screen: 'village_knowledge') => void
  onClose: () => void
}) {
  const cmd = useVillageCommand()
  const names = useContentNames()
  const [panel, setPanel] = useState<BuildingPanelView | null>(null)
  useEffect(() => {
    let cancelled = false
    void cmd('settlement.building.view', { building_id: b.id!, mode: 'up' }, { silent: true }).then((r) => {
      if (!cancelled && r.ok && r.res?.view) setPanel(r.res.view as unknown as BuildingPanelView)
    })
    return () => { cancelled = true }
  }, [b.id, cmd])

  const ups = panel?.upgrades ?? []
  // the first upgrade line this viewer can start now, else the first one (its unmet requirements are the rows)
  const u = ups.find((x) => x.available) ?? ups[0]
  const name = buildingName(cat, b.type, panel?.building.name)
  if (!panel) return <ConfirmPopup title={t('v6.up.title', { name })} primary={t('v6.up.go')} disabledReason={t('common.loading')} onPrimary={onClose} onClose={onClose} />
  if (!u) return <ConfirmPopup title={t('v6.up.title', { name })} note={t('building.upgrade.none')} primary={t('v6.up.go')} disabledReason={t('building.upgrade.none')} onPrimary={onClose} onClose={onClose} />

  const rows: ConfirmRow[] = [
    { kind: 'info', label: t('v6.up.cost'), value: money(u.cost_money) },
    { kind: 'info', label: t('v6.up.time'), value: buildText(u) },
  ]
  for (const m of u.missing ?? []) rows.push({ kind: 'bad', label: names.name('knowledge', m.code, m.name), fixLabel: t('v6.fix'), onFix: () => { onClose(); onOpen('village_knowledge') } })
  if (!u.available && (u.missing ?? []).length === 0) rows.push({ kind: 'bad', label: t('building.upgrade.locked') })
  if (u.available) rows.push({ kind: 'ok', label: t('v6.up.ready') })

  return (
    <ConfirmPopup
      title={t('v6.up.title', { name: buildingName(cat, u.building.code, u.building.name) })}
      rows={rows}
      primary={t('v6.up.go')}
      disabledReason={u.available ? undefined : t('v6.up.blocked')}
      onPrimary={() => { onClose(); onBuild(u.building.code) }}
      onClose={onClose}
    />
  )
}
