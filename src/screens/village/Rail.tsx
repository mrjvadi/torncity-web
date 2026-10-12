// «ریل» (ADR 0075): the quote of a line between two stations (a centre popup), the lines (stations open today, sections laid, worst condition, the rate, loops),
// the trains (status, where, cargo, why one waits, the schedule, start and halt) and the freight bookings. Drawing picks two stations from lists, so no
// 3D scene is touched; every act is a host write.

import { useState } from 'react'
import type { RailLineLine, RailTrainLine, RailView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { hasKey, t } from '../../i18n'
import { matLine, pct, sendCmd, word } from './Mining'
import { GoodsPick } from './GoodsPick'

const seen = (v: RailView) => [...(v.trains ?? []).flatMap((x) => [...(x.cargo ?? []).map((c) => c.item), ...(x.steps ?? []).map((st) => st.item)]), ...(v.bookings ?? []).map((b) => b.item)].filter((i) => i.code)

registerWrites(['settlement.rail'], (a) => !!a.args?.action && a.args.action !== 'plan')

const last = { cls: '', from: '', to: '' }

function Draw({ v, ctx }: { v: RailView; ctx: FlowCtx }) {
  const classes = v.classes ?? []
  const stations = v.stations ?? []
  const [cls, setCls] = useState(classes[0]?.class.code ?? '')
  const [a, setA] = useState(stations[0]?.id ?? '')
  const [b, setB] = useState(stations[1]?.id ?? '')
  const c = classes.find((x) => x.class.code === cls)
  if (stations.length < 2) return <Hint>{t('rl.need_stations')}</Hint>
  const pick = (cur: string, set: (s: string) => void) => <div className="rc-chips" role="radiogroup">{stations.map((s) => <button key={s.id} type="button" role="radio" aria-checked={cur === s.id} className={`dk-chip${cur === s.id ? ' all' : ''}`} onClick={() => set(s.id)}>{ctx.bname(s.building.code, s.building.name)} – {s.settlement.name}</button>)}</div>
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('rl.draw_title')}</b></div>
      <div className="tc-f"><span>{t('rl.class')}</span><div className="rc-chips" role="radiogroup">{classes.map((x) => <button key={x.class.code} type="button" role="radio" aria-checked={cls === x.class.code} className={`dk-chip${cls === x.class.code ? ' all' : ''}`} onClick={() => setCls(x.class.code)}>{x.class.name}</button>)}</div></div>
      {c && <div className="mn-sub">{t('rl.class_line', { s: formatNumber(c.speed_kmh), k: formatNumber(c.consist_kg), g: pct(c.max_grade_bps) })}</div>}
      {c && !c.can_lay && <Note tone="bad">{t('mn.missing', { list: (c.missing ?? []).map((x) => x.name).join('، ') || '—' })}</Note>}
      <div className="tc-f"><span>{t('rl.from')}</span>{pick(a, setA)}</div>
      <div className="tc-f"><span>{t('rl.to')}</span>{pick(b, setB)}</div>
      <ActionButton tone="gold" small disabled={ctx.busy || !cls || !a || !b || a === b || (c ? !c.can_lay : false)} onClick={() => { last.cls = cls; last.from = a; last.to = b; sendCmd(ctx, 'settlement.rail', { action: 'plan', code: cls, n: a, m: b }) }}>{t('rl.plan')}</ActionButton>
    </div>
  )
}

