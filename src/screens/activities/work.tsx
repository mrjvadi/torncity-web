// Screens of the activities area: work, study and skills. Neutral views only (docs/adr/0039-presentation-split.md):
// the server sends codes, numbers and times; the words are the web's own and every name comes from the catalogue.

import type {
  CourseCompletedView, CourseDetailView, EnrolledView, JobDetailView, JobHiredView, JobOpeningsView, JobPromotedView, JobQuitView, JobRef,
  Requirement, ShiftStartedView, ShiftWorkedView, SkillGain, SkillsView,
} from '../../api/views.gen'
import type { Action } from '../../api/types'
import { Bar, Card, ListRow, SectionTitle } from '../native/kit/Parts'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { Lines, Need } from '../native/kit/cardparts'
import { needLines, tripLine } from '../native/kit/needs'
import { clamp01, hms, money, roughDuration } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, {
  ActionButton, ActionRow, CostSummary, EffectChip, EffectRow, Hero, Medallion, Note, RequirementList, StatCard, StatGrid, Unavailable,
  type RequirementLine,
} from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { registerLabeler } from '../village/wording'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, flow, isBack, isRefresh, registerWrites } from '../village/flow'
import type { FlowCtx } from '../village/flow'
import { bps, cityName, clockText, tx } from '../life/common'

// -- names: the catalogue's, by code ------------------------------------------------------------------------

const tierName = (ctx: Pick<FlowCtx, 'names'>, j: JobRef) => ctx.names.name('career_tier', `${j.career_code}.${j.rank}`, j.title)
const careerName = (ctx: Pick<FlowCtx, 'names'>, j: JobRef) => ctx.names.name('career', j.career_code, j.career_name)
const skillName = (ctx: Pick<FlowCtx, 'names'>, code: string) => ctx.names.name('skill', code, code)
const courseName = (ctx: Pick<FlowCtx, 'names'>, c: { code: string; name: string }) => ctx.names.name('course', c.code, c.name)
const act = (ctx: FlowCtx, id: string, match?: (a: Action) => boolean): Action | undefined => ctx.acts.find((a) => a.id === id && (!match || match(a)))

// the buttons that name a position or a course: the web words them from the catalogue
registerLabeler((a, names) => {
  if (!names) return undefined
  const s = a.subject ?? ''
  const key = a.id ? `act.${a.id}` : ''
  if ((a.id === 'job.opening' || a.id === 'company.opening') && hasKey(key)) return t(key as Key, { name: names.name('career', s, s) })
  if ((a.id === 'education.course' || a.id === 'education.enrol') && hasKey(key)) return t(key as Key, { name: names.name('course', s, s) })
  return undefined
})

// -- requirements, met or not, in words ---------------------------------------------------------------------

const REQ_ICON: Record<string, string> = {
  level: 'x_star', skill: 'study', certificate: 'study', residence: 'house', performance: 'chart', time: 'clock', shifts: 'work', top: 'x_star',
  course_city: 'x_map', course_teacher: 'study', not_head: 'm_stop', teacher_no_pool: 'm_stop', already_teaching: 'check', not_teaching: 'm_stop', teacher_full: 'm_stop', course_full: 'm_stop', already_certified: 'check', already_enrolled: 'study',
}

function reqText(ctx: FlowCtx, r: Requirement): string {
  const p = {
    need: formatNumber(r.need), have: formatNumber(r.have), skill: skillName(ctx, r.skill),
    course: ctx.names.name('course', r.course_code, r.course_name), city: cityName(ctx, r.city_code, r.city), t: hms(r.wait_seconds),
  }
  const met = `${r.kind}_met`
  if (r.met && hasKey(`lf.req.${met}`)) return t(`lf.req.${met}` as Key, p)
  if (r.met && hasKey(`ac.work.req.${met}`)) return t(`ac.work.req.${met}` as Key, p)
  return tx(hasKey(`lf.req.${r.kind}`) ? `lf.req.${r.kind}` : 'ac.work.req.other', p)
}

const reqLines = (ctx: FlowCtx, list: Requirement[] | null): RequirementLine[] => (list ?? []).map((r, i) => ({
  key: String(i), icon: REQ_ICON[r.kind] ?? 'check', palette: r.met ? 'emerald' : 'ruby', label: reqText(ctx, r), state: r.met ? 'met' : 'missing',
}))

