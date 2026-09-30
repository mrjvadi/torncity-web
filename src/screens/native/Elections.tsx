import type { ScreenProps } from '../types'
import { Bar, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
const OFFICES = ['mayor', 'deputy_mayor', 'city_council', 'president']
const PHASES = ['candidacy', 'voting', 'counting', 'counted']
const officeText = (o?: string) => (o && OFFICES.includes(o) ? t(`office.${o}` as Key) : o ?? '')
const phaseText = (p?: string) => (p && PHASES.includes(p) ? t(`phase.${p}` as Key) : p ?? '')

interface ElectionLine { no?: number; office?: string; place?: Named; seats?: number; phase?: string; remaining_seconds?: number; candidates?: number; elected?: Named[] | null }
interface ElectionsView { no_city?: boolean; place?: Named; elections?: ElectionLine[] | null }

export function Elections({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ElectionsView
  if (loading && !response) return <ScreenScroll><Header title={t('elections.title')} tone="violet" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title={t('elections.title')} tone="violet" /><Notice>{t('property.no_city')}</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('elections.title')} tone="violet" onRefresh={() => run('election.list')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.elections ?? []).map((e, i) => (
          <ListRow
            key={i}
            icon="vote"
            palette="violet"
            title={`${officeText(e.office)} · ${e.place?.name ?? ''}`}
            sub={e.phase === 'counted'
              ? (e.elected?.length ? t('elections.winner', { names: e.elected.map((p) => p.name).join(`${t('common.sep')} `) }) : t('elections.counted'))
              : `${phaseText(e.phase)} · ${t('elections.candidates', { n: formatNumber(e.candidates ?? 0) })}${e.remaining_seconds ? ` · ${hms(e.remaining_seconds)}` : ''}`}
            onClick={() => e.no !== undefined && run('election.view', { no: String(e.no) })}
          />
        ))}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="election.list" />
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
  if (loading && !response) return <ScreenScroll><Header title={t('elections.title')} tone="violet" /></ScreenScroll>

  const total = (v.candidates ?? []).reduce((s, c) => s + (c.votes ?? 0), 0) || v.votes_cast || 0

  return (
    <ScreenScroll>
      <Header title={officeText(v.office) || t('elections.title')} tone="violet"
        onBack={() => run('election.list')} onRefresh={() => v.no !== undefined && run('election.view', { no: String(v.no) })} />

      <Notice>{v.place?.name ?? ''} · {phaseText(v.phase)}{v.remaining_seconds ? ` · ${hms(v.remaining_seconds)}` : ''}</Notice>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(v.candidates ?? []).map((c, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--gold-soft)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="display" style={{ color: c.mine ? 'var(--leaf)' : '#fff' }}>{c.player?.name ?? '—'}{c.mine ? ` ${t('elections.you')}` : ''}</span>
              {c.elected && <span className="nx-chip nx-chip-gold">{t('elections.elected')}</span>}
            </div>
            <Bar frac={total ? clamp01((c.votes ?? 0) / total) : 0} color={c.mine ? 'var(--leaf)' : 'var(--lapis)'}
              label={t('elections.votes', { n: formatNumber(c.votes ?? 0) })} />
          </div>
        ))}
      </div>

      {!!v.deposit && !v.standing && <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>{t('elections.deposit', { n: money(v.deposit) })}</div>}

      <Actions response={response} onAction={onAction} refreshCommand="election.view" />
    </ScreenScroll>
  )
}
