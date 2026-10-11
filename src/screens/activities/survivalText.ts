// The words of the survival screens (ADR 0070): the weather in a line, the state of warmth and thirst.
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

