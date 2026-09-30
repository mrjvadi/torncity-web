// Turns the live world (decoded chunks) plus a settlement's layout into the
// two grids the terrain/water/grass builders of src/demo already know how to
// draw: a coarse backdrop at tile resolution (~305 m) and a fine grid at lot
// resolution (30.54 m) centred on the village. Both live in one local
// east/north frame around the village (no planet curvature at this scale).
//
// The village's own lots are the truth: the fine grid holds each lot's
// `height_m` and water exactly as the server's layout says, and the ground
// around it is the chunk terrain nudged so it meets those heights without a
// step. Everything else that stands on the ground (buildings, roads, trees)
// asks `groundY` here, which is the very triangle the rendered mesh draws.

import type { VillageLayout, WorldInfo } from '../api/types'
import type { CityExportJSON, DecodedGrid } from '../demo/cityExportTypes'
import {
  TILE_FLAG_LAKE, TILE_FLAG_OCEAN, TILE_FLAG_STREAM,
  WATER_KIND_LAKE, WATER_KIND_NONE, WATER_KIND_OCEAN, WATER_KIND_RIVER, WATER_KIND_STREAM,
} from '../demo/cityExportTypes'
import { CityGrids } from '../demo/grids'
import { FINE_GROUND_LIFT } from '../demo/terrain'
import { offsetLatLon } from './geo'
import type { WorldSampler } from './worldSampler'

/** The fine window is FINE_TILES coarse tiles wide (1.8 km) and its edges lie exactly
 * on coarse vertex lines, so the coarse backdrop's hole is that same square and the
 * two meshes meet vertex to vertex; the backdrop is COARSE_TILES tiles (19.5 km). A
 * phone draws ~13k triangles for both. */
export const FINE_TILES = 6
export const COARSE_TILES = 64
/** Ground mesh vertices per lot edge (a lot centre is always one of them). */
export const GROUND_SUB = 3
/** Below this a sea floor is not worth drawing deeper (the water hides it). */
const MIN_ELEV_M = -30
/** How far river/lake beds sit under their water. */
export const RIVER_CARVE_M = 1.4
/** Lots over which the chunk terrain is bent to meet the village's own heights. */
const BLEND_LOTS = 7
/** Lots in from the window's edge over which the fine heights ease onto the coarse
 * surface (it is exactly that surface on the edge itself). */
const EDGE_BLEND_LOTS = 18
/** Lakes are not drawn this close to the window's edge (the backdrop has none). */
const LAKE_EDGE_MARGIN_LOTS = 10
/** Deepest a lake bed lies under its level, and how quickly it falls off the shore. */
const LAKE_MAX_DEPTH_M = 3.2
const LAKE_SHORE_DEPTH_M = 0.9
const LAKE_DEPTH_PER_LOT_M = 0.5
/** A lake level sits this far under its lowest bank. */
const LAKE_FREEBOARD_M = 0.3
/** How many lots a stream or river running into the village's water is followed as a lobe of it. */
const LOBE_LOTS = 1
const STREAM_HALF_WIDTH = 0.11 // in tiles

const smooth = (t: number) => t * t * (3 - 2 * t)

export interface VillageGround {
  grids: CityGrids
  lot: number
  n: number
  originX: number
  originY: number
  /** Ground height (scene metres) under a scene x/z: the fine mesh's own triangle. */
  groundY(x: number, z: number): number
  /** Scene x/z of the middle of lot (x, y) (y grows north). */
  lotCentre(x: number, y: number): { x: number; z: number }
  /** The lot under a scene x/z, or null outside the village grid. */
  lotAt(x: number, z: number): { x: number; y: number } | null
  /** Vertices per lot edge of the ground mesh, and the height grid it is drawn from
   * (raw metres, without FINE_GROUND_LIFT): (F-1)*SUB+1 squared, row-major, with the
   * server's lot heights exactly at every SUB-th vertex. */
  sub: { N: number; SUB: number; heights: Float32Array; x0: number; z0: number; stepX: number; stepZ: number }
  /** Water at a lot of the village. */
  isWaterLot(x: number, y: number): boolean
  /** Standing-water level of the lake a scene position belongs to (one flat surface per
   * lake, under its lowest bank), or null when no lake reaches there. Includes a one
   * lot ring past the water's own lots so shores can be told from dry land. */
  lakeLevelAt(x: number, z: number): number | null
  /** The same per ground-mesh vertex (NaN where no lake): N*N like `sub.heights`. */
  lakeSub: Float32Array
  /** Lowest/highest mesh height across a scene-space rectangle. */
  span(x0: number, z0: number, x1: number, z1: number): { min: number; max: number }
}

