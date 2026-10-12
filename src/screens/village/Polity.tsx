// Shared parts of the screens of unions, treaties, tenders and loans (ADR 0076): a number field, a row of choice chips, a vote tally,
// a confirm popup and the notice strip. Facts come from the server, words are ours; nothing here shows a code.

import type { ReactNode } from 'react'
import Popup, { ActionButton } from '../../ui/Popup'
import { Hint, Lead, Panel } from './flow'
import { formatNumber } from '../native/kit/format'
import { toWesternDigits } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'

/** A word for a code, or the fallback when the code is an authored name; a bare code is never shown. */
export const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : /^[a-z0-9_.-]+$/.test(fallback) ? '' : fallback)

export const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(bps / 100)}٪`

/** The answer of a write: «union_founded» becomes the strip at the top of the screen. */
export function NoticeStrip({ prefix, code }: { prefix: string; code: string }) {
  if (!code || !hasKey(`${prefix}.${code}`)) return null
  return <Panel tone="emerald"><Lead tone="good">{t(`${prefix}.${code}` as Key)}</Lead></Panel>
}

/** Digits typed in Persian or Arabic become a plain integer string. */
export const digits = (raw: string) => toWesternDigits(raw).replace(/[^0-9]/g, '')

export function NumField({ label, value, onChange, hint, suffix }: { label: string; value: string; onChange: (v: string) => void; hint?: string; suffix?: string }) {
  return (
    <label className="tc-f">
      <span>{label}</span>
      <input className="fx-field-input" dir="ltr" inputMode="numeric" value={value} onChange={(e) => onChange(digits(e.target.value))} aria-label={label} />
      {(hint || suffix) && <small className="pu-hint">{hint}{suffix ? ` ${suffix}` : ''}</small>}
    </label>
  )
}

/** One choice out of a few, as chips. */
export function Choice<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: { key: K; text: string }[]; onChange: (k: K) => void }) {
  return (
    <div className="tc-f"><span>{label}</span>
      <div className="rc-chips" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className={`dk-chip${value === o.key ? ' all' : ''}`} onClick={() => onChange(o.key)}>{o.text}</button>)}
      </div>
    </div>
  )
}

/** Several choices out of a few, as chips you switch on and off. */
export function Multi({ label, values, options, onChange }: { label: string; values: string[]; options: { key: string; text: string }[]; onChange: (v: string[]) => void }) {
  return (
    <div className="tc-f"><span>{label}</span>
      <div className="rc-chips" role="group" aria-label={label}>
        {options.map((o) => {
          const on = values.includes(o.key)
          return <button key={o.key} type="button" role="checkbox" aria-checked={on} className={`dk-chip${on ? ' all' : ''}`} onClick={() => onChange(on ? values.filter((x) => x !== o.key) : [...values, o.key])}>{o.text}</button>
        })}
      </div>
    </div>
  )
}

/** Yes and no in a bar, with the numbers under it. */
export function Tally({ yes, no, need }: { yes: number; no: number; need?: number }) {
  const all = Math.max(1, yes + no, need ?? 0)
  return (
    <div className="pu-tally" aria-label={t('pu.tally', { y: formatNumber(yes), n: formatNumber(no) })}>
      <div className="pu-bar"><i className="yes" style={{ width: `${(yes / all) * 100}%` }} /><i className="no" style={{ width: `${(no / all) * 100}%` }} /></div>
      <div className="mn-sub">{t('pu.tally', { y: formatNumber(yes), n: formatNumber(no) })}{need && need > 0 ? ` – ${t('pu.need', { n: formatNumber(need) })}` : ''}</div>
    </div>
  )
}

/** A question with two ways out, in a centred popup. */
export function Ask({ title, body, hint, yes, onYes, onClose, tone = 'gold', busy }: { title: string; body: ReactNode; hint?: string; yes: string; onYes: () => void; onClose: () => void; tone?: 'gold' | 'red' | 'green' | 'navy'; busy?: boolean }) {
  const btn = tone === 'red' ? 'red' : tone === 'green' ? 'green' : 'gold'
  return (
    <Popup open onClose={onClose} tone={tone === 'red' ? 'red' : tone === 'green' ? 'green' : tone === 'navy' ? 'navy' : 'gold'} title={title}
      footer={<div className="lm-craft-foot"><ActionButton tone="steel" small onClick={onClose}>{t('common.cancel')}</ActionButton><ActionButton tone={btn} busy={busy} onClick={() => { onClose(); onYes() }}>{yes}</ActionButton></div>}>
      <Lead>{body}</Lead>
      {hint && <Hint>{hint}</Hint>}
    </Popup>
  )
}

/** «اینجا نیست»: the place is closed, with the day it opens when the server says one. */
export function Closed({ text, hint }: { text: string; hint?: string }) {
  return <Panel><Lead>{text}</Lead>{hint && <Hint>{hint}</Hint>}</Panel>
}

