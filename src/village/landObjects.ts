// The land of a village as the server counts it (ADR 0065 section 7): the trees, rocks, stumps and saplings of every lot of the grid and of the
// woodland ring, placed at positions that are a pure function of the lot and the index, so every client draws the same and a cut removes the
// last one placed. Beyond the ring the client keeps its own scatter and thins it by `woods.forest_remaining_bps` in a fixed hashed order.

import {
  BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Object3D,
} from 'three'
import type { LandStuff, VillageLayout } from '../api/types'
import type { VillageGround } from './terrainModel'
import type { TreeSpot } from './vegetation'

/** A hash in [0,1) of a lot, an index and a salt: the same on every client. */
export function lotHash(x: number, y: number, k: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export interface RockSpot { x: number; y: number; z: number; s: number; rot: number }
export interface LandSpots { trees: TreeSpot[]; rocks: RockSpot[]; stumps: RockSpot[] }

/** The most the 3D village draws as land objects: the grid and ring hold at most 6 trees and 2 rocks a lot, so this is never reached by honest data. */
const CAP_ROCKS = 1200
const CAP_STUMPS = 1200

interface LandLot extends LandStuff { x: number; y: number; biome?: string; water?: string }

/** Every lot that carries land counts: the grid, the ring and the open land of the roads. */
export function landLots(layout: VillageLayout): LandLot[] {
  const out: LandLot[] = []
  layout.lots.forEach((row, y) => row.forEach((l, x) => { out.push({ ...l, x, y }) }))
  for (const l of layout.ring?.lots ?? []) out.push(l)
  for (const l of layout.land?.open ?? []) if (l.trees !== undefined || l.rocks !== undefined) out.push(l)
  return out
}

/** The lots (as "x,y") whose objects the server draws: the countryside scatter keeps out of them. */
export function landLotKeys(layout: VillageLayout): Set<string> {
  const keys = new Set<string>()
  layout.lots.forEach((row, y) => row.forEach((_, x) => keys.add(`${x},${y}`)))
  for (const l of layout.ring?.lots ?? []) keys.add(`${l.x},${l.y}`)
  for (const l of layout.land?.open ?? []) if (l.trees !== undefined || l.rocks !== undefined) keys.add(`${l.x},${l.y}`)
  return keys
}

/** A cheap fingerprint of the land counts: a change of it means the trees and rocks are drawn again. */
export function landSignature(layout: VillageLayout): string {
  if (!layout.woods && !layout.ring) return ''
  let h = 0, n = 0
  for (const l of landLots(layout)) {
    const sap = (l.saplings ?? []).reduce((a, s) => a + Math.round(s.stage * 10) + 1, 0)
    h = (Math.imul(h, 31) + ((l.trees ?? 0) * 97 + (l.rocks ?? 0) * 31 + (l.stumps ?? 0) * 7 + sap * 3 + (l.x + 50) * 13 + (l.y + 50) * 17)) | 0
    n++
  }
  return `${layout.woods?.mark ?? ''}|${layout.woods?.forest_remaining_bps ?? ''}|${n}|${h}`
}

export function landSpots(layout: VillageLayout, ground: VillageGround): LandSpots {
  const trees: TreeSpot[] = [], rocks: RockSpot[] = [], stumps: RockSpot[] = []
  const lot = ground.lot
  const place = (l: LandLot, k: number, salt: number, spread: number) => {
    const c = ground.lotCentre(l.x, l.y)
    const x = c.x + (lotHash(l.x, l.y, k, salt) - 0.5) * lot * spread
    const z = c.z + (lotHash(l.x, l.y, k, salt + 1) - 0.5) * lot * spread
    return { x, z }
  }
  for (const l of landLots(layout)) {
    if (l.water) continue
    const boreal = /boreal|taiga/.test(l.biome ?? '')
    const dry = (x: number, z: number) => { const lv = ground.lakeLevelAt(x, z); return lv === null || ground.groundY(x, z) >= lv + 0.9 }
    for (let k = 0; k < (l.trees ?? 0); k++) {
      const p = place(l, k, 11, 0.8)
      if (!dry(p.x, p.z)) continue
      trees.push({ x: p.x, z: p.z, y: ground.groundY(p.x, p.z), s: 0.8 + lotHash(l.x, l.y, k, 13) * 0.8, rot: lotHash(l.x, l.y, k, 14) * Math.PI * 2, species: boreal || lotHash(l.x, l.y, k, 15) < 0.22 ? 1 : 0 })
    }
    for (const sp of l.saplings ?? []) {
      const k = 20 + trees.length
      const p = place(l, k, 31, 0.8)
      if (!dry(p.x, p.z)) continue
      // small until it is ready: a young tree a third to a full size
      trees.push({ x: p.x, z: p.z, y: ground.groundY(p.x, p.z), s: 0.25 + 0.55 * Math.max(0, Math.min(1, sp.stage)), rot: lotHash(l.x, l.y, k, 34) * Math.PI * 2, species: 0 })
    }
    for (let k = 0; k < (l.rocks ?? 0) && rocks.length < CAP_ROCKS; k++) {
      const p = place(l, k, 51, 0.7)
      rocks.push({ x: p.x, z: p.z, y: ground.groundY(p.x, p.z), s: 0.9 + lotHash(l.x, l.y, k, 53) * 0.8, rot: lotHash(l.x, l.y, k, 54) * Math.PI * 2 })
    }
    for (let k = 0; k < (l.stumps ?? 0) && stumps.length < CAP_STUMPS; k++) {
      const p = place(l, k, 71, 0.8)
      stumps.push({ x: p.x, z: p.z, y: ground.groundY(p.x, p.z), s: 0.8 + lotHash(l.x, l.y, k, 73) * 0.5, rot: lotHash(l.x, l.y, k, 74) * Math.PI * 2 })
    }
  }
  return { trees, rocks, stumps }
}

/** Whether a countryside spot stays when the forest is down to `remaining` basis points: the same spots go every time (a hash of the spot's own place). */
export function forestKeeps(x: number, z: number, remaining: number): boolean {
  if (remaining >= 10000) return true
  return lotHash(Math.round(x * 4), Math.round(z * 4), 0, 991) * 10000 < remaining
}

function colored(geo: BufferGeometry, c: Color): BufferGeometry {
  const n = geo.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const k = 0.85 + ((i * 37) % 11) / 40; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k }
  geo.setAttribute('color', new Float32BufferAttribute(a, 3))
  return geo
}

