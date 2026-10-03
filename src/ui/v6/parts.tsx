// The v6 design system's components (ported from the approved prototype, torncity-lab/ui-concepts/v6-home).
// Pure presentation: data comes in as props, events go out as callbacks. Styles: v6.css (every class is v6-prefixed).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t, type Key } from '../../i18n'
import { IC, cashCompact, faNum, fa } from './format'
import type { HudData, EventSlot, WipSlot } from './hooks'

export function Ic({ name, className, alt = '' }: { name: string; className?: string; alt?: string }) {
  return <img className={className} src={IC(name)} alt={alt} draggable={false} />
}

// -- HUD: photo + level, three vitals, own cash, gem --------------------------------------------------

export function Portrait({ src, initials, hue, level, xp, onClick, tip }: { src: string | null; initials: string; hue: number; level: string; xp: number; onClick: () => void; tip?: string }) {
  return (
    <button className="v6-who" onClick={onClick} aria-label={t('shell.profile')} data-tip={tip} data-key="1">
      <i className="v6-xp" style={{ '--p': xp } as CSSProperties} />
      <span className="v6-photo" style={!src ? { background: `linear-gradient(150deg, hsl(${hue} 60% 52%), hsl(${(hue + 40) % 360} 60% 34%))` } : undefined}>
        {src ? <img src={src} alt="" /> : <b className="v6-otl">{initials}</b>}
      </span>
      <b className="v6-lvl">{level}</b>
    </button>
  )
}

export function VitalsBar({ hud }: { hud: HudData }) {
  const rows: { k: string; icon: string; fill: string; label: Key; v: number; max: number; tip: Key; fullIn: number }[] = [
    { k: 'health', icon: 'heart', fill: 'g', label: 'v6.vital.health', v: hud.health.v, max: hud.health.max, tip: 'v6.tip.health', fullIn: hud.health.fullIn },
    { k: 'energy', icon: 'bolt', fill: 'b', label: 'v6.vital.energy', v: hud.energy.v, max: hud.energy.max, tip: 'v6.tip.energy', fullIn: hud.energy.fullIn },
  ]
  if (hud.nerve) rows.push({ k: 'nerve', icon: 'nerve', fill: 'o', label: 'v6.vital.nerve', v: hud.nerve.v, max: hud.nerve.max, tip: 'v6.tip.nerve', fullIn: hud.nerve.fullIn })
  return (
    <div className="v6-vit" aria-label={t('v6.vital.mine')}>
      {rows.map((r) => (
        <div key={r.k} className="v6-vrow" data-k={r.k} data-tip={t(r.tip, { v: faNum(r.v), max: faNum(r.max) }) + (r.fullIn > 0 ? ' ' + t('v6.tip.full_in', { t: fullIn(r.fullIn) }) : '')}>
          <Ic name={r.icon} />
          <em>{t(r.label)}</em>
          <span className="v6-bar"><i className={`v6-fill-${r.fill}`} style={{ '--p': r.max ? Math.min(1, r.v / r.max) : 0 } as CSSProperties} /></span>
          <b>{fa(r.v)}/{fa(r.max)}</b>
        </div>
      ))}
    </div>
  )
}

function fullIn(seconds: number): string {
  const m = Math.ceil(seconds / 60)
  if (m < 60) return t('v6.dur.min', { n: fa(m) })
  const h = Math.floor(m / 60), r = m % 60
  return r ? t('v6.dur.hm', { h: fa(h), m: fa(r) }) : t('v6.dur.h', { h: fa(h) })
}

