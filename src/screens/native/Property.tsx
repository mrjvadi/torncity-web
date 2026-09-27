import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, hms, money } from './kit/format'

interface Named { code?: string; name?: string }
interface PropertyType { type?: Named; kind?: string; size?: number; quality?: number; left?: number; price?: number; home?: boolean }
interface PropertyOffer { no?: number; kind?: string; price?: number; type?: Named; seller?: Named; mine?: boolean }
interface PropertyMarketView { no_city?: boolean; city?: Named; types?: PropertyType[] | null; offers?: PropertyOffer[] | null }

export function PropertyMarket({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as PropertyMarketView
  if (loading && !response) return <ScreenScroll><Header title="ملک" tone="emerald" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title="ملک" tone="emerald" /><Notice>در هیچ شهری نیستی.</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="بازار ملک" tone="emerald" onRefresh={() => run('property.list')} />

      {!!(v.types && v.types.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.types!.map((t, i) => (
            <ListRow key={i} icon={t.home ? 'house' : 'factory'} palette="emerald"
              title={t.type?.name ?? '—'}
              sub={`${t.size ? `${formatNumber(t.size)} متر · ` : ''}${t.left !== undefined ? `${formatNumber(t.left)} باقی‌مانده · ` : ''}${money(t.price)}`}
              onClick={() => t.type?.code && run('property.type', { type: t.type.code })} />
          ))}
        </div>
      )}

      {!!(v.offers && v.offers.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>پیشنهادهای مالکان</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.offers!.map((o, i) => (
              <ListRow key={i} icon={o.kind === 'rent' ? 'keys' : 'house'} palette="steel"
                title={o.type?.name ?? '—'}
                sub={`${o.kind === 'rent' ? 'اجاره' : 'فروش'} · ${money(o.price)}${o.seller?.name ? ` · ${o.seller.name}` : ''}`}
                onClick={() => o.no !== undefined && run('property.offer', { no: String(o.no) })} />
            ))}
          </div>
        </Card>
      )}

      <Actions response={response} onAction={onAction} />
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
  if (loading && !response) return <ScreenScroll><Header title="ملک" tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="ملک من" tone="emerald" onRefresh={() => run('property.mine')} />

      {v.notice && <Notice>{v.notice}</Notice>}

      {v.can_rest !== undefined && (
        <Notice alert={!v.can_rest && !!v.rest_in_seconds}>
          {v.can_rest ? `می‌توانی استراحت کنی (+${formatNumber(v.rest_energy ?? 0)} انرژی)` : `تا استراحت بعدی: ${hms(v.rest_in_seconds)}`}
        </Notice>
      )}

      {(!v.owned || v.owned.length === 0) && <Notice>هنوز ملکی نداری.</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.owned ?? []).map((o, i) => (
          <ListRow
            key={i}
            icon={o.home ? 'house' : 'factory'}
            palette={o.home ? 'emerald' : 'gold'}
            title={o.type?.name ?? '—'}
            sub={[
              o.size ? `${formatNumber(o.size)} متر` : null,
              o.home ? 'مسکونی' : 'تجاری',
              o.tenant?.name ? `اجاره داده به ${o.tenant.name}` : o.rent ? `اجاره ${money(o.rent)}` : null,
              o.unpaid_periods ? `${formatNumber(o.unpaid_periods)} دوره معوق` : null,
            ].filter(Boolean).join(' · ')}
            right={money(o.value)}
            onClick={() => o.no !== undefined && run('property.view', { no: String(o.no) })}
          />
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
