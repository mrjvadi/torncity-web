import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import { CardGrid, PStats } from '../../ui/v6/panel'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

interface Named { code?: string; name?: string; emoji?: string }
interface Needs { hunger?: number; sleep?: number; stress?: number; happiness?: number }
interface Worth { cash?: number; bank?: number; property?: number; goods?: number; debts?: number; savings?: number; gold?: number; loans?: number; total?: number }
interface SleepSpot { spot?: Named; place?: Named; price?: number; rest?: number; relief?: number }
interface LifeView {
  needs?: Needs; age?: number; stage?: Named
  rank?: Named | null; next?: Named | null; next_need?: number
  worth?: Worth
  village_home?: { building?: Named; can_rest?: boolean; rest_in_seconds?: number } | null
  spots?: SleepSpot[] | null; sleep_in_seconds?: number; home?: boolean
  notice?: string; notice_args?: Record<string, unknown> | null
}

export default function Life({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as LifeView
  const names = useContentNames()
  if (loading && !response) return <ScreenScroll><Header title={t('life.title')} tone="violet" /></ScreenScroll>

  const needs = v.needs
  const items: { key: keyof Needs; label: string; color: string; icon: string }[] = [
    { key: 'sleep', label: t('need.sleep'), color: 'var(--violet)', icon: 'moon' },
    { key: 'hunger', label: t('need.hunger'), color: 'var(--saffron)', icon: 'bread' },
    { key: 'happiness', label: t('need.happiness'), color: 'var(--leaf)', icon: 'sun' },
    { key: 'stress', label: t('need.stress'), color: 'var(--anar)', icon: 'x_flame' },
  ]

  return (
    <ScreenScroll>
      <Header title={t('life.title')} tone="violet" onRefresh={() => run('life.me')} />

      {v.notice && hasKey(`lf.life.notice.${v.notice}`) && (
        <Notice>{t(`lf.life.notice.${v.notice}` as Key, { spot: names.name('sleep_spot', String(v.notice_args?.spot ?? ''), String(v.notice_args?.spot ?? '')), rest: formatNumber(Number(v.notice_args?.rest ?? 0)) })}</Notice>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="nx-chip nx-chip-gold">{t('life.stage_age', { stage: names.name('life_stage', v.stage?.code ?? '', v.stage?.name) || '—', age: formatNumber(v.age ?? 0) })}</span>
          {v.rank?.name && <span className="nx-chip">{names.name('rank', v.rank.code ?? '', v.rank.name)}</span>}
        </div>
        {needs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {items.filter((i) => needs[i.key] !== undefined).map((i) => (
              <div key={i.key} className="nx-bar-wrap">
                <div className="nx-bar" style={{ borderColor: i.color, height: 22 }}>
                  <div className="nx-bar-fill" style={{ width: `${clamp01((needs[i.key] as number) / 100) * 100}%`, background: i.color }} />
                  <span className="nx-bar-label display" style={{ lineHeight: '18px', fontSize: 12 }}>{i.label} {formatNumber(needs[i.key] as number)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {v.worth && (
        <>
          <PStats items={[
            { label: t('life.net_worth'), value: money(v.worth.total), gold: true },
            { label: t('life.cash_bank'), value: money((v.worth.cash ?? 0) + (v.worth.bank ?? 0)) },
            { label: t('life.property'), value: money(v.worth.property) },
          ]} />
        </>
      )}

      {v.village_home && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('life.home_bed')}</div>
          <ListRow icon="bed" palette="emerald" title={t('life.home_bed_in', { name: names.name('settlement_building', v.village_home.building?.code ?? '', v.village_home.building?.name) })}
            sub={v.village_home.can_rest ? t('life.home_bed_ready') : t('life.home_bed_wait', { t: hms(v.village_home.rest_in_seconds) })}
            onClick={v.village_home.can_rest ? () => run('settlement.home.rest') : undefined} />
        </Card>
      )}

      {!!(v.spots && v.spots.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t(v.village_home ? 'life.sleep_spots_other' : 'life.sleep_spots')}</div>
          <CardGrid>
            {v.spots!.map((s, i) => {
              // the server lists what may be done by meaning: sleep here, or walk there and sleep
              const act = (response?.actions ?? []).find((a) => (a.id === 'life.sleep' || a.id === 'life.sleep_walk') && a.subject === s.spot?.code)
              return (
                <ListRow key={i} icon="bed" palette="violet" title={s.spot?.name ? names.name('sleep_spot', s.spot.code ?? '', s.spot.name) : '—'}
                  sub={`${t('life.spot_sub', { place: s.place?.name ? names.name('place', s.place.code ?? '', s.place.name) : '', rest: formatNumber(s.rest ?? 0) })}${s.price ? ` · ${money(s.price)}` : ''}`}
                  onClick={act && !v.sleep_in_seconds ? () => onAction(act) : undefined} />
              )
            })}
          </CardGrid>
          {!!v.sleep_in_seconds && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>{t('life.sleep_again', { t: hms(v.sleep_in_seconds) })}</div>}
        </Card>
      )}

      <Actions response={response} onAction={onAction} only={(a) => a.id !== 'life.sleep' && a.id !== 'life.sleep_walk' && a.id !== 'life.village_rest'} refreshCommand="life.me" />
    </ScreenScroll>
  )
}
