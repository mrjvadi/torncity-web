// The offline world for ?mock=1: a small deterministic heightfield defined
// over tile coordinates of one cube face, encoded into the very binary chunk
// format the server serves (village/chunk.ts encodeChunk), so the client's
// decoder and the whole chunk -> terrain path run in mock mode exactly as
// against a real server. It is a stand-in for the Go generator, not a port.

import type { WorldInfo } from './types'
import { encodeChunk } from '../village/chunk'
import { latLonToTile, tileToLatLon, type Face } from '../village/geo'
import { TILE_LAKE, TILE_OCEAN, TILE_STREAM } from '../village/chunk'

export const MOCK_FACE: Face = 4
const EDGE = 32
const LOD = 10

export const MOCK_BIOMES = [
  { index: 0, code: 'ocean', water: true, color: '1a4d73' },
  { index: 1, code: 'lake', water: true, color: '2c6f96' },
  { index: 2, code: 'polar_ice', color: 'e8f0f2' },
  { index: 3, code: 'tundra', color: '9aa58a' },
  { index: 4, code: 'boreal_forest', color: '3f6a4a' },
  { index: 5, code: 'temperate_grassland', color: '8fae5a' },
  { index: 6, code: 'temperate_forest', color: '4c7a3d' },
  { index: 7, code: 'temperate_rainforest', color: '3a7a4e' },
  { index: 8, code: 'tropical_savanna', color: 'b0a85a' },
  { index: 9, code: 'tropical_rainforest', color: '2f7a3c' },
  { index: 10, code: 'desert', color: 'd6c08a' },
]

export const MOCK_WORLD: WorldInfo = {
  id: '0a0a4f2e-mock-world',
  seed: '20280928',
  generator_version: 1,
  params_hash: '3fa9mock',
  chunk_codec_version: 1,
  chunk: { faces: 6, tile_edge: EDGE, min_lod: 0, max_lod: LOD, header_bytes: 33, tile_bytes: 5 },
  tile_m: 305.4,
  lot_m: 30.54,
  lots_per_tile: 10,
  planet_radius_km: 6371,
  biomes: MOCK_BIOMES,
  chunk_path: '/api/v1/world/chunks/{face}/{lod}/{x}/{y}',
  created_at: '2026-09-30T12:00:00Z',
}

/** The village sits at this (fractional) tile of the mock face. */
export const VILLAGE_TILE = { gx: 520 * EDGE + 13.3, gy: 515 * EDGE + 17.4 }
/** The river is a straight line of tile row centres (so the coarse stream
 * flags and the lot-level water agree exactly) crossing the village's south. */
export const RIVER_GY = Math.floor(VILLAGE_TILE.gy) + 0.5 - 1
export const RIVER_HALF_TILES = 0.11

const s01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Height (metres) at a continuous tile coordinate; sea level 0. */
export function mockHeight(gx: number, gy: number): number {
  const dx = gx - VILLAGE_TILE.gx, dy = gy - VILLAGE_TILE.gy
  let h = 34 + 30 * (vnoise(dx * 0.11 + 4, dy * 0.11 + 9) - 0.5) * 2 + 9 * (vnoise(dx * 0.4 + 1, dy * 0.4 + 5) - 0.5) * 2
  // a range of hills to the north-east, the sea far to the west
  h += 130 * s01((dx * 0.55 + dy * 0.7 - 5) / 20)
  h -= 120 * s01(((-dx * 0.9 + dy * 0.2) - 9) / 9)
  // the river bed: a shallow valley along the river row
  const rd = Math.abs(gy - RIVER_GY)
  h -= 7 * (1 - s01(rd / 2.4))
  // a gentle village terrace so the lots are mostly flat
  const vd = Math.hypot(dx, dy)
  h = h * s01(vd / 1.4) + (34 + 3 * Math.sin(dx * 5) * Math.cos(dy * 6)) * (1 - s01(vd / 1.4))
  return h
}

export function mockTile(gx: number, gy: number): { elev: number; biome: number; flags: number } {
  const elev = Math.round(mockHeight(gx, gy))
  let flags = 0
  let biome: number
  const dx = gx - VILLAGE_TILE.gx, dy = gy - VILLAGE_TILE.gy
  if (elev <= 0) {
    flags |= TILE_OCEAN
    biome = 0
  } else {
    const lake = Math.hypot(dx + 7.5, dy - 6.5) < 2.3
    if (lake) { flags |= TILE_LAKE; biome = 1 }
    else {
      const moist = vnoise(dx * 0.18 + 30, dy * 0.18 + 12)
      biome = elev > 210 ? 3 : elev > 150 ? 4 : moist > 0.55 ? 6 : moist > 0.42 ? 7 : 5
      // clearings around the village
      if (Math.hypot(dx, dy) < 2.2) biome = 5
    }
    const onRiver = Math.abs(Math.floor(gy) + 0.5 - RIVER_GY) < 0.01 && dx > -8.5 && !lake
    if (onRiver) flags |= TILE_STREAM
  }
  return { elev, biome, flags }
}

export function mockChunkBytes(face: number, lod: number, cx: number, cy: number): ArrayBuffer | null {
  if (face !== MOCK_FACE || lod !== LOD) {
    // other faces / LODs: open ocean-free plain so a stray request never fails
    const n = EDGE * EDGE
    return encodeChunk({
      generator: 1, seed: 20280928n, face, lod, x: cx, y: cy, edge: EDGE,
      elevation: new Int16Array(n).fill(20), biome: new Uint8Array(n).fill(5), flags: new Uint8Array(n), deposit: new Uint8Array(n), deposits: [],
    })
  }
  const n = EDGE * EDGE
  const elevation = new Int16Array(n)
  const biome = new Uint8Array(n)
  const flags = new Uint8Array(n)
  for (let j = 0; j < EDGE; j++) {
    for (let i = 0; i < EDGE; i++) {
      const t = mockTile(cx * EDGE + i + 0.5, cy * EDGE + j + 0.5)
      elevation[j * EDGE + i] = t.elev
      biome[j * EDGE + i] = t.biome
      flags[j * EDGE + i] = t.flags
    }
  }
  return encodeChunk({ generator: 1, seed: 20280928n, face, lod, x: cx, y: cy, edge: EDGE, elevation, biome, flags, deposit: new Uint8Array(n), deposits: [] })
}

/** The village's centre and lot (0,0) as lat/lon, and its base-LOD chunk. */
export function mockVillagePlace(gridLots: number): {
  centre: { lat: number; lon: number; chunk: { face: number; lod: number; x: number; y: number } }
  origin: { lat: number; lon: number }
} {
  const c = tileToLatLon(MOCK_FACE, VILLAGE_TILE.gx, VILLAGE_TILE.gy, LOD, EDGE)
  const t = latLonToTile(c.lat, c.lon, LOD, EDGE)
  // lot (0,0) is (grid-1)/2 lots west and south of the centre
  const r = MOCK_WORLD.planet_radius_km * 1000
  const half = ((gridLots - 1) / 2) * MOCK_WORLD.lot_m
  const dLat = (-half / r) * (180 / Math.PI)
  const dLon = (-half / (r * Math.cos((c.lat * Math.PI) / 180))) * (180 / Math.PI)
  return {
    centre: { lat: c.lat, lon: c.lon, chunk: { face: t.face, lod: LOD, x: Math.floor(t.gx / EDGE), y: Math.floor(t.gy / EDGE) } },
    origin: { lat: c.lat + dLat, lon: c.lon + dLon },
  }
}
