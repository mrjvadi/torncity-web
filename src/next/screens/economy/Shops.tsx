// The city shops in the new UI: the shops as rows (the one I stand in lit), a shop's shelves as goods rows (picture,
// price, a stock chip, a buy button that opens a quantity sheet), the checkout with the ways to pay, the bought page,
// who buys a good of mine, the sold page and a refusal.

import { useState } from 'react'
import type { ShopBoughtView, ShopCheckoutView, ShopRefusalView, ShopSoldView, ShopView, ShopsView, SellOffersView } from '../../../api/views.gen'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Chip, Empty, Hero, Icon, List, Note, Page, Row, Section } from '../../ui'
import { atText } from '../../../lib/duration'
import { formatNumber, hms, money } from '../../../screens/native/kit/format'
import { hasKey, t } from '../../../i18n'
import {
  Done, Facts, More, NoAnswer, PayButtons, Purses, QtySheet, Said, StockChip, actsOf, argNum, bpsText, byId, find, idOf, itemIcon, key, payNote,
  useNames, withArgs, BigMoney, moneyMain,
} from './eco'

export function Shops({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('shops.title')} />
  const v = response.view as unknown as ShopsView
  const acts = actsOf(response)
  const at = v.place ? n.place(v.place) : ''
  const shops = [...(v.shops ?? [])].sort((a, b) => Number(b.here) - Number(a.here))
  return (
    <Page title={at ? t('shops.title_at', { place: at }) : t('shops.title')} sub={v.city ? t('eco.shops.in_city', { city: n.city(v.city_code, v.city) }) : undefined} art="market">
      <Said r={response} />
      {shops.length === 0 && <Empty icon="market">{at ? t('eco.shops.none_at', { place: at }) : t('shops.none')}</Empty>}
      <div className="n-rows">
        {shops.map((s) => {
          const a = find(acts, 'shop.open', { shop: s.shop.code })
          return (
            <Row key={s.shop.code} icon={s.here ? 'market' : 'cart'} title={n.shop(s.shop)}
              sub={s.here ? t('shops.here', { place: n.place(s.place) }) : n.place(s.place)}
              end={s.here ? <Chip tone="ok">{t('n.eco.here')}</Chip> : undefined}
              onClick={a ? () => nav.act(a) : undefined} />
          )
        })}
      </div>
      <More acts={acts} skip={(a) => idOf(a) === 'shop.open'} />
    </Page>
  )
}

