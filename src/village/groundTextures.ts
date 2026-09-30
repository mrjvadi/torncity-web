// Real photo textures for the ground, swapped in after the first frame. A
// photo carries its own average brightness, which would repaint the whole
// field darker than the biome colours it is meant to detail; like the lab's
// ground shader (uGrassAvg) the texture is divided by its own mean so only
// the *variation* is added and the vertex colours keep deciding the tone.

import { Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three'

const BASE = `${import.meta.env.BASE_URL}world-city/textures/`
const loader = new TextureLoader()

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Mean colour of an image in linear light. */
function meanLinear(img: CanvasImageSource): Color | null {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')
    if (!g) return null
    g.drawImage(img, 0, 0, 16, 16)
    const d = g.getImageData(0, 0, 16, 16).data
    let r = 0, gg = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += srgbToLinear(d[i] / 255); gg += srgbToLinear(d[i + 1] / 255); b += srgbToLinear(d[i + 2] / 255) }
    const n = d.length / 4
    return new Color(r / n, gg / n, b / n)
  } catch {
    return null
  }
}

/** Loads `file` and puts it on `material`, tone-neutral; resolves false if it cannot. */
export function swapNeutral(material: MeshStandardMaterial, file: string, onReady: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    loader.load(
      `${BASE}${file}`,
      (tex: Texture) => {
        tex.wrapS = tex.wrapT = RepeatWrapping
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 4
        const avg = meanLinear(tex.image as CanvasImageSource)
        const old = material.map
        material.map = tex
        if (avg) material.color.setRGB(Math.min(2.2, 1 / Math.max(0.05, avg.r)), Math.min(2.2, 1 / Math.max(0.05, avg.g)), Math.min(2.2, 1 / Math.max(0.05, avg.b)))
        material.needsUpdate = true
        old?.dispose()
        onReady()
        resolve(true)
      },
      undefined,
      () => resolve(false),
    )
  })
}
