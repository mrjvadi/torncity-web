// The world map's camera and renderer: its own canvas and WebGL context, separate from the city scene
// (which sleeps while the map is open). The camera orbits the planet: a focus point on the sphere, a
// distance from it, north up. Drag pans, pinch or wheel zooms, `flyTo` glides (zooming out over a long
// way and back in). Rendering is on demand. The terrain is `PlanetTerrain`.

import {
  AdditiveBlending, BackSide, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial,
  SphereGeometry, Vector3, WebGLRenderer,
} from 'three'
import type { WorldInfo } from '../api/types'
import { dirToLatLon, latLonToDir } from './geo'
import { PlanetTerrain, type FetchChunk, type TerrainStats } from './worldMapTerrain'

export const MAP_MIN_ALT = 6
const SPACE = new Color('#070b18')
const HAZE = new Color('#bcd2e8')
const OCEAN = '#1d5a86'
const s01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export interface MapCamState { lat: number; lon: number; alt: number; oblique: boolean; bearing: number }
export interface ProjectedPoint { x: number; y: number; visible: boolean }

export class WorldMapView {
  readonly terrain: PlanetTerrain
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(46, 1, 1, 50000)
  private R: number
  private f = new Vector3(1, 0, 0)
  private n = new Vector3(0, 0, 1)
  private alt = 3000
  private altGoal: number | null = null
  private anchor: { x: number; y: number; dir: Vector3 } | null = null
  private bearing = 0
  private bearGoal: number | null = null
  private style: 'map' | 'terrain' = 'map'
  private lastTap: { x: number; y: number; t: number } | null = null
  private tapTimer = 0
  private rotAngle = 0
  private rotating = false
  private oblique = false
  private tilt = 0
  private insets = { top: 0, bottom: 0 }
  private raf = 0
  private disposed = false
  private active = true
  private fly: { f0: Vector3; f1: Vector3; a0: number; a1: number; peak: number; t0: number; ms: number; done?: () => void } | null = null
  private pointers = new Map<number, { x: number; y: number }>()
  private pinch = 0
  private vel = { x: 0, y: 0 }
  private lastMove = 0
  private atmo: Mesh
  private base: Mesh
  private frameTimes: number[] = []
  private tmpA = new Vector3()
  private tmpB = new Vector3()
  /** after every drawn frame (the markers follow the camera) */
  onFrame: () => void = () => undefined
  /** a tap that landed on bare globe, in CSS px of the canvas (the card closes, the spot is read) */
  onTap: (x: number, y: number) => void = () => undefined
  /** the player has moved the camera by hand */
  onUser: () => void = () => undefined

