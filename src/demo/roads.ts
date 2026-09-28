// Realistic procedural roads, centred in the 30.54m lot grid: local/
// arterial/highway asphalt ribbons (with lane markings baked into their own
// canvas texture — see proceduralTextures.ts), raised curb sidewalks,
// zebra crosswalks at junctions, river bridges with railings, and the
// elevated highway on pillars with ramps at both ends of the exported
// window. Every layer is ONE merged BufferGeometry per material (asphalt
// local / asphalt arterial / asphalt highway / sidewalk / guardrail /
// crosswalk / pillar) — a handful of draw calls no matter how many road
// cells there are.

import { DoubleSide, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { ROAD_CLASS_ARTERIAL, ROAD_CLASS_HIGHWAY } from './cityExportTypes'
import { GeomAccum } from './meshBuilder'
import { ELEVATION_SCALE } from './terrain'
import { makeRoadTexture, makeSidewalkTexture } from './proceduralTextures'

const ROAD_THICKNESS = 0.1
const SIDEWALK_WIDTH = 3
const SIDEWALK_THICKNESS = 0.16
const HIGHWAY_CLEARANCE = 9
const HIGHWAY_RAMP_CELLS = 5
const RAIL_HEIGHT = 1.05
const RAIL_THICKNESS = 0.08
const PILLAR_SIZE = 1.4

function widthForClass(cls: number): number {
  if (cls === ROAD_CLASS_HIGHWAY) return 19
  if (cls === ROAD_CLASS_ARTERIAL) return 15
  return 8
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export interface RoadsResult {
  objects: Object3D[]
  dispose(): void
}

export function buildRoads(grids: CityGrids): RoadsResult {
  const doc = grids.doc
  const size = doc.city.size
  const lot = doc.lotMeters
  const half = lot / 2

  const cellClass = new Map<string, number>()
  for (const r of doc.city.roads) cellClass.set(`${r.x},${r.y}`, r.class)
  const bridgeSet = new Set<string>(doc.city.bridges.map((b) => `${b.x},${b.y}`))
  const classAt = (x: number, y: number): number | undefined => cellClass.get(`${x},${y}`)
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size

  const asphaltLocal = new GeomAccum()
  const asphaltArterial = new GeomAccum()
  const asphaltHighway = new GeomAccum()
  const sidewalk = new GeomAccum()
  const crosswalk = new GeomAccum()
  const guardrail = new GeomAccum()
  const pillars = new GeomAccum()

  const cellY = (lx: number, ly: number): number => grids.cityElevAt(lx, ly) * ELEVATION_SCALE

  // -- bridges: connected components of the bridge set, each a flat deck --
  const bridgeGroupId = new Map<string, number>()
  const bridgeDeckY = new Map<number, number>()
  {
    let nextId = 0
    for (const key of bridgeSet) {
      if (bridgeGroupId.has(key)) continue
      const id = nextId++
      const stack = [key]
      const members: [number, number][] = []
      bridgeGroupId.set(key, id)
      while (stack.length) {
        const k = stack.pop() as string
        const [cx, cy] = k.split(',').map(Number)
        members.push([cx, cy])
        for (const [dx, dy] of DIRS) {
          const nk = `${cx + dx},${cy + dy}`
          if (bridgeSet.has(nk) && !bridgeGroupId.has(nk)) {
            bridgeGroupId.set(nk, id)
            stack.push(nk)
          }
        }
      }
      // Anchor height: the ground road cells touching this bridge group,
      // clamped to sit above the water under the span.
      let anchorSum = 0
      let anchorN = 0
      let waterMax = -Infinity
      for (const [cx, cy] of members) {
        waterMax = Math.max(waterMax, cellY(cx, cy))
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx
          const ny = cy + dy
          const nk = `${nx},${ny}`
          if (bridgeSet.has(nk) || !inBounds(nx, ny)) continue
          if (!cellClass.has(nk)) continue
          anchorSum += cellY(nx, ny)
          anchorN++
        }
      }
      const base = anchorN > 0 ? anchorSum / anchorN : waterMax
      bridgeDeckY.set(id, Math.max(base, waterMax + 1.6))
    }
  }

  // -- ground/bridge ribbon: for every non-highway road cell, a centre
  // square plus one extension per connected neighbour, unioned into a
  // continuous ribbon that always matches its neighbour's width at their
  // shared edge (see this file's own design note in the project report). --
  for (const [key, cls] of cellClass) {
    if (cls === ROAD_CLASS_HIGHWAY) continue
    const [x, y] = key.split(',').map(Number)
    const isBridge = bridgeSet.has(key)
    const groupId = bridgeGroupId.get(key)
    const selfY = isBridge && groupId !== undefined ? (bridgeDeckY.get(groupId) as number) : cellY(x, y)
    const { x: cx, z: cz } = grids.cityScene(x, y)
    const target = cls === ROAD_CLASS_ARTERIAL ? asphaltArterial : asphaltLocal

    let widthHere = widthForClass(cls)
    for (const [dx, dy] of DIRS) {
      const nk = `${x + dx},${y + dy}`
      const nc = classAt(x + dx, y + dy)
      if (nc !== undefined) widthHere = Math.max(widthHere, widthForClass(nc))
    }
    const hw = widthHere / 2

    addFlatBox(target, cx - hw, cx + hw, selfY, cz - hw, cz + hw, 8, 8)
    sidewalkSide(sidewalk, cx, cz, selfY, hw, half, 'n', !hasNeighbor(classAt, x, y, 0, -1))
    sidewalkSide(sidewalk, cx, cz, selfY, hw, half, 's', !hasNeighbor(classAt, x, y, 0, 1))
    sidewalkSide(sidewalk, cx, cz, selfY, hw, half, 'e', !hasNeighbor(classAt, x, y, 1, 0))
    sidewalkSide(sidewalk, cx, cz, selfY, hw, half, 'w', !hasNeighbor(classAt, x, y, -1, 0))

    let connections = 0
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      const nk = `${nx},${ny}`
      const nc = classAt(nx, ny)
      if (nc === undefined) continue
      connections++
      const neighborIsBridge = bridgeSet.has(nk)
      const neighborGroup = bridgeGroupId.get(nk)
      const neighborY = neighborIsBridge && neighborGroup !== undefined ? (bridgeDeckY.get(neighborGroup) as number) : cellY(nx, ny)
      const extWidth = Math.max(widthForClass(cls), widthForClass(nc))
      const ehw = extWidth / 2
      // Extension rectangle from this cell's road edge out to the shared
      // boundary with the neighbour, sloping from this cell's own surface
      // height to the neighbour's (flat when they match — the common
      // case; a visible ramp only where a bridge/highway meets ground).
      const dirTarget = nc === ROAD_CLASS_ARTERIAL ? asphaltArterial : asphaltLocal
      if (dx === 1) addSlopedStrip(dirTarget, cx + hw, cx + half, cz - ehw, cz + ehw, selfY, neighborY, true)
      else if (dx === -1) addSlopedStrip(dirTarget, cx - half, cx - hw, cz - ehw, cz + ehw, selfY, neighborY, true)
      else if (dy === 1) addSlopedStrip(dirTarget, cx - ehw, cx + ehw, cz + hw, cz + half, selfY, neighborY, false)
      else if (dy === -1) addSlopedStrip(dirTarget, cx - ehw, cx + ehw, cz - half, cz - hw, selfY, neighborY, false)
    }

    // Crosswalks at real junctions (3+ connections, or a straight-through
    // pair on both axes — a cross or T).
    const ew = classAt(x + 1, y) !== undefined || classAt(x - 1, y) !== undefined
    const ns = classAt(x, y + 1) !== undefined || classAt(x, y - 1) !== undefined
    if (ew && ns && !isBridge) {
      addCrosswalks(crosswalk, cx, cz, selfY + 0.01, hw)
    }
    void connections
  }

  // -- bridge railings: along the two long edges of each bridge group that
  // face outward (no bridge/road neighbour in that direction). --
  for (const key of bridgeSet) {
    const [x, y] = key.split(',').map(Number)
    const groupId = bridgeGroupId.get(key) as number
    const deckY = bridgeDeckY.get(groupId) as number
    const { x: cx, z: cz } = grids.cityScene(x, y)
    const cls = classAt(x, y) ?? ROAD_CLASS_ARTERIAL
    const hw = widthForClass(cls) / 2
    for (const side of ['n', 's', 'e', 'w'] as const) {
      const [dx, dy] = side === 'n' ? [0, -1] : side === 's' ? [0, 1] : side === 'e' ? [1, 0] : [-1, 0]
      if (hasNeighbor(classAt, x, y, dx, dy)) continue
      addRailSegment(guardrail, cx, cz, deckY + ROAD_THICKNESS, hw, half, side)
    }
  }

  // -- elevated highway: a flat deck with ramps at both ends of the export
  // window, pillars every couple of cells, guardrails both edges. --
  const highwayCells = doc.city.roads.filter((r) => r.class === ROAD_CLASS_HIGHWAY).sort((a, b) => a.x - b.x)
  if (highwayCells.length > 0) {
    let maxGround = -Infinity
    for (const c of highwayCells) maxGround = Math.max(maxGround, cellY(c.x, c.y))
    const deckY = maxGround + HIGHWAY_CLEARANCE
    const hw = widthForClass(ROAD_CLASS_HIGHWAY) / 2
    const n = highwayCells.length

    highwayCells.forEach((c, idx) => {
      const { x: cx, z: cz } = grids.cityScene(c.x, c.y)
      const groundY = cellY(c.x, c.y)
      let y0 = deckY
      let y1 = deckY
      if (idx < HIGHWAY_RAMP_CELLS) {
        const t = idx / HIGHWAY_RAMP_CELLS
        y0 = groundY + (deckY - groundY) * t
        y1 = groundY + (deckY - groundY) * Math.min(1, (idx + 1) / HIGHWAY_RAMP_CELLS)
      } else if (idx >= n - HIGHWAY_RAMP_CELLS) {
        const fromEnd = n - 1 - idx
        const t = fromEnd / HIGHWAY_RAMP_CELLS
        y0 = groundY + (deckY - groundY) * Math.min(1, (fromEnd + 1) / HIGHWAY_RAMP_CELLS)
        y1 = groundY + (deckY - groundY) * t
      }
      addSlopedStrip(asphaltHighway, cx - half, cx + half, cz - hw, cz + hw, y0, y1, true)

      if (idx % 2 === 0) {
        const pillarTop = Math.min(y0, y1) - 0.05
        addFlatBox(pillars, cx - PILLAR_SIZE / 2, cx + PILLAR_SIZE / 2, (groundY + pillarTop) / 2, cz - PILLAR_SIZE / 2, cz + PILLAR_SIZE / 2, 1, 1, groundY, pillarTop)
      }

      const yMid = (y0 + y1) / 2
      addRailSegment(guardrail, cx, cz, yMid + ROAD_THICKNESS, hw, half, 'n')
      addRailSegment(guardrail, cx, cz, yMid + ROAD_THICKNESS, hw, half, 's')
    })
  }

  const { texture: localTex } = makeRoadTexture('local', 11)
  const { texture: arterialTex } = makeRoadTexture('arterial', 12)
  const { texture: highwayTex } = makeRoadTexture('highway', 13)
  const sidewalkTex = makeSidewalkTexture(14)

  const objects: Object3D[] = []
  const materials: MeshStandardMaterial[] = []

  const addMesh = (accum: GeomAccum, material: MeshStandardMaterial) => {
    const geo = accum.toGeometry()
    if (!geo) return
    const mesh = new Mesh(geo, material)
    objects.push(mesh)
  }

  const matLocal = new MeshStandardMaterial({ map: localTex, roughness: 0.95, side: DoubleSide })
  const matArterial = new MeshStandardMaterial({ map: arterialTex, roughness: 0.95, side: DoubleSide })
  const matHighway = new MeshStandardMaterial({ map: highwayTex, roughness: 0.9, side: DoubleSide })
  const matSidewalk = new MeshStandardMaterial({ map: sidewalkTex, roughness: 1, side: DoubleSide })
  const matCrosswalk = new MeshStandardMaterial({ color: 0xeceadf, roughness: 0.9, side: DoubleSide })
  const matGuardrail = new MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.55, metalness: 0.35, side: DoubleSide })
  const matPillar = new MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9, side: DoubleSide })
  materials.push(matLocal, matArterial, matHighway, matSidewalk, matCrosswalk, matGuardrail, matPillar)

  addMesh(asphaltLocal, matLocal)
  addMesh(asphaltArterial, matArterial)
  addMesh(asphaltHighway, matHighway)
  addMesh(sidewalk, matSidewalk)
  addMesh(crosswalk, matCrosswalk)
  addMesh(guardrail, matGuardrail)
  addMesh(pillars, matPillar)

  return {
    objects,
    dispose() {
      for (const o of objects) {
        const m = o as Mesh
        m.geometry.dispose()
      }
      for (const mat of materials) mat.dispose()
      localTex.dispose()
      arterialTex.dispose()
      highwayTex.dispose()
      sidewalkTex.dispose()
    },
  }
}

