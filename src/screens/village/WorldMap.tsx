// The world map mode of the city screen (docs/ui/web-structure.md section 3.5). The globe button of the city
// screen opens it: the camera rises high above the planet, the player pans and zooms anywhere, the terrain
// streams in as the view moves, and the cities stand on it as markers. A marker opens a small card; the list
// (a centred popup on a phone, a docked panel on a desktop) flies the camera straight to a city. The home
// button (the globe's other face) and the H key fly back to the player's own city.
//
// All the 3D lives in village/worldMapView.ts and village/worldMapTerrain.ts; this file is the markers, the
// card, the list and the keys. The city scene sleeps while this is open.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Emboss } from '../../kit'
import Popup from '../../ui/Popup'
import { useChrome } from '../../ui/v6/chrome'
import { t } from '../../i18n'
import { money } from '../native/kit/format'
import * as api from '../../api/client'
import { decodeChunk } from '../../village/chunk'
import type { WorldMapView } from '../../village/worldMapView'
import type { WorldInfo } from '../../api/types'
import type { MapView } from '../../api/views.gen'
import { report } from '../../lib/reporter'
import { biomeName, climateBand, coordText, niceScale, regionProvider } from './worldMapInfo'
import type { PlanetTerrain, TileInfo } from '../../village/worldMapTerrain'
import { latLonToDir } from '../../village/geo'
import './worldMap.css'

export interface MapHome { id: string; name: string; lat: number; lon: number }

interface Place {
  id: string
  code: string
  name: string
  lat: number
  lon: number
  kind: 'home' | 'central' | 'city'
  km?: number
  fare?: number
  wait?: number
  sid?: string
  located: boolean
}

const ENTER_ALT = 2400
const CITY_ALT = 24

const waitText = (sec: number) => (sec >= 5400 ? t('wm.hour', { n: String(Math.round(sec / 360) / 10) }) : t('wm.min', { n: String(Math.max(1, Math.round(sec / 60))) }))
const kmText = (km: number) => String(Math.round(km))


const EQ_W = 256, EQ_H = 128

/** The whole planet as a small equirectangular colour map, read once from the coarse chunks (LOD 1). */
function buildEquirect(terrain: PlanetTerrain): Uint8ClampedArray {
  const out = new Uint8ClampedArray(EQ_W * EQ_H * 3)
  for (let j = 0; j < EQ_H; j++) {
    for (let i = 0; i < EQ_W; i++) {
      const tl = terrain.sample(90 - ((j + 0.5) / EQ_H) * 180, -180 + ((i + 0.5) / EQ_W) * 360, 1)
      const k = (j * EQ_W + i) * 3
      out[k] = tl?.rgb[0] ?? 30; out[k + 1] = tl?.rgb[1] ?? 80; out[k + 2] = tl?.rgb[2] ?? 130
    }
  }
  return out
}

