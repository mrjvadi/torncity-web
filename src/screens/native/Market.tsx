import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'
import { t } from '../../i18n'

interface BookSummary { item?: { code?: string; name?: string }; best_ask?: number; best_bid?: number; last?: number }
interface MarketView {
  city?: string; books?: BookSummary[] | null; yours?: { code?: string; name?: string }[] | null
  at_market?: boolean; way?: { place?: { name?: string }; walk_seconds?: number } | null
}

export function Market({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as MarketView
  if (loading && !response) return <ScreenScroll><Header title={t('market.title')} tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('market.title')} tone="emerald" onRefresh={() => run('market.list')} />

      {!v.at_market && v.way && (
        <Notice>{t('market.walk', { t: hms(v.way.walk_seconds), place: v.way.place?.name ?? t('market.walk_place') })}</Notice>
      )}

      <div className="nx-tilegrid" style={{ flexDirection: 'column', display: 'flex' }}>
        {(v.books ?? []).map((b, i) => (
          <ListRow
            key={i}
            icon="cart"
            palette="emerald"
            title={b.item?.name ?? b.item?.code ?? '—'}
            sub={b.best_bid !== undefined && b.best_ask !== undefined ? t('market.bid_ask', { bid: formatNumber(b.best_bid), ask: formatNumber(b.best_ask) }) : undefined}
            right={b.last !== undefined ? formatNumber(b.last) : undefined}
            onClick={() => b.item?.code && run('market.book', { item: b.item.code })}
          />
        ))}
      </div>

      {!!(v.yours && v.yours.length) && (
        <Card>
          <div className="nx-sec">{t('market.no_book')}</div>
          {v.yours!.map((y, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{y.name ?? y.code}</div>)}
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="market.list" />
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
  if (loading && !response) return <ScreenScroll><Header title={t('market.book_title')} tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.item?.name ?? t('market.book_fallback')} tone="emerald" onRefresh={() => v.item?.code && run('market.book', { item: v.item.code })} />

      {!v.at_market && v.way && <Notice>{t('market.walk', { t: hms(v.way.walk_seconds), place: v.way.place?.name ?? t('market.walk_place') })}</Notice>}

      <StatPair
        left={<Stat icon="tag" palette="gold" label={t('market.last_price')} value={money(v.reference)} />}
        right={<Stat icon="box" palette="steel" label={t('market.you_hold')} value={formatNumber(v.holding ?? 0)} />}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <Card className="nx-card-emerald" tone="emerald">
          <div className="nx-sec">{t('market.buy')}</div>
          {(v.bids ?? []).slice(0, 5).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--leaf)' }}>
              <span>{formatNumber(b.qty ?? 0)}</span><span>{formatNumber(b.price ?? 0)}</span>
            </div>
          ))}
          {!(v.bids ?? []).length && <div className="nx-empty">—</div>}
        </Card>
        <Card tone="ruby">
          <div className="nx-sec">{t('market.sell')}</div>
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
          <div className="nx-sec" style={{ marginBottom: 6 }}>{t('market.recent')}</div>
          {v.trades!.slice(0, 8).map((tr, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', padding: '3px 0' }}>
              <span>{formatNumber(tr.qty ?? 0)}×</span><span>{formatNumber(tr.price ?? 0)}</span>
            </div>
          ))}
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="market.book" />
    </ScreenScroll>
  )
}
