// زندگی (screen `life`, command life.me): my stage, age and wealth rank with my net worth and the way to the next
// rank as the hero; my needs and my mind; what my net worth is made of; where I can sleep (my home's bed in a
// village, the city's spots elsewhere), then the rest the server offers (my story, my card, the rankings).

import type { NScreenProps } from '../../registry'
import type { Action } from '../../../api/types'
import type { LifeView, SurvivalView, WorthView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Chip, Empty, Hero, Icon, KV, List, Loading, Meter, Note, Page, Row, Section } from '../../ui'
import { useContentNames } from '../../../village/useVillage'
import { clamp01, formatNumber, hms, money } from '../../../screens/native/kit/format'
import { t, type Key } from '../../../i18n'
import { figure, MoreActions, NeedsCard, of, useBack, useSideView, word } from './parts'
import './me.css'

/** What a net worth is made of, in the order the player thinks of it; a part that is zero is not shown. */
const PARTS: (keyof WorthView)[] = ['cash', 'bank', 'savings', 'property', 'goods', 'gold', 'equity', 'escrow', 'loans', 'debts']
const SLEEP = (a: Action) => a.id === 'life.sleep' || a.id === 'life.sleep_walk' || a.id === 'life.village_rest'
const ICONS: Record<string, string> = { 'life.home_rest': 'house', 'life.history': 'x_scroll', 'life.card': 'x_cards', 'life.top': 'podium' }

export default function Life({ response, loading }: NScreenProps) {
  const nav = useNav()
  const back = useBack()
  const names = useContentNames()
  const survival = useSideView<SurvivalView>('health.survival')
  if (!response) return <Page title={t('life.title')} onBack={back}>{loading ? <Loading blocks={[200, 180, 120]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const v = (response.view ?? {}) as Partial<LifeView>
  const acts = response.actions ?? []
  const stage = v.stage?.name ? names.name('life_stage', v.stage.code ?? '', v.stage.name) : ''
  const rank = v.rank?.name ? names.name('life_rank', v.rank.code ?? '', v.rank.name) : ''
  const next = v.next?.name ? names.name('life_rank', v.next.code ?? '', v.next.name) : ''
  const total = v.worth?.total
  const notice = v.notice ? word(`lf.life.notice.${v.notice}`) : ''
  const noticeArgs = v.notice_args ?? {}
  const spotWord = (code: string) => names.name('sleep_spot', code, code)
  const parts = v.worth ? PARTS.filter((k) => (v.worth?.[k] ?? 0) !== 0) : []
  const villageRest = acts.find((a) => a.id === 'life.village_rest')

  return (
    <Page title={t('life.title')} onBack={back}>
      {notice && (
        <Note tone="ok" icon="m_check">
          {t(`lf.life.notice.${v.notice}` as Key, { spot: spotWord(String(noticeArgs.spot ?? '')), rest: formatNumber(Number(noticeArgs.rest ?? 0)) })}
        </Note>
      )}

      <Hero>
        <div className="n-me-chips n-me-life-chips">
          <Icon name="f_tree" className="n-me-life-ic" />
          {stage && <Chip tone="cyan">{t('life.stage_age', { stage, age: formatNumber(v.age ?? 0) })}</Chip>}
          {rank && <Chip tone="accent">{v.rank?.emoji ? `${v.rank.emoji} ` : ''}{rank}</Chip>}
        </div>
        {total !== undefined && (
          <>
            <p className="n-label n-me-gap">{t('life.net_worth')}</p>
            <p className="n-big">{figure(total).value}</p>
            {figure(total).note && <p className="n-label">{figure(total).note}</p>}
          </>
        )}
        {next && !!v.next_need && total !== undefined && (
          <div className="n-hero-foot">
            <Meter frac={clamp01(total / v.next_need)} tone="accent" thick
              label={<>{t('n.me.life.next', { name: `${v.next?.emoji ? v.next.emoji + ' ' : ''}${next}` })}</>} value={of(total, v.next_need)} />
          </div>
        )}
      </Hero>

      {v.needs && (
        <>
          <Section title={t('profile.needs')} />
          <NeedsCard needs={v.needs} survival={survival} />
        </>
      )}

      {!!v.intelligence_max && (
        <div className="n-card n-me-mind">
          <Icon name="f_grad" className="n-me-need-ic" />
          <div className="n-me-need-bar"><Meter frac={clamp01((v.intelligence ?? 0) / v.intelligence_max)} tone="cyan" label={t('n.me.life.intel')} value={of(v.intelligence ?? 0, v.intelligence_max)} /></div>
        </div>
      )}

      {parts.length > 0 && (
        <>
          <Section title={t('n.me.life.worth')} />
          <div className="n-rows">
            {parts.map((k) => <KV key={k} label={t(`n.me.worth.${k}` as Key)} value={money(v.worth?.[k])} />)}
          </div>
        </>
      )}

      {v.village_home && (
        <>
          <Section title={t('life.home_bed')} />
          <List>
            <Row icon="house" title={names.name('settlement_building', v.village_home.building?.code ?? '', v.village_home.building?.name)}
              sub={v.village_home.can_rest ? t('life.home_bed_ready') : t('life.home_bed_wait', { t: hms(v.village_home.rest_in_seconds) })}
              end={v.village_home.can_rest ? undefined : <b className="n-me-time">{hms(v.village_home.rest_in_seconds)}</b>}
              onClick={v.village_home.can_rest ? () => (villageRest ? nav.act(villageRest) : nav.run('settlement.home.rest')) : undefined} />
          </List>
        </>
      )}

      {!!v.spots?.length && (
        <>
          <Section title={t(v.village_home ? 'life.sleep_spots_other' : 'life.sleep_spots')} />
          {!!v.sleep_in_seconds && <Note tone="info" icon="sleepy">{t('life.sleep_again', { t: hms(v.sleep_in_seconds) })}</Note>}
          <List>
            {v.spots.map((s, i) => {
              // the server lists what may be done by meaning: sleep here, or walk there and sleep
              const act = acts.find((a) => (a.id === 'life.sleep' || a.id === 'life.sleep_walk') && a.subject === s.spot?.code)
              const place = s.place?.code ? names.name('place', s.place.code, s.place.name) : ''
              return (
                <Row key={i} icon={s.price ? 'bed' : 'm_bench'} title={s.spot?.code ? spotWord(s.spot.code) : s.spot?.name ?? ''}
                  sub={t('life.spot_sub', { place, rest: formatNumber(s.rest ?? 0) })}
                  end={<Chip tone={s.price ? undefined : 'ok'}>{s.price ? figure(s.price).value : t('common.free')}</Chip>}
                  onClick={act && !v.sleep_in_seconds ? () => nav.act(act) : undefined} />
              )
            })}
          </List>
        </>
      )}

      <MoreActions response={response} title={t('profile.more')} skip={SLEEP} icons={ICONS} />
    </Page>
  )
}
