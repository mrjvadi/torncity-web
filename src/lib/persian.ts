// Persian/Arabic-Indic digit handling and paste-safe link-code extraction.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩﻿]/g

/** Convert Persian/Arabic-Indic digits in a string to plain Western digits. */
export function toWesternDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch)
    if (fa >= 0) {
      out += String(fa)
      continue
    }
    const ar = AR_DIGITS.indexOf(ch)
    if (ar >= 0) {
      out += String(ar)
      continue
    }
    out += ch
  }
  return out
}

/** Format an integer with thousands separators, always in Western digits. */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/**
 * Pull an 8-character link code out of arbitrary pasted text: strip bidi
 * control marks, normalise Persian digits, uppercase, and take the first
 * standalone [A-Z0-9]{8} run.
 */
export function extractLinkCode(raw: string): string {
  const cleaned = toWesternDigits(raw.replace(BIDI_MARKS, '')).toUpperCase()
  const match = cleaned.match(/[A-Z0-9]{8}/)
  return match ? match[0] : cleaned.replace(/[^A-Z0-9]/g, '').slice(0, 8)
}


/** What a player is typing into the code field: Latin capitals and digits
 * only (Persian digits read as digits, bidi marks and anything else dropped),
 * at most 8. A whole pasted message goes through extractLinkCode instead. */
export function typedLinkCode(raw: string): string {
  const latin = raw.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  return latin.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}
