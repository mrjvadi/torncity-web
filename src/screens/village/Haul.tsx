// «گاری و جاده» (ADR 0075): carts, the roads between towns (class, length, toll), goods on the road with their arrival time, the carts that could be built, the
// towns without a road yet, and sending goods (a confirm names what goes where first).

import { useState } from 'react'
import type { HaulView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { durationText } from './common'
import { hasKey, t, type Key } from '../../i18n'
import { matLine, pct, sendCmd, word } from './Mining'
import { GoodsPick } from './GoodsPick'

registerWrites(['settlement.haul'], (a) => !!a.args?.action)

function Send({ v, ctx }: { v: HaulView; ctx: FlowCtx }) {
  const open = (v.links ?? []).filter((l) => l.status === 'open')
  const [item, setItem] = useState('')
  const [qty, setQty] = useState('10')
  const [to, setTo] = useState(open[0]?.other.code ?? '')
  const [ask, setAsk] = useState(false)
  if (open.length === 0) return <Hint>{t('hl.send_none')}</Hint>
  const n = Number(qty.replace(/[^0-9]/g, '')) || 0
  const other = open.find((l) => l.other.code === to)?.other.name ?? ''
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('hl.send_title')}</b></div>
      <div className="tc-f"><span>{t('hl.item')}</span><GoodsPick value={item} onChange={setItem} suggest={[...(v.orders ?? []).map((o) => o.item), ...(v.loads ?? []).map((o) => o.item)]} ctx={ctx} /></div>
      <label className="tc-f"><span>{t('hl.qty')}</span><input className="fx-field-input" dir="ltr" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-label={t('hl.qty')} /></label>
      <div className="rc-chips" role="radiogroup" aria-label={t('hl.to')}>{open.map((l) => <button key={l.id} type="button" role="radio" aria-checked={l.other.code === to} className={`dk-chip${l.other.code === to ? ' all' : ''}`} onClick={() => setTo(l.other.code)}>{l.other.name}</button>)}</div>
      <ActionButton tone="gold" small disabled={ctx.busy || !item || n < 1 || !to} onClick={() => setAsk(true)}>{t('hl.send')}</ActionButton>
      {ask && (
        <Popup open onClose={() => setAsk(false)} tone="gold" title={t('hl.confirm_title')} footer={<div className="lm-craft-foot"><ActionButton tone="steel" small onClick={() => setAsk(false)}>{t('common.cancel')}</ActionButton><ActionButton tone="gold" onClick={() => { setAsk(false); sendCmd(ctx, 'settlement.haul', { action: 'send', code: item, n: String(n), m: to }) }}>{t('hl.send_go')}</ActionButton></div>}>
          <Lead>{t('hl.confirm', { n: formatNumber(n), item: ctx.names.name(['item', 'component'], item), to: other })}</Lead>
          <Hint>{t('hl.confirm_hint')}</Hint>
        </Popup>
      )}
    </div>
  )
}

