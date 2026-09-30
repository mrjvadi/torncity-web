// Decodes the export once and gives every other builder (terrain, water,
// roads, buildings) a single shared, recentred coordinate system: raw world
// metres (from cityExportTypes.ts's coarseWorldMeters/fineWorldMeters) are
// huge numbers (tens of km) measured from the export window's own corner —
// fine for JSON, a bad idea for a three.js scene's camera/controls and
// float precision. CityGrids subtracts the city's own centre once and
// hands out SCENE metres (small numbers centred on the city) everywhere
// else in this demo.

import {
  type CityExportJSON,
  type DecodedGrid,
  coarseWorldMeters,
  decodeCoarseGrid,
  decodeFineGrid,
  fineWorldMeters,
  isWetCoarse,
  isWetFine,
} from './cityExportTypes'

export class CityGrids {
  readonly doc: CityExportJSON
  readonly coarse: DecodedGrid
  readonly fine: DecodedGrid
  /** Scene-space origin, in raw world metres — subtract from any
   * coarseWorldMeters/fineWorldMeters result to get scene metres. */
  readonly originX: number
  readonly originZ: number
  /** How far the fine terrain is cut below a river/stream/lake surface (the
   * village view carves beds so water sits in them); 0 for the export demo. */
  riverCarveM = 0
  /** The village view hands over fine heights that already meet the coarse
   * backdrop exactly at the window's edge: the demo's edge blend, lift and
   * skirt are then not applied. */
  finalFine = false

  /** `pre` supplies grids that are already decoded (the village view builds
   * them from live chunks, not from an export file) and already graded to
   * the village's own lots, so the export-city plateau grading is skipped. */
  constructor(doc: CityExportJSON, pre?: { coarse: DecodedGrid; fine: DecodedGrid }) {
    this.doc = doc
    this.coarse = pre ? pre.coarse : decodeCoarseGrid(doc)
    this.fine = pre ? pre.fine : decodeFineGrid(doc)
    // NOTE: fineWorldMeters, not cityWorldMeters — cityWorldMeters already
    // adds doc.city.originX/Y itself (it takes CITY-LOCAL coordinates), and
    // originX/size/2 below is already a FINE-GRID index, so going through
    // cityWorldMeters here would add the city offset twice and shift the
    // whole scene by ~city.originX lots off the real centre.
    const { originX, originY, size } = doc.city
    const center = fineWorldMeters(doc, originX + size / 2, originY + size / 2)
    this.originX = center.x
    this.originZ = center.z

    if (!pre) this.gradeCityFootprint()
  }

