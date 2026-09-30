// The Support city in three.js: the road kit instanced, the buildings of the
// kit (services and companies as their own meshes so they can be tapped, the
// filler instanced), tinted lots, roof emblems and DOM-projected labels.
// It renders on demand (a camera change, a tween, a resize), never in a
// loop, so a phone left on the city does not burn its battery.

import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, FogExp2, Group,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Quaternion, Raycaster, Scene, SphereGeometry, SRGBColorSpace, TOUCH, Vector2, Vector3, WebGLRenderer, type Object3D,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { BuildingKit, RoadKit } from './cityKit'
import { ROAD_SCALE, ROAD_TOP, type CityPlan, type Placed } from './cityPlan'
import type { Emblem } from './services'

export interface SupportLabel { key: string; x: number; y: number; visible: boolean; near: boolean }

export interface SupportSceneOptions {
  onTap: (p: Placed | null) => void
  onLabels: (labels: SupportLabel[]) => void
}

export type FrameMode = 'aerial' | 'street'

const UP = new Vector3(0, 1, 0)

function skyTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2; c.height = 256
  const g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, '#7aa6d6'); gr.addColorStop(0.5, '#c9dcec'); gr.addColorStop(1, '#eaeee9')
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const at = (m: Mesh, x: number, y: number, z: number): Mesh => { m.position.set(x, y, z); return m }

function emblemMesh(kind: Emblem, top: number): Object3D {
  const g = new Group()
  const std = (color: number, emissive = 0x000000) => new MeshStandardMaterial({ color, emissive, roughness: 0.5 })
  if (kind === 'cross') {
    const m = std(0xe5484d, 0x551015)
    g.add(new Mesh(new BoxGeometry(14, 4, 4), m), new Mesh(new BoxGeometry(4, 14, 4), m))
    g.children[0].position.y = 7; g.children[1].position.y = 7
  } else if (kind === 'coin') {
    const c = new Mesh(new CylinderGeometry(6, 6, 1.6, 28), std(0xf2c255, 0x6a4a08))
    c.rotation.x = Math.PI / 2; c.position.y = 8
    g.add(c)
  } else if (kind === 'siren') {
    g.add(at(new Mesh(new BoxGeometry(5, 2.6, 2.6), std(0xe5484d, 0x551015)), -2.6, 2, 0))
    g.add(at(new Mesh(new BoxGeometry(5, 2.6, 2.6), std(0x3f6adf, 0x101f5a)), 2.6, 2, 0))
  } else if (kind === 'flag') {
    g.add(at(new Mesh(new CylinderGeometry(0.35, 0.35, 16, 8), std(0xcccccc)), 0, 8, 0))
    g.add(at(new Mesh(new BoxGeometry(8, 4.5, 0.3), std(0xf2c255, 0x4a3608)), 4.2, 13.5, 0))
  } else if (kind === 'book') {
    g.add(at(new Mesh(new BoxGeometry(9, 1.6, 6), std(0x8e6cf0, 0x2a1e57)), 0, 1.4, 0))
    g.add(at(new Mesh(new BoxGeometry(8, 1.2, 5), std(0xf1ead8)), 0, 2.9, 0))
  } else {
    g.add(at(new Mesh(new BoxGeometry(11, 4, 4.5), std(0x2bc4b2, 0x0a423d)), 0, 3, 0))
  }
  g.position.y = top
  g.traverse((o) => { o.castShadow = true })
  return g
}

