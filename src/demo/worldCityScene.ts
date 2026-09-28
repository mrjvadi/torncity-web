// The world-city demo's three.js engine, rewritten for the real coarse/fine
// export schema: real-metre terrain at two LODs, a shader water surface,
// merged realistic roads and buildings, near-camera grass and street props.
// Keeps the previous engine's proven patterns unchanged where they still
// apply: render-on-demand, a DPR cap, WebGL context-loss handling,
// preserveDrawingBuffer for screenshot/thumbnail correctness, and touch
// OrbitControls.

import {
  ACESFilmicToneMapping,
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
import { buildTerrain, GrassField, type TerrainResult } from './terrain'
import { buildWater, type WaterResult } from './water'
import { buildRoads, type RoadsResult } from './roads'
import { buildBuildings, type BuildingsResult } from './buildings'
import { buildProps, type PropsResult } from './props'
import { disposeKitAssets } from './kitAssets'

const SKY = 0xdde8da
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

  private terrain: TerrainResult | null = null
  private water: WaterResult | null = null
  private roads: RoadsResult | null = null
  private buildings: BuildingsResult | null = null
  private props: PropsResult | null = null
  private grass: GrassField | null = null

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
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = false

    // far=15000 covers the coarse backdrop from anywhere the camera can
    // reach (maxDistance below); fog (see buildLights) fades it to the
    // sky colour well before that so there is never a hard clip edge.
    this.camera = new PerspectiveCamera(45, 1, 0.4, 15000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 11 // street level
    this.controls.maxDistance = 6000 // out to the valley
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03
    this.controls.addEventListener('change', this.onControlsChange)

    this.buildLights()

    canvas.addEventListener('webglcontextlost', this.onContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.resize()
  }

  private buildLights() {
    const sun = new DirectionalLight(0xfff1d8, 2.1)
    sun.position.set(-420, 520, -260)
    this.scene.add(sun)
    const ambient = new HemisphereLight(0xb9c9ee, 0xcdd6c2, 0.75)
    this.scene.add(ambient)
    // Tuned so the ~1.5km city core reads with clear contrast and the
    // coarse backdrop only fades to sky past a few km — a portrait phone's
    // narrow horizontal FOV needs several km of camera distance to fit the
    // whole city width-on, so fog this thin is what keeps that shot from
    // reading as fogged-out rather than merely distant.
    this.scene.fog = new FogExp2(SKY, 0.00018)
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

    this.frameCamera(grids)
    this.grass?.update(this.camera.position)
    this.startWaterTicking()

    this.sceneBuilt = true
    this.requestRender()

    if (import.meta.env.DEV || new URLSearchParams(location.search).has('stats')) {
      // A debug hook for the project's own Playwright screenshot/stats
      // scripts — never referenced by the page itself.
      ;(window as unknown as { __wc?: unknown }).__wc = { scene: this.scene, camera: this.camera, renderer: this.renderer, grids, doc }
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

    // CityGrids centres the scene on the city itself, so the target is
    // simply the vertical midpoint at world X/Z = 0 (see grids.ts).
    const cy = (minY + maxY) / 2
    const target = new Vector3(0, cy, 0)
    this.controls.target.copy(target)

    const footprintMeters = (size * doc.lotMeters) / 2
    const radius = Math.sqrt(footprintMeters * footprintMeters * 2 + ((maxY - minY) / 2) ** 2) * 1.12

    // Fit by the VERTICAL fov only, not the narrower horizontal one a
    // portrait phone screen has: fitting the full 45deg-wide city corner
    // to corner into a ~22deg horizontal half-fov pushes the camera many
    // kilometres back, which reads as a hazy, tiny distant town rather
    // than the "skyline" shot the brief asks for. Letting the left/right
    // edges crop (the player can still orbit/zoom) keeps the default shot
    // close enough to actually read as a city.
    const vFov = (this.camera.fov * Math.PI) / 180
    const dist = Math.max(this.controls.minDistance, radius / Math.sin(vFov / 2))

    // A 3/4 view biased toward the city's own north edge (where the river
    // and its bridges sit in this export) so the default shot shows the
    // river, the bridges and the skyline together, as the brief asks.
    const azimuth = -0.62
    const polar = Math.PI / 3.1
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
    this.terrain?.dispose()
    this.water?.dispose()
    this.roads?.dispose()
    this.buildings?.dispose()
    this.props?.dispose()
    this.grass?.dispose()
    this.renderer.dispose()
    disposeKitAssets()
  }
}
