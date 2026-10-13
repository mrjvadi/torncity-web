// The market in the new UI: the goods of the order book (and, in a village, its shop on the same page) with a
// segmented filter by source (all / the shop / residents) and shelf pills; each good a row with its picture, price,
// stock and a buy button that opens a quantity sheet. The book of one good (sellers and buyers as depth bars, recent
// trades, buy and sell sheets), the checkout, the order placed, cancelled, my orders, and a refusal.

import { useEffect, useMemo, useState } from 'react'
import type { Action } from '../../../api/types'
import type {
  BookLevel, BookView, MarketCheckoutView, MarketRefusalView, MarketView, MyOrdersView, OrderCancelledView, OrderPlacedView, VillageShopView,
} from '../../../api/views.gen'
import * as api from '../../../api/client'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, List, Note, Page, Pills, Row, Section, Segmented, Sheet, Stat, Stats } from '../../ui'
import { atText } from '../../../lib/duration'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { hasKey, t } from '../../../i18n'
import {
  Done, Facts, More, NoAnswer, NotHere, PayButtons, Purses, Qty, QtySheet, Said, StockChip, WalkTo, actsOf, argNum, bpsText, byId, find,
  groupWord, idOf, itemIcon, key, payNote, useNames, withArgs, BigMoney, moneyMain,
} from './eco'

type Source = 'all' | 'shop' | 'people'
interface Good { code: string; name: string; group: string; groupLabel: string; from: 'shop' | 'people'; ask: number; bid: number; last: number; stock?: number; max?: number; inBook: boolean }

/** A good as a row: the picture in a well, the name and its figures, the price large at the end with the buy button. */
function GoodRow({ g, onOpen, onBuy }: { g: Good; onOpen?: () => void; onBuy?: () => void }) {
  const price = g.from === 'shop' ? g.ask : g.ask || g.last
  return (
    <div className="n-eco-good">
      <button className="n-eco-good-main" onClick={onOpen} disabled={!onOpen}>
        <span className="n-eco-good-well"><Icon name={itemIcon(g.code, g.group)} /></span>
        <span className="n-eco-good-body">
          <span className="n-eco-good-name">{g.name}</span>
          <span className="n-eco-good-sub">
            {g.from === 'shop' ? <><Chip tone="accent">{t('sm.mk.source.shop')}</Chip><StockChip n={g.stock ?? 0} /></>
              : g.inBook ? <>{g.bid > 0 ? <Chip tone="cyan">{t('market.buy_at', { n: formatNumber(g.bid) })}</Chip> : <Chip>{t('market.no_buyer')}</Chip>}{g.ask <= 0 && <Chip>{t('market.no_seller')}</Chip>}</>
                : <Chip>{t('market.no_book')}</Chip>}
          </span>
        </span>
      </button>
      <div className="n-eco-good-end">
        {price > 0 && <b>{moneyMain(price)}</b>}
        {onBuy && <button className="n-eco-buy" onClick={onBuy} disabled={g.from === 'shop' ? !(g.max && g.max > 0) : g.ask <= 0}>{t('market.buy')}</button>}
      </div>
    </div>
  )
}

