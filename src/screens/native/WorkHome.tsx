import { useCallback, useState } from 'react'
import type { ScreenProps } from '../types'
import { Bar, Card, Chip, Empty, Header, Notice, ScreenScroll, SectionTitle } from './kit/Parts'
import { Slab } from '../../kit'
import { clamp01, formatNumber, hms, money, roughDuration } from './kit/format'
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

  const jobs = v.jobs ?? []
  const places = v.workplaces ?? []
  const left = v.working?.finish_at ? Math.max(0, (Date.parse(v.working.finish_at) - now) / 1000) : 0

  return (
    <ScreenScroll>
      <Header title={t('job.title')} tone="gold" onRefresh={() => void reload()} />

      {/* a village shift costs no energy (ADR 0038): the bar is for jobs that spend it */}
      {v.max_energy > 0 && v.place.tier !== 'village' && v.empty !== 'no_settlement' && (
        <Card>
          <Bar frac={clamp01(v.energy / v.max_energy)} color="var(--leaf)" label={t('work.energy', { a: formatNumber(v.energy), b: formatNumber(v.max_energy) })} />
        </Card>
      )}

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

          {jobs.length > 0 && <SectionTitle>{t('work.jobs')}</SectionTitle>}
          {jobs.map((j) => (
            <Card key={j.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{buildingName(cat, j.building.code, j.building.name)}</b>
                <Chip tone="gold">{t('labor.per_shift', { w: money(j.wage) })}</Chip>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 8px' }}>
                {t(j.kind === 'construction' ? 'labor.job.construction' : 'labor.job.production')} · {j.employer_kind === 'player' ? t('labor.employer.player', { name: j.employer }) : t('labor.employer.village')} · {t('labor.shifts_left', { n: j.left })}
              </div>
              {j.can_take
                ? <Slab tone="gold" radius={12} lip={3} disabled={busy || !!v.working} onClick={() => void act('settlement.labor.take', { id: j.id })}>{t('labor.work', { w: money(j.wage) })}</Slab>
                : <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('work.not_here')}</div>}
            </Card>
          ))}

          {places.length > 0 && <SectionTitle>{t('work.workplaces')}</SectionTitle>}
          {places.map((w) => {
            const full = w.busy >= w.workers
            const makes = (w.produces ?? []).map((m) => `${formatNumber(m.quantity)} ${names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ')
            return (
              <Card key={w.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{buildingName(cat, w.building.code, w.building.name)}</b>
                  <Chip tone="gold">{t('labor.per_shift', { w: money(w.wage) })}</Chip>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 8px' }}>
                  {makes && `${t('work.makes', { list: makes })} · `}{t('work.shift_len', { t: roughDuration(w.shift_seconds) })}
                </div>
                {!w.ready && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{t('work.needs_inputs')}</div>}
                {w.ready && full && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{t('work.full')}</div>}
                <Slab tone="gold" radius={12} lip={3} disabled={busy || !!v.working || !w.ready || full || !v.resident}
                  onClick={() => void act('settlement.work', { id: w.id })}>{t('work.start', { w: money(w.wage) })}</Slab>
              </Card>
            )
          })}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Slab tone="steel" radius={14} lip={4} onClick={() => run('settlement.labor.board')}>{t('labor.btn.board')}</Slab>
            <Slab tone="steel" radius={14} lip={4} onClick={() => run('settlement.labor.mine')}>{t('labor.btn.mine')}</Slab>
          </div>
        </>
      )}
    </ScreenScroll>
  )
}
