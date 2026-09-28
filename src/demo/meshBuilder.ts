// A tiny vertex accumulator: every procedural piece of geometry in this
// demo (road ribbons, building walls, curbs, rooftop clutter, ...) is a
// handful of quads pushed into one of these per material, then turned into
// ONE BufferGeometry — this is what "merge by material" (the task's own
// draw-call budget) means in practice: many small pieces, one upload, one
// draw call per material.

import { BufferAttribute, BufferGeometry, Vector3 } from 'three'

export class GeomAccum {
  private positions: number[] = []
  private normals: number[] = []
  private uvs: number[] = []
  private indices: number[] = []

  get vertexCount(): number {
    return this.positions.length / 3
  }

  /** Adds one quad, CCW winding when viewed from the side `normal` points
   * to. p0..p3 go around the quad in order (not necessarily a rectangle —
   * a trapezoid works fine, e.g. a highway ramp's sloped deck). uv0..uv3
   * match p0..p3. */
  addQuad(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, normal: Vector3, uv0: [number, number], uv1: [number, number], uv2: [number, number], uv3: [number, number]) {
    const base = this.vertexCount
    for (const p of [p0, p1, p2, p3]) this.positions.push(p.x, p.y, p.z)
    for (let i = 0; i < 4; i++) this.normals.push(normal.x, normal.y, normal.z)
    for (const uv of [uv0, uv1, uv2, uv3]) this.uvs.push(uv[0], uv[1])
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /** A flat rectangle quad with simple axis-aligned UVs (u along p0->p1,
   * v along p0->p3) scaled so one texture repeat spans `uPeriod`/`vPeriod`
   * world units — the common case (roads, sidewalks, roofs, walls). */
  addRect(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, normal: Vector3, uPeriod: number, vPeriod: number, uOffset = 0, vOffset = 0) {
    const uLen = p0.distanceTo(p1) / Math.max(1e-6, uPeriod)
    const vLen = p0.distanceTo(p3) / Math.max(1e-6, vPeriod)
    this.addQuad(p0, p1, p2, p3, normal, [uOffset, vOffset], [uOffset + uLen, vOffset], [uOffset + uLen, vOffset + vLen], [uOffset, vOffset + vLen])
  }

  addTri(p0: Vector3, p1: Vector3, p2: Vector3, normal: Vector3, uv0: [number, number], uv1: [number, number], uv2: [number, number]) {
    const base = this.vertexCount
    for (const p of [p0, p1, p2]) this.positions.push(p.x, p.y, p.z)
    for (let i = 0; i < 3; i++) this.normals.push(normal.x, normal.y, normal.z)
    for (const uv of [uv0, uv1, uv2]) this.uvs.push(uv[0], uv[1])
    this.indices.push(base, base + 1, base + 2)
  }

  /** An axis-aligned box from min to max, each face UV'd in real world
   * units divided by uPeriod/vPeriod (e.g. window pitch / floor height) so
   * a texture repeats at a consistent real-world scale regardless of the
   * box's own size. Vertical faces use worldY for V; the top face uses
   * worldZ for V. skipBottom saves two triangles for boxes that never show
   * their underside (most of them, sitting on the ground). */
  addBox(min: Vector3, max: Vector3, uPeriod: number, vPeriod: number, skipBottom = true) {
    const { x: x0, y: y0, z: z0 } = min
    const { x: x1, y: y1, z: z1 } = max
    const nx = new Vector3(-1, 0, 0)
    const px = new Vector3(1, 0, 0)
    const nz = new Vector3(0, 0, -1)
    const pz = new Vector3(0, 0, 1)
    const py = new Vector3(0, 1, 0)
    const ny = new Vector3(0, -1, 0)
    // +Z
    this.addRect(new Vector3(x0, y0, z1), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1), pz, uPeriod, vPeriod)
    // -Z
    this.addRect(new Vector3(x1, y0, z0), new Vector3(x0, y0, z0), new Vector3(x0, y1, z0), new Vector3(x1, y1, z0), nz, uPeriod, vPeriod)
    // +X
    this.addRect(new Vector3(x1, y0, z1), new Vector3(x1, y0, z0), new Vector3(x1, y1, z0), new Vector3(x1, y1, z1), px, uPeriod, vPeriod)
    // -X
    this.addRect(new Vector3(x0, y0, z0), new Vector3(x0, y0, z1), new Vector3(x0, y1, z1), new Vector3(x0, y1, z0), nx, uPeriod, vPeriod)
    // +Y (top)
    this.addRect(new Vector3(x0, y1, z1), new Vector3(x1, y1, z1), new Vector3(x1, y1, z0), new Vector3(x0, y1, z0), py, uPeriod, uPeriod)
    if (!skipBottom) {
      this.addRect(new Vector3(x0, y0, z0), new Vector3(x1, y0, z0), new Vector3(x1, y0, z1), new Vector3(x0, y0, z1), ny, uPeriod, uPeriod)
    }
  }

  toGeometry(): BufferGeometry | null {
    if (this.positions.length === 0) return null
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3))
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2))
    const useUint32 = this.positions.length / 3 > 65535
    geo.setIndex(new BufferAttribute(useUint32 ? new Uint32Array(this.indices) : new Uint16Array(this.indices), 1))
    return geo
  }
}