export function Market({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  const v = (response?.view ?? {}) as unknown as MarketView
  const [shop, setShop] = useState<VillageShopView | null>(null)
  const [source, setSource] = useState<Source>('all')
  const [group, setGroup] = useState('all')
  const [buy, setBuy] = useState<Good | null>(null)
  // a village's own shop sells on the same page: «از دکان» beside «از اهالی»
  useEffect(() => {
    if (!v.village) return
    let live = true
    api.runCommand('settlement.shop', {}).then((r) => { if (live && r.ok !== false && r.view) setShop(r.view as unknown as VillageShopView) }).catch(() => undefined)
    return () => { live = false }
  }, [v.village])

  const goods = useMemo<Good[]>(() => {
    const out: Good[] = []
    for (const b of v.books ?? []) out.push({ code: b.item.code, name: n.item(b.item), group: b.shelf?.group ?? '', groupLabel: b.shelf?.label ?? '', from: 'people', ask: b.best_ask, bid: b.best_bid, last: b.last, inBook: true })
    for (const y of v.yours ?? []) if (!out.some((g) => g.code === y.code)) out.push({ code: y.code, name: n.item(y), group: '', groupLabel: '', from: 'people', ask: 0, bid: 0, last: 0, inBook: false })
    if (shop && !shop.closed) for (const l of shop.lines ?? []) out.push({ code: l.item.code, name: n.item(l.item), group: l.shelf?.group ?? '', groupLabel: l.shelf?.label ?? '', from: 'shop', ask: l.price, bid: 0, last: 0, stock: l.stock, max: l.max_buy, inBook: true })
    return out
  }, [v.books, v.yours, shop, n])

  if (!response) return <NoAnswer loading={loading} title={t('market.title')} />
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('sm.mk.closed_title')} />

  const groups = [...new Map(goods.filter((g) => g.group).map((g) => [g.group, groupWord(g.group, g.groupLabel)])).entries()]
  const bySource = goods.filter((g) => source === 'all' || g.from === source)
  const shown = group === 'all' ? bySource : bySource.filter((g) => g.group === group)
  const hasShop = goods.some((g) => g.from === 'shop')
  const vil = v.village
  const bookOf = (code: string) => find(acts, 'market.book', { item: code })

  function buyGood(g: Good, qty: number) {
    setBuy(null)
    if (g.from === 'shop') nav.act({ command: 'settlement.shop.buy', args: { item: g.code, qty: String(qty) }, kind: 'primary' })
    else nav.act({ command: 'market.order', args: { side: 'buy', item: g.code, qty: String(qty), price: String(g.ask) }, kind: 'primary' })
  }

  return (
    <Page title={t('market.title')} sub={v.city || undefined} art="market">
      <Said r={response} />
      {!v.at_market && (v.way ? <WalkTo way={v.way} acts={acts} /> : <Note tone="info" icon="walk">{t('eco.market.away')}</Note>)}
      {vil && (
        <div className="n-card flat n-eco-stalls">
          <div className="n-eco-stalls-head">
            <Icon name="tent" size={34} />
            <b>{t('n.eco.stalls', { used: formatNumber(vil.stalls_used), n: formatNumber(vil.stalls) })}</b>
            {vil.market_day && <Chip tone="solid">{t('n.eco.market_day')}</Chip>}
          </div>
          <p className="n-eco-hint">{vil.market_day ? t('sm.mk.day') : t('sm.mk.rates', { d: bpsText(vil.dues_bps), l: bpsText(vil.listing_bps) })}</p>
        </div>
      )}

      {hasShop && (
        <Segmented items={[{ key: 'all', label: t('sm.mk.source.all') }, { key: 'shop', label: t('sm.mk.source.shop') }, { key: 'people', label: t('sm.mk.source.people') }]}
          value={source} onChange={(k) => setSource(k as Source)} />
      )}
      {groups.length > 1 && <Pills items={[{ key: 'all', label: t('goods.cat.all') }, ...groups.map(([k, label]) => ({ key: k, label }))]} value={group} onChange={setGroup} />}

      {goods.length === 0 ? <Empty icon="market">{t('eco.market.empty')}</Empty>
        : shown.length === 0 ? <Empty icon="m_search">{t('goods.none')}</Empty> : (
          <div className="n-eco-goods">
            {shown.map((g) => {
              const book = g.from === 'people' ? bookOf(g.code) : undefined
              return <GoodRow key={`${g.from}:${g.code}`} g={g} onOpen={book ? () => nav.act(book) : g.from === 'shop' ? () => setBuy(g) : undefined} onBuy={() => setBuy(g)} />
            })}
          </div>
        )}

      <More acts={acts} skip={(a) => idOf(a) === 'market.book' || idOf(a) === 'place.walk'} />

      {buy && (
        <QtySheet title={buy.name} icon={itemIcon(buy.code, buy.group)} unit={buy.ask} max={buy.from === 'shop' ? buy.max ?? 0 : 0}
          sub={buy.from === 'shop' ? t('sm.mk.source.shop') : t('sm.mk.source.people')}
          confirm={(q) => t('n.eco.buy_n', { n: formatNumber(q) })}
          extra={buy.from === 'people' && bookOf(buy.code) ? <Button kind="text" icon="trade" onClick={() => { const b = bookOf(buy.code); setBuy(null); if (b) nav.act(b) }}>{t('n.eco.see_book')}</Button> : undefined}
          onConfirm={(q) => buyGood(buy, q)} onClose={() => setBuy(null)} />
      )}
    </Page>
  )
}

