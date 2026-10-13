// The new shell's chrome: the personal HUD, my work and the events over the world, the quest card, the dock.
// Pure presentation over the data hooks (src/ui/v6/hooks.ts reads the state-sync store; it holds no UI).

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon, Meter } from './ui'
import { icon3d } from './icons'
import { haptic } from '../lib/telegram'
import { t } from '../i18n'
import { cashCompact, fa, faNum } from '../ui/v6/format'
import type { EventSlot, HudData, WipSlot } from '../ui/v6/hooks'
import type { Tab } from './nav'

// -- HUD -----------------------------------------------------------------------------------------------

export function Hud({ hud, name, portrait, onFace, onPurse, onGem }: {
  hud: HudData
  name: string
  portrait: { src: string | null; initials: string; hue: number }
  onFace: () => void
  onPurse: () => void
  onGem: () => void
}) {
  const unit = { thousand: t('v6.unit.thousand'), million: t('v6.unit.million') }
  const vit: { k: string; icon: string; tone?: 'accent' | 'cyan'; v: number; max: number; label: string }[] = [
    { k: 'health', icon: 'health', v: hud.health.v, max: hud.health.max, label: t('v6.vital.health') },
    { k: 'energy', icon: 'energy', tone: 'cyan', v: hud.energy.v, max: hud.energy.max, label: t('v6.vital.energy') },
  ]
  if (hud.nerve) vit.push({ k: 'nerve', icon: 'nerve', tone: 'accent', v: hud.nerve.v, max: hud.nerve.max, label: t('v6.vital.nerve') })
  return (
    <header className="n-hud">
      <button className="n-face" onClick={onFace} aria-label={t('shell.profile')}>
        <i className="n-face-ring" style={{ '--p': hud.xp } as CSSProperties} />
        <span className="n-face-pic" style={!portrait.src ? { background: `linear-gradient(150deg, hsl(${portrait.hue} 55% 46%), hsl(${(portrait.hue + 40) % 360} 55% 30%))` } : undefined}>
          {portrait.src ? <img src={portrait.src} alt="" /> : (portrait.initials || name.slice(0, 1))}
        </span>
        <b className="n-face-lvl">{hud.level}</b>
      </button>
      <div className="n-vit" aria-label={t('v6.vital.mine')}>
        {vit.map((r) => (
          <div key={r.k} className="n-vrow">
            <Icon name={r.icon} alt={r.label} />
            <Meter frac={r.max ? r.v / r.max : 0} tone={r.tone} />
            <b>{r.k === 'nerve' ? `${fa(r.v)}/${fa(r.max)}` : fa(r.v)}</b>
          </div>
        ))}
      </div>
      <div className="n-purse">
        <button className="n-coin" onClick={onPurse} aria-label={t('v6.tip.cash', { v: cashCompact(hud.cash, unit) })}>
          <Icon name="coins" />{cashCompact(hud.cash, unit)}
        </button>
        {hud.local && (
          <button className="n-coin short" onClick={onPurse} aria-label={t('v6.tip.local', { name: hud.local.name, v: cashCompact(hud.local.value, unit) })}>
            <span className="n-coin-l" aria-hidden="true">{[...hud.local.name][0] ?? ''}</span>{cashCompact(hud.local.value, unit)}
          </button>
        )}
        {hud.gem !== null && (
          <div className="n-coin">
            <Icon name="diamond" />{faNum(hud.gem)}
            <button className="n-coin-plus" onClick={onGem} aria-label={t('v6.gem.add')}>+</button>
          </div>
        )}
      </div>
    </header>
  )
}

// -- over the world ------------------------------------------------------------------------------------

function Slot({ icon, label, time, idle, round, lit, dot, onClick }: { icon: string; label: string; time?: string; idle?: boolean; round?: boolean; lit?: boolean; dot?: boolean; onClick: () => void }) {
  return (
    <button className={`n-slot${round ? ' round' : ''}${idle ? ' idle' : ''}${lit ? ' lit' : ''}`} onClick={() => { haptic('tap'); onClick() }} aria-label={`${label}${time ? ' ' + time : ''}`}>
      <span className="n-slot-btn">
        <Icon name={icon3d(icon)} />
        {dot && <i className="n-slot-dot" />}
        {!idle && time && <b className="n-slot-time">{time}</b>}
      </span>
      <span className="n-slot-cap">{label}</span>
    </button>
  )
}

