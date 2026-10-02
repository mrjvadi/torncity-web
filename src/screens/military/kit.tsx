// The pieces the military, war and defence screens share: names from the catalogue, the card of a coded
// notice, the way back, and the quantity choices. Everything is drawn from the view and the actions of
// the answer (docs/adr/0039-presentation-split.md).

import type { ReactNode } from 'react'
import type { Action } from '../../api/types'
import type { AttributeLine, GovPlace, Good, Named, Notice } from '../../api/views.gen'
import { Btns, Hint, Lead, Panel, isBack, type FlowCtx } from '../village/flow'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { placeName as govPlaceName } from '../society/common'
import { noticeWords } from './wording'
import './military.css'

export { ConfirmPopup, Do, NotHere, backOf, byId, find, rest } from '../economy/kit'
export { Facts, Hint, Lead, Page, Panel } from '../village/flow'

/** A country or a city, by its catalogue name. */
export const place = (ctx: FlowCtx, p: GovPlace | null | undefined): string => govPlaceName(ctx.names, p)

/** A city by its code. */
export const cityName = (ctx: FlowCtx, code: string, authored?: string): string => (code ? ctx.names.name(['city'], code, authored) : '')

const from = (ctx: FlowCtx, tables: string[], code: string): string => (code ? ctx.names.name(tables, code, code) : '')

export const branchName = (ctx: FlowCtx, n: Named): string => ctx.names.name(['branch'], n.code, n.name)
export const className = (ctx: FlowCtx, n: Named): string => ctx.names.name(['military_unit'], n.code, n.name)
export const bandName = (ctx: FlowCtx, code: string): string => from(ctx, ['force_band'], code)
export const groundName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_ground'], code)
export const operationName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_operation'], code)
export const damageName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_damage'], code)
export const objectiveName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_objective'], code)
export const proposalName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_proposal'], code)
export const chanceName = (ctx: FlowCtx, code: string): string => from(ctx, ['war_chance'], code)
export const attributeName = (ctx: FlowCtx, code: string): string => from(ctx, ['attribute'], code)
export const officeText = (ctx: FlowCtx, code: string): string => from(ctx, ['office'], code)

/** A good: its item (or component) from the catalogue, and the design's own name when it is a design. */
export function goodName(ctx: FlowCtx, g: Good): string {
  const base = ctx.names.name(g.component ? ['component', 'item'] : ['item', 'component'], g.item.code, g.item.name)
  return g.design ? `${base} (${g.design})` : base
}

/** The card of a coded notice a screen carries. */
export function NoticeCard({ ctx, n }: { ctx: FlowCtx; n: Notice | null | undefined }) {
  const text = noticeWords(n, ctx.names, (g) => goodName(ctx, g))
  if (!text) return null
  return <Panel tone="emerald"><Lead tone="good">{text}</Lead></Panel>
}

/** The attributes of a design, one line each (the value is the unit's base number). */
export function Attributes({ ctx, list }: { ctx: FlowCtx; list: AttributeLine[] | null | undefined }) {
  const rows = (list ?? []).filter((a) => a.name)
  if (!rows.length) return null
  return (
    <div className="mil-attrs">
      {rows.map((a) => (
        <div key={a.name} className="mil-attr"><span>{attributeName(ctx, a.name)}</span><b>{formatNumber(a.value)}</b></div>
      ))}
    </div>
  )
}

/** The way back, and nothing else. */
export function Tail({ ctx }: { ctx: FlowCtx }) {
  return <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
}

/** A row of quantity choices, each a button worded by its own number. */
export function QtyRow({ ctx, list }: { ctx: FlowCtx; list: Action[] }) {
  if (!list.length) return null
  return (
    <div className="vf-btns row">
      {list.map((a, i) => (
        <Slab key={`${a.args?.qty}-${i}`} tone="steel" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</Slab>
      ))}
    </div>
  )
}

/** A small caption line over a list. */
export function Caption({ children }: { children: ReactNode }) {
  return <Hint>{children}</Hint>
}