/** One money figure in the HUD: a coin or gem badge on the pill's start edge, the value, an optional gold plus. */
export function CurrencyPill({ kind, value, onClick, onPlus, pending }: { kind: 'cash' | 'gem'; value: string; onClick?: () => void; onPlus?: () => void; pending?: boolean }) {
  const tip = kind === 'cash' ? t('v6.tip.cash', { v: value }) : t('v6.tip.gem', { v: value })
  const cls = `v6-chip v6-${kind}${pending ? ' pending' : ''}`
  const inner = (
    <>
      <Ic name={kind === 'cash' ? 'coin' : 'gem'} />
      <b>{value}</b>
    </>
  )
  return (
    <div className={cls} data-k={kind} data-tip={tip}>
      {onClick ? <button className="v6-chip-hit" onClick={onClick} aria-label={tip} style={{ position: 'absolute', inset: 0, borderRadius: 15 }} /> : null}
      {inner}
      {onPlus && <button className="v6-plus" onClick={onPlus} aria-label={t('v6.gem.add')} data-tip={t('v6.gem.add')}><i /></button>}
    </div>
  )
}

export function HudBar({ hud, name, portrait, onAvatar, onBank, children, innerRef }: {
  hud: HudData; name: string
  portrait: { src: string | null; initials: string; hue: number }
  onAvatar: () => void; onBank: () => void
  /** the time-limited events, which sit in the top bar on a desktop */
  children?: ReactNode
  innerRef?: (el: HTMLElement | null) => void
}) {
  return (
    <header className="v6-hud" ref={innerRef}>
      <Portrait src={portrait.src} initials={portrait.initials || name.slice(0, 1)} hue={portrait.hue} level={hud.level} xp={hud.xp} onClick={onAvatar} tip={t('v6.tip.profile')} />
      <VitalsBar hud={hud} />
      {children}
      <div className="v6-money">
        <CurrencyPill kind="cash" value={cashCompact(hud.cash, { thousand: t('v6.unit.thousand'), million: t('v6.unit.million') })} onClick={onBank} pending={hud.pending} />
        {hud.gem !== null && <CurrencyPill kind="gem" value={faNum(hud.gem)} onPlus={onBank} />}
      </div>
    </header>
  )
}

// -- side columns --------------------------------------------------------------------------------------

export function Slot({ icon, label, time, idle, ev, dot, tip, onClick }: { icon: string; label: string; time?: string; idle?: boolean; ev?: boolean; dot?: boolean; tip?: string; onClick: () => void }) {
  return (
    <button className={`v6-slot${idle ? ' idle' : ''}${ev ? ' ev' : ''}`} onClick={onClick} data-tip={tip} aria-label={`${label}${time ? ' ' + time : ''}`}>
      <span className="v6-round">
        <Ic name={icon} />
        {dot && <i className="v6-dot" />}
        {!idle && time && <b className="v6-tm">{time}</b>}
      </span>
      <em className="v6-cap v6-otl">{label}</em>
    </button>
  )
}

/** My work in progress (at most 3): my shift, my study, my build. */
export function WipColumn({ slots, onOpen, ownRef }: { slots: WipSlot[]; onOpen: (s: WipSlot) => void; ownRef?: (el: HTMLElement | null) => void }) {
  if (!slots.length) return null
  return (
    <nav className="v6-wip" aria-label={t('v6.wip.title')} ref={ownRef}>
      {slots.map((s) => <Slot key={s.key} icon={s.icon} label={s.label} time={s.time} idle={s.idle} tip={s.tip} onClick={() => onOpen(s)} />)}
    </nav>
  )
}

/** Time-limited events (at most 3). On a phone the column folds away behind a handle fixed to its edge. */
export function EventsColumn({ events, onOpen, desktop, ownRef }: { events: EventSlot[]; onOpen: (e: EventSlot) => void; desktop: boolean; ownRef?: (el: HTMLElement | null) => void }) {
  const [folded, setFolded] = useState(false)
  if (!events.length) return null
  return (
    <nav className={`v6-events${folded && !desktop ? ' collapsed' : ''}`} aria-label={t('v6.events.title')} ref={ownRef}>
      <div className="v6-evs">
        {events.slice(0, 3).map((e) => <Slot key={e.key} ev icon={e.icon} label={e.label} time={e.time} tip={e.tip} onClick={() => onOpen(e)} />)}
      </div>
      <button className="v6-fold" aria-expanded={!folded} aria-label={t(folded ? 'v6.events.unfold' : 'v6.events.fold')} data-tip={t(folded ? 'v6.events.unfold' : 'v6.events.fold')} onClick={() => setFolded((f) => !f)}><i /></button>
    </nav>
  )
}

