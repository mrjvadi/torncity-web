// The lab's ground (prototypes/city/groundmat.js + ctlmap.js) in TypeScript: a
// standard material whose fragment shader paints the terrain from photo
// textures chosen by a small control map and by slope:
//   R  packed earth along roads and round buildings
//   G  wet river stones and mud along water
//   B  mown lawn (the village itself)
//   A  forest floor
// plus large-scale macro variation (lush / sun-dried / dark patches), rotated
// farm parcels well away from the village, and a fine grass normal near the
// camera. Textures are divided by their own mean so they only add detail and
// the biome colour carried by the vertices decides the tone.

import {
  Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RGBAFormat, RepeatWrapping, ClampToEdgeWrapping,
  SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer, type Texture, type Wrapping,
} from 'three'

// -- periodic value noise (tileable macro variation, water ripples) --------------------------------

function rawNoise(a: number, b: number, per: number, seed: number): number {
  const q = ((((a % per) + per) % per) * 73856093) ^ ((((b % per) + per) % per) * 19349663) ^ (seed * 83492791)
  let t = Math.imul(q | 0, 0x2545f491)
  t ^= t >>> 15
  t = Math.imul(t, 0x9e3779b1)
  t ^= t >>> 13
  return ((t >>> 0) / 4294967295) * 2 - 1
}
function pnoise(x: number, y: number, per: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = rawNoise(ix, iy, per, seed), b = rawNoise(ix + 1, iy, per, seed), c = rawNoise(ix, iy + 1, per, seed), d = rawNoise(ix + 1, iy + 1, per, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function pfbm(x: number, y: number, per: number, oct: number, seed: number): number {
  let s = 0, a = 1, n = 0, f = 1
  for (let i = 0; i < oct; i++) {
    s += pnoise(x * f, y * f, per * f, seed + i) * a
    n += a
    a *= 0.5
    f *= 2
  }
  return s / n
}

function tex(d: Uint8Array, size: number, wrap: Wrapping = RepeatWrapping): DataTexture {
  const t = new DataTexture(d, size, size, RGBAFormat)
  t.wrapS = t.wrapT = wrap
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/** Three tileable noise octaves in R, G, B: the ground's large-scale variation. */
export function makeMacroNoise(size = 128): DataTexture {
  const d = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, o = (y * size + x) * 4
      d[o] = (pfbm(u * 4, v * 4, 4, 4, 1) * 0.5 + 0.5) * 255
      d[o + 1] = (pfbm(u * 8, v * 8, 8, 4, 7) * 0.5 + 0.5) * 255
      d[o + 2] = (pfbm(u * 16, v * 16, 16, 3, 13) * 0.5 + 0.5) * 255
      d[o + 3] = 255
    }
  }
  return tex(d, size)
}

/** A tangent-space normal map of soft wavelets (periodic), for water. */
export function makeWaterNormals(size = 128): DataTexture {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const r = 1 - Math.abs(pfbm(u * 6, v * 6, 6, 4, 21))
      h[y * size + x] = pfbm(u * 5, v * 5, 5, 4, 5) * 0.6 + r * 0.5
    }
  }
  const d = new Uint8Array(size * size * 4), k = 2.4
  const g = (a: number, b: number) => h[((b + size) % size) * size + ((a + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (g(x - 1, y) - g(x + 1, y)) * k, ny = (g(x, y - 1) - g(x, y + 1)) * k
      const l = Math.hypot(nx, ny, 1), o = (y * size + x) * 4
      d[o] = (nx / l * 0.5 + 0.5) * 255
      d[o + 1] = (ny / l * 0.5 + 0.5) * 255
      d[o + 2] = (1 / l * 0.5 + 0.5) * 255
      d[o + 3] = 255
    }
  }
  return tex(d, size)
}

const px = (r: number, g: number, b: number): DataTexture => {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, RGBAFormat)
  t.needsUpdate = true
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

// -- the control map ------------------------------------------------------------------------------------

