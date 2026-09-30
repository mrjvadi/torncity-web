// Decoder for the binary chunk of client-api.md section 4.3 ("EncodeChunk"):
// little-endian, a 33-byte header, then edge*edge tiles of 5 bytes (elevation
// int16, biome uint8, flags uint8, deposit uint8), then the deposit list.

export const CHUNK_MAGIC = [0x4b, 0x43, 0x4e, 0x57] // "KCNW"

export const TILE_OCEAN = 1
export const TILE_STREAM = 2
export const TILE_LAKE = 4

export interface ChunkDeposit { id: string; resource: string; x: number; y: number }

export interface Chunk {
  codec: number
  generator: number
  seed: bigint
  face: number
  lod: number
  x: number
  y: number
  edge: number
  /** Row-major, index = j*edge + i (i along x). */
  elevation: Int16Array
  biome: Uint8Array
  flags: Uint8Array
  deposit: Uint8Array
  deposits: ChunkDeposit[]
}

export class ChunkFormatError extends Error {}

export function decodeChunk(buf: ArrayBuffer): Chunk {
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  if (buf.byteLength < 33) throw new ChunkFormatError('chunk: too short')
  for (let i = 0; i < 4; i++) if (u8[i] !== CHUNK_MAGIC[i]) throw new ChunkFormatError('chunk: bad magic')
  const codec = u8[4]
  if (codec !== 1) throw new ChunkFormatError(`chunk: unsupported codec ${codec}`)
  const generator = dv.getUint32(5, true)
  const seed = dv.getBigUint64(9, true)
  const face = dv.getInt8(17)
  const lod = dv.getInt8(18)
  const x = dv.getInt32(19, true)
  const y = dv.getInt32(23, true)
  const edge = dv.getUint16(27, true)
  const count = dv.getUint32(29, true)
  if (count !== edge * edge || buf.byteLength < 33 + count * 5) throw new ChunkFormatError('chunk: bad tile count')
  const elevation = new Int16Array(count)
  const biome = new Uint8Array(count)
  const flags = new Uint8Array(count)
  const deposit = new Uint8Array(count)
  let o = 33
  for (let k = 0; k < count; k++, o += 5) {
    elevation[k] = dv.getInt16(o, true)
    biome[k] = u8[o + 2]
    flags[k] = u8[o + 3]
    deposit[k] = u8[o + 4]
  }
  const deposits: ChunkDeposit[] = []
  if (o + 2 <= buf.byteLength) {
    const n = dv.getUint16(o, true)
    o += 2
    const dec = new TextDecoder()
    for (let d = 0; d < n && o < buf.byteLength; d++) {
      const idLen = u8[o++]
      const id = dec.decode(u8.subarray(o, o + idLen)); o += idLen
      const resLen = u8[o++]
      const resource = dec.decode(u8.subarray(o, o + resLen)); o += resLen
      deposits.push({ id, resource, x: u8[o], y: u8[o + 1] })
      o += 2
    }
  }
  return { codec, generator, seed, face, lod, x, y, edge, elevation, biome, flags, deposit, deposits }
}

/** The inverse of decodeChunk, for the offline mock world: proves the
 * decoder against the very byte layout the contract documents. */
export function encodeChunk(c: Pick<Chunk, 'generator' | 'seed' | 'face' | 'lod' | 'x' | 'y' | 'edge' | 'elevation' | 'biome' | 'flags' | 'deposit' | 'deposits'>): ArrayBuffer {
  const enc = new TextEncoder()
  const dep = c.deposits.map((d) => ({ id: enc.encode(d.id), res: enc.encode(d.resource), x: d.x, y: d.y }))
  const size = 33 + c.edge * c.edge * 5 + 2 + dep.reduce((n, d) => n + 4 + d.id.length + d.res.length, 0)
  const buf = new ArrayBuffer(size)
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  u8.set(CHUNK_MAGIC, 0)
  u8[4] = 1
  dv.setUint32(5, c.generator, true)
  dv.setBigUint64(9, c.seed, true)
  dv.setInt8(17, c.face)
  dv.setInt8(18, c.lod)
  dv.setInt32(19, c.x, true)
  dv.setInt32(23, c.y, true)
  dv.setUint16(27, c.edge, true)
  dv.setUint32(29, c.edge * c.edge, true)
  let o = 33
  for (let k = 0; k < c.edge * c.edge; k++, o += 5) {
    dv.setInt16(o, c.elevation[k], true)
    u8[o + 2] = c.biome[k]
    u8[o + 3] = c.flags[k]
    u8[o + 4] = c.deposit[k]
  }
  dv.setUint16(o, dep.length, true)
  o += 2
  for (const d of dep) {
    u8[o++] = d.id.length; u8.set(d.id, o); o += d.id.length
    u8[o++] = d.res.length; u8.set(d.res, o); o += d.res.length
    u8[o++] = d.x; u8[o++] = d.y
  }
  return buf
}
