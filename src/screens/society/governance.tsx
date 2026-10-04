// Offices and policies: the settlement's government page, the holder's own office, the flow that
// changes a policy (draft, review, confirm, announced), the budget's allocation editor, the public
// record, and appointments by office holders. Words are the web's own (src/i18n/ui.src.txt); names
// of offices, policies and places come from the content catalogue.

import type {
  AllocationConfirmView, AllocationEditView, AppointDoneView, AppointRefusalView, AppointView, CityGovView, DismissView,
  GovHistoryView, GovLever, GovRefusal, LeverEditView, MyOfficeView, PolicyAnnouncedView, PolicyConfirmView, PolicyRefusalView,
} from '../../api/views.gen'
import type { Action } from '../../api/types'
import { Bar, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { t } from '../../i18n'
import { Btns, Cancel, Facts, Hint, Lead, Page, Panel, Rest, type FlowCtx } from '../village/flow'
import { screen } from './host'
import {
  allocationText, bpsText, Line, leverName, leverNow, leverValue, officeName, pick, placeName, playerText, playersText, span, word, key,
} from './common'
import { durationText } from '../village/common'

// -- the government page ----------------------------------------------------------------------

function pendingText(ctx: FlowCtx, l: GovLever): string {
  if (!l.pending) return ''
  const v = l.type === 'allocation' ? allocationText(ctx.names, l.pending.allocation, l.categories) : leverValue(l, l.pending.value)
  return t('soc.gov.pending', { value: v, when: span(l.pending.in_seconds) })
}

function LeverLine({ ctx, l }: { ctx: FlowCtx; l: GovLever }) {
  const origin = l.from_office ? t('soc.gov.set_by', { player: playerText(l.set_by) }) : t('soc.gov.default')
  const alloc = l.type === 'allocation'
  return (
    <div className="sc-block">
      <Line title={leverName(ctx.names, l.code) || t('soc.unnamed_lever')} sub={[origin, alloc ? '' : pendingText(ctx, l)].filter(Boolean).join(' · ')} end={alloc ? undefined : <b className="gold">{leverNow(ctx.names, l)}</b>} />
      {alloc && <Hint>{leverNow(ctx.names, l)}</Hint>}
      {alloc && l.pending && <Hint>{pendingText(ctx, l)}</Hint>}
    </div>
  )
}

const CityGovernance = screen<CityGovView>(({ view: v, ctx }) => {
  const place = placeName(ctx.names, v.city)
  if (v.no_city) {
    return (
      <Page title={t('soc.gov.title_plain')} tone="gold">
        <Panel tone="gold"><Lead>{t('soc.gov.no_city')}</Lead></Panel>
        <Rest ctx={ctx} />
      </Page>
    )
  }
  return (
    <Page title={t('soc.gov.title', { place })} tone="gold">
      {(v.sections ?? []).map((s, i) => (
        <Panel key={i} tone="gold">
          <SectionTitle>{placeName(ctx.names, s.place)}</SectionTitle>
          <div className="sc-lines">
            {(s.offices ?? []).length === 0 && <Hint>{t('soc.gov.no_offices')}</Hint>}
            {(s.offices ?? []).map((o) => {
              const holders = o.holders ?? []
              const end = holders.length
                ? (o.seats > 1 ? t('soc.gov.seats', { held: holders.length, seats: o.seats, players: playersText(holders) }) : playersText(holders))
                : (o.acting_code && (o.acting ?? []).length ? t('soc.gov.acting', { deputy: officeName(ctx.names, o.acting_code), players: playersText(o.acting) }) : t('soc.gov.vacant'))
              return <Line key={o.code} title={officeName(ctx.names, o.code) || t('soc.unnamed_office')} end={end} />
            })}
          </div>
          {(s.levers ?? []).length > 0 && <SectionTitle>{t('soc.gov.policies')}</SectionTitle>}
          <div className="sc-lines">{(s.levers ?? []).map((l) => <LeverLine key={l.code} ctx={ctx} l={l} />)}</div>
        </Panel>
      ))}
      <Rest ctx={ctx} />
    </Page>
  )
})

// -- the holder's own office ----------------------------------------------------------------

const MyOffice = screen<MyOfficeView>(({ view: v, ctx }) => {
  const seats = v.seats ?? []
  const used = new Set<Action>()
  const take = (list: Action[]) => { list.forEach((a) => used.add(a)); return list }
  return (
    <Page title={t('soc.office.title')} tone="gold">
      {seats.length === 0 && <Panel><Lead>{t('soc.office.none')}</Lead></Panel>}
      {seats.map((s, i) => {
        const place = placeName(ctx.names, s.place)
        const mine = (l: GovLever, id: string) => take(pick(ctx, id, 'lever', l.code).filter((a) => a.args?.place === s.place.code))
        return (
          <Panel key={i} tone="gold">
            <SectionTitle>{t('soc.office.seat', { office: officeName(ctx.names, s.office), place })}</SectionTitle>
            {s.acting_for && <Hint>{t('soc.office.acting_for', { office: officeName(ctx.names, s.acting_for) })}</Hint>}
            {(s.levers ?? []).length === 0 && (s.vote_levers ?? []).length === 0 && <Hint>{t('soc.office.no_levers')}</Hint>}
            <div className="sc-lines">
              {(s.levers ?? []).map((l) => (
                <div key={l.code} className="sc-block">
                  <Line title={leverName(ctx.names, l.code)} sub={l.confirm_by ? t('soc.office.confirmed_by', { office: officeName(ctx.names, l.confirm_by) }) : undefined} end={<b className="gold">{leverNow(ctx.names, l)}</b>} />
                  <Btns ctx={ctx} list={mine(l, 'gov.lever.change')} />
                </div>
              ))}
              {(s.vote_levers ?? []).map((l) => (
                <div key={l.code} className="sc-block">
                  <Line title={leverName(ctx.names, l.code)} sub={t('soc.office.by_vote', { office: officeName(ctx.names, l.held_by) })} end={<b className="gold">{leverNow(ctx.names, l)}</b>} />
                  <Btns ctx={ctx} list={mine(l, 'gov.lever.propose')} />
                </div>
              ))}
            </div>
            {(s.appointees ?? []).length > 0 && <SectionTitle>{t('soc.office.appoints')}</SectionTitle>}
            <div className="sc-lines">
              {(s.appointees ?? []).map((ap, j) => {
                const acts = take(ctx.acts.filter((a) => (a.id === 'gov.appoint' || a.id === 'gov.dismiss') && a.args?.office === ap.office && a.args?.place === ap.place.code))
                return (
                  <div key={j} className="sc-block">
                    <Line title={officeName(ctx.names, ap.office)} end={ap.holder ? playerText(ap.holder) : t('soc.gov.vacant')} />
                    <Btns ctx={ctx} list={acts} />
                  </div>
                )
              })}
            </div>
          </Panel>
        )
      })}
      <Rest ctx={ctx} skip={(a) => used.has(a)} />
    </Page>
  )
})

// -- changing a policy -----------------------------------------------------------------------

const LeverEdit = screen<LeverEditView>(({ view: v, ctx }) => {
  const l = v.lever
  const fmt = (n: number) => leverValue(l, n)
  const choices = pick(ctx, 'gov.lever.choose')
  const waiting = v.next_change_in_seconds > 0
  const stepIds = ['gov.lever.down_coarse', 'gov.lever.down_fine', 'gov.lever.up_fine', 'gov.lever.up_coarse']
  const steps = ctx.acts.filter((a) => stepIds.includes(a.id ?? ''))
  const presets = ctx.acts.filter((a) => ['gov.lever.min', 'gov.lever.default', 'gov.lever.max'].includes(a.id ?? ''))
  const shown = new Set<Action>([...choices, ...steps, ...presets])
  const sign = (a: Action) => (a.id ?? '').startsWith('gov.lever.down') ? '−' : '+'
  const amount = (a: Action) => ((a.id ?? '').endsWith('coarse') ? v.coarse_step : v.fine_step)
  return (
    <Page title={leverName(ctx.names, l.code)} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('soc.edit.now'), value: leverNow(ctx.names, l), gold: true },
          ...(choices.length === 0 ? [{ label: t('soc.edit.bounds'), value: t('soc.edit.range', { min: fmt(l.min), max: fmt(l.max) }) }] : []),
          { label: t('soc.edit.default_label'), value: fmt(l.default) },
          { label: t('soc.edit.notice'), value: span(l.notice_seconds) },
          { label: t('soc.edit.cooldown'), value: span(l.cooldown_seconds) },
        ]} />
        {l.pending && <Hint>{pendingText(ctx, l)}</Hint>}
        {waiting
          ? <Hint tone="bad">{t('soc.edit.wait', { wait: span(v.next_change_in_seconds) })}</Hint>
          : (
            <>
              <div className="sc-draft"><span>{t('soc.edit.draft')}</span><b>{fmt(v.draft)}</b></div>
              {choices.length > 0 && (
                <div className="vf-btns">
                  {choices.map((a) => (
                    <Slab key={a.args?.value} tone="steel" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{fmt(Number(a.args?.value))}</Slab>
                  ))}
                </div>
              )}
              {steps.length > 0 && (
                <div className="vf-btns row">
                  {steps.map((a) => (
                    <Slab key={`${a.id}${a.args?.value}`} tone={sign(a) === '+' ? 'green' : 'red'} radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(a)}>
                      <span className="vs-ltr">{sign(a)}{fmt(amount(a))}</span>
                    </Slab>
                  ))}
                </div>
              )}
              {presets.length > 0 && (
                <div className="vf-btns row">
                  {presets.map((a) => (
                    <Slab key={a.id} tone="steel" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(a)}>
                      {t(key(`soc.edit.${(a.id ?? '').slice('gov.lever.'.length)}`), { value: fmt(Number(a.args?.value)) })}
                    </Slab>
                  ))}
                </div>
              )}
            </>
          )}
      </Panel>
      <Rest ctx={ctx} skip={(a) => shown.has(a)} />
    </Page>
  )
})