function Line({ l, v, ctx }: { l: RailLineLine; v: RailView; ctx: FlowCtx }) {
  const [rate, setRate] = useState(String(l.rate_per_tonne_km || ''))
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{l.name}</b><EffectChip tone={l.status === 'open' ? 'good' : l.status === 'building' ? 'warn' : 'neutral'}>{word(`rl.status.${l.status}`, l.status)}</EffectChip></div>
      <div className="mn-sub">{l.class.name} – {t('hl.km', { n: formatNumber(Math.round(l.length_m / 100) / 10) })} – {t('rl.sections', { a: formatNumber(l.built), b: formatNumber(l.sections) })}</div>
      <div className="mn-sub">{t('rl.condition', { p: pct(l.worst_condition_bps) })}{l.rate_per_tonne_km > 0 ? ` – ${t('rl.rate', { m: money(l.rate_per_tonne_km) })}` : ''}{l.laying && l.due_at ? ` – ${t('rl.laying', { at: atText(l.due_at) })}` : ''}</div>
      <div className="vf-list">{(l.stops ?? []).map((s) => <div key={s.id} className="vf-line"><span>{ctx.bname(s.building.code, s.building.name)} – {s.settlement.name}</span><b>{s.open ? t('rl.open_today') : t('rl.shut_today')}</b></div>)}</div>
      {l.mine && v.may_draw && (
        <div className="wk-btns">
          {l.built < l.sections && <ActionButton tone="gold" small disabled={ctx.busy || l.laying} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'build', code: l.id, n: '10' })}>{l.laying ? t('rl.laying_now') : t('rl.build_ten')}</ActionButton>}
          {l.status === 'open' && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'train', code: l.id, n: '3', m: t('rl.train_name', { n: formatNumber(l.trains + 1) }) })}>{t('rl.add_train')}</ActionButton>}
        </div>
      )}
      {l.mine && v.may_draw && l.status === 'open' && (
        <div className="rd-form">
          <label className="tc-f"><span>{t('rl.set_rate')}</span><input className="fx-field-input" dir="ltr" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} aria-label={t('rl.set_rate')} /></label>
          <ActionButton tone="steel" small disabled={ctx.busy || !(Number(rate) > 0)} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'rate', code: l.id, n: String(Number(rate)) })}>{t('rl.rate_go')}</ActionButton>
        </div>
      )}
    </div>
  )
}

function Train({ tr, v, ctx }: { tr: RailTrainLine; v: RailView; ctx: FlowCtx }) {
  const [item, setItem] = useState('')
  const line = (v.lines ?? []).find((l) => l.id === tr.line)
  const [stop, setStop] = useState(line?.stops?.[0]?.id ?? '')
  const [op, setOp] = useState('load')
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{tr.name}</b><EffectChip tone={tr.status === 'running' ? 'good' : tr.stuck ? 'bad' : 'neutral'}>{word(`rl.tstatus.${tr.status}`, tr.status)}</EffectChip></div>
      <div className="mn-sub">{t('rl.train_line', { w: formatNumber(tr.wagons), k: formatNumber(tr.capacity_kg) })}{tr.at.name ? ` – ${t('rl.at', { p: tr.at.name })}` : ''}{tr.next_at ? ` – ${t('rl.next', { at: atText(tr.next_at) })}` : ''}</div>
      {tr.reason && <Note tone="bad">{word(`rl.reason.${tr.reason}`, tr.reason)}</Note>}
      {(tr.cargo ?? []).length > 0 && <div className="mn-sub">{t('rl.cargo')}: {(tr.cargo ?? []).map((c) => `${formatNumber(c.qty)} ${ctx.names.name(['component', 'item'], c.item.code, c.item.name)} ← ${c.to.name}`).join('، ')}</div>}
      <div className="vf-list">{(tr.steps ?? []).map((s) => <div key={s.seq} className="vf-line"><span>{formatNumber(s.seq)}. {word(`rl.op.${s.op}`, s.op)} {s.item.name ? ctx.names.name(['component', 'item'], s.item.code, s.item.name) : ''}</span><b>{s.stop.settlement.name}{s.wait_minutes > 0 ? ` – ${t('rl.wait', { n: formatNumber(s.wait_minutes) })}` : ''}</b></div>)}</div>
      {tr.mine && v.may_draw && (
        <>
          <div className="tc-f"><span>{t('rl.add_step')}</span>
            <div className="rc-chips" role="radiogroup">{(line?.stops ?? []).map((s) => <button key={s.id} type="button" role="radio" aria-checked={stop === s.id} className={`dk-chip${stop === s.id ? ' all' : ''}`} onClick={() => setStop(s.id)}>{s.settlement.name}</button>)}</div>
            <div className="rc-chips" role="radiogroup">{['load', 'unload', 'pass'].map((o) => <button key={o} type="button" role="radio" aria-checked={op === o} className={`dk-chip${op === o ? ' all' : ''}`} onClick={() => setOp(o)}>{word(`rl.op.${o}`, o)}</button>)}</div>
            {op !== 'pass' && <GoodsPick value={item} onChange={setItem} suggest={seen(v)} ctx={ctx} />}
          </div>
          <div className="wk-btns">
            <ActionButton tone="steel" small disabled={ctx.busy || !stop || (op !== 'pass' && !item)} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'step', code: tr.id, n: stop, m: op, ...(item ? { k: item } : {}) })}>{t('rl.add_step_go')}</ActionButton>
            <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'clear', code: tr.id })}>{t('rl.clear')}</ActionButton>
            {tr.status === 'running' ? <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'halt', code: tr.id })}>{t('rl.halt')}</ActionButton> : <ActionButton tone="green" small disabled={ctx.busy || (tr.steps ?? []).length === 0} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'start', code: tr.id })}>{t('rl.start')}</ActionButton>}
          </div>
        </>
      )}
    </div>
  )
}

