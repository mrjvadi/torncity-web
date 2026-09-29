// Real CC0 photo textures (Poly Haven / ambientCG, self-hosted — see
// public/world-city/textures/CREDITS.md), swapped in for the equivalent
// canvas-noise material AFTER the scene's first frame: every builder still
// creates its materials with the cheap procedural texture first so the
// first paint on a phone never waits on a network fetch, then calls
// swapDiffuse/swapWallDiffuse here once idle, which loads the real photo
// and hot-swaps material.map (+ normalMap where budgeted) in place,
// calling the supplied onReady so the scene re-renders once.
//
// BUDGET. Diffuse is 512px WebP, normals only for grass/asphalt/brick at
// 256px (the set actually viewed up close) — see the project report for
// the exact byte count. Nothing here is fetched more than once: every
// loader is memoised by URL.

import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three'

const BASE = `${import.meta.env.BASE_URL}world-city/textures/`
const loader = new TextureLoader()
const cache = new Map<string, Promise<Texture | null>>()

function load(file: string, srgb: boolean): Promise<Texture | null> {
  const key = `${file}:${srgb}`
  let p = cache.get(key)
  if (p) return p
  p = new Promise((resolve) => {
    loader.load(
      `${BASE}${file}`,
      (tex) => {
        tex.wrapS = RepeatWrapping
        tex.wrapT = RepeatWrapping
        if (srgb) tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 4
        tex.generateMipmaps = true
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      () => resolve(null), // offline / blocked: keep the canvas texture already on screen
    )
  })
  cache.set(key, p)
  return p
}

export interface DiffuseNormalPair {
  diffuse: string
  normal256?: string
}

export const PHOTO_TEXTURES = {
  grassLawn: { diffuse: 'grass_lawn_diff.webp', normal256: 'grass_lawn_nor_gl_256.webp' },
  leafyGrass: { diffuse: 'leafy_grass_diff.webp', normal256: 'leafy_grass_nor_gl_256.webp' },
  dirtFloor: { diffuse: 'dirt_floor_diff.webp' },
  riverRocks: { diffuse: 'river_small_rocks_diff.webp' },
  asphalt: { diffuse: 'asphalt_02_diff.webp', normal256: 'asphalt_02_nor_gl_256.webp' },
  concrete: { diffuse: 'concrete_pavement_diff.webp' },
  brick: { diffuse: 'brick_wall_09_diff.webp', normal256: 'brick_wall_09_nor_gl_256.webp' },
  plaster: { diffuse: 'plastered_wall_02_diff.webp' },
  bitumen: { diffuse: 'bitumen_diff.webp' },
} as const satisfies Record<string, DiffuseNormalPair>

/** Loads a plain ground/road/roof diffuse (+ 256 normal when the set has
 * one) and swaps it onto `material` in place, setting the given repeat
 * (tiles-per-metre already baked in by the caller). Resolves once applied,
 * or resolves doing nothing if the fetch failed (stays on the canvas
 * texture). */
export async function swapDiffuse(
  material: { map: Texture | null; normalMap?: Texture | null; needsUpdate: boolean },
  set: DiffuseNormalPair,
  repeatX: number,
  repeatY: number,
  onReady: () => void,
): Promise<void> {
  const [diffuse, normal] = await Promise.all([
    load(set.diffuse, true),
    set.normal256 ? load(set.normal256, false) : Promise.resolve(null),
  ])
  if (!diffuse) return
  diffuse.repeat.set(repeatX, repeatY)
  material.map = diffuse
  if (normal && 'normalMap' in material) {
    normal.repeat.set(repeatX, repeatY)
    material.normalMap = normal
  }
  material.needsUpdate = true
  onReady()
}

/** Loads a wall photo (brick/plaster) and composites the SAME window-grid
 * pattern the canvas facade texture already drew onto it (dark panes +
 * frame lines, multiplied over the photo), so the swap keeps the window
 * read instead of replacing it with a blank brick wall. Returns a new
 * CanvasTexture-backed image; the caller still owns UV/repeat (unchanged
 * from the procedural texture's own window-pitch scale). */
export async function swapWallDiffuse(
  material: { map: Texture | null; normalMap?: Texture | null; needsUpdate: boolean },
  set: DiffuseNormalPair,
  drawWindowOverlay: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  onReady: () => void,
): Promise<void> {
  const [photo, normal] = await Promise.all([
    load(set.diffuse, true),
    set.normal256 ? load(set.normal256, false) : Promise.resolve(null),
  ])
  if (!photo || !photo.image) return
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(photo.image as CanvasImageSource, 0, 0, size, size)
  drawWindowOverlay(ctx, size, size)
  const { CanvasTexture } = await import('three')
  const combined = new CanvasTexture(canvas)
  combined.wrapS = RepeatWrapping
  combined.wrapT = RepeatWrapping
  combined.colorSpace = SRGBColorSpace
  combined.anisotropy = 4
  combined.needsUpdate = true
  const oldMap = material.map
  material.map = combined
  if (normal && 'normalMap' in material) material.normalMap = normal
  material.needsUpdate = true
  oldMap?.dispose()
  onReady()
}
