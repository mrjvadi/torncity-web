// Pieces the politics and society screens share: names from the catalogue, the web's own
// wording of lever values, players and spans, and the labels of actions (docs/adr/0039).
// The server sends codes and numbers; every word here is this client's.

import type { ReactNode } from 'react'
import type { Action } from '../../api/types'
import type { GovPlace, GovPlayer, GovLever } from '../../api/views.gen'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { durationText } from '../village/common'
import type { FlowCtx } from '../village/flow'
import type { ContentNames } from '../../village/useVillage'
import { noteLabelGap } from '../village/wording'

export const key = (k: string) => k as Key

/** A word from a table when the table has the key, else the fallback. */
export function word(k: string, fallback: string, params?: Record<string, string | number>): string {
  return hasKey(k) ? t(key(k), params) : fallback
}

/** A place above or beside the player: a city by its catalogue name, a country or province by its own. */
export function placeName(names: ContentNames, p: GovPlace | null | undefined): string {
  if (!p) return ''
  return p.kind === 'city' ? names.name(['city'], p.code, p.name) : names.name(['jurisdiction', 'city'], p.code, p.name)
}

export const officeName = (names: ContentNames, code: string): string => (code ? names.name(['office'], code, '') : '')
export const leverName = (names: ContentNames, code: string): string => (code ? names.name(['lever'], code, '') : '')

/** "name (code)", or the plain unknown when there is neither. */
export function playerText(p: GovPlayer | null | undefined): string {
  if (!p || (!p.name && !p.code)) return t('soc.unknown_player')
  if (!p.name) return p.code
  if (!p.code) return p.name
  return t('soc.player', { name: p.name, code: p.code })
}

export const playersText = (ps: GovPlayer[] | null | undefined): string => (ps ?? []).map(playerText).join(t('common.sep') + ' ')

/** A whole-second span from a minute up, in the coarsest useful unit. */
export const span = (seconds: number): string => {
  const h = Math.round((seconds % 86400) / 3600)
  return seconds >= 2 * 86400 && h > 0
    ? word('soc.span_dh', '', { d: Math.floor(seconds / 86400), h })
    : durationText(seconds)
}

/** A percentage of basis points: 450 is 4.5%. Kept as one left-to-right run so the sign stays beside its digits. */
export const bpsText = (bps: number): string => `\u2066${(Math.round(bps) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%\u2069`

/** A policy value in its unit, or in its words when the policy's values are named choices. */
export function leverValue(l: Pick<GovLever, 'code' | 'type'>, v: number): string {
  const named = `soc.lv.${l.code}.${v}`
  if (hasKey(named)) return t(key(named))
  if (l.type === 'bps') return bpsText(v)
  if (l.type === 'money') return money(v)
  return formatNumber(v)
}

/** The shares of an allocation in their categories' order, the empty ones left out. */
export function allocationText(names: ContentNames, shares: Record<string, number> | null | undefined, order: string[] | null | undefined): string {
  const codes = order && order.length ? order : Object.keys(shares ?? {}).sort()
  const parts = codes.filter((c) => (shares?.[c] ?? 0) > 0)
    .map((c) => t('soc.alloc.share', { line: names.name(['budget_line'], c, ''), share: bpsText(shares![c]) }))
  return parts.length ? parts.join(t('common.sep') + ' ') : t('soc.alloc.nothing')
}

/** The value of a lever now, in its unit or as its allocation. */
export function leverNow(names: ContentNames, l: GovLever): string {
  return l.type === 'allocation' ? allocationText(names, l.allocation, l.categories) : leverValue(l, l.value)
}

/** A phase of an election, in words. */
export const phaseText = (phase: string): string => word(`soc.phase.${phase}`, phase)

/** The title of one election: its usual name, or the office and the place. */
export function electionTitle(names: ContentNames, office: string, place: GovPlace): string {
  const p = placeName(names, place)
  const k = `soc.election.name.${office}`
  return hasKey(k) ? t(key(k), { place: p }) : t('soc.election.of', { office: officeName(names, office), place: p })
}

/** The text of an action's button, by its id, then its command; never a raw id. */
export function actionLabel(a: Action, names?: ContentNames, vars: Record<string, string | number> = {}): string {
  const id = a.id || ''
  const subject = a.subject ?? ''
  const tables = id.startsWith('gov.lever') || id === 'gov.appoint' || id === 'gov.dismiss' ? ['lever', 'office'] : id.startsWith('diplomacy.') ? ['sanction_measure', 'sanction_ground', 'jurisdiction'] : ['city', 'jurisdiction', 'crime']
  const name = subject && names ? names.name(tables, subject) : subject
  const params = { name, ...vars }
  // the server blanks an id that equals its command, so the command is also a name of the action
  for (const k of [`soc.act.${id}`, `soc.cmd.${a.command ?? ''}`, `soc.act.${a.command ?? ''}`, `act.${a.command ?? ''}`]) if (hasKey(k)) return t(key(k), params)
  noteLabelGap(a)
  return t('soc.act.fallback')
}

/** The actions with an id, optionally with one named argument equal to a value. */
export function pick(ctx: FlowCtx, id: string, arg?: string, value?: string): Action[] {
  return ctx.acts.filter((a) => a.id === id && (arg === undefined || a.args?.[arg] === value))
}

/** A line of a list: title, optional sub, and what stands at the end. */
export function Line({ title, sub, end }: { title: ReactNode; sub?: ReactNode; end?: ReactNode }) {
  return (
    <div className="sc-line">
      <div className="sc-line-text">
        <span className="sc-line-title">{title}</span>
        {sub ? <span className="sc-line-sub">{sub}</span> : null}
      </div>
      {end ? <span className="sc-line-end">{end}</span> : null}
    </div>
  )
}
