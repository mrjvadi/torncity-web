// What a tap on a building opens: ITS OWN panel (settlement.building.view,
// contract 1.4) - a granary shows what it holds, a school the village's
// literacy, the civic hall the village numbers and the doors to its screens, a
// building going up its timer. Demolishing is a small, quiet link at the very
// bottom with an are-you-sure step; upgrading reveals the next tier of the
// building's role, and its prerequisites, only when pressed.
//
// If the server has no panel for the building (an older server, a failed
// call), the sheet falls back to what the layout itself says.

import { useCallback, useEffect, useState } from 'react'
import BottomSheet from '../../ui/BottomSheet'
import { Slab, Plate, Emboss } from '../../kit'
import type { BuildingPanelView, CatalogueBuilding, LayoutBuilding } from '../../api/types'
import { t, type Key } from '../../i18n'
import { Bar } from '../native/kit/Parts'
import { formatNumber, money } from '../native/kit/format'
import { buildingName, useNow, useVillageCommand } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import { serverNow } from '../../village/clock'
import { countdown, durationText, iconForRole } from './common'
import { useToast } from '../../state/ToastContext'
import type { VillageStore } from '../../village/villageStore'
import { SiteSheet } from './Labor'

interface Props {
  building: LayoutBuilding | null
  canPlace: boolean
  cat: Map<string, CatalogueBuilding>
  store: VillageStore | null
  /** Opens one of the village's own screens (the civic hall's doors). */
  onOpen?: (screen: 'village_overview' | 'village_knowledge' | 'village_progress') => void
  /** Starts build mode on a building code (an upgrade line's button). */
  onBuild?: (code: string) => void
  onClose: () => void
  /** Opens the resident's own property sheet (rest at home, tax). */
  onMine?: () => void
}

const EFFECT_KEYS = ['local_security_bps', 'food_coverage_bps', 'job_coverage_bps', 'service_coverage_bps', 'happiness_bps', 'housing_capacity']

export default function BuildingSheet({ building: b, canPlace, cat, store, onOpen, onBuild, onClose, onMine }: Props) {
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const [ask, setAsk] = useState<'cancel' | 'demolish' | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<BuildingPanelView | null>(null)
  const [upgrade, setUpgrade] = useState(false)
  const id = b?.id
  const state = b?.state

  const load = useCallback(async (withUpgrade: boolean) => {
    if (!id) return
    const r = await cmd('settlement.building.view', withUpgrade ? { building_id: id, mode: 'up' } : { building_id: id }, { silent: true })
    if (r.ok && r.res?.view) setPanel(r.res.view as unknown as BuildingPanelView)
  }, [id, cmd])

  useEffect(() => {
    setPanel(null); setAsk(null); setUpgrade(false)
    void load(false)
  }, [id, state, load])
  const [site, setSite] = useState(false)
  if (!b) return null

  const entry = cat.get(b.type)
  const name = buildingName(cat, b.type, panel?.building.name)
  const { icon, palette } = iconForRole(entry?.category ?? panel?.role)
  const going = (panel ? panel.state === 'building' : (b.state === 'under_construction' || b.state === 'planned'))
  const p = constructionProgress(b, now || serverNow())
  // a resident's building is theirs to cancel or pull down, never the head's
  const canAct = (b.private ? !!b.mine : (panel ? panel.can_manage : canPlace)) && !!b.id
  const kind = panel?.kind ?? (b.type === 'road' ? 'road' : 'generic')

  async function run(kindOf: 'cancel' | 'demolish') {
    if (!b?.id) return
    setBusy(true)
    const r = await cmd(kindOf === 'cancel' ? 'settlement.build.cancel' : 'settlement.build.demolish', { id: b.id }, { write: true })
    setBusy(false)
    if (r.ok) {
      toast.push(t(kindOf === 'cancel' ? 'building.cancelled' : 'building.demolished'))
      void store?.refetchLayout()
      setAsk(null)
      onClose()
    }
  }

  async function reveal() {
    setUpgrade(true)
    await load(true)
  }

  const showUpgrade = !going && canAct && (panel?.has_upgrade ?? false)

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

      {panel?.description && <p className="vh-desc">{panel.description}</p>}

      {going ? (
        b.finish_at && <Bar frac={p} color="#f5a11f" label={`${countdown(b.finish_at, now)}  ·  ${t('progress.percent', { p: Math.round(p * 100) })}`} />
      ) : (
        <TypePanel kind={kind} panel={panel} onOpen={onOpen} onClose={onClose} />
      )}
      {going && b.id && !b.private && (
        <div className="vh-sheet-actions">
          <Slab tone="gold" radius={14} lip={4} onClick={() => setSite(true)}>{t('labor.btn.site')}</Slab>
        </div>
      )}
      {site && b.id && <SiteSheet buildingId={b.id} title={name} onClose={() => setSite(false)} />}
      {b.private && b.mine && !going && onMine && (
        <div className="vh-sheet-actions">
          <Slab tone="green" radius={14} lip={4} onClick={onMine}>{t('citizen.mine.rest')}</Slab>
          <Slab tone="steel" radius={14} lip={4} onClick={onMine}>{t('citizen.bar.mine')}</Slab>
        </div>
      )}


      {showUpgrade && !upgrade && (
        <div className="vh-sheet-actions">
          <Slab tone="steel" radius={14} lip={4} onClick={() => void reveal()}>⬆ {t('building.upgrade')}</Slab>
        </div>
      )}
      {upgrade && <UpgradeList panel={panel} onBuild={(c) => { onClose(); onBuild?.(c) }} />}

      {going && canAct && ask === null && (
        <div className="vh-quiet">
          <button className="vh-linkbtn" onClick={() => setAsk('cancel')}>{t('building.cancel')}</button>
        </div>
      )}
      {ask && (
        <>
          <div className="vh-confirm">{t(ask === 'cancel' ? 'building.confirm_cancel' : 'building.confirm_demolish')}</div>
          <div className="vh-sheet-actions">
            <Slab tone="steel" radius={14} lip={4} onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</Slab>
            <Slab tone="red" radius={14} lip={4} onClick={() => void run(ask)} disabled={busy}>{t('building.yes')}</Slab>
          </div>
        </>
      )}
      {/* the one destructive action: small, last, never the face of the panel */}
      {!going && canAct && ask === null && (
        <div className="vh-quiet">
          <button className="vh-linkbtn" onClick={() => setAsk('demolish')}>{t('building.demolish_small')}</button>
        </div>
      )}
    </BottomSheet>
  )
}

