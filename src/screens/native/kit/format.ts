// Small formatting helpers shared by the native screens. Persian digits in the Persian UI (owner, v6),
// Western digits in English: the digits are chosen by the one helper in ui/v6/format.ts.

import { formatNumber } from '../../../lib/persian'
import { t } from '../../../i18n'
import { fa } from '../../../ui/v6/format'
import { words } from '../../../lib/duration'
import { getDisplayMoney, localOf, SUP_MARK } from '../../../lib/money'

export { formatNumber }

/** Money in minor units. Without a chartered money of the viewer's own: «۲۵ ساپ». With one, the local figure first and the SUP
 * amount beside it: «۲۵۰ مارک پولو (۲۵ ساپ)» (lib/money.ts converts at the live rate). */
export function money(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0'
  const m = getDisplayMoney()
  const sup = `${formatNumber(n)} ${t('unit.money')}`
  if (!m) return sup
  return `${formatNumber(localOf(n, m))} ${m.name}${SUP_MARK} (${sup})`
}

/** The SUP part of a money string made by `money()`, split from the local part, or null for a plain one. */
export function splitMoney(s: string): [string, string] | null {
  const i = s.indexOf(SUP_MARK)
  return i > 0 ? [s.slice(0, i), s.slice(i + 1).trim()] : null
}

/** A chartered money's name for the viewer, or «ساپ». */
export function moneyName(): string { return getDisplayMoney()?.name || t('unit.money') }

/** A whole-second duration as "H:MM" (an hour or more) or "MM:SS" (under
 * an hour), the prototype's own countdown format. */
export function hms(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${fa(d)} ${t('time.d_short')} ${fa(`${h}:${String(m).padStart(2, '0')}`)}`
  if (h > 0) return fa(`${h}:${String(m).padStart(2, '0')}`)
  return fa(`${m}:${String(sec).padStart(2, '0')}`)
}

/** A duration rounded to the coarsest sensible unit, for a static line
 * ("6 ساعت", "12 روز"), not a countdown. */
export function roughDuration(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  if (s <= 0) return '0'
  return words(s)
}

/** How long ago, from a whole-second age. */
export function ago(seconds: number | undefined | null): string {
  return t('common.ago', { t: roughDuration(seconds) })
}

/** A percent from a 0..1 fraction, one decimal dropped when whole. */
export function pct(frac: number): string {
  const v = Math.round(frac * 1000) / 10
  return fa(`${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`)
}

export function clamp01(v: number): number {
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/** A server button label without its leading emoji: the kit draws its own
 * embossed icon for the action, so the Telegram emoji would double it. */
export function cleanLabel(label: string): string {
  const s = label.replace(/^[\s\p{Extended_Pictographic}‍️⃣]+/u, '').trim()
  return s || label
}
