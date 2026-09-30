import type { ReactNode } from 'react'
import Icon from '../../../ui/Icon'
import type { IconPalette } from '../../../ui/Icon'
import { TINT_ICON_PALETTE, type Tint } from './theme'
import { useToast } from '../../../state/ToastContext'
import { t } from '../../../i18n'

/** The scrollable page every feature screen sits in (like GenericScreen's
 * own .screen-scroll, so the two feel the same when the user moves between
 * a real and a preview screen). */
export function Scroll({ children }: { children: ReactNode }) {
  return <div className="ft-scroll">{children}</div>
}

/** The «به‌زودی» banner every preview screen opens with. */
export function ComingSoonBanner({ note }: { note?: string }) {
  return (
    <div className="ft-banner-soon">
      <Icon name="clock" palette="gold" size={20} />
      <span><b className="display">{t('f.parts.248')}</b> — {note ?? t('f.parts.249')}</span>
    </div>
  )
}

/** The opening hero card: a coloured tint, the feature's icon plated at the
 * reading end, a title and an optional line under it and a stat at the
 * reading start — the same role as the prototype's `_hdr` + opening `_card`. */
export function Hero({
  tint, icon, title, sub, stat, children,
}: {
  tint: Tint
  icon: string
  title: string
  sub?: string
  stat?: { label: string; value: string }
  children?: ReactNode
}) {
  return (
    <div className={`ft-hero ft-tint-${tint}`}>
      <div className="ft-hero-icon"><Icon name={icon} palette={TINT_ICON_PALETTE[tint]} size={30} /></div>
      {stat && (
        <div style={{ marginBottom: 6 }}>
          <div className="ft-hero-stat-label">{stat.label}</div>
          <div className="ft-hero-stat-value display">{stat.value}</div>
        </div>
      )}
      <div className="ft-hero-title display">{title}</div>
      {sub && <div className="ft-hero-sub">{sub}</div>}
      {children}
    </div>
  )
}

export function Card({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return <div className={`ft-card${flush ? ' ft-card-flush' : ''}`}>{children}</div>
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ft-section">
      <div className="ft-section-title display">{title}</div>
      {children}
    </div>
  )
}

/** A list row: a plated icon, a title and a line under it, an optional value
 * at the end — the prototype's `_row`/`_person`. */
export function Row({
  icon, palette = 'steel', title, sub, right, rightColor, online, badge, size = 38,
}: {
  icon: string
  palette?: IconPalette
  title: string
  sub?: string
  right?: ReactNode
  rightColor?: string
  online?: boolean
  badge?: number
  size?: number
}) {
  return (
    <div className="ft-row">
      <Plate icon={icon} palette={palette} size={size} online={online} badge={badge} />
      <div className="ft-row-body">
        <div className="ft-row-title">{title}</div>
        {sub && <div className="ft-row-sub">{sub}</div>}
      </div>
      {right != null && <div className="ft-row-right" style={{ color: rightColor }}>{right}</div>}
    </div>
  )
}

export function Plate({
  icon, palette = 'steel', size = 38, online, badge, bg,
}: { icon: string; palette?: IconPalette; size?: number; online?: boolean; badge?: number; bg?: string }) {
  return (
    <span className="ft-plate" style={{ width: size, height: size, background: bg ?? 'rgba(255,255,255,0.06)' }}>
      <Icon name={icon} palette={palette} size={Math.round(size * 0.55)} />
      {online != null && <span className="ft-dot" style={{ background: online ? 'var(--leaf)' : '#59607a' }} />}
      {!!badge && badge > 0 && <span className="ft-plate-badge">{badge}</span>}
    </span>
  )
}

/** A grid of Tile (or custom card) children. It's a CSS grid, not a flex
 * row, so a child can no longer claim "half width" with its own inline
 * flex-basis (that only worked back when this was flexbox) — pass `cols`
 * instead when a card needs more room than the default three-across (a
 * stat card with a button, a wanted poster). */
export function TileGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`ft-tile-grid${cols === 2 ? ' ft-tile-grid-2' : ''}`}>{children}</div>
}

export function Tile({
  icon, palette = 'steel', title, sub, glow,
}: { icon: string; palette?: IconPalette; title: string; sub?: string; glow?: boolean }) {
  return (
    <div className="ft-tile" style={glow ? { borderColor: 'rgba(242,194,85,0.6)' } : undefined}>
      <Plate icon={icon} palette={palette} size={44} />
      <div className="ft-tile-title display">{title}</div>
      {sub && <div className="ft-tile-sub">{sub}</div>}
    </div>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="ft-chip-row">{children}</div>
}

export function Chip({ text, color = 'var(--steel)' }: { text: string; color?: string }) {
  return <span className="ft-chip" style={{ background: color }}>{text}</span>
}

export function StatBar({
  label, value, fraction, color = 'var(--gold)',
}: { label: string; value?: string; fraction: number; color?: string }) {
  return (
    <div className="ft-statbar">
      <div className="ft-statbar-head"><span>{label}</span>{value && <span>{value}</span>}</div>
      <div className="ft-statbar-track">
        <div className="ft-statbar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`, background: color }} />
      </div>
    </div>
  )
}

type BtnKind = 'gold' | 'green' | 'red' | 'blue' | 'steel'

/** A real, working button — used by native screens wired to the server. */
export function Btn({
  kind = 'gold', icon, onClick, children, disabled,
}: { kind?: BtnKind; icon?: string; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button className={`ft-btn ft-btn-${kind} display`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} palette="cream" size={20} />}
      <span>{children}</span>
    </button>
  )
}

/** A button drawn exactly like `Btn` but permanently inert: a preview
 * screen's action, so nothing pretends to work. Tapping it explains why. */
export function SoonBtn({ kind = 'gold', icon, children }: { kind?: BtnKind; icon?: string; children: ReactNode }) {
  const toast = useToast()
  return (
    <button
      className={`ft-btn ft-btn-${kind} ft-disabled display`}
      onClick={() => toast.push(t('f.parts.250'))}
    >
      {icon && <Icon name={icon} palette="cream" size={20} />}
      <span>{children}</span>
    </button>
  )
}

export function BtnRow({ children }: { children: ReactNode }) {
  return <div className="ft-btn-row">{children}</div>
}

/** The relationship ladder (LADDER in the prototype): steps right to left,
 * the reached ones lit. */
export function Ladder({ steps, at, color = 'var(--rose)' }: { steps: string[]; at: number; color?: string }) {
  const pct = steps.length > 1 ? (at / (steps.length - 1)) * 100 : 0
  return (
    <div className="ft-ladder">
      <div className="ft-ladder-track" />
      <div className="ft-ladder-fill" style={{ width: `${pct}%`, background: color }} />
      {steps.map((s, i) => (
        <div className="ft-ladder-step" key={s}>
          <div className="ft-ladder-dot" style={{ background: i <= at ? color : 'rgba(255,255,255,0.12)' }} />
          <div className="ft-ladder-label" style={i === at ? { color: '#fff' } : undefined}>{s}</div>
        </div>
      ))}
    </div>
  )
}

export function LockedRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="ft-locked-row">
      <Icon name={ok ? 'check' : 'close'} palette={ok ? 'emerald' : 'ruby'} size={20} />
      <span style={ok ? undefined : { color: 'var(--anar)' }}>{text}</span>
    </div>
  )
}
