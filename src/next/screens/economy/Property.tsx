// Property in the new UI: the market (new homes and shops by type, as cards with size, what is left and the price;
// the owners' offers to sell or let) and my property (rest at home as the one orange button, what I own and what I
// hold in a village).

import type { Action } from '../../../api/types'
import type { PropertyMarketView, PropertyMineView } from '../../../api/views.gen'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Chip, Empty, Icon, List, Note, Page, Row, Section } from '../../ui'
import { formatNumber, hms } from '../../../screens/native/kit/format'
import { hasKey, t } from '../../../i18n'
import { More, NoAnswer, Said, actsOf, find, idOf, key, moneyMain, useNames } from './eco'

const typeIcon = (kind: string, home: boolean) => (home ? (kind === 'apartment' ? 'city' : 'house') : kind === 'shop' ? 'market' : 'factory')

export function PropertyMarket({ response, loading }: NScreenProps) {
  const nav = useNav()
  const { names } = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('property.market')} />
  const v = response.view as unknown as PropertyMarketView
  const acts = actsOf(response)
  if (v.no_city) return <Page title={t('property.market')}><Empty icon="city">{t('property.no_city')}</Empty><More acts={acts} /></Page>
  const types = v.types ?? []
  const offers = v.offers ?? []
  const go = (a: Action | undefined, cmd: string, args: Record<string, string>) => (a ? nav.act(a) : nav.run(cmd, args))
  return (
    <Page title={t('property.market')} sub={v.city?.name ? names.name(['city'], v.city.code, v.city.name) : undefined} art="house">
      <Said r={response} />
      {types.length > 0 && (
        <div className="n-eco-props">
          {types.map((ty) => {
            const out = ty.left <= 0
            return (
              <button key={ty.type.code} className={`n-eco-prop${out ? ' out' : ''}`}
                onClick={() => go(find(acts, 'property.type', { type: ty.type.code }), 'property.type', { type: ty.type.code })}>
                <Icon name={typeIcon(ty.kind, ty.home)} className="n-eco-prop-ic" />
                <span className="n-eco-prop-name">{names.name('property_type', ty.type.code, ty.type.name)}</span>
                <span className="n-chips">
                  {ty.size > 0 && <Chip>{t('property.size', { n: formatNumber(ty.size) })}</Chip>}
                  <Chip tone={ty.home ? 'cyan' : 'accent'}>{ty.home ? t('property.home') : t('property.commercial')}</Chip>
                </span>
                <b className="n-eco-prop-price">{moneyMain(ty.price)}</b>
                <span className={`n-eco-prop-left${out ? ' bad' : ''}`}>{out ? t('eco.shops.empty') : t('property.left', { n: formatNumber(ty.left) })}</span>
              </button>
            )
          })}
        </div>
      )}
      {offers.length > 0 && (
        <>
          <Section title={t('property.offers')} note={formatNumber(offers.length)} />
          <List>
            {offers.map((o) => (
              <Row key={o.no} icon={o.kind === 'rent' ? 'keys' : 'house'} title={names.name('property_type', o.type.code, o.type.name)}
                sub={[o.seller?.name, o.mine ? t('n.eco.mine') : ''].filter(Boolean).join(' · ')}
                end={<><b>{moneyMain(o.price)}</b><Chip tone={o.kind === 'rent' ? 'cyan' : 'accent'}>{o.kind === 'rent' ? t('property.rent') : t('property.sale')}</Chip></>}
                onClick={() => go(find(acts, 'property.offer', { no: o.no }), 'property.offer', { no: String(o.no) })} />
            ))}
          </List>
        </>
      )}
      {types.length === 0 && offers.length === 0 && <Empty icon="house">{t('common.none')}</Empty>}
      <More acts={acts} skip={(a) => idOf(a) === 'property.type' || idOf(a) === 'property.offer'} />
    </Page>
  )
}

