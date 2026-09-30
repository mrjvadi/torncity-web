// Parametric models for the village's building types. Each is a platform
// (the footprint, sunk `foundation` metres so uneven ground never shows a
// gap) with a small composition on top, built from coloured boxes, roofs and
// cylinders and seeded by the layout's `visual_seed`. The origin is the middle
// of the footprint on the platform's floor; the facade looks towards +z.
// Nothing leaves the footprint rectangle.

import { Color, Vector3 } from 'three'
import { ColorGeom, G_PLAIN, G_ROOF, G_WALL, seededRng } from './colorGeom'

export interface Model { geom: ColorGeom; height: number }

const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const WALLS = [0xe4d8bd, 0xf0ebe0, 0xd9b98a, 0xc9d3c2, 0xe8cfc0, 0xd3c3a5, 0xb9c6d1, 0xeadfae]
const ROOFS = [0x9a4a30, 0x8a3f2b, 0x5b5348, 0x4a4d52, 0xa5583a, 0x6e3f30]
const STONE = 0xbdb6a6
const STONE_DARK = 0x8f897c
const TRIM = 0xf3efe6
const GLASS = 0x62809c
const WOOD = 0x8a6238
const WOOD_DARK = 0x5f4326
const EARTH = 0x9b8b6c
const GRAVEL = 0xb4ab98
const GRASS = 0x83a55a
const WATER = 0x3f88a8
const CANVAS = 0xe8dcc0

interface Ctx { W: number; D: number; rng: () => number; foundation: number; g: ColorGeom }

const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length) % a.length]

/** A window on a wall: a frame and a pane, facing `axis` (outward). */
function win(g: ColorGeom, cx: number, cy: number, cz: number, axis: '+z' | '-z' | '+x' | '-x', hw = 0.62, hh = 0.85): void {
  const o = 0.04
  const q = (a: number, b: number, off: number, col: number) => {
    switch (axis) {
      case '+z': g.quad(V(cx - a, cy - b, cz + off), V(cx + a, cy - b, cz + off), V(cx + a, cy + b, cz + off), V(cx - a, cy + b, cz + off), col, 0.3, G_PLAIN); break
      case '-z': g.quad(V(cx + a, cy - b, cz - off), V(cx - a, cy - b, cz - off), V(cx - a, cy + b, cz - off), V(cx + a, cy + b, cz - off), col, 0.3, G_PLAIN); break
      case '+x': g.quad(V(cx + off, cy - b, cz + a), V(cx + off, cy - b, cz - a), V(cx + off, cy + b, cz - a), V(cx + off, cy + b, cz + a), col, 0.3, G_PLAIN); break
      default: g.quad(V(cx - off, cy - b, cz - a), V(cx - off, cy - b, cz + a), V(cx - off, cy + b, cz + a), V(cx - off, cy + b, cz - a), col, 0.3, G_PLAIN)
    }
  }
  q(hw + 0.14, hh + 0.14, o, TRIM)
  q(hw, hh, o * 2, GLASS)
}

/** Rows of windows along the four sides of a box, skipping a door gap on +z. */
function windows(g: ColorGeom, cx: number, cz: number, w: number, d: number, floors: number, floorH: number, opts: { door?: number; sides?: string } = {}): void {
  const sides = opts.sides ?? '+z-z+x-x'
  const rows = (len: number) => Math.max(1, Math.round((len - 2.4) / 3.2))
  for (let f = 0; f < floors; f++) {
    const cy = 0.4 + f * floorH + floorH * 0.55
    if (sides.includes('+z') || sides.includes('-z')) {
      const n = rows(w), step = (w - 2.4) / n
      for (let i = 0; i < n; i++) {
        const x = cx - w / 2 + 1.2 + step * (i + 0.5)
        if (!(f === 0 && opts.door !== undefined && Math.abs(x - cx - opts.door) < 1.3) && sides.includes('+z')) win(g, x, cy, cz + d / 2, '+z')
        if (sides.includes('-z')) win(g, x, cy, cz - d / 2, '-z')
      }
    }
    if (sides.includes('+x') || sides.includes('-x')) {
      const n = rows(d), step = (d - 2.4) / n
      for (let i = 0; i < n; i++) {
        const z = cz - d / 2 + 1.2 + step * (i + 0.5)
        if (sides.includes('+x')) win(g, cx + w / 2, cy, z, '+x')
        if (sides.includes('-x')) win(g, cx - w / 2, cy, z, '-x')
      }
    }
  }
}

function door(g: ColorGeom, cx: number, cz: number, d: number, dx: number, color = 0x5a3a26): void {
  g.box(cx + dx, 1.1, cz + d / 2 + 0.06, 1.4, 2.2, 0.14, TRIM)
  g.box(cx + dx, 1.05, cz + d / 2 + 0.14, 1.1, 2.05, 0.05, color, G_PLAIN)
  g.box(cx + dx, 0.05, cz + d / 2 + 0.6, 2.0, 0.16, 1.0, GRAVEL, G_PLAIN)
}

interface HouseOpts { floors?: number; roof?: 'gable' | 'hip' | 'flat'; wall?: number; roofColor?: number; floorH?: number; ridge?: 'x' | 'z' }

