// Shared parts of the law screens (ADR 0078, B14): the way to send a verb, the words for the server's codes, a few small cards. Facts come from the server;
// every word is ours and calm: mechanics only, no how-to. A code is never shown; an unknown one reads as a plain «دیگر».

import { useState, type ReactNode } from 'react'
import type { LawView, Named } from '../../api/views.gen'
import { Hint } from './flow'
import Popup, { ActionButton } from '../../ui/Popup'
import { Choice } from './Polity'
import type { FlowCtx } from './flow'
import { sendCmd } from './Mining'
import { word } from './Polity'
import { t } from '../../i18n'
import { formatNumber } from '../native/kit/format'

export type LawV = LawView

export const act = (ctx: FlowCtx, action: string, args: Record<string, string> = {}) => sendCmd(ctx, 'settlement.law', { action, ...args })

export const hoursText = (n: number) => t('time.h', { n: formatNumber(n) })
export const daysText = (n: number) => t('time.d', { n: formatNumber(n) })

export const stateWord = (s: string) => word(`lw.state.${s}`) || t('lw.other')
export const sourceWord = (s: string) => word(`lw.source.${s}`) || t('lw.other')
export const evidenceWord = (k: string) => word(`lw.ev.${k}`) || t('lw.other')
export const sentenceWord = (k: string) => word(`lw.sent.${k}`) || t('lw.other')
export const sentenceStatusWord = (k: string) => word(`lw.sstatus.${k}`) || t('lw.other')
export const classWord = (k: string) => word(`lw.class.${k}`) || t('lw.other')
export const banWord = (k: string) => word(`lw.ban.${k}`) || t('lw.other')
export const rungWord = (k: string) => word(`lw.rung.${k}`) || t('lw.other')
export const serviceWord = (k: string) => word(`lw.service.${k}`) || t('lw.other')

export const STATE_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral' | 'info'> = { open: 'info', charged: 'warn', hearing: 'warn', decided: 'info', appealed: 'warn', final: 'neutral', dropped: 'neutral', lapsed: 'neutral' }

/** What the viewer's words and the offence list say about one offence by its code (a name the server sends is kept as it is). */
export const offenceName = (v: LawView, o: Named) => (v.offences ?? []).find((x) => x.code === o.code)?.name || o.name || t('lw.other')

/** A bar of 0 to 100. */
export function Meter({ value, max = 100, bad }: { value: number; max?: number; bad?: boolean }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  return <div className="mn-bar" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i className={bad ? 'bad' : ''} style={{ width: `${pct}%` }} /></div>
}

/** The row of tabs of the law screen; wraps on a phone, never scrolls sideways. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; text: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="lw-tabs" role="tablist">
      {tabs.map((x) => <button key={x.key} type="button" role="tab" aria-selected={value === x.key} className={`dk-chip${value === x.key ? ' all' : ''}`} onClick={() => onChange(x.key)}>{x.text}</button>)}
    </div>
  )
}

/** A part that has not started or is not here: one plain line, no dead end. */
export function NotYet({ text, hint }: { text: string; hint?: ReactNode }) {
  return <div className="lw-notyet"><b>{text}</b>{hint && <Hint>{hint}</Hint>}</div>
}

/** A manifest «bread:2,coffee:1» from the typed rows (only the ones above zero). */
export const manifest = (rows: Record<string, string>) => Object.entries(rows).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${k}:${Number(n)}`).join(',')

/** A manifest of the server (a map of good to count) as «۲ نان، ۱ قهوه»; names by code through our own wording. */
export const manifestText = (ctx: FlowCtx, m: Record<string, number> | null | undefined, known: Named[] = []) =>
  Object.entries(m ?? {}).map(([k, n]) => `${formatNumber(n)} ${goodName(ctx, known.find((x) => x.code === k) ?? { code: k, name: '' })}`).join('، ')

/** The name of a good: our own wording by its code, else the server's name; never the bare code. */
export const goodName = (ctx: FlowCtx, n: Named) => {
  const cat = ctx.names.name(['component', 'item'], n.code, '')
  return (cat && cat !== n.code ? cat : '') || (n.name && n.name !== n.code ? n.name : '') || t('lw.other')
}

/** A pick list of people (or any named things): chips when there are few, a search box and a scrolling list when many. */
export function PickName({ label, items, value, onChange, sub, empty }: { label: string; items: Named[]; value: string; onChange: (code: string) => void; sub?: (n: Named) => string | undefined; empty: string }) {
  const [q, setQ] = useState('')
  if (items.length === 0) return <Hint>{empty}</Hint>
  const many = items.length > 8
  const shown = many && q.trim() ? items.filter((x) => x.name.includes(q.trim())) : items
  return (
    <div className="tc-f"><span>{label}</span>
      {many && <input className="fx-field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('lw.pick_search')} aria-label={t('lw.pick_search')} />}
      <div className={many ? 'lw-pick' : 'rc-chips'} role="radiogroup" aria-label={label}>
        {shown.map((x) => <button key={x.code} type="button" role="radio" aria-checked={value === x.code} className={`dk-chip${value === x.code ? ' all' : ''}`} onClick={() => onChange(x.code)}>{x.name || t('lw.unknown_person')}{sub?.(x) ? ` – ${sub(x)}` : ''}</button>)}
        {shown.length === 0 && <small className="pu-hint">{t('lw.pick_nomatch')}</small>}
      </div>
    </div>
  )
}

/** The complaint popup: an offence the town lists and a resident picked by name. */
export function Complain({ v, ctx, offence, onClose }: { v: LawV; ctx: FlowCtx; offence?: string; onClose: () => void }) {
  const listed = (v.offences ?? []).filter((o) => o.listed)
  const people = v.people ?? []
  const [code, setCode] = useState(offence ?? listed[0]?.code ?? '')
  const [player, setPlayer] = useState('')
  const ok = !!code && !!player
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.complain_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lw.complain_need')} onClick={() => { onClose(); act(ctx, 'complain', { code, player }) }}>{t('lw.complain_go')}</ActionButton>}>
      <Choice label={t('lw.offence')} value={code} onChange={setCode} options={listed.map((o) => ({ key: o.code, text: o.name }))} />
      <PickName label={t('lw.player')} items={people} value={player} onChange={setPlayer} empty={t('lw.pick_none')} />
      <Hint>{t('lw.complain_hint')}</Hint>
    </Popup>
  )
}

/** A popup that asks for one person, picked from a list of names. */
export function PlayerForm({ title, hint, go, ctx, onClose, onGo, items, empty, tone = 'gold' }: { title: string; hint: string; go: string; ctx: FlowCtx; onClose: () => void; onGo: (player: string) => void; items: Named[]; empty?: string; tone?: 'gold' | 'red' }) {
  const [player, setPlayer] = useState('')
  return (
    <Popup open onClose={onClose} tone={tone} title={title}
      footer={<ActionButton tone={tone} disabled={ctx.busy || !player} reason={player ? undefined : (items.length === 0 ? (empty ?? t('lw.pick_none')) : t('lw.player_need'))} onClick={() => { onClose(); onGo(player) }}>{go}</ActionButton>}>
      <PickName label={t('lw.player')} items={items} value={player} onChange={setPlayer} empty={empty ?? t('lw.pick_none')} />
      <Hint>{hint}</Hint>
    </Popup>
  )
}
