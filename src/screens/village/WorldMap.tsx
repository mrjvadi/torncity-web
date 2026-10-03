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

  const homePlace = useMemo<Place>(() => ({ id: 'home:' + home.id, code: 'home', name: home.name, lat: home.lat, lon: home.lon, kind: 'home', sid: home.id, located: true }), [home.id, home.name, home.lat, home.lon])
  const places = useMemo(() => [homePlace, ...dests.filter((d) => d.sid !== home.id)], [homePlace, dests, home.id])
  const placesRef = useRef(places)
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
        if (chipRef.current) chipRef.current.textContent = t('wm.alt', { km: String(Math.round(v.state().alt)) })
        if (!readyRef.current && v.terrain.stats().shown > 0) { readyRef.current = true; setReady(true) }
      }
      view.onTap = () => setSel(null)
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
    <div style={{ '--wm-top': `${topInset}px` } as React.CSSProperties} className={`wm${ready ? ' wm-in' : ''}${leaving ? ' wm-out' : ''}${desktop ? ' wm-desk' : ''}`}>
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
            <span className="wm-lbl">{p.kind === 'home' ? t('wm.mine') + ' · ' + p.name : p.name}</span>
          </button>
        ))}
      </div>

      <div className="wm-chip" ref={chipRef} />

      <div className="wm-tools">
        <button type="button" className="k-hdr-btn" onClick={() => setListOpen((o) => !o)} aria-label={t('wm.btn.list')} aria-pressed={listOpen}><Emboss name="m_search" palette="gold" size={22} /></button>
        {desktop && (
          <>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(0.6)} aria-label={t('wm.btn.zoom_in')}>+</button>
            <button type="button" className="k-hdr-btn wm-zoom" onClick={() => viewRef.current?.zoomBy(1.6)} aria-label={t('wm.btn.zoom_out')}>−</button>
          </>
        )}
      </div>

      {selPlace && (
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
