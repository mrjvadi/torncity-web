// A single lightweight ShaderMaterial for every river/stream/lake/ocean
// tile: depth tint (lighter at the shore), animated procedural ripple
// normals, fresnel-driven sky reflection, and a thin foam line at the
// shoreline. Rivers/streams carry a per-vertex flow direction (the
// regional downhill gradient, sampled from the coarse terrain) so their
// ripples visibly drift downstream instead of every water tile rippling
// in the same fixed direction.
//
// ANIMATION BUDGET. This mesh's own material ticks uTime, but nothing in
// this file runs a timer — the scene owns one shared throttle (~30fps, only
// while water is on screen, the tab is visible and the camera recently
// moved; honouring prefers-reduced-motion) and calls tick() itself. See
// worldCityScene.ts's own water-ticking code.

import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshStandardMaterial, ShaderMaterial, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { WATER_KIND_LAKE, WATER_KIND_OCEAN, WATER_KIND_RIVER, WATER_KIND_STREAM } from './cityExportTypes'
import { ELEVATION_SCALE, FINE_GROUND_LIFT } from './terrain'

const VERT = /* glsl */ `
  attribute float shoreDist;
  attribute vec2 flowDir;
  attribute float edgeAlpha;
  varying float vShoreDist;
  varying vec2 vFlow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vAlpha;
  void main() {
    vShoreDist = shoreDist;
    vFlow = flowDir;
    vAlpha = edgeAlpha;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSky;
  uniform vec3 uCameraPos;
  uniform float uFoamWidth;
  varying float vShoreDist;
  varying vec2 vFlow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vAlpha;

  // Cheap analytic ripple: a few sine layers offset along the flow
  // direction (zero vector for still lake/ocean tiles), perturbing the
  // normal without a texture lookup.
  vec3 rippleNormal(vec2 p, vec2 flow, float t) {
    vec2 dir = length(flow) > 0.001 ? normalize(flow) : vec2(0.7, 0.7);
    float w1 = sin(dot(p, dir) * 0.9 + t * 1.6) * 0.5;
    float w2 = sin(dot(p, vec2(-dir.y, dir.x)) * 1.7 - t * 1.1) * 0.3;
    float w3 = sin(dot(p, dir * 1.6 + vec2(0.3, -0.2)) * 2.3 + t * 2.4) * 0.15;
    float h = w1 + w2 + w3;
    float dhx = cos(dot(p, dir) * 0.9 + t * 1.6) * 0.9 * dir.x * 0.5
      + cos(dot(p, vec2(-dir.y, dir.x)) * 1.7 - t * 1.1) * 1.7 * (-dir.y) * 0.3;
    float dhz = cos(dot(p, dir) * 0.9 + t * 1.6) * 0.9 * dir.y * 0.5
      + cos(dot(p, vec2(-dir.y, dir.x)) * 1.7 - t * 1.1) * 1.7 * dir.x * 0.3;
    return normalize(vec3(-dhx, 1.0, -dhz));
  }

  void main() {
    vec3 n = rippleNormal(vWorldPos.xz * 0.35, vFlow, uTime);
    n = normalize(mix(vNormal, n, 0.85));

    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);

    float depthT = clamp(vShoreDist / 6.0, 0.0, 1.0);
    vec3 base = mix(uShallow, uDeep, depthT);
    vec3 withSky = mix(base, uSky, fresnel * 0.65);

    float foamT = 1.0 - smoothstep(0.0, uFoamWidth, vShoreDist);
    float foamNoise = sin(vWorldPos.x * 1.3 + vWorldPos.z * 1.1 + uTime * 2.0) * 0.5 + 0.5;
    foamT *= (0.6 + 0.4 * foamNoise);
    vec3 color = mix(withSky, uFoam, foamT);

    gl_FragColor = vec4(color, vAlpha);
  }
`

export interface WaterResult {
  mesh: Mesh | null
  material: ShaderMaterial | null
  tick(time: number): void
  setCamera(pos: Vector3): void
  dispose(): void
}

function regionalFlowDir(grids: CityGrids, fx: number, fy: number): [number, number] {
  // Coarse-tile-space position of this fine cell (see cityExportTypes.ts's
  // fineWorldMeters): used to sample the coarse grid's own large-scale
  // gradient as a plausible downhill/flow direction.
  const tileX = grids.doc.fineGrid.originTileX + fx / grids.doc.lotsPerTile
  const tileY = grids.doc.fineGrid.originTileY + fy / grids.doc.lotsPerTile
  const i = Math.round(tileX)
  const j = Math.round(tileY)
  const hL = grids.coarseElevAt(i - 1, j)
  const hR = grids.coarseElevAt(i + 1, j)
  const hD = grids.coarseElevAt(i, j - 1)
  const hU = grids.coarseElevAt(i, j + 1)
  // Downhill = negative gradient.
  const dx = -(hR - hL)
  const dz = -(hU - hD)
  const len = Math.hypot(dx, dz)
  if (len < 1e-4) return [0, 0]
  return [dx / len, dz / len]
}

