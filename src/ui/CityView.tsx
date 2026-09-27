import { useEffect, useRef, useState } from 'react'
import type { CityEngine, LabelPoint } from '../three/cityEngine'
import { getCityMap } from '../api/client'
import type { CityPlot, CommandResponse } from '../api/types'
import { useSession } from '../state/SessionContext'
import BottomSheet from './BottomSheet'
import { sanitizeTelegramHtml } from '../lib/sanitizeHtml'
import { report } from '../lib/reporter'

export default function CityView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<CityEngine | null>(null)
  const [labels, setLabels] = useState<LabelPoint[]>([])
  const [selected, setSelected] = useState<CityPlot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const { exec } = useSession()

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
      })
      engineRef.current = engine

      getCityMap()
        .then((map) => {
          if (cancelled) return
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

  return (
    <div className="city-view">
      <canvas ref={canvasRef} className="city-canvas" />
      <div className="city-labels">
        {labels.filter((l) => l.visible).map((l) => (
          <div key={l.id} className="city-label" style={{ left: l.x, top: l.y }}>{l.text}</div>
        ))}
      </div>
      {loading && <div className="city-loading"><div className="skeleton" style={{ width: 160, height: 22 }} /></div>}
      {loadError && <div className="city-error">نقشه‌ی شهر بارگذاری نشد.</div>}

      <PlotSheet plot={selected} onClose={() => setSelected(null)} exec={exec} />

      <style>{`
        .city-view { position: relative; flex: 1; overflow: hidden; background: #0b1330; }
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
