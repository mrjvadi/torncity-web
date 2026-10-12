// «کارهای بزرگ» (ADR 0077 4): long public works of many stages (a wall, a canal, a library). The list of the town's works, each with its stages as a row
// of marks; the page of one work (the stage in hand with its materials against what is on the site, the fund, the pledges and the donor roll, the crew
// and the tender); the kinds that could be started and what each still waits for; and, for a company, the board of open tenders of great works.
// A finished work is kept (open today) or stands idle (رهاشده) when nobody keeps it; it is never destroyed. Facts from the server, words ours.

import { useState } from 'react'
import type { ProjectBoardLine, ProjectContractLine, ProjectKindLine, ProjectLine, ProjectView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { PBar } from '../../ui/v6/panel'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, NumField, pct, word } from './Polity'
import { t } from '../../i18n'

registerWrites(['settlement.project'], (a) => !!a.args?.action && a.args.action !== 'open')

const act = (ctx: FlowCtx, action: string, args: Record<string, string>) => sendCmd(ctx, 'settlement.project', { action, ...args })
const kindName = (k: { code: string; name: string }) => word(`pj.kind.${k.code}`, k.name)
const itemName = (ctx: FlowCtx, code: string) => ctx.names.name(['component', 'item'], code, '')
const passed = (iso: string | null) => !!iso && Date.parse(iso) <= Date.now()

/** What a town still lacks for a kind or a stage: researched things named in our words. */
export const lacks = (ctx: FlowCtx, list: string[] | null | undefined) => (list ?? []).map((c) => ctx.names.name(['knowledge', 'building'], c, '')).filter(Boolean).join('، ')

/** The stages as a row of marks: done, the one in hand, the ones to come. */
export function Marks({ stage, stages, finished }: { stage: number; stages: number; finished: boolean }) {
  const label = finished ? t('pj.marks_done', { n: formatNumber(stages) }) : t('pj.marks', { a: formatNumber(stage), b: formatNumber(stages) })
  return (
    <div className="pj-marks" role="img" aria-label={label}>
      {Array.from({ length: stages }, (_, i) => {
        const n = i + 1
        const cls = finished || n < stage ? 'done' : n === stage ? 'now' : ''
        return <i key={n} className={`pj-mark ${cls}`}><span>{formatNumber(n)}</span></i>
      })}
    </div>
  )
}

function Need({ ctx, item, have, need }: { ctx: FlowCtx; item: string; have: number; need: number }) {
  const full = have >= need
  return (
    <div className="pj-need">
      <div className="mn-head"><span>{itemName(ctx, item)}</span><b className={full ? 'good' : ''}>{t('pj.have_need', { a: formatNumber(have), b: formatNumber(need) })}</b></div>
      <PBar frac={need > 0 ? have / need : 1} tone={full ? undefined : 'low'} />
    </div>
  )
}

// -- forms (centred popups) ---------------------------------------------------------------------

function Pledge({ v, p, ctx, onClose }: { v: ProjectView; p: ProjectLine; ctx: FlowCtx; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [anon, setAnon] = useState<'no' | 'yes'>('no')
  const n = Number(amount) || 0
  const ok = n >= v.pledge_min
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pj.pledge_title', { name: kindName(p.kind) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('pj.pledge_low', { m: money(v.pledge_min) })} onClick={() => { onClose(); act(ctx, 'pledge', { id: p.id, amount: String(n), ...(anon === 'yes' ? { anonymous: '1' } : {}) }) }}>{t('pj.pledge_go')}</ActionButton>}>
      <Lead>{kindName(p.kind)}</Lead>
      <NumField label={`${t('pj.amount')} (${t('unit.money')})`} value={amount} onChange={setAmount} hint={t('pj.pledge_hint', { m: money(v.pledge_min) })} />
      <Choice label={t('pj.anon_label')} value={anon} onChange={setAnon} options={[{ key: 'no', text: t('pj.anon_no') }, { key: 'yes', text: t('pj.anon_yes') }]} />
      <Hint>{p.stage > 1 ? t('pj.pledge_spent') : t('pj.pledge_refund')}</Hint>
    </Popup>
  )
}