const PolicyConfirm = screen<PolicyConfirmView>(({ view: v, ctx }) => {
  const l = v.lever
  return (
    <Page title={t('soc.confirm.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('soc.confirm.change', { lever: leverName(ctx.names, l.code), place: placeName(ctx.names, v.place), old: leverValue(l, l.value), now: leverValue(l, v.new_value) })}</Lead>
        <Hint>{v.vote_by ? t('soc.confirm.vote', { office: officeName(ctx.names, v.vote_by) }) : t('soc.confirm.notice', { notice: span(l.notice_seconds) })}</Hint>
        <Hint>{t('soc.confirm.cooldown', { cooldown: span(l.cooldown_seconds) })}</Hint>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'gov.confirm')} />
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'cancel')} />
    </Page>
  )
})

const PolicyAnnounced = screen<PolicyAnnouncedView>(({ view: v, ctx }) => {
  const l = v.lever
  const side = (n: number, shares: Record<string, number> | null) => (l.type === 'allocation' ? allocationText(ctx.names, shares, l.categories) : leverValue(l, n))
  return (
    <Page title={t('soc.announced.title')} tone="emerald">
      <Panel tone="emerald">
        <Lead tone="good">{t('soc.announced.body', { lever: leverName(ctx.names, l.code), place: placeName(ctx.names, v.place) })}</Lead>
        <Facts rows={[
          { label: t('soc.announced.old'), value: side(v.old, v.old_allocation) },
          { label: t('soc.announced.new'), value: side(v.new, v.new_allocation), gold: true },
          { label: t('soc.announced.when'), value: span(v.in_seconds) },
        ]} />
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})

// -- the budget's allocation -----------------------------------------------------------------

const AllocationEdit = screen<AllocationEditView>(({ view: v, ctx }) => {
  const l = v.lever
  const waiting = v.next_change_in_seconds > 0
  const moves = ctx.acts.filter((a) => a.id === 'gov.alloc.down' || a.id === 'gov.alloc.up')
  return (
    <Page title={leverName(ctx.names, l.code)} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('soc.edit.now'), value: leverNow(ctx.names, l), gold: true },
          ...(v.spend_share_bps > 0 ? [{ label: t('soc.alloc.spend'), value: bpsText(v.spend_share_bps) }] : []),
          { label: t('soc.edit.notice'), value: span(l.notice_seconds) },
          { label: t('soc.edit.cooldown'), value: span(l.cooldown_seconds) },
        ]} />
        {l.confirm_by && <Hint>{t('soc.confirm.vote', { office: officeName(ctx.names, l.confirm_by) })}</Hint>}
        {waiting && <Hint tone="bad">{t('soc.edit.wait', { wait: span(v.next_change_in_seconds) })}</Hint>}
      </Panel>
      {!waiting && (
        <Panel>
          <SectionTitle>{t('soc.alloc.draft')}</SectionTitle>
          {(v.lines ?? []).map((line) => {
            const name = ctx.names.name(['budget_line'], line.code, '')
            const down = moves.find((a) => a.id === 'gov.alloc.down' && a.subject === line.code)
            const up = moves.find((a) => a.id === 'gov.alloc.up' && a.subject === line.code)
            return (
              <div key={line.code} className="sc-alloc">
                <div className="sc-alloc-head"><span>{name}</span><b className="gold">{bpsText(line.share)}</b></div>
                <Bar frac={Math.min(1, line.share / 10000)} color="#e3b023" label={<span className="vs-ltr">{bpsText(line.share)}</span>} />
                <div className="vf-btns row">
                  <Slab tone="red" radius={12} lip={3} disabled={ctx.busy || !down} onClick={() => down && ctx.go(down)} aria-label={t('soc.alloc.down', { line: name })}>−</Slab>
                  <Slab tone="green" radius={12} lip={3} disabled={ctx.busy || !up} onClick={() => up && ctx.go(up)} aria-label={t('soc.alloc.up', { line: name })}>+</Slab>
                </div>
              </div>
            )
          })}
          <Facts rows={[
            { label: t('soc.alloc.total'), value: bpsText(v.total), gold: true },
            { label: t('soc.alloc.left'), value: bpsText(10000 - v.total) },
          ]} />
        </Panel>
      )}
      <Rest ctx={ctx} skip={(a) => moves.includes(a)} />
    </Page>
  )
})

