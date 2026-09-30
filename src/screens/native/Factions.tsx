import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface Operation { crime?: Named; status?: string; left_seconds?: number; min?: number; max?: number; crew?: unknown[] }
interface FactionHomeView {
  ref?: Named; rank?: string; city?: string; members?: number; max_members?: number
  bank?: number; applications?: number; operation?: Operation | null
}

const RANKS = ['leader', 'officer', 'member']
const rankText = (r: string) => (RANKS.includes(r) ? t(`faction.rank.${r}` as Key) : r)

export function FactionHome({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as FactionHomeView
  if (loading && !response) return <ScreenScroll><Header title={t('faction.title')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.ref?.name ?? t('faction.title')} tone="gold" onRefresh={() => run('faction.mine')} />

      <Card tone="gold">
        <StatPair
          left={<Stat icon="society" palette="gold" label={t('faction.members')} value={t('faction.members_of', { a: formatNumber(v.members ?? 0), b: formatNumber(v.max_members ?? 0) })} />}
          right={<Stat icon="bank" palette="sapphire" label={t('faction.bank')} value={money(v.bank)} />}
        />
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>
          {v.rank ? t('faction.your_rank', { r: rankText(v.rank) }) : ''}{v.applications ? ` · ${t('faction.applications', { n: formatNumber(v.applications) })}` : ''}
        </div>
      </Card>

      {v.operation && (
        <Notice>
          {v.operation.crime?.name ?? t('faction.operation')} · {v.operation.status === 'gathering' ? t('faction.gathering') : v.operation.status}
          {v.operation.left_seconds ? ` · ${hms(v.operation.left_seconds)}` : ''}
        </Notice>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="faction.mine" />
    </ScreenScroll>
  )
}

interface FactionLine { ref?: Named; members?: number }
interface FactionListView { city?: string; factions?: FactionLine[] | null; fee?: number; mine?: Named | null }

export function FactionList({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as FactionListView
  if (loading && !response) return <ScreenScroll><Header title={t('faction.list_title')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('faction.list_title')} tone="gold" onRefresh={() => run('faction.list')} />
      {v.mine && <Notice>{t('faction.you_are_in', { name: v.mine.name ?? '' })}</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.factions ?? []).map((f, i) => (
          <ListRow key={i} icon="lion" palette="gold" title={f.ref?.name ?? '—'}
            sub={t('faction.member_count', { n: formatNumber(f.members ?? 0) })}
            onClick={() => f.ref?.code && run('faction.view', { code: f.ref.code })} />
        ))}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="faction.list" />
    </ScreenScroll>
  )
}
