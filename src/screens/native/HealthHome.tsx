import type { ScreenProps } from '../types'
import { Empty, Header, Notice, ScreenScroll } from './kit/Parts'
import { PCard, PGrid, PSec } from '../../ui/v6/panel'
import { hms } from './kit/format'
import type { HealthHomeView } from '../../api/views.gen'
import { buildingName, useBuildingCatalogue, useContentNames } from '../../village/useVillage'
import { t, type Key } from '../../i18n'
import { careOf } from '../../support/care'

/** «سلامت»: health, rest and sleep, the places of care that stand here and the way to the central city
 * (ADR 0038 4.3). «بیمارستان» is the name only in a city or the central city. */
export default function HealthHome({ response, run, openLocal }: ScreenProps) {
  const v = (response?.view ?? null) as HealthHomeView | null
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  if (!v) return <ScreenScroll><Header title={t('hub.health')} tone="ruby" /><Empty>{t('common.loading')}</Empty></ScreenScroll>

  // «بیمارستان» is the name only where the place has its own hospital (it refers nobody on); a health house is «خانهٔ بهداشت»
  const isCity = careOf(v) === 'hospital'
  const title = isCity ? t('hub.hospital') : t('hub.health')
  const facilities = v.facilities ?? []
  const refer = v.refer ? names.name('city', v.refer.code, v.refer.name) : ''

  return (
    <ScreenScroll>
      <Header title={title} tone="ruby" onRefresh={() => run('health.home')} />

      {v.admitted && <Notice alert>{t('health.admitted', { t: hms(v.admitted.remaining_seconds) })}</Notice>}

      {/* health points are on the HUD already: no second copy here (owner 2026-10-03) */}
      <PSec>{t('health.rest')}</PSec>
      <PGrid>
        <PCard icon="house" title={t('health.rest')}
          chip={v.rest.has && !v.rest.can_rest ? t('health.rest_wait', { t: hms(v.rest.wait_seconds) }) : undefined} chipTone="busy"
          lines={[v.rest.has ? '' : t('health.no_home')]}
          off={!v.rest.has}>
          {v.rest.has && v.rest.can_rest && <button className="pn-btn cc-go" onClick={() => run('settlement.home.rest')}>{t('health.rest_home')}</button>}
        </PCard>
        <PCard icon="heart" title={t('health.sleep')} onClick={() => run('life.me')} lines={[t('health.sleep_open')]} />
      </PGrid>

      <PSec>{t('health.care')}</PSec>
      <PGrid>
        {facilities.map((f, i) => (
          <PCard key={i} icon="health" title={buildingName(cat, f.building.code, f.building.name)} lines={[t('health.facility.sub')]} />
        ))}
        {(isCity || v.admitted) && (
          <PCard icon="cross" title={t('hub.hospital')} onClick={() => run('health.hospital')} lines={[t('health.hospital_open')]} />
        )}
        {v.refer && (
          <PCard off icon="road" title={t('education.here_not')} chip={refer} chipTone="off" lines={[t('health.refer', { city: refer })]}>
            <button className="pn-btn cc-go" onClick={() => openLocal('support_travel', { to: v.refer!.code, service: 'hospital' })}>{t('health.refer_go', { city: refer })}</button>
          </PCard>
        )}
      </PGrid>
      {v.empty && <Empty>{t(`health.empty.${v.empty}` as Key)}</Empty>}
    </ScreenScroll>
  )
}
