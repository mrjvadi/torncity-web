// Work in the new UI: my job (the shift, the promotion), the openings, one opening, the town's work board (work.home)
// and the results of applying, a shift and a promotion.

import { useState } from 'react'
import type { NScreenProps } from '../../registry'
import type {
  JobDetailView, JobHiredView, JobOpeningsView, JobPromotedView, JobQuitView, JobRef, JobStatusView, Requirement, ShiftStartedView, ShiftWorkedView,
  SkillGain, WorkHomeView,
} from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Card, Chip, Empty, Icon, List, Meter, Note, Now, Row, Rows, Section, Stat, Stats, Tile, Tiles } from '../../ui'
import { t } from '../../../i18n'
import { hms, roughDuration } from '../../../screens/native/kit/format'
import { atText } from '../../../lib/duration'
import { useServerNow } from '../../../lib/ticker'
import { buildingName, useBuildingCatalogue, useVillageCommand } from '../../../village/useVillage'
import { useToast } from '../../../state/ToastContext'
import {
  ActPage, MoneyBig, TapCard, cash, plus, Conds, MoreActs, NoView, Pager, ResultHero, ThingHero, cityName, idOf, n, pctOf, tk, tripText, useActs, type ContentNames, type Cond,
} from './common'

// -- names and looks -------------------------------------------------------------------------------------------

const CAREER_ICON: Record<string, string> = {
  retail: 'market', hospitality: 'm_meal', logistics: 'box', workshop: 'factory', technology: 'gears', healthcare: 'stetho', finance: 'bank',
  farmhand: 'x_sprout', clerk: 'quill',
}
export const careerIcon = (code: string) => CAREER_ICON[code] ?? 'work'
export const tierName = (names: ContentNames, j: JobRef) => names.name('career_tier', `${j.career_code}.${j.rank}`, j.title)
export const careerName = (names: ContentNames, j: JobRef) => names.name('career', j.career_code, j.career_name)
const skillName = (names: ContentNames, code: string) => names.name('skill', code, code)

/** A condition of a job, a promotion or a course, in words (the catalogue names the skill, course and city). */
export function reqCond(names: ContentNames, r: Requirement): Cond {
  const p = {
    need: n(r.need), have: n(r.have), skill: skillName(names, r.skill), course: names.name('course', r.course_code, r.course_name),
    city: cityName(names, r.city_code, r.city), t: hms(r.wait_seconds),
  }
  const text = r.met
    ? tk(`lf.req.${r.kind}_met`, '', p) || tk(`ac.work.req.${r.kind}_met`, '', p) || tk(`lf.req.${r.kind}`, t('ac.work.req.other'), p)
    : tk(`lf.req.${r.kind}`, t('ac.work.req.other'), p)
  const sub = [!r.met && r.until ? t('ac.work.req.until', { at: atText(r.until) }) : '', !r.met && r.trip ? tripText(r.trip, roughDuration) : ''].filter(Boolean).join(' – ')
  return { met: r.met, text, sub: sub || undefined }
}

const gainText = (names: ContentNames, g: SkillGain) => (g.level > 0
  ? t('ac.work.skill_level', { skill: skillName(names, g.skill), xp: n(g.xp), n: n(g.level) })
  : t('ac.work.skill_gain', { skill: skillName(names, g.skill), xp: n(g.xp) }))

/** The skills a shift or a course taught, one row each. */
export function Gains({ names, list }: { names: ContentNames; list: SkillGain[] | null }) {
  if (!list?.length) return null
  return (
    <>
      <Section title={t('n.act.learned')} />
      <List>{list.map((g) => <Row key={g.skill} icon={g.level > 0 ? 'rank' : 'study'} title={skillName(names, g.skill)} sub={gainText(names, g)}
        end={<Chip tone={g.level > 0 ? 'accent' : 'cyan'}>{plus(n(g.xp))}</Chip>} />)}</List>
    </>
  )
}

/** Seconds until an instant, on the server's clock (re-rendered every second). */
function useLeft(at: string | null): number {
  const now = useServerNow()
  return at ? Math.max(0, Math.round((Date.parse(at) - now) / 1000)) : 0
}

// -- my job ----------------------------------------------------------------------------------------------------

