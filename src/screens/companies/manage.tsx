// A company's management screen: its money, its price level, its people, its last period and the next step the
// floor should take, with the ways into the rest of the company (staff, openings, recruitment, warehouse).
// Drawn from the view and the actions of the answer (docs/adr/0039-presentation-split.md).

import type { CompanyManageView, CompanyNotice, CompanyPeriodSummary, NextStep } from '../../api/views.gen'
import { Card } from '../native/kit/Parts'
import { Btns, flow, registerFlow } from '../village/flow'
import { t, hasKey, type Key } from '../../i18n'
import { clockText } from '../economy/time'
import { bps } from '../economy/kit'
import { BackBtn, Do, Facts, Hint, Lead, Notice, Page, Panel, byId, formatNumber, left, money, nameOf } from './kit'
import { TABLES, coded, goodName, namedOf } from './wording'
import type { FlowCtx } from '../village/flow'

const key = (k: string) => k as Key

/** The one thing the floor should do next, in words. */
export function stepText(ctx: FlowCtx, s: NextStep): string {
  const good = goodName(ctx.names, s.good)
  const units = s.batch > 0 ? s.qty * s.batch : s.qty
  const k = `co.step.${s.kind}`
  if (!hasKey(k)) return ''
  return t(key(k), {
    good, qty: formatNumber(units), total: money(s.total), name: s.design_name, tech: namedOf(ctx.names, TABLES.tech, s.tech),
    item: namedOf(ctx.names, TABLES.item, s.item), component: namedOf(ctx.names, TABLES.component, s.component),
    time: clockText(s.finish_at), duration: left(s.left_seconds),
  })
}

/** The label of the step's own button. */
export function stepButton(ctx: FlowCtx, s: NextStep): string {
  const units = s.batch > 0 ? s.qty * s.batch : s.qty
  return t(key(`co.stepbtn.${s.kind}`), {
    good: goodName(ctx.names, s.good), qty: formatNumber(units), total: money(s.total), name: s.design_name,
    tech: namedOf(ctx.names, TABLES.tech, s.tech), item: namedOf(ctx.names, TABLES.item, s.item),
  })
}

/** The card of the next step, with its one button. */
export function NextStepCard({ ctx, step }: { ctx: FlowCtx; step: NextStep | null | undefined }) {
  if (!step) return null
  const text = stepText(ctx, step)
  if (!text) return null
  const a = ctx.acts.find((x) => x.id === `production.step_${step.kind}`)
  return (
    <Card tone="gold">
      <div className="vf-panel">
        <Lead>{t('co.step.title')}</Lead>
        <Hint>{text}</Hint>
        {a && <Do ctx={ctx} a={a} tone="gold" label={stepButton(ctx, step)} />}
      </div>
    </Card>
  )
}

function noticeText(ctx: FlowCtx, n: CompanyNotice): string {
  const k = `co.notice.company.${n.kind}`
  if (!hasKey(k)) return ''
  return t(key(k), { amount: money(n.amount), tax: money(n.tax), net: money(n.net), percent: bps(n.price_bps), player: n.player.name })
}

/** A period's figures, as a list of facts. */
export function PeriodFacts({ p }: { p: CompanyPeriodSummary }) {
  return (
    <Facts rows={[
      { label: t('co.period.revenue'), value: money(p.revenue), gold: true },
      { label: t('co.period.sales_tax'), value: money(p.sales_tax) },
      { label: t('co.period.wages'), value: money(p.wages) },
      { label: t('co.period.upkeep'), value: money(p.upkeep) },
      { label: t('co.period.sold'), value: t('co.of', { a: formatNumber(p.sold), b: formatNumber(p.wanted) }) },
      { label: t('co.period.capacity'), value: formatNumber(p.capacity) },
      { label: t('co.period.quality'), value: bps(p.quality_bps) },
      { label: t('co.period.shifts'), value: formatNumber(p.shifts) },
      ...(p.citizen_workers > 0 ? [{ label: t('co.period.citizens'), value: t('co.period.citizens_value', { workers: formatNumber(p.citizen_workers), shifts: formatNumber(p.citizen_shifts), wages: money(p.citizen_wages) }) }] : []),
    ]} />
  )
}

