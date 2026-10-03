// A company's floor: the warehouse, the suppliers, the production orders and their plan, putting goods up for
// sale, the company's listings, the goods the city's companies sell and buying one, and a refused production
// request. Drawn from the view and the actions of each answer (docs/adr/0039-presentation-split.md); names of
// components, items, suppliers, attributes and technologies come from the content catalogue.

import type {
  BuyView, GoodsView, ListingsView, OrdersView, ProduceView, ProductionLine, ProductionRefusalView, SellView, SuppliersView, WarehouseView,
} from '../../api/views.gen'
import { ListRow } from '../native/kit/Parts'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, flow, registerFlow } from '../village/flow'
import { clockText } from '../economy/time'
import { Purses, payNote } from '../economy/kit'
import {
  BackBtn, Chip, Do, Facts, Hint, Lead, Notice, Page, Panel, byId, formatNumber, go, left, money, nameOf, roughDuration,
} from './kit'
import { NextStepCard } from './manage'
import { TABLES, goodName, namedOf, skillLevel } from './wording'
import type { FlowCtx } from '../village/flow'
import { CardGrid } from '../../ui/v6/panel'

const key = (k: string) => k as Key
const col = { display: 'flex', flexDirection: 'column', gap: 8 } as const

// -- the warehouse -----------------------------------------------------------------------------------

