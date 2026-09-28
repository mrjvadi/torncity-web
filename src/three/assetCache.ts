// Loads the city's art once and shares it: one GLTFLoader, one texture per
// Kenney kit (every kit's GLBs embed their own copy of the same colour map),
// and one loaded mesh template per key, cloned (geometry/material shared)
// for every placement. This is what keeps an iPhone from running out of
// memory on a city full of buildings.

import { Color, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material, type Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getAssetManifest, getModelLibrary, assetUrl } from '../api/client'
import type { AssetManifest, ModelLibrary } from '../api/types'

const loader = new GLTFLoader()

// the Kenney kit's own colormap is baked fairly mid-tone (it was made for a
// game that lights it however it likes); the prototype's own bright pastel
// look leans on that kit plus a generous bloom pass three.js's renderer
// doesn't have here, so every textured material is nudged toward white
// once, at load time — cheaper than a post-process bloom and applies
// equally whether a piece is drawn once or a thousand times via InstancedMesh.
const TINT = new Color(0xffffff)
function lighten(m: MeshStandardMaterial): void {
  m.color.lerp(TINT, 0.32)
}

let manifestPromise: Promise<AssetManifest | null> | null = null
let libraryPromise: Promise<ModelLibrary | null> | null = null
const meshCache = new Map<string, Promise<Group | null>>()
const kitTextures = new Map<string, Texture>()

export function loadManifest(): Promise<AssetManifest | null> {
  if (!manifestPromise) {
    manifestPromise = getAssetManifest().catch((e) => {
      console.warn('asset manifest failed', e)
      return null
    })
  }
  return manifestPromise
}

export async function loadModelLibrary(): Promise<ModelLibrary | null> {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      const manifest = await loadManifest()
      const entry = manifest?.assets?.['data:library']
      if (!entry) return null
      try {
        return await getModelLibrary(entry.path.startsWith('/') ? entry.path : `/assets/${entry.path}`)
      } catch (e) {
        console.warn('model library failed', e)
        return null
      }
    })()
  }
  return libraryPromise
}

function kitOf(meshKey: string): string {
  return meshKey.includes('/') ? meshKey.split('/')[0] : meshKey
}

/** Load (once) the GLB for a mesh key ("kit/name"), sharing one texture per kit. */
async function loadMeshTemplate(meshKey: string): Promise<Group | null> {
  const manifest = await loadManifest()
  const entry = manifest?.assets?.[`mesh:${meshKey}`]
  if (!entry) return null
  try {
    const gltf = await loader.loadAsync(assetUrl(entry.path))
    const root = gltf.scene
    const kit = kitOf(meshKey)
    const shared = kitTextures.get(kit)
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[]
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        if (!(m instanceof MeshStandardMaterial)) continue
        if (shared) {
          if (m.map && m.map !== shared) m.map.dispose()
          m.map = shared
          m.needsUpdate = true
        } else if (m.map) {
          kitTextures.set(kit, m.map)
        }
        lighten(m)
      }
    })
    return root
  } catch (e) {
    console.warn('mesh load failed', meshKey, e)
    return null
  }
}

export function getMeshTemplate(meshKey: string): Promise<Group | null> {
  let p = meshCache.get(meshKey)
  if (!p) {
    p = loadMeshTemplate(meshKey)
    meshCache.set(meshKey, p)
  }
  return p
}

/** A cloned instance of a mesh template: shares geometry and materials. */
export async function cloneMesh(meshKey: string): Promise<Group | null> {
  const template = await getMeshTemplate(meshKey)
  if (!template) return null
  return template.clone(true)
}

export function disposeAssetCache(): void {
  meshCache.clear()
  kitTextures.forEach((t) => t.dispose())
  kitTextures.clear()
  starterCache.clear()
}

// -- the local Starter Kit City Builder set (proto/art/models, CC0), served
// from our own public/models/: one shared texture for the whole kit, one
// loaded template per piece, cloned (geometry/material shared) for every
// placement. Used first, before the CDN's model library, for the shapes the
// owner's prototype itself draws this way (roads, houses, greenery).
const STARTER_BASE = `${import.meta.env.BASE_URL}models/`
const starterCache = new Map<string, Promise<Group | null>>()
let starterTexture: Texture | null = null

async function loadStarterTemplate(name: string): Promise<Group | null> {
  try {
    const gltf = await loader.loadAsync(`${STARTER_BASE}${name}.glb`)
    const root = gltf.scene
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[]
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        if (!(m instanceof MeshStandardMaterial)) continue
        if (starterTexture) {
          if (m.map && m.map !== starterTexture) m.map.dispose()
          m.map = starterTexture
          m.needsUpdate = true
        } else if (m.map) {
          starterTexture = m.map
        }
        lighten(m)
      }
    })
    return root
  } catch (e) {
    console.warn('starter kit mesh failed', name, e)
    return null
  }
}

export function getStarterTemplate(name: string): Promise<Group | null> {
  let p = starterCache.get(name)
  if (!p) {
    p = loadStarterTemplate(name)
    starterCache.set(name, p)
  }
  return p
}

/** A cloned instance of a Starter Kit piece: shares geometry and material. */
export async function cloneStarter(name: string): Promise<Group | null> {
  const template = await getStarterTemplate(name)
  return template ? template.clone(true) : null
}

/** The first mesh's geometry+material inside a loaded template, for building
 * an InstancedMesh out of a repeated piece (roads: many tiles, one draw call). */
export async function starterGeometry(name: string): Promise<{ geometry: BufferGeometry; material: Material } | null> {
  const template = await getStarterTemplate(name)
  if (!template) return null
  let found: Mesh | null = null
  template.traverse((obj) => {
    if (!found && (obj as Mesh).isMesh) found = obj as Mesh
  })
  if (!found) return null
  const mesh = found as Mesh
  return { geometry: mesh.geometry, material: mesh.material as Material }
}
