// A small kit of procedural buildings for the city, in the owner's palette
// (proto/city/builders.gd): what the Starter Kit does not cover (a bazaar's
// domes, a bank/civic front, a factory with a chimney, a shop's awning, a
// villa, a generic tower). One unit cube and one unit cylinder, shared by
// every mesh, cloned into a small local-space piece and coloured with a
// per-vertex colour (never a per-building material): every building of
// every plot in the whole city ends up in one of two merged BufferGeometries
// (opaque walls, glowing windows) built once by the caller, so a city of any
// size still costs two draw calls for its procedural buildings — the
// biggest single win for an iPhone's draw-call budget.

import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, Vector3 } from 'three'

const boxGeo = new BoxGeometry(1, 1, 1)
const cylGeo = new CylinderGeometry(1, 1, 1, 14)
const coneGeo = new ConeGeometry(1, 1, 16)

/** The two buckets every procedural primitive lands in: plain lit walls
 * (MeshLambertMaterial, vertex-coloured) and small glowing accents (an
 * unlit, vertex-coloured material standing in for per-vertex emissive,
 * which three's built-in materials don't support). */
export interface BuildBatch {
  opaque: BufferGeometry[]
  glow: BufferGeometry[]
}

export function newBatch(): BuildBatch {
  return { opaque: [], glow: [] }
}

const tmpMatrix = new Matrix4()
const tmpPos = new Vector3()
const tmpScale = new Vector3()
const IDENTITY_QUAT = new Quaternion()

/** Clone a shared unit geometry into a small, positioned, vertex-coloured
 * piece and file it into the batch's opaque or glow bucket. */
function prim(batch: BuildBatch, base: BufferGeometry, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, emissive: number): void {
  const geo = base.clone()
  tmpMatrix.compose(tmpPos.set(x, y + sy / 2, z), IDENTITY_QUAT, tmpScale.set(sx, sy, sz))
  geo.applyMatrix4(tmpMatrix)
  const c = new Color(color)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  ;(emissive > 0 ? batch.glow : batch.opaque).push(geo)
}

function box(batch: BuildBatch, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, emissive = 0): void {
  prim(batch, boxGeo, sx, sy, sz, x, y, z, color, emissive)
}

function cyl(batch: BuildBatch, r: number, h: number, x: number, y: number, z: number, color: number, emissive = 0): void {
  prim(batch, cylGeo, r, h, r, x, y, z, color, emissive)
}

function cone(batch: BuildBatch, r: number, h: number, x: number, y: number, z: number, color: number): void {
  prim(batch, coneGeo, r, h, r, x, y, z, color, 0)
}

const PAL = {
  stone: 0xefe6d2,
  trim: 0xd7cab0,
  roof: 0x5b6478,
  gold: 0xf2c255,
  teal: 0x2bc4b2,
  lapis: 0x3552c8,
  brick: 0xd9a66b,
  wallGrey: 0xaeb6c8,
  wallGreyDark: 0x8c8f9c,
  glassLit: 0xffd9a0,
  green: 0x4e9c58,
  hedge: 0x2f7a45,
  olive: 0x5e6a44,
  steel: 0xb8bdc8,
}

/** A civic front: a stone block, a colonnade, a tile band, a low tower —
 * used for the city's places (city hall, bank, and any other landmark). */
function civic(batch: BuildBatch, color = PAL.stone): void {
  box(batch, 1.7, 0.08, 1.3, 0, 0, 0, 0xd9d2c2)
  box(batch, 1.5, 0.55, 0.6, 0, 0.08, -0.25, color)
  for (let i = 0; i < 5; i++) cyl(batch, 0.035, 0.42, -0.55 + i * 0.28, 0.08, 0.18, PAL.stone)
  box(batch, 1.55, 0.06, 0.65, 0, 0.63, -0.25, PAL.trim)
  box(batch, 1.4, 0.35, 0.5, 0, 0.7, -0.35, PAL.roof)
  box(batch, 0.4, 0.7, 0.4, 0, 0.7, -0.45, color)
  box(batch, 0.44, 0.3, 0.44, 0, 1.4, -0.45, PAL.roof)
  cyl(batch, 0.02, 0.2, 0, 1.75, -0.45, PAL.gold)
  box(batch, 1.5, 0.06, 0.06, 0, 0.5, 0.06, PAL.teal)
}

