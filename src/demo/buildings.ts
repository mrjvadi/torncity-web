// Realistic procedural buildings: extrude every lot footprint (a small
// setback in from the sidewalk), height = floors * 3.2m, four facade
// materials (glass curtain wall / brick midrise with a ground shop band /
// smaller brick-or-plaster housing / stone civic), rooftop clutter, and a
// simple two-tier setback on the tallest towers. Park and farm lots get
// their own non-extruded treatment. Merged by material — glass, midrise,
// housing, stone, shopfront, roof, roof-clutter, park-ground, farm is 9
// draw calls total for the whole city, comfortably under the ~20 budget.

import { Color, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import type { CityGrids } from './grids'
import type { CityLotJSON } from './cityExportTypes'
import { GeomAccum } from './meshBuilder'
import { ELEVATION_SCALE } from './terrain'
import { makeFacadeTexture, makeFarmTexture, makeRoofTexture, makeShopfrontTexture, type FacadeKind } from './proceduralTextures'
import { kitGeometry } from './kitAssets'

const SETBACK = 1.6
const FLOOR_HEIGHT = 3.2
const WINDOW_PITCH = 1.5
const SHOPFRONT_HEIGHT = 3.4
const TIER_FLOOR_THRESHOLD = 24
const TIER_INSET = 2.4

function hash2(x: number, y: number, salt: number): number {
  const h = Math.imul(x * 73856093, 1) ^ Math.imul(y * 19349663, 1) ^ Math.imul(salt, 83492791)
  return (h >>> 0) / 4294967295
}

type Category = 'glass' | 'midrise' | 'housing' | 'stone'

function categoryOf(type: string): Category | 'park' | 'farm' | null {
  switch (type) {
    case 'tower_office':
    case 'tower_residential':
      return 'glass'
    case 'midrise':
      return 'midrise'
    case 'housing':
      return 'housing'
    case 'park':
      return 'park'
    case 'farm':
      return 'farm'
    case 'civic_hall':
    case 'market':
    case 'bank':
    case 'school':
    case 'clinic':
    case 'police':
    case 'port':
    case 'mine':
      return 'stone'
    default:
      return null
  }
}

interface Footprint {
  x0: number
  x1: number
  z0: number
  z1: number
  baseY: number
}

function footprintOf(grids: CityGrids, lot: CityLotJSON): Footprint {
  const a = grids.cityScene(lot.x, lot.y)
  const b = grids.cityScene(lot.x + lot.w, lot.y + lot.h)
  const x0 = Math.min(a.x, b.x) + SETBACK
  const x1 = Math.max(a.x, b.x) - SETBACK
  const z0 = Math.min(a.z, b.z) + SETBACK
  const z1 = Math.max(a.z, b.z) - SETBACK
  const cx = Math.round(lot.x + lot.w / 2)
  const cz = Math.round(lot.y + lot.h / 2)
  const baseY = grids.cityElevAt(cx, cz) * ELEVATION_SCALE
  return { x0, x1, z0, z1, baseY }
}

function addWallRing(accum: GeomAccum, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) {
  const h = y1 - y0
  if (h <= 0.01) return
  const p = (x: number, y: number, z: number) => new Vector3(x, y, z)
  // +Z (south)
  accum.addRect(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), new Vector3(0, 0, 1), WINDOW_PITCH, FLOOR_HEIGHT)
  // -Z (north)
  accum.addRect(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), new Vector3(0, 0, -1), WINDOW_PITCH, FLOOR_HEIGHT)
  // +X (east)
  accum.addRect(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), new Vector3(1, 0, 0), WINDOW_PITCH, FLOOR_HEIGHT)
  // -X (west)
  accum.addRect(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), new Vector3(-1, 0, 0), WINDOW_PITCH, FLOOR_HEIGHT)
}

function addFlatCap(accum: GeomAccum, x0: number, x1: number, z0: number, z1: number, y: number, up: boolean) {
  const p = (x: number, z: number) => new Vector3(x, y, z)
  const n = new Vector3(0, up ? 1 : -1, 0)
  if (up) accum.addRect(p(x0, z1), p(x1, z1), p(x1, z0), p(x0, z0), n, 4, 4)
  else accum.addRect(p(x0, z0), p(x1, z0), p(x1, z1), p(x0, z1), n, 4, 4)
}

