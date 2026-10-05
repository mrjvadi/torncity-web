// Times the economy screens show: the server sends RFC 3339 instants (UTC); the game's own clock is
// the viewer's device time zone, in the player's language, Western digits.

import { getLang } from '../../i18n'
import { atText } from '../../lib/duration'

function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'fa-IR-u-nu-latn', opts)
}

/** "14:30" */
export function clockText(iso: string | null | undefined): string {
  return atText(iso)
}

/** "۱۵ آبان" / "15 Oct", with the clock when it is today or tomorrow's own business. */
export function dateText(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : fmt({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}
