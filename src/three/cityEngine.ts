import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  OrthographicCamera,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CityMap, CityPlot, ModelLibrary } from '../api/types'
import { cloneMesh, loadModelLibrary, starterGeometry, cloneStarter } from './assetCache'
import { buildKind, classifyStrict, classifyGeneric, hashSeed, type BuildKind } from './builders'
import { report } from '../lib/reporter'

const HOUSES = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage']

export interface LabelPoint {
  id: string
  text: string
  x: number
  y: number
  visible: boolean
}

export interface BubbleAnchor {
  id: string
  x: number
  y: number
  z: number
}

export interface BubbleScreenPoint {
  id: string
  x: number
  y: number
  visible: boolean
}

export interface CityEngineOptions {
  onPlotTap: (plot: CityPlot) => void
  onLabels: (labels: LabelPoint[]) => void
  onBubbles?: (points: BubbleScreenPoint[]) => void
}

const MIN_FRUSTUM = 4
const MAX_FRUSTUM = 26
const DEV = import.meta.env.DEV

type LibraryEntry = { parts: import('../api/types').ModelPart[] }

export class CityEngine {
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: OrthographicCamera
  private target = new Vector3(0, 0, 0)
  private frustum = 10
  private bounds = { minX: -4, maxX: 20, minZ: -4, maxZ: 20 }
  private opts: CityEngineOptions
  private plots: CityPlot[] = []
  private placeLabels: { plot: CityPlot; world: Vector3 }[] = []
  private bubbleAnchors: BubbleAnchor[] = []
  private disposed = false
  private startedAt = performance.now()
  private loggedFirstFrame = false

  // render-on-demand: nothing redraws unless something actually changed
  // (a pan/zoom, a resize, new data, the odd drifting cloud) — a static
  // city costs zero renderer.render() calls a second, which is most of an
  // idle player's time and the biggest single battery saving available.
  private raf = 0
  private active = true
  private contextLost = false
  private cloudMesh: InstancedMesh | null = null
  private cloudSpecs: [number, number, number][] = []
  private lastCloudTick = 0

  // pan/zoom pointer state
  private pointers = new Map<number, { x: number; y: number }>()
  private lastPan: { x: number; y: number } | null = null
  private velocity = { x: 0, z: 0 }
  private pinchStartDist = 0
  private pinchStartFrustum = 14
  private downInfo: { x: number; y: number; t: number } | null = null

  constructor(canvas: HTMLCanvasElement, opts: CityEngineOptions) {
    this.canvas = canvas
    this.opts = opts
    // capped well under "native" retina (2-3x on a modern iPhone): halves
    // or thirds the fragment-shading cost for a look that reads the same
    // on a phone screen, per the task's 1.5-2 guidance.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: dpr < 1.75,
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x000000, 0)
    // free, one-time colour grading (no extra draw calls): a filmic tone
    // curve so the dusk lighting rolls off instead of clipping to white.
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    this.camera = new OrthographicCamera(-this.frustum * aspect, this.frustum * aspect, this.frustum, -this.frustum, 0.1, 200)
    this.placeCamera()

    this.buildLights()
    this.buildClouds()

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    document.addEventListener('visibilitychange', this.onVisibility)

