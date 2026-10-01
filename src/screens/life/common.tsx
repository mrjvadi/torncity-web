// Small helpers of the life area's screens (docs/adr/0039-presentation-split.md): the server sends codes,
// numbers and times; the words and the formats are this client's. Content names are read from the catalogue
// by code; the authored name the view carries is the last resort.

import { getLang, hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'
import type { FlowCtx } from '../village/flow'

/** A content entry the views carry: its code and its authored name. */
export interface Coded { code: string; name: string }

/** The name of a city (a content city; a founded village has only its own name). */
export const cityName = (ctx: FlowCtx, code: string, authored?: string): string => (code ? ctx.names.name('city', code, authored) : authored ?? '')

/** The name of a content entry of one of the catalogue's tables. */
export const nameOf = (ctx: FlowCtx, table: string | string[], n: Coded | null | undefined): string => (n && (n.code || n.name) ? ctx.names.name(table, n.code, n.name) : '')

/** A clock time of an instant (RFC 3339), in the player's language, Western digits. */
export function clockText(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString(getLang() === 'en' ? 'en-GB' : 'fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' })
}

/** A date of an instant, in the player's language, Western digits. */
export function dateText(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fa-IR-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** The web's text for a key built from codes (a refusal kind, a history kind); `fallback` when it has none. */
export function tf(key: string, fallback: Key, params?: Record<string, string | number>): string {
  return t((hasKey(key) ? key : fallback) as Key, params)
}

/** `t` for a key built from a code. */
export const tx = (key: string, params?: Record<string, string | number>): string => t(key as Key, params)

/** A percentage of basis points: 250 bps is "2.5%". */
export const bps = (n: number): string => `${formatNumber(Math.round(n) / 100)}%`