// Supersampling factor for the water mesh: the fine grid's waterKind mask
// is per-30.5m-lot, blocky by construction. Building the mesh on a grid
// SS times finer, with the wet MASK and elevation both bilinearly
// interpolated from the original lot-resolution data (not re-sampled from
// the generator), approximates marching-squares' smoothed shoreline almost
// for free: a cell that was 50/50 wet/dry at lot resolution now spans
// several sub-cells with continuously varying wetness, which the alpha
// fade below turns into a soft edge instead of the original hard
// staircase.
const SS = 3
const WET_THRESHOLD = 0.42
const WET_ALPHA_IN = 0.62 // fully opaque past this interpolated wetness
const WET_ALPHA_OUT = WET_THRESHOLD // fully transparent at the mesh's own cutoff

// A separable box blur (radius in LOTS) over the binary wet mask, run
// before the bilinear supersample + threshold below — without it, the
// supersampled shoreline is still a diagonal-faceted staircase (bilinear
// interpolation only smooths WITHIN one lot's own 4 neighbours; the mask's
// own hard lot-grid edges are still the only source of curvature). Blurring
// the mask first widens the wet/dry transition over several lots, so the
// same threshold cut now follows a genuinely rounded contour instead of
// tracing the lot grid's own diagonals.
const WATER_BLUR_RADIUS_LOTS = 2

function boxBlur(field: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  // horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx
        if (xx < 0 || xx >= w) continue
        sum += field[y * w + xx]
        n++
      }
      tmp[y * w + x] = sum / n
    }
  }
  // vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        sum += tmp[yy * w + x]
        n++
      }
      out[y * w + x] = sum / n
    }
  }
  return out
}

function bilinear(field: Float32Array | Int16Array, w: number, h: number, fx: number, fy: number): number {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)))
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const a = field[y0 * w + x0]
  const b = field[y0 * w + x1]
  const c = field[y1 * w + x0]
  const d = field[y1 * w + x1]
  const top = a + (b - a) * tx
  const bot = c + (d - c) * tx
  return top + (bot - top) * ty
}

