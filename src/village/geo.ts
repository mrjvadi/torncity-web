// The planet's cube-sphere addressing (client-api.md section 4.3; the server's
// internal/domain/worldgen/chunk_address.go): lat/lon <-> a face's flat
// (u,v) <-> a continuous tile coordinate on that face at a given LOD. Only
// what a client needs to find the chunks around a settlement and read a
// tile at a latitude/longitude.

const DEG = Math.PI / 180

/** Cube faces in OpenGL cubemap order: +X, -X, +Y, -Y, +Z, -Z. */
export type Face = 0 | 1 | 2 | 3 | 4 | 5

const tangentUnadjust = (w: number) => (Math.atan(w) * 4) / Math.PI
const tangentAdjust = (t: number) => Math.tan((t * Math.PI) / 4)

/** A lat/lon (degrees) as a unit direction (x through lon 0, z north). */
export function latLonToDir(latDeg: number, lonDeg: number): [number, number, number] {
  const la = latDeg * DEG
  const lo = lonDeg * DEG
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

export function dirToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const l = Math.hypot(x, y, z) || 1
  return { lat: Math.asin(Math.max(-1, Math.min(1, z / l))) / DEG, lon: Math.atan2(y, x) / DEG }
}

/** The face whose axis dominates a direction, and the direction's flat
 * (u,v) on it, each in [-1,1]. */
export function directionToFace(x: number, y: number, z: number): { face: Face; u: number; v: number } {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z)
  if (ax >= ay && ax >= az) {
    return x > 0
      ? { face: 0, u: tangentUnadjust(-z / ax), v: tangentUnadjust(-y / ax) }
      : { face: 1, u: tangentUnadjust(z / ax), v: tangentUnadjust(-y / ax) }
  }
  if (ay >= ax && ay >= az) {
    return y > 0
      ? { face: 2, u: tangentUnadjust(x / ay), v: tangentUnadjust(z / ay) }
      : { face: 3, u: tangentUnadjust(x / ay), v: tangentUnadjust(-z / ay) }
  }
  return z > 0
    ? { face: 4, u: tangentUnadjust(x / az), v: tangentUnadjust(-y / az) }
    : { face: 5, u: tangentUnadjust(-x / az), v: tangentUnadjust(-y / az) }
}

/** faceDirection's inverse: the (unnormalised) direction of flat (u,v) on a face. */
export function faceDirection(face: Face, u: number, v: number): [number, number, number] {
  const wu = tangentAdjust(u), wv = tangentAdjust(v)
  switch (face) {
    case 0: return [1, -wv, -wu]
    case 1: return [-1, -wv, wu]
    case 2: return [wu, 1, wv]
    case 3: return [wu, -1, -wv]
    case 4: return [wu, -wv, 1]
    default: return [-wu, -wv, -1]
  }
}

/** A position on the planet as a continuous tile coordinate of one face at
 * `lod`: tile `i` spans [i, i+1) along x, its centre at i + 0.5. */
export interface TileCoord { face: Face; gx: number; gy: number }

export function latLonToTile(latDeg: number, lonDeg: number, lod: number, tileEdge: number): TileCoord {
  const [x, y, z] = latLonToDir(latDeg, lonDeg)
  const { face, u, v } = directionToFace(x, y, z)
  const perFace = (1 << lod) * tileEdge
  return { face, gx: ((u + 1) / 2) * perFace, gy: ((v + 1) / 2) * perFace }
}

/** The inverse, for a tile coordinate (used by the offline mock world). */
export function tileToLatLon(face: Face, gx: number, gy: number, lod: number, tileEdge: number): { lat: number; lon: number } {
  const perFace = (1 << lod) * tileEdge
  const [x, y, z] = faceDirection(face, (gx / perFace) * 2 - 1, (gy / perFace) * 2 - 1)
  return dirToLatLon(x, y, z)
}

/** Metres to degrees at a latitude, on a sphere of the world's radius (the
 * server's lotLatLon in internal/domain/settlement/foundingkit.go). */
export function offsetLatLon(latDeg: number, lonDeg: number, eastM: number, northM: number, radiusKm: number): { lat: number; lon: number } {
  const r = radiusKm * 1000
  const dLat = (northM / r) / DEG
  const dLon = (eastM / (r * Math.cos(latDeg * DEG))) / DEG
  return { lat: latDeg + dLat, lon: lonDeg + dLon }
}
