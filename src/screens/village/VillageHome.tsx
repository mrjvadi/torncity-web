// The village home: the player's settlement on its real terrain in 3D, a
// the build button and the menu button, and the head's build mode. Everything else
// (land, my house, my property, work, status...) is a section of the village menu. A neighbour's village (`localArgs.id`) is drawn the
// same way from the coarse layout, without the build controls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScreenProps } from '../types'
import { Emboss, Frame, GLabel, Plate, Slab } from '../../kit'
import { Header } from '../native/kit/Parts'
import { money } from '../native/kit/format'
import { t, type Key } from '../../i18n'
import { useSession } from '../../state/SessionContext'
import { useToast } from '../../state/ToastContext'
import { buildingName, useBuildingCatalogue, useNow, useSettlementId, useVillage, useVillageCommand } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import type { VillageScene, ScreenLabel } from '../../village/villageScene'
import { clockSkewMs } from '../../village/clock'
import { report } from '../../lib/reporter'
import * as api from '../../api/client'
import { countdown } from './common'
import { MapOverlays, type Mark, type RingAction, type RingModel } from '../../ui/v6/MapOverlays'
import { ContextMenu, type CtxItem } from '../../ui/v6/parts'
import { useChrome } from '../../ui/v6/chrome'
import { buildPercent } from '../../ui/v6/hooks'
import { useBuildingOverlays } from './overlays'
import { ringActions } from './ring'
import UpgradeConfirm from './UpgradeConfirm'
import { useBuildMode } from './useBuildMode'
import BuildPanel from './BuildPanel'
import BuildingSheet from './BuildingSheet'
import { BuyLotSheet, HouseSheet, LotAccessSheet, TakenLotSheet } from './LandSheets'
import { classifyLot, tonesForLand, type LotAccessMap } from './citizen'
import { classifyOuter, inFirstGrid, outerAccess, outerForLand } from './outer'
import type { LandView, LotAccessView } from '../../api/types'
import WorldMap, { useWorldMapKeys } from './WorldMap'
import './village.css'

const member0 = (l: { viewer: { member: boolean } } | null | undefined) => !!l?.viewer.member
const inBuildNow = (step: string) => step !== 'off'

