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

  constructor(doc: CityExportJSON) {
    this.doc = doc
    this.coarse = decodeCoarseGrid(doc)
    this.fine = decodeFineGrid(doc)
    // NOTE: fineWorldMeters, not cityWorldMeters — cityWorldMeters already
    // adds doc.city.originX/Y itself (it takes CITY-LOCAL coordinates), and
    // originX/size/2 below is already a FINE-GRID index, so going through
    // cityWorldMeters here would add the city offset twice and shift the
    // whole scene by ~city.originX lots off the real centre.
    const { originX, originY, size } = doc.city
    const center = fineWorldMeters(doc, originX + size / 2, originY + size / 2)
    this.originX = center.x
    this.originZ = center.z
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