const backOf = (ctx: FlowCtx) => ctx.acts.filter((a) => isBack(a) && !isRefresh(a))

/** The gain of a skill, in words. */
function gainText(ctx: FlowCtx, g: SkillGain): string {
  return g.level > 0
    ? t('ac.work.skill_level', { skill: skillName(ctx, g.skill), xp: formatNumber(g.xp), n: formatNumber(g.level) })
    : t('ac.work.skill_gain', { skill: skillName(ctx, g.skill), xp: formatNumber(g.xp) })
}

// -- openings ----------------------------------------------------------------------------------------------

export const JobOpenings = flow<JobOpeningsView>(({ view: v, ctx }) => {
  const city = cityName(ctx, v.city_code, v.city)
  const openings = v.openings ?? []
  const companies = v.companies ?? []
  const gaps = v.gaps ?? []
  const paging = ctx.acts.filter((a) => a.id === 'page.prev' || a.id === 'page.next')
  const mine = act(ctx, 'job.mine')
  if (v.travelling) {
    return (
      <Page title={t('ac.work.openings.title')} tone="gold">
        <Panel tone="sapphire"><Lead>{t('ac.work.openings.travelling')}</Lead></Panel>
        <Btns ctx={ctx} list={backOf(ctx)} />
      </Page>
    )
  }
  return (
    <Page title={t('ac.work.openings.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('ac.work.openings.city', { city })}</Lead>
        {v.employed && <Hint>{t('ac.work.openings.current', { title: tierName(ctx, v.current) })}</Hint>}
      </Panel>
      {openings.length > 0 && (
        <>
          <SectionTitle>{t('ac.work.openings.base', { city })}</SectionTitle>
          <CardGrid>
            {openings.map((o) => {
              const go = act(ctx, 'job.opening', (a) => a.subject === o.job.career_code)
              return (
                <PCard
                  key={`${o.job.career_code}.${o.job.rank}`} icon={o.eligible ? 'tool' : 'lock'}
                  title={tierName(ctx, o.job)} badge={o.eligible ? t('ac.work.openings.open') : t('ac.work.openings.locked')} tone={o.eligible ? 'good' : 'off'}
                  facts={<Lines lines={[careerName(ctx, o.job), t('ac.work.pay_shift', { pay: money(o.pay) })]} />}
                  onClick={go ? () => ctx.go(go) : undefined}
                />
              )
            })}
          </CardGrid>
        </>
      )}
      {gaps.length > 0 && (
        <>
          <SectionTitle>{t('ac.work.openings.not_here', { city })}</SectionTitle>
          <CardGrid>
            {gaps.map((g) => {
              const near = g.nearest ? cityName(ctx, g.nearest.code, g.nearest.name) : ''
              return (
                <PCard key={g.job.career_code} off icon="tool" title={careerName(ctx, g.job)} badge={t('education.here_not')} tone="off"
                  facts={<><Lines lines={[near ? t('ac.work.openings.had_in', { place: near }) : '', tripLine(g.nearest_trip)]} /><Need lines={needLines(g.needs, ctx.names, ctx.bname)} /></>}
                  foot={near && g.nearest ? <button className="pn-btn sec" onClick={() => ctx.run('travel.options', { city: g.nearest!.code })}>{t('education.gap.go', { place: near })}</button> : undefined} />
              )
            })}
          </CardGrid>
        </>
      )}
      {companies.length > 0 && (
        <>
          <SectionTitle>{t('ac.work.openings.companies')}</SectionTitle>
          <CardGrid>
            {companies.map((o) => {
              const go = act(ctx, 'company.opening', (a) => a.args?.no === String(o.no))
              return (
                <PCard
                  key={o.no} icon={o.eligible ? 'crate' : 'lock'} title={tierName(ctx, o.job)}
                  badge={o.eligible ? t('ac.work.openings.open') : t('ac.work.openings.locked')} tone={o.eligible ? 'good' : 'off'}
                  facts={<Lines lines={[o.company, t('ac.work.pay_shift', { pay: money(o.pay) })]} />}
                  onClick={go ? () => ctx.go(go) : undefined}
                />
              )
            })}
          </CardGrid>
        </>
      )}
      {openings.length === 0 && companies.length === 0 && (
        <Panel><Lead>{t('ac.work.openings.empty', { city })}</Lead><Hint>{t('ac.work.openings.empty_hint')}</Hint></Panel>
      )}
      {v.pages > 1 && <div className="ac-work-page">{t('ac.work.openings.page', { a: formatNumber(v.page), b: formatNumber(v.pages) })}</div>}
      <Btns ctx={ctx} list={paging} row />
      {mine && <Btns ctx={ctx} list={[mine]} />}
      <Btns ctx={ctx} list={backOf(ctx)} />
    </Page>
  )
})

// -- one opening ---------------------------------------------------------------------------------------------

export const JobDetail = flow<JobDetailView>(({ view: v, ctx }) => {
  const lines = reqLines(ctx, v.requirements)
  return (
    <Page title={tierName(ctx, v.job)} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('ac.work.detail.career'), value: careerName(ctx, v.job) },
          { label: t('ac.work.detail.city'), value: cityName(ctx, v.city_code, v.city) },
          { label: t('ac.work.detail.pay'), value: money(v.pay), gold: true },
          { label: t('ac.work.detail.energy'), value: formatNumber(v.energy_cost) },
        ]} />
      </Panel>
      {v.employed && <Hint tone="bad">{t('ac.work.detail.employed')}</Hint>}
      {lines.length > 0
        ? <Panel><RequirementList lines={lines} title={t('ac.work.detail.reqs')} /></Panel>
        : <Panel><Lead>{t('ac.work.detail.no_reqs')}</Lead></Panel>}
      {!v.can_apply && !v.employed && <Hint>{t('ac.work.detail.locked')}</Hint>}
      <Btns ctx={ctx} list={ctx.by('job.apply')} tone="gold" />
      <Btns ctx={ctx} list={backOf(ctx)} />
    </Page>
  )
})