/** A small house with walls, roof, door and windows; returns its height. */
function house(g: ColorGeom, cx: number, cz: number, w: number, d: number, rng: () => number, o: HouseOpts = {}): number {
  const floors = o.floors ?? 2
  const floorH = o.floorH ?? 3.0
  const H = floors * floorH
  const wall = new Color(o.wall ?? pick(rng, WALLS))
  const roofC = new Color(o.roofColor ?? pick(rng, ROOFS))
  const roof = o.roof ?? (rng() < 0.7 ? 'gable' : 'hip')
  g.box(cx, H / 2 + 0.05, cz, w, H + 0.1, d, wall, G_WALL)
  g.box(cx, 0.3, cz, w + 0.14, 0.6, d + 0.14, STONE_DARK, G_PLAIN)
  const rise = (o.ridge === 'z' ? w : d) * 0.36
  if (roof === 'gable') {
    const ridge = o.ridge ?? (w >= d ? 'x' : 'z')
    g.gable(cx, cz, w, d, H, ridge === 'x' ? d * 0.36 : w * 0.36, ridge, roofC, wall)
    g.box(cx + w * 0.22, H + rise * 0.7, cz - d * 0.2, 0.8, rise * 1.05 + 0.5, 0.8, 0x8a5a48, G_PLAIN)
  } else if (roof === 'hip') {
    g.hip(cx, cz, w, d, H, Math.min(w, d) * 0.3, roofC)
  } else {
    g.flatRoof(cx, cz, w, d, H + 0.05, 0x6a6d70, 0xcfc9bc)
  }
  const dx = (rng() < 0.5 ? 1 : -1) * Math.min(w / 2 - 1.6, w * 0.18)
  door(g, cx, cz, d, dx, pick(rng, [0x5a3a26, 0x2f4a3c, 0x6d2f2a, 0x33445a]))
  windows(g, cx, cz, w, d, floors, floorH, { door: dx })
  return H + rise
}

function tree(g: ColorGeom, x: number, z: number, s: number, rng: () => number): void {
  g.cylinder(x, z, 0.22 * s, 0, 2.6 * s, WOOD_DARK, G_PLAIN, 6, 0.14 * s)
  const c = new Color(0x3f6b2e).offsetHSL(0, 0, (rng() - 0.5) * 0.08)
  g.cone(x, z, 1.9 * s, 1.6 * s, 5.6 * s, c, G_PLAIN, 8)
  g.cone(x, z, 1.4 * s, 3.4 * s, 6.8 * s, c.clone().offsetHSL(0, 0, 0.03), G_PLAIN, 8)
}

function fence(g: ColorGeom, x0: number, z0: number, x1: number, z1: number, color = WOOD): void {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(1, Math.round(len / 3))
  for (let i = 0; i <= n; i++) g.box(x0 + ((x1 - x0) * i) / n, 0.55, z0 + ((z1 - z0) * i) / n, 0.14, 1.1, 0.14, color, G_PLAIN)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  const horizontal = Math.abs(x1 - x0) > Math.abs(z1 - z0)
  g.box(cx, 0.85, cz, horizontal ? len : 0.08, 0.07, horizontal ? 0.08 : len, color, G_PLAIN)
  g.box(cx, 0.45, cz, horizontal ? len : 0.08, 0.07, horizontal ? 0.08 : len, color, G_PLAIN)
}

function fenceRect(g: ColorGeom, cx: number, cz: number, w: number, d: number, color = WOOD): void {
  fence(g, cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, color)
  fence(g, cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, color)
  fence(g, cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, color)
  fence(g, cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, color)
}

/** A flat patch of ground colour a few centimetres above the platform. */
function patch(g: ColorGeom, cx: number, cz: number, w: number, d: number, y: number, color: number): void {
  g.quad(V(cx - w / 2, y, cz + d / 2), V(cx + w / 2, y, cz + d / 2), V(cx + w / 2, y, cz - d / 2), V(cx - w / 2, y, cz - d / 2), color, 0.2, G_PLAIN)
}

function furrows(g: ColorGeom, cx: number, cz: number, w: number, d: number, color: number, gap = 1.6): void {
  const n = Math.max(2, Math.floor(w / gap))
  for (let i = 0; i < n; i++) g.box(cx - w / 2 + (w * (i + 0.5)) / n, 0.32, cz, gap * 0.45, 0.3, d, color, G_PLAIN)
}

function chimney(g: ColorGeom, x: number, z: number, y0: number, h: number, r = 0.9): void {
  g.cylinder(x, z, r, y0, y0 + h, 0x9c6a52, G_WALL, 8, r * 0.75)
  g.cylinder(x, z, r * 0.8, y0 + h, y0 + h + 0.15, 0x2a2622, G_PLAIN, 8)
}

function crossSign(g: ColorGeom, cx: number, cy: number, cz: number, s: number): void {
  const o = 0.07
  const red = 0xc8322d
  g.quad(V(cx - s, cy - s * 0.32, cz + o), V(cx + s, cy - s * 0.32, cz + o), V(cx + s, cy + s * 0.32, cz + o), V(cx - s, cy + s * 0.32, cz + o), red, 0.3, G_PLAIN)
  g.quad(V(cx - s * 0.32, cy - s, cz + o), V(cx + s * 0.32, cy - s, cz + o), V(cx + s * 0.32, cy + s, cz + o), V(cx - s * 0.32, cy + s, cz + o), red, 0.3, G_PLAIN)
}

function awning(g: ColorGeom, cx: number, y: number, cz: number, w: number, depth: number, color: number): void {
  g.quad(V(cx - w / 2, y, cz + depth), V(cx + w / 2, y, cz + depth), V(cx + w / 2, y + 0.6, cz), V(cx - w / 2, y + 0.6, cz), color, 0.3, G_PLAIN)
  g.quad(V(cx - w / 2, y, cz + depth), V(cx - w / 2, y + 0.6, cz), V(cx + w / 2, y + 0.6, cz), V(cx + w / 2, y, cz + depth), color, 0.3, G_PLAIN)
}

function crates(g: ColorGeom, x: number, z: number, n: number, rng: () => number): void {
  for (let i = 0; i < n; i++) g.box(x + (rng() - 0.5) * 2.4, 0.5 + (i % 2) * 0.9, z + (rng() - 0.5) * 2.4, 1.0, 1.0, 1.0, pick(rng, [WOOD, 0x9d7a4a, 0x6f5a3c]), G_PLAIN)
}

function logStack(g: ColorGeom, x: number, z: number, len: number, rows: number): void {
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) g.box(x, 0.3 + r * 0.55, z + (i - (rows - r - 1) / 2) * 0.6, len, 0.5, 0.5, 0x8c6b3f, G_PLAIN)
}

function tent(g: ColorGeom, x: number, z: number, r: number, color: number): void {
  g.cone(x, z, r, 0, r * 1.3, color, G_PLAIN, 6)
}

