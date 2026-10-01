// The pieces the companies screens share: buttons found by the action's id, the stars of a rating, the
// walk to a place, the "not available here" block of a kind of business, a requirement line, and the
// plain list row. Everything is drawn from the view and the actions of the answer.

import type { ReactNode } from 'react'
import type { Action } from '../../api/types'
import type { CompanyRef, Requirement, Unavailable, Way } from '../../api/views.gen'
import { Notice } from '../native/kit/Parts'
import { formatNumber, hms, money, roughDuration } from '../native/kit/format'
import { Slab } from '../../kit'
import { Unavailable as UnavailableBlock } from '../../ui/Popup'
import { t } from '../../i18n'
import { Btns, isBack, type FlowCtx } from '../village/flow'
import { Do, backOf, byId, find, nameOf, Facts, Hint, Lead, Page, Panel } from '../economy/kit'
import { stageName } from '../economy/wording'
import { MAX_STARS, TABLES, namedOf, skillLevel } from './wording'
import './companies.css'

export { Btns, Do, Facts, Hint, Lead, Notice, Page, Panel, backOf, byId, find, nameOf, namedOf, formatNumber, hms, money, roughDuration, isBack }

/** The way back, as one button. */
export function BackBtn({ ctx }: { ctx: FlowCtx }) {
  return <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
}

/** Opens the action with this id (and these arguments) when tapped; nothing when the server did not offer it. */
export const go = (ctx: FlowCtx, id: string, args: Record<string, string | number> = {}) => () => {
  const a = find(ctx, id, args)
  if (a) ctx.go(a)
}

/** One button for the action with this id, worded by the screen (or by the id when no label is given). */
export function One({ ctx, id, args, label, tone }: { ctx: FlowCtx; id: string; args?: Record<string, string | number>; label?: string; tone?: 'gold' | 'green' | 'red' | 'blue' | 'steel' }) {
  const a = find(ctx, id, args)
  if (!a) return null
  return <Do ctx={ctx} a={a} label={label} tone={tone} />
}

/** A small chip-button for a quick choice (a quantity, a preset). */
export function Chip({ ctx, a, children }: { ctx: FlowCtx; a: Action | undefined; children: ReactNode }) {
  if (!a) return null
  return <button className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{children}</button>
}

/** A company's rating in stars; "not rated yet" before its first period. */
export function Stars({ stars, rated }: { stars: number; rated: boolean }) {
  if (!rated) return <span className="co-stars dim">{t('co.unrated')}</span>
  const full = Math.max(0, Math.min(MAX_STARS, stars))
  return <span className="co-stars" aria-label={t('co.rating', { stars: formatNumber(full), max: formatNumber(MAX_STARS) })}>{'★'.repeat(full)}<i>{'★'.repeat(MAX_STARS - full)}</i></span>
}

/** The company's name and kind of business, as one line. */
export function companyLine(ctx: FlowCtx, ref: CompanyRef): string {
  return `${ref.name} - ${nameOf(ctx, TABLES.type, ref.type)}`
}

/** The walk to where a service is: the place and the time it takes, with the button that goes. */
export function WalkTo({ way, ctx }: { way: Way | null | undefined; ctx: FlowCtx }) {
  if (!way) return null
  const walk = find(ctx, 'place.walk')
  const place = ctx.names.name(TABLES.place, way.place.code, way.place.name)
  return (
    <>
      <Notice>{t('co.walk', { t: hms(way.walk_seconds), place })}</Notice>
      {walk && <Do ctx={ctx} a={walk} tone="gold" label={t('co.walk_there', { place })} />}
    </>
  )
}

/** A countdown to an instant the server sent as whole seconds left. */
export function left(seconds: number): string {
  return t('common.left', { t: roughDuration(seconds) })
}

// -- a kind of business that is not reached here --------------------------------------------------

/** Why a kind of business is not offered here: the stage it starts at, or the neutral city only. */
export function typeReason(ctx: FlowCtx, u: Unavailable): string {
  const type = ctx.names.name(TABLES.type, u.service, u.service)
  if (u.stage === 'support') {
    const place = u.nearest ? ctx.names.name(TABLES.city, u.nearest.code, u.nearest.name) : t('eco.na.somewhere')
    return t('co.na.only_support', { type, place })
  }
  return t('co.na.from', { type, stage: stageName(u.stage), here: stageName(u.here) })
}