export const JobHired = flow<JobHiredView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.hired.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('ac.work.hired.lead', { title: tierName(ctx, v.job) })}</Lead>
      <Facts rows={[
        { label: t('ac.work.hired.where'), value: v.employer || cityName(ctx, v.city_code, v.city) },
        { label: t('ac.work.detail.pay'), value: money(v.pay), gold: true },
      ]} />
    </Panel>
    <Btns ctx={ctx} list={ctx.by('job.work')} tone="gold" />
    <Rest ctx={ctx} skip={(a) => a.id === 'job.work'} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

// -- a shift --------------------------------------------------------------------------------------------------

const fatigueText = (bp: number) => (bp >= 10000 ? t('ac.work.fatigue_ok') : t('ac.work.fatigue_tired', { p: bps(bp) }))

export const ShiftStarted = flow<ShiftStartedView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.started.title')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('ac.work.started.lead', { title: tierName(ctx, v.job) })}</Lead>
      <Facts rows={[
        { label: t('ac.work.started.duration'), value: roughDuration(v.duration_seconds) },
        ...(v.ends_at ? [{ label: t('ac.work.started.ends'), value: clockText(v.ends_at) }] : []),
      ]} />
      <Hint tone={v.fatigue_bps >= 10000 ? 'good' : 'bad'}>{fatigueText(v.fatigue_bps)}</Hint>
      <Bar frac={clamp01(v.energy / Math.max(1, v.max_energy))} color="var(--saffron)" label={`${t('ac.work.energy')}: ${t('ac.work.of', { a: formatNumber(v.energy), b: formatNumber(v.max_energy) })}`} />
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