function hasNeighbor(classAt: (x: number, y: number) => number | undefined, x: number, y: number, dx: number, dy: number): boolean {
  return classAt(x + dx, y + dy) !== undefined
}

function addFlatBox(accum: GeomAccum, x0: number, x1: number, yTop: number, z0: number, z1: number, uPeriod: number, vPeriod: number, yBottomOverride?: number, yTopOverride?: number) {
  const top = yTopOverride ?? yTop + ROAD_THICKNESS / 2
  const bottom = yBottomOverride ?? yTop - ROAD_THICKNESS / 2
  accum.addBox(new Vector3(x0, bottom, z0), new Vector3(x1, top, z1), uPeriod, vPeriod)
}

/** A rectangle whose top face slopes linearly from y0 (at the `alongX`
 * axis's low edge) to y1 (at its high edge) — a flat road segment when
 * y0===y1, a ramp otherwise (bridge/highway approaches). */
function addSlopedStrip(accum: GeomAccum, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, alongX: boolean) {
  const th = ROAD_THICKNESS
  const a = alongX ? new Vector3(x0, y0 + th / 2, z0) : new Vector3(x0, y0 + th / 2, z0)
  const b = alongX ? new Vector3(x1, y1 + th / 2, z0) : new Vector3(x1, y0 + th / 2, z0)
  const c = alongX ? new Vector3(x1, y1 + th / 2, z1) : new Vector3(x1, y1 + th / 2, z1)
  const d = alongX ? new Vector3(x0, y0 + th / 2, z1) : new Vector3(x0, y1 + th / 2, z1)
  accum.addRect(a, b, c, d, new Vector3(0, 1, 0), 8, 8)
  // Underside strip so a ramp never reads as an infinitely thin sliver
  // from below/the side.
  const a2 = new Vector3(a.x, a.y - th, a.z)
  const b2 = new Vector3(b.x, b.y - th, b.z)
  const c2 = new Vector3(c.x, c.y - th, c.z)
  const d2 = new Vector3(d.x, d.y - th, d.z)
  accum.addRect(d2, c2, b2, a2, new Vector3(0, -1, 0), 8, 8)
}

