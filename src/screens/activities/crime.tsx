// Screens of the activities area: crime, jail and the victim's reports. Drawn from the neutral views only
// (docs/adr/0039-presentation-split.md): the server sends codes, numbers and times; the words are this client's,
// the names come from the catalogue. The hub and the list keep their native layouts (../native/CrimeHub.tsx).

import type {
  BailedView, CaseFiledView, CasesView, CrimeDetailView, CrimeRecordView, CrimeRefusalView, CrimeRequirement, CrimeResultView, CrimeStartedView, HeatView,
  JailView, NerveView, ReportConfirmView,
} from '../../api/views.gen'
import { Bar, SectionTitle } from '../native/kit/Parts'
import { clamp01, hms, money, roughDuration } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, { ActionButton, ActionRow, CostSummary, Note } from '../../ui/Popup'
import { hasKey, t } from '../../i18n'
import { registerLabeler } from '../village/wording'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, flow, isBack, registerWrites } from '../village/flow'
import type { FlowCtx } from '../village/flow'
import { bps, cityName, clockText, dateText, nameOf, tf, tx } from '../life/common'

export const CRIME_SCREENS: Record<string, ReturnType<typeof flow>> = {}

/** Commands of this file's screens that change the world: the flow host runs them itself. */
export const CRIME_WRITES: string[] = ['crime.commit']

// a bail is a write once a way to pay is chosen; a report once it is confirmed or paid
registerWrites(['crime.bail'], (a) => !!a.args?.method)
registerWrites(['crime.report'], (a) => !!a.args?.confirm)

// -- names ------------------------------------------------------------------------------------------------------------------

type Coded = { code: string; name: string }
const categoryName = (ctx: FlowCtx, n: Coded) => (hasKey(`crime.category.${n.code}`) ? tx(`crime.category.${n.code}`) : ctx.names.name('crime_category', n.code, n.name))
const tierName = (ctx: FlowCtx, n: Coded) => (hasKey(`crime.tier_name.${n.code}`) ? tx(`crime.tier_name.${n.code}`) : nameOf(ctx, 'crime_tier', n))

// the buttons that name a crime or a category take the name from the catalogue
registerLabeler((a, names) => {
  const id = a.id ?? ''
  if (id !== 'crime.category' && id !== 'crime.view' && id !== 'crime.again') return undefined
  const code = a.subject ?? ''
  const name = id === 'crime.category'
    ? (hasKey(`crime.category.${code}`) ? tx(`crime.category.${code}`) : names?.name('crime_category', code, code) ?? code)
    : names?.name('crime', code, code) ?? code
  return tx(`act.${id}`, { name })
})

// -- small parts --------------------------------------------------------------------------------------------------------------

function Meters({ nerve, heat }: { nerve?: NerveView; heat?: HeatView }) {
  return (
    <div className="ac-crime-meters">
      {heat && (
        <Bar frac={heat.max ? clamp01(heat.heat / heat.max) : 0} color="var(--saffron)" label={t('crime.heat', { n: formatNumber(heat.heat) })}
          sub={heat.wanted ? t('crime.wanted', { n: formatNumber(heat.wanted) }) : undefined} />
      )}
      {nerve && (
        <Bar frac={nerve.max ? clamp01(nerve.nerve / nerve.max) : 0} color="var(--anar)" label={t('crime.nerve', { a: formatNumber(nerve.nerve), b: formatNumber(nerve.max) })}
          sub={nerve.max && nerve.nerve < nerve.max ? t('crime.full_in', { t: hms(nerve.full_in_seconds) }) : undefined} />
      )}
    </div>
  )
}

const range = (a: string, b: string) => (a === b ? a : t('ac.crime.range', { a, b }))

