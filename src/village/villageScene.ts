// The village's three.js scene. Terrain, water, grass and boulders are the
// src/demo builders fed with the live world (terrainModel.ts); on top of them
// sit this file's own roads, trees, buildings (finished ones merged into one
// mesh, those under construction as scaffolding whose height follows the
// clock), the build-mode overlay and a touch camera (one finger orbits, two
// pinch and pan). Rendering is on demand: a frame is drawn when the camera
// moved, the layout changed or the water is animating.

import {
  ACESFilmicToneMapping, AmbientLight, PCFShadowMap, Color, DirectionalLight, Fog, HemisphereLight, Material, Mesh, PerspectiveCamera,
  Raycaster, Scene, SRGBColorSpace, TOUCH, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LayoutBuilding, VillageLayout, WorldInfo } from '../api/types'
import { buildTerrain, buildBoulders, type TerrainResult, type FieldResult } from '../demo/terrain'
import { buildWater, buildCoarseWaterPatch, type WaterResult, type CoarseWaterResult } from '../demo/water'
import { BufferAttribute, ShaderMaterial, type Mesh as ThreeMesh } from 'three'
import { bakeControl, createGroundMaterial, loadPhotoSet, makeMacroNoise, makeWaterNormals, type GroundMaterial } from './groundMaterial'
import { biomeTints, buildFineGroundMesh } from './groundMesh'
import { buildFields, type Fields } from './groundFields'
import { GrassTufts } from './grassTufts'
import { createWaterMaterial } from './waterMaterial'
import { buildLakeWater, type LakeWaterMesh } from './lakeWater'
import type { VillageGround } from './terrainModel'
import { buildModel, buildScaffold } from './buildingModels'
import { ColorGeom } from './colorGeom'
import { makeBuildingMaterials, type BuildingMaterials } from './buildingMaterials'
import { buildVillageRoads, type RoadsMesh } from './villageRoads'
import { LotOverlay } from './lotOverlay'
import { LandOverlay, type OuterCell } from './landOverlay'
import { TreeField, type TreeSpot } from './vegetation'
import { createSky, type Sky } from './sky'
import { constructionProgress } from './progress'
import { seededRng } from './colorGeom'

const SKY_TOP = 0x5f97d4
const SKY_HORIZON = 0xe9f3f7
const FOG_NEAR = 1400
const FOG_FAR = 7000
const SUN = new Vector3(-0.5, 0.7, 0.45).normalize()
const MARGIN = 1.2 // metres left between two neighbouring buildings
const WATER_TICK_MS = 1000 / 30
function valueNoise(x: number, y: number): number {
  const h = (i: number, j: number) => { const t = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return t - Math.floor(t) }
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v
}
const smoothstep = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }

/** `s`: how big a lot looks right now, relative to a comfortable reading size (1 = full size), so the overlays shrink
 * with the buildings when the camera pulls back instead of growing over them. */
export interface ScreenLabel { key: string; x: number; y: number; visible: boolean; s: number }

export interface Ghost { type: string; w: number; h: number; x: number; y: number; rotated: boolean; ok: boolean }

export interface SceneOptions {
  onTap?: (hit: { x: number; y: number } | null, buildingId: string | null) => void
  onLabels?: (labels: ScreenLabel[]) => void
  /** Milliseconds to add to Date.now() to get the server's clock. */
  clockSkewMs?: () => number
  /** A tap on the ground, wherever it lands: the lot under it may lie beyond the first grid (negative
   * coordinates west and south of it), where `onTap` gets null. Fired before `onTap`. */
  onGround?: (lot: { x: number; y: number }) => void
}

type Pose = { cx: number; cz: number; W: number; D: number; base: number; foundation: number }

