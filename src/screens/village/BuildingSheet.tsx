// What a tap on a building opens: ITS OWN panel (settlement.building.view,
// contract 1.4) - a granary shows what it holds, a school the village's
// literacy, the civic hall the village numbers and the doors to its screens, a
// building going up its timer. Demolishing is a small, quiet link at the very
// bottom with an are-you-sure step; upgrading reveals the next tier of the
// building's role, and its prerequisites, only when pressed.
//
// If the server has no panel for the building (an older server, a failed
// call), the sheet falls back to what the layout itself says.

import { UpgradeCard, fromBuildingUpgrade } from './UpgradeDetail'
import { useUpgradeHandlers, type UpgradeScreen } from './UpgradeConfirm'
import { endNote } from '../../lib/duration'
import { buildText, workText } from '../../lib/duration'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSide } from '../../state/SideContext'
import Popup, { ActionButton, ActionRow, EffectChip, EffectRow, Gauge, Hero, Medallion, Note, ProgressRow, Section, StatCard, StatGrid } from '../../ui/Popup'
import type { BuildingPanelView, CatalogueBuilding, LayoutBuilding } from '../../api/types'
import { t, type Key } from '../../i18n'
import { formatNumber, money } from '../native/kit/format'
import { buildingName, useContentNames, useNow, useVillageCommand, type ContentNames } from '../../village/useVillage'
import { buildingBlurb } from './wording'
import { constructionProgress } from '../../village/progress'
import { serverNow } from '../../village/clock'
import { countdown, durationText, iconForRole } from './common'
import { useToast } from '../../state/ToastContext'
import type { VillageStore } from '../../village/villageStore'
import { SiteSheet } from './Labor'
import WorkSection from './WorkSection'

interface Props {
  building: LayoutBuilding | null
  canPlace: boolean
  cat: Map<string, CatalogueBuilding>
  store: VillageStore | null
  /** Opens one of the village's own screens (the civic hall's doors). */
  onOpen?: (screen: 'village_overview' | 'village_knowledge' | 'village_progress' | 'village_storage' | 'village_shop' | 'village_labor') => void
  /** Starts build mode on a building code (an upgrade line's button). */
  onBuild?: (code: string) => void
  onClose: () => void
  /** The ring's verb that opened this sheet: straight to the site's labour screen. */
  startSite?: boolean
  /** Opens the resident's own property sheet (rest at home, tax). */
  onMine?: () => void
  /** «مدیریت قطعهٔ من» for a building of mine (or the settlement's own, with public.build) */
  onManage?: (buildingId: string) => void
  canPublicBuild?: boolean
  onRun?: (command: string) => void
}

const EFFECT_KEYS = ['local_security_bps', 'food_coverage_bps', 'job_coverage_bps', 'service_coverage_bps', 'happiness_bps', 'housing_capacity']

