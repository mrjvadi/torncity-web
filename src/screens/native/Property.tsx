import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'
import { t } from '../../i18n'

interface Named { code?: string; name?: string }
interface PropertyType { type?: Named; kind?: string; size?: number; quality?: number; left?: number; price?: number; home?: boolean }
interface PropertyOffer { no?: number; kind?: string; price?: number; type?: Named; seller?: Named; mine?: boolean }
interface PropertyMarketView { no_city?: boolean; city?: Named; types?: PropertyType[] | null; offers?: PropertyOffer[] | null }

export function PropertyMarket({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PropertyMarketView
  if (loading && !response) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /><Notice>{t('property.no_city')}</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('property.market')} tone="emerald" onRefresh={() => run('property.list')} />

      {!!(v.types && v.types.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.types!.map((ty, i) => (
            <ListRow key={i} icon={ty.home ? 'house' : 'factory'} palette="emerald"
              title={ty.type?.name ?? '—'}
              sub={`${ty.size ? `${t('property.size', { n: formatNumber(ty.size) })} · ` : ''}${ty.left !== undefined ? `${t('property.left', { n: formatNumber(ty.left) })} · ` : ''}${money(ty.price)}`}
              onClick={() => ty.type?.code && run('property.type', { type: ty.type.code })} />
          ))}
        </div>
      )}

      {!!(v.offers && v.offers.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('property.offers')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.offers!.map((o, i) => (
              <ListRow key={i} icon={o.kind === 'rent' ? 'keys' : 'house'} palette="steel"
                title={o.type?.name ?? '—'}
                sub={`${o.kind === 'rent' ? t('property.rent') : t('property.sale')} · ${money(o.price)}${o.seller?.name ? ` · ${o.seller.name}` : ''}`}
                onClick={() => o.no !== undefined && run('property.offer', { no: String(o.no) })} />
            ))}
          </div>
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
interface PropertyMineView {
  owned?: Owned[] | null; rented?: unknown; residence?: Named
  grace?: number; can_rest?: boolean; rest_energy?: number; rest_in_seconds?: number; notice?: string
}

export function PropertyMine({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PropertyMineView
  if (loading && !response) return <ScreenScroll><Header title={t('property.title')} tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('property.mine')} tone="emerald" onRefresh={() => run('property.mine')} />

      {v.notice && <Notice>{v.notice}</Notice>}

      {v.can_rest !== undefined && (
        <Notice alert={!v.can_rest && !!v.rest_in_seconds}>
          {v.can_rest ? t('property.can_rest', { n: formatNumber(v.rest_energy ?? 0) }) : t('property.rest_in', { t: hms(v.rest_in_seconds) })}
        </Notice>
      )}

      {(!v.owned || v.owned.length === 0) && <Notice>{t('property.none')}</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.owned ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={o.home ? 'house' : 'factory'}
            palette={o.home ? 'emerald' : 'gold'}
            title={o.type?.name ?? '—'}
            sub={[
              o.size ? t('property.size', { n: formatNumber(o.size) }) : null,
              o.home ? t('property.home') : t('property.commercial'),
              o.tenant?.name ? t('property.rented_to', { name: o.tenant.name }) : o.rent ? t('property.rent_amount', { n: money(o.rent) }) : null,
              o.unpaid_periods ? t('property.overdue', { n: formatNumber(o.unpaid_periods) }) : null,
            ].filter(Boolean).join(' · ')}
            right={money(o.value)}
            onClick={() => o.no !== undefined && run('property.view', { no: String(o.no) })}
          />
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="property.mine" />
    </ScreenScroll>
  )
}
