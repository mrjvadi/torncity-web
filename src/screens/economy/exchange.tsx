// The stock exchange: the listed companies, one company with its book, an order to confirm, the
// player's portfolio, a company's listing and its dividend. Drawn from the view and the actions of the
// answer (docs/adr/0039-presentation-split.md); a city without an exchange arrives as `unavailable`.

import type {
  BookLevel, DividendView, ExchangeView, ListingView, PortfolioView, StockOrderView, StockView, TradeLine,
} from '../../api/views.gen'
import { Card, ListRow, Notice, Stat, StatPair } from '../native/kit/Parts'
import { formatNumber, money, pct } from '../native/kit/format'
import { ActionButton, ActionRow, CostSummary, Note } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow } from '../village/flow'
import { durationText } from '../village/common'
import { ConfirmPopup, Do, NotHere, byId, find, nameOf, rest } from './kit'
import { noticeLine } from './wording'
import { clockText } from './time'

const key = (k: string) => k as Key

function change(price: number, prev: number): number | null {
  return price > 0 && prev > 0 ? (price - prev) / prev : null
}

function Move({ price, prev }: { price: number; prev: number }) {
  const c = change(price, prev)
  if (c === null) return null
  return <span dir="ltr" style={{ color: c > 0 ? 'var(--leaf)' : c < 0 ? 'var(--anar)' : undefined }}>{c > 0 ? '+' : ''}{pct(c)}</span>
}

/** The two sides of an order book, side by side. */
export function BookTables({ bids, asks, titleBids, titleAsks }: { bids: BookLevel[] | null; asks: BookLevel[] | null; titleBids: string; titleAsks: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Card className="nx-card-emerald" tone="emerald">
        <div className="nx-sec">{titleBids}</div>
        {(bids ?? []).slice(0, 5).map((b, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--leaf)' }}>
            <span>{formatNumber(b.qty)}</span><span>{formatNumber(b.price)}</span>
          </div>
        ))}
        {!(bids ?? []).length && <div className="nx-empty">—</div>}
      </Card>
      <Card tone="ruby">
        <div className="nx-sec">{titleAsks}</div>
        {(asks ?? []).slice(0, 5).map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#ff9a9e' }}>
            <span>{formatNumber(a.qty)}</span><span>{formatNumber(a.price)}</span>
          </div>
        ))}
        {!(asks ?? []).length && <div className="nx-empty">—</div>}
      </Card>
    </div>
  )
}

export function TradeList({ trades, title }: { trades: TradeLine[] | null; title: string }) {
  if (!(trades ?? []).length) return null
  return (
    <Card>
      <div className="nx-sec" style={{ marginBottom: 6 }}>{title}</div>
      {(trades ?? []).slice(0, 8).map((tr, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', padding: '3px 0' }}>
          <span>{t('eco.trade_line', { qty: formatNumber(tr.qty), price: money(tr.price) })}</span><span>{clockText(tr.at)}</span>
        </div>
      ))}
    </Card>
  )
}

// -- the listed companies ----------------------------------------------------------------------

const Exchange = flow<ExchangeView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('stocks.title')} tone="emerald" />
  return (
    <Page title={t('stocks.title')} tone="emerald">
      {(v.lines ?? []).length === 0 && <Notice>{t('eco.stock.empty')}</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.lines ?? []).map((l) => (
          <ListRow key={l.company.code} icon="chart" palette="emerald" title={l.company.name}
            sub={`${nameOf(ctx, ['company_type'], l.type)} · ${ctx.names.name(['city'], l.city.code, l.city.name)}`}
            right={<span dir="ltr">{formatNumber(l.price)} <Move price={l.price} prev={l.prev} /></span>}
            onClick={() => { const a = find(ctx, 'stock.open', { code: l.company.code }); if (a) ctx.go(a) }} />
        ))}
      </div>
      <Hint>{t('eco.stock.hint')}</Hint>
      <Btns ctx={ctx} list={rest(ctx, (a) => a.id === 'stock.open' || isBack(a))} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- one company ----------------------------------------------------------------------------------

