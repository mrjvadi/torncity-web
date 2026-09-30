// Trees for the countryside round the village: the lab's distance-tiered
// instancing (lodfield.js) with procedural trees (a broadleaf and a conifer,
// vertex-coloured, ~250 triangles near, ~20 far) instead of model files. A
// spot keeps one matrix; each camera move only copies the matrices of the
// spots that fall in a tier into that tier's InstancedMesh.

import {
  BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh,
  Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Object3D,
} from 'three'
import { seededRng } from './colorGeom'

export interface TreeSpot { x: number; y: number; z: number; s: number; rot: number; species: 0 | 1 }

interface Tier { geometry: BufferGeometry; maxD: number; cap: number }

function tint(geo: BufferGeometry, color: Color, jitter: number, seed: number): BufferGeometry {
  const r = seededRng(seed)
  const p = geo.attributes.position
  const cols = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * jitter + (p.getY(i) > 3 ? 0.08 : 0)
    cols[i * 3] = color.r * k
    cols[i * 3 + 1] = color.g * k
    cols[i * 3 + 2] = color.b * k
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3))
  return geo
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = []
  for (const g of parts) {
    const base = pos.length / 3
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
      col.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i))
    else for (let i = 0; i < p.count; i++) idx.push(base + i)
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  out.setAttribute('color', new Float32BufferAttribute(col, 3))
  out.setIndex(idx)
  out.computeBoundingSphere()
  return out
}

const at = (g: BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion(), new Vector3(sx, sy, sz)))

/** Rounded canopy blobs on a trunk. */
function broadleaf(seed: number): BufferGeometry {
  const r = seededRng(seed)
  const parts: BufferGeometry[] = [tint(at(new CylinderGeometry(0.16, 0.26, 3.4, 6, 1, true), 0, 1.7, 0), new Color(0x5a4632), 0.2, seed)]
  const green = new Color(0x4a7a34)
  parts.push(tint(at(new IcosahedronGeometry(1, 1), 0, 4.1, 0, 1.9, 1.5, 1.9), green, 0.5, seed + 1))
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r()
    parts.push(tint(at(new IcosahedronGeometry(1, 1), Math.cos(a) * 1.15, 3.5 + r() * 1.2, Math.sin(a) * 1.15, 1.2, 1.0, 1.2), green.clone().offsetHSL(0, 0, (r() - 0.5) * 0.06), 0.5, seed + 2 + i))
  }
  return merge(parts)
}

function conifer(seed: number): BufferGeometry {
  const green = new Color(0x2f5a34)
  return merge([
    tint(at(new CylinderGeometry(0.14, 0.22, 2.2, 5, 1, true), 0, 1.1, 0), new Color(0x54402c), 0.2, seed),
    tint(at(new ConeGeometry(2.2, 3.6, 7), 0, 3.0, 0), green, 0.4, seed + 1),
    tint(at(new ConeGeometry(1.7, 3.2, 7), 0, 5.0, 0), green.clone().offsetHSL(0, 0, 0.02), 0.4, seed + 2),
    tint(at(new ConeGeometry(1.1, 2.8, 7), 0, 6.9, 0), green.clone().offsetHSL(0, 0, 0.04), 0.4, seed + 3),
  ])
}

function farTree(species: 0 | 1, seed: number): BufferGeometry {
  if (species === 1) return merge([tint(at(new ConeGeometry(2.2, 8, 5), 0, 4, 0), new Color(0x2f5a34), 0.3, seed)])
  return merge([tint(at(new IcosahedronGeometry(1, 0), 0, 4.2, 0, 2.3, 2, 2.3), new Color(0x4a7a34), 0.4, seed), tint(at(new CylinderGeometry(0.2, 0.3, 3, 4, 1, true), 0, 1.5, 0), new Color(0x5a4632), 0.1, seed + 1)])
}

