// The village's lakes as water surfaces. Each lake is one flat plane at its own level
// (terrainModel: the height of its lowest bank), laid over the ground mesh's own vertex
// lattice inside the lake's region. Nothing here decides where the shore is: the ground
// dips under the plane and the depth test draws the shoreline exactly where the two
// meet; the surface only fades out over the last few decimetres of depth so that line is
// soft rather than jagged. A surface can therefore never float over dry land or sink
// under a hill.

import { BufferAttribute, BufferGeometry, Mesh, type Material } from 'three'
import type { VillageGround } from './terrainModel'

/** Depth (m) at which the surface is fully opaque. */
const FULL_ALPHA_DEPTH = 0.32

export interface LakeWaterMesh { mesh: Mesh | null; dispose(): void }

export function buildLakeWater(ground: VillageGround, material: Material): LakeWaterMesh {
  const { N, heights, x0, z0, stepX, stepZ } = ground.sub
  const level = ground.lakeSub
  const depth = new Float32Array(N * N)
  const vert = new Int32Array(N * N).fill(-1)
  const pos: number[] = []
  const shore: number[] = []
  const alpha: number[] = []
  let count = 0
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      const L = level[k]
      if (Number.isNaN(L)) { depth[k] = -1e3; continue }
      // the mesh is drawn FINE_GROUND_LIFT above `heights`: groundY is what the eye sees
      const d = L - (ground.groundY(x0 + i * stepX, z0 + j * stepZ))
      depth[k] = d
      vert[k] = count++
      pos.push(x0 + i * stepX, L, z0 + j * stepZ)
      const t = Math.max(0, Math.min(1, d / FULL_ALPHA_DEPTH))
      alpha.push(t * t * (3 - 2 * t))
      // the water shader reads depth as metres * 10
      shore.push(Math.max(0, d) * 10)
    }
  }
  void heights
  if (count === 0) return { mesh: null, dispose() {} }
  const idx: number[] = []
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1
      if (vert[a] < 0 || vert[b] < 0 || vert[c] < 0 || vert[d] < 0) continue
      if (depth[a] <= 0 && depth[b] <= 0 && depth[c] <= 0 && depth[d] <= 0) continue
      idx.push(vert[a], vert[c], vert[b], vert[b], vert[c], vert[d])
    }
  }
  if (idx.length === 0) return { mesh: null, dispose() {} }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3).map((_, q) => (q % 3 === 1 ? 1 : 0)), 3))
  geo.setAttribute('shoreDist', new BufferAttribute(new Float32Array(shore), 1))
  geo.setAttribute('flowDir', new BufferAttribute(new Float32Array(count * 2), 2))
  geo.setAttribute('edgeAlpha', new BufferAttribute(new Float32Array(alpha), 1))
  geo.setIndex(new BufferAttribute(count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1))
  const mesh = new Mesh(geo, material)
  mesh.name = 'lake-water'
  mesh.renderOrder = 2
  return { mesh, dispose() { geo.dispose() } }
}
