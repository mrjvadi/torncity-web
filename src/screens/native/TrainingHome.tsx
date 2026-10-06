import type { ScreenProps } from '../types'
import { Empty, Header, ScreenScroll } from './kit/Parts'
import { CardGrid, PCard, PSec, PStats } from '../../ui/v6/panel'
import { Lines, Need } from './kit/cardparts'
import { money } from './kit/format'
import { formatNumber } from '../../lib/persian'
import type { TrainedView, TrainingHomeView } from '../../api/views.gen'
import { buildingName, useBuildingCatalogue } from '../../village/useVillage'
import { t, type Key } from '../../i18n'

/** «تمرین»: the places to train at where the player stands (open ground always, a training ground where one stands,
 * the gym in the central city) and what a session costs and gives. Energy and health are on the HUD: no second copy
 * here (owner 2026-10-03); only what training itself builds is shown. */
export default function TrainingHome({ response, run }: ScreenProps) {
  const v = (response?.view ?? null) as TrainingHomeView | null
  const cat = useBuildingCatalogue()
  if (!v) return <ScreenScroll><Header title={t('training.title')} tone="ruby" /><Empty>{t('common.loading')}</Empty></ScreenScroll>
  const bonus = Math.max(0, v.stamina - 100)

  return (
    <ScreenScroll>
      <Header title={t('training.title')} tone="ruby" onRefresh={() => run('training.home')} />
      <PStats items={[
        { label: t('training.stamina'), value: formatNumber(v.stamina) },
        { label: t('training.strength'), value: t('common.level', { n: formatNumber(v.strength_level) }) },
        { label: t('training.session_cost'), value: t('training.energy_n', { n: formatNumber(v.energy_cost) }) },
      ]} />
      <PSec>{t('training.venues')}</PSec>
      <CardGrid>
        {(v.venues ?? []).map((venue) => (
          <PCard
            key={venue.code} icon={venue.code === 'yard' ? 'road' : 'hammer'} off={!venue.available} tone={venue.available ? 'good' : 'off'}
            title={t(`training.venue.${venue.code}` as Key)}
            badge={t('training.efficiency', { p: formatNumber(Math.round(venue.efficiency_bps / 100)) })}
            facts={
              <>
                <Lines lines={[venue.unkept ? t('training.unkept') : venue.fee > 0 ? t('training.fee', { fee: money(venue.fee) }) : t('training.free')]} />
                {!venue.available && venue.missing && <Need lines={[t('training.missing', { name: buildingName(cat, venue.missing.code, venue.missing.name) })]} />}
              </>
            }
            foot={venue.available ? <button className="pn-btn" onClick={() => run('training.start', { venue: venue.code })}>{t('training.start')}</button> : undefined}
          />
        ))}
      </CardGrid>
      {bonus > 0 && <Empty>{t('training.bonus', { n: formatNumber(Math.min(v.max_energy_cap, Math.floor(bonus / 50))), cap: formatNumber(v.max_energy_cap) })}</Empty>}
    </ScreenScroll>
  )
}

/** A finished session: what it gave. The energy left is on the HUD. */
export function Trained({ response, run }: ScreenProps) {
  const v = (response?.view ?? null) as TrainedView | null
  if (!v) return <ScreenScroll><Header title={t('training.title')} tone="ruby" /><Empty>{t('common.loading')}</Empty></ScreenScroll>
  return (
    <ScreenScroll>
      <Header title={t('training.done_title')} tone="ruby" />
      <PStats items={[
        { label: t('training.stamina'), value: `+${formatNumber(v.stamina)}` },
        { label: t('training.strength'), value: t('training.xp', { n: formatNumber(v.strength_xp) }) },
        ...(v.max_energy_added > 0 ? [{ label: t('training.max_energy'), value: `+${formatNumber(v.max_energy_added)}`, gold: true }] : []),
        ...(v.fee > 0 ? [{ label: t('training.paid'), value: money(v.fee) }] : []),
      ]} />
      {v.strength_level > 0 && <Empty>{t('training.level_up', { n: formatNumber(v.strength_level) })}</Empty>}
      <div style={{ padding: '0 16px 16px' }}><button className="pn-btn" onClick={() => run('training.home')}>{t('training.again')}</button></div>
    </ScreenScroll>
  )
}