export default function VillageHome({ localArgs, openLocal, run }: ScreenProps) {
  const id = useSettlementId(localArgs?.id)
  const v = useVillage(id)
  const { layout, ground, world, store } = v
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const toast = useToast()
  const { bootstrap } = useSession()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<VillageScene | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneError, setSceneError] = useState(false)
  const [labels, setLabels] = useState<ScreenLabel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // the ring's verbs: «اطلاعات» opens the building's own panel, «ارتقا» the confirm, «کمک به ساخت» the site's labour sheet
  const [infoId, setInfoId] = useState<string | null>(null)
  const [infoSite, setInfoSite] = useState(false)
  const [upId, setUpId] = useState<string | null>(null)
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null)
  const chrome = useChrome()
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const own = !localArgs?.id
  // world map mode (WorldMap.tsx): the globe button opens it, the same button is the way home
  const [mapOn, setMapOn] = useState(false)
  const [mapTilt, setMapTilt] = useState(false)
  const mapLeave = useRef<(() => void) | null>(null)
  const mapHome = layout?.settlement.centre && world ? { id: layout.settlement.id, name: layout.settlement.name, lat: layout.settlement.centre.lat, lon: layout.settlement.centre.lon } : null
  useEffect(() => {
    const on = (e: Event) => setMapTilt(!!(e as CustomEvent).detail)
    window.addEventListener('tc:maptilt-state', on)
    return () => window.removeEventListener('tc:maptilt-state', on)
  }, [])
  useEffect(() => { sceneRef.current?.setActive(!mapOn); if (!mapOn) setMapTilt(false) }, [mapOn, sceneReady])
  const leftMap = useCallback(() => { setMapOn(false); sceneRef.current?.frame('aerial') }, [])
  useWorldMapKeys(!!mapHome && sceneReady, mapOn, () => (mapOn ? mapLeave.current?.() : setMapOn(true)), () => mapLeave.current?.())
  const build = useBuildMode(store, layout, sceneRef, cat)
  const tapRef = useRef<(lot: { x: number; y: number } | null, bid: string | null) => void>(() => undefined)
  // a tap on the ground wherever it lands, the first grid or the land beyond it (negative lots west and south)
  const groundRef = useRef<(lot: { x: number; y: number }) => void>(() => undefined)

  // The citizen loop (docs/adr/0033 section 4.4): a resident buys a free lot,
  // builds a house on their own, sees their property. `landOn` is the land map
  // (free lots green, own lots gold); a tap on a lot opens the sheet it needs.
  const [landOn, setLandOn] = useState(false)
  const [buyLot, setBuyLot] = useState<{ x: number; y: number } | null>(null)
  const [houseLot, setHouseLot] = useState<{ x: number; y: number } | null>(null)
  const [takenLot, setTakenLot] = useState<{ x: number; y: number; owner?: string } | null>(null)
  const resident = !!layout?.viewer.resident && own
  // the dock's place slot pressed again: put the world back in view, ring and selection away
  useEffect(() => {
    const on = () => { setSelectedId(null); setLotRing(null); sceneRef.current?.frame('aerial') }
    window.addEventListener('tc:recentre', on)
    return () => window.removeEventListener('tc:recentre', on)
  }, [])
  // the lot ring: a tap on bare ground opens the ring of that lot (buy, build, access, info)
  const [lotRing, setLotRing] = useState<{ x: number; y: number; kind: 'free' | 'mine' | 'taken'; owner?: string } | null>(null)
  // Lot access (docs/adr/0043): how each free lot and each of the viewer's bare lots is served by road,
  // read from the land screen's own answer whenever the land map is on or the layout changed.
  const cmd = useVillageCommand()
  const [access, setAccess] = useState<LotAccessMap | undefined>(undefined)
  const [fixLot, setFixLot] = useState<{ x: number; y: number } | null>(null)
  const [fixView, setFixView] = useState<LotAccessView | null>(null)
  const layoutVersion = layout?.version
  useEffect(() => {
    if ((!landOn && !lotRing) || !resident) return
    let cancelled = false
    void cmd('settlement.land', {}, { silent: true }).then((r) => {
      if (cancelled || !r.ok || !r.res?.view) return
      const m = new Map<string, string>()
      const lv = r.res.view as unknown as LandView
      for (const row of lv.rows ?? []) for (const c of row ?? []) if (c.access) m.set(`${c.x},${c.y}`, c.access)
      for (const [k, a] of outerAccess(lv.outer)) m.set(k, a)
      setAccess(m)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landOn, !!lotRing, resident, layoutVersion])
  // a lot picked for purchase is framed and outlined on the map
  useEffect(() => {
    const sc = sceneRef.current
    if (!sceneReady || !sc) return
    if (buyLot) { sc.frame('lot', buyLot); sc.setSelection({ x: buyLot.x, y: buyLot.y, w: 1, h: 1, ok: true }) } else sc.setSelection(null)
  }, [buyLot, sceneReady])
  useEffect(() => {
    if (!sceneReady) return
    sceneRef.current?.setOverlayTones((landOn || lotRing) && layout && build.state.step === 'off' ? tonesForLand(layout, access) : null)
  }, [landOn, lotRing, layout, sceneReady, build.state.step, access])
  // the land the roads opened (ADR 0044 5.5): tinted in the land tool like the first grid
  useEffect(() => {
    if (!sceneReady || build.state.step !== 'off') return
    sceneRef.current?.setLandCells((landOn || lotRing) && layout ? outerForLand(layout, access) : null)
  }, [landOn, lotRing, layout, sceneReady, build.state.step, access])
  // the menu's «زمین و قطعه‌ها» opens the village straight on the land map (the page may already be showing:
  // the arguments are new each time the entry is pressed)
  const handledLand = useRef<unknown>(null)
  useEffect(() => {
    if (!localArgs?.land || handledLand.current === localArgs || !sceneReady || !layout?.viewer.resident) return
    handledLand.current = localArgs
    setLandOn(true)
  }, [localArgs, sceneReady, layout?.viewer.resident])

  // «ساخت» in the menu (or the B key) opens the village straight in build mode; the arguments are new each time
  const handledBuild = useRef<unknown>(null)
  useEffect(() => {
    if (!localArgs?.build || handledBuild.current === localArgs || !sceneReady || !layout?.viewer.can_place) return
    handledBuild.current = localArgs
    void build.enter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localArgs, sceneReady, layout?.viewer.can_place])

  // the ground (chunks -> grids) is made on request; only this screen wants it
  useEffect(() => {
    if (store && v.status === 'ready' && !ground) void store.ensureGround()
  }, [store, v.status, ground])

  // create the scene once the ground exists
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ground || !world || !layoutRef.current) return
    let cancelled = false
    let ro: ResizeObserver | null = null
    let created: VillageScene | null = null
    void import('../../village/villageScene').then(async ({ VillageScene }) => {
      try {
        const scene = await VillageScene.create(canvas, ground, world, layoutRef.current!, {
          onTap: (lot, bid) => tapRef.current(lot, bid),
          onGround: (lot) => groundRef.current(lot),
          onLabels: setLabels,
          clockSkewMs,
        })
        if (cancelled) { scene.dispose(); return }
        created = scene
        sceneRef.current = scene
        scene.resize()
        ro = new ResizeObserver(() => scene.resize())
        ro.observe(canvas)
        framedRef.current = false
        setSceneReady(true)
        if (import.meta.env.DEV || new URLSearchParams(location.search).has('stats') || new URLSearchParams(location.search).get('mock') === '1') {
          ;(window as unknown as { __village?: unknown }).__village = { scene, store, get layout() { return layoutRef.current } }
        }
      } catch (e) {
        report('village', 'scene failed: ' + String(e))
        if (!cancelled) setSceneError(true)
      }
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      created?.dispose()
      if (sceneRef.current === created) sceneRef.current = null
      setSceneReady(false)
    }
  }, [ground, world, store])

  // the overlay covers the top and bottom of the canvas: keep the village in the free part
  const framedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sceneReady) return
    const sync = () => {
      const scene = sceneRef.current, cv = canvasRef.current
      if (!scene || !cv) return
      const r = cv.getBoundingClientRect()
      let top = topRef.current ? topRef.current.getBoundingClientRect().bottom - r.top + 4 : 0
      let bottom = bottomRef.current ? r.bottom - bottomRef.current.getBoundingClientRect().top + 4 : 0
      // the shell's own HUD, quest strip and dock float over a phone's world: the village is framed in what is left
      if (chrome && !chrome.desktop) {
        const hud = chrome.hud(), bot = chrome.bottom()
        if (hud) top = Math.max(top, hud.bottom - r.top + 4)
        if (bot) bottom = Math.max(bottom, r.bottom - bot.top + 4)
      }
      scene.setInsets(Math.max(0, top), Math.max(0, bottom))
      if (!framedRef.current) { framedRef.current = true; scene.frame('aerial') }
    }
    sync()
    const ro = new ResizeObserver(sync)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    const off = chrome?.subscribe(sync)
    return () => { ro.disconnect(); off?.() }
  }, [chrome, sceneReady, build.state.step, layout?.viewer.member, landOn, resident])

  // layout changes -> what stands
  useEffect(() => {
    if (sceneReady && layout) sceneRef.current?.setLayout(layout)
  }, [layout, sceneReady])

  // taps
  tapRef.current = (lot, bid) => {
    if (build.state.step === 'lot') {
      if (lot) build.tapLot(lot)
      return
    }
    // the road tool opens new land: a tap inside the city's first block has nothing to open, so say where to tap
    if (build.state.step === 'road') { toast.push(t('road.tap_outside')); return }
    if (build.state.step !== 'off') return
    // a ring is open: a tap on the ground only puts it away (P10)
    if (lotRing) { setLotRing(null); return }
    if (selectedId && !bid) { setSelectedId(null); return }
    // a lot's ring (buy, build, access) opens only in the land or build tools, never on a stray touch of the ground
    // while looking around the city (owner 2026-10-03); outside them a tap on the ground does nothing
    if (!bid && layout && lot && resident && landOn) {
      const k = classifyLot(layout, lot.x, lot.y)
      setSelectedId(null)
      if (k.kind === 'free') { setLotRing({ x: lot.x, y: lot.y, kind: 'free' }); return }
      if (k.kind === 'mine') { setLotRing({ x: lot.x, y: lot.y, kind: 'mine' }); return }
      if (k.kind === 'taken') { setLotRing({ x: lot.x, y: lot.y, kind: 'taken', owner: k.owner }); return }
    }
    setSelectedId(bid)
  }

  groundRef.current = (lot) => {
    if (!layout || inFirstGrid(layout, lot.x, lot.y)) return
    // the road tool: the end of the road is any place on the ground
    if (build.state.step === 'road') { build.roadTap(lot); return }
    // the build picker: a lot the roads opened takes a building like a lot of the first grid
    if (build.state.step === 'lot') { build.tapLot(lot); return }
    if (build.state.step !== 'off' || !resident || !landOn) return
    if (lotRing) { setLotRing(null); return }
    // the land tool: a lot a road opened has its ring; a lot it cannot use says why
    const k = classifyOuter(layout, lot.x, lot.y)
    setSelectedId(null)
    if (k.kind === 'free' || k.kind === 'mine') setLotRing({ x: lot.x, y: lot.y, kind: k.kind })
    else if (k.kind === 'taken') setLotRing({ x: lot.x, y: lot.y, kind: 'taken', owner: k.owner })
    else if (k.kind === 'water') toast.push(t('land.lot.water'), { kind: 'info' })
    else if (k.kind === 'steep') toast.push(t('land.lot.steep'), { kind: 'info' })
    else if (k.kind === 'road') toast.push(t('land.lot.road'), { kind: 'info' })
  }

  useEffect(() => { sceneRef.current?.setSelectedBuilding(build.state.step === 'off' ? selectedId : null) }, [selectedId, build.state.step, sceneReady])

  // a building that disappeared closes its sheet
  const keyOf = useCallback((i: number, b: { id?: string }) => b.id ?? `i${i}`, [])
  const selected = useMemo(() => {
    if (!layout || !selectedId) return null
    const idx = layout.buildings.findIndex((b, i) => keyOf(i, b) === selectedId)
    return idx >= 0 ? layout.buildings[idx] : null
  }, [layout, selectedId, keyOf])

  // -- the ring and the map overlays (v6) ------------------------------------------------------------
  // A member of their own village gets the ring; a visitor (coarse layout, no building ids) keeps the plain panel.
  const useRing = own && member0(layout) && layout?.detail === 'full'
  const overlays = useBuildingOverlays()
  useEffect(() => {
    // a road has nothing to offer but its panel
    if (useRing && selected && selected.type === 'road') setInfoId(selectedId)
  }, [useRing, selected, selectedId])
  const canPlaceNow = !!layout?.viewer.can_place
  // the generated looks of the buildings the viewer manages (B1): fetched once per layout version, drawn by the scene
  const looksKey = useRef('')
  useEffect(() => {
    if (!sceneReady || !layout || !own || !member0(layout)) return
    const ids = layout.buildings.filter((b) => b.id && b.type !== 'road' && b.state === 'built' && (b.private ? b.mine : false)).map((b) => b.id!).slice(0, 24)
    const key = `${layout.version}|${ids.join(',')}`
    if (key === looksKey.current || !ids.length) return
    looksKey.current = key
    void Promise.all(ids.map((bid) => cmd('settlement.lot.manage', { building: bid }, { silent: true }).then((r) => [bid, (r.res?.view as { look?: unknown } | undefined)?.look] as const))).then((list) => {
      const m = new Map<string, never>()
      for (const [bid, look] of list) if (look) m.set(bid, look as never)
      sceneRef.current?.setLooks(m)
    })
  }, [sceneReady, layout, own, cmd])
  const canPublicBuild = !!bootstrap?.settlement?.permissions?.includes('public.build')
  const labelOf = (key: string) => labels.find((l) => l.key === key)
  const verbsFor = (b: NonNullable<typeof selected>, id: string) => ringActions(b, b.id ? overlays.get(b.id) ?? null : null, {
    info: () => setInfoId(id),
    upgrade: () => setUpId(id),
    site: () => { setInfoSite(true); setInfoId(id) },
    open: (screen, args) => openLocal(screen, args),
    civic: b.type === 'civic_hall' || cat.get(b.type)?.category === 'governance',
    mine: () => { setSelectedId(null); run('settlement.mine') },
    run: (command) => run(command),
    manage: (b.private ? b.mine : canPublicBuild) ? () => { setSelectedId(null); run('settlement.lot.manage', { building: b.id ?? '' }) } : undefined,
  })
  const ring: RingModel | null = useRing && !inBuildNow(build.state.step) && selected && selected.type !== 'road' && selectedId && labelOf(selectedId)
    ? (() => {
      const l = labelOf(selectedId)!
      const ov = selected.id ? overlays.get(selected.id) : undefined
      return {
        key: selectedId,
        name: buildingName(cat, selected.type),
        level: ov && ov.tier > 0 && (!selected.private || selected.mine) ? ov.tier : undefined,
        anchor: [l.x, l.y + 22] as [number, number],
        actions: verbsFor(selected, selectedId),
        onInfo: () => verbsFor(selected, selectedId)[0].onClick(),
      }
    })()
    : null
  // the ring of a bare lot: buy / build / access / info, by what the lot is to this viewer (the same sheets as before)
  const lotRingModel: RingModel | null = (() => {
    if (!lotRing || !sceneReady || !sceneRef.current || !canvasRef.current || !layout) return null
    const r = canvasRef.current.getBoundingClientRect()
    const p = sceneRef.current.screenOfLot(lotRing.x, lotRing.y)
    const lot = { x: lotRing.x, y: lotRing.y }
    const go = (fn: () => void) => () => { setLotRing(null); fn() }
    const acts: RingAction[] = []
    if (lotRing.kind === 'free') {
      const buy = go(() => setBuyLot(lot))
      acts.push({ id: 'info', label: t('v6.ring.info'), icon: 'info', kind: 'info', onClick: buy })
      acts.push({ id: 'buy', label: t('v6.ring.buy'), icon: 'coin', kind: 'primary', onClick: buy })
      if (canPlaceNow) acts.push({ id: 'build', label: t('v6.ring.build'), icon: 'hammer', onClick: go(() => { void build.enter() }) })
    } else if (lotRing.kind === 'mine') {
      const a = access?.get(`${lot.x},${lot.y}`)
      const noRoad = !!a && a !== 'road'
      const open = go(() => { if (noRoad) { setFixView(null); setFixLot(lot) } else setHouseLot(lot) })
      acts.push({ id: 'info', label: t('v6.ring.info'), icon: 'info', kind: 'info', onClick: open })
      acts.push({ id: 'build', label: t('v6.ring.build'), icon: 'hammer', kind: 'primary', onClick: go(() => setHouseLot(lot)), off: noRoad })
      acts.push({ id: 'access', label: t('v6.ring.access'), icon: 'road', onClick: go(() => { setFixView(null); setFixLot(lot) }) })
      const occ = layout.buildings.find((q) => q.id && q.type !== 'road' && lot.x >= q.x && lot.x < q.x + q.w && lot.y >= q.y && lot.y < q.y + q.h)
      if (occ?.id) acts.push({ id: 'manage', label: t('lm.ring'), icon: 'tool', onClick: go(() => run('settlement.lot.manage', { building: occ.id! })) })
    } else {
      acts.push({ id: 'info', label: t('v6.ring.info'), icon: 'info', kind: 'info', onClick: go(() => setTakenLot({ ...lot, owner: lotRing.owner })) })
    }
    return { key: `lot-${lot.x}-${lot.y}`, name: t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 }), anchor: [p.x - r.left, p.y - r.top] as [number, number], actions: acts, onInfo: acts[0].onClick }
  })()
  const marks: Mark[] = useRing && !inBuildNow(build.state.step) && !landOn
    ? labels.filter((l) => l.visible).flatMap((l): Mark[] => {
      const b = layout?.buildings.find((x, i) => keyOf(i, x) === l.key)
      if (!b || !b.id || b.type === 'road') return []
      const going = b.state === 'under_construction' || b.state === 'planned'
      if (going) return [{ key: l.key, x: l.x, y: l.y, s: l.s, building: buildPercent(b) }]
      const ov = overlays.get(b.id)
      // who is shown a plaque (P9): only a building the viewer can act on, i.e. the server says they can upgrade it, or it is
      // their own. Every other building shows nothing until tapped; its level then rides on the name plate.
      const mineView = b.private ? !!b.mine : canPlaceNow
      const m: Mark = { key: l.key, x: l.x, y: l.y, s: l.s }
      if (ov && ov.tier > 0 && (ov.can_upgrade || (b.private && b.mine))) { m.level = ov.tier; m.canUpgrade = ov.can_upgrade }
      // the reason a standing building cannot work, as the server names it (damage first)
      const why = mineView ? (ov?.reasons.includes('damaged') ? 'damaged' : ov?.reasons[0]) : undefined
      if (why) {
        const txt = t(`v6.bub.${why}` as Key)
        m.bubble = { kind: 'status', icon: why === 'damaged' ? 'cross' : 'info', text: txt, label: txt, onClick: () => { setSelectedId(l.key); setInfoId(l.key) } }
      }
      return m.level !== undefined || m.bubble ? [m] : []
    })
    : []
  const ctxItems = (id: string): CtxItem[] => {
    const i = layout?.buildings.findIndex((b, k) => keyOf(k, b) === id) ?? -1
    const b = i >= 0 ? layout!.buildings[i] : null
    return b ? verbsFor(b, id).map((a) => ({ id: a.id, label: a.label, icon: a.icon, kind: a.kind, off: a.off, onClick: a.onClick })) : []
  }
  // desktop: a right click on a building opens the same verbs as the ring (and the same role rules)
  const onContext = (e: React.MouseEvent) => {
    if (!useRing || !chrome?.desktop || !canvasRef.current) return
    const r = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    let best: string | null = null, bd = 64
    for (const l of labels) {
      if (!l.visible) continue
      const b = layout?.buildings.find((x, i) => keyOf(i, x) === l.key)
      if (!b || !b.id || b.type === 'road') continue
      const d = Math.hypot(px - l.x, py - (l.y + 22))
      if (d < bd) { bd = d; best = l.key }
    }
    if (!best) return
    e.preventDefault()
    setSelectedId(null)
    setCtx({ x: e.clientX, y: e.clientY, id: best })
  }

  // events worth a line
  const lastEventSeq = useRef(0)
  useEffect(() => {
    const ev = v.lastEvent
    if (!ev || ev.seq === lastEventSeq.current) return
    lastEventSeq.current = ev.seq
    const name = ev.type_code ? buildingName(cat, ev.type_code) : (ev.code ?? ev.player_name ?? '')
    if (ev.type === 'build_finished' || ev.type === 'build_cancelled' || ev.type === 'build_salvaged') toast.push(t(`event.${ev.type}`, { name }), { kind: ev.type === 'build_finished' ? 'success' : 'warning' })
    else if (ev.type === 'member_joined' || ev.type === 'member_left') toast.push(t(`event.${ev.type}`, { name: ev.player_name ?? '' }), { kind: ev.type === 'member_joined' ? 'success' : 'info' })
  }, [v.lastEvent, cat, toast])

  // -- render -----------------------------------------------------------------------------
  if (!id) {
    return (
      <div className="vh">
        <div className="vh-top"><HeaderBar title={t('village.title')} onBack={() => openLocal('society_hub')} /></div>
        <div className="vh-msg" style={{ background: 'transparent', color: 'var(--text-dim)' }}>
          <div>{t('village.none')}</div><div style={{ fontSize: 13 }}>{t('village.none_hint')}</div>
        </div>
      </div>
    )
  }

  const name = layout?.settlement.name ?? bootstrap?.settlement?.name ?? t('village.title')
  const member = !!layout?.viewer.member
  const canPlace = !!layout?.viewer.can_place
  const buildingsByKey = new Map((layout?.buildings ?? []).map((b, i) => [keyOf(i, b), b]))
  const inBuild = build.state.step !== 'off'

  return (
    <div className={`vh${mapOn ? ' vh--map' : ''}`} onContextMenu={onContext}>
      <canvas ref={canvasRef} className="vh-canvas" />
      {mapOn && mapHome && world && <WorldMap world={world} home={mapHome} run={run} openLocal={openLocal} onLeft={leftMap} leaveRef={mapLeave} />}

      {mapOn ? null : useRing ? (
        <MapOverlays marks={marks} ring={ring ?? lotRingModel} onDismiss={() => { setSelectedId(null); setLotRing(null) }} />
      ) : (
      <div className="vh-labels">
        {labels.filter((l) => l.visible).map((l) => {
          const b = buildingsByKey.get(l.key)
          if (!b) return null
          const going = b.state === 'under_construction' || b.state === 'planned'
          const isSel = l.key === selectedId
          if (!going && !isSel) return null
          return (
            <div key={l.key} className={`vh-pill${isSel ? ' sel' : ''}`} style={{ left: l.x, top: l.y }}>
              {going && <Emboss name="clock" palette="gold" size={14} />}
              {isSel && <span>{buildingName(cat, b.type)}</span>}
              {going && b.finish_at && <span>{countdown(b.finish_at, now)}</span>}
              {going && !isSel && b.started_at && <span style={{ opacity: 0.7 }}>{Math.round(constructionProgress(b, now) * 100)}%</span>}
            </div>
          )
        })}
      </div>
      )}

      <div className="vh-top" ref={topRef}>
        {!own && (
          <span className="vh-pill-btn" style={{ pointerEvents: 'none' }}>
            <Emboss name="house" palette="gold" size={16} />
            <span className="vh-pill-name">{name}</span>
          </span>
        )}
        {layout && !member && <div className="vh-note">{t('village.coarse_note')}</div>}
      </div>

      <div className="vh-side">
        {mapOn ? (
          <button className="k-hdr-btn" onClick={() => mapLeave.current?.()} aria-label={t('wm.btn.home')}><Emboss name="house" palette="gold" size={22} /></button>
        ) : (
          <button className="k-hdr-btn" onClick={() => (mapHome ? setMapOn(true) : sceneRef.current?.frame('aerial'))} aria-label={t(mapHome ? 'wm.btn.world' : 'village.btn.aerial')}><Emboss name="world" palette="gold" size={22} /></button>
        )}
        <button className="k-hdr-btn" onClick={() => (mapOn ? window.dispatchEvent(new Event('tc:maptilt')) : sceneRef.current?.frame('close'))} aria-label={mapOn ? t(mapTilt ? 'wm.btn.flat' : 'wm.btn.tilt') : t('village.btn.close')}><Emboss name="eye" palette="gold" size={22} /></button>
      </div>

      <div className="vh-bottom" ref={bottomRef}>
        {inBuild ? (
          <BuildPanel
            state={build.state} fits={build.fits} footprint={build.footprint} cat={cat}
            onExit={build.exit} onChoose={(c) => void build.choose(c)} onRotate={() => void build.rotate()}
            onNext={() => void build.next()} onConfirm={() => void build.confirm()} onBack={build.back}
            onUndo={build.undoPick} onClear={build.clearPicks} onPathMode={build.setPathMode}
            canDraw={canPlace} plans={layout?.land?.plans ?? []} onEnterRoad={build.enterRoad} onRoadClass={build.roadClass}
            onRoadConfirm={() => void build.roadConfirm()} onRoadCancel={(id) => void build.roadCancel(id)}
          />
        ) : null}
        {!inBuild && resident && landOn && (
          <Frame radius={20}>
            <div className="vh-panel">
              <div className="vh-panel-head">
                <span style={{ width: 34 }} />
                <GLabel className="vh-panel-title" top="#fff6c8" bottom="#ffb21f" stroke={1}>{t('citizen.bar.land')}</GLabel>
                <button className="vh-x" onClick={() => setLandOn(false)} aria-label={t('citizen.land.exit')}>✕</button>
              </div>
              <div className="vh-legend">
                <span><i className="vh-dot" style={{ background: '#1acc40' }} />{t('citizen.legend.free')}{layout?.terms ? ` · ${money(layout.terms.lot_price)}` : ''}</span>
                <span><i className="vh-dot" style={{ background: '#ffe60d' }} />{t('citizen.legend.needs')}</span>
                <span><i className="vh-dot" style={{ background: '#1a80ff' }} />{t('citizen.legend.bridge')}</span>
                <span><i className="vh-dot" style={{ background: '#f21414' }} />{t('citizen.legend.locked')}</span>
                <span><i className="vh-dot" style={{ background: '#a84dff' }} />{t('citizen.legend.mine')}</span>
                <span><i className="vh-dot" style={{ background: '#ff4db3' }} />{t('citizen.legend.mine_locked')}</span>
                <span><i className="vh-dot" style={{ background: '#9aa0b4' }} />{t('citizen.legend.taken')}</span>
              </div>
              <div className="vh-hint">{t('citizen.land.hint')}</div>
              {canPlace && (
                <button className="vh-chip road" onClick={() => { setLandOn(false); void build.enter().then(() => build.enterRoad()) }}>{t('road.draw_btn')}</button>
              )}
            </div>
          </Frame>
        )}
      </div>
      <BuildingSheet building={useRing ? (layout?.buildings.find((b, i) => keyOf(i, b) === infoId) ?? null) : selected} canPlace={canPlace} cat={cat} store={store}
        startSite={infoSite}
        onClose={() => { setInfoId(null); setInfoSite(false); if (!useRing) setSelectedId(null) }}
        onOpen={(screen) => openLocal(screen)} onBuild={(code) => { void build.enter().then(() => build.choose(code)) }}
        onMine={() => { setSelectedId(null); setInfoId(null); run('settlement.mine') }}
        onManage={(bid) => { setSelectedId(null); setInfoId(null); run('settlement.lot.manage', { building: bid }) }} canPublicBuild={canPublicBuild} />
      {upId && (() => {
        const ub = layout?.buildings.find((b, i) => keyOf(i, b) === upId)
        return ub ? <UpgradeConfirm building={ub} cat={cat} onClose={() => setUpId(null)} onOpen={(screen) => openLocal(screen)} onBuild={(code) => { setSelectedId(null); void build.enter().then(() => build.choose(code)) }} /> : null
      })()}
      {ctx && <ContextMenu at={ctx} title={(() => { const ub = layout?.buildings.find((b, i) => keyOf(i, b) === ctx.id); return ub ? buildingName(cat, ub.type) : '' })()} items={ctxItems(ctx.id)} onClose={() => setCtx(null)} />}
      <BuyLotSheet lot={buyLot} price={layout?.terms?.lot_price} onClose={() => setBuyLot(null)} store={store} onOther={(l) => setBuyLot(l)} />
      <HouseSheet lot={houseLot} cat={cat} onClose={() => setHouseLot(null)} store={store}
        onNoRoad={(view) => { setHouseLot(null); setFixView(view); setFixLot({ x: view.x, y: view.y }) }} />
      <LotAccessSheet lot={fixLot} initial={fixView} onClose={() => { setFixLot(null); setFixView(null) }} store={store} />
      <TakenLotSheet lot={takenLot} owner={takenLot?.owner} onClose={() => setTakenLot(null)} />

      {(v.status === 'loading' || (v.status === 'ready' && !sceneReady && !sceneError)) && <div className="vh-msg" style={{ background: 'linear-gradient(180deg,#dcebf3,#eaf3ee)' }}><span>{t('village.loading')}</span></div>}
      {(v.status === 'error' || sceneError) && (
        <div className="vh-msg">
          <span>{sceneError ? t('village.webgl') : t('village.load_failed')}</span>
          {!sceneError && <Slab tone="gold" onClick={() => void store?.load(true)}>{t('village.retry')}</Slab>}
        </div>
      )}
    </div>
  )
}

function HeaderBar({ title, onBack, onRefresh }: { title: string; onBack?: () => void; onRefresh?: () => void }) {
  return <Header title={title} tone="emerald" onBack={onBack} onRefresh={onRefresh} />
}
