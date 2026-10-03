// The whole planet as streamed terrain for the world map (docs/ui/web-structure.md section 3.5).
//
// Chunked LOD on the cube sphere: six face quadtrees, a node is the server's chunk (face, lod, x, y), a
// 32x32 tile heightfield. Each frame the tree is cut by screen-space size (a node is split when it spans
// more than `LOD_PX` pixels), culled by horizon and frustum, and the chunks the cut wants are fetched
// nearest first (a few at a time). Until the four children of a node are held the node itself stays drawn,
// so the picture never has a hole. Meshes are built lazily, a couple per frame, and dropped again when they
// have not been seen for a while; decoded chunks are kept in a bounded LRU. One shader draws everything:
// vertex colours from the biome, normals from the height gradient, vertical exaggeration as a uniform that
// the camera's altitude sets (so it never needs a rebuild), skirts under every edge hide the cracks between
// neighbours of different LOD.

import {
  BufferAttribute, BufferGeometry, Color, Frustum, Group, Matrix4, Mesh, ShaderMaterial, Sphere, Vector3,
  type PerspectiveCamera,
} from 'three'
import type { WorldInfo } from '../api/types'
import { TILE_LAKE, TILE_OCEAN, type Chunk } from './chunk'
import { faceDirection, latLonToTile, type Face } from './geo'

export type FetchChunk = (face: number, lod: number, x: number, y: number) => Promise<Chunk>

/** A node is split when its side spans more than this many CSS pixels (a 32-tile chunk: ~11 px a tile). */
const LOD_PX = 360
const G = 33 // vertices along a chunk's side (tiles + 1)
const MAX_INFLIGHT = 6
const BUILDS_PER_FRAME = 2
const MESH_IDLE_MS = 5000
const CHUNK_CAP = 900
const RETRY_MS = 12000

const VERT = /* glsl */ `
attribute float aElev;
attribute vec3 aDir;
attribute vec3 aGrad;
attribute float aSkirt;
attribute vec3 aCol;
uniform float uExag;
varying vec3 vCol;
varying vec3 vN;
varying float vDist;
void main() {
  vec3 p = position + aDir * (aElev * uExag - aSkirt);
  vN = normalize(aDir - uExag * aGrad);
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vCol;
varying vec3 vN;
varying float vDist;
void main() {
  float d = max(dot(normalize(vN), uLight), 0.0);
  vec3 c = vCol * (0.46 + 0.74 * d);
  c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, vDist));
  gl_FragColor = vec4(c, 1.0);
}`

interface Entry {
  key: string
  face: number
  lod: number
  x: number
  y: number
  state: 'idle' | 'loading' | 'ready' | 'failed'
  failedAt: number
  chunk: Chunk | null
  mesh: Mesh | null
  seen: number
  touched: number
}

export interface TileInfo { elev: number; biome: number; biomeCode: string; ocean: boolean; lake: boolean; coast: boolean; lod: number; tileKm: number; rgb: [number, number, number] }

export interface TerrainStats { loaded: number; loading: number; shown: number; tris: number; meshes: number }

