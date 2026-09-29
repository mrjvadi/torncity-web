// The world-city demo's three.js engine, rewritten for the real coarse/fine
// export schema: real-metre terrain at two LODs, a shader water surface,
// merged realistic roads and buildings, near-camera grass and street props.
// Keeps the previous engine's proven patterns unchanged where they still
// apply: render-on-demand, a DPR cap, WebGL context-loss handling,
// preserveDrawingBuffer for screenshot/thumbnail correctness, and touch
// OrbitControls.

import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CityExportJSON } from './cityExportTypes'
import { CityGrids } from './grids'
import { buildBoulders, buildTerrain, buildTreeClusters, GrassField, type FieldResult, type TerrainResult } from './terrain'
import { buildWater, type WaterResult } from './water'
import { buildRoads, type RoadsResult } from './roads'
import { buildBuildings, type BuildingsResult } from './buildings'
import { buildProps, type PropsResult } from './props'
import { disposeKitAssets } from './kitAssets'
import { upgradeToPhotoTextures } from './photoUpgrade'

// A light pastel daytime sky: pale blue overhead fading to a near-white
// haze at the horizon — a real gradient (buildSky below), not a flat
// fill, matching the reference images' bright, clear daylight look.
const SKY_TOP = 0x8fc3ec
const SKY_HORIZON = 0xe9f3f7
const SKY = SKY_HORIZON // fog/background colour: matches the horizon band so distant geometry fades into the dome, not a visible seam
const RECENTLY_MOVED_MS = 4000
const WATER_TICK_MS = 1000 / 30

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

  private skyTexture: CanvasTexture | null = null
  private terrain: TerrainResult | null = null
  private water: WaterResult | null = null
  private roads: RoadsResult | null = null
  private buildings: BuildingsResult | null = null
  private props: PropsResult | null = null
  private grass: GrassField | null = null
  private trees: FieldResult | null = null
  private boulders: FieldResult | null = null

  private lastMovedAt = performance.now()
  private waterClock = 0
  private waterTimer = 0
  private reducedMotion = false

  private loggedFirstFrame = false
  private sceneBuilt = false
  private loggedBuiltFrame = false
  private startedAt = performance.now()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: dpr < 1.75,
      alpha: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(dpr)
    this.renderer.setClearColor(0x000000, 0)
    this.scene.background = new Color(SKY)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.35
    this.renderer.shadowMap.enabled = false

    // far=15000 covers the coarse backdrop from anywhere the camera can
    // reach (maxDistance below); fog (see buildLights) fades it to the
    // sky colour well before that so there is never a hard clip edge.
    // near=0.4 (street-level detail) and a far plane kept as small as the
    // scene allows is what a STANDARD depth buffer needs here: a 0.4..15000
    // near/far ratio (37500:1) spends almost all of its precision in the
    // first few hundred metres and z-fights badly beyond that — real
    // buildings/roads a few hundred to low thousands of metres out were
    // silently losing the depth test against the terrain and vanishing in
    // wide shots even though their geometry was correct (see the project
    // report's debugging trail). A logarithmic depth buffer is the textbook
    // fix for this ratio, but this renderer targets an iPhone WebView on
    // WebGL1-class hardware where logarithmicDepthBuffer's extension
    // support is unreliable (it silently produced a fully blank scene when
    // tried here) — so the fix instead is keeping far close enough that the
    // ratio itself stays sane. 9000 comfortably covers maxDistance (the
    // valley zoom-out) while cutting the near/far ratio to a fifth of what
    // it was.
    this.camera = new PerspectiveCamera(45, 1, 1, 11000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 11 // street level
    this.controls.maxDistance = 10000 // out to the valley
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03
    this.controls.addEventListener('change', this.onControlsChange)

    this.skyTexture = this.buildSkyTexture()
    this.scene.background = this.skyTexture
    this.buildLights()

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.resize()
  }

  private buildLights() {
    const sun = new DirectionalLight(0xfff6e2, 2.6)
    sun.position.set(-420, 520, -260)
    this.scene.add(sun)
    // Sky-blue-from-above / warm-ground-from-below hemisphere fill — the
    // main source of the bright pastel daytime look the reference images
    // have, brighter than a single ambient light could give without
    // blowing out the sun-facing walls.
    const ambient = new HemisphereLight(SKY_TOP, 0xdcd3b8, 1.05)
    this.scene.add(ambient)
    // Tuned so the ~1.5km city core reads with clear contrast and the
    // coarse backdrop only fades to sky past a few km — a portrait phone's
    // narrow horizontal FOV needs several km of camera distance to fit the
    // whole city width-on, so fog this thin is what keeps that shot from
    // reading as fogged-out rather than merely distant.
    this.scene.fog = new FogExp2(SKY, 0.00007)
  }

  /** A vertical-gradient canvas, pale blue overhead fading to a near-white
   * horizon band, set directly as scene.background — a real gradient sky
   * instead of a flat fill. Simpler and more robust than a 3D sky-dome
   * mesh (no camera-relative geometry, no depth/render-order interaction
   * to get wrong at street level), at the cost of not itself rotating
   * with the camera's pitch — acceptable since the fog/hemisphere light
   * already carry the "bright pastel daytime" read at any angle. */
  private buildSkyTexture(): CanvasTexture {
    const w = 8
    const h = 256
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, `#${new Color(SKY_TOP).getHexString()}`)
    grad.addColorStop(0.62, `#${new Color(SKY_TOP).lerp(new Color(SKY_HORIZON), 0.6).getHexString()}`)
    grad.addColorStop(1, `#${new Color(SKY_HORIZON).getHexString()}`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.needsUpdate = true
    return tex
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

  private onControlsChange = () => {
    this.lastMovedAt = performance.now()
    this.grass?.update(this.camera.position)
    this.requestRender()
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

  // -- water animation: ~30fps, only while water exists, the tab is
  // visible, motion is not reduced, and the camera moved recently — see
  // water.ts's own doc comment. A single persistent timer that mostly
  // no-ops is simpler and cheap enough than starting/stopping timers. --
  private startWaterTicking() {
    if (this.waterTimer) return
    this.waterTimer = window.setInterval(() => {
      if (this.disposed || this.contextLost || !this.active) return
      if (!this.water?.mesh) return
      if (this.reducedMotion) return
      if (performance.now() - this.lastMovedAt > RECENTLY_MOVED_MS) return
      this.waterClock += WATER_TICK_MS / 1000
      this.water.tick(this.waterClock)
      this.water.setCamera(this.camera.position)
      this.requestRender()
    }, WATER_TICK_MS)
  }

  /** Loads the export, builds the whole scene, frames the camera, returns
   * the label overlay's own data (name/continent/river/legend). */
  async load(doc: CityExportJSON): Promise<WorldCityLabels> {
    const grids = new CityGrids(doc)

    // Each layer is independent — a bug in one (or a slow/missing kit GLB)
    // should never blank the whole scene, so every stage is wrapped and
    // logged rather than left to reject the whole load() promise.
    const stage = (name: string, fn: () => void) => {
      try {
        fn()
      } catch (e) {
        console.error(`[worldCity] ${name} failed`, e)
      }
    }
    const stageAsync = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn()
      } catch (e) {
        console.error(`[worldCity] ${name} failed`, e)
      }
    }

    stage('terrain', () => {
      this.terrain = buildTerrain(grids)
      this.scene.add(...this.terrain.objects)
    })

    stage('water', () => {
      this.water = buildWater(grids)
      if (this.water.mesh) this.scene.add(this.water.mesh)
    })

    stage('roads', () => {
      this.roads = buildRoads(grids)
      this.scene.add(...this.roads.objects)
    })

    await stageAsync('buildings', async () => {
      this.buildings = await buildBuildings(grids)
      this.scene.add(...this.buildings.objects)
    })

    await stageAsync('props', async () => {
      this.props = await buildProps(grids)
      this.scene.add(...this.props.objects)
    })

    stage('grass', () => {
      this.grass = new GrassField(grids)
      this.scene.add(this.grass.object)
    })

    await stageAsync('trees', async () => {
      this.trees = await buildTreeClusters(grids)
      this.scene.add(...this.trees.objects)
    })

    stage('boulders', () => {
      this.boulders = buildBoulders(grids)
      this.scene.add(...this.boulders.objects)
    })

    this.frameCamera(grids)
    this.grass?.update(this.camera.position)
    this.startWaterTicking()

    this.sceneBuilt = true
    this.requestRender()

    // Real photo textures load AFTER this first frame (fire-and-forget: a
    // slow/offline fetch just leaves the canvas-noise materials on screen,
    // never blocks or fails the scene) — see photoUpgrade.ts's own doc for
    // exactly what swaps in.
    if (this.terrain && this.roads && this.buildings) {
      upgradeToPhotoTextures(this.terrain, this.roads, this.buildings, () => this.requestRender())
    }

    if (import.meta.env.DEV || new URLSearchParams(location.search).has('stats')) {
      // A debug hook for the project's own Playwright screenshot/stats
      // scripts — never referenced by the page itself.
      ;(window as unknown as { __wc?: unknown }).__wc = {
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        controls: this.controls,
        grids,
        doc,
      }
    }

    return this.labelsFor(grids)
  }

  private frameCamera(grids: CityGrids) {
    const doc = grids.doc
    const size = doc.city.size
    let maxFloors = 1
    for (const lot of doc.city.lots) maxFloors = Math.max(maxFloors, lot.floors)
    const maxHeight = maxFloors * 3.2

    let minY = Infinity
    let maxY = -Infinity
    for (let ly = 0; ly <= size; ly += 4) {
      for (let lx = 0; lx <= size; lx += 4) {
        const h = grids.cityElevAt(lx, ly) * 1
        if (h < minY) minY = h
        if (h > maxY) maxY = h
      }
    }
    maxY += maxHeight

    // CityGrids centres the scene on the city itself, so the target sits
    // at world X/Z = 0 (see grids.ts). Its Y is deliberately just above
    // GROUND, not the vertical midpoint up to the tallest tower: a handful
    // of 40-floor towers pull that midpoint ~60-70m up, aiming the camera
    // near the TOP of the skyline instead of into it — the look ray then
    // clears most low/mid-rise buildings entirely and crosses empty air
    // over them, which reads as a hole punched through the middle of the
    // city (see the project report). Aiming just above the street reads
    // as a real skyline shot instead.
    const groundY = (minY + maxY - maxHeight) / 2
    const cy = groundY + 12
    const target = new Vector3(0, cy, 0)
    this.controls.target.copy(target)

    // A true bounding-sphere fit (city half-diagonal + building height) by
    // the camera's own LIMITING fov puts the whole dense city right at the
    // frame's edge; dividing by FILL backs the camera off just enough that
    // it fills ~70% of the frame instead of exactly 100%. "Limiting" fov
    // matters a lot here: a portrait phone's HORIZONTAL fov is much
    // narrower than its 45deg vertical one (aspect < 1), so a sphere sized
    // to the city's own X/Z footprint needs the narrower horizontal angle
    // to fit by width, not the vertical one — using vFov alone here once
    // silently cropped roughly the western/eastern half of the city out of
    // frame (see the project report): it fit vertically at a distance that
    // was nowhere near far enough horizontally.
    const footprintMeters = (size * doc.lotMeters) / 2
    const halfDiagonal = Math.sqrt(footprintMeters * footprintMeters * 2)
    const radius = Math.sqrt(halfDiagonal * halfDiagonal + ((maxY - groundY) / 2) ** 2) * 1.06
    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect)
    const limitingFov = Math.min(vFov, hFov)
    const FILL = 0.92
    const fitDist = radius / Math.sin(limitingFov / 2)
    const dist = Math.max(this.controls.minDistance, fitDist / FILL)

    // A 3/4 view, ~35deg above the horizon, biased toward the city's own
    // north edge (where the river and its bridges sit in this export) so
    // the default shot shows the river, the bridges and the skyline
    // together, as the brief asks.
    const azimuth = -0.62
    const polar = (90 - 35) * (Math.PI / 180)
    const offset = new Vector3(dist * Math.sin(polar) * Math.sin(azimuth), dist * Math.cos(polar), dist * Math.sin(polar) * Math.cos(azimuth))
    this.camera.position.copy(target).add(offset)
    this.controls.update()
  }

  private labelsFor(grids: CityGrids): WorldCityLabels {
    const doc = grids.doc
    const legend: { label: string; colorHex: string }[] = []
    const seen = new Set<number>()
    for (const b of grids.fine.biome) seen.add(b)
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
    if (this.waterTimer) clearInterval(this.waterTimer)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.controls.removeEventListener('change', this.onControlsChange)
    this.controls.dispose()
    this.skyTexture?.dispose()
    this.terrain?.dispose()
    this.water?.dispose()
    this.roads?.dispose()
    this.buildings?.dispose()
    this.props?.dispose()
    this.grass?.dispose()
    this.trees?.dispose()
    this.boulders?.dispose()
    this.renderer.dispose()
    disposeKitAssets()
  }
}