// -- the book of one good ------------------------------------------------------------------------------------

/** One side of the book: price and count lines with a bar of the count behind. */
function Depth({ title, levels, side }: { title: string; levels: BookLevel[]; side: 'ask' | 'bid' }) {
  const top = Math.max(1, ...levels.map((l) => l.qty))
  return (
    <div className={`n-eco-depth ${side}`}>
      <h3>{title}</h3>
      {levels.length === 0 ? <p className="n-eco-hint">{t(side === 'ask' ? 'market.no_seller' : 'market.no_buyer')}</p> : levels.map((l, i) => (
        <div key={i} className="n-eco-depth-line">
          <i style={{ width: `${Math.round((l.qty / top) * 100)}%` }} />
          <b>{moneyMain(l.price)}</b>
          <span>×{formatNumber(l.qty)}</span>
        </div>
      ))}
    </div>
  )
}

/** Buy or sell in the book: the prices the server offers as choices, how many, the total, the one button. */
function OrderSheet({ title, icon, options, max, onGo, onClose }: { title: string; icon: string; options: { a: Action; label: string }[]; max: number; onGo: (a: Action, qty: number) => void; onClose: () => void }) {
  const [pick, setPick] = useState(0)
  const [qty, setQty] = useState(1)
  const o = options[Math.min(pick, options.length - 1)]
  const fixed = o ? idOf(o.a) === 'market.ask_all' : false
  const q = fixed ? argNum(o.a, 'qty') : qty
  return (
    <Sheet title={title} icon={icon} onClose={onClose}>
      <div className="n-eco-opts">
        {options.map((x, i) => <button key={i} aria-pressed={i === pick} onClick={() => setPick(i)}>{x.label}</button>)}
      </div>
      {!fixed && <Qty value={qty} max={max} onChange={setQty} />}
      {o && <div className="n-eco-total"><span>{t('n.eco.total')}</span><b>{money(argNum(o.a, 'price') * q)}</b></div>}
      <Buttons lead>
        <Button disabled={!o} onClick={() => o && onGo(o.a, q)}>{title}</Button>
        <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      </Buttons>
    </Sheet>
  )
}

