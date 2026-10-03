// The village shop «دکان» and the money panel (ADR 0046 sections 5 and 7), drawn from `village_shop`, its checkout and
// refusals, `village_money`, and the shared `no_room` refusal. The shelf is a grid of goods cards (2 per row on a phone,
// 3-4 on desktop); a card opens a centred popup to choose how many; the checkout is a popup with the ways to pay. The
// head's two levers (price ceiling, sales tax) and the mending counter are sections of the same screen.
// Nothing here moves money by itself: the server's `settlement.shop.*` commands do, and every refusal says what is missing.

import { useState } from 'react'
import type { ScreenProps } from '../types'
import type { MoneyView, NoRoomView, VillageShopCheckoutView, VillageShopLine, VillageShopRefusalView, VillageShopView } from '../../api/views.gen'
import { Header, Notice, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import Popup, { ActionButton, ActionRow, CostSummary, Note } from '../../ui/Popup'
import { CardGrid, PCard, PStats, PTabs } from '../../ui/v6/panel'
import GoodsCard from '../../ui/v6/GoodsCard'
import { FillBar } from '../../ui/v6/ItemGrid'
import { formatNumber, hms, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { useContentNames, useVillageCommand, type ContentNames } from '../../village/useVillage'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerWrite, type FlowCtx } from './flow'
import { useVillageView } from './common'
import { serverNow } from '../../village/clock'

const key = (k: string) => k as Key
const pct = (bps: number) => `${formatNumber(Math.round(bps) / 100)}٪`

// the head's levers, the mending counter and the payment are writes the flow host runs with an idempotency key
registerWrite((a) => ['shop.cap', 'shop.tax', 'shop.repair', 'shop.pay'].includes(a.id ?? ''))

const goodsName = (names: ContentNames, l: { item: { code: string; name: string } }) => names.name(['component', 'item'], l.item.code, l.item.name)

/** The whole shop: status, shelf, what a building or research would add, mending, the head's levers. */
function ShopBody({ v, names, onBuy, onWrite, onMoney }: {
  v: VillageShopView
  names: ContentNames
  onBuy: (item: string, qty: number) => void
  onWrite: (command: string, args: Record<string, string>) => void
  onMoney: () => void
}) {
  const [pick, setPick] = useState<VillageShopLine | null>(null)
  const open = v.closed === ''
  const closedText = v.closed ? t(key(`sm.shop.closed.${v.closed}`)) : ''
  const next = v.next_delivery ? Math.max(0, Math.floor((new Date(v.next_delivery).getTime() - serverNow()) / 1000)) : 0
  const lines = v.lines ?? []
  return (
    <>
      {!open && <Notice alert>{closedText}</Notice>}
      {next > 0 && <Hint>{t('sm.shop.next', { t: hms(next) })}</Hint>}
      <PStats items={[
        { label: t('sm.shop.lbl_wage'), value: money(v.wage), gold: true },
        { label: t('sm.shop.lbl_tax'), value: pct(v.tax_bps) },
        { label: t('sm.shop.lbl_cap'), value: pct(v.price_cap_bps) },
      ]} />
      {v.resident && v.capacity > 0 && (
        <FillBar used={Math.max(v.capacity - v.free_space, 0)} capacity={v.capacity} label={t('sm.fill.space')} figures={`${formatNumber(Math.max(v.capacity - v.free_space, 0))} / ${formatNumber(v.capacity)}`} />
      )}
      {!v.resident && <Notice>{t('sm.shop.not_resident')}</Notice>}

      {lines.length === 0 && open && <Notice>{t('sm.mk.shop_empty')}</Notice>}
      <CardGrid>
        {lines.map((l) => {
          const out = l.stock <= 0
          const noFit = !out && l.fits <= 0
          const capped = !out && !noFit && l.max_buy <= 0
          return (
            <GoodsCard key={l.item.code} code={l.item.code} name={goodsName(names, l)} group={l.shelf?.group}
              price={money(l.price)} price2={out ? t('sm.shop.sold_out') : noFit ? t('sm.shop.nofit') : capped ? t('sm.shop.player_cap') : t('sm.shop.left_today', { n: formatNumber(l.left_today) })}
              badge={out ? undefined : formatNumber(l.stock)} tone={out || noFit || capped ? 'off' : undefined} off={out}
              onClick={open && v.resident && !out && !noFit && !capped ? () => setPick(l) : undefined} />
          )
        })}
      </CardGrid>

      {(v.locked ?? []).length > 0 && (
        <>
          <SectionTitle>{t('sm.shop.locked')}</SectionTitle>
          <CardGrid>
            {(v.locked ?? []).map((l) => (
              <PCard key={l.item.code} icon="lock" title={goodsName(names, l)} off
                facts={<>
                  {(l.needs_buildings ?? []).length > 0 && <span>{t('sm.shop.needs_building', { list: (l.needs_buildings ?? []).map((b) => names.name('settlement_building', b.code, b.name)).join('، ') })}</span>}
                  {(l.needs_knowledge ?? []).length > 0 && <span>{t('sm.shop.needs_knowledge', { list: (l.needs_knowledge ?? []).map((k) => names.name('knowledge', k.code, k.name)).join('، ') })}</span>}
                </>} />
            ))}
          </CardGrid>
        </>
      )}

      {v.building && (v.repairs ?? []).length > 0 && (
        <>
          <SectionTitle>{t('sm.shop.repair')}</SectionTitle>
          <CardGrid>
            {(v.repairs ?? []).map((r) => (
              <PCard key={r.serial} icon="m_backpack" title={names.name('item', r.item.code, r.item.name)}
                sub={r.torn ? t('sm.shop.torn') : t('sm.slot.wear', { w: formatNumber(r.wear), m: formatNumber(r.wear_max) })}
                tone={r.torn ? 'danger' : undefined}
                foot={<ActionButton tone="gold" small disabled={!v.can_repair || r.cost > v.cash} onClick={() => onWrite('settlement.shop.repair', { item: r.serial })}>{t('sm.shop.repair_btn', { cost: money(r.cost) })}</ActionButton>} />
            ))}
          </CardGrid>
        </>
      )}

      {v.can_set_cap && (
        <>
          <SectionTitle>{t('sm.shop.levers')}</SectionTitle>
          <Hint>{t('sm.shop.cap_hint')}</Hint>
          <PTabs tabs={(v.cap_presets ?? []).map((p) => ({ key: String(p), label: pct(p) }))} value={String(v.price_cap_bps)} onChange={(k) => onWrite('settlement.shop.cap', { bps: k })} />
          <Hint>{t('sm.shop.tax_lever')}</Hint>
          <PTabs tabs={(v.tax_presets ?? []).map((p) => ({ key: String(p), label: pct(p) }))} value={String(v.tax_bps)} onChange={(k) => onWrite('settlement.shop.tax', { bps: k })} />
        </>
      )}
      <ActionButton tone="steel" small onClick={onMoney}>{t('sm.money.title')}</ActionButton>

      <Popup open={!!pick} onClose={() => setPick(null)} title={pick ? goodsName(names, pick) : ''} tone="gold">
        {pick && (
          <>
            <PStats items={[
              { label: t('sm.shop.lbl_price'), value: money(pick.price), gold: true },
              { label: t('sm.shop.lbl_fits'), value: formatNumber(pick.fits) },
            ]} />
            <Note>{t('sm.shop.left_today', { n: formatNumber(pick.left_today) })}</Note>
            <ActionRow>
              {(v.presets ?? []).filter((q) => q <= pick.max_buy).map((q) => (
                <ActionButton key={q} tone="green" onClick={() => { const it = pick.item.code; setPick(null); onBuy(it, q) }}>{t('storage.buy_qty', { q: formatNumber(q) })}</ActionButton>
              ))}
            </ActionRow>
          </>
        )}
      </Popup>
    </>
  )
}

/** The shop as a screen. `initial` is the answer the shell has; writes replace it with the server's new answer. */
function ShopScreen({ initial, run, onBack }: { initial: VillageShopView | null; run: ScreenProps['run']; onBack?: () => void }) {
  const names = useContentNames()
  const cmd = useVillageCommand()
  const [fresh, setFresh] = useState<VillageShopView | null>(null)
  const v = fresh ?? initial
  async function write(command: string, args: Record<string, string>) {
    const r = await cmd(command, args, { write: true })
    if (r.ok && r.res?.view) setFresh(r.res.view as unknown as VillageShopView)
  }
  return (
    <ScreenScroll>
      <Header title={t('sm.shop.title')} tone="gold" onBack={onBack} onRefresh={() => run('settlement.shop')} />
      {!v && <Notice>…</Notice>}
      {v?.bought && <Notice>{t('sm.shop.bought', { qty: formatNumber(v.bought.qty), name: names.name(['component', 'item'], v.bought.item.code, v.bought.item.name) })}</Notice>}
      {v?.mended && <Notice>{t('sm.shop.mended', { name: names.name('item', v.mended.item.code, v.mended.item.name), cost: money(v.mended.cost) })}</Notice>}
      {v && <ShopBody v={v} names={names} onBuy={(item, qty) => run('settlement.shop.buy', { item, qty: String(qty) })} onWrite={write} onMoney={() => run('settlement.money')} />}
    </ScreenScroll>
  )
}

/** The local screen: fetches the shop itself (reached from the shop building's panel and the Economy hub). */
export function ShopLocal(props: ScreenProps) {
  const { view, loading } = useVillageView<VillageShopView>('settlement.shop', null)
  if (loading && !view) return <ScreenScroll><Header title={t('sm.shop.title')} tone="gold" onBack={() => props.openLocal('village_home')} /></ScreenScroll>
  return <ScreenShopKeyed initial={view} run={props.run} onBack={() => props.openLocal('village_home')} />
}

function ScreenShopKeyed(p: { initial: VillageShopView | null; run: ScreenProps['run']; onBack?: () => void }) {
  return <ShopScreen key={p.initial?.next_delivery ?? 'x'} {...p} />
}

const Shop = flow<VillageShopView>(({ view: v, ctx }) => <ShopScreen initial={v} run={ctx.run} onBack={() => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }} />)