function Money({ p, ctx, onClose }: { p: ProjectLine; ctx: FlowCtx; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const ok = Number(amount) > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pj.alloc_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} onClick={() => { onClose(); act(ctx, 'allocate', { id: p.id, amount }) }}>{t('pj.alloc_go')}</ActionButton>}>
      <NumField label={`${t('pj.amount')} (${t('unit.money')})`} value={amount} onChange={setAmount} />
      <Hint>{t('pj.alloc_hint')}</Hint>
    </Popup>
  )
}

/** Goods to the site: from the town's store (a holder of project.fund) or from what you carry. */
function Goods({ p, ctx, from, onClose }: { p: ProjectLine; ctx: FlowCtx; from: 'store' | 'bag'; onClose: () => void }) {
  const lacking = (p.materials ?? []).filter((m) => m.have < m.need)
  const list = lacking.length > 0 ? lacking : (p.materials ?? [])
  const [item, setItem] = useState(list[0]?.item ?? '')
  const m = list.find((x) => x.item === item)
  const [n, setN] = useState(m ? String(Math.max(1, m.need - m.have)) : '')
  const ok = !!item && Number(n) > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t(from === 'store' ? 'pj.deliver_title' : 'pj.give_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} onClick={() => { onClose(); act(ctx, from === 'store' ? 'deliver' : 'give', { id: p.id, code: item, n }) }}>{t(from === 'store' ? 'pj.deliver_go' : 'pj.give_go')}</ActionButton>}>
      {list.length === 0 && <Hint>{t('pj.no_materials')}</Hint>}
      <Choice label={t('pj.item')} value={item} onChange={(k) => { setItem(k); const x = list.find((y) => y.item === k); if (x) setN(String(Math.max(1, x.need - x.have))) }} options={list.map((x) => ({ key: x.item, text: itemName(ctx, x.item) }))} />
      <NumField label={t('pj.count')} value={n} onChange={setN} hint={m ? t('pj.lacks_n', { n: formatNumber(Math.max(0, m.need - m.have)) }) : undefined} />
      <Hint>{t(from === 'store' ? 'pj.deliver_hint' : 'pj.give_hint')}</Hint>
    </Popup>
  )
}

function Hire({ p, ctx, onClose }: { p: ProjectLine; ctx: FlowCtx; onClose: () => void }) {
  const left = Math.max(0, p.hire_per_day - p.hired_today)
  const [n, setN] = useState('')
  const ok = Number(n) > 0 && Number(n) <= left
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pj.hire_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={n && !ok ? t('pj.hire_left', { n: formatNumber(left) }) : undefined} onClick={() => { onClose(); act(ctx, 'hire', { id: p.id, n }) }}>{t('pj.hire_go')}</ActionButton>}>
      <NumField label={t('pj.hours')} value={n} onChange={setN} hint={t('pj.hire_hint', { n: formatNumber(left) })} />
    </Popup>
  )
}

function Tender({ p, ctx, onClose }: { p: ProjectLine; ctx: FlowCtx; onClose: () => void }) {
  const [cap, setCap] = useState('')
  const [due, setDue] = useState('14')
  const [window, setWindow] = useState('48')
  const [rule, setRule] = useState<'lowest_price' | 'scored'>('lowest_price')
  const ok = Number(cap) > 0 && Number(due) > 0 && Number(window) > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pj.tender_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('pj.tender_need')} onClick={() => { onClose(); act(ctx, 'tender', { id: p.id, cap, due, window, rule }) }}>{t('pj.tender_go')}</ActionButton>}>
      <NumField label={t('pd.cap')} value={cap} onChange={setCap} hint={t('pd.cap_hint')} />
      <NumField label={t('pd.due')} value={due} onChange={setDue} hint={t('pd.due_hint')} />
      <NumField label={t('pd.window')} value={window} onChange={setWindow} hint={t('pd.window_hint')} />
      <Choice label={t('pd.rule')} value={rule} onChange={setRule} options={[{ key: 'lowest_price', text: t('pd.rule.lowest_price') }, { key: 'scored', text: t('pd.rule.scored') }]} />
      <Hint>{t('pj.tender_hint')}</Hint>
    </Popup>
  )
}

