import * as THREE from 'three'
import type { CityMap, CityPlot, ModelLibrary } from '../api/types'
import { cloneMesh, loadModelLibrary } from './assetCache'
import { report } from '../lib/reporter'

export interface LabelPoint {
  id: string
  text: string
  x: number
  y: number
  visible: boolean
}

export interface CityEngineOptions {
  onPlotTap: (plot: CityPlot) => void
  onLabels: (labels: LabelPoint[]) => void
}

const MIN_FRUSTUM = 4
const MAX_FRUSTUM = 26

export class CityEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private target = new THREE.Vector3(0, 0, 0)
  private frustum = 14
  private bounds = { minX: -4, maxX: 20, minZ: -4, maxZ: 20 }
  private raf = 0
  private opts: CityEngineOptions
  private plots: CityPlot[] = []
  private placeLabels: { plot: CityPlot; world: THREE.Vector3 }[] = []
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
      alpha: false,
      powerPreference: 'low-power',
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x0b1330, 1)

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    this.camera = new THREE.OrthographicCamera(-this.frustum * aspect, this.frustum * aspect, this.frustum, -this.frustum, 0.1, 200)
    this.placeCamera()

    this.buildSky()
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

  private buildSky() {
    const top = new THREE.Color('#1b2a5c')
    const bottom = new THREE.Color('#e9926a')
    const geo = new THREE.SphereGeometry(150, 16, 16)
    const mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: top }, bottom: { value: bottom } },
      vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; void main() { float h = normalize(vPos).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
      side: THREE.BackSide,
      depthWrite: false,
    })
    const sky = new THREE.Mesh(geo, mat)
    this.scene.add(sky)
  }

  private buildLights() {
    const sun = new THREE.DirectionalLight(0xffb27a, 2.0)
    sun.position.set(-8, 14, -10)
    this.scene.add(sun)
    const ambient = new THREE.HemisphereLight(0x7f8fd0, 0x22263a, 1.1)
    this.scene.add(ambient)
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
    this.buildRoads(cityMap)
    this.buildWater(cityMap)
    this.buildPlotBases(cityMap)
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

  private buildRoads(cityMap: CityMap) {
    if (cityMap.roads.length === 0) return
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
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a8f9e, vertexColors: true })
    const mesh = new THREE.InstancedMesh(geo, mat, cityMap.plots.length)
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    cityMap.plots.forEach((p, i) => {
      m.compose(
        new THREE.Vector3(p.x + p.w / 2, 0.01, p.y + p.h / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(p.w * 0.94, 1, p.h * 0.94),
      )
      mesh.setMatrixAt(i, m)
      const c = p.kind === 'company' ? 0x2a4bc8 : p.kind === 'place' ? 0x2bc4b2 : 0x4cc47e
      color.set(c)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.scene.add(mesh)
  }

  private async buildModels(cityMap: CityMap) {
    const library = await loadModelLibrary()
    if (!library || this.disposed) return
    this.placeLabels = []
    for (const plot of cityMap.plots) {
      if (this.disposed) return
      const entry = this.resolveModel(library, plot.model)
      const group = new THREE.Group()
      const plotScale = clamp(Math.min(plot.w, plot.h) / 2, 0.8, 1.35)
      group.position.set(plot.x + plot.w / 2, 0, plot.y + plot.h / 2)
      group.rotation.y = THREE.MathUtils.degToRad(plot.rot ?? 0)
      group.scale.setScalar(plotScale)
      this.scene.add(group)

      if (plot.kind === 'place') {
        this.placeLabels.push({ plot, world: new THREE.Vector3(plot.x + plot.w / 2, 1.6 * plotScale, plot.y + plot.h / 2) })
      }

      if (!entry) continue
      for (const part of entry.parts) {
        const instance = await cloneMesh(part.mesh)
        if (!instance || this.disposed) continue
        fitAndPlacePart(instance, part)
        group.add(instance)
      }
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