export class SupportScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private controls: OrbitControls
  private raycaster = new Raycaster()
  private pickables: Mesh[] = []
  private anchors: { key: string; pos: Vector3; weight: number; kind: Placed['kind'] }[] = []
  private root = new Group()
  private raf = 0
  private disposed = false
  private active = true
  private contextLost = false
  private tween: { t0: number; dur: number; p0: Vector3; t1: Vector3; p1: Vector3; t0v: Vector3 } | null = null
  private down: { x: number; y: number; t: number } | null = null
  private insets = { top: 0, bottom: 0 }
  private lastLabelJson = ''
  private streetPose: { pos: Vector3; target: Vector3 }
  private geos: { dispose: () => void }[] = []

  private constructor(private canvas: HTMLCanvasElement, private plan: CityPlan, private kits: { b: BuildingKit; r: RoadKit }, private opts: SupportSceneOptions) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({ canvas, antialias: dpr < 1.75, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap

    this.scene.background = skyTexture()
    this.scene.fog = new FogExp2(0xdde6ee, 0.00042)
    this.camera = new PerspectiveCamera(40, 1, 2, 6000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 26
    this.controls.maxDistance = plan.span * 1.5
    this.controls.minPolarAngle = 0.15
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02
    this.controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
    this.controls.addEventListener('change', this.onChange)
    this.controls.addEventListener('start', () => { this.tween = null })

    this.buildLights()
    this.scene.add(this.root)
    this.buildGround()
    this.buildRoads()
    this.buildBuildings()
    this.streetPose = this.findStreet()

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.frame('aerial', false)
  }

  static async create(canvas: HTMLCanvasElement, plan: CityPlan, kits: { b: BuildingKit; r: RoadKit }, opts: SupportSceneOptions): Promise<SupportScene> {
    return new SupportScene(canvas, plan, kits, opts)
  }

  // -- construction -----------------------------------------------------------

  private buildLights() {
    const half = this.plan.span / 2 + 60
    this.scene.add(new HemisphereLight(0xe6f0ff, 0x6b6f5a, 1.5), new AmbientLight(0xffffff, 0.15))
    const sun = new DirectionalLight(0xfff1dc, 2.6)
    sun.position.set(-half * 0.6, half * 0.95, half * 0.45)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 50, far: half * 3 })
    sun.shadow.bias = -0.0005
    this.scene.add(sun)
  }

  private buildGround() {
    const g = new PlaneGeometry(9000, 9000)
    const m = new MeshStandardMaterial({ color: 0x819063, roughness: 1 })
    const ground = new Mesh(g, m)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.3
    ground.receiveShadow = true
    this.root.add(ground)
    this.geos.push(g, m)
  }

  private buildRoads() {
    const { tiles, net, M } = this.plan
    const buckets: Record<string, typeof tiles> = {}
    for (const t of tiles) (buckets[t.id] ||= []).push(t)
    const m4 = new Matrix4(), q = new Quaternion(), s3 = new Vector3(ROAD_SCALE, ROAD_SCALE, ROAD_SCALE)
    for (const [id, list] of Object.entries(buckets)) {
      const p = this.kits.r.pieces[id]
      const im = new InstancedMesh(p.geometry, p.material, list.length)
      list.forEach((t, i) => {
        q.setFromAxisAngle(UP, t.k * Math.PI / 2)
        m4.compose(new Vector3((t.x - (net.w - 1) / 2) * M, 0, (t.z - (net.h - 1) / 2) * M), q, s3)
        im.setMatrixAt(i, m4)
      })
      im.receiveShadow = true
      this.root.add(im)
    }
  }

  private buildBuildings() {
    const { placed } = this.plan
    const m4 = new Matrix4(), q = new Quaternion()
    const slabGeo = new BoxGeometry(1, 1, 1)
    const slabMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
    const slabs = new InstancedMesh(slabGeo, slabMat, placed.length)
    const col = new Color()
    placed.forEach((p, i) => {
      const [lx, lz, lw, ld] = p.lot
      m4.compose(new Vector3(lx + lw / 2, ROAD_TOP - 0.25, lz + ld / 2), new Quaternion(), new Vector3(lw, 0.5, ld))
      slabs.setMatrixAt(i, m4)
      if (p.kind === 'park') col.set(0x6f9a52)
      else if (p.service) col.set(0x9a9a92).lerp(new Color(p.service.color), 0.5)
      else if (p.kind === 'company') col.set(0x9a9a92).lerp(new Color('#e8a838'), 0.32)
      else col.set(0x9a9a92)
      slabs.setColorAt(i, col)
    })
    slabs.receiveShadow = true
    this.root.add(slabs)
    this.geos.push(slabGeo, slabMat)

    // filler: one instanced mesh per kit building
    const fillers = new Map<string, Placed[]>()
    for (const p of placed) if (p.kind === 'filler' && p.fit) { const l = fillers.get(p.fit.b.id) ?? []; l.push(p); fillers.set(p.fit.b.id, l) }
    for (const list of fillers.values()) {
      const b = list[0].fit!.b
      const im = new InstancedMesh(b.geometry, b.material, list.length)
      list.forEach((p, i) => {
        q.setFromAxisAngle(UP, p.fit!.rot ? Math.PI / 2 : 0)
        m4.compose(new Vector3(p.x, ROAD_TOP, p.z), q, new Vector3(p.fit!.s, p.fit!.s, p.fit!.s))
        im.setMatrixAt(i, m4)
      })
      im.castShadow = im.receiveShadow = true
      this.root.add(im)
    }

    // services and companies: their own meshes, tappable
    for (const p of placed) {
      if (!p.fit || (p.kind !== 'service' && p.kind !== 'company')) continue
      const { b, rot, s } = p.fit
      const mesh = new Mesh(b.geometry, b.material)
      mesh.position.set(p.x, ROAD_TOP, p.z)
      mesh.rotation.y = rot ? Math.PI / 2 : 0
      mesh.scale.setScalar(s)
      mesh.castShadow = mesh.receiveShadow = true
      mesh.userData.key = p.key
      this.root.add(mesh)
      this.pickables.push(mesh)
      const top = b.height * s
      if (p.service?.emblem) {
        const e = emblemMesh(p.service.emblem, ROAD_TOP + top)
        e.position.x = p.x; e.position.z = p.z
        this.root.add(e)
      }
      this.anchors.push({ key: p.key, pos: new Vector3(p.x, ROAD_TOP + top + (p.service?.emblem ? 12 : 4), p.z), weight: p.service?.weight ?? 1, kind: p.kind })
    }

    // parks: lawn and trees
    const parks = placed.filter((p) => p.kind === 'park')
    const trunkG = new CylinderGeometry(0.5, 0.7, 4, 6), crownG = new SphereGeometry(3.6, 8, 6)
    const trunkM = new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }), crownM = new MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.9 })
    const spots: { x: number; z: number; k: number }[] = []
    let seed = 11
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (const p of parks) {
      const [lx, lz, lw, ld] = p.lot
      const n = Math.round(lw * ld / 190)
      for (let i = 0; i < n; i++) spots.push({ x: lx + 4 + rnd() * (lw - 8), z: lz + 4 + rnd() * (ld - 8), k: 0.8 + rnd() * 0.8 })
    }
    const trunks = new InstancedMesh(trunkG, trunkM, spots.length), crowns = new InstancedMesh(crownG, crownM, spots.length)
    spots.forEach((t, i) => {
      m4.compose(new Vector3(t.x, ROAD_TOP + 2 * t.k, t.z), new Quaternion(), new Vector3(t.k, t.k, t.k)); trunks.setMatrixAt(i, m4)
      m4.compose(new Vector3(t.x, ROAD_TOP + 6.2 * t.k, t.z), new Quaternion(), new Vector3(t.k, t.k * 1.15, t.k)); crowns.setMatrixAt(i, m4)
    })
    trunks.castShadow = crowns.castShadow = true
    this.root.add(trunks, crowns)
    this.geos.push(trunkG, crownG, trunkM, crownM)
    void col
  }

  /** The longest straight street through the middle: the street-level view. */
  private findStreet(): { pos: Vector3; target: Vector3 } {
    const { net, M } = this.plan
    let best: { len: number; x: number; z0: number; z1: number; dist: number } | null = null
    for (let x = 0; x < net.w; x++) {
      let z = 0
      while (z < net.h) {
        if (!net.road[z * net.w + x]) { z++; continue }
        const z0 = z
        while (z < net.h && net.road[z * net.w + x]) z++
        const len = z - z0
        const dist = Math.abs(x - (net.w - 1) / 2)
        if (len > 4 && (!best || len > best.len + 4 || (len >= best.len - 4 && dist < best.dist))) best = { len, x, z0, z1: z - 1, dist }
      }
    }
    const b = best ?? { x: Math.round((net.w - 1) / 2), z0: 0, z1: net.h - 1, len: net.h, dist: 0 }
    const wx = (b.x - (net.w - 1) / 2) * M
    const zA = (b.z1 - (net.h - 1) / 2) * M, zB = (b.z0 - (net.h - 1) / 2) * M
    const zc = (zA + zB) / 2
    return { pos: new Vector3(wx, 4.2, zc + Math.min(zA - zc, 90) - 8), target: new Vector3(wx, 28, zc - Math.min(zc - zB, 90)) }
  }

  // -- camera -----------------------------------------------------------------

  frame(mode: FrameMode, animate = true) {
    let pos: Vector3, target: Vector3
    if (mode === 'street') { pos = this.streetPose.pos.clone(); target = this.streetPose.target.clone() }
    else {
      const d = this.plan.span * 1.08
      target = new Vector3(0, 24, 0)
      pos = new Vector3(d * 0.62, d * 0.56, d * 0.78).add(target)
    }
    this.flyTo(pos, target, animate)
  }

  /** Flies the camera to look at a building of the plan. */
  focus(key: string) {
    const p = this.plan.placed.find((x) => x.key === key)
    if (!p?.fit) return
    const h = p.fit.b.height * p.fit.s
    const target = new Vector3(p.x, Math.min(h * 0.45, 60), p.z)
    const dist = Math.max(70, Math.min(230, Math.max(p.fit.b.width, p.fit.b.depth) * 2.4 + h * 0.5))
    const dir = new Vector3(0.45, 0.32, 0.83).normalize()
    this.flyTo(target.clone().addScaledVector(dir, dist), target, true)
  }

  private flyTo(pos: Vector3, target: Vector3, animate: boolean) {
    if (!animate) {
      this.controls.target.copy(target)
      this.camera.position.copy(pos)
      this.controls.update()
      this.applyInsets()
      this.requestRender()
      return
    }
    this.tween = { t0: performance.now(), dur: 900, p0: this.camera.position.clone(), p1: pos, t0v: this.controls.target.clone(), t1: target }
    this.requestRender()
  }

  setInsets(top: number, bottom: number) {
    this.insets = { top, bottom }
    this.applyInsets()
    this.requestRender()
  }

  private applyInsets() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1
    const shift = (this.insets.top - this.insets.bottom) / 2
    if (Math.abs(shift) < 1) this.camera.clearViewOffset()
    else this.camera.setViewOffset(w, h, 0, -shift, w, h)
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.applyInsets()
    this.requestRender()
  }

  setActive(a: boolean) {
    this.active = a
    if (a) this.requestRender()
  }

  // -- input ------------------------------------------------------------------

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() } }
  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.down = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return
    this.opts.onTap(this.pickAt(e.clientX, e.clientY))
  }

  pickAt(cx: number, cy: number): Placed | null {
    const r = this.canvas.getBoundingClientRect()
    this.raycaster.setFromCamera(new Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera)
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0]
    if (!hit) return null
    return this.plan.placed.find((p) => p.key === hit.object.userData.key) ?? null
  }

  private onLost = (e: Event) => { e.preventDefault(); this.contextLost = true }
  private onRestored = () => { this.contextLost = false; this.requestRender() }
  private onChange = () => { this.requestRender() }

  // -- rendering --------------------------------------------------------------

  requestRender() {
    if (this.raf || this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    if (this.disposed || !this.active || this.contextLost) return
    const tw = this.tween
    if (tw) {
      const k = Math.min(1, (now - tw.t0) / tw.dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.camera.position.lerpVectors(tw.p0, tw.p1, e)
      this.controls.target.lerpVectors(tw.t0v, tw.t1, e)
      this.camera.lookAt(this.controls.target)
      if (k >= 1) { this.tween = null; this.controls.update() }
      else this.requestRender()
    }
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
  }

  private updateLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    const camPos = this.camera.position
    const v = new Vector3()
    const list = this.anchors.map((a) => {
      v.copy(a.pos).project(this.camera)
      const dist = camPos.distanceTo(a.pos)
      const onScreen = v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05
      return { a, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, dist, onScreen }
    })
    // the most important labels first; a label that would overlap one already placed is dropped
    const order = list.filter((l) => l.onScreen).sort((p, q) => (q.a.weight - p.a.weight) || (p.dist - q.dist))
    const boxes: { x: number; y: number }[] = []
    const shown = new Set<string>()
    const maxLabels = w < 500 ? 12 : 22
    for (const l of order) {
      if (l.a.kind === 'company' && l.dist > 300) continue
      if (shown.size >= maxLabels) break
      if (boxes.some((b) => Math.abs(b.x - l.x) < 78 && Math.abs(b.y - l.y) < 28)) continue
      boxes.push({ x: l.x, y: l.y }); shown.add(l.a.key)
    }
    const out: SupportLabel[] = list.map((l) => ({ key: l.a.key, x: Math.round(l.x), y: Math.round(l.y), visible: shown.has(l.a.key), near: l.dist < 200 }))
    const json = JSON.stringify(out.filter((o) => o.visible))
    if (json !== this.lastLabelJson) { this.lastLabelJson = json; this.opts.onLabels(out.filter((o) => o.visible)) }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.controls.dispose()
    this.geos.forEach((g) => g.dispose())
    this.renderer.dispose()
  }
}
