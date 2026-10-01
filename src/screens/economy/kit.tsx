// The pieces the economy screens share: the not-available-here card, the ways to pay one charge,
// and the confirm popup. Everything is drawn from the view and the actions of the answer.

import type { ReactNode } from 'react'
import type { Action } from '../../api/types'
import type { PaymentChoice, Unavailable } from '../../api/views.gen'
import { Card, Header, ScreenScroll } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, { ActionButton, ActionRow, Note, Unavailable as UnavailableBlock } from '../../ui/Popup'
import { t } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, isBack, isRefresh, type FlowCtx } from '../village/flow'
import { unavailableReason } from './wording'

/** The actions of a screen with this id. */
export const byId = (ctx: FlowCtx, ...ids: string[]): Action[] => ctx.acts.filter((a) => ids.includes(a.id ?? ''))

/** The first action with this id whose arguments include all of `args`. */
export function find(ctx: FlowCtx, id: string, args: Record<string, string | number> = {}): Action | undefined {
  return ctx.acts.find((a) => a.id === id && Object.entries(args).every(([k, v]) => String(a.args?.[k]) === String(v)))
}

/** The action that goes back. */
export const backOf = (ctx: FlowCtx): Action | undefined => ctx.acts.find(isBack)

/** Opens a screen by its action; a missing action does nothing. */
export const open = (ctx: FlowCtx, a: Action | undefined) => () => { if (a) ctx.go(a) }

/** Everything that is not a way back or a refresh, minus what the screen already drew. */
export const rest = (ctx: FlowCtx, drawn: (a: Action) => boolean): Action[] =>
  ctx.acts.filter((a) => !isBack(a) && !isRefresh(a) && !drawn(a))

/** The place a name is shown at, from the catalogue (a city, a place). */
export function placeName(ctx: FlowCtx, tables: string[], code: string, authored?: string): string {
  return ctx.names.name(tables, code, authored)
}

/** A shop, an item, a loan product... named from the catalogue in the player's language. */
export function nameOf(ctx: FlowCtx, tables: string[], n: { code: string; name: string } | null | undefined): string {
  if (!n) return ''
  return ctx.names.name(tables, n.code, n.name)
}

/** The "not available here" state of a service: what is missing, from which stage it is offered, what a
 * settlement needs for it, and the nearest place that has it with the journey there. */
export function NotHere({ u, ctx, title, tone }: { u: Unavailable; ctx: FlowCtx; title: string; tone?: 'sapphire' | 'emerald' | 'gold' }) {
  const go = find(ctx, 'support.travel')
  const city = u.nearest ? ctx.names.name(['city'], u.nearest.code, u.nearest.name) : undefined
  const needs = (u.requires ?? []).filter((b) => b.code).map((b) => ctx.bname(b.code, b.code))
  return (
    <Page title={title} tone={tone ?? 'sapphire'}>
      <Panel tone={tone ?? 'sapphire'}>
        <UnavailableBlock
          reason={unavailableReason(u, city)}
          hint={needs.length ? t('eco.na.hint', { buildings: needs.join('، ') }) : undefined}
          nearest={go && city ? { name: city, onGo: () => ctx.go(go), label: t('eco.na.go', { city }) } : undefined}
        />
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
}

/** One action as a button, worded by the screen when the id's own label cannot say enough. */
export function Do({ ctx, a, label, tone }: { ctx: FlowCtx; a: Action; label?: string; tone?: 'gold' | 'green' | 'red' | 'blue' | 'steel' }) {
  return (
    <div className="vf-btns">
      <Slab tone={tone ?? (a.kind === 'danger' ? 'red' : a.kind === 'primary' ? 'gold' : 'steel')} radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{label ?? ctx.label(a)}</Slab>
    </div>
  )
}

/** What the player holds, shown above the ways to pay (the Telegram edge leaves it out of a group). */
export function Purses({ p }: { p: PaymentChoice }) {
  return (
    <Facts rows={[
      { label: t('eco.pay.cash'), value: money(p.cash) },
      { label: t('eco.pay.bank'), value: money(p.bank) },
    ]} />
  )
}

/** The note under a price that says why a way to pay is missing. */
export function payNote(p: PaymentChoice): string {
  const acc = p.accepted ?? []
  const use = p.usable ?? []
  if (acc.length === 1) return t(acc[0] === 'cash' ? 'eco.pay.cash_only' : 'eco.pay.card_only')
  if (acc.includes('cash') && acc.includes('card') && use.length === 1) return t(use[0] === 'card' ? 'eco.pay.only_card' : 'eco.pay.only_cash')
  return ''
}

/** A modal over an (empty) screen: the confirmation of one act. Closing it is the way back. */
export function ConfirmPopup({ title, ctx, tone, children, footer }: { title: string; ctx: FlowCtx; tone?: 'red' | 'navy' | 'green' | 'gold' | 'violet'; children: ReactNode; footer?: ReactNode }) {
  const back = backOf(ctx)
  return (
    <>
      <ScreenScroll><Header title={title} tone="sapphire" /></ScreenScroll>
      <Popup open onClose={() => { if (back) ctx.go(back) }} title={title} tone={tone ?? 'navy'} footer={footer}>
        {children}
      </Popup>
    </>
  )
}

/** The ways to pay as the popup's footer: one button per method that covers the price, or the bank. */
export function PayFooter({ ctx, p, bank }: { ctx: FlowCtx; p: PaymentChoice; bank?: Action }) {
  const pays = byId(ctx, 'payment.cash', 'payment.card')
  return (
    <>
      {pays.length > 0 ? (
        <ActionRow>
          {pays.map((a) => (
            <ActionButton key={a.id} tone={a.id === 'payment.card' ? 'gold' : 'green'} disabled={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>
          ))}
        </ActionRow>
      ) : (
        <>
          <Note tone="bad">{t('eco.pay.cannot', { amount: money(p.amount) })}</Note>
          {bank && <ActionButton tone="gold" onClick={() => ctx.go(bank)}>{ctx.label(bank)}</ActionButton>}
        </>
      )}
    </>
  )
}

export function Money({ n }: { n: number | null | undefined }) {
  return <span>{money(n ?? 0)}</span>
}

/** A percent from basis points, "۲٫۵٪"-less: Western digits and a percent sign. */
export function bps(n: number): string {
  const v = Math.round(n) / 100
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2).replace(/0$/, '')}%`
}

/** A whole number with a unit word. */
export function countOf(n: number): string {
  return formatNumber(n)
}

export { Facts, Hint, Lead, Page, Panel, Card }
