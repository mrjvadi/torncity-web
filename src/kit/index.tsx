// The design kit: a faithful port of the owner's Godot prototype primitives
// (proto/home_proto.gd, proto/screens_proto.gd) to React + CSS. Every piece
// here is deliberately small and composable — the chrome (Hud/Dock/…) and
// the 54 feature screens are built on top of it. See kit.css for the visual
// rules; this file is only markup + typed props.
import type { CSSProperties, ReactNode } from 'react'
import Icon from '../ui/Icon'
import { shade } from './color'
import './kit.css'

export type { IconPalette } from '../ui/Icon'
export type { IconPalette as Palette } from '../ui/Icon'

/** The struck-icon glyph, in the prototype's ten palettes (home_proto.gd
 * `_emboss` / PAL). Re-exports the shared Icon so the rest of the app (which
 * already renders hundreds of these) and the kit stay pixel-identical. */
export const Emboss = Icon

// -- Frame ------------------------------------------------------------------

export interface FrameProps {
  children?: ReactNode
  /** px or any CSS length, e.g. 18 or 'calc(24px * var(--u))'. */
  radius?: number | string
  /** A CSS gradient pair — defaults to the panel tone. */
  top?: string
  bottom?: string
  /** Trim (border) colour — defaults to gold. */
  trim?: string
  trimWidth?: number | string
  /** A tinted glow just inside the trim, e.g. 'rgba(53,82,200,0.5)'. */
  glow?: string
  /** The faint girih lattice across the face — on by default, like every
   * panel in the prototype. */
  pattern?: boolean
  patternSize?: number | string
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

/** A lit panel: vertical gradient face, girih lattice, metallic trim lit
 * from the top, optional glow — the prototype's one panel primitive behind
 * every card, header ribbon backing and pill (home_proto.gd `_frame`). */
export function Frame({
  children, radius = 18, top, bottom, trim, trimWidth, glow, pattern = true, patternSize,
  className, style, onClick,
}: FrameProps) {
  const vars: CSSProperties = {
    '--k-radius': len(radius),
    ...(top ? { '--k-top': top } : {}),
    ...(bottom ? { '--k-bottom': bottom } : {}),
    ...(trim ? { '--k-trim': trim } : {}),
    ...(trimWidth !== undefined ? { '--k-trim-w': len(trimWidth) } : {}),
    ...(glow ? { '--k-glow': `0 0 22px ${glow}` } : {}),
    ...(patternSize ? { '--k-pattern-size': len(patternSize) + ' ' + len(patternSize) } : {}),
    ...style,
  } as CSSProperties
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp className={`k-frame${pattern ? ' k-pattern' : ''}${className ? ` ${className}` : ''}`} style={vars} onClick={onClick}>
      <div className="k-frame-body">{children}</div>
    </Comp>
  )
}

function len(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v
}

// -- Slab (button) ------------------------------------------------------------

export type SlabTone = 'gold' | 'green' | 'red' | 'blue' | 'steel' | 'ghost'

export interface SlabProps {
  children?: ReactNode
  tone?: SlabTone
  radius?: number | string
  lip?: number | string
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  type?: 'button' | 'submit'
}

/** A chunky glossy button: face gradient, a darker lip the press sinks
 * into (home_proto.gd `_button`). Five preset tones match the prototype's
 * BTN dict (screens_proto.gd); `ghost` is an outlined, unfilled variant for
 * a second choice next to a lead primary. */
