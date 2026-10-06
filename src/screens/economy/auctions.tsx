// The auction house: a city's open auctions, one auction with its bid, putting a piece up, the player's own
// auctions and bids. Drawn from the view and the actions of the answer (docs/adr/0039-presentation-split.md);
// a city without an auction house arrives as `unavailable`.

import { short } from '../../ui/v6/short'
import type {
  AuctionLine, AuctionNewView, AuctionOpenedView, AuctionRefusalView, AuctionDetailView, AuctionsView, BidPlacedView, MyAuctionsView, Way,
} from '../../api/views.gen'
import { ListRow, Notice } from '../native/kit/Parts'
import { formatNumber, hms, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { Do, NotHere, Purses, byId, find, nameOf, payNote, rest } from './kit'
import { clockText } from './time'

const key = (k: string) => k as Key

function lineSub(ctx: FlowCtx, a: AuctionLine): string {
  const state = a.status === 'open' ? t('eco.auction.remaining', { t: durationText(a.remaining_seconds) }) : t(key(`eco.auction.status.${a.status}`))
  return `${a.high_bid > 0 ? t('eco.auction.high_bid', { n: money(a.high_bid) }) : t('eco.auction.from', { n: money(a.reserve) })} · ${state}`
}

function Rows({ list, ctx }: { list: AuctionLine[] | null; ctx: FlowCtx }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(list ?? []).map((a) => (
        <ListRow key={a.no} icon="tag" palette={a.mine ? 'gold' : a.leading ? 'emerald' : 'steel'}
          title={t('eco.auction.line', { no: formatNumber(a.no), item: nameOf(ctx, ['item', 'component'], a.item), quality: formatNumber(a.quality) })}
          sub={lineSub(ctx, a)}
          right={a.mine ? t('eco.auction.role_seller') : a.leading ? t('eco.auction.role_leading') : undefined}
          onClick={() => { const go = find(ctx, 'auction.open', { no: a.no }); if (go) ctx.go(go) }} />
      ))}
    </div>
  )
}

function WalkTo({ way, ctx }: { way: Way | null; ctx: FlowCtx }) {
  const go = find(ctx, 'place.walk')
  if (!way) return null
  const place = ctx.names.name(['place'], way.place.code, way.place.name)
  return (
    <>
      <Notice>{t('market.walk', { t: hms(way.walk_seconds), place })}</Notice>
      {go && <Do ctx={ctx} a={go} tone="gold" label={t('eco.walk_there', { place, t: hms(way.walk_seconds) })} />}
    </>
  )
}