export class TreeField {
  readonly objects: Object3D[] = []
  private meshes: InstancedMesh[][] = []
  private tiers: Tier[][]
  private material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  private mats: Float32Array = new Float32Array(0)
  private xs: Float32Array = new Float32Array(0)
  private zs: Float32Array = new Float32Array(0)
  private sp: Uint8Array = new Uint8Array(0)
  private lastCam = new Vector3(1e9, 0, 0)
  private geos: BufferGeometry[] = []

  constructor(private spots: TreeSpot[], nearCap = 260) {
    const near = [broadleaf(11), conifer(21)]
    const far = [farTree(0, 31), farTree(1, 41)]
    this.geos = [...near, ...far]
    this.tiers = [0, 1].map((s) => [
      { geometry: near[s], maxD: 260, cap: nearCap },
      { geometry: far[s], maxD: 2600, cap: 100000 },
    ])
    const n = spots.length
    this.mats = new Float32Array(n * 16)
    this.xs = new Float32Array(n)
    this.zs = new Float32Array(n)
    this.sp = new Uint8Array(n)
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), s = new Vector3()
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot)
      s.set(t.s, t.s * (0.9 + (t.rot % 1) * 0.25), t.s)
      p.set(t.x, t.y - 0.05, t.z)
      m.compose(p, q, s).toArray(this.mats, i * 16)
      this.xs[i] = t.x
      this.zs[i] = t.z
      this.sp[i] = t.species
    })
    const counts = [0, 0]
    for (const t of spots) counts[t.species]++
    for (let sIdx = 0; sIdx < 2; sIdx++) {
      this.meshes.push(this.tiers[sIdx].map((tier) => {
        const im = new InstancedMesh(tier.geometry, this.material, Math.max(1, Math.min(counts[sIdx], tier.cap)))
        im.count = 0
        im.frustumCulled = false
        im.name = 'trees'
        this.objects.push(im)
        return im
      }))
    }
  }

  /** Re-tiers the spots round the camera; true when something changed. */
  update(cam: Vector3, force = false): boolean {
    if (!force && this.lastCam.distanceToSquared(cam) < 100) return false
    this.lastCam.copy(cam)
    for (let s = 0; s < 2; s++) {
      const ids: number[][] = this.tiers[s].map(() => [])
      const d2near = this.tiers[s][0].maxD ** 2
      const nears: [number, number][] = []
      for (let i = 0; i < this.sp.length; i++) {
        if (this.sp[i] !== s) continue
        const dx = this.xs[i] - cam.x, dz = this.zs[i] - cam.z, d2 = dx * dx + dz * dz
        if (d2 < d2near) nears.push([i, d2])
        else if (d2 < this.tiers[s][1].maxD ** 2) ids[1].push(i)
      }
      nears.sort((a, b) => a[1] - b[1])
      const cap = this.tiers[s][0].cap
      for (let k = 0; k < nears.length; k++) (k < cap ? ids[0] : ids[1]).push(nears[k][0])
      this.tiers[s].forEach((_, t) => {
        const im = this.meshes[s][t]
        const list = ids[t]
        const cnt = Math.min(list.length, im.instanceMatrix.count)
        const arr = im.instanceMatrix.array as Float32Array
        for (let k = 0; k < cnt; k++) arr.set(this.mats.subarray(list[k] * 16, list[k] * 16 + 16), k * 16)
        im.count = cnt
        im.instanceMatrix.needsUpdate = true
      })
    }
    return true
  }

  stats(): { instances: number; triangles: number } {
    let inst = 0, tri = 0
    for (const row of this.meshes) for (const im of row) {
      inst += im.count
      const g = im.geometry
      tri += ((g.index ? g.index.count : g.attributes.position.count) / 3) * im.count
    }
    return { instances: inst, triangles: Math.round(tri) }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose()
    for (const row of this.meshes) for (const im of row) im.dispose()
    this.material.dispose()
  }
}
