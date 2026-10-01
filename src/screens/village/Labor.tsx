// The village labour market: the hiring board, a construction site and "my
// work". A building is raised only by the work of shifts; here a player takes a
// job («کار کن (+مزد)»), the employer hires NPC labourers and sets the wage, and
// everyone sees the progress, who is working and how scarce labour is. The
// site panel is one component used three ways: a full screen (server screen
// labor_site), a portalled sheet (from the board and from a building's own
// sheet) and inside the board.

import { useCallback, useEffect, useState } from 'react'
import BottomSheet from '../../ui/BottomSheet'
import { Slab } from '../../kit'
import { Bar, Card, Chip, Empty, Header, Notice, ScreenScroll, SectionTitle, type Tone } from '../native/kit/Parts'
import { hms, money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { t, type Key } from '../../i18n'
import type { ScreenProps } from '../types'
import type { LaborBoardView, LaborJobView, LaborMarketView, LaborMineView, LaborShiftView, LaborSiteView } from '../../api/laborTypes'
import * as api from '../../api/client'
import { buildingName, useBuildingCatalogue, useNow, useSettlementId, useVillage, useVillageCommand } from '../../village/useVillage'
import { iconForRole, RowCard, ROLE_TONE, useVillageView } from './common'
import { useToast } from '../../state/ToastContext'
import './labor.css'

const MARKET_TONE: Record<string, Tone> = { slack: 'emerald', balanced: 'gold', tight: 'gold', short: 'ruby' }
const MARKET_COLOR: Record<string, string> = { slack: '#4cc47e', balanced: '#f2c255', tight: '#f5a11f', short: '#e5484d' }

const hours = (minutes: number) => (Math.max(0, minutes) / 60).toFixed(1)

// -- the market -----------------------------------------------------------------------------------------

function MarketCard({ m }: { m: LaborMarketView }) {
  const frac = Math.max(0.04, Math.min(1, m.tightness_bps / 20000))
  return (
    <Card tone={MARKET_TONE[m.level]}>
      <div className="lb-market-head">
        <span className="lb-market-title">{t('labor.market.title')}</span>
        <Chip tone={MARKET_TONE[m.level]}>{t(`labor.market.${m.level}` as Key)}</Chip>
      </div>
      <Bar frac={frac} color={MARKET_COLOR[m.level] ?? '#f2c255'} label={t('labor.market.pool', { a: formatNumber(m.available), p: formatNumber(m.pool) })} />
      <div className="lb-market-rows">
        <span>{t('labor.market.wage', { w: money(m.npc_wage) })}</span>
        <span>{t('labor.market.min', { w: money(m.min_wage) })}</span>
      </div>
      <div className="lb-hint">{t('labor.market.hint')}</div>
    </Card>
  )
}

// -- one worker on a site ----------------------------------------------------------------------------------

function ShiftRow({ s, now }: { s: LaborShiftView; now: number }) {
  const left = (Date.parse(s.finish_at) - now) / 1000
  return (
    <div className="lb-worker">
      <span className="lb-worker-name">{s.worker_npc ? t('labor.npc') : s.worker}</span>
      {!s.worker_npc && s.level && <Chip>{t(`labor.level.${s.level}` as Key)}</Chip>}
      <span className="lb-worker-time">{left > 0 ? hms(left) : t('labor.finishing')}</span>
    </div>
  )
}

// -- the site panel --------------------------------------------------------------------------------------------

export function useSite(id: string, initial: LaborSiteView | null) {
  const cmd = useVillageCommand()
  const toast = useToast()
  const [view, setView] = useState<LaborSiteView | null>(initial)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const r = await api.runCommand('settlement.labor.site', { id })
      if (r.view) setView(r.view as unknown as LaborSiteView)
    } catch {
      // keep the last view
    }
  }, [id])
  const act = useCallback(async (command: string, args: Record<string, string>) => {
    setBusy(true)
    const r = await cmd(command, args, { write: true })
    setBusy(false)
    if (!r.ok) return false
    const v = r.res?.view as unknown as LaborSiteView | undefined
    if (v && v.building) {
      setView(v)
      if (v.just) toast.push(t(`labor.just.${v.just}` as Key))
    } else {
      void refresh()
    }
    return true
  }, [cmd, toast, refresh])
  return { view, setView, refresh, act, busy }
}

