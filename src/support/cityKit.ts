// The Support city's kit runtime: the small road kit and the building kit of
// the lab city engine (torncity-lab/prototypes/city: roadlib.js, citylib.js),
// ported to TypeScript. Everything here is pure geometry and planning; the
// scene that draws it is supportScene.ts.

import { BufferGeometry, Material, Mesh, DoubleSide, FrontSide, type MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type Rng = () => number

export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Category = 'tower' | 'office' | 'apartment' | 'factory' | 'small'

export interface KitBuilding {
  id: string
  category: Category
  file: string
  width: number
  depth: number
  height: number
  floors: number
  geometry: BufferGeometry
  material: Material
}

export interface BuildingKit { list: KitBuilding[]; byCat: Record<string, KitBuilding[]>; byId: Map<string, KitBuilding> }

function firstMesh(root: { traverse: (f: (o: unknown) => void) => void }): Mesh {
  let mesh: Mesh | null = null
  root.traverse((o) => { if ((o as Mesh).isMesh) mesh = o as Mesh })
  if (!mesh) throw new Error('kit glb without a mesh')
  return mesh
}

export async function loadBuildingKit(base: string): Promise<BuildingKit> {
  const index = await (await fetch(base + 'index.json')).json() as { buildings: { id: string; category: Category; file: string; width: number; depth: number; height: number; floors: number }[] }
  const loader = new GLTFLoader().setPath(base)
  const list = await Promise.all(index.buildings.map(async (b) => {
    const g = await loader.loadAsync(b.file)
    const mesh = firstMesh(g.scene)
    mesh.geometry.computeVertexNormals()
    const mat = mesh.material as MeshStandardMaterial
    mat.side = DoubleSide
    mat.roughness = 0.8
    return { ...b, geometry: mesh.geometry, material: mat } as KitBuilding
  }))
  const byCat: Record<string, KitBuilding[]> = {}
  for (const b of list) (byCat[b.category] ||= []).push(b)
  return { list, byCat, byId: new Map(list.map((b) => [b.id, b])) }
}

// -- roads -------------------------------------------------------------------

export type Dir = 'N' | 'E' | 'S' | 'W'
export const DIRS: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }
export const ORDER: Dir[] = ['N', 'E', 'S', 'W']
const TURN: Record<Dir, Dir> = { E: 'N', N: 'W', W: 'S', S: 'E' }
const rot = (sides: Dir[], k: number) => sides.map((s) => { for (let i = 0; i < k; i++) s = TURN[s]; return s })
export const maskOf = (sides: Dir[]) => sides.reduce((m, s) => m | (1 << ORDER.indexOf(s)), 0)

export interface RoadPiece { geometry: BufferGeometry; material: Material; connections: Dir[] }
export interface RoadKit { pieces: Record<string, RoadPiece>; lookup: Map<number, [string, number]>; module: number }

export async function loadRoadKit(base: string): Promise<RoadKit> {
  const index = await (await fetch(base + 'index.json')).json() as { module: number; pieces: Record<string, { file: string; connections: Dir[] }> }
  const loader = new GLTFLoader().setPath(base)
  const pieces: Record<string, RoadPiece> = {}
  await Promise.all(Object.entries(index.pieces).map(async ([id, info]) => {
    const g = await loader.loadAsync(info.file)
    const mesh = firstMesh(g.scene)
    mesh.geometry.computeVertexNormals()
    const rm = mesh.material as MeshStandardMaterial
    rm.side = FrontSide
    pieces[id] = { geometry: mesh.geometry, material: rm, connections: info.connections }
  }))
  const lookup = new Map<number, [string, number]>()
  for (const id of ['endcap', 'straight', 'curve', 'tjunction', 'crossing']) {
    for (let k = 0; k < 4; k++) {
      const m = maskOf(rot(pieces[id].connections, k))
      if (!lookup.has(m)) lookup.set(m, [id, k])
    }
  }
  return { pieces, lookup, module: index.module }
}

export interface Network { w: number; h: number; road: Uint8Array; nodesX: number; nodesZ: number; spacing: number }

/** A lattice of avenues joined by a random spanning tree plus extra edges: a
 * connected street grid whose blocks are of varied size. */