export function Slab({ children, tone = 'gold', radius = 16, lip, onClick, disabled, className, style, type = 'button' }: SlabProps) {
  const vars: CSSProperties = {
    '--k-radius': len(radius),
    ...(lip !== undefined ? { '--k-lip': len(lip) } : {}),
    ...style,
  } as CSSProperties
  return (
    <button
      type={type}
      className={`k-slab k-slab-${tone} display${className ? ` ${className}` : ''}`}
      style={vars}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// -- Plate (badge) ------------------------------------------------------------

export interface PlateProps {
  children?: ReactNode
  size?: number | string
  rim?: string
  rimWidth?: number | string
  square?: boolean
  light?: string
  dark?: string
  className?: string
  style?: CSSProperties
}

/** A round (or rounded-square) rimmed plate an icon sits on
 * (home_proto.gd `_badge`). Put an `Emboss` inside it. */
export function Plate({ children, size = 64, rim, rimWidth, square, light, dark, className, style }: PlateProps) {
  const vars: CSSProperties = {
    '--k-size': len(size),
    ...(rim ? { '--k-rim': rim } : {}),
    ...(rimWidth !== undefined ? { '--k-rim-w': len(rimWidth) } : {}),
    ...(light ? { '--k-plate-l': light } : {}),
    ...(dark ? { '--k-plate-d': dark } : {}),
    ...style,
  } as CSSProperties
  return (
    <span className={`k-plate${square ? ' k-plate-square' : ''}${className ? ` ${className}` : ''}`} style={vars}>
      {children}
    </span>
  )
}

// -- GLabel (gradient display text) --------------------------------------------

export interface GLabelProps {
  children: ReactNode
  top?: string
  bottom?: string
  stroke?: number | string
  className?: string
  style?: CSSProperties
}

/** Gradient-filled Lalezar text with a dark outline (home_proto.gd
 * `_glabel`) — names, values, ribbon titles, dock labels. */
export function GLabel({ children, top, bottom, stroke, className, style }: GLabelProps) {
  const vars: CSSProperties = {
    ...(top ? { '--k-g-top': top } : {}),
    ...(bottom ? { '--k-g-bottom': bottom } : {}),
    ...(stroke !== undefined ? { '--k-g-stroke': len(stroke) } : {}),
    ...style,
  } as CSSProperties
  return <span className={`k-glabel${className ? ` ${className}` : ''}`} style={vars}>{children}</span>
}

// -- Bar ----------------------------------------------------------------------

export interface BarProps {
  /** 0..1 */
  frac: number
  color: string
  colorLight?: string
  outline?: string
  height?: number | string
  full?: boolean
  label?: ReactNode
  fontSize?: number | string
  className?: string
}

/** A resource bar: sunken track, lit fill from the reading edge, value
 * text centred inside (ui/bar.gdshader). `full` makes the fill breathe,
 * like the prototype's energy bar at 100%. */
export function Bar({ frac, color, colorLight, outline, height, full, label, fontSize, className }: BarProps) {
  const pct = Math.max(0, Math.min(1, frac)) * 100
  const vars: CSSProperties = {
    '--k-fill': color,
    '--k-fill-l': colorLight ?? shade(color, 0.55),
    ...(outline ? { '--k-outline': outline } : {}),
    ...(height !== undefined ? { '--k-h': len(height) } : {}),
    ...(fontSize !== undefined ? { '--k-fs': len(fontSize) } : {}),
  } as CSSProperties
  return (
    <div className={`k-bar${full ? ' k-bar-full' : ''}${className ? ` ${className}` : ''}`} style={vars}>
      <div className="k-bar-fill" style={{ width: `${pct}%` }} />
      {label !== undefined && <span className="k-bar-label display">{label}</span>}
    </div>
  )
}

// -- Ring -----------------------------------------------------------------------

export interface RingProps {
  frac: number
  color: string
  size?: number
  strokeWidth?: number
  children?: ReactNode
  className?: string
}

/** A progress ring for timers, clockwise from the top (ui/ring.gdshader). */
export function Ring({ frac, color, size = 64, strokeWidth = 7, children, className }: RingProps) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, frac))
  return (
    <div className={`k-ring${className ? ` ${className}` : ''}`} style={{ width: size, height: size, color }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} className="k-ring-track" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} stroke={color}
          strokeDasharray={`${v * c} ${c}`} className="k-ring-value"
        />
      </svg>
      {children && <div className="k-ring-center">{children}</div>}
    </div>
  )
}

// -- Count ----------------------------------------------------------------------

export function Count({ n, size, className }: { n: number; size?: number | string; className?: string }) {
  return (
    <span className={`k-count${className ? ` ${className}` : ''}`} style={size !== undefined ? ({ '--k-size': len(size) } as CSSProperties) : undefined}>
      {n < 100 ? n : '99+'}
    </span>
  )
}

