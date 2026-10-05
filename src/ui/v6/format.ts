// Numbers and clocks in the v6 shell. Persian digits in the Persian UI (P26), plain digits elsewhere.
// A figure is abbreviated only above 9,999 and only on a HUD pill (P7); every other place writes it in full.

import { isRtl } from '../../i18n'

const FD = '۰۱۲۳۴۵۶۷۸۹'

/** Digits of a string in the player's script. */
export function fa(s: string | number): string {
  const str = String(s)
  return isRtl() ? str.replace(/\d/g, (d) => FD[+d]) : str
}

/** A whole number with thousands separators, written in full. */
export function faNum(n: number): string {
  const str = Math.round(n).toLocaleString('en-US')
  return isRtl() ? fa(str.replace(/,/g, '٬')) : str
}

/** The HUD cash pill: full up to 9,999, then «۱۲٫۴ هزار» / «۱٫۶ م» with a thin non-breaking space before the unit. */
export function cashCompact(n: number, unit: { thousand: string; million: string }): string {
  if (Math.abs(n) <= 9999) return faNum(n)
  const one = (v: number) => {
    const s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '')
    return isRtl() ? fa(s.replace('.', '٫')) : s
  }
  if (n >= 1_000_000) return `${one(n / 1_000_000)} ${unit.million}`
  return `${one(n / 1_000)} ${unit.thousand}`
}

/** A countdown: m:ss under an hour, h:mm:ss above. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p = (v: number) => String(v).padStart(2, '0')
  // from a day on: whole days first, then the clock («۲ روز ۰۴:۱۲:۰۰»); the days word is the app's own
  if (d) return `${fa(d)} ${isRtl() ? 'روز' : 'd'} ${fa(`${p(h)}:${p(m)}:${p(ss)}`)}`
  return fa(h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`)
}

/** A long wait for an event chip: whole days from a day on («۲ روز»), else the clock. */
export function waitText(totalSeconds: number, dayWord: string): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s >= 86400) return `${fa(Math.floor(s / 86400))} ${dayWord}`
  return clock(s)
}

export const IC = (name: string): string => `${import.meta.env.BASE_URL}ui-v6/icons/${name}.png`
