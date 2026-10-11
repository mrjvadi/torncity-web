// The words of the survival screens (ADR 0070): the weather in a line, the state of warmth and thirst.
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { SurvivalView } from '../../api/views.gen'
import { hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'

export const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)

/** The weather in a line: season, temperature, rain, wind and the local hour of the town. */
export function weatherLine(e: NonNullable<SurvivalView['env']>): string {
  const bits = [word(`sv.season.${e.season}`), (e.temp_c < 0 ? t('sv.temp_neg', { n: formatNumber(Math.round(-e.temp_c)) }) : t('sv.temp', { n: formatNumber(Math.round(e.temp_c)) })), e.rain ? t('sv.rain') : '', e.wind ? t('sv.wind') : '']
  return `${bits.filter(Boolean).join(' – ')}. ${t('sv.hour', { h: formatNumber(e.hour) })}`
}

export const warmthWord = (level: string): string => word(`sv.warmth.${level}`, '')
export const thirstWord = (level: number): string => (level > 0 ? word(`sv.thirst.${level}`, '') : '')


const deg = (n: number): string => (n < 0 ? t('sv.neg', { n: formatNumber(Math.round(-n)) }) : formatNumber(Math.round(n)))
const dayName = (offset: number): string => (offset === 1 ? t('time.tomorrow') : offset === 2 ? t('sv.day2') : t('sv.day3'))

/** The next days as a small row of cells: the day, the range of the temperature, and the signs (rain, wind, a cold snap, a hot spell). */
export function Forecast({ days }: { days: SurvivalView['env'] extends infer E ? (E extends { forecast: infer F } ? F : never) : never }): ReactNode {
  const list = days ?? []
  if (!list.length) return null
  const sign = (d: (typeof list)[number]) => [d.snap ? t('sv.f.snap') : '', d.spell ? t('sv.f.spell') : '', d.rain ? t('sv.rain') : '', d.wind ? t('sv.wind') : ''].filter(Boolean).join('، ')
  return createElement('div', { className: 'sv-fc', 'aria-label': t('sv.forecast') },
    list.map((d) => createElement('div', { key: d.offset, className: `sv-fc-d${d.snap || d.spell ? ' warn' : ''}` },
      createElement('b', null, dayName(d.offset)),
      createElement('span', null, t('sv.f.range', { a: deg(d.min_c), b: deg(d.max_c) })),
      sign(d) ? createElement('em', null, sign(d)) : null)))
}
