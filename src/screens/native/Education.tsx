import type { ScreenProps } from '../types'
import { Bar, Card, Header, ListRow, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, hms, money } from './kit/format'
import { t } from '../../i18n'

interface Named { code?: string; name?: string }
interface CurrentCourse { course?: Named; percent?: number; remaining_seconds?: number; paused?: boolean }
interface CourseLine { course?: Named; duration_seconds?: number; eligible?: boolean; fee?: number; min_level?: number }
interface EducationView {
  current?: CurrentCourse | null
  certificates?: Named[] | null
  courses?: CourseLine[] | null
}

export default function Education({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as EducationView
  if (loading && !response) return <ScreenScroll><Header title={t('education.title')} tone="violet" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('education.title')} tone="violet" onRefresh={() => run('education.list')} />

      {v.current && (
        <Card tone="violet">
          <div className="nx-sec">{t('education.current')}</div>
          <div className="display" style={{ fontSize: 18, color: '#fff', margin: '4px 0 8px' }}>{v.current.course?.name}</div>
          <Bar frac={clamp01((v.current.percent ?? 0) / 100)} color="var(--violet)"
            label={v.current.paused ? t('education.paused') : t('common.left', { t: hms(v.current.remaining_seconds) })} />
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.courses ?? []).map((c, i) => (
          <ListRow
            key={i}
            icon={c.eligible ? 'study' : 'm_lock'}
            palette={c.eligible ? 'violet' : 'steel'}
            title={c.course?.name ?? c.course?.code ?? '—'}
            sub={`${c.fee ? money(c.fee) : t('common.free')} · ${hms(c.duration_seconds)}${c.min_level ? ` · ${t('common.of_level', { n: c.min_level })}` : ''}`}
            onClick={() => c.eligible && c.course?.code && run('education.view', { course: c.course.code })}
          />
        ))}
      </div>

      {!!(v.certificates && v.certificates.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('education.certificates')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {v.certificates!.map((c) => <span key={c.code} className="nx-chip nx-chip-emerald">{c.name}</span>)}
          </div>
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="education.list" />
    </ScreenScroll>
  )
}
