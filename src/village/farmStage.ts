// What a farm's field looks like (ADR 0067): the layout says the stage the server read at the request time; the times (`ripe_at`, `spoil_at`)
// move it on between two requests, so the field turns ripe and then dull without a new layout. Pure, so the scene and the tests agree.

import type { LayoutFarm } from '../api/types'

export type FieldLook = 'bare' | 'sown' | 'green' | 'ripe' | 'stubble' | 'withered'
export interface Field { look: FieldLook; /** 0..1: green towards ripe while it grows, ripe towards spoilt while it waits */ blend: number }

/** The crop grows about six hours (farming.yml); used only to blend the colour. */
const GROW_MS = 6 * 3600 * 1000

export function fieldOf(f: LayoutFarm | undefined, nowMs: number): Field {
  if (!f) return { look: 'bare', blend: 0 }
  const ripe = f.ripe_at ? Date.parse(f.ripe_at) : NaN
  const spoil = f.spoil_at ? Date.parse(f.spoil_at) : NaN
  if (f.legacy) return { look: 'green', blend: 0.5 }
  switch (f.stage) {
    case 'sowing': return { look: 'sown', blend: 0 }
    case 'growing':
      // ripe by its own time, though the layout was read earlier
      if (Number.isFinite(ripe) && nowMs >= ripe) return ripeField(nowMs, ripe, spoil)
      return { look: 'green', blend: Number.isFinite(ripe) ? Math.max(0, Math.min(1, 1 - (ripe - nowMs) / GROW_MS)) : 0.3 }
    case 'ripe': case 'overripe': case 'harvest': return ripeField(nowMs, ripe, spoil)
    case 'harvested': return { look: 'stubble', blend: 0 }
    case 'rotted': return { look: 'withered', blend: 1 }
    default: return { look: 'bare', blend: 0 }
  }
}

function ripeField(nowMs: number, ripe: number, spoil: number): Field {
  if (!Number.isFinite(ripe) || !Number.isFinite(spoil) || spoil <= ripe) return { look: 'ripe', blend: 0 }
  return { look: 'ripe', blend: Math.max(0, Math.min(1, (nowMs - ripe) / (spoil - ripe))) }
}

/** A short key of what every farm looks like, in steps of a fifth: when it changes the buildings are drawn again. */
export function fieldsKey(farms: LayoutFarm[] | null | undefined, nowMs: number): string {
  return (farms ?? []).map((f) => { const x = fieldOf(f, nowMs); return `${f.building}:${x.look}:${Math.round(x.blend * 5)}` }).join('|')
}