const AllocationConfirm = screen<AllocationConfirmView>(({ view: v, ctx }) => {
  const l = v.lever
  return (
    <Page title={t('soc.confirm.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('soc.confirm.change', { lever: leverName(ctx.names, l.code), place: placeName(ctx.names, v.place), old: leverNow(ctx.names, l), now: allocationText(ctx.names, v.new, l.categories) })}</Lead>
        <Hint>{v.vote_by ? t('soc.confirm.vote', { office: officeName(ctx.names, v.vote_by) }) : t('soc.confirm.notice', { notice: span(l.notice_seconds) })}</Hint>
        <Hint>{t('soc.confirm.cooldown', { cooldown: span(l.cooldown_seconds) })}</Hint>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'gov.confirm')} />
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'cancel')} />
    </Page>
  )
})

// -- the public record ------------------------------------------------------------------------

export function Pager({ ctx, page, pages }: { ctx: FlowCtx; page: number; pages: number }) {
  const list = ctx.acts.filter((a) => a.id === 'page.prev' || a.id === 'page.next')
  return (
    <>
      <Hint>{t('soc.page', { a: formatNumber(Math.max(1, page)), b: formatNumber(Math.max(1, pages)) })}</Hint>
      <Btns ctx={ctx} list={list} row />
    </>
  )
}

