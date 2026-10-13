// The city tab IS the game: the 3D world fills the screen and the shell's chrome floats over it. This view mounts the
// world engine (src/village/villageScene.ts, no UI in it) and draws its own overlays: the city's tag, a plate on each
// building site with its progress, the camera buttons. A tap on a building opens that building's own panel
// (settlement.building.view); a tap on the ground clears the selection.

import { useEffect, useRef, useState } from 'react'
import type { NScreenProps } from '../../registry'
import type { VillageScene, ScreenLabel } from '../../../village/villageScene'
import { useNav } from '../../nav'
import { Icon } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { useBuildingCatalogue, buildingName, useNow, useSettlementId, useVillage } from '../../../village/useVillage'
import { constructionProgress } from '../../../village/progress'
import { clockSkewMs } from '../../../village/clock'
import { report } from '../../../lib/reporter'
import { fa } from '../../../ui/v6/format'
import { formatNumber } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'

export default function Game({ args }: NScreenProps) {
  const nav = useNav()
  const { bootstrap } = useSession()
  const id = useSettlementId(args?.id)
  const v = useVillage(id)
  const { layout, ground, world, store } = v
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const scene = useRef<VillageScene | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [labels, setLabels] = useState<ScreenLabel[]>([])
  const layoutRef = useRef(layout); layoutRef.current = layout
  const navRef = useRef(nav); navRef.current = nav

  // the ground arrives after the layout
  useEffect(() => { if (store && v.status === 'ready' && !ground) void store.ensureGround() }, [store, v.status, ground])

  // the world engine, once the ground exists
  useEffect(() => {
    const cv = canvas.current
    if (!cv || !ground || !world || !layoutRef.current) return
    let cancelled = false
    let ro: ResizeObserver | null = null
    let made: VillageScene | null = null
    void import('../../../village/villageScene').then(async ({ VillageScene }) => {
      try {
        const s = await VillageScene.create(cv, ground, world, layoutRef.current!, {
          onTap: (_lot, bid) => {
            if (bid) { s.setSelection(null); navRef.current.run('settlement.building.view', { building_id: bid }) }
          },
          onLabels: setLabels,
          clockSkewMs,
        })
        if (cancelled) { s.dispose(); return }
        made = s
        scene.current = s
        s.resize()
        ro = new ResizeObserver(() => s.resize())
        ro.observe(cv)
        s.frame('aerial')
        setReady(true)
      } catch (e) {
        report('village', 'next: scene failed: ' + String(e))
        if (!cancelled) setFailed(true)
      }
    })
    return () => { cancelled = true; ro?.disconnect(); made?.dispose(); if (scene.current === made) scene.current = null; setReady(false) }
  }, [ground, world, store])

  // the layout moves (a building finished, a new site): the world follows
  useEffect(() => { if (ready && layout) scene.current?.setLayout(layout) }, [ready, layout])
  // the dock's city tab pressed again: the whole city back in view
  useEffect(() => {
    const on = () => scene.current?.frame('aerial')
    window.addEventListener('tc:recentre', on)
    return () => window.removeEventListener('tc:recentre', on)
  }, [])

  const sites = new Map((layout?.buildings ?? []).filter((b) => b.id && b.finish_at && Date.parse(b.finish_at) > now).map((b) => [b.id!, b]))
  const name = layout?.settlement.name ?? bootstrap?.settlement?.name ?? ''
  const buildings = layout?.buildings.length ?? 0

  return (
    <div className="n-world">
      <canvas ref={canvas} aria-label={t('next.world', { name })} />
      <div className="n-world-shade-t" />
      <div className="n-world-shade-b" />
      {!id && <div className="n-world-msg"><p className="n-text">{t('next.no_city')}</p></div>}
      {failed && <div className="n-world-msg"><p className="n-text">{t('next.world_failed')}</p></div>}

      {ready && labels.map((l) => {
        const b = sites.get(l.key)
        if (!b) return null
        const pct = Math.round(constructionProgress(b, now) * 100)
        return (
          <button key={l.key} className={`n-plate lit${l.visible ? '' : ' hidden'}`} style={{ left: l.x, top: l.y }}
            onClick={() => nav.run('settlement.building.view', { building_id: l.key })}>
            <Icon name="factory" />{buildingName(cat, b.type)} <b>{fa(pct)}٪</b>
          </button>
        )
      })}

      {name && (
        <button className="n-city-tag" onClick={() => nav.open('city_panel')}>
          <Icon name="city" />
          <span><b>{name}</b><small>{t('next.buildings_n', { n: formatNumber(buildings) })}</small></span>
          <span className="go">{t('next.city_work')}</span>
        </button>
      )}

      <div className="n-world-tools">
        <button onClick={() => scene.current?.frame('aerial')} aria-label={t('next.recentre')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#eef2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
        </button>
      </div>
    </div>
  )
}
