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

import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three'
import type { CityGrids } from './grids'
import { WATER_KIND_LAKE, WATER_KIND_OCEAN, WATER_KIND_RIVER, WATER_KIND_STREAM } from './cityExportTypes'
import { ELEVATION_SCALE, FINE_GROUND_LIFT } from './terrain'

const VERT = /* glsl */ `
  attribute float shoreDist;
  attribute vec2 flowDir;
  varying float vShoreDist;
  varying vec2 vFlow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vShoreDist = shoreDist;
    vFlow = flowDir;
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

    gl_FragColor = vec4(color, 1.0);
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

export function buildWater(grids: CityGrids): WaterResult {
  const { w, h } = grids.fine
  const wet = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) wet[i] = grids.fine.water[i] !== 0 ? 1 : 0
  let anyWet = false
  for (const v of wet) if (v) { anyWet = true; break }
  if (!anyWet) {
    return { mesh: null, material: null, tick() {}, setCamera() {}, dispose() {} }
  }

  // Multi-source BFS shore distance, in LOTS, capped — cheap and gives the
  // shader a real "distance to dry land" without per-frame cost.
  const CAP = 8
  const shoreLots = new Float32Array(w * h).fill(CAP)
  const queue: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (!wet[idx]) continue
      const neighborsDry =
        (x > 0 && !wet[idx - 1]) ||
        (x < w - 1 && !wet[idx + 1]) ||
        (y > 0 && !wet[idx - w]) ||
        (y < h - 1 && !wet[idx + w])
      if (neighborsDry) {
        shoreLots[idx] = 0
        queue.push(idx)
      }
    }
  }
  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    const x = idx % w
    const y = (idx - x) / w
    const d = shoreLots[idx]
    if (d >= CAP) continue
    const neigh = [idx - 1, idx + 1, idx - w, idx + w]
    const valid = [x > 0, x < w - 1, y > 0, y < h - 1]
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue
      const ni = neigh[k]
      if (!wet[ni]) continue
      if (d + 1 < shoreLots[ni]) {
        shoreLots[ni] = d + 1
        queue.push(ni)
      }
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const shoreAttr: number[] = []
  const flowAttr: number[] = []
  const indices: number[] = []
  const vertIndex = new Int32Array(w * h).fill(-1)
  let vcount = 0

  const yAt = (fx: number, fy: number): number => {
    const e = grids.fineElevAt(fx, fy) * ELEVATION_SCALE
    const kind = grids.fine.water[grids.fineIndex(fx, fy)]
    const y = kind === WATER_KIND_OCEAN ? Math.min(0, e) : e
    return y + FINE_GROUND_LIFT + 0.06
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (!wet[idx]) continue
      const { x: sx, z: sz } = grids.fineScene(x, y)
      positions.push(sx, yAt(x, y), sz)
      normals.push(0, 1, 0)
      shoreAttr.push(shoreLots[idx] * grids.doc.lotMeters)
      const kind = grids.fine.water[idx]
      if (kind === WATER_KIND_RIVER || kind === WATER_KIND_STREAM) {
        const [fdx, fdz] = regionalFlowDir(grids, x, y)
        flowAttr.push(fdx, fdz)
      } else {
        flowAttr.push(0, 0)
      }
      vertIndex[idx] = vcount++
    }
  }

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = vertIndex[y * w + x]
      const b = vertIndex[y * w + x + 1]
      const c = vertIndex[(y + 1) * w + x]
      const d = vertIndex[(y + 1) * w + x + 1]
      if (a < 0 || b < 0 || c < 0 || d < 0) continue
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geo.setAttribute('shoreDist', new BufferAttribute(new Float32Array(shoreAttr), 1))
  geo.setAttribute('flowDir', new BufferAttribute(new Float32Array(flowAttr), 2))
  const useUint32 = vcount > 65535
  geo.setIndex(new BufferAttribute(useUint32 ? new Uint32Array(indices) : new Uint16Array(indices), 1))

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: DoubleSide,
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(0x1c5f77) },
      uShallow: { value: new Color(0x6fc3d6) },
      uFoam: { value: new Color(0xeaf6f2) },
      uSky: { value: new Color(0xdde8da) },
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
