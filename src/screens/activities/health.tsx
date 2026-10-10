// Screens of the activities area: health and missions. Neutral views only (docs/adr/0039-presentation-split.md):
// the server sends the facts and the next steps by meaning; the words are this client's, content names come from
// the catalogue by code. The older native layouts (hospital, mission board) keep their own files in ../native.

import type {
  ClinicDeskView, HealthRefusalView, MissionNotice, MissionObjective, MissionProgressLine, MissionRefusalView, MissionReward, MissionsMineView,
  MissionView, TreatConfirmView, TreatedView, TreatOption,
} from '../../api/views.gen'
import type { Action } from '../../api/types'
import { Bar, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { clamp01, hms, money, roughDuration } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, { ActionButton, ActionRow, Hero, Medallion, Note, StatCard, StatGrid } from '../../ui/Popup'
import { t } from '../../i18n'
import { careWord, useCare, type Care } from '../../support/care'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, flow, isBack, isRefresh, registerWrites, type FlowCtx } from '../village/flow'
import { objectiveText } from '../native/Missions'
import { bps, clockText, nameOf, tx } from '../life/common'

export const HEALTH_SCREENS: Record<string, ReturnType<typeof flow>> = {}

/** Commands of this file's screens that change the world: the flow host runs them itself. A treatment is a write
 * only once a way to pay (or the free confirm) is chosen; giving a mission up only once it is confirmed. */
export const HEALTH_WRITES: string[] = ['mission.accept', 'mission.deliver', 'health.open', 'health.price']
registerWrites(['health.treat'], (a) => !!a.args?.method)
registerWrites(['mission.abandon'], (a) => !!a.args?.confirm)

/** Who treats: the city's hospital, or a clinic by the name its owner gave it. */
const providerName = (o: TreatOption, care: Care): string => (o.provider === 'health_house' ? t('ac.health.health_house') : o.provider === 'village_clinic' ? t('hc.clinic') : o.provider === 'clinic' ? t('ac.health.clinic_name', { name: o.clinic.name }) : t(({ hospital: 'ac.health.city_hospital', house: 'ac.health.health_house', plain: 'ac.health.care_plain' } as const)[careWord(care)]))

/** The server's refresh of the hospital, worded as the way on («وضع درمان من»), for a screen whose back goes home. */
const toHospital = (ctx: FlowCtx): Action[] => ctx.acts.filter((a) => a.id === 'health.hospital' || (isRefresh(a) && a.command === 'health.hospital')).slice(0, 1).map((a) => ({ ...a, id: 'health.hospital', kind: 'secondary' }))

// -- a treatment: the price and how to pay it, then the result ---------------------------------------------------

