// Shared building blocks for the native screens, styled after the Godot
// prototype (proto/screens_proto.gd): a ribbon title, dark gold-trimmed
// cards, pill progress bars, a percent ring, list rows and hub tiles.
// CSS lives in src/styles/global.css under the `/* screens */` block.

import type { ReactNode } from 'react'
import Icon, { type IconPalette } from '../../../ui/Icon'
import './header.css'
import { useNav } from '../../../state/NavContext'
import { t, isRtl } from '../../../i18n'

export type Tone = 'gold' | 'ruby' | 'violet' | 'emerald' | 'sapphire' | 'teal'

/** Ribbon top/bottom per tone — each screen's own stand-in for the
 * prototype's bespoke per-screen tint (screens_proto.gd passes `_hdr` a
 * one-off `Color(...)`; the web app buckets those into six reusable
 * tones), shaded the same way as the kit's own `Ribbon` (`shade(tint,
 * 0.25)` / `shade(tint, -0.3)`). */
const TONE: Record<Tone, [top: string, bottom: string]> = {
  gold: ['#b8860b', '#4a3608'],
  ruby: ['#c8242c', '#430e12'],
  violet: ['#7a5adf', '#2a1e57'],
  emerald: ['#2fae6c', '#0e3d2a'],
  sapphire: ['#3f6adf', '#101f4a'],
  teal: ['#2bc4b2', '#0a423d'],
}

/** The whole screen's scroll area: every native screen renders one of
 * these at its root. */
export function ScreenScroll({ children }: { children: ReactNode }) {
  return <div className="nx-scroll">{children}</div>
}

/** The ribbon-shaped screen title, tinted per section, with the round
 * back/refresh buttons either side — built on the kit's own `.k-hdr`/
 * `.k-ribbon` (screens_proto.gd `_hdr`), just with a refresh (↻) button
 * standing in for the prototype's help (؟) one, since every native screen
 * needs "reload me", not a help sheet. DOM order is back-first,
 * refresh-last so the app's RTL flex row lands back on the right — see
 * kit/index.tsx `Ribbon` for the same convention. */
export function Header({ title, onBack }: {
  title: string
  tone?: Tone
  /** used only outside the shell; inside it the header always goes back through the shell's history */
  onBack?: () => void
  /** ignored: screens refetch by themselves; kept so older calls compile */
  onRefresh?: () => void
}) {
  const nav = useNav()
  const back = nav ? nav.back : onBack
  const showBack = !!back && !nav?.hideBack
  return (
    <div className={`cx-hdr${showBack ? ' has-back' : ''}`}>
      {showBack && <button className="cx-hdr-btn" onClick={back ?? undefined} aria-label={t('common.back')}>{isRtl() ? '›' : '‹'}</button>}
      <span className="cx-hdr-title display">{title}</span>
    </div>
  )
}

export function Card({ children, tone, className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <div className={`nx-card${tone ? ` nx-card-${tone}` : ''}${className ? ` ${className}` : ''}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="nx-sec display">{children}</div>
}

/** A two-column stat readout inside a card (cash/bank, level/xp…). */
export function StatPair({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="nx-statpair">{left}{right}</div>
}

export function Stat({ icon, palette, label, value }: { icon: string; palette?: IconPalette; label: string; value: ReactNode }) {
  return (
    <div className="nx-stat">
      <Icon name={icon} palette={palette ?? 'gold'} size={22} />
      <div className="nx-stat-text">
        <div className="nx-stat-value display">{value}</div>
        <div className="nx-stat-label">{label}</div>
      </div>
    </div>
  )
}

/** A labelled pill progress bar, the value drawn over the fill. */
export function Bar({ frac, color, label, sub }: { frac: number; color: string; label: ReactNode; sub?: string }) {
  return (
    <div className="nx-bar-wrap">
      <div className="nx-bar" style={{ borderColor: color }}>
        <div className="nx-bar-fill" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color }} />
        <span className="nx-bar-label display">{label}</span>
      </div>
      {sub && <div className="nx-bar-sub">{sub}</div>}
    </div>
  )
}

/** A percent ring, like the hospital screen's health-remaining dial. */
export function Ring({ frac, color, size = 120, children }: { frac: number; color: string; size?: number; children?: ReactNode }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="nx-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} className="nx-ring-track" />
        <circle
          cx="50" cy="50" r={r} stroke={color}
          strokeDasharray={`${Math.max(0, Math.min(1, frac)) * c} ${c}`}
          className="nx-ring-value"
        />
      </svg>
      <div className="nx-ring-center">{children}</div>
    </div>
  )
}

/** A row: icon plate, title + subtitle, and something on the leading
 * (right, in RTL) edge — a button, a badge, a value. */
export function ListRow({ icon, palette, title, sub, right, tone, onClick }: {
  icon: string
  palette?: IconPalette
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  tone?: Tone
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp className={`nx-row${tone ? ` nx-row-${tone}` : ''}${onClick ? ' nx-row-tap' : ''}`} onClick={onClick}>
      <span className="nx-row-plate"><Icon name={icon} palette={palette ?? 'steel'} size={20} /></span>
      <span className="nx-row-text">
        <span className="nx-row-title">{title}</span>
        {sub && <span className="nx-row-sub">{sub}</span>}
      </span>
      {right && <span className="nx-row-right">{right}</span>}
    </Comp>
  )
}

/** Filter chips (crime categories, inbox categories, leaderboard boards…). */
export function Segmented({ options, value, onChange, wrap }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
  /** Lay the options over as many rows as they need instead of one row that scrolls sideways (a strip of six tabs). */
  wrap?: boolean
}) {
  return (
    <div className={`nx-seg${wrap ? ' nx-seg-wrap' : ''}`}>
      {options.map((o) => (
        <button key={o.key} className={`nx-seg-opt${o.key === value ? ' active' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button className="nx-primary display" onClick={onClick} disabled={disabled}>{children}</button>
}

export function Chip({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className={`nx-chip${tone ? ` nx-chip-${tone}` : ''}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="nx-empty">{children}</div>
}

export function Notice({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return <div className={`nx-notice${alert ? ' nx-notice-alert' : ''}`}>{children}</div>
}