function BidForm({ v, b, ctx, onClose }: { v: ProjectView; b: ProjectBoardLine; ctx: FlowCtx; onClose: () => void }) {
  const c = b.contract
  const mine = new Set((c.bids ?? []).filter((x) => x.mine).map((x) => x.company.code))
  const free = (v.companies ?? []).filter((x) => !mine.has(x.company.code))
  const [co, setCo] = useState((free.find((x) => !x.debarred_until || passed(x.debarred_until)) ?? free[0])?.company.code ?? '')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState(String(c.due_days))
  const sel = (v.companies ?? []).find((x) => x.company.code === co)
  const barred = !!sel?.debarred_until && !passed(sel.debarred_until)
  const p = Number(price) || 0
  const over = p > c.budget_cap
  const ok = !!co && !barred && p > 0 && !over && Number(days) > 0
  const reason = barred ? t('pd.barred_reason', { at: atText(sel?.debarred_until) }) : over ? t('pd.over_cap', { m: money(c.budget_cap) }) : undefined
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pj.bid_title', { name: kindName(b.project) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : reason} onClick={() => { onClose(); act(ctx, 'bid', { id: c.id, company: co, price, days }) }}>{t('pd.bid_go')}</ActionButton>}>
      <Lead>{kindName(b.project)}</Lead>
      <Choice label={t('pd.company')} value={co} onChange={setCo} options={free.map((x) => ({ key: x.company.code, text: x.company.name }))} />
      {free.length === 0 && <Hint>{t('pd.no_company')}</Hint>}
      {barred && <Note tone="bad">{t('pd.barred', { at: atText(sel?.debarred_until) })}</Note>}
      <NumField label={t('pd.price')} value={price} onChange={setPrice} hint={t('pd.price_hint', { m: money(c.budget_cap) })} />
      <NumField label={t('pd.days')} value={days} onChange={setDays} hint={t('pd.days_hint', { n: formatNumber(c.due_days) })} />
      <Hint>{t('pd.bond_note', { b: money(Math.round((p * c.bond_bps) / 10000)), p: pct(c.bond_bps) })}</Hint>
    </Popup>
  )
}

// -- the tender of a work, seen from the town or from a company ---------------------------------