/** The inset globe: the planet seen from above the view centre, a ring for what the view covers, a dot for the player's city. */
function drawMini(cv: HTMLCanvasElement, eq: Uint8ClampedArray, v: WorldMapView, home: { lat: number; lon: number }, alt: number, R: number) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const S = cv.width, r = S / 2 - 3
  const { f, n } = v.frameVectors()
  const e = [n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2], n[0] * f[1] - n[1] * f[0]] // east = n x f
  const img = ctx.createImageData(S, S)
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5 - S / 2) / r, y = (S / 2 - py - 0.5) / r
      const d2 = x * x + y * y
      if (d2 > 1) continue
      const z = Math.sqrt(1 - d2)
      const dx = f[0] * z + e[0] * x + n[0] * y, dy = f[1] * z + e[1] * x + n[1] * y, dz = f[2] * z + e[2] * x + n[2] * y
      const lat = Math.asin(Math.max(-1, Math.min(1, dz))), lon = Math.atan2(dy, dx)
      const ei = Math.min(EQ_W - 1, Math.floor(((lon / Math.PI + 1) / 2) * EQ_W)), ej = Math.min(EQ_H - 1, Math.floor((0.5 - lat / Math.PI) * EQ_H))
      const k = (ej * EQ_W + ei) * 3, o = (py * S + px) * 4
      const shade = 0.55 + 0.45 * z
      img.data[o] = eq[k] * shade; img.data[o + 1] = eq[k + 1] * shade; img.data[o + 2] = eq[k + 2] * shade; img.data[o + 3] = 255
    }
  }
  ctx.clearRect(0, 0, S, S)
  ctx.putImageData(img, 0, 0)
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath(); ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2); ctx.stroke()
  // what the view covers
  const cp = v.compass()
  const half = Math.min(Math.PI / 2, (cp.kmPerPx * Math.min(v.canvasSize().w, v.canvasSize().h)) / 2 / R)
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath(); ctx.arc(S / 2, S / 2, Math.max(5, r * Math.sin(half)), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // the player's city: a gold dot, or a faint one on the rim when it is on the far side
  const h = latLonToDir(home.lat, home.lon)
  const hx = h[0] * e[0] + h[1] * e[1] + h[2] * e[2], hy = h[0] * n[0] + h[1] * n[1] + h[2] * n[2], hz = h[0] * f[0] + h[1] * f[1] + h[2] * f[2]
  let px = hx, py = hy, a = 1
  if (hz < 0) { const l = Math.hypot(hx, hy) || 1; px = hx / l; py = hy / l; a = 0.45 }
  ctx.globalAlpha = a
  ctx.fillStyle = '#ffc928'; ctx.strokeStyle = '#4a2f00'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(S / 2 + px * r, S / 2 - py * r, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.globalAlpha = 1
  void alt
}

const gcKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }, R: number) => {
  const p = latLonToDir(a.lat, a.lon), q = latLonToDir(b.lat, b.lon)
  return Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) * R
}

interface Readout { lat: number; lon: number; tile: TileInfo | null; near: { name: string; km: number } | null; region: string }
const MINI_ALT = 5000

/** M opens or closes the map, H (inside it) goes home; only when no text field or popup has the keyboard. */
export function useWorldMapKeys(enabled: boolean, mapOn: boolean, toggle: () => void, home: () => void) {
  const ref = useRef({ mapOn, toggle, home })
  ref.current = { mapOn, toggle, home }
  useEffect(() => {
    if (!enabled) return
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tg = e.target as HTMLElement | null
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return
      if (e.code === 'KeyM' && !document.querySelector('.pp-overlay:not(.wm-pop)')) { e.preventDefault(); e.stopImmediatePropagation(); ref.current.toggle(); return }
      if (e.code === 'KeyH' && ref.current.mapOn) { e.preventDefault(); ref.current.home() }
    }
    // capture: the shell's own M (the city tab) must not also fire while the city screen is up
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [enabled])
}

interface Props {
  world: WorldInfo
  home: MapHome
  /** the city screen's `run` (opens the travel screen) */
  run: (command: string, args?: Record<string, string>) => void
  openLocal: (name: string, args?: Record<string, string>) => void
  /** the map has finished leaving; the city screen takes over */
  onLeft: () => void
  /** asks to leave (the map flies home first) */
  leaveRef: { current: (() => void) | null }
}

