import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'

interface Named { code?: string; name?: string }
interface Operation { crime?: Named; status?: string; left_seconds?: number; min?: number; max?: number; crew?: unknown[] }
interface FactionHomeView {
  ref?: Named; rank?: string; city?: string; members?: number; max_members?: number
  bank?: number; applications?: number; operation?: Operation | null
}

const RANK_FA: Record<string, string> = { leader: 'رهبر', officer: 'مسئول', member: 'عضو' }

export function FactionHome({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as FactionHomeView
  if (loading && !response) return <ScreenScroll><Header title="جناح" tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.ref?.name ?? 'جناح'} tone="gold" onRefresh={() => run('faction.mine')} />

      <Card tone="gold">
        <StatPair
          left={<Stat icon="society" palette="gold" label="اعضا" value={`${formatNumber(v.members ?? 0)} از ${formatNumber(v.max_members ?? 0)}`} />}
          right={<Stat icon="bank" palette="sapphire" label="صندوق" value={money(v.bank)} />}
        />
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>
          {v.rank ? `رتبه‌ی تو: ${RANK_FA[v.rank] ?? v.rank}` : ''}{v.applications ? ` · ${formatNumber(v.applications)} درخواست عضویت` : ''}
        </div>
      </Card>

      {v.operation && (
        <Notice>
          {v.operation.crime?.name ?? 'عملیات'} · {v.operation.status === 'gathering' ? 'در حال جمع شدن' : v.operation.status}
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
  if (loading && !response) return <ScreenScroll><Header title="جناح‌ها" tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="جناح‌های شهر" tone="gold" onRefresh={() => run('faction.list')} />
      {v.mine && <Notice>عضو {v.mine.name} هستی.</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.factions ?? []).map((f, i) => (
          <ListRow key={i} icon="lion" palette="gold" title={f.ref?.name ?? '—'}
            sub={`${formatNumber(f.members ?? 0)} عضو`}
            onClick={() => f.ref?.code && run('faction.view', { code: f.ref.code })} />
        ))}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="faction.list" />
    </ScreenScroll>
  )
}
