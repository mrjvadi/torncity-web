import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'

interface TravelOption { mode_code?: string; mode_name?: string; fare?: number; wait_seconds?: number; energy?: number; busy?: boolean }
interface TravelOptionsView { from?: string; to?: string; to_code?: string; cash?: number; options?: TravelOption[] | null }

const MODE_ICON: Record<string, string> = { bus: 'bus', car: 'x_car', train: 'train', flight: 'plane' }

export function TravelOptions({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as TravelOptionsView
  if (loading && !response) return <ScreenScroll><Header title="سفر" tone="teal" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={`سفر به ${v.to ?? ''}`} tone="teal" onRefresh={() => v.to_code && run('travel.options', { city: v.to_code })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.options ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={MODE_ICON[o.mode_code ?? ''] ?? 'plane'}
            palette="teal"
            title={o.mode_name ?? o.mode_code ?? '—'}
            sub={`${hms(o.wait_seconds)} · ${formatNumber(o.energy ?? 0)} انرژی${o.busy ? ' · شلوغ' : ''}`}
            right={money(o.fare)}
            onClick={() => v.to_code && o.mode_code && run('travel.start', { city: v.to_code, mode: o.mode_code, max: String(o.fare ?? 0) })}
          />
        ))}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="travel.options" />
    </ScreenScroll>
  )
}

interface TravelStatusView { from?: string; to?: string; mode_name?: string; remaining_seconds?: number }

export function TravelStatus({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as TravelStatusView
  if (loading && !response) return <ScreenScroll><Header title="سفر" tone="teal" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="در راه" tone="teal" onRefresh={() => run('travel.status')} />
      <Notice>{v.from ?? ''} ← {v.mode_name ?? ''} → {v.to ?? ''}</Notice>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div className="display" style={{ fontSize: 36, color: 'var(--firouzeh)' }}>{hms(v.remaining_seconds)}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>تا رسیدن</div>
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="travel.status" />
    </ScreenScroll>
  )
}
