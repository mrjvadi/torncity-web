// The village's three.js scene. Terrain, water, grass and boulders are the
// src/demo builders fed with the live world (terrainModel.ts); on top of them
// sit this file's own roads, trees, buildings (finished ones merged into one
// mesh, those under construction as scaffolding whose height follows the
// clock), the build-mode overlay and a touch camera (one finger orbits, two
// pinch and pan). Rendering is on demand: a frame is drawn when the camera
// moved, the layout changed or the water is animating.

import {
  ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Material, Mesh, PerspectiveCamera,
  Raycaster, Scene, SRGBColorSpace, TOUCH, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LayoutBuilding, VillageLayout, WorldInfo } from '../api/types'
import { buildTerrain, GrassField, buildBoulders, type TerrainResult, type FieldResult } from '../demo/terrain'
import { buildWater, buildCoarseWaterPatch, type WaterResult, type CoarseWaterResult } from '../demo/water'
import { swapDiffuse, PHOTO_TEXTURES } from '../demo/photoTextures'
import type { VillageGround } from './terrainModel'
import { buildModel, buildScaffold } from './buildingModels'
import { ColorGeom } from './colorGeom'
import { makeBuildingMaterials, type BuildingMaterials } from './buildingMaterials'
import { buildVillageRoads, type RoadsMesh } from './villageRoads'
import { LotOverlay } from './lotOverlay'
import { TreeField, type TreeSpot } from './vegetation'
import { createSky, type Sky } from './sky'
import { seededRng } from './colorGeom'

const SKY_TOP = 0x8fc3ec
const SKY_HORIZON = 0xe9f3f7
const FOG_NEAR = 1400
const FOG_FAR = 7000
const SUN = new Vector3(-0.5, 0.7, 0.45).normalize()
const MARGIN = 1.2 // metres left between two neighbouring buildings
const WATER_TICK_MS = 1000 / 30

export interface ScreenLabel { key: string; x: number; y: number; visible: boolean }

export interface Ghost { type: string; w: number; h: number; x: number; y: number; rotated: boolean; ok: boolean }

export interface SceneOptions {
  onTap?: (hit: { x: number; y: number } | null, buildingId: string | null) => void
  onLabels?: (labels: ScreenLabel[]) => void
  /** Milliseconds to add to Date.now() to get the server's clock. */
  clockSkewMs?: () => number
}

type Pose = { cx: number; cz: number; W: number; D: number; base: number; foundation: number }

/** Progress 0..1 of a building under construction from its timestamps. */
export function constructionProgress(b: Pick<LayoutBuilding, 'started_at' | 'finish_at' | 'state'>, nowMs: number): number {
  if (b.state === 'built' || b.state === 'damaged') return 1
  if (b.state === 'planned' || !b.started_at || !b.finish_at) return 0.05
  const s = Date.parse(b.started_at), f = Date.parse(b.finish_at)
  if (!(f > s)) return 1
  return Math.max(0, Math.min(1, (nowMs - s) / (f - s)))
}

