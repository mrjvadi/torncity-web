import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, money, pct } from './kit/format'

interface Named { code?: string; name?: string }
interface ListedLine { company?: Named; type?: Named; city?: Named; price?: number; prev?: number; cap?: number; volume?: number }
interface ExchangeView { lines?: ListedLine[] | null }

function changeFrac(price?: number, prev?: number): number | null {
  if (!price || !prev) return null
  return (price - prev) / prev
}

export function Exchange({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ExchangeView
  if (loading && !response) return <ScreenScroll><Header title="بورس" tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="بورس" tone="emerald" onRefresh={() => run('stock.list')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.lines ?? []).map((l, i) => {
          const chg = changeFrac(l.price, l.prev)
          return (
            <ListRow key={i} icon="chart" palette="emerald" title={l.company?.name ?? '—'}
              sub={l.type?.name}
              right={<span style={{ color: chg === null ? undefined : chg >= 0 ? 'var(--leaf)' : 'var(--anar)' }}>
                {formatNumber(l.price ?? 0)}{chg !== null ? ` (${chg >= 0 ? '+' : ''}${pct(chg)})` : ''}
              </span>}
              onClick={() => l.company?.code && run('stock.view', { code: l.company.code })} />
          )
        })}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="stock.list" />
    </ScreenScroll>
  )
}

interface Holding { company?: Named; shares?: number; cost?: number; value?: number; price?: number }
interface OpenOrder { company?: Named; side?: string; qty?: number; price?: number; filled?: number; no?: number }
interface PortfolioView {
  holdings?: Holding[] | null; orders?: OpenOrder[] | null
  gold?: number; gold_val?: number; savings?: number; value?: number; gain?: number; notice?: string
}

export function Portfolio({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PortfolioView
  if (loading && !response) return <ScreenScroll><Header title="سبد دارایی" tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="سبد دارایی" tone="emerald" onRefresh={() => run('stock.mine')} />
      {v.notice && <Notice>{v.notice}</Notice>}

      <StatPair
        left={<Stat icon="crowncoin" palette="gold" label="ارزش سبد" value={money(v.value)} />}
        right={<Stat icon="chart" palette="emerald" label="سود" value={money(v.gain)} />}
      />

      {!!(v.holdings && v.holdings.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.holdings!.map((h, i) => (
            <ListRow key={i} icon="chart" palette="emerald" title={h.company?.name ?? '—'}
              sub={`${formatNumber(h.shares ?? 0)} سهم`}
              right={money(h.value)}
              onClick={() => h.company?.code && run('stock.view', { code: h.company.code })} />
          ))}
        </div>
      )}

      {!!(v.orders && v.orders.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>سفارش‌های باز</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {v.orders!.map((o, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)' }}>
                <span>{o.company?.name}</span>
                <span>{o.side === 'buy' ? 'خرید' : 'فروش'} {formatNumber(o.filled ?? 0)}/{formatNumber(o.qty ?? 0)} @ {formatNumber(o.price ?? 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(!!v.gold || !!v.savings) && (
        <StatPair
          left={<Stat icon="ring" palette="gold" label="طلا" value={money(v.gold_val)} />}
          right={<Stat icon="bank" palette="sapphire" label="پس‌انداز" value={money(v.savings)} />}
        />
      )}

      <Actions response={response} onAction={onAction} refreshCommand="stock.mine" />
    </ScreenScroll>
  )
}