export function buildWater(grids: CityGrids): WaterResult {
  const { w, h } = grids.fine
  const wet = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) wet[i] = grids.fine.water[i] !== 0 ? 1 : 0
  let anyWet = false
  for (const v of wet) if (v) { anyWet = true; break }
  if (!anyWet) {
    return { mesh: null, material: null, tick() {}, setCamera() {}, dispose() {} }
  }
  const wetBlurred = boxBlur(wet, w, h, WATER_BLUR_RADIUS_LOTS)

  const sw = (w - 1) * SS + 1
  const sh = (h - 1) * SS + 1
  const wetness = new Float32Array(sw * sh)
  const wetMask = new Uint8Array(sw * sh)
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const fx = sx / SS
      const fy = sy / SS
      const wv = bilinear(wetBlurred, w, h, fx, fy)
      const si = sy * sw + sx
      wetness[si] = wv
      wetMask[si] = wv >= WET_THRESHOLD ? 1 : 0
    }
  }

  // Multi-source BFS shore distance over the SUPERSAMPLED mask, in real
  // metres (one super-cell is lotMeters/SS apart) — cheap, and gives the
  // shader a smoother "distance to dry land" gradient than the original
  // lot-resolution mask could.
  const CAP = 8 * SS
  const stepMeters = grids.doc.lotMeters / SS
  const shoreSteps = new Float32Array(sw * sh).fill(CAP)
  const queue: number[] = []
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const idx = sy * sw + sx
      if (!wetMask[idx]) continue
      const dry =
        (sx > 0 && !wetMask[idx - 1]) ||
        (sx < sw - 1 && !wetMask[idx + 1]) ||
        (sy > 0 && !wetMask[idx - sw]) ||
        (sy < sh - 1 && !wetMask[idx + sw])
      if (dry) {
        shoreSteps[idx] = 0
        queue.push(idx)
      }
    }
  }
  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    const x = idx % sw
    const y = (idx - x) / sw
    const d = shoreSteps[idx]
    if (d >= CAP) continue
    const neigh = [idx - 1, idx + 1, idx - sw, idx + sw]
    const valid = [x > 0, x < sw - 1, y > 0, y < sh - 1]
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue
      const ni = neigh[k]
      if (!wetMask[ni]) continue
      if (d + 1 < shoreSteps[ni]) {
        shoreSteps[ni] = d + 1
        queue.push(ni)
      }
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const shoreAttr: number[] = []
  const flowAttr: number[] = []
  const alphaAttr: number[] = []
  const indices: number[] = []
  const vertIndex = new Int32Array(sw * sh).fill(-1)
  let vcount = 0

  const yAt = (fx: number, fy: number): number => {
    const e = bilinear(grids.fine.elevation, w, h, fx, fy) * ELEVATION_SCALE
    const kindNear = grids.fine.water[grids.fineIndex(Math.round(fx), Math.round(fy))]
    const y = kindNear === WATER_KIND_OCEAN ? Math.min(0, e) : e
    return y + FINE_GROUND_LIFT + 0.06
  }

  // Include a 1-super-cell dilation ring past the wet cutoff so the alpha
  // fade below has somewhere to fade TO (a hard mesh edge exactly at the
  // wet cutoff would just move the staircase from "colour" to "alpha").
  const include = new Uint8Array(sw * sh)
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const idx = sy * sw + sx
      if (wetMask[idx]) {
        include[idx] = 1
        continue
      }
      if (
        (sx > 0 && wetMask[idx - 1]) ||
        (sx < sw - 1 && wetMask[idx + 1]) ||
        (sy > 0 && wetMask[idx - sw]) ||
        (sy < sh - 1 && wetMask[idx + sw])
      ) {
        include[idx] = 1
      }
    }
  }

  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const idx = sy * sw + sx
      if (!include[idx]) continue
      const fx = sx / SS
      const fy = sy / SS
      const { x: scx, z: scz } = grids.fineScene(fx, fy)
      positions.push(scx, yAt(fx, fy), scz)
      normals.push(0, 1, 0)
      shoreAttr.push(shoreSteps[idx] * stepMeters)
      const alpha = Math.max(0, Math.min(1, (wetness[idx] - WET_ALPHA_OUT) / Math.max(1e-4, WET_ALPHA_IN - WET_ALPHA_OUT)))
      alphaAttr.push(alpha)
      const kindNear = grids.fine.water[grids.fineIndex(Math.round(fx), Math.round(fy))]
      if (kindNear === WATER_KIND_RIVER || kindNear === WATER_KIND_STREAM) {
        const [fdx, fdz] = regionalFlowDir(grids, Math.round(fx), Math.round(fy))
        flowAttr.push(fdx, fdz)
      } else {
        flowAttr.push(0, 0)
      }
      vertIndex[idx] = vcount++
    }
  }

  for (let sy = 0; sy < sh - 1; sy++) {
    for (let sx = 0; sx < sw - 1; sx++) {
      const a = vertIndex[sy * sw + sx]
      const b = vertIndex[sy * sw + sx + 1]
      const c = vertIndex[(sy + 1) * sw + sx]
      const d = vertIndex[(sy + 1) * sw + sx + 1]
      if (a < 0 || b < 0 || c < 0 || d < 0) continue
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geo.setAttribute('shoreDist', new BufferAttribute(new Float32Array(shoreAttr), 1))
  geo.setAttribute('flowDir', new BufferAttribute(new Float32Array(flowAttr), 2))
  geo.setAttribute('edgeAlpha', new BufferAttribute(new Float32Array(alphaAttr), 1))
  const useUint32 = vcount > 65535
  geo.setIndex(new BufferAttribute(useUint32 ? new Uint32Array(indices) : new Uint16Array(indices), 1))

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(0x1c5f77) },
      uShallow: { value: new Color(0x6fc3d6) },
      uFoam: { value: new Color(0xeaf6f2) },
      uSky: { value: new Color(0x8fc3ec) },
      uCameraPos: { value: new Vector3(0, 0, 0) },
      uFoamWidth: { value: 2.4 },
    },
  })

  const mesh = new Mesh(geo, material)
  mesh.name = 'water'

  return {
    mesh,
    material,
    tick(time: number) {
      material.uniforms.uTime.value = time
    },
    setCamera(pos) {
      ;(material.uniforms.uCameraPos.value as Vector3).copy(pos)
    },
    dispose() {
      geo.dispose()
      material.dispose()
    },
  }
}