function sawtooth(g: ColorGeom, cx: number, cz: number, w: number, d: number, H: number, teeth: number, roofC: number): void {
  const step = w / teeth
  for (let i = 0; i < teeth; i++) {
    const x0 = cx - w / 2 + i * step, x1 = x0 + step
    g.quad(V(x0, H, cz + d / 2), V(x1, H + 2.2, cz + d / 2), V(x1, H + 2.2, cz - d / 2), V(x0, H, cz - d / 2), roofC, 0.3, G_ROOF)
    g.quad(V(x1, H + 2.2, cz + d / 2), V(x1, H, cz + d / 2), V(x1, H, cz - d / 2), V(x1, H + 2.2, cz - d / 2), GLASS, 0.3, G_PLAIN)
    g.tri(V(x0, H, cz + d / 2), V(x1, H, cz + d / 2), V(x1, H + 2.2, cz + d / 2), 0xc9c1ae, 0.3, G_WALL)
    g.tri(V(x1, H, cz - d / 2), V(x0, H, cz - d / 2), V(x1, H + 2.2, cz - d / 2), 0xc9c1ae, 0.3, G_WALL)
  }
}

// -- the generators ---------------------------------------------------------

type Gen = (c: Ctx) => number

const civicHall: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 3, D - 3, 0.2, GRAVEL)
  const w = W * 0.62, d = D * 0.42, H = 8.5
  g.box(0, H / 2 + 0.1, -D * 0.06, w, H, d, 0xe6dfcd, G_WALL)
  g.box(0, 0.4, -D * 0.06, w + 0.3, 0.8, d + 0.3, STONE_DARK, G_PLAIN)
  g.hip(0, -D * 0.06, w, d, H, 3.8, pick(rng, ROOFS), 0.9)
  const zf = -D * 0.06 + d / 2
  for (let i = -2; i <= 2; i++) g.cylinder(i * (w / 5), zf + 1.6, 0.42, 0.2, H - 0.4, TRIM, G_WALL, 8)
  g.box(0, H - 0.2, zf + 1.6, w, 0.7, 1.4, TRIM, G_WALL)
  g.gable(0, zf + 1.6, w * 0.8, 3.2, H + 0.5, 1.8, 'x', 0x8a5a48, TRIM, 0.2)
  windows(g, 0, -D * 0.06, w, d, 2, 3.7, { door: 0, sides: '+z-z+x-x' })
  g.box(0, 1.4, zf + 0.08, 2.2, 2.8, 0.2, 0x4a3524, G_PLAIN)
  for (let s = 0; s < 4; s++) g.box(0, 0.12 + s * 0.14, zf + 4.2 - s * 0.8, 6, 0.14, 0.8, STONE, G_PLAIN)
  g.cylinder(w * 0.34, -D * 0.06 - d * 0.12, 1.5, H, H + 4.5, 0xe2d9c4, G_WALL, 8)
  g.cone(w * 0.34, -D * 0.06 - d * 0.12, 2.0, H + 4.5, H + 7.2, 0x4a6b7a, G_ROOF, 8)
  g.cylinder(-W * 0.3, D * 0.34, 0.1, 0.2, 9, 0xcfcfcf, G_PLAIN, 6)
  g.quad(V(-W * 0.3, 8.6, D * 0.34), V(-W * 0.3 + 2.2, 8.2, D * 0.34), V(-W * 0.3 + 2.2, 7.0, D * 0.34), V(-W * 0.3, 7.4, D * 0.34), 0x2f7a4d, 0.3, G_PLAIN)
  return H + 7.2
}

const housingBlock: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 2, D - 2, 0.2, 0x8fa564)
  const cols = Math.max(2, Math.floor((W - 3) / 15)), rows = Math.max(2, Math.floor((D - 3) / 15))
  const cw = (W - 4) / cols, cd = (D - 4) / rows
  let top = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = cw - 3.2 - rng() * 1.2, d = cd - 4 - rng() * 1.5
      const h = house(g, -W / 2 + 2 + cw * (c + 0.5), -D / 2 + 2 + cd * (r + 0.5), Math.max(6, w), Math.max(6, d), rng, { floors: rng() < 0.4 ? 1 : 2 })
      top = Math.max(top, h)
    }
  }
  for (let i = 0; i < 4; i++) tree(g, (rng() - 0.5) * (W - 8), (rng() - 0.5) * (D - 8), 0.55, rng)
  return top
}

const park: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x6f9a4b)
  patch(g, 0, 0, 2.6, D - 3, 0.24, GRAVEL)
  patch(g, 0, 0, W - 3, 2.6, 0.24, GRAVEL)
  g.cylinder(W * 0.22, D * 0.22, Math.min(W, D) * 0.15, 0.2, 0.26, WATER, G_PLAIN, 14)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng()
    tree(g, Math.cos(a) * W * 0.36, Math.sin(a) * D * 0.36, 0.7 + rng() * 0.4, rng)
  }
  for (const [x, z] of [[-4, -3], [4, 3], [-4, 4]]) {
    g.box(x, 0.55, z, 2.0, 0.12, 0.55, WOOD, G_PLAIN)
    g.box(x, 0.3, z, 1.8, 0.35, 0.4, WOOD_DARK, G_PLAIN)
  }
  return 7
}

const bank: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 2, D - 2, 0.2, GRAVEL)
  const w = W * 0.7, d = D * 0.6, H = 9
  g.box(0, H / 2 + 0.1, -D * 0.05, w, H, d, 0xd8d1be, G_WALL)
  g.flatRoof(0, -D * 0.05, w, d, H + 0.1, 0x66696b, 0xcbc4b3)
  const zf = -D * 0.05 + d / 2
  for (let i = -2; i <= 2; i++) g.cylinder(i * (w / 5), zf + 1.2, 0.5, 0.2, H - 0.4, TRIM, G_WALL, 8)
  g.gable(0, zf + 1.2, w * 0.9, 2.4, H, 2.2, 'x', 0xb8b0a0, TRIM, 0.2)
  windows(g, 0, -D * 0.05, w, d, 2, 4.2, { door: 0 })
  g.box(0, 1.5, zf + 0.1, 2.4, 3, 0.2, 0x3a3f46, G_PLAIN)
  void rng
  return H + 2.6
}