export default function WorldMap({ world, home, run, openLocal, onLeft, leaveRef }: Props) {
  const chrome = useChrome()
  const desktop = !!chrome?.desktop
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<WorldMapView | null>(null)
  const markerRefs = useRef(new Map<string, HTMLButtonElement>())
  const chipRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [oblique, setOblique] = useState(false)
  const [dests, setDests] = useState<Place[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [bottomInset, setBottomInset] = useState(8)
  const [topInset, setTopInset] = useState(0)
  const [spot, setSpot] = useState<{ lat: number; lon: number } | null>(null)
  const spotRef = useRef(spot)
  spotRef.current = spot
  const [read, setRead] = useState<Readout | null>(null)
  const arrowRef = useRef<HTMLButtonElement | null>(null)
  const arrowTxt = useRef<HTMLSpanElement | null>(null)
  const arrowIcon = useRef<HTMLSpanElement | null>(null)
  const compassRef = useRef<HTMLSpanElement | null>(null)
  const scaleBar = useRef<HTMLSpanElement | null>(null)
  const scaleTxt = useRef<HTMLSpanElement | null>(null)
  const miniRef = useRef<HTMLCanvasElement | null>(null)
  const miniWrap = useRef<HTMLButtonElement | null>(null)
  const spotMk = useRef<HTMLDivElement | null>(null)
  const equi = useRef<Uint8ClampedArray | null>(null)
  const insetsRef = useRef({ top: 0, bottom: 0 })
  const lastRead = useRef({ at: 0, key: '' })
  const [viewAlt, setViewAlt] = useState(ENTER_ALT)
  const lastMini = useRef({ at: 0, lat: 999, lon: 999, alt: 0 })

  const homePlace = useMemo<Place>(() => ({ id: 'home:' + home.id, code: 'home', name: home.name, lat: home.lat, lon: home.lon, kind: 'home', sid: home.id, located: true }), [home.id, home.name, home.lat, home.lon])
  const places = useMemo(() => [homePlace, ...dests.filter((d) => d.sid !== home.id)], [homePlace, dests, home.id])
  const placesRef = useRef(places)
  const homeRef = useRef({ lat: home.lat, lon: home.lon })
  homeRef.current = { lat: home.lat, lon: home.lon }
  placesRef.current = places

  // the other cities (the travel list, every page)
  useEffect(() => {
    let off = false
    void (async () => {
      const out: Place[] = []
      for (let page = 1; page <= 8; page++) {
        try {
          const r = await api.runCommand('map.cities', { page: String(page) })
          const v = r.view as MapView | undefined
          if (r.ok === false || !v) break
          for (const d of v.destinations ?? []) {
            if (out.some((o) => o.id === d.code)) continue
            const central = d.code === 'support'
            out.push({
              id: d.code, code: d.code, name: central ? t('wm.central') : d.name, lat: d.lat, lon: d.lon, kind: central ? 'central' : 'city',
              km: d.distance_km, fare: d.fare, wait: d.wait_seconds, sid: d.settlement_id || undefined, located: !(d.lat === 0 && d.lon === 0),
            })
          }
          if (page >= (v.pages || 1)) break
        } catch { break }
      }
      if (!off) setDests(out)
    })()
    return () => { off = true }
  }, [])

  // the 3D view
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let ro: ResizeObserver | null = null
    let view: WorldMapView | null = null
    void import('../../village/worldMapView').then(({ WorldMapView }) => {
      if (cancelled) return
      try {
        view = new WorldMapView(canvas, world, async (f, l, x, y) => decodeChunk(await api.getChunkBytes(f, l, x, y)))
      } catch (e) {
        report('worldmap', 'view failed: ' + String(e))
        setFailed(true)
        return
      }
      viewRef.current = view
      view.onFrame = () => {
        const v = view!
        // markers follow the globe
        const taken: { x: number; y: number }[] = []
        const order = [...placesRef.current].sort((a, b) => (a.kind === 'home' ? 0 : 1) - (b.kind === 'home' ? 0 : 1))
        for (const p of order) {
          const el = markerRefs.current.get(p.id)
          if (!el) continue
          if (!p.located) { el.style.display = 'none'; continue }
          const pt = v.project(p.lat, p.lon)
          if (!pt.visible) { el.style.display = 'none'; continue }
          el.style.display = ''
          el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`
          // a label that would sit on another city's label gives way
          const clash = taken.some((o) => Math.abs(o.x - pt.x) < 78 && Math.abs(o.y - pt.y) < 20)
          el.classList.toggle('wm-nolbl', clash)
          if (!clash) taken.push(pt)
        }
        const st = v.state()
        if (chipRef.current) chipRef.current.textContent = t('wm.alt', { km: String(Math.round(st.alt)) })
        const now = performance.now()
        // compass and scale bar follow the camera
        const cp = v.compass()
        if (compassRef.current) compassRef.current.style.transform = `rotate(${(-cp.deg).toFixed(1)}deg)`
        if (scaleBar.current && scaleTxt.current) {
          const sc = niceScale(cp.kmPerPx, 110)
          scaleBar.current.style.width = `${Math.max(8, sc.px).toFixed(0)}px`
          const txt = t('wm.scale', { km: String(sc.km >= 1 ? Math.round(sc.km) : sc.km) })
          if (scaleTxt.current.textContent !== txt) scaleTxt.current.textContent = txt
        }
        // "you are here": an arrow on the edge of the view when the city is out of sight
        const hp = homeRef.current
        const cv = canvasRef.current
        if (arrowRef.current && cv) {
          const w = cv.clientWidth, h = cv.clientHeight, ins = insetsRef.current
          const pt = v.project(hp.lat, hp.lon)
          const inside = pt.visible && pt.x > 18 && pt.x < w - 18 && pt.y > ins.top + 18 && pt.y < h - ins.bottom - 18
          if (inside) arrowRef.current.style.display = 'none'
          else {
            const b = v.bearingOnScreen(hp.lat, hp.lon)
            const cx = w / 2, cy = ins.top + (h - ins.top - ins.bottom) / 2
            const mx = 34, my = 34
            const kx = b.x === 0 ? Infinity : (b.x > 0 ? (w - mx - cx) : (mx - cx)) / b.x
            const ky = b.y === 0 ? Infinity : (b.y > 0 ? (h - ins.bottom - my - cy) : (ins.top + my - cy)) / b.y
            const k = Math.min(kx, ky)
            arrowRef.current.style.display = ''
            arrowRef.current.style.transform = `translate(${(cx + b.x * k).toFixed(1)}px, ${(cy + b.y * k).toFixed(1)}px)`
            if (arrowIcon.current) arrowIcon.current.style.transform = `rotate(${(Math.atan2(b.x, -b.y) * 180 / Math.PI).toFixed(1)}deg)`
            const txt = t('wm.arrow', { km: String(Math.round(v.distanceKm(hp.lat, hp.lon))) })
            if (arrowTxt.current && arrowTxt.current.textContent !== txt) arrowTxt.current.textContent = txt
          }
        }
        // a tapped spot keeps its cross on the ground
        if (spotMk.current) {
          const sp = spotRef.current
          const pt = sp ? v.project(sp.lat, sp.lon) : null
          if (pt && pt.visible) { spotMk.current.style.display = ''; spotMk.current.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)` } else spotMk.current.style.display = 'none'
        }
        // the readout and the minimap, a few times a second
        if (now - lastRead.current.at > 280) {
          lastRead.current.at = now
          const at = spotRef.current ?? { lat: st.lat, lon: st.lon }
          const tile = v.terrain.sample(at.lat, at.lon)
          let near: Readout['near'] = null
          for (const p of placesRef.current) {
            if (!p.located) continue
            const km = gcKm(at, p, world.planet_radius_km)
            if (!near || km < near.km) near = { name: p.kind === 'home' ? p.name : p.name, km }
          }
          const key = `${at.lat.toFixed(2)},${at.lon.toFixed(2)},${tile?.lod ?? -1},${near?.name},${Math.round(Math.log(st.alt) * 8)}`
          if (key !== lastRead.current.key) {
            lastRead.current.key = key
            setViewAlt(st.alt)
            setRead({ lat: at.lat, lon: at.lon, tile, near, region: regionProvider.at(at.lat, at.lon)?.name ?? '' })
          }
        }
        if (miniRef.current && st.alt < MINI_ALT) {
          v.terrain.wantOverview()
          if (!equi.current && v.terrain.overviewReady()) equi.current = buildEquirect(v.terrain)
          const lm = lastMini.current
          if (equi.current && (now - lm.at > 220) && (Math.abs(lm.lat - st.lat) > 0.3 || Math.abs(lm.lon - st.lon) > 0.3 || Math.abs(lm.alt - st.alt) > st.alt * 0.05)) {
            lastMini.current = { at: now, lat: st.lat, lon: st.lon, alt: st.alt }
            drawMini(miniRef.current, equi.current, v, hp, st.alt, world.planet_radius_km)
          }
        }
        if (!readyRef.current && v.terrain.stats().shown > 0) { readyRef.current = true; setReady(true) }
      }
      view.onTap = (x, y) => { setSel(null); const p = view!.pick(x, y); if (p) setSpot(p) }
      view.onUser = () => undefined
      ro = new ResizeObserver(() => view?.resize())
      ro.observe(canvas)
      view.resize()
      // start low over the city, rise to the view of the region
      view.setView(home.lat, home.lon, 14)
      view.flyTo(home.lat, home.lon, ENTER_ALT)
      if (import.meta.env.DEV || new URLSearchParams(location.search).get('mock') === '1' || new URLSearchParams(location.search).has('stats')) {
        ;(window as unknown as { __worldmap?: unknown }).__worldmap = view
      }
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      view?.dispose()
      viewRef.current = null
      readyRef.current = false
      const w = window as unknown as { __worldmap?: unknown }
      if (w.__worldmap === view) delete w.__worldmap
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world])
  const readyRef = useRef(false)

  // the shell's HUD and dock cover the top and bottom of the canvas: the globe is centred in what is left
  useEffect(() => {
    const sync = () => {
      const v = viewRef.current, cv = canvasRef.current
      if (!cv) return
      const r = cv.getBoundingClientRect()
      let top = 0, bottom = 0
      if (chrome && !chrome.desktop) {
        const hud = chrome.hud(), bot = chrome.bottom()
        if (hud) top = Math.max(0, hud.bottom - r.top)
        if (bot) bottom = Math.max(0, r.bottom - bot.top)
      }
      v?.setInsets(top, bottom)
      insetsRef.current = { top, bottom }
      setBottomInset(bottom + 8)
      setTopInset(top)
    }
    sync()
    const off = chrome?.subscribe(sync)
    const id = window.setInterval(sync, 700) // the view appears a moment after this effect
    return () => { off?.(); window.clearInterval(id) }
  }, [chrome, ready])

  const goHome = useCallback(() => {
    const v = viewRef.current
    setSel(null); setListOpen(false)
    if (!v || leaving) { onLeft(); return }
    setLeaving(true)
    v.flyTo(home.lat, home.lon, 14, () => window.setTimeout(onLeft, 260))
  }, [home.lat, home.lon, leaving, onLeft])
  leaveRef.current = goHome

  const flyTo = useCallback((p: Place) => {
    if (!p.located) return
    setSel(p.id)
    setListOpen(false)
    viewRef.current?.flyTo(p.lat, p.lon, CITY_ALT)
  }, [])

  // keys: arrows pan, + and - zoom, Escape closes the card or the list
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return
      const v = viewRef.current
      if (!v || e.ctrlKey || e.metaKey || e.altKey) return
      const step = 90
      if (e.key === 'ArrowLeft') v.panBy(step, 0)
      else if (e.key === 'ArrowRight') v.panBy(-step, 0)
      else if (e.key === 'ArrowUp') v.panBy(0, step)
      else if (e.key === 'ArrowDown') v.panBy(0, -step)
      else if (e.key === '+' || e.key === '=') v.zoomBy(0.7)
      else if (e.key === '-' || e.key === '_') v.zoomBy(1.4)
      else if (e.key === 'Escape') { if (sel) setSel(null); else if (listOpen) setListOpen(false) }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel, listOpen])

  // the eye button of the city screen asks for the tilted view here
  useEffect(() => {
    const on = () => { const v = viewRef.current; if (!v) return; v.setOblique(!v.isOblique()); setOblique(v.isOblique()) }
    window.addEventListener('tc:maptilt', on)
    return () => window.removeEventListener('tc:maptilt', on)
  }, [])
  useEffect(() => { window.dispatchEvent(new CustomEvent('tc:maptilt-state', { detail: oblique })) }, [oblique])

  const selPlace = places.find((p) => p.id === sel) ?? null
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places.filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [places, query])

  const list = (
    <div className="wm-list">
      <input className="wm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('wm.list.search')} aria-label={t('wm.list.search')} />
      <div className="wm-rows">
        {shown.map((p) => (
          <button key={p.id} type="button" className={`wm-row${p.id === sel ? ' on' : ''}`} onClick={() => (p.kind === 'home' ? goHome() : flyTo(p))} disabled={!p.located}>
            <span className={`wm-rowdot ${p.kind}`}>{p.kind === 'home' && <Emboss name="house" palette="gold" size={16} />}</span>
            <span className="wm-rowname">{p.name}</span>
            <span className="wm-rowkm">{p.kind === 'home' ? t('wm.here') : p.km !== undefined ? t('wm.km', { km: kmText(p.km) }) : ''}</span>
          </button>
        ))}
        {shown.length === 0 && <div className="wm-empty">{places.length <= 1 && !query ? t('wm.list.none') : t('wm.list.empty')}</div>}
      </div>
    </div>
  )

  return (
    <div style={{ '--wm-top': `${topInset}px`, '--wm-bot': `${bottomInset}px` } as React.CSSProperties} className={`wm${ready ? ' wm-in' : ''}${leaving ? ' wm-out' : ''}${desktop ? ' wm-desk' : ''}`}>
      <canvas ref={canvasRef} className="wm-canvas" />

      <div className="wm-markers">
        {places.map((p) => (
          <button
            key={p.id} type="button" ref={(el) => { if (el) markerRefs.current.set(p.id, el); else markerRefs.current.delete(p.id) }}
            className={`wm-mk ${p.kind}${p.id === sel ? ' sel' : ''}`} style={{ display: 'none' }}
            onClick={(e) => { e.stopPropagation(); setSel(p.id) }}
            aria-label={p.name}
          >
            <span className="wm-dot">{p.kind === 'home' && <Emboss name="house" palette="gold" size={18} />}</span>
            <span className="wm-lbl">{p.kind === 'home' ? t('wm.you_here') + ' · ' + p.name : p.name}</span>
          </button>
        ))}
      </div>

      <button type="button" className="wm-arrow" ref={arrowRef} style={{ display: 'none' }} onClick={() => { const v = viewRef.current; if (v) v.flyTo(home.lat, home.lon, Math.min(v.state().alt, 3000)) }} aria-label={t('wm.you_here')}>
        <span className="wm-arrow-ic" ref={arrowIcon}><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#ffc928" stroke="#4a2f00" strokeWidth="1.8" strokeLinejoin="round" /></svg></span>
        <span className="wm-arrow-txt" ref={arrowTxt} />
      </button>

      <div className="wm-spot" ref={spotMk} style={{ display: 'none' }} aria-hidden>✕</div>

      <div className="wm-info" aria-live="polite">
        <span className="wm-compass" title={t('wm.north')}><span ref={compassRef}><svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="11" fill="rgba(7,10,20,0.6)" stroke="rgba(255,255,255,0.4)" /><path d="M12 3 L16 13 L12 11.5 L8 13 Z" fill="#ff5a4a" /><path d="M12 21 L16 13 L12 11.5 L8 13 Z" fill="#dfe4ff" /></svg></span></span>
        <span className="wm-info-txt">
          {read && (
            <>
              <span className="wm-info-l1">
                <b>{spot ? t('wm.spot') : t('wm.centre')}</b>
                <span>{coordText(read.lat, read.lon)}</span>
              </span>
              {read.region && <span className="wm-info-l2">{read.region}</span>}
              <span className="wm-info-l2">
                {[
                  read.tile ? biomeName(read.tile.biomeCode) : '',
                  climateBand(read.lat),
                  read.tile ? (read.tile.ocean ? t('wm.depth', { m: String(Math.max(0, Math.round(-read.tile.elev))) }) : t('wm.height', { m: String(Math.round(read.tile.elev)) })) : '',
                  read.tile && !read.tile.ocean && read.tile.tileKm <= 20 ? (read.tile.coast ? t('wm.coast') : t('wm.inland')) : '',
                ].filter(Boolean).join(' · ')}
              </span>
              {read.near && <span className="wm-info-l2">{t('wm.nearest', { name: read.near.name, km: kmText(read.near.km) })}</span>}
            </>
          )}
          <span className="wm-chip" ref={chipRef} />
        </span>
        {spot && <button type="button" className="wm-x wm-info-x" onClick={() => setSpot(null)} aria-label={t('wm.spot_clear')}>✕</button>}
      </div>

      <div className="wm-scale"><span className="wm-scale-bar" ref={scaleBar} /><span ref={scaleTxt} /></div>

      <button type="button" className="wm-mini" ref={miniWrap} onClick={() => { const v = viewRef.current; if (v) { const st = v.state(); v.flyTo(st.lat, st.lon, world.planet_radius_km * 3) } }} aria-label={t('wm.mini')}
        style={{ display: (read && viewAlt < MINI_ALT) ? '' : 'none' }}>
        <canvas ref={miniRef} width={176} height={176} />
      </button>

      <div className="wm-tools">
        <button type="button" className="k-hdr-btn" onClick={() => setListOpen((o) => !o)} aria-label={t('wm.btn.list')} aria-pressed={listOpen}><Emboss name="m_search" palette="gold" size={22} /></button>
        {desktop && (
          <>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(0.6)} aria-label={t('wm.btn.zoom_in')}>+</button>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(1.6)} aria-label={t('wm.btn.zoom_out')}>−</button>
          </>
        )}
      </div>

      {selPlace && !listOpen && (
        <div className="wm-card" style={desktop ? undefined : { bottom: bottomInset }} role="dialog" aria-label={selPlace.name}>
          <div className="wm-card-head">
            <span className={`wm-rowdot ${selPlace.kind}`}>{selPlace.kind === 'home' && <Emboss name="house" palette="gold" size={16} />}</span>
            <div className="wm-card-title">
              <b>{selPlace.name}</b>
              <small>{selPlace.kind === 'home' ? t('wm.here') : selPlace.kind === 'central' ? '' : t('wm.city')}</small>
            </div>
            <button type="button" className="wm-x" onClick={() => setSel(null)} aria-label={t('wm.close')}>✕</button>
          </div>
          {selPlace.kind !== 'home' && (
            <div className="wm-card-facts">
              {selPlace.km !== undefined && <span>{t('wm.km', { km: kmText(selPlace.km) })}</span>}
              {selPlace.fare !== undefined && <span>{t('wm.fare', { fare: money(selPlace.fare) })}</span>}
              {selPlace.wait !== undefined && <span>{t('wm.wait', { t: waitText(selPlace.wait) })}</span>}
            </div>
          )}
          <div className="wm-card-acts">
            {selPlace.kind === 'home' ? (
              <button type="button" className="wm-btn gold" onClick={goHome}>{t('wm.home_go')}</button>
            ) : (
              <>
                <button type="button" className="wm-btn gold" onClick={() => flyTo(selPlace)} disabled={!selPlace.located}>{t('wm.go')}</button>
                {selPlace.sid && <button type="button" className="wm-btn" onClick={() => { onLeftSilently(); openLocal('village_visit', { id: selPlace.sid! }) }}>{t('wm.visit')}</button>}
                <button type="button" className="wm-btn" onClick={() => { onLeftSilently(); run('travel.options', { city: selPlace.code }) }}>{t('wm.travel')}</button>
              </>
            )}
          </div>
        </div>
      )}

      {listOpen && (desktop ? (
        <aside className="wm-dock" aria-label={t('wm.list.title')}>
          <div className="wm-dock-head"><b>{t('wm.list.title')}</b><button type="button" className="wm-x" onClick={() => setListOpen(false)} aria-label={t('wm.close')}>✕</button></div>
          {list}
        </aside>
      ) : (
        <Popup open title={t('wm.list.title')} tone="navy" onClose={() => setListOpen(false)}>{list}</Popup>
      ))}

      {!ready && !failed && <div className="wm-load">{t('wm.loading')}</div>}
      {failed && <div className="wm-load">{t('wm.failed')}</div>}
    </div>
  )

  // a travel or visit screen opens over the city: the map closes without the flight home
  function onLeftSilently() { onLeft() }
}