// -- Ribbon (screen header) ------------------------------------------------------

export interface RibbonProps {
  title: string
  /** A base hex colour — the ribbon lightens/darkens it itself, the same
   * as screens_proto.gd `_hdr(title, tint)`. */
  tint: string
  onBack?: () => void
  onHelp?: () => void
  height?: number | string
  className?: string
}

/** The screen title ribbon with the round back (›) / help (؟) buttons
 * either side (screens_proto.gd `_hdr`: help at canvas x=24, back at
 * x=628 — physically help-left/back-right). DOM order is back-first,
 * help-last on purpose: the app is RTL (styles/global.css `direction:
 * rtl`), which lays out a flex row's first child at the *right* — so
 * back-first/help-last is what lands back on the right and help on the
 * left, matching the prototype's fixed pixel layout. */
export function Ribbon({ title, tint, onBack, onHelp, height, className }: RibbonProps) {
  const vars: CSSProperties = {
    '--k-top': shade(tint, 0.25),
    '--k-bottom': shade(tint, -0.3),
    ...(height !== undefined ? { '--k-h': len(height) } : {}),
  } as CSSProperties
  return (
    <div className={`k-hdr${className ? ` ${className}` : ''}`}>
      <button className="k-hdr-btn" disabled={!onBack} onClick={onBack} aria-label="بازگشت">›</button>
      <div className="k-ribbon" style={vars}>
        <GLabel className="k-ribbon-title" top="#ffffff" bottom="#ffe6b8" stroke={1.4}>{title}</GLabel>
      </div>
      <button className="k-hdr-btn" disabled={!onHelp} onClick={onHelp} aria-label="راهنما">؟</button>
    </div>
  )
}

// -- Chip -----------------------------------------------------------------------

export interface ChipProps {
  children: ReactNode
  tone?: string
  rim?: string
  fontSize?: number | string
  className?: string
}

/** A small lit pill (screens_proto.gd `_chip`) — a tinted status chip, a
 * "full at" time under a stat bar, a filter option. */
export function Chip({ children, tone, rim, fontSize, className }: ChipProps) {
  const vars: CSSProperties = tone
    ? ({ '--k-top': shade(tone, -0.45), '--k-bottom': shade(tone, -0.72), '--k-rim': rim ?? shade(tone, 0.2) } as CSSProperties)
    : {}
  if (fontSize !== undefined) (vars as Record<string, string>)['--k-fs'] = len(fontSize)
  return <span className={`k-chip display${className ? ` ${className}` : ''}`} style={vars}>{children}</span>
}

// -- Segmented --------------------------------------------------------------------

export function Segmented({ options, value, onChange }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="k-seg">
      {options.map((o) => (
        <button key={o.key} className={`k-seg-opt${o.key === value ? ' k-active' : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// -- Numpad -----------------------------------------------------------------------

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫']

/** The bank screen's keypad (screens_proto.gd `_s_bank`): digits read left
 * to right like any phone keypad, `000`/`0` and a red backspace. */
export function Numpad({ onPress, className }: { onPress: (key: string) => void; className?: string }) {
  return (
    <div className={`k-numpad${className ? ` ${className}` : ''}`}>
      {NUMPAD_KEYS.map((k) => (
        <Slab key={k} tone={k === '⌫' ? 'red' : k === '000' ? 'blue' : 'steel'} radius={14} lip={4} onClick={() => onPress(k)}>
          {k}
        </Slab>
      ))}
    </div>
  )
}

// -- Screen (background) -----------------------------------------------------------

/** The shared background behind every non-city screen: the city photo, the
 * dark top/bottom gradient, the vignette and the girih pattern
 * (screens_proto.gd `_build_ui`). Wrap a screen's scroll content in this. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  const bg = `${import.meta.env.BASE_URL}bg_city.jpg`
  return (
    <div className={`k-screen${className ? ` ${className}` : ''}`} style={{ '--k-bg-url': `url(${bg})` } as CSSProperties}>
      <div className="k-screen-pattern" />
      <div className="k-screen-body">{children}</div>
    </div>
  )
}