export function PropertyMine({ response, loading }: NScreenProps) {
  const nav = useNav()
  const { names } = useNames()
  if (!response) return <NoAnswer loading={loading} title={t('property.mine')} />
  const v = response.view as unknown as PropertyMineView
  const acts = actsOf(response)
  const owned = v.owned ?? []
  const held = v.village ?? []
  const rest = find(acts, 'property.rest')
  const nk = `lf.property.notice.${v.notice}`
  const notice = v.notice && hasKey(nk) ? t(key(nk), Object.fromEntries(Object.entries(v.notice_args ?? {}).map(([k, x]) => [k, typeof x === 'number' ? formatNumber(x) : String(x)]))) : ''
  return (
    <Page title={t('property.mine')} art="keys">
      <Said r={response} />
      {notice && <Note tone="ok" icon="m_check">{notice}</Note>}

      {(v.can_rest || v.rest_in_seconds > 0) && (
        <div className={`n-card n-eco-rest${v.can_rest ? ' lit' : ''}`}>
          <Icon name={v.can_rest ? 'bed' : 'sleepy'} size={52} />
          <div className="n-eco-rest-body">
            <b>{v.can_rest ? t('property.can_rest', { n: formatNumber(v.rest_energy) }) : t('property.rest_in', { t: hms(v.rest_in_seconds) })}</b>
          </div>
          {v.can_rest && rest && <Button small icon="energy" onClick={() => nav.act(rest)}>{t('n.eco.rest')}</Button>}
        </div>
      )}

      {owned.length === 0 && held.length === 0 && !v.rented && <Empty icon="keys">{t('property.none')}</Empty>}

      {v.rented && (
        <>
          <Section title={t('property.rent')} />
          <List>
            <Row icon="keys" title={names.name('property_type', v.rented.property.type.code, v.rented.property.type.name)}
              sub={v.rented.landlord?.name} end={<b>{moneyMain(v.rented.rent)}</b>} />
          </List>
        </>
      )}

      {owned.length > 0 && (
        <>
          <Section title={t('n.eco.owned')} note={formatNumber(owned.length)} />
          <List>
            {owned.map((o) => (
              <Row key={o.no} icon={typeIcon(o.kind, o.home)} title={names.name('property_type', o.type.code, o.type.name)}
                sub={[
                  o.size ? t('property.size', { n: formatNumber(o.size) }) : '',
                  o.home ? t('property.home') : t('property.commercial'),
                  o.tenant?.name ? t('property.rented_to', { name: o.tenant.name }) : o.rent ? t('property.rent_amount', { n: moneyMain(o.rent) }) : '',
                  o.unpaid_periods ? t('property.overdue', { n: formatNumber(o.unpaid_periods) }) : '',
                ].filter(Boolean).join(' · ')}
                end={<>
                  <b>{moneyMain(o.value)}</b>
                  {o.offer && <Chip tone="accent">{o.offer.kind === 'rent' ? t('property.rent') : t('property.sale')}</Chip>}
                </>}
                onClick={() => { const a = find(acts, 'property.manage', { no: o.no }); if (a) nav.act(a); else nav.run('property.view', { no: String(o.no) }) }} />
            ))}
          </List>
        </>
      )}

      {held.map((h, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <Section title={t('property.village_in', { name: names.name('city', h.settlement.code, h.settlement.name) })} note={moneyMain(h.value)} />
          <List>
            {(h.buildings ?? []).map((b, j) => (
              <Row key={j} icon={b.home ? 'house' : 'factory'} title={names.name('settlement_building', b.building.code, b.building.name)}
                sub={[b.home ? t('property.home') : t('property.commercial'), b.state === 'building' ? t('property.going_up') : '',
                  b.home && b.state === 'complete' ? (h.can_rest ? t('property.can_rest_village') : t('property.rest_in', { t: hms(h.rest_in_seconds) })) : ''].filter(Boolean).join(' · ')}
                end={<b>{moneyMain(b.value)}</b>} />
            ))}
            {h.lots > 0 && <Row icon="x_map" title={t('property.lots', { n: formatNumber(h.lots) })} />}
          </List>
        </div>
      ))}

      <More acts={acts} skip={(a) => idOf(a) === 'property.manage' || a === rest} />
    </Page>
  )
}
