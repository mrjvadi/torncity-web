// War: the board, the flow that declares a war, the decision to join, settle or resume one, the war room,
// a target, launching an operation, its report, the notice of war and the refusals. Everything is drawn
// from the view and the actions of the answer (docs/adr/0039-presentation-split.md); wars, operations,
// grounds, objectives, bands and cities are named from the catalogue, never from here.

import type {
  DeclareView, LaunchView, OccupationLine, OperationLine, StrikeReportView, WarBlockedView, WarBoardView, WarDecisionView, WarLine,
  WarNoticeView, WarRefusalView, WarRoomView, WarTargetView,
} from '../../api/views.gen'
import { ListRow, SectionTitle } from '../native/kit/Parts'
import { formatNumber } from '../native/kit/format'
import { ActionButton } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { placeName } from '../society/common'
import {
  ConfirmPopup, NoticeCard, NotHere, QtyRow, Tail, byId, chanceName, cityName, className, damageName, find, groundName, objectiveName,
  officeText, operationName, place, proposalName, bandName,
} from './kit'
import { bpsPct } from './wording'
import { CardGrid } from '../../ui/v6/panel'

const key = (k: string) => k as Key
const list = (items: string[]): string => items.join(t('common.sep') + ' ')

/** A line of a block: a label and what stands at the end. */
function Row({ label, value }: { label: string; value: string }) {
  return <div className="mil-line"><span>{label}</span><b>{value}</b></div>
}

// -- the board -----------------------------------------------------------------------------------------

function WarBlock({ ctx, w }: { ctx: FlowCtx; w: WarLine }) {
  const sides = (cs: typeof w.attacker_allies) => list((cs ?? []).map((c) => place(ctx, c)))
  const status = hasKey(`mil.war.status.${w.status}`) ? t(key(`mil.war.status.${w.status}`), { in: durationText(w.active_in_seconds), since: durationText(w.since_seconds) }) : ''
  const answers = ctx.acts.filter((a) => (a.id === 'war.accept' || a.id === 'war.decline'))
  const mine = (id: string) => ctx.acts.filter((a) => a.id === id && a.args?.no === String(w.no))
  const propose = [...mine('war.ceasefire'), ...mine('war.peace')]
  return (
    <div className="mil-block">
      <div className="mil-head"><span>{t('mil.war.title', { attacker: place(ctx, w.attacker), defender: place(ctx, w.defender) })}</span><span>{t('mil.war.no', { no: formatNumber(w.no) })}</span></div>
      <Hint>{status}{w.ground ? ` – ${t('mil.war.ground', { ground: groundName(ctx, w.ground) })}` : ''}</Hint>
      {(w.attacker_allies ?? []).length > 0 && <Hint>{t('mil.war.attacker_allies', { list: sides(w.attacker_allies) })}</Hint>}
      {(w.defender_allies ?? []).length > 0 && <Hint>{t('mil.war.defender_allies', { list: sides(w.defender_allies) })}</Hint>}
      {w.broke && <Hint tone="bad">{t('mil.war.broke')}</Hint>}
      {(w.proposals ?? []).map((p) => {
        const mineAnswers = answers.filter((a) => a.args?.no === String(p.no))
        return (
          <div key={p.no} className={`mil-block${p.incoming ? ' mil-incoming' : ''}`}>
            <Lead>{t(p.incoming ? 'mil.war.proposal_in' : 'mil.war.proposal_out', { other: place(ctx, p.other), kind: proposalName(ctx, p.kind), in: durationText(p.expires_in_seconds) })}</Lead>
            {p.incoming && <Btns ctx={ctx} list={mineAnswers} row />}
          </div>
        )
      })}
      <Btns ctx={ctx} list={[...propose, ...mine('war.resume')]} row />
    </div>
  )
}

function Occupied({ ctx, o }: { ctx: FlowCtx; o: OccupationLine }) {
  return (
    <Hint>{t('mil.war.occupied', { city: cityName(ctx, o.city_code, o.city), controller: place(ctx, o.controller), owner: place(ctx, o.de_jure) })} – {durationText(o.since_seconds)}</Hint>
  )
}

