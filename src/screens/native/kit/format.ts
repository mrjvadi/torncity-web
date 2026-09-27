// Small formatting helpers shared by the native screens. Everything in
// Western digits (repo rule): no locale that would print Persian glyphs.

import { formatNumber } from '../../../lib/persian'

export { formatNumber }

/** Money in minor units, with the currency word after it (نیل, matching
 * the bot's own rendering). Negative values keep their sign. */
export function money(n: number | undefined | null): string {
  if (n === undefined || n === null) return '۰'.replace('۰', '0')
  return `${formatNumber(n)} نیل`
}

/** A whole-second duration as "H:MM" (an hour or more) or "MM:SS" (under
 * an hour), Western digits — the prototype's own countdown format. */
export function hms(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** A duration rounded to the coarsest sensible unit, for a static line
 * ("6 ساعت", "12 روز"), not a countdown. */
export function roughDuration(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  if (s <= 0) return '۰'.replace('۰', '0')
  const day = 86400, hour = 3600, min = 60
  if (s >= day) return `${Math.round(s / day)} روز`
  if (s >= hour) return `${Math.round(s / hour)} ساعت`
  if (s >= min) return `${Math.round(s / min)} دقیقه`
  return `${s} ثانیه`
}

/** How long ago, from a whole-second age. */
export function ago(seconds: number | undefined | null): string {
  return `${roughDuration(seconds)} پیش`
}

/** A percent from a 0..1 fraction, one decimal dropped when whole. */
export function pct(frac: number): string {
  const v = Math.round(frac * 1000) / 10
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`
}

export function clamp01(v: number): number {
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}
