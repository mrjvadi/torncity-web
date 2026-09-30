// A tiny mesh accumulator with per-vertex colour and three material groups,
// the lab's houselib.js `GB` in TypeScript: every village building is a few
// hundred triangles of coloured boxes, gable/hip roofs and cylinders merged
// into one BufferGeometry (no model files are shipped, ADR: a building's
// look is the client's own, seeded by `visual_seed`).

import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'

/** Draw groups: walls (stucco texture), roofs (tile texture), plain colour. */
export const G_WALL = 0
export const G_ROOF = 1
export const G_PLAIN = 2

export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const tmpA = new Vector3()
const tmpB = new Vector3()

export class ColorGeom {
  private pos: number[] = []
  private nor: number[] = []
  private col: number[] = []
  private uv: number[] = []
  private idx: number[][] = [[], [], []]

  get triangleCount(): number { return this.idx.reduce((n, a) => n + a.length / 3, 0) }

  /** a,b,c,d counter-clockwise seen from the front. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color | number, uvs = 0.3, group = G_WALL): void {
    const col = color instanceof Color ? color : new Color(color)
    const n = tmpA.subVectors(b, a).cross(tmpB.subVectors(c, a)).normalize()
    const base = this.pos.length / 3
    for (const p of [a, b, c, d]) {
      this.pos.push(p.x, p.y, p.z)
      this.nor.push(n.x, n.y, n.z)
      this.col.push(col.r, col.g, col.b)
      const flat = Math.abs(n.y) > 0.6
      this.uv.push((flat ? p.x : Math.abs(n.x) > Math.abs(n.z) ? p.z : p.x) * uvs, (flat ? p.z : p.y) * uvs)
    }
    this.idx[group].push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  tri(a: Vector3, b: Vector3, c: Vector3, color: Color | number, uvs = 0.3, group = G_WALL): void {
    const col = color instanceof Color ? color : new Color(color)
    const n = tmpA.subVectors(b, a).cross(tmpB.subVectors(c, a)).normalize()
    const base = this.pos.length / 3
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z)
      this.nor.push(n.x, n.y, n.z)
      this.col.push(col.r, col.g, col.b)
      this.uv.push((Math.abs(n.x) > Math.abs(n.z) ? p.z : p.x) * uvs, p.y * uvs)
    }
    this.idx[group].push(base, base + 1, base + 2)
  }

  /** An axis-aligned box by centre and size. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Color | number, group = G_WALL, skipBottom = true): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2
    this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), color, 0.3, group)
    this.quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), color, 0.3, group)
    this.quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), color, 0.3, group)
    this.quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), color, 0.3, group)
    this.quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), color, 0.3, group)
    if (!skipBottom) this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), color, 0.3, group)
  }

  /** A box from its base y (not centre). */
  slab(cx: number, y0: number, cz: number, sx: number, sy: number, sz: number, color: Color | number, group = G_PLAIN): void {
    this.box(cx, y0 + sy / 2, cz, sx, sy, sz, color, group)
  }

  /** A gable roof over a wall box: ridge along x or z. */
  gable(cx: number, cz: number, w: number, d: number, yEave: number, rise: number, ridge: 'x' | 'z', roofColor: Color | number, wallColor: Color | number, overhang = 0.5): void {
    const hw = w / 2, hd = d / 2, ov = overhang, ye = yEave - 0.1, yr = yEave + rise
    if (ridge === 'x') {
      this.quad(V(cx - hw - ov, ye, cz + hd + ov), V(cx + hw + ov, ye, cz + hd + ov), V(cx + hw + ov, yr, cz), V(cx - hw - ov, yr, cz), roofColor, 0.4, G_ROOF)
      this.quad(V(cx + hw + ov, ye, cz - hd - ov), V(cx - hw - ov, ye, cz - hd - ov), V(cx - hw - ov, yr, cz), V(cx + hw + ov, yr, cz), roofColor, 0.4, G_ROOF)
      this.tri(V(cx + hw, yEave, cz + hd), V(cx + hw, yEave, cz - hd), V(cx + hw, yr - 0.05, cz), wallColor)
      this.tri(V(cx - hw, yEave, cz - hd), V(cx - hw, yEave, cz + hd), V(cx - hw, yr - 0.05, cz), wallColor)
    } else {
      this.quad(V(cx + hw + ov, ye, cz + hd + ov), V(cx + hw + ov, ye, cz - hd - ov), V(cx, yr, cz - hd - ov), V(cx, yr, cz + hd + ov), roofColor, 0.4, G_ROOF)
      this.quad(V(cx - hw - ov, ye, cz - hd - ov), V(cx - hw - ov, ye, cz + hd + ov), V(cx, yr, cz + hd + ov), V(cx, yr, cz - hd - ov), roofColor, 0.4, G_ROOF)
      this.tri(V(cx - hw, yEave, cz + hd), V(cx + hw, yEave, cz + hd), V(cx, yr - 0.05, cz + hd), wallColor)
      this.tri(V(cx + hw, yEave, cz - hd), V(cx - hw, yEave, cz - hd), V(cx, yr - 0.05, cz - hd), wallColor)
    }
  }