const barracks: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 2, D - 2, 0.2, EARTH)
  const rows = Math.max(2, Math.floor(D / 20))
  for (let r = 0; r < rows; r++) {
    const z = -D / 2 + 7 + r * ((D - 14) / Math.max(1, rows - 1) || 0)
    house(g, 0, z, W * 0.72, 8, rng, { floors: 1, roof: 'gable', ridge: 'x', wall: 0xc8bfa4, roofColor: 0x5b5348, floorH: 3.2 })
  }
  fenceRect(g, 0, 0, W - 3, D - 3, WOOD_DARK)
  g.cylinder(W * 0.32, D * 0.32, 0.12, 0.2, 10, 0xcfcfcf, G_PLAIN, 6)
  g.quad(V(W * 0.32, 9.6, D * 0.32), V(W * 0.32 + 2.6, 9.2, D * 0.32), V(W * 0.32 + 2.6, 7.6, D * 0.32), V(W * 0.32, 8.0, D * 0.32), 0xa02a2a, 0.3, G_PLAIN)
  return 10
}

const port: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, STONE_DARK)
  g.box(0, 0.35, D * 0.32, W - 3, 0.5, D * 0.3, WOOD, G_PLAIN)
  house(g, -W * 0.22, -D * 0.22, W * 0.4, D * 0.3, rng, { floors: 1, roof: 'gable', ridge: 'x', wall: 0xb9a98c, roofColor: 0x4a4d52, floorH: 5.5 })
  // crane
  g.box(W * 0.3, 6, -D * 0.05, 1.0, 12, 1.0, 0xd8a52a, G_PLAIN)
  g.box(W * 0.3 - 4, 12, -D * 0.05, 9, 0.6, 0.6, 0xd8a52a, G_PLAIN)
  g.box(W * 0.3 - 7.5, 9, -D * 0.05, 0.12, 6, 0.12, 0x333333, G_PLAIN)
  crates(g, W * 0.05, D * 0.05, 6, rng)
  crates(g, -W * 0.3, D * 0.15, 5, rng)
  for (let i = -3; i <= 3; i++) g.cylinder(i * (W / 8), D * 0.46, 0.3, 0, 0.9, 0x2d2f33, G_PLAIN, 6)
  return 13
}

const airport: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x7d9a5a)
  patch(g, 0, D * 0.22, W - 4, D * 0.16, 0.28, 0x3d3f44)
  for (let i = -8; i <= 8; i++) patch(g, i * ((W - 8) / 16), D * 0.22, 3, 0.5, 0.32, 0xf0ece0)
  house(g, -W * 0.28, -D * 0.25, W * 0.32, D * 0.2, rng, { floors: 1, roof: 'gable', ridge: 'x', wall: 0xc9c9c0, roofColor: 0x6a7076, floorH: 7 })
  g.cylinder(W * 0.3, -D * 0.28, 1.3, 0.2, 14, 0xe6e2d4, G_WALL, 10)
  g.box(W * 0.3, 15.4, -D * 0.28, 4.4, 2.6, 4.4, GLASS, G_PLAIN)
  g.hip(W * 0.3, -D * 0.28, 4.6, 4.6, 16.7, 1.2, 0x4a4d52, 0.3)
  return 18
}

const wateredField = (g: ColorGeom, cx: number, cz: number, w: number, d: number): void => {
  g.box(cx, 0.32, cz - d / 2, w, 0.4, 0.5, 0x7a6a4a, G_PLAIN)
  g.box(cx, 0.32, cz + d / 2, w, 0.4, 0.5, 0x7a6a4a, G_PLAIN)
  g.box(cx - w / 2, 0.32, cz, 0.5, 0.4, d, 0x7a6a4a, G_PLAIN)
  g.box(cx + w / 2, 0.32, cz, 0.5, 0.4, d, 0x7a6a4a, G_PLAIN)
  patch(g, cx, cz, w - 0.8, d - 0.8, 0.3, WATER)
}

function farm(kind: string): Gen {
  return ({ g, W, D, rng }) => {
    patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x8a7a55)
    const fw = (W - 6) / 2, fd = (D - 14) / 2
    const cols = [0xb9a24a, 0x6f8f3e, 0x7a5c38, 0x9bb04a]
    const spots: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    let k = 0
    for (const [sx, sz] of spots) {
      const cx = sx * (fw / 2 + 0.6), cz = -D * 0.18 + sz * (fd / 2 + 0.6) - (sz > 0 ? 0 : 0)
      if (kind === 'farm_paddy') wateredField(g, cx, cz, fw - 1, fd - 1)
      else { patch(g, cx, cz, fw - 1, fd - 1, 0.26, cols[(k + Math.floor(rng() * 4)) % 4]); furrows(g, cx, cz, fw - 1.6, fd - 1.6, new Color(cols[k % 4]).multiplyScalar(0.78).getHex()) }
      k++
    }
    if (kind === 'farm_canal') patch(g, 0, -D * 0.18, 2.2, D - 14, 0.34, WATER)
    if (kind === 'farm_terrace') for (let i = 0; i < 3; i++) g.box(0, 0.5 + i * 0.6, -D * 0.34 + i * 3, W - 6, 0.5, 1.2, STONE_DARK, G_PLAIN)
    if (kind === 'farm_shaft') { g.cylinder(0, -D * 0.18, 1.2, 0.2, 1.4, STONE, G_WALL, 8); g.cone(0, -D * 0.18, 1.8, 3.2, 4.4, 0x8a3f2b, G_ROOF, 4); for (const s of [-1, 1]) g.box(s * 1.2, 1.8, -D * 0.18, 0.16, 3, 0.16, WOOD, G_PLAIN) }
    house(g, 0, D * 0.36, W * 0.34, D * 0.18, rng, { floors: 1, roof: 'gable', ridge: 'x' })
    return 6
  }
}

