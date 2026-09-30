// Smooth 0..1 fields over the fine grid that the ground shader's control map,
// the tree scatter and the grass tufts all read: how wet (near water), how
// forested, and how "village lawn". Computed once from the grids.

import type { VillageGround } from './terrainModel'

export interface Fields {
  F: number
  wet: Float32Array
  forest: Float32Array
  /** Bilinear sample at a scene position (0 outside the grid). */
  at(arr: Float32Array, x: number, z: number): number
  /** The lot-space distance (in metres) from a scene position to the village block. */
  blockDist(x: number, z: number): number
}

function blur(src: Float32Array, F: number, r: number): Float32Array {
  const out = new Float32Array(F * F)
  for (let j = 0; j < F; j++) {
    for (let i = 0; i < F; i++) {
      let s = 0, n = 0
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const x = i + di, y = j + dj
        if (x < 0 || y < 0 || x >= F || y >= F) continue
        s += src[y * F + x]; n++
      }
      out[j * F + i] = s / n
    }
  }
  return out
}

export function buildFields(ground: VillageGround, legend: { code: string }[]): Fields {
  const { fine } = ground.grids
  const F = fine.w
  const wet0 = new Float32Array(F * F), forest0 = new Float32Array(F * F)
  for (let k = 0; k < F * F; k++) {
    wet0[k] = fine.water[k] !== 0 ? 1 : 0
    const code = legend[fine.biome[k]]?.code ?? ''
    forest0[k] = /forest|rainforest|taiga/.test(code) ? 1 : 0
  }
  const wetB = blur(wet0, F, 1)
  const wet = new Float32Array(F * F)
  for (let k = 0; k < F * F; k++) wet[k] = Math.min(1, wetB[k] * 2.6)
  const forest = blur(blur(forest0, F, 2), F, 1)
  const { x0, z0, stepX, stepZ, SUB } = ground.sub
  const sx = stepX * SUB, sz = stepZ * SUB
  const at = (arr: Float32Array, x: number, z: number) => {
    const fx = (x - x0) / sx, fy = (z - z0) / sz
    if (fx < 0 || fy < 0 || fx > F - 1 || fy > F - 1) return 0
    const i = Math.min(F - 2, Math.floor(fx)), j = Math.min(F - 2, Math.floor(fy)), u = fx - i, v = fy - j
    return (arr[j * F + i] * (1 - u) + arr[j * F + i + 1] * u) * (1 - v) + (arr[(j + 1) * F + i] * (1 - u) + arr[(j + 1) * F + i + 1] * u) * v
  }
  const a = ground.lotCentre(0, 0), b = ground.lotCentre(ground.n - 1, ground.n - 1)
  const h = ground.lot / 2
  const bx0 = Math.min(a.x, b.x) - h, bx1 = Math.max(a.x, b.x) + h, bz0 = Math.min(a.z, b.z) - h, bz1 = Math.max(a.z, b.z) + h
  const blockDist = (x: number, z: number) => Math.hypot(Math.max(0, bx0 - x, x - bx1), Math.max(0, bz0 - z, z - bz1))
  return { F, wet, forest, at, blockDist }
}
