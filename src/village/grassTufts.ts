// Grass tufts and wildflowers in a ring round the camera, only while it is low
// enough to see them (the lab's grassfield.js). Positions come from a hashed
// grid so re-centring never makes tufts pop or shuffle; they sway in the wind.

import {
  BufferGeometry, Color, DataTexture, DoubleSide, Float32BufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter,
  Matrix4, MeshStandardMaterial, Quaternion, RGBAFormat, SRGBColorSpace, ShaderChunk, Vector3,
} from 'three'
import { seededRng } from './colorGeom'

function bleed(c: HTMLCanvasElement, rgb: number[]): DataTexture {
  const n = c.width
  const img = c.getContext('2d')!.getImageData(0, 0, n, n)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 8) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2] }
  const flipped = new Uint8Array(d.length)
  for (let y = 0; y < n; y++) flipped.set(d.subarray(y * n * 4, (y + 1) * n * 4), (n - 1 - y) * n * 4)
  const t = new DataTexture(flipped, n, n, RGBAFormat)
  t.colorSpace = SRGBColorSpace
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  t.flipY = false
  t.needsUpdate = true
  return t
}

function tuftTexture(): DataTexture {
  const R = seededRng(5), n = 96
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  for (let i = 0; i < 24; i++) {
    const x0 = 8 + R() * (n - 16), lean = (R() - 0.5) * 36, h = 30 + R() * 58, w = 1.8 + R() * 2.6, ctrl = (R() - 0.5) * 12
    const dark = 40 + R() * 40, lite = 120 + R() * 90
    const grd = g.createLinearGradient(0, n, 0, n - h)
    grd.addColorStop(0, `rgb(${dark * 0.55},${dark + 20},${dark * 0.3})`)
    grd.addColorStop(0.7, `rgb(${lite * 0.55},${lite},${lite * 0.3})`)
    grd.addColorStop(1, `rgb(${lite * 0.85},${lite * 1.05},${lite * 0.4})`)
    g.fillStyle = grd
    g.beginPath(); g.moveTo(x0 - w, n); g.quadraticCurveTo(x0 + ctrl, n - h * 0.55, x0 + lean, n - h); g.quadraticCurveTo(x0 + ctrl + w * 0.6, n - h * 0.5, x0 + w, n); g.closePath(); g.fill()
  }
  return bleed(c, [72, 122, 36])
}

function flowerTexture(): DataTexture {
  const R = seededRng(9), n = 96
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const cols = ['#f4f1e8', '#f5d63a', '#b06ad6', '#e8687a', '#f7f7fb']
  for (let i = 0; i < 6; i++) {
    const x = 10 + i * 14 + R() * 5, h = 36 + R() * 40
    g.strokeStyle = '#4a7a2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, n); g.quadraticCurveTo(x + (R() - 0.5) * 10, n - h * 0.5, x + (R() - 0.5) * 6, n - h); g.stroke()
    const col = cols[Math.floor(R() * cols.length)], r = 4 + R() * 3, cx = x, cy = n - h
    g.fillStyle = col
    for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, r * 0.62, 0, 6.283); g.fill() }
    g.fillStyle = '#f0c020'; g.beginPath(); g.arc(cx, cy, r * 0.5, 0, 6.283); g.fill()
  }
  return bleed(c, [70, 120, 40])
}

function crossGeo(w: number, h: number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = []
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3, c = (Math.cos(a) * w) / 2, s = (Math.sin(a) * w) / 2, b = pos.length / 3
    pos.push(-c, 0, -s, c, 0, s, c, h, s, -c, h, -s)
    uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0)
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

function patchMat(map: DataTexture, uTime: { value: number }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ map, alphaTest: 0.42, side: DoubleSide, roughness: 1, metalness: 0 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float sway = uv.y * uv.y * 0.11 * sin(uTime * 1.7 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7);
        transformed.x += sway; transformed.z += sway * 0.6;
      #endif`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'))
  }
  m.customProgramCacheKey = () => 'village-grass'
  return m
}

export interface TuftContext {
  groundY(x: number, z: number): number
  /** True where nothing may grow (water, roads, building pads). */
  blocked(x: number, z: number): boolean
  /** 0..1, how forested the ground is here (few flowers under trees). */
  forest(x: number, z: number): number
}

