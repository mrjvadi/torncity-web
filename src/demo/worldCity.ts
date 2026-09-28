// Entry point for /v2/world-city.html — the standalone demo page. Owns
// nothing from the game's own React app (src/App.tsx, src/api/client.ts):
// this fetches one static JSON file (public/world-city/city.json, written
// by the torncity repo's `worldpreview --export-city`) and hands it to
// WorldCityScene.

import { WorldCityScene } from './worldCityScene'
import type { CityExportJSON } from './cityExportTypes'

const BIOME_LABELS: Record<string, string> = {
  tropical_rainforest: 'جنگل بارانی',
  tropical_savanna: 'ساوان',
  desert: 'کویر',
  temperate_grassland: 'دشت',
  temperate_forest: 'جنگل معتدل',
  temperate_rainforest: 'جنگل بارانی معتدل',
  boreal_forest: 'جنگل سوزنی‌برگ',
  tundra: 'تندرا',
  polar_ice: 'یخ قطبی',
}

async function boot() {
  const root = document.getElementById('root')
  const loading = document.getElementById('wc-loading')
  if (!root) return

  const canvas = document.createElement('canvas')
  root.appendChild(canvas)
  const scene = new WorldCityScene(canvas)

  const ro = new ResizeObserver(() => scene.resize())
  ro.observe(root)

  let doc: CityExportJSON
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}world-city/city.json`)
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    doc = (await res.json()) as CityExportJSON
  } catch (e) {
    if (loading) loading.textContent = 'بارگذاری زمین ناموفق بود'
    console.error('[worldCity] failed to load city.json', e)
    return
  }

  const labels = await scene.load(doc)
  loading?.remove()
  renderOverlay(root, labels, doc)
}

function renderOverlay(root: HTMLElement, labels: Awaited<ReturnType<WorldCityScene['load']>>, doc: CityExportJSON) {
  const overlay = document.createElement('div')
  overlay.className = 'wc-overlay'

  const title = document.createElement('div')
  title.className = 'wc-title'
  const name = document.createElement('div')
  name.className = 'name'
  name.textContent = labels.cityName
  title.appendChild(name)
  const subParts: string[] = []
  if (labels.river) subParts.push(`کنار ${labels.river}`)
  if (labels.continent) subParts.push(`قارهٔ ${labels.continent}`)
  if (subParts.length > 0) {
    const sub = document.createElement('div')
    sub.className = 'sub'
    sub.textContent = subParts.join(' · ')
    title.appendChild(sub)
  }
  overlay.appendChild(title)

  if (labels.legend.length > 0) {
    const legend = document.createElement('div')
    legend.className = 'wc-legend'
    for (const item of labels.legend) {
      const row = document.createElement('div')
      row.className = 'row'
      const swatch = document.createElement('span')
      swatch.className = 'swatch'
      swatch.style.background = `#${item.colorHex}`
      const text = document.createElement('span')
      text.textContent = BIOME_LABELS[item.label] ?? item.label
      row.appendChild(text)
      row.appendChild(swatch)
      legend.appendChild(row)
    }
    overlay.appendChild(legend)
  }

  const hint = document.createElement('div')
  hint.className = 'wc-hint'
  hint.textContent = `seed ${doc.seed} · ${doc.city.size}×${doc.city.size} قطعه · ${doc.fineGrid.w}×${doc.fineGrid.h} ریزنقشه`
  overlay.appendChild(hint)

  root.appendChild(overlay)
}

boot()