const GovHistory = screen<GovHistoryView>(({ view: v, ctx }) => (
  <Page title={t('soc.history.title', { city: placeName(ctx.names, v.city) })} tone="gold">
    <Panel tone="gold">
      {(v.entries ?? []).length === 0 && <Lead>{t('soc.history.empty')}</Lead>}
      <div className="sc-rows">
        {(v.entries ?? []).map((e, i) => {
          const lever = { code: e.lever, type: e.type }
          return (
            <div key={i} className="sc-block">
              <Line title={leverName(ctx.names, e.lever) || t('soc.unnamed_lever')} sub={placeName(ctx.names, e.place)}
                end={<b className="gold vs-ltr">{leverValue(lever, e.old)} ← {leverValue(lever, e.new)}</b>} />
              <Hint>{t('soc.history.by', { office: officeName(ctx.names, e.office), player: playerText(e.by), ago: span(e.ago_seconds) })}
                {' · '}{e.effective_in_seconds > 0 ? t('soc.history.in', { when: span(e.effective_in_seconds) }) : t('soc.history.since', { when: span(-e.effective_in_seconds) })}</Hint>
            </div>
          )
        })}
      </div>
      <Pager ctx={ctx} page={v.page} pages={v.pages} />
    </Panel>
    <Rest ctx={ctx} skip={(a) => a.id === 'page.prev' || a.id === 'page.next'} />
  </Page>
))