const pasture: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x7fa557)
  fenceRect(g, 0, 0, W - 3, D - 3)
  g.box(-W * 0.25, 1.5, -D * 0.25, 7, 3, 4, WOOD, G_WALL)
  g.gable(-W * 0.25, -D * 0.25, 7, 4, 3, 1.6, 'x', 0x6e3f30, WOOD, 0.4)
  for (let i = 0; i < 9; i++) {
    const x = (rng() - 0.5) * (W - 10), z = (rng() - 0.5) * (D - 10) + 4
    g.box(x, 0.8, z, 1.6, 0.9, 0.7, pick(rng, [0xf1efe8, 0x3a3532, 0xb08a5b]), G_PLAIN)
    g.box(x + 0.9, 1.1, z, 0.5, 0.5, 0.45, 0x2d2926, G_PLAIN)
  }
  return 4.6
}

const workshop = (kind: string): Gen => ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, EARTH)
  const wall = kind === 'masonry_workshop' ? 0xc9c1b0 : kind === 'smithy' ? 0x8d857a : kind === 'weaving_shed' ? 0xd9c8a6 : 0xd2b88c
  const h = house(g, 0, -D * 0.12, W * 0.66, D * 0.5, rng, { floors: 1, floorH: 4.6, wall, roof: 'gable', ridge: 'x', roofColor: kind === 'pottery_kiln' ? 0x9a4a30 : 0x5b5348 })
  if (kind === 'smithy') chimney(g, W * 0.2, -D * 0.2, 4.6, 6)
  if (kind === 'carpentry_workshop') { logStack(g, -W * 0.25, D * 0.3, 5, 3); logStack(g, W * 0.1, D * 0.32, 5, 3) }
  if (kind === 'masonry_workshop') for (let i = 0; i < 6; i++) g.box(-W * 0.3 + i * 2.6, 0.7, D * 0.32, 2, 1, 1.5, pick(rng, [STONE, STONE_DARK]), G_PLAIN)
  if (kind === 'weaving_shed') for (let i = 0; i < 4; i++) g.box(-W * 0.3 + i * 4, 0.9, D * 0.32, 0.12, 1.8, 0.12, pick(rng, [0xb02a2a, 0x2a5aa0, 0xd8a52a]), G_PLAIN)
  if (kind === 'pottery_kiln') { g.cylinder(W * 0.24, D * 0.28, 2.4, 0.2, 2.6, 0xa8623f, G_WALL, 10, 1.8); g.cone(W * 0.24, D * 0.28, 1.8, 2.6, 3.6, 0x7d4a30, G_ROOF, 10); for (let i = 0; i < 5; i++) g.cylinder(-W * 0.3 + i * 1.6, D * 0.32, 0.5, 0.2, 1.3, 0xc07a4a, G_PLAIN, 6, 0.35) }
  return h + 3
}

const manufactory: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  const w = W * 0.78, d = D * 0.42, H = 8
  g.box(0, H / 2 + 0.1, -D * 0.15, w, H, d, 0xb9b09a, G_WALL)
  sawtooth(g, 0, -D * 0.15, w, d, H + 0.1, 4, 0x6a6d70)
  windows(g, 0, -D * 0.15, w, d, 1, 6.5, { door: 0 })
  chimney(g, w * 0.36, -D * 0.28, H, 10)
  crates(g, -W * 0.25, D * 0.28, 5, rng)
  g.cylinder(W * 0.25, D * 0.3, 2.2, 0.2, 6, 0x8f9aa2, G_PLAIN, 10)
  return H + 11
}

const factory: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  for (let i = 0; i < 2; i++) {
    const cx = (i - 0.5) * (W * 0.44), w = W * 0.4, d = D * 0.48, H = 10
    g.box(cx, H / 2 + 0.1, -D * 0.15, w, H, d, 0xa9a08a, G_WALL)
    sawtooth(g, cx, -D * 0.15, w, d, H + 0.1, 3, 0x5a5d60)
    windows(g, cx, -D * 0.15, w, d, 1, 8, { door: 0 })
  }
  chimney(g, -W * 0.36, D * 0.02, 0.2, 22, 1.4)
  chimney(g, W * 0.38, D * 0.02, 0.2, 18, 1.2)
  for (let i = 0; i < 3; i++) g.cylinder(-W * 0.3 + i * 5, D * 0.34, 2.4, 0.2, 7, 0x8f9aa2, G_PLAIN, 12)
  crates(g, W * 0.2, D * 0.33, 8, rng)
  return 24
}

const pit: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1, D - 1, 0.2, 0x8c7a5c)
  g.cylinder(0, 0, Math.min(W, D) * 0.32, 0.18, 0.24, 0x3a3128, G_PLAIN, 12)
  g.cone(Math.min(W, D) * 0.3, -Math.min(W, D) * 0.25, Math.min(W, D) * 0.28, 0.2, 2.2, 0x6f6252, G_PLAIN, 9)
  g.box(-W * 0.25, 1.2, -D * 0.2, 0.2, 2.4, 0.2, WOOD, G_PLAIN)
  g.box(-W * 0.25, 2.3, -D * 0.2, 2.6, 0.2, 0.2, WOOD, G_PLAIN)
  void rng
  return 3
}

const mine: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x857560)
  g.cone(W * 0.28, D * 0.22, W * 0.24, 0.2, 5, 0x6a5e4e, G_PLAIN, 10)
  for (const s of [-1, 1]) g.box(s * 2.2, 5, -D * 0.1, 0.5, 10, 0.5, WOOD_DARK, G_PLAIN)
  g.box(0, 10.2, -D * 0.1, 5.4, 0.6, 0.6, WOOD_DARK, G_PLAIN)
  g.cylinder(0, -D * 0.1, 1.3, 9.2, 9.9, 0x555555, G_PLAIN, 10)
  house(g, -W * 0.22, D * 0.22, W * 0.38, D * 0.22, rng, { floors: 1, floorH: 4, wall: 0x9a917f, roof: 'gable', roofColor: 0x4a4d52 })
  g.box(W * 0.05, 1.4, D * 0.35, 0.16, 2.4, 3.6, 0x333333, G_PLAIN)
  return 11
}

