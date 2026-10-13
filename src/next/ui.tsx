// The new UI's components, written from scratch (2026-10). Pure presentation: data comes in as props, events go out
// as callbacks. Styles: next.css (every class `n-`). Icons are the game's amber 3D set (public/icons3d/amber).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../lib/telegram'
import { t } from '../i18n'

const BASE = import.meta.env.BASE_URL

/** A 3D icon by its name in public/icons3d/amber (`work`, `bank`, `m_backpack`...). */
export function Icon({ name, size, className, alt = '' }: { name: string; size?: number; className?: string; alt?: string }) {
  // amber first, then the gold twin, then a neutral icon: a name the set lacks never shows a broken picture
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [name])
  const src = step === 0 ? `${BASE}icons3d/amber/${name}.webp` : step === 1 ? `${BASE}icons3d/gold/${name}.webp` : `${BASE}icons3d/amber/eye.webp`
  return (
    <img className={`n-ic${className ? ' ' + className : ''}`} src={src} alt={alt} draggable={false}
      style={size ? { width: size, height: size } : undefined} onError={() => setStep((s) => Math.min(2, s + 1))} />
  )
}

const Chev = () => <svg className="n-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
const XMark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>

// -- page --------------------------------------------------------------------------------------------------

/** A screen: a scrolling page under the HUD with a large title. `onBack` draws a back button (outside Telegram only:
 * inside it the native BackButton is the one way back). */
export function Page({ title, sub, art, end, onBack, children }: { title: ReactNode; sub?: ReactNode; art?: string; end?: ReactNode; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="n-page">
      <div className="n-page-in">
        <header className="n-head">
          {onBack && <button className="n-back" onClick={onBack} aria-label={t('common.back')}><Back /></button>}
          <div className="n-head-text">
            <h1>{title}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {end && <div className="n-head-end">{end}</div>}
          {art && <Icon name={art} className="n-head-art" />}
        </header>
        {children}
      </div>
    </div>
  )
}

export function Section({ title, end, note }: { title: ReactNode; end?: ReactNode; note?: ReactNode }) {
  return (
    <div className="n-sec">
      <h2>{title}</h2>
      {note && <span className="n-sec-note">{note}</span>}
      {end}
    </div>
  )
}

/** A link at the end of a section title («همه»). */
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="n-sec-end" onClick={onClick}>{children}</button>
}

// -- cards -------------------------------------------------------------------------------------------------

export function Card({ children, tone, flat, onClick, className }: { children: ReactNode; tone?: 'lit' | 'bad'; flat?: boolean; onClick?: () => void; className?: string }) {
  const cls = `n-card${tone ? ' ' + tone : ''}${flat ? ' flat' : ''}${className ? ' ' + className : ''}`
  return onClick ? <button className={cls} style={{ width: '100%', textAlign: 'start' }} onClick={onClick}>{children}</button> : <div className={cls}>{children}</div>
}

/** The big card at the top of a screen: the wallet, the identity card. `art` is a 3D icon in its corner. */
export function Hero({ children, art }: { children: ReactNode; art?: string }) {
  return (
    <section className={`n-hero${art ? ' has-art' : ''}`}>
      {art && <Icon name={art} className="n-hero-art" />}
      <div className="n-hero-body">{children}</div>
    </section>
  )
}

// -- tiles -------------------------------------------------------------------------------------------------

export function Tiles({ children, three }: { children: ReactNode; three?: boolean }) {
  return <div className={`n-tiles${three ? ' three' : ''}`}>{children}</div>
}

/** A choice as a big tile: the 3D icon at the top, the name (and a line) at the foot, a badge in the corner.
 * `off` is something not open yet: dashed and greyed, still telling why in `sub`. */
export function Tile({ icon, title, sub, badge, tone, off, onClick }: { icon: string; title: ReactNode; sub?: ReactNode; badge?: ReactNode; tone?: 'lit' | 'bad'; off?: boolean; onClick?: () => void }) {
  return (
    <button className={`n-tile${tone ? ' ' + tone : ''}${off ? ' off' : ''}`} onClick={off ? undefined : () => { haptic('tap'); onClick?.() }} aria-disabled={off || undefined}>
      {badge !== undefined && badge !== null && badge !== '' && <span className="n-tile-badge">{badge}</span>}
      <Icon name={icon} className="n-tile-ic" />
      <span>
        <span className="n-tile-title">{title}</span>
        {sub && <span className="n-tile-sub">{sub}</span>}
      </span>
    </button>
  )
}

