// The world-city demo's own three.js engine: a 3x3-chunk terrain heightmap
// with a settlement's buildings/roads sitting on it. Deliberately separate
// from src/three/cityEngine.ts (the game's own city screen) — this reads a
// static export file, not the live API, and renders a whole landscape, not
// one fixed-camera lot grid — but it borrows that file's proven patterns
// wherever they apply unchanged: render-on-demand, a DPR cap, WebGL
// context-loss handling, the bright pastel daytime lighting rig, and
// InstancedMesh-per-kind so a landscape full of trees and a city full of
// buildings still costs a handful of draw calls, not one per object.

import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { cloneKitModel, kitGeometry, disposeKitAssets } from './kitAssets'
import {
  decodeBase64Bytes,
  TILE_FLAG_LAKE,
  TILE_FLAG_OCEAN,
  TILE_FLAG_STREAM,
  type CityExportJSON,
} from './cityExportTypes'

// -- tuning -------------------------------------------------------------

// One tile = one world unit in X/Z (matches the game's own city screen
// convention of 1 lot = 1 unit); real size (tileMeters, ~305m) is only used
// for the label overlay's distances, never for scene scale — a 96-unit-wide
// scene is a far friendlier number for the camera/controls than a
// ~29km-wide one would be.
const WORLD_UNITS_PER_TILE = 1

// Elevation is already close to real metres (worldgen's own Elevation type:
// "roughly -10000 (trench) .. 10000 (peaks)"). At 1 world unit = 305m in X/Z
// but 1 world unit = 1 unmodified metre in Y, hills would be nearly
// imperceptible (a real 500m hill over a 29km-wide view is a gentle slope
// the eye barely reads at this scale) — EXAGGERATION multiplies elevation
// well past real proportions specifically so the terrain reads as hills
// from an orbiting camera, the task's own "gentle vertical exaggeration"
// ask.
const ELEVATION_TO_WORLD = 0.007

const SKY = 0xdde8da
const LOW_MEMORY_GB = 4
function isLowMemoryDevice(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof mem === 'number' && mem <= LOW_MEMORY_GB
}

// Building type -> which kit model bucket it draws from. civic_hall/market/
// bank/school/clinic/police/housing all share the plain house/garage set
// (the kit has no bespoke "bank" or "school" mesh); what tells them apart
// visually is each one's own real footprint size (2x2 housing vs 3x3
// market/bank/school/clinic) scaled up to match — a civic building simply
// reads as a bigger building on a bigger lot, the same way a real small
// town's town hall is not a different kind of object, just a bigger one.
const KIT_BUILDING_POOL = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage']
const KIT_BUILDING_TYPES = new Set(['housing', 'civic_hall', 'market', 'bank', 'school', 'clinic', 'police'])

function hash2(x: number, y: number, salt: number): number {
  const h = Math.imul(x * 73856093, 1) ^ Math.imul(y * 19349663, 1) ^ Math.imul(salt, 83492791)
  return (h >>> 0) / 4294967295
}

function hexColor(hex: string): Color {
  return new Color(`#${hex}`)
}

export interface WorldCityLabels {
  cityName: string
  continent?: string
  river?: string
  legend: { label: string; colorHex: string }[]
}

export class WorldCityScene {
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private controls: OrbitControls
  private disposed = false
  private contextLost = false
  private active = true
  private raf = 0
  private shadowsEnabled = false // a terrain-scale scene leans on normal-based hillshading, not shadow maps — see doc below

