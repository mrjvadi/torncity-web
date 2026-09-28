// Street props — lowest priority per the project brief: lamps along roads,
// street trees on sidewalks (the existing Kenney tree GLBs), and a handful
// of parked cars as simple boxes. Everything here is either merged into one
// or two draw calls (lamps) or instanced (trees, cars), so this layer's
// entire cost is a few extra draw calls regardless of the city's size.

import { Color, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { ROAD_CLASS_HIGHWAY } from './cityExportTypes'
import { GeomAccum } from './meshBuilder'
import { ELEVATION_SCALE } from './terrain'
import { kitGeometry } from './kitAssets'

const LAMP_SPACING_CELLS = 3
const SIDEWALK_OFFSET = 4.4 // just past the 3m sidewalk, near its outer edge
const CAR_COLORS = [0xb23a3a, 0x2f4f7a, 0xd8d3c4, 0x3a3f42, 0x6b6f73]

function hashP(x: number, y: number, salt: number): number {
  const h = Math.imul(x * 2654435761, 1) ^ Math.imul(y * 2246822519, 1) ^ Math.imul(salt, 3266489917)
  return (h >>> 0) / 4294967295
}

function addLamp(accum: GeomAccum, x: number, z: number, y: number) {
  const poleR = 0.06
  accum.addBox(new Vector3(x - poleR, y, z - poleR), new Vector3(x + poleR, y + 3.6, z + poleR), 1, 1)
  accum.addBox(new Vector3(x - 0.22, y + 3.45, z - 0.1), new Vector3(x + 0.22, y + 3.65, z + 0.1), 1, 1)
}

export interface PropsResult {
  objects: Object3D[]
  dispose(): void
}

export async function buildProps(grids: CityGrids): Promise<PropsResult> {
  const doc = grids.doc
  const cellClass = new Map<string, number>()
  for (const r of doc.city.roads) cellClass.set(`${r.x},${r.y}`, r.class)
  const bridgeSet = new Set(doc.city.bridges.map((b) => `${b.x},${b.y}`))

  const lampAccum = new GeomAccum()
  const lampMat = new MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.6, metalness: 0.3, side: DoubleSide })

  const treeSpots: { pos: Vector3; scale: number; rot: number }[] = []
  const carSpots: { pos: Vector3; rot: number; color: number }[] = []

  for (const [key, cls] of cellClass) {
    if (cls === ROAD_CLASS_HIGHWAY || bridgeSet.has(key)) continue
    const [x, y] = key.split(',').map(Number)
    if (((x + y) % LAMP_SPACING_CELLS) !== 0) continue

    const west = cellClass.has(`${x - 1},${y}`)
    const east = cellClass.has(`${x + 1},${y}`)
    const north = cellClass.has(`${x},${y - 1}`)
    const south = cellClass.has(`${x},${y + 1}`)
    const horizontal = west || east
    const vertical = north || south
    if (!horizontal && !vertical) continue

    const { x: cx, z: cz } = grids.cityScene(x, y)
    const ey = grids.cityElevAt(x, y) * ELEVATION_SCALE

    // Pick the side that is actually a free sidewalk edge (no road
    // continuing that direction) so props never spawn on top of asphalt.
    const sides: [number, number][] = []
    if (horizontal && !north) sides.push([0, -1])
    if (horizontal && !south) sides.push([0, 1])
    if (vertical && !west) sides.push([-1, 0])
    if (vertical && !east) sides.push([1, 0])
    if (sides.length === 0) continue
    const [sdx, sdz] = sides[Math.floor(hashP(x, y, 3) * sides.length)]
    const px = cx + sdx * SIDEWALK_OFFSET
    const pz = cz + sdz * SIDEWALK_OFFSET

    addLamp(lampAccum, px, pz, ey)

    if (hashP(x, y, 7) > 0.45) {
      treeSpots.push({ pos: new Vector3(px + sdx * 1.2, ey, pz + sdz * 1.2), scale: 1.6 + hashP(x, y, 9) * 0.8, rot: hashP(x, y, 11) * Math.PI * 2 })
    }
    if (cls !== ROAD_CLASS_HIGHWAY && hashP(x, y, 13) > 0.72 && horizontal !== vertical) {
      const carColor = CAR_COLORS[Math.floor(hashP(x, y, 17) * CAR_COLORS.length)]
      const alongX = vertical // car parks parallel to the road it sits beside
      carSpots.push({ pos: new Vector3(cx + sdx * (SIDEWALK_OFFSET - 2.2), ey, cz + sdz * (SIDEWALK_OFFSET - 2.2)), rot: alongX ? Math.PI / 2 : 0, color: carColor })
    }
  }

  const objects: Object3D[] = []
  const disposables: { dispose(): void }[] = []

  const lampGeo = lampAccum.toGeometry()
  if (lampGeo) {
    const mesh = new Mesh(lampGeo, lampMat)
    objects.push(mesh)
    disposables.push(lampGeo, lampMat)
  }

  const treeTemplate = await kitGeometry('grass-trees')
  if (treeTemplate && treeSpots.length > 0) {
    const mesh = new InstancedMesh(treeTemplate.geometry, treeTemplate.material, treeSpots.length)
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    treeSpots.forEach((s, idx) => {
      q.setFromAxisAngle(up, s.rot)
      m.compose(s.pos, q, new Vector3(s.scale, s.scale, s.scale))
      mesh.setMatrixAt(idx, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    objects.push(mesh)
  }

  if (carSpots.length > 0) {
    const carGeo = new GeomAccum()
    carGeo.addBox(new Vector3(-2.1, 0, -0.9), new Vector3(2.1, 1.4, 0.9), 4, 2)
    const geo = carGeo.toGeometry()
    if (geo) {
      const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2, side: DoubleSide })
      const mesh = new InstancedMesh(geo, mat, carSpots.length)
      const m = new Matrix4()
      const q = new Quaternion()
      const up = new Vector3(0, 1, 0)
      const color = new Color()
      carSpots.forEach((s, idx) => {
        q.setFromAxisAngle(up, s.rot)
        m.compose(new Vector3(s.pos.x, s.pos.y + 0.35, s.pos.z), q, new Vector3(1, 1, 1))
        mesh.setMatrixAt(idx, m)
        color.setHex(s.color)
        mesh.setColorAt(idx, color)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      objects.push(mesh)
      disposables.push(geo, mat)
    }
  }

  return {
    objects,
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