const waterWorks = (kind: string): Gen => ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1, D - 1, 0.2, 0x8a7d62)
  if (kind === 'canal_channel') {
    g.box(0, 0.5, -D * 0.28, W - 1, 0.8, 1.0, STONE, G_WALL)
    g.box(0, 0.5, D * 0.28, W - 1, 0.8, 1.0, STONE, G_WALL)
    patch(g, 0, 0, W - 1.5, D * 0.5, 0.42, WATER)
    return 2
  }
  if (kind === 'shaft_well') {
    g.cylinder(0, 0, 3.4, 0.2, 1.4, STONE, G_WALL, 12)
    g.cylinder(0, 0, 2.5, 1.4, 1.42, 0x1d2a33, G_PLAIN, 12)
    for (const s of [-1, 1]) g.box(s * 3.2, 2.4, 0, 0.3, 4.4, 0.3, WOOD, G_PLAIN)
    g.gable(0, 0, 7.6, 3, 4.6, 1.6, 'z', 0x8a3f2b, WOOD, 0.3)
    return 6.5
  }
  if (kind === 'terrace_works') {
    for (let i = 0; i < 3; i++) {
      g.box(0, 0.5 + i * 0.8, D * 0.3 - i * 7, W - 2, 1.0 + i * 0.2, 5, STONE_DARK, G_WALL)
      patch(g, 0, D * 0.3 - i * 7, W - 3.4, 4.2, 1.04 + i * 0.8 + 0.1, 0x84a24f)
    }
    return 4
  }
  // paddy_banks
  wateredField(g, 0, 0, W - 3, D - 3)
  for (let i = 0; i < 5; i++) g.box(-W * 0.3 + i * 1.6, 0.42, (rng() - 0.5) * D * 0.4, 0.14, 0.5, 0.14, 0x4f8a3a, G_PLAIN)
  return 1.6
}

const healthHouse = (big: boolean): Gen => ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  const h = house(g, 0, -D * 0.05, W * (big ? 0.72 : 0.62), D * (big ? 0.5 : 0.5), rng, { floors: big ? 2 : 1, floorH: big ? 3.6 : 4, wall: 0xf2f0ea, roof: big ? 'flat' : 'gable', roofColor: 0xb9b0a0 })
  crossSign(g, 0, (big ? 7.4 : 5.4), D * 0.2 - D * 0.05 + 0.0, 1.5)
  crossSign(g, 0, big ? 7.6 : 5.6, -D * 0.05 + (D * 0.5) / 2 + 0.06, 1.3)
  for (let i = 0; i < 3; i++) tree(g, -W * 0.36 + i * 2.5, D * 0.36, 0.5, rng)
  return h + 1
}

const teachingCircle: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 0.8, D - 0.8, 0.2, 0x9aa870)
  const r = Math.min(W, D) * 0.32
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.box(Math.cos(a) * r, 0.5, Math.sin(a) * r, 1.6, 0.5, 0.5, STONE, G_PLAIN)
  }
  g.cylinder(0, 0, 0.7, 0.2, 1.7, STONE, G_WALL, 8)
  tree(g, -r * 1.2, -r * 1.1, 0.9, rng)
  return 5.5
}

const school: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  const h = house(g, 0, -D * 0.18, W * 0.7, D * 0.28, rng, { floors: 2, floorH: 3.6, wall: 0xe6d3a4, roof: 'gable', ridge: 'x', roofColor: 0x9a4a30 })
  house(g, -W * 0.28, D * 0.14, W * 0.24, D * 0.24, rng, { floors: 1, floorH: 3.6, wall: 0xe6d3a4, roof: 'gable', ridge: 'z', roofColor: 0x9a4a30 })
  g.cylinder(W * 0.22, -D * 0.18, 1.0, 7.2, 10, 0xe6d3a4, G_WALL, 6)
  g.cone(W * 0.22, -D * 0.18, 1.4, 10, 12, 0x9a4a30, G_ROOF, 6)
  fenceRect(g, W * 0.2, D * 0.26, W * 0.44, D * 0.3, WOOD_DARK)
  return h + 4
}

const stall = (g: ColorGeom, x: number, z: number, w: number, color: number, rng: () => number): void => {
  g.box(x, 0.55, z, w, 1.1, 1.6, WOOD, G_PLAIN)
  for (const s of [-1, 1]) g.box(x + s * (w / 2 - 0.1), 1.6, z + 0.6, 0.12, 3.2, 0.12, WOOD_DARK, G_PLAIN)
  awning(g, x, 3.0, z - 0.4, w + 0.6, 2.2, color)
  crates(g, x, z + 1.6, 2, rng)
}

const barterPost: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1, D - 1, 0.2, GRAVEL)
  stall(g, 0, -D * 0.1, W * 0.6, 0xb8452f, rng)
  crates(g, -W * 0.2, D * 0.3, 3, rng)
  return 4
}

const market: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  const cols = [0xb8452f, 0x2f6fa0, 0xd8a52a, 0x3f7f4f, 0xb8452f, 0x8a3fa0]
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) stall(g, -W * 0.3 + c * (W * 0.3), -D * 0.26 + r * (D * 0.42), W * 0.22, cols[(r * 3 + c) % cols.length], rng)
  g.cylinder(0, 0, 1.3, 0.2, 1.1, STONE, G_WALL, 10)
  return 4.5
}

const granary: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1, D - 1, 0.2, EARTH)
  g.cylinder(0, 0, Math.min(W, D) * 0.3, 0.2, 5.5, 0xb9a678, G_WALL, 12)
  g.cone(0, 0, Math.min(W, D) * 0.34, 5.5, 8, 0x7d4a30, G_ROOF, 12)
  void rng
  return 8
}