/** Something running for the player now (a shift, a course): a wide card, the time left large at the end. */
export function Now({ icon, title, sub, time, frac, lit, onClick }: { icon: string; title: ReactNode; sub?: ReactNode; time?: string; frac?: number; lit?: boolean; onClick?: () => void }) {
  return (
    <button className={`n-now${lit ? ' lit' : ''}`} onClick={() => { haptic('tap'); onClick?.() }}>
      <span className="n-now-well"><Icon name={icon} size={44} /></span>
      <span className="n-now-body">
        <span className="n-now-title">{title}</span>
        {sub && <span className="n-now-sub">{sub}</span>}
        {frac !== undefined && <Meter frac={frac} tone={lit ? 'accent' : 'cyan'} />}
      </span>
      {time && <b className="n-now-time">{time}</b>}
    </button>
  )
}

// -- rows --------------------------------------------------------------------------------------------------

/** Rows grouped in one card with dividers (`List`), or as separate cards (`Rows`). */
export function List({ children }: { children: ReactNode }) { return <div className="n-list">{children}</div> }
export function Rows({ children }: { children: ReactNode }) { return <div className="n-rows">{children}</div> }

/** One row: an icon well (or an avatar letter), a title and a sub line, something at the end (a value, a chip, a
 * button). With `onClick` the whole row is a button and gets a chevron when nothing else is at its end. */
export function Row({ icon, avatar, title, sub, end, onClick }: { icon?: string; avatar?: { letter: string; hue: number }; title: ReactNode; sub?: ReactNode; end?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      {icon && <span className="n-row-well"><Icon name={icon} /></span>}
      {avatar && <span className="n-row-av" style={{ background: `hsl(${avatar.hue} 42% 38%)` }}>{avatar.letter}</span>}
      <span className="n-row-body">
        <span className="n-row-title">{title}</span>
        {sub && <span className="n-row-sub">{sub}</span>}
      </span>
      {end !== undefined ? <span className="n-row-end">{end}</span> : onClick ? <Chev /> : null}
    </>
  )
  return onClick ? <button className="n-row" onClick={() => { haptic('tap'); onClick() }}>{body}</button> : <div className="n-row">{body}</div>
}

// -- figures -----------------------------------------------------------------------------------------------

export function Stats({ children, three }: { children: ReactNode; three?: boolean }) { return <div className={`n-stats${three ? ' three' : ''}`}>{children}</div> }

export function Stat({ icon, label, value, note, tone }: { icon?: string; label: ReactNode; value: ReactNode; note?: ReactNode; tone?: 'lit' | 'bad' }) {
  return (
    <div className={`n-stat${tone ? ' ' + tone : ''}`}>
      {icon && <Icon name={icon} />}
      <span>{label}</span>
      <b>{value}</b>
      {note && <small>{note}</small>}
    </div>
  )
}

/** Three figures side by side in one card, divided (the vitals, a city's counts). */
export function Strip({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return <div className="n-strip">{items.map((x, i) => <div key={i}><b>{x.value}</b><span>{x.label}</span></div>)}</div>
}

export function KV({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="n-kv"><span>{label}</span><b>{value}</b></div>
}

export function Meter({ frac, tone, thick, label, value }: { frac: number; tone?: 'accent' | 'cyan' | 'warn' | 'bad'; thick?: boolean; label?: ReactNode; value?: ReactNode }) {
  const bar = <div className={`n-meter${tone ? ' ' + tone : ''}${thick ? ' thick' : ''}`}><i style={{ '--p': Math.max(0, Math.min(1, frac || 0)) } as CSSProperties} /></div>
  if (!label && !value) return bar
  return <div><div className="n-meter-head"><span>{label}</span><b>{value}</b></div>{bar}</div>
}

/** A path of stages (open → charged → hearing → verdict → final): done ones lit, the current one glowing. */
export function Steps({ steps, at }: { steps: string[]; at: number }) {
  return (
    <div className="n-steps">
      {steps.map((s, i) => <div key={i} className={i < at ? 'done' : i === at ? 'now' : ''}><i /><span>{s}</span></div>)}
    </div>
  )
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'accent' | 'solid' | 'cyan' | 'ok' | 'warn' | 'bad' }) {
  return <span className={`n-chip${tone ? ' ' + tone : ''}`}>{children}</span>
}

// -- actions -----------------------------------------------------------------------------------------------

/** A button: `primary` (the one orange per screen), `cyan`, `ghost`, `danger`, `text`. A disabled button stays
 * pressable for the eye and says why under it (`reason`). */
export function Button({ children, kind = 'primary', icon, small, block, disabled, reason, onClick }: {
  children: ReactNode; kind?: 'primary' | 'cyan' | 'ghost' | 'danger' | 'text'; icon?: string; small?: boolean; block?: boolean; disabled?: boolean; reason?: ReactNode; onClick?: () => void
}) {
  return (
    <>
      <button className={`n-btn ${kind}${small ? ' small' : ''}${block ? ' block' : ''}`} aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : () => { haptic('tap'); onClick?.() }}>
        {icon && <Icon name={icon} />}{children}
      </button>
      {disabled && reason && <p className="n-why">{reason}</p>}
    </>
  )
}

