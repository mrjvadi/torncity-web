// Diplomacy: a country's sanctions board and the flow that imposes and lifts a sanction, the
// treaties board and the flows that propose, answer and end a treaty, the public record, and the
// refusal a sanction answers a blocked action with. Public business: anyone reads the boards;
// deciding is the office holder's.

import { CardGrid } from '../../ui/v6/panel'
import type {
  DiplomacyHistoryView, DiplomacyNotice, DiplomacyRefusalView, EndTreatyView, ImposeView, LiftView, ProposeView, SanctionBlockedView,
  SanctionLine, SanctionsView, TreatiesView, TreatyLine,
} from '../../api/views.gen'
import type { Action } from '../../api/types'
import { SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { t } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'
import { Btns, Cancel, Facts, Hint, Lead, Page, Panel, Rest, type FlowCtx } from '../village/flow'
import { screen } from './host'
import { Pager } from './governance'
import { officeName, placeName, playerText, span, word } from './common'

const measureName = (names: ContentNames, code: string) => names.name(['sanction_measure'], code, code)
const groundName = (names: ContentNames, code: string) => names.name(['sanction_ground'], code, code)
const treatyName = (names: ContentNames, n: { code: string; name: string }) => names.name(['treaty_kind'], n.code, n.name)
const measures = (names: ContentNames, list: string[] | null) => (list ?? []).map((m) => measureName(names, m)).join(t('common.sep') + ' ')

function Notice({ ctx, n }: { ctx: FlowCtx; n: DiplomacyNotice | null }) {
  if (!n) return null
  const place = placeName(ctx.names, n.place)
  return (
    <Panel tone="emerald">
      <Lead tone="good">{word(`soc.dip.notice.${n.kind}`, '', { target: place, partner: place, kind: treatyName(ctx.names, n.treaty), in: span(n.in_seconds) })}</Lead>
    </Panel>
  )
}

function SanctionBlock({ ctx, s, imposed, lift }: { ctx: FlowCtx; s: SanctionLine; imposed: boolean; lift?: Action }) {
  const other = imposed ? s.target : s.imposer
  return (
    <div className="sc-block">
      <div className="sc-line">
        <span className="sc-line-title">{t(imposed ? 'soc.dip.line_on' : 'soc.dip.line_by', { no: formatNumber(s.no), country: placeName(ctx.names, other) })}</span>
      </div>
      <Hint>{measures(ctx.names, s.measures)} – {t('soc.dip.ground', { ground: groundName(ctx.names, s.ground) })}</Hint>
      <Hint>{s.in_force_in_seconds > 0 ? t('soc.dip.pending', { in: span(s.in_force_in_seconds) }) : t('soc.dip.since', { since: span(s.since_seconds) })}
        {s.by ? ` – ${t('soc.dip.by', { office: officeName(ctx.names, s.office), player: playerText(s.by) })}` : ''}</Hint>
      {imposed && !s.liftable && s.liftable_in_seconds > 0 && <Hint>{t('soc.dip.liftable_in', { in: span(s.liftable_in_seconds) })}</Hint>}
      {lift && <Btns ctx={ctx} list={[lift]} />}
    </div>
  )
}

const Sanctions = screen<SanctionsView>(({ view: v, ctx }) => {
  const lifts = ctx.acts.filter((a) => a.id === 'diplomacy.lift')
  return (
    <Page title={t('soc.dip.sanctions_title', { country: placeName(ctx.names, v.country) })} tone="ruby">
      <Notice ctx={ctx} n={v.notice} />
      <Panel tone="ruby">
        <SectionTitle>{t('soc.dip.imposed')}</SectionTitle>
        {(v.imposed ?? []).length === 0 && <Hint>{t('soc.dip.none')}</Hint>}
        <CardGrid>
        {(v.imposed ?? []).map((s) => <SanctionBlock key={s.no} ctx={ctx} s={s} imposed lift={lifts.find((a) => a.args?.no === String(s.no))} />)}
        </CardGrid>
      </Panel>
      <Panel>
        <SectionTitle>{t('soc.dip.suffered')}</SectionTitle>
        {(v.suffered ?? []).length === 0 && <Hint>{t('soc.dip.none')}</Hint>}
        <CardGrid>{(v.suffered ?? []).map((s) => <SanctionBlock key={s.no} ctx={ctx} s={s} imposed={false} />)}</CardGrid>
      </Panel>
      <Hint>{t('soc.dip.sanctions_footer')}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'diplomacy.lift'} />
    </Page>
  )
})