export function SitePanel({ view: v, act, busy }: { view: LaborSiteView; act: (command: string, args: Record<string, string>) => Promise<boolean>; busy: boolean }) {
  const now = useNow(1000)
  const workers = v.workers ?? []
  const job = v.job
  const done = v.status === 'complete'
  const frac = v.progress_bps / 10000
  return (
    <div className="lb-site">
      {done
        ? <Notice>{t('labor.done')}</Notice>
        : (
          <Card tone="gold">
            <Bar frac={frac} color="#f5a11f" label={t('labor.progress', { p: Math.floor(v.progress_bps / 100) })} />
            <div className="lb-hours">{t('labor.hours', { done: hours(v.done_minutes), total: hours(v.required_minutes), left: hours(v.left_minutes) })}</div>
          </Card>
        )}

      {v.working && (
        <Notice>{t('labor.working', { t: hms(Math.max(0, (Date.parse(v.working.finish_at) - now) / 1000)) })}</Notice>
      )}
      {!done && job && v.can_work && (
        <Slab tone="gold" radius={16} lip={5} onClick={() => void act('settlement.labor.take', { id: job.id })} disabled={busy}>
          {t('labor.work', { w: money(v.work_wage) })}
        </Slab>
      )}
      {!done && job && !v.can_work && !v.working && <div className="lb-hint">{t('labor.cannot_work')}</div>}
      {!done && v.can_work && <div className="lb-hint">{t('labor.points', { m: v.work_points })}</div>}

      {!done && (
        <>
          <SectionTitle>{t('labor.workers')}</SectionTitle>
          {workers.length === 0
            ? <Empty>{t('labor.workers.none')}</Empty>
            : <Card><div className="lb-workers">{workers.map((s) => <ShiftRow key={s.id} s={s} now={now} />)}</div></Card>}
        </>
      )}

      {job && (
        <Card>
          <div className="lb-job-line"><span>{t('labor.wage_per_shift', { w: money(job.wage) })}</span><Chip>{t('labor.shifts_left', { n: job.left })}</Chip></div>
          <div className="lb-job-sub">{job.employer_kind === 'player' ? t('labor.employer.player', { name: job.employer }) : t('labor.employer.village')}</div>
          {job.npc_crew > 0 && <div className="lb-job-sub">{t('labor.crew', { n: job.npc_crew })}</div>}
        </Card>
      )}
      {!done && !job && <Empty>{t('labor.no_job')}</Empty>}

      {v.can_post && !done && (
        <Slab tone="steel" radius={14} lip={4} onClick={() => void act('settlement.labor.post', { id: v.id })} disabled={busy}>{t('labor.post')}</Slab>
      )}

      {v.can_employ && job && !done && (
        <Card tone="sapphire">
          <SectionTitle>{t('labor.hire')}</SectionTitle>
          <div className="lb-hint">{t('labor.hire_hint', { a: formatNumber(v.npc_available), w: money(v.npc_wage) })}</div>
          <div className="lb-btns">
            {(v.hire_presets ?? []).map((n) => (
              <Slab key={n} tone="blue" radius={12} lip={3} onClick={() => void act('settlement.labor.hire', { id: job.id, n: String(n) })} disabled={busy}>{t('labor.hire_n', { n })}</Slab>
            ))}
            {job.npc_crew > 0 && <Slab tone="steel" radius={12} lip={3} onClick={() => void act('settlement.labor.hire', { id: job.id, n: '0' })} disabled={busy}>{t('labor.hire_none')}</Slab>}
          </div>
          <SectionTitle>{t('labor.wage_set')}</SectionTitle>
          <div className="lb-btns">
            {(v.wage_presets ?? []).map((p) => (
              <Slab key={p.percent} tone={job.wage === p.wage ? 'gold' : 'steel'} radius={12} lip={3} onClick={() => void act('settlement.labor.wage', { id: job.id, n: String(p.percent) })} disabled={busy}>
                {money(p.wage)}
              </Slab>
            ))}
          </div>
          <Slab tone="red" radius={12} lip={3} onClick={() => void act('settlement.labor.close', { id: job.id })} disabled={busy}>{t('labor.close')}</Slab>
        </Card>
      )}

      <MarketCard m={v.market} />
    </div>
  )
}