/** A bazaar arcade: a brick strip topped with a row of small teal domes. */
function bazaar(batch: BuildBatch): void {
  box(batch, 1.8, 0.42, 0.62, 0, 0, 0, PAL.brick)
  const n = 4
  for (let i = 0; i < n; i++) {
    const x = -0.75 + i * (1.5 / (n - 1))
    cone(batch, 0.2, 0.22, x, 0.42, 0, PAL.teal)
    box(batch, 0.22, 0.28, 0.03, x, 0, 0.31, 0x3a2a1a)
  }
}

/** A shop: a small block, a striped awning, a lit front window. */
function shop(batch: BuildBatch, stripe: number): void {
  box(batch, 0.95, 0.55, 0.75, 0, 0, 0, 0xf1e4cc)
  box(batch, 0.95, 0.06, 0.78, 0, 0.55, 0, 0xc9b58f)
  for (let i = 0; i < 5; i++) {
    box(batch, 0.16, 0.03, 0.27, -0.38 + i * 0.19, 0.38, 0.47, i % 2 === 0 ? stripe : 0xfff6e6)
  }
  box(batch, 0.75, 0.3, 0.03, 0, 0.05, 0.38, PAL.glassLit, 0.6)
}

/** A villa: two wings, a lit glass band, a small pool patch, a hedge. */
function villa(batch: BuildBatch, wall: number): void {
  box(batch, 1.5, 0.03, 1.5, 0, 0, 0, 0x5db36a)
  box(batch, 0.95, 0.38, 0.6, -0.15, 0.03, -0.28, wall)
  box(batch, 0.6, 0.3, 0.5, -0.3, 0.41, -0.3, wall)
  box(batch, 0.7, 0.18, 0.03, -0.15, 0.12, 0.03, PAL.glassLit, 0.7)
  box(batch, 0.55, 0.05, 0.33, 0.28, 0.035, 0.35, 0x9fd8ff, 0.3)
  box(batch, 0.62, 0.03, 0.4, 0.28, 0.0, 0.35, 0xede6d6)
  for (const [hx, hz, sx, sz] of [[0, 0.72, 1.5, 0.05], [0, -0.72, 1.5, 0.05], [0.72, 0, 0.05, 1.5], [-0.72, 0, 0.05, 1.5]] as const) {
    box(batch, sx, 0.09, sz, hx, 0.03, hz, PAL.hedge)
  }
}

/** A factory: a wall block, a sawtooth roof, an accent stripe, a chimney. */
function factory(batch: BuildBatch, accent: number): void {
  box(batch, 1.7, 0.03, 1.4, 0, 0, 0, 0x8c8f9c)
  box(batch, 1.3, 0.5, 0.9, -0.1, 0.03, -0.1, PAL.wallGrey)
  for (let i = 0; i < 3; i++) {
    box(batch, 0.35, 0.05, 0.9, -0.55 + i * 0.4, 0.53, -0.1, 0x6b7488)
  }
  box(batch, 1.31, 0.09, 0.03, -0.1, 0.38, 0.35, accent)
  cyl(batch, 0.08, 1.1, 0.55, 0.03, -0.4, 0xc8453c)
  cyl(batch, 0.085, 0.12, 0.55, 1.1, -0.4, 0xeeeeee)
}

/** A military block: olive walls, a watchtower, a small flag. */
function military(batch: BuildBatch): void {
  box(batch, 1.8, 0.3, 0.5, 0, 0, 0, PAL.olive)
  box(batch, 1.85, 0.2, 0.58, 0, 0.3, 0, 0x4e5a3a)
  cyl(batch, 0.03, 0.7, 0.7, 0, 0.3, 0x5b4a3a)
  box(batch, 0.36, 0.2, 0.36, 0.7, 0.7, 0.3, 0x6e6450)
  cyl(batch, 0.015, 1.1, -0.7, 0, -0.35, 0xd8dce6)
  box(batch, 0.32, 0.2, 0.01, -0.61, 0.9, -0.35, 0x2bc4b2)
}