export const TreatConfirm = flow<TreatConfirmView>(({ view: v, ctx }) => {
  const care = useCare()
  const back = ctx.acts.find(isBack)
  const pays = ctx.acts.filter((a) => a.id?.startsWith('pay.'))
  const free = ctx.by('health.confirm_free')[0]
  const bank = ctx.by('bank')[0]
  const p = v.payment
  const afford = !!p && (p.usable ?? []).length > 0
  return (
    <Page title={t('ac.health.treat_title')} tone="ruby">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="navy" dismissible={!ctx.busy}
        title={t('ac.health.confirm_title', { who: providerName(v.option, care) })}
        footer={(
          <>
            <ActionRow>
              {free && <ActionButton tone="green" busy={ctx.busy} onClick={() => ctx.go(free)}>{t('ac.health.confirm_free')}</ActionButton>}
              {pays.map((a) => <ActionButton key={a.id} tone="gold" busy={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>)}
            </ActionRow>
            {!!p && !afford && bank && <ActionButton tone="steel" small onClick={() => ctx.go(bank)}>{t('lf.checkout.bank')}</ActionButton>}
            {back && <ActionButton tone="steel" small onClick={() => ctx.go(back)}>{t('common.cancel')}</ActionButton>}
          </>
        )}
      >
        <Hero><Medallion icon="stetho" palette="ruby" /></Hero>
        <StatGrid>
          <StatCard icon="coins" palette="gold" label={t('ac.health.price')} value={v.option.price > 0 ? money(v.option.price) : t('common.free')} />
          <StatCard icon="stopwatch" palette="emerald" label={t('ac.health.saves')} value={roughDuration(v.option.saves_seconds)} />
          <StatCard icon="health" palette="ruby" label={t('ac.health.remaining')} value={hms(v.remaining_seconds)} />
        </StatGrid>
        {v.ends_at && <Note>{t('ac.health.new_end', { at: clockText(v.ends_at) })}</Note>}
        {p && (afford
          ? <Note>{t('lf.pay.balances', { cash: money(p.cash), bank: money(p.bank) })}</Note>
          : <Note tone="bad">{t('lf.pay.cannot', { cash: money(p.cash), bank: money(p.bank) })}</Note>)}
      </Popup>
    </Page>
  )
})

export const Treated = flow<TreatedView>(({ view: v, ctx }) => {
  const care = useCare()
  return (
  <Page title={t('ac.health.treated_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('ac.health.treated_lead', { who: providerName(v.option, care), saved: roughDuration(v.saved_seconds) })}</Lead>
      <Facts rows={[
        ...(v.paid > 0 ? [{ label: t('ac.health.paid'), value: money(v.paid), gold: true }, { label: t('ac.health.paid_by'), value: tx(`lf.pay.${v.method}`) }] : []),
        { label: t('ac.health.remaining'), value: v.remaining_seconds > 0 ? hms(v.remaining_seconds) : t('ac.health.none_left') },
        ...(v.ends_at && v.remaining_seconds > 0 ? [{ label: t('ac.health.ends_at'), value: clockText(v.ends_at) }] : []),
      ]} />
    </Panel>
    <Btns ctx={ctx} list={toHospital(ctx)} />
  </Page>
  )
})

// -- a clinic's desk, for its owner and manager ------------------------------------------------------------------

export const ClinicDesk = flow<ClinicDeskView>(({ view: v, ctx }) => (
  <Page title={t('ac.health.desk_title', { name: v.ref.name })} tone="ruby">
    <Panel tone={v.open ? 'emerald' : 'ruby'}>
      <Lead tone={v.open ? 'good' : 'bad'}>{v.open ? t('ac.health.desk_open') : t('ac.health.desk_closed')}</Lead>
      <Facts rows={[
        { label: t('ac.health.desk_price'), value: v.price > 0 ? money(v.price) : t('common.free'), gold: true },
        { label: t('ac.health.desk_stock'), value: t('ac.health.desk_stock_v', { n: formatNumber(v.stock), per: formatNumber(v.units) }) },
        { label: t('ac.health.desk_doctor'), value: formatNumber(v.doctor) },
        { label: t('ac.health.desk_reduction'), value: bps(v.reduction_bps) },
        { label: t('ac.health.desk_treated'), value: formatNumber(v.treated) },
        { label: t('ac.health.desk_earned'), value: money(v.earned), gold: true },
      ]} />
      {!v.stocked && <Hint tone="bad">{t('ac.health.desk_no_stock')}</Hint>}
      <Hint>{t('ac.health.desk_help')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a))} />
  </Page>
))

export const HealthRefusal = flow<HealthRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{tx(`ac.health.refused.${v.kind}`)}</Lead>
      <Hint>{tx(`ac.health.refused_hint.${v.kind}`)}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- missions ----------------------------------------------------------------------------------------------------

const objectiveDone = (o: MissionObjective) => o.count > 0 && o.done >= o.count

/** The objectives of a mission, each with its progress when the mission is under way. */
function Objectives({ ctx, list, progress }: { ctx: FlowCtx; list: MissionObjective[] | null; progress?: boolean }) {
  const rows = list ?? []
  if (!rows.length) return null
  return (
    <div className="vf-goals">
      {rows.map((o, i) => (
        <div key={i} className={`vf-goal${progress && objectiveDone(o) ? ' met' : ''}`}>
          <span className="vf-goal-mark" aria-hidden>{progress && objectiveDone(o) ? '✓' : '•'}</span>
          <div className="vf-goal-body">
            <span>{objectiveText({ kind: o.kind, target: o.target, count: o.count }, ctx.names)}</span>
            {progress && o.count > 1 && <Bar frac={clamp01(o.done / o.count)} color={objectiveDone(o) ? 'var(--leaf)' : 'var(--saffron)'} label={t('ac.mission.progress', { done: formatNumber(Math.min(o.done, o.count)), count: formatNumber(o.count) })} />}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The reward of a mission: cash, experience and goods, one fact each. */
function rewardRows(ctx: FlowCtx, r: MissionReward): { label: string; value: string; gold?: boolean }[] {
  return [
    ...(r.cash > 0 ? [{ label: t('ac.mission.reward_cash'), value: money(r.cash), gold: true }] : []),
    ...(r.xp > 0 ? [{ label: t('ac.mission.reward_xp'), value: formatNumber(r.xp) }] : []),
    ...(r.items ?? []).map((l) => ({ label: t('ac.mission.reward_item'), value: `${formatNumber(l.qty)} ${nameOf(ctx, 'item', l.item)}` })),
  ]
}

/** Why a mission cannot be taken, in words. */
const blockedText = (why: string, p: { wait?: number; level?: number; max?: number }): string => tx(`ac.mission.blocked.${why}`, { t: roughDuration(p.wait ?? 0), level: formatNumber(p.level ?? 0), max: formatNumber(p.max ?? 0) })

export const Mission = flow<MissionView>(({ view: v, ctx }) => {
  const name = nameOf(ctx, 'mission', v.mission)
  const board = ctx.names.name('mission_board', v.board.code, v.board.name)
  const back = ctx.acts.find(isBack)
  const accept = ctx.by('mission.accept')[0]
  const yes = ctx.by('mission.abandon_confirm')[0]
  if (v.abandoning) {
    return (
      <Page title={name} tone="violet">
        <Popup
          open onClose={() => back && ctx.go(back)} tone="red" dismissible={!ctx.busy} title={t('ac.mission.abandon_title')}
          footer={<ActionRow><ActionButton tone="steel" small onClick={() => back && ctx.go(back)}>{t('common.cancel')}</ActionButton>{yes && <ActionButton tone="red" busy={ctx.busy} onClick={() => ctx.go(yes)}>{t('ac.mission.abandon_yes')}</ActionButton>}</ActionRow>}
        >
          <Hero><Medallion icon="missions" palette="ruby" /></Hero>
          <Note>{t('ac.mission.abandon_ask', { mission: name })}</Note>
        </Popup>
      </Page>
    )
  }
  const facts = [
    ...(v.min_level > 0 ? [{ label: t('ac.mission.min_level'), value: formatNumber(v.min_level) }] : []),
    ...((v.requires ?? []).length ? [{ label: t('ac.mission.requires'), value: (v.requires ?? []).map((m) => nameOf(ctx, 'mission', m)).join('، ') }] : []),
    ...(v.time_limit_seconds > 0 ? [{ label: t('ac.mission.time_limit'), value: roughDuration(v.time_limit_seconds) }] : []),
    ...(v.repeatable ? [{ label: t('ac.mission.repeatable'), value: v.cooldown_seconds > 0 ? t('ac.mission.repeat_after', { t: roughDuration(v.cooldown_seconds) }) : t('ac.mission.repeat_any') }] : []),
    { label: t('ac.mission.at_most'), value: formatNumber(v.max) },
  ]
  return (
    <Page title={name} tone="violet">
      <Panel tone="violet">
        <Hint>{t('ac.mission.where', { board })}</Hint>
        <SectionTitle>{t('ac.mission.goals')}</SectionTitle>
        <Objectives ctx={ctx} list={v.objectives} />
        <SectionTitle>{t('ac.mission.reward')}</SectionTitle>
        <Facts rows={rewardRows(ctx, v.reward)} />
        <Facts rows={facts} />
      </Panel>
      {v.blocked && <Panel tone="ruby"><Lead tone="bad">{blockedText(v.blocked, { wait: v.wait_seconds, level: v.min_level, max: v.max })}</Lead></Panel>}
      {accept && <Btns ctx={ctx} list={[accept]} tone="gold" />}
    </Page>
  )
})

/** What just happened, above the player's missions. */
function NoticeCard({ ctx, n }: { ctx: FlowCtx; n: MissionNotice }) {
  const mission = nameOf(ctx, 'mission', n.mission)
  const good = n.kind !== 'abandoned'
  return (
    <Panel tone={good ? 'emerald' : 'sapphire'}>
      <Lead tone={good ? 'good' : undefined}>{tx(`ac.mission.notice.${n.kind}`, { mission, qty: formatNumber(n.qty) })}</Lead>
      {n.kind === 'completed' && (n.cash > 0 || n.xp > 0) && (
        <Facts rows={[
          ...(n.cash > 0 ? [{ label: t('ac.mission.paid'), value: money(n.cash), gold: true }] : []),
          ...(n.xp > 0 ? [{ label: t('ac.mission.reward_xp'), value: formatNumber(n.xp) }] : []),
        ]} />
      )}
      {n.kind === 'completed' && n.withheld > 0 && <Hint>{t('ac.mission.withheld', { n: money(n.withheld) })}</Hint>}
    </Panel>
  )
}

/** A mission already done, given up or out of time, in one line. */
const recentLine = (ctx: FlowCtx, m: MissionProgressLine): string => tx(`ac.mission.recent.${m.status}`, { mission: nameOf(ctx, 'mission', m.mission), cash: money(m.cash) })

export const MissionsMine = flow<MissionsMineView>(({ view: v, ctx }) => {
  const active = v.active ?? []
  const recent = v.recent ?? []
  const mine = (id: string, m: MissionProgressLine) => ctx.acts.find((a) => a.id === id && a.args?.no === String(m.no))
  return (
    <Page title={t('ac.mission.mine_title')} tone="violet">
      {v.notice && <NoticeCard ctx={ctx} n={v.notice} />}
      <Panel tone="violet">
        <Lead>{t('ac.mission.mine_count', { n: formatNumber(active.length), max: formatNumber(v.max) })}</Lead>
        {!active.length && <Hint>{t('ac.mission.mine_none')}</Hint>}
      </Panel>
      {active.map((m) => {
        const deliver = mine('mission.deliver', m)
        const abandon = mine('mission.abandon', m)
        return (
          <Panel key={m.no} tone="violet">
            <SectionTitle>{nameOf(ctx, 'mission', m.mission)}</SectionTitle>
            <Objectives ctx={ctx} list={m.objectives} progress />
            {m.left_seconds > 0 && <Hint>{t('ac.mission.left', { t: roughDuration(m.left_seconds) })}</Hint>}
            <div className="vf-btns row">
              {deliver && <Slab tone="gold" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(deliver)}>{t('ac.mission.deliver')}</Slab>}
              {abandon && <Slab tone="red" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(abandon)}>{t('ac.mission.abandon')}</Slab>}
            </div>
          </Panel>
        )
      })}
      {recent.length > 0 && (
        <Panel>
          <SectionTitle>{t('ac.mission.recent_title')}</SectionTitle>
          <div className="vf-list">
            {recent.map((m) => <div key={m.no} className="vf-line"><span>{recentLine(ctx, m)}{m.withheld > 0 ? ` – ${t('ac.mission.withheld_short')}` : ''}</span></div>)}
          </div>
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.by('mission.boards')} />
    </Page>
  )
})

export const MissionRefusal = flow<MissionRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{tx(`ac.mission.refused.${v.kind}`)}</Lead>
      {v.kind === 'blocked' && v.blocked && <Hint tone="bad">{blockedText(v.blocked, { wait: v.wait_seconds, level: v.level, max: v.max })}</Hint>}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

Object.assign(HEALTH_SCREENS, {
  treat_confirm: TreatConfirm, treated: Treated, clinic_desk: ClinicDesk, health_refusal: HealthRefusal,
  mission: Mission, missions_mine: MissionsMine, mission_refusal: MissionRefusal,
})