/** The site as a portalled sheet: from the board, or from a building's own sheet. */
export function SiteSheet({ buildingId, title, onClose }: { buildingId: string | null; title: string; onClose: () => void }) {
  if (!buildingId) return null
  return <SiteSheetBody buildingId={buildingId} title={title} onClose={onClose} />
}

function SiteSheetBody({ buildingId, title, onClose }: { buildingId: string; title: string; onClose: () => void }) {
  const { tick } = useLiveTick()
  const { view, refresh, act, busy } = useSite(buildingId, null)
  useRefreshOn(refresh, tick)
  return (
    <BottomSheet open onClose={onClose} title={title}>
      {view ? <SitePanel view={view} act={act} busy={busy} /> : <Empty>…</Empty>}
    </BottomSheet>
  )
}


function useLiveTick() {
  const id = useSettlementId()
  const { tick } = useVillage(id)
  return { tick }
}

function useRefreshOn(refresh: () => Promise<void>, tick: number) {
  useEffect(() => { void refresh() }, [refresh, tick])
}

// -- the site as a screen ----------------------------------------------------------------------------------------

export function LaborSiteScreen({ response, openLocal }: ScreenProps) {
  const initial = (response?.view ?? null) as LaborSiteView | null
  const id = initial?.id ?? ''
  const { tick } = useLiveTick()
  const { view, refresh, act, busy } = useSite(id, initial)
  useRefreshOn(refresh, tick)
  const cat = useBuildingCatalogue()
  const title = view ? buildingName(cat, view.building.code, view.building.name) : t('labor.site.title')
  return (
    <ScreenScroll>
      <Header title={title} tone="gold" onBack={() => openLocal('village_labor')} />
      {view ? <SitePanel view={view} act={act} busy={busy} /> : <Empty>…</Empty>}
    </ScreenScroll>
  )
}

// -- the board ---------------------------------------------------------------------------------------------------------------

function JobCard({ j, now, onOpen, onTake, busy }: { j: LaborJobView; now: number; onOpen: () => void; onTake: () => void; busy: boolean }) {
  const cat = useBuildingCatalogue()
  const role = cat.get(j.building.code)?.category
  const { icon, palette } = iconForRole(role)
  const construction = j.kind === 'construction'
  void now
  return (
    <RowCard
      tone={ROLE_TONE[role ?? ''] === 'gold' ? undefined : ROLE_TONE[role ?? '']}
      icon={icon} palette={palette}
      title={buildingName(cat, j.building.code, j.building.name)}
      sub={`${t(construction ? 'labor.job.construction' : 'labor.job.production')} · ${j.employer_kind === 'player' ? t('labor.employer.player', { name: j.employer }) : t('labor.employer.village')}`}
      right={<Chip tone="gold">{t('labor.per_shift', { w: money(j.wage) })}</Chip>}
    >
      {construction && (
        <>
          <Bar frac={j.progress_bps / 10000} color="#f5a11f" label={t('labor.progress', { p: Math.floor(j.progress_bps / 100) })} />
          <div className="lb-hours">{t('labor.left_hours', { left: hours(j.left_minutes), n: j.workers })}</div>
        </>
      )}
      <div className="lb-btns">
        {j.can_take && <Slab tone="gold" radius={12} lip={3} onClick={onTake} disabled={busy}>{t('labor.work', { w: money(j.wage) })}</Slab>}
        <Slab tone="steel" radius={12} lip={3} onClick={onOpen}>{t('labor.btn.site')}</Slab>
      </div>
    </RowCard>
  )
}