const Stock = flow<StockView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('stocks.title')} tone="emerald" />
  const notice = noticeLine('stock', v.notice, v.notice_args)
  const city = ctx.names.name(['city'], v.city.code, v.city.name)
  return (
    <Page title={v.company.name} tone="emerald">
      {notice && <Notice>{notice}</Notice>}
      <Card tone="emerald">
        <div className="vh-hint" style={{ textAlign: 'center' }}>{t('eco.stock.sub', { type: nameOf(ctx, ['company_type'], v.type), city })}</div>
        {v.listed ? (
          <StatPair
            left={<Stat icon="chart" palette="emerald" label={t('eco.stock.price')} value={<span dir="ltr">{money(v.price)} <Move price={v.price} prev={v.prev} /></span>} />}
            right={<Stat icon="coins" palette="gold" label={t('eco.stock.ipo_price')} value={money(v.ipo)} />}
          />
        ) : <Lead>{t('eco.stock.not_listed')}</Lead>}
      </Card>
      <Panel>
        <Facts rows={[
          { label: t('eco.stock.book'), value: money(v.book) },
          { label: t('eco.stock.total'), value: formatNumber(v.total) },
          { label: t('eco.stock.cap'), value: money(v.price * v.total), gold: true },
          ...(v.controller ? [{ label: t('eco.stock.controller'), value: v.controller }] : []),
          ...(v.last_div > 0 ? [{ label: t('eco.stock.last_div'), value: money(v.last_div) }] : []),
        ]} />
        {v.holding > 0 && <Hint tone="good">{t('eco.stock.holding', { shares: formatNumber(v.holding), locked: formatNumber(v.locked), cost: money(v.cost) })}</Hint>}
      </Panel>
      {v.listed && <BookTables bids={v.bids} asks={v.asks} titleBids={t('eco.stock.bids')} titleAsks={t('eco.stock.asks')} />}
      {v.listed && <TradeList trades={v.trades} title={t('eco.stock.trades')} />}
      {v.listed && (
        <Panel>
          <Lead>{t('eco.stock.buy')}</Lead>
          <div className="vf-btns row">
            {(v.buys ?? []).map((o) => { const a = find(ctx, 'stock.buy', { qty: o.qty, price: o.price }); return a && <button key={`b${o.qty}-${o.price}`} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('eco.stock.option', { qty: formatNumber(o.qty), price: money(o.price) })}</button> })}
          </div>
          {(v.sells ?? []).length > 0 && <Lead>{t('eco.stock.sell')}</Lead>}
          <div className="vf-btns row">
            {(v.sells ?? []).map((o) => { const a = find(ctx, 'stock.sell', { qty: o.qty, price: o.price }); return a && <button key={`s${o.qty}-${o.price}`} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('eco.stock.option', { qty: formatNumber(o.qty), price: money(o.price) })}</button> })}
          </div>
          <Hint>{t('eco.stock.fee', { p: pct(v.fee_bps / 10000) })}</Hint>
        </Panel>
      )}
      {v.owner && <Btns ctx={ctx} list={byId(ctx, 'stock.ipo', 'stock.dividend')} tone="gold" />}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- an order ------------------------------------------------------------------------------------