const Checkout = flow<VillageShopCheckoutView>(({ view: v, ctx }) => {
  const names = ctx.names
  const pays = ctx.acts.filter((a) => a.id === 'shop.pay')
  const back = ctx.acts.find(isBack)
  return (
    <>
      <ScreenScroll><Header title={t('sm.shop.checkout')} tone="gold" /></ScreenScroll>
      <Popup open onClose={() => { if (back) ctx.go(back) }} title={t('sm.shop.checkout')} tone="gold"
        footer={pays.length > 0 ? (
          <ActionRow>{pays.map((a) => <ActionButton key={a.args?.method} tone={a.args?.method === 'card' ? 'gold' : 'green'} disabled={ctx.busy} onClick={() => ctx.go(a)}>{t(a.args?.method === 'card' ? 'sm.shop.pay_card' : 'sm.shop.pay_cash')}</ActionButton>)}</ActionRow>
        ) : <Note tone="bad">{t('eco.pay.cannot', { amount: money(v.total + v.tax) })}</Note>}>
        <Lead>{t('sm.shop.checkout_line', { qty: formatNumber(v.qty), name: names.name(['component', 'item'], v.item.code, v.item.name), unit: money(v.unit) })}</Lead>
        <CostSummary
          lines={[{ label: t('sm.shop.buy'), amount: money(v.total) }, ...(v.tax > 0 ? [{ label: t('sm.shop.tax', { p: pct(v.tax_bps) }), amount: money(v.tax) }] : [])]}
          total={{ label: t('sm.shop.total'), amount: money(v.total + v.tax) }} />
        <Hint>{t('sm.shop.space', { need: formatNumber(v.space), free: formatNumber(v.free_space) })}</Hint>
      </Popup>
    </>
  )
})