export function JobStatus({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as JobStatusView | undefined
  if (!v) return <NoView title={t('job.title')} loading={loading} />
  const { names } = acts
  const work = acts.find('job.work')
  const promote = acts.find('job.promote')

  if (!v.employed) {
    const openings = acts.find('job.openings')
    return (
      <ActPage title={t('job.title')} response={response}>
        <ResultHero tone="plain" art="work" kicker={t('job.title')} big={t('job.none')} sub={t('n.act.job.none_sub')} />
        {openings && <Button block icon="m_search" onClick={() => nav.act(openings)}>{acts.label(openings)}</Button>}
        <MoreActs acts={acts} list={acts.rest(['job.openings'])} />
      </ActPage>
    )
  }

  const city = cityName(names, v.city_code, v.city)
  const shift = v.shift
  const frac = shift && v.shift_length_seconds ? 1 - shift.remaining_seconds / v.shift_length_seconds : undefined
  return (
    <ActPage title={t('job.title')} response={response}>
      <ThingHero art={careerIcon(v.job.career_code)} kicker={[careerName(names, v.job), v.employer || city].filter(Boolean).join(' – ')} title={tierName(names, v.job)}
        chips={<>
          <Chip tone="accent"><Icon name="coins" size={18} />{t('job.per_shift', { pay: cash(v.pay) })}</Chip>
          {v.energy_cost > 0 && <Chip><Icon name="energy" size={18} />{t('n.act.energy_cost', { n: n(v.energy_cost) })}</Chip>}
          {v.shift_length_seconds > 0 && <Chip><Icon name="clock" size={18} />{roughDuration(v.shift_length_seconds)}</Chip>}
        </>}>
        {!shift && work && <div className="n-hero-foot"><Button block icon="work" onClick={() => nav.act(work)}>{acts.label(work)}</Button></div>}
      </ThingHero>

      {shift && <Now icon="work" lit title={t('n.act.job.on_shift')} sub={v.workplace?.name || city} time={hms(shift.remaining_seconds)} frac={frac} />}
      {!shift && !v.at_workplace && <Note tone="bad" icon="x_map">{t('ac.work.status.elsewhere', { city })}</Note>}
      {!shift && v.at_workplace && v.walk_to_work_seconds > 0 && <Note tone="info" icon="walk">{t('job.walk_to', { t: hms(v.walk_to_work_seconds), place: v.workplace?.name ?? '' })}</Note>}

      <Card>
        <Meter thick tone="accent" frac={v.performance / 100} label={t('job.performance')} value={n(v.performance)} />
      </Card>
      <Stats>
        <Stat icon="x_cash" label={t('n.act.job.earned')} value={cash(v.total_earned)} tone="lit" />
        <Stat icon="checklist" label={t('n.act.job.shifts_here')} value={n(v.shifts_in_tier)} />
      </Stats>

      {!v.top_tier ? (
        <>
          <Section title={t('n.act.job.next')} />
          <Card tone={v.promotion_ready ? 'lit' : undefined}>
            <div className="n-act-next">
              <Icon name="rank" size={44} />
              <div>
                <p className="n-act-next-title">{tierName(names, v.next)}</p>
                <p className="n-label">{v.promotion_ready ? t('job.promo_ready') : t('job.next_rank')}</p>
              </div>
            </div>
            {promote && <div className="n-act-gap"><Button kind="cyan" block icon="rank" onClick={() => nav.act(promote)}>{acts.label(promote)}</Button></div>}
          </Card>
          <Conds title={t('ac.work.detail.reqs')} items={(v.missing ?? []).map((r) => reqCond(names, r))} />
        </>
      ) : <Note tone="ok" icon="x_crown">{t('lf.req.top')}</Note>}

      <MoreActs acts={acts} list={acts.rest(['job.work', 'job.promote'])} />
    </ActPage>
  )
}

// -- openings --------------------------------------------------------------------------------------------------

export function JobOpenings({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as JobOpeningsView | undefined
  if (!v) return <NoView title={t('ac.work.openings.title')} loading={loading} />
  const { names } = acts
  const city = cityName(names, v.city_code, v.city)
  const openings = v.openings ?? []
  const companies = v.companies ?? []
  const gaps = v.gaps ?? []
  const mine = acts.find('job.mine')
  const pay = (p: number, ok: boolean) => (
    <><Chip tone={ok ? 'accent' : undefined}>{cash(p)}</Chip><small>{ok ? t('ac.work.openings.open') : t('ac.work.openings.locked')}</small></>
  )
  return (
    <ActPage title={t('ac.work.openings.title')} sub={city ? t('ac.work.openings.city', { city }) : undefined} response={response}>
      {v.travelling && <Note tone="info" icon="plane">{t('ac.work.openings.travelling')}</Note>}
      {v.employed && !v.travelling && (
        <TapCard onClick={() => (mine ? nav.act(mine) : nav.run('job.status'))}>
          <div className="n-act-next">
            <Icon name={careerIcon(v.current.career_code)} size={44} />
            <div><p className="n-act-next-title">{tierName(names, v.current)}</p><p className="n-label">{t('n.act.job.must_quit')}</p></div>
          </div>
        </TapCard>
      )}

      {openings.length > 0 && (
        <>
          <Section title={t('ac.work.openings.base', { city })} note={t('n.act.pay_note')} />
          <Rows>
            {openings.map((o) => {
              const go = acts.of('job.opening', o.job.career_code)
              return <Row key={`${o.job.career_code}.${o.job.rank}`} icon={o.eligible ? careerIcon(o.job.career_code) : 'm_lock'} title={tierName(names, o.job)} sub={careerName(names, o.job)}
                end={pay(o.pay, o.eligible)} onClick={go ? () => nav.act(go) : undefined} />
            })}
          </Rows>
        </>
      )}

      {companies.length > 0 && (
        <>
          <Section title={t('ac.work.openings.companies')} />
          <Rows>
            {companies.map((o) => {
              const go = acts.find('company.opening', (a) => a.args?.no === String(o.no))
              return <Row key={o.no} icon={o.eligible ? 'factory' : 'm_lock'} title={tierName(names, o.job)} sub={o.company} end={pay(o.pay, o.eligible)} onClick={go ? () => nav.act(go) : undefined} />
            })}
          </Rows>
        </>
      )}

      {gaps.length > 0 && (
        <>
          <Section title={t('ac.work.openings.not_here', { city })} />
          <Rows>
            {gaps.map((g) => {
              const near = g.nearest ? cityName(names, g.nearest.code, g.nearest.name) : ''
              const needs = (g.needs ?? []).map((x) => needText(names, x)).filter(Boolean)
              return (
                <Row key={g.job.career_code} icon="x_map" title={careerName(names, g.job)}
                  sub={[near ? t('ac.work.openings.had_in', { place: near }) : '', tripText(g.nearest_trip, roughDuration), ...needs].filter(Boolean).join(' – ')}
                  end={near && g.nearest ? <Button kind="ghost" small onClick={() => nav.run('travel.options', { city: g.nearest!.code })}>{t('n.act.go')}</Button> : undefined} />
              )
            })}
          </Rows>
        </>
      )}

      {!v.travelling && openings.length === 0 && companies.length === 0 && <Empty icon="m_search">{t('ac.work.openings.empty', { city })}<br />{t('ac.work.openings.empty_hint')}</Empty>}
      <Pager acts={acts} page={v.page} pages={v.pages} />
      <MoreActs acts={acts} list={acts.rest(['job.opening', 'company.opening', 'job.mine', 'page.prev', 'page.next'])} />
    </ActPage>
  )
}

/** What a place lacks for a job or a course it does not have (research, a building, a teacher). */
export function needText(names: ContentNames, x: { kind: string; code: string; name: string; role: string }): string {
  switch (x.kind) {
    case 'knowledge': return t('education.gap.need.knowledge', { name: names.name('knowledge', x.code, x.name || x.code) })
    case 'building': return t('education.gap.need.building', { name: x.code ? names.name(['settlement_building', 'building'], x.code, x.name || x.code) : names.name('building_role', x.role, x.role) })
    case 'teacher': return x.role ? t('education.gap.need.teacher', { name: names.name('building_role', x.role, x.role) }) : t('education.gap.need.teacher_post')
    default: return ''
  }
}

// -- one opening -----------------------------------------------------------------------------------------------

export function JobDetail({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as JobDetailView | undefined
  if (!v) return <NoView title={t('ac.work.openings.title')} loading={loading} />
  const { names } = acts
  const apply = acts.find('job.apply')
  const reqs = (v.requirements ?? []).map((r) => reqCond(names, r))
  return (
    <ActPage title={tierName(names, v.job)} response={response}>
      <ThingHero art={careerIcon(v.job.career_code)} kicker={[careerName(names, v.job), cityName(names, v.city_code, v.city)].filter(Boolean).join(' – ')} title={tierName(names, v.job)} />
      <Stats>
        <Stat icon="coins" label={t('ac.work.detail.pay')} value={cash(v.pay)} tone="lit" />
        <Stat icon="energy" label={t('ac.work.detail.energy')} value={n(v.energy_cost)} />
      </Stats>
      {reqs.length > 0 ? <Conds title={t('ac.work.detail.reqs')} items={reqs} /> : <Note tone="ok" icon="m_check">{t('ac.work.detail.no_reqs')}</Note>}
      {v.employed && <Note tone="bad" icon="work">{t('ac.work.detail.employed')}</Note>}
      {!v.can_apply && !v.employed && <Note icon="m_lock">{t('ac.work.detail.locked')}</Note>}
      {apply && <Button block icon="m_brief" onClick={() => nav.act(apply)}>{acts.label(apply)}</Button>}
      <MoreActs acts={acts} list={acts.rest(['job.apply'])} />
    </ActPage>
  )
}

// -- results ---------------------------------------------------------------------------------------------------

export function JobHired({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as JobHiredView | undefined
  if (!v) return <NoView title={t('ac.work.hired.title')} loading={loading} />
  const { names } = acts
  const work = acts.find('job.work')
  return (
    <ActPage title={t('ac.work.hired.title')} response={response}>
      <ResultHero art={careerIcon(v.job.career_code)} kicker={t('ac.work.hired.title')} big={tierName(names, v.job)}
        sub={v.employer || cityName(names, v.city_code, v.city)}
        chips={<Chip tone="accent"><Icon name="coins" size={18} />{t('job.per_shift', { pay: cash(v.pay) })}</Chip>} />
      {work && <Button block icon="work" onClick={() => nav.act(work)}>{acts.label(work)}</Button>}
      <MoreActs acts={acts} list={acts.rest(['job.work'])} />
    </ActPage>
  )
}

const fatigue = (bp: number) => (bp >= 10000 ? t('ac.work.fatigue_ok') : t('ac.work.fatigue_tired', { p: pctOf(bp) }))

export function ShiftStarted({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as ShiftStartedView | undefined
  const left = useLeft(v?.ends_at ?? null)
  if (!v) return <NoView title={t('ac.work.started.title')} loading={loading} />
  const { names } = acts
  return (
    <ActPage title={t('ac.work.started.title')} response={response}>
      <ResultHero tone="plain" art="work" kicker={t('ac.work.started.title')} big={tierName(names, v.job)} sub={t('ac.work.started.lead', { title: tierName(names, v.job) })} />
      <Now icon="stopwatch" lit title={t('n.act.job.on_shift')} sub={v.ends_at ? `${t('ac.work.started.ends')} ${atText(v.ends_at)}` : roughDuration(v.duration_seconds)}
        time={v.ends_at ? hms(left) : roughDuration(v.duration_seconds)} frac={v.ends_at && v.duration_seconds ? 1 - left / v.duration_seconds : undefined} />
      <Note tone={v.fatigue_bps >= 10000 ? 'ok' : 'bad'} icon={v.fatigue_bps >= 10000 ? 'x_muscle' : 'sleepy'}>{fatigue(v.fatigue_bps)}</Note>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export function ShiftWorked({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as ShiftWorkedView | undefined
  if (!v) return <NoView title={t('ac.work.worked.title')} loading={loading} />
  const { names } = acts
  const d = v.performance_delta
  const again = acts.find('job.work_again')
  const hospital = acts.find('health.hospital')
  const lead = again ?? hospital
  return (
    <ActPage title={t('ac.work.worked.title')} response={response}>
      <ResultHero art="x_cash" kicker={t('ac.work.worked.net')} big={<MoneyBig amount={v.net} sign="+" />} sub={t('ac.work.worked.lead')}
        chips={<>
          {v.xp > 0 && <Chip tone="cyan"><Icon name="x_star" size={18} />{t('crime.xp', { n: n(v.xp) })}</Chip>}
          <Chip tone={d > 0 ? 'ok' : d < 0 ? 'bad' : undefined}>{d > 0 ? t('ac.work.worked.perf_up', { n: n(d) }) : d < 0 ? t('ac.work.worked.perf_down', { n: n(-d) }) : t('ac.work.worked.perf_same')}</Chip>
          {v.level > 0 && <Chip tone="solid">{t('ac.work.worked.level_up', { n: n(v.level) })}</Chip>}
        </>} />
      <Stats three>
        <Stat label={t('ac.work.worked.gross')} value={cash(v.gross)} />
        <Stat label={t('ac.work.worked.tax')} value={cash(v.tax)} />
        <Stat label={t('ac.work.worked.performance')} value={n(v.performance)} />
      </Stats>
      {v.fatigue_bps < 10000 && <Note icon="sleepy">{fatigue(v.fatigue_bps)}</Note>}
      {v.injury && (
        <Note tone="bad" icon="hospital">
          <b>{t('ac.work.injury.title')}</b> {t('ac.crime.res.injury_text', { n: n(v.injury.damage) })} {t('hospital.health', { a: n(v.injury.health), b: n(v.injury.max) })}
          {v.injury.hospital && <><br />{v.injury.ends_at ? t('ac.crime.res.admitted_until', { at: atText(v.injury.ends_at) }) : t('ac.work.injury.hospital')}</>}
        </Note>
      )}
      <Gains names={names} list={v.skills} />
      {lead && <Button block icon={lead === hospital ? 'hospital' : 'work'} onClick={() => nav.act(lead)}>{acts.label(lead)}</Button>}
      <MoreActs acts={acts} list={acts.all.filter((a) => a !== lead)} />
    </ActPage>
  )
}

export function JobPromoted({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as JobPromotedView | undefined
  if (!v) return <NoView title={t('ac.work.promoted.title')} loading={loading} />
  const { names } = acts
  return (
    <ActPage title={t('ac.work.promoted.title')} response={response}>
      <ResultHero art="rank" kicker={t('ac.work.promoted.title')} big={tierName(names, v.job)} sub={careerName(names, v.job)}
        chips={<Chip tone="accent"><Icon name="coins" size={18} />{t('job.per_shift', { pay: cash(v.pay) })}</Chip>} />
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

/** Before a resignation: the job, what it costs, a red button (this screen is the question, so it does not ask again). */
export function JobQuitConfirm({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as JobQuitView | undefined
  if (!v) return <NoView title={t('ac.work.quit.title')} loading={loading} />
  const yes = acts.find('job.quit_confirm')
  return (
    <ActPage title={t('ac.work.quit.title')} response={response}>
      <ResultHero tone="loss" art="m_stop" kicker={t('ac.work.quit.title')} big={tierName(acts.names, v.job)} sub={t('ac.work.quit.ask', { title: tierName(acts.names, v.job) })} />
      <Buttons lead>
        {yes && <Button kind="danger" onClick={() => nav.act({ ...yes, kind: 'secondary' })}>{t('ac.work.quit.yes')}</Button>}
        <Button kind="ghost" onClick={nav.back}>{t('common.cancel')}</Button>
      </Buttons>
    </ActPage>
  )
}

export function JobQuit({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as JobQuitView | undefined
  if (!v) return <NoView title={t('ac.work.quit.done_title')} loading={loading} />
  return (
    <ActPage title={t('ac.work.quit.done_title')} response={response}>
      <ResultHero tone="plain" art="m_brief" kicker={t('ac.work.quit.done_title')} big={tierName(acts.names, v.job)} sub={t('ac.work.quit.done', { title: tierName(acts.names, v.job) })} />
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

// -- the town's work (work.home) --------------------------------------------------------------------------------

export function WorkHome({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const acts = useActs(response)
  const cmd = useVillageCommand()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [roads, setRoads] = useState(false)
  const v = response?.view as WorkHomeView | undefined
  const left = useLeft(v?.working?.finish_at ?? null)
  if (!v) return <NoView title={t('job.title')} loading={loading} />
  const { names } = acts
  const bname = (b: { code: string; name: string }) => buildingName(cat, b.code, b.name)

  const take = async (command: string, id: string) => {
    if (busy) return
    setBusy(true)
    const r = await cmd(command, { id }, { write: true })
    setBusy(false)
    if (r.ok) { toast.push(t('labor.just.worked'), { kind: 'success' }); nav.reload() }
  }

  const all = v.jobs ?? []
  const road = all.filter((j) => j.building.code === 'road')
  const grouped = road.length >= 3
  const jobs = grouped ? all.filter((j) => j.building.code !== 'road') : all
  const best = road.filter((j) => j.can_take).sort((a, b) => b.wage - a.wage)[0]
  const places = v.workplaces ?? []
  const off = busy || !!v.working

  const JobRow = ({ j }: { j: (typeof all)[number] }) => (
    <Row icon={j.kind === 'construction' ? 'house' : 'factory'} title={bname(j.building)}
      sub={[j.kind === 'construction' ? t('labor.job.site', { x: n(j.lot_x), y: n(j.lot_y), p: n(Math.floor(j.progress_bps / 100)) }) : t('labor.job.production'),
        j.employer_kind === 'player' ? t('labor.employer.player', { name: j.employer }) : t('labor.employer.village'), t('labor.shifts_left', { n: n(j.left) }),
        !j.can_take ? t('work.not_here') : ''].filter(Boolean).join(' – ')}
      end={j.can_take ? <Button kind="cyan" small disabled={off} onClick={() => void take('settlement.labor.take', j.id)}>{plus(cash(j.wage))}</Button> : <Chip>{cash(j.wage)}</Chip>} />
  )

  return (
    <ActPage title={t('job.title')} sub={v.place?.name} response={response}>
      {v.working
        ? <Now icon="work" lit title={bname(v.working.building)} sub={t('n.act.job.on_shift')} time={hms(left)} />
        : v.empty !== 'no_settlement' && <Note tone="info" icon="clock">{t('work.idle')}</Note>}

      {v.empty && v.empty !== 'no_settlement' && (
        <Note icon="x_wanted">{tk(`work.empty.${v.empty}`, v.empty)}{v.next && <><br />{tk(`work.next.${v.next}`)}</>}</Note>
      )}
      {v.empty === 'no_settlement' && <Note tone="info" icon="work">{t('work.empty.no_settlement')}</Note>}

      <Tiles>
        <Tile icon="work" title={t('work.career')} onClick={() => nav.run('job.status')} />
        <Tile icon="m_search" title={t('ac.work.openings.title')} onClick={() => nav.run('job.list')} />
        {v.empty !== 'no_settlement' && <Tile icon="checklist" title={t('labor.btn.board')} onClick={() => nav.run('settlement.labor.board')} />}
        {v.empty !== 'no_settlement' && <Tile icon="m_brief" title={t('labor.btn.mine')} onClick={() => nav.run('settlement.labor.mine')} />}
      </Tiles>

      {places.length > 0 && (
        <>
          <Section title={t('work.workplaces')} note={t('ac.work.of', { a: n(v.energy), b: n(v.max_energy) }) + ' ' + t('ac.work.energy')} />
          <Rows>
            {places.map((w) => {
              const full = w.busy >= w.workers
              const makes = (w.produces ?? []).map((m) => `${n(m.quantity)} ${names.name(['component', 'item'], m.component.code, m.component.name)}`).join(t('common.sep') + ' ')
              const can = !off && w.ready && !full && v.resident
              return (
                <Row key={w.id} icon="factory" title={bname(w.building)}
                  sub={[makes && t('work.makes', { list: makes }), t('work.shift_len', { t: roughDuration(w.shift_seconds) }), !w.ready ? t('work.needs_inputs') : full ? t('work.full') : ''].filter(Boolean).join(' – ')}
                  end={<Button kind="cyan" small disabled={!can} onClick={() => void take('settlement.work', w.id)}>{plus(cash(w.wage))}</Button>} />
              )
            })}
          </Rows>
        </>
      )}

      {(jobs.length > 0 || grouped) && <Section title={t('work.jobs')} note={t('n.act.pay_note')} />}
      {grouped && (
        <Card>
          <div className="n-act-next">
            <Icon name="x_map" size={44} />
            <div>
              <p className="n-act-next-title">{t('work.road_group', { n: n(road.length) })}</p>
              <p className="n-label">{best ? t('work.road_best', { w: cash(best.wage) }) : t('work.full')}</p>
            </div>
          </div>
          <p className="n-act-small">{t('work.road_hint')}</p>
          <Buttons>
            {best && <Button kind="cyan" small disabled={off} onClick={() => void take('settlement.labor.take', best.id)}>{t('labor.work', { w: cash(best.wage) })}</Button>}
            <Button kind="ghost" small onClick={() => setRoads((o) => !o)}>{roads ? t('work.road_hide') : t('work.road_show')}</Button>
          </Buttons>
        </Card>
      )}
      {grouped && roads && <List>{road.map((j) => <JobRow key={j.id} j={j} />)}</List>}
      {jobs.length > 0 && <List>{jobs.map((j) => <JobRow key={j.id} j={j} />)}</List>}
      <MoreActs acts={acts} list={acts.all.filter((a) => !['settlement.labor.take', 'settlement.work'].includes(idOf(a)))} />
    </ActPage>
  )
}

export const WORK = {
  job_status: JobStatus, job_openings: JobOpenings, job_detail: JobDetail, job_hired: JobHired, shift_started: ShiftStarted, shift_worked: ShiftWorked,
  job_promoted: JobPromoted, job_quit_confirm: JobQuitConfirm, job_quit: JobQuit, work_home: WorkHome,
}