// -- quest strip + ticker ------------------------------------------------------------------------------

export function QuestStrip({ quest, ticker, onQuest, onTicker, ownRef }: { quest: { text: string; prog: string; done: boolean } | null; ticker: string | null; onQuest: () => void; onTicker: () => void; ownRef?: (el: HTMLElement | null) => void }) {
  if (!quest && !ticker) return null
  return (
    <section className={`v6-info${quest?.done ? ' done' : ''}${quest && !ticker ? ' solo' : ''}`} ref={ownRef}>
      {quest && (
        <button className="v6-quest" onClick={onQuest} aria-live="polite" data-tip={t('v6.tip.quest')} data-key="Enter">
          <i className="v6-glow" />
          <span className="v6-medal"><Ic name={quest.done ? 'check' : 'scroll'} /></span>
          <span className="v6-qtext"><b>{quest.text}</b>{quest.prog && <i className="v6-prog">{quest.prog}</i>}</span>
          <span className="v6-go"><Ic name={quest.done ? 'gift' : 'chev'} /></span>
        </button>
      )}
      {ticker && (
        <button className="v6-ticker" onClick={onTicker} data-tip={t('v6.tip.ticker')} style={!quest ? { borderTop: 0, borderRadius: 15 } : undefined}>
          <Ic name="chat" /><span>{ticker}</span>
        </button>
      )}
    </section>
  )
}

// -- phone dock ------------------------------------------------------------------------------------------

export interface DockTab { key: string; icon: string; label: string; dot?: number }

/** Five slots, the place in the middle and larger, labels always shown. Carries the old class names too
 * (dock-bar, dock-tab, dock-label) so the existing smoke checks keep finding it. */
export function PhoneDock({ tabs, active, onSelect, onLong, middle = 2, ownRef }: { tabs: DockTab[]; active: string; onSelect: (key: string) => void; onLong?: (key: string) => void; middle?: number; ownRef?: (el: HTMLElement | null) => void }) {
  // a long press on the place slot opens the city panel; the click that follows it is swallowed
  const press = useRef<{ timer: number; fired: boolean } | null>(null)
  const down = (key: string) => {
    if (!onLong) return
    const p = { timer: window.setTimeout(() => { p.fired = true; onLong(key) }, 520), fired: false }
    press.current = p
  }
  const up = () => { if (press.current) window.clearTimeout(press.current.timer) }
  return (
    <nav className="v6-dock dock-bar" ref={ownRef} aria-label={t('v6.nav.title')}>
      {tabs.map((tab, i) => {
        const on = tab.key === active
        const mid = i === middle
        return (
          <button key={tab.key} className={`v6-tab dock-tab${mid ? ' mid' : ''}${on ? ' on' : ''}`} onClick={() => { if (press.current?.fired) { press.current = null; return } onSelect(tab.key) }} onPointerDown={mid ? () => down(tab.key) : undefined} onPointerUp={mid ? up : undefined} onPointerLeave={mid ? up : undefined} onPointerCancel={mid ? up : undefined} onContextMenu={mid ? (e) => e.preventDefault() : undefined} aria-current={on ? 'page' : undefined}>
            {mid
              ? <span className="v6-disc"><Ic name={tab.icon} /></span>
              : (
                <span className="v6-ico">
                  <Ic name={tab.icon} />
                  {tab.dot ? (tab.dot > 1 ? <i className="v6-dot n">{tab.dot > 9 ? fa('9+') : fa(tab.dot)}</i> : <i className="v6-dot" />) : null}
                </span>
              )}
            <b className="dock-label">{tab.label}</b>
          </button>
        )
      })}
    </nav>
  )
}

