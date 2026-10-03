// Build mode of the village home: the head picks a building from the menu
// (settlement.build), sees which lots take it (settlement.build.lots, with
// the quarter turn), taps a lot, reads the price (settlement.build.place
// without `confirm`), and confirms. The 3D scene follows: lots are tinted,
// the chosen footprint outlined, a translucent model stands where it would
// go. Every refusal is shown by its code (i18n refusalText).
//
// The road tool (ADR 0044 5.5, "a road opens the land it reaches") is the other half of building: the head
// taps the ground where a road should end, wherever that is (the land has no edge), reads the quote
// (settlement.road.plan without `confirm`) and stores the plan. Nothing is built or charged until a buyer
// takes a lot beside it; the lots along the road then appear in the land tool and in the build picker.

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { BatchConfirmView, BuildMenuView, CatalogueBuilding, LotConfirmView, LotGridView, RoadQuoteView, VillageLayout } from '../../api/types'
import type { VillageScene } from '../../village/villageScene'
import { TONE_BAD, TONE_NONE, TONE_OK, TONE_PICK, TONE_TAKEN } from '../../village/lotOverlay'
import { useToast } from '../../state/ToastContext'
import { t } from '../../i18n'
import { useVillageCommand } from '../../village/useVillage'
import type { VillageStore } from '../../village/villageStore'
import { TONE_NEEDS, TONE_OK as TONE_FREE, TONE_PICK as TONE_ROAD } from '../../village/lotOverlay'
import { lotCellAt, outerFromLayout, outerFromLots } from './outer'
import type { OuterCell } from '../../village/landOverlay'

export type BuildStep = 'off' | 'menu' | 'lot' | 'confirm' | 'road'

/** The road tool's state: where the road should end, and the quote for it. */
export interface RoadDraft {
  to: { x: number; y: number } | null
  quote: RoadQuoteView | null
  /** The road class asked for (`path` until the settlement has researched better). */
  cls: string
  /** A quote is being asked. */
  asking: boolean
}

export interface BuildState {
  step: BuildStep
  menu: BuildMenuView | null
  code: string | null
  rotated: boolean
  lots: LotGridView | null
  anchor: { x: number; y: number } | null
  confirm: LotConfirmView | null
  busy: boolean
  /** Several lots at once (roads): the picked lots, in the order tapped. */
  picks: { x: number; y: number }[]
  /** In path mode a tap adds the whole run from the last pick to the tapped lot. */
  pathMode: boolean
  batch: BatchConfirmView | null
  /** Lots a refused batch named. */
  badLots: { x: number; y: number; kind: string }[]
  road: RoadDraft
}

const NO_ROAD: RoadDraft = { to: null, quote: null, cls: 'path', asking: false }

/** How many lots across the camera shows when the road tool opens (about 1.2 km). */
const ROAD_VIEW_LOTS = 40

const OFF: BuildState = {
  step: 'off', menu: null, code: null, rotated: false, lots: null, anchor: null, confirm: null, busy: false,
  picks: [], pathMode: false, batch: null, badLots: [], road: NO_ROAD,
}

/** The run of lots from a to b: along the row, then down the column (the server's own rule). */
export function lineBetween(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const sx = b.x >= a.x ? 1 : -1, sy = b.y >= a.y ? 1 : -1
  for (let x = a.x; ; x += sx) { out.push({ x, y: a.y }); if (x === b.x) break }
  for (let y = a.y + sy; a.y !== b.y; y += sy) { out.push({ x: b.x, y }); if (y === b.y) break }
  return out
}

/** What the layout alone says about each lot, before any building is chosen. */
export function tonesFromLayout(layout: VillageLayout): Uint8Array {
  const n = layout.grid.lots
  const out = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) out[y * n + x] = layout.lots[y]?.[x]?.buildable ? TONE_OK : TONE_BAD
  }
  for (const b of layout.buildings) {
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (xx >= 0 && yy >= 0 && xx < n && yy < n) out[yy * n + xx] = TONE_TAKEN
  }
  for (const r of layout.roads ?? []) if (r.x >= 0 && r.y >= 0 && r.x < n && r.y < n) out[r.y * n + r.x] = TONE_TAKEN
  return out
}