export interface ControlInput {
  /** Scene rectangle the map covers. */
  x0: number
  z0: number
  size: number
  /** 0..1 at a scene position. */
  wet(x: number, z: number): number
  forest(x: number, z: number): number
  lawn(x: number, z: number): number
  /** Line segments (scene x/z) that get a dirt verge, with the half width of the road. */
  verges: { ax: number; az: number; bx: number; bz: number; half: number }[]
  /** Rectangles (scene x/z) whose surroundings get packed earth. */
  pads: { x0: number; z0: number; x1: number; z1: number }[]
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function bakeControl(inp: ControlInput, res = 256): { tex: DataTexture; org: [number, number]; size: number } {
  const d = new Uint8Array(res * res * 4)
  const cell = inp.size / res
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = inp.x0 + (i + 0.5) * cell, z = inp.z0 + (j + 0.5) * cell
      const o = (j * res + i) * 4
      const w = inp.wet(x, z)
      d[o + 1] = w * 255
      d[o + 2] = inp.lawn(x, z) * 255 * (1 - w)
      d[o + 3] = inp.forest(x, z) * 255 * (1 - w)
    }
  }
  const stamp = (x: number, z: number, reach: number, v: (dd: number) => number) => {
    const rc = Math.ceil(reach / cell)
    const ci = (x - inp.x0) / cell, cj = (z - inp.z0) / cell
    for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(res - 1, Math.ceil(cj + rc)); j++) {
      for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(res - 1, Math.ceil(ci + rc)); i++) {
        const dd = Math.hypot(inp.x0 + (i + 0.5) * cell - x, inp.z0 + (j + 0.5) * cell - z)
        const nv = v(dd) * 255
        const o = (j * res + i) * 4
        if (nv > d[o]) d[o] = nv
      }
    }
  }
  for (const s of inp.verges) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
    const n = Math.max(1, Math.ceil(len / (cell * 0.8)))
    const reach = s.half + 7
    for (let k = 0; k <= n; k++) stamp(s.ax + ((s.bx - s.ax) * k) / n, s.az + ((s.bz - s.az) * k) / n, reach, (dd) => 1 - smooth(s.half + 0.5, reach, dd))
  }
  for (const p of inp.pads) {
    const margin = 8
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hx = (p.x1 - p.x0) / 2, hz = (p.z1 - p.z0) / 2
    const rc = Math.ceil((Math.max(hx, hz) + margin) / cell) + 1
    const ci = (cx - inp.x0) / cell, cj = (cz - inp.z0) / cell
    for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(res - 1, Math.ceil(cj + rc)); j++) {
      for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(res - 1, Math.ceil(ci + rc)); i++) {
        const x = inp.x0 + (i + 0.5) * cell, z = inp.z0 + (j + 0.5) * cell
        const dx = Math.max(0, Math.abs(x - cx) - hx), dz = Math.max(0, Math.abs(z - cz) - hz)
        const nv = (1 - smooth(1, margin, Math.hypot(dx, dz))) * 200
        const o = (j * res + i) * 4
        if (nv > d[o]) d[o] = nv
      }
    }
  }
  const t = tex(d, res, ClampToEdgeWrapping)
  return { tex: t, org: [inp.x0, inp.z0], size: inp.size }
}

// -- photo textures, loaded after the first frame ----------------------------------------------------------

export interface PhotoSet { [key: string]: { tex: Texture; avg: Color } }

export async function loadPhotoSet(renderer: WebGLRenderer, base: string, files: [key: string, file: string, srgb?: boolean][]): Promise<PhotoSet> {
  const loader = new TextureLoader()
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const out: PhotoSet = {}
  await Promise.all(files.map(async ([key, file, srgb = true]) => {
    try {
      const t = await loader.loadAsync(base + file)
      t.wrapS = t.wrapT = RepeatWrapping
      t.anisotropy = aniso
      if (srgb) t.colorSpace = SRGBColorSpace
      const c = document.createElement('canvas')
      c.width = c.height = 1
      const g = c.getContext('2d')
      let avg = new Color(0.4, 0.4, 0.4)
      if (g && srgb) {
        g.drawImage(t.image as CanvasImageSource, 0, 0, 1, 1)
        const p = g.getImageData(0, 0, 1, 1).data
        avg = new Color().setRGB(p[0] / 255, p[1] / 255, p[2] / 255, SRGBColorSpace)
      }
      out[key] = { tex: t, avg }
    } catch {
      // offline / blocked: the flat placeholder stays
    }
  }))
  return out
}