// The fine river mesh above only covers the fine grid's own ~3.9km
// footprint; a river/lake/ocean that continues past that edge into the
// coarse backdrop (this seed's does) used to just stop dead at the fine
// grid's boundary. This is a second, much simpler flat-quad water patch —
// no ripple shader, no shore fade, it is background scenery several
// kilometres out — for every coarse cell the coarse grid's own flags mark
// wet, skipping any cell already inside the fine grid's footprint (the
// detailed mesh above owns that area) so the two never overlap/z-fight.
export interface CoarseWaterResult {
  mesh: Mesh | null
  dispose(): void
}

const COARSE_OCEAN_BIT = 1
const COARSE_LAKE_BIT = 4
// Above this, a cell flagged ocean is almost certainly a misflagged
// hilltop/coastal-noise cell, not open water — real sea level is ~0.
const OCEAN_ELEV_TOLERANCE_M = 40
// A lake is a flat body of standing water; if a connected group of
// lake-flagged cells actually spans more than this much elevation, that
// is sloped terrain wrongly carrying the flag (or two separate water
// bodies at different levels touching), not a real lake — the whole group
// is dropped rather than drawn as a tilted "floating" patch.
const LAKE_FLATNESS_TOLERANCE_M = 15

export function buildCoarseWaterPatch(grids: CityGrids): CoarseWaterResult {
  const { w, h } = grids.coarse
  const fineHalfSpanTiles = grids.fine.w / grids.doc.lotsPerTile / 2
  const { i: centreI, j: centreJ } = grids.fineToCoarseTile(grids.fine.w / 2, grids.fine.h / 2)
  const insideFine = (i: number, j: number) => Math.abs(i - centreI) < fineHalfSpanTiles - 2 && Math.abs(j - centreJ) < fineHalfSpanTiles - 2

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vcount = 0

  const addQuad = (i: number, j: number, y: number) => {
    const { x, z } = grids.coarseScene(i, j)
    const half = grids.doc.tileMeters / 2
    const base = vcount
    positions.push(x - half, y, z - half, x + half, y, z - half, x + half, y, z + half, x - half, y, z + half)
    for (let k = 0; k < 4; k++) normals.push(0, 1, 0)
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1)
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
    vcount += 4
  }

  // Ocean: one flat plane at sea level (0) — never the per-cell terrain
  // elevation, which is what made ocean cells on a sloped coast read as
  // floating rectangles. Cells whose OWN elevation is well above sea level
  // are dropped as misflagged rather than drawn tilted-looking-flat.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      if (!(grids.coarse.water[idx] & COARSE_OCEAN_BIT)) continue
      if (insideFine(i, j)) continue
      if (grids.coarseElevAt(i, j) > OCEAN_ELEV_TOLERANCE_M) continue
      addQuad(i, j, 0.08)
    }
  }

  // Lakes: flood-fill each connected group of lake-flagged cells, draw the
  // whole group at its OWN average elevation (one real flat surface) only
  // if it is genuinely flat; a group that spans more than the tolerance is
  // dropped entirely rather than drawn as a tilted patch.
  const visited = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      if (visited[idx] || !(grids.coarse.water[idx] & COARSE_LAKE_BIT)) continue
      const cells: [number, number][] = []
      const queue: [number, number][] = [[i, j]]
      visited[idx] = 1
      let sum = 0
      let min = Infinity
      let max = -Infinity
      while (queue.length) {
        const [ci, cj] = queue.pop() as [number, number]
        const e = grids.coarseElevAt(ci, cj)
        sum += e
        if (e < min) min = e
        if (e > max) max = e
        cells.push([ci, cj])
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ni = ci + dx
          const nj = cj + dy
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue
          const nidx = nj * w + ni
          if (visited[nidx] || !(grids.coarse.water[nidx] & COARSE_LAKE_BIT)) continue
          visited[nidx] = 1
          queue.push([ni, nj])
        }
      }
      if (max - min > LAKE_FLATNESS_TOLERANCE_M) continue
      const avgY = (sum / cells.length) * ELEVATION_SCALE + 0.08
      for (const [ci, cj] of cells) {
        if (insideFine(ci, cj)) continue
        addQuad(ci, cj, avgY)
      }
    }
  }

  if (vcount === 0) return { mesh: null, dispose() {} }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  const useUint32 = vcount > 65535
  geo.setIndex(new BufferAttribute(useUint32 ? new Uint32Array(indices) : new Uint16Array(indices), 1))

  const material = new MeshStandardMaterial({ color: 0x1c5f77, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.92 })
  const mesh = new Mesh(geo, material)
  mesh.name = 'water-coarse'

  return {
    mesh,
    dispose() {
      geo.dispose()
      material.dispose()
    },
  }
}