export default function BuildingSheet({ building: b, canPlace, cat, store, onOpen, onBuild, onClose, onMine, onManage, canPublicBuild, onRun, startSite }: Props) {
  const now = useNow(1000)
  const names = useContentNames()
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
  useEffect(() => { if (startSite && id) setSite(true) }, [startSite, id])
  // desktop: this panel docks beside the world (web map 6.4); a phone gets the centred popup
  const side = useSide()
  const docked = !!side?.desktop
  const dockTitle = b ? buildingName(cat, b.type, panel?.building.name) : ''
  const closeAll = useCallback(() => { setAsk(null); onClose() }, [onClose])
  const claim = side?.claim
  useEffect(() => {
    if (!docked || !b || !claim) return
    return claim(dockTitle, closeAll)
  }, [docked, !!b, dockTitle, claim, closeAll])
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
      toast.push(t(kindOf === 'cancel' ? 'building.cancelled' : 'building.demolished'), { kind: 'success' })
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

  const footer = ask ? (
    <ActionRow>
      <ActionButton tone="steel" small onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</ActionButton>
      <ActionButton tone="red" small onClick={() => void run(ask)} disabled={busy}>{t('building.yes')}</ActionButton>
    </ActionRow>
  ) : (going && b.id) ? (
    <ActionButton tone="gold" onClick={() => setSite(true)}>{t('labor.btn.site')}</ActionButton>
  ) : (b.private && b.mine && !going && onMine) ? (
    <ActionRow>
      <ActionButton tone="green" small onClick={onMine}>{t('citizen.mine.rest')}</ActionButton>
      <ActionButton tone="steel" small onClick={onMine}>{t('citizen.bar.mine')}</ActionButton>
      {b.id && onManage && <ActionButton tone="gold" small onClick={() => onManage(b.id!)}>{t('lm.ring')}</ActionButton>}
    </ActionRow>
  ) : (!going && b.id && onManage && !b.private && canPublicBuild && b.type !== 'road') ? (
    <ActionButton tone="gold" onClick={() => onManage(b.id!)}>{t('lm.title')}</ActionButton>
  ) : (showUpgrade && !upgrade) ? (
    <ActionButton tone="gold" onClick={() => void reveal()}>{t('building.upgrade')}</ActionButton>
  ) : undefined

  const content = (
    <>
      <Hero>
        {going && <Gauge frac={p} color="var(--saffron)" numTone="gold" value={t('progress.percent', { p: Math.round(p * 100) })} caption={b.finish_at ? countdown(b.finish_at, now) : t('labor.btn.site')} />}
        <Medallion icon={icon} palette={palette} ring="#d99a1f" chip={t(`building.state.${b.state}` as Key)} />
      </Hero>

      {panel && <Note>{buildingBlurb(panel)}</Note>}

      <StatGrid>
        <StatCard icon="x_map" palette="sapphire" label={t('building.stat.spot')} value={t('building.at', { x: b.x + 1, y: b.y + 1 })} />
        <StatCard icon="box" palette="steel" label={t('building.stat.size')} value={`${b.w}×${b.h}`} />
        {b.private && <StatCard icon="person" palette={b.mine ? 'gold' : 'steel'} label={t('building.stat.owner')} value={b.mine ? t('building.stat.you') : (b.owner ?? '')} />}
        {!going && (panel?.upkeep ?? 0) > 0 && kind !== 'road' && !panel?.work?.condition && <StatCard icon="coins" palette="amber" label={t('building.stat.upkeep')} value={money(panel?.upkeep ?? 0)} />}
      </StatGrid>

      {going ? (
        !b.finish_at && <Note>{t('labor.by_work_hint')}</Note>
      ) : (
        <TypePanel kind={kind} panel={panel} names={names} onOpen={onOpen} onBuild={onBuild} onClose={onClose} manage={canAct} onAct={(c, a) => { void cmd(c, a, { write: true }).then((r) => { if (r.ok) void load(false) }) }} />
      )}
      {site && b.id && <SiteSheet buildingId={b.id} title={name} onClose={() => setSite(false)} />}

      {upgrade && <UpgradeList panel={panel} cat={cat} onRun={onRun} onOpen={(s) => onOpen?.(s)} onClose={onClose} onBuild={(c) => { onClose(); onBuild?.(c) }} />}

      {ask && <Note>{t(ask === 'cancel' ? 'building.confirm_cancel' : 'building.confirm_demolish')}</Note>}
      {going && canAct && ask === null && (
        <div className="vh-quiet">
          <button className="vh-linkbtn" onClick={() => setAsk('cancel')}>{t('building.cancel')}</button>
        </div>
      )}
      {/* the one destructive action: small, last, never the face of the panel */}
      {!going && canAct && ask === null && (
        <div className="vh-quiet">
          <button className="vh-linkbtn" onClick={() => setAsk('demolish')}>{t('building.demolish_small')}</button>
        </div>
      )}
    </>
  )
  if (docked) return side?.el ? createPortal(<div className="nx-scroll bp-dock">{content}{footer && <div className="bp-foot">{footer}</div>}</div>, side.el) : null
  return <Popup open onClose={closeAll} title={name} tone="gold" footer={footer}>{content}</Popup>
}