/** The airport's small terminal: a low glassy block and a control tower. */
function airport(batch: BuildBatch): void {
  box(batch, 2.0, 0.06, 0.7, 0, 0, 0, 0xc9ced8)
  box(batch, 1.85, 0.35, 0.55, 0, 0.06, 0, 0x6fb8ff, 0.3)
  cyl(batch, 0.1, 1.0, 0.85, 0.06, -0.1, 0xe4e7ee)
  cyl(batch, 0.18, 0.16, 0.85, 1.06, -0.1, 0x6fb8ff, 0.3)
}

/** A city-centre tower: tall and narrow, like the skyline in city_proto.gd's
 * "C" (centre) blocks — a plot the kit does not otherwise name defaults to
 * this rather than a low box, so a street of them still reads as a downtown. */
function tower(batch: BuildBatch, wall: number, seed: number): void {
  const h = 1.1 + (seed % 7) * 0.5
  box(batch, 0.95, h, 0.85, 0, 0, 0, wall)
  box(batch, 1.02, 0.06, 0.92, 0, h, 0, 0xffffff)
  box(batch, 0.4, 0.22, 0.4, 0, h + 0.06, 0, 0x8a93ae)
  const rows = Math.max(3, Math.floor(h / 0.22))
  for (let r = 0; r < rows; r++) {
    const y = 0.1 + r * (h - 0.2) / Math.max(1, rows - 1)
    for (let c = 0; c < 3; c++) {
      if ((r + c + seed) % 3 === 0) continue
      box(batch, 0.12, 0.13, 0.02, -0.27 + c * 0.27, y, 0.435, PAL.glassLit, 0.55)
    }
  }
}

export type BuildKind = 'civic' | 'bazaar' | 'bank' | 'shop' | 'villa' | 'factory' | 'military' | 'airport' | 'tower'

const ACCENTS = [0xe5484d, 0x2bc4b2, 0x8e6cf0, 0xf5a623, 0x4cc47e]
const WALLS = [0xf4efe6, 0xeadbc4, 0xdde6ee, 0xf1e1d0, 0x8c95b8, 0xa7a0c8]

/** Build one of the kit's shapes for a plot, coloured by a small hash of its
 * id so neighbouring buildings vary without any server-side colour data.
 * Returns local-space geometry (the plot's own position/rotation/scale is
 * baked in by the caller once, when it merges every building in the city
 * into the two big meshes that actually get added to the scene). */
export function buildKind(kind: BuildKind, seed: number): BuildBatch {
  const batch = newBatch()
  const accent = ACCENTS[seed % ACCENTS.length]
  const wall = WALLS[seed % WALLS.length]
  switch (kind) {
    case 'civic': civic(batch, PAL.stone); break
    case 'bank': civic(batch, 0xede6d6); break
    case 'bazaar': bazaar(batch); break
    case 'shop': shop(batch, accent); break
    case 'villa': villa(batch, wall); break
    case 'factory': factory(batch, accent); break
    case 'military': military(batch); break
    case 'airport': airport(batch); break
    default: tower(batch, wall, seed); break
  }
  return batch
}

/** A plot's model key ("place:bazaar", "company:factory") read against the
 * kit's own shapes. Only a real keyword match counts — a bare code the kit
 * does not recognise (a plain company id, an unnamed place) returns null,
 * so the caller can try the CDN's model library before falling back to a
 * generic shape. */
export function classifyStrict(modelKey: string | undefined): BuildKind | null {
  const key = (modelKey || '').toLowerCase()
  if (key.includes('bazaar') || key.includes('market')) return 'bazaar'
  if (key.includes('bank')) return 'bank'
  if (key.includes('hall') || key.includes('civic')) return 'civic'
  if (key.includes('shop') || key.includes('store')) return 'shop'
  if (key.includes('villa') || key.includes('house') || key.includes('home')) return 'villa'
  if (key.includes('factory') || key.includes('industr')) return 'factory'
  if (key.includes('military') || key.includes('barrack')) return 'military'
  if (key.includes('airport') || key.includes('plane')) return 'airport'
  return null
}

/** The generic, last-resort shape once neither the kit's own keywords nor
 * the CDN's model library named anything: a tower for a company, a small
 * civic front for a place. */
export function classifyGeneric(plotKind: string, seed: number): BuildKind {
  if (plotKind === 'company') return seed % 2 === 0 ? 'factory' : 'tower'
  if (plotKind === 'place') return seed % 3 === 0 ? 'tower' : 'civic'
  return 'tower'
}

export function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}