export function Buttons({ children, lead }: { children: ReactNode; lead?: boolean }) {
  return <div className={`n-btns${lead ? ' lead' : ''}`}>{children}</div>
}

/** Tabs or a filter as an orange pill in a dark well. */
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: ReactNode; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="n-seg" role="tablist">
      {items.map((x) => (
        <button key={x.key} role="tab" aria-selected={x.key === value} onClick={() => { if (x.key !== value) { haptic('select'); onChange(x.key) } }}>
          {x.label}{x.count ? <Chip tone={x.key === value ? undefined : 'bad'}>{x.count}</Chip> : null}
        </button>
      ))}
    </div>
  )
}

/** A row of filter pills that scrolls sideways (categories). */
export function Pills<K extends string>({ items, value, onChange }: { items: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="n-pills">
      {items.map((x) => <button key={x.key} aria-pressed={x.key === value} onClick={() => { haptic('select'); onChange(x.key) }}>{x.label}</button>)}
    </div>
  )
}

// -- states ------------------------------------------------------------------------------------------------

export function Note({ children, tone, icon }: { children: ReactNode; tone?: 'info' | 'ok' | 'bad'; icon?: string }) {
  return <div className={`n-note${tone ? ' ' + tone : ''}`}>{icon && <Icon name={icon} />}<div className="n-note-body">{children}</div></div>
}

export function Empty({ icon = 'box', children }: { icon?: string; children: ReactNode }) {
  return <div className="n-empty"><Icon name={icon} />{children}</div>
}

/** The page while its first answer is on the way: grey blocks where the content will be. */
export function Loading({ blocks = [140, 64, 64, 64] }: { blocks?: number[] }) {
  return <>{blocks.map((h, i) => <div key={i} className="n-skel" style={{ height: h }} aria-hidden="true" />)}<span className="n-sr">{t('common.loading')}</span></>
}

// -- sheets ------------------------------------------------------------------------------------------------

/** A bottom sheet over the screen (a centred dialog on desktop): a title with an icon, a close button, any content.
 * Escape and a tap on the scrim close it. */
export function Sheet({ title, icon, onClose, children }: { title: ReactNode; icon?: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', key, true)
    box.current?.querySelector<HTMLElement>('button, input, textarea')?.focus()
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])
  return createPortal(
    <div className="n-layer" dir={document.documentElement.dir}>
      <div className="n-scrim" onClick={onClose} />
      <div className="n-sheet" role="dialog" aria-modal="true" ref={box}>
        <div className="n-sheet-in">
          <span className="n-grab" aria-hidden="true" />
          <div className="n-sheet-head">
            {icon && <Icon name={icon} />}
            <h2>{title}</h2>
            <button className="n-x" onClick={onClose} aria-label={t('common.close')}><XMark /></button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Ask before something that cannot be undone or costs: the question, the facts, a confirm and a cancel. */
export function Confirm({ title, icon, children, confirm, danger, onConfirm, onClose }: { title: ReactNode; icon?: string; children?: ReactNode; confirm: ReactNode; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} icon={icon} onClose={onClose}>
      {children}
      <Buttons lead>
        <Button kind={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirm}</Button>
        <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      </Buttons>
    </Sheet>
  )
}

/** A hue for a name, so the same person always gets the same avatar colour. */
export function hueOf(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/** The first letter of a name, for an avatar. */
export function letterOf(name: string): string {
  return Array.from(name.trim())[0] ?? '؟'
}