function tonesFromLots(lots: LotGridView, picks: { x: number; y: number }[] = [], bad: { x: number; y: number }[] = []): Uint8Array {
  const n = lots.grid_lots
  const out = new Uint8Array(n * n)
  for (const row of lots.rows ?? []) {
    for (const c of row ?? []) {
      out[c.y * n + c.x] = c.fits ? TONE_OK : c.state === 'occupied' || c.state === 'road' ? TONE_TAKEN : c.state === 'free' ? TONE_NONE : TONE_BAD
    }
  }
  for (const p of picks) if (p.x >= 0 && p.y >= 0 && p.x < n && p.y < n) out[p.y * n + p.x] = TONE_PICK
  for (const p of bad) if (p.x >= 0 && p.y >= 0 && p.x < n && p.y < n) out[p.y * n + p.x] = TONE_BAD
  return out
}

/** Whether a building code can be laid many at a time: one lot and exempt from the cap (roads). */
export function isMulti(cat: Map<string, CatalogueBuilding>, code: string | null): boolean {
  const e = code ? cat.get(code) : undefined
  return !!e && !!e.cap_exempt && e.footprint[0] === 1 && e.footprint[1] === 1
}

export function footprintOf(cat: Map<string, CatalogueBuilding>, code: string | null, rotated: boolean): { w: number; h: number } {
  const fp = (code ? cat.get(code)?.footprint : undefined) ?? [1, 1]
  return rotated ? { w: fp[1], h: fp[0] } : { w: fp[0], h: fp[1] }
}

/** Why a footprint at an anchor does not fit, as a short reason. */
export function blockReason(lots: LotGridView | null, anchor: { x: number; y: number }, w: number, h: number): string | null {
  if (!lots) return null
  const n = lots.grid_lots
  const inside = anchor.x >= 0 && anchor.y >= 0 && anchor.x + w <= n && anchor.y + h <= n
  const beyond = !inside && (lots.outer?.length ?? 0) > 0
  if (!inside && !beyond) return t('build.reason.bounds')
  for (let y = anchor.y; y < anchor.y + h; y++) {
    for (let x = anchor.x; x < anchor.x + w; x++) {
      const c = lotCellAt(lots, x, y)
      // land no road opened is not for building yet
      if (!c) return t('build.reason.closed')
      const s = c.state
      if (s === 'water') return t('build.reason.water')
      if (s === 'steep') return t('build.reason.steep')
      if (s === 'occupied') return t('build.reason.occupied')
      if (s === 'road' || s === 'planned') return t('build.reason.road')
    }
  }
  return null
}

/** The anchor of a footprint that contains the tapped lot: one that fits if
 * any does (nearest to centring the building on the tap), else the centred one. */
export function anchorFor(lots: LotGridView, tap: { x: number; y: number }, w: number, h: number): { x: number; y: number } {
  const n = lots.grid_lots
  const cands: { x: number; y: number; d: number; fits: boolean }[] = []
  for (let ay = tap.y - h + 1; ay <= tap.y; ay++) {
    for (let ax = tap.x - w + 1; ax <= tap.x; ax++) {
      const cx = ax + (w - 1) / 2, cy = ay + (h - 1) / 2
      cands.push({ x: ax, y: ay, d: Math.hypot(cx - tap.x, cy - tap.y), fits: !!lotCellAt(lots, ax, ay)?.fits })
    }
  }
  cands.sort((a, b) => Number(b.fits) - Number(a.fits) || a.d - b.d)
  const best = cands[0]
  // never let an unfit centred pick hang off the first grid when the tap is in it: clamp it inside
  const tapInside = tap.x >= 0 && tap.y >= 0 && tap.x < n && tap.y < n
  if (best.fits || !tapInside) return { x: best.x, y: best.y }
  return { x: Math.max(0, Math.min(n - w, best.x)), y: Math.max(0, Math.min(n - h, best.y)) }
}

