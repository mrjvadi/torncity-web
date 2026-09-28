// Every material the city renders with is a runtime canvas texture — no
// asset files, nothing from a CDN (the players are in Iran; see the
// project's own no-CDN rule). Each function below draws one small, tileable
// canvas and wraps it in a three.js Texture. A tiny seeded PRNG (mulberry32)
// keeps every texture's own noise pattern reproducible between reloads,
// matching the rest of the export's "same seed, same result" rule even
// though these textures never read the city seed itself — reproducible
// output is simply better for iterating on how it looks.

import { CanvasTexture, LinearFilter, LinearMipMapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return { canvas, ctx }
}

function finish(canvas: HTMLCanvasElement, repeatX = true, repeatY = true): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.wrapS = repeatX ? RepeatWrapping : tex.wrapS
  tex.wrapT = repeatY ? RepeatWrapping : tex.wrapT
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipMapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = 4
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Neutral (mid-grey) mottled noise, multiplied over per-vertex biome
 * colour on the terrain — grass/soil mottling that reads as detail without
 * fighting the vertex colour's own hue. Wrapped so blobs drawn near one
 * edge are echoed near the opposite edge, keeping the tile seam quiet. */
export function makeGroundDetailTexture(size = 256, seed = 1): CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  const rnd = mulberry32(seed)
  ctx.fillStyle = '#8a8a82'
  ctx.fillRect(0, 0, size, size)
  const blobs = 900
  for (let i = 0; i < blobs; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 1.2 + rnd() * 3.2
    const lightness = rnd()
    const shade = lightness > 0.5 ? 255 : 0
    ctx.globalAlpha = 0.05 + rnd() * 0.09
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        if (Math.abs(ox) > 0 && x + ox > 0 && x + ox < size && Math.abs(x - size / 2) < r * 3) continue
        const drawX = x + ox
        const drawY = y + oy
        if (drawX < -r || drawX > size + r || drawY < -r || drawY > size + r) continue
        ctx.beginPath()
        ctx.arc(drawX, drawY, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // Fine grain speckle on top for close-up crispness.
  ctx.globalAlpha = 1
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18
    img.data[i] = clamp8(img.data[i] + n)
    img.data[i + 1] = clamp8(img.data[i + 1] + n)
    img.data[i + 2] = clamp8(img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)
  return finish(canvas)
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export interface RoadTextureResult {
  texture: CanvasTexture
  /** Real-world metres one full V (length) repeat spans — set a road
   * segment's V-axis UV span to (segment length in metres)/this so dashes
   * come out at a real ~6m dash+gap spacing regardless of segment length. */
  dashPeriodMeters: number
}

/** One road class's asphalt: base noise + patches, edge lines and a dashed
 * (local/arterial) or double (highway) centre line, baked straight into
 * the texture rather than drawn as separate geometry — cheap, and correct
 * at any zoom since it is just texture filtering. The texture's local V
 * axis is the road's LENGTH; U is across its width. */
export function makeRoadTexture(kind: 'local' | 'arterial' | 'highway', seed = 2): RoadTextureResult {
  const texW = 256
  const texH = 512
  const { canvas, ctx } = makeCanvas(texW)
  canvas.height = texH
  const rnd = mulberry32(seed + (kind === 'local' ? 1 : kind === 'arterial' ? 2 : 3))

  ctx.fillStyle = kind === 'highway' ? '#3a3c40' : '#45464a'
  ctx.fillRect(0, 0, texW, texH)
  // Noise / grime patches.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * texW
    const y = rnd() * texH
    const r = 3 + rnd() * 14
    ctx.globalAlpha = 0.04 + rnd() * 0.08
    ctx.fillStyle = rnd() > 0.5 ? '#000000' : '#6b6c70'
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.4 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const laneWidthPx = texW // full width is the road surface
  const edgeInset = texW * 0.035
  const lineW = Math.max(2, texW * 0.018)
  ctx.strokeStyle = '#e9e6d8'
  ctx.lineWidth = lineW
  // Solid edge lines.
  ctx.beginPath()
  ctx.moveTo(edgeInset, 0)
  ctx.lineTo(edgeInset, texH)
  ctx.moveTo(laneWidthPx - edgeInset, 0)
  ctx.lineTo(laneWidthPx - edgeInset, texH)
  ctx.stroke()

  if (kind === 'highway') {
    // Multiple lanes: dashed lines between each lane, no single centre.
    const lanes = 5
    for (let l = 1; l < lanes; l++) {
      const x = edgeInset + ((laneWidthPx - 2 * edgeInset) * l) / lanes
      drawDashed(ctx, x, texH, lineW * 0.8, '#d8d4c4')
    }
  } else if (kind === 'arterial') {
    const cx = texW / 2
    ctx.strokeStyle = '#f2e9a8'
    ctx.lineWidth = lineW * 0.9
    ctx.beginPath()
    ctx.moveTo(cx - lineW * 1.4, 0)
    ctx.lineTo(cx - lineW * 1.4, texH)
    ctx.moveTo(cx + lineW * 1.4, 0)
    ctx.lineTo(cx + lineW * 1.4, texH)
    ctx.stroke()
    // Lane dividers each side, dashed.
    drawDashed(ctx, edgeInset + (laneWidthPx - 2 * edgeInset) * 0.25, texH, lineW * 0.6, '#d8d4c4')
    drawDashed(ctx, edgeInset + (laneWidthPx - 2 * edgeInset) * 0.75, texH, lineW * 0.6, '#d8d4c4')
  } else {
    const cx = texW / 2
    drawDashed(ctx, cx, texH, lineW, '#f2e9a8')
  }

  return { texture: finish(canvas, false, true), dashPeriodMeters: 6 }
}

function drawDashed(ctx: CanvasRenderingContext2D, x: number, height: number, w: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  const dash = height / 10
  for (let y = 0; y < height; y += dash * 2) {
    ctx.moveTo(x, y)
    ctx.lineTo(x, Math.min(height, y + dash))
  }
  ctx.stroke()
}

/** Light concrete sidewalk: subtle expansion-joint panel lines + speckle. */
export function makeSidewalkTexture(seed = 3): CanvasTexture {
  const size = 128
  const { canvas, ctx } = makeCanvas(size)
  const rnd = mulberry32(seed)
  ctx.fillStyle = '#c9c6bd'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(90,88,80,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, size / 2)
  ctx.lineTo(size, size / 2)
  ctx.stroke()
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 20
    img.data[i] = clamp8(img.data[i] + n)
    img.data[i + 1] = clamp8(img.data[i + 1] + n)
    img.data[i + 2] = clamp8(img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)
  return finish(canvas)
}

export type FacadeKind = 'glass' | 'midrise' | 'housing' | 'stone'

export interface FacadeTextureResult {
  texture: CanvasTexture
  /** Real-world metres one full texture U repeat spans (one window bay). */
  windowPitchMeters: number
  /** Real-world metres one full texture V repeat spans (one floor). */
  floorPitchMeters: number
}

/** One building type's wall material: a single window-bay tile, repeated
 * by the caller's own UV generation so a building's real width/floor count
 * lands each window at a real ~1.5m pitch and each floor at 3.2m — see
 * buildings.ts's uvForWall. */
export function makeFacadeTexture(kind: FacadeKind, seed = 4): FacadeTextureResult {
  const w = 64
  const h = 96
  const { canvas, ctx } = makeCanvas(w)
  canvas.height = h
  const rnd = mulberry32(seed + kind.length)

  if (kind === 'glass') {
    // Dark frame border (the mullion) all around the tile, a deep-blue
    // glass pane inset inside it, and a soft diagonal sky-reflection
    // streak — reads as a real curtain-wall bay even minified at distance,
    // since the dark frame stays a hard edge under mip-mapping longer
    // than a soft gradient would.
    ctx.fillStyle = '#1b2530'
    ctx.fillRect(0, 0, w, h)
    const inset = w * 0.09
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#2f5578')
    grad.addColorStop(0.5, '#3d6f96')
    grad.addColorStop(1, '#254864')
    ctx.fillStyle = grad
    ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.beginPath()
    ctx.moveTo(inset, h * 0.55)
    ctx.lineTo(w * 0.55, inset)
    ctx.lineTo(w * 0.72, inset)
    ctx.lineTo(inset, h * 0.75)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'midrise') {
    ctx.fillStyle = '#8a5340'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 240; i++) {
      const x = rnd() * w
      const y = rnd() * h
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'
      ctx.fillRect(x, y, 2, 1)
    }
    ctx.fillStyle = '#14181d'
    ctx.fillRect(w * 0.14, h * 0.16, w * 0.72, h * 0.6)
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(w * 0.14, h * 0.16, w * 0.72, h * 0.6)
  } else if (kind === 'housing') {
    ctx.fillStyle = '#c9b28f'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 180; i++) {
      const x = rnd() * w
      const y = rnd() * h
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'
      ctx.fillRect(x, y, 1.5, 1.5)
    }
    ctx.fillStyle = '#171b20'
    ctx.fillRect(w * 0.2, h * 0.22, w * 0.6, h * 0.42)
    ctx.strokeStyle = '#efe6d2'
    ctx.lineWidth = 2
    ctx.strokeRect(w * 0.2, h * 0.22, w * 0.6, h * 0.42)
  } else {
    ctx.fillStyle = '#cfc9b8'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 220; i++) {
      const x = rnd() * w
      const y = rnd() * h
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.10)'
      ctx.fillRect(x, y, 2, 1)
    }
    ctx.strokeStyle = 'rgba(90,80,60,0.4)'
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += h / 6) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.fillStyle = '#161c22'
    ctx.fillRect(w * 0.22, h * 0.2, w * 0.56, h * 0.5)
    ctx.strokeStyle = '#efe6d2'
    ctx.lineWidth = 2
    ctx.strokeRect(w * 0.22, h * 0.2, w * 0.56, h * 0.5)
  }

  return { texture: finish(canvas), windowPitchMeters: 1.5, floorPitchMeters: 3.2 }
}