function addRoofClutter(accum: GeomAccum, x0: number, x1: number, z0: number, z1: number, y: number, lx: number, ly: number) {
  const w = x1 - x0
  const d = z1 - z0
  if (w < 3 || d < 3) return
  const acCount = 1 + Math.floor(hash2(lx, ly, 51) * 3)
  for (let i = 0; i < acCount; i++) {
    const hx = hash2(lx, ly, 52 + i)
    const hz = hash2(lx, ly, 62 + i)
    const cx = x0 + 0.6 + hx * (w - 1.2)
    const cz = z0 + 0.6 + hz * (d - 1.2)
    const s = 0.5 + hash2(lx, ly, 72 + i) * 0.35
    accum.addBox(new Vector3(cx - s / 2, y, cz - s / 2), new Vector3(cx + s / 2, y + s * 0.8, cz + s / 2), 1, 1)
  }
  if (hash2(lx, ly, 81) > 0.45 && w > 6 && d > 6) {
    const px0 = x0 + w * 0.15
    const px1 = x0 + w * 0.55
    const pz0 = z0 + d * 0.55
    const pz1 = z0 + d * 0.85
    accum.addBox(new Vector3(px0, y, pz0), new Vector3(px1, y + 0.12, pz1), 4, 4)
  }
  // Parapet ring.
  const pw = 0.35
  accum.addBox(new Vector3(x0, y, z0), new Vector3(x1, y + 0.5, z0 + pw), 4, 1)
  accum.addBox(new Vector3(x0, y, z1 - pw), new Vector3(x1, y + 0.5, z1), 4, 1)
  accum.addBox(new Vector3(x0, y, z0), new Vector3(x0 + pw, y + 0.5, z1), 1, 4)
  accum.addBox(new Vector3(x1 - pw, y, z0), new Vector3(x1, y + 0.5, z1), 1, 4)
}

export interface BuildingsResult {
  objects: Object3D[]
  dispose(): void
}

