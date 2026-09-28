// The shape cmd/worldpreview --export-city writes (torncity repo,
// cmd/worldpreview/export_city.go + citylayout.go). Kept in lockstep with
// those files by hand — this is a demo's own reader for a demo-only export,
// not a shared wire contract with the real game API (src/api/types.ts), so
// it does not belong there.
//
// TWO RESOLUTIONS. coarseGrid is base terrain TILE resolution (~305m/cell,
// tileMeters) — the far backdrop. fineGrid is settlement LOT resolution
// (~30.5m/cell, lotMeters) — the near mesh the city itself sits on. Both
// share the SAME coordinate space: fineGrid.originTileX/Y locates the fine
// grid's own north-west LOT as a (fractional) TILE coordinate inside
// coarseGrid. See fineWorldMeters()/coarseWorldMeters() below for the exact
// placement formulas — never approximate these, a half-lot error shows up
// as a visible seam between the two meshes.

export interface ChunkAddrJSON {
  face: number
  lod: number
  x: number
  y: number
}

export interface BiomeLegendEntry {
  code: string
  colorHex: string
}

export interface ResourceLegendEntry {
  code: string
  name: string
  colorHex: string
}

export interface DepositJSON {
  x: number
  y: number
  resource: string
}

export interface CoarseGridJSON {
  w: number
  h: number
  /** base64 of W*H little-endian int16 metres — decode with decodeInt16LE. */
  elevation: string
  /** base64 of W*H bytes, index into biomeLegend. */
  biome: string
  /** base64 of W*H bytes: bit0 ocean, bit1 stream, bit2 lake. */
  flags: string
}

export interface FineGridJSON {
  originTileX: number
  originTileY: number
  w: number
  h: number
  elevation: string
  biome: string
  /** one byte/lot: 0 none, 1 stream, 2 river, 3 lake, 4 ocean. */
  waterKind: string
}

export interface RoadJSON {
  x: number
  y: number
  /** 0 local, 1 arterial, 2 elevated highway. */
  class: number
}

export interface CityLotJSON {
  type: string
  x: number
  y: number
  w: number
  h: number
  rot: number
  floors: number
}

export interface CitySummaryJSON {
  originX: number
  originY: number
  size: number
  roads: RoadJSON[]
  bridges: RoadJSON[]
  lots: CityLotJSON[]
  counts: Record<string, number>
}

export interface WorldSummaryJSON {
  continent?: string
  river?: string
  sea?: string
}

export interface CityExportJSON {
  seed: number
  generatorVersion: number
  tileMeters: number
  lotMeters: number
  chunkTileEdge: number
  lotsPerTile: number
  centerChunk: ChunkAddrJSON
  latDeg: number
  lonDeg: number
  coarseGrid: CoarseGridJSON
  fineGrid: FineGridJSON
  biomeLegend: BiomeLegendEntry[]
  resourceLegend: ResourceLegendEntry[]
  deposits: DepositJSON[]
  city: CitySummaryJSON
  world: WorldSummaryJSON
}

export const ROAD_CLASS_LOCAL = 0
export const ROAD_CLASS_ARTERIAL = 1
export const ROAD_CLASS_HIGHWAY = 2

export const WATER_KIND_NONE = 0
export const WATER_KIND_STREAM = 1
export const WATER_KIND_RIVER = 2
export const WATER_KIND_LAKE = 3
export const WATER_KIND_OCEAN = 4

export const TILE_FLAG_OCEAN = 1
export const TILE_FLAG_STREAM = 2
export const TILE_FLAG_LAKE = 4

/** atob()+Uint8Array: the one line that undoes Go's []byte-as-base64 JSON
 * encoding (see CoarseGridJSON's own doc comment). */
export function decodeBase64Bytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Decodes a base64 blob of little-endian int16 pairs (export_city.go's
 * packInt16LE) into a signed Int16Array, one value per cell, row-major. */
export function decodeInt16LE(b64: string): Int16Array {
  const bytes = decodeBase64Bytes(b64)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Int16Array(bytes.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true)
  return out
}

/** Decoded, ready-to-render terrain: elevation in real metres, biome index
 * per cell, and per-cell flags/water-kind — the plain-array form every
 * terrain/water/road builder below consumes instead of re-decoding base64
 * itself. */
export interface DecodedGrid {
  w: number
  h: number
  elevation: Int16Array
  biome: Uint8Array
  /** coarse: TILE_FLAG_* bitmask. fine: WATER_KIND_* enum value. Same
   * array shape, different meaning — see isWetCoarse/isWetFine below. */
  water: Uint8Array
}

export function decodeCoarseGrid(doc: CityExportJSON): DecodedGrid {
  const g = doc.coarseGrid
  return { w: g.w, h: g.h, elevation: decodeInt16LE(g.elevation), biome: decodeBase64Bytes(g.biome), water: decodeBase64Bytes(g.flags) }
}

export function decodeFineGrid(doc: CityExportJSON): DecodedGrid {
  const g = doc.fineGrid
  return { w: g.w, h: g.h, elevation: decodeInt16LE(g.elevation), biome: decodeBase64Bytes(g.biome), water: decodeBase64Bytes(g.waterKind) }
}

export function isWetCoarse(flags: number): boolean {
  return (flags & (TILE_FLAG_OCEAN | TILE_FLAG_STREAM | TILE_FLAG_LAKE)) !== 0
}

export function isWetFine(waterKind: number): boolean {
  return waterKind !== WATER_KIND_NONE
}

/** World-space (metres, X east / Z south) position of coarse-grid cell
 * (i,j) — the export window's own north-west corner is the origin. */
export function coarseWorldMeters(doc: CityExportJSON, i: number, j: number): { x: number; z: number } {
  return { x: i * doc.tileMeters, z: j * doc.tileMeters }
}

/** World-space (metres) position of fine-grid cell (fx,fy) — placed inside
 * the SAME coordinate space as coarseWorldMeters via fineGrid's own
 * originTileX/Y (a fractional coarse-tile coordinate), so the two meshes
 * never drift out of registration at their shared seam. Equivalent to
 * (originTileX*tileMeters + fx*lotMeters), just spelled out the way
 * export_city.go documents the placement. */
export function fineWorldMeters(doc: CityExportJSON, fx: number, fy: number): { x: number; z: number } {
  const tileX = doc.fineGrid.originTileX + fx / doc.lotsPerTile
  const tileY = doc.fineGrid.originTileY + fy / doc.lotsPerTile
  return { x: tileX * doc.tileMeters, z: tileY * doc.tileMeters }
}

/** World-space (metres) position of a city-local lot coordinate (the space
 * city.roads/city.lots use) — offset into fineGrid by city.originX/Y, then
 * placed with fineWorldMeters. */
export function cityWorldMeters(doc: CityExportJSON, lx: number, ly: number): { x: number; z: number } {
  return fineWorldMeters(doc, doc.city.originX + lx, doc.city.originY + ly)
}
