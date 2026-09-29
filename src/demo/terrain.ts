// Terrain at real metres, two LODs: the coarse 96x96 TILE grid (~305m/cell)
// as the far backdrop, and the fine 128x128 LOT grid (~30.5m/cell) as the
// near mesh the city itself sits on. The fine mesh is rendered a hair above
// the coarse one everywhere it covers (both meshes are sampled from the
// same underlying terrain, via cityExportTypes.ts's shared coordinate
// space, so they already agree on shape) — that hides the seam and avoids
// z-fighting without needing to cut a hole in the coarse mesh.

import { BufferAttribute, BufferGeometry, Color, DoubleSide, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Texture, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { makeGrassBladeTexture, makeGroundDetailTexture } from './proceduralTextures'
import { kitGeometry } from './kitAssets'

// No vertical exaggeration by default — the task's own "no vertical
// exaggeration; at most 1.2x if screenshots show the hills unreadable"
// rule. Left at 1 unless bumped (see the project report for whether that
// happened).
export const ELEVATION_SCALE = 1.0

// The fine terrain mesh is rendered this far above its own raw elevation
// (see buildGridMesh's yLift param, used below) so it always wins the
// z-fight against the coarse mesh underneath it. EVERYTHING else that
// sits "on the ground" — roads, sidewalks, buildings, props, the grass
// field — must add this same lift to grids.cityElevAt/fineElevAt, or it
// renders a couple of centimetres UNDER the visible ground and disappears
// entirely (this bit the first pass at this file: roads existed, had the
// right footprint, and were simply invisible, buried under the terrain).
export const FINE_GROUND_LIFT = 0.25

// How many metres one ground-detail-texture repeat spans — a small tile
// repeated often reads as fine mottling underfoot without needing a huge
// texture.
const GROUND_DETAIL_METERS = 8

const ROCK_COLOR = new Color(0x8a8378)
const WET_SOIL_COLOR = new Color(0x3d3324)
// A pale, rocky grey-tan rather than a beach-sand yellow — the reference
// alpine stream (refs/alp.jpg) has a rocky pale-grey bed and banks, not
// sand.
const SAND_COLOR = new Color(0xb8ae9c)
const STEEP_SLOPE = 0.55 // rise/run past which ground reads as bare rock
const WATER_NEAR_LOTS = 2.2

export interface TerrainResult {
  objects: Object3D[]
  detailTexture: Texture
  fineMaterial: MeshStandardMaterial
  coarseMaterial: MeshStandardMaterial
  dispose(): void
}

// The exported biome legend's own colours are saturated map-style swatches
// (meant to be told apart on a 2D preview map, not lit and shaded in 3D) —
// lightened toward white here so a lit, textured lawn reads as a bright
// pastel daytime park/field instead of a dark saturated blob, the same
// "nudge the source palette toward white" trick kitAssets.ts already used
// for the Kenney kit's own materials.
const GRASS_LIGHTEN = 0.3
function biomeColorLegend(grids: CityGrids): Color[] {
  const white = new Color(0xffffff)
  return grids.doc.biomeLegend.map((b) => new Color(`#${b.colorHex}`).lerp(white, GRASS_LIGHTEN))
}

function blendSlopeAndWetness(base: Color, slope: number, wet: boolean, sandy: boolean): Color {
  const c = base.clone()
  if (slope > STEEP_SLOPE) {
    const t = Math.min(1, (slope - STEEP_SLOPE) / 0.5)
    c.lerp(ROCK_COLOR, t * 0.85)
  } else if (sandy) {
    c.lerp(SAND_COLOR, 0.6)
  } else if (wet) {
    c.lerp(WET_SOIL_COLOR, 0.5)
  }
  return c
}

function buildGridMesh(
  grids: CityGrids,
  w: number,
  h: number,
  sceneOf: (i: number, j: number) => { x: number; z: number },
  elevAt: (i: number, j: number) => number,
  colorAt: (i: number, j: number) => Color,
  detailTexture: Texture,
  detailMeters: number,
  yLift: number,
): Mesh {
  const positions = new Float32Array(w * h * 3)
  const colors = new Float32Array(w * h * 3)
  const uvs = new Float32Array(w * h * 2)

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const { x, z } = sceneOf(i, j)
      positions[idx * 3 + 0] = x
      positions[idx * 3 + 1] = elevAt(i, j) * ELEVATION_SCALE + yLift
      positions[idx * 3 + 2] = z
      const c = colorAt(i, j)
      colors[idx * 3 + 0] = c.r
      colors[idx * 3 + 1] = c.g
      colors[idx * 3 + 2] = c.b
      uvs[idx * 2 + 0] = x / detailMeters
      uvs[idx * 2 + 1] = z / detailMeters
    }
  }

  const quadsX = w - 1
  const quadsY = h - 1
  const useUint32 = w * h > 65535
  const indices = useUint32 ? new Uint32Array(quadsX * quadsY * 6) : new Uint16Array(quadsX * quadsY * 6)
  let ii = 0
  for (let j = 0; j < quadsY; j++) {
    for (let i = 0; i < quadsX; i++) {
      const a = j * w + i
      const b = a + 1
      const c = a + w
      const d = c + 1
      indices[ii++] = a
      indices[ii++] = c
      indices[ii++] = b
      indices[ii++] = b
      indices[ii++] = c
      indices[ii++] = d
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(new BufferAttribute(indices, 1))
  geo.computeVertexNormals()

  const mat = new MeshStandardMaterial({
    vertexColors: true,
    map: detailTexture,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
  })
  return new Mesh(geo, mat)
}

export function buildTerrain(grids: CityGrids): TerrainResult {
  const legend = biomeColorLegend(grids)
  const detailTexture = makeGroundDetailTexture(256, 101)

  const coarseMesh = buildGridMesh(
    grids,
    grids.coarse.w,
    grids.coarse.h,
    (i, j) => grids.coarseScene(i, j),
    (i, j) => grids.coarseElevAt(i, j),
    (i, j) => {
      const idx = j * grids.coarse.w + i
      const biome = grids.coarse.biome[idx]
      const base = legend[biome] ?? new Color(0x8fae6d)
      const wet = grids.coarseIsWet(i, j)
      return wet ? base.clone().lerp(new Color(0x3f7fa6), 0.35) : base
    },
    detailTexture,
    GROUND_DETAIL_METERS * 3,
    0,
  )
  coarseMesh.name = 'terrain-coarse'

  const fineMesh = buildGridMesh(
    grids,
    grids.fine.w,
    grids.fine.h,
    (fx, fy) => grids.fineScene(fx, fy),
    (fx, fy) => grids.fineElevAt(fx, fy),
    (fx, fy) => {
      const idx = fy * grids.fine.w + fx
      const biome = grids.fine.biome[idx]
      const base = legend[biome] ?? new Color(0x8fae6d)
      const slope = grids.fineSlopeAt(fx, fy)
      const wet = grids.fineIsWet(fx, fy)
      const sandy = !wet && grids.fineNearWater(fx, fy, WATER_NEAR_LOTS)
      return blendSlopeAndWetness(base, slope, wet, sandy)
    },
    detailTexture,
    GROUND_DETAIL_METERS,
    // Lift the fine mesh a touch above the coarse one so it always wins
    // the z-fight in their shared footprint — see FINE_GROUND_LIFT's doc.
    FINE_GROUND_LIFT,
  )
  fineMesh.name = 'terrain-fine'

  return {
    objects: [coarseMesh, fineMesh],
    detailTexture,
    fineMaterial: fineMesh.material as MeshStandardMaterial,
    coarseMaterial: coarseMesh.material as MeshStandardMaterial,
    dispose() {
      coarseMesh.geometry.dispose()
      fineMesh.geometry.dispose()
      ;(coarseMesh.material as MeshStandardMaterial).dispose()
      ;(fineMesh.material as MeshStandardMaterial).dispose()
      detailTexture.dispose()
    },
  }
}

// -- near-camera grass tufts ------------------------------------------------

const GRASS_RADIUS = 200
const GRASS_FADE_BAND = 45
const GRASS_MAX_INSTANCES = 1600
const GRASS_MOVE_THRESHOLD = 10 // metres the camera must move before a re-scatter

function crossedQuadGeometry(width: number, height: number): BufferGeometry {
  const hw = width / 2
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, hw, height, 0, -hw, height, 0,
    0, 0, -hw, 0, 0, hw, 0, height, hw, 0, height, -hw,
  ])
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1])
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('normal', new BufferAttribute(normals, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(new BufferAttribute(indices, 1))
  return geo
}

function hashG(x: number, y: number, salt: number): number {
  const h = Math.imul(x * 374761393, 1) ^ Math.imul(y * 668265263, 1) ^ Math.imul(salt, 2246822519)
  return (h >>> 0) / 4294967295
}

export class GrassField {
  readonly object: InstancedMesh
  private geo: BufferGeometry
  private mat: MeshStandardMaterial
  private tex: Texture
  private grids: CityGrids
  private candidates: { fx: number; fy: number }[] = []
  private lastCamera = new Vector3(Infinity, Infinity, Infinity)
  private tmpMatrix = new Matrix4()
  private reducedMotion: boolean

  constructor(grids: CityGrids) {
    this.grids = grids
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    const forestOrGrass = new Set(
      grids.doc.biomeLegend
        .map((b, idx) => ({ idx, code: b.code }))
        .filter((b) => !['ocean', 'lake', 'desert', 'polar_ice', 'tundra'].includes(b.code))
        .map((b) => b.idx),
    )
    const { w, h } = grids.fine
    for (let fy = 2; fy < h - 2; fy++) {
      for (let fx = 2; fx < w - 2; fx++) {
        const idx = fy * w + fx
        if (!forestOrGrass.has(grids.fine.biome[idx])) continue
        if (grids.fineIsWet(fx, fy)) continue
        if (grids.fineSlopeAt(fx, fy) > 0.4) continue
        this.candidates.push({ fx, fy })
      }
    }

    this.tex = makeGrassBladeTexture(31)
    this.geo = crossedQuadGeometry(0.6, 0.55)
    this.mat = new MeshStandardMaterial({
      map: this.tex,
      alphaTest: 0.4,
      side: DoubleSide,
      roughness: 1,
    })
    this.object = new InstancedMesh(this.geo, this.mat, GRASS_MAX_INSTANCES)
    this.object.count = 0
    this.object.frustumCulled = false
  }

  /** Re-scatters tufts around `cameraPos` (scene metres) if the camera has
   * moved far enough since the last scatter to matter. Cheap enough to call
   * from the same throttle water.ts's ripple animation uses; grass itself
   * never animates (prefers-reduced-motion has no bearing on a static
   * scatter, but a reduced-motion viewer still gets one — only the WATER
   * ripple/foam is motion). Returns true if it changed anything (caller
   * should re-render). */
  update(cameraPos: Vector3): boolean {
    if (cameraPos.distanceTo(this.lastCamera) < GRASS_MOVE_THRESHOLD) return false
    this.lastCamera.copy(cameraPos)

    const scored: { fx: number; fy: number; d: number }[] = []
    for (const c of this.candidates) {
      const { x, z } = this.grids.fineScene(c.fx, c.fy)
      const d = Math.hypot(x - cameraPos.x, z - cameraPos.z)
      if (d > GRASS_RADIUS) continue
      scored.push({ fx: c.fx, fy: c.fy, d })
    }
    scored.sort((a, b) => a.d - b.d)

    let n = 0
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    for (const s of scored) {
      const perCell = 2
      for (let k = 0; k < perCell && n < GRASS_MAX_INSTANCES; k++) {
        const jx = (hashG(s.fx, s.fy, 5 + k) - 0.5) * this.grids.doc.lotMeters * 0.8
        const jz = (hashG(s.fx, s.fy, 15 + k) - 0.5) * this.grids.doc.lotMeters * 0.8
        const { x, z } = this.grids.fineScene(s.fx, s.fy)
        const wx = x + jx
        const wz = z + jz
        const fade = 1 - Math.max(0, Math.min(1, (s.d - (GRASS_RADIUS - GRASS_FADE_BAND)) / GRASS_FADE_BAND))
        if (fade <= 0.02) continue
        const y = this.grids.fineElevAt(s.fx, s.fy) * ELEVATION_SCALE + FINE_GROUND_LIFT
        const scale = fade * (0.75 + hashG(s.fx, s.fy, 25 + k) * 0.5)
        q.setFromAxisAngle(up, hashG(s.fx, s.fy, 35 + k) * Math.PI * 2)
        this.tmpMatrix.compose(new Vector3(wx, y, wz), q, new Vector3(scale, scale, scale))
        this.object.setMatrixAt(n++, this.tmpMatrix)
      }
      if (n >= GRASS_MAX_INSTANCES) break
    }
    this.object.count = n
    this.object.instanceMatrix.needsUpdate = true
    return true
  }

  dispose() {
    this.geo.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }
}

// -- countryside trees and boulders (refs/alp.jpg: dense conifer clusters,
// small boulders scattered on open grass) ------------------------------

export interface FieldResult {
  objects: Object3D[]
  dispose(): void
}

/** Tall conifers clustered into groups (a handful of cluster centres, each
 * with several trees scattered close together) rather than evenly spread
 * one-per-cell — matches the alpine reference's dense stands of trees with
 * open grass between them, not a uniform forest. Reuses the same Kenney
 * tree GLB the park/street trees already share (one shared geometry/
 * material, so this costs one extra draw call regardless of tree count). */
export async function buildTreeClusters(grids: CityGrids): Promise<FieldResult> {
  const forestCodes = new Set(
    grids.doc.biomeLegend
      .map((b, idx) => ({ idx, code: b.code }))
      .filter((b) => !['ocean', 'lake', 'desert', 'polar_ice'].includes(b.code))
      .map((b) => b.idx),
  )
  const { w, h } = grids.fine
  const { originX, originY, size } = grids.doc.city
  const inCity = (x: number, y: number) => x >= originX - 2 && x < originX + size + 2 && y >= originY - 2 && y < originY + size + 2

  // Candidate cluster centres: fine cells outside the city, on a buildable
  // (non-water, non-steep) grass/forest tile, thinned to roughly one
  // candidate per ~9 lots so clusters don't crowd each other.
  const centres: { x: number; y: number }[] = []
  for (let y = 3; y < h - 3; y += 3) {
    for (let x = 3; x < w - 3; x += 3) {
      const idx = y * w + x
      if (!forestCodes.has(grids.fine.biome[idx])) continue
      if (grids.fineIsWet(x, y)) continue
      if (grids.fineSlopeAt(x, y) > 0.45) continue
      if (inCity(x, y)) continue
      if (hashG(x, y, 201) > 0.4) continue // most candidates skipped: real stands are sparse across the map
      centres.push({ x, y })
    }
  }

  const tall = await kitGeometry('grass-trees-tall')
  const short = await kitGeometry('grass-trees')
  const objects: Object3D[] = []
  if (!tall && !short) return { objects, dispose() {} }

  type Spot = { x: number; y: number; scale: number; rot: number; tall: boolean }
  const spots: Spot[] = []
  for (const c of centres) {
    const count = 4 + Math.floor(hashG(c.x, c.y, 211) * 7) // 4..10 trees per stand
    for (let i = 0; i < count; i++) {
      const jr = 1 + hashG(c.x, c.y, 220 + i) * 3.2 // spread within the stand, in lots
      const ang = hashG(c.x, c.y, 240 + i) * Math.PI * 2
      const fx = c.x + Math.cos(ang) * jr
      const fy = c.y + Math.sin(ang) * jr
      if (grids.fineIsWet(Math.round(fx), Math.round(fy))) continue
      spots.push({
        x: fx,
        y: fy,
        scale: 2.4 + hashG(c.x + i, c.y, 250) * 2.6,
        rot: hashG(c.x, c.y + i, 260) * Math.PI * 2,
        tall: hashG(c.x, c.y, 270 + i) > 0.35,
      })
    }
  }

  const place = (geoMat: { geometry: BufferGeometry; material: import('three').Material } | null, list: Spot[]) => {
    if (!geoMat || list.length === 0) return
    const mesh = new InstancedMesh(geoMat.geometry, geoMat.material, list.length)
    const m = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    list.forEach((s, idx) => {
      const y = grids.fineElevAt(s.x, s.y) * ELEVATION_SCALE + FINE_GROUND_LIFT
      const { x: sx, z: sz } = grids.fineScene(s.x, s.y)
      q.setFromAxisAngle(up, s.rot)
      m.compose(new Vector3(sx, y, sz), q, new Vector3(s.scale, s.scale, s.scale))
      mesh.setMatrixAt(idx, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    objects.push(mesh)
  }
  place(tall, spots.filter((s) => s.tall))
  place(short, spots.filter((s) => !s.tall))

  return {
    objects,
    dispose() {
      // Geometry/material are owned by kitAssets' own cache — disposed via
      // disposeKitAssets() at scene teardown, not here.
    },
  }
}

const BOULDER_COLOR_A = new Color(0x8d897c)
const BOULDER_COLOR_B = new Color(0x716c60)

/** Small boulders scattered thinly across open grass — cheap low-poly
 * instances (one shared icosahedron), never inside the city or on water. */
export function buildBoulders(grids: CityGrids): FieldResult {
  const { w, h } = grids.fine
  const { originX, originY, size } = grids.doc.city
  const inCity = (x: number, y: number) => x >= originX - 2 && x < originX + size + 2 && y >= originY - 2 && y < originY + size + 2

  const spots: { x: number; y: number; scale: number }[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (inCity(x, y)) continue
      if (grids.fineIsWet(x, y)) continue
      if (grids.fineSlopeAt(x, y) > 0.5) continue
      if (hashG(x, y, 301) > 0.012) continue // thin scatter, not a carpet
      spots.push({ x, y, scale: 0.35 + hashG(x, y, 311) * 0.9 })
    }
  }
  if (spots.length === 0) return { objects: [], dispose() {} }

  const geo = new IcosahedronGeometry(0.5, 0)
  const mat = new MeshStandardMaterial({ color: BOULDER_COLOR_A, roughness: 1, flatShading: true })
  const mesh = new InstancedMesh(geo, mat, spots.length)
  const m = new Matrix4()
  const q = new Quaternion()
  const color = new Color()
  spots.forEach((s, idx) => {
    const y = grids.fineElevAt(s.x, s.y) * ELEVATION_SCALE + FINE_GROUND_LIFT
    const { x: sx, z: sz } = grids.fineScene(s.x, s.y)
    q.setFromAxisAngle(new Vector3(hashG(s.x, s.y, 320), 1, hashG(s.x, s.y, 330)).normalize(), hashG(s.x, s.y, 340) * Math.PI * 2)
    m.compose(new Vector3(sx, y + s.scale * 0.25, sz), q, new Vector3(s.scale, s.scale * 0.72, s.scale))
    mesh.setMatrixAt(idx, m)
    color.copy(BOULDER_COLOR_A).lerp(BOULDER_COLOR_B, hashG(s.x, s.y, 350))
    mesh.setColorAt(idx, color)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  return {
    objects: [mesh],
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