/** One operation as the public sees it: told in bands, never in counts. */
export function OperationBlock({ ctx, o }: { ctx: FlowCtx; o: OperationLine }) {
  return (
    <div className="mil-block">
      <div className="mil-head">
        <span>{t('mil.op.title', { kind: operationName(ctx, o.kind), objective: objectiveName(ctx, o.objective), city: cityName(ctx, o.city_code, o.city) })}</span>
        <span>{t('mil.op.no', { no: formatNumber(o.no) })}</span>
      </div>
      <Hint>{t('mil.op.sides', { country: place(ctx, o.country), target: place(ctx, o.target) })}</Hint>
      {o.called_off && <Hint>{t('mil.op.called_off')}</Hint>}
      {o.pending && !o.called_off && <Hint>{t('mil.op.pending', { in: durationText(o.strikes_in_seconds) })}</Hint>}
      {!o.pending && !o.called_off && (
        <>
          {o.damage_band && <Row label={t('mil.op.damage')} value={damageName(ctx, o.damage_band)} />}
          {o.lost_band && <Row label={t('mil.op.lost')} value={bandName(ctx, o.lost_band)} />}
          {o.enemy_lost_band && <Row label={t('mil.op.enemy_lost')} value={bandName(ctx, o.enemy_lost_band)} />}
          {o.captured && <Hint tone="good">{t('mil.op.captured')}</Hint>}
          <Hint>{t('mil.op.ago', { ago: durationText(o.ago_seconds) })}</Hint>
        </>
      )}
    </div>
  )
}