function sidewalkSide(accum: GeomAccum, cx: number, cz: number, y: number, roadHalf: number, cellHalf: number, side: 'n' | 's' | 'e' | 'w', exposed: boolean) {
  if (!exposed) return
  const top = y + ROAD_THICKNESS / 2 + SIDEWALK_THICKNESS
  const bottom = y - ROAD_THICKNESS / 2
  let x0: number, x1: number, z0: number, z1: number
  if (side === 'n') {
    x0 = cx - roadHalf
    x1 = cx + roadHalf
    z0 = cz - roadHalf - SIDEWALK_WIDTH
    z1 = cz - roadHalf
  } else if (side === 's') {
    x0 = cx - roadHalf
    x1 = cx + roadHalf
    z0 = cz + roadHalf
    z1 = cz + roadHalf + SIDEWALK_WIDTH
  } else if (side === 'e') {
    x0 = cx + roadHalf
    x1 = cx + roadHalf + SIDEWALK_WIDTH
    z0 = cz - roadHalf
    z1 = cz + roadHalf
  } else {
    x0 = cx - roadHalf - SIDEWALK_WIDTH
    x1 = cx - roadHalf
    z0 = cz - roadHalf
    z1 = cz + roadHalf
  }
  x0 = Math.max(x0, cx - cellHalf)
  x1 = Math.min(x1, cx + cellHalf)
  z0 = Math.max(z0, cz - cellHalf)
  z1 = Math.min(z1, cz + cellHalf)
  if (x1 <= x0 || z1 <= z0) return
  accum.addBox(new Vector3(x0, bottom, z0), new Vector3(x1, top, z1), 1.5, 1.5)
}