const Impose = screen<ImposeView>(({ view: v, ctx }) => {
  const country = placeName(ctx.names, v.country)
  const by = (id: string) => ctx.acts.filter((a) => a.id === id)
  const targets = by('diplomacy.target'), toggles = by('diplomacy.measure'), grounds = by('diplomacy.ground'), next = by('diplomacy.next')
  const confirm = by('diplomacy.impose.confirm')
  const shown = new Set<Action>([...targets, ...toggles, ...grounds, ...next, ...confirm])
  return (
    <Page title={t('soc.dip.impose_title', { country })} tone="ruby">
      <Panel tone="ruby">
        {!v.target && (
          <>
            <Lead>{t('soc.dip.choose_target')}</Lead>
            {targets.length === 0 && <Hint>{t('soc.dip.no_targets')}</Hint>}
            <div className="vf-btns">{targets.map((a) => <Slab key={a.subject} tone="steel" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{placeName(ctx.names, (v.targets ?? []).find((p) => p.code === a.subject))}</Slab>)}</div>
          </>
        )}
        {v.target && !v.ground && (v.grounds ?? []).length === 0 && (
          <>
            <Lead>{t('soc.dip.choose_measures', { target: placeName(ctx.names, v.target) })}</Lead>
            <div className="vf-btns row">
              {toggles.map((a) => {
                const m = (v.measures ?? []).find((x) => x.code === a.subject)
                return <Slab key={a.subject} tone={m?.on ? 'gold' : 'steel'} radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(a)}>{`${m?.on ? '✓ ' : ''}${measureName(ctx.names, a.subject ?? '')}`}</Slab>
              })}
            </div>
            <Btns ctx={ctx} list={next} />
          </>
        )}
        {v.target && !v.ground && (v.grounds ?? []).length > 0 && (
          <>
            <Lead>{t('soc.dip.choose_ground', { target: placeName(ctx.names, v.target), measures: measures(ctx.names, v.chosen) })}</Lead>
            <div className="vf-btns row">{grounds.map((a) => <Slab key={a.subject} tone="steel" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(a)}>{groundName(ctx.names, a.subject ?? '')}</Slab>)}</div>
          </>
        )}
        {v.target && v.ground && (
          <>
            <Lead>{t('soc.dip.impose_confirm', { target: placeName(ctx.names, v.target) })}</Lead>
            <Facts rows={[
              { label: t('soc.dip.measures'), value: measures(ctx.names, v.chosen) },
              { label: t('soc.dip.ground_label'), value: groundName(ctx.names, v.ground) },
              { label: t('soc.dip.binds_in'), value: span(v.notice_seconds) },
              { label: t('soc.dip.min_stands'), value: span(v.min_duration_seconds) },
            ]} />
            <Btns ctx={ctx} list={confirm} tone="red" />
            <Cancel ctx={ctx} />
          </>
        )}
      </Panel>
      <Rest ctx={ctx} skip={(a) => shown.has(a)} />
    </Page>
  )
})

const Lift = screen<LiftView>(({ view: v, ctx }) => (
  <Page title={t('soc.dip.lift_title')} tone="sapphire">
    <Panel tone="sapphire">
      <Lead>{t('soc.dip.lift_confirm', { no: formatNumber(v.sanction.no), target: placeName(ctx.names, v.sanction.target), measures: measures(ctx.names, v.sanction.measures) })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'diplomacy.lift.confirm')} />
    <Cancel ctx={ctx} />
  </Page>
))

function TreatyBlock({ ctx, tr, acts }: { ctx: FlowCtx; tr: TreatyLine; acts: Action[] }) {
  const kind = treatyName(ctx.names, tr.kind)
  const country = placeName(ctx.names, tr.other)
  const key = tr.status === 'proposed' ? (tr.incoming ? 'incoming' : 'outgoing') : tr.status === 'active' ? 'active' : `ended_${tr.status}`
  return (
    <div className="sc-block">
      <Lead>{word(`soc.dip.treaty.${key}`, kind, { no: formatNumber(tr.no), kind, country, in: span(tr.expires_in_seconds), since: span(tr.since_seconds) })}</Lead>
      <Btns ctx={ctx} list={acts} row />
    </div>
  )
}

const Treaties = screen<TreatiesView>(({ view: v, ctx }) => {
  const used = new Set<Action>()
  return (
    <Page title={t('soc.dip.treaties_title', { country: placeName(ctx.names, v.country) })} tone="sapphire">
      <Notice ctx={ctx} n={v.notice} />
      <Panel tone="sapphire">
        {(v.treaties ?? []).length === 0 && <Lead>{t('soc.dip.treaties_none')}</Lead>}
        <CardGrid>
        {(v.treaties ?? []).map((tr) => {
          const acts = ctx.acts.filter((a) => a.args?.no === String(tr.no) && (a.command === 'diplomacy.answer' || a.command === 'diplomacy.end'))
          acts.forEach((a) => used.add(a))
          return <TreatyBlock key={tr.no} ctx={ctx} tr={tr} acts={acts} />
        })}
        </CardGrid>
      </Panel>
      <Hint>{t('soc.dip.treaties_footer')}</Hint>
      <Rest ctx={ctx} skip={(a) => used.has(a)} />
    </Page>
  )
})

