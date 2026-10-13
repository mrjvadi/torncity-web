// The auction house in the new UI: the lots as cards (picture, quality, the high bid large, the time left), one lot
// with its figures and the bid buttons (the ways to pay the next bid), the bid placed, and my auctions.

import type { AuctionDetailView, AuctionLine, AuctionsView, BidPlacedView, MyAuctionsView } from '../../../api/views.gen'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Chip, Empty, Hero, Icon, Note, Page, Section } from '../../ui'
import { atText } from '../../../lib/duration'
import { formatNumber, hms, money } from '../../../screens/native/kit/format'
import { hasKey, t } from '../../../i18n'
import { Done, Facts, More, NoAnswer, NotHere, PayButtons, Purses, Said, WalkTo, actsOf, find, idOf, itemIcon, key, useNames, BigMoney, moneyMain } from './eco'

/** One lot as a card: picture, name and quality, my role, the high bid (or the reserve) and the time left. */
function Lot({ a, onOpen }: { a: AuctionLine; onOpen?: () => void }) {
  const n = useNames()
  const open = a.status === 'open'
  const status = hasKey(`eco.auction.status.${a.status}`) ? t(key(`eco.auction.status.${a.status}`)) : a.status
  return (
    <button className={`n-eco-lot${a.leading ? ' lit' : ''}`} onClick={onOpen} disabled={!onOpen}>
      <span className="n-eco-good-well"><Icon name={itemIcon(a.item.code)} /></span>
      <span className="n-eco-good-body">
        <span className="n-eco-good-name">{n.item(a.item)}</span>
        <span className="n-eco-good-sub">
          {a.quality > 0 && <Chip>{t('n.eco.quality')} {formatNumber(a.quality)}</Chip>}
          {a.mine && <Chip tone="accent">{t('eco.auction.role_seller')}</Chip>}
          {a.leading && <Chip tone="ok">{t('eco.auction.role_leading')}</Chip>}
          {!open && <Chip>{status}</Chip>}
        </span>
      </span>
      <span className="n-eco-lot-end">
        <small>{a.high_bid > 0 ? t('eco.auction.high_bid_label') : t('eco.auction.reserve')}</small>
        <b>{moneyMain(a.high_bid > 0 ? a.high_bid : a.reserve)}</b>
        {open && a.remaining_seconds > 0 && <span className="n-eco-lot-time"><Icon name="stopwatch" size={16} />{hms(a.remaining_seconds)}</span>}
      </span>
    </button>
  )
}

export function Auctions({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <NoAnswer loading={loading} title={t('eco.auction.title_plain')} />
  const v = response.view as unknown as AuctionsView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('eco.auction.title_plain')} />
  const lots = v.auctions ?? []
  return (
    <Page title={v.city ? t('eco.auction.title', { city: v.city }) : t('eco.auction.title_plain')} art="gavel">
      <Said r={response} />
      {!v.at_house && (v.way ? <WalkTo way={v.way} acts={acts} /> : <Note tone="info" icon="walk">{t('eco.auction.away')}</Note>)}
      {lots.length === 0 ? <Empty icon="gavel">{t('eco.auction.none')}</Empty> : (
        <div className="n-eco-goods">
          {lots.map((a) => {
            const o = find(acts, 'auction.open', { no: a.no })
            return <Lot key={a.no} a={a} onOpen={o ? () => nav.act(o) : undefined} />
          })}
        </div>
      )}
      <More acts={acts} skip={(a) => idOf(a) === 'auction.open' || idOf(a) === 'place.walk'} />
    </Page>
  )
}

export function AuctionDetail({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('eco.auction.title_plain')} />
  const v = response.view as unknown as AuctionDetailView
  const acts = actsOf(response)
  const a = v.line
  const open = a.status === 'open'
  return (
    <Page title={t('eco.auction.detail_title', { no: formatNumber(a.no) })}>
      <Said r={response} />
      <Hero art={itemIcon(a.item.code)}>
        <p className="n-label">{n.item(a.item)}{a.quality > 0 ? ` · ${t('n.eco.quality')} ${formatNumber(a.quality)}` : ''}</p>
        <BigMoney n={a.high_bid > 0 ? a.high_bid : a.reserve} />
        <p className="n-label">{a.high_bid > 0 ? t('eco.auction.high_bid_of', { n: t('eco.auction.high_bid_label'), bids: formatNumber(v.bids) }) : t('eco.auction.no_bids')}</p>
        {open && a.remaining_seconds > 0 && <p className="n-hero-line"><Chip tone="accent"><Icon name="stopwatch" size={18} />{t('common.left', { t: hms(a.remaining_seconds) })}</Chip></p>}
      </Hero>
      {a.mine && <Note tone="info" icon="gavel">{t('eco.auction.yours')}</Note>}
      {a.leading && <Note tone="ok" icon="trophy">{t('eco.auction.leading')}</Note>}
      <Facts rows={[
        ...(v.seller ? [{ label: t('eco.auction.seller'), value: v.seller }] : []),
        { label: t('eco.auction.reserve'), value: money(a.reserve) },
        ...(a.ends_at ? [{ label: t('eco.auction.ends'), value: atText(a.ends_at) }] : []),
      ]} />
      {open && v.payment && !a.mine && !a.leading && (
        <>
          <Section title={t('n.eco.bid_n', { n: money(v.min_next) })} />
          <p className="n-eco-hint">{t('n.eco.bid_escrow')}</p>
          <Purses p={v.payment} />
          <PayButtons acts={acts} p={v.payment} />
        </>
      )}
      <More acts={acts} skip={(x) => idOf(x).startsWith('payment.') || idOf(x) === 'bank.show'} />
    </Page>
  )
}

export function BidPlaced({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as BidPlacedView
  return (
    <Done title={t('eco.auction.bid_title', { no: formatNumber(v.no) })} icon="gavel" acts={actsOf(response)}
      lead={t('eco.auction.bid_placed', { no: formatNumber(v.no), item: n.item(v.item), amount: money(v.amount) })}>
      <p className="n-eco-hint">{t('eco.auction.bid_escrow')}</p>
      {v.ends_at && <Facts rows={[{ label: t('eco.auction.ends'), value: atText(v.ends_at) }]} />}
    </Done>
  )
}

export function MyAuctions({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <NoAnswer loading={loading} title={t('eco.auction.mine_title')} />
  const v = response.view as unknown as MyAuctionsView
  const acts = actsOf(response)
  const lots = v.auctions ?? []
  return (
    <Page title={t('eco.auction.mine_title')} art="gavel">
      <Said r={response} />
      {lots.length === 0 ? <Empty icon="gavel">{t('eco.auction.mine_none')}</Empty> : (
        <div className="n-eco-goods">
          {lots.map((a) => {
            const o = find(acts, 'auction.open', { no: a.no })
            return <Lot key={a.no} a={a} onOpen={o ? () => nav.act(o) : undefined} />
          })}
        </div>
      )}
      <More acts={acts} skip={(a) => idOf(a) === 'auction.open'} />
    </Page>
  )
}