function addCrosswalks(accum: GeomAccum, cx: number, cz: number, y: number, roadHalf: number) {
  const stripeLen = 0.7
  const gap = 0.55
  const bandWidth = roadHalf * 1.7
  const barW = 0.4
  for (const dir of [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
  ] as const) {
    const [dx, dy] = dir
    const baseX = cx + dx * (roadHalf + 0.3)
    const baseZ = cz + dy * (roadHalf + 0.3)
    const alongX = dx !== 0
    let offset = -bandWidth / 2
    while (offset < bandWidth / 2) {
      const cxs = alongX ? baseX : baseX + offset
      const czs = alongX ? baseZ + offset : baseZ
      const x0 = alongX ? cxs - barW / 2 : cxs - stripeLen / 2
      const x1 = alongX ? cxs + barW / 2 : cxs + stripeLen / 2
      const z0 = alongX ? czs - stripeLen / 2 : czs - barW / 2
      const z1 = alongX ? czs + stripeLen / 2 : czs + barW / 2
      accum.addRect(new Vector3(x0, y, z0), new Vector3(x1, y, z0), new Vector3(x1, y, z1), new Vector3(x0, y, z1), new Vector3(0, 1, 0), 1, 1)
      offset += stripeLen + gap
    }
  }
}

function addRailSegment(accum: GeomAccum, cx: number, cz: number, y: number, roadHalf: number, cellHalf: number, side: 'n' | 's' | 'e' | 'w') {
  const len = cellHalf * 2
  let x0: number, x1: number, z0: number, z1: number
  if (side === 'n') {
    x0 = cx - len / 2
    x1 = cx + len / 2
    z0 = cz - roadHalf - RAIL_THICKNESS
    z1 = cz - roadHalf
  } else if (side === 's') {
    x0 = cx - len / 2
    x1 = cx + len / 2
    z0 = cz + roadHalf
    z1 = cz + roadHalf + RAIL_THICKNESS
  } else if (side === 'e') {
    x0 = cx + roadHalf
    x1 = cx + roadHalf + RAIL_THICKNESS
    z0 = cz - len / 2
    z1 = cz + len / 2
  } else {
    x0 = cx - roadHalf - RAIL_THICKNESS
    x1 = cx - roadHalf
    z0 = cz - len / 2
    z1 = cz + len / 2
  }
  accum.addBox(new Vector3(x0, y, z0), new Vector3(x1, y + RAIL_HEIGHT, z1), 1, 1)
}
