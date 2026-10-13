// The stock exchange in the new UI: the listed companies as rows with the price and its move since the last close
// (green up, red down), and my portfolio (its value large, the gain, the holdings and open orders).

import type { ExchangeView, PortfolioView } from '../../../api/views.gen'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Chip, Empty, Hero, List, Page, Row, Section, Stat, Stats } from '../../ui'
import { formatNumber, pct } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { More, NoAnswer, NotHere, Said, actsOf, ecoNotice, find, idOf, useNames, BigMoney, moneyMain } from './eco'

/** A price's move since the last close as a chip: up green, down red, flat grey. */
function Move({ price, prev }: { price: number; prev: number }) {
  if (!prev) return null
  const f = (price - prev) / prev
  return <Chip tone={f > 0 ? 'ok' : f < 0 ? 'bad' : undefined}><span dir="ltr">{f > 0 ? '▲' : f < 0 ? '▼' : ''} {pct(Math.abs(f))}</span></Chip>
}

export function Exchange({ response, loading }: NScreenProps) {
  const nav = useNav()
  const { names } = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('stocks.title')} />
  const v = response.view as unknown as ExchangeView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('stocks.title')} />
  const lines = v.lines ?? []
  return (
    <Page title={t('stocks.title')} art="chart">
      <Said r={response} />
      {lines.length === 0 ? <Empty icon="chart">{t('eco.stock.empty')}</Empty> : (
        <List>
          {lines.map((l) => {
            const a = find(acts, 'stock.open', { code: l.company.code })
            return (
              <Row key={l.company.code} icon="chart" title={l.company.name}
                sub={t('eco.stock.sub', { type: names.name(['company_type'], l.type.code, l.type.name), city: names.name(['city'], l.city.code, l.city.name) })}
                end={<><b>{moneyMain(l.price)}</b><Move price={l.price} prev={l.prev} /></>}
                onClick={a ? () => nav.act(a) : undefined} />
            )
          })}
        </List>
      )}
      <p className="n-eco-hint">{t('eco.stock.hint')}</p>
      <More acts={acts} skip={(a) => idOf(a) === 'stock.open'} />
    </Page>
  )
}

export function Portfolio({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <NoAnswer loading={loading} title={t('stocks.portfolio')} />
  const v = response.view as unknown as PortfolioView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('stocks.portfolio')} />
  const notice = ecoNotice('stock', v.notice, v.notice_args)
  const holdings = v.holdings ?? []
  const orders = v.orders ?? []
  return (
    <Page title={t('stocks.portfolio')}>
      <Said r={response} />
      {notice && <p className="n-eco-hint">{notice}</p>}
      <Hero art="histogram">
        <p className="n-label">{t('stocks.portfolio_value')}</p>
        <BigMoney n={v.value} />
        <p className="n-hero-line"><Chip tone={v.gain > 0 ? 'ok' : v.gain < 0 ? 'bad' : undefined}>{v.gain < 0 ? t('eco.stock.loss') : t('stocks.gain')}: {moneyMain(Math.abs(v.gain))}</Chip></p>
      </Hero>
      {(v.gold > 0 || v.savings > 0) && (
        <Stats>
          {v.gold > 0 && <Stat icon="x_goldbar" label={t('stocks.gold')} value={moneyMain(v.gold_val)} note={formatNumber(v.gold)} />}
          {v.savings > 0 && <Stat icon="x_chest" label={t('stocks.savings')} value={moneyMain(v.savings)} />}
        </Stats>
      )}
      <Section title={t('n.eco.holdings')} note={holdings.length ? formatNumber(holdings.length) : undefined} />
      {holdings.length === 0 ? <Empty icon="chart">{t('eco.stock.no_shares')}</Empty> : (
        <List>
          {holdings.map((h) => {
            const a = find(acts, 'stock.open', { code: h.company.code })
            return (
              <Row key={h.company.code} icon="chart" title={h.company.name}
                sub={h.listed ? t('eco.stock.holding_line', { shares: formatNumber(h.shares), price: moneyMain(h.price), cost: moneyMain(h.cost) }) : t('eco.stock.holding_private', { shares: formatNumber(h.shares), cost: moneyMain(h.cost) })}
                end={<><b>{moneyMain(h.value)}</b>{h.cost > 0 && <Move price={h.value} prev={h.cost} />}</>}
                onClick={a ? () => nav.act(a) : undefined} />
            )
          })}
        </List>
      )}
      {orders.length > 0 && (
        <>
          <Section title={t('stocks.open_orders')} />
          <List>
            {orders.map((o) => {
              const c = find(acts, 'stock.cancel', { no: o.no })
              return (
                <Row key={o.no} icon={o.side === 'buy' ? 'cart' : 'tag'}
                  title={t(o.side === 'buy' ? 'eco.stock.order_line_buy' : 'eco.stock.order_line_sell', { no: formatNumber(o.no), qty: formatNumber(o.qty), price: moneyMain(o.price) })}
                  sub={o.company.name} end={c ? <button className="n-eco-buy bad" onClick={() => nav.act(c)}>{t('common.cancel')}</button> : undefined} />
              )
            })}
          </List>
        </>
      )}
      <More acts={acts} skip={(a) => idOf(a) === 'stock.open' || idOf(a) === 'stock.cancel'} />
    </Page>
  )
}