const s01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export class PlanetTerrain {
  readonly group = new Group()
  readonly material: ShaderMaterial
  private R: number
  private entries = new Map<string, Entry>()
  private shown = new Set<Entry>()
  private pending: { e: Entry; pri: number }[] = []
  private inflight = 0
  private biomeRgb: [number, number, number][] = []
  private biomeWater: boolean[] = []
  private frustum = new Frustum()
  private pv = new Matrix4()
  private sph = new Sphere()
  private tmp = new Vector3()
  private disposed = false
  private lastTrim = 0
  /** Called when a chunk arrives or a mesh is built, so the view draws again. */
  onChange: () => void = () => undefined

  constructor(private world: WorldInfo, private fetchChunk: FetchChunk) {
    this.R = world.planet_radius_km
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uExag: { value: 8 },
        uLight: { value: new Vector3(0.4, 0.5, 0.77).normalize() },
        uFogColor: { value: new Color('#b8d0e6') },
        uFogNear: { value: 1e9 },
        uFogFar: { value: 2e9 },
      },
    })
    for (const b of world.biomes) {
      const hex = b.color ?? '808080'
      // the colour is written to the framebuffer as it is: the sRGB numbers, not linear ones
      this.biomeRgb[b.index] = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
      this.biomeWater[b.index] = !!b.water
    }
  }

  uniforms() { return this.material.uniforms }

  private entry(face: number, lod: number, x: number, y: number): Entry {
    const key = `${face}/${lod}/${x}/${y}`
    let e = this.entries.get(key)
    if (!e) {
      e = { key, face, lod, x, y, state: 'idle', failedAt: 0, chunk: null, mesh: null, seen: 0, touched: 0 }
      this.entries.set(key, e)
    }
    return e
  }

  /** Cuts the quadtree for this camera: which nodes to draw, which chunks to fetch. */
  update(camera: PerspectiveCamera, viewportH: number, now: number, exag: number) {
    if (this.disposed) return
    const R = this.R
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.pv)
    const cam = camera.position
    const camLen = cam.length()
    const horizon = Math.acos(Math.min(1, R / camLen))
    const camDir = this.tmp.copy(cam).normalize().clone()
    const pxPerRad = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360))
    const maxLod = this.world.chunk.max_lod
    const want: { e: Entry; pri: number }[] = []
    const draw: Entry[] = []
    let builds = BUILDS_PER_FRAME
    const margin = 9 * exag

    const visit = (face: number, lod: number, x: number, y: number) => {
      const per = 1 << lod
      const dir = faceDirection(face as Face, ((x + 0.5) / per) * 2 - 1, ((y + 0.5) / per) * 2 - 1)
      const dl = Math.hypot(dir[0], dir[1], dir[2])
      const nx = dir[0] / dl, ny = dir[1] / dl, nz = dir[2] / dl
      const size = (R * Math.PI) / 2 / per
      const radius = size * 0.78 + margin
      // behind the horizon
      const cosA = nx * camDir.x + ny * camDir.y + nz * camDir.z
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA)))
      if (ang > horizon + (radius / R) + 0.02) return
      this.sph.center.set(nx * R, ny * R, nz * R)
      this.sph.radius = radius
      if (!this.frustum.intersectsSphere(this.sph)) return
      const dist = Math.max(this.sph.center.distanceTo(cam) - radius * 0.7, Math.max(0.5, camLen - R) * 0.6)
      const px = (size / dist) * pxPerRad
      const e = this.entry(face, lod, x, y)
      e.touched = now
      if (px > LOD_PX && lod < maxLod) {
        const kids: Entry[] = []
        let ready = 0
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const k = this.entry(face, lod + 1, x * 2 + dx, y * 2 + dy)
          kids.push(k)
          if (k.chunk) ready++
          else want.push({ e: k, pri: dist })
        }
        if (ready === 4) {
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) visit(face, lod + 1, x * 2 + dx, y * 2 + dy)
          return
        }
        // the children are on their way: this node stays
      }
      if (!e.chunk) { want.push({ e, pri: dist - 1e6 }); return }
      draw.push(e)
    }
    for (let f = 0; f < 6; f++) visit(f, 0, 0, 0)
    if (this.overview) {
      for (let f = 0; f < 6; f++) {
        const r = this.entry(f, 0, 0, 0)
        if (!r.chunk) want.push({ e: r, pri: 1e9 })
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const k = this.entry(f, 1, x, y); k.touched = now; if (!k.chunk) want.push({ e: k, pri: 1e9 + 1 }) }
      }
    }

    // meshes for what is to be drawn
    for (const e of this.shown) e.mesh && (e.mesh.visible = false)
    this.shown.clear()
    let tris = 0
    for (const e of draw) {
      if (!e.mesh) {
        if (builds <= 0) { this.onChange(); continue }
        builds--
        e.mesh = this.buildMesh(e)
        this.group.add(e.mesh)
      }
      e.mesh.visible = true
      e.seen = now
      this.shown.add(e)
      tris += (e.mesh.geometry.index?.count ?? 0) / 3
    }
    this.lastTris = tris
    want.sort((a, b) => a.pri - b.pri)
    this.pending = want
    this.pump(now)
    if (now - this.lastTrim > 1500) { this.lastTrim = now; this.trim(now) }
  }

  private lastTris = 0
  private overview = false

  /** Asks for every chunk down to LOD 1 (30 small chunks) so the whole planet can be read at a coarse grain (minimap). */
  wantOverview() { this.overview = true }

  /** True when LOD 0 and 1 are all held. */
  overviewReady(): boolean {
    for (let f = 0; f < 6; f++) {
      if (!this.entries.get(`${f}/0/0/0`)?.chunk) return false
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) if (!this.entries.get(`${f}/1/${x}/${y}`)?.chunk) return false
    }
    return true
  }

  /** The tile at a place from the finest chunk held (or at most `maxLod`), with its biome, height and whether the sea is next to it. */
  sample(lat: number, lon: number, maxLod = this.world.chunk.max_lod): TileInfo | null {
    const E = this.world.chunk.tile_edge
    for (let lod = Math.min(maxLod, this.world.chunk.max_lod); lod >= 0; lod--) {
      const tc = latLonToTile(lat, lon, lod, E)
      const per = (1 << lod) * E
      const gx = Math.min(per - 1, Math.max(0, Math.floor(tc.gx))), gy = Math.min(per - 1, Math.max(0, Math.floor(tc.gy)))
      const e = this.entries.get(`${tc.face}/${lod}/${Math.floor(gx / E)}/${Math.floor(gy / E)}`)
      const c = e?.chunk
      if (!c) continue
      const i = gx % E, j = gy % E
      const k = j * E + i
      const ocean = (c.flags[k] & TILE_OCEAN) !== 0
      let coast = false
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj
        if (ii < 0 || jj < 0 || ii >= E || jj >= E) continue
        if (((c.flags[jj * E + ii] & TILE_OCEAN) !== 0) !== ocean) coast = true
      }
      const rgb: [number, number, number] = [0, 0, 0]
      const tmp = new Uint8Array(3)
      this.colour(c.biome[k], c.elevation[k], c.flags[k], tmp, 0)
      rgb[0] = tmp[0]; rgb[1] = tmp[1]; rgb[2] = tmp[2]
      const biome = c.biome[k]
      return { elev: c.elevation[k], biome, biomeCode: this.world.biomes.find((b) => b.index === biome)?.code ?? '', ocean, lake: (c.flags[k] & TILE_LAKE) !== 0, coast, lod, tileKm: (this.R * Math.PI) / 2 / per, rgb }
    }
    return null
  }

  private pump(now: number) {
    while (this.inflight < MAX_INFLIGHT && this.pending.length) {
      const { e } = this.pending.shift()!
      if (e.chunk || e.state === 'loading') continue
      if (e.state === 'failed' && now - e.failedAt < RETRY_MS) continue
      e.state = 'loading'
      this.inflight++
      this.fetchChunk(e.face, e.lod, e.x, e.y).then((c) => {
        e.chunk = c
        e.state = 'ready'
      }).catch(() => {
        e.state = 'failed'
        e.failedAt = performance.now()
      }).finally(() => {
        this.inflight--
        if (this.disposed) return
        this.pump(performance.now())
        this.onChange()
      })
    }
  }

  /** Meshes unseen for a while go; the oldest decoded chunks go beyond the cap (the coarse ones stay). */
  private trim(now: number) {
    for (const e of this.entries.values()) {
      if (e.mesh && !this.shown.has(e) && now - e.seen > MESH_IDLE_MS) {
        this.group.remove(e.mesh)
        e.mesh.geometry.dispose()
        e.mesh = null
      }
    }
    if (this.entries.size > CHUNK_CAP) {
      const old = [...this.entries.values()].filter((e) => !e.mesh && e.state !== 'loading' && e.lod > 2).sort((a, b) => a.touched - b.touched)
      for (const e of old.slice(0, this.entries.size - CHUNK_CAP)) this.entries.delete(e.key)
    }
  }

  stats(): TerrainStats {
    let loaded = 0, meshes = 0
    for (const e of this.entries.values()) { if (e.chunk) loaded++; if (e.mesh) meshes++ }
    return { loaded, loading: this.inflight, shown: this.shown.size, tris: this.lastTris, meshes }
  }

  /** True while chunks are still on their way for the current cut. */
  busy() { return this.inflight > 0 || this.pending.length > 0 }

  // -- one chunk's mesh ----------------------------------------------------------------

  private buildMesh(e: Entry): Mesh {
    const c = e.chunk!
    const R = this.R
    const E = c.edge
    const per = (1 << e.lod) * E
    const cd = faceDirection(e.face as Face, ((e.x + 0.5) / (1 << e.lod)) * 2 - 1, ((e.y + 0.5) / (1 << e.lod)) * 2 - 1)
    const cl = Math.hypot(cd[0], cd[1], cd[2])
    const cx = (cd[0] / cl) * R, cy = (cd[1] / cl) * R, cz = (cd[2] / cl) * R

    const NV = G * G
    const hk = new Float32Array(NV) // km, sea clamped to 0
    const dirs = new Float32Array(NV * 3)
    const base = new Float32Array(NV * 3) // sea-level position, chunk-local
    const baseW = new Float32Array(NV * 3) // sea-level position, world (for the gradient)
    const rgb = new Uint8Array(NV * 3)
    const tmpRgb = new Uint8Array(3)

    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i
        const d = faceDirection(e.face as Face, ((e.x * E + i) / per) * 2 - 1, ((e.y * E + j) / per) * 2 - 1)
        const l = Math.hypot(d[0], d[1], d[2])
        const dx = d[0] / l, dy = d[1] / l, dz = d[2] / l
        dirs[k * 3] = dx; dirs[k * 3 + 1] = dy; dirs[k * 3 + 2] = dz
        baseW[k * 3] = dx * R; baseW[k * 3 + 1] = dy * R; baseW[k * 3 + 2] = dz * R
        base[k * 3] = dx * R - cx; base[k * 3 + 1] = dy * R - cy; base[k * 3 + 2] = dz * R - cz
        // height: mean of the up to four tiles around the corner
        let sum = 0, n = 0
        for (let tj = j - 1; tj <= j; tj++) {
          for (let ti = i - 1; ti <= i; ti++) {
            if (ti < 0 || tj < 0 || ti >= E || tj >= E) continue
            sum += Math.max(0, c.elevation[tj * E + ti]); n++
          }
        }
        hk[k] = n ? sum / n / 1000 : 0
        // colour: the mean of the tiles around the corner, so coasts and biomes blend instead of stepping
        let cr = 0, cg = 0, cb = 0, cn = 0
        for (let tj = j - 1; tj <= j; tj++) {
          for (let ti = i - 1; ti <= i; ti++) {
            if (ti < 0 || tj < 0 || ti >= E || tj >= E) continue
            const t2 = tj * E + ti
            this.colour(c.biome[t2], c.elevation[t2], c.flags[t2], tmpRgb, 0)
            cr += tmpRgb[0]; cg += tmpRgb[1]; cb += tmpRgb[2]; cn++
          }
        }
        rgb[k * 3] = cr / cn; rgb[k * 3 + 1] = cg / cn; rgb[k * 3 + 2] = cb / cn
      }
    }

    // the skirt ring: border vertices again, dropped
    const skirtKm = Math.max(0.03, ((R * Math.PI) / 2 / (1 << e.lod)) * 0.008)
    const border: number[] = []
    for (let i = 0; i < G; i++) border.push(i) // y = 0
    for (let j = 1; j < G; j++) border.push(j * G + G - 1) // x = max
    for (let i = G - 2; i >= 0; i--) border.push((G - 1) * G + i) // y = max
    for (let j = G - 2; j >= 1; j--) border.push(j * G) // x = 0
    const NB = border.length
    const NT = NV + NB

    const pos = new Float32Array(NT * 3)
    const elev = new Float32Array(NT)
    const dir = new Float32Array(NT * 3)
    const grad = new Float32Array(NT * 3)
    const skirt = new Float32Array(NT)
    const col = new Uint8Array(NT * 3)

    const idx = (i: number, j: number) => Math.min(G - 1, Math.max(0, j)) * G + Math.min(G - 1, Math.max(0, i))
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i
        // height gradient along the two grid axes
        const a = idx(i + 1, j), b = idx(i - 1, j), cc = idx(i, j + 1), dd = idx(i, j - 1)
        let ux = baseW[a * 3] - baseW[b * 3], uy = baseW[a * 3 + 1] - baseW[b * 3 + 1], uz = baseW[a * 3 + 2] - baseW[b * 3 + 2]
        let vx = baseW[cc * 3] - baseW[dd * 3], vy = baseW[cc * 3 + 1] - baseW[dd * 3 + 1], vz = baseW[cc * 3 + 2] - baseW[dd * 3 + 2]
        const lu = Math.hypot(ux, uy, uz) || 1, lv = Math.hypot(vx, vy, vz) || 1
        const su = (hk[a] - hk[b]) / lu, sv = (hk[cc] - hk[dd]) / lv
        ux /= lu; uy /= lu; uz /= lu; vx /= lv; vy /= lv; vz /= lv
        grad[k * 3] = ux * su + vx * sv; grad[k * 3 + 1] = uy * su + vy * sv; grad[k * 3 + 2] = uz * su + vz * sv
        pos[k * 3] = base[k * 3]; pos[k * 3 + 1] = base[k * 3 + 1]; pos[k * 3 + 2] = base[k * 3 + 2]
        elev[k] = hk[k]
        dir[k * 3] = dirs[k * 3]; dir[k * 3 + 1] = dirs[k * 3 + 1]; dir[k * 3 + 2] = dirs[k * 3 + 2]
        col[k * 3] = rgb[k * 3]; col[k * 3 + 1] = rgb[k * 3 + 1]; col[k * 3 + 2] = rgb[k * 3 + 2]
      }
    }
    for (let b = 0; b < NB; b++) {
      const s = border[b], t = NV + b
      for (let q = 0; q < 3; q++) {
        pos[t * 3 + q] = pos[s * 3 + q]; dir[t * 3 + q] = dir[s * 3 + q]; grad[t * 3 + q] = grad[s * 3 + q]; col[t * 3 + q] = col[s * 3 + q]
      }
      elev[t] = elev[s]
      skirt[t] = skirtKm
    }

    const index = new Uint16Array((G - 1) * (G - 1) * 6 + NB * 6)
    let o = 0
    for (let j = 0; j < G - 1; j++) {
      for (let i = 0; i < G - 1; i++) {
        const a = j * G + i, b = a + 1, c2 = a + G, d = c2 + 1
        index[o++] = a; index[o++] = c2; index[o++] = b
        index[o++] = b; index[o++] = c2; index[o++] = d
      }
    }
    for (let b = 0; b < NB; b++) {
      const s0 = border[b], s1 = border[(b + 1) % NB], t0 = NV + b, t1 = NV + ((b + 1) % NB)
      index[o++] = s0; index[o++] = t0; index[o++] = s1
      index[o++] = s1; index[o++] = t0; index[o++] = t1
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aElev', new BufferAttribute(elev, 1))
    geo.setAttribute('aDir', new BufferAttribute(dir, 3))
    geo.setAttribute('aGrad', new BufferAttribute(grad, 3))
    geo.setAttribute('aSkirt', new BufferAttribute(skirt, 1))
    geo.setAttribute('aCol', new BufferAttribute(col, 3, true))
    geo.setIndex(new BufferAttribute(index, 1))
    const mesh = new Mesh(geo, this.material)
    mesh.position.set(cx, cy, cz)
    mesh.frustumCulled = false // the cut already culled it (the shader moves the vertices)
    return mesh
  }

  private colour(biome: number, elev: number, flags: number, out: Uint8Array, at: number) {
    let r: number, g: number, b: number
    const water = (flags & TILE_OCEAN) !== 0 || (elev <= 0 && this.biomeWater[biome])
    if ((flags & TILE_LAKE) !== 0) { r = 61; g = 134; b = 179 } else if (water) {
      const t = Math.min(1, Math.max(0, -elev / 4500))
      r = 44 + (14 - 44) * t; g = 124 + (42 - 124) * t; b = 170 + (88 - 170) * t
    } else {
      const base = this.biomeRgb[biome] ?? [128, 128, 128]
      r = base[0]; g = base[1]; b = base[2]
      const rock = s01((elev - 1800) / 1500)
      r += (138 - r) * rock; g += (132 - g) * rock; b += (120 - b) * rock
      const snow = s01((elev - 3300) / 900)
      r += (242 - r) * snow; g += (245 - g) * snow; b += (248 - b) * snow
    }
    out[at] = r; out[at + 1] = g; out[at + 2] = b
  }

  dispose() {
    this.disposed = true
    for (const e of this.entries.values()) e.mesh?.geometry.dispose()
    this.entries.clear()
    this.shown.clear()
    this.pending = []
    this.group.clear()
    this.material.dispose()
  }
}