    this.resize()
    this.requestRender()
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.contextLost = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    report('webglcontextlost', 'city view lost its WebGL context')
  }

  /** The overlays (HUD, side plates, bubbles) are plain HTML and never
   * depend on WebGL, so they stay up through a context loss on their own.
   * All the 3D side needs is to notice the context came back and draw a
   * frame again — three.js keeps every geometry/texture description on the
   * JS side, so the next render re-uploads them without us rebuilding the
   * scene by hand. */
  private onContextRestored = () => {
    this.contextLost = false
    report('webglcontextrestored', 'city view recovered its WebGL context')
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

  /** Lets the caller (CityView) pause rendering while a sheet or another
   * screen fully covers the canvas, without the engine needing to know
   * anything about React state. */
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    if (active) this.requestRender()
    else {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
  }

  // The dusk sky is a plain CSS gradient behind the (alpha-transparent)
  // canvas, not a 3D sphere: an orthographic camera's rays are all parallel,
  // so a world-space sky sphere renders as a few flat, hard-edged bands
  // instead of a smooth gradient. A screen-space gradient is also one less
  // big mesh to draw every frame — better for an iPhone's battery too.

  private buildLights() {
    const sun = new DirectionalLight(0xffb27a, 2.0)
    sun.position.set(-8, 14, -10)
    this.scene.add(sun)
    const ambient = new HemisphereLight(0x7f8fd0, 0x22263a, 1.1)
    this.scene.add(ambient)
    // a soft dusk haze, as the prototype's fog_light_color/fog_density
    this.scene.fog = new FogExp2(0x3b3f74, 0.012)
  }

  /** A handful of flat, cheap cloud-shadow blobs drifting slowly over the
   * city — the only thing in the scene that ever moves on its own. They
   * tick a few times a second, not every frame: a cloud does not need 60fps
   * to look like it is drifting, and this keeps the "idle life" from
   * fighting the render-on-demand battery saving. */
  private buildClouds() {
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshBasicMaterial({ color: 0x0a1030, transparent: true, opacity: 0.1, depthWrite: false })
    // one InstancedMesh for all of them: three moving blobs still cost a
    // single draw call, same as if there were only one
    this.cloudSpecs = [
      [5, 3.2, 9],
      [14, 2.6, 15],
      [9, 3.6, 22],
    ]
    this.cloudMesh = new InstancedMesh(geo, mat, this.cloudSpecs.length)
    this.cloudMesh.frustumCulled = false
    this.scene.add(this.cloudMesh)
    this.lastCloudTick = performance.now()
    this.writeCloudMatrices()
  }

  private writeCloudMatrices() {
    if (!this.cloudMesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    this.cloudSpecs.forEach(([x, size, z], i) => {
      m.compose(new Vector3(x, 6, z), q, new Vector3(size, 1, size * 0.7))
      this.cloudMesh!.setMatrixAt(i, m)
    })
    this.cloudMesh.instanceMatrix.needsUpdate = true
  }

  private tickClouds(now: number) {
    if (this.cloudSpecs.length === 0) return
    const dt = (now - this.lastCloudTick) / 1000
    this.lastCloudTick = now
    const span = this.bounds.maxX - this.bounds.minX + 10
    for (const spec of this.cloudSpecs) {
      spec[0] += dt * 0.15
      if (spec[0] > this.bounds.maxX + 8) spec[0] -= span
    }
    this.writeCloudMatrices()
  }

  private placeCamera() {
    const dir = new Vector3(1, 1.25, 1).normalize()
    const pos = this.target.clone().add(dir.multiplyScalar(40))
    this.camera.position.copy(pos)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(this.target)
  }

  private updateFrustumPlanes() {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight)
    this.camera.left = -this.frustum * aspect
    this.camera.right = this.frustum * aspect
    this.camera.top = this.frustum
    this.camera.bottom = -this.frustum
    this.camera.updateProjectionMatrix()
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.updateFrustumPlanes()
    this.requestRender()
  }

  async loadCity(cityMap: CityMap) {
    this.plots = cityMap.plots
    this.bounds = {
      minX: -3,
      maxX: cityMap.grid.w + 3,
      minZ: -3,
      maxZ: cityMap.grid.h + 3,
    }
    this.target.set(cityMap.grid.w / 2, 0, cityMap.grid.h / 2)
    this.placeCamera()

    this.buildGround(cityMap)
    void this.buildRoads(cityMap)
    this.buildWater(cityMap)
    this.buildPlotBases(cityMap)
    void this.buildGreenery(cityMap)
    void this.buildModels(cityMap)
    this.updateLabels()
    this.requestRender()
  }

  private buildGround(cityMap: CityMap) {
    const geo = new PlaneGeometry(cityMap.grid.w + 20, cityMap.grid.h + 20)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshLambertMaterial({ color: 0x3e6b4a })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(cityMap.grid.w / 2, -0.03, cityMap.grid.h / 2)
    this.scene.add(mesh)
  }

  /** Road tiles from the owner's own Starter Kit (proto/art/models), the way
   * the prototype lays them: a straight tile turned to face its neighbours,
   * an intersection tile where two roads cross. Two InstancedMeshes (one
   * geometry/material pair each, shared with every tile of that kind) keep
   * a city full of roads to one draw call per kind. Falls back to a flat
   * tinted plane if the kit fails to load (offline, a slow first paint). */
  private async buildRoads(cityMap: CityMap) {
    if (cityMap.roads.length === 0) return
    const cells = new Set(cityMap.roads.map(([x, y]) => `${x},${y}`))
    const has = (x: number, y: number) => cells.has(`${x},${y}`)
    const straight = await starterGeometry('road-straight')
    const cross = await starterGeometry('road-intersection')
    if (this.disposed) return
    if (!straight || !cross) {
      this.buildFlatRoads(cityMap)
      return
    }
    const straightMesh = new InstancedMesh(straight.geometry, straight.material, cityMap.roads.length)
    const crossMesh = new InstancedMesh(cross.geometry, cross.material, cityMap.roads.length)
    let ns = 0
    let nc = 0
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    for (const [x, y] of cityMap.roads) {
      const ew = has(x - 1, y) || has(x + 1, y)
      const ns2 = has(x, y - 1) || has(x, y + 1)
      const pos = new Vector3(x + 0.5, 0.005, y + 0.5)
      if (ew && ns2) {
        q.identity()
        m.compose(pos, q, new Vector3(1, 1, 1))
        crossMesh.setMatrixAt(nc++, m)
      } else {
        q.setFromAxisAngle(up, ew ? Math.PI / 2 : 0)
        m.compose(pos, q, new Vector3(1, 1, 1))
        straightMesh.setMatrixAt(ns++, m)
      }
    }
    straightMesh.count = ns
    crossMesh.count = nc
    straightMesh.instanceMatrix.needsUpdate = true
    crossMesh.instanceMatrix.needsUpdate = true
    this.scene.add(straightMesh, crossMesh)
    this.requestRender()
  }

  private buildFlatRoads(cityMap: CityMap) {
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshLambertMaterial({ color: 0x555a6e })
    const mesh = new InstancedMesh(geo, mat, cityMap.roads.length)
    const m = new Matrix4()
    cityMap.roads.forEach(([x, y], i) => {
      m.makeTranslation(x + 0.5, 0.005, y + 0.5)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
    this.requestRender()
  }

  /** Grass and trees from the Starter Kit, scattered over the ground cells a
   * road or a plot does not cover — one InstancedMesh, so the greenery never
   * costs more than a single draw call regardless of the city's size. */
  private async buildGreenery(cityMap: CityMap) {
    const taken = new Set(cityMap.roads.map(([x, y]) => `${x},${y}`))
    for (const p of cityMap.plots) {
      for (let dx = 0; dx < p.w; dx++) {
        for (let dy = 0; dy < p.h; dy++) taken.add(`${p.x + dx},${p.y + dy}`)
      }
    }
    const spots: [number, number][] = []
    for (let x = 0; x < cityMap.grid.w; x++) {
      for (let y = 0; y < cityMap.grid.h; y++) {
        if (taken.has(`${x},${y}`)) continue
        if (((x * 131 + y * 977) % 5) === 0) spots.push([x, y])
      }
    }
    if (spots.length === 0) return
    const tree = await starterGeometry('grass-trees')
    if (!tree || this.disposed) return
    const mesh = new InstancedMesh(tree.geometry, tree.material, spots.length)
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    spots.forEach(([x, y], i) => {
      q.setFromAxisAngle(up, ((x * 7 + y * 13) % 4) * (Math.PI / 2))
      m.compose(new Vector3(x + 0.5, 0, y + 0.5), q, new Vector3(1, 1, 1))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
    this.requestRender()
  }

  private buildWater(cityMap: CityMap) {
    const water = cityMap.water
    if (!water) return
    const w = cityMap.grid.w
    const h = cityMap.grid.h
    const width = water.width
    let geo: PlaneGeometry
    let x = w / 2
    let z = h / 2
    if (water.side === 'north') {
      geo = new PlaneGeometry(w + 8, width + 4)
      z = -width / 2
    } else if (water.side === 'south') {
      geo = new PlaneGeometry(w + 8, width + 4)
      z = h + width / 2
    } else if (water.side === 'west') {
      geo = new PlaneGeometry(width + 4, h + 8)
      x = -width / 2
    } else {
      geo = new PlaneGeometry(width + 4, h + 8)
      x = w + width / 2
    }
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshLambertMaterial({ color: 0x2a5f9e, transparent: true, opacity: 0.92 })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(x, -0.015, z)
    this.scene.add(mesh)
  }

  private buildPlotBases(cityMap: CityMap) {
    if (cityMap.plots.length === 0) return
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    // a quiet kerb/pavement pad under every building, not a category colour:
    // the building itself (procedural or modelled) now carries that read
    const mat = new MeshLambertMaterial({ color: 0xc9c4b8 })
    const mesh = new InstancedMesh(geo, mat, cityMap.plots.length)
    const m = new Matrix4()
    cityMap.plots.forEach((p, i) => {
      m.compose(
        new Vector3(p.x + p.w / 2, 0.008, p.y + p.h / 2),
        new Quaternion(),
        new Vector3(p.w * 0.96, 1, p.h * 0.96),
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
  }

  /** One building per plot, in three tiers: the owner's own procedural kit
   * when a plot's model key names something the kit knows how to draw (a
   * bazaar, a bank, a factory, a shop, a villa...); the CDN's model library
   * (the isometric Kenney set already served from webomm.ir404.site) when
   * the key names something else the catalogue modelled; and, only then, a
   * generic shape from the kit (a tower, a small civic front) so no plot is
   * ever left bare. Buildings are coloured by a hash of the plot's id so a
   * street of generic towers still reads as a street, not a repeat.
   *
   * Classifying a plot never needs to await anything (the model library was
   * already resolved once, above), so the whole city is sorted into three
   * buckets first; each bucket is then drawn the cheap way for however many
   * plots land in it: every procedural building in the city (the kit's own
   * shapes, tier one and three) merges into two draw calls total; a
   * Starter Kit fallback house repeats into one InstancedMesh per house
   * variant; only the CDN tier still needs one small Group per plot, since
   * its parts can each be a different model. */
  private async buildModels(cityMap: CityMap) {
    this.placeLabels = []
    const library = await loadModelLibrary().catch(() => null)
    if (this.disposed) return

    const proc: { kind: BuildKind; seed: number; x: number; z: number; rot: number; scale: number }[] = []
    const starter: { name: string; x: number; z: number; rot: number; scale: number }[] = []
    const lib: { plot: CityPlot; entry: LibraryEntry; x: number; z: number; rot: number; scale: number }[] = []

    for (const plot of cityMap.plots) {
      const plotScale = clamp(Math.min(plot.w, plot.h) / 2, 0.8, 1.35)
      const worldX = plot.x + plot.w / 2
      const worldZ = plot.y + plot.h / 2
      const rot = MathUtils.degToRad(plot.rot ?? 0)

      if (plot.kind === 'place') {
        this.placeLabels.push({ plot, world: new Vector3(worldX, 1.6 * plotScale, worldZ) })
      }
      if (plot.kind === 'decor') continue

      const seed = hashSeed(plot.id)
      const kit = classifyStrict(plot.model)
      if (kit) {
        proc.push({ kind: kit, seed, x: worldX, z: worldZ, rot, scale: plotScale })
        continue
      }

      const entry = library ? this.resolveModel(library, plot.model) : null
      if (entry) {
        lib.push({ plot, entry, x: worldX, z: worldZ, rot, scale: plotScale })
        continue
      }

      if (plot.kind === 'company') {
        starter.push({ name: HOUSES[seed % HOUSES.length], x: worldX, z: worldZ, rot, scale: plotScale * 0.62 })
        continue
      }
      proc.push({ kind: classifyGeneric(plot.kind, seed), seed, x: worldX, z: worldZ, rot, scale: plotScale })
    }

    this.buildProceduralBuildings(proc)
    await this.buildStarterHouses(starter)
    await this.buildLibraryModels(lib)
    this.updateLabels()
    if (DEV && !this.disposed && !this.contextLost) {
      // an extra, dev-only render right here (outside the normal
      // request/render cycle) so the logged counters reflect the fully
      // loaded city, not whatever was on screen when the last plot's
      // async load happened to finish
      this.renderer.render(this.scene, this.camera)
      this.logStats('city loaded')
    }
    this.requestRender()
  }

  /** Every kit-drawn or generic-fallback building in the whole city, merged
   * into exactly two static meshes (opaque walls, glowing window accents).
   * Each building is a handful of unit boxes/cylinders in local space; the
   * plot's own position/rotation/scale is baked into the geometry itself
   * (not a scene-graph transform) before merging, so the result is one
   * flat, immovable mesh the GPU can draw in a single call no matter how
   * many buildings the city has. */
  private buildProceduralBuildings(list: { kind: BuildKind; seed: number; x: number; z: number; rot: number; scale: number }[]) {
    if (list.length === 0) return
    const cityOpaque: BufferGeometry[] = []
    const cityGlow: BufferGeometry[] = []
    const m = new Matrix4()
    const q = new Quaternion()
    const s = new Vector3()
    const up = new Vector3(0, 1, 0)
    for (const b of list) {
      const batch = buildKind(b.kind, b.seed)
      q.setFromAxisAngle(up, b.rot)
      s.set(b.scale, b.scale, b.scale)
      m.compose(new Vector3(b.x, 0, b.z), q, s)
      for (const g of batch.opaque) { g.applyMatrix4(m); cityOpaque.push(g) }
      for (const g of batch.glow) { g.applyMatrix4(m); cityGlow.push(g) }
    }
    this.addMerged(cityOpaque, new MeshLambertMaterial({ vertexColors: true }))
    this.addMerged(cityGlow, new MeshBasicMaterial({ vertexColors: true, toneMapped: false }))
  }

  private addMerged(geometries: BufferGeometry[], material: Material) {
    if (geometries.length === 0) return
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((g) => g.dispose())
    if (!merged) return
    this.scene.add(new Mesh(merged, material))
  }

  /** The last-resort Starter Kit house, grouped by which of the five house
   * variants a plot landed on: at most five InstancedMeshes for however
   * many companies fall through to this tier, instead of one Group each. */
  private async buildStarterHouses(list: { name: string; x: number; z: number; rot: number; scale: number }[]) {
    if (list.length === 0) return
    const byName = new Map<string, typeof list>()
    for (const h of list) {
      const arr = byName.get(h.name)
      if (arr) arr.push(h)
      else byName.set(h.name, [h])
    }
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    for (const [name, items] of byName) {
      const geo = await starterGeometry(name)
      if (!geo || this.disposed) continue
      const mesh = new InstancedMesh(geo.geometry, geo.material, items.length)
      items.forEach((it, i) => {
        q.setFromAxisAngle(up, it.rot)
        m.compose(new Vector3(it.x, 0, it.z), q, new Vector3(it.scale, it.scale, it.scale))
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
      this.requestRender()
    }
  }

  /** The CDN model library tier: still one small Group per plot, since a
   * multi-part model can mix different meshes/scales per part. Kept as-is
   * (already sharing one texture and one template per kit via assetCache) —
   * only reached once neither the owner's own kit nor a Starter Kit house
   * claims the plot. */
  private async buildLibraryModels(list: { plot: CityPlot; entry: LibraryEntry; x: number; z: number; rot: number; scale: number }[]) {
    for (const item of list) {
      if (this.disposed) return
      const group = new Group()
      group.position.set(item.x, 0, item.z)
      group.rotation.y = item.rot
      group.scale.setScalar(item.scale)
      this.scene.add(group)
      for (const part of item.entry.parts) {
        const instance = await cloneMesh(part.mesh)
        if (!instance || this.disposed) continue
        fitAndPlacePart(instance, part)
        group.add(instance)
      }
      this.requestRender()
    }
  }

  private resolveModel(library: ModelLibrary, key?: string) {
    if (!key) return library.models['*'] ?? null
    if (library.models[key]) return library.models[key]
    const category = key.split(':')[0]
    if (library.models[`${category}:*`]) return library.models[`${category}:*`]
    return library.models['*'] ?? null
  }

  private updateLabels() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const labels: LabelPoint[] = this.placeLabels.map(({ plot, world }) => {
      const p = world.clone().project(this.camera)
      const visible = p.z < 1
      return {
        id: plot.id,
        text: plot.name?.fa || plot.name?.en || '',
        x: (p.x * 0.5 + 0.5) * w,
        y: (-p.y * 0.5 + 0.5) * h,
        visible,
      }
    })
    this.opts.onLabels(labels)
    this.updateBubbles()
  }

  /** Screen-anchors the world bubbles (home_proto.gd `_world_bubbles`) hang
   * over: the caller names the plots it cares about once (setBubbleAnchors),
   * and every frame they get the same camera-projected x/y as a place's
   * label, so they track a pan/zoom exactly like the buildings do. */
  setBubbleAnchors(anchors: BubbleAnchor[]) {
    this.bubbleAnchors = anchors
    this.updateBubbles()
    this.requestRender()
  }

  private updateBubbles() {
    if (!this.opts.onBubbles) return
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const points: BubbleScreenPoint[] = this.bubbleAnchors.map((a) => {
      const p = new Vector3(a.x, a.y, a.z).project(this.camera)
      return { id: a.id, x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 }
    })
    this.opts.onBubbles(points)
  }

  // -- input: pan with inertia, pinch/wheel zoom, tap to pick a plot --------

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.velocity.x = 0
    this.velocity.z = 0
    if (this.pointers.size === 1) {
      this.lastPan = { x: e.clientX, y: e.clientY }
      this.downInfo = { x: e.clientX, y: e.clientY, t: performance.now() }
    } else if (this.pointers.size === 2) {
      this.downInfo = null
      const pts = [...this.pointers.values()]
      this.pinchStartDist = dist(pts[0], pts[1])
      this.pinchStartFrustum = this.frustum
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 1 && this.lastPan) {
      const dx = e.clientX - this.lastPan.x
      const dy = e.clientY - this.lastPan.y
      this.pan(dx, dy)
      this.velocity = { x: dx, z: dy }
      this.lastPan = { x: e.clientX, y: e.clientY }
      this.requestRender()
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()]
      const d = dist(pts[0], pts[1])
      if (this.pinchStartDist > 0) {
        const factor = this.pinchStartDist / Math.max(1, d)
        this.setFrustum(this.pinchStartFrustum * factor)
        this.requestRender()
      }
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size === 0) {
      this.lastPan = null
      if (this.downInfo) {
        const dx = e.clientX - this.downInfo.x
        const dy = e.clientY - this.downInfo.y
        const dt = performance.now() - this.downInfo.t
        if (Math.hypot(dx, dy) < 8 && dt < 500) {
          this.pickPlot(e.clientX, e.clientY)
        }
      }
      this.downInfo = null
      if (Math.abs(this.velocity.x) > 0.02 || Math.abs(this.velocity.z) > 0.02) this.requestRender()
    }
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.setFrustum(this.frustum * (1 + e.deltaY * 0.001))
    this.requestRender()
  }

  private pan(dxPx: number, dyPx: number) {
    const worldPerPx = (this.frustum * 2) / Math.max(1, this.canvas.clientHeight)
    // screen right/down -> move target opposite, along camera's local right/forward on the ground plane
    const right = new Vector3(1, 0, -1).normalize()
    const fwd = new Vector3(-1, 0, -1).normalize()
    this.target.addScaledVector(right, -dxPx * worldPerPx)
    this.target.addScaledVector(fwd, dyPx * worldPerPx)
    this.target.x = clamp(this.target.x, this.bounds.minX, this.bounds.maxX)
    this.target.z = clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ)
    this.placeCamera()
  }

  private setFrustum(v: number) {
    this.frustum = clamp(v, MIN_FRUSTUM, MAX_FRUSTUM)
    this.updateFrustumPlanes()
  }

  private pickPlot(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const plane = new Plane(new Vector3(0, 1, 0), 0)
    const hit = new Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) return
    const plot = this.plots.find((p) => hit.x >= p.x && hit.x <= p.x + p.w && hit.z >= p.y && hit.z <= p.y + p.h)
    if (plot) this.opts.onPlotTap(plot)
  }

  /** Schedules exactly one frame, unless one is already pending — the only
   * way anything ever gets drawn. Nothing keeps a permanent 60fps loop
   * running: an idle city between requestRender() calls costs nothing. */
  private requestRender() {
    if (this.raf || this.disposed || !this.active || this.contextLost) return
    this.raf = requestAnimationFrame(this.frame)
  }

  private frame = (now: number) => {
    this.raf = 0
    if (this.disposed || this.contextLost) return

    // inertia decay: keep re-rendering while the pan is still coasting
    let moving = false
    if (!this.lastPan && (Math.abs(this.velocity.x) > 0.02 || Math.abs(this.velocity.z) > 0.02)) {
      this.pan(this.velocity.x, this.velocity.z)
      this.velocity.x *= 0.9
      this.velocity.z *= 0.9
      moving = true
    }

    // clouds tick at a few hz, not every frame — plenty smooth for
    // something this slow, and far cheaper on battery than 60fps
    if (now - this.lastCloudTick > 120) this.tickClouds(now)

    this.renderer.render(this.scene, this.camera)
    this.updateLabels()

    if (!this.loggedFirstFrame) {
      this.loggedFirstFrame = true
      this.logStats('first frame', performance.now() - this.startedAt)
    }

    if (moving || this.pointers.size > 0) this.requestRender()
    else if (this.cloudSpecs.length > 0) {
      // keep the drift alive at a low cadence via a lightweight timer
      // rather than chaining requestAnimationFrame at 60fps for no reason
      window.setTimeout(() => this.requestRender(), 120)
    }
  }

  /** Dev-only console readout of the renderer's own counters (draw calls,
   * triangles, live geometries/textures) plus how long the first frame took
   * to land — the numbers the task asks to measure, with zero cost in a
   * production build (import.meta.env.DEV is compiled away). */
  private logStats(label: string, ms?: number) {
    if (!DEV) return
    const info = this.renderer.info
    const t = ms !== undefined ? `${ms.toFixed(0)}ms` : ''
    // eslint-disable-next-line no-console
    console.log(
      `[cityEngine] ${label} ${t} — calls=${info.render.calls} triangles=${info.render.triangles} ` +
      `geometries=${info.memory.geometries} textures=${info.memory.textures} programs=${info.programs?.length ?? 0}`,
    )
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('visibilitychange', this.onVisibility)
    // geometries and materials are safe to dispose here even where they
    // are shared with assetCache's module-level template cache: dispose()
    // only drops the GPU-side buffers/programs a *renderer* tracked (this
    // renderer, which is being torn down anyway), not the JS-side
    // descriptors those caches hold — the next CityEngine's new renderer
    // re-uploads them the first time they are drawn again.
    this.scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as Material | Material[] | undefined
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        const withMap = m as Material & { map?: { dispose(): void } | null }
        withMap.map?.dispose()
        m.dispose()
      }
    })
    this.renderer.dispose()
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Scale a part so its larger x/z footprint equals `size`, centre it on x/z
 * with its base at y=0, then offset and rotate it as the placement rules say. */
function fitAndPlacePart(obj: Object3D, part: { at: [number, number]; rotate: number; size: number }) {
  const box = new Box3().setFromObject(obj)
  const dims = box.getSize(new Vector3())
  const footprint = Math.max(dims.x, dims.z) || 1
  const scale = part.size / footprint
  obj.scale.setScalar(scale)

  const box2 = new Box3().setFromObject(obj)
  const center = box2.getCenter(new Vector3())
  obj.position.x -= center.x
  obj.position.z -= center.z
  obj.position.y -= box2.min.y

  obj.position.x += part.at[0]
  obj.position.z += part.at[1]
  obj.rotation.y = MathUtils.degToRad(part.rotate ?? 0)
}