export function useBuildMode(
  store: VillageStore | null,
  layout: VillageLayout | null,
  sceneRef: MutableRefObject<VillageScene | null>,
  cat: Map<string, CatalogueBuilding>,
) {
  const [s, setS] = useState<BuildState>(OFF)
  const sRef = useRef(s)
  sRef.current = s
  const cmd = useVillageCommand()
  const toast = useToast()

  const enter = useCallback(async () => {
    setS({ ...OFF, step: 'menu', busy: true })
    const r = await cmd('settlement.build')
    setS((p) => ({ ...p, menu: (r.res?.view as BuildMenuView | undefined) ?? null, busy: false }))
  }, [cmd])

  const exit = useCallback(() => setS(OFF), [])

  // -- the road tool (ADR 0044 5.5) ----------------------------------------------------------
  /** Opens the road tool: the next tap on the ground is where the road should end. */
  const enterRoad = useCallback(() => {
    setS((p) => ({ ...p, step: 'road', road: NO_ROAD, code: null, lots: null, anchor: null, confirm: null, picks: [], badLots: [], batch: null }))
    // a road goes out into the land: show a stretch of it round the village, not only the first grid
    sceneRef.current?.frame('aerial', undefined, ROAD_VIEW_LOTS)
  }, [sceneRef])

  /** Asks for the quote of a road to a lot of the ground (anywhere); a refusal is shown by its code and the old end stays. */
  const askRoad = useCallback(async (to: { x: number; y: number }, cls?: string) => {
    let want = ''
    setS((p) => { want = cls ?? p.road.cls; return { ...p, road: { ...p.road, asking: true, cls: want } } })
    const r = await cmd('settlement.road.plan', { x: to.x, y: to.y, ...(want ? { class: want } : {}) })
    setS((p) => {
      if (p.step !== 'road') return p
      if (r.ok && r.res?.screen === 'settlement_road_quote') {
        return { ...p, road: { to, quote: r.res.view as unknown as RoadQuoteView, cls: want, asking: false } }
      }
      return { ...p, road: { ...p.road, asking: false } }
    })
  }, [cmd])

  /** The tool's tap: where on the ground the road should end. */
  const roadTap = useCallback((lot: { x: number; y: number }) => {
    if (sRef.current.step !== 'road' || sRef.current.road.asking) return
    void askRoad(lot)
  }, [askRoad])

  const roadClass = useCallback((cls: string) => {
    const to = sRef.current.road.to
    if (to) void askRoad(to, cls)
    else setS((p) => ({ ...p, road: { ...p.road, cls } }))
  }, [askRoad])

  /** Stores the plan: free, and nothing is built until a buyer takes a lot beside it. */
  const roadConfirm = useCallback(async () => {
    const { to, cls } = sRef.current.road
    if (!to) return
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.road.plan', { x: to.x, y: to.y, ...(cls ? { class: cls } : {}), confirm: 'confirm' }, { write: true })
    if (r.ok) {
      toast.push(t('road.done'), { kind: 'success' })
      void store?.refetchLayout()
      setS((p) => ({ ...p, busy: false, road: { ...NO_ROAD, cls } }))
    } else setS((p) => ({ ...p, busy: false }))
  }, [cmd, store, toast])

  /** Takes an unlaid, unsold plan back. */
  const roadCancel = useCallback(async (id: string) => {
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.road.cancel', { id }, { write: true })
    if (r.ok) {
      toast.push(t('road.cancelled'), { kind: 'success' })
      void store?.refetchLayout()
    }
    setS((p) => ({ ...p, busy: false }))
  }, [cmd, store, toast])

  const loadLots = useCallback(async (code: string, rotated: boolean) => {
    const r = await cmd('settlement.build.lots', rotated ? { code, rotate: '1' } : { code })
    return r.ok ? ((r.res?.view as LotGridView | undefined) ?? null) : null
  }, [cmd])

  const choose = useCallback(async (code: string) => {
    setS((p) => ({ ...p, busy: true, code, rotated: false, anchor: null, lots: null, confirm: null, picks: [], batch: null, badLots: [], pathMode: false }))
    const lots = await loadLots(code, false)
    setS((p) => (lots ? { ...p, step: 'lot', lots, busy: false } : { ...p, step: 'menu', code: null, busy: false }))
  }, [loadLots])

  const rotate = useCallback(async () => {
    if (!s.code) return
    const rotated = !s.rotated
    setS((p) => ({ ...p, busy: true }))
    const lots = await loadLots(s.code, rotated)
    setS((p) => {
      if (!lots) return { ...p, busy: false }
      const fp = footprintOf(cat, p.code, rotated)
      // keep the tapped area: re-anchor on the old anchor's centre
      const tap = p.anchor ? { x: Math.min(lots.grid_lots - 1, p.anchor.x), y: Math.min(lots.grid_lots - 1, p.anchor.y) } : null
      return { ...p, rotated, lots, busy: false, anchor: tap ? anchorFor(lots, tap, fp.w, fp.h) : null }
    })
  }, [s.code, s.rotated, loadLots, cat])

  const tapLot = useCallback((lot: { x: number; y: number }) => {
    setS((p) => {
      if (p.step !== 'lot' || !p.lots) return p
      if (isMulti(cat, p.code)) {
        const fitsAt = (q: { x: number; y: number }) => !!p.lots && !!lotCellAt(p.lots, q.x, q.y)?.fits
        const last = p.picks[p.picks.length - 1]
        if (p.pathMode && last && (last.x !== lot.x || last.y !== lot.y)) {
          // the run from the last pick: every fitting lot on it not yet picked
          const have = new Set(p.picks.map((q) => `${q.x},${q.y}`))
          const add = lineBetween(last, lot).filter((q) => fitsAt(q) && !have.has(`${q.x},${q.y}`))
          return { ...p, picks: [...p.picks, ...add], badLots: [] }
        }
        const at = p.picks.findIndex((q) => q.x === lot.x && q.y === lot.y)
        if (at >= 0) return { ...p, picks: p.picks.filter((_, i) => i !== at), badLots: [] }
        return fitsAt(lot) ? { ...p, picks: [...p.picks, lot], badLots: [] } : p
      }
      const fp = footprintOf(cat, p.code, p.rotated)
      return { ...p, anchor: anchorFor(p.lots, lot, fp.w, fp.h) }
    })
  }, [cat])

  const fits = useMemo(() => {
    if (!s.lots || !s.anchor) return false
    return !!lotCellAt(s.lots, s.anchor.x, s.anchor.y)?.fits
  }, [s.lots, s.anchor])

  const undoPick = useCallback(() => setS((p) => ({ ...p, picks: p.picks.slice(0, -1), badLots: [] })), [])
  const clearPicks = useCallback(() => setS((p) => ({ ...p, picks: [], badLots: [] })), [])
  const setPathMode = useCallback((pathMode: boolean) => setS((p) => ({ ...p, pathMode })), [])

  const next = useCallback(async () => {
    if (s.code && isMulti(cat, s.code)) {
      if (!s.picks.length) return
      setS((p) => ({ ...p, busy: true }))
      const r = await cmd('settlement.build.place_many', { code: s.code, lots: s.picks.map((q) => ({ x: q.x, y: q.y })) }, { silent: true })
      if (r.ok && r.res?.screen === 'settlement_build_batch_confirm') {
        setS((p) => ({ ...p, step: 'confirm', batch: r.res!.view as unknown as BatchConfirmView, busy: false }))
      } else {
        const bad = (r.res?.view as { lots?: { x: number; y: number; kind: string }[] } | undefined)?.lots ?? []
        toast.push(r.res?.error?.code === 'village_batch' ? t('build.batch.refused', { n: bad.length }) : r.message, { kind: 'error' })
        setS((p) => ({ ...p, busy: false, badLots: bad }))
        if (bad.length && s.code) void loadLots(s.code, false).then((lots) => lots && setS((p) => ({ ...p, lots })))
      }
      return
    }
    if (!s.code || !s.anchor || !fits) return
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.build.place', { code: s.code, x: s.anchor.x, y: s.anchor.y, rotated: s.rotated })
    setS((p) => (r.ok && r.res?.screen === 'settlement_build_confirm'
      ? { ...p, step: 'confirm', confirm: r.res.view as unknown as LotConfirmView, busy: false }
      : { ...p, busy: false }))
  }, [s.code, s.anchor, s.rotated, s.picks, fits, cmd, cat, toast, loadLots])

  const confirm = useCallback(async () => {
    if (s.code && isMulti(cat, s.code) && s.picks.length) {
      setS((p) => ({ ...p, busy: true }))
      const r = await cmd('settlement.build.place_many', { code: s.code, lots: s.picks.map((q) => ({ x: q.x, y: q.y })), confirm: 'confirm' }, { write: true, silent: true })
      if (r.ok) {
        toast.push(t('build.batch.started', { n: s.picks.length }), { kind: 'success' })
        void store?.refetchLayout()
        setS(OFF)
      } else {
        const bad = (r.res?.view as { lots?: { x: number; y: number; kind: string }[] } | undefined)?.lots ?? []
        toast.push(r.res?.error?.code === 'village_batch' ? t('build.batch.refused', { n: bad.length }) : r.message, { kind: 'error' })
        setS((p) => ({ ...p, busy: false, step: 'lot', batch: null, badLots: bad }))
        if (s.code) void loadLots(s.code, false).then((lots) => lots && setS((p) => ({ ...p, lots })))
      }
      return
    }
    if (!s.code || !s.anchor) return
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.build.place', { code: s.code, x: s.anchor.x, y: s.anchor.y, rotated: s.rotated, confirm: 'confirm' }, { write: true })
    if (r.ok) {
      toast.push(t('build.started'), { kind: 'success' })
      void store?.refetchLayout()
      setS(OFF)
    } else {
      // a refusal leaves the plan on screen; the lot may just have been taken
      setS((p) => ({ ...p, busy: false, step: r.code === 'village_occupied' || r.code === 'village_unbuildable' ? 'lot' : p.step }))
      if (r.code === 'village_occupied') void loadLots(s.code, s.rotated).then((lots) => lots && setS((p) => ({ ...p, lots })))
    }
  }, [s.code, s.anchor, s.rotated, s.picks, cmd, cat, store, toast, loadLots])

  const back = useCallback(() => {
    setS((p) => {
      if (p.step === 'road') return p.road.to ? { ...p, road: { ...p.road, to: null, quote: null } } : { ...p, step: 'menu', road: NO_ROAD }
      if (p.step === 'confirm') return { ...p, step: 'lot', confirm: null, batch: null }
      if (p.step === 'lot') return { ...p, step: 'menu', code: null, lots: null, anchor: null, rotated: false, picks: [], badLots: [], pathMode: false }
      return OFF
    })
  }, [])

  // -- the 3D scene follows the state ---------------------------------------------------------
  const fp = footprintOf(cat, s.code, s.rotated)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (s.step === 'off' || !layout) {
      scene.setOverlayTones(null)
      scene.setLandCells(null)
      scene.setRoadRibbon(null)
      scene.setSelection(null)
      scene.setGhost(null)
      return
    }
    scene.setOverlayTones(s.step === 'menu' || s.step === 'road' || !s.lots ? tonesFromLayout(layout) : tonesFromLots(s.lots, s.picks, s.badLots))
    // the land beyond the first grid: what the roads opened (the picker's own answer when a building is being placed)
    // and, in the road tool, the road being drawn with the lots it would open
    let outer: OuterCell[] = s.step === 'lot' && s.lots ? outerFromLots(s.lots, s.picks, s.badLots) : outerFromLayout(layout)
    if (s.step === 'road' && s.road.quote) {
      const q = s.road.quote
      const draft: OuterCell[] = (q.open_cells ?? []).map((c) => ({ x: c.x, y: c.y, tone: c.state === 'water' ? TONE_BAD : c.state === 'steep' ? TONE_NEEDS : TONE_FREE }))
      const path: OuterCell[] = (q.path ?? []).map((c) => ({ x: c.x, y: c.y, tone: TONE_ROAD }))
      const have = new Set([...draft, ...path].map((c) => `${c.x},${c.y}`))
      outer = [...outer.filter((c) => !have.has(`${c.x},${c.y}`)), ...draft, ...path]
      scene.setRoadRibbon(q.path ?? null)
    } else scene.setRoadRibbon(null)
    scene.setLandCells(outer)
    if (s.step !== 'menu' && s.step !== 'road' && s.code && s.anchor && !isMulti(cat, s.code)) {
      scene.setSelection({ x: s.anchor.x, y: s.anchor.y, w: fp.w, h: fp.h, ok: fits })
      scene.setGhost({ type: s.code, x: s.anchor.x, y: s.anchor.y, w: fp.w, h: fp.h, rotated: s.rotated, ok: fits })
    } else {
      scene.setSelection(null)
      scene.setGhost(null)
    }
  }, [s.step, s.lots, s.anchor, s.code, s.rotated, s.picks, s.badLots, s.road.quote, fits, layout, fp.w, fp.h, sceneRef, cat])

  // leaving build mode (unmount) clears the overlay
  useEffect(() => () => {
    const scene = sceneRef.current
    scene?.setOverlayTones(null)
    scene?.setLandCells(null)
    scene?.setRoadRibbon(null)
    scene?.setSelection(null)
    scene?.setGhost(null)
  }, [sceneRef])

  return {
    state: s, fits, footprint: fp, enter, exit, choose, rotate, tapLot, next, confirm, back, undoPick, clearPicks, setPathMode,
    enterRoad, roadTap, roadClass, roadConfirm, roadCancel,
  }
}