/** Builds the ground once the chunks it needs have arrived. */
export async function loadVillageGround(world: WorldInfo, layout: VillageLayout, sampler: WorldSampler): Promise<VillageGround> {
  const lot = world.lot_m
  const tile = world.tile_m
  const lpt = world.lots_per_tile
  const n = layout.grid.lots
  const F = FINE_TILES * lpt + 1
  const C = COARSE_TILES
  const originX = Math.floor((F - n) / 2)
  const originY = Math.floor((F - n) / 2)
  // integer: fine vertex 0 and F-1 both lie on coarse vertex lines
  const originTileX = C / 2 - FINE_TILES / 2
  const originTileY = originTileX
  const radius = world.planet_radius_km
  const o = layout.grid.origin

  const latLonOfLotSpace = (lx: number, ly: number) => offsetLatLon(o.lat, o.lon, lx * lot, ly * lot, radius)
  // fine cell -> lot-space coordinates (y north)
  const fineToLotSpace = (fx: number, fy: number) => ({ lx: fx - originX, ly: n - 1 - (fy - originY) })

  // biome legend by index
  const maxIdx = world.biomes.reduce((m, b) => Math.max(m, b.index), 0)
  const legend: { code: string; colorHex: string }[] = []
  for (let i = 0; i <= maxIdx; i++) legend.push({ code: 'unknown', colorHex: '8fae6d' })
  for (const b of world.biomes) legend[b.index] = { code: b.code, colorHex: b.color.replace('#', '') }
  const biomeIndex = new Map(world.biomes.map((b) => [b.code, b.index]))

  // -- what the sampler needs to have fetched --------------------------------
  const lattice: { lat: number; lon: number }[] = []
  const half = (C / 2) * tile + tile
  for (let a = -2; a <= 2; a++) {
    for (let b = -2; b <= 2; b++) {
      const east = (a / 2) * half
      const north = (b / 2) * half
      lattice.push(offsetLatLon(o.lat, o.lon, east + ((n - 1) / 2) * lot, north + ((n - 1) / 2) * lot, radius))
    }
  }
  await sampler.prefetch(lattice)

  {
    // -- coarse ---------------------------------------------------------------
    const cElev = new Int16Array(C * C)
    const cBiome = new Uint8Array(C * C)
    const cFlags = new Uint8Array(C * C)
    for (let j = 0; j < C; j++) {
      for (let i = 0; i < C; i++) {
        const fx = (i - originTileX) * lpt
        const fy = (j - originTileY) * lpt
        const { lx, ly } = fineToLotSpace(fx, fy)
        const ll = latLonOfLotSpace(lx, ly)
        const s = sampler.sample(ll.lat, ll.lon)
        const k = j * C + i
        cElev[k] = Math.max(MIN_ELEV_M, Math.round(s.elev))
        cBiome[k] = s.biome
        // a lake outside the fine window would be filled by the demo's flat patch at its rim height, floating
        // over the slopes between: the backdrop keeps ocean and streams only, lakes are the fine grid's
        cFlags[k] = s.flags & ~TILE_FLAG_LAKE
      }
    }
    const coarse: DecodedGrid = { w: C, h: C, elevation: cElev, biome: cBiome, water: cFlags }

    /** The backdrop's own surface at a fine position: the two triangles per coarse cell
     * the coarse mesh draws (diagonal from (i+1, j) to (i, j+1)). */
    const coarseSurf = (fx: number, fy: number): number => {
      const ti = originTileX + fx / lpt, tj = originTileY + fy / lpt
      const i = Math.max(0, Math.min(C - 2, Math.floor(ti + 1e-9)))
      const j = Math.max(0, Math.min(C - 2, Math.floor(tj + 1e-9)))
      const u = Math.max(0, Math.min(1, ti - i)), v = Math.max(0, Math.min(1, tj - j))
      const a = cElev[j * C + i], b = cElev[j * C + i + 1], c = cElev[(j + 1) * C + i], d = cElev[(j + 1) * C + i + 1]
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (b - d) * (1 - v) + (c - d) * (1 - u)
    }

    // -- fine, from the chunks ------------------------------------------------
    const fElev = new Float32Array(F * F)
    const fBiome = new Uint8Array(F * F)
    const fWater = new Uint8Array(F * F)
    const base = new Float32Array(F * F)
    for (let fy = 0; fy < F; fy++) {
      for (let fx = 0; fx < F; fx++) {
        const { lx, ly } = fineToLotSpace(fx, fy)
        const ll = latLonOfLotSpace(lx, ly)
        const s = sampler.sample(ll.lat, ll.lon)
        const k = fy * F + fx
        base[k] = s.elev
        fElev[k] = Math.max(MIN_ELEV_M, s.elev)
        fBiome[k] = s.biome
        fWater[k] = waterKindOf(sampler, s)
      }
    }

    // -- the village's own lots ------------------------------------------------
    // delta of each lot: its server height against what the chunks say there
    const delta = new Float32Array(n * n)
    const lotWater = new Uint8Array(n * n)
    const lotHeight = new Float32Array(n * n)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const l = layout.lots[y]?.[x]
        const fx = originX + x
        const fy = originY + (n - 1 - y)
        const k = fy * F + fx
        if (!l) { delta[y * n + x] = 0; lotHeight[y * n + x] = fElev[k]; continue }
        const h = Math.max(MIN_ELEV_M, l.height_m)
        lotHeight[y * n + x] = h
        delta[y * n + x] = h - base[k]
        const wk = l.water === 'ocean' ? WATER_KIND_OCEAN : l.water === 'lake' ? WATER_KIND_LAKE : l.water === 'river' ? WATER_KIND_RIVER : l.water === 'stream' ? WATER_KIND_STREAM : WATER_KIND_NONE
        lotWater[y * n + x] = wk
        const bi = biomeIndex.get(l.biome)
        if (bi !== undefined) fBiome[k] = bi
      }
    }
    // outside the block: bend the chunk terrain by the nearest lot's delta,
    // fading over BLEND_LOTS; inside: the lot's own numbers
    const inBlock = (fx: number, fy: number) => fx >= originX && fx < originX + n && fy >= originY && fy < originY + n
    for (let fy = 0; fy < F; fy++) {
      for (let fx = 0; fx < F; fx++) {
        const cx = Math.min(originX + n - 1, Math.max(originX, fx))
        const cy = Math.min(originY + n - 1, Math.max(originY, fy))
        const d = Math.max(Math.abs(fx - cx), Math.abs(fy - cy))
        const k = fy * F + fx
        if (d === 0) {
          const x = fx - originX
          const y = n - 1 - (fy - originY)
          fElev[k] = lotHeight[y * n + x]
          // a river or stream the server marks on a lot of the block is standing water there (the block
          // is 150 m: one flat surface, like a lake); beyond the block the chunks' own ribbons continue
          const wk = lotWater[y * n + x]
          fWater[k] = wk === WATER_KIND_RIVER || wk === WATER_KIND_STREAM ? WATER_KIND_LAKE : wk
        } else if (d <= BLEND_LOTS) {
          const x = cx - originX
          const y = n - 1 - (cy - originY)
          const w = 1 - smooth(d / (BLEND_LOTS + 1))
          fElev[k] = Math.max(MIN_ELEV_M, base[k] + delta[y * n + x] * w)
        }
      }
    }
    // Streams and rivers of the chunks are one lot wide: too thin to draw as water at this resolution
    // and, on a slope, a tilted sheet. Where they run into the village's own water they are its
    // lobes (a few lots, standing water at the same level); everywhere else they are not drawn.
    {
      const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const
      const isRun = (k: number) => fWater[k] === WATER_KIND_STREAM || fWater[k] === WATER_KIND_RIVER
      let frontier: number[] = []
      for (let k = 0; k < F * F; k++) if (fWater[k] === WATER_KIND_LAKE) frontier.push(k)
      for (let step = 0; step < LOBE_LOTS && frontier.length; step++) {
        const next: number[] = []
        for (const c of frontier) {
          const cx = c % F, cy = (c - cx) / F
          for (const [dx, dy] of N8) {
            const nx = cx + dx, ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= F || ny >= F) continue
            const k = ny * F + nx
            if (!isRun(k)) continue
            fWater[k] = WATER_KIND_LAKE
            next.push(k)
          }
        }
        frontier = next
      }
      for (let k = 0; k < F * F; k++) if (isRun(k)) fWater[k] = WATER_KIND_NONE
    }
    const edgeDist = (fx: number, fy: number) => Math.min(fx, fy, F - 1 - fx, F - 1 - fy)

    // -- lakes -----------------------------------------------------------------
    // A lake is one flat surface at the height of its lowest bank, the bed a bowl under it
    // that deepens away from the shore; a bank the chunks left lower than that (a lake
    // wider than its rim) is raised to hold it. The village's own land lots keep the
    // server's heights, so buildings never move.
    const lakeLevel = new Float32Array(F * F).fill(NaN) // over the lake's own lots
    for (let fy = 0; fy < F; fy++) for (let fx = 0; fx < F; fx++) {
      if (edgeDist(fx, fy) < LAKE_EDGE_MARGIN_LOTS && fWater[fy * F + fx] === WATER_KIND_LAKE) fWater[fy * F + fx] = WATER_KIND_NONE
    }
    const seen = new Uint8Array(F * F)
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const
    for (let start = 0; start < F * F; start++) {
      if (seen[start] || fWater[start] !== WATER_KIND_LAKE) continue
      const cells: number[] = [start]
      seen[start] = 1
      for (let q = 0; q < cells.length; q++) {
        const c = cells[q]
        const cx = c % F, cy = (c - cx) / F
        for (const [dx, dy] of N8) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= F || ny >= F) continue
          const k = ny * F + nx
          if (seen[k] || fWater[k] !== WATER_KIND_LAKE) continue
          seen[k] = 1
          cells.push(k)
        }
      }
      // bank: dry lots touching the lake, and how far each lake lot is from one
      const dist = new Map<number, number>()
      const bank: number[] = []
      let frontier: number[] = []
      for (const c of cells) {
        const cx = c % F, cy = (c - cx) / F
        let shore = false
        for (const [dx, dy] of N4) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= F || ny >= F) continue
          const k = ny * F + nx
          if (fWater[k] === WATER_KIND_NONE) { shore = true; if (!bank.includes(k)) bank.push(k) }
        }
        if (shore) { dist.set(c, 1); frontier.push(c) }
      }
      for (let d = 1; frontier.length; d++) {
        const next: number[] = []
        for (const c of frontier) {
          const cx = c % F, cy = (c - cx) / F
          for (const [dx, dy] of N4) {
            const nx = cx + dx, ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= F || ny >= F) continue
            const k = ny * F + nx
            if (fWater[k] !== WATER_KIND_LAKE || dist.has(k)) continue
            dist.set(k, d + 1)
            next.push(k)
          }
        }
        frontier = next
      }
      const heights = cells.map((c) => fElev[c]).sort((a, b) => a - b)
      const median = heights[Math.floor(heights.length / 2)]
      let level: number
      if (bank.length) {
        const lowest = Math.min(...bank.map((k) => fElev[k]))
        level = Math.max(lowest - LAKE_FREEBOARD_M, median - 3)
        for (const k of bank) {
          const bx = k % F, by = (k - bx) / F
          if (!inBlock(bx, by) && fElev[k] < level + 0.5) fElev[k] = level + 0.5
        }
      } else level = median
      for (const c of cells) {
        const d = dist.get(c) ?? 1
        fElev[c] = level - Math.min(LAKE_MAX_DEPTH_M, LAKE_SHORE_DEPTH_M + (d - 1) * LAKE_DEPTH_PER_LOT_M)
        lakeLevel[c] = level
      }
    }
    // beds under rivers and streams
    for (let k = 0; k < F * F; k++) {
      const w = fWater[k]
      if (w === WATER_KIND_RIVER || w === WATER_KIND_STREAM) fElev[k] -= RIVER_CARVE_M
    }

    // -- onto the backdrop -------------------------------------------------------
    // Over the last EDGE_BLEND_LOTS the heights ease onto the coarse surface, and on the
    // window's own edge they ARE that surface (less the mesh lift): the fine mesh's border
    // vertices lie on the coarse mesh's vertex lines, so the two meet without a step,
    // a skirt or a gap.
    for (let fy = 0; fy < F; fy++) {
      for (let fx = 0; fx < F; fx++) {
        const e = edgeDist(fx, fy)
        if (e >= EDGE_BLEND_LOTS) continue
        const w = 1 - smooth(e / EDGE_BLEND_LOTS)
        const k = fy * F + fx
        fElev[k] = fElev[k] * (1 - w) + (coarseSurf(fx, fy) - FINE_GROUND_LIFT) * w
      }
    }
    const fine: DecodedGrid = { w: F, h: F, elevation: fElev, biome: fBiome, water: fWater }

    const doc: CityExportJSON = {
      seed: Number(BigInt(world.seed) % 2147483647n),
      generatorVersion: world.generator_version,
      tileMeters: tile,
      lotMeters: lot,
      chunkTileEdge: world.chunk.tile_edge,
      lotsPerTile: lpt,
      centerChunk: layout.settlement.centre.chunk ?? { face: 0, lod: world.chunk.max_lod, x: 0, y: 0 },
      latDeg: layout.settlement.centre.lat,
      lonDeg: layout.settlement.centre.lon,
      coarseGrid: { w: C, h: C, elevation: '', biome: '', flags: '' },
      fineGrid: { originTileX, originTileY, w: F, h: F, elevation: '', biome: '', waterKind: '' },
      biomeLegend: legend,
      resourceLegend: [],
      deposits: [],
      city: { originX, originY, size: n, roads: [], bridges: [], lots: [], counts: {} },
      world: {},
    }
    const grids = new CityGrids(doc, { coarse, fine })
    grids.riverCarveM = RIVER_CARVE_M
    grids.finalFine = true

    // scene <-> fine-cell conversion is affine: read it off two points
    const p00 = grids.fineScene(0, 0)
    const p10 = grids.fineScene(1, 0)
    const p01 = grids.fineScene(0, 1)
    const sx = p10.x - p00.x // metres per fine cell along +x
    const sz = p01.z - p00.z

    // the heights as the fine mesh draws them
    const drawn = fElev

    // Catmull-Rom through the drawn lot heights, SUB vertices per lot: smooth
    // ground that still passes exactly through every lot's own height
    const SUB = GROUND_SUB
    const N = (F - 1) * SUB + 1
    const heights = new Float32Array(N * N)
    const lakeSub = new Float32Array(N * N).fill(NaN)
    const cr = (a: number, b: number, c: number, d: number, t: number) =>
      b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)))
    const at = (i: number, j: number) => drawn[Math.max(0, Math.min(F - 1, j)) * F + Math.max(0, Math.min(F - 1, i))]
    for (let sj = 0; sj < N; sj++) {
      const fy = sj / SUB, j1 = Math.floor(fy), ty = fy - j1
      for (let si = 0; si < N; si++) {
        const fx = si / SUB, i1 = Math.floor(fx), tx = fx - i1
        if (sj === 0 || si === 0 || sj === N - 1 || si === N - 1) { heights[sj * N + si] = coarseSurf(fx, fy) - FINE_GROUND_LIFT; continue }
        if (tx === 0 && ty === 0) { heights[sj * N + si] = at(i1, j1); continue }
        const rows = [j1 - 1, j1, j1 + 1, j1 + 2].map((jj) => cr(at(i1 - 1, jj), at(i1, jj), at(i1 + 1, jj), at(i1 + 2, jj), tx))
        heights[sj * N + si] = cr(rows[0], rows[1], rows[2], rows[3], ty)
      }
    }
    // the lake's level over each mesh vertex: the level of the nearest lake lot, one lot of shore included
    const lakeAtLot = (i: number, j: number): number => {
      if (i < 0 || j < 0 || i >= F || j >= F) return NaN
      return lakeLevel[j * F + i]
    }
    for (let sj = 0; sj < N; sj++) {
      for (let si = 0; si < N; si++) {
        const ci = Math.round(si / SUB), cj = Math.round(sj / SUB)
        let lv = lakeAtLot(ci, cj)
        for (let dj = -1; dj <= 1 && Number.isNaN(lv); dj++) for (let di = -1; di <= 1 && Number.isNaN(lv); di++) {
          // the ring: a lot beside the lake, but only the part of it that lies towards the lake
          const l2 = lakeAtLot(ci + di, cj + dj)
          if (Number.isNaN(l2)) continue
          // (and only where the ground is not already far under it: a lake never spills over a lower slope)
          if (Math.hypot(si / SUB - (ci + di), sj / SUB - (cj + dj)) <= 1.0 && heights[sj * N + si] + FINE_GROUND_LIFT >= l2 - 0.4) lv = l2
        }
        lakeSub[sj * N + si] = lv
      }
    }
    const stepX = sx / SUB, stepZ = sz / SUB

    const groundY = (x: number, z: number): number => {
      const fx = (x - p00.x) / stepX
      const fy = (z - p00.z) / stepZ
      const i = Math.max(0, Math.min(N - 2, Math.floor(fx)))
      const j = Math.max(0, Math.min(N - 2, Math.floor(fy)))
      const u = Math.max(0, Math.min(1, fx - i))
      const v = Math.max(0, Math.min(1, fy - j))
      const a = heights[j * N + i], b = heights[j * N + i + 1], c = heights[(j + 1) * N + i], d = heights[(j + 1) * N + i + 1]
      // the mesh's triangles are (a,c,b) and (b,c,d): diagonal b-c
      const y = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (b - d) * (1 - v) + (c - d) * (1 - u)
      return y + FINE_GROUND_LIFT
    }

    return {
      grids, lot, n, originX, originY, groundY,
      sub: { N, SUB, heights, x0: p00.x, z0: p00.z, stepX, stepZ },
      lakeSub,
      lakeLevelAt(x, z) {
        const i = Math.round((x - p00.x) / stepX), j = Math.round((z - p00.z) / stepZ)
        if (i < 0 || j < 0 || i >= N || j >= N) return null
        const v = lakeSub[j * N + i]
        return Number.isNaN(v) ? null : v
      },
      lotCentre: (x, y) => grids.fineScene(originX + x, originY + (n - 1 - y)),
      lotAt: (x, z) => {
        const lx = Math.round((x - p00.x) / sx - originX)
        const ly = n - 1 - Math.round((z - p00.z) / sz - originY)
        return lx >= 0 && lx < n && ly >= 0 && ly < n ? { x: lx, y: ly } : null
      },
      isWaterLot: (x, y) => lotWater[y * n + x] !== WATER_KIND_NONE,
      span(x0, z0, x1, z1) {
        let min = Infinity, max = -Infinity
        const see = (x: number, z: number) => {
          const h = groundY(x, z)
          if (h < min) min = h
          if (h > max) max = h
        }
        const steps = 6
        for (let a = 0; a <= steps; a++) for (let b = 0; b <= steps; b++) see(x0 + ((x1 - x0) * a) / steps, z0 + ((z1 - z0) * b) / steps)
        // and every mesh vertex inside: a peak between sample points would
        // otherwise poke through a floor laid at the sampled maximum
        const i0 = Math.ceil((x0 - p00.x) / stepX), i1 = Math.floor((x1 - p00.x) / stepX)
        const j0 = Math.ceil((z0 - p00.z) / stepZ), j1 = Math.floor((z1 - p00.z) / stepZ)
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) see(p00.x + i * stepX, p00.z + j * stepZ)
        return { min, max }
      },
    }
  }
}