  private loggedFirstFrame = false
  private sceneBuilt = false
  private loggedBuiltFrame = false
  private startedAt = performance.now()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: dpr < 1.75,
      alpha: true, // WebKit's software path blanks an alpha:false canvas — see cityEngine.ts's own note
      powerPreference: 'low-power',
      // This engine renders on demand (no continuous rAF loop — see
      // requestRender's own doc): once idle, WebGL's drawing buffer is
      // otherwise free to go stale after the compositor presents it, so a
      // later read of the canvas (a screenshot, a tab thumbnail) can catch
      // a cleared buffer instead of the last real frame. Keeping it costs a
      // little more GPU memory than the animate-every-frame case would
      // need to worry about, but render-on-demand is exactly the case that
      // needs this true.
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x000000, 0)
    this.scene.background = new Color(SKY)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.28
    // No shadow map: a heightmap already reads its own relief from
    // per-vertex normals under one directional light (real hillshading, the
    // task's own ask), and a shadow map's extra depth pass/texture is the
    // single costliest thing this scene could add for an iPhone's memory —
    // the same context-loss risk cityEngine.ts's own comment documents.
    this.renderer.shadowMap.enabled = false

    this.camera = new PerspectiveCamera(42, 1, 0.5, 400)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = false // render-on-demand: damping would need a live animation loop even when idle
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 14
    this.controls.maxDistance = 140
    this.controls.minPolarAngle = 0.15
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05
    this.controls.addEventListener('change', () => this.requestRender())

    this.buildLights()

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.resize()
  }

  private buildLights() {
    const sun = new DirectionalLight(0xffc98a, 2.2)
    sun.position.set(-60, 90, -40)
    this.scene.add(sun)
    const ambient = new HemisphereLight(0xb9c3ee, 0xd9deef, 1.55)
    this.scene.add(ambient)
    this.scene.fog = new FogExp2(SKY, 0.0068)
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.contextLost = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private onContextRestored = () => {
    this.contextLost = false
    this.requestRender()
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.active = false
      cancelAnimationFrame(this.raf)
      this.raf = 0
    } else {
      this.active = true
      this.requestRender()
    }
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  private requestRender() {
    if (this.raf || this.disposed || !this.active || this.contextLost) return
    this.raf = requestAnimationFrame(this.frame)
  }

  private frame = () => {
    this.raf = 0
    if (this.disposed || this.contextLost) return
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    if (!this.loggedFirstFrame) {
      this.loggedFirstFrame = true
      if (import.meta.env.DEV) this.logStats('first frame', performance.now() - this.startedAt)
    }
    if (this.sceneBuilt && !this.loggedBuiltFrame && (import.meta.env.DEV || new URLSearchParams(location.search).has('stats'))) {
      this.loggedBuiltFrame = true
      this.logStats('scene built, first rendered frame')
    }
  }

  /** Loads the export, builds the whole scene, frames the camera, returns
   * the label overlay's own data (name/continent/river/legend). */
  async load(doc: CityExportJSON): Promise<WorldCityLabels> {
    const gridW = doc.grid.w
    const gridH = doc.grid.h
    const elevation = doc.elevation
    const biome = decodeBase64Bytes(doc.biome)
    const flags = decodeBase64Bytes(doc.flags)

    const worldHeights = this.flattenCityFootprint(doc, elevation, gridW, gridH)

    this.buildTerrain(doc, worldHeights, biome, flags, gridW, gridH)
    this.buildWater(worldHeights, biome, flags, gridW, gridH)
    await this.buildTrees(doc, worldHeights, biome, flags, gridW, gridH)
    await this.buildCity(doc, worldHeights, gridW)

    this.frameCamera(doc, worldHeights, gridW, gridH)
    this.sceneBuilt = true
    this.requestRender()

    return this.labelsFor(doc)
  }

  // -- terrain flattening ------------------------------------------------

  /** Returns a WORLD-SPACE (already *ELEVATION_TO_WORLD) height array, with
   * the city's own footprint graded toward one gentle plateau so its roads
   * and buildings sit level — real terrain grading, not a literal "flatten
   * every lot" (ADR 0028 §6's spirit: a settlement's own ground is levelled
   * once, not per building) — blended out to nothing a few tiles past the
   * city's edge so the graded patch never shows as a hard step against the
   * surrounding hills. */
  private flattenCityFootprint(doc: CityExportJSON, elevation: number[], gridW: number, gridH: number): Float32Array {
    const out = new Float32Array(gridW * gridH)
    for (let i = 0; i < out.length; i++) out[i] = elevation[i] * ELEVATION_TO_WORLD

    const { originX, originY, size } = doc.city
    let sum = 0
    let n = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        sum += out[(originY + y) * gridW + (originX + x)]
        n++
      }
    }
    const plateau = n > 0 ? sum / n : 0

    const margin = 4 // tiles of soft falloff beyond the city's own edge
    const minX = originX - margin
    const maxX = originX + size - 1 + margin
    const minY = originY - margin
    const maxY = originY + size - 1 + margin
    for (let y = Math.max(0, minY); y <= Math.min(gridH - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(gridW - 1, maxX); x++) {
        // distance (in tiles) outside the city's own core, 0 inside it
        const dx = x < originX ? originX - x : x > originX + size - 1 ? x - (originX + size - 1) : 0
        const dy = y < originY ? originY - y : y > originY + size - 1 ? y - (originY + size - 1) : 0
        const d = Math.max(dx, dy)
        const t = 1 - Math.min(1, d / margin) // 1 at the core, 0 at margin's edge
        const blend = t * t * (3 - 2 * t) // smoothstep, so the graded patch meets real terrain smoothly
        const i = y * gridW + x
        out[i] = out[i] * (1 - blend) + plateau * blend
      }
    }
    return out
  }

  // -- terrain mesh --------------------------------------------------------

  private buildTerrain(doc: CityExportJSON, heights: Float32Array, biome: Uint8Array, flags: Uint8Array, gridW: number, gridH: number) {
    const legend = doc.biomeLegend.map((b) => hexColor(b.colorHex))
    const positions = new Float32Array(gridW * gridH * 3)
    const colors = new Float32Array(gridW * gridH * 3)

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = y * gridW + x
        positions[i * 3 + 0] = x * WORLD_UNITS_PER_TILE
        positions[i * 3 + 1] = heights[i]
        positions[i * 3 + 2] = y * WORLD_UNITS_PER_TILE

        let c = legend[biome[i]] ?? new Color(0x9ab973)
        // Streams thread through land biomes far too thin for their own
        // geometry at this LOD; tinting the terrain vertex itself (exactly
        // the approach cmd/worldpreview's own renderer takes for the same
        // reason) reads as a stream without a separate mesh.
        if (flags[i] & TILE_FLAG_STREAM) c = new Color(0x5aa8dd)
        colors[i * 3 + 0] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
    }

    const quadsX = gridW - 1
    const quadsY = gridH - 1
    // Uint16: a 96x96 grid is 9216 vertices, comfortably under 65536, and a
    // 16-bit index buffer needs no WebGL extension to draw at all (a 32-bit
    // one needs OES_element_index_uint on a WebGL1 context) — the safer
    // choice for an unknown phone's GL stack, not just a smaller upload.
    const indices = new Uint16Array(quadsX * quadsY * 6)
    let ii = 0
    for (let y = 0; y < quadsY; y++) {
      for (let x = 0; x < quadsX; x++) {
        const a = y * gridW + x
        const b = a + 1
        const c = a + gridW
        const d = c + 1
        indices[ii++] = a
        indices[ii++] = c
        indices[ii++] = b
        indices[ii++] = b
        indices[ii++] = c
        indices[ii++] = d
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('color', new BufferAttribute(colors, 3))
    geo.setIndex(new BufferAttribute(indices, 1))
    geo.computeVertexNormals() // smooth normals across shared vertices = the hillshading the task asks for, for free under one directional light

    const mat = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })
    const mesh = new Mesh(geo, mat)
    this.scene.add(mesh)
  }

  // -- water: one flat instanced quad per ocean/lake tile ------------------

  private buildWater(heights: Float32Array, biome: Uint8Array, flags: Uint8Array, gridW: number, gridH: number) {
    const tiles: { x: number; y: number; kind: 'ocean' | 'lake' }[] = []
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = y * gridW + x
        if (flags[i] & TILE_FLAG_OCEAN) tiles.push({ x, y, kind: 'ocean' })
        else if (flags[i] & TILE_FLAG_LAKE) tiles.push({ x, y, kind: 'lake' })
      }
    }
    if (tiles.length === 0) return

    const geo = new PlaneGeometry(WORLD_UNITS_PER_TILE * 1.04, WORLD_UNITS_PER_TILE * 1.04)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.86, side: DoubleSide })
    const mesh = new InstancedMesh(geo, mat, tiles.length)
    const oceanColor = new Color(0x6fc7d6)
    const lakeColor = new Color(0x4fb0c9)
    const m = new Matrix4()
    tiles.forEach((t, idx) => {
      const gi = t.y * gridW + t.x
      // Ocean sits at (roughly) sea level; a lake was filled to its own
      // level by the generator — reading the terrain's own height back
      // keeps every water tile flush with the land right at its shore
      // instead of one flat plane cutting through nearby hills.
      const y = t.kind === 'ocean' ? Math.min(0, heights[gi]) - 0.01 : heights[gi] + 0.01
      m.makeTranslation(t.x * WORLD_UNITS_PER_TILE, y, t.y * WORLD_UNITS_PER_TILE)
      mesh.setMatrixAt(idx, m)
      mesh.setColorAt(idx, t.kind === 'ocean' ? oceanColor : lakeColor)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.scene.add(mesh)
  }

  // -- forest: thinned instanced trees on forest-biome tiles ---------------

  private async buildTrees(doc: CityExportJSON, heights: Float32Array, biome: Uint8Array, flags: Uint8Array, gridW: number, gridH: number) {
    const forestCodes = new Set(
      doc.biomeLegend
        .map((b, idx) => ({ idx, code: b.code }))
        .filter((b) => b.code.includes('forest'))
        .map((b) => b.idx),
    )
    if (forestCodes.size === 0) return

    const { originX, originY, size } = doc.city
    const inCity = (x: number, y: number) => x >= originX - 1 && x < originX + size + 1 && y >= originY - 1 && y < originY + size + 1

    type Spot = { x: number; y: number; tall: boolean }
    const spots: Spot[] = []
    const cx = originX + size / 2
    const cz = originY + size / 2
    const nearRadius = size / 2 + 16
    // Thinned deterministically (a hash of the tile, not Math.random — the
    // same export always plants the same trees), and thinned MORE the
    // farther a tile sits from the settlement: this export's whole 3x3
    // chunk window happens to be almost entirely forest biome (9203 of
    // 9216 tiles), so a flat "one tree per ~7 tiles" ratio alone was still
    // north of a thousand tree instances — plenty of triangles for a
    // phone's fill rate. Keeping the near ring reasonably dense (the woods
    // right around a town read as real woods) and thinning the distant
    // ring hard (it is background — the terrain's own forest-green colour
    // already reads as forest from far away) keeps the same visual read
    // for a fraction of the instance count.
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = y * gridW + x
        if (!forestCodes.has(biome[i])) continue
        if (flags[i] & (TILE_FLAG_OCEAN | TILE_FLAG_LAKE | TILE_FLAG_STREAM)) continue
        if (inCity(x, y)) continue
        const near = Math.hypot(x - cx, y - cz) < nearRadius
        const keepRatio = near ? 1 / 9 : 1 / 40
        const h = hash2(x, y, 7)
        if (h > keepRatio) continue
        spots.push({ x, y, tall: hash2(x, y, 11) > 0.6 })
      }
    }
    if (spots.length === 0) return

    const [treeGeo, tallGeo] = await Promise.all([kitGeometry('grass-trees'), kitGeometry('grass-trees-tall')])
    const place = (geoMat: { geometry: BufferGeometry; material: import('three').Material } | null, list: Spot[]) => {
      if (!geoMat || list.length === 0) return
      const mesh = new InstancedMesh(geoMat.geometry, geoMat.material, list.length)
      const m = new Matrix4()
      const q = new Quaternion()
      const up = new Vector3(0, 1, 0)
      list.forEach((s, idx) => {
        const gi = s.y * gridW + s.x
        q.setFromAxisAngle(up, hash2(s.x, s.y, 23) * Math.PI * 2)
        const scale = 0.85 + hash2(s.x, s.y, 29) * 0.3
        m.compose(
          new Vector3(s.x * WORLD_UNITS_PER_TILE, heights[gi], s.y * WORLD_UNITS_PER_TILE),
          q,
          new Vector3(scale, scale, scale),
        )
        mesh.setMatrixAt(idx, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }
    place(treeGeo, spots.filter((s) => !s.tall))
    place(tallGeo, spots.filter((s) => s.tall))
  }

  // -- the city: roads, lamps, buildings, parks, farms, mine, port ---------

  private async buildCity(doc: CityExportJSON, heights: Float32Array, gridW: number) {
    const { originX, originY, roads, lots } = doc.city
    // A footprint's own centre (lot.x + w/2 - 0.5) lands on a HALF-integer
    // local coordinate for every even-sized footprint (every 2x2 building:
    // housing, civic_hall, police, park, farm, mine, port — everything
    // except the 3x3 civic buildings). Float32Array indexing with a
    // non-integer key silently returns undefined, not an interpolated or
    // rounded read — that undefined then poisons the whole placement
    // (NaN position, an instance WebGL quietly drops). Rounding ONLY the
    // lookup index (never the world X/Z the building actually renders at)
    // fixes it: the terrain height a couple of tenths of a tile off from a
    // footprint's exact centre is never visibly different.
    const heightAt = (lx: number, ly: number) => heights[(originY + Math.round(ly)) * gridW + (originX + Math.round(lx))]
    const toWorld = (lx: number, ly: number) => new Vector3((originX + lx) * WORLD_UNITS_PER_TILE, heightAt(lx, ly), (originY + ly) * WORLD_UNITS_PER_TILE)

    await this.buildRoads(roads, toWorld)

    const byBucket = new Map<string, { pos: Vector3; scale: number; rot: number }[]>()
    const specials: { kind: string; lot: (typeof lots)[number]; center: Vector3; footWorld: number }[] = []

    for (const lot of lots) {
      const cx = lot.x + lot.w / 2 - 0.5
      const cy = lot.y + lot.h / 2 - 0.5
      const center = toWorld(cx, cy)
      const footWorld = Math.min(lot.w, lot.h) * WORLD_UNITS_PER_TILE

      if (KIT_BUILDING_TYPES.has(lot.type)) {
        const modelIdx = Math.floor(hash2(originX + lot.x, originY + lot.y, 41) * KIT_BUILDING_POOL.length)
        const model = KIT_BUILDING_POOL[Math.min(KIT_BUILDING_POOL.length - 1, modelIdx)]
        // Every kit model's own footprint is exactly 1x1 unit (measured via
        // Box3 against the loaded GLB), so "scale" IS the world footprint
        // it fills — 0.85 of the lot leaves a small gap to the next lot,
        // the same margin a real building sits back from its own plot line.
        const scale = footWorld * (lot.type === 'civic_hall' ? 0.95 : 0.85)
        const rot = Math.round(hash2(originX + lot.x, originY + lot.y, 43) * 4) * (Math.PI / 2)
        const arr = byBucket.get(model) ?? []
        arr.push({ pos: center, scale, rot })
        byBucket.set(model, arr)
      } else {
        specials.push({ kind: lot.type, lot, center, footWorld })
      }
    }

    await this.buildInstancedBuildings(byBucket)
    await this.buildSpecials(specials, doc)
  }

  private async buildRoads(roads: [number, number][], toWorld: (x: number, y: number) => Vector3) {
    if (roads.length === 0) return
    const cells = new Set(roads.map(([x, y]) => `${x},${y}`))
    const has = (x: number, y: number) => cells.has(`${x},${y}`)

    const [straight, lamp, cross] = await Promise.all([
      kitGeometry('road-straight'),
      kitGeometry('road-straight-lightposts'),
      kitGeometry('road-intersection'),
    ])
    if (!straight || !cross) return

    const straightMesh = new InstancedMesh(straight.geometry, straight.material, roads.length)
    const lampMesh = lamp ? new InstancedMesh(lamp.geometry, lamp.material, roads.length) : null
    const crossMesh = new InstancedMesh(cross.geometry, cross.material, roads.length)
    let ns = 0, nl = 0, nc = 0
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    for (const [x, y] of roads) {
      const ew = has(x - 1, y) || has(x + 1, y)
      const ns2 = has(x, y - 1) || has(x, y + 1)
      const pos = toWorld(x, y)
      pos.y += 0.006
      if (ew && ns2) {
        q.identity()
        m.compose(pos, q, new Vector3(1, 1, 1))
        crossMesh.setMatrixAt(nc++, m)
      } else {
        q.setFromAxisAngle(up, ew ? Math.PI / 2 : 0)
        m.compose(pos, q, new Vector3(1, 1, 1))
        if (lampMesh && (x + y) % 2 === 0) lampMesh.setMatrixAt(nl++, m)
        else straightMesh.setMatrixAt(ns++, m)
      }
    }
    straightMesh.count = ns
    crossMesh.count = nc
    straightMesh.instanceMatrix.needsUpdate = true
    crossMesh.instanceMatrix.needsUpdate = true
    this.scene.add(straightMesh, crossMesh)
    if (lampMesh) {
      lampMesh.count = nl
      lampMesh.instanceMatrix.needsUpdate = true
      this.scene.add(lampMesh)
    }
  }

  private async buildInstancedBuildings(byBucket: Map<string, { pos: Vector3; scale: number; rot: number }[]>) {
    for (const [model, items] of byBucket) {
      const geoMat = await kitGeometry(model)
      if (!geoMat) continue
      const mesh = new InstancedMesh(geoMat.geometry, geoMat.material, items.length)
      const m = new Matrix4()
      const q = new Quaternion()
      const up = new Vector3(0, 1, 0)
      items.forEach((it, idx) => {
        q.setFromAxisAngle(up, it.rot)
        m.compose(it.pos, q, new Vector3(it.scale, it.scale, it.scale))
        mesh.setMatrixAt(idx, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }
  }

  /** Park (greenery + one fountain), farm (a tinted field plane), mine (a
   * garage building plus an ore-coloured marker) and port (a dock plane) —
   * the catalogue entries with no direct Kenney-kit equivalent, approximated
   * from what the kit actually ships rather than left unbuilt. Noted in the
   * project report as a demo-only simplification. */
  private async buildSpecials(
    specials: { kind: string; lot: { type: string; x: number; y: number; w: number; h: number }; center: Vector3; footWorld: number }[],
    doc: CityExportJSON,
  ) {
    if (specials.length === 0) return

    const parkSpots = specials.filter((s) => s.kind === 'park')
    const farmSpots = specials.filter((s) => s.kind === 'farm')
    const mineSpots = specials.filter((s) => s.kind === 'mine')
    const portSpots = specials.filter((s) => s.kind === 'port')

    if (parkSpots.length > 0) {
      const treeGeo = await kitGeometry('grass-trees-tall')
      if (treeGeo) {
        const mesh = new InstancedMesh(treeGeo.geometry, treeGeo.material, parkSpots.length)
        const m = new Matrix4()
        parkSpots.forEach((s, idx) => {
          const scale = s.footWorld * 0.8
          m.compose(s.center, new Quaternion(), new Vector3(scale, scale, scale))
          mesh.setMatrixAt(idx, m)
        })
        mesh.instanceMatrix.needsUpdate = true
        this.scene.add(mesh)
      }
      const fountain = await cloneKitModel('pavement-fountain')
      if (fountain) {
        const s = parkSpots[0]
        fountain.position.copy(s.center)
        fountain.scale.setScalar(s.footWorld * 0.9)
        this.scene.add(fountain)
      }
    }

    if (farmSpots.length > 0) {
      const geo = new PlaneGeometry(1, 1)
      geo.rotateX(-Math.PI / 2)
      const mat = new MeshLambertMaterial({ color: 0xd8c46a })
      const mesh = new InstancedMesh(geo, mat, farmSpots.length)
      const m = new Matrix4()
      farmSpots.forEach((s, idx) => {
        m.compose(s.center, new Quaternion(), new Vector3(s.lot.w * 0.95, 1, s.lot.h * 0.95))
        mesh.setMatrixAt(idx, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }

    if (mineSpots.length > 0) {
      const garage = await kitGeometry('building-garage')
      const markerColor = hexColor(doc.resourceLegend[0]?.colorHex ?? '888888')
      if (garage) {
        const mesh = new InstancedMesh(garage.geometry, garage.material, mineSpots.length)
        const m = new Matrix4()
        mineSpots.forEach((s, idx) => {
          const scale = s.footWorld * 0.85
          m.compose(s.center, new Quaternion(), new Vector3(scale, scale, scale))
          mesh.setMatrixAt(idx, m)
        })
        mesh.instanceMatrix.needsUpdate = true
        this.scene.add(mesh)
      }
      const markerGeo = new PlaneGeometry(0.5, 0.5)
      markerGeo.rotateX(-Math.PI / 2)
      const markerMesh = new InstancedMesh(markerGeo, new MeshLambertMaterial({ color: markerColor }), mineSpots.length)
      const m2 = new Matrix4()
      mineSpots.forEach((s, idx) => {
        const p = s.center.clone()
        p.y += 0.02
        m2.makeTranslation(p.x, p.y, p.z)
        markerMesh.setMatrixAt(idx, m2)
      })
      markerMesh.instanceMatrix.needsUpdate = true
      this.scene.add(markerMesh)
    }

    if (portSpots.length > 0) {
      const geo = new PlaneGeometry(1, 1)
      geo.rotateX(-Math.PI / 2)
      const mat = new MeshLambertMaterial({ color: 0x8fa9c9 })
      const mesh = new InstancedMesh(geo, mat, portSpots.length)
      const m = new Matrix4()
      portSpots.forEach((s, idx) => {
        m.compose(s.center, new Quaternion(), new Vector3(s.lot.w * 0.95, 1, s.lot.h * 0.95))
        mesh.setMatrixAt(idx, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }
  }

  // -- camera framing + labels ---------------------------------------------

  /** Frames the camera on the city's own footprint using its real bounding
   * sphere (not a guessed distance): the previous hand-picked distance/polar
   * numbers repeatedly under- or over-shot the actual 15x15 extent once
   * real (uneven) terrain and a narrow portrait aspect were both in play.
   * A bounding-sphere fit is the standard, robust way to frame an object of
   * known size regardless of aspect ratio or FOV tuning later. */
  private frameCamera(doc: CityExportJSON, heights: Float32Array, gridW: number, gridH: number) {
    const { originX, originY, size } = doc.city
    let minY = Infinity
    let maxY = -Infinity
    for (let ly = 0; ly <= size; ly++) {
      for (let lx = 0; lx <= size; lx++) {
        const gx = Math.min(gridW - 1, originX + lx)
        const gy = Math.min(gridH - 1, originY + ly)
        const h = heights[gy * gridW + gx]
        if (h < minY) minY = h
        if (h > maxY) maxY = h
      }
    }
    maxY += 3 // headroom for building height above the ground plateau

    const cx = originX + size / 2
    const cz = originY + size / 2
    const cy = (minY + maxY) / 2
    const target = new Vector3(cx, cy, cz)
    this.controls.target.copy(target)

    // Bounding-sphere radius of the city's own box (footprint + a little
    // building height), padded 25% so the frame has breathing room rather
    // than cropping the outermost lots tight against the edge.
    const half = size / 2
    const radius = Math.sqrt(half * half + half * half + ((maxY - minY) / 2) ** 2) * 1.25

    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect)
    const limitingFov = Math.min(vFov, hFov)
    const dist = Math.max(this.controls.minDistance, radius / Math.sin(limitingFov / 2))

    const azimuth = Math.PI / 5
    const polar = Math.PI / 3.4
    const offset = new Vector3(
      dist * Math.sin(polar) * Math.sin(azimuth),
      dist * Math.cos(polar),
      dist * Math.sin(polar) * Math.cos(azimuth),
    )
    this.camera.position.copy(target).add(offset)
    this.controls.update()
  }

  private labelsFor(doc: CityExportJSON): WorldCityLabels {
    const legend: { label: string; colorHex: string }[] = []
    const seen = new Set<number>()
    const biomeBytes = decodeBase64Bytes(doc.biome)
    for (const b of biomeBytes) seen.add(b)
    for (const idx of seen) {
      const entry = doc.biomeLegend[idx]
      if (!entry || entry.code === 'ocean' || entry.code === 'lake') continue
      legend.push({ label: entry.code, colorHex: entry.colorHex })
      if (legend.length >= 5) break
    }
    return {
      cityName: 'شهر نمونه',
      continent: doc.world.continent,
      river: doc.world.river,
      legend,
    }
  }

  private logStats(label: string, ms?: number) {
    const info = this.renderer.info
    const t = ms !== undefined ? `${ms.toFixed(0)}ms` : ''
    // eslint-disable-next-line no-console
    console.log(
      `[worldCity] ${label} ${t} — calls=${info.render.calls} triangles=${info.render.triangles} ` +
      `geometries=${info.memory.geometries} textures=${info.memory.textures}`,
    )
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.controls.dispose()
    this.scene.traverse((obj) => {
      const mesh = obj as Mesh
      if ((mesh as unknown as { geometry?: BufferGeometry }).geometry) mesh.geometry.dispose()
      const mat = (mesh as unknown as { material?: import('three').Material | import('three').Material[] }).material
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose()
    })
    this.renderer.dispose()
    disposeKitAssets()
  }
}
