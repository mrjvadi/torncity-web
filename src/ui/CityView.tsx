import { useEffect, useMemo, useRef, useState } from 'react'
import type { CityEngine, LabelPoint, BubbleScreenPoint, BubbleAnchor } from '../three/cityEngine'
import { getCityMap } from '../api/client'
import type { CityMap, CityPlot, CommandResponse } from '../api/types'
import { useSession } from '../state/SessionContext'
import { useToast } from '../state/ToastContext'
import BottomSheet from './BottomSheet'
import SidePlates from './home/SidePlates'
import WorldBubbles, { type WorldBubbleDef } from './home/WorldBubbles'
import ReadyToast from './home/ReadyToast'
import { sanitizeTelegramHtml } from '../lib/sanitizeHtml'
import { report } from '../lib/reporter'
import { formatNumber } from '../lib/persian'
import type { TabKey } from './Dock'

interface CityViewProps {
  /** Switches the shell's own tab (missions -> activity, rank -> profile,
   * faction -> society): the side plates reuse real navigation, never a
   * command that does not exist yet. */
  onTab?: (tab: TabKey) => void
  /** Opens the shell's notification sheet, for the "پیام‌ها" plate. */
  onInbox?: () => void
}

interface JobStatusView {
  employed?: boolean
  workplace?: { code?: string; name?: string } | null
  shift?: { remaining_seconds?: number } | null
}