// -- refusals ---------------------------------------------------------------------------------

/** Why a governance command was refused, in words: the office the refusal names, the bounds and the wait in the lever's unit. */
export function govRefusalText(ctx: FlowCtx, r: GovRefusal, lever?: GovLever | null): string {
  const office = officeName(ctx.names, r.office || lever?.held_by || '')
  const params: Record<string, string | number> = { office: office || t('soc.unnamed_office') }
  if (r.kind === 'out_of_range' && lever) { params.min = leverValue(lever, lever.min); params.max = leverValue(lever, lever.max) }
  if (r.kind === 'cooldown') return r.wait_seconds > 0 ? t('soc.refusal.gov.cooldown', { wait: span(r.wait_seconds) }) : t('soc.refusal.gov.cooldown_later')
  if (r.kind === 'out_of_range' && !lever) return t('soc.refusal.gov.out_of_range_plain')
  return word(`soc.refusal.gov.${r.kind}`, t('soc.refusal.unknown'), params)
}

const PolicyRefused = screen<PolicyRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby"><Lead tone="bad">{govRefusalText(ctx, v.refusal, v.lever)}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- appointments by office holders -----------------------------------------------------------

const AppointConfirm = screen<AppointView>(({ view: v, ctx }) => (
  <Page title={t('soc.appoint.title')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('soc.appoint.confirm', { player: playerText(v.player), office: officeName(ctx.names, v.office), place: placeName(ctx.names, v.place) })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'gov.appoint.confirm')} />
    <Cancel ctx={ctx} />
  </Page>
))

const DismissConfirm = screen<DismissView>(({ view: v, ctx }) => (
  <Page title={t('soc.dismiss.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead>{t('soc.dismiss.confirm', { player: playerText(v.holder), office: officeName(ctx.names, v.office), place: placeName(ctx.names, v.place) })}</Lead>
      <Hint>{t('soc.dismiss.note')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'gov.dismiss.confirm')} tone="red" />
    <Cancel ctx={ctx} />
  </Page>
))

const AppointDone = screen<AppointDoneView>(({ view: v, ctx }) => (
  <Page title={t(v.dismissed ? 'soc.dismiss.done_title' : 'soc.appoint.done_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t(v.dismissed ? 'soc.dismiss.done' : 'soc.appoint.done', { player: playerText(v.player), office: officeName(ctx.names, v.office), place: placeName(ctx.names, v.place) })}</Lead>
      {!v.dismissed && v.term_ends_in_seconds > 0 && <Hint>{t('soc.appoint.term', { term: durationText(v.term_ends_in_seconds) })}</Hint>}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const AppointRefusal = screen<AppointRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">
        {v.gov ? govRefusalText(ctx, v.gov) : word(`soc.refusal.appoint.${v.kind}`, t('soc.refusal.unknown'), { office: officeName(ctx.names, v.office) || t('soc.unnamed_office') })}
      </Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const GOVERNANCE_SCREENS = {
  city_governance: CityGovernance,
  my_office: MyOffice,
  lever_edit: LeverEdit,
  policy_confirm: PolicyConfirm,
  policy_announced: PolicyAnnounced,
  allocation_edit: AllocationEdit,
  allocation_confirm: AllocationConfirm,
  gov_history: GovHistory,
  policy_refused: PolicyRefused,
  appoint_confirm: AppointConfirm,
  dismiss_confirm: DismissConfirm,
  appoint_done: AppointDone,
  appoint_refusal: AppointRefusal,
}

