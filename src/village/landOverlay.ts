// The overlay of the land beyond the first grid (ADR 0044 5.5, "a road opens the land it reaches").
//
// LotOverlay tints the dense n x n block of the first grid. The land the roads open has no edge and no
// shape, so its lots are a sparse list with absolute lot coordinates (negative west and south of the
// grid): this overlay draws exactly those, a translucent tint per lot with thin borders, draped on the
// ground (the vertices ask the terrain's own height function, which beyond the fine window is the
// coarse backdrop's surface), and the road being drawn as a gold ribbon over the lots' centres.

import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Object3D } from 'three'
import type { VillageGround } from './terrainModel'
import { toneColor } from './lotOverlay'

export interface OuterCell { x: number; y: number; tone: number }

const LIFT = 0.3
const RIBBON_HALF = 2.4
const RIBBON_STEP = 4
/** Beyond this many lots the borders are left off and the tint is one quad per lot: a long road opens thousands. */
const BORDER_MAX = 5000
const SUB_MAX = 3000

export class LandOverlay {
  readonly tint: Mesh
  readonly borders: LineSegments
  readonly ribbon: Mesh
  private tintGeo = new BufferGeometry()
  private borderGeo = new BufferGeometry()
  private ribbonGeo = new BufferGeometry()
  private visible = false

  constructor(private ground: VillageGround) {
    this.tint = new Mesh(this.tintGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }))
    this.tint.renderOrder = 5
    this.tint.frustumCulled = false
    this.tint.name = 'land-tint'
    this.borders = new LineSegments(this.borderGeo, new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false }))
    this.borders.renderOrder = 6
    this.borders.frustumCulled = false
    this.ribbon = new Mesh(this.ribbonGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, fog: false }))
    this.ribbon.renderOrder = 9
    this.ribbon.frustumCulled = false
    this.ribbon.visible = false
    this.tint.visible = this.borders.visible = false
  }

  get objects(): Object3D[] { return [this.tint, this.borders, this.ribbon] }

  /** Show or hide the tint and borders (the ribbon follows its own path). */
  setVisible(v: boolean) {
    this.visible = v
    this.tint.visible = v && this.tintCount > 0
    this.borders.visible = v && this.borderCount > 0
  }

  private tintCount = 0
  private borderCount = 0

  /** One tinted quad per lot. A lot with tone 0 is left out. */
  setCells(cells: readonly OuterCell[]) {
    const g = this.ground
    const lot = g.lot
    const list = cells.filter((c) => c.tone > 0)
    const sub = list.length <= SUB_MAX ? 2 : 1
    const verts = (sub + 1) ** 2
    const pos = new Float32Array(list.length * verts * 3)
    const col = new Float32Array(list.length * verts * 4)
    const idx: number[] = []
    list.forEach((c, k) => {
      const m = g.lotCentre(c.x, c.y)
      const rgba = toneColor(c.tone)
      const base = k * verts
      for (let j = 0; j <= sub; j++) {
        for (let i = 0; i <= sub; i++) {
          const x = m.x + (i / sub - 0.5) * lot, z = m.z + (j / sub - 0.5) * lot
          const o = (base + j * (sub + 1) + i) * 3
          pos[o] = x; pos[o + 1] = g.groundY(x, z) + LIFT; pos[o + 2] = z
          col.set(rgba, (base + j * (sub + 1) + i) * 4)
        }
      }
      for (let j = 0; j < sub; j++) {
        for (let i = 0; i < sub; i++) {
          const a = base + j * (sub + 1) + i
          idx.push(a, a + sub + 1, a + 1, a + 1, a + sub + 1, a + sub + 2)
        }
      }
    })
    this.tintGeo.setAttribute('position', new BufferAttribute(pos, 3))
    this.tintGeo.setAttribute('color', new BufferAttribute(col, 4))
    this.tintGeo.setIndex(new BufferAttribute(list.length * verts > 65000 ? new Uint32Array(idx) : new Uint16Array(idx), 1))
    this.tintGeo.computeBoundingSphere()
    this.tintCount = list.length

    const seg: number[] = []
    if (list.length <= BORDER_MAX) {
      const line = (ax: number, az: number, bx: number, bz: number) => {
        const steps = 3
        for (let s = 0; s < steps; s++) {
          const x0 = ax + ((bx - ax) * s) / steps, z0 = az + ((bz - az) * s) / steps
          const x1 = ax + ((bx - ax) * (s + 1)) / steps, z1 = az + ((bz - az) * (s + 1)) / steps
          seg.push(x0, g.groundY(x0, z0) + LIFT + 0.05, z0, x1, g.groundY(x1, z1) + LIFT + 0.05, z1)
        }
      }
      for (const c of list) {
        const m = g.lotCentre(c.x, c.y), h = lot / 2
        line(m.x - h, m.z - h, m.x + h, m.z - h)
        line(m.x - h, m.z - h, m.x - h, m.z + h)
        line(m.x + h, m.z - h, m.x + h, m.z + h)
        line(m.x - h, m.z + h, m.x + h, m.z + h)
      }
    }
    this.borderGeo.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
    this.borderGeo.computeBoundingSphere()
    this.borderCount = seg.length / 6
    this.setVisible(this.visible)
  }

  /** The road being drawn: a gold ribbon through the lots' centres; null clears. */
  setRibbon(path: readonly { x: number; y: number }[] | null) {
    if (!path || path.length === 0) { this.ribbon.visible = false; return }
    const g = this.ground
    const pos: number[] = [], col: number[] = [], idx: number[] = []
    const gold: [number, number, number, number] = [1, 0.8, 0.2, 0.85]
    const centres = path.map((p) => g.lotCentre(p.x, p.y))
    for (let a = 0; a + 1 < centres.length; a++) {
      const p = centres[a], q = centres[a + 1]
      const len = Math.hypot(q.x - p.x, q.z - p.z) || 1
      const n = Math.max(1, Math.ceil(len / RIBBON_STEP))
      const nx = -(q.z - p.z) / len, nz = (q.x - p.x) / len
      const start = pos.length / 3
      for (let i = 0; i <= n; i++) {
        const x = p.x + ((q.x - p.x) * i) / n, z = p.z + ((q.z - p.z) * i) / n
        for (const side of [-1, 1]) {
          const px = x + nx * RIBBON_HALF * side, pz = z + nz * RIBBON_HALF * side
          pos.push(px, g.groundY(px, pz) + LIFT + 0.4, pz)
          col.push(...gold)
        }
      }
      for (let i = 0; i < n; i++) {
        const s = start + i * 2
        idx.push(s, s + 1, s + 2, s + 1, s + 3, s + 2)
      }
    }
    this.ribbonGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    this.ribbonGeo.setAttribute('color', new BufferAttribute(new Float32Array(col), 4))
    this.ribbonGeo.setIndex(new BufferAttribute(pos.length / 3 > 65000 ? new Uint32Array(idx) : new Uint16Array(idx), 1))
    this.ribbonGeo.computeBoundingSphere()
    this.ribbon.visible = true
  }

  dispose() {
    this.tintGeo.dispose(); this.borderGeo.dispose(); this.ribbonGeo.dispose()
    ;(this.tint.material as MeshBasicMaterial).dispose()
    ;(this.borders.material as LineBasicMaterial).dispose()
    ;(this.ribbon.material as MeshBasicMaterial).dispose()
  }
}