export const ShiftWorked = flow<ShiftWorkedView>(({ view: v, ctx }) => {
  const hurt = v.injury
  const delta = v.performance_delta
  return (
    <Page title={t('ac.work.worked.title')} tone={hurt ? 'ruby' : 'emerald'}>
      <Panel tone="emerald">
        <Lead tone="good">{t('ac.work.worked.lead')}</Lead>
        <StatGrid>
          <StatCard icon="coins" palette="gold" label={t('ac.work.worked.net')} value={money(v.net)} />
          <StatCard icon="bank" palette="steel" label={t('ac.work.worked.tax')} value={money(v.tax)} />
          <StatCard icon="x_star" palette="amber" label={t('ac.work.worked.xp')} value={formatNumber(v.xp)} />
          <StatCard icon="chart" palette="sapphire" label={t('ac.work.worked.performance')} value={formatNumber(v.performance)} />
        </StatGrid>
        <Facts rows={[{ label: t('ac.work.worked.gross'), value: money(v.gross) }]} />
        <EffectRow>
          <EffectChip tone={delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'}>
            {delta > 0 ? t('ac.work.worked.perf_up', { n: formatNumber(delta) }) : delta < 0 ? t('ac.work.worked.perf_down', { n: formatNumber(-delta) }) : t('ac.work.worked.perf_same')}
          </EffectChip>
          {v.fatigue_bps < 10000 && <EffectChip tone="warn">{fatigueText(v.fatigue_bps)}</EffectChip>}
          {v.level > 0 && <EffectChip tone="good">{t('ac.work.worked.level_up', { n: formatNumber(v.level) })}</EffectChip>}
        </EffectRow>
        {(v.skills ?? []).length > 0 && (
          <div className="vf-list">
            {(v.skills ?? []).map((g) => <div key={g.skill} className="vf-line"><span>{gainText(ctx, g)}</span></div>)}
          </div>
        )}
        <Bar frac={clamp01(v.energy / Math.max(1, v.max_energy))} color="var(--saffron)" label={`${t('ac.work.energy')}: ${t('ac.work.of', { a: formatNumber(v.energy), b: formatNumber(v.max_energy) })}`} />
      </Panel>
      {hurt && (
        <Panel tone="ruby">
          <Lead tone="bad">{t('ac.work.injury.title')}</Lead>
          <Facts rows={[
            { label: t('ac.work.injury.damage'), value: formatNumber(hurt.damage) },
            { label: t('ac.work.injury.health'), value: t('ac.work.of', { a: formatNumber(hurt.health), b: formatNumber(hurt.max) }) },
          ]} />
          {hurt.hospital && hurt.ends_at && <Facts rows={[{ label: t('ac.work.injury.until'), value: clockText(hurt.ends_at) }]} />}
          {hurt.hospital && <Hint tone="bad">{t('ac.work.injury.hospital')}</Hint>}
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.by('job.work_again')} tone="gold" />
      <Rest ctx={ctx} skip={(a) => a.id === 'job.work_again'} />
      <Btns ctx={ctx} list={backOf(ctx)} />
    </Page>
  )
})

export const JobPromoted = flow<JobPromotedView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.promoted.title')} tone="gold">
    <Panel tone="gold">
      <Lead tone="good">{t('ac.work.promoted.lead', { title: tierName(ctx, v.job) })}</Lead>
      <Facts rows={[{ label: t('ac.work.detail.pay'), value: money(v.pay), gold: true }]} />
    </Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

// -- resigning -----------------------------------------------------------------------------------------------------

/** Asks before a resignation, which cannot be undone: a popup with one red button. */
export const JobQuitConfirm = flow<JobQuitView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const yes = act(ctx, 'job.quit_confirm')
  return (
    <Page title={t('ac.work.quit.title')} tone="ruby">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="red" dismissible={!ctx.busy} title={t('ac.work.quit.title')}
        footer={<ActionRow><ActionButton tone="steel" small onClick={() => back && ctx.go(back)}>{t('common.cancel')}</ActionButton>{yes && <ActionButton tone="red" busy={ctx.busy} onClick={() => ctx.go(yes)}>{t('ac.work.quit.yes')}</ActionButton>}</ActionRow>}
      >
        <Hero><Medallion icon="work" palette="ruby" /></Hero>
        <Note>{t('ac.work.quit.ask', { title: tierName(ctx, v.job) })}</Note>
      </Popup>
    </Page>
  )
})

export const JobQuit = flow<JobQuitView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.quit.done_title')} tone="sapphire">
    <Panel><Lead>{t('ac.work.quit.done', { title: tierName(ctx, v.job) })}</Lead></Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

// -- study --------------------------------------------------------------------------------------------------------

const INSTITUTION = ['training_center', 'university', 'company']