export function LaborBoard({ response, openLocal, run }: ScreenProps) {
  const now = useNow(1000)
  const cat = useBuildingCatalogue()
  const cmd = useVillageCommand()
  const toast = useToast()
  const { view: v, loading, refresh } = useVillageView<LaborBoardView>('settlement.labor.board', response)
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function take(j: LaborJobView) {
    setBusy(true)
    const r = await cmd('settlement.labor.take', { id: j.id }, { write: true })
    setBusy(false)
    if (r.ok) {
      toast.push(t('labor.just.worked'))
      void refresh()
    }
  }
  async function post(id: string) {
    const r = await cmd('settlement.labor.post', { id }, { write: true })
    if (r.ok) { toast.push(t('labor.just.posted')); void refresh() }
  }

  const jobs = v?.jobs ?? []
  return (
    <ScreenScroll>
      <Header title={t('labor.board.title')} tone="gold" onBack={() => openLocal('village_home')} onRefresh={() => void refresh()} />
      {loading && !v && <Empty>…</Empty>}
      {v && (
        <>
          {v.working && (
            <Notice>{t('labor.working', { t: hms(Math.max(0, (Date.parse(v.working.finish_at) - now) / 1000)) })} · {buildingName(cat, v.working.building.code, v.working.building.name)}</Notice>
          )}
          {!v.resident && <div className="lb-hint">{t('labor.not_resident')}</div>}
          {jobs.length === 0 && <Empty>{t('labor.board.empty')}</Empty>}
          <div className="lb-list">
            {jobs.map((j) => (
              <JobCard key={j.id} j={j} now={now} busy={busy}
                onOpen={() => setOpen({ id: j.building_id, title: buildingName(cat, j.building.code, j.building.name) })}
                onTake={() => void take(j)} />
            ))}
          </div>
          {(v.sites ?? []).length > 0 && (
            <>
              <SectionTitle>{t('labor.board.sites')}</SectionTitle>
              <div className="lb-list">
                {(v.sites ?? []).map((s) => {
                  const { icon, palette } = iconForRole(cat.get(s.building.code)?.category)
                  return (
                    <RowCard key={s.id} icon={icon} palette={palette} title={buildingName(cat, s.building.code, s.building.name)}
                      sub={t('labor.progress', { p: Math.floor(s.progress_bps / 100) })}>
                      <div className="lb-btns">
                        <Slab tone="gold" radius={12} lip={3} onClick={() => void post(s.id)}>{t('labor.post')}</Slab>
                      </div>
                    </RowCard>
                  )
                })}
              </div>
            </>
          )}
          <MarketCard m={v.market} />
          <div className="lb-btns">
            <Slab tone="steel" radius={14} lip={4} onClick={() => run('settlement.labor.mine')}>{t('labor.btn.mine')}</Slab>
            <Slab tone="steel" radius={14} lip={4} onClick={() => run('settlement.work')}>{t('vx.work.open')}</Slab>
          </div>
        </>
      )}
      <SiteSheet buildingId={open?.id ?? null} title={open?.title ?? ''} onClose={() => { setOpen(null); void refresh() }} />
    </ScreenScroll>
  )
}

// -- my work ---------------------------------------------------------------------------------------------------------------------

export function LaborMine({ response, openLocal, run }: ScreenProps) {
  const now = useNow(1000)
  const cat = useBuildingCatalogue()
  const { view: v, loading, refresh } = useVillageView<LaborMineView>('settlement.labor.mine', response)
  return (
    <ScreenScroll>
      <Header title={t('labor.mine.title')} tone="gold" onBack={() => openLocal('village_labor')} onRefresh={() => void refresh()} />
      {loading && !v && <Empty>…</Empty>}
      {v && (
        <>
          <Card tone="gold">
            <div className="lb-market-head">
              <span className="lb-market-title">{t(`labor.level.${v.level}` as Key)}</span>
              <Chip tone="gold">{t('labor.mine.productivity', { p: Math.floor(v.productivity_bps / 100) })}</Chip>
            </div>
            <div className="lb-stats">
              <div><div className="nx-stat-label">{t('labor.mine.shifts')}</div><div className="display lb-stat">{formatNumber(v.shifts)}</div></div>
              <div><div className="nx-stat-label">{t('labor.mine.earned')}</div><div className="display lb-stat lb-gold">{money(v.earned)}</div></div>
            </div>
            {v.next_level && <div className="lb-hint">{t('labor.mine.next', { n: v.next_shifts, l: t(`labor.level.${v.next_level}` as Key) })}</div>}
          </Card>
          {v.working
            ? <Notice>{t('labor.working', { t: hms(Math.max(0, (Date.parse(v.working.finish_at) - now) / 1000)) })} · {buildingName(cat, v.working.building.code, v.working.building.name)}</Notice>
            : <Empty>{t('labor.mine.idle')}</Empty>}
          <MarketCard m={v.market} />
          <div className="lb-btns">
            <Slab tone="gold" radius={14} lip={4} onClick={() => run('settlement.labor.board')}>{t('labor.btn.board')}</Slab>
          </div>
        </>
      )}
    </ScreenScroll>
  )
}
