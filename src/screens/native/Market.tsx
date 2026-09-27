import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'

interface BookSummary { item?: { code?: string; name?: string }; best_ask?: number; best_bid?: number; last?: number }
interface MarketView {
  city?: string; books?: BookSummary[] | null; yours?: { code?: string; name?: string }[] | null
  at_market?: boolean; way?: { place?: { name?: string }; walk_seconds?: number } | null
}

export function Market({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as MarketView
  if (loading && !response) return <ScreenScroll><Header title="بازار" tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="بازار" tone="emerald" onRefresh={() => run('market.list')} />

      {!v.at_market && v.way && (
        <Notice>{hms(v.way.walk_seconds)} پیاده تا {v.way.place?.name ?? 'بازار'}</Notice>
      )}

      <div className="nx-tilegrid" style={{ flexDirection: 'column', display: 'flex' }}>
        {(v.books ?? []).map((b, i) => (
          <ListRow
            key={i}
            icon="cart"
            palette="emerald"
            title={b.item?.name ?? b.item?.code ?? '—'}
            sub={b.best_bid !== undefined && b.best_ask !== undefined ? `خرید ${formatNumber(b.best_bid)} · فروش ${formatNumber(b.best_ask)}` : undefined}
            right={b.last !== undefined ? formatNumber(b.last) : undefined}
            onClick={() => b.item?.code && run('market.book', { item: b.item.code })}
          />
        ))}
      </div>

      {!!(v.yours && v.yours.length) && (
        <Card>
          <div className="nx-sec">کالاهای تو بدون دفتر اینجا</div>
          {v.yours!.map((y, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{y.name ?? y.code}</div>)}
        </Card>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface BookLevel { price?: number; qty?: number }
interface TradeLine { at?: string; price?: number; qty?: number }
interface BookViewData {
  item?: { code?: string; name?: string }; city?: string
  bids?: BookLevel[] | null; asks?: BookLevel[] | null; trades?: TradeLine[] | null
  reference?: number; holding?: number; at_market?: boolean
  way?: { place?: { name?: string }; walk_seconds?: number } | null
}

export function Book({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as BookViewData
  if (loading && !response) return <ScreenScroll><Header title="دفتر" tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.item?.name ?? 'دفتر بازار'} tone="emerald" onRefresh={() => v.item?.code && run('market.book', { item: v.item.code })} />

      {!v.at_market && v.way && <Notice>{hms(v.way.walk_seconds)} پیاده تا {v.way.place?.name ?? 'بازار'}</Notice>}

      <StatPair
        left={<Stat icon="tag" palette="gold" label="آخرین قیمت" value={money(v.reference)} />}
        right={<Stat icon="box" palette="steel" label="موجودی تو" value={formatNumber(v.holding ?? 0)} />}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <Card className="nx-card-emerald" tone="emerald">
          <div className="nx-sec">خرید</div>
          {(v.bids ?? []).slice(0, 5).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--leaf)' }}>
              <span>{formatNumber(b.qty ?? 0)}</span><span>{formatNumber(b.price ?? 0)}</span>
            </div>
          ))}
          {!(v.bids ?? []).length && <div className="nx-empty">—</div>}
        </Card>
        <Card tone="ruby">
          <div className="nx-sec">فروش</div>
          {(v.asks ?? []).slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#ff9a9e' }}>
              <span>{formatNumber(a.qty ?? 0)}</span><span>{formatNumber(a.price ?? 0)}</span>
            </div>
          ))}
          {!(v.asks ?? []).length && <div className="nx-empty">—</div>}
        </Card>
      </div>

      {!!(v.trades && v.trades.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 6 }}>معاملات اخیر</div>
          {v.trades!.slice(0, 8).map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', padding: '3px 0' }}>
              <span>{formatNumber(t.qty ?? 0)}×</span><span>{formatNumber(t.price ?? 0)}</span>
            </div>
          ))}
        </Card>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