function Contract({ c, ctx, name, board, onBid }: { c: ProjectContractLine; ctx: FlowCtx; name: string; board?: boolean; onBid?: () => void }) {
  const [ask, setAsk] = useState<'award' | 'defect' | null>(null)
  const closed = passed(c.closes_at)
  const bids = [...(c.bids ?? [])].sort((a, b) => a.price - b.price)
  const mineStanding = bids.some((b) => b.mine && b.status === 'standing')
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{name}</b><EffectChip tone={c.status === 'awarded' || c.status === 'done' ? 'good' : c.status === 'open' ? 'warn' : c.status === 'failed' ? 'bad' : 'neutral'}>{word(`pd.status.${c.status}`)}</EffectChip></div>
      <div className="mn-sub">{t('pd.rule_line', { r: word(`pd.rule.${c.rule}`), m: money(c.budget_cap) })}</div>
      <div className="mn-sub">{t('pd.terms_line', { b: pct(c.bond_bps), r: pct(c.retention_bps), d: formatNumber(c.defects_days), n: formatNumber(c.due_days) })}</div>
      {c.status === 'open' && c.closes_at && <div className="mn-sub">{closed ? t('pd.closed_at', { at: atText(c.closes_at) }) : t('pd.closes', { at: atText(c.closes_at) })}</div>}
      {bids.length > 0 && (
        <div className="mn-list">
          {bids.map((b) => (
            <div key={b.id} className="pd-bid">
              <div className="mn-head"><b>{b.company.name}{b.mine ? ` (${t('pd.me')})` : ''}</b><EffectChip tone={b.status === 'won' ? 'good' : b.status === 'standing' ? 'warn' : 'neutral'}>{word(`pd.bid.${b.status}`)}</EffectChip></div>
              <div className="mn-sub">{t('pd.bid_line', { m: money(b.price), d: formatNumber(b.days) })} – {t('pd.record', { n: formatNumber(b.record) })}</div>
              {b.mine && b.status === 'standing' && c.status === 'open' && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'withdraw', { id: c.id })}>{t('pd.bid_withdraw')}</ActionButton></div>}
            </div>
          ))}
        </div>
      )}
      {c.status === 'open' && bids.length === 0 && <Hint>{t('pd.no_bids')}</Hint>}
      {(c.status === 'awarded' || c.status === 'done') && c.company && (
        <div className="vf-list">
          <div className="vf-line"><span>{t('pd.winner')}</span><b>{c.company.name}</b></div>
          <div className="vf-line"><span>{t('pd.price')}</span><b>{money(c.price)}</b></div>
          {c.due_at && <div className="vf-line"><span>{t('pd.due_at')}</span><b>{atText(c.due_at)}</b></div>}
          <div className="vf-line"><span>{t('pj.stages_paid')}</span><b>{formatNumber(c.stages_paid)}</b></div>
          {c.retention_held > 0 && <div className="vf-line"><span>{t('pj.retention')}</span><b>{money(c.retention_held)}</b></div>}
        </div>
      )}
      <div className="wk-btns">
        {board && c.may_bid && !mineStanding && <ActionButton tone="gold" small disabled={ctx.busy} onClick={onBid}>{t('pd.bid')}</ActionButton>}
        {c.may_award && c.status === 'open' && <ActionButton tone="gold" small disabled={ctx.busy || !closed || bids.length === 0} reason={!closed ? t('pd.not_closed') : bids.length === 0 ? t('pd.no_bids') : undefined} onClick={() => setAsk('award')}>{t('pd.award')}</ActionButton>}
        {c.may_defect && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('defect')}>{t('pj.defect')}</ActionButton>}
      </div>
      {ask === 'award' && <Ask title={t('pd.award_title')} body={t('pd.award_body', { n: formatNumber(bids.length) })} hint={t('pd.award_hint')} yes={t('pd.award_yes')} onYes={() => act(ctx, 'award', { id: c.id })} onClose={() => setAsk(null)} />}
      {ask === 'defect' && <Ask title={t('pj.defect_title')} body={t('pj.defect_body')} hint={t('pj.defect_hint')} yes={t('pj.defect_yes')} onYes={() => act(ctx, 'defect', { id: c.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

// -- one work -----------------------------------------------------------------------------------

type Form = 'pledge' | 'alloc' | 'deliver' | 'give' | 'hire' | 'tender' | 'cancel' | null

function WorkPage({ v, p, ctx, onBack }: { v: ProjectView; p: ProjectLine; ctx: FlowCtx; onBack: () => void }) {
  const [form, setForm] = useState<Form>(null)
  const [unpledge, setUnpledge] = useState<string | null>(null)
  const finished = p.status === 'finished'
  const active = p.status === 'active'
  const mats = p.materials ?? []
  const hoursFrac = p.need_hour > 0 ? p.hours / p.need_hour : 1
  const donors = p.donors ?? []
  const shifts = p.shifts ?? []
  const waitKey = p.waiting ? `pj.wait.${p.waiting}` : 'pj.wait.ready'
  const mineShift = p.my_shift && p.my_shift.status === 'running' ? p.my_shift : null
  return (
    <Page title={kindName(p.kind)} tone="gold">
      <NoticeStrip prefix="pj.notice" code={v.notice} />
      <div className="wk-btns"><ActionButton tone="steel" small onClick={onBack}>{t('pj.back_list')}</ActionButton></div>
      <Panel>
        <Lead>{word(`pj.effect.${p.effect}`)}</Lead>
        <Marks stage={p.stage} stages={p.stages} finished={finished} />
        {active && <Hint>{t('pj.stage_of', { a: formatNumber(p.stage), b: formatNumber(p.stages) })}</Hint>}
        {p.status === 'cancelled' && <Note tone="bad">{t('pj.cancelled')}</Note>}
      </Panel>

      {finished && (
        <>
          <SectionTitle>{t('pj.state')}</SectionTitle>
          <Panel>
            <div className="mn-head"><b>{p.held ? t('pj.kept') : t('pj.abandoned')}</b><EffectChip tone={p.held ? 'good' : 'warn'}>{p.held ? t('pj.open_today') : t('pj.idle')}</EffectChip></div>
            {p.held ? <Hint>{t('pj.kept_hint')}</Hint> : <Note tone="bad">{word(`pj.idle.${p.idle}`) || t('pj.idle.other')}</Note>}
            {!p.held && <Hint>{t('pj.idle_never')}</Hint>}
            {p.effect === 'research' && (
              <>
                <Hint>{t('pj.library_post')}</Hint>
                <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={() => ctx.run('settlement.research')}>{t('pj.library_go')}</ActionButton></div>
              </>
            )}
          </Panel>
        </>
      )}

      {active && (
        <>
          <SectionTitle>{t('pj.now')}</SectionTitle>
          <Panel>
            <div className="mn-head"><b>{t('pj.waiting')}</b><EffectChip tone={p.waiting ? 'warn' : 'good'}>{t(waitKey as 'pj.wait.ready')}</EffectChip></div>
            {p.waiting === 'time' && p.min_until && <Hint>{t('pj.until', { at: atText(p.min_until) })}</Hint>}
            {p.waiting === 'delay' && p.delay && <Hint>{t('pj.delay_until', { at: atText(p.delay) })}</Hint>}
            {p.waiting === 'research' && <Hint>{t('pj.research_hint')}</Hint>}
            <div className="pj-need">
              <div className="mn-head"><span>{t('pj.crew_hours')}</span><b className={hoursFrac >= 1 ? 'good' : ''}>{t('pj.have_need', { a: formatNumber(p.hours), b: formatNumber(p.need_hour) })}</b></div>
              <PBar frac={hoursFrac} tone={hoursFrac >= 1 ? undefined : 'low'} />
            </div>
            {mats.length === 0 ? <Hint>{t('pj.no_materials')}</Hint> : mats.map((m) => <Need key={m.item} ctx={ctx} item={m.item} have={m.have} need={m.need} />)}
            <div className="wk-btns">
              <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('give')}>{t('pj.give_btn')}</ActionButton>
              {p.may_fund && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('deliver')}>{t('pj.deliver_btn')}</ActionButton>}
            </div>
            <Hint>{t('pj.give_note')}</Hint>
          </Panel>

          <SectionTitle>{t('pj.crew')}</SectionTitle>
          <Panel>
            {p.contract && p.contract.status === 'awarded' ? <Hint>{t('pj.crew_contractor')}</Hint> : (
              <>
                {shifts.length === 0 && <Hint>{t('pj.crew_none')}</Hint>}
                <div className="vf-list">
                  {shifts.map((s) => (
                    <div key={s.id} className="vf-line"><span>{s.mine ? t('pj.me') : s.player.name}</span><b>{s.status === 'running' ? t('pj.shift_run', { at: atText(s.ends_at) }) : t('pj.shift_done', { n: formatNumber(s.hours) })}</b></div>
                  ))}
                </div>
                <div className="wk-btns">
                  {p.may_work && <ActionButton tone="green" small disabled={ctx.busy || !!mineShift} reason={mineShift ? t('pj.shift_mine', { at: atText(mineShift.ends_at) }) : undefined} onClick={() => act(ctx, 'work', { id: p.id })}>{t('pj.work', { m: formatNumber(v.shift_minutes), h: formatNumber(p.shift_hours) })}</ActionButton>}
                  {p.may_hire && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('hire')}>{t('pj.hire_btn')}</ActionButton>}
                </div>
                {p.may_hire && <Hint>{t('pj.hire_note', { n: formatNumber(p.hired_today), m: formatNumber(p.hire_per_day) })}</Hint>}
              </>
            )}
          </Panel>
        </>
      )}

      {(active || donors.length > 0 || p.fund > 0) && (
        <>
          <SectionTitle>{t('pj.fund')}</SectionTitle>
          <Panel>
            {active && <div className="vf-line"><span>{t('pj.fund_now')}</span><b>{money(p.fund)}</b></div>}
            {active && (
              <div className="wk-btns">
                {p.may_pledge && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('pledge')}>{t('pj.pledge_btn')}</ActionButton>}
                {p.may_fund && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('alloc')}>{t('pj.alloc_btn')}</ActionButton>}
              </div>
            )}
            <SectionTitle>{t('pj.donors')}</SectionTitle>
            {donors.length === 0 && <Hint>{t('pj.donors_none')}</Hint>}
            <div className="mn-list">
              {donors.map((d) => (
                <div key={d.id} className="pd-bid">
                  <div className="mn-head"><b>{d.anonymous || !d.name ? t('pj.anonymous') : d.name}{d.mine ? ` (${t('pj.me')})` : ''}</b><b>{money(d.amount)}</b></div>
                  <div className="mn-sub">{d.at ? atText(d.at) : ''}{d.status === 'refunded' ? ` – ${t('pj.refunded')}` : ''}</div>
                  {d.mine && d.refunds && d.status !== 'refunded' && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setUnpledge(d.id)}>{t('pj.unpledge')}</ActionButton></div>}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {active && (p.contract || p.may_tender) && (
        <>
          <SectionTitle>{t('pj.contract')}</SectionTitle>
          <Panel>
            {p.contract ? <Contract c={p.contract} ctx={ctx} name={kindName(p.kind)} /> : <Hint>{t('pj.contract_none')}</Hint>}
            {!p.contract && p.may_tender && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('tender')}>{t('pj.tender_btn')}</ActionButton></div>}
          </Panel>
        </>
      )}

      {(p.done ?? []).length > 0 && (
        <>
          <SectionTitle>{t('pj.done')}</SectionTitle>
          <Panel>
            <div className="vf-list">{(p.done ?? []).map((s) => <div key={s.stage} className="vf-line"><span>{t('pj.stage_n', { n: formatNumber(s.stage) })}</span><b>{s.at ? atText(s.at) : ''}</b></div>)}</div>
          </Panel>
        </>
      )}

      {active && p.may_cancel && <div className="wk-btns"><ActionButton tone="red" small disabled={ctx.busy} onClick={() => setForm('cancel')}>{t('pj.cancel_btn')}</ActionButton></div>}

      {form === 'pledge' && <Pledge v={v} p={p} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'alloc' && <Money p={p} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'deliver' && <Goods p={p} ctx={ctx} from="store" onClose={() => setForm(null)} />}
      {form === 'give' && <Goods p={p} ctx={ctx} from="bag" onClose={() => setForm(null)} />}
      {form === 'hire' && <Hire p={p} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'tender' && <Tender p={p} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'cancel' && <Ask tone="red" title={t('pj.cancel_title')} body={t('pj.cancel_body', { name: kindName(p.kind) })} hint={t('pj.cancel_hint')} yes={t('pj.cancel_yes')} onYes={() => act(ctx, 'cancel', { id: p.id })} onClose={() => setForm(null)} />}
      {unpledge && <Ask title={t('pj.unpledge_title')} body={t('pj.unpledge_body')} yes={t('pj.unpledge')} onYes={() => act(ctx, 'unpledge', { id: unpledge })} onClose={() => setUnpledge(null)} />}
    </Page>
  )
}

// -- the list -----------------------------------------------------------------------------------

function WorkCard({ p, onOpen }: { p: ProjectLine; onOpen: () => void }) {
  const finished = p.status === 'finished'
  const chip = finished ? (p.held ? <EffectChip tone="good">{t('pj.kept')}</EffectChip> : <EffectChip tone="warn">{t('pj.abandoned')}</EffectChip>)
    : p.status === 'cancelled' ? <EffectChip tone="neutral">{t('pj.cancelled_chip')}</EffectChip>
    : <EffectChip tone={p.waiting ? 'warn' : 'good'}>{t((p.waiting ? `pj.wait.${p.waiting}` : 'pj.wait.ready') as 'pj.wait.ready')}</EffectChip>
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{kindName(p.kind)}</b>{chip}</div>
      <Marks stage={p.stage} stages={p.stages} finished={finished} />
      <div className="mn-sub">{p.status === 'active' ? `${t('pj.stage_of', { a: formatNumber(p.stage), b: formatNumber(p.stages) })} – ${t('pj.fund_short', { m: money(p.fund) })}` : finished && !p.held ? word(`pj.idle.${p.idle}`) || t('pj.idle.other') : ''}</div>
      <div className="wk-btns"><ActionButton tone="gold" small onClick={onOpen}>{t('pj.see')}</ActionButton></div>
    </div>
  )
}

function KindCard({ k, v, ctx, onStart }: { k: ProjectKindLine; v: ProjectView; ctx: FlowCtx; onStart: () => void }) {
  const miss = lacks(ctx, k.missing)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{kindName(k)}</b><EffectChip tone={k.available ? 'good' : 'neutral'}>{t('pj.kind_stages', { n: formatNumber(k.stages) })}</EffectChip></div>
      <div className="mn-sub">{word(`pj.effect.${k.effect}`)}</div>
      {!k.available && <Note>{t('pj.kind_missing', { list: miss || t('pj.kind_missing_any') })}</Note>}
      {!k.available && <Hint>{t('pj.kind_missing_hint')}</Hint>}
      {k.available && v.may_start && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={onStart}>{t('pj.start')}</ActionButton></div>}
    </div>
  )
}

