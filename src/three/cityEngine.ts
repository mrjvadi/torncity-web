import * as THREE from 'three'
import type { CityMap, CityPlot, ModelLibrary } from '../api/types'
import { cloneMesh, loadModelLibrary, starterGeometry, cloneStarter } from './assetCache'
import { buildKind, classifyStrict, classifyGeneric, hashSeed } from './builders'
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

export class CityEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private target = new THREE.Vector3(0, 0, 0)
  private frustum = 10
  private bounds = { minX: -4, maxX: 20, minZ: -4, maxZ: 20 }
  private raf = 0
  private opts: CityEngineOptions
  private plots: CityPlot[] = []
  private placeLabels: { plot: CityPlot; world: THREE.Vector3 }[] = []
  private bubbleAnchors: BubbleAnchor[] = []
  private disposed = false

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
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dpr < 2,
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x000000, 0)

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    this.camera = new THREE.OrthographicCamera(-this.frustum * aspect, this.frustum * aspect, this.frustum, -this.frustum, 0.1, 200)
    this.placeCamera()

    this.buildLights()

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })

    this.resize()
    this.loop()
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    report('webglcontextlost', 'city view lost its WebGL context')
  }

  // The dusk sky is a plain CSS gradient behind the (alpha-transparent)
  // canvas, not a 3D sphere: an orthographic camera's rays are all parallel,
  // so a world-space sky sphere renders as a few flat, hard-edged bands
  // instead of a smooth gradient. A screen-space gradient is also one less
  // big mesh to draw every frame — better for an iPhone's battery too.

  private buildLights() {
    const sun = new THREE.DirectionalLight(0xffb27a, 2.0)
    sun.position.set(-8, 14, -10)
    this.scene.add(sun)
    const ambient = new THREE.HemisphereLight(0x7f8fd0, 0x22263a, 1.1)
    this.scene.add(ambient)
    // a soft dusk haze, as the prototype's fog_light_color/fog_density
    this.scene.fog = new THREE.FogExp2(0x3b3f74, 0.012)
  }

  private placeCamera() {
    const dir = new THREE.Vector3(1, 1.25, 1).normalize()
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
  }

  private buildGround(cityMap: CityMap) {
    const geo = new THREE.PlaneGeometry(cityMap.grid.w + 20, cityMap.grid.h + 20)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshLambertMaterial({ color: 0x3e6b4a })
    const mesh = new THREE.Mesh(geo, mat)
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
    const straightMesh = new THREE.InstancedMesh(straight.geometry, straight.material, cityMap.roads.length)
    const crossMesh = new THREE.InstancedMesh(cross.geometry, cross.material, cityMap.roads.length)
    let ns = 0
    let nc = 0
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    for (const [x, y] of cityMap.roads) {
      const ew = has(x - 1, y) || has(x + 1, y)
      const ns2 = has(x, y - 1) || has(x, y + 1)
      const pos = new THREE.Vector3(x + 0.5, 0.005, y + 0.5)
      if (ew && ns2) {
        q.identity()
        m.compose(pos, q, new THREE.Vector3(1, 1, 1))
        crossMesh.setMatrixAt(nc++, m)
      } else {
        q.setFromAxisAngle(up, ew ? Math.PI / 2 : 0)
        m.compose(pos, q, new THREE.Vector3(1, 1, 1))
        straightMesh.setMatrixAt(ns++, m)
      }
    }
    straightMesh.count = ns
    crossMesh.count = nc
    straightMesh.instanceMatrix.needsUpdate = true
    crossMesh.instanceMatrix.needsUpdate = true
    this.scene.add(straightMesh, crossMesh)
  }

  private buildFlatRoads(cityMap: CityMap) {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshLambertMaterial({ color: 0x555a6e })
    const mesh = new THREE.InstancedMesh(geo, mat, cityMap.roads.length)
    const m = new THREE.Matrix4()
    cityMap.roads.forEach(([x, y], i) => {
      m.makeTranslation(x + 0.5, 0.005, y + 0.5)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
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
    const mesh = new THREE.InstancedMesh(tree.geometry, tree.material, spots.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    spots.forEach(([x, y], i) => {
      q.setFromAxisAngle(up, ((x * 7 + y * 13) % 4) * (Math.PI / 2))
      m.compose(new THREE.Vector3(x + 0.5, 0, y + 0.5), q, new THREE.Vector3(1, 1, 1))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
  }

  private buildWater(cityMap: CityMap) {
    const water = cityMap.water
    if (!water) return
    const w = cityMap.grid.w
    const h = cityMap.grid.h
    const width = water.width
    let geo: THREE.PlaneGeometry
    let x = w / 2
    let z = h / 2
    if (water.side === 'north') {
      geo = new THREE.PlaneGeometry(w + 8, width + 4)
      z = -width / 2
    } else if (water.side === 'south') {
      geo = new THREE.PlaneGeometry(w + 8, width + 4)
      z = h + width / 2
    } else if (water.side === 'west') {
      geo = new THREE.PlaneGeometry(width + 4, h + 8)
      x = -width / 2
    } else {
      geo = new THREE.PlaneGeometry(width + 4, h + 8)
      x = w + width / 2
    }
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a5f9e, transparent: true, opacity: 0.92 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, -0.015, z)
    this.scene.add(mesh)
  }

  private buildPlotBases(cityMap: CityMap) {
    if (cityMap.plots.length === 0) return
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    // a quiet kerb/pavement pad under every building, not a category colour:
    // the building itself (procedural or modelled) now carries that read
    const mat = new THREE.MeshLambertMaterial({ color: 0xc9c4b8 })
    const mesh = new THREE.InstancedMesh(geo, mat, cityMap.plots.length)
    const m = new THREE.Matrix4()
    cityMap.plots.forEach((p, i) => {
      m.compose(
        new THREE.Vector3(p.x + p.w / 2, 0.008, p.y + p.h / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(p.w * 0.96, 1, p.h * 0.96),
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
   * generic shape from the kit (a tower, a small civic front) so nothing
   * plot is ever left bare. Buildings are coloured by a hash of the plot's
   * id so a street of generic towers still reads as a street, not a repeat. */
  private async buildModels(cityMap: CityMap) {
    this.placeLabels = []
    const library = await loadModelLibrary().catch(() => null)
    for (const plot of cityMap.plots) {
      if (this.disposed) return
      const group = new THREE.Group()
      const plotScale = clamp(Math.min(plot.w, plot.h) / 2, 0.8, 1.35)
      group.position.set(plot.x + plot.w / 2, 0, plot.y + plot.h / 2)
      group.rotation.y = THREE.MathUtils.degToRad(plot.rot ?? 0)
      group.scale.setScalar(plotScale)
      this.scene.add(group)

      if (plot.kind === 'place') {
        this.placeLabels.push({ plot, world: new THREE.Vector3(plot.x + plot.w / 2, 1.6 * plotScale, plot.y + plot.h / 2) })
      }
      if (plot.kind === 'decor') continue

      const kit = classifyStrict(plot.model)
      if (kit) {
        group.add(buildKind(kit, hashSeed(plot.id)))
        continue
      }

      const entry = library ? this.resolveModel(library, plot.model) : null
      if (entry) {
        for (const part of entry.parts) {
          const instance = await cloneMesh(part.mesh)
          if (!instance || this.disposed) continue
          fitAndPlacePart(instance, part)
          group.add(instance)
        }
        continue
      }

      // last resort: a generic shape from the kit, or (for a company) a
      // Starter Kit house for a little of the owner's own art on the street
      if (plot.kind === 'company') {
        const house = await cloneStarter(HOUSES[hashSeed(plot.id) % HOUSES.length])
        if (house && !this.disposed) {
          house.scale.setScalar(0.62)
          group.add(house)
          continue
        }
      }
      group.add(buildKind(classifyGeneric(plot.kind, hashSeed(plot.id)), hashSeed(plot.id)))
    }
    this.updateLabels()
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
  }

  private updateBubbles() {
    if (!this.opts.onBubbles) return
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const points: BubbleScreenPoint[] = this.bubbleAnchors.map((a) => {
      const p = new THREE.Vector3(a.x, a.y, a.z).project(this.camera)
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
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()]
      const d = dist(pts[0], pts[1])
      if (this.pinchStartDist > 0) {
        const factor = this.pinchStartDist / Math.max(1, d)
        this.setFrustum(this.pinchStartFrustum * factor)
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
    }
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.setFrustum(this.frustum * (1 + e.deltaY * 0.001))
  }

  private pan(dxPx: number, dyPx: number) {
    const w = this.canvas.clientWidth
    const worldPerPx = (this.frustum * 2) / Math.max(1, this.canvas.clientHeight)
    // screen right/down -> move target opposite, along camera's local right/forward on the ground plane
    const right = new THREE.Vector3(1, 0, -1).normalize()
    const fwd = new THREE.Vector3(-1, 0, -1).normalize()
    void w
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
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) return
    const plot = this.plots.find((p) => hit.x >= p.x && hit.x <= p.x + p.w && hit.z >= p.y && hit.z <= p.y + p.h)
    if (plot) this.opts.onPlotTap(plot)
  }

  private loop = () => {
    if (this.disposed) return
    // inertia decay
    if (!this.lastPan && (Math.abs(this.velocity.x) > 0.02 || Math.abs(this.velocity.z) > 0.02)) {
      this.pan(this.velocity.x, this.velocity.z)
      this.velocity.x *= 0.9
      this.velocity.z *= 0.9
    }
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
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
function fitAndPlacePart(obj: THREE.Object3D, part: { at: [number, number]; rotate: number; size: number }) {
  const box = new THREE.Box3().setFromObject(obj)
  const dims = box.getSize(new THREE.Vector3())
  const footprint = Math.max(dims.x, dims.z) || 1
  const scale = part.size / footprint
  obj.scale.setScalar(scale)

  const box2 = new THREE.Box3().setFromObject(obj)
  const center = box2.getCenter(new THREE.Vector3())
  obj.position.x -= center.x
  obj.position.z -= center.z
  obj.position.y -= box2.min.y

  obj.position.x += part.at[0]
  obj.position.z += part.at[1]
  obj.rotation.y = THREE.MathUtils.degToRad(part.rotate ?? 0)
}
