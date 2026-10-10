import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'
import { CardGrid } from '../../ui/v6/panel'

interface Named { code?: string; name?: string }
interface PropertyType { type?: Named; kind?: string; size?: number; quality?: number; left?: number; price?: number; home?: boolean }
interface PropertyOffer { no?: number; kind?: string; price?: number; type?: Named; seller?: Named; mine?: boolean }
interface PropertyMarketView { no_city?: boolean; city?: Named; types?: PropertyType[] | null; offers?: PropertyOffer[] | null }

export function PropertyMarket({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PropertyMarketView
  const names = useContentNames()
  if (loading && !response) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /><Notice>{t('property.no_city')}</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('property.market')} tone="emerald" onRefresh={() => run('property.list')} />

      {!!(v.types && v.types.length) && (
        <CardGrid>
          {v.types!.map((ty, i) => (
            <ListRow key={i} icon={ty.home ? 'house' : 'factory'} palette="emerald"
              title={ty.type?.code ? names.name('property_type', ty.type.code, ty.type.name) : '—'}
              sub={`${ty.size ? `${t('property.size', { n: formatNumber(ty.size) })} – ` : ''}${ty.left !== undefined ? `${t('property.left', { n: formatNumber(ty.left) })} – ` : ''}${money(ty.price)}`}
              onClick={() => ty.type?.code && run('property.type', { type: ty.type.code })} />
          ))}
        </CardGrid>
      )}

      {!!(v.offers && v.offers.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('property.offers')}</div>
          <CardGrid>
            {v.offers!.map((o, i) => (
              <ListRow key={i} icon={o.kind === 'rent' ? 'keys' : 'house'} palette="steel"
                title={o.type?.code ? names.name('property_type', o.type.code, o.type.name) : '—'}
                sub={`${o.kind === 'rent' ? t('property.rent') : t('property.sale')} – ${money(o.price)}${o.seller?.name ? ` – ${o.seller.name}` : ''}`}
                onClick={() => o.no !== undefined && run('property.offer', { no: String(o.no) })} />
            ))}
          </CardGrid>
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="property.list" />
    </ScreenScroll>
  )
}

interface Owned {
  no?: number; type?: Named; kind?: string; size?: number; quality?: number
  value?: number; rent?: number; debt?: number; unpaid_periods?: number; home?: boolean
  tenant?: Named | null; city?: Named
}
interface VillageHolding {
  settlement?: Named; lots?: number; value?: number; can_rest?: boolean; rest_in_seconds?: number
  buildings?: { building?: Named; state?: string; home?: boolean; value?: number }[] | null
}
interface PropertyMineView {
  owned?: Owned[] | null; rented?: unknown; residence?: Named
  village?: VillageHolding[] | null
  grace?: number; can_rest?: boolean; rest_energy?: number; rest_in_seconds?: number; notice?: string; notice_args?: Record<string, unknown> | null
}

export function PropertyMine({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PropertyMineView
  const names = useContentNames()
  if (loading && !response) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('property.mine')} tone="emerald" onRefresh={() => run('property.mine')} />

      {v.notice && hasKey(`lf.property.notice.${v.notice}`) && <Notice>{t(`lf.property.notice.${v.notice}` as Key, Object.fromEntries(Object.entries(v.notice_args ?? {}).map(([k, x]) => [k, typeof x === 'number' ? formatNumber(x) : String(x)])))}</Notice>}

      {/* the line is about a home in a city: with none, there is nothing to count down to */}
      {(v.can_rest || !!v.rest_in_seconds) && (
        <Notice alert={!v.can_rest && !!v.rest_in_seconds}>
          {v.can_rest ? t('property.can_rest', { n: formatNumber(v.rest_energy ?? 0) }) : t('property.rest_in', { t: hms(v.rest_in_seconds) })}
        </Notice>
      )}

      {(!v.owned || v.owned.length === 0) && (v.village ?? []).length === 0 && <Notice>{t('property.none')}</Notice>}

      {(v.village ?? []).map((h, i) => (
        <div key={`vh${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nx-sec">{t('property.village_in', { name: names.name('city', h.settlement?.code ?? '', h.settlement?.name) })}</div>
          <CardGrid>
          {(h.buildings ?? []).map((b, j) => (
            <ListRow key={j} icon={b.home ? 'house' : 'factory'} palette={b.home ? 'emerald' : 'gold'}
              title={b.building?.code ? names.name('settlement_building', b.building.code, b.building.name) : '—'}
              sub={[b.home ? t('property.home') : t('property.commercial'), b.state === 'building' ? t('property.going_up') : null,
                b.home && b.state === 'complete' ? (h.can_rest ? t('property.can_rest_village') : t('property.rest_in', { t: hms(h.rest_in_seconds) })) : null].filter(Boolean).join(' – ')}
              right={money(b.value)} />
          ))}
          {!!h.lots && <ListRow icon="x_map" palette="teal" title={t('property.lots', { n: formatNumber(h.lots) })} />}
          </CardGrid>
        </div>
      ))}

      <CardGrid>
        {(v.owned ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={o.home ? 'house' : 'factory'}
            palette={o.home ? 'emerald' : 'gold'}
            title={o.type?.code ? names.name('property_type', o.type.code, o.type.name) : '—'}
            sub={[
              o.size ? t('property.size', { n: formatNumber(o.size) }) : null,
              o.home ? t('property.home') : t('property.commercial'),
              o.tenant?.name ? t('property.rented_to', { name: o.tenant.name }) : o.rent ? t('property.rent_amount', { n: money(o.rent) }) : null,
              o.unpaid_periods ? t('property.overdue', { n: formatNumber(o.unpaid_periods) }) : null,
            ].filter(Boolean).join(' – ')}
            right={money(o.value)}
            onClick={() => o.no !== undefined && run('property.view', { no: String(o.no) })}
          />
        ))}
      </CardGrid>

      <Actions response={response} onAction={onAction} refreshCommand="property.mine" />
    </ScreenScroll>
  )
}