export function Book({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  const [sheet, setSheet] = useState<'buy' | 'sell' | null>(null)
  if (!response) return <NoAnswer loading={loading} title={t('market.book_fallback')} />
  const v = response.view as unknown as BookView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('sm.mk.closed_title')} />
  const name = n.item(v.item)
  const buys = byId(acts, 'market.buy_at', 'market.bid_at').map((a) => ({ a, label: t(idOf(a) === 'market.buy_at' ? 'n.eco.buy_at' : 'n.eco.bid_at', { price: money(argNum(a, 'price')) }) }))
  const sells = byId(acts, 'market.sell_at', 'market.ask_at', 'market.ask_all').map((a) => ({
    a, label: idOf(a) === 'market.ask_all' ? t('eco.market.ask_all', { qty: formatNumber(argNum(a, 'qty')), price: money(argNum(a, 'price')) }) : t(idOf(a) === 'market.sell_at' ? 'n.eco.sell_at' : 'n.eco.ask_at', { price: money(argNum(a, 'price')) }),
  }))
  const asks = [...(v.asks ?? [])].sort((a, b) => a.price - b.price)
  const bids = [...(v.bids ?? [])].sort((a, b) => b.price - a.price)
  const drawn = (a: Action) => buys.some((x) => x.a === a) || sells.some((x) => x.a === a) || idOf(a) === 'place.walk'

  return (
    <Page title={name} sub={v.city || undefined}>
      <Said r={response} />
      <div className="n-eco-itemhead">
        <span className="n-eco-itemwell"><Icon name={itemIcon(v.item.code)} /></span>
        <Stats>
          <Stat label={t('market.last_price')} value={v.reference ? moneyMain(v.reference) : '—'} tone="lit" />
          <Stat label={t('market.you_hold')} value={formatNumber(v.holding)} />
        </Stats>
      </div>
      {!v.at_market && <WalkTo way={v.way} acts={acts} />}

      {v.at_market && (buys.length > 0 || sells.length > 0) && (
        <Buttons>
          {buys.length > 0 && <Button icon="cart" onClick={() => setSheet('buy')}>{t('market.buy')}</Button>}
          {sells.length > 0 && <Button kind="cyan" icon="tag" onClick={() => setSheet('sell')}>{t('market.sell')}</Button>}
        </Buttons>
      )}

      <div className="n-eco-book">
        <Depth title={t('eco.stock.asks')} levels={asks} side="ask" />
        <Depth title={t('eco.stock.bids')} levels={bids} side="bid" />
      </div>

      {(v.trades ?? []).length > 0 && (
        <>
          <Section title={t('market.recent')} />
          <List>
            {(v.trades ?? []).map((tr, i) => <Row key={i} icon="trade" title={t('eco.trade_line', { qty: formatNumber(tr.qty), price: money(tr.price) })} end={tr.at ? <small>{atText(tr.at)}</small> : undefined} />)}
          </List>
        </>
      )}
      <p className="n-eco-hint">{t('eco.market.fee_note')}</p>
      <More acts={acts} skip={drawn} />

      {sheet === 'buy' && <OrderSheet title={t('market.buy')} icon="cart" options={buys} max={0} onClose={() => setSheet(null)} onGo={(a, q) => { setSheet(null); nav.act(withArgs(a, { qty: String(q) }, 'navigation')) }} />}
      {sheet === 'sell' && <OrderSheet title={t('market.sell')} icon="tag" options={sells} max={v.holding} onClose={() => setSheet(null)} onGo={(a, q) => { setSheet(null); nav.act(withArgs(a, { qty: String(q) }, 'navigation')) }} />}
    </Page>
  )
}

// -- checkout, placed, cancelled -------------------------------------------------------------------------------

