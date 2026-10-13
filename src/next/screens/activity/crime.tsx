// Crime in the new UI: the underworld hub (nerve, heat, tier, the categories), a category's crimes, one crime with its
// chance and its stakes, how an attempt ended, a timed crime under way, the record, jail and bail.

import type { NScreenProps } from '../../registry'
import type {
  BailedView, CrimeDetailView, CrimeHubView, CrimeListView, CrimeRecordView, CrimeRequirement, CrimeResultView, CrimeStartedView, HeatView, JailView, Named,
  NerveView, TierView,
} from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Card, Chip, Empty, Icon, KV, List, Meter, Note, Now, Row, Rows, Section, Stat, Stats, Strip, Tile, Tiles } from '../../ui'
import { t } from '../../../i18n'
import { hms, roughDuration } from '../../../screens/native/kit/format'
import { atText } from '../../../lib/duration'
import { useServerNow } from '../../../lib/ticker'
import { ActPage, MoneyBig, cash, Conds, MoreActs, NoView, Pager, PayBox, ResultHero, cityName, idOf, n, pctOf, range, signedPct, tk, useActs, type Acts, type ContentNames, type Cond } from './common'
import { Gains } from './work'

// -- names and looks -------------------------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, string> = { petty_theft: 'm_hand', street_crime: 'x_fist', burglary: 'keys', fraud: 'phone', smuggling: 'box' }
const CRIME_ICON: Record<string, string> = {
  pickpocketing: 'm_hand', shoplifting: 'cart', bag_snatching: 'm_brief', mugging: 'x_knife', house_burglary: 'keys', phone_scam: 'phone', contraband_run: 'box',
}
const crimeIcon = (code: string) => CRIME_ICON[code] ?? 'crime'
const crimeName = (names: ContentNames, c: Named) => names.name('crime', c.code, c.name)
const categoryName = (names: ContentNames, c: Named) => tk(`crime.category.${c.code}`, '') || names.name('crime_category', c.code, c.name)
const tierName = (names: ContentNames, c: Named) => tk(`crime.tier_name.${c.code}`, '') || names.name('crime_tier', c.code, c.name)
const venueName = (names: ContentNames, c: Named) => (c.code ? names.name('venue', c.code, c.name) : c.name)

/** The chance's colour: good odds green, fair ones amber, poor ones red. */
const chanceTone = (bps: number) => (bps >= 6000 ? undefined : bps >= 3500 ? 'warn' : 'bad') as 'warn' | 'bad' | undefined

/** Nerve, heat and the tier, as three meters in one card. */
function Gauges({ nerve, heat, tier, names }: { nerve: NerveView; heat: HeatView; tier?: TierView; names: ContentNames }) {
  return (
    <Card className="n-act-gauges">
      <Meter tone="bad" frac={nerve.max ? nerve.nerve / nerve.max : 0} label={<><Icon name="nerve" size={20} />{t('n.act.crime.nerve')}</>}
        value={`${t('ac.work.of', { a: n(nerve.nerve), b: n(nerve.max) })}${nerve.nerve < nerve.max && nerve.full_in_seconds ? ` – ${t('crime.full_in', { t: hms(nerve.full_in_seconds) })}` : ''}`} />
      <Meter tone="warn" frac={heat.max ? heat.heat / heat.max : 0} label={<><Icon name="heat" size={20} />{t('n.act.crime.heat')}</>}
        value={heat.wanted ? `${n(heat.heat)} – ${t('crime.wanted', { n: n(heat.wanted) })}` : n(heat.heat)} />
      {tier && tier.next?.code && tier.next_xp > 0 && (
        <Meter tone="accent" frac={tier.xp / tier.next_xp} label={<><Icon name="rank" size={20} />{t('ac.crime.rec.next', { name: tierName(names, tier.next) })}</>}
          value={t('ac.work.of', { a: n(tier.xp), b: n(tier.next_xp) })} />
      )}
    </Card>
  )
}

