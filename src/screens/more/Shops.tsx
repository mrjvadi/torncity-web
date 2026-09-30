// City shops (internal/telegram/screens/shops.go, ShopsView): the general
// goods a city sells, one shop per row, opened onto shop.view.

import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { t } from '../../i18n'

interface Named { code?: string; name?: string }
interface ShopLine { shop?: Named; place?: Named; here?: boolean }
interface ShopsView { city?: string; city_code?: string; shops?: ShopLine[] | null; place?: Named | null }

export default function Shops({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ShopsView
  if (loading && !response) return <ScreenScroll><Header title={t('shops.title')} tone="emerald" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.place?.name ? t('shops.title_at', { place: v.place.name }) : t('shops.title')} tone="emerald"
        onBack={() => run('map.list')}
        onRefresh={() => run('shop.list', v.place?.code ? { place: v.place.code } : undefined)} />

      {!(v.shops && v.shops.length) && <Notice>{t('shops.none')}</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.shops ?? []).map((s, i) => (
          <ListRow
            key={i}
            icon="cart"
            palette={s.here ? 'emerald' : 'steel'}
            title={s.shop?.name ?? '—'}
            sub={s.here ? t('shops.here', { place: s.place?.name ?? '' }) : s.place?.name}
            onClick={() => s.shop?.code && run('shop.view', { shop: s.shop.code })}
          />
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