const StockOrder = flow<StockOrderView>(({ view: v, ctx }) => {
  const buying = v.side === 'buy'
  if (!v.placed) {
    const yes = byId(ctx, 'stock.confirm_buy', 'stock.confirm_sell')[0]
    return (
      <ConfirmPopup title={t(buying ? 'eco.stock.order_buy_title' : 'eco.stock.order_sell_title', { company: v.company.name })} ctx={ctx} tone="gold"
        footer={<ActionRow><ActionButton tone="green" disabled={ctx.busy} onClick={() => yes && ctx.go(yes)}>{t(buying ? 'eco.stock.confirm_buy' : 'eco.stock.confirm_sell')}</ActionButton></ActionRow>}>
        <CostSummary
          lines={[{ label: t('eco.stock.qty'), amount: formatNumber(v.qty) }, { label: t(buying ? 'eco.stock.up_to' : 'eco.stock.from'), amount: money(v.price) }]}
          total={{ label: t(buying ? 'eco.stock.reserve' : 'eco.stock.locked'), amount: buying ? money(v.reserve) : t('eco.stock.shares', { n: formatNumber(v.qty) }) }} />
        {buying && <Hint>{t('eco.stock.reserve_note', { bank: money(v.bank) })}</Hint>}
        <Note>{t('eco.stock.fee', { p: pct(v.fee_bps / 10000) })}</Note>
      </ConfirmPopup>
    )
  }
  return (
    <Page title={t('eco.stock.placed_title', { no: formatNumber(v.no) })} tone="emerald">
      <Panel tone="emerald">
        <Lead tone="good">{t(buying ? 'eco.stock.placed_buy' : 'eco.stock.placed_sell', { company: v.company.name, qty: formatNumber(v.qty), price: money(v.price) })}</Lead>
        {v.filled > 0 && <Hint tone="good">{t(buying ? 'eco.stock.filled_buy' : 'eco.stock.filled_sell', { filled: formatNumber(v.filled), spent: money(v.spent), got: money(v.got) })}</Hint>}
        {v.rests && <Hint>{t('eco.stock.rests', { t: clockText(v.expires_at) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- the portfolio ----------------------------------------------------------------------------------

const Portfolio = flow<PortfolioView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('stocks.portfolio')} tone="emerald" />
  const notice = noticeLine('stock', v.notice, v.notice_args)
  return (
    <Page title={t('stocks.portfolio')} tone="emerald">
      {notice && <Notice>{notice}</Notice>}
      <StatPair
        left={<Stat icon="crowncoin" palette="gold" label={t('stocks.portfolio_value')} value={money(v.value)} />}
        right={<Stat icon="chart" palette="emerald" label={t(v.gain < 0 ? 'eco.stock.loss' : 'stocks.gain')} value={money(Math.abs(v.gain))} />}
      />
      {(v.holdings ?? []).length === 0 && <Notice>{t('eco.stock.no_shares')}</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.holdings ?? []).map((h) => (
          <ListRow key={h.company.code} icon="chart" palette="emerald" title={h.company.name}
            sub={t(h.listed ? 'eco.stock.holding_line' : 'eco.stock.holding_private', { shares: formatNumber(h.shares), price: money(h.price), cost: money(h.cost) })}
            right={money(h.value)} onClick={() => { const a = find(ctx, 'stock.open', { code: h.company.code }); if (a) ctx.go(a) }} />
        ))}
      </div>
      {(v.orders ?? []).length > 0 && (
        <Panel>
          <Lead>{t('stocks.open_orders')}</Lead>
          {(v.orders ?? []).map((o) => {
            const a = find(ctx, 'stock.cancel', { no: o.no })
            return (
              <div key={o.no} className="vf-need">
                <div className="vf-need-head">
                  <span>{o.company.name}</span>
                  <span>{t(o.side === 'buy' ? 'eco.stock.order_line_buy' : 'eco.stock.order_line_sell', { no: formatNumber(o.no), qty: formatNumber(o.qty - o.filled), price: money(o.price) })}</span>
                </div>
                {a && <Do ctx={ctx} a={a} tone="red" label={t('eco.stock.cancel', { no: formatNumber(o.no) })} />}
              </div>
            )
          })}
        </Panel>
      )}
      {(v.gold > 0 || v.savings > 0) && (
        <StatPair
          left={<Stat icon="ring" palette="gold" label={t('stocks.gold')} value={money(v.gold_val)} />}
          right={<Stat icon="bank" palette="sapphire" label={t('stocks.savings')} value={money(v.savings)} />}
        />
      )}
      <Btns ctx={ctx} list={byId(ctx, 'finance.exchange', 'finance.gold', 'finance.savings')} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- a company's listing and its dividend ----------------------------------------------------------

const Listing = flow<ListingView>(({ view: v, ctx }) => {
  const yes = byId(ctx, 'stock.ipo_yes')[0]
  if (v.chosen && !v.refused) {
    return (
      <ConfirmPopup title={t('eco.ipo.confirm_title', { company: v.company.name })} ctx={ctx} tone="gold"
        footer={<ActionRow><ActionButton tone="green" disabled={ctx.busy} onClick={() => yes && ctx.go(yes)}>{t('eco.ipo.yes')}</ActionButton></ActionRow>}>
        <CostSummary
          lines={[{ label: t('eco.ipo.shares'), amount: formatNumber(v.chosen.qty) }, { label: t('eco.ipo.price_each'), amount: money(v.chosen.price) }]}
          total={{ label: t('eco.ipo.fee'), amount: money(v.fee) }} />
      </ConfirmPopup>
    )
  }
  const refusedKey = `eco.ipo.refused.${v.refused}`
  return (
    <Page title={t('eco.ipo.title', { company: v.company.name })} tone="emerald">
      <Panel tone="emerald">
        <Lead>{t('eco.ipo.rules', { age: durationText(v.min_age_seconds), revenue: money(v.min_revenue), fee: money(v.fee) })}</Lead>
        <Hint>{t('eco.ipo.book', { book: money(v.book), total: formatNumber(v.total) })}</Hint>
        {v.refused && <Lead tone="bad">{hasKey(refusedKey) ? t(key(refusedKey), { wait: durationText(Math.max(0, v.min_age_seconds - v.age_seconds)), revenue: money(v.revenue) }) : t('refusal.unknown')}</Lead>}
      </Panel>
      {!v.refused && (
        <Panel>
          <Lead>{t('eco.ipo.choose')}</Lead>
          {ctx.acts.filter((a) => a.id === 'stock.ipo_option').map((a) => (
            <Do key={`${a.args?.qty}-${a.args?.price}`} ctx={ctx} a={a} tone="gold" label={t('eco.ipo.option', { shares: formatNumber(Number(a.args?.qty)), price: money(Number(a.args?.price)) })} />
          ))}
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const Dividend = flow<DividendView>(({ view: v, ctx }) => {
  const yes = byId(ctx, 'stock.dividend_yes')[0]
  if (v.chosen && !v.refused && v.paid <= 0) {
    return (
      <ConfirmPopup title={t('eco.dividend.confirm_title', { company: v.company.name })} ctx={ctx} tone="gold"
        footer={<ActionRow><ActionButton tone="green" disabled={ctx.busy} onClick={() => yes && ctx.go(yes)}>{t('eco.dividend.yes')}</ActionButton></ActionRow>}>
        <CostSummary
          lines={[{ label: t('eco.dividend.per_share'), amount: money(v.chosen.qty) }]}
          total={{ label: t('eco.dividend.taken'), amount: money(v.chosen.price) }} />
        <Hint>{t('eco.dividend.tax_note')}</Hint>
      </ConfirmPopup>
    )
  }
  const refusedKey = `eco.dividend.refused.${v.refused}`
  return (
    <Page title={t('eco.dividend.title', { company: v.company.name })} tone="emerald">
      <Panel tone="emerald">
        <Facts rows={[
          { label: t('eco.dividend.free'), value: money(v.free), gold: true },
          { label: t('eco.dividend.tax'), value: pct(v.tax_bps / 10000) },
          { label: t('eco.dividend.shares'), value: formatNumber(v.total) },
        ]} />
        {v.refused && <Lead tone="bad">{hasKey(refusedKey) ? t(key(refusedKey)) : t('refusal.unknown')}</Lead>}
        {v.paid > 0 && <Lead tone="good">{t('eco.dividend.paid', { paid: money(v.paid), per: money(v.per_share), holders: formatNumber(v.holders) })}</Lead>}
      </Panel>
      {!v.refused && v.paid <= 0 && (
        <Panel>
          {(v.options ?? []).length === 0 ? <Hint>{t('eco.dividend.refused.no_money')}</Hint> : (
            ctx.acts.filter((a) => a.id === 'stock.dividend_option').map((a) => {
              const o = (v.options ?? []).find((x) => String(x.price) === String(a.args?.amount))
              return <Do key={a.args?.amount} ctx={ctx} a={a} tone="gold" label={t('eco.dividend.option', { amount: money(Number(a.args?.amount)), per: money(o?.qty ?? 0) })} />
            })
          )}
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({ exchange: Exchange, stock: Stock, stock_order: StockOrder, portfolio: Portfolio, listing: Listing, dividend: Dividend })

/** The screens this file draws. */
export const EXCHANGE_SCREENS = ['exchange', 'stock', 'stock_order', 'portfolio', 'listing', 'dividend']
