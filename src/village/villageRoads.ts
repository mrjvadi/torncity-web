// Roads of the village: ribbons of packed earth/asphalt laid over the ground
// mesh from lot centre to lot centre (a lot is 30 m, a road ~7 m), joined at
// junctions by squares. The vertices ask the same ground function the
// terrain mesh is drawn from, so a road follows a slope instead of cutting
// through it.

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'
import type { VillageGround } from './terrainModel'

const ROAD_HALF = 3.6
const STEP_M = 3
const LIFT = 0.14

export interface RoadsMesh { mesh: Mesh | null; dispose(): void }

export function buildVillageRoads(ground: VillageGround, roadLots: { x: number; y: number }[]): RoadsMesh {
  if (roadLots.length === 0) return { mesh: null, dispose() {} }
  const has = new Set(roadLots.map((r) => `${r.x},${r.y}`))
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const base = new Color(0x6c6a66)
  const edge = new Color(0x8b8578)

  const strip = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.ceil(len / STEP_M))
    const dx = (bx - ax) / len, dz = (bz - az) / len
    const nx = -dz, nz = dx
    const start = pos.length / 3
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n
      for (const side of [-1, 0, 1]) {
        const px = x + nx * ROAD_HALF * side, pz = z + nz * ROAD_HALF * side
        pos.push(px, ground.groundY(px, pz) + LIFT, pz)
        const c = side === 0 ? base : edge
        col.push(c.r, c.g, c.b)
      }
    }
    for (let i = 0; i < n; i++) {
      const a = start + i * 3
      for (let s = 0; s < 2; s++) {
        idx.push(a + s, a + s + 3, a + s + 1, a + s + 1, a + s + 3, a + s + 4)
      }
    }
  }

  for (const r of roadLots) {
    const c = ground.lotCentre(r.x, r.y)
    let arms = 0
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      if (has.has(`${r.x + dx},${r.y + dy}`)) {
        const o = ground.lotCentre(r.x + dx, r.y + dy)
        strip(c.x, c.z, o.x, o.z)
        arms++
      }
    }
    for (const [dx, dy] of [[-1, 0], [0, -1]] as const) if (has.has(`${r.x + dx},${r.y + dy}`)) arms++
    if (arms === 0) strip(c.x - 8, c.z, c.x + 8, c.z)
    // a square where roads meet
    const sq = 5
    strip(c.x - sq, c.z - sq * 0.5, c.x + sq, c.z - sq * 0.5)
    strip(c.x - sq, c.z + sq * 0.5, c.x + sq, c.z + sq * 0.5)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  geo.setIndex(new BufferAttribute(pos.length / 3 > 65000 ? new Uint32Array(idx) : new Uint16Array(idx), 1))
  geo.computeVertexNormals()
  // strips wind either way: light them from above regardless
  const nrm = geo.attributes.normal
  for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i))
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const mesh = new Mesh(geo, mat)
  mesh.name = 'village-roads'
  return { mesh, dispose() { geo.dispose(); mat.dispose() } }
}