export function MarketCheckout({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as MarketCheckoutView
  const acts = actsOf(response)
  const note = payNote(v.payment)
  return (
    <Page title={t('eco.market.checkout_title', { item: n.item(v.item) })}>
      <Said r={response} />
      <Hero art={itemIcon(v.item.code)}>
        <p className="n-label">{t('eco.market.reserve')}</p>
        <BigMoney n={v.reserve} />
        <p className="n-hero-line"><Chip>{t('eco.trade_line', { qty: formatNumber(v.qty), price: moneyMain(v.price) })}</Chip></p>
      </Hero>
      <Facts rows={[{ label: t('eco.market.qty'), value: formatNumber(v.qty) }, { label: t('eco.market.price_each'), value: money(v.price) }]} />
      <p className="n-eco-hint">{t('eco.market.escrow_how')}</p>
      <Purses p={v.payment} />
      {note && <p className="n-eco-hint">{note}</p>}
      <PayButtons acts={acts} p={v.payment} />
      <More acts={acts} skip={(a) => idOf(a).startsWith('payment.') || idOf(a) === 'bank.show'} title="" />
    </Page>
  )
}

export function OrderPlaced({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as OrderPlacedView
  const buy = v.side === 'buy'
  const item = n.item(v.item)
  return (
    <Done title={t('eco.market.placed_title', { no: formatNumber(v.no) })} icon={itemIcon(v.item.code)}
      lead={t(buy ? 'eco.market.placed_buy' : 'eco.market.placed_sell', { item, qty: formatNumber(v.qty), price: money(v.price) })} acts={actsOf(response)}>
      {v.filled > 0 && <Note tone="ok" icon="m_check">{t(buy ? 'eco.market.filled_buy' : 'eco.market.filled_sell', { filled: formatNumber(v.filled), spent: money(v.spent), got: money(v.got) })}</Note>}
      {v.rests && <Note tone="info" icon="stopwatch">{t('eco.market.rests', { left: formatNumber(v.qty - v.filled), t: atText(v.expires_at) })}</Note>}
      {v.embargoed > 0 && <Note tone="bad" icon="x_wanted">{t('eco.market.embargoed', { count: formatNumber(v.embargoed) })}</Note>}
      {v.listing_fee > 0 && <p className="n-eco-hint">{t('sm.mk.fee_paid', { fee: money(v.listing_fee) })}</p>}
      {buy && v.method && <p className="n-eco-hint">{t(v.method === 'card' ? 'eco.pay.paid_card' : 'eco.pay.paid_cash')}</p>}
    </Done>
  )
}

export function OrderCancelled({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as OrderCancelledView
  return (
    <Done title={t('eco.market.cancelled_title', { no: formatNumber(v.no) })} icon={itemIcon(v.item.code)} tone="info" acts={actsOf(response)}
      lead={v.side === 'buy' ? t('eco.market.cancelled_buy', { no: formatNumber(v.no), refund: money(v.refund) }) : t('eco.market.cancelled_sell', { no: formatNumber(v.no), item: n.item(v.item), left: formatNumber(v.left) })} />
  )
}

export function MyOrders({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('eco.market.mine_title')} />
  const v = response.view as unknown as MyOrdersView
  const acts = actsOf(response)
  const orders = v.orders ?? []
  const open = orders.filter((o) => o.status === 'open')
  const done = orders.filter((o) => o.status !== 'open')
  const line = (o: (typeof orders)[number]) => {
    const cancel = o.status === 'open' ? find(acts, 'market.cancel', { no: o.no }) : undefined
    const status = hasKey(`eco.market.status.${o.status}`) ? t(key(`eco.market.status.${o.status}`)) : o.status
    return (
      <div key={o.no} className="n-eco-order">
        <span className="n-eco-good-well"><Icon name={itemIcon(o.item.code)} /></span>
        <div className="n-eco-good-body">
          <span className="n-eco-good-name">{t(o.side === 'buy' ? 'eco.market.order_buy' : 'eco.market.order_sell', { no: formatNumber(o.no), item: n.item(o.item) })}</span>
          <span className="n-eco-order-sub">{t('eco.market.order_sub', { filled: formatNumber(o.filled), qty: formatNumber(o.qty), price: money(o.price), city: n.city(o.city_code, o.city) })}</span>
          <span className="n-chips">
            <Chip tone={o.side === 'buy' ? 'cyan' : 'accent'}>{o.side === 'buy' ? t('market.buy') : t('market.sell')}</Chip>
            <Chip tone={o.status === 'open' ? 'ok' : undefined}>{status}</Chip>
            {o.status === 'open' && o.expires_at && <Chip>{t('time.until', { at: atText(o.expires_at) })}</Chip>}
          </span>
        </div>
        {cancel && <Button small kind="danger" onClick={() => nav.act(cancel)}>{t('common.cancel')}</Button>}
      </div>
    )
  }
  return (
    <Page title={t('eco.market.mine_title')}>
      <Said r={response} />
      {orders.length === 0 && <Empty icon="checklist">{t('eco.market.mine_none')}</Empty>}
      {open.length > 0 && <><Section title={t('eco.market.status.open')} note={formatNumber(open.length)} />{open.map(line)}</>}
      {done.length > 0 && <><Section title={t('n.eco.past')} />{done.map(line)}</>}
      <More acts={acts} skip={(a) => idOf(a) === 'market.cancel'} />
    </Page>
  )
}

export function MarketRefusal({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as MarketRefusalView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('sm.mk.closed_title')} />
  const k = hasKey(`sm.mk.refused.${v.kind}`) ? `sm.mk.refused.${v.kind}` : `eco.market.refused.${v.kind}`
  return <Done title={t('eco.refused.title')} icon={v.item?.code ? itemIcon(v.item.code) : 'market'} tone="bad" acts={acts}
    lead={hasKey(k) ? t(key(k), { item: n.item(v.item), count: formatNumber(v.count) }) : t('refusal.unknown')} />
}
