// The overlays on the village, drawn in a DOM layer above the 3D canvas (the scene itself is never touched):
// level plaque, green upgrade arrow, construction chip, status and output bubbles, and the building ring with its
// name plate. Positions come from the scene's own projected labels; what each viewer sees (and may do) comes from
// the server's per-viewer data (the layout and the building panel), never from a client-side guess.

import { useLayoutEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { Ic } from './parts'
import { fa } from './format'
import { planRing, SIZE, type RingPlan } from './ringLayout'
import { useChrome } from './chrome'

export interface Mark {
  key: string
  x: number
  y: number
  /** the level plaque (omitted when this viewer is not shown one) */
  level?: number
  /** a green arrow: only when the server says this viewer can upgrade it */
  canUpgrade?: boolean
  /** under construction: percent done */
  building?: number
  /** a speech bubble with the reason a building cannot work, or an output ready to collect */
  bubble?: { kind: 'status' | 'out'; icon: string; text: string; label: string; onClick: () => void }
}

export interface RingAction {
  id: string
  label: string
  icon: string
  kind?: 'primary' | 'info'
  off?: boolean
  badge?: string
  onClick: () => void
}

export interface RingModel {
  key: string
  name: string
  level?: number
  anchor: [number, number]
  actions: RingAction[]
  onInfo: () => void
}

export function MapOverlays({ marks, ring, onDismiss }: { marks: Mark[]; ring: RingModel | null; onDismiss: () => void }) {
  return (
    <div className={`v6-ovl${ring ? ' ringed' : ''}`} data-ring={ring?.key ?? ''}>
      <div className="v6-dim" style={ring ? { '--sx': `${ring.anchor[0]}px`, '--sy': `${ring.anchor[1] - 6}px` } as React.CSSProperties : undefined} />
      {marks.map((m) => <MarkView key={m.key} m={m} />)}
      {ring && <Ring key={ring.key} model={ring} onDismiss={onDismiss} />}
    </div>
  )
}

function MarkView({ m }: { m: Mark }) {
  // the plaque sits just under the building's top point, the arrow above it
  const px = m.x, py = m.y + 14
  return (
    <>
      {m.building !== undefined
        ? <div className="v6-cons v6-mark" style={{ left: px, top: py }}><Ic name="hammer" /><b>{fa(m.building)}٪</b></div>
        : m.level !== undefined && (
          <>
            <div className="v6-plq v6-mark" style={{ left: px, top: py }}>{fa(m.level)}</div>
            {m.canUpgrade && <div className="v6-arw v6-mark" style={{ left: px, top: py - 10 }}><Ic name="up" /></div>}
          </>
        )}
      {m.bubble && (
        <button className={`v6-bub${m.bubble.kind === 'out' ? ' out' : ''}`} style={{ left: m.x, top: m.y - 6 }} onClick={(e) => { e.stopPropagation(); m.bubble!.onClick() }} aria-label={m.bubble.label}>
          <Ic name={m.bubble.icon} />{m.bubble.kind === 'out' ? <b>{m.bubble.text}</b> : <span>{m.bubble.text}</span>}
        </button>
      )}
    </>
  )
}

/** The ring: name plate, then at most 5 buttons fanned out; the primary is the largest and gold, «اطلاعات» the
 * least prominent and first. It flips above the building when below does not fit and is clamped into the safe rect. */
function Ring({ model, onDismiss }: { model: RingModel; onDismiss: () => void }) {
  const chrome = useChrome()
  const root = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<RingPlan | null>(null)
  const [open, setOpen] = useState(false)
  const actions = model.actions.slice(0, 5)

  useLayoutEffect(() => {
    const host = root.current?.parentElement
    if (!host) return
    const hr = host.getBoundingClientRect()
    const plate = root.current!.querySelector<HTMLElement>('.v6-rplate')!
    const labs = [...root.current!.querySelectorAll<HTMLElement>('.v6-rlab')]
    const specs = actions.map((a, j) => ({ size: a.kind === 'primary' ? SIZE.primary : a.kind === 'info' ? SIZE.info : SIZE.normal, lw: labs[j]?.offsetWidth ?? 60, lh: labs[j]?.offsetHeight ?? 22 }))
    const hud = chrome?.hud(), bottom = chrome?.bottom()
    const safe = {
      x0: 8, x1: hr.width - 8,
      y0: Math.max(8, hud && !chrome?.desktop ? Math.round(hud.bottom - hr.top + 8) : 8),
      y1: Math.round((bottom && !chrome?.desktop ? bottom.top - hr.top : hr.height) - 8),
    }
    const avoid = (chrome?.sides() ?? []).map((r) => ({ edge: (r.left + r.width / 2 < hr.left + hr.width / 2 ? 'l' : 'r') as 'l' | 'r', x0: r.left - hr.left, x1: r.right - hr.left, y0: r.top - hr.top, y1: r.bottom - hr.top }))
    setPlan(planRing(model.anchor, specs, plate.offsetWidth, safe, avoid))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.anchor[0], model.anchor[1], actions.length])

  useLayoutEffect(() => {
    if (!plan) return
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [plan])

  // Escape dismisses the ring (the shell skips its own Escape while a ring is up)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.v6-scrim')) onDismiss() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onDismiss])

  const put = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`
  const ax = model.anchor[0], ay = model.anchor[1]
  const at = (px: number, py: number, s: number, i: number) => ({ transform: put(open && plan ? px : ax, open && plan ? py : ay, open ? 1 : s), transitionDelay: open ? `${i * 14}ms` : '0ms' })

  return (
    <div ref={root} className="v6-ring" style={{ display: 'contents' }}>
      <button className={`v6-rplate${open ? ' v6-ring-open' : ''}`} onClick={(e) => { e.stopPropagation(); model.onInfo() }} aria-label={`${model.name}، ${t('v6.ring.info')}`}
        style={{ transform: put(open && plan ? plan.plateX : ax, open && plan ? plan.plateY : ay, open ? 1 : 0.6) }}>
        <span>{model.name}</span>{model.level !== undefined && <b className="v6-pl">{fa(model.level)}</b>}<Ic name="chev" />
      </button>
      {actions.map((a, j) => {
        const size = a.kind === 'primary' ? SIZE.primary : a.kind === 'info' ? SIZE.info : SIZE.normal
        const it = plan?.items[j]
        return (
          <span key={a.id} style={{ display: 'contents' }}>
            <button className={`v6-rbtn${a.kind ? ' ' + a.kind : ''}${a.off ? ' off' : ''}${open ? ' v6-ring-open' : ''}`} data-act={a.id}
              style={{ width: size, height: size, ...at(it?.x ?? ax, it?.y ?? ay, 0.3, j) }}
              aria-label={a.label} data-tip={a.label}
              onClick={(e) => { e.stopPropagation(); a.onClick() }}>
              <Ic name={a.icon} />{a.badge && <span className="v6-badge">{a.badge}</span>}
            </button>
            <span className={`v6-rlab${a.kind === 'primary' ? ' primary' : ''}${a.off ? ' off' : ''}${open ? ' v6-ring-open' : ''}`} style={at(it?.x ?? ax, it?.ly ?? ay, 0.3, j)}>{a.label}</span>
          </span>
        )
      })}
    </div>
  )
}
