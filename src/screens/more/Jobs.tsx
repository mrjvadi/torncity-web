// The job board, past job_status (src/screens/native/JobStatus.tsx): every
// opening in the city, and one opening's requirements before applying.
// internal/telegram/screens/jobs.go (JobOpeningsView, JobDetailView).

import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { formatNumber, hms, money } from '../native/kit/format'
import { t } from '../../i18n'

interface JobRef { career_code?: string; career_name?: string; rank?: string; title?: string }
interface JobOpening { job?: JobRef; pay?: number; eligible?: boolean }
interface CompanyJobOpening { no?: number; company?: string; job?: JobRef; pay?: number; eligible?: boolean }

interface JobOpeningsView {
  city?: string; city_code?: string
  travelling?: boolean
  employed?: boolean; current?: JobRef
  openings?: JobOpening[] | null
  companies?: CompanyJobOpening[] | null
  page?: number; pages?: number
}

export function JobOpenings({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as JobOpeningsView
  if (loading && !response) return <ScreenScroll><Header title={t('jobs.board')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('jobs.board')} tone="gold" onBack={() => run('job.status')} onRefresh={() => run('job.list', { page: String(v.page ?? 1) })} />

      {v.travelling && <Notice alert>{t('jobs.travelling')}</Notice>}
      {v.employed && v.current?.title && <Notice>{t('jobs.current', { title: v.current.title })}</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.openings ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={o.eligible ? 'work' : 'm_lock'}
            palette={o.eligible ? 'gold' : 'steel'}
            title={o.job?.title ?? '—'}
            sub={`${o.job?.career_name ?? ''} – ${money(o.pay)}`}
            onClick={() => o.job?.career_code && run('job.view', { role: o.job.career_code })}
          />
        ))}
        {(v.companies ?? []).map((o, i) => (
          <ListRow
            key={`c${i}`}
            icon={o.eligible ? 'factory' : 'm_lock'}
            palette={o.eligible ? 'sapphire' : 'steel'}
            title={o.job?.title ?? '—'}
            sub={`${o.company ?? ''} – ${money(o.pay)}`}
            onClick={() => o.no !== undefined && run('company.opening', { no: String(o.no) })}
          />
        ))}
      </div>

      {!(v.openings?.length || v.companies?.length) && !v.travelling && <Notice>{t('jobs.none')}</Notice>}
      {!!v.pages && v.pages > 1 && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>{t('jobs.page', { a: formatNumber(v.page ?? 1), b: formatNumber(v.pages) })}</div>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface Requirement {
  kind?: string; met?: boolean; need?: number; have?: number
  skill?: string; course_code?: string; course_name?: string
  city_code?: string; city?: string; wait_seconds?: number
}

function reqLabel(r: Requirement): string {
  const have = !r.met ? ` ${t('req.have', { have: formatNumber(r.have ?? 0) })}` : ''
  switch (r.kind) {
    case 'level': return t('req.level', { need: formatNumber(r.need ?? 0) }) + have
    case 'skill': return t('req.skill', { skill: r.skill ?? '', need: formatNumber(r.need ?? 0) }) + have
    case 'certificate': return t('req.certificate', { name: r.course_name ?? r.course_code ?? '—' })
    case 'residence': return t('req.residence', { city: r.city ?? '—' })
    case 'performance': return t('req.performance', { need: formatNumber(r.need ?? 0) }) + have
    case 'time': return t('req.time', { t: hms(r.wait_seconds) })
    case 'shifts': return t('req.shifts', { n: formatNumber(r.need ?? 0) })
    case 'top': return t('req.top')
    case 'course_city': return t('req.course_city', { city: r.city ?? '—' })
    case 'course_full': return t('req.course_full')
    case 'already_certified': return t('req.already_certified')
    case 'already_enrolled': return t('req.already_enrolled', { name: r.course_name ?? '—' })
    default: return '—'
  }
}

interface JobDetailView {
  job?: JobRef; city?: string; city_code?: string
  pay?: number; energy_cost?: number
  requirements?: Requirement[] | null
  can_apply?: boolean; employed?: boolean
}

export function JobDetail({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as JobDetailView
  if (loading && !response) return <ScreenScroll><Header title={t('jobs.detail')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.job?.title ?? t('jobs.detail')} tone="gold" onBack={() => run('job.list')} />

      <Card>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{v.job?.career_name} – {v.city}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <span className="nx-chip nx-chip-gold">{t('job.per_shift', { pay: money(v.pay) })}</span>
          {!!v.energy_cost && <span className="nx-chip">{t('jobs.energy_per_shift', { n: formatNumber(v.energy_cost) })}</span>}
        </div>
      </Card>

      {v.employed && !v.can_apply && <Notice alert>{t('jobs.employed_first')}</Notice>}

      {!!(v.requirements && v.requirements.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.requirements!.map((r, i) => (
            <ListRow key={i} icon={r.met ? 'check' : 'm_lock'} palette={r.met ? 'emerald' : 'steel'} title={reqLabel(r)} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
