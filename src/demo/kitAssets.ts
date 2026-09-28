// A standalone loader for the local Kenney Starter Kit City Builder GLBs
// (public/models/*.glb) — the same "one shared texture per kit, one loaded
// template per piece, cloned for every placement" pattern
// src/three/assetCache.ts already uses for the game's own city screen,
// copied here rather than imported so this demo never pulls in the game's
// api client, asset manifest fetch or CDN model library — everything this
// page draws is a same-origin static file, nothing loads from a network
// call at runtime beyond that.

import { Color, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const BASE = `${import.meta.env.BASE_URL}models/`

// Nudge the kit's own mid-tone colormap toward white, same amount and same
// reason cityEngine.ts's assetCache does: this kit was modelled for a game
// that lights it however it likes, and the owner's bright pastel look reads
// right once every material is lightened rather than left as-authored.
const TINT = new Color(0xffffff)
function lighten(m: MeshStandardMaterial): void {
  m.color.lerp(TINT, 0.32)
}

let sharedTexture: Texture | null = null
const cache = new Map<string, Promise<Group | null>>()

async function loadTemplate(name: string): Promise<Group | null> {
  try {
    const gltf = await loader.loadAsync(`${BASE}${name}.glb`)
    const root = gltf.scene
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[]
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        if (!(m instanceof MeshStandardMaterial)) continue
        if (sharedTexture) {
          if (m.map && m.map !== sharedTexture) m.map.dispose()
          m.map = sharedTexture
          m.needsUpdate = true
        } else if (m.map) {
          sharedTexture = m.map
        }
        lighten(m)
      }
    })
    return root
  } catch (e) {
    console.warn('[worldCity] kit model failed to load', name, e)
    return null
  }
}

function getTemplate(name: string): Promise<Group | null> {
  let p = cache.get(name)
  if (!p) {
    p = loadTemplate(name)
    cache.set(name, p)
  }
  return p
}

/** A cloned instance of a kit piece: shares geometry and material with every
 * other clone, so drawing a hundred of one model costs one GPU upload. */
export async function cloneKitModel(name: string): Promise<Group | null> {
  const template = await getTemplate(name)
  return template ? template.clone(true) : null
}

/** The first mesh's geometry+material inside a loaded template — for
 * building one InstancedMesh out of many repeats of the same piece (roads,
 * trees, lamp posts): one draw call no matter how many instances. */
export async function kitGeometry(name: string): Promise<{ geometry: BufferGeometry; material: Material } | null> {
  const template = await getTemplate(name)
  if (!template) return null
  let found: Mesh | null = null
  template.traverse((obj) => {
    if (!found && (obj as Mesh).isMesh) found = obj as Mesh
  })
  if (!found) return null
  const mesh = found as Mesh
  return { geometry: mesh.geometry, material: mesh.material as Material }
}

export function disposeKitAssets(): void {
  cache.clear()
  sharedTexture?.dispose()
  sharedTexture = null
}