/** One condition of a crime, worded from its kind; the names come from the catalogue. */
function reqText(ctx: FlowCtx, r: CrimeRequirement): string {
  const have = (h: string) => (!r.met ? ` ${t('req.have', { have: h })}` : '')
  const venues = (r.venues ?? []).map((v) => nameOf(ctx, 'venue', v)).join(`${t('common.sep')} `)
  switch (r.kind) {
    case 'level': return t('req.level', { need: formatNumber(r.need) }) + have(formatNumber(r.have))
    case 'skill': return t('req.skill', { skill: ctx.names.name('skill', r.skill, r.skill), need: formatNumber(r.need) }) + have(formatNumber(r.have))
    case 'certificate': return t('req.certificate', { name: ctx.names.name('course', r.course_code, r.course_name) })
    case 'residence': return t('req.residence', { city: cityName(ctx, r.city_code, r.city) })
    case 'performance': return t('req.performance', { need: formatNumber(r.need) }) + have(formatNumber(r.have))
    case 'time': return t('req.time', { t: hms(r.wait_seconds) })
    case 'shifts': return t('req.shifts_have', { n: formatNumber(r.need), have: have(formatNumber(r.have)) })
    case 'top': return t('req.top')
    case 'crime_tier': return t('req.crime_tier', { name: tierName(ctx, r.tier), have: have(tierName(ctx, r.have_tier)) })
    case 'venue': return r.met ? t('req.venue_ok', { names: venues }) : t('ac.crime.req.venue_miss', { names: venues, here: nameOf(ctx, 'venue', r.here) })
    case 'facility': return t('req.facility', { name: ctx.names.name(['facility', 'settlement_building'], r.facility, r.facility) })
    case 'tool': return t('req.tool', { name: nameOf(ctx, 'item', r.tool) })
    default: return t('ac.crime.req.other')
  }
}

function Reqs({ ctx, list }: { ctx: FlowCtx; list: CrimeRequirement[] }) {
  return (
    <div className="ac-crime-reqs">
      {list.map((r, i) => (
        <div key={i} className={`ac-crime-req ${r.met ? 'met' : 'miss'}`}>
          <span className="ac-crime-dot" role="img" aria-label={t(r.met ? 'ac.crime.req.met' : 'ac.crime.req.miss')} />
          <span>{reqText(ctx, r)}</span>
        </div>
      ))}
    </div>
  )
}

/** The sentence of a request refused for one of the crime reasons. */
function refusedText(ctx: FlowCtx, v: CrimeRefusalView): string {
  const wait = v.wait_seconds || v.remaining_seconds
  const key = v.kind === 'nerve' && !wait ? 'ac.crime.refused.nerve_now' : `ac.crime.refused.${v.kind}`
  return tf(key, 'ac.crime.refused.unknown', {
    need: formatNumber(v.need), have: formatNumber(v.have), time: roughDuration(wait), amount: money(v.amount), cash: money(v.cash), crime: nameOf(ctx, 'crime', v.crime),
  })
}

