// The viewer's display money (ADR 0033 section 6.9): once the home settlement has a chartered money, every amount (which the
// server always sends in SUP minor units) is shown in it at the LIVE rate, with the SUP amount beside it. One place converts:
// `localOf` and `moneyText`; the screens only call the shared `money()` formatter, which uses them. No money block: SUP only.

export interface DisplayMoney { code: string; name: string; symbol: string; r0: number; x_ref_ppm: number; rate_num: number; rate_den: number }

let current: DisplayMoney | null = null
const listeners = new Set<() => void>()

/** What the last neutral response said: its `money` block, or none. Re-renders subscribers when it changes. */
export function setDisplayMoney(m: DisplayMoney | null | undefined): void {
  const next = m && m.rate_den > 0 && m.rate_num > 0 && m.name ? m : null
  const same = (!current && !next) || (!!current && !!next && current.code === next.code && current.rate_num === next.rate_num && current.rate_den === next.rate_den && current.name === next.name)
  if (same) return
  current = next
  listeners.forEach((f) => f())
}
export const getDisplayMoney = (): DisplayMoney | null => current
export function onDisplayMoney(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f) } }

/** units of the viewer's money for a SUP minor-unit amount: round half up in integer math, the sign kept. Numbers past 2^53 lose
 * nothing that matters for a display. */
export function localOf(sup: number, m: DisplayMoney | null = current): number {
  if (!m) return sup
  const neg = sup < 0
  const a = Math.abs(sup)
  const q = Math.floor((a * m.rate_num * 2 + m.rate_den) / (m.rate_den * 2))
  return neg ? -q : q
}

/** The marker between the local figure and the SUP part: invisible, so plain text reads «۲۵۰ مارک پولو (۲۵ ساپ)»; the cards
 * that can style it split on it and draw the SUP part small and muted. */
export const SUP_MARK = '⁣'
