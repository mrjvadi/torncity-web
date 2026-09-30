// Reads the world's terrain at a latitude/longitude out of decoded chunks:
// elevation bilinear between tile centres, biome and flags from the nearest
// tile. Chunks are fetched once (the server marks them immutable) and kept
// for the life of the view.

import type { WorldInfo } from '../api/types'
import type { Chunk } from './chunk'
import { latLonToTile } from './geo'
import type { Face } from './geo'

export type ChunkSource = (face: number, lod: number, x: number, y: number) => Promise<Chunk | null>

export interface TileSample {
  /** Metres (the generator's unit; sea level is 0). */
  elev: number
  biome: number
  flags: number
  face: Face
  /** Continuous tile coordinates on the face (tile i spans [i, i+1)). */
  gx: number
  gy: number
}

export class WorldSampler {
  readonly lod: number
  readonly edge: number
  private readonly perFace: number
  private chunks = new Map<string, Chunk | null>()
  private fallback: Chunk | null = null

  constructor(readonly world: WorldInfo, private source: ChunkSource) {
    this.lod = world.chunk.max_lod
    this.edge = world.chunk.tile_edge
    this.perFace = (1 << this.lod) * this.edge
  }

  private key(face: number, x: number, y: number) { return `${face}/${x}/${y}` }

  /** Fetches every chunk a set of points (and their one-tile neighbours)
   * falls in, in parallel. A chunk that cannot be had is remembered as
   * missing and sampled from the nearest one held instead. */
  async prefetch(points: { lat: number; lon: number }[]): Promise<void> {
    const wanted = new Map<string, [number, number, number]>()
    for (const p of points) {
      const t = latLonToTile(p.lat, p.lon, this.lod, this.edge)
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          const cx = Math.floor(Math.min(this.perFace - 1, Math.max(0, t.gx + dx)) / this.edge)
          const cy = Math.floor(Math.min(this.perFace - 1, Math.max(0, t.gy + dy)) / this.edge)
          wanted.set(this.key(t.face, cx, cy), [t.face, cx, cy])
        }
      }
    }
    await Promise.all([...wanted.entries()].filter(([k]) => !this.chunks.has(k)).map(async ([k, [f, cx, cy]]) => {
      let c: Chunk | null = null
      try {
        c = await this.source(f, this.lod, cx, cy)
      } catch {
        c = null
      }
      this.chunks.set(k, c)
      if (c && !this.fallback) this.fallback = c
    }))
  }

  /** Number of chunks held / asked for (for diagnostics). */
  stats() { return { asked: this.chunks.size, held: [...this.chunks.values()].filter(Boolean).length } }

  private tile(face: number, I: number, J: number): { elev: number; biome: number; flags: number } {
    const i = Math.min(this.perFace - 1, Math.max(0, I))
    const j = Math.min(this.perFace - 1, Math.max(0, J))
    const c = this.chunks.get(this.key(face, Math.floor(i / this.edge), Math.floor(j / this.edge))) ?? null
    if (!c) {
      const f = this.fallback
      if (!f) return { elev: 0, biome: 0, flags: 0 }
      return { elev: f.elevation[0], biome: f.biome[0], flags: 0 }
    }
    const k = (j % this.edge) * this.edge + (i % this.edge)
    return { elev: c.elevation[k], biome: c.biome[k], flags: c.flags[k] }
  }

  /** The flags of tile (I,J) of a face (used to link stream tiles). */
  flagsAt(face: number, I: number, J: number): number { return this.tile(face, I, J).flags }

  sample(lat: number, lon: number): TileSample {
    const t = latLonToTile(lat, lon, this.lod, this.edge)
    const fx = t.gx - 0.5
    const fy = t.gy - 0.5
    const i0 = Math.floor(fx), j0 = Math.floor(fy)
    const ax = fx - i0, ay = fy - j0
    const a = this.tile(t.face, i0, j0), b = this.tile(t.face, i0 + 1, j0)
    const c = this.tile(t.face, i0, j0 + 1), d = this.tile(t.face, i0 + 1, j0 + 1)
    // an ocean tile's depth would drag a shoreline down into a trench:
    // bilinear only between tiles of the same kind of ground
    const wet = (s: { flags: number }) => (s.flags & 1) !== 0
    const anyWet = wet(a) || wet(b) || wet(c) || wet(d)
    const all = wet(a) && wet(b) && wet(c) && wet(d)
    const lerp = (p: number, q: number, r: number, s: number) => (p * (1 - ax) + q * ax) * (1 - ay) + (r * (1 - ax) + s * ax) * ay
    let elev = lerp(a.elev, b.elev, c.elev, d.elev)
    if (anyWet && !all) {
      const cl = (s: { elev: number; flags: number }) => (wet(s) ? Math.max(-6, Math.min(0, s.elev)) : s.elev)
      elev = lerp(cl(a), cl(b), cl(c), cl(d))
    }
    const near = this.tile(t.face, Math.floor(t.gx), Math.floor(t.gy))
    return { elev, biome: near.biome, flags: near.flags, face: t.face, gx: t.gx, gy: t.gy }
  }
}
