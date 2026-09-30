// Build mode of the village home: the head picks a building from the menu
// (settlement.build), sees which lots take it (settlement.build.lots, with
// the quarter turn), taps a lot, reads the price (settlement.build.place
// without `confirm`), and confirms. The 3D scene follows: lots are tinted,
// the chosen footprint outlined, a translucent model stands where it would
// go. Every refusal is shown by its code (i18n refusalText).

import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import type { BuildMenuView, CatalogueBuilding, LotConfirmView, LotGridView, VillageLayout } from '../../api/types'
import type { VillageScene } from '../../village/villageScene'
import { TONE_BAD, TONE_NONE, TONE_OK, TONE_TAKEN } from '../../village/lotOverlay'
import { useToast } from '../../state/ToastContext'
import { t } from '../../i18n'
import { useVillageCommand } from '../../village/useVillage'
import type { VillageStore } from '../../village/villageStore'

export type BuildStep = 'off' | 'menu' | 'lot' | 'confirm'

export interface BuildState {
  step: BuildStep
  menu: BuildMenuView | null
  code: string | null
  rotated: boolean
  lots: LotGridView | null
  anchor: { x: number; y: number } | null
  confirm: LotConfirmView | null
  busy: boolean
}

const OFF: BuildState = { step: 'off', menu: null, code: null, rotated: false, lots: null, anchor: null, confirm: null, busy: false }

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

function tonesFromLots(lots: LotGridView): Uint8Array {
  const n = lots.grid_lots
  const out = new Uint8Array(n * n)
  for (const row of lots.rows) {
    for (const c of row) {
      out[c.y * n + c.x] = c.fits ? TONE_OK : c.state === 'occupied' || c.state === 'road' ? TONE_TAKEN : c.state === 'free' ? TONE_NONE : TONE_BAD
    }
  }
  return out
}

export function footprintOf(cat: Map<string, CatalogueBuilding>, code: string | null, rotated: boolean): { w: number; h: number } {
  const fp = (code ? cat.get(code)?.footprint : undefined) ?? [1, 1]
  return rotated ? { w: fp[1], h: fp[0] } : { w: fp[0], h: fp[1] }
}

/** Why a footprint at an anchor does not fit, as a short reason. */
export function blockReason(lots: LotGridView | null, anchor: { x: number; y: number }, w: number, h: number): string | null {
  if (!lots) return null
  const n = lots.grid_lots
  if (anchor.x < 0 || anchor.y < 0 || anchor.x + w > n || anchor.y + h > n) return t('build.reason.bounds')
  for (let y = anchor.y; y < anchor.y + h; y++) {
    for (let x = anchor.x; x < anchor.x + w; x++) {
      const s = lots.rows[y]?.[x]?.state
      if (s === 'water') return t('build.reason.water')
      if (s === 'steep') return t('build.reason.steep')
      if (s === 'occupied') return t('build.reason.occupied')
      if (s === 'road') return t('build.reason.road')
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
      const inside = ax >= 0 && ay >= 0 && ax + w <= n && ay + h <= n
      cands.push({ x: ax, y: ay, d: Math.hypot(cx - tap.x, cy - tap.y), fits: inside && !!lots.rows[ay]?.[ax]?.fits })
    }
  }
  cands.sort((a, b) => Number(b.fits) - Number(a.fits) || a.d - b.d)
  const best = cands[0]
  // never let an unfit centred pick hang off the grid: clamp it inside
  return best.fits ? { x: best.x, y: best.y } : { x: Math.max(0, Math.min(n - w, best.x)), y: Math.max(0, Math.min(n - h, best.y)) }
}

