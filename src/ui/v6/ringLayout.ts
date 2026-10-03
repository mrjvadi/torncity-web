// The ring's geometry (ported from the approved prototype, home.js `place` / `openRing`): the actions fan out
// below the building (or above, when that would leave the safe rectangle), the arc is clamped inside it and is
// never clipped (P12). Every button is >= 44px with >= 8px between neighbours (P13, P24). Pure maths, no DOM.

export interface RingSpec { size: number; lw: number; lh: number }
export interface Placed { x: number; y: number; ly: number }
export interface RingPlan { flip: boolean; items: Placed[]; plateX: number; plateY: number }

// owner 2026-10-03: the ring was too big; the visible discs shrink, every hit area stays >= 44 px (P24)
export const SIZE = { info: 44, normal: 46, primary: 56 }
const STEP = 68, BASE = 26, DEPTH = 28, PLATE_H = 32

type Rect = [number, number, number, number]
const bounds = (rects: Rect[]) => rects.reduce((a, r) => ({ x0: Math.min(a.x0, r[0]), y0: Math.min(a.y0, r[1]), x1: Math.max(a.x1, r[2]), y1: Math.max(a.y1, r[3]) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 })

export function planRing(anchor: [number, number], specs: RingSpec[], plateW: number, safe: { x0: number; x1: number; y0: number; y1: number }, avoid: { edge: 'l' | 'r'; x0: number; x1: number; y0: number; y1: number }[]): RingPlan {
  const n = specs.length
  const tries = [false, true].map((flip) => {
    const items = specs.map((s, j) => {
      const u = (n - 1) / 2 - j, norm = n > 1 ? u / ((n - 1) / 2) : 0
      const dy = BASE + DEPTH * (1 - norm * norm) * (n > 3 ? 1 : n > 2 ? 0.8 : 0.5)
      return { s, x: anchor[0] + u * STEP, y: anchor[1] + (flip ? -dy : dy) }
    })
    const rects: Rect[] = []
    const placed = items.map((it) => {
      const r = it.s.size / 2
      rects.push([it.x - r, it.y - r, it.x + r, it.y + r])
      const lyTop = flip ? it.y - r - 4 - it.s.lh : it.y + r + 4
      rects.push([it.x - it.s.lw / 2, lyTop, it.x + it.s.lw / 2, lyTop + it.s.lh])
      return { x: it.x, y: it.y, ly: lyTop + it.s.lh / 2 }
    })
    const pyTop = flip ? anchor[1] + 26 : anchor[1] - 64
    rects.push([anchor[0] - plateW / 2, pyTop, anchor[0] + plateW / 2, pyTop + PLATE_H])
    const m = bounds(rects)
    let dx = 0
    if (m.x0 < safe.x0) dx = safe.x0 - m.x0
    if (m.x1 + dx > safe.x1) dx = safe.x1 - m.x1
    const vio = Math.max(0, safe.y0 - m.y0) + Math.max(0, m.y1 - safe.y1)
    return { flip, placed, pyTop, dx, vio, m }
  })
  let pick = tries[0]
  if (tries[0].vio > 0 && tries[1].vio < tries[0].vio) pick = tries[1]
  let dy = 0
  if (pick.m.y0 < safe.y0) dy = safe.y0 - pick.m.y0
  else if (pick.m.y1 > safe.y1) dy = safe.y1 - pick.m.y1
  // keep the name plate off the side rails
  let colL = safe.x0, colR = safe.x1
  const pT = pick.pyTop + dy, pB = pT + PLATE_H
  for (const a of avoid) {
    if (pB <= a.y0 || pT >= a.y1) continue
    if (a.edge === 'l') colL = Math.max(colL, a.x1 + 6)
    else colR = Math.min(colR, a.x0 - 6)
  }
  const plateX = Math.min(colR - plateW / 2, Math.max(colL + plateW / 2, anchor[0]))
  return {
    flip: pick.flip,
    items: pick.placed.map((p) => ({ x: p.x + pick.dx, y: p.y + dy, ly: p.ly + dy })),
    plateX,
    plateY: pick.pyTop + PLATE_H / 2 + dy,
  }
}
