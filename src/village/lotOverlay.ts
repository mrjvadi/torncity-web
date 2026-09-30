// The build-mode overlay: a translucent tint per lot and thin lot borders,
// both draped on the ground (vertices asked from the terrain's own height
// function), plus draped outlines for a chosen footprint.

import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from 'three'
import type { VillageGround } from './terrainModel'

/** What a lot shows in build mode. */
export const TONE_NONE = 0
export const TONE_OK = 1
export const TONE_BAD = 2
export const TONE_TAKEN = 3
/** A lot the viewer owns (the citizen loop's land mode): gold. */
export const TONE_OWN = 5
/** A lot picked in a multi-select (roads). */
export const TONE_PICK = 4

const SUB = 4
const LIFT = 0.28
const TONES: Record<number, [number, number, number, number]> = {
  [TONE_NONE]: [0, 0, 0, 0],
  [TONE_OK]: [0.25, 0.9, 0.42, 0.45],
  [TONE_BAD]: [0.92, 0.05, 0.06, 0.6],
  [TONE_TAKEN]: [0.62, 0.66, 0.85, 0.28],
  [TONE_OWN]: [1, 0.8, 0.2, 0.55],
  [TONE_PICK]: [1, 0.78, 0.18, 0.7],
}

export class LotOverlay {
  readonly tint: Mesh
  readonly borders: LineSegments
  private colors: Float32Array
  private n: number
  private tintGeo: BufferGeometry
  private borderGeo: BufferGeometry
  private outline: LineSegments
  private outlineGeo = new BufferGeometry()

  constructor(private ground: VillageGround) {
    const n = (this.n = ground.n)
    const lot = ground.lot
    const verts = (SUB + 1) ** 2
    const pos = new Float32Array(n * n * verts * 3)
    this.colors = new Float32Array(n * n * verts * 4)
    const idx: number[] = []
    for (let ly = 0; ly < n; ly++) {
      for (let lx = 0; lx < n; lx++) {
        const c = ground.lotCentre(lx, ly)
        const base = (ly * n + lx) * verts
        for (let j = 0; j <= SUB; j++) {
          for (let i = 0; i <= SUB; i++) {
            const x = c.x + (i / SUB - 0.5) * lot
            const z = c.z + (j / SUB - 0.5) * lot
            const o = (base + j * (SUB + 1) + i) * 3
            pos[o] = x
            pos[o + 1] = ground.groundY(x, z) + LIFT
            pos[o + 2] = z
          }
        }
        for (let j = 0; j < SUB; j++) {
          for (let i = 0; i < SUB; i++) {
            const a = base + j * (SUB + 1) + i
            idx.push(a, a + SUB + 1, a + 1, a + 1, a + SUB + 1, a + SUB + 2)
          }
        }
      }
    }
    this.tintGeo = new BufferGeometry()
    this.tintGeo.setAttribute('position', new BufferAttribute(pos, 3))
    this.tintGeo.setAttribute('color', new BufferAttribute(this.colors, 4))
    this.tintGeo.setIndex(new BufferAttribute(new Uint32Array(idx), 1))
    this.tint = new Mesh(this.tintGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }))
    this.tint.renderOrder = 5
    this.tint.frustumCulled = false
    this.tint.name = 'lot-tint'

    // borders: every lot's outline, subdivided so it follows the ground
    const seg: number[] = []
    const line = (ax: number, az: number, bx: number, bz: number) => {
      const steps = 6
      for (let s = 0; s < steps; s++) {
        const x0 = ax + ((bx - ax) * s) / steps, z0 = az + ((bz - az) * s) / steps
        const x1 = ax + ((bx - ax) * (s + 1)) / steps, z1 = az + ((bz - az) * (s + 1)) / steps
        seg.push(x0, ground.groundY(x0, z0) + LIFT + 0.05, z0, x1, ground.groundY(x1, z1) + LIFT + 0.05, z1)
      }
    }
    for (let ly = 0; ly < n; ly++) {
      for (let lx = 0; lx < n; lx++) {
        const c = ground.lotCentre(lx, ly), h = lot / 2
        if (lx === n - 1) line(c.x + h, c.z - h, c.x + h, c.z + h)
        if (ly === 0) line(c.x - h, c.z + h, c.x + h, c.z + h)
        line(c.x - h, c.z - h, c.x + h, c.z - h)
        line(c.x - h, c.z - h, c.x - h, c.z + h)
      }
    }
    this.borderGeo = new BufferGeometry()
    this.borderGeo.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
    this.borders = new LineSegments(this.borderGeo, new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }))
    this.borders.renderOrder = 6
    this.borders.frustumCulled = false

    this.outline = new LineSegments(this.outlineGeo, new LineBasicMaterial({ color: 0xffd45a, depthWrite: false, depthTest: false, fog: false }))
    this.outline.renderOrder = 8
    this.outline.frustumCulled = false
    this.outline.visible = false
    this.setVisible(false)
  }

  get objects() { return [this.tint, this.borders, this.outline] }

  setVisible(v: boolean) {
    this.tint.visible = v
    this.borders.visible = v
    if (!v) this.outline.visible = false
  }

  /** tones[y * n + x] is one of the TONE_ codes. */
  setTones(tones: ArrayLike<number>) {
    const verts = (SUB + 1) ** 2
    for (let k = 0; k < this.n * this.n; k++) {
      const c = TONES[tones[k]] ?? TONES[TONE_NONE]
      for (let v = 0; v < verts; v++) this.colors.set(c, (k * verts + v) * 4)
    }
    ;(this.tintGeo.attributes.color as BufferAttribute).needsUpdate = true
  }

  /** A gold outline round a rectangle of lots (x, y = its lowest lot corner), or none. */
  setOutline(rect: { x: number; y: number; w: number; h: number; color?: number } | null) {
    if (!rect) { this.outline.visible = false; return }
    const g = this.ground
    const lot = g.lot
    const a = g.lotCentre(rect.x, rect.y + rect.h - 1)
    const b = g.lotCentre(rect.x + rect.w - 1, rect.y)
    const x0 = a.x - lot / 2 + 0.6, x1 = b.x + lot / 2 - 0.6, z0 = a.z - lot / 2 + 0.6, z1 = b.z + lot / 2 - 0.6
    const seg: number[] = []
    const line = (ax: number, az: number, bx: number, bz: number) => {
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 4))
      for (let s = 0; s < steps; s++) {
        const px = ax + ((bx - ax) * s) / steps, pz = az + ((bz - az) * s) / steps
        const qx = ax + ((bx - ax) * (s + 1)) / steps, qz = az + ((bz - az) * (s + 1)) / steps
        seg.push(px, g.groundY(px, pz) + 0.5, pz, qx, g.groundY(qx, qz) + 0.5, qz)
      }
    }
    line(x0, z0, x1, z0); line(x1, z0, x1, z1); line(x1, z1, x0, z1); line(x0, z1, x0, z0)
    this.outlineGeo.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
    this.outlineGeo.computeBoundingSphere()
    ;(this.outline.material as LineBasicMaterial).color.set(rect.color ?? 0xffd45a)
    this.outline.visible = true
  }

  dispose() {
    this.tintGeo.dispose(); this.borderGeo.dispose(); this.outlineGeo.dispose()
    ;(this.tint.material as MeshBasicMaterial).dispose()
    ;(this.borders.material as LineBasicMaterial).dispose()
    ;(this.outline.material as LineBasicMaterial).dispose()
  }
}