const Warehouse = flow<WarehouseView>(({ view: v, ctx }) => {
  const sells = byId(ctx, 'production.sell')
  let i = 0
  return (
    <Page title={t('co.wh.title', { name: v.ref.name })} tone="emerald">
      <NextStepCard ctx={ctx} step={v.next} />
      <Panel>
        <Facts rows={[
          { label: t('co.wh.running'), value: formatNumber(v.running) },
          { label: t('co.wh.listings'), value: formatNumber(v.listings) },
        ]} />
        {v.researching && <Hint>{t('co.wh.researching')}</Hint>}
      </Panel>
      <Lead>{t('co.wh.stock')}</Lead>
      {(v.lines ?? []).length === 0 && <Notice>{t('co.wh.empty')}</Notice>}
      <div style={col}>
        {(v.lines ?? []).map((l, n) => {
          const sell = l.sellable ? sells[i++] : undefined
          const sub = [
            l.quality > 0 ? t('co.wh.pieces', { qty: formatNumber(l.qty), quality: formatNumber(l.quality) }) : t('co.wh.units', { qty: formatNumber(l.qty) }),
            l.listed > 0 ? t('co.wh.listed', { qty: formatNumber(l.listed) }) : '',
          ].filter(Boolean).join(' - ')
          return <ListRow key={n} icon="box" palette={l.sellable ? 'gold' : 'steel'} title={goodName(ctx.names, l.good)} sub={sub}
            right={sell ? t('co.wh.sell') : undefined} onClick={sell ? () => ctx.go(sell) : undefined} />
        })}
      </div>
      <Btns ctx={ctx} list={byId(ctx, 'production.suppliers', 'production.orders', 'production.studio', 'production.lab', 'production.reverse_lab', 'production.listings')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Suppliers = flow<SuppliersView>(({ view: v, ctx }) => (
  <Page title={t('co.sup.title', { city: ctx.names.name([...TABLES.city], v.city_code, v.city) })} tone="emerald">
    {v.bought && <Notice>{t('co.sup.bought', { qty: formatNumber(v.bought.qty), component: nameOf(ctx, TABLES.component, v.bought.component), total: money(v.bought.total) })}</Notice>}
    <Facts rows={[{ label: t('co.available'), value: money(v.available), gold: true }]} />
    {(v.offers ?? []).length === 0 && <Notice>{t('co.sup.none')}</Notice>}
    {(v.offers ?? []).map((o) => {
      const mine = ctx.acts.filter((a) => a.args?.component === o.component.code && ['production.supply', 'production.supply_other'].includes(a.id ?? ''))
      return (
        <Panel key={`${o.supplier.code}.${o.component.code}`}>
          <ListRow icon="cart" palette="emerald" title={nameOf(ctx, TABLES.component, o.component)}
            sub={t('co.sup.line', { supplier: nameOf(ctx, TABLES.supplier, o.supplier), price: money(o.price), stock: formatNumber(o.stock) })} />
          <div className="vf-btns row">
            {mine.filter((a) => a.id === 'production.supply').map((a) => <Chip key={a.args?.qty} ctx={ctx} a={a}>{t('co.sup.buy_qty', { qty: formatNumber(Number(a.args?.qty)) })}</Chip>)}
            {mine.filter((a) => a.id === 'production.supply_other').map((a) => <Chip key="other" ctx={ctx} a={a}>{t('co.sup.buy_other')}</Chip>)}
          </div>
        </Panel>
      )
    })}
    <Hint>{t('co.sup.hint')}</Hint>
    <BackBtn ctx={ctx} />
  </Page>
))

// -- orders -------------------------------------------------------------------------------------------

/** How a good one step away is opened: research a technology, buy a license for it, or both. */
function unlockHint(ctx: FlowCtx, steps: { tech: { code: string; name: string }; research: boolean }[]): string {
  const research = steps.filter((s) => s.research).map((s) => namedOf(ctx.names, TABLES.tech, s.tech))
  const license = steps.filter((s) => !s.research).map((s) => namedOf(ctx.names, TABLES.tech, s.tech))
  if (research.length && license.length) return t('co.unlock.both', { research: research.join('، '), license: license.join('، ') })
  if (license.length) return t('co.unlock.license', { techs: license.join('، ') })
  return t('co.unlock.research', { techs: research.join('، ') })
}
export { unlockHint }

function OrderLine({ ctx, o }: { ctx: FlowCtx; o: ProductionLine }) {
  const good = goodName(ctx.names, o.good)
  return o.done
    ? <ListRow icon="check" palette="emerald" title={t('co.order.done', { no: formatNumber(o.no), qty: formatNumber(o.output), good })} sub={t('co.order.quality', { quality: formatNumber(o.quality) })} />
    : <ListRow icon="clock" palette="gold" title={t('co.order.running', { no: formatNumber(o.no), qty: formatNumber(o.output), good })}
        sub={t('co.order.until', { time: clockText(o.finish_at), duration: left(o.left_seconds) })} />
}

const Orders = flow<OrdersView>(({ view: v, ctx }) => {
  const produce = byId(ctx, 'production.produce')
  const running = (v.orders ?? []).filter((o) => !o.done)
  const done = (v.orders ?? []).filter((o) => o.done)
  return (
    <Page title={t('co.orders.title', { name: v.ref.name })} tone="emerald">
      <Facts rows={[
        { label: t('co.orders.crew'), value: formatNumber(v.crew) },
        { label: t('co.orders.running'), value: t('co.of', { a: formatNumber(v.running), b: formatNumber(v.max) }) },
      ]} />
      {running.length > 0 && <><Lead>{t('co.orders.in_progress')}</Lead><CardGrid>{running.map((o) => <OrderLine key={o.no} ctx={ctx} o={o} />)}</CardGrid></>}
      {done.length > 0 && <><Lead>{t('co.orders.finished')}</Lead><CardGrid>{done.map((o) => <OrderLine key={o.no} ctx={ctx} o={o} />)}</CardGrid></>}
      {(v.orders ?? []).length === 0 && <Notice>{t('co.orders.none')}</Notice>}
      <Lead>{t('co.orders.new')}</Lead>
      {(v.targets ?? []).length === 0 && <Notice>{t('co.orders.no_targets')}</Notice>}
      <CardGrid>
        {(v.targets ?? []).map((tg, i) => (
          <ListRow key={i} icon="gears" palette="gold" title={goodName(ctx.names, tg.good)}
            sub={tg.batch > 0 ? t('co.orders.batch', { batch: formatNumber(tg.batch) }) : undefined}
            onClick={produce[i] ? () => ctx.go(produce[i]) : undefined} />
        ))}
      </CardGrid>
      {(v.locked ?? []).length > 0 && (
        <>
          <Lead>{t('co.orders.locked')}</Lead>
          <CardGrid>
            {(v.locked ?? []).map((l, i) => <ListRow key={i} icon="m_lock" palette="steel" title={goodName(ctx.names, l.good)} sub={unlockHint(ctx, l.steps ?? [])} />)}
          </CardGrid>
        </>
      )}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Produce = flow<ProduceView>(({ view: v, ctx }) => {
  const good = goodName(ctx.names, v.target.good)
  if (v.placed) {
    return (
      <Page title={t('co.produce.placed_title')} tone="emerald">
        <Panel tone="emerald">
          <Lead tone="good">{t('co.produce.placed', { no: formatNumber(v.placed.no), qty: formatNumber(v.placed.output), good, time: clockText(v.placed.finish_at), duration: left(v.placed.left_seconds) })}</Lead>
          <Hint>{t('co.produce.placed_hint')}</Hint>
        </Panel>
        <Btns ctx={ctx} list={byId(ctx, 'production.orders')} />
        <BackBtn ctx={ctx} />
      </Page>
    )
  }
  const batch = v.target.batch
  const sizes = byId(ctx, 'production.size', 'production.size_max')
  const start = byId(ctx, 'production.start_order')
  const fix = byId(ctx, 'production.stock_up', 'production.produce', 'production.goods', 'production.suppliers')
  const missing = (v.short ?? [])
  return (
    <Page title={t(v.kit ? 'co.produce.kit_title' : 'co.produce.title', { good })} tone="emerald">
      {v.bought > 0 && <Notice>{t('co.produce.bought', { total: money(v.bought) })}</Notice>}
      <Panel>
        {batch > 0 && <Hint>{t('co.produce.batch', { batch: formatNumber(batch) })}</Hint>}
        <Lead>{t(v.qty > 0 ? 'co.produce.recipe_order' : 'co.produce.recipe')}</Lead>
        <CardGrid>
          {(v.recipe ?? []).map((r) => {
            const ok = r.have >= (v.qty > 0 ? r.need : r.per)
            return <ListRow key={r.component.code} icon={ok ? 'check' : 'close'} palette={ok ? 'emerald' : 'ruby'} title={nameOf(ctx, TABLES.component, r.component)}
              sub={v.qty > 0 ? t('co.produce.need', { need: formatNumber(r.need), have: formatNumber(r.have) }) : t('co.produce.per', { per: formatNumber(r.per), have: formatNumber(r.have) })} />
          })}
        </CardGrid>
      </Panel>
      {v.qty <= 0 && <Lead>{t('co.produce.choose', { max: formatNumber(v.max_qty) })}</Lead>}
      {v.qty > 0 && (
        <Panel>
          <Lead>{t('co.produce.plan', { qty: formatNumber(batch > 0 ? v.qty * batch : v.qty), good, crew: formatNumber(v.crew), duration: roughDuration(v.duration_seconds) })}</Lead>
          {missing.length === 0 ? <Hint>{t('co.produce.consumes')}</Hint> : (
            <>
              <Lead tone="bad">{t('co.produce.short')}</Lead>
              {missing.map((s) => (
                <Hint key={s.component.code} tone="bad">{t(`co.short.${s.source}` as Key, { component: nameOf(ctx, TABLES.component, s.component), qty: formatNumber(Math.max(0, s.need - s.have)) })}</Hint>
              ))}
            </>
          )}
        </Panel>
      )}
      <div className="vf-btns row">
        {sizes.map((a) => <Chip key={`${a.id}${a.args?.qty}`} ctx={ctx} a={a}>{a.id === 'production.size_max'
          ? t('co.produce.all', { qty: formatNumber(Number(a.args?.qty)) })
          : t(batch > 0 ? 'co.produce.size_batch' : 'co.produce.size', { qty: formatNumber(Number(a.args?.qty)) })}</Chip>)}
      </div>
      {start.map((a) => <Do key="s" ctx={ctx} a={a} tone="gold" label={t('co.produce.start', { qty: formatNumber(batch > 0 ? v.qty * batch : v.qty) })} />)}
      {fix.map((a) => <Do key={`${a.id}${a.subject}`} ctx={ctx} a={a} tone="gold"
        label={a.id === 'production.stock_up' ? t('co.act.production.stock_up', { total: money(v.stock_up) }) : undefined} />)}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

// -- selling ------------------------------------------------------------------------------------------

const Sell = flow<SellView>(({ view: v, ctx }) => {
  const good = goodName(ctx.names, v.good)
  return (
    <Page title={t('co.sell.title', { good })} tone="gold">
      <Facts rows={[
        { label: t('co.sell.have'), value: formatNumber(v.have) },
        { label: t('co.sell.reference'), value: money(v.reference), gold: true },
        ...(v.qty > 0 ? [{ label: t('co.sell.qty'), value: formatNumber(v.qty) }] : []),
      ]} />
      {v.qty <= 0 ? (
        <Panel>
          <Lead>{t('co.sell.how_many')}</Lead>
          <div className="vf-btns row">
            {byId(ctx, 'production.size').map((a) => <Chip key={a.args?.qty} ctx={ctx} a={a}>{t('co.produce.size', { qty: formatNumber(Number(a.args?.qty)) })}</Chip>)}
            {byId(ctx, 'production.sell_all').map((a) => <Chip key="all" ctx={ctx} a={a}>{t('co.produce.all', { qty: formatNumber(Number(a.args?.qty)) })}</Chip>)}
          </div>
        </Panel>
      ) : (
        <Panel>
          <Lead>{t('co.sell.price_how', { qty: formatNumber(v.qty), good })}</Lead>
          {byId(ctx, 'production.price_reference').map((a) => <Do key="r" ctx={ctx} a={a} tone="gold" label={t('co.sell.at_reference', { price: money(v.reference) })} />)}
          <Btns ctx={ctx} list={byId(ctx, 'production.price')} />
        </Panel>
      )}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Listings = flow<ListingsView>(({ view: v, ctx }) => {
  const n = v.notice
  return (
    <Page title={t('co.listings.title', { city: ctx.names.name([...TABLES.city], v.city_code, v.city) })} tone="gold">
      {n && <Notice>{t(n.kind === 'withdrawn' ? 'co.listings.withdrawn' : 'co.listings.listed', { good: goodName(ctx.names, n.listing.good), qty: formatNumber(n.listing.left), price: money(n.listing.price) })}</Notice>}
      {(v.listings ?? []).length === 0 && <Notice>{t('co.listings.none')}</Notice>}
      {(v.listings ?? []).map((l) => (
        <Panel key={l.no}>
          <ListRow icon="tag" palette="gold" title={goodName(ctx.names, l.good)} sub={t('co.listings.line', { qty: formatNumber(l.left), price: money(l.price) })} />
          <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'production.unlist' && a.args?.no === String(l.no))} />
        </Panel>
      ))}
      <Hint>{t('co.listings.hint')}</Hint>
      <BackBtn ctx={ctx} />
    </Page>
  )
})

// -- the goods companies sell ---------------------------------------------------------------------------

const Goods = flow<GoodsView>(({ view: v, ctx }) => (
  <Page title={v.no_city ? t('co.goods.heading') : t('co.goods.title', { city: ctx.names.name([...TABLES.city], v.city_code, v.city) })} tone="gold">
    {v.no_city ? <Notice>{t('co.no_city')}</Notice> : (v.lines ?? []).length === 0 ? <Notice>{t('co.goods.none')}</Notice> : (
      <div style={col}>
        {(v.lines ?? []).map((l) => {
          const seen = (l.attributes ?? []).filter((a) => a.observable).map((a) => t('co.goods.attribute', { name: nameOf(ctx, TABLES.attribute, { code: a.name, name: a.name }), value: formatNumber(a.value) }))
          return (
            <ListRow key={l.no} icon="market" palette="gold" title={goodName(ctx.names, l.good)}
              sub={[t('co.goods.line', { company: l.company.name, qty: formatNumber(l.left) }), seen.join('، ')].filter(Boolean).join(' - ')}
              right={money(l.price)} onClick={go(ctx, 'production.buy', { no: l.no })} />
          )
        })}
      </div>
    )}
    <BackBtn ctx={ctx} />
  </Page>
))

const Buy = flow<BuyView>(({ view: v, ctx }) => {
  const good = goodName(ctx.names, v.line.good)
  const b = v.bought
  if (b) {
    return (
      <Page title={t('co.buy.done_title')} tone="emerald">
        <Panel tone="emerald">
          <Lead tone="good">{b.for_code
            ? t('co.buy.bought_company', { qty: formatNumber(b.qty), good, seller: v.line.company.name, company: b.for, total: money(b.total) })
            : t('co.buy.bought_player', { qty: formatNumber(b.qty), good, seller: v.line.company.name, total: money(b.total) })}</Lead>
        </Panel>
        <Btns ctx={ctx} list={byId(ctx, 'production.company_warehouse', 'item.bag')} />
        <BackBtn ctx={ctx} />
      </Page>
    )
  }
  const pays = byId(ctx, 'payment.cash', 'payment.card')
  return (
    <Page title={t('co.buy.title', { good })} tone="gold">
      <Panel>
        <Facts rows={[
          { label: t('co.buy.seller'), value: v.line.company.name },
          { label: t('co.buy.left'), value: formatNumber(v.line.left) },
          { label: t('co.buy.price_each'), value: money(v.line.price) },
          { label: t('co.buy.qty'), value: formatNumber(v.qty) },
          { label: t('co.buy.total'), value: money(v.line.price * v.qty), gold: true },
        ]} />
        {(v.line.attributes ?? []).filter((a) => a.observable).length > 0 && (
          <Hint>{(v.line.attributes ?? []).filter((a) => a.observable).map((a) => t('co.goods.attribute', { name: nameOf(ctx, TABLES.attribute, { code: a.name, name: a.name }), value: formatNumber(a.value) })).join('، ')}</Hint>
        )}
      </Panel>
      {v.payment && (
        <Panel>
          <Purses p={v.payment} />
          {payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}
          {pays.length > 0 ? <Btns ctx={ctx} list={pays} tone="gold" /> : (v.companies ?? []).length === 0 && <Lead tone="bad">{t('co.buy.cannot_pay')}</Lead>}
        </Panel>
      )}
      {(v.companies ?? []).map((c) => {
        const a = ctx.acts.find((x) => x.id === 'production.pay_company' && x.subject === c.code)
        return a ? <Do key={c.code} ctx={ctx} a={a} label={t('co.buy.for_company', { company: c.name })} /> : null
      })}
      <Btns ctx={ctx} list={byId(ctx, 'production.buy_qty')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

// -- a refused request -------------------------------------------------------------------------------

export const ProductionRefusal = flow<ProductionRefusalView>(({ view: v, ctx }) => {
  const k = `co.refused.production.${v.kind}`
  const techs = (v.techs ?? []).map((x) => namedOf(ctx.names, TABLES.tech, x)).join('، ')
  return (
    <Page title={t('co.refused.title')} tone="ruby">
      <Panel>
        <Lead tone="bad">{hasKey(k) ? t(key(k), {
          name: v.ref.name, skill: v.skill ? skillLevel(ctx.names, v.skill, 0) : '', level: formatNumber(v.level), have: formatNumber(v.have),
          need: money(v.need), money: money(v.have_money), max: formatNumber(v.max), city: ctx.names.name([...TABLES.city], v.city_code, v.city), techs,
        }) : t('refusal.unknown')}</Lead>
        {(v.shortages ?? []).map((s) => (
          <Hint key={s.component.code} tone="bad">{t('co.refused.shortage_line', { component: nameOf(ctx, TABLES.component, s.component), need: formatNumber(s.need), have: formatNumber(s.have) })}</Hint>
        ))}
        {v.gap && <Hint>{t('co.gap.hire', { skill: skillLevel(ctx.names, v.gap.skill, v.gap.level) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => ['production.suppliers', 'recruit.gap', 'recruit.course'].includes(a.id ?? ''))} tone="gold" />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

registerFlow({
  warehouse: Warehouse, suppliers: Suppliers, orders: Orders, produce: Produce, sell: Sell, listings: Listings, company_goods: Goods, company_buy: Buy,
  production_refusal: ProductionRefusal,
})

export const PRODUCTION_SCREENS = ['warehouse', 'suppliers', 'orders', 'produce', 'sell', 'listings', 'company_goods', 'company_buy', 'production_refusal']
