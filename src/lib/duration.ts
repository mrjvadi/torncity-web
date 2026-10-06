// Durations and instants for a game that runs on real time (ADR: a game hour is a real hour, a game day a real day).
// Waits can now last days, so every duration prints its two coarsest parts ("۲ روز و ۴ ساعت"), and an instant is shown
// in the VIEWER'S device time zone (today, tomorrow, or a date), with the settlement's own local time beside a
// settlement-level hour (shop delivery, market day, elections) via `zoneClock`.

import { getLang, isRtl, t } from '../i18n'
import type { BuildWaitView } from '../api/views.gen'
import { fa } from '../ui/v6/format'

/** "۲ روز و ۴ ساعت" / "۳ ساعت و ۱۵ دقیقه" / "۴۵ دقیقه" / "۳۰ ثانیه": two parts at most, the coarse one first. */
export function words(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.round(seconds ?? 0))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.round((s % 3600) / 60)
  if (d >= 1) return h ? `${t('time.d', { n: d })} ${t('common.and')} ${t('time.h', { n: h })}` : t('time.d', { n: d })
  if (s >= 3600) return m && m < 60 ? `${t('time.h', { n: h })} ${t('common.and')} ${t('time.m', { n: m })}` : t('time.h', { n: m === 60 ? h + 1 : h })
  if (s >= 60) return t('time.m', { n: Math.round(s / 60) })
  return t('time.s', { n: s })
}

const locale = () => (getLang() === 'en' ? 'en-GB' : 'fa-IR-u-nu-latn')

/** "14:30" of an instant in the device's zone. */
export function timeOf(ms: number): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))

/** An instant (RFC 3339 or epoch ms) in the device's zone: "14:30" today, «فردا ۱۴:۳۰» tomorrow, else «۱۵ آبان ۱۴:۳۰». '' when none. */
export function atText(at: string | number | null | undefined, now: number = Date.now()): string {
  if (at === null || at === undefined || at === '') return ''
  const ms = typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ms)) return ''
  const clock = timeOf(ms)
  if (dayKey(ms) === dayKey(now)) return clock
  if (dayKey(ms) === dayKey(now + 86_400_000)) return `${t('time.tomorrow')} ${clock}`
  if (dayKey(ms) === dayKey(now - 86_400_000)) return `${t('time.yesterday')} ${clock}`
  const date = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(new Date(ms))
  return `${date} ${clock}`
}

/** "ends at …" for a wait that is long enough for the end time to matter (6 hours or more), else ''. */
export function endNote(seconds: number | undefined | null, now: number = Date.now()): string {
  const s = seconds ?? 0
  return s >= 6 * 3600 ? t('time.until', { at: atText(now + s * 1000, now) }) : ''
}

/** "HH:MM" of the settlement's local clock at an instant (`zoneMinutes` east of UTC). */
export function zoneClock(ms: number, zoneMinutes: number): string {
  const d = new Date(ms + zoneMinutes * 60_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** The local hour of a settlement (0..23) as «۰۶:۰۰ به وقت شهر». */
export function cityHour(hour: number): string {
  return t('time.city_clock', { at: fa(`${String(hour).padStart(2, '0')}:00`) })
}

/** "UTC+5:30" label of an offset in minutes. */
export function zoneLabel(zoneMinutes: number): string {
  const sign = zoneMinutes < 0 ? '−' : '+'
  const a = Math.abs(zoneMinutes), h = Math.floor(a / 60), m = a % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** The device's own offset, minutes east of UTC. */
export const deviceZone = (): number => -new Date().getTimezoneOffset()

/** The labour a building takes (`build_time_seconds` is worker time: one worker for that long), not a wait on the clock:
 * «۲ نفر-ساعت کار» / «۳۰ نفر-دقیقه کار». The wall-clock wait is this divided by the crew. */
export function workText(seconds: number | undefined | null): string {
  const s = Math.max(0, seconds ?? 0)
  if (s >= 3600) {
    const h = Math.round((s / 3600) * 10) / 10
    return t('time.work_hours', { n: fa(String(h).replace('.', isRtl() ? '٫' : '.')) })
  }
  return t('time.work_minutes', { n: fa(Math.max(1, Math.round(s / 60))) })
}

/** What a build costs in time: the server's estimate of the wait («حدود ۱۲ دقیقه») when it sends one, else the worker effort. */
export function buildText(b: { build_time_seconds: number; expected_wait?: BuildWaitView | null }): string {
  return b.expected_wait && b.expected_wait.seconds > 0 ? `${t('time.about', { t: words(b.expected_wait.seconds) })} (${workText(b.build_time_seconds)})` : workText(b.build_time_seconds)
}

/** The arrival in the DESTINATION's own time ("ساعت ۱۴:۳۰ به وقت آنجا"), from its fixed zone offset (minutes east of UTC).
 * '' when the zone is unknown (0) or equals the device's own, so the same hour is never printed twice. */
export function thereText(at: string | number | null | undefined, zoneMinutes: number | null | undefined): string {
  if (at === null || at === undefined || at === '' || !zoneMinutes) return ''
  const ms = typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ms)) return ''
  if (zoneMinutes === -new Date(ms).getTimezoneOffset()) return ''
  const day = (x: number) => Math.floor((x + zoneMinutes * 60_000) / 86_400_000)
  const diff = day(ms) - day(Date.now())
  const clock = zoneClock(ms, zoneMinutes)
  const when = diff === 1 ? `${t('time.tomorrow')} ${clock}` : diff === -1 ? `${t('time.yesterday')} ${clock}` : diff > 1 || diff < -1
    ? `${new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(ms + zoneMinutes * 60_000))} ${clock}` : clock
  return t('time.there', { at: fa(when) })
}
