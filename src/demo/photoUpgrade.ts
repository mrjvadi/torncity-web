// Orchestrates every real-photo texture swap (see photoTextures.ts for the
// actual loader) once the scene's first frame is already on screen: ground
// gets grass_lawn/leafy_grass, roads get asphalt_02 with the SAME lane
// markings redrawn on top (never just a blank photo tile — the markings
// are what makes a road read as a road), sidewalks get concrete_pavement,
// and midrise/housing/civic walls get brick_wall_09/plastered_wall_02 with
// the SAME window-grid overlay the procedural texture drew, composited on
// top. Glass towers are left on their procedural curtain-wall texture (no
// real-photo equivalent asked for). Every swap is independent and
// best-effort — a slow or blocked fetch just leaves that one material on
// its canvas texture, nothing else waits on it.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type MeshStandardMaterial } from 'three'
import type { TerrainResult } from './terrain'
import type { RoadsResult } from './roads'
import type { BuildingsResult } from './buildings'
import { PHOTO_TEXTURES, swapDiffuse, swapWallDiffuse, type DiffuseNormalPair } from './photoTextures'

const BASE = `${import.meta.env.BASE_URL}world-city/textures/`

function loadImage(file: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `${BASE}${file}`
  })
}

/** A tiled-photo canvas the same size as the procedural road texture, with
 * the SAME edge/centre lane markings this road class already draws —
 * reusing makeRoadTexture's own drawing calls would need it to accept a
 * base image, more churn than this file's job justifies, so the marking
 * geometry is redrawn here directly (kept in sync by hand with
 * proceduralTextures.ts's own version; both are simple enough that this is
 * low risk). */
async function buildAsphaltPhotoTexture(kind: 'local' | 'arterial', photo: HTMLImageElement): Promise<CanvasTexture> {
  const texW = 256
  const texH = 512
  const canvas = document.createElement('canvas')
  canvas.width = texW
  canvas.height = texH
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const pattern = ctx.createPattern(photo, 'repeat')
  if (pattern) {
    const tileTimes = 5 // repeats of the photo tile across the canvas width
    const scale = texW / (photo.width / tileTimes)
    ctx.save()
    ctx.scale(scale, scale)
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, texW / scale, texH / scale)
    ctx.restore()
  } else {
    ctx.fillStyle = '#2e3034'
    ctx.fillRect(0, 0, texW, texH)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, texW, texH)

  const edgeInset = texW * 0.035
  const lineW = Math.max(2, texW * 0.018)
  ctx.strokeStyle = '#e9e6d8'
  ctx.lineWidth = lineW
  ctx.beginPath()
  ctx.moveTo(edgeInset, 0)
  ctx.lineTo(edgeInset, texH)
  ctx.moveTo(texW - edgeInset, 0)
  ctx.lineTo(texW - edgeInset, texH)
  ctx.stroke()

  const drawDashed = (x: number) => {
    const dash = texH / 10
    ctx.beginPath()
    for (let y = 0; y < texH; y += dash * 2) {
      ctx.moveTo(x, y)
      ctx.lineTo(x, Math.min(texH, y + dash))
    }
    ctx.stroke()
  }
  if (kind === 'arterial') {
    const cx = texW / 2
    ctx.strokeStyle = '#f2e9a8'
    ctx.lineWidth = lineW * 0.9
    ctx.beginPath()
    ctx.moveTo(cx - lineW * 1.4, 0)
    ctx.lineTo(cx - lineW * 1.4, texH)
    ctx.moveTo(cx + lineW * 1.4, 0)
    ctx.lineTo(cx + lineW * 1.4, texH)
    ctx.stroke()
    ctx.strokeStyle = '#d8d4c4'
    ctx.lineWidth = lineW * 0.6
    drawDashed(edgeInset + (texW - 2 * edgeInset) * 0.25)
    drawDashed(edgeInset + (texW - 2 * edgeInset) * 0.75)
  } else {
    ctx.strokeStyle = '#f2e9a8'
    ctx.lineWidth = lineW
    drawDashed(texW / 2)
  }

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function windowOverlayFor(kind: 'midrise' | 'housing' | 'stone') {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, w, h)
    const winColor = kind === 'housing' ? '#171b20' : '#14181d'
    const frame = kind === 'stone' ? '#efe6d2' : 'rgba(0,0,0,0.4)'
    const x = w * (kind === 'stone' ? 0.22 : kind === 'housing' ? 0.2 : 0.14)
    const y = h * (kind === 'stone' ? 0.2 : kind === 'housing' ? 0.22 : 0.16)
    const ww = w * (kind === 'stone' ? 0.56 : kind === 'housing' ? 0.6 : 0.72)
    const wh = h * (kind === 'stone' ? 0.5 : kind === 'housing' ? 0.42 : 0.6)
    ctx.fillStyle = winColor
    ctx.fillRect(x, y, ww, wh)
    ctx.strokeStyle = frame
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, ww, wh)
  }
}

export function upgradeToPhotoTextures(terrain: TerrainResult, roads: RoadsResult, buildings: BuildingsResult, onReady: () => void) {
  // Ground: fine mesh (near, walked-on) gets the lush lawn; the far coarse
  // backdrop gets the slightly different leafy-grass tone for a touch of
  // natural variation between the two LODs instead of one flat repeat.
  void swapDiffuse(terrain.fineMaterial, PHOTO_TEXTURES.grassLawn, 1, 1, onReady)
  void swapDiffuse(terrain.coarseMaterial, PHOTO_TEXTURES.leafyGrass, 1, 1, onReady)

  void swapDiffuse(roads.matSidewalk, PHOTO_TEXTURES.concrete, 1, 1, onReady)

  void (async () => {
    const photo = await loadImage(PHOTO_TEXTURES.asphalt.diffuse)
    if (!photo) return
    const [localTex, arterialTex] = await Promise.all([buildAsphaltPhotoTexture('local', photo), buildAsphaltPhotoTexture('arterial', photo)])
    const oldLocal = roads.matLocal.map
    const oldArt = roads.matArterial.map
    roads.matLocal.map = localTex
    roads.matArterial.map = arterialTex
    roads.matLocal.needsUpdate = true
    roads.matArterial.needsUpdate = true
    oldLocal?.dispose()
    oldArt?.dispose()
    onReady()
  })()

  const wallSwap = (mat: MeshStandardMaterial, set: DiffuseNormalPair, kind: 'midrise' | 'housing' | 'stone') =>
    swapWallDiffuse(mat, set, windowOverlayFor(kind), onReady)
  void wallSwap(buildings.wallMaterials.midrise, PHOTO_TEXTURES.brick, 'midrise')
  void wallSwap(buildings.wallMaterials.housing, PHOTO_TEXTURES.plaster, 'housing')
  void wallSwap(buildings.wallMaterials.stone, PHOTO_TEXTURES.plaster, 'stone')

  void swapDiffuse(buildings.roofMaterial, PHOTO_TEXTURES.bitumen, 1, 1, onReady)
}