function TypePanel({ kind, panel, names, onOpen, onBuild, onClose, manage, onAct }: {
  onBuild?: Props['onBuild']
  manage: boolean
  onAct: (command: string, args: Record<string, string>) => void
  kind: string
  panel: BuildingPanelView | null
  names: ContentNames
  onOpen?: Props['onOpen']
  onClose: () => void
}) {
  if (!panel) return null
  const effects = (panel.effects ?? []).filter((e) => EFFECT_KEYS.includes(e.target))
  return (
    <>
      {kind === 'storage' && (
        <>
          <Section>{t('building.storage.title')}</Section>
          {(panel.stock ?? []).length === 0
            ? <Note>{t('building.storage.empty')}</Note>
            : (
              <StatGrid>
                {(panel.stock ?? []).map((s) => (
                  <StatCard key={s.item.code} icon="box" palette="amber" label={names.name(['component', 'item'], s.item.code, s.item.name)} value={formatNumber(s.qty)} />
                ))}
              </StatGrid>
            )}
          {onOpen && (
            <ActionButton tone="steel" small onClick={() => { onClose(); onOpen('village_storage') }}>{t('storage.open')}</ActionButton>
          )}
        </>
      )}
      {kind === 'shop' && panel.shop && (
        <>
          <Section>{t('sm.shop.title')}</Section>
          <Note>{panel.shop.closed ? t(`sm.shop.closed.${panel.shop.closed}` as Key) : t('sm.shop.open')}</Note>
          <StatGrid>
            <StatCard icon="box" palette="amber" label={t('sm.shop.lbl_price')} value={formatNumber((panel.shop.lines ?? []).length)} />
            <StatCard icon="coins" palette="gold" label={t('sm.shop.lbl_wage')} value={money(panel.shop.wage)} />
          </StatGrid>
          {onOpen && <ActionButton tone="gold" small onClick={() => { onClose(); onOpen('village_shop') }}>{t('sm.shop.open')}</ActionButton>}
        </>
      )}
      {kind === 'school' && (
        <>
          <ProgressRow frac={(panel.literacy_percent ?? 0) / 100} color="#8f7cff" icon="book" palette="violet" label={t('building.school.literacy', { p: panel.literacy_percent ?? 0 })} />
          <Note>{panel.teaching ? t('building.school.teaching') : t('building.school.idle')}</Note>
        </>
      )}
      {kind === 'civic_hall' && (
        <>
          <StatGrid>
            <StatCard icon="society" palette="emerald" label={t('building.civic.population')} value={formatNumber(panel.population ?? 0)} />
            <StatCard icon="coins" palette="gold" label={t('building.civic.treasury')} value={money(panel.treasury ?? 0)} />
          </StatGrid>
          <Note>
            {panel.research ? t('building.civic.research', { name: names.name('knowledge', panel.research.knowledge.code, panel.research.knowledge.name), t: `${durationText(panel.research.left_seconds)} ${endNote(panel.research.left_seconds)}`.trim() }) : t('building.civic.no_research')}
          </Note>
          {onOpen && (
            <div className="vh-doors">
              <ActionButton tone="steel" small onClick={() => { onClose(); onOpen('village_overview') }}>{t('building.civic.overview')}</ActionButton>
              <ActionButton tone="steel" small onClick={() => { onClose(); onOpen('village_knowledge') }}>{t('building.civic.knowledge')}</ActionButton>
              <ActionButton tone="steel" small onClick={() => { onClose(); onOpen('village_progress') }}>{t('building.civic.progress')}</ActionButton>
              <ActionButton tone="steel" small onClick={() => { onClose(); onOpen('village_storage') }}>{t('storage.open')}</ActionButton>
            </div>
          )}
        </>
      )}
      {panel.work && <WorkSection work={panel.work} names={names} onOpen={onOpen} onBuild={onBuild ? () => onBuild('tool_workshop') : undefined} onClose={onClose} manage={manage} act={onAct} buildingId={panel.id} />}
      {effects.length > 0 && (
        <EffectRow>
          {effects.map((e) => (
            <EffectChip key={e.target} tone="good">{t(`building.effect.${e.target}` as Key, { v: formatNumber(e.target === 'housing_capacity' ? e.value : Math.round(e.value / 100)) })}</EffectChip>
          ))}
        </EffectRow>
      )}
    </>
  )
}

function UpgradeList({ panel, cat, onOpen, onRun, onClose, onBuild }: { onRun?: (command: string) => void; panel: BuildingPanelView | null; cat: Map<string, CatalogueBuilding>; onOpen: (s: UpgradeScreen) => void; onClose: () => void; onBuild: (code: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const h = useUpgradeHandlers(cat, onOpen, (c) => c && onBuild(c), onClose, onBuild, onRun)
  const ups = panel?.upgrades ?? null
  if (!panel || panel.mode !== 'up') return <Note>…</Note>
  if (!ups || ups.length === 0) return <Note>{t('building.upgrade.none')}</Note>
  const models = ups.map((u) => ({ u, m: fromBuildingUpgrade(u, h) }))
  const sel = models.find((x) => x.u.building.code === open)
  return (
    <>
      <Section>{t('building.upgrade.intro')}</Section>
      <CardGrid>
        {models.map(({ u, m }) => (
          <PCard key={u.building.code} icon={m.available ? 'up' : 'scroll'} title={m.title} tone={m.available ? 'busy' : 'off'} off={!m.available}
            sub={`${money(u.cost_money)} – ${buildText(u)}`}
            facts={m.available ? t('v6.up.ready') : <span className="dk-why">{t('ug.blocked', { n: formatNumber(m.reqs.filter((r) => !r.ok).length) })}</span>}
            onClick={() => setOpen(u.building.code)} />
        ))}
      </CardGrid>
      {sel && <UpgradeCard m={sel.m} onClose={() => setOpen(null)} />}
    </>
  )
}