function Book({ v, ctx }: { v: RailView; ctx: FlowCtx }) {
  const lines = (v.lines ?? []).filter((l) => l.status === 'open')
  const [lid0, setLid] = useState('')
  const lid = lid0 || (lines[0]?.id ?? '')
  const line = lines.find((l) => l.id === lid)
  const [stop, setStop] = useState('')
  const [item, setItem] = useState('')
  const [qty, setQty] = useState('10')
  const [ask, setAsk] = useState(false)
  if (!lines.length) return <Hint>{t('rl.book_none')}</Hint>
  const n = Number(qty.replace(/[^0-9]/g, '')) || 0
  const fee = (line?.rate_per_tonne_km ?? 0) * (n / 1000) * ((line?.length_m ?? 0) / 1000)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('rl.book_title')}</b></div>
      <div className="rc-chips" role="radiogroup">{lines.map((l) => <button key={l.id} type="button" role="radio" aria-checked={lid === l.id} className={`dk-chip${lid === l.id ? ' all' : ''}`} onClick={() => { setLid(l.id); setStop('') }}>{l.name}</button>)}</div>
      <div className="tc-f"><span>{t('rl.book_to')}</span><div className="rc-chips" role="radiogroup">{(line?.stops ?? []).map((s) => <button key={s.id} type="button" role="radio" aria-checked={stop === s.id} className={`dk-chip${stop === s.id ? ' all' : ''}`} onClick={() => setStop(s.id)}>{s.settlement.name}</button>)}</div></div>
      <div className="tc-f"><span>{t('hl.item')}</span><GoodsPick value={item} onChange={setItem} suggest={seen(v)} ctx={ctx} /></div>
      <label className="tc-f"><span>{t('hl.qty')}</span><input className="fx-field-input" dir="ltr" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-label={t('hl.qty')} /></label>
      <ActionButton tone="gold" small disabled={ctx.busy || !stop || !item || n < 1} onClick={() => setAsk(true)}>{t('rl.book')}</ActionButton>
      {ask && (
        <Popup open onClose={() => setAsk(false)} tone="gold" title={t('rl.book_confirm_title')} footer={<div className="lm-craft-foot"><ActionButton tone="steel" small onClick={() => setAsk(false)}>{t('common.cancel')}</ActionButton><ActionButton tone="gold" onClick={() => { setAsk(false); sendCmd(ctx, 'settlement.rail', { action: 'book', code: lid, n: String(n), m: item, k: stop }) }}>{t('rl.book_go')}</ActionButton></div>}>
          <Lead>{t('rl.book_confirm', { n: formatNumber(n), item: ctx.names.name(['item', 'component'], item), rate: money(line?.rate_per_tonne_km ?? 0) })}</Lead>
          <Hint>{t('rl.book_fee', { fee: money(Math.round(fee)) })}</Hint>
        </Popup>
      )}
    </div>
  )
}

