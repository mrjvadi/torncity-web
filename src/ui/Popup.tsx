// The app's one modal: a centred panel with a ribbon title over its top edge,
// a round close button, a maroon girih panel in a gold frame - a port of the
// owner's Godot proto (home_proto.gd `_crime_popup`). Everything that used to
// slide up from the bottom (BottomSheet) is this now.
//
// The body scrolls when it is tall; the header (ribbon + close) and the
// `footer` (the main action) stay put. Escape, the Telegram back button and a
// tap on the dim close it; Tab stays inside; focus returns to what opened it.
//
// Building blocks for the inside: Hero, Gauge, Medallion, StatGrid/StatCard,
// EffectRow/EffectChip, ProgressRow, ActionButton (with a cost badge), Note,
// Section. See popup.css.
import { rich } from './v6/rich'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon, { type IconPalette } from './Icon'
import { IC, fa } from './v6/format'
import { t, isRtl } from '../i18n'
import { pushNativeBack } from '../lib/nativeBack'
import './popup.css'

export type PopupTone = 'red' | 'navy' | 'green' | 'gold' | 'violet'

export interface PopupProps {
  open?: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  /** Pinned under the scrolling body - put the main ActionButton here. */
  footer?: ReactNode
  tone?: PopupTone
  /** false: the dim, Escape and the close button do nothing (a busy step). */
  dismissible?: boolean
}

// -- stack: only the top popup answers Escape / Back ---------------------------
const stack: symbol[] = []
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((f) => f())
let locks = 0
function lockScroll(on: boolean) {
  locks += on ? 1 : -1
  document.documentElement.classList.toggle('pp-lock', locks > 0)
}

export default function Popup({ open = true, onClose, title, children, footer, tone = 'red', dismissible = true }: PopupProps) {
  if (!open) return null
  return <PopupInner onClose={onClose} title={title} footer={footer} tone={tone} dismissible={dismissible}>{children}</PopupInner>
}