const Refusal = flow<VillageShopRefusalView>(({ view: v, ctx }) => {
  const k = `sm.shop.refused.${v.kind}`
  return (
    <Page title={t('eco.refused.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(k) ? t(key(k)) : t('refusal.unknown')}</Lead>
        {(v.kind === 'no_space' || v.kind === 'too_heavy') && (
          <Facts rows={[{ label: t('sm.noroom.title'), value: t('sm.noroom.space', { qty: '', item: ctx.names.name(['component', 'item'], v.item.code, v.item.name), need: formatNumber(v.need_space), free: formatNumber(v.free_space), short: formatNumber(Math.max(v.need_space - v.free_space, 0)) }) }]} />
        )}
        {v.kind === 'closed' && v.next_delivery && <Hint>{t('sm.shop.next', { t: hms(Math.max(0, Math.floor((new Date(v.next_delivery).getTime() - serverNow()) / 1000))) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && a.id !== 'refresh')} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

/** «پول شهر»: the settlement's money and its Nil quote. The Nil figures are a display only; nothing converts. */
const Money = flow<MoneyView>(({ view: v, ctx }) => {
  const nil = (micro: number) => formatNumber(Math.round(micro / 10_000) / 100)
  return (
    <Page title={t('sm.money.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('sm.money.currency', { name: v.currency?.name || t('unit.money') })}</Lead>
        {(v.market === 'none' || v.reserve === 'none') && <Hint>{t('sm.money.no_book')}</Hint>}
        <Hint>{t('sm.money.nil')}</Hint>
      </Panel>
      <PStats items={[
        { label: t('sm.money.lbl_treasury'), value: money(v.treasury), gold: true },
        { label: t('sm.money.lbl_unit', { u: formatNumber(v.nil_unit_sup) }), value: `${nil(v.nil_per_unit_micro * v.nil_unit_sup)} Nil` },
        { label: t('sm.money.lbl_output', { d: formatNumber(v.output_days) }), value: money(v.output) },
        { label: 'Nil', value: nil(v.treasury_nil_micro) },
      ]} />
      {(v.examples ?? []).length > 0 && (
        <>
          <SectionTitle>{t('sm.money.examples')}</SectionTitle>
          <CardGrid>
            {(v.examples ?? []).map((e) => <PCard key={e.amount} icon="coins" title={money(e.amount)} facts={`${nil(e.nil_micro)} Nil`} />)}
          </CardGrid>
        </>
      )}
      {(v.basket ?? []).length > 0 && (
        <>
          <SectionTitle>{t('sm.money.basket')}</SectionTitle>
          <Hint>{t('sm.money.index', { p: formatNumber(Math.round(v.index_bps / 100)) })} · {t('sm.money.cover', { p: formatNumber(Math.round(v.cover_bps / 100)) })}</Hint>
          <CardGrid>
            {(v.basket ?? []).map((b) => (
              <PCard key={b.item.code} icon="crate" title={ctx.names.name(['component', 'item'], b.item.code, b.item.name)} facts={money(b.price)}
                sub={b.on_shelf ? t('sm.money.shelf') : t('sm.money.not_shelf')} off={!b.on_shelf} />
            ))}
          </CardGrid>
        </>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

/** «جا ندارید»: a purchase, an order or a claim refused for lack of room; what is missing and how to make room. */
const NoRoom = flow<NoRoomView>(({ view: v, ctx }) => (
  <Page title={t('sm.noroom.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{v.heavy
        ? t('sm.noroom.heavy')
        : t('sm.noroom.space', { qty: formatNumber(v.qty), item: ctx.names.name(['component', 'item'], v.item.code, v.item.name), need: formatNumber(v.need_space), free: formatNumber(v.free_space), short: formatNumber(v.short) })}</Lead>
      <Hint>{t('sm.noroom.fix')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && a.id !== 'refresh')} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

export const SHOP_FLOWS = { village_shop: Shop, village_shop_checkout: Checkout, village_shop_refusal: Refusal, village_money: Money, no_room: NoRoom }
export const SHOP_SCREENS = Object.keys(SHOP_FLOWS)
export type { FlowCtx }
