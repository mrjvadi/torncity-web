// The v6 parts of a re-hosted screen or panel (building panel, city panel, storehouse, hubs). Pure presentation:
// data comes in as props, events go out as callbacks. Styles: inner.css (`.hub-*`, `.pn-*`). Icons are the v6 set.

import type { CSSProperties, ReactNode } from 'react'
import { Ic } from './parts'

/** A section label inside a screen or panel. */
export function PSec({ children }: { children: ReactNode }) {
  return <div className="pn-sec">{children}</div>
}

/** A label and a value in one row; `bad` marks a shortfall. */
export function PKV({ label, value, bad }: { label: ReactNode; value: ReactNode; bad?: boolean }) {
  return <div className={`pn-kv${bad ? ' bad' : ''}`}><span>{label}</span><b>{value}</b></div>
}

/** A thin bar under a row: green normally, amber when low, red when blocked. */
export function PBar({ frac, tone, cls }: { frac: number; tone?: 'low' | 'bad'; cls?: string }) {
  return <div className={`pn-bar${tone ? ' ' + tone : ''}${cls && !tone ? ' ' + cls : ''}`} style={{ '--p': Math.max(0, Math.min(1, frac)) } as CSSProperties}><i /></div>
}

/** The one gold primary, a quiet secondary, or a disabled button that says why (a flat grey button with a lock). */
export function PBtn({ children, onClick, kind, disabled, reason }: { children: ReactNode; onClick?: () => void; kind?: 'sec'; disabled?: boolean; reason?: string }) {
  return (
    <>
      <button className={`pn-btn${kind ? ' ' + kind : ''}${disabled ? ' dis' : ''}`} onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined}>
        {disabled && <Ic name="lock" className="pn-lock" />}{children}
      </button>
      {disabled && reason && <p className="pn-hint pn-bad">{reason}</p>}
    </>
  )
}

/** What the building or place is doing, first: red when it cannot work, green when it works. */
export function PWhy({ title, text, ok }: { title: ReactNode; text?: ReactNode; ok?: boolean }) {
  return (
    <div className={`pn-why${ok ? ' ok' : ''}`}>
      <Ic name={ok ? 'check' : 'warn'} className="pn-why-ic" />
      <div><b>{title}</b>{text && <span>{text}</span>}</div>
    </div>
  )
}

/** A list card in the prototype's pattern: an icon, a title and a sub line, a badge or a chevron at the end. */
export function PRow({ icon, title, sub, badge, tone, off, onClick, children }: {
  icon: string
  title: ReactNode
  sub?: ReactNode
  badge?: ReactNode
  tone?: 'busy' | 'off' | 'danger'
  /** a thing that is not here: dashed, with its reason and way (children) inside */
  off?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const body = (
    <>
      <span className="hub-ico"><Ic name={icon} /></span>
      <span className="hub-body">
        <span className="hub-title">{title}</span>
        {sub && <span className="hub-sub">{sub}</span>}
        {children}
      </span>
      {badge ? <span className={`hub-badge${tone ? ' ' + tone : ''}`}>{badge}</span> : onClick ? <Ic name="chev" className="hub-chev" /> : null}
    </>
  )
  const cls = `hub-card${off ? ' here-not' : ''}${tone === 'danger' ? ' danger' : ''}`
  return onClick ? <button className={cls} onClick={onClick}>{body}</button> : <div className={cls}>{body}</div>
}

/** Segmented tabs (انبار شهر / انبار من, خرید / فروش): gold on dark. */
export function PTabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="pn-tabs" role="tablist">
      {tabs.map((x) => <button key={x.key} role="tab" aria-selected={x.key === value} className={x.key === value ? 'on' : ''} onClick={() => onChange(x.key)}>{x.label}</button>)}
    </div>
  )
}
