// The item market and the city shops, drawn from the view and the actions of the answer
// (docs/adr/0039-presentation-split.md). Item, shop and place names come from the content catalogue.

import { short } from '../../ui/v6/short'
import type {
  BookView, MarketCheckoutView, MarketRefusalView, MarketView, MyOrdersView, OrderCancelledView, OrderPlacedView,
  SellOffersView, ShopBoughtView, ShopCheckoutView, ShopRefusalView, ShopSoldView, ShopView, ShopsView, Way,
} from '../../api/views.gen'
import { useEffect, useMemo, useState } from 'react'
import { ListRow, Notice, Stat, StatPair } from '../native/kit/Parts'
import { GoodsTools, useGoodsFilter, type GoodsRow } from '../../ui/v6/goodsFilter'
import GoodsCard from '../../ui/v6/GoodsCard'
import { CardGrid, PStats, PTabs } from '../../ui/v6/panel'
import { useVillageCommand } from '../../village/useVillage'
import type { VillageShopView } from '../../api/views.gen'
import { formatNumber, hms, money } from '../native/kit/format'
import { CostSummary } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { ConfirmPopup, Do, NotHere, PayFooter, Purses, bps, byId, find, nameOf, payNote, rest } from './kit'
import { BookTables, TradeList } from './exchange'
import { clockText } from './time'

const key = (k: string) => k as Key

/** The walk to where the service is: the place and the time it takes, with the button that goes. */
function WalkTo({ way, ctx }: { way: Way | null; ctx: FlowCtx }) {
  if (!way) return null
  const go = find(ctx, 'place.walk')
  return (
    <>
      <Notice>{t('market.walk', { t: hms(way.walk_seconds), place: ctx.names.name(['place'], way.place.code, way.place.name) })}</Notice>
      {go && <Do ctx={ctx} a={go} tone="gold" label={t('eco.walk_there', { place: ctx.names.name(['place'], way.place.code, way.place.name), t: hms(way.walk_seconds) })} />}
    </>
  )
}

// -- the market ------------------------------------------------------------------------------------

/** The market screen is the market only (the order book of goods): search by name, tabs by the catalogue's category,
 * sorting. The storehouse is a screen of its own (village_storage). */