/** The buildings a settlement needs for it, as one list ("a workshop, a clinic (level 2)"). */
export function needsText(ctx: FlowCtx, u: Unavailable): string {
  const parts = (u.requires ?? []).map((b) => {
    if (b.code) return ctx.bname(b.code, b.code)
    if (b.role) return t('co.na.role', { role: ctx.names.name(TABLES.role, b.role, ''), tier: formatNumber(b.tier) }).trim()
    return ''
  }).filter(Boolean)
  return parts.join('، ')
}

/** The "not available here" block of a kind of business, with the journey to the nearest place that has it. */
export function NotReached({ ctx, u }: { ctx: FlowCtx; u: Unavailable }) {
  const travel = find(ctx, 'support.travel')
  const city = u.nearest ? ctx.names.name(TABLES.city, u.nearest.code, u.nearest.name) : ''
  const needs = needsText(ctx, u)
  return (
    <UnavailableBlock
      reason={typeReason(ctx, u)}
      hint={needs ? t('eco.na.hint', { buildings: needs }) : undefined}
      nearest={travel && city ? { name: city, onGo: () => ctx.go(travel), label: t('eco.na.go', { city }) } : undefined}
    />
  )
}

// -- a requirement of a position ------------------------------------------------------------------

/** One requirement of a position, in words. */
export function reqLabel(ctx: FlowCtx, r: Requirement): string {
  const have = !r.met ? ` ${t('req.have', { have: formatNumber(r.have) })}` : ''
  switch (r.kind) {
    case 'level': return t('req.level', { need: formatNumber(r.need) }) + have
    case 'skill': return skillLevel(ctx.names, r.skill, r.need) + have
    case 'certificate': return t('req.certificate', { name: ctx.names.name(TABLES.course, r.course_code, r.course_name) })
    case 'residence': return t('req.residence', { city: ctx.names.name(TABLES.city, r.city_code, r.city) })
    case 'performance': return t('req.performance', { need: formatNumber(r.need) }) + have
    case 'time': return t('req.time', { t: hms(r.wait_seconds) })
    case 'shifts': return t('req.shifts', { n: formatNumber(r.need) })
    case 'top': return t('req.top')
    case 'course_city': return t('req.course_city', { city: ctx.names.name(TABLES.city, r.city_code, r.city) })
    case 'course_full': return t('req.course_full')
    case 'already_certified': return t('req.already_certified')
    case 'already_enrolled': return t('req.already_enrolled', { name: ctx.names.name(TABLES.course, r.course_code, r.course_name) })
    default: return t('co.unknown')
  }
}

/** A list of lines, each with a mark: met or missing. */
export function Checks({ lines }: { lines: { label: string; met: boolean }[] }) {
  return (
    <div className="vf-goals">
      {lines.map((l, i) => (
        <div key={i} className={`vf-goal${l.met ? ' met' : ''}`}>
          <span className="vf-goal-mark">{l.met ? '✓' : '!'}</span>
          <div className="vf-goal-body">{l.label}</div>
        </div>
      ))}
    </div>
  )
}

/** The buttons of a screen that are not its back or refresh, minus what it drew itself. */
export function Others({ ctx, ids, skip }: { ctx: FlowCtx; ids: string[]; skip?: (a: Action) => boolean }) {
  return <Btns ctx={ctx} list={byId(ctx, ...ids).filter((a) => !(skip && skip(a)))} />
}

/** A slab button that is not an action of the server (a local choice). */
export function Local({ children, onClick, tone, disabled }: { children: ReactNode; onClick: () => void; tone?: 'gold' | 'green' | 'red' | 'blue' | 'steel'; disabled?: boolean }) {
  return <div className="vf-btns"><Slab tone={tone ?? 'steel'} radius={14} lip={4} disabled={disabled} onClick={onClick}>{children}</Slab></div>
}