export default function CityView({ onTab, onInbox }: CityViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<CityEngine | null>(null)
  const [labels, setLabels] = useState<LabelPoint[]>([])
  const [bubblePoints, setBubblePoints] = useState<BubbleScreenPoint[]>([])
  const [cityMap, setCityMap] = useState<CityMap | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatusView | null>(null)
  const [selected, setSelected] = useState<CityPlot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const { exec, profile } = useSession()
  const toast = useToast()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let ro: ResizeObserver | null = null

    // three.js is heavy; load it only once the player actually opens the
    // city tab, so it never weighs down login or the other tabs.
    import('../three/cityEngine').then(({ CityEngine }) => {
      if (cancelled) return
      const engine = new CityEngine(canvas, {
        onPlotTap: (plot) => setSelected(plot),
        onLabels: setLabels,
        onBubbles: setBubblePoints,
      })
      engineRef.current = engine

      getCityMap()
        .then((map) => {
          if (cancelled) return
          setCityMap(map)
          void engine.loadCity(map)
        })
        .catch((e) => {
          report('city_map', 'failed to load city: ' + String(e))
          setLoadError(true)
        })
        .finally(() => !cancelled && setLoading(false))

      ro = new ResizeObserver(() => engine.resize())
      ro.observe(canvas)
    })

    return () => {
      cancelled = true
      ro?.disconnect()
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  // the shift-ready world bubble needs the workplace's place code, which
  // only job_status (not the profile view) carries; fetched once the city
  // and the player are both known, so the bubble can be dropped if there is
  // nothing real to anchor it to
  useEffect(() => {
    let cancelled = false
    if (!cityMap || !profile) return
    exec('job.status').then((res) => {
      if (!cancelled && res?.ok && res.view) setJobStatus(res.view as JobStatusView)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityMap, !!profile])

  const work = profile?.work as { job?: { job?: { career_code?: string }; pay?: number; shift_ends_in_seconds?: number }; course?: { course?: { code?: string; name?: string }; remaining_seconds?: number; paused?: boolean } } | undefined

  const bubbles = useMemo<WorldBubbleDef[]>(() => {
    const list: WorldBubbleDef[] = []
    if (jobStatus?.employed && !(jobStatus.shift && (jobStatus.shift.remaining_seconds ?? 0) > 0)) {
      list.push({ id: 'bubble:work', text: 'شیفت آماده', icon: 'check', palette: 'teal', tint: 'teal', onTap: () => { void exec('job.work') } })
    }
    const course = work?.course
    if (course?.course?.code && !course.paused && (course.remaining_seconds ?? 1) <= 0) {
      list.push({ id: 'bubble:study', text: 'مدرک آماده', icon: 'study', palette: 'violet', tint: 'violet' })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus, work?.course?.course?.code, work?.course?.remaining_seconds, work?.course?.paused])

  const bubbleAnchors = useMemo<BubbleAnchor[]>(() => {
    if (!cityMap) return []
    const anchors: BubbleAnchor[] = []
    const workplaceCode = jobStatus?.workplace?.code
    if (workplaceCode) {
      const plot = cityMap.plots.find((p) => p.kind === 'place' && p.ref?.code === workplaceCode)
      if (plot) anchors.push({ id: 'bubble:work', x: plot.x + plot.w / 2, y: 1.7, z: plot.y + plot.h / 2 })
    }
    const hereCode = profile?.place?.code
    if (hereCode) {
      const plot = cityMap.plots.find((p) => p.kind === 'place' && p.ref?.code === hereCode)
      if (plot) anchors.push({ id: 'bubble:study', x: plot.x + plot.w / 2, y: 1.7, z: plot.y + plot.h / 2 })
    }
    return anchors
  }, [cityMap, jobStatus?.workplace?.code, profile?.place?.code])

  useEffect(() => {
    engineRef.current?.setBubbleAnchors(bubbleAnchors)
  }, [bubbleAnchors])

  // the plot sheet fully covers the canvas while it's open — no reason to
  // keep the city rendering underneath it
  useEffect(() => {
    engineRef.current?.setActive(!selected)
  }, [selected])

  // the bottom ready-toast: only when there is a real reason for it —
  // energy not yet full, a job to work, and no shift already running
  const energyFullIn = profile?.energy_full_in_seconds ?? 0
  const energyFull = !!profile && profile.energy >= profile.max_energy
  const onShift = !!work?.job && (work.job.shift_ends_in_seconds ?? 0) > 0
  const employed = !!work?.job?.job?.career_code
  const showToast = !!profile && !energyFull && employed && !onShift && energyFullIn > 0
  const pay = work?.job?.pay ?? 0

  return (
    <div className="city-view">
      <canvas ref={canvasRef} className="city-canvas" />
      <div className="city-labels">
        {labels.filter((l) => l.visible).map((l) => (
          <div key={l.id} className="city-label" style={{ left: l.x, top: l.y }}>{l.text}</div>
        ))}
      </div>

      <SidePlates
        onMissions={() => onTab?.('activity')}
        onGift={() => toast.push('جایزه‌ی روز به‌زودی اضافه می‌شود')}
        onRank={() => onTab?.('profile')}
        onInbox={() => onInbox?.()}
        onFaction={() => onTab?.('society')}
      />
      <WorldBubbles bubbles={bubbles} points={bubblePoints} />
      {/* NBSP in the title keeps "پر می‌شه" together at narrow widths */}
      {showToast && (
        <ReadyToast
          title={`انرژی ${formatNumber(Math.round(energyFullIn / 60))} دقیقه دیگه پر می‌شه`}
          subtitle={pay > 0 ? `یه شیفت برو که هدر نره  ·  +${formatNumber(pay)}` : 'یه شیفت برو که هدر نره'}
          cta="شروع شیفت"
          onTap={() => { void exec('job.work') }}
        />
      )}

      {loading && <div className="city-loading"><div className="skeleton" style={{ width: 160, height: 22 }} /></div>}
      {loadError && <div className="city-error">نقشه‌ی شهر بارگذاری نشد.</div>}

      <PlotSheet plot={selected} onClose={() => setSelected(null)} exec={exec} />

      <style>{`
        /* the dusk sky (city_proto.gd ProceduralSkyMaterial): a CSS gradient
           behind the transparent canvas, not a 3D sphere — see cityEngine's
           buildLights comment for why an orthographic camera needs this */
        .city-view {
          position: relative; flex: 1; overflow: hidden;
          background: linear-gradient(180deg, #16224f 0%, #2c3d7a 32%, #b06a58 58%, #6a5a78 78%, #141a33 100%);
        }
        .city-canvas { width: 100%; height: 100%; display: block; touch-action: none; }
        .city-labels { position: absolute; inset: 0; pointer-events: none; }
        .city-label {
          position: absolute; transform: translate(-50%, -100%);
          background: rgba(7,10,20,0.7); border: 1px solid var(--gold-soft);
          color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 8px;
          white-space: nowrap;
        }
        .city-loading, .city-error {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          background: rgba(7,10,20,0.8); padding: 8px 14px; border-radius: 12px; color: var(--text-dim); font-size: 13px;
        }
      `}</style>
    </div>
  )
}

function PlotSheet({ plot, onClose, exec }: { plot: CityPlot | null; onClose: () => void; exec: (c: string, a?: Record<string, string>) => Promise<CommandResponse | null> }) {
  const [company, setCompany] = useState<CommandResponse | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCompany(null)
    if (plot?.kind === 'company' && plot.ref?.company_id) {
      setBusy(true)
      exec('company.show', { id: plot.ref.company_id }).then((r) => {
        setCompany(r)
        setBusy(false)
      })
    }
  }, [plot, exec])

  if (!plot) return null
  const name = plot.name?.fa || plot.name?.en || plot.id

  return (
    <BottomSheet open={!!plot} onClose={onClose} title={name}>
      {plot.kind === 'company' && (
        busy ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : company?.text ? (
          <div className="screen-text" dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(company.text) }} />
        ) : (
          <p style={{ color: 'var(--text-dim)' }}>اطلاعاتی برای این کسب‌وکار یافت نشد.</p>
        )
      )}
      {plot.kind === 'place' && plot.ref?.code && (
        <button
          className="action-primary display"
          style={{ width: '100%' }}
          onClick={() => { void exec('place.go', { place: plot.ref!.code! }); onClose() }}
        >
          برو به {name}
        </button>
      )}
      {plot.kind === 'decor' && <p style={{ color: 'var(--text-dim)' }}>{name}</p>}
    </BottomSheet>
  )
}
