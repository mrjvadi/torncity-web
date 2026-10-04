// THE countdown: it takes an absolute end time on the server's clock (`ends_at`, `due_at`, `finish_at`) and shows
// what is left, recomputed from that clock on the app's one shared 1 s ticker (src/lib/ticker.ts). Persian digits and
// units. It never keeps a number of its own, so it cannot drift; when it reaches zero it calls `onDone` once (the
// screen re-reads its view or pulls the state-sync store) instead of polling.

import { useEffect, useRef } from 'react'
import { useServerNow } from '../../lib/ticker'
import { syncStore } from '../../state/store'
import { clock } from './format'
import { t } from '../../i18n'
import { words } from '../../lib/duration'

/** Seconds left until `endsAt` (ISO string or epoch ms), 0 once past; null when there is no end. Fires `onDone` once on the crossing to zero. */
export function useCountdown(endsAt: string | number | null | undefined, onDone?: () => void): number | null {
  const now = useServerNow()
  const end = endsAt === null || endsAt === undefined || endsAt === '' ? NaN : typeof endsAt === 'number' ? endsAt : Date.parse(endsAt)
  const left = Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : null
  const was = useRef<number | null>(null)
  const cb = useRef(onDone); cb.current = onDone
  useEffect(() => {
    if (was.current !== null && was.current > 0 && left === 0) {
      void syncStore.pull().catch(() => undefined)
      cb.current?.()
    }
    was.current = left
  }, [left])
  return left
}

/** "3 ساعت و ۱۵ دقیقه" / "۴۵ دقیقه" / "۳۰ ثانیه": the coarsest useful words, Persian digits. */
export function wordsLeft(s: number): string {
  return words(s)
}

export function Countdown({ endsAt, onDone, format = 'clock', done }: { endsAt: string | number | null | undefined; onDone?: () => void; format?: 'clock' | 'words'; done?: string }) {
  const left = useCountdown(endsAt, onDone)
  if (left === null) return null
  if (left === 0 && done) return <span className="cd cd-done">{done}</span>
  return <time className="cd" dateTime={`PT${left}S`}>{format === 'words' ? wordsLeft(left) : clock(left)}</time>
}