/** Rocks and stumps of the lots: two small instanced meshes (a flat-shaded rock of 20 triangles, a stump of a dozen). */
export class RockField {
  readonly objects: Object3D[] = []
  private geos: BufferGeometry[] = []
  private material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true })

  constructor(rocks: RockSpot[], stumps: RockSpot[]) {
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), s = new Vector3()
    const make = (geo: BufferGeometry, spots: RockSpot[], lift: number, flat: number, name: string) => {
      if (!spots.length) return
      this.geos.push(geo)
      const im = new InstancedMesh(geo, this.material, spots.length)
      spots.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot)
        s.set(t.s, t.s * flat, t.s * (0.8 + (t.rot % 1) * 0.3))
        p.set(t.x, t.y + t.s * lift, t.z)
        m.compose(p, q, s)
        im.setMatrixAt(i, m)
      })
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      im.castShadow = true
      im.receiveShadow = true
      im.name = name
      this.objects.push(im)
    }
    make(colored(new IcosahedronGeometry(0.7, 0), new Color(0x8d897c)), rocks, 0.22, 0.72, 'lot-rocks')
    make(colored(new CylinderGeometry(0.28, 0.36, 0.5, 6), new Color(0x6a5236)), stumps, 0.22, 1, 'lot-stumps')
  }

  stats(): { instances: number } {
    return { instances: this.objects.reduce((a, o) => a + (o as InstancedMesh).count, 0) }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose()
    this.material.dispose()
  }
}