export const Rail = flow<RailView>(({ view: v, ctx }) => {
  const q = v.quote
  if (!v.open) return <Page title={t('rl.title')} tone="gold"><Panel><Lead>{t('rl.off')}</Lead><Hint>{t('mn.off_hint')}</Hint></Panel></Page>
  return (
    <Page title={t('rl.title')} tone="gold">
      {v.notice && hasKey(`rl.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`rl.notice.${v.notice}`)}</Lead></Panel>}
      {q && (
        <Popup open onClose={() => ctx.run('settlement.rail')} tone="gold" title={t('rl.quote_title')}
          footer={<div className="lm-craft-foot"><ActionButton tone="steel" small onClick={() => ctx.run('settlement.rail')}>{t('common.cancel')}</ActionButton><ActionButton tone="gold" disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'draw', code: last.cls || q.class.code, n: last.from, m: last.to })}>{t('rl.draw_go')}</ActionButton></div>}>
          <Lead>{t('rl.quote_lead', { a: q.from.name, b: q.to.name })}</Lead>
          <div className="vf-list">
            <div className="vf-line"><span>{t('rl.q.sections')}</span><b>{formatNumber(q.sections)}</b></div>
            <div className="vf-line"><span>{t('rl.q.length')}</span><b>{t('hl.km', { n: formatNumber(Math.round(q.length_m / 100) / 10) })}</b></div>
            <div className="vf-line"><span>{t('rl.q.grade')}</span><b>{pct(q.max_grade_bps)}</b></div>
            <div className="vf-line"><span>{t('rl.q.materials')}</span><b>{matLine(ctx, q.materials) || '—'}</b></div>
            <div className="vf-line"><span>{t('rl.q.wage')}</span><b>{money(q.wage)}</b></div>
            <div className="vf-line"><span>{t('rl.q.minutes')}</span><b>{t('rl.q.min_v', { n: formatNumber(q.minutes) })}</b></div>
          </div>
          <Hint>{t('rl.quote_hint')}</Hint>
        </Popup>
      )}
      <SectionTitle>{t('rl.lines')}</SectionTitle>
      <Panel>
        {(v.lines ?? []).length === 0 && <Hint>{t('rl.lines_none')}</Hint>}
        <div className="mn-list">{(v.lines ?? []).map((l) => <Line key={l.id} l={l} v={v} ctx={ctx} />)}</div>
        {v.may_draw && <Draw v={v} ctx={ctx} />}
        {!v.may_draw && <Hint>{t('rl.not_draw')}</Hint>}
      </Panel>
      <SectionTitle>{t('rl.trains')}</SectionTitle>
      <Panel>
        {(v.trains ?? []).length === 0 && <Hint>{t('rl.trains_none')}</Hint>}
        <div className="mn-list">{(v.trains ?? []).map((tr) => <Train key={tr.id} tr={tr} v={v} ctx={ctx} />)}</div>
      </Panel>
      <SectionTitle>{t('rl.bookings')}</SectionTitle>
      <Panel>
        {(v.bookings ?? []).length === 0 && <Hint>{t('rl.bookings_none')}</Hint>}
        <div className="vf-list">{(v.bookings ?? []).map((b) => <div key={b.id} className="vf-line"><span>{t('hl.load', { n: formatNumber(b.qty), item: ctx.names.name(['component', 'item'], b.item.code, b.item.name), to: b.to.name })}</span><b>{word(`rl.bstatus.${b.status}`, b.status)} – {money(b.fee)}</b></div>)}</div>
        {(v.bookings ?? []).filter((b) => b.status === 'booked' || b.status === 'open').map((b) => <ActionButton key={b.id} tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.rail', { action: 'cancel', code: b.id })}>{t('rl.cancel_booking')}</ActionButton>)}
        {v.may_order && <Book v={v} ctx={ctx} />}
      </Panel>
    </Page>
  )
})
