import type { ScreenProps } from '../types'
import { Bar, Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms } from './kit/format'

interface Named { code?: string; name?: string }
interface CrimeHubView {
  city?: string; venue?: Named
  nerve?: { nerve?: number; max?: number; full_in_seconds?: number }
  heat?: { heat?: number; max?: number; wanted?: number; stars?: number }
  tier?: { tier?: Named; xp?: number; next?: Named; next_xp?: number }
  travelling?: boolean
  jail?: { remaining_seconds?: number } | null
  busy?: { remaining_seconds?: number } | null
  categories?: Named[] | null
}

export default function CrimeHub({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeHubView
  if (loading && !response) return <ScreenScroll><Header title="جرم" tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="جرم" tone="ruby" onRefresh={() => run('crime.hub')} />

      {v.jail && <Notice alert>در زندان · {hms(v.jail.remaining_seconds)} مانده</Notice>}
      {v.busy && <Notice>جرم در حال انجام · {hms(v.busy.remaining_seconds)} مانده</Notice>}
      {v.travelling && <Notice alert>در سفر هستی؛ نمی‌توانی جرم انجام بدهی.</Notice>}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {v.heat && (
            <Bar frac={v.heat.max ? clamp01((v.heat.heat ?? 0) / v.heat.max) : 0} color="var(--saffron)"
              label={`داغی ${formatNumber(v.heat.heat ?? 0)}`}
              sub={v.heat.wanted ? `${formatNumber(v.heat.wanted)} تحت تعقیب` : undefined} />
          )}
          {v.nerve && (
            <Bar frac={v.nerve.max ? clamp01((v.nerve.nerve ?? 0) / v.nerve.max) : 0} color="var(--anar)"
              label={`عصب ${formatNumber(v.nerve.nerve ?? 0)}/${formatNumber(v.nerve.max ?? 0)}`}
              sub={!v.nerve.max || (v.nerve.nerve ?? 0) < v.nerve.max ? `پر در ${hms(v.nerve.full_in_seconds)}` : undefined} />
          )}
        </div>
        {v.venue?.name && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>مکان: {v.venue.name}</div>}
        {v.tier?.tier?.name && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            رتبه: {v.tier.tier.name} {v.tier.next?.name ? `· بعدی: ${v.tier.next.name} (${formatNumber(v.tier.xp ?? 0)}/${formatNumber(v.tier.next_xp ?? 0)})` : ''}
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.categories ?? []).map((c) => (
          <ListRow key={c.code} icon="crime" palette="ruby" title={c.name ?? c.code ?? '—'}
            onClick={() => c.code && run('crime.list', { category: c.code })} />
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface CrimeLine { crime?: Named; duration_seconds?: number; eligible?: boolean; nerve?: number }
interface CrimeListView { category?: Named; crimes?: CrimeLine[] | null; page?: number; pages?: number }

export function CrimeList({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeListView
  if (loading && !response) return <ScreenScroll><Header title="جرم" tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.category?.name ?? 'جرم'} tone="ruby" onBack={() => run('crime.hub')} onRefresh={() => v.category?.code && run('crime.list', { category: v.category.code })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.crimes ?? []).map((c, i) => (
          <ListRow
            key={i}
            icon={c.eligible ? 'crime' : 'm_lock'}
            palette={c.eligible ? 'ruby' : 'steel'}
            title={c.crime?.name ?? c.crime?.code ?? '—'}
            sub={`${formatNumber(c.nerve ?? 0)} عصب${c.duration_seconds ? ` · ${hms(c.duration_seconds)}` : ''}`}
            onClick={() => c.eligible && c.crime?.code && run('crime.view', { crime: c.crime.code })}
          />
        ))}
      </div>
      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