  /** A four-sided hipped (or pyramid) roof. */
  hip(cx: number, cz: number, w: number, d: number, yEave: number, rise: number, roofColor: Color | number, overhang = 0.5): void {
    const hw = w / 2 + overhang, hd = d / 2 + overhang, ye = yEave - 0.1, yr = yEave + rise
    const rl = Math.max(0, (Math.abs(w - d)) / 2)
    const ax = w >= d ? rl : 0, az = w >= d ? 0 : rl
    this.quad(V(cx - hw, ye, cz + hd), V(cx + hw, ye, cz + hd), V(cx + ax, yr, cz + az), V(cx - ax, yr, cz + az), roofColor, 0.4, G_ROOF)
    this.quad(V(cx + hw, ye, cz - hd), V(cx - hw, ye, cz - hd), V(cx - ax, yr, cz - az), V(cx + ax, yr, cz - az), roofColor, 0.4, G_ROOF)
    this.quad(V(cx + hw, ye, cz + hd), V(cx + hw, ye, cz - hd), V(cx + ax, yr, cz - az), V(cx + ax, yr, cz + az), roofColor, 0.4, G_ROOF)
    this.quad(V(cx - hw, ye, cz - hd), V(cx - hw, ye, cz + hd), V(cx - ax, yr, cz + az), V(cx - ax, yr, cz - az), roofColor, 0.4, G_ROOF)
  }

  /** A flat roof with a parapet (walls carry on up 0.7 m). */
  flatRoof(cx: number, cz: number, w: number, d: number, yTop: number, roofColor: Color | number, parapet: Color | number): void {
    this.quad(V(cx - w / 2, yTop, cz + d / 2), V(cx + w / 2, yTop, cz + d / 2), V(cx + w / 2, yTop, cz - d / 2), V(cx - w / 2, yTop, cz - d / 2), roofColor, 0.2, G_ROOF)
    const t = 0.3, h = 0.8
    this.box(cx, yTop + h / 2, cz + d / 2 - t / 2, w + 0.2, h, t, parapet)
    this.box(cx, yTop + h / 2, cz - d / 2 + t / 2, w + 0.2, h, t, parapet)
    this.box(cx + w / 2 - t / 2, yTop + h / 2, cz, t, h, d - t * 2, parapet)
    this.box(cx - w / 2 + t / 2, yTop + h / 2, cz, t, h, d - t * 2, parapet)
  }

  /** An upright cylinder (chimney, silo, tower, well) with an open top. */
  cylinder(cx: number, cz: number, r: number, y0: number, y1: number, color: Color | number, group = G_WALL, sides = 10, rTop = r): void {
    const col = color instanceof Color ? color : new Color(color)
    const base = this.pos.length / 3
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2
      const cs = Math.cos(a), sn = Math.sin(a)
      this.pos.push(cx + cs * r, y0, cz + sn * r, cx + cs * rTop, y1, cz + sn * rTop)
      this.nor.push(cs, 0, sn, cs, 0, sn)
      this.col.push(col.r, col.g, col.b, col.r, col.g, col.b)
      this.uv.push(i * 0.6, y0 * 0.3, i * 0.6, y1 * 0.3)
    }
    for (let i = 0; i < sides; i++) {
      const a = base + i * 2
      this.idx[group].push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
  }

  /** A cone (conical roof, tent, spoil heap). */
  cone(cx: number, cz: number, r: number, y0: number, y1: number, color: Color | number, group = G_ROOF, sides = 10): void {
    const col = color instanceof Color ? color : new Color(color)
    const base = this.pos.length / 3
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2
      const cs = Math.cos(a), sn = Math.sin(a)
      this.pos.push(cx + cs * r, y0, cz + sn * r, cx, y1, cz)
      const ny = r / Math.hypot(r, y1 - y0)
      const nl = Math.hypot(cs, sn) || 1
      this.nor.push(cs / nl * (1 - ny), ny, sn / nl * (1 - ny), cs / nl * (1 - ny), ny, sn / nl * (1 - ny))
      this.col.push(col.r, col.g, col.b, col.r, col.g, col.b)
      this.uv.push(i * 0.5, 0, i * 0.5, r * 0.4)
    }
    for (let i = 0; i < sides; i++) {
      const a = base + i * 2
      this.idx[group].push(a, a + 1, a + 3, a, a + 3, a + 2)
    }
  }

  /** Copies another accumulator in, moved by (dx,dy,dz) and turned about y. */
  append(o: ColorGeom, dx: number, dy: number, dz: number, rotY = 0): void {
    const base = this.pos.length / 3
    const cs = Math.cos(rotY), sn = Math.sin(rotY)
    for (let i = 0; i < o.pos.length; i += 3) {
      const x = o.pos[i], y = o.pos[i + 1], z = o.pos[i + 2]
      this.pos.push(x * cs + z * sn + dx, y + dy, -x * sn + z * cs + dz)
      const nx = o.nor[i], nz = o.nor[i + 2]
      this.nor.push(nx * cs + nz * sn, o.nor[i + 1], -nx * sn + nz * cs)
      this.col.push(o.col[i], o.col[i + 1], o.col[i + 2])
    }
    for (let i = 0; i < o.uv.length; i++) this.uv.push(o.uv[i])
    for (let g = 0; g < 3; g++) for (const k of o.idx[g]) this.idx[g].push(base + k)
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2))
    const all = ([] as number[]).concat(...this.idx)
    g.setIndex(new BufferAttribute(this.pos.length / 3 > 65000 ? new Uint32Array(all) : new Uint16Array(all), 1))
    let start = 0
    this.idx.forEach((a, i) => {
      if (a.length) g.addGroup(start, a.length, i)
      start += a.length
    })
    g.computeBoundingSphere()
    return g
  }
}