// -- desktop rail + docked panel ---------------------------------------------------------------------------

export interface RailItem { key: string; label: string; on?: boolean; wait?: boolean; onClick: () => void }
export interface RailSection { key: string; icon: string; label: string; kbd: string; items: RailItem[]; onSelect: () => void }

export function NavRail({ sections, active, brand, sub, children }: { sections: RailSection[]; active: string; brand: string; sub?: string; children?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(active)
  useEffect(() => { setOpen(active) }, [active])
  return (
    <aside className="v6-rail dock-bar" aria-label={t('v6.nav.title')}>
      <div className="v6-rail-brand"><b>{brand}</b>{sub && <i>{sub}</i>}</div>
      <nav className="v6-railnav">
        {sections.map((s) => (
          <div key={s.key} className={`v6-rs${open === s.key ? ' open' : ''}${active === s.key ? ' on' : ''}`}>
            <button className="v6-rh" onClick={() => { setOpen(open === s.key && active === s.key ? null : s.key); s.onSelect() }} data-tip={s.label} data-key={s.kbd} aria-expanded={open === s.key} aria-current={active === s.key ? 'page' : undefined}>
              <Ic name={s.icon} /><b>{s.label}</b><kbd>{fa(s.kbd)}</kbd><i className="v6-chev" />
            </button>
            <div className="v6-ri">
              {s.items.map((it) => <button key={it.key} className={`v6-rit${it.on ? ' on' : ''}${it.wait ? ' wait' : ''}`} onClick={it.onClick} aria-current={it.on ? 'true' : undefined}>{it.label}</button>)}
            </div>
          </div>
        ))}
      </nav>
      {children}
    </aside>
  )
}

export function DockedPanel({ crumbs, onClose, children }: { crumbs: { label: string; onClick?: () => void }[]; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="v6-side" aria-label={t('v6.panel.title')}>
      <header>
        <nav className="v6-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <i>{document.documentElement.dir === 'rtl' ? '‹' : '›'}</i>}
              {i === crumbs.length - 1 || !c.onClick ? <span className="cur">{c.label}</span> : <button onClick={c.onClick}>{c.label}</button>}
            </span>
          ))}
        </nav>
        <button className="v6-sx" onClick={onClose} aria-label={t('common.close')} data-tip={t('common.close')} data-key="Esc"><Ic name="close" /></button>
      </header>
      <div className="v6-sbody">{children}</div>
    </aside>
  )
}

// -- the centred confirm popup ------------------------------------------------------------------------------

export type ConfirmRow =
  | { kind: 'info'; label: string; value: string }
  | { kind: 'ok'; label: string }
  | { kind: 'bad'; label: string; value?: string; fixLabel?: string; onFix?: () => void }

export interface ConfirmProps {
  title: string
  rows?: ConfirmRow[]
  note?: string
  primary: string
  /** the reason the primary button is disabled; when set the button is greyed out and the reason is written under it */
  disabledReason?: string
  onPrimary: () => void
  secondary?: string
  onClose: () => void
}

/** The one shape of a confirm: title, requirement rows (a tick, or red with «go fix it»), one gold primary button with a clear
 * disabled state, and a × inside the frame. Centred over the live world, never a sheet (P15, P16). */