  constructor(private canvas: HTMLCanvasElement, private world: WorldInfo, fetchChunk: FetchChunk) {
    this.R = world.planet_radius_km
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(dpr)
    this.scene.background = SPACE.clone()
    this.scene.fog = new Fog(HAZE.clone(), 1e9, 2e9)
    this.terrain = new PlanetTerrain(world, fetchChunk)
    this.terrain.onChange = () => this.request()
    this.scene.add(this.terrain.group)
    // unloaded patches read as sea, never as holes
    this.base = new Mesh(new SphereGeometry(this.R * 0.997, 64, 40), new MeshBasicMaterial({ color: OCEAN }))
    this.scene.add(this.base)
    this.atmo = new Mesh(new SphereGeometry(this.R * 1.025, 64, 40), new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: BackSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float k = pow(max(0.0, dot(-vN, vV)), 2.6); gl_FragColor = vec4(vec3(0.35,0.62,1.0) * k * 1.1, 1.0); }',
    }))
    this.scene.add(this.atmo)
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('contextmenu', this.noMenu)
    this.resize()
  }

  // -- state -------------------------------------------------------------------------------

  state(): MapCamState {
    const ll = dirToLatLon(this.f.x, this.f.y, this.f.z)
    return { lat: ll.lat, lon: ll.lon, alt: this.alt, oblique: this.oblique, bearing: this.bearing }
  }

  get maxAlt() { return this.R * 3.4 }

  /** Puts the camera at once. */
  setView(lat: number, lon: number, alt: number) {
    const d = latLonToDir(lat, lon)
    this.f.set(d[0], d[1], d[2])
    this.alt = Math.min(this.maxAlt, Math.max(MAP_MIN_ALT, alt))
    this.fly = null
    this.settleNorth()
    this.request()
  }

  /** Glides to a place: zooms out over a long way, in again at the end. */
  flyTo(lat: number, lon: number, alt: number, done?: () => void) {
    const d = latLonToDir(lat, lon)
    const f1 = new Vector3(d[0], d[1], d[2]).normalize()
    const a1 = Math.min(this.maxAlt, Math.max(MAP_MIN_ALT, alt))
    const ang = Math.acos(Math.min(1, Math.max(-1, this.f.dot(f1))))
    const km = ang * this.R
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const peak = Math.min(this.maxAlt, Math.max(this.alt, a1, km * 0.9))
    const ms = reduced ? 1 : Math.min(2400, 650 + 330 * Math.log2(1 + km / 60))
    this.altGoal = null; this.anchor = null
    this.fly = { f0: this.f.clone(), f1, a0: this.alt, a1, peak, t0: performance.now(), ms, done }
    this.request()
  }

  setOblique(on: boolean) { this.oblique = on; this.request() }
  isOblique() { return this.oblique }

  /** A smooth zoom by a factor (below 1 = closer); with a point the place under it stays under it. */
  zoomAt(k: number, x?: number, y?: number) {
    this.fly = null
    const goal = (this.altGoal ?? this.alt) * k
    this.altGoal = Math.min(this.maxAlt, Math.max(MAP_MIN_ALT, goal))
    if (x !== undefined && y !== undefined) {
      const p = this.pick(x, y)
      if (p) { const d = latLonToDir(p.lat, p.lon); this.anchor = { x, y, dir: new Vector3(d[0], d[1], d[2]) } }
    } else this.anchor = null
    this.request()
  }
  zoomBy(k: number) { this.zoomAt(k) }

  setStyle(s: 'map' | 'terrain') { this.style = s; this.request() }
  getStyle() { return this.style }

  /** Turns the map to a bearing (degrees, the compass direction that is up). */
  setBearing(b: number) { this.bearGoal = null; this.bearing = ((b + 540) % 360) - 180; this.settleNorth(); this.request() }
  /** The compass button: north up again, and the flat view. */
  resetNorth() { this.bearGoal = 0; this.oblique = false; this.request() }

  /** Keeps the place that was under (x, y) at the start of a zoom or pinch under it. */
  private holdAnchor() {
    const a = this.anchor
    if (!a) return
    const p = this.pick(a.x, a.y)
    if (!p) return
    const d = latLonToDir(p.lat, p.lon)
    this.f.x += a.dir.x - d[0]; this.f.y += a.dir.y - d[1]; this.f.z += a.dir.z - d[2]
    this.f.normalize()
    this.settleNorth()
  }

  panBy(dxPx: number, dyPx: number) {
    this.fly = null
    this.pan(dxPx, dyPx)
    this.request()
  }

  setInsets(top: number, bottom: number) {
    this.insets = { top, bottom }
    this.applyOffset()
    this.request()
  }

  setActive(a: boolean) { this.active = a; if (a) this.request() }

  private applyOffset() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    const dy = (this.insets.top - this.insets.bottom) / 2
    if (Math.abs(dy) < 1) this.camera.clearViewOffset()
    else this.camera.setViewOffset(w, h, 0, -dy, w, h)
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 58 : 46
    this.camera.updateProjectionMatrix()
    this.applyOffset()
    this.request()
  }

  // -- input -------------------------------------------------------------------------------

  private down: { x: number; y: number; t: number } | null = null
  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.vel = { x: 0, y: 0 }
    this.rotating = e.pointerType === 'mouse' && (e.button === 2 || e.ctrlKey)
    if (this.pointers.size === 1) this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    else {
      this.down = null; this.pinch = this.spread(); this.rotAngle = this.twistAngle()
      const m = this.mid()
      const p = this.pick(m.x, m.y)
      if (p) { const d = latLonToDir(p.lat, p.lon); this.anchor = { x: m.x, y: m.y, dir: new Vector3(d[0], d[1], d[2]) } }
    }
    this.fly = null; this.altGoal = null
  }
  private twistAngle() {
    const p = [...this.pointers.values()]
    return p.length >= 2 ? (Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) * 180) / Math.PI : 0
  }
  private mid() {
    const p = [...this.pointers.values()], r = this.canvas.getBoundingClientRect()
    return p.length >= 2 ? { x: (p[0].x + p[1].x) / 2 - r.left, y: (p[0].y + p[1].y) / 2 - r.top } : { x: 0, y: 0 }
  }
  private spread() {
    const p = [...this.pointers.values()]
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0
  }
  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev) return
    const nx = e.clientX, ny = e.clientY
    if (this.pointers.size === 1 && this.rotating) {
      this.bearing = ((this.bearing + (nx - prev.x) * 0.4 + 540) % 360) - 180
      this.settleNorth(); this.onUser()
    } else if (this.pointers.size === 1) {
      const dx = nx - prev.x, dy = ny - prev.y
      this.pan(dx, dy)
      const now = performance.now()
      const dt = Math.max(8, now - this.lastMove)
      this.lastMove = now
      this.vel = { x: (dx / dt) * 16, y: (dy / dt) * 16 }
      if (this.down && Math.hypot(nx - this.down.x, ny - this.down.y) > 9) this.onUser()
    } else if (this.pointers.size >= 2) {
      this.pointers.set(e.pointerId, { x: nx, y: ny })
      const s = this.spread()
      if (this.pinch > 0 && s > 0) { this.alt = Math.min(this.maxAlt, Math.max(MAP_MIN_ALT, (this.alt * this.pinch) / s)); this.onUser() }
      this.pinch = s
      // two fingers also turn the map
      const ang = this.twistAngle()
      let da = ang - this.rotAngle
      if (da > 180) da -= 360
      if (da < -180) da += 360
      this.rotAngle = ang
      if (Math.abs(da) < 40) { this.bearing = ((this.bearing - da + 540) % 360) - 180; this.settleNorth() }
      this.place()
      this.holdAnchor()
    }
    this.pointers.set(e.pointerId, { x: nx, y: ny })
    this.request()
  }
  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.pointers.delete(e.pointerId)
    this.pinch = this.spread()
    if (this.pointers.size === 0) { this.anchor = null; this.rotating = false; if (Math.abs(this.bearing) < 7 && this.bearing !== 0) this.bearGoal = 0 }
    if (d && this.pointers.size === 0 && e.type === 'pointerup') {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 9 && performance.now() - d.t < 500) {
        this.vel = { x: 0, y: 0 }
        const r = this.canvas.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now()
        const lt = this.lastTap
        if (lt && now - lt.t < 320 && Math.hypot(x - lt.x, y - lt.y) < 32) {
          // double tap: one step closer, toward the tapped place
          window.clearTimeout(this.tapTimer); this.lastTap = null
          this.zoomAt(0.42, x, y)
        } else {
          this.lastTap = { x, y, t: now }
          this.tapTimer = window.setTimeout(() => { this.lastTap = null; this.onTap(x, y) }, 270)
        }
      }
    }
    this.down = null
    if (performance.now() - this.lastMove > 60) this.vel = { x: 0, y: 0 }
    this.request()
  }
  private noMenu = (e: Event) => e.preventDefault()
  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const r = this.canvas.getBoundingClientRect()
    this.zoomAt(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0016), e.clientX - r.left, e.clientY - r.top)
    this.onUser()
    this.request()
  }

  /** A drag of (dx, dy) CSS px moves the focus across the sphere. */
  private pan(dx: number, dy: number) {
    const h = this.canvas.clientHeight || 1
    const perPx = (2 * this.alt * Math.tan((this.camera.fov * Math.PI) / 360)) / h // km on the ground per px
    const right = this.tmpA.set(this.camera.matrixWorld.elements[0], this.camera.matrixWorld.elements[1], this.camera.matrixWorld.elements[2])
    const up = this.tmpB.copy(this.n)
    const mv = new Vector3().addScaledVector(right, -dx * perPx).addScaledVector(up, dy * perPx / Math.max(0.35, Math.cos(this.tilt)))
    this.f.multiplyScalar(this.R).add(mv).normalize()
    this.settleNorth()
  }

  /** North up: the screen-up tangent is the pole's direction projected onto the ground at the focus. */
  private settleNorth() {
    const z = this.tmpA.set(0, 0, 1)
    const n = z.addScaledVector(this.f, -z.dot(this.f))
    if (n.lengthSq() > 1e-6) {
      this.n.copy(n.normalize())
      if (this.bearing !== 0) {
        // screen-up = north turned towards east by the bearing (east = north x focus)
        const b = (this.bearing * Math.PI) / 180
        const east = new Vector3().crossVectors(this.n, this.f)
        this.n.multiplyScalar(Math.cos(b)).addScaledVector(east, Math.sin(b)).normalize()
      }
    }
    else {
      this.n.addScaledVector(this.f, -this.n.dot(this.f))
      if (this.n.lengthSq() < 1e-9) this.n.set(0, 1, 0).addScaledVector(this.f, -this.f.y)
      this.n.normalize()
    }
  }

  // -- projection of a place onto the page --------------------------------------------------

  project(lat: number, lon: number): ProjectedPoint {
    const d = latLonToDir(lat, lon)
    const p = new Vector3(d[0] * this.R, d[1] * this.R, d[2] * this.R)
    const camLen = this.camera.position.length()
    const facing = (p.x * this.camera.position.x + p.y * this.camera.position.y + p.z * this.camera.position.z) / (this.R * camLen)
    const horizon = this.R / camLen
    const v = p.project(this.camera)
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: facing > horizon + 0.004 && v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 }
  }

  /** The place under a canvas point (CSS px), or null off the planet. */
  pick(x: number, y: number): { lat: number; lon: number } | null {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return null
    const o = this.camera.position
    const d = new Vector3((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(this.camera).sub(o).normalize()
    const b = o.dot(d), c = o.lengthSq() - this.R * this.R
    const disc = b * b - c
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    const p = o.clone().addScaledVector(d, t)
    return dirToLatLon(p.x, p.y, p.z)
  }

  /** Screen-plane direction (x right, y down, unit) from the view centre towards a place, over the globe's surface. */
  bearingOnScreen(lat: number, lon: number): { x: number; y: number } {
    const dd = latLonToDir(lat, lon)
    const q = new Vector3(dd[0], dd[1], dd[2])
    q.addScaledVector(this.f, -q.dot(this.f))
    const me = this.camera.matrixWorld.elements
    const right = new Vector3(me[0], me[1], me[2])
    const x = q.dot(right), y = -q.dot(this.n)
    const l = Math.hypot(x, y) || 1
    return { x: x / l, y: y / l }
  }

  canvasSize() { return { w: this.canvas.clientWidth, h: this.canvas.clientHeight } }

  /** The view centre and the screen-up tangent as unit vectors (for the minimap). */
  frameVectors(): { f: [number, number, number]; n: [number, number, number] } {
    return { f: [this.f.x, this.f.y, this.f.z], n: [this.n.x, this.n.y, this.n.z] }
  }

  /** Screen angle of north in degrees (0 = up, clockwise), and kilometres per CSS px at the view centre. */
  compass(): { deg: number; kmPerPx: number } {
    const me = this.camera.matrixWorld.elements
    const right = new Vector3(me[0], me[1], me[2])
    const up = new Vector3(me[4], me[5], me[6])
    const z = new Vector3(0, 0, 1)
    z.addScaledVector(this.f, -z.dot(this.f))
    const deg = z.lengthSq() < 1e-9 ? 0 : (Math.atan2(z.dot(right), z.dot(up)) * 180) / Math.PI
    const h = this.canvas.clientHeight || 1
    return { deg, kmPerPx: (2 * this.alt * Math.tan((this.camera.fov * Math.PI) / 360)) / h }
  }

  /** Kilometres between the camera's focus and a place (great circle). */
  distanceKm(lat: number, lon: number): number {
    const d = latLonToDir(lat, lon)
    return Math.acos(Math.min(1, Math.max(-1, this.f.x * d[0] + this.f.y * d[1] + this.f.z * d[2]))) * this.R
  }

  // -- loop --------------------------------------------------------------------------------

  request() {
    if (this.raf || this.disposed || !this.active) return
    this.raf = requestAnimationFrame(this.render)
  }

  private render = () => {
    this.raf = 0
    if (this.disposed) return
    const t0 = performance.now()
    let more = false
    if (this.fly) {
      const a = this.fly
      const t = Math.min(1, (t0 - a.t0) / a.ms)
      const e = t * t * (3 - 2 * t)
      this.f.copy(a.f0).lerp(a.f1, e).normalize()
      const base = Math.exp(Math.log(a.a0) + (Math.log(a.a1) - Math.log(a.a0)) * e)
      const bump = Math.log(a.peak / Math.max(a.a0, a.a1)) * Math.sin(Math.PI * t)
      this.alt = Math.min(this.maxAlt, Math.max(MAP_MIN_ALT, base * Math.exp(bump)))
      this.settleNorth()
      if (t >= 1) { const done = a.done; this.fly = null; done?.() } else more = true
    } else if (this.altGoal === null && Math.abs(this.vel.x) + Math.abs(this.vel.y) > 0.15 && this.pointers.size === 0) {
      this.pan(this.vel.x, this.vel.y)
      this.vel.x *= 0.92; this.vel.y *= 0.92
      more = true
    }
    if (this.bearGoal !== null) {
      this.bearing += (this.bearGoal - this.bearing) * 0.3
      if (Math.abs(this.bearGoal - this.bearing) < 0.25) { this.bearing = this.bearGoal; this.bearGoal = null }
      this.settleNorth(); more = true
    }
    if (this.altGoal !== null) {
      const l = Math.log(this.alt) + (Math.log(this.altGoal) - Math.log(this.alt)) * 0.3
      this.alt = Math.exp(l)
      if (Math.abs(Math.log(this.altGoal / this.alt)) < 0.003) { this.alt = this.altGoal; this.altGoal = null }
      more = true
      this.place()
      this.holdAnchor()
      if (this.altGoal === null) this.anchor = null
    }
    this.place()
    this.terrain.update(this.camera, this.canvas.clientHeight || 1, t0, this.style === 'terrain' ? this.exag() : 0)
    this.renderer.render(this.scene, this.camera)
    this.onFrame()
    const dt = performance.now() - t0
    this.frameTimes.push(dt)
    if (this.frameTimes.length > 90) this.frameTimes.shift()
    if (more || this.terrain.busy()) this.request()
  }

  private exag() {
    return 1.2 + 12.8 * s01((Math.log10(this.alt) - 0.6) / 2.7)
  }

  /** Camera pose, clip planes, haze and the sun for this frame. */
  private place() {
    const R = this.R
    const tiltWant = this.oblique ? 0.95 : 0
    this.tilt = tiltWant * (1 - s01((this.alt - 600) / 2500))
    const s = this.tmpA.copy(this.n).multiplyScalar(-1)
    const P = this.tmpB.copy(this.f).multiplyScalar(R)
    const pos = new Vector3().copy(P).addScaledVector(this.f, this.alt * Math.cos(this.tilt)).addScaledVector(s, this.alt * Math.sin(this.tilt))
    this.camera.position.copy(pos)
    this.camera.up.copy(this.n)
    this.camera.lookAt(P)
    this.camera.updateMatrixWorld()
    const camLen = pos.length()
    const horizon = Math.sqrt(Math.max(1, camLen * camLen - R * R))
    this.camera.near = Math.max(0.15, this.alt * 0.04 * Math.cos(this.tilt))
    this.camera.far = horizon + this.alt + 120
    this.camera.updateProjectionMatrix()
    // sky to space with altitude
    const sp = s01((this.alt - 250) / 2500)
    const bg = this.scene.background as Color
    bg.copy(HAZE).lerp(SPACE, sp)
    const fog = this.scene.fog as Fog
    fog.color.copy(HAZE).lerp(SPACE, Math.max(sp, 0.0))
    fog.near = this.alt * 2.2
    fog.far = Math.max(horizon * 1.05, this.alt * 6)
    const u = this.terrain.uniforms()
    u.uFogColor.value.copy(fog.color)
    u.uFogNear.value = sp > 0.9 ? 1e9 : fog.near
    u.uFogFar.value = sp > 0.9 ? 2e9 : fog.far
    const terrainLook = this.style === 'terrain'
    u.uStyle.value = terrainLook ? 1 : 0
    u.uExag.value = terrainLook ? this.exag() : 0
    // the flat map keeps a soft hillshade: relief only in the light, never in the shape
    u.uShade.value = terrainLook ? this.exag() : 2 + 12 * s01((Math.log10(this.alt) - 1.8) / 1.7)
    // a sun above the camera's left shoulder: the relief reads the same wherever you look
    const light = (u.uLight.value as Vector3)
    light.copy(this.f).multiplyScalar(0.62).addScaledVector(this.n, 0.45).addScaledVector(this.tmpA.set(this.camera.matrixWorld.elements[0], this.camera.matrixWorld.elements[1], this.camera.matrixWorld.elements[2]), -0.5).normalize()
    this.atmo.visible = this.alt > 500
    this.base.visible = true
  }

  /** Frame time (ms, CPU side of a frame) and what the renderer and terrain hold. */
  stats(): { frameMs: number; frameMax: number; calls: number; tris: number; geometries: number; textures: number; terrain: TerrainStats; alt: number } {
    const ft = this.frameTimes
    const avg = ft.length ? ft.reduce((a, b) => a + b, 0) / ft.length : 0
    const i = this.renderer.info
    return { frameMs: avg, frameMax: ft.length ? Math.max(...ft) : 0, calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, terrain: this.terrain.stats(), alt: this.alt }
  }

  dispose() {
    this.disposed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.noMenu)
    window.clearTimeout(this.tapTimer)
    this.terrain.dispose()
    this.base.geometry.dispose(); (this.base.material as MeshBasicMaterial).dispose()
    this.atmo.geometry.dispose(); (this.atmo.material as ShaderMaterial).dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