  /** Grades the fine grid's elevation to one smooth plateau under the
   * city's own lot core, blended out to real terrain over a margin beyond
   * it — real settlement grading (ADR 0028's spirit: a city site is
   * levelled once, not per building), and the only thing that keeps every
   * road/sidewalk/building base flush with the ground mesh under it. The
   * fine grid's own relief is small in a city core by construction
   * (findCitySite only accepts a flat window), but "small" is still
   * enough (a metre or two between adjacent lots) to sink a flat-topped
   * building corner half a floor into the terrain, or split a road ribbon
   * into a jagged, partly-buried strip — see the project report. Mutates
   * this.fine.elevation in place so every consumer (terrain, roads,
   * buildings, props, water) reads the SAME graded ground with no extra
   * plumbing. */
  private gradeCityFootprint() {
    const { originX, originY, size } = this.doc.city
    const w = this.fine.w
    const elev = this.fine.elevation
    let sum = 0
    let n = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        sum += elev[(originY + y) * w + (originX + x)]
        n++
      }
    }
    const plateau = n > 0 ? sum / n : 0

    const margin = 6 // lots of soft falloff beyond the city's own core
    const minX = originX - margin
    const maxX = originX + size - 1 + margin
    const minY = originY - margin
    const maxY = originY + size - 1 + margin
    for (let y = Math.max(0, minY); y <= Math.min(this.fine.h - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(w - 1, maxX); x++) {
        const dx = x < originX ? originX - x : x > originX + size - 1 ? x - (originX + size - 1) : 0
        const dy = y < originY ? originY - y : y > originY + size - 1 ? y - (originY + size - 1) : 0
        const d = Math.max(dx, dy)
        const t = 1 - Math.min(1, d / margin) // 1 at the core, 0 at margin's edge
        const blend = t * t * (3 - 2 * t) // smoothstep
        const i = y * w + x
        elev[i] = Math.round(elev[i] * (1 - blend) + plateau * blend)
      }
    }
  }

  // -- scene-space placement ----------------------------------------------

  coarseScene(i: number, j: number): { x: number; z: number } {
    const w = coarseWorldMeters(this.doc, i, j)
    return { x: w.x - this.originX, z: w.z - this.originZ }
  }

  fineScene(fx: number, fy: number): { x: number; z: number } {
    const w = fineWorldMeters(this.doc, fx, fy)
    return { x: w.x - this.originX, z: w.z - this.originZ }
  }

  cityScene(lx: number, ly: number): { x: number; z: number } {
    return this.fineScene(this.doc.city.originX + lx, this.doc.city.originY + ly)
  }

  /** The coarse-grid TILE index a fine-grid LOT sits inside — the shared
   * coordinate space both grids already agree on (fineGrid.originTileX/Y),
   * rounded to the nearest whole tile. Used to sample the coarse grid's own
   * elevation/biome at a fine cell's position, for blending the two
   * meshes together at the fine grid's own outer edge (see terrain.ts). */
  fineToCoarseTile(fx: number, fy: number): { i: number; j: number } {
    const i = Math.round(this.doc.fineGrid.originTileX + fx / this.doc.lotsPerTile)
    const j = Math.round(this.doc.fineGrid.originTileY + fy / this.doc.lotsPerTile)
    return { i, j }
  }

  // -- sampling -------------------------------------------------------------

  coarseIndex(i: number, j: number): number {
    const ci = Math.min(this.coarse.w - 1, Math.max(0, i))
    const cj = Math.min(this.coarse.h - 1, Math.max(0, j))
    return cj * this.coarse.w + ci
  }

  fineIndex(fx: number, fy: number): number {
    const ci = Math.min(this.fine.w - 1, Math.max(0, Math.round(fx)))
    const cj = Math.min(this.fine.h - 1, Math.max(0, Math.round(fy)))
    return cj * this.fine.w + ci
  }

  coarseElevAt(i: number, j: number): number {
    return this.coarse.elevation[this.coarseIndex(i, j)]
  }

  fineElevAt(fx: number, fy: number): number {
    return this.fine.elevation[this.fineIndex(fx, fy)]
  }

  /** Elevation (metres) under a city-local lot coordinate — the common
   * lookup roads/buildings need. */
  cityElevAt(lx: number, ly: number): number {
    return this.fineElevAt(this.doc.city.originX + lx, this.doc.city.originY + ly)
  }

  fineIsWet(fx: number, fy: number): boolean {
    return isWetFine(this.fine.water[this.fineIndex(fx, fy)])
  }

  coarseIsWet(i: number, j: number): boolean {
    return isWetCoarse(this.coarse.water[this.coarseIndex(i, j)])
  }

  /** Fine-grid slope magnitude (rise/run, unitless) at (fx,fy), central
   * difference over one lot — used for rock-on-steep-slope blending and
   * for keeping props off ground that is too steep to stand on. */
  fineSlopeAt(fx: number, fy: number): number {
    const lot = this.doc.lotMeters
    const hL = this.fineElevAt(fx - 1, fy)
    const hR = this.fineElevAt(fx + 1, fy)
    const hD = this.fineElevAt(fx, fy - 1)
    const hU = this.fineElevAt(fx, fy + 1)
    const dx = (hR - hL) / (2 * lot)
    const dz = (hU - hD) / (2 * lot)
    return Math.sqrt(dx * dx + dz * dz)
  }

  /** True near any wet fine cell within `radiusLots` — used for the
   * wet-soil/sand ground blend near water's edge. */
  fineNearWater(fx: number, fy: number, radiusLots: number): boolean {
    const r = Math.ceil(radiusLots)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radiusLots * radiusLots) continue
        if (this.fineIsWet(fx + dx, fy + dy)) return true
      }
    }
    return false
  }
}
