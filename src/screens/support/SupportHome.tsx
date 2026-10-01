// The village tab while the player is in Support: the neutral city in 3D, its
// services as buildings with labels; a tap on one opens its screen. The city
// (kit, plan, scene) is its own lazy chunk: nothing here loads before the
// player is actually in Support.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScreenProps } from '../types'
import { Emboss, Slab } from '../../kit'
import * as api from '../../api/client'
import { report } from '../../lib/reporter'
import { useContentNames } from '../../village/useVillage'
import { t } from '../../i18n'
import { SERVICE_BY_ID } from '../../support/services'
import type { CityPlan, Placed } from '../../support/cityPlan'
import type { SupportLabel, SupportScene } from '../../support/supportScene'
import { useSession } from '../../state/SessionContext'
import './support.css'

const KIT = `${import.meta.env.BASE_URL}support/kit/`

export default function SupportHome({ run, openLocal }: ScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<SupportScene | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)
  const [plan, setPlan] = useState<CityPlan | null>(null)
  const [labels, setLabels] = useState<SupportLabel[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mode, setMode] = useState<'aerial' | 'street'>('aerial')
  const { bootstrap } = useSession()
  const tapRef = useRef<(p: Placed | null) => void>(() => undefined)

  tapRef.current = (p) => {
    if (!p) return
    if (p.service) {
      const s = p.service
      if (s.command) run(s.command, s.args)
      else if (s.local) openLocal(s.local, s.args)
    } else if (p.company) run('company.view', { code: p.company.id })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let ro: ResizeObserver | null = null
    let scene: SupportScene | null = null
    void (async () => {
      try {
        const [{ loadBuildingKit, loadRoadKit }, { planCity }, { SupportScene }, companies] = await Promise.all([
          import('../../support/cityKit'), import('../../support/cityPlan'), import('../../support/supportScene'),
          api.getCityMap('support').then((m) => m.plots.filter((p) => p.kind === 'company' && p.ref?.company_id).map((p) => ({ id: p.ref!.company_id!, name: p.name?.fa || p.name?.en || p.ref!.company_id! }))).catch(() => []),
        ])
        const [b, r] = await Promise.all([loadBuildingKit(KIT + 'buildings/'), loadRoadKit(KIT + 'roads/')])
        if (cancelled) return
        const p = planCity(r, b, companies)
        scene = await SupportScene.create(canvas, p, { b, r }, { onTap: (x) => tapRef.current(x), onLabels: setLabels })
        if (cancelled) { scene.dispose(); return }
        sceneRef.current = scene
        scene.resize()
        scene.frame('aerial', false)
        ro = new ResizeObserver(() => scene?.resize())
        ro.observe(canvas)
        setPlan(p)
        setReady(true)
        if (import.meta.env.DEV || new URLSearchParams(location.search).has('stats') || new URLSearchParams(location.search).get('mock') === '1') {
          ;(window as unknown as { __support?: unknown }).__support = { scene, plan: p }
        }
      } catch (e) {
        report('support', 'scene failed: ' + String(e)); console.error('support scene', e)
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      ro?.disconnect()
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  // the top bar covers the canvas: keep the city in the free part
  useEffect(() => {
    if (!ready) return
    const top = topRef.current
    const sync = () => {
      const cv = canvasRef.current
      if (!cv || !top) return
      sceneRef.current?.setInsets(top.getBoundingClientRect().bottom - cv.getBoundingClientRect().top + 4, 0)
    }
    sync()
    const ro = new ResizeObserver(sync)
    if (top) ro.observe(top)
    return () => ro.disconnect()
  }, [ready])

  const byKey = useMemo(() => new Map((plan?.placed ?? []).map((p) => [p.key, p])), [plan])
  const home = bootstrap?.settlement ? { code: bootstrap.settlement.code, name: bootstrap.settlement.name } : null
  const names = useContentNames()
  const cityName = names.name('city', 'support', bootstrap?.cities.find((c) => c.code === 'support')?.name ?? t('sc.title'))

  function setFrame(m: 'aerial' | 'street') {
    setMode(m)
    sceneRef.current?.frame(m)
  }

  return (
    <div className="sc">
      <canvas ref={canvasRef} className="sc-canvas" />

      <div className="sc-labels">
        {labels.map((l) => {
          const p = byKey.get(l.key)
          if (!p) return null
          const s = p.service
          return (
            <button
              key={l.key}
              className={`sc-pill${s ? '' : ' co'}${s?.soon ? ' soon' : ''}`}
              style={{ left: l.x, top: l.y, borderColor: s?.color ?? '#e8a838' }}
              onClick={() => tapRef.current(p)}
            >
              <Emboss name={s?.icon ?? 'factory'} palette={s?.tone ?? 'amber'} size={16} />
              <span>{s ? t(s.name) : p.company?.name}</span>
            </button>
          )
        })}
      </div>

      <div className="sc-top" ref={topRef}>
        <div className="sc-title">
          <Emboss name="city" palette="gold" size={16} />
          <span>{cityName}</span>
          <span className="sc-visit">{t('sc.visitor')}</span>
        </div>
      </div>

      <div className="sc-side">
        <button className={`k-hdr-btn${mode === 'aerial' ? ' on' : ''}`} onClick={() => setFrame('aerial')} aria-label={t('sc.view.aerial')}><Emboss name="world" palette="gold" size={22} /></button>
        <button className={`k-hdr-btn${mode === 'street' ? ' on' : ''}`} onClick={() => setFrame('street')} aria-label={t('sc.view.street')}><Emboss name="eye" palette="gold" size={22} /></button>
        <button className="k-hdr-btn" onClick={() => openLocal('support_travel')} aria-label={t('sc.travel')}><Emboss name="plane" palette="teal" size={22} /></button>
      </div>

      <div className="sc-return">
        <Slab tone={home ? 'gold' : 'steel'} radius={14} lip={4} onClick={() => openLocal('support_travel', home ? { to: home.code } : undefined)}>
          <Emboss name={home ? 'house' : 'plane'} palette={home ? 'gold' : 'teal'} size={20} />
          <span>{home ? t('sc.return', { name: home.name }) : t('sc.return_generic')}</span>
        </Slab>
      </div>

      {!ready && !failed && <div className="sc-msg"><span>{t('sc.loading')}</span></div>}
      {failed && <div className="sc-msg"><span>{t('sc.failed')}</span></div>}
    </div>
  )
}