/** Dark glazed ground-floor shop band (proccity.jpg's storefronts): one
 * texture, tiled along a building's own perimeter at ~3m per bay. */
export function makeShopfrontTexture(seed = 5): CanvasTexture {
  const w = 96
  const h = 48
  const { canvas, ctx } = makeCanvas(w)
  canvas.height = h
  const rnd = mulberry32(seed)
  ctx.fillStyle = '#1c1f24'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#587085'
  ctx.fillRect(4, 4, w * 0.42, h - 12)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(6, 6, w * 0.42 - 4, (h - 12) * 0.4)
  ctx.fillStyle = '#d8cf9a'
  ctx.fillRect(w * 0.5, 10, w * 0.44, h - 24)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w
    const y = rnd() * h
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(x, y, 1.5, 1.5)
  }
  return finish(canvas)
}

/** Rooftop material: flat grey membrane with subtle noise, used under
 * rooftop clutter (AC units, solar panels, parapets). */
export function makeRoofTexture(seed = 6): CanvasTexture {
  const size = 64
  const { canvas, ctx } = makeCanvas(size)
  const rnd = mulberry32(seed)
  ctx.fillStyle = '#5c5d5a'
  ctx.fillRect(0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22
    img.data[i] = clamp8(img.data[i] + n)
    img.data[i + 1] = clamp8(img.data[i + 1] + n)
    img.data[i + 2] = clamp8(img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)
  return finish(canvas)
}

/** Striped farm field: alternating crop-row colours, tiled per farm lot. */
export function makeFarmTexture(seed = 7): CanvasTexture {
  const w = 64
  const h = 64
  const { canvas, ctx } = makeCanvas(w)
  canvas.height = h
  const rnd = mulberry32(seed)
  const stripes = 8
  for (let i = 0; i < stripes; i++) {
    const t = i / stripes
    const a = i % 2 === 0
    ctx.fillStyle = a ? `hsl(${78 + rnd() * 8},46%,${34 + rnd() * 6}%)` : `hsl(${42 + rnd() * 10},52%,${40 + rnd() * 8}%)`
    ctx.fillRect(0, t * h, w, h / stripes + 1)
  }
  return finish(canvas)
}

/** A transparent-background cluster of a few blades + one small flower dot
 * — alpha-tested billboard quads for the near-camera grass field
 * (terrain.ts's buildGrassField). Drawn once, instanced many times. */
export function makeGrassBladeTexture(seed = 8): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const rnd = mulberry32(seed)
  ctx.clearRect(0, 0, size, size)
  const blades = 6
  for (let i = 0; i < blades; i++) {
    const bx = size * 0.5 + (rnd() - 0.5) * size * 0.5
    const bh = size * (0.55 + rnd() * 0.4)
    const bw = size * (0.05 + rnd() * 0.05)
    const lean = (rnd() - 0.5) * size * 0.18
    const g = rnd() > 0.5 ? '#4f8c3a' : '#3c7a2c'
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(bx - bw, size)
    ctx.quadraticCurveTo(bx + lean * 0.5, size - bh * 0.6, bx + lean, size - bh)
    ctx.quadraticCurveTo(bx + lean * 0.5 + bw, size - bh * 0.6, bx + bw, size)
    ctx.closePath()
    ctx.fill()
  }
  if (rnd() > 0.55) {
    ctx.fillStyle = rnd() > 0.5 ? '#e8d24a' : '#e0e0e0'
    ctx.beginPath()
    ctx.arc(size * 0.5 + (rnd() - 0.5) * size * 0.3, size * 0.32, size * 0.06, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Disposes every texture handed to it — call from the scene's dispose(). */
export function disposeTextures(...textures: (Texture | undefined | null)[]) {
  for (const t of textures) t?.dispose()
}