const granaryBig: Gen = (c) => {
  const { g, W, D, rng } = c
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, EARTH)
  house(g, 0, -D * 0.15, W * 0.62, D * 0.42, rng, { floors: 1, floorH: 5, wall: 0xb08a5b, roof: 'gable', ridge: 'x', roofColor: 0x6e3f30 })
  for (let i = 0; i < 2; i++) { g.cylinder(-W * 0.2 + i * W * 0.4, D * 0.28, 2.4, 0.2, 7, 0xb9a678, G_WALL, 12); g.cone(-W * 0.2 + i * W * 0.4, D * 0.28, 2.7, 7, 9, 0x7d4a30, G_ROOF, 12) }
  return 9.5
}

const watchHut: Gen = ({ g, W, D }) => {
  patch(g, 0, 0, W - 1, D - 1, 0.2, EARTH)
  const s = Math.min(W, D) * 0.16
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x * s, 4, z * s, 0.4, 8, 0.4, WOOD_DARK, G_PLAIN)
  g.box(0, 7.6, 0, s * 2.5, 0.4, s * 2.5, WOOD, G_PLAIN)
  for (const [x, z, w2, d2] of [[0, s * 1.2, s * 2.5, 0.2], [0, -s * 1.2, s * 2.5, 0.2], [s * 1.2, 0, 0.2, s * 2.5], [-s * 1.2, 0, 0.2, s * 2.5]]) g.box(x, 8.4, z, w2, 1.2, d2, WOOD, G_PLAIN)
  g.hip(0, 0, s * 2.7, s * 2.7, 10, 2.2, 0x7d4a30, 0.6)
  for (let i = 0; i < 8; i++) g.box(s * 1.35, 0.6 + i * 0.95, s * 0.4, 0.1, 0.1, 1.1, WOOD, G_PLAIN)
  return 12.2
}

const militiaCamp: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, 0x8a7d5c)
  for (let i = 0; i < 4; i++) tent(g, -W * 0.28 + (i % 2) * W * 0.5, -D * 0.22 + Math.floor(i / 2) * D * 0.36, Math.min(W, D) * 0.16, pick(rng, [CANVAS, 0xb8b090, 0x9aa070]))
  fenceRect(g, 0, 0, W - 3, D - 3, WOOD_DARK)
  g.cone(0, D * 0.05, 0.7, 0.2, 1.2, 0xd4761f, G_PLAIN, 5)
  return 6
}

const smallHall = (opts: HouseOpts, extras?: (c: Ctx) => void): Gen => (c) => {
  const { g, W, D, rng } = c
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  const h = house(g, 0, -D * 0.05, W * 0.72, D * 0.6, rng, opts)
  extras?.(c)
  return h + 1.5
}

const constable: Gen = smallHall({ floors: 1, floorH: 4.2, wall: 0xcbc3ae, roof: 'hip', roofColor: 0x4a5560 }, ({ g, W }) => {
  g.cylinder(W * 0.36, 0, 0.1, 0.2, 7, 0xcfcfcf, G_PLAIN, 6)
  g.quad(V(W * 0.36, 7, 0), V(W * 0.36 + 2, 6.7, 0), V(W * 0.36 + 2, 5.6, 0), V(W * 0.36, 5.9, 0), 0x2a4aa0, 0.3, G_PLAIN)
})

const policePost: Gen = smallHall({ floors: 2, floorH: 3.8, wall: 0xdad6c8, roof: 'flat' }, ({ g, D }) => {
  g.box(0, 5.4, -D * 0.05 + D * 0.3 - 0.05, 12, 0.7, 0.2, 0x2a4aa0, G_PLAIN)
})

const retainerHall: Gen = smallHall({ floors: 1, floorH: 5, wall: 0xb69a72, roof: 'gable', ridge: 'x', roofColor: 0x5b3a26 })

const generic: Gen = ({ g, W, D, rng }) => {
  patch(g, 0, 0, W - 1.5, D - 1.5, 0.2, GRAVEL)
  return house(g, 0, 0, W * 0.6, D * 0.6, rng)
}

const GENS: Record<string, Gen> = {
  civic_hall: civicHall, housing_block: housingBlock, park, bank, barracks, port, airport,
  watch_hut: watchHut, militia_camp: militiaCamp, retainer_hall: retainerHall, constable_post: constable, police_post: policePost,
  carpentry_workshop: workshop('carpentry_workshop'), masonry_workshop: workshop('masonry_workshop'), smithy: workshop('smithy'),
  weaving_shed: workshop('weaving_shed'), pottery_kiln: workshop('pottery_kiln'), manufactory, factory,
  small_pit: pit, mine,
  canal_channel: waterWorks('canal_channel'), shaft_well: waterWorks('shaft_well'), terrace_works: waterWorks('terrace_works'), paddy_banks: waterWorks('paddy_banks'),
  farm_canal: farm('farm_canal'), farm_shaft: farm('farm_shaft'), farm_terrace: farm('farm_terrace'), farm_paddy: farm('farm_paddy'),
  pasture_range: pasture,
  health_house: healthHouse(false), clinic: healthHouse(true),
  teaching_circle: teachingCircle, school,
  barter_post: barterPost, market, granary: (c) => (Math.min(c.W, c.D) > 40 ? granaryBig(c) : granary(c)),
}

/** The finished model of a building type on a W x D metre footprint. */
export function buildModel(type: string, W: number, D: number, seed: number, foundation: number): Model {
  const g = new ColorGeom()
  const rng = seededRng(seed || 1)
  // the platform: sunk into the ground, top a hand's breadth above the base
  const f = Math.max(0.6, foundation)
  g.box(0, (0.16 - f) / 2, 0, W - 0.6, 0.16 + f, D - 0.6, STONE_DARK, G_PLAIN)
  const gen = GENS[type] ?? generic
  const height = gen({ W, D, rng, foundation: f, g })
  return { geom: g, height }
}

/** Under construction: a levelled pad and the building's frame rising
 * storey by storey to `progress` of its finished height (columns, floor
 * slabs, part of the walls), scaffolding round it, stacks of materials, and
 * a crane on the big ones. */
