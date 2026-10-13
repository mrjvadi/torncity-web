// The «من» area's shared pieces: a side read of another command's view, the back control, the needs card (Me and
// Life draw the same one), the medals' icons, and the server's remaining actions as rows.

import { useEffect, useState } from 'react'
import * as api from '../../../api/client'
import type { Action, CommandResponse } from '../../../api/types'
import type { NeedsView, SurvivalView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Icon, List, Meter, Row, Section } from '../../ui'
import { icon3d } from '../../icons'
import { hasNativeBack } from '../../../lib/nativeBack'
import { actionLabel } from '../../../screens/village/wording'
import { clamp01, formatNumber, money, splitMoney } from '../../../screens/native/kit/format'
import { hasKey, t, type Key } from '../../../i18n'

/** Another command's view, read beside the open screen (the net worth, the medals); null until it comes (or when
 * it is refused). */
export function useSideView<T>(command: string): T | null {
  const [v, setV] = useState<T | null>(null)
  useEffect(() => {
    let on = true
    api.runCommand(command, {}).then((r) => { if (on && r.ok !== false && r.view) setV(r.view as unknown as T) }).catch(() => undefined)
    return () => { on = false }
  }, [command])
  return v
}

/** The page's own back button, outside Telegram only (inside it the native BackButton is the one way back). */
export function useBack(): (() => void) | undefined {
  const nav = useNav()
  return !nav.atRoot && !hasNativeBack() ? nav.back : undefined
}

/** A sum for a figure tile: the local money large, the SUP amount under it when the viewer has a money of their own. */
export function figure(n: number | undefined): { value: string; note?: string } {
  const m = money(n)
  const s = splitMoney(m)
  return s ? { value: s[0], note: s[1] } : { value: m }
}

/** «a از b» */
export const of = (a: number, b: number): string => t('n.me.of', { a: formatNumber(a), b: formatNumber(b) })

/** A word of the app when it has one, else the fallback. */
export const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)

// -- needs -------------------------------------------------------------------------------------------------

/** One meaning per need: sleepiness, hunger, stress, thirst and cold are worse when HIGHER (a full hunger bar is
 * red); happiness is better when higher. */
const NEED: Record<string, { icon: string; bad: boolean }> = {
  sleep: { icon: 'sleepy', bad: true },
  hunger: { icon: 'm_meal', bad: true },
  happiness: { icon: 'mood', bad: false },
  stress: { icon: 'nerve', bad: true },
  thirst: { icon: 'soda', bad: true },
  warmth: { icon: 'heat', bad: true },
}

function NeedRow({ k, value }: { k: string; value?: number }) {
  if (value === undefined || value === null) return null
  const spec = NEED[k]
  const f = clamp01(value / 100)
  const good = spec.bad ? 1 - f : f
  const tone = good < 0.2 ? 'bad' : good < 0.4 ? 'warn' : k === 'sleep' || k === 'thirst' ? 'cyan' : undefined
  return (
    <div className={`n-me-need${tone === 'bad' ? ' bad' : ''}`}>
      <Icon name={spec.icon} className="n-me-need-ic" />
      <div className="n-me-need-bar"><Meter frac={f} tone={tone} label={t(`need.${k}` as Key)} value={formatNumber(value)} /></div>
    </div>
  )
}

const warmthWord = (level: string): string => (level && level !== 'fine' ? word(`sv.warmth.${level}`) : '')
const thirstWord = (level: number): string => (level > 0 ? word(`sv.thirst.${level}`) : '')
function weatherLine(e: NonNullable<SurvivalView['env']>): string {
  const temp = e.temp_c < 0 ? t('sv.temp_neg', { n: formatNumber(Math.round(-e.temp_c)) }) : t('sv.temp', { n: formatNumber(Math.round(e.temp_c)) })
  return [word(`sv.season.${e.season}`), temp, e.rain ? t('sv.rain') : '', e.wind ? t('sv.wind') : ''].filter(Boolean).join(' · ')
}

/** The needs in one card: sleep, hunger, happiness, stress; thirst and cold beside them only where they run (a
 * founded town), with the state in words and the weather, a tap away from the survival screen. */
export function NeedsCard({ needs, survival }: { needs: Partial<NeedsView> | null | undefined; survival?: SurvivalView | null }) {
  const nav = useNav()
  if (!needs) return null
  const sv = survival?.founded ? survival : null
  const words = sv ? [thirstWord(sv.thirst_level), warmthWord(sv.warmth_level)].filter(Boolean).join('، ') : ''
  return (
    <div className="n-card n-me-needs">
      {(['sleep', 'hunger', 'happiness', 'stress'] as const).map((k) => <NeedRow key={k} k={k} value={needs[k]} />)}
      {sv && <NeedRow k="thirst" value={sv.thirst} />}
      {sv && <NeedRow k="warmth" value={sv.warmth} />}
      {sv && (words || sv.env) && (
        <button className="n-me-weather" onClick={() => nav.run('health.survival')}>
          <Icon name={sv.env?.rain ? 'x_flower' : 'sun'} size={28} />
          <span>
            {words && <b>{words}</b>}
            {sv.env && <small>{weatherLine(sv.env)}</small>}
          </span>
          <svg className="n-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      )}
    </div>
  )
}

// -- medals ------------------------------------------------------------------------------------------------

const MEDALS = ['medal', 'trophy', 'x_laurel', 'ribbon', 'x_star', 'x_crown', 'x_seal', 'x_podium']
/** A medal's icon: the same achievement always gets the same one. */
export function medalOf(code: string): string {
  let h = 0
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MEDALS[h % MEDALS.length]
}

// -- the server's other actions ------------------------------------------------------------------------------

/** The actions a screen does not draw itself, as rows (never back or refresh: the shell has those). */
export function MoreActions({ response, skip, title, icons }: { response: CommandResponse | null; skip?: (a: Action) => boolean; title?: string; icons?: Record<string, string> }) {
  const nav = useNav()
  const rest = (response?.actions ?? []).filter((a) => a.kind !== 'back' && a.id !== 'back' && a.id !== 'refresh' && !(skip?.(a)))
  if (!rest.length) return null
  return (
    <>
      {title && <Section title={title} />}
      <List>
        {rest.map((a, i) => (
          <Row key={i} icon={icons?.[a.id || a.command || ''] ?? icon3d(a.icon?.startsWith('action:') ? undefined : a.icon, a.kind === 'danger' ? 'close' : 'eye')}
            title={actionLabel(a)} onClick={() => nav.act(a)} />
        ))}
      </List>
    </>
  )
}