function TypePanel({ kind, panel, onOpen, onClose }: {
  kind: string
  panel: BuildingPanelView | null
  onOpen?: Props['onOpen']
  onClose: () => void
}) {
  if (!panel) return null
  const effects = (panel.effects ?? []).filter((e) => EFFECT_KEYS.includes(e.target))
  return (
    <div className="vh-panelbody">
      {kind === 'storage' && (
        <div className="vh-stock">
          <div className="vh-sub">{t('building.storage.title')}</div>
          {(panel.stock ?? []).length === 0
            ? <div className="vh-hint">{t('building.storage.empty')}</div>
            : (panel.stock ?? []).map((s) => (
              <div key={s.item.code} className="vh-stockrow"><span>{s.item.name}</span><b>{formatNumber(s.qty)}</b></div>
            ))}
        </div>
      )}
      {kind === 'school' && (
        <>
          <Bar frac={(panel.literacy_percent ?? 0) / 100} color="#8f7cff" label={t('building.school.literacy', { p: panel.literacy_percent ?? 0 })} />
          <div className="vh-hint">{panel.teaching ? t('building.school.teaching') : t('building.school.idle')}</div>
        </>
      )}
      {kind === 'civic_hall' && (
        <>
          <div className="vh-tiles">
            <div className="vh-tile"><span>{t('building.civic.population')}</span><b>{formatNumber(panel.population ?? 0)}</b></div>
            <div className="vh-tile"><span>{t('building.civic.treasury')}</span><b>{money(panel.treasury ?? 0)}</b></div>
          </div>
          <div className="vh-hint">
            {panel.research ? t('building.civic.research', { name: panel.research.knowledge.name, t: durationText(panel.research.left_seconds) }) : t('building.civic.no_research')}
          </div>
          {onOpen && (
            <div className="vh-doors">
              <Slab tone="steel" radius={12} lip={3} onClick={() => { onClose(); onOpen('village_overview') }}>{t('building.civic.overview')}</Slab>
              <Slab tone="steel" radius={12} lip={3} onClick={() => { onClose(); onOpen('village_knowledge') }}>{t('building.civic.knowledge')}</Slab>
              <Slab tone="steel" radius={12} lip={3} onClick={() => { onClose(); onOpen('village_progress') }}>{t('building.civic.progress')}</Slab>
            </div>
          )}
        </>
      )}
      {effects.length > 0 && (
        <div className="vh-effects">
          {effects.map((e) => (
            <span key={e.target} className="vh-effect">{t(`building.effect.${e.target}` as Key, { v: formatNumber(e.target === 'housing_capacity' ? e.value : Math.round(e.value / 100)) })}</span>
          ))}
        </div>
      )}
      {(panel.upkeep ?? 0) > 0 && kind !== 'road' && <div className="vh-hint">{t('building.upkeep', { amount: money(panel.upkeep ?? 0) })}</div>}
    </div>
  )
}

function UpgradeList({ panel, onBuild }: { panel: BuildingPanelView | null; onBuild: (code: string) => void }) {
  const ups = panel?.upgrades ?? null
  if (!panel || panel.mode !== 'up') return <div className="vh-hint">…</div>
  if (!ups || ups.length === 0) return <div className="vh-hint">{t('building.upgrade.none')}</div>
  return (
    <div className="vh-upgrades">
      <div className="vh-sub">{t('building.upgrade.intro')}</div>
      {ups.map((u) => (
        <div key={u.building.code} className={`vh-upgrade${u.available ? '' : ' locked'}`}>
          <div className="vh-upgrade-name">{u.building.name}</div>
          <div className="vh-hint">{money(u.cost_money)} · {durationText(u.build_time_seconds)}</div>
          {u.available
            ? <Slab tone="gold" radius={12} lip={3} onClick={() => onBuild(u.building.code)}>{t('building.upgrade.build')}</Slab>
            : <div className="vh-hint bad">{(u.missing ?? []).length > 0 ? t('build.needs', { list: (u.missing ?? []).map((m) => m.name).join('، ') }) : t('building.upgrade.locked')}</div>}
        </div>
      ))}
    </div>
  )
}