export function ConfirmPopup({ title, rows, note, primary, disabledReason, onPrimary, secondary, onClose }: ConfirmProps) {
  const [show, setShow] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => { setShow(true); btn.current?.focus() })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', key, true)
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', key, true) }
  }, [onClose])
  const disabled = !!disabledReason
  return createPortal(
    <div className={`v6-scrim${show ? ' show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="v6-pop" role="dialog" aria-modal="true" aria-label={title}>
        <button className="v6-x" onClick={onClose} aria-label={t('common.close')}><Ic name="close" /></button>
        <h2>{title}</h2>
        {(rows ?? []).map((r, i) => r.kind === 'info'
          ? <div key={i} className="v6-row"><span>{r.label}</span><b>{r.value}</b></div>
          : r.kind === 'ok'
            ? <div key={i} className="v6-row ok"><b>{r.label}</b><Ic name="check" alt={t('v6.have')} /></div>
            : r.onFix
              ? <button key={i} className="v6-row bad tap" onClick={r.onFix}><b>{r.label}</b><span>{r.fixLabel ?? t('v6.fix')}</span></button>
              : <div key={i} className="v6-row bad"><b>{r.label}</b>{r.value && <span>{r.value}</span>}</div>)}
        {note && <p className="note">{note}</p>}
        <div className="v6-btns">
          {disabled
            ? <button ref={btn} className="v6-btn dis" aria-disabled="true"><Ic name="lock" /><span>{primary}</span></button>
            : <button ref={btn} className="v6-btn" onClick={onPrimary}><span>{primary}</span></button>}
          <button className="v6-btn sec" onClick={onClose}><span>{secondary ?? t('common.close')}</span></button>
        </div>
        {disabled && <span className="v6-why">{disabledReason}</span>}
      </div>
    </div>,
    document.body,
  )
}

// -- tooltip (desktop hover) + context menu ------------------------------------------------------------------

/** One tooltip for the whole page: any element with data-tip (and data-key for its shortcut). Hover only. */
export function TipHost() {
  const [tip, setTip] = useState<{ text: string; key?: string; x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return
    let at: Element | null = null
    const over = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]') ?? null
      if (!el || el === at) return
      at = el
      const r = el.getBoundingClientRect()
      setTip({ text: el.getAttribute('data-tip') ?? '', key: el.getAttribute('data-key') ?? undefined, x: r.left + r.width / 2, y: r.bottom })
    }
    const out = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]')
      if (el && el === at) { at = null; setTip(null) }
    }
    const hide = () => { at = null; setTip(null) }
    // a tooltip whose element left the page (a ring closed under the pointer) goes with it
    const move = () => { if (at && !at.isConnected) hide() }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    document.addEventListener('mousedown', hide)
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('mouseout', out); document.removeEventListener('mousedown', hide); document.removeEventListener('mousemove', move) }
  }, [])
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!tip || !ref.current) { setPos(null); return }
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, tip.x - w / 2))
    const top = tip.y + 8 + h > window.innerHeight ? tip.y - h - 40 : tip.y + 8
    setPos({ left, top })
  }, [tip])
  if (!tip || !tip.text) return null
  return createPortal(
    <div ref={ref} className="v6-tip" role="tooltip" style={{ left: pos?.left ?? -999, top: pos?.top ?? -999 }}>
      {tip.text}{tip.key && <kbd>{/^\d$/.test(tip.key) ? fa(tip.key) : tip.key}</kbd>}
    </div>,
    document.body,
  )
}

export interface CtxItem { id: string; label: string; icon: string; kind?: 'primary' | 'info'; off?: boolean; onClick: () => void }

/** The right-click menu: the same verbs, in the same order, as the ring. */
export function ContextMenu({ at, title, items, onClose }: { at: { x: number; y: number }; title: string; items: CtxItem[]; onClose: () => void }) {
  useEffect(() => {
    const off = () => onClose()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t0 = window.setTimeout(() => document.addEventListener('click', off), 0)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', off)
    return () => { clearTimeout(t0); document.removeEventListener('click', off); document.removeEventListener('keydown', key); window.removeEventListener('blur', off) }
  }, [onClose])
  const left = Math.min(window.innerWidth - 212, at.x)
  const top = Math.min(window.innerHeight - 52 - items.length * 40, at.y)
  return createPortal(
    <div className="v6-ctx" role="menu" style={{ left, top }}>
      <h6>{title}</h6>
      {items.map((i) => (
        <button key={i.id} role="menuitem" className={`${i.kind ?? ''}${i.off ? ' off' : ''}`} onClick={() => { onClose(); i.onClick() }}>
          <Ic name={i.icon} />{i.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