export function useBuildMode(
  store: VillageStore | null,
  layout: VillageLayout | null,
  sceneRef: MutableRefObject<VillageScene | null>,
  cat: Map<string, CatalogueBuilding>,
) {
  const [s, setS] = useState<BuildState>(OFF)
  const cmd = useVillageCommand()
  const toast = useToast()

  const enter = useCallback(async () => {
    setS({ ...OFF, step: 'menu', busy: true })
    const r = await cmd('settlement.build')
    setS((p) => ({ ...p, menu: (r.res?.view as BuildMenuView | undefined) ?? null, busy: false }))
  }, [cmd])

  const exit = useCallback(() => setS(OFF), [])

  const loadLots = useCallback(async (code: string, rotated: boolean) => {
    const r = await cmd('settlement.build.lots', rotated ? { code, rotate: '1' } : { code })
    return r.ok ? ((r.res?.view as LotGridView | undefined) ?? null) : null
  }, [cmd])

  const choose = useCallback(async (code: string) => {
    setS((p) => ({ ...p, busy: true, code, rotated: false, anchor: null, lots: null, confirm: null }))
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
      const fp = footprintOf(cat, p.code, p.rotated)
      return { ...p, anchor: anchorFor(p.lots, lot, fp.w, fp.h) }
    })
  }, [cat])

  const fits = useMemo(() => {
    if (!s.lots || !s.anchor) return false
    return !!s.lots.rows[s.anchor.y]?.[s.anchor.x]?.fits
  }, [s.lots, s.anchor])

  const next = useCallback(async () => {
    if (!s.code || !s.anchor || !fits) return
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.build.place', { code: s.code, x: s.anchor.x, y: s.anchor.y, rotated: s.rotated })
    setS((p) => (r.ok && r.res?.screen === 'settlement_build_confirm'
      ? { ...p, step: 'confirm', confirm: r.res.view as unknown as LotConfirmView, busy: false }
      : { ...p, busy: false }))
  }, [s.code, s.anchor, s.rotated, fits, cmd])

  const confirm = useCallback(async () => {
    if (!s.code || !s.anchor) return
    setS((p) => ({ ...p, busy: true }))
    const r = await cmd('settlement.build.place', { code: s.code, x: s.anchor.x, y: s.anchor.y, rotated: s.rotated, confirm: 'confirm' }, { write: true })
    if (r.ok) {
      toast.push(t('build.started'))
      void store?.refetchLayout()
      setS(OFF)
    } else {
      // a refusal leaves the plan on screen; the lot may just have been taken
      setS((p) => ({ ...p, busy: false, step: r.code === 'village_occupied' || r.code === 'village_unbuildable' ? 'lot' : p.step }))
      if (r.code === 'village_occupied') void loadLots(s.code, s.rotated).then((lots) => lots && setS((p) => ({ ...p, lots })))
    }
  }, [s.code, s.anchor, s.rotated, cmd, store, toast, loadLots])

  const back = useCallback(() => {
    setS((p) => {
      if (p.step === 'confirm') return { ...p, step: 'lot', confirm: null }
      if (p.step === 'lot') return { ...p, step: 'menu', code: null, lots: null, anchor: null, rotated: false }
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
      scene.setSelection(null)
      scene.setGhost(null)
      return
    }
    scene.setOverlayTones(s.step === 'menu' || !s.lots ? tonesFromLayout(layout) : tonesFromLots(s.lots))
    if (s.step !== 'menu' && s.code && s.anchor) {
      scene.setSelection({ x: s.anchor.x, y: s.anchor.y, w: fp.w, h: fp.h, ok: fits })
      scene.setGhost({ type: s.code, x: s.anchor.x, y: s.anchor.y, w: fp.w, h: fp.h, rotated: s.rotated, ok: fits })
    } else {
      scene.setSelection(null)
      scene.setGhost(null)
    }
  }, [s.step, s.lots, s.anchor, s.code, s.rotated, fits, layout, fp.w, fp.h, sceneRef])

  // leaving build mode (unmount) clears the overlay
  useEffect(() => () => {
    const scene = sceneRef.current
    scene?.setOverlayTones(null)
    scene?.setSelection(null)
    scene?.setGhost(null)
  }, [sceneRef])

  return { state: s, fits, footprint: fp, enter, exit, choose, rotate, tapLot, next, confirm, back }
}
