import type { ScreenProps } from '../types'
import { Bar, Card, Empty, Header, ListRow, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, hms, moneyIn, roughDuration, type PlaceCurrency } from './kit/format'
import { buildingName, useBuildingCatalogue, useContentNames } from '../../village/useVillage'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface CurrentCourse { course?: Named; percent?: number; remaining_seconds?: number; paused?: boolean }
interface CourseLine { course?: Named; duration_seconds?: number; eligible?: boolean; fee?: number; min_level?: number }
interface Need { kind?: string; code?: string; role?: string; tier?: number }
interface Gap { course?: Named; fee?: number; duration_seconds?: number; nearest?: Named | null; needs?: Need[] | null }
interface Literacy { share_bps?: number; next_bps?: number; next_stage?: string }
interface EducationView {
  current?: CurrentCourse | null
  certificates?: Named[] | null
  place?: Named | null
  tier?: string
  currency?: PlaceCurrency | null
  literacy?: Literacy | null
  courses?: CourseLine[] | null
  elsewhere?: Gap[] | null
  empty?: string
  build?: Named | null
}

/** What this place teaches comes from what it has (research, a class, a teacher): the server lists only those, and the
 * courses it cannot teach as «not here» cards with where they are taught and what the head could do. */
export default function Education({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as EducationView
  const names = useContentNames()
  const cat = useBuildingCatalogue()
  if (loading && !response) return <ScreenScroll><Header title={t('education.title')} tone="violet" /></ScreenScroll>

  const course = (n?: Named) => (n?.code ? names.name('course', n.code, n.name) : n?.name ?? '—')
  const place = v.place?.name ?? ''
  const pct = (bps?: number) => Math.round((bps ?? 0) / 100)
  const lit = v.literacy
  const needText = (n: Need): string | null => {
    switch (n.kind) {
      case 'knowledge': return t('education.gap.need.knowledge', { name: names.name('knowledge', n.code ?? '', n.code) })
      case 'building': return t('education.gap.need.building', { name: n.code ? buildingName(cat, n.code) : names.name('building_role', n.role ?? '', n.role) })
      case 'teacher': return t('education.gap.need.teacher', { name: names.name('building_role', n.role ?? '', n.role) })
      default: return null
    }
  }

  return (
    <ScreenScroll>
      <Header title={t('education.title')} tone="violet" onRefresh={() => run('education.list')} />

      {lit && (
        <Card>
          <div className="nx-sec">{t('education.literacy.title')}</div>
          <div className="nx-bar-sub" style={{ margin: '4px 0 8px' }}>{t('education.literacy.first')}</div>
          <Bar
            frac={clamp01((lit.share_bps ?? 0) / Math.max(1, lit.next_bps || 10000))} color="var(--violet)"
            label={t('education.literacy.share', { p: pct(lit.share_bps), place })}
            sub={lit.next_bps ? t('education.literacy.next', { p: pct(lit.next_bps), stage: t(`eco.stage.${lit.next_stage ?? 'town'}` as Key) }) : undefined}
          />
        </Card>
      )}

      {v.current && (
        <Card tone="violet">
          <div className="nx-sec">{t('education.current')}</div>
          <div className="display" style={{ fontSize: 18, color: '#fff', margin: '4px 0 8px' }}>{course(v.current.course)}</div>
          <Bar frac={clamp01((v.current.percent ?? 0) / 100)} color="var(--violet)"
            label={v.current.paused ? t('education.paused') : t('common.left', { t: hms(v.current.remaining_seconds) })} />
        </Card>
      )}

      {v.empty === 'no_class' && (
        <Card>
          <div className="nx-sec">{t('education.empty.no_class')}</div>
          {v.build?.code && <div className="nx-bar-sub" style={{ marginTop: 6 }}>{t('education.empty.build', { name: buildingName(cat, v.build.code, v.build.name) })}</div>}
        </Card>
      )}
      {v.empty === 'nothing_taught' && <Empty>{t('education.empty.nothing', { place })}</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.courses ?? []).map((c, i) => (
          <ListRow
            key={c.course?.code ?? i}
            icon={c.eligible ? 'study' : 'm_lock'}
            palette={c.eligible ? 'violet' : 'steel'}
            title={course(c.course)}
            sub={`${c.fee ? moneyIn(c.fee, v.currency) : t('common.free')} · ${roughDuration(c.duration_seconds)}${!c.eligible && c.min_level ? ` · ${t('common.of_level', { n: c.min_level })}` : ''}`}
            onClick={() => c.eligible && c.course?.code && run('education.view', { course: c.course.code })}
          />
        ))}
      </div>

      {(v.elsewhere ?? []).map((g) => {
        const near = g.nearest?.name ? names.name('city', g.nearest.code ?? '', g.nearest.name) : ''
        const needs = (g.needs ?? []).map(needText).filter((x): x is string => !!x)
        return (
          <Card key={g.course?.code}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div className="display" style={{ fontSize: 15 }}>{course(g.course)}</div>
              <span className="nx-chip">{t('education.here_not')}</span>
            </div>
            <div className="nx-bar-sub" style={{ marginTop: 4 }}>{`${g.fee ? moneyIn(g.fee, v.currency) : t('common.free')} · ${roughDuration(g.duration_seconds)}`}</div>
            {near && <div className="nx-bar-sub" style={{ marginTop: 4 }}>{t('education.gap.taught_in', { place: near })}</div>}
            {needs.map((x) => <div key={x} className="nx-bar-sub" style={{ marginTop: 2 }}>{x}</div>)}
            {near && g.nearest?.code && (
              <div style={{ marginTop: 8 }}>
                <ListRow icon="plane" palette="teal" title={t('education.gap.go', { place: near })} onClick={() => run('travel.options', { city: g.nearest!.code! })} />
              </div>
            )}
          </Card>
        )
      })}

      {!!(v.certificates && v.certificates.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('education.certificates')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {v.certificates!.map((c) => <span key={c.code} className="nx-chip nx-chip-emerald">{course(c)}</span>)}
          </div>
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="education.list" />
    </ScreenScroll>
  )
}