export class GrassTufts {
  readonly objects: InstancedMesh[]
  private uTime = { value: 0 }
  private grass: InstancedMesh
  private flowers: InstancedMesh
  private last = new Vector3(1e9, 0, 1e9)
  private readonly R = 34
  private readonly cell = 1.6
  private tex: DataTexture[]

  constructor(private ctx: TuftContext) {
    const nMax = Math.ceil((Math.PI * this.R * this.R) / (this.cell * this.cell)) * 2 + 64
    const gt = tuftTexture(), ft = flowerTexture()
    this.tex = [gt, ft]
    this.grass = new InstancedMesh(crossGeo(1.0, 0.8), patchMat(gt, this.uTime), nMax)
    this.grass.frustumCulled = false
    this.grass.count = 0
    this.flowers = new InstancedMesh(crossGeo(0.6, 0.6), patchMat(ft, this.uTime), 700)
    this.flowers.frustumCulled = false
    this.flowers.count = 0
    this.objects = [this.grass, this.flowers]
  }

  private hash(i: number, j: number, k: number): number {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + 7, 1274126177)
    h = Math.imul(h ^ (h >>> 13), 1103515245)
    h ^= h >>> 16
    return (h >>> 0) / 4294967295
  }

  update(cam: Vector3, t: number): boolean {
    this.uTime.value = t
    const low = cam.y - this.ctx.groundY(cam.x, cam.z) < 60
    if (!low) {
      const had = this.grass.count > 0
      this.grass.count = 0; this.flowers.count = 0
      this.last.set(1e9, 0, 1e9)
      return had
    }
    if (this.last.distanceToSquared(cam) < 9) return false
    this.last.copy(cam)
    const c = this.cell, R = this.R
    const i0 = Math.floor((cam.x - R) / c), i1 = Math.ceil((cam.x + R) / c), j0 = Math.floor((cam.z - R) / c), j1 = Math.ceil((cam.z + R) / c)
    const M = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), P = new Vector3(), S = new Vector3(), col = new Color()
    const lush = new Color(0.86, 1.0, 0.8), dry = new Color(1.3, 1.08, 0.72)
    let ng = 0, nf = 0
    const maxG = this.grass.instanceMatrix.count, maxF = this.flowers.instanceMatrix.count
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (let k = 0; k < 2; k++) {
          const x = (i + this.hash(i, j, k * 3 + 1)) * c, z = (j + this.hash(i, j, k * 3 + 2)) * c
          const d = Math.hypot(x - cam.x, z - cam.z)
          if (d > R) continue
          if (this.ctx.blocked(x, z)) continue
          const forest = this.ctx.forest(x, z)
          if (forest > 0.55 && this.hash(i, j, 9) < 0.7) continue
          const y = this.ctx.groundY(x, z)
          const fade = 1 - Math.max(0, Math.min(1, (d - R * 0.6) / (R * 0.4)))
          const hsh = this.hash(i, j, k + 40)
          const s = (0.55 + hsh * 0.75) * fade
          if (s < 0.06) continue
          if (ng < maxG) {
            q.setFromAxisAngle(up, hsh * 6.283); P.set(x, y - 0.03, z); S.set(s * 1.25, s, s * 1.25)
            this.grass.setMatrixAt(ng, M.compose(P, q, S))
            const tn = 0.5 + 0.5 * Math.sin(x * 0.011 + z * 0.007) * Math.cos(z * 0.013 - x * 0.005)
            col.copy(lush).lerp(dry, tn * 0.75).multiplyScalar(0.85 + 0.3 * this.hash(i, j, k + 60))
            this.grass.setColorAt(ng, col)
            ng++
          }
          if (nf < maxF && forest < 0.35 && this.hash(i, j, k + 80) < 0.09 && d < 26) {
            q.setFromAxisAngle(up, hsh * 6.283); P.set(x, y - 0.02, z)
            const fs = 0.55 + this.hash(i, j, 90) * 0.5
            S.set(fs, fs, fs)
            this.flowers.setMatrixAt(nf, M.compose(P, q, S)); this.flowers.setColorAt(nf, col.set(1, 1, 1)); nf++
          }
        }
      }
    }
    this.grass.count = ng; this.flowers.count = nf
    this.grass.instanceMatrix.needsUpdate = true; this.flowers.instanceMatrix.needsUpdate = true
    if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true
    return true
  }

  dispose(): void {
    for (const m of this.objects) { m.geometry.dispose(); (m.material as MeshStandardMaterial).dispose(); m.dispose() }
    for (const t of this.tex) t.dispose()
  }
}