export async function buildBuildings(grids: CityGrids): Promise<BuildingsResult> {
  const lots = grids.doc.city.lots

  const walls: Record<Category, GeomAccum> = {
    glass: new GeomAccum(),
    midrise: new GeomAccum(),
    housing: new GeomAccum(),
    stone: new GeomAccum(),
  }
  const shopfront = new GeomAccum()
  const roof = new GeomAccum()
  const roofClutter = new GeomAccum()
  const farmField = new GeomAccum()
  const parkGround = new GeomAccum()

  const parkLots: CityLotJSON[] = []

  for (const lot of lots) {
    const cat = categoryOf(lot.type)
    if (!cat) continue
    if (cat === 'park') {
      parkLots.push(lot)
      const fp = footprintOf(grids, lot)
      addFlatCap(parkGround, fp.x0 - SETBACK + 0.3, fp.x1 + SETBACK - 0.3, fp.z0 - SETBACK + 0.3, fp.z1 + SETBACK - 0.3, fp.baseY + 0.03, true)
      continue
    }
    if (cat === 'farm') {
      const fp = footprintOf(grids, lot)
      addFlatCap(farmField, fp.x0 - SETBACK + 0.4, fp.x1 + SETBACK - 0.4, fp.z0 - SETBACK + 0.4, fp.z1 + SETBACK - 0.4, fp.baseY + 0.02, true)
      continue
    }

    const fp = footprintOf(grids, lot)
    if (fp.x1 <= fp.x0 || fp.z1 <= fp.z0) continue
    const floors = Math.max(1, lot.floors)
    const totalHeight = floors * FLOOR_HEIGHT
    const target = walls[cat]

    if (floors >= TIER_FLOOR_THRESHOLD) {
      const lowerFloors = Math.round(floors * 0.62)
      const lowerH = lowerFloors * FLOOR_HEIGHT
      const upperFloors = floors - lowerFloors
      addWallRing(target, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY, fp.baseY + lowerH)
      const ix0 = fp.x0 + TIER_INSET
      const ix1 = fp.x1 - TIER_INSET
      const iz0 = fp.z0 + TIER_INSET
      const iz1 = fp.z1 - TIER_INSET
      if (ix1 > ix0 && iz1 > iz0) {
        addFlatCap(roof, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY + lowerH, true)
        addWallRing(target, ix0, ix1, iz0, iz1, fp.baseY + lowerH, fp.baseY + lowerH + upperFloors * FLOOR_HEIGHT)
        addFlatCap(roof, ix0, ix1, iz0, iz1, fp.baseY + totalHeight, true)
        addRoofClutter(roofClutter, ix0, ix1, iz0, iz1, fp.baseY + totalHeight + 0.01, lot.x, lot.y)
      } else {
        addFlatCap(roof, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY + lowerH, true)
      }
    } else {
      addWallRing(target, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY, fp.baseY + totalHeight)
      addFlatCap(roof, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY + totalHeight, true)
      addRoofClutter(roofClutter, fp.x0, fp.x1, fp.z0, fp.z1, fp.baseY + totalHeight + 0.01, lot.x, lot.y)
    }

    if (cat === 'midrise' || cat === 'stone') {
      const o = 0.03
      addWallRing(shopfront, fp.x0 - o, fp.x1 + o, fp.z0 - o, fp.z1 + o, fp.baseY, fp.baseY + Math.min(SHOPFRONT_HEIGHT, totalHeight))
    }
  }

  const facades: Record<Category, ReturnType<typeof makeFacadeTexture>> = {
    glass: makeFacadeTexture('glass', 21),
    midrise: makeFacadeTexture('midrise', 22),
    housing: makeFacadeTexture('housing', 23),
    stone: makeFacadeTexture('stone', 24),
  }
  const shopfrontTex = makeShopfrontTexture(25)
  const roofTex = makeRoofTexture(26)
  const farmTex = makeFarmTexture(27)

  const objects: Object3D[] = []
  const disposables: { geometry: { dispose(): void }; material: { dispose(): void } }[] = []

  const addMesh = (accum: GeomAccum, material: MeshStandardMaterial) => {
    const geo = accum.toGeometry()
    if (!geo) return
    const mesh = new Mesh(geo, material)
    objects.push(mesh)
    disposables.push({ geometry: geo, material })
  }

  ;(Object.keys(walls) as Category[]).forEach((cat) => {
    const mat = new MeshStandardMaterial({ map: facades[cat].texture, roughness: cat === 'glass' ? 0.25 : 0.92, metalness: cat === 'glass' ? 0.15 : 0, side: DoubleSide })
    addMesh(walls[cat], mat)
  })
  addMesh(shopfront, new MeshStandardMaterial({ map: shopfrontTex, roughness: 0.4, side: DoubleSide }))
  addMesh(roof, new MeshStandardMaterial({ map: roofTex, roughness: 1, side: DoubleSide }))
  addMesh(roofClutter, new MeshStandardMaterial({ color: 0x6d716c, roughness: 0.85, side: DoubleSide }))
  addMesh(farmField, new MeshStandardMaterial({ map: farmTex, roughness: 1, side: DoubleSide }))
  addMesh(parkGround, new MeshStandardMaterial({ color: new Color(0x4d8a4a), roughness: 1, side: DoubleSide }))

  await addParkTrees(grids, parkLots, objects, disposables)

  return {
    objects,
    dispose() {
      for (const d of disposables) {
        d.geometry.dispose()
        d.material.dispose()
      }
      for (const f of Object.values(facades)) f.texture.dispose()
      shopfrontTex.dispose()
      roofTex.dispose()
      farmTex.dispose()
    },
  }
}

async function addParkTrees(grids: CityGrids, parkLots: CityLotJSON[], objects: Object3D[], disposables: { geometry: { dispose(): void }; material: { dispose(): void } }[]) {
  if (parkLots.length === 0) return
  const treeGeo = await kitGeometry('grass-trees-tall')
  if (!treeGeo) return
  const spots: { pos: Vector3; scale: number }[] = []
  for (const lot of parkLots) {
    const count = 3 + Math.floor(hash2(lot.x, lot.y, 91) * 4)
    for (let i = 0; i < count; i++) {
      const hx = hash2(lot.x, lot.y, 100 + i)
      const hz = hash2(lot.x, lot.y, 140 + i)
      const local = grids.cityScene(lot.x + hx * lot.w, lot.y + hz * lot.h)
      const cx = Math.round(lot.x + hx * lot.w)
      const cz = Math.round(lot.y + hz * lot.h)
      const y = grids.cityElevAt(cx, cz) * ELEVATION_SCALE
      spots.push({ pos: new Vector3(local.x, y, local.z), scale: 2.2 + hash2(lot.x, lot.y, 160 + i) * 1.4 })
    }
  }
  if (spots.length === 0) return
  const mesh = new InstancedMesh(treeGeo.geometry, treeGeo.material, spots.length)
  const m = new Matrix4()
  spots.forEach((s, idx) => {
    m.compose(s.pos, new Quaternion(), new Vector3(s.scale, s.scale, s.scale))
    mesh.setMatrixAt(idx, m)
  })
  mesh.instanceMatrix.needsUpdate = true
  objects.push(mesh)
}

export type { FacadeKind }