export const CourseDetail = flow<CourseDetailView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const name = courseName(ctx, v.course)
  const lines = reqLines(ctx, v.requirements)
  const elsewhere = (v.requirements ?? []).find((r) => r.kind === 'course_city' && !r.met)
  const hire = act(ctx, 'education.hire')
  const teachSchool = act(ctx, 'education.teach_school')
  const teachHome = act(ctx, 'education.teach_home')
  const staff = v.staff ?? []
  const pays = ctx.acts.filter((a) => a.id?.startsWith('pay.'))
  const bank = act(ctx, 'bank')
  const enrol = act(ctx, 'education.enrol')
  const afford = (v.payment?.usable ?? []).length > 0
  return (
    <Page title={name} tone="violet">
      <Popup open onClose={() => back && ctx.go(back)} tone="violet" dismissible={!ctx.busy} title={name}>
        <Hero><Medallion icon="study" palette="violet" chip={INSTITUTION.includes(v.institution) ? tx(`ac.work.inst.${v.institution}`) : undefined} /></Hero>
        <StatGrid>
          <StatCard icon="coins" palette="amber" label={t('ac.work.course.fee')} value={v.fee > 0 ? money(v.fee) : t('common.free')} />
          <StatCard icon="clock" palette="sapphire" label={t('ac.work.course.duration')} value={roughDuration(v.duration_seconds)} />
          {v.limited && <StatCard icon="x_map" palette="steel" label={t('ac.work.course.seats')} value={formatNumber(v.seats_left)} />}
          <StatCard icon="study" palette="emerald" label={t('ac.work.course.certificate')} value={v.certifies ? t('ac.work.course.yes') : t('ac.work.course.no')} />
        </StatGrid>
        {v.city && !elsewhere && <Note>{t('ac.work.course.where', { city: cityName(ctx, v.city_code, v.city) })}</Note>}
        {(v.skills ?? []).length > 0 && (
          <>
            <div className="ac-work-sub">{t('ac.work.course.rewards')}</div>
            <EffectRow>{(v.skills ?? []).map((g) => <EffectChip key={g.skill} tone="good">{t('ac.work.course.reward', { skill: skillName(ctx, g.skill), xp: formatNumber(g.xp) })}</EffectChip>)}</EffectRow>
          </>
        )}
        {staff.length > 0 && (
          <>
            <div className="ac-work-sub">{t('ac.work.course.staff')}</div>
            <div className="vf-list">
              {staff.map((s) => {
                const end = ctx.acts.find((a) => a.id === 'education.unteach' && a.args?.id === s.id)
                return (
                  <div key={s.id} className="vf-line">
                    <span>{t(`ac.work.teacher.${s.kind}` as Key, { name: s.name, n: formatNumber(s.students), max: formatNumber(s.max) })}</span>
                    {end && <ActionButton tone="steel" small busy={ctx.busy} onClick={() => ctx.go(end)}>{t('ac.work.teacher.end')}</ActionButton>}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {(hire || teachSchool || teachHome) && (
          <>
            {v.teaching && <Note>{t('ac.work.teacher.wage', { wage: money(v.teaching.school_wage) })}</Note>}
            <ActionRow>
              {hire && <ActionButton tone="green" busy={ctx.busy} onClick={() => ctx.go(hire)}>{t('ac.work.teacher.btn_hire')}</ActionButton>}
              {teachSchool && <ActionButton tone="green" busy={ctx.busy} onClick={() => ctx.go(teachSchool)}>{t('ac.work.teacher.btn_school')}</ActionButton>}
              {teachHome && <ActionButton tone="steel" busy={ctx.busy} onClick={() => ctx.go(teachHome)}>{t('ac.work.teacher.btn_home', { tax: formatNumber(Math.round((v.teaching?.tax_bps ?? 0) / 100)) })}</ActionButton>}
            </ActionRow>
          </>
        )}
        {v.teaching?.no_pool && <Note tone="bad">{t('ac.work.teacher.no_pool')}</Note>}
        <RequirementList lines={lines} title={lines.length ? t('ac.work.detail.reqs') : undefined} />
        {elsewhere && (
          <Unavailable
            reason={t('ac.work.course.not_here')} hint={[t('ac.work.course.taught_in', { place: cityName(ctx, elsewhere.city_code, elsewhere.city) }), tripLine(elsewhere.trip)].filter(Boolean).join(' · ')}
            nearest={{ name: cityName(ctx, elsewhere.city_code, elsewhere.city), onGo: () => ctx.run('travel.options', { city: elsewhere.city_code }), label: t('ac.work.course.go') }}
          />
        )}
        {v.can_enrol && v.payment && (
          <>
            <CostSummary lines={[]} total={{ amount: money(v.payment.amount) }} />
            {afford
              ? <Note>{t('lf.pay.balances', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>
              : <Note tone="bad">{t('lf.pay.cannot', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>}
            <ActionRow>
              {pays.map((a) => <ActionButton key={a.id} tone="gold" busy={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>)}
              {!afford && bank && <ActionButton tone="steel" onClick={() => ctx.go(bank)}>{ctx.label(bank)}</ActionButton>}
            </ActionRow>
          </>
        )}
        {v.can_enrol && !v.payment && enrol && <ActionRow><ActionButton tone="green" busy={ctx.busy} onClick={() => ctx.go(enrol)}>{t('ac.work.course.enrol')}</ActionButton></ActionRow>}
      </Popup>
    </Page>
  )
})

export const Enrolled = flow<EnrolledView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.enrolled.title')} tone="violet">
    <Panel tone="violet">
      <Lead tone="good">{t('ac.work.enrolled.lead', { course: courseName(ctx, v.course) })}</Lead>
      <Facts rows={[
        { label: t('ac.work.course.duration'), value: roughDuration(v.duration_seconds) },
        ...(v.ends_at ? [{ label: t('ac.work.enrolled.ends'), value: clockText(v.ends_at) }] : []),
        { label: t('ac.work.course.fee'), value: v.fee > 0 ? money(v.fee) : t('common.free'), gold: v.fee > 0 },
        ...(v.method ? [{ label: t('ac.work.enrolled.method'), value: tx(`ac.work.method.${v.method}`) }] : []),
      ]} />
    </Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

export const CourseCompleted = flow<CourseCompletedView>(({ view: v, ctx }) => (
  <Page title={t('ac.work.completed.title')} tone="gold">
    <Panel tone="gold">
      <Lead tone="good">{t('ac.work.completed.lead', { course: courseName(ctx, v.course) })}</Lead>
      {v.certified && <Hint tone="good">{t('ac.work.completed.certified', { course: courseName(ctx, v.course) })}</Hint>}
      {(v.skills ?? []).length > 0 && (
        <div className="vf-list">
          {(v.skills ?? []).map((g) => <div key={g.skill} className="vf-line"><span>{gainText(ctx, g)}</span></div>)}
        </div>
      )}
    </Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={backOf(ctx)} />
  </Page>
))

// -- skills ---------------------------------------------------------------------------------------------------------

export const Skills = flow<SkillsView>(({ view: v, ctx }) => {
  const lines = v.lines ?? []
  const trained = lines.filter((l) => l.level > 0 || l.xp > 0)
  const rest = lines.filter((l) => !(l.level > 0 || l.xp > 0))
  return (
    <Page title={t('ac.work.skills.title')} tone="violet">
      {trained.length === 0 && <Panel><Lead>{t('ac.work.skills.none')}</Lead><Hint>{t('ac.work.skills.how')}</Hint></Panel>}
      {trained.map((l) => (
        <Card key={l.code} tone="violet">
          <div className="vf-panel">
            <div className="ac-work-skill">
              <span className="display">{skillName(ctx, l.code)}</span>
              <span className="nx-chip nx-chip-violet">{t('ac.work.skills.level', { n: formatNumber(l.level) })}</span>
            </div>
            {l.max
              ? <Hint tone="good">{t('ac.work.skills.max')}</Hint>
              : <Bar frac={clamp01(l.percent / 100)} color="var(--violet)" label={t('ac.work.of', { a: formatNumber(l.xp), b: formatNumber(l.next) })} />}
          </div>
        </Card>
      ))}
      {rest.length > 0 && trained.length > 0 && (
        <Panel>
          <SectionTitle>{t('ac.work.skills.untrained')}</SectionTitle>
          <div className="ac-work-chips">{rest.map((l) => <span key={l.code} className="nx-chip">{skillName(ctx, l.code)}</span>)}</div>
        </Panel>
      )}
      <Btns ctx={ctx} list={backOf(ctx)} />
    </Page>
  )
})

export const WORK_SCREENS: Record<string, ReturnType<typeof flow>> = {
  job_openings: JobOpenings, job_detail: JobDetail, job_hired: JobHired, shift_started: ShiftStarted, shift_worked: ShiftWorked,
  job_promoted: JobPromoted, job_quit_confirm: JobQuitConfirm, job_quit: JobQuit,
  course_detail: CourseDetail, enrolled: Enrolled, course_completed: CourseCompleted, skills: Skills,
}

/** Commands of this file's screens that change the world: the flow host runs them itself. */
export const WORK_WRITES: string[] = ['job.apply', 'job.work', 'job.promote', 'education.enroll', 'education.hire', 'education.teach', 'education.unteach']
// a resignation is a write only once the player has confirmed it
registerWrites(['job.quit'], (a) => !!a.args?.confirm)