export function ShopDetail({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  const [buy, setBuy] = useState<string | null>(null)
  if (!response) return <NoAnswer loading={loading} title={t('shops.title')} />
  const v = response.view as unknown as ShopView
  const acts = actsOf(response)
  const place = n.place(v.place)
  const go = find(acts, 'place.walk')
  const shelves = v.shelves ?? []
  const line = shelves.find((s) => s.item.code === buy)
  const buyAct = (code: string) => find(acts, 'shop.buy', { item: code })
  return (
    <Page title={n.shop(v.shop)} sub={place}>
      <Said r={response} />
      {v.here ? <Note tone="ok" icon="m_check">{t('eco.shops.at_counter')}</Note> : (
        <div className="n-card flat n-eco-walk">
          <Icon name="walk" size={40} />
          <div className="n-eco-walk-body"><b>{place}</b><span>{t('eco.shops.away', { place })}</span></div>
          {go && <Button small kind="cyan" onClick={() => nav.act(go)}>{v.walk_seconds > 0 ? `${t('n.eco.go')} · ${hms(v.walk_seconds)}` : t('n.eco.go')}</Button>}
        </div>
      )}

      <Section title={t('n.eco.shelves')} note={formatNumber(shelves.length)} />
      {shelves.length === 0 ? <Empty icon="box">{t('eco.shops.no_shelves')}</Empty> : (
        <div className="n-eco-goods">
          {shelves.map((s) => {
            const a = v.here && s.stock > 0 ? buyAct(s.item.code) : undefined
            return (
              <div key={s.item.code} className={`n-eco-good${s.stock <= 0 ? ' out' : ''}`}>
                <div className="n-eco-good-main">
                  <span className="n-eco-good-well"><Icon name={itemIcon(s.item.code, s.shelf?.group)} /></span>
                  <span className="n-eco-good-body">
                    <span className="n-eco-good-name">{n.item(s.item)}</span>
                    <span className="n-eco-good-sub">
                      <StockChip n={s.stock} />
                      {s.busy && <Chip tone="warn">{t('eco.shops.busy')}</Chip>}
                      {s.buyback > 0 && <Chip tone="cyan">{t('eco.shops.buys', { n: money(s.buyback) })}</Chip>}
                      {s.stock <= 0 && s.next_restock && <Chip>{t('eco.shops.restock')}: {atText(s.next_restock)}</Chip>}
                    </span>
                  </span>
                </div>
                <div className="n-eco-good-end">
                  <b>{moneyMain(s.price)}</b>
                  {v.here && <button className="n-eco-buy" disabled={!a} onClick={() => setBuy(s.item.code)}>{t('market.buy')}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {v.tax_bps > 0 && <p className="n-eco-hint">{t('eco.shops.tax_note', { p: bpsText(v.tax_bps) })}</p>}
      <More acts={acts} skip={(a) => idOf(a) === 'shop.buy' || idOf(a) === 'place.walk'} />

      {line && (
        <QtySheet title={n.item(line.item)} icon={itemIcon(line.item.code, line.shelf?.group)} unit={line.price} max={line.stock}
          sub={n.shop(v.shop)} confirm={(q) => t('n.eco.buy_n', { n: formatNumber(q) })}
          onConfirm={(q) => { const a = buyAct(line.item.code); setBuy(null); if (a) nav.act(withArgs(a, { qty: String(q) }, 'navigation')) }}
          onClose={() => setBuy(null)} />
      )}
    </Page>
  )
}

export function ShopCheckout({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ShopCheckoutView
  const acts = actsOf(response)
  const more = byId(acts, 'shop.qty')
  const note = payNote(v.payment)
  return (
    <Page title={t('eco.shops.checkout_title', { shop: n.shop(v.shop) })}>
      <Said r={response} />
      <Hero art={itemIcon(v.item.code)}>
        <p className="n-label">{t('eco.shops.due')}</p>
        <BigMoney n={v.total + v.tax} />
        <p className="n-hero-line"><Chip>{t('eco.shops.checkout_item', { item: n.item(v.item), qty: formatNumber(v.qty), unit: moneyMain(v.unit) })}</Chip></p>
      </Hero>
      {more.length > 0 && (
        <div className="n-eco-chips wide">
          {more.map((a, i) => <button key={i} aria-pressed={argNum(a, 'qty') === v.qty} onClick={() => nav.act(a)}>{t('eco.shops.qty', { n: formatNumber(argNum(a, 'qty')) })}</button>)}
        </div>
      )}
      <Facts rows={[
        { label: t('eco.shops.price'), value: money(v.total) },
        ...(v.tax > 0 ? [{ label: t('eco.shops.tax', { p: bpsText(v.tax_bps) }), value: money(v.tax) }] : []),
        { label: t('eco.shops.due'), value: money(v.total + v.tax) },
      ]} />
      <Purses p={v.payment} />
      {note && <p className="n-eco-hint">{note}</p>}
      <PayButtons acts={acts} p={v.payment} />
      <More acts={acts} skip={(a) => idOf(a).startsWith('payment.') || idOf(a) === 'shop.qty' || idOf(a) === 'bank.show'} title="" />
    </Page>
  )
}

export function ShopBought({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ShopBoughtView
  return (
    <Done title={t('eco.shops.bought_title')} icon={itemIcon(v.item.code)} acts={actsOf(response)}
      lead={t('eco.shops.bought', { item: n.item(v.item), qty: formatNumber(v.qty), total: money(v.total + v.tax) })}>
      {v.tax > 0 && <p className="n-eco-hint">{t('eco.shops.bought_tax', { tax: money(v.tax) })}</p>}
      {v.method && <p className="n-eco-hint">{t(v.method === 'card' ? 'eco.pay.paid_card' : 'eco.pay.paid_cash')}</p>}
    </Done>
  )
}

export function SellOffers({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as SellOffersView
  const acts = actsOf(response)
  const offers = [...(v.offers ?? [])].sort((a, b) => b.price - a.price)
  return (
    <Page title={t('eco.shops.offers_title', { item: n.item(v.item) })} art={itemIcon(v.item.code)}>
      <Said r={response} />
      {offers.length === 0 && <Empty icon="market">{t('eco.shops.offers_none')}</Empty>}
      {offers.length > 0 && (
        <List>
          {offers.map((o, i) => {
            const a = find(acts, 'shop.sell_to', { shop: o.shop.code })
            return (
              <Row key={o.shop.code} icon="market" title={n.shop(o.shop)} sub={n.place(o.place)}
                end={<>
                  <b>{moneyMain(o.price)}</b>
                  {a && <Button small kind={i === 0 ? 'primary' : 'ghost'} onClick={() => nav.act(a)}>{t('market.sell')}</Button>}
                </>} />
            )
          })}
        </List>
      )}
      <More acts={acts} skip={(a) => idOf(a) === 'shop.sell_to'} />
    </Page>
  )
}

export function ShopSold({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ShopSoldView
  return (
    <Done title={t('eco.shops.sold_title')} icon="coins" acts={actsOf(response)}
      lead={t('eco.shops.sold', { item: n.item(v.item), shop: n.shop(v.shop), price: money(v.price) })}>
      <p className="n-eco-hint">{t('eco.shops.left', { n: formatNumber(v.left) })}</p>
    </Done>
  )
}

export function ShopRefusal({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ShopRefusalView
  const k = `eco.shops.refused.${v.kind}`
  return (
    <Done title={t('eco.refused.title')} icon={v.item?.code ? itemIcon(v.item.code) : 'market'} tone="bad" acts={actsOf(response)}
      lead={hasKey(k) ? t(key(k), { shop: n.shop(v.shop), item: n.item(v.item), stock: formatNumber(v.stock) }) : t('refusal.unknown')}>
      {v.kind === 'sold_out' && v.next_restock && <Facts rows={[{ label: t('eco.shops.restock'), value: atText(v.next_restock) }]} />}
    </Done>
  )
}
