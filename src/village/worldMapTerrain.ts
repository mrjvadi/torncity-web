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
  BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, DataUtils, Frustum, Group, HalfFloatType, LinearFilter, Matrix4, Mesh,
  RGBAFormat, ShaderMaterial, Sphere, UnsignedByteType, Vector3,
  type PerspectiveCamera,
} from 'three'
import type { WorldInfo } from '../api/types'
import { TILE_LAKE, TILE_OCEAN, TILE_STREAM, type Chunk } from './chunk'
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
const FADE_MS = 260

const VERT = /* glsl */ `
attribute float aElev;
attribute vec3 aDir;
attribute vec3 aGrad;
attribute float aSkirt;
attribute vec2 aTile;
uniform float uExag;
uniform float uShade;
varying vec3 vN;
varying float vDist;
varying vec2 vUv;
varying vec3 vDirW;
void main() {
  vec3 p = position + aDir * (aElev * uExag - aSkirt);
  vN = normalize(aDir - uShade * aGrad);
  vUv = (aTile + 1.0) / 34.0;
  vDirW = aDir;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

// The picture is drawn per pixel from a small data texture of the chunk (water share, height, lake, stream), so the coast is an
// iso-line of a smooth field: one crisp line at every zoom, never a magnified raster. Beyond what the data knows, a seeded
// value noise that depends only on the world position and the world seed adds the finer shape (the same for every player).
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uData;
uniform sampler2D uColM;
uniform sampler2D uColT;
uniform vec3 uLight;
uniform vec3 uFogColor;
uniform vec3 uSeed;
uniform float uFogNear;
uniform float uFogFar;
uniform float uStyle;
uniform float uFade;
uniform float uTile;
uniform float uR;
varying vec3 vN;
varying float vDist;
varying vec2 vUv;
varying vec3 vDirW;

// cubic B-spline of a texture with four bilinear fetches
vec4 bicubic(sampler2D t, vec2 uv) {
  vec2 sz = vec2(34.0);
  vec2 p = uv * sz - 0.5;
  vec2 f = fract(p);
  vec2 i = floor(p);
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / sz;
  vec2 h1 = (i + 1.5 + w3 / g1) / sz;
  vec4 a = texture2D(t, vec2(h0.x, h0.y));
  vec4 b = texture2D(t, vec2(h1.x, h0.y));
  vec4 c = texture2D(t, vec2(h0.x, h1.y));
  vec4 d = texture2D(t, vec2(h1.x, h1.y));
  return mix(mix(a, b, g1.x / (g0.x + g1.x)), mix(c, d, g1.x / (g0.x + g1.x)), g1.y / (g0.y + g1.y));
}
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec4 d = bicubic(uData, vUv);
  float pxKm = max(length(fwidth(vDirW)) * uR, 1e-6);
  // seeded detail the data lacks: wavelengths from large to tiny (km), kept only where the data is coarser than the feature
  // and the feature is wider than a pixel; the amplitude follows the wavelength so the coast keeps one character at every level
  float disp = 0.0, grain = 0.0;
  float lam = 96.0;
  for (int o = 0; o < 9; o++) {
    float wData = 1.0 - smoothstep(uTile * 0.9, uTile * 2.4, lam);
    float wPix = smoothstep(0.8, 3.0, lam / pxKm);
    float n = vnoise(vDirW * (uR / lam) + uSeed + float(o) * 7.31) * 2.0 - 1.0;
    disp += n * wData * wPix * lam * 0.11 / uTile;
    float wG = wPix * (1.0 - smoothstep(uTile * 0.15, uTile * 0.9, lam)) ;
    grain += n * wG * 0.35;
    lam *= 0.5;
  }
  float fc = d.r + disp;
  float aa = max(fwidth(fc), 1e-4);
  float dist = abs(fc - 0.5) / aa;               // pixels from the coast line
  float wm = clamp((fc - 0.5) / aa + 0.5, 0.0, 1.0); // 1 = water
  // ---- land
  vec3 land = mix(texture2D(uColM, vUv).rgb, texture2D(uColT, vUv).rgb, uStyle);
  float d0 = max(dot(normalize(vN), uLight), 0.0);
  float amb = mix(0.82, 0.46, uStyle);
  float kk = mix(0.26, 0.74, uStyle);
  land *= (amb + kk * d0) * (1.0 + grain * mix(0.07, 0.12, uStyle));
  // rivers: a thin ribbon where the stream mask is high; gone when a tile is under 2 px
  float riv = smoothstep(0.30, 0.44, d.a + disp * 0.5) * smoothstep(1.2, 3.0, uTile / pxKm);
  land = mix(land, mix(vec3(0.56, 0.75, 0.93), vec3(0.29, 0.52, 0.72), uStyle), riv * 0.9);
  // ---- water
  float depth = clamp(-d.g * 1000.0 / 4500.0, 0.0, 1.0);
  vec3 shallowM = vec3(0.71, 0.86, 0.96), deepM = vec3(0.40, 0.62, 0.84);
  vec3 shallowT = vec3(0.17, 0.49, 0.67), deepT = vec3(0.055, 0.165, 0.345);
  vec3 sea = mix(mix(shallowM, deepM, depth), mix(shallowT, deepT, depth), uStyle);
  vec3 lake = mix(vec3(0.62, 0.81, 1.0), vec3(0.24, 0.53, 0.70), uStyle);
  float lk = smoothstep(0.35, 0.65, d.b + disp);
  vec3 water = mix(sea, lake, lk);
  water *= 1.0 + grain * 0.02;
  // a light band along the shore, fading over about eight pixels
  float shore = (1.0 - smoothstep(0.0, 8.0, dist)) * 0.55;
  water = mix(water, mix(vec3(0.88, 0.95, 0.99), vec3(0.45, 0.78, 0.82), uStyle), shore * wm);
  vec3 c = mix(land, water, wm);
  // the coast line: a crisp stroke about 1.3 px at any zoom
  float line = 1.0 - smoothstep(0.35, 1.25, dist);
  c = mix(c, mix(vec3(0.40, 0.62, 0.82), vec3(0.78, 0.90, 0.92), uStyle), line * 0.85);
  c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, vDist));
  gl_FragColor = vec4(c, uFade);
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
  /** when it last came into view (it fades in over FADE_MS) and when it last left it */
  arriveAt: number
  leaveAt: number
  tex: DataTexture[]
}

export interface TileInfo { elev: number; biome: number; biomeCode: string; ocean: boolean; lake: boolean; coast: boolean; lod: number; tileKm: number; rgb: [number, number, number] }

export interface TerrainStats { loaded: number; loading: number; shown: number; tris: number; meshes: number }

/** the world seed (a decimal string) as a point in noise space: the same world gives the same detail for everyone */
function seedVec(seed: string): Vector3 {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  const f = (k: number) => ((Math.imul(h ^ k, 2654435761) >>> 0) % 4096) + 0.37
  return new Vector3(f(1), f(2), f(3))
}

const s01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export class PlanetTerrain {
  readonly group = new Group()
  private shared: Record<string, { value: unknown }>
  private R: number
  private entries = new Map<string, Entry>()
  private shown = new Set<Entry>()
  private leaving = new Set<Entry>()
  private fading = false
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
    // the uniforms every chunk shares (one object each: setting a value here sets it for every mesh)
    this.shared = {
      uExag: { value: 8 },
      uShade: { value: 8 },
      uStyle: { value: 0 },
      uLight: { value: new Vector3(0.4, 0.5, 0.77).normalize() },
      uFogColor: { value: new Color('#b8d0e6') },
      uFogNear: { value: 1e9 },
      uFogFar: { value: 2e9 },
      uR: { value: this.R },
      uSeed: { value: seedVec(world.seed) },
    }
    for (const b of world.biomes) {
      const hex = b.color ?? '808080'
      // the colour is written to the framebuffer as it is: the sRGB numbers, not linear ones
      this.biomeRgb[b.index] = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
      this.biomeWater[b.index] = !!b.water
    }
  }

  uniforms() { return this.shared as Record<string, { value: any }> } // eslint-disable-line @typescript-eslint/no-explicit-any

  private entry(face: number, lod: number, x: number, y: number): Entry {
    const key = `${face}/${lod}/${x}/${y}`
    let e = this.entries.get(key)
    if (!e) {
      e = { key, face, lod, x, y, state: 'idle', failedAt: 0, chunk: null, mesh: null, seen: 0, touched: 0, arriveAt: 0, leaveAt: 0, tex: [] }
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

    // meshes for what is to be drawn. A node that comes into view fades in over the one it replaces; the one it replaces stays
    // drawn until the fade is over, so there is never a hole, a pop or a rectangle of a different colour.
    const prev = this.shown
    const next = new Set<Entry>()
    let tris = 0
    for (const e of draw) {
      if (!e.mesh) {
        if (builds <= 0) { this.onChange(); continue }
        builds--
        e.mesh = this.buildMesh(e)
        this.group.add(e.mesh)
      }
      if (!prev.has(e) && !(e.leaveAt && now - e.leaveAt < FADE_MS)) e.arriveAt = now
      e.leaveAt = 0
      e.seen = now
      next.add(e)
    }
    for (const e of prev) if (!next.has(e) && !e.leaveAt) e.leaveAt = now
    const leaving = new Set<Entry>()
    for (const e of [...prev, ...this.leaving]) if (!next.has(e) && e.leaveAt && now - e.leaveAt < FADE_MS + 40) leaving.add(e)
    let fading = leaving.size > 0
    for (const e of this.group.children as Mesh[]) e.visible = false
    for (const e of next) {
      const m = e.mesh!, mat = m.material as ShaderMaterial
      const f = Math.min(1, (now - e.arriveAt) / FADE_MS)
      const arriving = f < 1
      if (arriving) fading = true
      mat.uniforms.uFade.value = f * f * (3 - 2 * f)
      mat.depthTest = !arriving; mat.depthWrite = !arriving
      m.renderOrder = arriving ? 1000 + e.lod : e.lod
      m.visible = true
      e.seen = now
      tris += (m.geometry.index?.count ?? 0) / 3
    }
    for (const e of leaving) {
      const m = e.mesh!, mat = m.material as ShaderMaterial
      mat.uniforms.uFade.value = 1; mat.depthTest = true; mat.depthWrite = true; m.renderOrder = e.lod
      m.visible = true; e.seen = now
    }
    this.shown = next
    this.leaving = leaving
    this.fading = fading
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
        this.freeMesh(e)
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
  busy() { return this.inflight > 0 || this.pending.length > 0 || this.fading }

  // -- one chunk's mesh ----------------------------------------------------------------

  /** The tile at (i, j) of a chunk, reaching into the neighbouring chunk of the same level for the border ring (clamped when it is not held). */
  private tileOf(e: Entry, i: number, j: number): { biome: number; elev: number; flags: number } {
    const E = e.chunk!.edge
    let c = e.chunk!
    let ii = i, jj = j
    if (i < 0 || j < 0 || i >= E || j >= E) {
      const dx = i < 0 ? -1 : i >= E ? 1 : 0, dy = j < 0 ? -1 : j >= E ? 1 : 0
      const n = this.entries.get(`${e.face}/${e.lod}/${e.x + dx}/${e.y + dy}`)?.chunk
      if (n) { c = n; ii = (i + E) % E; jj = (j + E) % E } else { ii = Math.min(E - 1, Math.max(0, i)); jj = Math.min(E - 1, Math.max(0, j)) }
    }
    const k = jj * E + ii
    return { biome: c.biome[k], elev: c.elevation[k], flags: c.flags[k] }
  }

  /** The three small textures of a chunk (E + 2 tiles on a side, the border ring from the neighbours): the data field and two palettes. */
  private buildTextures(e: Entry): DataTexture[] {
    const E = e.chunk!.edge, T = E + 2
    const data = new Uint16Array(T * T * 4)
    const colM = new Uint8Array(T * T * 4)
    const colT = new Uint8Array(T * T * 4)
    const water = new Uint8Array(T * T)
    const tmp = new Uint8Array(3)
    const one = DataUtils.toHalfFloat(1), zero = DataUtils.toHalfFloat(0)
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const t = this.tileOf(e, i - 1, j - 1)
        const k = j * T + i
        const w = this.isWater(t.biome, t.elev, t.flags)
        water[k] = w ? 1 : 0
        data[k * 4] = w ? one : zero
        data[k * 4 + 1] = DataUtils.toHalfFloat(Math.max(-12, Math.min(12, t.elev / 1000)))
        data[k * 4 + 2] = (t.flags & TILE_LAKE) !== 0 ? one : zero
        data[k * 4 + 3] = !w && (t.flags & TILE_STREAM) !== 0 ? one : zero
        this.colourMap(t.biome, t.elev, t.flags, tmp); colM[k * 4] = tmp[0]; colM[k * 4 + 1] = tmp[1]; colM[k * 4 + 2] = tmp[2]; colM[k * 4 + 3] = 255
        this.colour(t.biome, t.elev, t.flags, tmp, 0); colT[k * 4] = tmp[0]; colT[k * 4 + 1] = tmp[1]; colT[k * 4 + 2] = tmp[2]; colT[k * 4 + 3] = 255
      }
    }
    // a water tile carries the colour of the land beside it, so the land colour never bleeds blue across the coast
    for (const col of [colM, colT]) {
      const src = col.slice()
      for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
        const k = j * T + i
        if (!water[k]) continue
        let r = 0, g = 0, b = 0, n = 0
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj
          if (ii < 0 || jj < 0 || ii >= T || jj >= T) continue
          const q = jj * T + ii
          if (water[q]) continue
          r += src[q * 4]; g += src[q * 4 + 1]; b += src[q * 4 + 2]; n++
        }
        if (n) { col[k * 4] = r / n; col[k * 4 + 1] = g / n; col[k * 4 + 2] = b / n }
      }
    }
    const mk = (arr: Uint16Array | Uint8Array, type: typeof HalfFloatType | typeof UnsignedByteType) => {
      const t = new DataTexture(arr, T, T, RGBAFormat, type)
      t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping
      t.generateMipmaps = false; t.needsUpdate = true
      return t
    }
    return [mk(data, HalfFloatType), mk(colM, UnsignedByteType), mk(colT, UnsignedByteType)]
  }

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
    const tile = new Float32Array(NT * 2)

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
        tile[k * 2] = i; tile[k * 2 + 1] = j
      }
    }
    for (let b = 0; b < NB; b++) {
      const s = border[b], t = NV + b
      for (let q = 0; q < 3; q++) { pos[t * 3 + q] = pos[s * 3 + q]; dir[t * 3 + q] = dir[s * 3 + q]; grad[t * 3 + q] = grad[s * 3 + q] }
      elev[t] = elev[s]
      tile[t * 2] = tile[s * 2]; tile[t * 2 + 1] = tile[s * 2 + 1]
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
    geo.setAttribute('aTile', new BufferAttribute(tile, 2))
    geo.setIndex(new BufferAttribute(index, 1))
    e.tex = this.buildTextures(e)
    const tileKm = (R * Math.PI) / 2 / per
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -(e.lod + 1) * 2,
      uniforms: { ...this.shared, uData: { value: e.tex[0] }, uColM: { value: e.tex[1] }, uColT: { value: e.tex[2] }, uFade: { value: 1 }, uTile: { value: tileKm } },
    })
    const mesh = new Mesh(geo, mat)
    mesh.renderOrder = e.lod
    mesh.position.set(cx, cy, cz)
    mesh.frustumCulled = false // the cut already culled it (the shader moves the vertices)
    return mesh
  }

  private freeMesh(e: Entry) {
    if (!e.mesh) return
    this.group.remove(e.mesh)
    e.mesh.geometry.dispose();
    (e.mesh.material as ShaderMaterial).dispose()
    for (const t of e.tex) t.dispose()
    e.tex = []
    e.mesh = null
  }

  private isWater(biome: number, elev: number, flags: number) {
    return (flags & (TILE_OCEAN | TILE_LAKE)) !== 0 || (elev <= 0 && this.biomeWater[biome])
  }

  /** The flat cartographic palette: pale land by biome, soft blue water, grey rock, white ice. */
  private colourMap(biome: number, elev: number, flags: number, out: Uint8Array) {
    let r: number, g: number, b: number
    if ((flags & TILE_LAKE) !== 0) { r = 168; g = 210; b = 238 } else if (this.isWater(biome, elev, flags)) {
      const t = Math.min(1, Math.max(0, -elev / 4500))
      r = 190 + (150 - 190) * t; g = 224 + (196 - 224) * t; b = 246 + (232 - 246) * t
    } else {
      // a light cartographic land: the biome's colour softened towards a warm paper tone, rock and snow above the trees
      const base = this.biomeRgb[biome] ?? [160, 170, 150]
      r = base[0] * 0.62 + 238 * 0.38; g = base[1] * 0.62 + 232 * 0.38; b = base[2] * 0.62 + 214 * 0.38
      const rock = s01((elev - 1600) / 1700)
      r += (206 - r) * rock; g += (199 - g) * rock; b += (186 - b) * rock
      const snow = s01((elev - 3300) / 900)
      r += (250 - r) * snow; g += (250 - g) * snow; b += (252 - b) * snow
    }
    out[0] = r; out[1] = g; out[2] = b
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
    for (const e of this.entries.values()) this.freeMesh(e)
    this.entries.clear()
    this.shown.clear()
    this.pending = []
    this.group.clear()
  }
}
