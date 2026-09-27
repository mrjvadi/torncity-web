import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, Ring, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'

interface JobRef { career_name?: string; title?: string }
interface Requirement { kind?: string; have?: number; need?: number; met?: boolean }
interface JobStatusView {
  employed?: boolean
  job?: JobRef; employer?: string; city?: string
  pay?: number; energy_cost?: number; energy?: number; max_energy?: number
  performance?: number; shifts_in_tier?: number; total_earned?: number
  at_workplace?: boolean; top_tier?: boolean
  shift_length_seconds?: number
  workplace?: { name?: string }; walk_to_work_seconds?: number
  shift?: { remaining_seconds?: number } | null
  next?: JobRef; promotion_ready?: boolean; missing?: Requirement[] | null
}

export default function JobStatus({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as JobStatusView
  if (loading && !response) return <ScreenScroll><Header title="کار" tone="gold" /></ScreenScroll>

  if (!v.employed) {
    return (
      <ScreenScroll>
        <Header title="کار" tone="gold" onRefresh={() => run('job.status')} />
        <Notice>هنوز شغلی نداری.</Notice>
        <Actions response={response} onAction={onAction} />
      </ScreenScroll>
    )
  }

  return (
    <ScreenScroll>
      <Header title="کار" tone="gold" onRefresh={() => run('job.status')} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring frac={clamp01((v.performance ?? 0) / 100)} color="var(--leaf)" size={90}>
            <span className="display" style={{ fontSize: 22, color: '#fff' }}>{formatNumber(v.performance ?? 0)}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>عملکرد</span>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 18, color: '#fff' }}>{v.job?.title ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
              {[v.job?.career_name, v.employer || v.city].filter(Boolean).join(' · ')}
            </div>
            <span className="nx-chip nx-chip-gold">{money(v.pay)} هر شیفت</span>{' '}
            <span className="nx-chip">{formatNumber(v.shifts_in_tier ?? 0)} شیفت</span>
          </div>
        </div>
      </Card>

      {v.shift ? (
        <Notice>شیفت در حال انجام · {hms(v.shift.remaining_seconds)} مانده</Notice>
      ) : !v.at_workplace && v.workplace ? (
        <Notice>{hms(v.walk_to_work_seconds)} پیاده تا {v.workplace.name}</Notice>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ListRow icon="check" palette="emerald" tone="emerald" title={v.job?.title ?? '—'} sub="جایگاه فعلی" />
        {!v.top_tier && v.next && (
          <ListRow
            icon={v.promotion_ready ? 'check' : 'clock'}
            palette={v.promotion_ready ? 'emerald' : 'steel'}
            title={v.next.title ?? '—'}
            sub={v.promotion_ready ? 'آماده‌ی ترفیع' : 'مرحله‌ی بعد'}
          />
        )}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