export class VillageScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private controls: OrbitControls
  private sky: Sky
  private terrain!: TerrainResult
  private water: WaterResult | null = null
  private coarseWater: CoarseWaterResult | null = null
  private lakes: LakeWaterMesh | null = null
  private grass: GrassTufts | null = null
  private groundMats: GroundMaterial[] = []
  private ctlMat!: GroundMaterial
  private macro: import('three').DataTexture | null = null
  private waterMat: ShaderMaterial | null = null
  private fields!: Fields
  private waterNormals: import('three').DataTexture | null = null
  private grassTime = 0
  private boulders: FieldResult | null = null
  private trees: TreeField | null = null
  private treeList: TreeSpot[] = []
  private roads: RoadsMesh | null = null
  private mats: BuildingMaterials
  private overlay: LotOverlay
  private land: LandOverlay
  /** How far the roads' land reaches from the village centre, in metres (the camera may go there). */
  private reachM = 0
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
  private insets = { top: 0, bottom: 0 }
  private userMoved = false
  private lastMode: 'aerial' | 'close' | 'lot' = 'aerial'
  /** The width, in lots, the last aerial framing was asked to hold (the road tool shows a wide stretch of land). */
  private lastSpan = 0
  private sun!: DirectionalLight
  private shadowsOn = true

  private constructor(private canvas: HTMLCanvasElement, readonly ground: VillageGround, private world: WorldInfo, layout: VillageLayout, private opts: SceneOptions) {
    this.layout = layout
    this.reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({ canvas, antialias: dpr < 1.75, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.4
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
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
    this.controls.addEventListener('start', () => { this.userMoved = true })

    this.sky = createSky(SUN, SKY_HORIZON, SKY_TOP)
    this.scene.add(this.sky.mesh)
    const sun = this.sun = new DirectionalLight(0xfff3dc, 2.6)
    sun.castShadow = true
    const res = Math.min(2048, Math.max(1024, 1024 * Math.round(dpr)))
    sun.shadow.mapSize.set(res, res)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.4
    this.scene.add(sun, sun.target, new HemisphereLight(SKY_TOP, 0xd6cdb0, 0.95), new AmbientLight(0xffffff, 0.18))
    this.scene.fog = new Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR)

    this.mats = makeBuildingMaterials()
    this.overlay = new LotOverlay(ground)
    this.scene.add(...this.overlay.objects)
    this.land = new LandOverlay(ground)
    this.scene.add(...this.land.objects)
    this.measureReach()

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
    this.fields = buildFields(this.ground, grids.doc.biomeLegend)
    stage('terrain', () => {
      // the demo's coarse backdrop only, with a hole exactly the size of the fine window: the
      // subdivided fine mesh below fills it and meets it vertex to vertex (no skirt, no gap)
      const t = buildTerrain(grids, { hole: this.holeTiles(), coarseOnly: true })
      this.terrain = t
      const tint = biomeTints(this.ground, grids.doc.biomeLegend)
      this.macro = makeMacroNoise(128)
      const ctl = bakeControl(this.controlInput(), 256)
      this.ctlMat = createGroundMaterial({ ctl: ctl.tex, org: ctl.org, size: ctl.size, macro: this.macro, vertexColors: true })
      const coarseMat = createGroundMaterial({ ctl: ctl.tex, org: ctl.org, size: ctl.size, macro: this.macro, vertexColors: true })
      this.groundMats = [this.ctlMat, coarseMat]
      const fineMesh = buildFineGroundMesh(this.ground, this.ctlMat.mat, tint)
      fineMesh.receiveShadow = true
      const coarse = t.objects.find((o) => o.name === 'terrain-coarse') as ThreeMesh
      const col = coarse.geometry.getAttribute('color') as BufferAttribute
      for (let i = 0; i < col.count; i++) col.setXYZ(i, Math.min(1.7, col.getX(i) / tint.ref.r), Math.min(1.7, col.getY(i) / tint.ref.g), Math.min(1.7, col.getZ(i) / tint.ref.b))
      coarse.material = coarseMat.mat
      this.terrainFine = fineMesh
      this.scene.add(fineMesh, ...t.objects)
    })
    stage('water', () => {
      this.water = buildWater(grids, { skipLakes: true, thinStreams: true })
      this.waterNormals = makeWaterNormals(128)
      this.waterMat = createWaterMaterial({ normals: this.waterNormals, sunDir: SUN, horizon: SKY_HORIZON, top: SKY_TOP })
      if (this.water.mesh) {
        this.water.mesh.material = this.waterMat
        this.water.mesh.renderOrder = 2
        this.scene.add(this.water.mesh)
      }
      this.lakes = buildLakeWater(this.ground, this.waterMat)
      if (this.lakes.mesh) this.scene.add(this.lakes.mesh)
      this.coarseWater = buildCoarseWaterPatch(grids, { hole: this.holeTiles() })
      if (this.coarseWater.mesh) this.scene.add(this.coarseWater.mesh)
    })
    stage('roads', () => this.rebuildRoads())
    stage('grass', () => {
      this.grass = new GrassTufts({
        groundY: this.ground.groundY,
        blocked: (x, z) => this.blockedForGrowth(x, z),
        forest: (x, z) => this.fields.at(this.fields.forest, x, z),
      })
      this.scene.add(...this.grass.objects)
    })
    stage('boulders', () => {
      this.boulders = buildBoulders(grids)
      this.scene.add(...this.boulders.objects)
    })
    stage('trees', () => {
      this.treeList = this.treeSpots()
      this.trees = new TreeField(this.treeList)
      for (const o of this.trees.objects) { o.castShadow = true; o.receiveShadow = true }
      this.scene.add(...this.trees.objects)
    })
    this.rebuildBuildings()
    this.frame('aerial')
    this.trees?.update(this.camera.position, true)
    this.grass?.update(this.camera.position, 0)
    this.startTimers()
    this.request()
    // real photo textures for the ground, after the first frame
    const base = `${import.meta.env.BASE_URL}world-city/textures/`
    void loadPhotoSet(this.renderer, base, [
      ['grass', 'grass_lawn_diff.webp'], ['leafy', 'leafy_grass_diff.webp'], ['dirt', 'dirt_floor_diff.webp'],
      ['rock', 'river_small_rocks_diff.webp'], ['gravel', 'gravel_floor_02_diff.webp'], ['grassN', 'grass_lawn_nor_gl_256.webp', false],
    ]).then((set) => {
      if (this.disposed) return
      for (const m of this.groundMats) m.apply(set)
      this.request()
    })
  }

  private terrainFine: ThreeMesh | null = null

  /** The coarse cells the fine window covers: its edges lie on coarse vertex lines. */
  private holeTiles() {
    const d = this.ground.grids.doc
    return { i0: d.fineGrid.originTileX, j0: d.fineGrid.originTileY, n: (d.fineGrid.w - 1) / d.lotsPerTile }
  }

  /** True where nothing should grow: water and its banks, roads, building pads. */
  private blockedForGrowth(x: number, z: number): boolean {
    if (this.fields.at(this.fields.wet, x, z) > 0.25) return true
    const lv = this.ground.lakeLevelAt(x, z)
    if (lv !== null && this.ground.groundY(x, z) < lv + 0.7) return true
    for (const r of this.padRects) if (x > r.x0 - 2 && x < r.x1 + 2 && z > r.z0 - 2 && z < r.z1 + 2) return true
    for (const s of this.roadSegs) {
      const dx = s.bx - s.ax, dz = s.bz - s.az
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)))
      if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) < s.half + 1.5) return true
    }
    return false
  }

  private padRects: { x0: number; z0: number; x1: number; z1: number }[] = []
  private roadSegs: { ax: number; az: number; bx: number; bz: number; half: number }[] = []

  /** What the control map paints: recomputed when the layout changes. */
  private controlInput() {
    const g = this.ground
    this.padRects = []
    for (const b of this.layout.buildings) {
      if (b.type === 'road') continue
      const p = this.poseOf(b)
      this.padRects.push({ x0: p.cx - p.W / 2, z0: p.cz - p.D / 2, x1: p.cx + p.W / 2, z1: p.cz + p.D / 2 })
    }
    this.roadSegs = []
    const roads = this.roadLots()
    const has = new Set(roads.map((r) => `${r.x},${r.y}`))
    for (const r of roads) {
      const c = g.lotCentre(r.x, r.y)
      let arms = 0
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        if (has.has(`${r.x + dx},${r.y + dy}`)) {
          const o = g.lotCentre(r.x + dx, r.y + dy)
          this.roadSegs.push({ ax: c.x, az: c.z, bx: o.x, bz: o.z, half: 4.2 })
          arms++
        }
      }
      if (arms === 0) this.roadSegs.push({ ax: c.x - g.lot / 2, az: c.z, bx: c.x + g.lot / 2, bz: c.z, half: 4.2 })
    }
    const { sub, lot } = g
    const size = (sub.N - 1) * sub.stepX
    const f = this.fields
    return {
      x0: sub.x0, z0: sub.z0, size,
      // wet ground: river banks by their lot-wide field; lake shores by how far the ground stands above the
      // lake's own level, so the mud is a bank of some metres, not a lot-sized smear
      wet: (x: number, z: number) => {
        const lv = g.lakeLevelAt(x, z)
        if (lv !== null) return 1 - smoothstep(0.05, 1.5, g.groundY(x, z) - lv)
        return Math.min(1, f.at(f.wetRiver, x, z))
      },
      forest: (x: number, z: number) => Math.min(1, f.at(f.forest, x, z)) * (0.15 + 0.85 * smoothstep(lot * 0.6, lot * 4, f.blockDist(x, z))),
      lawn: (x: number, z: number) => 1 - smoothstep(lot * 0.3, lot * 2.6, f.blockDist(x, z)),
      verges: this.roadSegs,
      pads: this.padRects,
    }
  }

  private rebakeControl() {
    if (!this.ctlMat) return
    const ctl = bakeControl(this.controlInput(), 256)
    for (const m of this.groundMats) {
      ;(m.U.uCtl.value as import('three').Texture | null)?.dispose()
      m.U.uCtl.value = ctl.tex
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
        const cs = grids.fineScene(fx, fy)
        // forests come in stands: a slow noise thickens some places and thins others
        const nz = valueNoise(fx * 0.12 + 3.1, fy * 0.12 + 7.7) * 0.7 + valueNoise(fx * 0.31, fy * 0.31 + 1.3) * 0.3
        p *= 0.12 + 2.1 * smoothstep(0.42, 0.68, nz)
        // and gather along water
        const wetHere = this.fields.wet[fy * w + fx]
        if (wetHere > 0.02 && wetHere < 0.9 && !/desert|ice|tundra/.test(code)) p = Math.max(p, 0.55 * (1 - Math.abs(wetHere - 0.35)))
        void cs
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
          const lv = this.ground.lakeLevelAt(c.x, c.z)
          if (lv !== null && groundY(c.x, c.z) < lv + 0.9) continue
          spots.push({ x: c.x, z: c.z, y: groundY(c.x, c.z), s: 0.8 + r() * 0.8, rot: r() * Math.PI * 2, species: /boreal|taiga/.test(code) || r() < 0.22 ? 1 : 0 })
        }
      }
    }
    void lot
    return spots.slice(0, 4200)
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
    this.measureReach()
    this.rebuildRoads()
    this.rebuildBuildings()
    this.rebakeControl()
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
      this.builtMesh.castShadow = this.builtMesh.receiveShadow = true
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
    this.scaffoldMesh.castShadow = this.scaffoldMesh.receiveShadow = true
    this.scene.add(this.scaffoldMesh)
    return true
  }

  // -- build-mode overlay -----------------------------------------------------------

  setOverlayTones(tones: ArrayLike<number> | null) {
    if (tones) this.overlay.setTones(tones)
    this.overlay.setVisible(!!tones)
    this.request()
  }

  // -- the land beyond the first grid (ADR 0044 5.5) --------------------------------------

  /** Tinted lots beyond the first grid (absolute lot coordinates); an empty list or null clears. */
  setLandCells(cells: readonly OuterCell[] | null) {
    this.land.setCells(cells ?? [])
    this.land.setVisible(!!cells && cells.length > 0)
    this.request()
  }

  /** The road being drawn, as a ribbon through the lots; null clears. */
  setRoadRibbon(path: readonly { x: number; y: number }[] | null) {
    this.land.setRibbon(path)
    this.request()
  }

  /** The roads' land reaches this far from the centre: the camera may follow, up to the world. */
  private measureReach() {
    const g = this.ground
    const mid = g.lotCentre((g.n - 1) / 2, (g.n - 1) / 2)
    let far = 0
    const see = (x: number, y: number) => {
      const c = g.lotCentre(x, y)
      const d = Math.hypot(c.x - mid.x, c.z - mid.z)
      if (d > far) far = d
    }
    const land = this.layout?.land
    if (land) {
      for (const c of land.cells) see(c.x, c.y)
      for (const o of land.open) see(o.x, o.y)
    }
    for (const r of this.layout?.roads ?? []) see(r.x, r.y)
    this.reachM = far
    this.controls.maxDistance = Math.min(6000, Math.max(1400, far * 1.5 + 900))
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

  /** How much of the canvas the overlay covers at its top and bottom (CSS
   * px): the camera's principal point moves so the village is centred in
   * what is left, and the framing counts only that part. */
  setInsets(top: number, bottom: number) {
    if (this.insets.top === top && this.insets.bottom === bottom) return
    this.insets = { top, bottom }
    this.applyViewOffset()
    // a camera the player has not touched keeps the village fitted to what is left
    if (!this.userMoved && this.lastMode !== 'lot') this.frame(this.lastMode)
    this.request()
  }

  private applyViewOffset() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    const dy = (this.insets.top - this.insets.bottom) / 2
    if (Math.abs(dy) < 1) this.camera.clearViewOffset()
    else this.camera.setViewOffset(w, h, 0, -dy, w, h)
  }

  /** Frames the whole village from above (`aerial`), tighter (`close`), or on one lot. */
  frame(mode: 'aerial' | 'close' | 'lot', lot?: { x: number; y: number }, spanLots = this.lastSpan) {
    this.userMoved = false
    this.lastMode = mode
    this.lastSpan = mode === 'aerial' ? spanLots : 0
    const g = this.ground
    const n = g.n
    const mid = g.lotCentre((n - 1) / 2, (n - 1) / 2)
    let tx = mid.x, tz = mid.z
    if (mode === 'lot' && lot) {
      const c = g.lotCentre(lot.x, lot.y)
      tx = c.x; tz = c.z
    }
    const ty = Math.max(g.groundY(tx, tz), g.lakeLevelAt(tx, tz) ?? -Infinity) + 4
    this.center.set(mid.x, ty, mid.z)
    this.controls.target.set(tx, ty, tz)
    const aspect = this.camera.aspect || 0.5
    const H = this.canvas.clientHeight || 1
    const free = Math.max(0.35, (H - this.insets.top - this.insets.bottom) / H)
    // the lens as far as the free part of the canvas is concerned
    const vFov = 2 * Math.atan(Math.tan(((this.camera.fov * Math.PI) / 180) / 2) * free)
    const hFov = 2 * Math.atan(Math.tan(((this.camera.fov * Math.PI) / 180) / 2) * aspect)
    const polar = mode === 'aerial' ? 0.95 : 1.1
    const span = mode === 'aerial' ? Math.max(Math.max(n + 2, 7) * g.lot, this.reachM * 2 + 8 * g.lot, spanLots * g.lot) : mode === 'close' ? 70 : 50
    const dist = Math.max(this.controls.minDistance, (span / 2 / Math.tan(Math.min(hFov, vFov) / 2)) * (mode === 'aerial' ? 1.12 : 1))
    const az = -0.5
    this.camera.position.set(tx + dist * Math.sin(polar) * Math.sin(az), ty + dist * Math.cos(polar), tz + dist * Math.sin(polar) * Math.cos(az))
    this.controls.update()
    this.request()
  }

  /** Where lot (x, y)'s middle is on the page, in CSS px (for tests and hints). */
  screenOfLot(x: number, y: number): { x: number; y: number } {
    const c = this.ground.lotCentre(x, y)
    const v = new Vector3(c.x, this.ground.groundY(c.x, c.z), c.z).project(this.camera)
    const r = this.canvas.getBoundingClientRect()
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
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
    if (p) this.opts.onGround?.(this.ground.lotAtAny(p.x, p.z))
    const lot = p ? this.ground.lotAt(p.x, p.z) : null
    // a building stands wherever its lot is, also on land beyond the first grid (lotAt is null there): look it up by the lot at any place
    const any = p ? this.ground.lotAtAny(p.x, p.z) : null
    let id: string | null = null
    if (any) {
      for (const [key, pose] of this.poses) {
        const b = pose.building
        if (any.x >= b.x && any.x < b.x + b.w && any.y >= b.y && any.y < b.y + b.h) { id = b.id ?? key; break }
      }
    }
    if (new URLSearchParams(location.search).has('dbg')) console.log('DBG tap', JSON.stringify(lot), id)
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
    const maxT = 12000
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
    const half = Math.max(this.ground.n * this.ground.lot * 0.9 + 60, this.reachM + 160)
    const dx = t.x - this.center.x, dz = t.z - this.center.z
    const dd = Math.hypot(dx, dz)
    if (dd > half) { t.x = this.center.x + (dx / dd) * half; t.z = this.center.z + (dz / dd) * half }
    t.y = this.ground.groundY(t.x, t.z) + 4
    const cp = this.camera.position
    const floor = this.ground.groundY(cp.x, cp.z) + 3
    if (cp.y < floor) cp.y = floor
    this.trees?.update(cp)
    this.grass?.update(cp, this.waterClock)
    this.request()
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // a portrait phone sees a thin slice sideways: open the lens up
    this.camera.fov = w < h ? 58 : 46
    this.camera.updateProjectionMatrix()
    this.applyViewOffset()
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
    this.fitShadow()
    this.renderer.render(this.scene, this.camera)
    this.watchFrameTime()
    this.emitLabels()
  }

  /** The sun's shadow box follows what the camera looks at, snapped to
   * shadow texels so it does not shimmer as the camera moves. */
  private fitShadow() {
    if (!this.shadowsOn) return
    const d = this.camera.position.distanceTo(this.controls.target)
    const ext = Math.max(90, Math.min(320, d * 0.75))
    const c = this.sun.shadow.camera
    if (Math.abs(c.right - ext) > 1) {
      c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 10; c.far = ext * 8
      c.updateProjectionMatrix()
    }
    const step = (ext * 2) / this.sun.shadow.mapSize.x
    const t = this.controls.target
    const tx = Math.round(t.x / step) * step, tz = Math.round(t.z / step) * step
    this.sun.target.position.set(tx, t.y, tz)
    this.sun.position.set(tx + SUN.x * ext * 3, t.y + SUN.y * ext * 3, tz + SUN.z * ext * 3)
    this.sun.target.updateMatrixWorld()
  }

  private slowFrames = 0
  private lastFrameAt = 0
  /** A device that cannot hold ~20 fps while the camera moves loses the
   * shadows first (the priciest thing here), then render resolution. */
  private watchFrameTime() {
    const now = performance.now()
    const dt = now - this.lastFrameAt
    this.lastFrameAt = now
    if (dt > 400 || navigator.webdriver) return // idle gap, or an automated run
    this.slowFrames = dt > 55 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1)
    if (this.slowFrames > 30 && this.shadowsOn) {
      this.shadowsOn = false
      this.sun.castShadow = false
      this.renderer.shadowMap.enabled = false
      this.scene.traverse((o) => { const m = (o as Mesh).material as Material | Material[] | undefined; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true })
      this.slowFrames = 0
    } else if (this.slowFrames > 40) {
      const pr = Math.max(0.75, this.renderer.getPixelRatio() * 0.8)
      this.renderer.setPixelRatio(pr)
      this.resize()
      this.slowFrames = 0
    }
  }

  private startTimers() {
    this.waterTimer = window.setInterval(() => {
      if (this.disposed || this.contextLost || !this.active) return
      const now = Date.now() + (this.opts.clockSkewMs?.() ?? 0)
      let dirty = this.updateScaffolds(now)
      if (this.waterMat && !this.reduced && performance.now() - this.lastMoved < 4000) {
        this.waterClock += WATER_TICK_MS / 1000
        this.waterMat.uniforms.uTime.value = this.waterClock
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
    const v = new Vector3(), w = new Vector3()
    // a lot spanning LOT_FULL css px or more gets full-size overlays; smaller lots scale them down (two decimals,
    // so the label json only changes when the size really does)
    const LOT_FULL = 56, lot = this.ground.lot
    for (const [key, p] of this.poses) {
      v.set(p.cx, p.base + p.height + 2, p.cz).project(this.camera)
      w.set(p.cx + lot, p.base, p.cz).project(this.camera)
      const span = Math.hypot((w.x - v.x) * r.width, (w.y - v.y) * r.height) / 2
      const s = Math.round(Math.min(1, span / LOT_FULL) * 20) / 20
      out.push({ key, x: Math.round(((v.x + 1) / 2) * r.width), y: Math.round(((1 - v.y) / 2) * r.height), visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1, s })
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
    const targets = this.terrainFine ? [this.terrainFine] : []
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
      // the platform's top is base + 0.16; it must sit at or above the highest
      // ground and its sunk foundation must reach below the lowest
      if (hi - p.base > 0.02) problems.push(`${id} (${p.building.type}) sinks: ground ${hi.toFixed(2)} above base ${p.base.toFixed(2)}`)
      if (p.base - p.foundation > lo + 0.02) problems.push(`${id} (${p.building.type}) floats: foundation bottom ${(p.base - p.foundation).toFixed(2)} over ground ${lo.toFixed(2)}`)
    }
    // everything else stands on groundY: it must be the height of the rendered mesh's
    // own vertex buffer (read triangle by triangle, which is what a ray would hit)
    const hitY = (x: number, z: number) => this.meshHeightAt(x, z)
    const spots = this.treeList.filter((_, i) => i % 3 === 0)
    let treeBad = 0
    for (const t of spots) {
      const y = hitY(t.x, t.z)
      if (!(Math.abs(t.y - y) < 0.06)) treeBad++
    }
    checked += spots.length
    if (treeBad) problems.push(`${treeBad} of ${spots.length} trees are off the ground`)
    const rocks = this.boulders?.objects[0] as import('three').InstancedMesh | undefined
    if (rocks) {
      const m = new (rocks.matrixWorld.constructor as new () => import('three').Matrix4)()
      const p = new Vector3()
      let bad = 0
      const n = Math.min(rocks.count, 300)
      for (let i = 0; i < n; i++) {
        rocks.getMatrixAt(i, m)
        p.setFromMatrixPosition(m)
        const d = p.y - hitY(p.x, p.z)
        if (!(d > -0.2 && d < 1.6)) bad++
      }
      checked += n
      if (bad) problems.push(`${bad} of ${n} boulders are off the ground`)
    }
    const road = this.roads?.mesh
    if (road) {
      const pos = road.geometry.attributes.position
      let bad = 0
      for (let i = 0; i < pos.count; i += 7) {
        const y = hitY(pos.getX(i), pos.getZ(i))
        const d = pos.getY(i) - y
        if (!(d > 0.02 && d < 0.5)) bad++
      }
      checked += Math.ceil(pos.count / 7)
      if (bad) problems.push(`${bad} road vertices sink into or hover over the ground`)
    }
    return { checked, problems }
  }

  /** Height of the drawn ground mesh at x/z, from its vertex buffer. */
  private meshHeightAt(x: number, z: number): number {
    const { N, x0, z0, stepX, stepZ } = this.ground.sub
    const pos = this.terrainFine!.geometry.attributes.position
    const fx = (x - x0) / stepX, fz = (z - z0) / stepZ
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), j = Math.max(0, Math.min(N - 2, Math.floor(fz)))
    const u = fx - i, v = fz - j
    const y = (ii: number, jj: number) => pos.getY(jj * N + ii)
    const a = y(i, j), b = y(i + 1, j), c = y(i, j + 1), d = y(i + 1, j + 1)
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (b - d) * (1 - v) + (c - d) * (1 - u)
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
    this.terrainFine?.geometry.dispose()
    for (const m of this.groundMats) { (m.U.uCtl.value as import('three').Texture | null)?.dispose(); m.mat.dispose() }
    this.macro?.dispose()
    this.waterNormals?.dispose()
    this.waterMat?.dispose()
    this.water?.dispose()
    this.coarseWater?.dispose()
    this.lakes?.dispose()
    this.grass?.dispose()
    this.boulders?.dispose()
    this.trees?.dispose()
    this.roads?.dispose()
    this.overlay.dispose()
    this.land.dispose()
    this.builtMesh?.geometry.dispose()
    this.scaffoldMesh?.geometry.dispose()
    this.ghostMesh?.geometry.dispose()
    this.sky.dispose()
    this.mats.dispose()
    this.renderer.dispose()
  }
}
