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

/** Server fields that the contract may still grow (see the server asks of the B14 web report); read when present, never required. */
export interface LawExt {
  /** the gang of the viewer's group, only for a member who may know (hidden otherwise) */
  gang?: { leader: boolean; marked: boolean; declared: boolean; heat: number; max: number } | null
  /** what the viewer carries, for a declared load and a listing */
  goods?: { item: Named; have: number }[] | null
  /** towns a load may be declared to */
  towns?: Named[] | null
  /** the viewer's companies (a front, a batch) */
  companies?: Named[] | null
  /** brokers of the hidden board the viewer may use */
  brokers?: Named[] | null
}
export type LawV = LawView & LawExt

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

/** A manifest of the server (a map of good to count) as «۲ نان، ۱ قهوه»; a name comes from the server's own list of goods, else the catalogue. */
export const manifestText = (ctx: FlowCtx, m: Record<string, number> | null | undefined, known: Named[] = []) =>
  Object.entries(m ?? {}).map(([k, n]) => {
    const own = known.find((x) => x.code === k)?.name
    const cat = ctx.names.name(['component', 'item'], k, '')
    return `${formatNumber(n)} ${own || (cat && cat !== k ? cat : t('lw.other'))}`
  }).join('، ')

/** The complaint popup: an offence the town lists and the other person's code. */
export function Complain({ v, ctx, offence, onClose }: { v: LawV; ctx: FlowCtx; offence?: string; onClose: () => void }) {
  const listed = (v.offences ?? []).filter((o) => o.listed)
  const [code, setCode] = useState(offence ?? listed[0]?.code ?? '')
  const [player, setPlayer] = useState('')
  const ok = !!code && player.trim().length > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.complain_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lw.complain_need')} onClick={() => { onClose(); act(ctx, 'complain', { code, player: player.trim() }) }}>{t('lw.complain_go')}</ActionButton>}>
      <Choice label={t('lw.offence')} value={code} onChange={setCode} options={listed.map((o) => ({ key: o.code, text: o.name }))} />
      <label className="tc-f"><span>{t('lw.player')}</span>
        <input className="fx-field-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value)} aria-label={t('lw.player')} />
        <small className="pu-hint">{t('lw.player_hint')}</small>
      </label>
      <Hint>{t('lw.complain_hint')}</Hint>
    </Popup>
  )
}


/** A popup that asks for one player's code. */
export function PlayerForm({ title, hint, go, ctx, onClose, onGo, tone = 'gold' }: { title: string; hint: string; go: string; ctx: FlowCtx; onClose: () => void; onGo: (player: string) => void; tone?: 'gold' | 'red' }) {
  const [player, setPlayer] = useState('')
  return (
    <Popup open onClose={onClose} tone={tone} title={title}
      footer={<ActionButton tone={tone} disabled={ctx.busy || !player.trim()} reason={player.trim() ? undefined : t('lw.player_need')} onClick={() => { onClose(); onGo(player.trim()) }}>{go}</ActionButton>}>
      <label className="tc-f"><span>{t('lw.player')}</span>
        <input className="fx-field-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value)} aria-label={t('lw.player')} />
        <small className="pu-hint">{t('lw.player_hint')}</small>
      </label>
      <Hint>{hint}</Hint>
    </Popup>
  )
}