/** One condition of a crime, worded by its kind; the names from the catalogue. */
export function crimeCond(names: ContentNames, r: CrimeRequirement): Cond {
  const have = (h: string) => (!r.met ? ` ${t('req.have', { have: h })}` : '')
  const venues = (r.venues ?? []).map((v) => venueName(names, v)).join(`${t('common.sep')} `)
  let text: string
  switch (r.kind) {
    case 'level': text = t('req.level', { need: n(r.need) }) + have(n(r.have)); break
    case 'skill': text = t('req.skill', { skill: names.name('skill', r.skill, r.skill), need: n(r.need) }) + have(n(r.have)); break
    case 'certificate': text = t('req.certificate', { name: names.name('course', r.course_code, r.course_name) }); break
    case 'crime_tier': text = t('req.crime_tier', { name: tierName(names, r.tier), have: have(tierName(names, r.have_tier)) }); break
    case 'venue': text = r.met ? t('req.venue_ok', { names: venues }) : t('ac.crime.req.venue_miss', { names: venues, here: venueName(names, r.here) }); break
    case 'facility': text = t('req.facility', { name: names.name(['facility', 'settlement_building'], r.facility, r.facility) }); break
    case 'tool': text = t('req.tool', { name: names.name('item', r.tool.code, r.tool.name) }); break
    default: text = t('ac.crime.req.other')
  }
  return { met: r.met, text }
}

// -- the hub ---------------------------------------------------------------------------------------------------