const WarBoard = flow<WarBoardView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.war.board_title')} tone="ruby" />
  const room = find(ctx, 'war.room')
  const declare = find(ctx, 'war.declare')
  return (
    <Page title={t('mil.war.board_of', { country: place(ctx, v.country) })} tone="ruby">
      <NoticeCard ctx={ctx} n={v.notice} />
      <Panel tone="ruby">
        <SectionTitle>{t('mil.war.wars')}</SectionTitle>
        {(v.wars ?? []).length === 0 && <Hint>{t('mil.war.none')}</Hint>}
        {(v.wars ?? []).map((w) => <WarBlock key={w.no} ctx={ctx} w={w} />)}
      </Panel>
      {(v.joinable ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('mil.war.joinable')}</SectionTitle>
          {(v.joinable ?? []).map((j) => {
            const join = ctx.acts.find((a) => a.id === 'war.join' && a.args?.no === String(j.war_no))
            return (
              <div key={j.war_no} className="mil-block">
                <Lead>{t('mil.war.join_line', { ally: place(ctx, j.ally), enemy: place(ctx, j.enemy) })}</Lead>
                {join && <Btns ctx={ctx} list={[join]} />}
              </div>
            )
          })}
        </Panel>
      )}
      {(v.operations ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('mil.war.operations')}</SectionTitle>
          {(v.operations ?? []).map((o) => <OperationBlock key={o.no} ctx={ctx} o={o} />)}
        </Panel>
      )}
      {((v.occupied ?? []).length > 0 || (v.damaged ?? []).length > 0) && (
        <Panel>
          <SectionTitle>{t('mil.war.cities')}</SectionTitle>
          {(v.occupied ?? []).map((o) => <Occupied key={o.city_code} ctx={ctx} o={o} />)}
          {(v.damaged ?? []).map((d) => (
            <Hint key={d.city_code}>{t('mil.war.damaged', { city: cityName(ctx, d.city_code, d.city), band: damageName(ctx, d.band) })}{d.closed_in_seconds > 0 ? ` – ${t('mil.war.closed_for', { in: durationText(d.closed_in_seconds) })}` : ''}</Hint>
          ))}
        </Panel>
      )}
      {(room || declare) && (
        <CardGrid>
          {room && <ListRow icon="radar" palette="ruby" title={ctx.label(room)} sub={t('mil.war.room_sub')} onClick={() => ctx.go(room)} />}
          {declare && <ListRow icon="x_flag" palette="ruby" title={ctx.label(declare)} sub={t('mil.war.declare_sub')} onClick={() => ctx.go(declare)} />}
        </CardGrid>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- declaring a war: the country, the ground, confirm -------------------------------------------------

const Declare = flow<DeclareView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.declare.title')} tone="ruby" />
  const targets = byId(ctx, 'war.declare_target')
  const grounds = byId(ctx, 'war.declare_ground')
  if (v.target && v.ground) {
    const yes = byId(ctx, 'war.declare_confirm')[0]
    const target = place(ctx, v.target)
    return (
      <ConfirmPopup title={t('mil.declare.confirm_title', { target })} ctx={ctx} tone="red"
        footer={yes && <ActionButton tone="red" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={[
          { label: t('mil.declare.target'), value: target },
          { label: t('mil.declare.ground'), value: groundName(ctx, v.ground) },
          { label: t('mil.declare.notice'), value: durationText(v.notice_seconds) },
        ]} />
        {(v.breaks ?? []).length > 0 && <Hint tone="bad">{t('mil.declare.breaks', { list: list((v.breaks ?? []).map((b) => ctx.names.name(['treaty_kind'], b.code, b.name))) })}</Hint>}
        {(v.allies ?? []).length > 0 && <Hint>{t('mil.declare.allies', { list: list((v.allies ?? []).map((a) => place(ctx, a))) })}</Hint>}
        <Hint>{t('mil.declare.confirm_hint')}</Hint>
      </ConfirmPopup>
    )
  }
  return (
    <Page title={t('mil.declare.title')} tone="ruby">
      <Panel tone="ruby">
        {!v.target ? (
          <>
            <Lead>{t('mil.declare.pick_target')}</Lead>
            {targets.length === 0 && <Hint>{t('mil.declare.no_targets')}</Hint>}
            <CardGrid>
              {targets.map((a) => <ListRow key={a.subject} icon="x_flag" palette="ruby" title={placeName(ctx.names, (v.targets ?? []).find((p) => p.code === a.subject)) || ctx.label(a)} onClick={() => ctx.go(a)} />)}
            </CardGrid>
          </>
        ) : (
          <>
            <Lead>{t('mil.declare.pick_ground', { target: place(ctx, v.target) })}</Lead>
            <Btns ctx={ctx} list={grounds} />
          </>
        )}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- joining, settling or resuming a war: one decision -------------------------------------------------

const WarDecision = flow<WarDecisionView>(({ view: v, ctx }) => {
  const kind = ['join', 'ceasefire', 'peace', 'resume'].includes(v.kind) ? v.kind : 'join'
  const yes = ctx.acts.find((a) => (a.id ?? '').endsWith('_confirm'))
  return (
    <ConfirmPopup title={t(key(`mil.decision.${kind}.title`))} ctx={ctx} tone={kind === 'join' || kind === 'resume' ? 'red' : 'navy'}
      footer={yes && <ActionButton tone={kind === 'join' || kind === 'resume' ? 'red' : 'green'} disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
      <Lead>{t(key(`mil.decision.${kind}.body`), {
        no: formatNumber(v.war_no), other: place(ctx, v.other), ally: place(ctx, v.ally), notice: durationText(v.notice_seconds), ttl: durationText(v.ttl_seconds),
      })}</Lead>
    </ConfirmPopup>
  )
})

// -- the war room: the enemy's cities, what is under way -----------------------------------------------

const WarRoom = flow<WarRoomView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.room.title')} tone="ruby" />
  return (
    <Page title={t('mil.room.title')} tone="ruby">
      <NoticeCard ctx={ctx} n={v.notice} />
      <Panel tone="ruby">
        <Facts rows={[{ label: t('mil.readiness'), value: bpsPct(v.readiness) }]} />
      </Panel>
      <Panel>
        <SectionTitle>{t('mil.room.targets')}</SectionTitle>
        {(v.targets ?? []).length === 0 && <Hint>{t('mil.room.no_targets')}</Hint>}
        <CardGrid>
          {(v.targets ?? []).map((tg) => {
            const open = ctx.acts.find((a) => a.id === 'war.target' && a.subject === tg.city_code)
            return (
              <ListRow key={tg.city_code} icon="radar" palette="ruby" title={cityName(ctx, tg.city_code, tg.city)}
                sub={`${place(ctx, tg.country)} – ${t('mil.room.distance', { km: formatNumber(tg.distance_km) })}${tg.damage_band ? ` – ${damageName(ctx, tg.damage_band)}` : ''}`}
                onClick={open ? () => ctx.go(open) : undefined} />
            )
          })}
        </CardGrid>
      </Panel>
      {(v.running ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('mil.room.running')}</SectionTitle>
          {(v.running ?? []).map((o) => <OperationBlock key={o.no} ctx={ctx} o={o} />)}
        </Panel>
      )}
      <Tail ctx={ctx} />
    </Page>
  )
})

const WarTarget = flow<WarTargetView>(({ view: v, ctx }) => {
  const tg = v.target
  return (
    <Page title={cityName(ctx, tg.city_code, tg.city)} tone="ruby">
      <Panel tone="ruby">
        <Facts rows={[
          { label: t('mil.target.country'), value: place(ctx, tg.country) },
          { label: t('mil.target.distance'), value: t('mil.room.distance', { km: formatNumber(tg.distance_km) }) },
          ...(tg.damage_band ? [{ label: t('mil.target.damage'), value: damageName(ctx, tg.damage_band) }] : []),
        ]} />
        {v.occupied && <Hint>{t('mil.war.occupied', { city: cityName(ctx, v.occupied.city_code, v.occupied.city), controller: place(ctx, v.occupied.controller), owner: place(ctx, v.occupied.de_jure) })}</Hint>}
      </Panel>
      <Panel>
        <SectionTitle>{t('mil.target.options')}</SectionTitle>
        {(v.options ?? []).length === 0 && <Hint>{t('mil.target.no_options')}</Hint>}
        {(v.options ?? []).map((o) => {
          const open = ctx.acts.find((a) => a.id === 'war.launch_open' && a.subject === o.kind && a.args?.class === (o.kind === 'ground' ? 'all' : o.class.code))
          return (
            <div key={`${o.kind}-${o.class.code}`} className="mil-block">
              <div className="mil-head"><span>{operationName(ctx, o.kind)}</span><span>{className(ctx, o.class)}</span></div>
              <Row label={t('mil.target.ready')} value={formatNumber(o.ready)} />
              <Row label={t('mil.target.from')} value={`${cityName(ctx, o.from_code, o.from)} – ${t('mil.room.distance', { km: formatNumber(o.distance_km) })}`} />
              {o.kind === 'air' && <Row label={t('mil.target.munitions')} value={formatNumber(o.munitions)} />}
              {!o.can_launch && <Hint>{t('mil.target.not_yours', { office: officeText(ctx, o.office) || t('mil.unnamed_office') })}</Hint>}
              {open && <Btns ctx={ctx} list={[open]} />}
            </div>
          )
        })}
      </Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

// -- launching an operation: objective, how many, estimate, confirm ------------------------------------

const Launch = flow<LaunchView>(({ view: v, ctx }) => {
  const op = operationName(ctx, v.option.kind)
  const title = t('mil.launch.title', { kind: op, city: cityName(ctx, v.target.city_code, v.target.city) })
  const summary = [
    { label: t('mil.launch.class'), value: className(ctx, v.option.class) },
    { label: t('mil.target.ready'), value: formatNumber(v.option.ready) },
  ]
  if (v.confirm) {
    const yes = byId(ctx, 'war.launch_confirm')[0]
    return (
      <ConfirmPopup title={title} ctx={ctx} tone="red"
        footer={yes && <ActionButton tone="red" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={[
          { label: t('mil.launch.kind'), value: op },
          ...summary.slice(0, 1),
          { label: t('mil.launch.objective'), value: objectiveName(ctx, v.objective) },
          { label: t('mil.launch.qty'), value: formatNumber(v.qty), gold: true },
          { label: t('mil.launch.prepare'), value: durationText(v.prepare_seconds) },
          ...(v.munitions > 0 ? [{ label: t('mil.target.munitions'), value: formatNumber(v.munitions) }] : []),
        ]} />
        {v.estimate && (
          <div className="mil-block">
            <Hint>{t('mil.launch.estimate')}</Hint>
            <Row label={t('mil.launch.chance')} value={chanceName(ctx, v.estimate.chance)} />
            <Row label={t('mil.launch.loss')} value={bandName(ctx, v.estimate.loss_band)} />
            <Row label={t('mil.launch.damage')} value={damageName(ctx, v.estimate.damage_band)} />
          </div>
        )}
        <Hint>{t('mil.launch.confirm_hint')}</Hint>
      </ConfirmPopup>
    )
  }
  const objectives = byId(ctx, 'war.launch_objective')
  const qty = byId(ctx, 'war.launch_qty')
  return (
    <Page title={title} tone="ruby">
      <Panel tone="ruby">
        <Facts rows={summary} />
        {!v.objective ? (
          <>
            <Lead>{t('mil.launch.pick_objective')}</Lead>
            <Btns ctx={ctx} list={objectives} />
          </>
        ) : (
          <>
            <Lead>{t('mil.launch.pick_qty', { objective: objectiveName(ctx, v.objective) })}</Lead>
            <QtyRow ctx={ctx} list={qty} />
          </>
        )}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- an operation's report -----------------------------------------------------------------------------

const StrikeReport = flow<StrikeReportView>(({ view: v, ctx }) => {
  const k = v.ours ? 'ours' : 'theirs'
  const rows = [
    { label: t('mil.report.committed'), value: formatNumber(v.committed) },
    { label: t('mil.report.lost'), value: formatNumber(v.lost) },
    { label: t('mil.report.damaged'), value: formatNumber(v.damaged) },
    { label: t('mil.report.enemy_lost'), value: formatNumber(v.enemy_lost) },
    { label: t('mil.report.enemy_dmg'), value: formatNumber(v.enemy_dmg) },
    ...(v.fired > 0 ? [{ label: t('mil.report.fired'), value: formatNumber(v.fired) }] : []),
    ...(v.munitions > 0 ? [{ label: t('mil.target.munitions'), value: formatNumber(v.munitions) }] : []),
    ...(v.fired > 0 || v.hits > 0 ? [{ label: t('mil.report.hits'), value: formatNumber(v.hits) }] : []),
    ...(v.seen_at_km > 0 ? [{ label: t('mil.report.seen_at'), value: t('mil.room.distance', { km: formatNumber(v.seen_at_km) }) }] : []),
    { label: t('mil.report.damage'), value: `${bpsPct(v.damage_bps)}${v.damage_band ? ` – ${damageName(ctx, v.damage_band)}` : ''}`, gold: true },
  ]
  return (
    <Page title={t(`mil.report.title_${k}` as Key, { no: formatNumber(v.no) })} tone="ruby">
      <Panel tone="ruby">
        <Lead>{t(`mil.report.head_${k}` as Key, {
          kind: operationName(ctx, v.kind), objective: objectiveName(ctx, v.objective), city: cityName(ctx, v.city_code, v.city), target: place(ctx, v.target), country: place(ctx, v.country),
          class: className(ctx, v.class),
        })}</Lead>
        {v.called_off && <Hint>{t('mil.op.called_off')}</Hint>}
        {!v.called_off && <Facts rows={rows} />}
        {v.captured && <Hint tone="good">{t('mil.report.captured')}</Hint>}
        {v.liberated && <Hint tone="good">{t('mil.report.liberated')}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
      <Tail ctx={ctx} />
    </Page>
  )
})

// -- the notice of war, and what war refuses -----------------------------------------------------------

const WarNotice = flow<WarNoticeView>(({ view: v, ctx }) => {
  const kind = ['struck', 'ally', 'proposal', 'declared'].includes(v.kind) ? v.kind : 'declared'
  const inj = v.injury
  return (
    <Page title={t(`mil.notice_title.${kind}` as Key)} tone="ruby">
      <Panel tone="ruby">
        <Lead>{t(`mil.war_notice.${kind}` as Key, {
          city: cityName(ctx, v.city_code, v.city), band: damageName(ctx, v.band), other: place(ctx, v.other), ally: place(ctx, v.ally), country: place(ctx, v.country),
          kindname: proposalName(ctx, v.proposal_kind), in: durationText(v.in_seconds), no: formatNumber(v.war_no),
        })}</Lead>
        {inj && (
          <Facts rows={[
            { label: t('mil.injury.damage'), value: formatNumber(inj.damage) },
            { label: t('mil.injury.health'), value: t('mil.injury.of', { health: formatNumber(inj.health), max: formatNumber(inj.max) }) },
            ...(inj.hospital ? [{ label: t('mil.injury.hospital'), value: t('mil.injury.in_hospital') }] : []),
          ]} />
        )}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
      <Tail ctx={ctx} />
    </Page>
  )
})

const WarRefusal = flow<WarRefusalView>(({ view: v, ctx }) => {
  const k = `mil.war_refused.${v.kind}`
  const text = hasKey(k)
    ? t(key(k), { country: place(ctx, v.country), office: officeText(ctx, v.office) || t('mil.unnamed_office'), in: durationText(v.in_seconds), max: formatNumber(v.max) })
    : t('refusal.unknown')
  return (
    <Page title={t('mil.refused.title')} tone="ruby">
      <Panel tone="ruby"><Lead tone="bad">{text}</Lead></Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const WarBlocked = flow<WarBlockedView>(({ view: v, ctx }) => (
  <Page title={t('mil.blocked.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{v.border
        ? t('mil.blocked.border', { from: place(ctx, v.from), to: place(ctx, v.to) })
        : t('mil.blocked.city', { city: cityName(ctx, v.city_code, v.city), in: durationText(v.in_seconds) })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

registerFlow({
  war_board: WarBoard, war_declare: Declare, war_decision: WarDecision, war_room: WarRoom, war_target: WarTarget, war_launch: Launch,
  strike_report: StrikeReport, war_notice: WarNotice, war_refusal: WarRefusal, war_blocked: WarBlocked,
})

/** The screens this file draws. */
export const WAR_SCREENS = [
  'war_board', 'war_declare', 'war_decision', 'war_room', 'war_target', 'war_launch', 'strike_report', 'war_notice', 'war_refusal', 'war_blocked',
]