const Auctions = flow<AuctionsView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('eco.auction.title_plain')} tone="gold" />
  return (
    <Page title={t('eco.auction.title', { city: ctx.names.name(['city'], v.city_code, v.city) })} tone="gold">
      {!v.at_house && !v.way && <Notice>{t('eco.auction.away')}</Notice>}
      {!v.at_house && <WalkTo way={v.way} ctx={ctx} />}
      {(v.auctions ?? []).length === 0 && <Notice>{t('eco.auction.none')}</Notice>}
      <Rows list={v.auctions} ctx={ctx} />
      <Btns ctx={ctx} list={byId(ctx, 'auction.mine', 'item.bag')} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const Auction = flow<AuctionDetailView>(({ view: v, ctx }) => {
  const a = v.line
  const open = a.status === 'open'
  const pays = byId(ctx, 'payment.cash', 'payment.card')
  return (
    <Page title={t('eco.auction.detail_title', { no: formatNumber(a.no) })} tone="gold">
      <Panel tone="gold">
        <Lead>{t('eco.auction.item', { item: nameOf(ctx, ['item', 'component'], a.item), quality: formatNumber(a.quality) })}</Lead>
        <Facts rows={[
          { label: t('eco.auction.seller'), value: v.seller || t('eco.someone') },
          { label: t('eco.auction.reserve'), value: money(a.reserve) },
          ...(a.high_bid > 0 ? [{ label: t('eco.auction.high_bid_label'), value: t('eco.auction.high_bid_of', { n: money(a.high_bid), bids: formatNumber(v.bids) }), gold: true }] : []),
          ...(open ? [{ label: t('eco.auction.ends'), value: `${durationText(a.remaining_seconds)} · ${clockText(a.ends_at)}` }] : []),
        ]} />
        {a.high_bid <= 0 && <Hint>{t('eco.auction.no_bids')}</Hint>}
        {!open && <Hint>{t(key(`eco.auction.status.${a.status}`))}</Hint>}
        {open && a.mine && <Hint tone="good">{t('eco.auction.yours')}</Hint>}
        {open && a.leading && <Hint tone="good">{t('eco.auction.leading')}</Hint>}
      </Panel>
      {open && !a.mine && !a.leading && v.payment && (
        <Panel>
          {pays.length > 0 ? (
            <>
              <Lead>{t('eco.auction.bid_how', { n: money(v.min_next) })}</Lead>
              <Purses p={v.payment} />
              {payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}
              <Btns ctx={ctx} list={pays} tone="gold" />
            </>
          ) : <Lead tone="bad">{t('eco.pay.cannot', { amount: money(v.min_next) })}</Lead>}
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const AuctionNew = flow<AuctionNewView>(({ view: v, ctx }) => (
  <Page title={t('eco.auction.new_title', { item: nameOf(ctx, ['item', 'component'], v.item), quality: formatNumber(v.quality) })} tone="gold">
    <Panel tone="gold">
      <Lead>{t('eco.auction.new_hint')}</Lead>
      {(v.durations ?? []).map((d, i) => (
        <div key={i}>
          <Hint>{t('eco.auction.duration', { t: durationText(d) })}</Hint>
          <div className="vf-btns row">
            {(v.reserves ?? []).map((r) => {
              const a = ctx.acts.find((x) => x.id === 'auction.terms' && String(x.args?.reserve) === String(r) && String(x.args?.duration) === String(i))
              return a && <button key={r} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{short(<>{t('eco.auction.reserve_option', { n: money(r) })}</>)}</button>
            })}
          </div>
        </div>
      ))}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const AuctionOpened = flow<AuctionOpenedView>(({ view: v, ctx }) => (
  <Page title={t('eco.auction.opened_title', { no: formatNumber(v.no) })} tone="gold">
    <Panel tone="gold">
      <Lead tone="good">{t('eco.auction.opened', { no: formatNumber(v.no), item: nameOf(ctx, ['item', 'component'], v.item), reserve: money(v.reserve), duration: durationText(v.duration_seconds) })}</Lead>
      <Hint>{t('eco.auction.ends_at', { t: clockText(v.ends_at) })}</Hint>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const BidPlaced = flow<BidPlacedView>(({ view: v, ctx }) => (
  <Page title={t('eco.auction.bid_title', { no: formatNumber(v.no) })} tone="gold">
    <Panel tone="gold">
      <Lead tone="good">{t('eco.auction.bid_placed', { no: formatNumber(v.no), item: nameOf(ctx, ['item', 'component'], v.item), amount: money(v.amount) })}</Lead>
      <Hint>{t(v.method === 'card' ? 'eco.pay.paid_card' : 'eco.pay.paid_cash')}</Hint>
      <Hint>{t('eco.auction.bid_escrow')}</Hint>
      <Hint>{t('eco.auction.ends_at', { t: clockText(v.ends_at) })}</Hint>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const MyAuctions = flow<MyAuctionsView>(({ view: v, ctx }) => (
  <Page title={t('eco.auction.mine_title')} tone="gold">
    {(v.auctions ?? []).length === 0 && <Notice>{t('eco.auction.mine_none')}</Notice>}
    <Rows list={v.auctions} ctx={ctx} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const AuctionRefusal = flow<AuctionRefusalView>(({ view: v, ctx }) => {
  const k = `eco.auction.refused.${v.kind}`
  return (
    <Page title={t('eco.refused.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(k) ? t(key(k), { min: money(v.min_next), count: formatNumber(v.count), no: formatNumber(v.no) }) : t('refusal.unknown')}</Lead>
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({
  auctions: Auctions, auction_detail: Auction, auction_new: AuctionNew, auction_opened: AuctionOpened, bid_placed: BidPlaced,
  my_auctions: MyAuctions, auction_refusal: AuctionRefusal,
})

/** The screens this file draws. */
export const AUCTION_SCREENS = ['auctions', 'auction_detail', 'auction_new', 'auction_opened', 'bid_placed', 'my_auctions', 'auction_refusal']