export function CrimeHub({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as CrimeHubView | undefined
  if (!v) return <NoView title={t('crime.title')} loading={loading} />
  const { names } = acts
  const cats = v.categories ?? []
  const where = [venueName(names, v.venue), cityName(names, v.city_code, v.city)].filter(Boolean).join(`${t('common.sep')} `)
  const jail = acts.find('crime.jail')
  return (
    <ActPage title={t('act.crime.hub')} sub={where || undefined} response={response}>
      {v.jail && <Now icon="handcuffs" title={t('screen.jail')} sub={crimeName(names, v.jail.crime)} time={hms(v.jail.remaining_seconds)} onClick={() => (jail ? nav.act(jail) : nav.run('crime.jail'))} />}
      {v.busy && <Now icon="stopwatch" lit title={crimeName(names, v.busy.crime)} sub={t('n.act.crime.under_way')} time={hms(v.busy.remaining_seconds)} />}

      <div className="n-act-tier">
        <Icon name="x_ninja" size={56} />
        <div>
          <p className="n-label">{t('n.act.crime.tier')}</p>
          <p className="n-act-tier-name">{tierName(names, v.tier.tier)}</p>
        </div>
        {v.heat.stars > 0 && <span className="n-act-stars" aria-label={t('crime.wanted', { n: n(v.heat.stars) })}>{Array.from({ length: Math.min(5, v.heat.stars) }, (_, i) => <Icon key={i} name="x_star" size={20} />)}</span>}
      </div>
      <Gauges nerve={v.nerve} heat={v.heat} tier={v.tier} names={names} />

      {v.travelling && <Note tone="info" icon="plane">{t('crime.travelling')}</Note>}
      {v.empty === 'level_too_low' && <Note icon="m_lock">{t('crime.empty.level_too_low', { n: n(v.min_level) })}</Note>}
      {v.empty === 'no_venue' && <Note icon="market">{t('crime.empty.no_venue')} {v.need_role && t('crime.empty.need_building', { name: tk(`crime.role.${v.need_role}`, v.need_code) })}</Note>}
      {v.empty === 'no_targets' && <Note icon="eye">{t('crime.empty.no_targets')}</Note>}

      {cats.length > 0 && (
        <>
          <Section title={t('n.act.crime.choose')} />
          <Tiles>
            {cats.map((c) => {
              const go = acts.of('crime.category', c.code)
              return <Tile key={c.code} icon={CATEGORY_ICON[c.code] ?? 'crime'} title={categoryName(names, c)} tone="bad" onClick={() => (go ? nav.act(go) : nav.run('crime.list', { category: c.code }))} />
            })}
          </Tiles>
        </>
      )}
      <MoreActs acts={acts} list={acts.rest(['crime.category', 'crime.jail'])} />
    </ActPage>
  )
}

// -- a category ------------------------------------------------------------------------------------------------

export function CrimeList({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as CrimeListView | undefined
  if (!v) return <NoView title={t('crime.title')} loading={loading} />
  const { names } = acts
  const crimes = v.crimes ?? []
  return (
    <ActPage title={categoryName(names, v.category)} response={response}>
      {crimes.length === 0 && <Empty icon="crime">{t('crime.list.empty')}</Empty>}
      <Rows>
        {crimes.map((c) => {
          const go = acts.of('crime.view', c.crime.code)
          return (
            <Row key={c.crime.code} icon={c.eligible ? crimeIcon(c.crime.code) : 'm_lock'} title={crimeName(names, c.crime)}
              sub={c.eligible ? (c.duration_seconds > 0 ? t('crime.chip_duration', { t: roughDuration(c.duration_seconds) }) : t('ac.crime.d.instant')) : t('ac.crime.list.locked')}
              end={<Chip tone={c.eligible ? 'bad' : undefined}><Icon name="nerve" size={16} />{n(c.nerve)}</Chip>}
              onClick={go ? () => nav.act(go) : () => nav.run('crime.view', { crime: c.crime.code })} />
          )
        })}
      </Rows>
      <Pager acts={acts} page={v.page} pages={v.pages} />
      <MoreActs acts={acts} list={acts.rest(['crime.view', 'page.prev', 'page.next'])} />
    </ActPage>
  )
}

// -- one crime -------------------------------------------------------------------------------------------------

const ODDS = ['base', 'skill', 'awareness', 'heat', 'gear'] as const

function blockedText(v: CrimeDetailView): string {
  switch (v.blocked) {
    case '': return ''
    case 'nerve': return t('ac.crime.d.blocked_nerve', { need: n(v.need), have: n(v.have) })
    case 'cooldown': return t('ac.crime.d.blocked_cooldown', { t: hms(v.wait_seconds || v.cooldown_left_seconds) })
    default: return tk(`crime.blocked.${v.blocked}`, t('crime.blocked.default'))
  }
}

/** The start of a crime: a red, heavy button (this is the risky thing on the screen), or why it cannot start. */
function StartCrime({ acts, v }: { acts: Acts; v: CrimeDetailView }) {
  const nav = useNav()
  const go = acts.find('crime.commit')
  const blocked = blockedText(v)
  const missing = (v.requirements ?? []).some((r) => !r.met)
  if (go) {
    return (
      <button className="n-btn block n-act-heist" onClick={() => nav.act(go)}>
        <Icon name={crimeIcon(v.crime.code)} />{acts.label(go)}<span className="n-act-heist-cost"><Icon name="nerve" size={18} />{n(v.nerve)}</span>
      </button>
    )
  }
  return <Note tone="bad" icon={v.blocked === 'jail' ? 'handcuffs' : v.blocked === 'nerve' ? 'nerve' : 'm_stop'}>{blocked || (missing ? t('ac.crime.d.missing') : t('crime.blocked.default'))}</Note>
}

export function CrimeDetail({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as CrimeDetailView | undefined
  if (!v) return <NoView title={t('crime.title')} loading={loading} />
  const { names } = acts
  const odds = ODDS.map((k) => [k, v.odds[k]] as const).filter(([, x]) => x !== 0)
  const gear = ([['catch', v.gear_catch_bps], ['witness', v.gear_witness_bps], ['solve', v.gear_solve_bps], ['reward', v.gear_reward_bps]] as const).filter(([, x]) => x !== 0)
  const hits = [v.hits_np_cs && t('ac.crime.d.hits_npcs'), v.hits_players && t('ac.crime.d.hits_players')].filter(Boolean).join(`${t('common.sep')} `)
  const reqs = (v.requirements ?? []).map((r) => crimeCond(names, r))
  // what is missing comes first when it is what stands between the player and the crime
  const condsFirst = !acts.find('crime.commit') && reqs.some((c) => !c.met)
  return (
    <ActPage title={crimeName(names, v.crime)} response={response}>
      <div className="n-hero has-art n-act-crime-hero">
        <Icon name={crimeIcon(v.crime.code)} className="n-hero-art" />
        <div className="n-hero-body">
          <p className="n-label">{categoryName(names, v.category)}</p>
          <p className="n-big n-act-name">{crimeName(names, v.crime)}</p>
          <div className="n-chips n-hero-line">
            <Chip tone="bad"><Icon name="nerve" size={18} />{t('crime.chip_nerve', { n: n(v.nerve) })}</Chip>
            <Chip><Icon name="stopwatch" size={18} />{v.duration_seconds > 0 ? roughDuration(v.duration_seconds) : t('ac.crime.d.instant')}</Chip>
          </div>
        </div>
        <div className="n-act-chance">
          <Meter thick tone={chanceTone(v.chance_bps)} frac={v.chance_bps / 10000} label={t('n.act.crime.chance')} value={<span className="n-act-chance-v">{pctOf(v.chance_bps)}</span>} />
        </div>
      </div>

      <StartCrime acts={acts} v={v} />
      {condsFirst && <Conds title={t('ac.crime.req.title')} items={reqs} />}

      <Section title={t('n.act.crime.stakes')} />
      <Stats>
        {v.hits_np_cs && v.max_take > 0 && <Stat icon="x_cash" label={t('ac.crime.d.take')} value={range(cash(v.min_take), cash(v.max_take))} tone="lit" />}
        <Stat icon="handcuffs" label={t('ac.crime.d.jail')} value={range(roughDuration(v.jail_min_seconds), roughDuration(v.jail_max_seconds))} tone="bad" />
        <Stat icon="f_gavel" label={t('ac.crime.d.fine')} value={range(cash(v.fine_min), cash(v.fine_max))} />
        {v.cooldown_seconds > 0 && <Stat icon="sleepy" label={t('ac.crime.d.cooldown')} value={roughDuration(v.cooldown_seconds)} />}
      </Stats>
      {hits && <KV label={t('ac.crime.d.victims')} value={hits} />}

      {odds.length > 0 && (
        <>
          <Section title={t('ac.crime.odds.title')} />
          <List>{odds.map(([k, x]) => <Row key={k} icon={ODDS_ICON[k]} title={t(`ac.crime.odds.${k}`)} end={<Chip tone={k === 'base' ? undefined : x > 0 ? 'ok' : 'bad'}><span className="n-ltr">{k === 'base' ? pctOf(x) : signedPct(x)}</span></Chip>} />)}</List>
        </>
      )}
      {gear.length > 0 && (
        <>
          <Section title={t('ac.crime.gear.title')} />
          <div className="n-chips">{gear.map(([k, x]) => <Chip key={k} tone={(k === 'reward' ? x > 0 : x < 0) ? 'ok' : 'bad'}>{tk(`lf.gear.${k}`, k)} <span className="n-ltr">{signedPct(x)}</span></Chip>)}</div>
        </>
      )}
      {!condsFirst && <Conds title={t('ac.crime.req.title')} items={reqs} />}
      <MoreActs acts={acts} list={acts.rest(['crime.commit'])} />
    </ActPage>
  )
}
const ODDS_ICON: Record<string, string> = { base: 'crime', skill: 'study', awareness: 'eye', heat: 'heat', gear: 'm_backpack' }

// -- results ---------------------------------------------------------------------------------------------------

export function CrimeResult({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as CrimeResultView | undefined
  if (!v) return <NoView title={t('crime.result_title')} loading={loading} />
  const { names } = acts
  const out = v.result === 'succeeded' || v.result === 'caught' ? v.result : 'escaped'
  const crime = crimeName(names, v.crime)
  const where = [venueName(names, v.venue), cityName(names, v.city_code, v.city)].filter(Boolean).join(`${t('common.sep')} `)
  const again = acts.find('crime.again')
  const jail = acts.find('crime.jail')
  const hospital = acts.find('health.hospital')
  const lead = hospital ?? jail ?? again
  const xpChips = <>
    {v.xp > 0 && <Chip tone="cyan"><Icon name="x_star" size={18} />{t('crime.xp', { n: n(v.xp) })}</Chip>}
    {v.criminal_xp > 0 && <Chip tone="bad">{t('crime.criminal_xp', { n: n(v.criminal_xp) })}</Chip>}
    {v.level > 0 && <Chip tone="solid">{t('crime.level_up', { n: n(v.level) })}</Chip>}
  </>
  return (
    <ActPage title={t('crime.result_title')} response={response}>
      {out === 'succeeded' && <ResultHero art="x_cash" kicker={t('crime.result.succeeded')} big={v.take > 0 ? <MoneyBig amount={v.take} sign="+" /> : crime} sub={t('ac.crime.res.lead.succeeded', { crime })} chips={xpChips} />}
      {out === 'escaped' && <ResultHero tone="plain" art="x_sprint" kicker={t('crime.result.escaped')} big={crime} sub={t('ac.crime.res.lead.escaped', { crime })} chips={xpChips} />}
      {out === 'caught' && <ResultHero tone="loss" art="handcuffs" kicker={t('crime.result.caught')} big={v.jail ? hms(v.jail.remaining_seconds) : crime} sub={t('ac.crime.res.lead.caught', { crime })} chips={xpChips} />}

      {where && <KV label={t('n.act.crime.where')} value={where} />}
      {v.dry_spell && <Note icon="clock">{t('crime.dry')}</Note>}
      {v.victim_player && out === 'succeeded' && <Note tone="info" icon="person">{t('ac.crime.res.victim_player')}</Note>}

      {((v.loot ?? []).length > 0 || v.stolen) && (
        <>
          <Section title={t('ac.crime.res.loot')} />
          <List>
            {(v.loot ?? []).map((l) => <Row key={l.item.code} icon="x_chest" title={names.name('item', l.item.code, l.item.name)} end={<Chip tone="accent">{t('ac.crime.res.times', { n: n(l.qty) })}</Chip>} />)}
            {v.stolen && <Row icon="m_hand" title={names.name('item', v.stolen.code, v.stolen.name)} sub={t('ac.crime.res.stolen')} />}
          </List>
        </>
      )}

      {out === 'caught' && v.fine > 0 && <KV label={t('ac.crime.res.fine')} value={v.fine_paid > 0 ? `${cash(v.fine)} – ${t('ac.crime.res.fine_paid')} ${cash(v.fine_paid)}` : cash(v.fine)} />}
      {(v.confiscated ?? []).length > 0 && (
        <Note tone="bad" icon="m_backpack">{t('ac.crime.res.confiscated')} {(v.confiscated ?? []).map((c) => names.name('item', c.code, c.name)).join(`${t('common.sep')} `)}</Note>
      )}
      {v.injury && (
        <Note tone="bad" icon="hospital">
          {t('ac.crime.res.injury_text', { n: n(v.injury.damage) })} {t('hospital.health', { a: n(v.injury.health), b: n(v.injury.max) })}
          {v.injury.hospital && <><br />{v.injury.ends_at ? t('ac.crime.res.admitted_until', { at: atText(v.injury.ends_at) }) : t('ac.crime.res.admitted')}</>}
        </Note>
      )}
      <Gains names={names} list={v.skills} />
      <Gauges nerve={v.nerve} heat={v.heat} names={names} />
      {lead && <Button block kind={lead === again ? 'primary' : 'primary'} icon={lead === hospital ? 'hospital' : lead === jail ? 'handcuffs' : 'crime'} onClick={() => nav.act(lead)}>{acts.label(lead)}</Button>}
      <MoreActs acts={acts} list={acts.all.filter((a) => a !== lead)} />
    </ActPage>
  )
}

export function CrimeStarted({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as CrimeStartedView | undefined
  const now = useServerNow()
  if (!v) return <NoView title={t('crime.started')} loading={loading} />
  const { names } = acts
  const crime = crimeName(names, v.crime)
  const left = v.ends_at ? Math.max(0, Math.round((Date.parse(v.ends_at) - now) / 1000)) : 0
  return (
    <ActPage title={t('crime.started')} response={response}>
      <ResultHero tone="plain" art={crimeIcon(v.crime.code)} kicker={t('crime.started')} big={crime} sub={t('ac.crime.started.lead', { crime, place: venueName(names, v.venue) })} />
      <Now icon="stopwatch" lit title={crime} sub={v.ends_at ? `${t('ac.crime.started.ends')} ${atText(v.ends_at)}` : roughDuration(v.duration_seconds)}
        time={v.ends_at ? hms(left) : roughDuration(v.duration_seconds)} frac={v.ends_at && v.duration_seconds ? 1 - left / v.duration_seconds : undefined} />
      <Note tone="info" icon="eye">{t('crime.result_later')}</Note>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export function CrimeRecord({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as CrimeRecordView | undefined
  const now = useServerNow()
  if (!v) return <NoView title={t('screen.crime_record')} loading={loading} />
  const { names } = acts
  const recent = v.recent ?? []
  const RES: Record<string, 'ok' | 'warn' | 'bad'> = { succeeded: 'ok', escaped: 'warn', caught: 'bad' }
  return (
    <ActPage title={t('screen.crime_record')} response={response}>
      <Strip items={[
        { label: t('ac.crime.rec.attempts'), value: n(v.attempts) },
        { label: v.attempts ? `${t('ac.crime.rec.successes')} – ${pctOf(Math.round((v.successes / v.attempts) * 100) * 100)}` : t('ac.crime.rec.successes'), value: n(v.successes) },
        { label: t('ac.crime.rec.arrests'), value: n(v.arrests) },
      ]} />
      <Stats>
        <Stat icon="f_gavel" label={t('ac.crime.rec.convictions')} value={n(v.convictions)} tone={v.convictions ? 'bad' : undefined} />
        <Stat icon="x_ninja" label={t('n.act.crime.tier')} value={tierName(names, v.tier.tier)} />
      </Stats>
      <Gauges nerve={v.nerve} heat={v.heat} tier={v.tier} names={names} />
      {(v.unpaid_restitution > 0 || v.unpaid_fines > 0) && (
        <Note tone="bad" icon="f_scales">
          {t('ac.crime.rec.unpaid')}{' '}
          {[v.unpaid_restitution > 0 ? `${t('ac.crime.rec.restitution')} ${cash(v.unpaid_restitution)}` : '', v.unpaid_fines > 0 ? `${t('ac.crime.rec.fines')} ${cash(v.unpaid_fines)}` : ''].filter(Boolean).join(`${t('common.sep')} `)}
        </Note>
      )}
      <Section title={t('ac.crime.rec.recent')} />
      {recent.length === 0 ? <Empty icon="crime">{t('ac.crime.rec.none')}</Empty> : (
        <List>
          {recent.map((l, i) => (
            <Row key={i} icon={crimeIcon(l.crime.code)} title={crimeName(names, l.crime)} sub={l.at ? t('common.ago', { t: roughDuration((now - Date.parse(l.at)) / 1000) }) : undefined}
              end={<Chip tone={RES[l.result]}>{tk(`crime.result.${l.result}`, l.result)}</Chip>} />
          ))}
        </List>
      )}
      <MoreActs acts={acts} list={acts.rest(['crime.hub'])} />
    </ActPage>
  )
}

// -- jail ------------------------------------------------------------------------------------------------------

export function Jail({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as JailView | undefined
  if (!v) return <NoView title={t('screen.jail')} loading={loading} />
  const { names } = acts
  if (!v.in_jail) {
    return (
      <ActPage title={t('screen.jail')} response={response}>
        <ResultHero art="x_sparkles" big={t('ac.crime.jail.free')} />
        <MoreActs acts={acts} list={acts.all} />
      </ActPage>
    )
  }
  return (
    <ActPage title={t('screen.jail')} response={response}>
      <ResultHero tone="loss" art="handcuffs" kicker={t('ac.crime.jail.left')} big={hms(v.remaining_seconds)}
        sub={t('ac.crime.jail.lead', { city: cityName(names, v.city_code, v.city) })}
        chips={<>
          {v.reason && <Chip tone="bad">{tk(`ac.crime.jail.${v.reason}`, v.reason)}</Chip>}
          {v.ends_at && <Chip><Icon name="clock" size={18} />{t('ac.crime.jail.ends')} {atText(v.ends_at)}</Chip>}
        </>} />
      {v.payment && (
        <>
          <Section title={t('ac.crime.jail.bail_title')} />
          <Note tone="info" icon="x_cash">{t('ac.crime.jail.bail_hint')}</Note>
          <PayBox payment={v.payment} acts={acts} title={t('ac.crime.jail.bail')} />
        </>
      )}
      <MoreActs acts={acts} list={acts.all.filter((a) => !idOf(a).startsWith('pay.'))} />
    </ActPage>
  )
}

export function Bailed({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as BailedView | undefined
  if (!v) return <NoView title={t('ac.crime.bailed.title')} loading={loading} />
  return (
    <ActPage title={t('ac.crime.bailed.title')} response={response}>
      <ResultHero art="keys" kicker={t('ac.crime.bailed.title')} big={<MoneyBig amount={v.bail} />}
        sub={t('ac.crime.bailed.lead', { amount: cash(v.bail), method: tk(`ac.crime.method.${v.method}`, t('ac.crime.method.other')) })} />
      <Note icon="heat">{t('ac.crime.bailed.hint')}</Note>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export const CRIME = {
  crime_hub: CrimeHub, crime_list: CrimeList, crime_detail: CrimeDetail, crime_result: CrimeResult, crime_started: CrimeStarted, crime_record: CrimeRecord,
  jail: Jail, bailed: Bailed,
}
