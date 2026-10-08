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
import { useChrome } from '../../ui/v6/chrome'
import { t } from '../../i18n'
import { money } from '../native/kit/format'
import * as api from '../../api/client'
import { decodeChunk } from '../../village/chunk'
import type { WorldMapView } from '../../village/worldMapView'
import type { WorldInfo } from '../../api/types'
import type { MapView } from '../../api/views.gen'
import { report } from '../../lib/reporter'
import { biomeName, climateBand, coordText, niceScale, parseCoords, regionProvider } from './worldMapInfo'
import type { TileInfo } from '../../village/worldMapTerrain'
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


const gcKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }, R: number) => {
  const p = latLonToDir(a.lat, a.lon), q = latLonToDir(b.lat, b.lon)
  return Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) * R
}

interface Readout { lat: number; lon: number; tile: TileInfo | null; near: { name: string; km: number; id: string } | null; region: string }
const LABEL_ALT = 4000
const LOCATE_ALT = 60

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

/** the chosen place never folds into a bubble */
const p2 = (p: { id: string }, sel: string | null) => p.id === sel
const CLUSTER_PX = 34
const MAP_MIN_ALT_UI = 20

export default function WorldMap({ world, home, run, openLocal, onLeft, leaveRef }: Props) {
  const chrome = useChrome()
  const desktop = !!chrome?.desktop
  const R = world.planet_radius_km
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<WorldMapView | null>(null)
  const markerRefs = useRef(new Map<string, HTMLButtonElement>())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [oblique, setOblique] = useState(false)
  const [terrainLook, setTerrainLook] = useState(false)
  const [lookHint, setLookHint] = useState('')
  const [dests, setDests] = useState<Place[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [bottomInset, setBottomInset] = useState(8)
  const [topInset, setTopInset] = useState(0)
  const [spot, setSpot] = useState<Readout | null>(null)
  const spotRef = useRef<Readout | null>(null)
  spotRef.current = spot
  const [atHome, setAtHome] = useState(true)
  const arrowRef = useRef<HTMLButtonElement | null>(null)
  const arrowTxt = useRef<HTMLSpanElement | null>(null)
  const arrowIcon = useRef<HTMLSpanElement | null>(null)
  const compassRef = useRef<HTMLSpanElement | null>(null)
  const scaleBar = useRef<HTMLSpanElement | null>(null)
  const scaleTxt = useRef<HTMLSpanElement | null>(null)
  const spotMk = useRef<HTMLDivElement | null>(null)
  const insetsRef = useRef({ top: 0, bottom: 0 })
  const clusterRefs = useRef<HTMLButtonElement[]>([])
  const clusterInfo = useRef<{ x: number; y: number; n: number; lat: number; lon: number; members: Place[] }[]>([])
  const selRef = useRef<string | null>(null)
  const atHomeRef = useRef(true)
  selRef.current = sel
  const readyRef = useRef(false)

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

  /** What is at a place: coordinates, biome, height, coast, the nearest city. */
  const readAt = useCallback((lat: number, lon: number): Readout => {
    const v = viewRef.current
    const tile = v ? v.terrain.sample(lat, lon) : null
    let near: Readout['near'] = null
    for (const p of placesRef.current) {
      if (!p.located) continue
      const km = gcKm({ lat, lon }, p, R)
      if (!near || km < near.km) near = { name: p.name, km, id: p.id }
    }
    return { lat, lon, tile, near, region: regionProvider.at(lat, lon)?.name ?? '' }
  }, [R])

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
        const st = v.state()
        // markers follow the globe; far out only the own city and the chosen one keep a name
        rootRef.current?.classList.toggle('wm-far', st.alt > LABEL_ALT)
        // markers: the own city and the chosen one always stand alone; cities that would pile up within a thumb's width
        // fold into one count bubble (a tap opens it); the labels that remain avoid each other
        const taken: { x: number; y: number; w: number }[] = []
        const order = [...placesRef.current].sort((a, b) => (a.kind === 'home' ? 0 : p2(a, selRef.current) ? 1 : 2) - (b.kind === 'home' ? 0 : p2(b, selRef.current) ? 1 : 2))
        const groups: { x: number; y: number; n: number; lat: number; lon: number; members: Place[] }[] = []
        const shown: { p: Place; pt: { x: number; y: number } }[] = []
        for (const p of order) {
          const el = markerRefs.current.get(p.id)
          if (!el) continue
          if (!p.located) { el.style.display = 'none'; continue }
          const pt = v.project(p.lat, p.lon)
          if (!pt.visible) { el.style.display = 'none'; continue }
          const alone = p.kind === 'home' || p2(p, selRef.current)
          // a city right under the own city or the chosen one is folded into it: no bubble on top of the marker that matters
          if (!alone && shown.some((q) => (q.p.kind === 'home' || p2(q.p, selRef.current)) && Math.hypot(q.pt.x - pt.x, q.pt.y - pt.y) < CLUSTER_PX)) { el.style.display = 'none'; continue }
          const g = alone ? null : groups.find((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < CLUSTER_PX)
          if (g) { g.members.push(p); g.n++; g.x = (g.x * (g.n - 1) + pt.x) / g.n; g.y = (g.y * (g.n - 1) + pt.y) / g.n; g.lat = (g.lat * (g.n - 1) + p.lat) / g.n; g.lon = (g.lon * (g.n - 1) + p.lon) / g.n; el.style.display = 'none'; continue }
          if (!alone) groups.push({ x: pt.x, y: pt.y, n: 1, lat: p.lat, lon: p.lon, members: [p] })
          shown.push({ p, pt })
        }
        // a lone city is a marker; a group of two or more is a bubble and its members stay hidden
        const bubbles = groups.filter((g) => g.n > 1)
        const folded = new Set(bubbles.flatMap((g) => g.members.map((m) => m.id)))
        for (const { p, pt } of shown) {
          const el = markerRefs.current.get(p.id)!
          if (folded.has(p.id)) { el.style.display = 'none'; continue }
          el.style.display = ''
          el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`
          const w = Math.max(60, Math.min(190, p.name.length * 7.5 + 22))
          const clash = taken.some((o) => Math.abs(o.x - pt.x) < (o.w + w) / 2 && Math.abs(o.y - pt.y) < 24)
          el.classList.toggle('wm-nolbl', clash)
          if (!clash) taken.push({ x: pt.x, y: pt.y, w })
        }
        clusterInfo.current = bubbles
        clusterRefs.current.forEach((el, i) => {
          const g = bubbles[i]
          if (!g) { el.style.display = 'none'; return }
          el.style.display = ''
          el.style.transform = `translate(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px)`
          const n = String(g.n)
          const c = el.firstElementChild as HTMLElement | null
          if (c && c.textContent !== n) c.textContent = n
        })
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
            const topEdge = ins.top + my + 56 // clear of the search box
            const kx = b.x === 0 ? Infinity : (b.x > 0 ? (w - mx - cx) : (mx - cx)) / b.x
            const ky = b.y === 0 ? Infinity : (b.y > 0 ? (h - ins.bottom - my - cy) : (topEdge - cy)) / b.y
            const k = Math.min(kx, ky)
            arrowRef.current.style.display = ''
            arrowRef.current.style.transform = `translate(${(cx + b.x * k).toFixed(1)}px, ${(cy + b.y * k).toFixed(1)}px)`
            if (arrowIcon.current) arrowIcon.current.style.transform = `rotate(${(Math.atan2(b.x, -b.y) * 180 / Math.PI).toFixed(1)}deg)`
            const txt = t('wm.arrow', { km: String(Math.round(v.distanceKm(hp.lat, hp.lon))) })
            if (arrowTxt.current && arrowTxt.current.textContent !== txt) arrowTxt.current.textContent = txt
          }
        }
        // a dropped pin keeps its place on the ground
        if (spotMk.current) {
          const sp = spotRef.current
          const pt = sp ? v.project(sp.lat, sp.lon) : null
          if (pt && pt.visible) { spotMk.current.style.display = ''; spotMk.current.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)` } else spotMk.current.style.display = 'none'
        }
        // the my-location button is lit while the view is centred on the city
        const near = v.distanceKm(hp.lat, hp.lon) < Math.max(2, st.alt * 0.06)
        if (near !== atHomeRef.current) { atHomeRef.current = near; setAtHome(near) }
        if (!readyRef.current && v.terrain.stats().shown > 0) { readyRef.current = true; setReady(true) }
      }
      view.onTap = (x, y) => {
        setSel(null); setSearchOpen(false)
        const p = view!.pick(x, y)
        if (p) setSpot(readAt(p.lat, p.lon))
      }
      view.onUser = () => setSearchOpen(false)
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
    setSel(null); setSpot(null); setSearchOpen(false)
    if (!v || leaving) { onLeft(); return }
    setLeaving(true)
    v.flyTo(home.lat, home.lon, 14, () => window.setTimeout(onLeft, 260))
  }, [home.lat, home.lon, leaving, onLeft])
  leaveRef.current = goHome

  const flyTo = useCallback((p: Place) => {
    if (!p.located) return
    setSel(p.id); setSpot(null); setSearchOpen(false); setQuery('')
    viewRef.current?.flyTo(p.lat, p.lon, CITY_ALT)
  }, [])

  const flyToSpot = useCallback((lat: number, lon: number) => {
    setSel(null); setSearchOpen(false); setQuery('')
    setSpot(readAt(lat, lon))
    viewRef.current?.flyTo(lat, lon, 40)
  }, [readAt])

  const locate = useCallback(() => {
    setSel(null); setSpot(null)
    const v = viewRef.current
    if (!v) return
    v.resetNorth(); setOblique(false)
    window.dispatchEvent(new CustomEvent('tc:maptilt-state', { detail: false }))
    v.flyTo(home.lat, home.lon, LOCATE_ALT)
  }, [home.lat, home.lon])

  const toggleLook = useCallback(() => {
    const v = viewRef.current
    if (!v) return
    const next = !terrainLook
    v.setStyle(next ? 'terrain' : 'map')
    setTerrainLook(next)
    setLookHint(t(next ? 'wm.look.terrain' : 'wm.look.map'))
    window.setTimeout(() => setLookHint(''), 1600)
  }, [terrainLook])

  const resetNorth = useCallback(() => {
    viewRef.current?.resetNorth(); setOblique(false)
    window.dispatchEvent(new CustomEvent('tc:maptilt-state', { detail: false }))
  }, [])

  // keys: arrows pan, + and - zoom, Escape closes the card or the suggestions
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) { if (e.key === 'Escape') { setSearchOpen(false); (tg as HTMLInputElement).blur() } return }
      const v = viewRef.current
      if (!v || e.ctrlKey || e.metaKey || e.altKey) return
      const step = 90
      if (e.key === 'ArrowLeft') v.panBy(step, 0)
      else if (e.key === 'ArrowRight') v.panBy(-step, 0)
      else if (e.key === 'ArrowUp') v.panBy(0, step)
      else if (e.key === 'ArrowDown') v.panBy(0, -step)
      else if (e.key === '+' || e.key === '=') v.zoomBy(0.6)
      else if (e.key === '-' || e.key === '_') v.zoomBy(1.6)
      else if (e.key === 'Escape') { if (spotRef.current) setSpot(null); else setSel(null) }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  // the eye button of the city screen asks for the tilted view here
  useEffect(() => {
    const on = () => { const v = viewRef.current; if (!v) return; v.setOblique(!v.isOblique()); setOblique(v.isOblique()) }
    window.addEventListener('tc:maptilt', on)
    return () => window.removeEventListener('tc:maptilt', on)
  }, [])
  useEffect(() => { window.dispatchEvent(new CustomEvent('tc:maptilt-state', { detail: oblique })) }, [oblique])

  const selPlace = places.find((p) => p.id === sel) ?? null

  // search: the cities that match (all of them when the box is empty), or a pair of coordinates
  const coords = useMemo(() => parseCoords(query), [query])
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places.filter((p) => p.located && (!q || p.name.toLowerCase().includes(q))).slice(0, 7)
  }, [places, query])
  const pickFirst = () => {
    if (suggestions[0]) flyTo(suggestions[0])
    else if (coords) flyToSpot(coords.lat, coords.lon)
  }

  const cardPlace = selPlace
  const homeKm = (lat: number, lon: number) => gcKm({ lat, lon }, homeRef.current, R)

  return (
    <div ref={rootRef} style={{ '--wm-top': `${topInset}px`, '--wm-bot': `${bottomInset}px` } as React.CSSProperties} className={`wm${ready ? ' wm-in' : ''}${leaving ? ' wm-out' : ''}${desktop ? ' wm-desk' : ''}${terrainLook ? ' wm-terrain' : ''}`}>
      <canvas ref={canvasRef} className="wm-canvas" />

      <div className="wm-markers">
        {places.map((p) => (
          <button
            key={p.id} type="button" ref={(el) => { if (el) markerRefs.current.set(p.id, el); else markerRefs.current.delete(p.id) }}
            className={`wm-mk ${p.kind}${p.id === sel ? ' sel' : ''}`} style={{ display: 'none' }}
            onClick={(e) => { e.stopPropagation(); setSel(p.id); setSpot(null); setSearchOpen(false) }}
            aria-label={p.name}
          >
            <span className="wm-dot">{p.kind === 'home' && <Emboss name="house" palette="gold" size={18} />}</span>
            <span className="wm-lbl">{p.kind === 'home' ? t('wm.you_here') + ' · ' + p.name : p.name}</span>
          </button>
        ))}
      </div>

      <div className="wm-clusters">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={i} type="button" className="wm-cl" style={{ display: 'none' }} ref={(el) => { if (el) clusterRefs.current[i] = el }}
            aria-label={t('wm.cluster')}
            onClick={(e) => { e.stopPropagation(); const g = clusterInfo.current[i]; const v = viewRef.current; if (g && v) v.flyTo(g.lat, g.lon, Math.max(MAP_MIN_ALT_UI, v.state().alt * 0.3)) }}
          ><span /></button>
        ))}
      </div>

      <button type="button" className="wm-arrow" ref={arrowRef} style={{ display: 'none' }} onClick={() => { const v = viewRef.current; if (v) v.flyTo(home.lat, home.lon, Math.min(v.state().alt, 3000)) }} aria-label={t('wm.you_here')}>
        <span className="wm-arrow-ic" ref={arrowIcon}><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#ffc928" stroke="#4a2f00" strokeWidth="1.8" strokeLinejoin="round" /></svg></span>
        <span className="wm-arrow-txt" ref={arrowTxt} />
      </button>

      <div className="wm-spot" ref={spotMk} style={{ display: 'none' }} aria-hidden />

      <div className="wm-searchbox">
        <div className="wm-sfield">
          <Emboss name="m_search" palette="gold" size={20} />
          <input
            type="search" value={query} placeholder={t('wm.search.ph')} aria-label={t('wm.search.ph')} autoComplete="off" enterKeyHint="search"
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pickFirst(); (e.target as HTMLInputElement).blur() } }}
          />
          {query && <button type="button" className="wm-sclear" onClick={() => setQuery('')} aria-label={t('wm.close')}>✕</button>}
        </div>
        {searchOpen && (suggestions.length > 0 || coords) && (
          <div className="wm-suggest" role="listbox" onPointerDown={(e) => e.preventDefault()}>
            {coords && (
              <button type="button" role="option" aria-selected="false" className="wm-row" onClick={() => flyToSpot(coords.lat, coords.lon)}>
                <span className="wm-rowdot pin" />
                <span className="wm-rowname">{coordText(coords.lat, coords.lon)}</span>
              </button>
            )}
            {suggestions.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={p.id === sel} className={`wm-row${p.id === sel ? ' on' : ''}`} onClick={() => (p.kind === 'home' ? (flyTo(p)) : flyTo(p))}>
                <span className={`wm-rowdot ${p.kind}`}>{p.kind === 'home' && <Emboss name="house" palette="gold" size={16} />}</span>
                <span className="wm-rowname">{p.name}</span>
                <span className="wm-rowkm">{p.kind === 'home' ? t('wm.here') : t('wm.km', { km: kmText(p.km ?? homeKm(p.lat, p.lon)) })}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="wm-tools">
        <button type="button" className="k-hdr-btn" onClick={toggleLook} aria-label={t(terrainLook ? 'wm.look.to_map' : 'wm.look.to_terrain')} aria-pressed={terrainLook}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffe9a8" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3 L21 8 L12 13 L3 8 Z" /><path d="M3 12.5 L12 17.5 L21 12.5" /><path d="M3 16.5 L12 21.5 L21 16.5" /></svg>
        </button>
        <button type="button" className="k-hdr-btn" onClick={resetNorth} aria-label={t('wm.compass')}>
          <span ref={compassRef} className="wm-needle"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2 L17 13 L12 11 L7 13 Z" fill="#ff5a4a" /><path d="M12 22 L17 13 L12 11 L7 13 Z" fill="#dfe4ff" /></svg></span>
        </button>
        {desktop && (
          <>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(0.55)} aria-label={t('wm.btn.zoom_in')}>+</button>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(1.8)} aria-label={t('wm.btn.zoom_out')}>−</button>
          </>
        )}
        <button type="button" className={`k-hdr-btn wm-locate${atHome ? ' on' : ''}`} onClick={locate} aria-label={t('wm.locate')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={atHome ? '#ffc928' : '#ffe9a8'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2.4" fill={atHome ? '#ffc928' : 'none'} /><path d="M12 1.5 V5 M12 19 V22.5 M1.5 12 H5 M19 12 H22.5" /></svg>
        </button>
        {lookHint && <span className="wm-hint">{lookHint}</span>}
      </div>

      {(cardPlace || spot) && (
        <div className="wm-card" style={desktop ? undefined : { bottom: bottomInset }} role="dialog" aria-label={cardPlace?.name ?? t('wm.spot')}>
          {cardPlace ? (
            <>
              <div className="wm-card-head">
                <span className={`wm-rowdot ${cardPlace.kind}`}>{cardPlace.kind === 'home' && <Emboss name="house" palette="gold" size={16} />}</span>
                <div className="wm-card-title">
                  <b>{cardPlace.name}</b>
                  <small>{cardPlace.kind === 'home' ? t('wm.here') : cardPlace.kind === 'central' ? '' : t('wm.city')}</small>
                </div>
                <button type="button" className="wm-x" onClick={() => setSel(null)} aria-label={t('wm.close')}>✕</button>
              </div>
              {cardPlace.kind !== 'home' && (
                <div className="wm-card-facts">
                  {cardPlace.km !== undefined && <span>{t('wm.km', { km: kmText(cardPlace.km) })}</span>}
                  {cardPlace.fare !== undefined && <span>{t('wm.fare', { fare: money(cardPlace.fare) })}</span>}
                  {cardPlace.wait !== undefined && <span>{t('wm.wait', { t: waitText(cardPlace.wait) })}</span>}
                </div>
              )}
              <div className="wm-card-acts">
                {cardPlace.kind === 'home' ? (
                  <button type="button" className="wm-btn gold" onClick={goHome}>{t('wm.home_go')}</button>
                ) : (
                  <>
                    <button type="button" className="wm-btn gold" onClick={() => flyTo(cardPlace)} disabled={!cardPlace.located}>{t('wm.go')}</button>
                    {cardPlace.sid && <button type="button" className="wm-btn" onClick={() => { onLeft(); openLocal('village_visit', { id: cardPlace.sid! }) }}>{t('wm.visit')}</button>}
                    <button type="button" className="wm-btn" onClick={() => { onLeft(); run('travel.options', { city: cardPlace.code }) }}>{t('wm.travel')}</button>
                  </>
                )}
              </div>
            </>
          ) : spot && (
            <>
              <div className="wm-card-head">
                <span className="wm-rowdot pin" />
                <div className="wm-card-title">
                  <b>{t('wm.spot')}</b>
                  <small>{coordText(spot.lat, spot.lon)}</small>
                </div>
                <button type="button" className="wm-x" onClick={() => setSpot(null)} aria-label={t('wm.close')}>✕</button>
              </div>
              <div className="wm-card-facts wm-facts-col">
                {spot.region && <span>{spot.region}</span>}
                <span>
                  {[
                    spot.tile ? biomeName(spot.tile.biomeCode) : '',
                    climateBand(spot.lat),
                    spot.tile ? (spot.tile.ocean ? t('wm.depth', { m: String(Math.max(0, Math.round(-spot.tile.elev))) }) : t('wm.height', { m: String(Math.round(spot.tile.elev)) })) : '',
                    spot.tile && !spot.tile.ocean && spot.tile.tileKm <= 20 ? (spot.tile.coast ? t('wm.coast') : t('wm.inland')) : '',
                  ].filter(Boolean).join(' · ')}
                </span>
                <span>{t('wm.from_home', { km: kmText(homeKm(spot.lat, spot.lon)) })}</span>
                {spot.near && <span>{t('wm.nearest', { name: spot.near.name, km: kmText(spot.near.km) })}</span>}
              </div>
              {spot.near && (
                <div className="wm-card-acts">
                  <button type="button" className="wm-btn gold" onClick={() => { const p = places.find((q) => q.id === spot.near!.id); if (p) flyTo(p) }}>{t('wm.go_nearest')}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="wm-scale"><span className="wm-scale-bar" ref={scaleBar} /><span ref={scaleTxt} /></div>

      {!ready && !failed && <div className="wm-load">{t('wm.loading')}</div>}
      {failed && <div className="wm-load">{t('wm.failed')}</div>}
    </div>
  )
}
