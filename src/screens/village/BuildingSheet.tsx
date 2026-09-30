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

interface Props {
  building: LayoutBuilding | null
  canPlace: boolean
  cat: Map<string, CatalogueBuilding>
  store: VillageStore | null
  onClose: () => void
  /** Opens the resident's own property sheet (rest at home, tax). */
  onMine?: () => void
}

export default function BuildingSheet({ building: b, canPlace, cat, store, onClose, onMine }: Props) {
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const [ask, setAsk] = useState<'cancel' | 'demolish' | null>(null)
  const [busy, setBusy] = useState(false)
  if (!b) return null

  const entry = cat.get(b.type)
  const name = buildingName(cat, b.type)
  const { icon, palette } = iconForRole(entry?.category)
  const building = b.state === 'under_construction' || b.state === 'planned'
  const p = constructionProgress(b, now || serverNow())
  // a resident's building is theirs to cancel or pull down, never the head's
  const canAct = (b.private ? !!b.mine : canPlace) && !!b.id

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
          {b.private && <div className="vh-sheet-meta" style={{ color: b.mine ? 'var(--gold)' : undefined }}>{b.mine ? t('citizen.owner_you') : t('citizen.owner', { name: b.owner ?? '' })}</div>}
        </div>
      </div>
      {building && (
        <Bar frac={p} color="#f5a11f" label={`${countdown(b.finish_at, now)}  ·  ${t('progress.percent', { p: Math.round(p * 100) })}`} />
      )}
      {b.private && b.mine && !building && onMine && (
        <div className="vh-sheet-actions">
          <Slab tone="green" radius={14} lip={4} onClick={onMine}>{t('citizen.mine.rest')}</Slab>
          <Slab tone="steel" radius={14} lip={4} onClick={onMine}>{t('citizen.bar.mine')}</Slab>
        </div>
      )}
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
