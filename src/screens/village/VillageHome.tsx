// The village home: the player's settlement on its real terrain in 3D, a
// header with name, tier and literacy, buttons to the status screens, and
// the head's build mode. A neighbour's village (`localArgs.id`) is drawn the
// same way from the coarse layout, without the build controls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScreenProps } from '../types'
import { Emboss, Plate, Slab } from '../../kit'
import { Header } from '../native/kit/Parts'
import Emblem from '../../lib/emblem'
import { emblemHex } from '../../lib/emblemPalette'
import BottomSheet from '../../ui/BottomSheet'
import { money } from '../native/kit/format'
import DonateSheet from './Donate'
import { t } from '../../i18n'
import { useSession } from '../../state/SessionContext'
import { useToast } from '../../state/ToastContext'
import { buildingName, useBuildingCatalogue, useNow, useSettlementId, useVillage } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import type { VillageScene, ScreenLabel } from '../../village/villageScene'
import { clockSkewMs } from '../../village/clock'
import { report } from '../../lib/reporter'
import { countdown, useVillageView } from './common'
import type { VillageOverviewView } from '../../api/types'
import { useBuildMode } from './useBuildMode'
import BuildPanel from './BuildPanel'
import BuildingSheet from './BuildingSheet'
import './village.css'

export default function VillageHome({ localArgs, openLocal }: ScreenProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)
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
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const own = !localArgs?.id
  const overview = useVillageView<VillageOverviewView>('settlement.overview', null, {}, own)
  const build = useBuildMode(store, layout, sceneRef, cat)
  const tapRef = useRef<(lot: { x: number; y: number } | null, bid: string | null) => void>(() => undefined)

  // «ساخت» in the menu opens the village straight in build mode
  const wantBuild = useRef(!!localArgs?.build)
  useEffect(() => {
    if (wantBuild.current && sceneReady && layout?.viewer.can_place) { wantBuild.current = false; void build.enter() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, layout?.viewer.can_place])

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
      const top = topRef.current ? topRef.current.getBoundingClientRect().bottom - r.top + 4 : 0
      const bottom = bottomRef.current ? r.bottom - bottomRef.current.getBoundingClientRect().top + 4 : 0
      scene.setInsets(Math.max(0, top), Math.max(0, bottom))
      if (!framedRef.current) { framedRef.current = true; scene.frame('aerial') }
    }
    sync()
    const ro = new ResizeObserver(sync)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    return () => ro.disconnect()
  }, [sceneReady, build.state.step, layout?.viewer.member])

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
    if (build.state.step !== 'off') return
    setSelectedId(bid)
  }

  useEffect(() => { sceneRef.current?.setSelectedBuilding(build.state.step === 'off' ? selectedId : null) }, [selectedId, build.state.step, sceneReady])

  // a building that disappeared closes its sheet
  const keyOf = useCallback((i: number, b: { id?: string }) => b.id ?? `i${i}`, [])
  const selected = useMemo(() => {
    if (!layout || !selectedId) return null
    const idx = layout.buildings.findIndex((b, i) => keyOf(i, b) === selectedId)
    return idx >= 0 ? layout.buildings[idx] : null
  }, [layout, selectedId, keyOf])

  // events worth a line
  const lastEventSeq = useRef(0)
  useEffect(() => {
    const ev = v.lastEvent
    if (!ev || ev.seq === lastEventSeq.current) return
    lastEventSeq.current = ev.seq
    const name = ev.type_code ? buildingName(cat, ev.type_code) : (ev.code ?? ev.player_name ?? '')
    if (ev.type === 'build_finished' || ev.type === 'build_cancelled' || ev.type === 'build_salvaged') toast.push(t(`event.${ev.type}`, { name }))
    else if (ev.type === 'member_joined' || ev.type === 'member_left') toast.push(t(`event.${ev.type}`, { name: ev.player_name ?? '' }))
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
  const tier = layout?.settlement.tier ?? 'village'
  const literacy = own ? overview.view?.literacy_percent ?? null : null
  const online = v.players?.online
  const buildingsByKey = new Map((layout?.buildings ?? []).map((b, i) => [keyOf(i, b), b]))
  const inBuild = build.state.step !== 'off'

  return (
    <div className="vh">
      <canvas ref={canvasRef} className="vh-canvas" />

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
              {going && <span>{countdown(b.finish_at, now)}</span>}
              {going && !isSel && b.started_at && <span style={{ opacity: 0.7 }}>{Math.round(constructionProgress(b, now) * 100)}%</span>}
            </div>
          )
        })}
      </div>

      <div className="vh-top" ref={topRef}>
        <button className="vh-pill-btn" onClick={() => setInfoOpen(true)} aria-label={t('village.pill.aria')}>
          {bootstrap?.settlement?.emblem
            ? <Emblem shape={bootstrap.settlement.emblem.shape} colorA={emblemHex(bootstrap.settlement.emblem.color_a)} colorB={emblemHex(bootstrap.settlement.emblem.color_b)} icon={bootstrap.settlement.emblem.icon} size={18} />
            : <Emboss name="house" palette="gold" size={16} />}
          <span className="vh-pill-name">{name}</span>
        </button>
        {layout && !member && <div className="vh-note">{t('village.coarse_note')}</div>}
      </div>

      <div className="vh-side">
        <button className="k-hdr-btn" onClick={() => sceneRef.current?.frame('aerial')} aria-label={t('village.btn.aerial')}><Emboss name="world" palette="gold" size={22} /></button>
        <button className="k-hdr-btn" onClick={() => sceneRef.current?.frame('close')} aria-label={t('village.btn.close')}><Emboss name="eye" palette="gold" size={22} /></button>
      </div>

      <div className="vh-bottom" ref={bottomRef}>
        {inBuild ? (
          <BuildPanel
            state={build.state} fits={build.fits} footprint={build.footprint} cat={cat}
            onExit={build.exit} onChoose={(c) => void build.choose(c)} onRotate={() => void build.rotate()}
            onNext={() => void build.next()} onConfirm={() => void build.confirm()} onBack={build.back}
          />
        ) : null}
      </div>
      {!inBuild && canPlace && member && (
        <button className="vh-fab" onClick={() => void build.enter()} aria-label={t('village.btn.build')}>
          <Plate size={54} rim="#ffd66b"><Emboss name="house" palette="gold" size={32} /></Plate>
          <span>{t('village.build_fab')}</span>
        </button>
      )}

      <BottomSheet open={infoOpen} onClose={() => setInfoOpen(false)} title={t('village.sheet.title', { name })}>
        <div className="vh-info">
          <InfoRow label={t('village.sheet.tier')} value={t(`village.tier.${tier}` as never)} />
          {literacy !== null && <InfoRow label={t('village.sheet.literacy')} value={`${literacy}%`} />}
          {online !== undefined && <InfoRow label={t('village.sheet.online')} value={String(online)} />}
          {layout && <InfoRow label={t('village.sheet.role')} value={canPlace ? t('village.head') : member ? t('village.member') : t('village.visitor')} />}
          {own && overview.view && <InfoRow label={t('village.sheet.treasury')} value={money(overview.view.treasury)} gold />}
        </div>
        <div className="vh-sheet-actions">
          <Slab tone="steel" radius={14} lip={4} onClick={() => { setInfoOpen(false); openLocal('village_overview') }}>{t('village.sheet.details')}</Slab>
          {own && member && <Slab tone="gold" radius={14} lip={4} onClick={() => { setInfoOpen(false); setDonateOpen(true) }}>{t('village.sheet.donate')}</Slab>}
        </div>
      </BottomSheet>
      <DonateSheet open={donateOpen} onClose={() => setDonateOpen(false)} onDone={() => void overview.refresh()} />

      <BuildingSheet building={selected} canPlace={canPlace} cat={cat} store={store} onClose={() => setSelectedId(null)} />

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

function InfoRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return <div className="vh-info-row"><span>{label}</span><b style={gold ? { color: 'var(--gold)' } : undefined}>{value}</b></div>
}

function HeaderBar({ title, onBack, onRefresh }: { title: string; onBack?: () => void; onRefresh?: () => void }) {
  return <Header title={title} tone="emerald" onBack={onBack} onRefresh={onRefresh} />
}