// -- the material ---------------------------------------------------------------------------------------------

export interface GroundMaterial {
  mat: MeshStandardMaterial
  U: Record<string, { value: unknown }>
  apply(set: PhotoSet): void
}

export function createGroundMaterial(o: { ctl: DataTexture; org: [number, number]; size: number; macro: DataTexture; vertexColors?: boolean }): GroundMaterial {
  // until the photos arrive each slot is a flat swatch of its own mean colour (linear), so the
  // first frame is already the right tone
  const sw = (c: Color) => px(Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255))
  const flat = px(128, 128, 255)
  const U: Record<string, { value: unknown }> = {
    uGrass: { value: sw(new Color(0.3, 0.45, 0.2)) }, uLeafy: { value: sw(new Color(0.25, 0.35, 0.15)) }, uDirt: { value: sw(new Color(0.4, 0.3, 0.2)) },
    uRock: { value: sw(new Color(0.4, 0.4, 0.4)) }, uGravel: { value: sw(new Color(0.4, 0.4, 0.4)) }, uGrassN: { value: flat },
    uGrassAvg: { value: new Color(0.3, 0.45, 0.2) }, uLeafyAvg: { value: new Color(0.25, 0.35, 0.15) }, uDirtAvg: { value: new Color(0.4, 0.3, 0.2) },
    uRockAvg: { value: new Color(0.4, 0.4, 0.4) }, uGravelAvg: { value: new Color(0.4, 0.4, 0.4) },
    uCtl: { value: o.ctl }, uCtlOrg: { value: new Vector2(o.org[0], o.org[1]) }, uCtlSize: { value: o.size }, uMacro: { value: o.macro },
  }
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, vertexColors: o.vertexColors ?? false })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
uniform sampler2D uGrass, uLeafy, uDirt, uRock, uGravel, uGrassN, uCtl, uMacro;
uniform vec3 uGrassAvg, uLeafyAvg, uDirtAvg, uRockAvg, uGravelAvg;
uniform vec2 uCtlOrg; uniform float uCtlSize;
vec3 detail(sampler2D t, vec3 avg, vec2 p, float s1, float s2) {
  vec3 a = texture2D(t, p * s1).rgb;
  vec3 b = texture2D(t, mat2(0.8, 0.6, -0.6, 0.8) * p * s2 + 0.31).rgb;
  return a * pow(max(b / max(avg, vec3(0.02)), vec3(0.2)), vec3(0.45));
}
vec4 gCtl = vec4(0.0);
`)
      .replace('#include <map_fragment>', `
{
  vec2 p = vWP.xz;
  vec3 mac = vec3(texture2D(uMacro, p * 0.00062).r, texture2D(uMacro, p * 0.0021 + 0.37).g, texture2D(uMacro, p * 0.0107 + 0.11).b);
  vec2 cuv = (p - uCtlOrg) / uCtlSize;
  vec4 ct = texture2D(uCtl, clamp(cuv, 0.0005, 0.9995));
  float inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
  ct *= inside; ct.a = mix(0.62, ct.a, inside);
  float up = clamp(normalize(vWN).y, 0.0, 1.0);
  float steep = smoothstep(0.90, 0.72, up);
  gCtl = ct;
  vec3 grass = detail(uGrass, uGrassAvg, p, 0.42, 0.061);
  vec3 lawn = grass * vec3(1.04, 1.05, 0.9);
  vec3 leafy = detail(uLeafy, uLeafyAvg, p, 0.36, 0.057);
  vec3 wild = mix(grass, leafy * 1.15, smoothstep(0.35, 0.75, mac.g));
  vec3 base = mix(wild, lawn, ct.b);
  vec3 dry = vec3(1.22, 1.05, 0.62), lush = vec3(0.72, 0.98, 0.72);
  float tint = smoothstep(0.30, 0.70, mac.r * 0.65 + mac.b * 0.35);
  base *= mix(lush, dry, tint * 0.75);
  base *= 0.82 + 0.36 * mac.b;
  base = mix(base, leafy * vec3(0.62, 0.70, 0.52), smoothstep(0.15, 0.75, ct.a) * 0.9);
  {
    float rr = length(p);
    vec2 fp = mat2(0.94, -0.34, 0.34, 0.94) * p;
    vec2 cs = vec2(95.0, 150.0);
    vec2 cell = floor(fp / cs), lc = fract(fp / cs);
    float h1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453), h2 = fract(sin(dot(cell, vec2(39.3468, 11.135))) * 24634.6345);
    float edge = smoothstep(0.0, 0.025, lc.x) * smoothstep(0.0, 0.017, lc.y) * smoothstep(1.0, 0.975, lc.x) * smoothstep(1.0, 0.983, lc.y);
    float on = step(0.45, h1) * smoothstep(260.0, 420.0, rr) * (1.0 - smoothstep(1000.0, 1500.0, rr)) * (1.0 - smoothstep(0.05, 0.35, ct.a)) * (1.0 - ct.r) * (1.0 - ct.g) * inside;
    float ang = h2 * 3.14;
    float rows = 0.86 + 0.14 * sin(dot(p, vec2(cos(ang), sin(ang))) * 2.4);
    vec3 fc = h2 < 0.3 ? vec3(0.66, 0.53, 0.24) : (h2 < 0.62 ? vec3(0.36, 0.5, 0.15) : (h2 < 0.82 ? vec3(0.34, 0.24, 0.15) : vec3(0.5, 0.56, 0.2)));
    float lum = dot(base, vec3(0.3, 0.55, 0.15));
    base = mix(base, fc * rows * (0.45 + 0.85 * lum), on * edge * 0.92);
  }
  if (ct.r > 0.01) { vec3 dirt = detail(uDirt, uDirtAvg, p, 0.35, 0.05); base = mix(base, dirt, ct.r * (0.75 + 0.25 * mac.b)); }
  if (ct.g > 0.3) { vec3 stones = detail(uRock, uRockAvg, p, 0.55, 0.09) * 0.95; base = mix(base, stones, smoothstep(0.35, 0.8, ct.g)); }
  if (steep > 0.01) { vec3 gr = detail(uGravel, uGravelAvg, p, 0.22, 0.037) * 0.9; base = mix(base, gr, steep * 0.9); }
  diffuseColor.rgb *= base;
}
`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 p = vWP.xz;
  float dcam = length(cameraPosition - vWP);
  if (dcam < 220.0) {
    vec3 n1 = texture2D(uGrassN, p * 0.42).xyz * 2.0 - 1.0;
    vec3 n2 = texture2D(uGrassN, mat2(0.8, 0.6, -0.6, 0.8) * p * 1.1).xyz * 2.0 - 1.0;
    vec2 nn = (n1.xy + n2.xy * 0.6) * (1.0 - gCtl.r * 0.4) * (1.0 - smoothstep(80.0, 220.0, dcam));
    vec3 pert = (viewMatrix * vec4(nn.x, 0.0, -nn.y, 0.0)).xyz;
    normal = normalize(normal + pert * 0.55);
  }
}`)
  }
  mat.customProgramCacheKey = () => 'village-ground' + (o.vertexColors ? 'v' : '')
  return {
    mat, U,
    apply(set) {
      const put = (k: string, key: string, avgKey?: string) => {
        if (!set[key]) return
        U[k].value = set[key].tex
        if (avgKey) (U[avgKey].value as Color).copy(set[key].avg)
      }
      put('uGrass', 'grass', 'uGrassAvg'); put('uLeafy', 'leafy', 'uLeafyAvg'); put('uDirt', 'dirt', 'uDirtAvg')
      put('uRock', 'rock', 'uRockAvg'); put('uGravel', 'gravel', 'uGravelAvg'); put('uGrassN', 'grassN')
    },
  }
}
