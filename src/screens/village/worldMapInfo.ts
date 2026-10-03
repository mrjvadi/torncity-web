// What the world map says about a place: the coordinates in words, the climate band, the biome's name and the
// scale bar's round length. Plain functions, no state. The region hook at the bottom is where countries and
// alliances plug in once the server has them (ADR 0044 G6); until then it answers nothing.

import { t, type Key } from '../../i18n'

export function coordText(lat: number, lon: number): string {
  const la = Math.abs(lat).toFixed(2), lo = Math.abs(lon).toFixed(2)
  return `${la}° ${lat >= 0 ? t('wm.dir.n') : t('wm.dir.s')}  ${lo}° ${lon >= 0 ? t('wm.dir.e') : t('wm.dir.w')}`
}

/** The climate band by latitude (a plain geographic band, not a weather model). */
export function climateBand(lat: number): string {
  const a = Math.abs(lat)
  return t(a < 23.5 ? 'wm.climate.tropic' : a < 35 ? 'wm.climate.subtropic' : a < 55 ? 'wm.climate.temperate' : a < 66.5 ? 'wm.climate.cold' : 'wm.climate.polar')
}

const BIOMES = new Set(['ocean', 'lake', 'polar_ice', 'tundra', 'boreal_forest', 'temperate_grassland', 'temperate_forest', 'temperate_rainforest', 'tropical_savanna', 'tropical_rainforest', 'desert'])

/** The Persian name of a biome code; a code the client has no name for is left out, never shown raw. */
export function biomeName(code: string): string {
  return BIOMES.has(code) ? t(`wm.biome.${code}` as Key) : ''
}

/** A round scale length (1, 2 or 5 x 10^n km) that fits in `maxPx` at `kmPerPx`. */
export function niceScale(kmPerPx: number, maxPx: number): { km: number; px: number } {
  const raw = kmPerPx * maxPx
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const km = [5, 2, 1].map((m) => m * p).find((v) => v <= raw) ?? p
  return { km, px: km / kmPerPx }
}

export interface RegionInfo { name: string; kind: 'country' | 'alliance' }
/** Countries and alliances layer. The server has no country data yet (they exist only when players found them);
 * when it does, set `regionProvider.at` to look a place up (a polygon test or a tile owner) and the readout shows it. */
export const regionProvider: { at: (lat: number, lon: number) => RegionInfo | null } = { at: () => null }

/** "35.7 51.4" or "35.7, 51.4" (Persian or Latin digits, a Persian comma too) as a place; null for anything else. */
export function parseCoords(q: string): { lat: number; lon: number } | null {
  const latin = q.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٫]/g, '.').replace(/[،]/g, ',')
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(latin)
  if (!m) return null
  const lat = Number(m[1]), lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}
