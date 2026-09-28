// The job board, past job_status (src/screens/native/JobStatus.tsx): every
// opening in the city, and one opening's requirements before applying.
// internal/telegram/screens/jobs.go (JobOpeningsView, JobDetailView).

import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { formatNumber, hms, money } from '../native/kit/format'

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
  if (loading && !response) return <ScreenScroll><Header title="فرصت‌های شغلی" tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="فرصت‌های شغلی" tone="gold" onBack={() => run('job.status')} onRefresh={() => run('job.list', { page: String(v.page ?? 1) })} />

      {v.travelling && <Notice alert>در سفر هستی؛ اینجا کاری پیدا نمی‌کنی.</Notice>}
      {v.employed && v.current?.title && <Notice>الان {v.current.title} هستی.</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.openings ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={o.eligible ? 'work' : 'm_lock'}
            palette={o.eligible ? 'gold' : 'steel'}
            title={o.job?.title ?? '—'}
            sub={`${o.job?.career_name ?? ''} · ${money(o.pay)}`}
            onClick={() => o.job?.career_code && run('job.view', { role: o.job.career_code })}
          />
        ))}
        {(v.companies ?? []).map((o, i) => (
          <ListRow
            key={`c${i}`}
            icon={o.eligible ? 'factory' : 'm_lock'}
            palette={o.eligible ? 'sapphire' : 'steel'}
            title={o.job?.title ?? '—'}
            sub={`${o.company ?? ''} · ${money(o.pay)}`}
            onClick={() => o.no !== undefined && run('company.opening', { no: String(o.no) })}
          />
        ))}
      </div>

      {!(v.openings?.length || v.companies?.length) && !v.travelling && <Notice>در حال حاضر فرصتی نیست.</Notice>}
      {!!v.pages && v.pages > 1 && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>صفحه {formatNumber(v.page ?? 1)} از {formatNumber(v.pages)}</div>
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
  switch (r.kind) {
    case 'level': return `سطح ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'skill': return `مهارت ${r.skill ?? ''} سطح ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'certificate': return `مدرک ${r.course_name ?? r.course_code ?? '—'}`
    case 'residence': return `اقامت در ${r.city ?? '—'}`
    case 'performance': return `عملکرد ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'time': return `${hms(r.wait_seconds)} دیگر`
    case 'shifts': return `${formatNumber(r.need ?? 0)} شیفت`
    case 'top': return 'بالاترین درجه'
    case 'course_city': return `دوره در ${r.city ?? '—'}`
    case 'course_full': return 'ظرفیت دوره پر است'
    case 'already_certified': return 'قبلاً این مدرک را داری'
    case 'already_enrolled': return `در حال گذراندن ${r.course_name ?? '—'} هستی`
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
  if (loading && !response) return <ScreenScroll><Header title="فرصت شغلی" tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.job?.title ?? 'فرصت شغلی'} tone="gold" onBack={() => run('job.list')} />

      <Card>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{v.job?.career_name} · {v.city}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <span className="nx-chip nx-chip-gold">{money(v.pay)} هر شیفت</span>
          {!!v.energy_cost && <span className="nx-chip">{formatNumber(v.energy_cost)} انرژی هر شیفت</span>}
        </div>
      </Card>

      {v.employed && !v.can_apply && <Notice alert>الان شاغل هستی؛ اول باید استعفا بدهی.</Notice>}

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