function MarketBody({ v, ctx }: { v: MarketView; ctx: FlowCtx }) {
  const cmd = useVillageCommand()
  // the village's own shop sells on the same page (ADR 0046 section 9): «از دکان» beside «از اهالی»
  const [shop, setShop] = useState<VillageShopView | null>(null)
  const [source, setSource] = useState<'all' | 'shop' | 'people'>('all')
  useEffect(() => {
    if (!v.village) return
    void cmd('settlement.shop', {}, { silent: true }).then((r) => { if (r.ok && r.res?.view) setShop(r.res.view as unknown as VillageShopView) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.village])
  type Row = { code: string; ask: number; bid: number; last: number; book: boolean; from: 'shop' | 'people'; stock?: number }
  const rows = useMemo<GoodsRow<Row>[]>(() => [
    ...(v.books ?? []).map((b) => ({ item: { code: b.item.code, ask: b.best_ask, bid: b.best_bid, last: b.last, book: true, from: 'people' as const }, name: nameOf(ctx, ['item', 'component'], b.item), category: ctx.names.category(['item', 'component'], b.item.code), shelf: b.shelf, price: b.best_ask > 0 ? b.best_ask : b.last > 0 ? b.last : undefined })),
    ...(v.yours ?? []).map((y) => ({ item: { code: y.code, ask: 0, bid: 0, last: 0, book: false, from: 'people' as const }, name: nameOf(ctx, ['item', 'component'], y), category: ctx.names.category(['item', 'component'], y.code), price: undefined })),
    ...((shop && shop.closed === '' ? shop.lines ?? [] : []).map((l) => ({ item: { code: l.item.code, ask: l.price, bid: 0, last: 0, book: true, from: 'shop' as const, stock: l.stock }, name: nameOf(ctx, ['item', 'component'], l.item), category: ctx.names.category(['item', 'component'], l.item.code), shelf: l.shelf, price: l.price }))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [v, shop, ctx.names])
  const f = useGoodsFilter(rows, ['name', 'low', 'high'])
  const shown = f.shown.filter((r) => source === 'all' || r.item.from === source)
  const village = v.village
  return (
    <>
      {village && (
        <>
          <PStats items={[
            { label: t('sm.mk.stalls', { used: formatNumber(village.stalls_used), n: formatNumber(village.stalls), mine: formatNumber(village.mine), per: formatNumber(village.per_player) }), value: `${formatNumber(village.stalls_used)} / ${formatNumber(village.stalls)}` },
          ]} />
          <Hint>{village.market_day ? t('sm.mk.day') : t('sm.mk.rates', { d: bps(village.dues_bps), l: bps(village.listing_bps) })}</Hint>
          <Hint>{t('sm.mk.away')}</Hint>
          <PTabs tabs={[{ key: 'all', label: t('sm.mk.source.all') }, { key: 'shop', label: t('sm.mk.source.shop') }, { key: 'people', label: t('sm.mk.source.people') }]} value={source} onChange={(k) => setSource(k as typeof source)} />
        </>
      )}
      <GoodsTools f={f as never} />
      {shown.length === 0 && <p className="pn-hint">{t('goods.none')}</p>}
      <CardGrid>
        {shown.map((r) => (
          <GoodsCard key={`${r.item.from}:${r.item.code}`} code={r.item.code} name={r.name} group={r.shelf?.group ?? r.category}
            price={r.item.from === 'shop' ? money(r.item.ask) : r.item.last > 0 ? money(r.item.last) : undefined}
            price2={r.item.from === 'shop' ? t('sm.mk.shop_left', { n: formatNumber(r.item.stock ?? 0) }) : r.item.book ? t('market.bid_ask', { bid: r.item.bid > 0 ? formatNumber(r.item.bid) : '—', ask: r.item.ask > 0 ? formatNumber(r.item.ask) : '—' }) : t('market.no_book')}
            source={village ? (r.item.from === 'shop' ? t('sm.mk.source.shop') : t('sm.mk.source.people')) : undefined}
            onClick={() => {
              if (r.item.from === 'shop') { ctx.run('settlement.shop'); return }
              const a = find(ctx, 'market.book', { item: r.item.code }); if (a) ctx.go(a)
            }} />
        ))}
      </CardGrid>
    </>
  )
}

const Market = flow<MarketView>(({ view: v, ctx }) => v.unavailable ? (
  <NotHere u={v.unavailable} ctx={ctx} title={t('sm.mk.closed_title')} tone="emerald" />
) : (
  <Page title={t('market.title')} tone="emerald">
    {!v.at_market && !v.way && <Notice>{t('eco.market.away')}</Notice>}
    {!v.at_market && <WalkTo way={v.way} ctx={ctx} />}
    {(v.books ?? []).length === 0 && (v.yours ?? []).length === 0 && <Notice>{t('eco.market.empty')}</Notice>}
    <MarketBody v={v} ctx={ctx} />
    <Btns ctx={ctx} list={byId(ctx, 'market.mine', 'market.auctions', 'market.goods')} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const Book = flow<BookView>(({ view: v, ctx }) => {
  const buys = byId(ctx, 'market.buy_at', 'market.bid_at')
  const sells = byId(ctx, 'market.sell_at', 'market.ask_at', 'market.ask_all')
  return (
    <Page title={nameOf(ctx, ['item', 'component'], v.item)} tone="emerald">
      {!v.at_market && <WalkTo way={v.way} ctx={ctx} />}
      <StatPair
        left={<Stat icon="tag" palette="gold" label={t('market.last_price')} value={money(v.reference)} />}
        right={<Stat icon="box" palette="steel" label={t('market.you_hold')} value={formatNumber(v.holding)} />}
      />
      <BookTables bids={v.bids} asks={v.asks} titleBids={t('market.buy')} titleAsks={t('market.sell')} />
      <TradeList trades={v.trades} title={t('market.recent')} />
      {v.at_market && (
        <Panel>
          <Lead>{t('eco.market.buy')}</Lead>
          <div className="vf-btns row">
            {buys.map((a) => <button key={`${a.id}${a.args?.price}`} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{short(<>{t(a.id === 'market.buy_at' ? 'eco.market.buy_at' : 'eco.market.bid_at', { price: money(Number(a.args?.price)) })}</>)}</button>)}
          </div>
          {sells.length > 0 && <Lead>{t('eco.market.sell')}</Lead>}
          <div className="vf-btns row">
            {sells.map((a) => <button key={`${a.id}${a.args?.price}${a.args?.qty}`} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>
              {t(a.id === 'market.ask_all' ? 'eco.market.ask_all' : a.id === 'market.sell_at' ? 'eco.market.sell_at' : 'eco.market.ask_at', { qty: formatNumber(Number(a.args?.qty)), price: money(Number(a.args?.price)) })}
            </button>)}
          </div>
        </Panel>
      )}
      <Hint>{t('eco.market.fee_note')}</Hint>
      <Btns ctx={ctx} list={byId(ctx, 'market.mine')} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const MarketCheckout = flow<MarketCheckoutView>(({ view: v, ctx }) => (
  <ConfirmPopup title={t('eco.market.checkout_title', { item: nameOf(ctx, ['item', 'component'], v.item) })} ctx={ctx} tone="gold"
    footer={<PayFooter ctx={ctx} p={v.payment} bank={find(ctx, 'bank.show')} />}>
    <CostSummary
      lines={[{ label: t('eco.market.qty'), amount: formatNumber(v.qty) }, { label: t('eco.market.price_each'), amount: money(v.price) }]}
      total={{ label: t('eco.market.reserve'), amount: money(v.reserve) }} />
    <Hint>{t('eco.market.escrow_how')}</Hint>
    <Purses p={v.payment} />
    {payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}
  </ConfirmPopup>
))

const OrderPlaced = flow<OrderPlacedView>(({ view: v, ctx }) => {
  const buy = v.side === 'buy'
  const item = nameOf(ctx, ['item', 'component'], v.item)
  return (
    <Page title={t('eco.market.placed_title', { no: formatNumber(v.no) })} tone="emerald">
      <Panel tone="emerald">
        <Lead tone="good">{t(buy ? 'eco.market.placed_buy' : 'eco.market.placed_sell', { item, qty: formatNumber(v.qty), price: money(v.price) })}</Lead>
        {v.filled > 0 && <Hint tone="good">{t(buy ? 'eco.market.filled_buy' : 'eco.market.filled_sell', { filled: formatNumber(v.filled), spent: money(v.spent), got: money(v.got) })}</Hint>}
        {v.rests && <Hint>{t('eco.market.rests', { left: formatNumber(v.qty - v.filled), t: clockText(v.expires_at) })}</Hint>}
        {v.embargoed > 0 && <Hint tone="bad">{t('eco.market.embargoed', { count: formatNumber(v.embargoed) })}</Hint>}
        {buy && <Hint>{t(v.method === 'card' ? 'eco.pay.paid_card' : 'eco.pay.paid_cash')}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const OrderCancelled = flow<OrderCancelledView>(({ view: v, ctx }) => (
  <Page title={t('eco.market.cancelled_title', { no: formatNumber(v.no) })} tone="emerald">
    <Panel>
      <Lead>{v.side === 'buy'
        ? t('eco.market.cancelled_buy', { no: formatNumber(v.no), refund: money(v.refund) })
        : t('eco.market.cancelled_sell', { no: formatNumber(v.no), item: nameOf(ctx, ['item', 'component'], v.item), left: formatNumber(v.left) })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const MyOrders = flow<MyOrdersView>(({ view: v, ctx }) => (
  <Page title={t('eco.market.mine_title')} tone="emerald">
    {(v.orders ?? []).length === 0 && <Notice>{t('eco.market.mine_none')}</Notice>}
    {(v.orders ?? []).map((o) => {
      const cancel = o.status === 'open' ? find(ctx, 'market.cancel', { no: o.no }) : undefined
      return (
        <Panel key={o.no}>
          <ListRow icon={o.side === 'buy' ? 'cart' : 'tag'} palette={o.status === 'open' ? 'emerald' : 'steel'}
            title={t(o.side === 'buy' ? 'eco.market.order_buy' : 'eco.market.order_sell', { no: formatNumber(o.no), item: nameOf(ctx, ['item', 'component'], o.item) })}
            sub={t('eco.market.order_sub', { filled: formatNumber(o.filled), qty: formatNumber(o.qty), price: money(o.price), city: ctx.names.name(['city'], o.city_code, o.city) })}
            right={hasKey(`eco.market.status.${o.status}`) ? t(key(`eco.market.status.${o.status}`)) : ''} />
          {cancel && <Do ctx={ctx} a={cancel} tone="red" label={t('eco.market.cancel', { no: formatNumber(o.no) })} />}
        </Panel>
      )
    })}
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const MarketRefusal = flow<MarketRefusalView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('sm.mk.closed_title')} tone="ruby" />
  const k = hasKey(`sm.mk.refused.${v.kind}`) ? `sm.mk.refused.${v.kind}` : `eco.market.refused.${v.kind}`
  return (
    <Page title={t('eco.refused.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(k) ? t(key(k), { item: nameOf(ctx, ['item', 'component'], v.item), count: formatNumber(v.count) }) : t('refusal.unknown')}</Lead>
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- the shops ---------------------------------------------------------------------------------------

const Shops = flow<ShopsView>(({ view: v, ctx }) => {
  const city = ctx.names.name(['city'], v.city_code, v.city)
  const at = v.place ? ctx.names.name(['place'], v.place.code, v.place.name) : ''
  return (
    <Page title={at ? t('shops.title_at', { place: at }) : t('shops.title')} tone="emerald">
      {(v.shops ?? []).length === 0 && <Notice>{at ? t('eco.shops.none_at', { place: at }) : t('shops.none')}</Notice>}
      <Hint>{t('eco.shops.in_city', { city })}</Hint>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.shops ?? []).map((s) => (
          <ListRow key={s.shop.code} icon="cart" palette={s.here ? 'emerald' : 'steel'} title={nameOf(ctx, ['shop'], s.shop)}
            sub={s.here ? t('shops.here', { place: ctx.names.name(['place'], s.place.code, s.place.name) }) : ctx.names.name(['place'], s.place.code, s.place.name)}
            onClick={() => { const a = find(ctx, 'shop.open', { shop: s.shop.code }); if (a) ctx.go(a) }} />
        ))}
      </div>
      <Btns ctx={ctx} list={byId(ctx, 'shop.all', 'item.bag')} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const ShopDetail = flow<ShopView>(({ view: v, ctx }) => {
  const place = ctx.names.name(['place'], v.place.code, v.place.name)
  const go = find(ctx, 'place.walk')
  return (
    <Page title={nameOf(ctx, ['shop'], v.shop)} tone="emerald">
      <Notice>{v.here ? t('eco.shops.at_counter') : t('eco.shops.away', { place })}</Notice>
      {!v.here && go && v.walk_seconds > 0 && <Do ctx={ctx} a={go} tone="gold" label={t('eco.walk_there', { place, t: hms(v.walk_seconds) })} />}
      <Panel>
        {(v.shelves ?? []).map((s) => {
          const buy = v.here && s.stock > 0 ? find(ctx, 'shop.buy', { item: s.item.code }) : undefined
          return (
            <ListRow key={s.item.code} icon="box" palette={s.stock > 0 ? 'emerald' : 'steel'} title={nameOf(ctx, ['item', 'component'], s.item)}
              sub={s.stock === 0 ? t('eco.shops.empty') : `${t('eco.shops.stock', { n: formatNumber(s.stock) })}${s.busy ? ` · ${t('eco.shops.busy')}` : ''}${s.buyback > 0 ? ` · ${t('eco.shops.buys', { n: money(s.buyback) })}` : ''}`}
              right={money(s.price)} onClick={buy ? () => ctx.go(buy) : undefined} />
          )
        })}
        {(v.shelves ?? []).length === 0 && <Hint>{t('eco.shops.no_shelves')}</Hint>}
      </Panel>
      {v.tax_bps > 0 && <Hint>{t('eco.shops.tax_note', { p: `${v.tax_bps / 100}%` })}</Hint>}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const ShopCheckout = flow<ShopCheckoutView>(({ view: v, ctx }) => {
  const more = byId(ctx, 'shop.qty')
  return (
    <ConfirmPopup title={t('eco.shops.checkout_title', { shop: nameOf(ctx, ['shop'], v.shop) })} ctx={ctx} tone="gold"
      footer={<PayFooter ctx={ctx} p={v.payment} bank={find(ctx, 'bank.show')} />}>
      <Lead>{t('eco.shops.checkout_item', { item: nameOf(ctx, ['item', 'component'], v.item), qty: formatNumber(v.qty), unit: money(v.unit) })}</Lead>
      <CostSummary
        lines={[{ label: t('eco.shops.price'), amount: money(v.total) }, ...(v.tax > 0 ? [{ label: t('eco.shops.tax', { p: `${v.tax_bps / 100}%` }), amount: money(v.tax) }] : [])]}
        total={{ label: t('eco.shops.due'), amount: money(v.total + v.tax) }} />
      <Purses p={v.payment} />
      {payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}
      {more.length > 0 && (
        <div className="vf-btns row">
          {more.map((a) => <button key={a.args?.qty} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('eco.shops.qty', { n: formatNumber(Number(a.args?.qty)) })}</button>)}
        </div>
      )}
    </ConfirmPopup>
  )
})

const ShopBought = flow<ShopBoughtView>(({ view: v, ctx }) => (
  <Page title={t('eco.shops.bought_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('eco.shops.bought', { item: nameOf(ctx, ['item', 'component'], v.item), qty: formatNumber(v.qty), total: money(v.total + v.tax) })}</Lead>
      {v.tax > 0 && <Hint>{t('eco.shops.bought_tax', { tax: money(v.tax) })}</Hint>}
      <Hint>{t(v.method === 'card' ? 'eco.pay.paid_card' : 'eco.pay.paid_cash')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const SellOffers = flow<SellOffersView>(({ view: v, ctx }) => (
  <Page title={t('eco.shops.offers_title', { item: nameOf(ctx, ['item', 'component'], v.item) })} tone="emerald">
    {(v.offers ?? []).length === 0 && <Notice>{t('eco.shops.offers_none')}</Notice>}
    {(v.offers ?? []).map((o) => {
      const a = find(ctx, 'shop.sell_to', { shop: o.shop.code })
      return <ListRow key={o.shop.code} icon="tag" palette="gold" title={nameOf(ctx, ['shop'], o.shop)} sub={ctx.names.name(['place'], o.place.code, o.place.name)}
        right={money(o.price)} onClick={() => a && ctx.go(a)} />
    })}
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const ShopSold = flow<ShopSoldView>(({ view: v, ctx }) => (
  <Page title={t('eco.shops.sold_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('eco.shops.sold', { item: nameOf(ctx, ['item', 'component'], v.item), shop: nameOf(ctx, ['shop'], v.shop), price: money(v.price) })}</Lead>
      <Hint>{t('eco.shops.left', { n: formatNumber(v.left) })}</Hint>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const ShopRefusal = flow<ShopRefusalView>(({ view: v, ctx }) => {
  const k = `eco.shops.refused.${v.kind}`
  return (
    <Page title={t('eco.refused.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(k) ? t(key(k), { shop: nameOf(ctx, ['shop'], v.shop), item: nameOf(ctx, ['item', 'component'], v.item), stock: formatNumber(v.stock) }) : t('refusal.unknown')}</Lead>
        {v.kind === 'sold_out' && v.next_restock && <Facts rows={[{ label: t('eco.shops.restock'), value: clockText(v.next_restock) }]} />}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({
  market: Market, book: Book, market_checkout: MarketCheckout, order_placed: OrderPlaced, order_cancelled: OrderCancelled,
  my_orders: MyOrders, market_refusal: MarketRefusal, shops: Shops, shop_detail: ShopDetail, shop_checkout: ShopCheckout,
  shop_bought: ShopBought, sell_offers: SellOffers, shop_sold: ShopSold, shop_refusal: ShopRefusal,
})

/** The screens this file draws. */
export const TRADE_SCREENS = [
  'market', 'book', 'market_checkout', 'order_placed', 'order_cancelled', 'my_orders', 'market_refusal',
  'shops', 'shop_detail', 'shop_checkout', 'shop_bought', 'sell_offers', 'shop_sold', 'shop_refusal',
]