export const Project = flow<ProjectView>(({ view: v, ctx }) => {
  const [sel, setSel] = useState('')
  const [starting, setStarting] = useState<ProjectKindLine | null>(null)
  const [bid, setBid] = useState<ProjectBoardLine | null>(null)
  if (!v.open) return <Page title={t('pj.title')} tone="gold"><Closed text={t('pj.off')} hint={t('sp.off_hint')} /></Page>
  const list = v.projects ?? []
  const open = list.find((p) => p.id === sel)
  if (open) return <WorkPage v={v} p={open} ctx={ctx} onBack={() => setSel('')} />
  const live = list.filter((p) => p.status === 'active')
  const done = list.filter((p) => p.status !== 'active')
  const board = v.board ?? []
  return (
    <Page title={t('pj.title')} tone="gold">
      <NoticeStrip prefix="pj.notice" code={v.notice} />
      <Panel><Hint>{t('pj.intro')}</Hint></Panel>
      <SectionTitle>{t('pj.live')}</SectionTitle>
      <Panel>
        {live.length === 0 && <Lead>{t('pj.live_none')}</Lead>}
        <div className="mn-list">{live.map((p) => <WorkCard key={p.id} p={p} onOpen={() => setSel(p.id)} />)}</div>
      </Panel>
      {done.length > 0 && (
        <>
          <SectionTitle>{t('pj.finished')}</SectionTitle>
          <Panel>
            <Hint>{t('pj.finished_hint')}</Hint>
            <div className="mn-list">{done.map((p) => <WorkCard key={p.id} p={p} onOpen={() => setSel(p.id)} />)}</div>
          </Panel>
        </>
      )}
      <SectionTitle>{t('pj.kinds')}</SectionTitle>
      <Panel>
        {!v.may_start && <Hint>{t('pj.not_allowed')}</Hint>}
        {(v.kinds ?? []).length === 0 && <Hint>{t('pj.kinds_none')}</Hint>}
        <div className="mn-list">{(v.kinds ?? []).map((k) => <KindCard key={k.code} k={k} v={v} ctx={ctx} onStart={() => setStarting(k)} />)}</div>
      </Panel>
      {(board.length > 0 || (v.companies ?? []).length > 0) && (
        <>
          <SectionTitle>{t('pj.board')}</SectionTitle>
          <Panel>
            <Hint>{t('pj.board_hint')}</Hint>
            {board.length === 0 && <Lead>{t('pj.board_none')}</Lead>}
            <div className="mn-list">
              {board.map((b) => <Contract key={b.contract.id} c={b.contract} ctx={ctx} board name={t('pj.board_line', { name: kindName(b.project), town: b.settlement.name })} onBid={() => setBid(b)} />)}
            </div>
          </Panel>
        </>
      )}
      {starting && (
        <Ask title={t('pj.start_title', { name: kindName(starting) })} body={t('pj.start_body', { name: kindName(starting), n: formatNumber(starting.stages) })} hint={t('pj.start_hint', { fee: money(v.fee) })} yes={t('pj.start_yes')}
          onYes={() => act(ctx, 'start', { code: starting.code })} onClose={() => setStarting(null)} />
      )}
      {bid && <BidForm v={v} b={bid} ctx={ctx} onClose={() => setBid(null)} />}
    </Page>
  )
})
