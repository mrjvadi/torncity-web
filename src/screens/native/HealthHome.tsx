import type { ScreenProps } from '../types'
import { Card, Empty, Header, ListRow, Notice, Ring, ScreenScroll, SectionTitle } from './kit/Parts'
import { Slab } from '../../kit'
import Icon from '../../ui/Icon'
import { clamp01, formatNumber, hms } from './kit/format'
import type { HealthHomeView } from '../../api/views.gen'
import { buildingName, useBuildingCatalogue, useContentNames } from '../../village/useVillage'
import { t, type Key } from '../../i18n'

/** «سلامت»: health, rest and sleep, the places of care that stand here and the way to the central city
 * (ADR 0038 4.3). «بیمارستان» is the name only in a city or the central city. */
export default function HealthHome({ response, run, openLocal }: ScreenProps) {
  const v = (response?.view ?? null) as HealthHomeView | null
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  if (!v) return <ScreenScroll><Header title={t('hub.health')} tone="ruby" /><Empty>{t('common.loading')}</Empty></ScreenScroll>

  const isCity = v.place.tier === 'city'
  const title = isCity ? t('hub.hospital') : t('hub.health')
  const facilities = v.facilities ?? []
  const refer = v.refer ? names.name('city', v.refer.code, v.refer.name) : ''

  return (
    <ScreenScroll>
      <Header title={title} tone="ruby" onRefresh={() => run('health.home')} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <Ring frac={v.max_health ? clamp01(v.health / v.max_health) : 1} color={v.admitted ? 'var(--anar)' : 'var(--leaf)'} size={110}>
          <Icon name="health" palette={v.admitted ? 'ruby' : 'emerald'} size={32} />
        </Ring>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('health.of', { a: formatNumber(v.health), b: formatNumber(v.max_health) })}</div>
      </div>

      {v.admitted && <Notice alert>{t('health.admitted', { t: hms(v.admitted.remaining_seconds) })}</Notice>}

      <SectionTitle>{t('health.rest')}</SectionTitle>
      <Card>
        {v.rest.has ? (
          v.rest.can_rest
            ? <Slab tone="gold" radius={12} lip={3} onClick={() => run('settlement.home.rest')}>{t('health.rest_home')}</Slab>
            : <div style={{ fontSize: 13 }}>{t('health.rest_wait', { t: hms(v.rest.wait_seconds) })}</div>
        ) : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('health.no_home')}</div>}
      </Card>

      <SectionTitle>{t('health.sleep')}</SectionTitle>
      <ListRow icon="moon" palette="violet" title={t('health.sleep_open')} onClick={() => run('life.me')} />

      <SectionTitle>{t('health.care')}</SectionTitle>
      {facilities.map((f, i) => (
        <ListRow key={i} icon="stetho" palette="emerald" title={buildingName(cat, f.building.code, f.building.name)} sub={t('health.facility.sub')} />
      ))}
      {v.empty && <Empty>{t(`health.empty.${v.empty}` as Key)}</Empty>}
      {(isCity || v.admitted) && <Slab tone="steel" radius={14} lip={4} onClick={() => run('health.hospital')}>{t('health.hospital_open')}</Slab>}
      {v.refer && (
        <Card tone="gold">
          <div style={{ fontSize: 14, marginBottom: 8 }}>{t('health.refer', { city: refer })}</div>
          <Slab tone="gold" radius={14} lip={4} onClick={() => openLocal('support_travel', { to: v.refer!.code, service: 'hospital' })}>{t('health.refer_go', { city: refer })}</Slab>
        </Card>
      )}
    </ScreenScroll>
  )
}
