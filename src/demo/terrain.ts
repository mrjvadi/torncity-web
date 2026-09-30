// Terrain at real metres, two LODs: the coarse 96x96 TILE grid (~305m/cell)
// as the far backdrop, and the fine 128x128 LOT grid (~30.5m/cell) as the
// near mesh the city itself sits on. The coarse mesh has a real HOLE cut
// under the fine grid's own footprint (buildTerrain's coarseSkip) — the two
// are independently sampled (tile vs lot resolution) and the coarse
// terrain is never flattened, so "trust the fine mesh's small lift to
// always win the z-fight" breaks the moment a real hill near the city sits
// above the fine grid's own graded-flat plateau (see the project report:
// this is what the "tan surface cutting through buildings" bug was). A
// vertical skirt around the fine mesh's own edge (buildFineSkirt) hides
// any crack between the two independently-generated boundaries.

import { BufferAttribute, BufferGeometry, Color, DoubleSide, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Texture, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { makeGrassBladeTexture, makeGroundDetailTexture } from './proceduralTextures'
import { kitGeometry } from './kitAssets'
import { GeomAccum } from './meshBuilder'

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
const GRASS_LIGHTEN = 0.4
function biomeColorLegend(grids: CityGrids): Color[] {
  const white = new Color(0xffffff)
  return grids.doc.biomeLegend.map((b) => new Color(`#${b.colorHex}`).lerp(white, GRASS_LIGHTEN))
}

// A large-scale (hundreds-of-metres) lightness wobble layered on top of the
// flat per-biome tint — without it, a whole zone of one biome is a single
// uniform colour over a huge area (a real field/lawn reads as patchy at
// that scale even where the grass itself is one species). Two sine waves
// at different periods/angles avoid an obviously-repeating grid pattern.
function macroTint(x: number, z: number): number {
  const a = Math.sin(x * 0.0021 + z * 0.0009)
  const b = Math.sin(x * -0.0013 + z * 0.0027 + 1.7)
  return (a * 0.6 + b * 0.4) * 0.09 // +/-9% lightness
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
  // When given, a quad whose centre (i+0.5, j+0.5) this returns true for
  // is left OUT of the index buffer entirely — a real hole (no triangles
  // drawn there at all), not just an occluded/lower surface. Used to cut
  // the coarse mesh out from under the fine mesh's own footprint (see
  // buildTerrain): drawing both surfaces and hoping the fine one always
  // wins the z-fight breaks the moment the (independently sampled, never
  // flattened) coarse terrain happens to sit ABOVE the fine grid's own
  // graded-flat city plateau — which real hills near the city do.
  skipQuad?: (i: number, j: number) => boolean,
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
  const indexList: number[] = []
  for (let j = 0; j < quadsY; j++) {
    for (let i = 0; i < quadsX; i++) {
      if (skipQuad?.(i, j)) continue
      const a = j * w + i
      const b = a + 1
      const c = a + w
      const d = c + 1
      indexList.push(a, c, b, b, c, d)
    }
  }
  const useUint32 = w * h > 65535
  const indices = useUint32 ? new Uint32Array(indexList) : new Uint16Array(indexList)

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

// How many LOTS in from the fine grid's own outer edge the blend toward
// the coarse mesh's height/colour runs — a real transition zone instead of
// the hard-edged square the fine grid's own boundary used to draw (two
// independent samplings of "the same underlying terrain", at tile vs lot
// resolution, agree in the general shape but not pixel-for-pixel, so an
// unblended edge always drew a visible seam).
const FINE_EDGE_BLEND_LOTS = 22

function coarseColorAt(grids: CityGrids, legend: Color[], i: number, j: number): Color {
  const idx = grids.coarseIndex(i, j)
  const biome = grids.coarse.biome[idx]
  const base = legend[biome] ?? new Color(0x8fae6d)
  const wet = grids.coarseIsWet(i, j)
  const c = (wet ? base.clone().lerp(new Color(0x3f7fa6), 0.35) : base.clone()) as Color
  if (!wet) {
    const { x, z } = grids.coarseScene(i, j)
    const t = macroTint(x, z)
    if (t >= 0) c.lerp(new Color(0xffffff), t)
    else c.lerp(new Color(0x000000), -t * 0.7)
  }
  return c
}

/** The height of fine-grid vertex (fx, fy) as the mesh is actually drawn:
 * the raw lot elevation, eased toward the coarse backdrop over the last
 * FINE_EDGE_BLEND_LOTS before the grid's edge, and lifted a little at the very
 * edge so the fine surface stays above the coarse one there. Anything that
 * stands on the ground must read this, not the raw grid. */
export function renderedFineElev(grids: CityGrids, fx: number, fy: number): number {
  const fw = grids.fine.w
  const fh = grids.fine.h
  const raw = grids.fineElevAt(fx, fy)
  if (grids.finalFine) return raw
  const edgeDist = Math.min(fx, fy, fw - 1 - fx, fh - 1 - fy)
  let out = raw
  if (edgeDist < FINE_EDGE_BLEND_LOTS) {
    const t = 1 - edgeDist / FINE_EDGE_BLEND_LOTS
    const blend = t * t * (3 - 2 * t)
    const { i, j } = grids.fineToCoarseTile(fx, fy)
    out = raw * (1 - blend) + grids.coarseElevAt(i, j) * blend
  }
  // The coarse hole is matched to the fine grid's extent exactly (see
  // coarseSkip in buildTerrain), so coarse resumes right at this mesh's own
  // edge — a small safety margin (interpolation error within one tile, not a
  // whole tile's worth of mismatch) keeps fine reliably on top exactly at
  // that boundary, verified by verifyNoCoarseUnderFineGrid.
  const EDGE_SAFETY_LOTS = 3
  if (edgeDist < EDGE_SAFETY_LOTS) out += (1 - edgeDist / EDGE_SAFETY_LOTS) * 15
  return out
}

/** The drawn surface at a fractional fine position: the mesh's own two
 * triangles per cell (diagonal from (i+1, j) to (i, j+1)), so a tuft or a
 * boulder placed with it touches the ground exactly. */
export function renderedGroundAt(grids: CityGrids, fx: number, fy: number): number {
  const i = Math.max(0, Math.min(grids.fine.w - 2, Math.floor(fx)))
  const j = Math.max(0, Math.min(grids.fine.h - 2, Math.floor(fy)))
  const u = Math.max(0, Math.min(1, fx - i))
  const v = Math.max(0, Math.min(1, fy - j))
  const a = renderedFineElev(grids, i, j), b = renderedFineElev(grids, i + 1, j)
  const c = renderedFineElev(grids, i, j + 1), d = renderedFineElev(grids, i + 1, j + 1)
  return (u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (b - d) * (1 - v) + (c - d) * (1 - u)) + FINE_GROUND_LIFT
}

export interface TerrainOptions {
  /** Coarse cells (quads) i0..i0+n-1 by j0..j0+n-1 are cut out: the fine mesh
   * covers exactly that square, vertex line to vertex line. */
  hole?: { i0: number; j0: number; n: number }
  /** Only the coarse backdrop is built (no demo fine mesh, no skirt). */
  coarseOnly?: boolean
}

export function buildTerrain(grids: CityGrids, opts: TerrainOptions = {}): TerrainResult {
  const legend = biomeColorLegend(grids)
  const detailTexture = makeGroundDetailTexture(256, 101)

  // The coarse mesh's own hole under the fine grid: matched to the fine
  // grid's true extent exactly — no overlap ring (an earlier version left
  // one on purpose, meaning to share ground at the seam, but the two
  // surfaces are independently sampled — tile vs lot resolution, coarse
  // never flattened — and routinely disagreed by tens of metres right at
  // that border, which is real hillside terrain, not a rounding error; no
  // fixed bias reliably kept fine on top there without either failing
  // verifyNoCoarseUnderFineGrid or visibly lifting the fine mesh), and no
  // extra gap either (a hole bigger than the fine grid leaves a bare ring
  // with nothing drawn in it at all — worse than the seam it was meant to
  // fix). Coarse resumes exactly where fine's own geometry ends; the skirt
  // below hides the small residual mismatch (interpolation error within a
  // single tile, not a whole tile's worth) that's left at that shared
  // boundary.
  const fineHalfSpanTiles = grids.fine.w / grids.doc.lotsPerTile / 2
  const holeHalf = fineHalfSpanTiles
  const { i: fineCentreI, j: fineCentreJ } = grids.fineToCoarseTile(grids.fine.w / 2, grids.fine.h / 2)
  const hole = opts.hole
  const coarseSkip = hole
    ? (i: number, j: number) => i >= hole.i0 && i < hole.i0 + hole.n && j >= hole.j0 && j < hole.j0 + hole.n
    : (i: number, j: number) => Math.abs(i + 0.5 - fineCentreI) < holeHalf && Math.abs(j + 0.5 - fineCentreJ) < holeHalf

  const coarseMesh = buildGridMesh(
    grids,
    grids.coarse.w,
    grids.coarse.h,
    (i, j) => grids.coarseScene(i, j),
    (i, j) => grids.coarseElevAt(i, j),
    (i, j) => coarseColorAt(grids, legend, i, j),
    detailTexture,
    GROUND_DETAIL_METERS * 3,
    0,
    coarseSkip,
  )
  coarseMesh.name = 'terrain-coarse'

  if (opts.coarseOnly) {
    return {
      objects: [coarseMesh],
      detailTexture,
      fineMaterial: coarseMesh.material as MeshStandardMaterial,
      coarseMaterial: coarseMesh.material as MeshStandardMaterial,
      dispose() {
        coarseMesh.geometry.dispose()
        ;(coarseMesh.material as MeshStandardMaterial).dispose()
        detailTexture.dispose()
      },
    }
  }

  const fw = grids.fine.w
  const fh = grids.fine.h

  const fineElevAt = (fx: number, fy: number): number => renderedFineElev(grids, fx, fy)
  const fineColorAt = (fx: number, fy: number): Color => {
    const idx = fy * fw + fx
    const biome = grids.fine.biome[idx]
    const base = legend[biome] ?? new Color(0x8fae6d)
    const slope = grids.fineSlopeAt(fx, fy)
    const wet = grids.fineIsWet(fx, fy)
    const sandy = !wet && grids.fineNearWater(fx, fy, WATER_NEAR_LOTS)
    const fineColor = blendSlopeAndWetness(base, slope, wet, sandy)
    if (!wet && !sandy) {
      const { x, z } = grids.fineScene(fx, fy)
      const t = macroTint(x, z)
      if (t >= 0) fineColor.lerp(new Color(0xffffff), t)
      else fineColor.lerp(new Color(0x000000), -t * 0.7)
    }
    const edgeDist = Math.min(fx, fy, fw - 1 - fx, fh - 1 - fy)
    if (edgeDist >= FINE_EDGE_BLEND_LOTS) return fineColor
    const t = 1 - edgeDist / FINE_EDGE_BLEND_LOTS
    const blend = t * t * (3 - 2 * t)
    const { i, j } = grids.fineToCoarseTile(fx, fy)
    return fineColor.clone().lerp(coarseColorAt(grids, legend, i, j), blend)
  }

  const fineMesh = buildGridMesh(
    grids,
    fw,
    fh,
    (fx, fy) => grids.fineScene(fx, fy),
    fineElevAt,
    fineColorAt,
    detailTexture,
    GROUND_DETAIL_METERS,
    // Lift the fine mesh a touch above the coarse one so it always wins
    // the z-fight in the 1-tile overlap ring the coarse hole leaves — see
    // FINE_GROUND_LIFT's doc.
    FINE_GROUND_LIFT,
  )
  fineMesh.name = 'terrain-fine'

  const skirt = buildFineSkirt(grids, fw, fh, fineElevAt, fineColorAt, detailTexture)
  skirt.name = 'terrain-fine-skirt'

  return {
    objects: [coarseMesh, fineMesh, skirt],
    detailTexture,
    fineMaterial: fineMesh.material as MeshStandardMaterial,
    coarseMaterial: coarseMesh.material as MeshStandardMaterial,
    dispose() {
      coarseMesh.geometry.dispose()
      fineMesh.geometry.dispose()
      skirt.geometry.dispose()
      ;(coarseMesh.material as MeshStandardMaterial).dispose()
      ;(fineMesh.material as MeshStandardMaterial).dispose()
      ;(skirt.material as MeshStandardMaterial).dispose()
      detailTexture.dispose()
    },
  }
}

// A vertical wall around the fine mesh's own outer edge, from its real
// surface straight down by SKIRT_DEPTH_M — the standard "hide the crack"
// trick for a mesh with a deliberate hole cut under it (see the coarse
// mesh's own coarseSkip above): the coarse hole's edge and the fine mesh's
// edge are two independently-generated boundaries that are never
// pixel-exact matches, so without a skirt a grazing view could see a sliver
// of empty space (or the sky) through the seam between them. The skirt
// shares the fine mesh's own edge vertices (same position/colour), so it
// reads as a natural drop-off, not a visible seam of its own.
const SKIRT_DEPTH_M = 50

function buildFineSkirt(
  grids: CityGrids,
  fw: number,
  fh: number,
  elevAt: (fx: number, fy: number) => number,
  colorAt: (fx: number, fy: number) => Color,
  detailTexture: Texture,
): Mesh {
  const acc = new GeomAccum()
  const topAt = (fx: number, fy: number): Vector3 => {
    const { x, z } = grids.fineScene(fx, fy)
    return new Vector3(x, elevAt(fx, fy) * ELEVATION_SCALE + FINE_GROUND_LIFT, z)
  }
  const addEdgeStrip = (points: [number, number][]) => {
    for (let k = 0; k < points.length - 1; k++) {
      const [ax, ay] = points[k]
      const [bx, by] = points[k + 1]
      const topA = topAt(ax, ay)
      const topB = topAt(bx, by)
      const botA = new Vector3(topA.x, topA.y - SKIRT_DEPTH_M, topA.z)
      const botB = new Vector3(topB.x, topB.y - SKIRT_DEPTH_M, topB.z)
      const normal = new Vector3(bx - ax, 0, -(by - ay)).normalize()
      acc.addRect(topA, topB, botB, botA, normal.lengthSq() > 0 ? normal : new Vector3(1, 0, 0), GROUND_DETAIL_METERS, GROUND_DETAIL_METERS)
    }
  }

  const north: [number, number][] = []
  for (let fx = 0; fx < fw; fx++) north.push([fx, 0])
  const south: [number, number][] = []
  for (let fx = fw - 1; fx >= 0; fx--) south.push([fx, fh - 1])
  const east: [number, number][] = []
  for (let fy = 0; fy < fh; fy++) east.push([fw - 1, fy])
  const west: [number, number][] = []
  for (let fy = fh - 1; fy >= 0; fy--) west.push([0, fy])
  addEdgeStrip(north)
  addEdgeStrip(south)
  addEdgeStrip(east)
  addEdgeStrip(west)

  const geo = acc.toGeometry() ?? new BufferGeometry()
  const mat = new MeshStandardMaterial({ vertexColors: false, color: 0x6b6154, map: detailTexture, roughness: 1, side: DoubleSide })
  // The skirt has no per-vertex colour data (GeomAccum doesn't carry one) —
  // a flat soil tone reads fine for a strip that, by design, is only ever
  // glimpsed edge-on at a steep grazing angle.
  void colorAt
  return new Mesh(geo, mat)
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

  /** Drops scatter cells the caller wants kept bare (the village's own lots). */
  removeCandidates(drop: (fx: number, fy: number) => boolean): void {
    this.candidates = this.candidates.filter((c) => !drop(c.fx, c.fy))
    this.lastCamera.set(Infinity, Infinity, Infinity)
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
        const y = renderedGroundAt(this.grids, s.fx + jx / this.grids.doc.lotMeters, s.fy + jz / this.grids.doc.lotMeters) * ELEVATION_SCALE
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
  for (let y = 4; y < h - 4; y += 9) {
    for (let x = 4; x < w - 4; x += 9) {
      const idx = y * w + x
      if (!forestCodes.has(grids.fine.biome[idx])) continue
      if (grids.fineIsWet(x, y)) continue
      if (grids.fineSlopeAt(x, y) > 0.45) continue
      if (inCity(x, y)) continue
      if (hashG(x, y, 201) > 0.22) continue // most candidates skipped: real stands are sparse across the map
      centres.push({ x, y })
    }
  }

  const tall = await kitGeometry('grass-trees-tall')
  const short = await kitGeometry('grass-trees')
  const objects: Object3D[] = []
  if (!tall && !short) return { objects, dispose() {} }

  const TREE_CAP = 900 // keep instance/triangle counts cheap on a phone GPU
  type Spot = { x: number; y: number; scale: number; rot: number; tall: boolean }
  const spots: Spot[] = []
  for (const c of centres) {
    if (spots.length >= TREE_CAP) break
    const count = 4 + Math.floor(hashG(c.x, c.y, 211) * 5) // 4..8 trees per stand
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
    const y = renderedGroundAt(grids, s.x, s.y) * ELEVATION_SCALE
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