export function generateNetwork(R: Rng, { nodesX, nodesZ, spacing, extra }: { nodesX: number; nodesZ: number; spacing: number; extra: number }): Network {
  const w = (nodesX - 1) * spacing + 1, h = (nodesZ - 1) * spacing + 1
  const road = new Uint8Array(w * h)
  const id = (a: number, b: number) => b * nodesX + a
  const edges: [number, number, number, number][] = []
  for (let b = 0; b < nodesZ; b++) for (let a = 0; a < nodesX; a++) {
    if (a + 1 < nodesX) edges.push([a, b, a + 1, b])
    if (b + 1 < nodesZ) edges.push([a, b, a, b + 1])
  }
  for (let i = edges.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [edges[i], edges[j]] = [edges[j], edges[i]] }
  const parent = [...Array(nodesX * nodesZ).keys()]
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const kept: [number, number, number, number][] = []
  for (const e of edges) {
    const A = find(id(e[0], e[1])), B = find(id(e[2], e[3]))
    if (A !== B) { parent[A] = B; kept.push(e) } else if (R() < extra) kept.push(e)
  }
  for (const [a, b, c, d] of kept) {
    const x0 = a * spacing, z0 = b * spacing, x1 = c * spacing, z1 = d * spacing
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0))
    for (let i = 0; i <= n; i++) road[(z0 + Math.sign(z1 - z0) * i) * w + x0 + Math.sign(x1 - x0) * i] = 1
  }
  return { w, h, road, spacing, nodesX, nodesZ }
}

export interface RoadTile { x: number; z: number; id: string; k: number; sides: Dir[] }

export function planRoadTiles(kit: RoadKit, net: Network, R: Rng, crosswalks: number): RoadTile[] {
  const { w, h, road } = net
  const at = (x: number, z: number) => x >= 0 && z >= 0 && x < w && z < h && !!road[z * w + x]
  const tiles: RoadTile[] = []
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    if (!at(x, z)) continue
    const sides = ORDER.filter((s) => at(x + DIRS[s][0], z + DIRS[s][1]))
    const [id, k] = kit.lookup.get(maskOf(sides)) ?? ['crossing', 0]
    tiles.push({ x, z, id, k, sides })
  }
  const byPos = new Map(tiles.map((t) => [t.z * w + t.x, t]))
  for (const t of tiles) {
    if (t.id !== 'straight') continue
    const near = t.sides.some((s) => { const n = byPos.get((t.z + DIRS[s][1]) * w + t.x + DIRS[s][0]); return !!n && n.sides.length >= 3 })
    if (near && R() < crosswalks) { t.id = 'crosswalk'; t.k = (t.k + 1) % 4 }
  }
  return tiles
}

// -- lots --------------------------------------------------------------------

export type Lot = [x: number, z: number, w: number, d: number]

function freeRects(net: Network): [number, number, number, number][] {
  const { w, h, road } = net
  const used = new Uint8Array(w * h)
  const free = (x: number, z: number) => x >= 0 && z >= 0 && x < w && z < h && !road[z * w + x] && !used[z * w + x]
  const rects: [number, number, number, number][] = []
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    if (!free(x, z)) continue
    let rw = 1
    while (free(x + rw, z)) rw++
    let rh = 1
    outer: while (true) { for (let i = 0; i < rw; i++) if (!free(x + i, z + rh)) break outer; rh++ }
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) used[(z + j) * w + x + i] = 1
    rects.push([x, z, rw, rh])
  }
  return rects
}

function splitLots(r: Lot, max: number, R: Rng, out: Lot[]) {
  const [x, z, w, d] = r
  if (w > max * 1.25 && (w >= d || d <= max * 1.25)) { const c = w * (0.42 + 0.16 * R()); splitLots([x, z, c, d], max, R, out); splitLots([x + c, z, w - c, d], max, R, out) }
  else if (d > max * 1.25) { const c = d * (0.42 + 0.16 * R()); splitLots([x, z, w, c], max, R, out); splitLots([x, z + c, w, d - c], max, R, out) }
  else out.push(r)
}

/** The free cells between the roads, cut into lots in world metres. */
export function planLots(net: Network, M: number, R: Rng, { curb, maxLot }: { curb: number; maxLot: number }): Lot[] {
  const { w, h } = net
  const ox = -(w - 1) / 2 * M - M / 2, oz = -(h - 1) / 2 * M - M / 2
  const lots: Lot[] = []
  const pad = curb * M
  for (const [x, z, rw, rh] of freeRects(net)) splitLots([ox + x * M + pad, oz + z * M + pad, rw * M - 2 * pad, rh * M - 2 * pad], maxLot, R, lots)
  return lots
}

export interface Fit { b: KitBuilding; rot: 0 | 1; s: number }

/** Every kit building of the given categories that fits the lot (scaled down
 * to at most 72%). */
export function fits(kit: BuildingKit, cats: Category[], lot: Lot, gap: number, maxHeight = Infinity): Fit[] {
  const fw = lot[2] - gap, fd = lot[3] - gap
  const out: Fit[] = []
  for (const c of cats) for (const b of kit.byCat[c] ?? []) {
    if (b.height > maxHeight) continue
    for (const rot of [0, 1] as const) {
      const bw = rot ? b.depth : b.width, bd = rot ? b.width : b.depth
      const s = Math.min(1, fw / bw, fd / bd)
      if (s >= 0.72) out.push({ b, rot, s })
    }
  }
  return out
}