const Manage = flow<CompanyManageView>(({ view: v, ctx }) => {
  const n = v.notice ? noticeText(ctx, v.notice) : ''
  const defence = v.defence
  return (
    <Page title={t('co.manage.title', { name: v.ref.name })} tone="emerald">
      {n && <Notice>{n}</Notice>}
      <NextStepCard ctx={ctx} step={v.step} />
      <Panel>
        <Lead>{nameOf(ctx, TABLES.type, v.ref.type)}</Lead>
        <Facts rows={[
          { label: t('co.manage.balance'), value: money(v.balance), gold: true },
          ...(v.reserved > 0 ? [{ label: t('co.manage.reserved'), value: money(v.reserved) }] : []),
          { label: t('co.manage.available'), value: money(v.available) },
          { label: t('co.manage.upkeep'), value: money(v.upkeep) },
          { label: t('co.manage.tax'), value: bps(v.tax_bps) },
          ...(v.price_step > 0 ? [{ label: t('co.manage.price'), value: bps(v.price_bps) }] : []),
        ]} />
        {v.debt > 0 && <Notice alert>{t('co.manage.debt', { amount: money(v.debt), arrears: formatNumber(v.arrears), grace: formatNumber(v.grace) })}</Notice>}
        <Btns ctx={ctx} row list={byId(ctx, 'company.deposit_cash', 'company.deposit_card')} />
        <Btns ctx={ctx} list={byId(ctx, 'company.withdraw')} />
        {v.price_step > 0 && <Btns ctx={ctx} row list={byId(ctx, 'company.cheaper', 'company.dearer')} />}
      </Panel>
      <Panel>
        <Facts rows={[
          { label: t('co.manage.staff'), value: t('co.of', { a: formatNumber(v.staff), b: formatNumber(v.max_staff) }) },
          { label: t('co.manage.openings'), value: formatNumber(v.openings) },
          { label: t('co.manage.pending'), value: formatNumber(v.pending) },
          ...(v.specialists > 0 || v.recruiting > 0
            ? [{ label: t('co.manage.specialists'), value: t('co.manage.specialists_value', { count: formatNumber(v.specialists), campaigns: formatNumber(v.recruiting) }) }]
            : []),
          ...(v.manager ? [{ label: t('co.page.manager'), value: v.manager.name }] : []),
        ]} />
        <Hint>{t(v.auto_accept ? 'co.manage.auto_on' : 'co.manage.auto_off')}</Hint>
        {v.citizens.vacant > 0 && (
          <Hint>{v.citizens.workers > 0
            ? t('co.citizens.working', { workers: formatNumber(v.citizens.workers), vacant: formatNumber(v.citizens.vacant), wages: money(v.citizens.wages) })
            : t('co.citizens.unpaid', { vacant: formatNumber(v.citizens.vacant) })}</Hint>
        )}
        <Btns ctx={ctx} list={byId(ctx, 'company.staff', 'company.openings', 'recruit.hub', 'recruit.specialists')} />
        <Btns ctx={ctx} list={byId(ctx, 'company.auto_on', 'company.auto_off')} />
      </Panel>
      <Panel>
        <Lead>{t('co.manage.last')}</Lead>
        {v.last ? <PeriodFacts p={v.last} /> : <Hint>{t('co.manage.no_period')}</Hint>}
        {v.next_at && <Hint>{t('co.manage.next', { time: clockText(v.next_at), duration: left(v.next_in_seconds) })}</Hint>}
      </Panel>
      {defence && (defence.status || defence.eligible) && (
        <Panel>
          <Hint>{defence.status ? t('co.manage.defence', { state: coded('defence', defence.status), time: clockText(defence.effective_at) }) : t('co.manage.defence_eligible')}</Hint>
          <Btns ctx={ctx} list={byId(ctx, 'company.defence')} />
        </Panel>
      )}
      <Btns ctx={ctx} list={byId(ctx, 'production.warehouse', 'health.desk')} tone="gold" />
      {v.owner && <Btns ctx={ctx} list={byId(ctx, 'company.manager')} />}
      {v.owner && <Btns ctx={ctx} list={byId(ctx, 'company.close')} />}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

registerFlow({ company_manage: Manage })

export const MANAGE_SCREENS = ['company_manage']
