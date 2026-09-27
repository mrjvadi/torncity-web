import type { ScreenProps } from '../types'
import { Bar, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'

interface Named { code?: string; name?: string }
const OFFICE_FA: Record<string, string> = { mayor: 'شهردار', deputy_mayor: 'معاون شهردار', city_council: 'شورای شهر', president: 'رئیس‌جمهور' }
const PHASE_FA: Record<string, string> = { candidacy: 'نامزدی', voting: 'رای‌گیری', counting: 'در حال شمارش', counted: 'پایان‌یافته' }

interface ElectionLine { no?: number; office?: string; place?: Named; seats?: number; phase?: string; remaining_seconds?: number; candidates?: number; elected?: Named[] | null }
interface ElectionsView { no_city?: boolean; place?: Named; elections?: ElectionLine[] | null }

export function Elections({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ElectionsView
  if (loading && !response) return <ScreenScroll><Header title="انتخابات" tone="violet" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title="انتخابات" tone="violet" /><Notice>در هیچ شهری نیستی.</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="انتخابات" tone="violet" onRefresh={() => run('election.list')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.elections ?? []).map((e, i) => (
          <ListRow
            key={i}
            icon="vote"
            palette="violet"
            title={`${OFFICE_FA[e.office ?? ''] ?? e.office} · ${e.place?.name ?? ''}`}
            sub={e.phase === 'counted'
              ? (e.elected?.length ? `برنده: ${e.elected.map((p) => p.name).join('، ')}` : 'شمارش پایان یافت')
              : `${PHASE_FA[e.phase ?? ''] ?? e.phase} · ${formatNumber(e.candidates ?? 0)} نامزد${e.remaining_seconds ? ` · ${hms(e.remaining_seconds)}` : ''}`}
            onClick={() => e.no !== undefined && run('election.view', { no: String(e.no) })}
          />
        ))}
      </div>
      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface Candidate { player?: Named; votes?: number; mine?: boolean; elected?: boolean }
interface ElectionView {
  no?: number; office?: string; place?: Named; seats?: number; phase?: string
  remaining_seconds?: number; votes_cast?: number; candidates?: Candidate[] | null
  deposit?: number; min_level?: number; standing?: boolean; voted?: boolean
}

export function Election({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ElectionView
  if (loading && !response) return <ScreenScroll><Header title="انتخابات" tone="violet" /></ScreenScroll>

  const total = (v.candidates ?? []).reduce((s, c) => s + (c.votes ?? 0), 0) || v.votes_cast || 0

  return (
    <ScreenScroll>
      <Header title={OFFICE_FA[v.office ?? ''] ?? v.office ?? 'انتخابات'} tone="violet"
        onBack={() => run('election.list')} onRefresh={() => v.no !== undefined && run('election.view', { no: String(v.no) })} />

      <Notice>{v.place?.name ?? ''} · {PHASE_FA[v.phase ?? ''] ?? v.phase}{v.remaining_seconds ? ` · ${hms(v.remaining_seconds)}` : ''}</Notice>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(v.candidates ?? []).map((c, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--gold-soft)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="display" style={{ color: c.mine ? 'var(--leaf)' : '#fff' }}>{c.player?.name ?? '—'}{c.mine ? ' (تو)' : ''}</span>
              {c.elected && <span className="nx-chip nx-chip-gold">برنده</span>}
            </div>
            <Bar frac={total ? clamp01((c.votes ?? 0) / total) : 0} color={c.mine ? 'var(--leaf)' : 'var(--lapis)'}
              label={`${formatNumber(c.votes ?? 0)} رأی`} />
          </div>
        ))}
      </div>

      {!!v.deposit && !v.standing && <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>سپرده‌ی نامزدی: {money(v.deposit)}</div>}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
