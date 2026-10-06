import { useCallback, useState } from 'react'
import type { ScreenProps } from '../types'
import { Card, Empty, Header, Notice, ScreenScroll, SectionTitle } from './kit/Parts'
import { CardGrid, PCard, PTile } from '../../ui/v6/panel'
import { Lines, Need } from './kit/cardparts'
import { Slab } from '../../kit'
import { formatNumber, hms, money, roughDuration } from './kit/format'
import * as api from '../../api/client'
import type { WorkHomeView } from '../../api/views.gen'
import { buildingName, useBuildingCatalogue, useContentNames, useNow, useVillageCommand } from '../../village/useVillage'
import { useToast } from '../../state/ToastContext'
import { t, type Key } from '../../i18n'

/** «کار»: the one work screen (ADR 0038 4.1). Both doors open it: Activities → کار and the village menu → کار.
 * The shift now, the jobs on the board, the workplaces to start a shift at, or why there is nothing and the one step. */
export default function WorkHome({ response, run, openLocal }: ScreenProps) {
  const [view, setView] = useState<WorkHomeView | null>(null)
  const v = view ?? ((response?.view ?? null) as WorkHomeView | null)
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  const cmd = useVillageCommand()
  const toast = useToast()
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api.runCommand('work.home', {})
      if (r.view) setView(r.view as unknown as WorkHomeView)
    } catch { /* keep the last view */ }
  }, [])

  async function act(command: string, args: Record<string, string>) {
    setBusy(true)
    const r = await cmd(command, args, { write: true })
    setBusy(false)
    if (r.ok) { toast.push(t('labor.just.worked'), { kind: 'success' }); void reload() }
  }

  if (!v) return <ScreenScroll><Header title={t('job.title')} tone="gold" /><Empty>{t('common.loading')}</Empty></ScreenScroll>

  const allJobs = v.jobs ?? []
  // road segments come as dozens of identical cards: one group card, expandable
  const roadJobs = allJobs.filter((j) => j.building.code === 'road')
  const grouped = roadJobs.length >= 3
  const jobs = grouped ? allJobs.filter((j) => j.building.code !== 'road') : allJobs
  const takeable = roadJobs.filter((j) => j.can_take).sort((a, b) => b.wage - a.wage)
  const best = takeable[0]
  const places = v.workplaces ?? []
  const left = v.working?.finish_at ? Math.max(0, (Date.parse(v.working.finish_at) - now) / 1000) : 0

  const JobCards = ({ list }: { list: typeof allJobs }) => (
    <CardGrid>
            {list.map((j) => (
              <PCard key={j.id} icon="tool" title={buildingName(cat, j.building.code, j.building.name)}
                badge={t('labor.per_shift', { w: money(j.wage) })} tone="busy" off={!j.can_take}
                facts={<>
                  <Lines lines={[
                    j.kind === 'construction' ? t('labor.job.site', { x: formatNumber(j.lot_x), y: formatNumber(j.lot_y), p: formatNumber(Math.floor(j.progress_bps / 100)) }) : t('labor.job.production'),
                    j.employer_kind === 'player' ? t('labor.employer.player', { name: j.employer }) : t('labor.employer.village'),
                    t('labor.shifts_left', { n: j.left }),
                  ]} />
                  {!j.can_take && <Need lines={[t('work.not_here')]} />}
                </>}
                foot={j.can_take
                  ? <button className={`pn-btn${busy || v.working ? ' dis' : ''}`} disabled={busy || !!v.working} onClick={() => void act('settlement.labor.take', { id: j.id })}>{t('labor.work', { w: money(j.wage) })}</button>
                  : undefined} />
            ))}
          </CardGrid>
  )

  return (
    <ScreenScroll>
      <Header title={t('job.title')} tone="gold" onRefresh={() => void reload()} />

      {v.empty === 'no_settlement' ? (
        <>
          <Empty>{t('work.empty.no_settlement')}</Empty>
          <Slab tone="gold" radius={14} lip={4} onClick={() => run('job.status')}>{t('work.career')}</Slab>
        </>
      ) : (
        <>
          <SectionTitle>{t('work.now')}</SectionTitle>
          {v.working
            ? <Notice>{buildingName(cat, v.working.building.code, v.working.building.name)} · {t('labor.working', { t: hms(left) })}</Notice>
            : <Empty>{t('work.idle')}</Empty>}

          {v.empty && (
            <Card>
              <div style={{ fontSize: 14 }}>{t(`work.empty.${v.empty}` as Key)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', margin: '8px 0' }}>{t(`work.next.${v.next}` as Key)}</div>
              {v.next === 'build' && <Slab tone="gold" radius={14} lip={4} onClick={() => openLocal('village_home')}>{t('work.next.build')}</Slab>}
            </Card>
          )}

          <div className="hub-grid">
            <PTile icon="tool" title={t('labor.btn.board')} onClick={() => run('settlement.labor.board')} />
            <PTile icon="info" title={t('labor.btn.mine')} onClick={() => run('settlement.labor.mine')} />
            <PTile icon="book" title={t('ac.work.openings.title')} onClick={() => run('job.list')} />
            <PTile icon="person" title={t('work.career')} onClick={() => run('job.status')} />
          </div>
          {places.length > 0 && <SectionTitle>{t('work.workplaces')}</SectionTitle>}
          <CardGrid>
            {places.map((w) => {
              const full = w.busy >= w.workers
              const makes = (w.produces ?? []).map((m) => `${formatNumber(m.quantity)} ${names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ')
              const off = busy || !!v.working || !w.ready || full || !v.resident
              return (
                <PCard key={w.id} icon="tool" title={buildingName(cat, w.building.code, w.building.name)}
                  badge={t('labor.per_shift', { w: money(w.wage) })} tone="busy"
                  facts={<>
                    <Lines lines={[makes && t('work.makes', { list: makes }), t('work.shift_len', { t: roughDuration(w.shift_seconds) })]} />
                    <Need lines={[!w.ready ? t('work.needs_inputs') : '', w.ready && full ? t('work.full') : ''].filter(Boolean)} />
                  </>}
                  foot={<button className={`pn-btn${off ? ' dis' : ''}`} disabled={off} onClick={() => void act('settlement.work', { id: w.id })}>{t('work.start', { w: money(w.wage) })}</button>} />
              )
            })}
          </CardGrid>

          {(jobs.length > 0 || grouped) && <SectionTitle>{t('work.jobs')}</SectionTitle>}
          {grouped && (
            <CardGrid>
              <PCard icon="tool" title={t('work.road_group', { n: formatNumber(roadJobs.length) })}
                badge={best ? t('work.road_best', { w: money(best.wage) }) : undefined} tone="busy" off={!best}
                facts={<Lines lines={[t('work.road_hint')]} />}
                foot={(
                  <>
                    {best && <button className={`pn-btn${busy || v.working ? ' dis' : ''}`} disabled={busy || !!v.working} onClick={() => void act('settlement.labor.take', { id: best.id })}>{t('labor.work', { w: money(best.wage) })}</button>}
                    <button className="pn-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? t('work.road_hide') : t('work.road_show')}</button>
                  </>
                )} />
            </CardGrid>
          )}
          {grouped && open && <JobCards list={roadJobs} />}
          {jobs.length > 0 && <JobCards list={jobs} />}
        </>
      )}
    </ScreenScroll>
  )
}
