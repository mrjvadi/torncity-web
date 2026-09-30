// The village's fine ground mesh: GROUND_SUB vertices per lot edge (terrainModel
// builds the height grid, exact at every lot centre), coloured per vertex by the
// biome under it, drawn with the control-map ground shader.

import { BufferAttribute, BufferGeometry, Color, Material, Mesh } from 'three'
import { FINE_GROUND_LIFT } from '../demo/terrain'
import type { VillageGround } from './terrainModel'

export interface BiomeTint { ref: Color; lot: Float32Array }

const WHITE = new Color(0xffffff)

/** Biome colours as multipliers on the reference grass: 1 on grassland, warmer
 * on savanna and desert, cooler on tundra. `legend[i].colorHex` per biome index. */
export function biomeTints(ground: VillageGround, legend: { code: string; colorHex: string }[]): BiomeTint {
  const light = (hex: string) => new Color(`#${hex}`).lerp(WHITE, 0.4)
  const refEntry = legend.find((b) => b.code === 'temperate_grassland') ?? legend.find((b) => /forest|grass/.test(b.code)) ?? legend[0]
  const ref = light(refEntry.colorHex)
  const { w, h, biome } = ground.grids.fine
  const lot = new Float32Array(w * h * 3)
  const c = new Color()
  for (let k = 0; k < w * h; k++) {
    const e = legend[biome[k]]
    c.copy(e ? light(e.colorHex) : ref)
    lot[k * 3] = Math.max(0.35, Math.min(1.7, c.r / Math.max(0.05, ref.r)))
    lot[k * 3 + 1] = Math.max(0.35, Math.min(1.7, c.g / Math.max(0.05, ref.g)))
    lot[k * 3 + 2] = Math.max(0.35, Math.min(1.7, c.b / Math.max(0.05, ref.b)))
  }
  return { ref, lot }
}

export function buildFineGroundMesh(ground: VillageGround, material: Material, tint: BiomeTint): Mesh {
  const { N, SUB, heights, x0, z0, stepX, stepZ } = ground.sub
  const F = ground.grids.fine.w
  const pos = new Float32Array(N * N * 3)
  const col = new Float32Array(N * N * 3)
  for (let j = 0; j < N; j++) {
    const fy = j / SUB, j0 = Math.min(F - 2, Math.floor(fy)), ty = fy - j0
    for (let i = 0; i < N; i++) {
      const o = (j * N + i) * 3
      pos[o] = x0 + i * stepX
      pos[o + 1] = heights[j * N + i] + FINE_GROUND_LIFT
      pos[o + 2] = z0 + j * stepZ
      const fx = i / SUB, i0 = Math.min(F - 2, Math.floor(fx)), tx = fx - i0
      for (let ch = 0; ch < 3; ch++) {
        const a = tint.lot[(j0 * F + i0) * 3 + ch], b = tint.lot[(j0 * F + i0 + 1) * 3 + ch]
        const c = tint.lot[((j0 + 1) * F + i0) * 3 + ch], d = tint.lot[((j0 + 1) * F + i0 + 1) * 3 + ch]
        col[o + ch] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
      }
    }
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6)
  let k = 0
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1
      idx[k++] = a; idx[k++] = c; idx[k++] = b
      idx[k++] = b; idx[k++] = c; idx[k++] = d
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.setIndex(new BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  const mesh = new Mesh(geo, material)
  mesh.name = 'terrain-fine'
  return mesh
}