export const Haul = flow<HaulView>(({ view: v, ctx }) => {
  if (!v.open) return <Page title={t('hl.title')} tone="gold"><Panel><Lead>{t('hl.off')}</Lead><Hint>{t('mn.off_hint')}</Hint></Panel></Page>
  return (
    <Page title={t('hl.title')} tone="gold">
      {v.notice && hasKey(`hl.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`hl.notice.${v.notice}`)}</Lead></Panel>}
      <SectionTitle>{t('hl.loads')}</SectionTitle>
      <Panel>
        {(v.loads ?? []).length === 0 && <Hint>{t('hl.loads_none')}</Hint>}
        <div className="vf-list">{(v.loads ?? []).map((l) => <div key={l.id} className="vf-line"><span>{t('hl.load', { n: formatNumber(l.qty), item: ctx.names.name(['component', 'item'], l.item.code, l.item.name), to: l.to.name })}</span><b>{l.left_seconds > 0 ? t('hl.arrives', { t: durationText(l.left_seconds) }) : atText(l.due_at)}</b></div>)}</div>
      </Panel>
      <SectionTitle>{t('hl.links')}</SectionTitle>
      <Panel>
        {(v.links ?? []).length === 0 && <Hint>{t('hl.links_none')}</Hint>}
        <div className="mn-list">{(v.links ?? []).map((l) => (
          <div key={l.id} className="mn-card">
            <div className="mn-head"><b>{t('hl.road_to', { who: l.other.name })}</b><EffectChip tone={l.status === 'open' ? 'good' : l.status === 'building' ? 'warn' : 'bad'}>{word(`hl.status.${l.status}`, l.status)}</EffectChip></div>
            <div className="mn-sub">{word(`hl.class.${l.class}`, l.class)} – {t('hl.km', { n: formatNumber(Math.round(l.length_m / 100) / 10) })} – {t('hl.condition', { p: pct(l.condition_bps) })}{l.toll > 0 ? ` – ${t('hl.toll', { m: money(l.toll) })}` : ''}{l.mine ? ` – ${t('hl.mine')}` : ''}</div>
          </div>
        ))}</div>
        {v.may_draw && (v.targets ?? []).length > 0 && (
          <>
            <Hint>{t('hl.new_road')}</Hint>
            <div className="mn-list">{(v.targets ?? []).map((x) => (
              <div key={x.code} className="mn-card"><div className="mn-head"><b>{x.name}</b></div>
                <div className="wk-btns">{['path', 'track'].map((c) => <ActionButton key={c} tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.haul', { action: 'link', code: x.code, n: c })}>{t('hl.link_go', { c: word(`hl.class.${c}`, c) })}</ActionButton>)}</div></div>
            ))}</div>
          </>
        )}
        {!v.may_draw && <Hint>{t('hl.not_draw')}</Hint>}
      </Panel>
      <SectionTitle>{t('hl.carts')}</SectionTitle>
      <Panel>
        {(v.carriers ?? []).length === 0 && <Hint>{t('hl.carts_none')}</Hint>}
        <div className="vf-list">{(v.carriers ?? []).map((c) => <div key={c.id} className="vf-line"><span>{c.mode.name} – {t('hl.cap', { n: formatNumber(c.capacity_kg) })}</span><b>{word(`hl.cstatus.${c.status}`, c.status)} {c.settlement.name ? `– ${c.settlement.name}` : ''}</b></div>)}</div>
        {v.may_order && (v.modes ?? []).length > 0 && <div className="mn-list">{(v.modes ?? []).map((m) => (
          <div key={m.mode.code} className="mn-card">
            <div className="mn-head"><b>{m.mode.name}</b><span>{t('hl.cap', { n: formatNumber(m.capacity_kg) })}</span></div>
            <div className="mn-sub">{t('hl.mode_cost', { list: matLine(ctx, m.cost) || '—', w: money(m.wage), h: formatNumber(m.hours) })}</div>
            {(m.missing ?? []).length > 0 && <Note tone="bad">{t('mn.missing', { list: (m.missing ?? []).map((x) => x.name).join('، ') })}</Note>}
            <ActionButton tone="gold" small disabled={ctx.busy || !m.can_order} onClick={() => sendCmd(ctx, 'settlement.haul', { action: 'carrier', code: m.mode.code })}>{t('hl.build_cart')}</ActionButton>
          </div>
        ))}</div>}
      </Panel>
      {v.may_order && <><SectionTitle>{t('hl.send_section')}</SectionTitle><Panel><Send v={v} ctx={ctx} /></Panel></>}
      {(v.orders ?? []).length > 0 && (
        <>
          <SectionTitle>{t('hl.orders')}</SectionTitle>
          <Panel><div className="vf-list">{(v.orders ?? []).map((o) => <div key={o.id} className="vf-line"><span>{t('hl.load', { n: formatNumber(o.qty), item: ctx.names.name(['component', 'item'], o.item.code, o.item.name), to: o.to.name })}</span><b>{word(`hl.ostatus.${o.status}`, o.status)}{o.fee > 0 ? ` – ${money(o.fee)}` : ''}</b></div>)}</div></Panel>
        </>
      )}
    </Page>
  )
})
void ({} as Key)