const ODDS = ['base', 'skill', 'awareness', 'heat', 'gear'] as const
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${bps(Math.abs(n))}`

// -- one crime in detail ----------------------------------------------------------------------------------------------------

function blockedText(v: CrimeDetailView): string {
  switch (v.blocked) {
    case '': return ''
    case 'nerve': return t('ac.crime.d.blocked_nerve', { need: formatNumber(v.need), have: formatNumber(v.have) })
    case 'cooldown': return t('ac.crime.d.blocked_cooldown', { t: roughDuration(v.wait_seconds || v.cooldown_left_seconds) })
    default: return tf(`crime.blocked.${v.blocked}`, 'crime.blocked.default')
  }
}

export const CrimeDetail = flow<CrimeDetailView>(({ view: v, ctx }) => {
  const odds = ODDS.map((k) => [k, v.odds[k]] as const).filter(([, n]) => n !== 0)
  const gear = ([['catch', v.gear_catch_bps], ['witness', v.gear_witness_bps], ['solve', v.gear_solve_bps], ['reward', v.gear_reward_bps]] as const).filter(([, n]) => n !== 0)
  const blocked = blockedText(v)
  const missing = (v.requirements ?? []).some((r) => !r.met)
  const hits = [v.hits_np_cs && t('ac.crime.d.hits_npcs'), v.hits_players && t('ac.crime.d.hits_players')].filter(Boolean).join(`${t('common.sep')} `)
  return (
    <Page title={nameOf(ctx, 'crime', v.crime)} tone="ruby">
      <Panel tone="ruby">
        <Lead>{t('ac.crime.d.chance', { p: bps(v.chance_bps) })}</Lead>
        <Hint>{t('ac.crime.d.category', { name: categoryName(ctx, v.category) })}</Hint>
        <Facts rows={[
          { label: t('ac.crime.d.nerve'), value: formatNumber(v.nerve) },
          { label: t('ac.crime.d.duration'), value: v.duration_seconds > 0 ? roughDuration(v.duration_seconds) : t('ac.crime.d.instant') },
          ...(v.hits_np_cs && v.max_take > 0 ? [{ label: t('ac.crime.d.take'), value: range(money(v.min_take), money(v.max_take)), gold: true }] : []),
          ...(hits ? [{ label: t('ac.crime.d.victims'), value: hits }] : []),
          { label: t('ac.crime.d.jail'), value: range(roughDuration(v.jail_min_seconds), roughDuration(v.jail_max_seconds)) },
          { label: t('ac.crime.d.fine'), value: range(money(v.fine_min), money(v.fine_max)) },
          ...(v.cooldown_seconds > 0 ? [{ label: t('ac.crime.d.cooldown'), value: roughDuration(v.cooldown_seconds) }] : []),
        ]} />
      </Panel>
      {odds.length > 0 && (
        <Panel>
          <SectionTitle>{t('ac.crime.odds.title')}</SectionTitle>
          <div className="vf-list">
            {odds.map(([k, n]) => <div key={k} className="vf-line"><span>{tx(`ac.crime.odds.${k}`)}</span><b dir="ltr">{signed(n)}</b></div>)}
          </div>
        </Panel>
      )}
      {gear.length > 0 && (
        <Panel>
          <SectionTitle>{t('ac.crime.gear.title')}</SectionTitle>
          <div className="vf-list">
            {gear.map(([k, n]) => <div key={k} className="vf-line"><span>{tx(`lf.gear.${k}`)}</span><b dir="ltr">{signed(n)}</b></div>)}
          </div>
        </Panel>
      )}
      {(v.requirements ?? []).length > 0 && (
        <Panel tone={missing ? 'gold' : undefined}>
          <SectionTitle>{t('ac.crime.req.title')}</SectionTitle>
          <Reqs ctx={ctx} list={v.requirements ?? []} />
        </Panel>
      )}
      {blocked && <Panel tone="ruby"><Lead tone="bad">{blocked}</Lead></Panel>}
      {!blocked && missing && <Hint tone="bad">{t('ac.crime.d.missing')}</Hint>}
      <Btns ctx={ctx} list={ctx.by('crime.commit')} tone="red" />
    </Page>
  )
})
CRIME_SCREENS.crime_detail = CrimeDetail

// -- how an attempt ended -----------------------------------------------------------------------------------------------------

const RESULT_TONE = { succeeded: 'emerald', escaped: 'sapphire', caught: 'ruby' } as const

export const CrimeResult = flow<CrimeResultView>(({ view: v, ctx }) => {
  const out = (v.result in RESULT_TONE ? v.result : 'escaped') as keyof typeof RESULT_TONE
  const crime = nameOf(ctx, 'crime', v.crime)
  const where = [nameOf(ctx, 'venue', v.venue), cityName(ctx, v.city_code, v.city)].filter(Boolean).join(`${t('common.sep')} `)
  const gains = [
    v.take > 0 && { label: t('ac.crime.res.take'), value: money(v.take), gold: true },
    v.xp > 0 && { label: t('ac.crime.res.xp'), value: formatNumber(v.xp) },
    v.criminal_xp > 0 && { label: t('ac.crime.res.criminal_xp'), value: formatNumber(v.criminal_xp) },
    v.level > 0 && { label: t('ac.crime.res.level'), value: formatNumber(v.level), gold: true },
    ...(v.skills ?? []).map((s) => ({
      label: ctx.names.name('skill', s.skill, s.skill),
      value: s.level > 0 ? t('ac.crime.res.skill_up', { n: formatNumber(s.xp), level: formatNumber(s.level) }) : t('ac.crime.res.skill_xp', { n: formatNumber(s.xp) }),
    })),
    ...(v.loot ?? []).map((l) => ({ label: t('ac.crime.res.loot'), value: `${nameOf(ctx, 'item', l.item)} ${t('ac.crime.res.times', { n: formatNumber(l.qty) })}` })),
    v.stolen && { label: t('ac.crime.res.stolen'), value: nameOf(ctx, 'item', v.stolen) },
  ].filter(Boolean) as { label: string; value: string; gold?: boolean }[]
  const injury = v.injury
  return (
    <Page title={t('crime.result_title')} tone={RESULT_TONE[out]}>
      <Panel tone={RESULT_TONE[out]}>
        <Lead tone={out === 'succeeded' ? 'good' : out === 'caught' ? 'bad' : undefined}>{tx(`ac.crime.res.lead.${out}`, { crime })}</Lead>
        {where && <Hint>{t('ac.crime.res.where', { place: where })}</Hint>}
        {v.dry_spell && <Hint>{t('crime.dry')}</Hint>}
        {v.victim_player && out === 'succeeded' && <Hint>{t('ac.crime.res.victim_player')}</Hint>}
        {gains.length > 0 && <Facts rows={gains} />}
      </Panel>
      {out === 'caught' && (
        <Panel tone="ruby">
          <SectionTitle>{t('ac.crime.res.arrest')}</SectionTitle>
          <Facts rows={[
            ...(v.jail ? [{ label: t('ac.crime.res.jail'), value: hms(v.jail.remaining_seconds) }] : []),
            ...(v.fine > 0 ? [{ label: t('ac.crime.res.fine'), value: money(v.fine) }, { label: t('ac.crime.res.fine_paid'), value: money(v.fine_paid) }] : []),
          ]} />
          {(v.confiscated ?? []).length > 0 && (
            <>
              <Hint>{t('ac.crime.res.confiscated')}</Hint>
              <div className="vf-list">{(v.confiscated ?? []).map((c, i) => <div key={i} className="vf-line"><span>{nameOf(ctx, 'item', c)}</span></div>)}</div>
            </>
          )}
        </Panel>
      )}
      {injury && (
        <Panel tone="ruby">
          <SectionTitle>{t('ac.crime.res.injury')}</SectionTitle>
          <Lead tone="bad">{t('ac.crime.res.injury_text', { n: formatNumber(injury.damage) })}</Lead>
          <Bar frac={injury.max ? clamp01(injury.health / injury.max) : 0} color="var(--anar)" label={t('hospital.health', { a: formatNumber(injury.health), b: formatNumber(injury.max) })} />
          {injury.hospital && <Hint tone="bad">{injury.ends_at ? t('ac.crime.res.admitted_until', { at: clockText(injury.ends_at) }) : t('ac.crime.res.admitted')}</Hint>}
        </Panel>
      )}
      <Panel><Meters nerve={v.nerve} heat={v.heat} /></Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})
CRIME_SCREENS.crime_result = CrimeResult

export const CrimeStarted = flow<CrimeStartedView>(({ view: v, ctx }) => (
  <Page title={t('crime.started')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('ac.crime.started.lead', { crime: nameOf(ctx, 'crime', v.crime), place: nameOf(ctx, 'venue', v.venue) })}</Lead>
      <Facts rows={[
        { label: t('ac.crime.d.duration'), value: roughDuration(v.duration_seconds) },
        ...(v.ends_at ? [{ label: t('ac.crime.started.ends'), value: clockText(v.ends_at) }] : []),
      ]} />
      <Hint>{t('crime.result_later')}</Hint>
    </Panel>
    <Panel><Meters nerve={v.nerve} /></Panel>
    <Rest ctx={ctx} />
  </Page>
))
CRIME_SCREENS.crime_started = CrimeStarted

// -- the record -------------------------------------------------------------------------------------------------------------

export const CrimeRecord = flow<CrimeRecordView>(({ view: v, ctx }) => {
  const rate = v.attempts > 0 ? Math.round((v.successes * 100) / v.attempts) : 0
  const recent = v.recent ?? []
  return (
    <Page title={t('screen.crime_record')} tone="ruby">
      <Panel tone="ruby">
        <Lead>{t('ac.crime.rec.tier', { name: tierName(ctx, v.tier.tier) })}</Lead>
        {v.tier.next.code && (
          <>
            <Hint>{t('ac.crime.rec.next', { name: tierName(ctx, v.tier.next) })}</Hint>
            <Bar frac={v.tier.next_xp ? clamp01(v.tier.xp / v.tier.next_xp) : 0} color="var(--saffron)"
              label={t('ac.crime.rec.xp', { a: formatNumber(v.tier.xp), b: formatNumber(v.tier.next_xp) })} />
          </>
        )}
        <Meters nerve={v.nerve} heat={v.heat} />
      </Panel>
      <Panel>
        <Facts rows={[
          { label: t('ac.crime.rec.attempts'), value: formatNumber(v.attempts) },
          { label: t('ac.crime.rec.successes'), value: v.attempts > 0 ? t('ac.crime.rec.of', { n: formatNumber(v.successes), p: formatNumber(rate) }) : formatNumber(0) },
          { label: t('ac.crime.rec.arrests'), value: formatNumber(v.arrests) },
          { label: t('ac.crime.rec.convictions'), value: formatNumber(v.convictions) },
        ]} />
        {(v.unpaid_restitution > 0 || v.unpaid_fines > 0) && (
          <>
            <Hint tone="bad">{t('ac.crime.rec.unpaid')}</Hint>
            <Facts rows={[
              ...(v.unpaid_restitution > 0 ? [{ label: t('ac.crime.rec.restitution'), value: money(v.unpaid_restitution) }] : []),
              ...(v.unpaid_fines > 0 ? [{ label: t('ac.crime.rec.fines'), value: money(v.unpaid_fines) }] : []),
            ]} />
          </>
        )}
      </Panel>
      <Panel>
        <SectionTitle>{t('ac.crime.rec.recent')}</SectionTitle>
        {recent.length === 0
          ? <Hint>{t('ac.crime.rec.none')}</Hint>
          : (
            <div className="vf-list">
              {recent.map((r, i) => (
                <div key={i} className="vf-line">
                  <span>{nameOf(ctx, 'crime', r.crime)}</span>
                  <b className={`ac-crime-out ${r.result}`}>{tf(`crime.result.${r.result}`, 'crime.result')}{r.at ? ` · ${dateText(r.at)} ${clockText(r.at)}` : ''}</b>
                </div>
              ))}
            </div>
          )}
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})
CRIME_SCREENS.crime_record = CrimeRecord

// -- jail and bail ------------------------------------------------------------------------------------------------------------

const isPay = (a: { id?: string }) => !!a.id?.startsWith('pay.')

export const Jail = flow<JailView>(({ view: v, ctx }) => {
  if (!v.in_jail) {
    return (
      <Page title={t('screen.jail')} tone="sapphire">
        <Panel><Lead tone="good">{t('ac.crime.jail.free')}</Lead></Panel>
        <Rest ctx={ctx} />
      </Page>
    )
  }
  const pay = v.payment
  const cannot = !!pay && (pay.usable ?? []).length === 0
  return (
    <Page title={t('screen.jail')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{t('ac.crime.jail.lead', { city: cityName(ctx, v.city_code, v.city) })}</Lead>
        <Hint>{t(v.reason === 'conviction' ? 'ac.crime.jail.conviction' : 'ac.crime.jail.arrest')}</Hint>
        <Facts rows={[
          { label: t('ac.crime.jail.left'), value: hms(v.remaining_seconds) },
          ...(v.ends_at ? [{ label: t('ac.crime.jail.ends'), value: clockText(v.ends_at) }] : []),
          ...(v.bail > 0 ? [{ label: t('ac.crime.jail.bail'), value: money(v.bail), gold: true }] : []),
        ]} />
      </Panel>
      {v.bail > 0 && pay && (
        <Panel>
          <SectionTitle>{t('ac.crime.jail.bail_title')}</SectionTitle>
          <Hint>{t('ac.crime.jail.bail_hint')}</Hint>
          {cannot
            ? <Hint tone="bad">{t('ac.crime.jail.cannot', { amount: money(pay.amount), cash: money(pay.cash), bank: money(pay.bank) })}</Hint>
            : <Facts rows={[{ label: t('ac.crime.pay.cash'), value: money(pay.cash) }, { label: t('ac.crime.pay.bank'), value: money(pay.bank) }]} />}
          <Btns ctx={ctx} list={ctx.acts.filter(isPay)} tone="gold" />
        </Panel>
      )}
      <Rest ctx={ctx} skip={isPay} />
    </Page>
  )
})
CRIME_SCREENS.jail = Jail

export const Bailed = flow<BailedView>(({ view: v, ctx }) => (
  <Page title={t('ac.crime.bailed.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('ac.crime.bailed.lead', { amount: money(v.bail), method: tf(`ac.crime.method.${v.method}`, 'ac.crime.method.other') })}</Lead>
      <Hint>{t('ac.crime.bailed.hint')}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))
CRIME_SCREENS.bailed = Bailed

// -- the victim's reports ------------------------------------------------------------------------------------------------------

/** Asks the victim before a report is filed: what was stolen, what it costs, how long it takes, and how to pay. */
export const ReportConfirm = flow<ReportConfirmView>(({ view: v, ctx }) => {
  const backAct = ctx.acts.find(isBack)
  const pay = v.payment
  const cannot = !!pay && (pay.usable ?? []).length === 0
  const buttons = ctx.acts.filter((a) => !isBack(a))
  const leave = () => backAct && ctx.go(backAct)
  return (
    <Page title={t('ac.crime.report.title')} tone="gold">
      <Popup
        open onClose={leave} tone="gold" dismissible={!ctx.busy} title={t('ac.crime.report.title')}
        footer={(
          <>
            {cannot && <Note tone="bad">{t('ac.crime.report.cannot', { amount: money(pay!.amount), cash: money(pay!.cash), bank: money(pay!.bank) })}</Note>}
            <ActionRow>
              <ActionButton tone="steel" small onClick={leave}>{t('common.cancel')}</ActionButton>
              {buttons.map((a, i) => <ActionButton key={`${a.id}-${i}`} tone={a.id === 'bank' ? 'gold' : 'green'} busy={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>)}
            </ActionRow>
          </>
        )}
      >
        <Note>{t('ac.crime.report.ask', { crime: nameOf(ctx, 'crime', v.crime), city: cityName(ctx, v.city_code, v.city), amount: money(v.amount) })}</Note>
        <CostSummary lines={[]} total={{ label: t('ac.crime.report.fee'), amount: v.fee > 0 ? money(v.fee) : t('common.free') }} />
        <Facts rows={[
          { label: t('ac.crime.report.investigation'), value: roughDuration(v.investigation_seconds) },
          { label: t('ac.crime.report.within'), value: roughDuration(v.report_within_seconds) },
        ]} />
        <Hint>{t('ac.crime.report.hint')}</Hint>
      </Popup>
    </Page>
  )
})
CRIME_SCREENS.report_confirm = ReportConfirm

export const CaseFiled = flow<CaseFiledView>(({ view: v, ctx }) => (
  <Page title={t('ac.crime.filed.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('ac.crime.filed.lead', { t: roughDuration(v.investigation_seconds) })}</Lead>
      {v.ends_at && <Facts rows={[{ label: t('ac.crime.filed.ends'), value: clockText(v.ends_at) }]} />}
      <Hint>{t('ac.crime.filed.hint')}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))
CRIME_SCREENS.case_filed = CaseFiled

export const Cases = flow<CasesView>(({ view: v, ctx }) => {
  const list = v.cases ?? []
  return (
    <Page title={t('ac.crime.cases.title')} tone="gold">
      {list.length === 0
        ? <Panel><Lead>{t('ac.crime.cases.empty')}</Lead><Hint>{t('ac.crime.cases.empty_hint')}</Hint></Panel>
        : list.map((c, i) => (
          <Panel key={i} tone={c.status === 'solved' ? 'emerald' : c.status === 'unsolved' ? 'ruby' : 'sapphire'}>
            <Lead>{t('ac.crime.cases.line', { crime: nameOf(ctx, 'crime', c.crime), city: cityName(ctx, c.city_code, c.city) })}</Lead>
            <Facts rows={[
              { label: t('ac.crime.cases.amount'), value: money(c.amount) },
              { label: t('ac.crime.cases.status'), value: tf(`ac.crime.cases.${c.status}`, 'ac.crime.cases.unsolved'), gold: c.status === 'solved' },
              ...(c.status === 'investigating' ? [{ label: t('ac.crime.cases.left'), value: hms(c.remaining_seconds) }] : []),
              ...(c.status === 'solved' && c.thief ? [{ label: t('ac.crime.cases.thief'), value: c.thief }] : []),
              ...(c.status === 'solved' ? [{ label: t('ac.crime.cases.restored'), value: money(c.restored) }] : []),
            ]} />
          </Panel>
        ))}
      <Rest ctx={ctx} />
    </Page>
  )
})
CRIME_SCREENS.cases = Cases

// -- a refused request ------------------------------------------------------------------------------------------------------------

export const CrimeRefusal = flow<CrimeRefusalView>(({ view: v, ctx }) => {
  const missing = v.missing ?? []
  return (
    <Page title={t('ac.crime.refusal.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{refusedText(ctx, v)}</Lead>
        {v.kind === 'requirements' && v.crime.code && <Hint>{t('ac.crime.refusal.for', { crime: nameOf(ctx, 'crime', v.crime) })}</Hint>}
        {missing.length > 0 && <Reqs ctx={ctx} list={missing} />}
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})
CRIME_SCREENS.crime_refusal = CrimeRefusal