function PopupInner({ onClose, title, children, footer, tone, dismissible }: Omit<PopupProps, 'open'>) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const can = useRef(dismissible !== false)
  can.current = dismissible !== false
  const titleId = useId()
  // a popup opened over another hides the one below (it stays mounted, so its state survives)
  const [covered, setCovered] = useState(false)

  useEffect(() => {
    const me = Symbol('popup')
    stack.push(me)
    const sync = () => setCovered(stack.length > 0 && stack[stack.length - 1] !== me)
    listeners.add(sync)
    changed()
    lockScroll(true)
    const opener = document.activeElement as HTMLElement | null
    const el = panel.current
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    const top = () => stack[stack.length - 1] === me
    const dismiss = () => { if (top() && can.current) close.current() }

    const onKey = (e: KeyboardEvent) => {
      if (!top()) return
      if (e.key === 'Escape') { e.stopPropagation(); dismiss(); return }
      if (e.key !== 'Tab' || !el) return
      const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        .filter((n) => n.offsetParent !== null)
      if (f.length === 0) { e.preventDefault(); el.focus(); return }
      const first = f[0], last = f[f.length - 1], at = document.activeElement
      if (e.shiftKey && (at === first || at === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
      else if (!el.contains(at)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)

    // Telegram's own back button (Android's back key lands here too): the one wiring in lib/nativeBack.ts.
    const offBack = pushNativeBack(() => dismiss())

    return () => {
      document.removeEventListener('keydown', onKey, true)
      const i = stack.indexOf(me)
      if (i >= 0) stack.splice(i, 1)
      listeners.delete(sync)
      changed()
      lockScroll(false)
      offBack()
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [])

  // Rendered at the document body, not inside the screen that asked: a popup
  // opened from a screen with its own stacking context (the village's 3D view,
  // a scroller) would otherwise sit under the dock and the menus.
  return createPortal(
    <div className={`pp-overlay sheet-backdrop pp-${tone}${covered ? ' pp-covered' : ''}`} dir={isRtl() ? 'rtl' : 'ltr'} onMouseDown={(e) => { if (e.target === e.currentTarget && can.current) close.current() }}>
      <div
        className="pp-panel sheet-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {title && <h2 className="pp-title" id={titleId}>{title}</h2>}
        {dismissible !== false && (
          <button className="pp-close" onClick={() => close.current()} aria-label={t('common.close')}><img src={IC('close')} alt="" /></button>
        )}
        <div className="pp-scroll">{children}</div>
        {footer && <div className="pp-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// -- blocks -------------------------------------------------------------------

/** The top row: the odds gauge on one side, the medallion on the other. */
export function Hero({ children }: { children: ReactNode }) {
  return <div className="pp-hero">{children}</div>
}

export interface GaugeProps {
  /** 0..1 */
  frac: number
  /** The big text in the ring; default the percent. */
  value?: ReactNode
  caption?: string
  /** A small grey line under the ring. */
  note?: string
  color?: string
  size?: number
  /** The figure's colour pair: green (a good chance) or gold. */
  numTone?: 'green' | 'gold'
}

/** A big ring with a figure and a caption inside (the success chance). */
export function Gauge({ frac, value, caption, note, color = 'var(--leaf)', size = 124, numTone = 'green' }: GaugeProps) {
  const v = Math.max(0, Math.min(1, frac))
  const sw = Math.round(size * 0.1)
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="pp-gauge-wrap">
      <div className="pp-gauge" style={{ width: size, height: size, color }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={sw} className="pp-ring-track" />
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={sw} stroke="currentColor" strokeDasharray={`${v * c} ${c}`} className="pp-ring-val" />
        </svg>
        <div className="pp-gauge-in">
          <span className={`pp-gauge-num pp-gauge-${numTone}`}>{value ?? `${fa(Math.round(v * 100))}٪`}</span>
          {caption && <span className="pp-gauge-cap display">{caption}</span>}
        </div>
      </div>
      {note && <div className="pp-gauge-note">{note}</div>}
    </div>
  )
}

export interface MedallionProps {
  icon: string
  palette?: IconPalette
  /** The outer ring's colour; default the tone's accent. */
  ring?: string
  /** The location chip under it. */
  chip?: string
  size?: number
}

/** A round icon medallion: coloured ring, gold rim, dark plate, and a chip. */
export function Medallion({ icon, palette = 'steel', ring, chip, size = 112 }: MedallionProps) {
  return (
    <div className="pp-medal-wrap">
      <div className="pp-medal" style={{ width: size, height: size, ...(ring ? { '--pp-ring': ring } : {}) } as CSSProperties}>
        <Icon name={icon} palette={palette} size={Math.round(size * 0.66)} />
      </div>
      {chip && <div className="pp-medal-chip">{chip}</div>}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="pp-stats">{children}</div>
}

export interface StatCardProps {
  icon: string
  palette?: IconPalette
  label: string
  value: ReactNode
}

/** An embossed icon with a small label and a bold value. */
export function StatCard({ icon, palette = 'steel', label, value }: StatCardProps) {
  return (
    <div className="pp-stat">
      <span className="pp-stat-ic"><Icon name={icon} palette={palette} size={38} /></span>
      <span className="pp-stat-tx">
        <span className="pp-stat-l">{label}</span>
        <span className="pp-stat-v display">{rich(value)}</span>
      </span>
    </div>
  )
}

export type EffectTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

export function EffectRow({ children }: { children: ReactNode }) {
  return <div className="pp-fx">{children}</div>
}

export function EffectChip({ tone = 'neutral', children }: { tone?: EffectTone; children: ReactNode }) {
  return <span className={`pp-chip pp-chip-${tone} display`}>{children}</span>
}

export interface ProgressRowProps {
  frac: number
  /** Text inside the bar. */
  label?: ReactNode
  /** Text beside the bar (e.g. "heat 12 to 18"). */
  caption?: ReactNode
  icon?: string
  palette?: IconPalette
  color?: string
}

/** A labelled bar with an icon at its end. */
export function ProgressRow({ frac, label, caption, icon, palette = 'amber', color = 'var(--saffron)' }: ProgressRowProps) {
  const pct = Math.max(0, Math.min(1, frac)) * 100
  return (
    <div className="pp-prog">
      {icon && <span className="pp-prog-ic"><Icon name={icon} palette={palette} size={32} /></span>}
      <div className="pp-prog-bar" style={{ '--pp-fill': color } as CSSProperties}>
        <div className="pp-prog-fill" style={{ width: `${pct}%` }} />
        {label !== undefined && <span className="pp-prog-lbl display">{label}</span>}
      </div>
      {caption !== undefined && <span className="pp-prog-cap">{caption}</span>}
    </div>
  )
}

export type ActionTone = 'green' | 'gold' | 'red' | 'steel'

export interface ActionButtonProps {
  children: ReactNode
  onClick?: () => void
  tone?: ActionTone
  /** The cost badge at the start of the button, e.g. "-2" with `costIcon`. */
  cost?: ReactNode
  costIcon?: string
  costPalette?: IconPalette
  disabled?: boolean
  /** Why it is disabled, shown under the button. */
  reason?: string
  busy?: boolean
  /** A smaller button for a second choice. */
  small?: boolean
  type?: 'button' | 'submit'
}

/** The big raised button, with an optional cost badge. */
export function ActionButton({ children, onClick, tone = 'green', cost, costIcon, costPalette = 'ruby', disabled, reason, busy, small, type = 'button' }: ActionButtonProps) {
  return (
    <div className={`pp-act-wrap${small ? ' pp-act-small' : ''}`}>
      <button type={type} className={`pp-act pp-act-${tone}`} onClick={onClick} disabled={disabled || busy}>
        {cost !== undefined && (
          <span className="pp-act-cost display">
            <span>{cost}</span>
            {costIcon && <Icon name={costIcon} palette={costPalette} size={30} />}
          </span>
        )}
        <span className="pp-act-label">{children}</span>
      </button>
      {disabled && reason && <div className="pp-act-reason">{reason}</div>}
    </div>
  )
}

/** Two or more actions side by side / stacked. */
export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="pp-acts">{children}</div>
}

export function Section({ children }: { children: ReactNode }) {
  return <div className="pp-sec display">{children}</div>
}

export function Note({ children, tone }: { children: ReactNode; tone?: 'bad' | 'good' }) {
  return <p className={`pp-note${tone ? ` pp-note-${tone}` : ''}`}>{children}</p>
}

export interface UnavailableProps {
  /** Why it is not here, e.g. "this village has not learned it yet". */
  reason: string
  /** What the head could research or build to get it. */
  hint?: string
  /** The nearest place that has it, with the travel shortcut. */
  nearest?: { name: string; onGo: () => void; label?: string }
  icon?: string
}

/** The "not available here" block: a lock, the reason, a hint for the head,
 * and (when there is one) the nearest place that has it with a travel button. */
export function Unavailable({ reason, hint, nearest, icon = 'm_lock' }: UnavailableProps) {
  return (
    <div className="pp-unav">
      <span className="pp-unav-ic"><Icon name={icon} palette="steel" size={44} /></span>
      <div className="pp-unav-reason">{reason}</div>
      {hint && <div className="pp-unav-hint">{hint}</div>}
      {nearest && (
        <div className="pp-unav-near">
          <span>{t('popup.nearest', { name: nearest.name })}</span>
          <ActionButton tone="steel" small onClick={nearest.onGo}>{nearest.label ?? t('popup.go_there')}</ActionButton>
        </div>
      )}
    </div>
  )
}

// -- requirements and costs --------------------------------------------------------

export interface RequirementLine {
  key?: string
  icon: string
  palette?: IconPalette
  /** What is needed, e.g. "A place to keep it". */
  label: string
  /** met: have it; missing: do not have it; info: a plain extra cost or fact. */
  state: 'met' | 'missing' | 'info'
  /** The current state in words, e.g. "You have 3 of 5" / "No storage". */
  detail?: string
  /** What getting it costs, already formatted, e.g. "30 a day". */
  price?: string
  /** A small button to go and get it (only useful when missing). */
  action?: { label: string; onClick: () => void; tone?: ActionTone; disabled?: boolean }
}

/** Everything the player needs to know before acting: one line per
 * requirement or extra cost, each with where it stands, what it costs to
 * fix, and a small button to fix it right there. Data-driven: any server
 * view can be mapped onto these lines. */
export function RequirementList({ lines, title }: { lines: RequirementLine[]; title?: string }) {
  if (lines.length === 0) return null
  return (
    <div className="pp-req">
      {title && <Section>{title}</Section>}
      {lines.map((l, i) => (
        <div key={l.key ?? i} className={`pp-req-line pp-req-${l.state}`}>
          <span className="pp-req-ic"><Icon name={l.icon} palette={l.palette ?? 'steel'} size={30} /></span>
          <span className="pp-req-tx">
            <span className="pp-req-l">{l.label}</span>
            {l.detail && <span className="pp-req-d">{l.detail}</span>}
          </span>
          <span className="pp-req-end">
            {l.state !== 'info' && <span className="pp-req-mark" aria-label={l.state === 'met' ? t('popup.req.met') : t('popup.req.missing')}>{l.state === 'met' ? '✓' : '!'}</span>}
            {l.price && <span className="pp-req-price display">{l.price}</span>}
          </span>
          {l.action && l.state !== 'met' && (
            <button className={`pp-req-btn pp-req-btn-${l.action.tone ?? 'gold'}`} disabled={l.action.disabled} onClick={l.action.onClick}>{l.action.label}</button>
          )}
        </div>
      ))}
    </div>
  )
}

export interface CostSummaryProps {
  /** The parts: the price, the fees, the storage... (amounts already formatted). */
  lines: { label: string; amount: string }[]
  total: { label?: string; amount: string }
}

/** The bill above the main button: each part, then the total. */
export function CostSummary({ lines, total }: CostSummaryProps) {
  return (
    <div className="pp-cost">
      {lines.map((l, i) => (
        <div key={i} className="pp-cost-line"><span>{l.label}</span><b>{l.amount}</b></div>
      ))}
      <div className="pp-cost-total display"><span>{total.label ?? t('popup.total')}</span><b>{total.amount}</b></div>
    </div>
  )
}
