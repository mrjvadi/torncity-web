// «بازار پول»: the floating book of a settlement's own money against SUP (ADR 0033 6.8 to 6.10). The book with its depth, the reference
// rate and the allowed band; an order form with a typed price; the rate's history; and the conversion between moneys through SUP.
// Prices are micro-SUP per unit of the money; every amount here is a plain figure of its own currency, never run through the
// local-money formatter. Phone: stacked cards. Desktop: the two sides as columns of a table in the docked panel.

import { useMemo, useState } from 'react'
import type { FXBookView, FXConvertView, FXHistoryView, FXLevel, FXOrderLine, FXOrderView, FXRefusalView } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, Note, StatCard, StatGrid } from '../../ui/Popup'
import { Segmented } from '../native/kit/Parts'
import { formatNumber } from '../native/kit/format'
import { t } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, type FlowCtx } from './flow'

const fa = (x: number, max = 3) => new Intl.NumberFormat('fa-IR', { minimumFractionDigits: Math.min(2, max), maximumFractionDigits: max }).format(x)
const sup = (n: number) => `${formatNumber(n)} ${t('unit.money')}`
const units = (n: number, name: string) => `${formatNumber(n)} ${name}`
/** a price (micro-SUP per unit) as «۰٫۱۰ ساپ برای هر مارک پولو» */
const priceText = (p: number, name: string) => t('fx.price', { p: fa(p / 1_000_000), name })
const shortPrice = (p: number) => fa(p / 1_000_000)
const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(bps / 100)}٪`
/** what a person types: Persian or Arabic digits and a comma or Arabic decimal mark become a plain number */
export function parseNum(s: string): number {
  const en = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, '.').replace(/[٬\s]/g, '')
  const n = Number(en)
  return Number.isFinite(n) ? n : NaN
}

// -- the book -------------------------------------------------------------------------------------------------------

function Side({ title, levels, name, tone, max }: { title: string; levels: FXLevel[]; name: string; tone: 'buy' | 'sell'; max: number }) {
  return (
    <section className={`fx-side fx-${tone}`} aria-label={title}>
      <h3 className="fx-h">{title}</h3>
      {levels.length === 0 && <p className="fx-none">{t('fx.side_empty')}</p>}
      <ul className="fx-levels">
        {levels.map((l) => (
          <li key={l.price} style={{ ['--fx-w' as string]: `${Math.max(6, Math.round((l.units / max) * 100))}%` }}>
            <b>{shortPrice(l.price)}</b>
            <span>{units(l.units, name)}</span>
            <small>{t('fx.orders_n', { n: formatNumber(l.orders) })}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrderCard({ o, name, onCancel, busy }: { o: FXOrderLine; name: string; onCancel: () => void; busy: boolean }) {
  const left = o.units - o.filled
  return (
    <div className={`fx-order fx-${o.side}`}>
      <div className="fx-order-top">
        <b>{o.side === 'buy' ? t('fx.my_buy', { n: formatNumber(o.no) }) : t('fx.my_sell', { n: formatNumber(o.no) })}</b>
        <span>{priceText(o.price, name)}</span>
      </div>
      <div className="fx-bar"><i style={{ width: `${o.units > 0 ? Math.round((o.filled / o.units) * 100) : 0}%` }} /></div>
      <div className="fx-order-sub">
        <span>{t('fx.filled', { a: formatNumber(o.filled), b: units(o.units, name) })}</span>
        <span>{t('fx.left', { n: formatNumber(left) })}</span>
      </div>
      <ActionButton tone="steel" small disabled={busy} onClick={onCancel}>{t('fx.cancel')}</ActionButton>
    </div>
  )
}

function OrderForm({ v, ctx }: { v: FXBookView; ctx: FlowCtx }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [u, setU] = useState('')
  const [p, setP] = useState(fa(v.ref_price / 1_000_000, 4))
  const n = parseNum(u), price = parseNum(p)
  const lo = v.band_low / 1_000_000, hi = v.band_high / 1_000_000
  const problem = !(n >= 1) ? 'units' : !(price > 0) ? 'price' : price < lo || price > hi ? 'band'
    : side === 'sell' && n > v.units ? 'have_units' : side === 'buy' && Math.ceil(n * price) > v.cash_sup ? 'have_sup'
      : Math.floor(n * price) < v.min_order_sup ? 'small' : ''
  const msg = problem ? t(`fx.problem.${problem}` as 'fx.problem.units', { lo: fa(lo), hi: fa(hi), min: formatNumber(v.min_order_sup), have: formatNumber(side === 'sell' ? v.units : v.cash_sup) }) : ''
  const submit = () => ctx.run('fx.place', { side, units: String(Math.floor(n)), price: String(price) })
  return (
    <Panel tone="gold">
      <Lead>{t('fx.form_title')}</Lead>
      <Segmented options={[{ key: 'buy', label: t('fx.buy') }, { key: 'sell', label: t('fx.sell') }]} value={side} onChange={(k) => setSide(k as 'buy' | 'sell')} />
      <label className="fx-field">
        <span>{t('fx.field_units', { name: v.name })}</span>
        <input inputMode="numeric" dir="ltr" value={u} onChange={(e) => setU(e.target.value)} placeholder="0" />
      </label>
      <div className="fx-chips">
        {(v.preset_units ?? []).map((x) => <button key={x} type="button" className="dk-chip" onClick={() => setU(String(x))}>{formatNumber(x)}</button>)}
        <button type="button" className="dk-chip all" onClick={() => setU(String(side === 'sell' ? v.units : Math.floor(v.cash_sup / Math.max(price, 0.000001))))}>{t('sm.desk.all')}</button>
      </div>
      <label className="fx-field">
        <span>{t('fx.field_price', { name: v.name })}</span>
        <input inputMode="decimal" dir="ltr" value={p} onChange={(e) => setP(e.target.value)} />
      </label>
      <div className="fx-chips">
        <button type="button" className="dk-chip" onClick={() => setP(String(lo))}>{fa(lo)}</button>
        <button type="button" className="dk-chip all" onClick={() => setP(String(v.ref_price / 1_000_000))}>{t('fx.ref_chip')}</button>
        <button type="button" className="dk-chip" onClick={() => setP(String(hi))}>{fa(hi)}</button>
      </div>
      <Hint>{t('fx.band_hint', { lo: fa(lo), hi: fa(hi) })}</Hint>
      {msg && (problem !== 'units' || u) && <Note tone="bad">{msg}</Note>}
      <ActionButton tone="gold" busy={ctx.busy} disabled={!!problem} onClick={submit}>{t('fx.review')}</ActionButton>
    </Panel>
  )
}

export const FxBook = flow<FXBookView>(({ view: v, ctx }) => {
  const bids = v.bids ?? [], asks = v.asks ?? []
  const max = useMemo(() => Math.max(1, ...bids.map((l) => l.units), ...asks.map((l) => l.units)), [bids, asks])
  const mine = v.my_orders ?? []
  const empty = bids.length === 0 && asks.length === 0
  return (
    <Page title={t('fx.title', { name: v.name })} tone="gold">
      {v.notice === 'cancelled' && <Panel tone="emerald"><Lead tone="good">{t('fx.cancelled')}</Lead></Panel>}
      <Panel tone="gold">
        <Facts rows={[
          { label: t('fx.ref'), value: priceText(v.ref_price, v.name), gold: true },
          { label: t('fx.band'), value: t('fx.band_line', { lo: shortPrice(v.band_low), hi: shortPrice(v.band_high) }) },
          ...(v.last_price > 0 ? [{ label: t('fx.last'), value: priceText(v.last_price, v.name) }] : []),
          { label: t('fx.you_sup'), value: sup(v.cash_sup) },
          { label: t('fx.you_units', { name: v.name }), value: formatNumber(v.units) },
          ...(v.escrow_sup > 0 || v.escrow_units > 0 ? [{ label: t('fx.held'), value: `${sup(v.escrow_sup)} – ${units(v.escrow_units, v.name)}` }] : []),
        ]} />
        <Hint>{t('fx.slow', { n: formatNumber(v.min_trades), d: formatNumber(v.window_periods) })}</Hint>
      </Panel>
      {empty && <Panel><Lead>{t('fx.empty')}</Lead><Hint>{t('fx.empty_hint')}</Hint></Panel>}
      <div className="fx-book">
        <Side title={t('fx.bids')} levels={bids} name={v.name} tone="buy" max={max} />
        <Side title={t('fx.asks')} levels={asks} name={v.name} tone="sell" max={max} />
      </div>
      <OrderForm v={v} ctx={ctx} />
      {mine.length > 0 && (
        <>
          <h3 className="fx-h">{t('fx.mine')}</h3>
          <div className="fx-orders">{mine.map((o) => <OrderCard key={o.id} o={o} name={v.name} busy={ctx.busy} onCancel={() => ctx.run('fx.cancel', { order: o.id })} />)}</div>
        </>
      )}
      {(v.trades ?? []).length > 0 && (
        <>
          <h3 className="fx-h">{t('fx.recent')}</h3>
          <ul className="fx-trades">{(v.trades ?? []).slice(0, 6).map((x, i) => <li key={i}><b>{shortPrice(x.price)}</b><span>{units(x.units, v.name)}</span></li>)}</ul>
        </>
      )}
      <div className="fx-links">
        <ActionButton tone="steel" small onClick={() => ctx.run('fx.history', {})}>{t('fx.history')}</ActionButton>
        <ActionButton tone="steel" small onClick={() => ctx.run('fx.convert', {})}>{t('fx.convert')}</ActionButton>
      </div>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- an order: the quote with what is set aside, then the result ---------------------------------------------------------

export const FxOrder = flow<FXOrderView>(({ view: v, ctx }) => {
  const buy = v.side === 'buy'
  const back = ctx.acts.find(isBack)
  const ok = ctx.acts.find((a) => a.id === 'confirm')
  if (v.stage === 'ask') {
    const confirm = () => (ok ? ctx.go(ok) : ctx.run('fx.place', { side: v.side, units: String(v.units), price: String(v.price / 1_000_000), confirm: 'confirm' }))
    return (
      <Page title={t('fx.title', { name: v.name })} tone="gold">
        <Popup open onClose={() => back && ctx.go(back)} tone="gold" dismissible={!ctx.busy} title={buy ? t('fx.confirm_buy') : t('fx.confirm_sell')}
          footer={<ActionRow>
            {back && <ActionButton tone="steel" small onClick={() => ctx.go(back)} disabled={ctx.busy}>{t('building.no')}</ActionButton>}
            <ActionButton tone="gold" busy={ctx.busy} disabled={!v.can_place} onClick={confirm}>{t('fx.place')}</ActionButton>
          </ActionRow>}>
          <StatGrid>
            <StatCard icon="coins" palette="amber" label={buy ? t('fx.you_buy') : t('fx.you_sell')} value={units(v.units, v.name)} />
            <StatCard icon="chart" palette="sapphire" label={t('fx.price_each')} value={priceText(v.price, v.name)} />
            <StatCard icon="box" palette="steel" label={t('fx.worth')} value={sup(v.worth_sup)} />
            <StatCard icon="coins" palette="gold" label={buy ? t('fx.escrow_sup') : t('fx.escrow_units')} value={buy ? sup(v.escrow) : units(v.escrow, v.name)} />
          </StatGrid>
          <Note>{buy ? t('fx.fee_buy', { p: pct(v.fee_bps), total: sup(v.escrow) }) : t('fx.fee_sell', { p: pct(v.fee_bps) })}</Note>
          {v.crosses && <Note>{t('fx.crosses')}</Note>}
          <Note>{t('fx.refund_note')}</Note>
          {!v.can_place && <Note tone="bad">{t('fx.cannot')}</Note>}
        </Popup>
      </Page>
    )
  }
  const o = v.order
  return (
    <Page title={t('fx.title', { name: v.name })} tone="emerald">
      <Panel tone="emerald">
        <Lead tone="good">{v.units_moved > 0 ? t('fx.done_filled', { a: units(v.units_moved, v.name), b: sup(v.sup_moved) }) : t('fx.done_rested')}</Lead>
        <Facts rows={[
          { label: t('fx.filled_of'), value: `${formatNumber(o.filled)} / ${formatNumber(o.units)}` },
          { label: t('fx.price_each'), value: priceText(o.price, v.name) },
          ...(v.rested ? [{ label: t('fx.on_book'), value: units(o.units - o.filled, v.name) }] : []),
        ]} />
        {v.rested && <Hint>{t('fx.rested_hint')}</Hint>}
      </Panel>
      <ActionButton tone="gold" onClick={() => ctx.run('fx.book', {})}>{t('fx.back_book')}</ActionButton>
    </Page>
  )
})

// -- the rate's history ---------------------------------------------------------------------------------------------

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 300, h = 80, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  const pts = values.map((x, i) => `${(i / (values.length - 1)) * w},${h - 6 - ((x - lo) / span) * (h - 12)}`).join(' ')
  return (
    <svg className="fx-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('fx.spark')} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export const FxHistory = flow<FXHistoryView>(({ view: v, ctx }) => {
  const ps = v.periods ?? []
  const series = [...ps].reverse().map((p) => p.x_ref_after / 10000)
  return (
    <Page title={t('fx.hist_title', { name: v.name })} tone="gold">
      <Panel tone="gold">
        <Lead>{t('fx.hist_now', { rate: fa((v.r0 * 1_000_000) / Math.max(1, v.x_ref_ppm), 2), name: v.name })}</Lead>
        <Hint>{t('fx.slow', { n: formatNumber(v.min_trades), d: formatNumber(v.window_periods) })}</Hint>
        {ps.length === 0 ? <Hint>{t('fx.hist_none')}</Hint> : <div className="fx-spark-box"><Spark values={series} /></div>}
      </Panel>
      {ps.length > 0 && (
        <ul className="fx-hist">
          {ps.slice(0, 10).map((p) => (
            <li key={p.period_no}>
              <b>{t('fx.period', { n: formatNumber(p.period_no) })}</b>
              <span>{t('fx.hist_row', { t: formatNumber(p.trades), v: formatNumber(p.volume_units), p: fa(p.vwap / 1_000_000) })}</span>
              <small>{t('fx.hist_ref', { a: fa(p.x_ref_before / 10000, 1), b: fa(p.x_ref_after / 10000, 1) })}</small>
            </li>
          ))}
        </ul>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- conversion between moneys, through SUP ---------------------------------------------------------------------------

export const FxConvert = flow<FXConvertView>(({ view: v, ctx }) => {
  const holds = v.holdings ?? []
  const options = [{ code: 'SUP', name: t('unit.money') }, ...holds.map((h) => ({ code: h.code, name: h.name }))]
  const nameOf = (c: string) => options.find((o) => o.code === c)?.name ?? (c === 'SUP' ? t('unit.money') : '')
  const [from, setFrom] = useState(v.from || holds[0]?.code || 'SUP')
  const [to, setTo] = useState(v.to || 'SUP')
  const [amt, setAmt] = useState(v.amount ? String(v.amount) : '')
  const have = from === 'SUP' ? v.cash_sup : holds.find((h) => h.code === from)?.units ?? 0
  const n = parseNum(amt)
  const bad = !(n >= 1) || from === to || n > have
  const back = ctx.acts.find(isBack)
  const ok = ctx.acts.find((a) => a.id === 'confirm')
  if (v.stage === 'ask') {
    const confirm = () => (ok ? ctx.go(ok) : ctx.run('fx.convert', { from: v.from, to: v.to, amount: String(v.amount), quote: String(v.out), confirm: 'confirm' }))
    return (
      <Page title={t('fx.conv_title')} tone="gold">
        <Popup open onClose={() => back && ctx.go(back)} tone="gold" dismissible={!ctx.busy} title={t('fx.conv_title')}
          footer={<ActionRow>
            {back && <ActionButton tone="steel" small onClick={() => ctx.go(back)} disabled={ctx.busy}>{t('building.no')}</ActionButton>}
            <ActionButton tone="gold" busy={ctx.busy} disabled={!v.complete} onClick={confirm}>{t('fx.conv_yes')}</ActionButton>
          </ActionRow>}>
          <StatGrid>
            <StatCard icon="coins" palette="amber" label={t('sm.desk.you_pay')} value={`${formatNumber(v.amount)} ${nameOf(v.from)}`} />
            <StatCard icon="coins" palette="gold" label={t('sm.desk.you_get')} value={`${formatNumber(v.out)} ${nameOf(v.to)}`} />
          </StatGrid>
          {(v.legs ?? []).map((l, i) => (
            <Note key={i}>{l.side === 'sell' ? t('fx.leg_sell', { a: units(l.units_in, l.name), b: sup(l.sup_out), fee: units(l.fee, l.name) }) : t('fx.leg_buy', { a: sup(l.sup_in), b: units(l.units_out, l.name), fee: sup(l.fee) })}</Note>
          ))}
          <Note>{t('fx.conv_protect', { p: pct(v.slippage_bps), n: formatNumber(v.min_out) })}</Note>
          {!v.complete && <Note tone="bad">{t('fx.no_liquidity')}</Note>}
        </Popup>
      </Page>
    )
  }
  if (v.stage === 'done') {
    return (
      <Page title={t('fx.conv_title')} tone="emerald">
        <Panel tone="emerald"><Lead tone="good">{t('fx.conv_done', { a: `${formatNumber(v.gave)} ${nameOf(v.from)}`, b: `${formatNumber(v.got)} ${nameOf(v.to)}` })}</Lead></Panel>
        <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
      </Page>
    )
  }
  return (
    <Page title={t('fx.conv_title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('fx.conv_lead')}</Lead>
        <Hint>{t('fx.conv_hint')}</Hint>
        <label className="fx-field"><span>{t('fx.from')}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></label>
        <label className="fx-field"><span>{t('fx.to')}</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>{options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></label>
        <label className="fx-field"><span>{t('fx.amount', { name: nameOf(from) })}</span>
          <input inputMode="numeric" dir="ltr" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0" /></label>
        <Hint>{t('fx.you_have', { n: `${formatNumber(have)} ${nameOf(from)}` })}</Hint>
        {from === to && <Note tone="bad">{t('fx.same')}</Note>}
        {n > have && <Note tone="bad">{t('fx.problem.have_conv')}</Note>}
        <ActionButton tone="gold" busy={ctx.busy} disabled={bad} onClick={() => ctx.run('fx.convert', { from, to, amount: String(Math.floor(n)) })}>{t('fx.conv_quote')}</ActionButton>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- a refusal: calm, and the way to ask again -------------------------------------------------------------------------

export const FxRefusal = flow<FXRefusalView>(({ view: v, ctx }) => {
  const again = ctx.acts.find(isBack)
  const k = `fx.refused.${v.kind}`
  const text = t(k as 'fx.refused.fx_moved', { min: fa((v.min ?? 0) / 1_000_000), max: fa((v.max ?? 0) / 1_000_000), smin: formatNumber(v.min ?? 0) })
  const retry = v.kind === 'fx_moved' || v.kind === 'fx_no_liquidity'
  return (
    <Page title={t('fx.refused_title')} tone="ruby">
      <Panel tone="ruby"><Lead tone="bad">{text === k ? t('refusal.unknown') : text}</Lead></Panel>
      {again && <ActionButton tone="gold" onClick={() => ctx.go(again)}>{retry ? t('fx.requote') : t('fx.back')}</ActionButton>}
    </Page>
  )
})

export const FX_FLOWS = { fx_book: FxBook, fx_order: FxOrder, fx_history: FxHistory, fx_convert: FxConvert, fx_refusal: FxRefusal }
export const FX_SCREENS = Object.keys(FX_FLOWS)
