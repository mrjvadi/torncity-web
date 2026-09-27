// Tehran wall-clock time, since the whole game runs on one clock.

const TEHRAN_OFFSET_SECONDS = 3 * 3600 + 30 * 60

/** "HH:MM" in Tehran time, `seconds` from now, in Western digits. */
export function clockIn(seconds: number): string {
  const t = Math.floor(Date.now() / 1000) + seconds + TEHRAN_OFFSET_SECONDS
  const d = new Date(t * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
