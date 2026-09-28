// The shape cmd/worldpreview --export-city writes (torncity repo,
// cmd/worldpreview/export_city.go). Kept in lockstep with that file by
// hand — this is a demo's own reader for a demo-only export, not a shared
// wire contract with the real game API (src/api/types.ts), so it does not
// belong there.

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

export interface CityLotJSON {
  type: string
  x: number
  y: number
  w: number
  h: number
  rot: number
}

export interface CitySummaryJSON {
  originX: number
  originY: number
  size: number
  roads: [number, number][]
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
  chunkTileEdge: number
  centerChunk: ChunkAddrJSON
  latDeg: number
  lonDeg: number
  grid: { w: number; h: number }
  // Go's encoding/json marshals a []byte field ([]uint8 in Go, matches
  // Biome/Flags here) as a base64 STRING, not a JSON array — see
  // export_city.go's own comment on why. decodeBase64Bytes below undoes it.
  elevation: number[]
  biome: string
  flags: string
  biomeLegend: BiomeLegendEntry[]
  resourceLegend: ResourceLegendEntry[]
  deposits: DepositJSON[]
  city: CitySummaryJSON
  world: WorldSummaryJSON
}

/** atob()+Uint8Array: the one line that undoes Go's []byte-as-base64 JSON
 * encoding (see CityExportJSON's own doc comment on biome/flags). */
export function decodeBase64Bytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const TILE_FLAG_OCEAN = 1
export const TILE_FLAG_STREAM = 2
export const TILE_FLAG_LAKE = 4