export function buildScaffold(type: string, W: number, D: number, seed: number, foundation: number, progress: number, finalHeight: number): Model {
  const g = new ColorGeom()
  const rng = seededRng((seed || 1) + 7)
  const f = Math.max(0.6, foundation)
  g.box(0, (0.16 - f) / 2, 0, W - 0.6, 0.16 + f, D - 0.6, STONE_DARK, G_PLAIN)
  patch(g, 0, 0, W - 1.6, D - 1.6, 0.2, 0x9b8b6c)
  const p = Math.max(0.04, Math.min(1, progress))
  const H = Math.max(4, finalHeight * 0.85)
  const bw = W * 0.62, bd = D * 0.62
  const storey = 3.4
  const reached = Math.max(0.5, H * p)
  const floors = Math.max(1, Math.ceil(reached / storey))
  const concrete = 0xb9b6ad
  // foundation slab
  g.box(0, 0.4, 0, bw + 0.6, 0.4, bd + 0.6, 0x8d8a82, G_PLAIN)
  // frame: columns on a grid, a slab per finished storey
  const nx = Math.max(2, Math.round(bw / 6)), nz = Math.max(2, Math.round(bd / 6))
  let top = 0.6
  for (let fl = 0; fl < floors; fl++) {
    const y0 = 0.6 + fl * storey
    const h = Math.min(storey, reached - fl * storey + 0.2)
    if (h < 0.4) break
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
      if (i > 0 && i < nx && k > 0 && k < nz && rng() < 0.4) continue
      g.box(-bw / 2 + (bw * i) / nx, y0 + h / 2, -bd / 2 + (bd * k) / nz, 0.55, h, 0.55, concrete, G_PLAIN)
    }
    top = y0 + h
    if (h > storey * 0.75 || fl < floors - 1) g.box(0, y0 + h - 0.15, 0, bw + 0.4, 0.3, bd + 0.4, concrete, G_PLAIN)
    // masonry infill on the lower storeys, the back and one side
    if (fl < floors - 1 || p > 0.55) {
      g.box(0, y0 + h * 0.45, -bd / 2 + 0.1, bw, h * 0.9, 0.35, pick(rng, WALLS), G_WALL)
      g.box(-bw / 2 + 0.1, y0 + h * 0.45, 0, 0.35, h * 0.9, bd, pick(rng, WALLS), G_WALL)
    }
  }
  // rebar stubs on the top storey
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) g.box(-bw / 2 + (bw * i) / nx, top + 0.6, -bd / 2 + (bd * k) / nz, 0.06, 1.2, 0.06, 0x7a4a2a, G_PLAIN)
  // scaffolding round the frame: poles, ledgers, boards, braces on the front
  const sx = bw + 2.4, sz = bd + 2.4
  const sTop = top + 1.6
  const px = Math.max(2, Math.round(sx / 5)), pz = Math.max(2, Math.round(sz / 5))
  const pole = (x: number, z: number) => g.box(x, sTop / 2 + 0.2, z, 0.14, sTop, 0.14, WOOD, G_PLAIN)
  for (let i = 0; i <= px; i++) { pole(-sx / 2 + (sx * i) / px, -sz / 2); pole(-sx / 2 + (sx * i) / px, sz / 2) }
  for (let k = 1; k < pz; k++) { pole(-sx / 2, -sz / 2 + (sz * k) / pz); pole(sx / 2, -sz / 2 + (sz * k) / pz) }
  for (let y = 2.0; y <= sTop; y += 2.4) {
    g.box(0, y, sz / 2, sx, 0.12, 0.12, WOOD, G_PLAIN)
    g.box(0, y, -sz / 2, sx, 0.12, 0.12, WOOD, G_PLAIN)
    g.box(sx / 2, y, 0, 0.12, 0.12, sz, WOOD, G_PLAIN)
    g.box(-sx / 2, y, 0, 0.12, 0.12, sz, WOOD, G_PLAIN)
    g.box(0, y - 0.1, sz / 2 - 0.4, sx, 0.08, 0.9, 0xa9834f, G_PLAIN)
  }
  for (let i = 0; i < px; i++) {
    const x0 = -sx / 2 + (sx * i) / px, x1 = x0 + sx / px
    g.quad(V(x0, 0.4, sz / 2 + 0.05), V(x0 + 0.1, 0.4, sz / 2 + 0.05), V(x1 + 0.1, sTop, sz / 2 + 0.05), V(x1, sTop, sz / 2 + 0.05), WOOD_DARK, 0.3, G_PLAIN)
  }
  // a green safety net on the front
  g.quad(V(-sx / 2, 1.0, sz / 2 + 0.08), V(-sx * 0.05, 1.0, sz / 2 + 0.08), V(-sx * 0.05, sTop - 0.6, sz / 2 + 0.08), V(-sx / 2, sTop - 0.6, sz / 2 + 0.08), 0x4c8a5a, 0.3, G_PLAIN)
  // materials on site
  logStack(g, -W * 0.36, D * 0.4, 4, 3)
  crates(g, W * 0.34, D * 0.4, 4, rng)
  g.cone(W * 0.38, -D * 0.38, 2.2, 0.2, 1.8, 0xc9b98a, G_PLAIN, 8)
  for (let i = 0; i < 4; i++) g.box(-W * 0.3 + i * 1.3, 0.55, -D * 0.42, 1.0, 0.7, 1.0, 0xc4c0b6, G_PLAIN)
  if (Math.min(W, D) > 40) {
    g.box(-W * 0.4, 9, -D * 0.4, 0.8, 18, 0.8, 0xd8a52a, G_PLAIN)
    g.box(-W * 0.4 + 6, 18, -D * 0.4, 14, 0.6, 0.6, 0xd8a52a, G_PLAIN)
    g.box(-W * 0.4 + 12, 15, -D * 0.4, 0.1, 6, 0.1, 0x333333, G_PLAIN)
  }
  return { geom: g, height: sTop }
}

/** A translucent block for previewing a building on a lot. */
export function boxPreview(W: number, D: number, H: number): ColorGeom {
  const g = new ColorGeom()
  g.box(0, H / 2, 0, W - 1, H, D - 1, 0xffffff, G_PLAIN)
  return g
}