export class VillageScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private controls: OrbitControls
  private sky: Sky
  private terrain!: TerrainResult
  private water: WaterResult | null = null
  private coarseWater: CoarseWaterResult | null = null
  private grass!: GrassField
  private boulders: FieldResult | null = null
  private trees: TreeField | null = null
  private roads: RoadsMesh | null = null
  private mats: BuildingMaterials
  private overlay: LotOverlay
  private builtMesh: Mesh | null = null
  private scaffoldMesh: Mesh | null = null
  private ghostMesh: Mesh | null = null
  private ghostKey = ''
  private layout: VillageLayout
  private poses = new Map<string, Pose & { height: number; building: LayoutBuilding }>()
  private scaffoldKey = ''
  private raf = 0
  private disposed = false
  private active = true
  private contextLost = false
  private lastMoved = performance.now()
  private waterClock = 0
  private waterTimer = 0
  private labelTimer = 0
  private raycaster = new Raycaster()
  private down: { x: number; y: number; t: number } | null = null
  private selectedId: string | null = null
  private reduced: boolean
  private lastLabelJson = ''
  private center = new Vector3()

  private constructor(private canvas: HTMLCanvasElement, readonly ground: VillageGround, private world: WorldInfo, layout: VillageLayout, private opts: SceneOptions) {
    this.layout = layout
    this.reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({ canvas, antialias: dpr < 1.75, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3
    this.renderer.shadowMap.enabled = false
    this.scene.background = new Color(SKY_HORIZON)
    this.camera = new PerspectiveCamera(46, 1, 2, 12000)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 28
    this.controls.maxDistance = 1400
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06
    this.controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
    this.controls.addEventListener('change', this.onChange)

    this.sky = createSky(SUN, SKY_HORIZON, SKY_TOP)
    this.scene.add(this.sky.mesh)
    const sun = new DirectionalLight(0xfff3dc, 2.5)
    sun.position.copy(SUN).multiplyScalar(800)
    this.scene.add(sun, new HemisphereLight(SKY_TOP, 0xd6cdb0, 1.05), new AmbientLight(0xffffff, 0.22))
    this.scene.fog = new Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR)

    this.mats = makeBuildingMaterials()
    this.overlay = new LotOverlay(ground)
    this.scene.add(...this.overlay.objects)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  static async create(canvas: HTMLCanvasElement, ground: VillageGround, world: WorldInfo, layout: VillageLayout, opts: SceneOptions): Promise<VillageScene> {
    const s = new VillageScene(canvas, ground, world, layout, opts)
    await s.build()
    return s
  }

  // -- building the scene -----------------------------------------------------

  private async build() {
    const { grids } = this.ground
    const stage = (name: string, fn: () => void) => {
      try { fn() } catch (e) { console.error(`[village] ${name} failed`, e) }
    }
    stage('terrain', () => {
      this.terrain = buildTerrain(grids)
      this.scene.add(...this.terrain.objects)
    })
    stage('water', () => {
      this.water = buildWater(grids)
      if (this.water.mesh) this.scene.add(this.water.mesh)
      this.coarseWater = buildCoarseWaterPatch(grids)
      if (this.coarseWater.mesh) this.scene.add(this.coarseWater.mesh)
    })
    stage('roads', () => this.rebuildRoads())
    stage('grass', () => {
      this.grass = new GrassField(grids)
      const { originX, originY, n } = this.ground
      this.grass.removeCandidates((fx, fy) => fx >= originX - 1 && fx <= originX + n && fy >= originY - 1 && fy <= originY + n)
      this.scene.add(this.grass.object)
    })
    stage('boulders', () => {
      this.boulders = buildBoulders(grids)
      this.scene.add(...this.boulders.objects)
    })
    stage('trees', () => {
      this.trees = new TreeField(this.treeSpots())
      this.scene.add(...this.trees.objects)
    })
    this.rebuildBuildings()
    this.frame('aerial')
    this.trees?.update(this.camera.position, true)
    this.grass?.update(this.camera.position)
    this.startTimers()
    this.request()
    // real photo textures for the ground, after the first frame
    if (this.terrain) {
      void swapDiffuse(this.terrain.fineMaterial, PHOTO_TEXTURES.grassLawn, 1, 1, () => this.request())
      void swapDiffuse(this.terrain.coarseMaterial, PHOTO_TEXTURES.leafyGrass, 1, 1, () => this.request())
    }
  }

  private treeSpots(): TreeSpot[] {
    const { grids, groundY, originX, originY, n } = this.ground
    const legend = grids.doc.biomeLegend
    const density = (code: string): number => {
      if (/rainforest/.test(code)) return 0.42
      if (/boreal|taiga/.test(code)) return 0.4
      if (/forest/.test(code)) return 0.34
      if (/savanna/.test(code)) return 0.05
      if (/grassland|steppe|meadow/.test(code)) return 0.03
      return 0
    }
    const r = seededRng(9137)
    const spots: TreeSpot[] = []
    const { w, h } = grids.fine
    const lot = this.ground.lot
    const roadCells = new Set(this.roadLots().map((p) => `${p.x},${p.y}`))
    for (let fy = 1; fy < h - 1; fy++) {
      for (let fx = 1; fx < w - 1; fx++) {
        const idx = fy * w + fx
        if (grids.fine.water[idx] !== 0) continue
        const code = legend[grids.fine.biome[idx]]?.code ?? ''
        let p = density(code)
        if (p === 0) continue
        if (grids.fineSlopeAt(fx, fy) > 0.5) continue
        const inBlock = fx >= originX && fx < originX + n && fy >= originY && fy < originY + n
        const nearBlock = fx >= originX - 1 && fx <= originX + n && fy >= originY - 1 && fy <= originY + n
        if (inBlock) {
          const lx = fx - originX, ly = n - 1 - (fy - originY)
          const lotInfo = this.layout.lots[ly]?.[lx]
          if (lotInfo?.buildable || roadCells.has(`${lx},${ly}`) || this.occupied(lx, ly)) continue
          p *= 0.6
        } else if (nearBlock) p *= 0.25
        const count = Math.floor(p * 3 + r())
        for (let k = 0; k < count; k++) {
          const c = grids.fineScene(fx + (r() - 0.5) * 0.9, fy + (r() - 0.5) * 0.9)
          if (inBlock && this.ground.lotAt(c.x, c.z) === null) continue
          spots.push({ x: c.x, z: c.z, y: groundY(c.x, c.z), s: 0.8 + r() * 0.8, rot: r() * Math.PI * 2, species: /boreal|taiga/.test(code) || r() < 0.22 ? 1 : 0 })
        }
      }
    }
    void lot
    return spots.slice(0, 2600)
  }

  private occupied(lx: number, ly: number): boolean {
    return this.layout.buildings.some((b) => lx >= b.x && lx < b.x + b.w && ly >= b.y && ly < b.y + b.h)
  }

  private roadLots(): { x: number; y: number }[] {
    const fromRoads = this.layout.roads ?? []
    const fromBuildings = this.layout.buildings.filter((b) => b.type === 'road' && (b.state === 'built' || b.state === 'damaged')).map((b) => ({ x: b.x, y: b.y }))
    const seen = new Set<string>()
    const out: { x: number; y: number }[] = []
    for (const p of [...fromRoads, ...fromBuildings]) {
      const k = `${p.x},${p.y}`
      if (!seen.has(k)) { seen.add(k); out.push(p) }
    }
    return out
  }

  private rebuildRoads() {
    if (this.roads?.mesh) this.scene.remove(this.roads.mesh)
    this.roads?.dispose()
    this.roads = buildVillageRoads(this.ground, this.roadLots())
    if (this.roads.mesh) this.scene.add(this.roads.mesh)
  }

  // -- layout -------------------------------------------------------------------

  /** A new layout (a building placed, finished, pulled down): rebuild what stands. */
  setLayout(layout: VillageLayout) {
    this.layout = layout
    this.rebuildRoads()
    this.rebuildBuildings()
    this.request()
  }

  private poseOf(b: LayoutBuilding): Pose {
    const g = this.ground
    const lot = g.lot
    const a = g.lotCentre(b.x, b.y + b.h - 1)
    const c = g.lotCentre(b.x + b.w - 1, b.y)
    const x0 = a.x - lot / 2 + MARGIN, x1 = c.x + lot / 2 - MARGIN, z0 = a.z - lot / 2 + MARGIN, z1 = c.z + lot / 2 - MARGIN
    const span = g.span(x0, z0, x1, z1)
    const base = span.max + 0.05
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, W: x1 - x0, D: z1 - z0, base, foundation: base - span.min + 0.6 }
  }

  private rebuildBuildings() {
    const now = Date.now() + (this.opts.clockSkewMs?.() ?? 0)
    if (this.builtMesh) { this.scene.remove(this.builtMesh); this.builtMesh.geometry.dispose(); this.builtMesh = null }
    this.poses.clear()
    const merged = new ColorGeom()
    let any = false
    this.layout.buildings.forEach((b, i) => {
      if (b.type === 'road') return
      const pose = this.poseOf(b)
      const rot = b.rotated ? Math.PI / 2 : 0
      const Wm = b.rotated ? pose.D : pose.W
      const Dm = b.rotated ? pose.W : pose.D
      const finished = b.state === 'built' || b.state === 'damaged'
      const model = buildModel(b.type, Wm, Dm, b.visual_seed, pose.foundation)
      this.poses.set(b.id ?? `i${i}`, { ...pose, height: model.height, building: b })
      if (finished) {
        merged.append(model.geom, pose.cx, pose.base, pose.cz, rot)
        any = true
      }
    })
    if (any) {
      this.builtMesh = new Mesh(merged.toGeometry(), this.mats.list)
      this.builtMesh.name = 'village-buildings'
      this.scene.add(this.builtMesh)
    }
    this.scaffoldKey = ''
    this.updateScaffolds(now)
    void seededRng
  }

  /** Rebuilds the under-construction mesh when any progress bucket moved. */
  private updateScaffolds(nowMs: number): boolean {
    const parts: { id: string; pose: Pose & { height: number; building: LayoutBuilding }; p: number }[] = []
    for (const [id, pose] of this.poses) {
      const b = pose.building
      if (b.state === 'built' || b.state === 'damaged') continue
      parts.push({ id, pose, p: constructionProgress(b, nowMs) })
    }
    const key = parts.map((q) => `${q.id}:${Math.floor(q.p * 24)}`).join('|')
    if (key === this.scaffoldKey) return false
    this.scaffoldKey = key
    if (this.scaffoldMesh) { this.scene.remove(this.scaffoldMesh); this.scaffoldMesh.geometry.dispose(); this.scaffoldMesh = null }
    if (parts.length === 0) return true
    const merged = new ColorGeom()
    for (const { pose, p } of parts) {
      const b = pose.building
      const rot = b.rotated ? Math.PI / 2 : 0
      const Wm = b.rotated ? pose.D : pose.W
      const Dm = b.rotated ? pose.W : pose.D
      const sc = buildScaffold(b.type, Wm, Dm, b.visual_seed, pose.foundation, Math.floor(p * 24) / 24, pose.height)
      merged.append(sc.geom, pose.cx, pose.base, pose.cz, rot)
    }
    this.scaffoldMesh = new Mesh(merged.toGeometry(), this.mats.list)
    this.scaffoldMesh.name = 'village-scaffolds'
    this.scene.add(this.scaffoldMesh)
    return true
  }

  // -- build-mode overlay -----------------------------------------------------------

  setOverlayTones(tones: ArrayLike<number> | null) {
    if (tones) this.overlay.setTones(tones)
    this.overlay.setVisible(!!tones)
    this.request()
  }

  /** Outline (lots) round the chosen footprint; null clears. */
  setSelection(rect: { x: number; y: number; w: number; h: number; ok: boolean } | null) {
    this.overlay.setOutline(rect ? { ...rect, color: rect.ok ? 0xffe27a : 0xff6a5a } : null)
    this.request()
  }

  /** A translucent model of the building being placed, or none. */
  setGhost(g: Ghost | null) {
    const key = g ? `${g.type}|${g.x}|${g.y}|${g.w}|${g.h}|${g.rotated}|${g.ok}` : ''
    if (key === this.ghostKey) return
    this.ghostKey = key
    if (this.ghostMesh) { this.scene.remove(this.ghostMesh); this.ghostMesh.geometry.dispose(); (this.ghostMesh.material as Material[]).forEach((m) => m.dispose()); this.ghostMesh = null }
    if (g) {
      const fake: LayoutBuilding = { type: g.type, x: g.x, y: g.y, w: g.w, h: g.h, rotated: g.rotated, state: 'built', visual_seed: 5 }
      const pose = this.poseOf(fake)
      const Wm = g.rotated ? pose.D : pose.W
      const Dm = g.rotated ? pose.W : pose.D
      const model = buildModel(g.type, Wm, Dm, 5, pose.foundation)
      const acc = new ColorGeom()
      acc.append(model.geom, pose.cx, pose.base + 0.4, pose.cz, g.rotated ? Math.PI / 2 : 0)
      this.ghostMesh = new Mesh(acc.toGeometry(), this.mats.ghost(g.ok ? 0xb8ffc8 : 0xffb0a8))
      this.ghostMesh.renderOrder = 7
      this.scene.add(this.ghostMesh)
    }
    this.request()
  }

  setSelectedBuilding(id: string | null) {
    this.selectedId = id
    const pose = id ? this.poses.get(id) : null
    if (pose) {
      const b = pose.building
      this.overlay.setOutline({ x: b.x, y: b.y, w: b.w, h: b.h, color: 0xffd45a })
      this.overlay.setVisible(this.overlay.tint.visible)
    } else if (!id) this.overlay.setOutline(null)
    this.request()
  }

  // -- camera -------------------------------------------------------------------------

  /** Frames the whole village from above (`aerial`), tighter (`close`), or on one lot. */
  frame(mode: 'aerial' | 'close' | 'lot', lot?: { x: number; y: number }) {
    const g = this.ground
    const n = g.n
    const mid = g.lotCentre((n - 1) / 2, (n - 1) / 2)
    let tx = mid.x, tz = mid.z
    if (mode === 'lot' && lot) {
      const c = g.lotCentre(lot.x, lot.y)
      tx = c.x; tz = c.z
    }
    const ty = g.groundY(tx, tz) + 4
    this.center.set(mid.x, ty, mid.z)
    this.controls.target.set(tx, ty, tz)
    const aspect = this.camera.aspect || 0.5
    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const polar = mode === 'aerial' ? 0.95 : 1.05
    const span = mode === 'aerial' ? n * g.lot * 0.62 + 40 : mode === 'close' ? 62 : 46
    const dist = Math.max(this.controls.minDistance, span / Math.tan(Math.min(hFov, vFov) / 2) * 0.62)
    const az = -0.5
    this.camera.position.set(tx + dist * Math.sin(polar) * Math.sin(az), ty + dist * Math.cos(polar), tz + dist * Math.sin(polar) * Math.cos(az))
    this.controls.update()
    this.request()
  }

  /** For tests and screenshots: place the camera exactly. */
  setCamera(pos: [number, number, number], target: [number, number, number], fov?: number) {
    if (fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix() }
    this.camera.position.set(...pos)
    this.controls.target.set(...target)
    this.controls.update()
    this.request()
  }

  // -- input ----------------------------------------------------------------------------

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() } }
  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.down = null
    if (!d || !this.opts.onTap) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9 || performance.now() - d.t > 500) return
    const p = this.pickGround(e.clientX, e.clientY)
    const lot = p ? this.ground.lotAt(p.x, p.z) : null
    let id: string | null = null
    if (lot) {
      for (const [key, pose] of this.poses) {
        const b = pose.building
        if (lot.x >= b.x && lot.x < b.x + b.w && lot.y >= b.y && lot.y < b.y + b.h) { id = b.id ?? key; break }
      }
    }
    this.opts.onTap(lot, id)
  }

  /** Where a screen point meets the ground: the ray is walked until it dips under the mesh. */
  pickGround(clientX: number, clientY: number): Vector3 | null {
    const r = this.canvas.getBoundingClientRect()
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction
    const groundY = this.ground.groundY
    let prev = 0
    const maxT = 4000
    for (let t = 1; t < maxT; t += Math.max(2, t * 0.02)) {
      const y = o.y + d.y * t
      if (y <= groundY(o.x + d.x * t, o.z + d.z * t)) {
        let lo = prev, hi = t
        for (let i = 0; i < 18; i++) {
          const mid = (lo + hi) / 2
          if (o.y + d.y * mid <= groundY(o.x + d.x * mid, o.z + d.z * mid)) hi = mid
          else lo = mid
        }
        return new Vector3(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi)
      }
      prev = t
    }
    return null
  }

  // -- loop ----------------------------------------------------------------------------------

  private onChange = () => {
    this.lastMoved = performance.now()
    // keep the target near the village and the camera above the ground
    const t = this.controls.target
    const half = this.ground.n * this.ground.lot * 0.9 + 60
    const dx = t.x - this.center.x, dz = t.z - this.center.z
    const dd = Math.hypot(dx, dz)
    if (dd > half) { t.x = this.center.x + (dx / dd) * half; t.z = this.center.z + (dz / dd) * half }
    t.y = this.ground.groundY(t.x, t.z) + 4
    const cp = this.camera.position
    const floor = this.ground.groundY(cp.x, cp.z) + 3
    if (cp.y < floor) cp.y = floor
    this.trees?.update(cp)
    this.grass?.update(cp)
    this.request()
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.request()
  }

  setActive(a: boolean) {
    this.active = a
    if (a) this.request()
  }

  request() {
    if (this.raf || this.disposed || !this.active || this.contextLost) return
    this.raf = requestAnimationFrame(this.render)
  }

  private render = () => {
    this.raf = 0
    if (this.disposed || this.contextLost) return
    this.controls.update()
    this.sky.mesh.position.copy(this.camera.position)
    this.renderer.render(this.scene, this.camera)
    this.emitLabels()
  }

  private startTimers() {
    this.waterTimer = window.setInterval(() => {
      if (this.disposed || this.contextLost || !this.active) return
      const now = Date.now() + (this.opts.clockSkewMs?.() ?? 0)
      let dirty = this.updateScaffolds(now)
      if (this.water?.mesh && !this.reduced && performance.now() - this.lastMoved < 4000) {
        this.waterClock += WATER_TICK_MS / 1000
        this.water.tick(this.waterClock)
        this.water.setCamera(this.camera.position)
        this.sky.material.uniforms.uTime.value = this.waterClock
        dirty = true
      }
      if (dirty) this.request()
    }, WATER_TICK_MS)
    this.labelTimer = window.setInterval(() => this.emitLabels(true), 1000)
  }

  private emitLabels(force = false) {
    if (!this.opts.onLabels) return
    const r = this.canvas.getBoundingClientRect()
    const out: ScreenLabel[] = []
    const v = new Vector3()
    for (const [key, p] of this.poses) {
      v.set(p.cx, p.base + p.height + 2, p.cz).project(this.camera)
      out.push({ key, x: Math.round(((v.x + 1) / 2) * r.width), y: Math.round(((1 - v.y) / 2) * r.height), visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 })
    }
    const json = JSON.stringify(out)
    if (!force && json === this.lastLabelJson) return
    this.lastLabelJson = json
    this.opts.onLabels(out)
  }

  private onLost = (e: Event) => { e.preventDefault(); this.contextLost = true; cancelAnimationFrame(this.raf); this.raf = 0 }
  private onRestored = () => { this.contextLost = false; this.request() }
  private onVisibility = () => { if (document.hidden) { this.active = false; cancelAnimationFrame(this.raf); this.raf = 0 } else { this.active = true; this.request() } }

  // -- diagnostics ------------------------------------------------------------------------------

  stats() {
    const i = this.renderer.info
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, trees: this.trees?.stats() ?? null }
  }

  /** Casts rays straight down through every building's footprint and reports
   * any that float (the platform's underside stays above the ground) or sink
   * (the ground rises above the floor) against the *rendered* meshes. */
  verifyGrounding(): { checked: number; problems: string[] } {
    const rc = new Raycaster()
    rc.ray.direction.set(0, -1, 0)
    const targets = this.terrain.objects.filter((o) => o.name === 'terrain-fine')
    const problems: string[] = []
    let checked = 0
    for (const [id, p] of this.poses) {
      const hw = p.W / 2, hd = p.D / 2
      let lo = Infinity, hi = -Infinity
      for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        rc.ray.origin.set(p.cx + a * hw, 4000, p.cz + b * hd)
        const hit = rc.intersectObjects(targets, false)[0]
        if (!hit) { problems.push(`${id}: no terrain under a corner`); continue }
        lo = Math.min(lo, hit.point.y)
        hi = Math.max(hi, hit.point.y)
      }
      checked++
      // the platform's top is base + 0.2; it must sit at or above the highest
      // ground and its sunk foundation must reach below the lowest
      if (hi - p.base > 0.02) problems.push(`${id} (${p.building.type}) sinks: ground ${hi.toFixed(2)} above base ${p.base.toFixed(2)}`)
      if (p.base - p.foundation > lo + 0.02) problems.push(`${id} (${p.building.type}) floats: foundation bottom ${(p.base - p.foundation).toFixed(2)} over ground ${lo.toFixed(2)}`)
    }
    return { checked, problems }
  }

  debug() {
    return { scene: this.scene, camera: this.camera, controls: this.controls, renderer: this.renderer }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    clearInterval(this.waterTimer)
    clearInterval(this.labelTimer)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.controls.removeEventListener('change', this.onChange)
    this.controls.dispose()
    this.terrain?.dispose()
    this.water?.dispose()
    this.coarseWater?.dispose()
    this.grass?.dispose()
    this.boulders?.dispose()
    this.trees?.dispose()
    this.roads?.dispose()
    this.overlay.dispose()
    this.builtMesh?.geometry.dispose()
    this.scaffoldMesh?.geometry.dispose()
    this.ghostMesh?.geometry.dispose()
    this.sky.dispose()
    this.mats.dispose()
    this.renderer.dispose()
  }
}
