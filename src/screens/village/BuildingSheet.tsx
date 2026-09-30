// What a tap on a building opens: its name, state, lot, the live timer of one
// going up, and (for the head) cancel or demolish with an are-you-sure step.

import { useState } from 'react'
import BottomSheet from '../../ui/BottomSheet'
import { Slab, Plate, Emboss } from '../../kit'
import type { CatalogueBuilding, LayoutBuilding } from '../../api/types'
import { t, type Key } from '../../i18n'
import { Bar } from '../native/kit/Parts'
import { buildingName, useNow, useVillageCommand } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import { serverNow } from '../../village/clock'
import { countdown, iconForRole } from './common'
import { useToast } from '../../state/ToastContext'
import type { VillageStore } from '../../village/villageStore'
import { SiteSheet } from './Labor'

interface Props {
  building: LayoutBuilding | null
  canPlace: boolean
  cat: Map<string, CatalogueBuilding>
  store: VillageStore | null
  onClose: () => void
}

export default function BuildingSheet({ building: b, canPlace, cat, store, onClose }: Props) {
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const [ask, setAsk] = useState<'cancel' | 'demolish' | null>(null)
  const [busy, setBusy] = useState(false)
  const [site, setSite] = useState(false)
  if (!b) return null

  const entry = cat.get(b.type)
  const name = buildingName(cat, b.type)
  const { icon, palette } = iconForRole(entry?.category)
  const building = b.state === 'under_construction' || b.state === 'planned'
  const p = constructionProgress(b, now || serverNow())
  const canAct = canPlace && !!b.id

  async function run(kind: 'cancel' | 'demolish') {
    if (!b?.id) return
    setBusy(true)
    const r = await cmd(kind === 'cancel' ? 'settlement.build.cancel' : 'settlement.build.demolish', { id: b.id }, { write: true })
    setBusy(false)
    if (r.ok) {
      toast.push(t(kind === 'cancel' ? 'building.cancelled' : 'building.demolished'))
      void store?.refetchLayout()
      setAsk(null)
      onClose()
    }
  }

  return (
    <BottomSheet open onClose={() => { setAsk(null); onClose() }} title={name}>
      <div className="vh-sheet-row">
        <Plate size={52} square><Emboss name={icon} palette={palette} size={32} /></Plate>
        <div>
          <div className="vh-sheet-meta">{t(`building.state.${b.state}` as Key)}</div>
          <div className="vh-sheet-meta">{t('building.at', { x: b.x + 1, y: b.y + 1 })} · {t('build.footprint', { w: b.w, h: b.h })}</div>
        </div>
      </div>
      {building && b.finish_at && (
        <Bar frac={p} color="#f5a11f" label={`${countdown(b.finish_at, now)}  ·  ${t('progress.percent', { p: Math.round(p * 100) })}`} />
      )}
      {building && !b.finish_at && b.id && (
        <div className="vh-sheet-actions">
          <Slab tone="gold" radius={14} lip={4} onClick={() => setSite(true)}>{t('labor.btn.site')}</Slab>
        </div>
      )}
      {site && b.id && <SiteSheet buildingId={b.id} title={name} onClose={() => setSite(false)} />}
      {canAct && ask === null && (
        <div className="vh-sheet-actions">
          {building
            ? <Slab tone="red" radius={14} lip={4} onClick={() => setAsk('cancel')}>{t('building.cancel')}</Slab>
            : <Slab tone="red" radius={14} lip={4} onClick={() => setAsk('demolish')}>{t('building.demolish')}</Slab>}
        </div>
      )}
      {canAct && ask && (
        <>
          <div className="vh-confirm">{t(ask === 'cancel' ? 'building.confirm_cancel' : 'building.confirm_demolish')}</div>
          <div className="vh-sheet-actions">
            <Slab tone="steel" radius={14} lip={4} onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</Slab>
            <Slab tone="red" radius={14} lip={4} onClick={() => void run(ask)} disabled={busy}>{t('building.yes')}</Slab>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