/** Water kind of a sampled position outside the village block: tile flags,
 * with streams drawn as a ribbon joining neighbouring stream tiles rather
 * than a 305 m square. */
function waterKindOf(sampler: WorldSampler, s: { elev: number; flags: number; face: number; gx: number; gy: number }): number {
  if (s.flags & TILE_FLAG_OCEAN) return s.elev <= 0.5 ? WATER_KIND_OCEAN : WATER_KIND_NONE
  if (s.flags & TILE_FLAG_LAKE) return WATER_KIND_LAKE
  const I = Math.floor(s.gx), J = Math.floor(s.gy)
  const a = s.gx - (I + 0.5), b = s.gy - (J + 0.5)
  const joins = (di: number, dj: number) => (sampler.flagsAt(s.face, I + di, J + dj) & (TILE_FLAG_STREAM | TILE_FLAG_LAKE | TILE_FLAG_OCEAN)) !== 0
  const w = STREAM_HALF_WIDTH
  const here = (s.flags & TILE_FLAG_STREAM) !== 0
  if (here && Math.abs(a) < w && Math.abs(b) < w) return WATER_KIND_STREAM
  if (here) {
    if (Math.abs(b) < w && a > 0 && joins(1, 0)) return WATER_KIND_STREAM
    if (Math.abs(b) < w && a < 0 && joins(-1, 0)) return WATER_KIND_STREAM
    if (Math.abs(a) < w && b > 0 && joins(0, 1)) return WATER_KIND_STREAM
    if (Math.abs(a) < w && b < 0 && joins(0, -1)) return WATER_KIND_STREAM
  }
  return WATER_KIND_NONE
}