/** My work in progress (a shift, a course, a build): rounded squares on the start side. */
export function WorkRail({ slots, onOpen }: { slots: WipSlot[]; onOpen: (s: WipSlot) => void }) {
  if (!slots.length) return null
  return (
    <nav className="n-rail work" aria-label={t('v6.wip.title')}>
      {slots.map((s) => <Slot key={s.key} icon={s.icon} label={s.label} time={s.time} idle={s.idle} onClick={() => onOpen(s)} />)}
    </nav>
  )
}

/** Time-limited events (an election, a research, a raid): round buttons on the other side, folding behind a handle. */
export function EventRail({ events, onOpen }: { events: EventSlot[]; onOpen: (e: EventSlot) => void }) {
  const [folded, setFolded] = useState(false)
  if (!events.length) return null
  return (
    <nav className={`n-rail events${folded ? ' folded' : ''}`} aria-label={t('v6.events.title')}>
      <div className="n-rail-col">
        {events.slice(0, 3).map((e) => <Slot key={e.key} round icon={e.icon} label={e.label} time={e.time} onClick={() => onOpen(e)} />)}
      </div>
      <button className="n-fold" aria-expanded={!folded} aria-label={t(folded ? 'v6.events.unfold' : 'v6.events.fold')} onClick={() => { haptic('select'); setFolded((f) => !f) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff9d4d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        <b className="n-slot-dot">{fa(Math.min(events.length, 3))}</b>
      </button>
    </nav>
  )
}

/** The next goal with its progress and a «برو», and the newest news under it. */
export function QuestCard({ quest, news, onQuest, onNews }: { quest: { text: string; prog: string; done: boolean } | null; news: string | null; onQuest: () => void; onNews: () => void }) {
  if (!quest && !news) return null
  return (
    <section className={`n-quest${quest?.done ? ' done' : ''}`}>
      {quest && (
        <button className="n-quest-main" onClick={() => { haptic('tap'); onQuest() }}>
          <span className="n-quest-medal"><Icon name={quest.done ? 'm_check' : 'missions'} /></span>
          <span className="n-quest-text"><b>{quest.text}</b>{quest.prog && <span className="n-chip accent">{quest.prog}</span>}</span>
          <span className="n-quest-go">{t(quest.done ? 'v6.quest.claim' : 'v6.quest.go')}</span>
        </button>
      )}
      {news && <button className="n-news" onClick={onNews}><Icon name="m_chat" /><span>{news}</span></button>}
    </section>
  )
}

// -- the dock --------------------------------------------------------------------------------------------

const TAB_ICON: Record<Tab, string> = { me: 'person', activity: 'work', city: 'house', economy: 'market', society: 'society' }

/** Five tabs in a floating pill; the active one rides a raised orange tile that slides to it. */
export function Dock({ active, labels, unread, onSelect, onLong }: { active: Tab; labels: Record<Tab, string>; unread: number; onSelect: (t: Tab) => void; onLong?: (t: Tab) => void }) {
  const nav = useRef<HTMLElement | null>(null)
  const [x, setX] = useState<number | null>(null)
  const press = useRef<number | null>(null)
  const fired = useRef(false)
  useLayoutEffect(() => {
    const el = nav.current
    if (!el) return
    const measure = () => {
      const on = el.querySelector<HTMLElement>('[aria-current="page"]')
      if (on) setX(on.offsetLeft + on.offsetWidth / 2)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])
  const tabs: Tab[] = ['me', 'activity', 'city', 'economy', 'society']
  return (
    <nav className="n-dock" ref={nav} aria-label={t('v6.nav.title')}>
      {x !== null && <span className="n-disc" style={{ transform: `translateX(${x - 31}px)` }} aria-hidden="true"><Icon key={active} name={TAB_ICON[active]} /></span>}
      {tabs.map((k) => (
        <button key={k} className="n-tab" aria-current={k === active ? 'page' : undefined}
          onPointerDown={() => { fired.current = false; if (onLong) press.current = window.setTimeout(() => { fired.current = true; onLong(k) }, 520) }}
          onPointerUp={() => { if (press.current) window.clearTimeout(press.current) }}
          onPointerLeave={() => { if (press.current) window.clearTimeout(press.current) }}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => { if (fired.current) { fired.current = false; return } if (k !== active) haptic('select'); onSelect(k) }}>
          <span className="n-tab-ic">
            <Icon name={TAB_ICON[k]} />
            {k === 'society' && unread > 0 && <i className="n-slot-dot">{unread > 1 ? (unread > 9 ? fa('9+') : fa(unread)) : ''}</i>}
          </span>
          <b>{labels[k]}</b>
        </button>
      ))}
    </nav>
  )
}
