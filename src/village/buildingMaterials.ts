// The three materials a village building's groups use (colorGeom.ts): stucco
// walls, clay roof tiles, plain vertex colour. The two textures are tiny
// tileable canvases drawn once (the lab's houselib.js makeHouseMaterials).

import { CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { seededRng } from './colorGeom'

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, n: number) => void): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d') as CanvasRenderingContext2D
  draw(g, size)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

export interface BuildingMaterials {
  list: MeshStandardMaterial[]
  dispose(): void
  /** A translucent copy of the set, for the placement preview. */
  ghost(color: number): MeshStandardMaterial[]
}

export function makeBuildingMaterials(): BuildingMaterials {
  const R = seededRng(77)
  const stucco = canvasTex(128, (g, n) => {
    g.fillStyle = '#ececec'
    g.fillRect(0, 0, n, n)
    for (let i = 0; i < 2600; i++) {
      const v = 200 + Math.floor(R() * 55)
      g.fillStyle = `rgba(${v},${v},${v},${0.35 + R() * 0.4})`
      g.fillRect(R() * n, R() * n, 1 + R() * 2, 1 + R() * 2)
    }
  })
  const tiles = canvasTex(128, (g, n) => {
    const rows = 8, rh = n / rows, cw = n / 8
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < 9; c++) {
        const x = c * cw + (r % 2) * cw / 2, v = 150 + Math.floor(R() * 90)
        const grd = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh)
        grd.addColorStop(0, `rgb(${v + 35},${v + 35},${v + 35})`)
        grd.addColorStop(0.75, `rgb(${v},${v},${v})`)
        grd.addColorStop(1, `rgb(${v - 70},${v - 70},${v - 70})`)
        g.fillStyle = grd
        g.fillRect(x + 1, r * rh, cw - 1, rh)
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(x, r * rh, 1.5, rh)
      }
    }
  })
  const wall = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: stucco, roughness: 0.92 })
  const roof = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: tiles, roughness: 0.85, side: DoubleSide })
  const plain = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, side: DoubleSide })
  const ghosts: MeshStandardMaterial[] = []
  return {
    list: [wall, roof, plain],
    ghost(color: number) {
      const out = [wall, roof, plain].map((m) => {
        const c = m.clone()
        c.transparent = true
        c.opacity = 0.62
        c.depthWrite = false
        c.color.set(color)
        return c
      })
      ghosts.push(...out)
      return out
    },
    dispose() {
      stucco.dispose()
      tiles.dispose()
      for (const m of [wall, roof, plain, ...ghosts]) m.dispose()
    },
  }
}
