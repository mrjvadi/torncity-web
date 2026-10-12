// «مناقصه‌ها» (ADR 0076 10): the town opens a tender for a public building in the making, companies of the trade bid with a bond, the town awards it, the
// work is paid in three stages with a retention held through the defects period, and a contractor that walks away loses the bond and is kept out for a while.

import { useState } from 'react'
import type { TenderBidLine, TenderLine, TenderSiteLine, TenderView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, NumField, pct, word } from './Polity'
import { t } from '../../i18n'

registerWrites(['settlement.tender'], (a) => !!a.args?.action)

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = { open: 'warn', awarded: 'good', done: 'good', failed: 'bad', cancelled: 'neutral' }
const passed = (iso: string | null) => !!iso && Date.parse(iso) <= Date.now()

function Post({ v, site, ctx, onClose }: { v: TenderView; site: TenderSiteLine; ctx: FlowCtx; onClose: () => void }) {
  const [cap, setCap] = useState('')
  const [due, setDue] = useState('14')
  const [window, setWindow] = useState('48')
  const [rule, setRule] = useState<'lowest_price' | 'scored'>('lowest_price')
  const ok = Number(cap) > 0 && Number(due) > 0 && Number(window) > 0
  const name = ctx.bname(site.building.code, site.building.name)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pd.post_title', { b: name })}
      footer={<ActionButton tone="gold" cost={money(v.fee)} costIcon="coin" disabled={ctx.busy || !ok} reason={ok ? undefined : t('pd.post_need')} onClick={() => { onClose(); sendCmd(ctx, 'settlement.tender', { action: 'post', building: site.id, cap, due, window, rule }) }}>{t('pd.post_go')}</ActionButton>}>
      <NumField label={t('pd.cap')} value={cap} onChange={setCap} hint={t('pd.cap_hint')} />
      <NumField label={t('pd.due')} value={due} onChange={setDue} hint={t('pd.due_hint')} />
      <NumField label={t('pd.window')} value={window} onChange={setWindow} hint={t('pd.window_hint')} />
      <Choice label={t('pd.rule')} value={rule} onChange={setRule} options={[{ key: 'lowest_price', text: t('pd.rule.lowest_price') }, { key: 'scored', text: t('pd.rule.scored') }]} />
      <Hint>{t('pd.post_terms', { fee: money(v.fee), bond: pct(v.bond_bps), ret: pct(v.retention_bps) })}</Hint>
    </Popup>
  )
}

function Bid({ v, l, ctx, onClose }: { v: TenderView; l: TenderLine; ctx: FlowCtx; onClose: () => void }) {
  const mine = new Set((l.bids ?? []).filter((b) => b.mine).map((b) => b.company.code))
  const free = (v.companies ?? []).filter((c) => !mine.has(c.company.code))
  const [co, setCo] = useState((free.find((c) => !c.debarred_until || passed(c.debarred_until)) ?? free[0])?.company.code ?? '')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState(String(l.due_days))
  const c = (v.companies ?? []).find((x) => x.company.code === co)
  const barred = !!c?.debarred_until && !passed(c.debarred_until)
  const p = Number(price) || 0
  const over = p > l.budget_cap
  const ok = !!co && !barred && p > 0 && !over && Number(days) > 0
  const reason = barred ? t('pd.barred_reason', { at: atText(c?.debarred_until) }) : over ? t('pd.over_cap', { m: money(l.budget_cap) }) : undefined
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pd.bid_title', { b: ctx.bname(l.building.code, l.building.name) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : reason} onClick={() => { onClose(); sendCmd(ctx, 'settlement.tender', { action: 'bid', id: l.id, company: co, price, days }) }}>{t('pd.bid_go')}</ActionButton>}>
      <Choice label={t('pd.company')} value={co} onChange={setCo} options={free.map((x) => ({ key: x.company.code, text: x.company.name }))} />
      {free.length === 0 && <Hint>{t('pd.no_company')}</Hint>}
      {barred && <Note tone="bad">{t('pd.barred', { at: atText(c?.debarred_until) })}</Note>}
      <NumField label={t('pd.price')} value={price} onChange={setPrice} hint={t('pd.price_hint', { m: money(l.budget_cap) })} />
      <NumField label={t('pd.days')} value={days} onChange={setDays} hint={t('pd.days_hint', { n: formatNumber(l.due_days) })} />
      <Hint>{t('pd.bond_note', { b: money(Math.round((p * l.bond_bps) / 10000)), p: pct(l.bond_bps) })}</Hint>
    </Popup>
  )
}