const Propose = screen<ProposeView>(({ view: v, ctx }) => {
  const by = (id: string) => ctx.acts.filter((a) => a.id === id)
  const partners = by('diplomacy.partner'), kinds = by('diplomacy.kind'), confirm = by('diplomacy.propose.confirm')
  const shown = new Set<Action>([...partners, ...kinds, ...confirm])
  return (
    <Page title={t('soc.dip.propose_title', { country: placeName(ctx.names, v.country) })} tone="sapphire">
      <Panel tone="sapphire">
        {!v.partner && (
          <>
            <Lead>{t('soc.dip.choose_partner')}</Lead>
            {partners.length === 0 && <Hint>{t('soc.dip.no_targets')}</Hint>}
            <div className="vf-btns">{partners.map((a) => <Slab key={a.subject} tone="steel" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{placeName(ctx.names, (v.partners ?? []).find((p) => p.code === a.subject))}</Slab>)}</div>
          </>
        )}
        {v.partner && !v.kind && (
          <>
            <Lead>{t('soc.dip.choose_kind', { partner: placeName(ctx.names, v.partner) })}</Lead>
            <div className="vf-btns">{kinds.map((a) => { const k = (v.kinds ?? []).find((x) => x.code === a.subject); return <Slab key={a.subject} tone="steel" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{k ? treatyName(ctx.names, k) : a.subject}</Slab> })}</div>
          </>
        )}
        {v.partner && v.kind && (
          <>
            <Lead>{t('soc.dip.propose_confirm', { partner: placeName(ctx.names, v.partner), kind: treatyName(ctx.names, v.kind), ttl: span(v.ttl_seconds) })}</Lead>
            <Btns ctx={ctx} list={confirm} />
            <Cancel ctx={ctx} />
          </>
        )}
      </Panel>
      <Rest ctx={ctx} skip={(a) => shown.has(a)} />
    </Page>
  )
})

const EndTreaty = screen<EndTreatyView>(({ view: v, ctx }) => {
  const withdraw = v.treaty.status === 'proposed'
  return (
    <Page title={t(withdraw ? 'soc.dip.withdraw_title' : 'soc.dip.terminate_title')} tone="ruby">
      <Panel tone="ruby">
        <Lead>{t(withdraw ? 'soc.dip.withdraw_confirm' : 'soc.dip.terminate_confirm', { no: formatNumber(v.treaty.no), kind: treatyName(ctx.names, v.treaty.kind), country: placeName(ctx.names, v.treaty.other) })}</Lead>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => (a.id ?? '').endsWith('.confirm'))} tone="red" />
      <Cancel ctx={ctx} />
    </Page>
  )
})

const DiplomacyHistory = screen<DiplomacyHistoryView>(({ view: v, ctx }) => (
  <Page title={t('soc.dip.history_title', { country: placeName(ctx.names, v.country) })} tone="sapphire">
    <Panel tone="sapphire">
      {(v.entries ?? []).length === 0 && <Lead>{t('soc.dip.history_empty')}</Lead>}
      {(v.entries ?? []).map((e, i) => (
        <div key={i} className="sc-block">
          <Lead>{word(`soc.dip.history.${e.kind}`, e.kind, {
            country: placeName(ctx.names, e.country), other: placeName(ctx.names, e.other), measures: measures(ctx.names, e.measures),
            ground: groundName(ctx.names, e.ground), kind: treatyName(ctx.names, e.treaty), no: formatNumber(e.no),
          })}</Lead>
          {e.by && <Hint>{t('soc.dip.history_by', { office: officeName(ctx.names, e.office), player: playerText(e.by), ago: span(e.ago_seconds) })}</Hint>}
        </div>
      ))}
      <Pager ctx={ctx} page={v.page} pages={v.pages} />
    </Panel>
    <Rest ctx={ctx} skip={(a) => a.id === 'page.prev' || a.id === 'page.next'} />
  </Page>
))

const DiplomacyRefusal = screen<DiplomacyRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`soc.refusal.diplomacy.${v.kind}`, t('soc.refusal.unknown'), {
        country: placeName(ctx.names, v.country), office: officeName(ctx.names, v.office) || t('soc.unnamed_office'), in: span(v.in_seconds),
      })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const SanctionBlocked = screen<SanctionBlockedView>(({ view: v, ctx }) => (
  <Page title={t('soc.dip.blocked_title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`soc.dip.blocked.${v.measure}`, t('soc.dip.blocked.any'), { imposer: placeName(ctx.names, v.imposer), target: placeName(ctx.names, v.target) })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const DIPLOMACY_SCREENS = {
  sanctions: Sanctions, impose: Impose, lift: Lift, treaties: Treaties, propose: Propose, end_treaty: EndTreaty,
  diplomacy_history: DiplomacyHistory, diplomacy_refusal: DiplomacyRefusal, sanction_blocked: SanctionBlocked,
}
