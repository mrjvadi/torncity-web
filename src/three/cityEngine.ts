import {
  ACESFilmicToneMapping,
  Box3,
  Color,
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
  PCFShadowMap,
  PerspectiveCamera,
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

// the prototype's own camera (home_proto.gd `_build_world`): a Camera3D at
// (10.5, 13, 10.5) looking at the origin with a 27° (vertical) field of
// view. Copied exactly — direction, distance and FOV — instead of guessed
// at as an equivalent orthographic size, so the framing (how many lots fill
// the width, how big a building reads) matches the reference without eyeballing.
const CAM_FOV = 27
const CAM_OFFSET = new Vector3(10.5, 13, 10.5)
const CAM_DIR = CAM_OFFSET.clone().normalize()
const CAM_DIST = CAM_OFFSET.length()
// the prototype's home screen has no pinch-zoom of its own (a fixed shot);
// this is this screen's own interactive range around that same default
const MIN_DIST = 9
const MAX_DIST = 38
// home_proto.gd draws its own HUD as an overlay fading the city out behind
// two gradients on top of its own full 720x1280 canvas (the top bar and
// the dock/toast strip). Our canvas is already sized to just the space
// between the HUD and the dock by the surrounding flex layout (they are
// separate siblings, not an overlay drawn on top of a full-screen canvas),
// so the two apps exclude their chrome by different mechanisms and the
// prototype's own gradient extents (soft fades, not hard cutoffs) don't
// translate into a crop fraction directly — this pair is tuned instead by
// comparing renders against the reference screenshot, the same way the
// prototype's own gradient sizes were themselves picked by eye.
const SAFE_FRAC = 0.8
const SAFE_TOP_FRAC = 0.12
const HALF_FOV_TAN = Math.tan(MathUtils.degToRad(CAM_FOV / 2))
// the light, soft daytime mood (home_proto.gd's WorldEnvironment/lights),
// not the dusk-void one this screen used to have
const SKY = 0xdde8da
// shadows are the one part of this scene with a real GPU-memory cost (a
// depth texture plus an extra draw per shadow-casting object); a phone the
// OS already reports as memory-constrained skips them from the start, and
// a context loss — the actual symptom low GPU memory produces on an iPhone —
// turns them off for the rest of the session rather than risk losing the
// context again on the next frame
const LOW_MEMORY_GB = 4
function isLowMemoryDevice(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof mem === 'number' && mem <= LOW_MEMORY_GB
}
const DEV = import.meta.env.DEV

type LibraryEntry = { parts: import('../api/types').ModelPart[] }

export class CityEngine {
  private canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera: PerspectiveCamera
  private target = new Vector3(0, 0, 0)
  private distance = CAM_DIST
  private bounds = { minX: -4, maxX: 20, minZ: -4, maxZ: 20 }
  private shadowsEnabled = !isLowMemoryDevice()
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
  private sun!: DirectionalLight

  // pan/zoom pointer state
  private pointers = new Map<number, { x: number; y: number }>()
  private lastPan: { x: number; y: number } | null = null
  private velocity = { x: 0, z: 0 }
  private pinchStartDist = 0
  private pinchStartDistance = CAM_DIST
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
      // WebKit's software GL path renders a blank canvas for alpha:false
      // contexts (a real Safari/WebKit bug, not just a style choice), so
      // this stays alpha:true — the light sky colour that replaces the old
      // dark void is painted as a real scene.background below instead,
      // which always draws regardless of that quirk.
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x000000, 0)
    this.scene.background = new Color(SKY)
    // free, one-time colour grading (no extra draw calls): a filmic tone
    // curve so the bright daytime lighting rolls off instead of clipping.
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.32
    // one directional light casting soft shadows (proto's DirectionalLight3D
    // has shadow_enabled=true) — a single 1k shadow map is cheap enough for
    // most phones and is the one thing that reads as "grounded" the flat
    // instanced tiles otherwise can't give the scene; skipped from the start
    // on a phone that already reports itself as memory-constrained.
    this.renderer.shadowMap.enabled = this.shadowsEnabled
    // three 0.186 folded the old "soft" variant into this one (percentage-
    // closer filtering is always on for a directional light's shadow map)
    this.renderer.shadowMap.type = PCFShadowMap

    this.camera = new PerspectiveCamera(CAM_FOV, 1, 0.5, 200)
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
    // a context loss is itself the symptom low GPU memory produces on an
    // iPhone; shadows are the one extra depth texture and per-object draw
    // this scene asks for, so they go off for the rest of the session
    // rather than risk losing the context again on the very next frame —
    // renderer.shadowMap.enabled gates the whole feature at the shader
    // level, so no per-mesh flag needs touching to make this take effect
    if (this.shadowsEnabled) {
      this.shadowsEnabled = false
      this.renderer.shadowMap.enabled = false
    }
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

  // The sky is the renderer's own clear colour, not a 3D sphere: an
  // orthographic camera's rays are all parallel, so a world-space sky sphere
  // renders as a few flat, hard-edged bands instead of a smooth gradient.
  // A flat clear colour is also one less mesh to draw every frame — better
  // for an iPhone's battery too, and it makes the canvas fully opaque so no
  // dark page background can ever show through at the grid's edge.

  private buildLights() {
    // proto's DirectionalLight3D: light_color #FFB27A, tilted sun; here it
    // also casts the scene's only shadows (soft, one 1k map)
    this.sun = new DirectionalLight(0xffc98a, 2.1)
    this.sun.castShadow = this.shadowsEnabled
    // at most 1024: a bigger shadow map is the single biggest extra chunk of
    // GPU memory this scene could ask for, and that budget is exactly what
    // caused WebGL context loss on iPhones before
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.bias = -0.0012
    this.sun.shadow.normalBias = 0.025
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 50
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    // proto's Environment.ambient_light_color/energy (#7F8FD0 @ 0.55): a
    // near-flat hemisphere (sky and ground close in both hue and value, not
    // the old dark-navy ground) so every surface — including walls and
    // undersides — reads bright and cool rather than half-lit
    const ambient = new HemisphereLight(0xb9c3ee, 0xd9deef, 1.5)
    this.scene.add(ambient)
    // a light, barely-there haze (proto's fog_light_color/fog_density),
    // toned to the sky colour instead of dusk navy so distant tiles fade
    // into the same soft daytime mood rather than a dark void
    this.scene.fog = new FogExp2(SKY, 0.01)
  }

  /** Re-aims the sun and its shadow camera at the city's own centre once the
   * grid is known (loadCity): a directional light's shadow only depends on
   * direction, but its shadow *camera* is a real frustum that has to be
   * sized and centred on the ground it needs to cover. */
  private positionSun(center: Vector3, gridW: number, gridH: number) {
    this.sun.position.set(center.x - 10, center.y + 16, center.z - 8)
    this.sun.target.position.copy(center)
    this.sun.target.updateMatrixWorld()
    const half = Math.max(gridW, gridH) / 2 + 5
    const cam = this.sun.shadow.camera
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.updateProjectionMatrix()
  }

  /** A handful of flat, cheap cloud-shadow blobs drifting slowly over the
   * city — the only thing in the scene that ever moves on its own. They
   * tick a few times a second, not every frame: a cloud does not need 60fps
   * to look like it is drifting, and this keeps the "idle life" from
   * fighting the render-on-demand battery saving. */
  private buildClouds() {
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshBasicMaterial({ color: 0x6a7098, transparent: true, opacity: 0.07, depthWrite: false })
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
    const pos = this.target.clone().addScaledVector(CAM_DIR, this.distance)
    this.camera.position.copy(pos)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(this.target)
  }

  /** Aspect and the HUD/dock lens-shift only change on a resize — zooming
   * (setDistance) only ever moves the camera along CAM_DIR, via placeCamera. */
  private updateProjection() {
    const w = this.canvas.clientWidth
    const h = Math.max(1, this.canvas.clientHeight)
    this.camera.aspect = w / h
    this.camera.fov = CAM_FOV
    // crop the full 27° cone down to the proto's own safe band (see
    // PROTO_CANVAS_H/SAFE_* above): a virtual frame SAFE_FRAC taller than
    // our actual canvas, of which our canvas shows the slice starting
    // SAFE_TOP_FRAC down — a real lens-shift (setViewOffset forces
    // camera.aspect to fullWidth/fullHeight as a side effect, but the
    // *rendered* image's angular aspect still works out to fullWidth/h
    // divided by the same crop fraction applied to both axes, i.e. back to
    // w/h — fullWidth is kept equal to w precisely so nothing crops
    // horizontally, only vertically), so the ground plane itself is never
    // stretched or skewed to fake this, only cropped
    const fullH = h / SAFE_FRAC
    this.camera.setViewOffset(w, fullH, 0, fullH * SAFE_TOP_FRAC, w, h)
    this.camera.updateProjectionMatrix()
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.updateProjection()
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
    // the prototype's own default zoom (CAM_DIST), no matter how big the
    // city behind it is — the dense filler tiles carry the composition past
    // the edge of frame, so this never grows with the server's grid
    this.setDistance(CAM_DIST)
    this.placeCamera()
    this.positionSun(this.target, cityMap.grid.w, cityMap.grid.h)

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
    // a light mint base (the grass models' own bright green, not the old
    // dark-forest tone) so any sliver that peeks between tiles still reads
    // as the same soft daytime lawn
    const mat = new MeshLambertMaterial({ color: 0xcdeec6 })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(cityMap.grid.w / 2, -0.03, cityMap.grid.h / 2)
    mesh.receiveShadow = true
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
    const lamp = await starterGeometry('road-straight-lightposts')
    const cross = await starterGeometry('road-intersection')
    if (this.disposed) return
    if (!straight || !cross) {
      this.buildFlatRoads(cityMap)
      return
    }
    const straightMesh = new InstancedMesh(straight.geometry, straight.material, cityMap.roads.length)
    // the prototype alternates a lit lamppost tile into every other straight
    // stretch (home_proto.gd `_tile_at`'s (abs(x)+abs(z))%2==0); the model's
    // own baked bulb reads as lit without a runtime light, so this costs one
    // extra draw call, not a per-lamp light on a phone's budget
    const lampMesh = lamp ? new InstancedMesh(lamp.geometry, lamp.material, cityMap.roads.length) : null
    const crossMesh = new InstancedMesh(cross.geometry, cross.material, cityMap.roads.length)
    let ns = 0
    let nl = 0
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
        if (lampMesh && (x + y) % 2 === 0) lampMesh.setMatrixAt(nl++, m)
        else straightMesh.setMatrixAt(ns++, m)
      }
    }
    straightMesh.count = ns
    crossMesh.count = nc
    straightMesh.instanceMatrix.needsUpdate = true
    crossMesh.instanceMatrix.needsUpdate = true
    straightMesh.receiveShadow = true
    crossMesh.receiveShadow = true
    this.scene.add(straightMesh, crossMesh)
    if (lampMesh) {
      lampMesh.count = nl
      lampMesh.instanceMatrix.needsUpdate = true
      lampMesh.receiveShadow = true
      this.scene.add(lampMesh)
    }
    this.requestRender()
  }

  private buildFlatRoads(cityMap: CityMap) {
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    // a light neutral grey (not the old dark slate) so an offline city
    // without the Starter Kit loaded still reads as the same bright street
    const mat = new MeshLambertMaterial({ color: 0xd7d6d0 })
    const mesh = new InstancedMesh(geo, mat, cityMap.roads.length)
    mesh.receiveShadow = true
    const m = new Matrix4()
    cityMap.roads.forEach(([x, y], i) => {
      m.makeTranslation(x + 0.5, 0.005, y + 0.5)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
    this.requestRender()
  }

  // the prototype's own `_tile_at` weighting for a cell that is not on a
  // road, not a real plot and not the plaza: eight of ten hash slots a
  // lilac Kenney house, two a conifer cluster — copied verbatim (down to
  // the repeated a/b/c entries) rather than re-balanced, since that 80/20
  // split between building and tree is what makes the reference read as a
  // packed town instead of a park with buildings in it
  private static readonly TILE_TABLE = [
    'building-small-a', 'building-small-b', 'building-small-c', 'building-small-d',
    'building-garage', 'grass-trees', 'building-small-a', 'building-small-c',
    'grass-trees-tall', 'building-small-b',
  ]

  /** Every ground cell a road or a real plot does not cover, filled exactly
   * the way the prototype's own `_tile_at` fills its 9x9 block: a small
   * paved plaza (with a fountain) at the two cells diagonally off the road
   * hub nearest the grid's centre — `_tile_at`'s own (1,1)/(1,-1)/(-1,1)/
   * (-1,-1) cells around its origin intersection, generalised to whichever
   * intersection sits closest to the middle of the server's own grid — and
   * everywhere else the TILE_TABLE hash above. This is the single thing
   * that makes even a city with a handful of real plots read as dozens of
   * buildings packed along the roads: one InstancedMesh per model kind
   * (six or seven total, buildings and trees alike), so the draw-call count
   * stays flat no matter how many cells the hash fills. */
  private async buildGreenery(cityMap: CityMap) {
    const taken = new Set(cityMap.roads.map(([x, y]) => `${x},${y}`))
    for (const p of cityMap.plots) {
      for (let dx = 0; dx < p.w; dx++) {
        for (let dy = 0; dy < p.h; dy++) taken.add(`${p.x + dx},${p.y + dy}`)
      }
    }
    const roadCells = new Set(cityMap.roads.map(([x, y]) => `${x},${y}`))

    // the road cell nearest the grid's centre stands in for `_tile_at`'s
    // own origin intersection; its diagonal neighbours (off the road, off
    // any real plot) become the plaza, one of them the fountain
    const cx = cityMap.grid.w / 2
    const cz = cityMap.grid.h / 2
    let hub: [number, number] | null = null
    let hubBest = Infinity
    for (const [x, y] of cityMap.roads) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cz) ** 2
      if (d < hubBest) { hubBest = d; hub = [x, y] }
    }
    const plazaSpots: [number, number][] = []
    let fountainAt: [number, number] | null = null
    if (hub) {
      const [hx, hy] = hub
      for (const [x, y] of [[hx + 1, hy + 1], [hx + 1, hy - 1], [hx - 1, hy + 1], [hx - 1, hy - 1]] as const) {
        if (x < 0 || y < 0 || x >= cityMap.grid.w || y >= cityMap.grid.h) continue
        const key = `${x},${y}`
        if (taken.has(key) || roadCells.has(key)) continue
        if (!fountainAt) fountainAt = [x, y]
        else plazaSpots.push([x, y])
        taken.add(key)
      }
    }

    const fillSpots: [number, number][] = []
    for (let x = 0; x < cityMap.grid.w; x++) {
      for (let y = 0; y < cityMap.grid.h; y++) {
        if (taken.has(`${x},${y}`)) continue
        fillSpots.push([x, y])
      }
    }
    if (fillSpots.length === 0 && plazaSpots.length === 0 && !fountainAt) return

    const identity = new Quaternion()
    const m = new Matrix4()

    const pavement = await starterGeometry('pavement')
    if (pavement && !this.disposed && plazaSpots.length > 0) {
      const mesh = new InstancedMesh(pavement.geometry, pavement.material, plazaSpots.length)
      plazaSpots.forEach(([x, y], i) => {
        m.compose(new Vector3(x + 0.5, 0, y + 0.5), identity, new Vector3(1, 1, 1))
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
      this.requestRender()
    }
    if (fountainAt && !this.disposed) {
      const fountain = await cloneStarter('pavement-fountain')
      if (fountain && !this.disposed) {
        fountain.position.set(fountainAt[0] + 0.5, 0, fountainAt[1] + 0.5)
        fountain.traverse((o) => { const mm = o as Mesh; if (mm.isMesh) { mm.receiveShadow = true; mm.castShadow = this.shadowsEnabled } })
        this.scene.add(fountain)
        this.requestRender()
      }
    }

    // `_place` always drops a non-road tile at rot=0 — the kit's own models
    // already face the street — so every filler tile here does too
    const byName = new Map<string, [number, number][]>()
    for (const [x, y] of fillSpots) {
      const h = Math.abs((x * 73856093) ^ (y * 19349663)) % 10
      const name = CityEngine.TILE_TABLE[h]
      const arr = byName.get(name)
      if (arr) arr.push([x, y])
      else byName.set(name, [[x, y]])
    }
    for (const [name, spots] of byName) {
      const tile = await starterGeometry(name)
      if (!tile || this.disposed) continue
      const mesh = new InstancedMesh(tile.geometry, tile.material, spots.length)
      spots.forEach(([x, y], i) => {
        m.compose(new Vector3(x + 0.5, 0, y + 0.5), identity, new Vector3(1, 1, 1))
        mesh.setMatrixAt(i, m)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.receiveShadow = true
      mesh.castShadow = this.shadowsEnabled
      this.scene.add(mesh)
      this.requestRender()
    }
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
    // a soft pastel turquoise, not the old dark navy sea
    const mat = new MeshLambertMaterial({ color: 0x9fdfe3, transparent: true, opacity: 0.88 })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(x, -0.015, z)
    mesh.receiveShadow = true
    this.scene.add(mesh)
  }

  private buildPlotBases(cityMap: CityMap) {
    if (cityMap.plots.length === 0) return
    const geo = new PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    // a quiet kerb/pavement pad under every building, not a category colour:
    // the building itself (procedural or modelled) now carries that read
    const mat = new MeshLambertMaterial({ color: 0xe4e0d6 })
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
    mesh.receiveShadow = true
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
    this.addMerged(cityOpaque, new MeshLambertMaterial({ vertexColors: true }), true)
    this.addMerged(cityGlow, new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), false)
  }

  private addMerged(geometries: BufferGeometry[], material: Material, shadowed: boolean) {
    if (geometries.length === 0) return
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((g) => g.dispose())
    if (!merged) return
    const mesh = new Mesh(merged, material)
    mesh.castShadow = shadowed && this.shadowsEnabled
    mesh.receiveShadow = shadowed
    this.scene.add(mesh)
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
      mesh.castShadow = this.shadowsEnabled
      mesh.receiveShadow = true
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
        instance.traverse((o) => { const mm = o as Mesh; if (mm.isMesh) { mm.castShadow = this.shadowsEnabled; mm.receiveShadow = true } })
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
    // a world bubble (shift-ready, course-done...) already names and marks
    // its own plot; a name label on the same spot only doubles it up, so a
    // plot with a bubble on it skips its label entirely rather than the two
    // fighting for the same few pixels
    const bubbledPlots = new Set(this.bubbleAnchors.map((a) => `${a.x.toFixed(2)},${a.z.toFixed(2)}`))
    const labels: LabelPoint[] = this.placeLabels.map(({ plot, world }) => {
      const p = world.clone().project(this.camera)
      const onBubble = bubbledPlots.has(`${world.x.toFixed(2)},${world.z.toFixed(2)}`)
      const visible = p.z < 1 && !onBubble
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
      this.pinchStartDistance = this.distance
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
        this.setDistance(this.pinchStartDistance * factor)
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
    this.setDistance(this.distance * (1 + e.deltaY * 0.001))
    this.requestRender()
  }

  private pan(dxPx: number, dyPx: number) {
    // a perspective camera's world-per-pixel varies with depth; the target's
    // own distance is the right approximation for how a drag near the
    // camera's look-at point should feel, same as most map/city UIs do
    const worldPerPx = (2 * this.distance * HALF_FOV_TAN) / Math.max(1, this.canvas.clientHeight)
    // screen right/down -> move target opposite, along camera's local right/forward on the ground plane
    const right = new Vector3(1, 0, -1).normalize()
    const fwd = new Vector3(-1, 0, -1).normalize()
    this.target.addScaledVector(right, -dxPx * worldPerPx)
    this.target.addScaledVector(fwd, dyPx * worldPerPx)
    this.target.x = clamp(this.target.x, this.bounds.minX, this.bounds.maxX)
    this.target.z = clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ)
    this.placeCamera()
  }

  private setDistance(v: number) {
    this.distance = clamp(v, MIN_DIST, MAX_DIST)
    this.placeCamera()
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