function BidRow({ b, l, ctx }: { b: TenderBidLine; l: TenderLine; ctx: FlowCtx }) {
  return (
    <div className="pd-bid">
      <div className="mn-head"><b>{b.company.name}{b.mine ? ` (${t('pd.me')})` : ''}</b><EffectChip tone={b.status === 'won' ? 'good' : b.status === 'standing' ? 'warn' : 'neutral'}>{word(`pd.bid.${b.status}`)}</EffectChip></div>
      <div className="mn-sub">{t('pd.bid_line', { m: money(b.price), d: formatNumber(b.days) })} – {t('pd.record', { n: formatNumber(b.record) })}</div>
      {b.mine && b.status === 'standing' && l.status === 'open' && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.tender', { action: 'withdraw', id: l.id, company: b.company.code })}>{t('pd.bid_withdraw')}</ActionButton></div>}
    </div>
  )
}

function Card({ l, v, ctx, board }: { l: TenderLine; v: TenderView; ctx: FlowCtx; board?: boolean }) {
  const [ask, setAsk] = useState<'cancel' | 'award' | null>(null)
  const [bid, setBid] = useState(false)
  const closed = passed(l.closes_at)
  const bids = [...(l.bids ?? [])].sort((a, b) => a.price - b.price)
  const done = l.work_required > 0 ? Math.round((l.work_done / l.work_required) * 100) : 0
  const stages = l.stages ?? []
  const mineBid = bids.some((b) => b.mine && b.status === 'standing')
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{ctx.bname(l.building.code, l.building.name)}</b><EffectChip tone={STATUS_TONE[l.status] ?? 'neutral'}>{word(`pd.status.${l.status}`)}</EffectChip></div>
      <div className="mn-sub">{board ? t('pd.by', { who: l.payer.name }) : t('pd.rule_line', { r: word(`pd.rule.${l.rule}`), m: money(l.budget_cap) })}{board ? ` – ${t('pd.cap_short', { m: money(l.budget_cap) })}` : ''}</div>
      <div className="mn-sub">{t('pd.terms_line', { b: pct(l.bond_bps), r: pct(l.retention_bps), d: formatNumber(l.defects_days), n: formatNumber(l.due_days) })}</div>
      {l.status === 'open' && l.closes_at && <div className="mn-sub">{closed ? t('pd.closed_at', { at: atText(l.closes_at) }) : t('pd.closes', { at: atText(l.closes_at) })}</div>}
      {bids.length > 0 && <div className="mn-list">{bids.map((b) => <BidRow key={b.id} b={b} l={l} ctx={ctx} />)}</div>}
      {l.status === 'open' && bids.length === 0 && <Hint>{t('pd.no_bids')}</Hint>}
      {(l.status === 'awarded' || l.status === 'done') && l.company && (
        <>
          <div className="vf-list">
            <div className="vf-line"><span>{t('pd.winner')}</span><b>{l.company.name}</b></div>
            <div className="vf-line"><span>{t('pd.price')}</span><b>{money(l.price)}</b></div>
            {l.due_at && <div className="vf-line"><span>{t('pd.due_at')}</span><b>{atText(l.due_at)}</b></div>}
            <div className="vf-line"><span>{t('pd.work')}</span><b>{pct(done * 100)}</b></div>
          </div>
          <div className="mn-bar"><i style={{ width: `${Math.min(100, done)}%` }} /></div>
          <div className="mn-sub">{t('pd.stages_head')}</div>
          <div className="vf-list">{stages.map((s) => <div key={s.stage} className="vf-line"><span>{t('pd.stage', { n: formatNumber(s.stage) })}</span><b>{s.at ? t('pd.stage_paid', { m: money(s.paid), at: atText(s.at) }) : t('pd.stage_wait')}</b></div>)}</div>
          {l.retention_held > 0 && <Note>{t('pd.retention', { m: money(l.retention_held), d: formatNumber(l.defects_days) })}</Note>}
        </>
      )}
      {l.status === 'failed' && <Note tone="bad">{t('pd.failed')}</Note>}
      {l.status === 'cancelled' && <Hint>{t('pd.cancelled')}</Hint>}
      <div className="wk-btns">
        {board && l.may_bid && !mineBid && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setBid(true)}>{t('pd.bid')}</ActionButton>}
        {l.may_award && l.status === 'open' && <ActionButton tone="gold" small disabled={ctx.busy || !closed || bids.length === 0} reason={!closed ? t('pd.not_closed') : bids.length === 0 ? t('pd.no_bids') : undefined} onClick={() => setAsk('award')}>{t('pd.award')}</ActionButton>}
        {l.may_award && l.status === 'awarded' && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.tender', { action: 'settle', id: l.id })}>{t('pd.settle')}</ActionButton>}
        {v.may_accept && l.status === 'awarded' && !board && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.tender', { action: 'accept', id: l.id })}>{t('pd.accept')}</ActionButton>}
        {l.may_cancel && l.status === 'open' && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('cancel')}>{t('pd.cancel')}</ActionButton>}
      </div>
      {bid && <Bid v={v} l={l} ctx={ctx} onClose={() => setBid(false)} />}
      {ask === 'cancel' && <Ask title={t('pd.cancel_title')} body={t('pd.cancel_body')} hint={t('pd.cancel_hint')} yes={t('pd.cancel_yes')} onYes={() => sendCmd(ctx, 'settlement.tender', { action: 'cancel', id: l.id })} onClose={() => setAsk(null)} />}
      {ask === 'award' && <Ask title={t('pd.award_title')} body={t('pd.award_body', { n: formatNumber(bids.length) })} hint={t('pd.award_hint')} yes={t('pd.award_yes')} onYes={() => sendCmd(ctx, 'settlement.tender', { action: 'award', id: l.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

export const Tender = flow<TenderView>(({ view: v, ctx }) => {
  const [site, setSite] = useState<TenderSiteLine | null>(null)
  const sites = v.sites ?? []
  const mine = v.tenders ?? []
  const board = v.board ?? []
  const barred = (v.companies ?? []).filter((c) => c.debarred_until && !passed(c.debarred_until))
  if (!v.open) return <Page title={t('pd.title')} tone="gold"><Closed text={t('pd.off')} hint={t('pu.off_hint')} /></Page>
  return (
    <Page title={t('pd.title')} tone="gold">
      <NoticeStrip prefix="pd.notice" code={v.notice} />
      <Panel><Hint>{t('pd.intro')}</Hint></Panel>
      <SectionTitle>{t('pd.mine')}</SectionTitle>
      <Panel>
        {mine.length === 0 && <Lead>{t('pd.mine_none')}</Lead>}
        <div className="mn-list">{mine.map((l) => <Card key={l.id} l={l} v={v} ctx={ctx} />)}</div>
      </Panel>
      <SectionTitle>{t('pd.sites')}</SectionTitle>
      <Panel>
        {sites.length === 0 && <Hint>{t('pd.sites_none')}</Hint>}
        <div className="mn-list">{sites.map((s, i) => (
          <div key={s.id || String(i)} className="mn-card">
            <div className="mn-head"><b>{ctx.bname(s.building.code, s.building.name)}</b><span>{t('pd.site_work', { a: formatNumber(s.work_done), b: formatNumber(s.work_required) })}</span></div>
            {v.may_tender && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setSite(s)}>{t('pd.post')}</ActionButton>}
          </div>
        ))}</div>
        {!v.may_tender && <Hint>{t('pd.not_tender')}</Hint>}
      </Panel>
      <SectionTitle>{t('pd.board')}</SectionTitle>
      <Panel>
        <Hint>{t('pd.board_hint')}</Hint>
        {(v.companies ?? []).length === 0 && <Note>{t('pd.no_company')}</Note>}
        {board.length === 0 && (v.companies ?? []).length > 0 && <Lead>{t('pd.board_none')}</Lead>}
        <div className="mn-list">{board.map((l) => <Card key={l.id} l={l} v={v} ctx={ctx} board />)}</div>
      </Panel>
      {(v.companies ?? []).length > 0 && (
        <>
          <SectionTitle>{t('pd.companies')}</SectionTitle>
          <Panel>
            <div className="vf-list">{(v.companies ?? []).map((c) => <div key={c.company.code} className="vf-line"><span>{c.company.name}</span><b className={barred.includes(c) ? 'bad' : ''}>{barred.includes(c) ? t('pd.barred_short', { at: atText(c.debarred_until) }) : t('pd.record', { n: formatNumber(c.record) })}</b></div>)}</div>
            <Hint>{t('pd.rules_hint', { bond: pct(v.bond_bps), ret: pct(v.retention_bps) })}</Hint>
          </Panel>
        </>
      )}
      {site && <Post v={v} site={site} ctx={ctx} onClose={() => setSite(null)} />}
    </Page>
  )
})
