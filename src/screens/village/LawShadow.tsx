// What stays out of sight in the law screen (ADR 0078 3.9 to 3.12), in calm game wording: money offered to an office-holder (the holder answers; only the two
// see it), the hidden board «بازار زیرزمینی» (drawn only for someone it knows: fences, escrow brokers, the scam risk, the dirty balance «پول سیاه»), cleaning
// dirty money through a front company, and a gang with its heat. Without standing the board is not mentioned: one quiet card lets the player ask around.
// Everything here is mechanics, risks and consequences; nothing says how to do any of it.

import { useState } from 'react'
import type { LawBribeLine, LawEscrowLine, LawFrontLine, LawListingLine } from '../../api/views.gen'
import { Hint, Lead, Panel, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { Ask, Choice, NumField, word } from './Polity'
import { Meter, NotYet, PlayerForm, act, rungWord, type LawV } from './lawShared'
import { t } from '../../i18n'

const bpsOf = (percent: string) => String(Math.round(Number(percent || 0) * 100))

// -- bribes ------------------------------------------------------------------------------------------

function BribeOffer({ v, ctx, onClose }: { v: LawV; ctx: FlowCtx; onClose: () => void }) {
  const [player, setPlayer] = useState('')
  const [rung, setRung] = useState('warrant')
  const [amount, setAmount] = useState('')
  const [pct, setPct] = useState('')
  const [dirty, setDirty] = useState('no')
  const ok = player.trim().length > 0 && Number(amount) > 0
  return (
    <Popup open onClose={onClose} tone="red" title={t('lw.bribe_title')}
      footer={<ActionButton tone="red" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lw.bribe_need')} onClick={() => { onClose(); act(ctx, 'bribe', { player: player.trim(), kind: rung, amount, ...(pct ? { bps: bpsOf(pct) } : {}), ...(dirty === 'yes' ? { dirty: '1' } : {}) }) }}>{t('lw.bribe_go')}</ActionButton>}>
      <Note>{t('lw.bribe_calm')}</Note>
      <label className="tc-f"><span>{t('lw.bribe_holder')}</span>
        <input className="fx-field-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value)} aria-label={t('lw.bribe_holder')} />
        <small className="pu-hint">{t('lw.player_hint')}</small>
      </label>
      <Choice label={t('lw.bribe_rung')} value={rung} onChange={setRung} options={['warrant', 'detection', 'verdict'].map((k) => ({ key: k, text: rungWord(k) }))} />
      <Hint>{word(`lw.rung_hint.${rung}`)}</Hint>
      <NumField label={t('lw.bribe_amount')} value={amount} onChange={setAmount} />
      <NumField label={t('lw.bribe_pct')} value={pct} onChange={setPct} suffix="٪" hint={t('lw.bribe_pct_hint')} />
      {v.board.dirty > 0 && <Choice label={t('lw.pay_from')} value={dirty} onChange={setDirty} options={[{ key: 'no', text: t('lw.pay_clean') }, { key: 'yes', text: t('lw.pay_dirty', { n: money(v.board.dirty) }) }]} />}
      <Hint>{t('lw.bribe_risk')}</Hint>
    </Popup>
  )
}

function Bribe({ b, ctx }: { b: LawBribeLine; ctx: FlowCtx }) {
  const tone = b.status === 'accepted' ? 'warn' : b.status === 'found' ? 'bad' : b.status === 'offered' ? 'info' : 'neutral'
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{b.mine ? t('lw.bribe_mine') : t('lw.bribe_to_me')}</b><EffectChip tone={tone}>{word(`lw.bstatus.${b.status}`) || t('lw.other')}</EffectChip></div>
      <div className="vf-list">
        <div className="vf-line"><span>{t('lw.bribe_rung')}</span><b>{rungWord(b.rung)}</b></div>
        <div className="vf-line"><span>{t('lw.bribe_amount')}</span><b>{money(b.amount)}</b></div>
        {b.dirty && <div className="vf-line"><span>{t('lw.pay_from')}</span><b>{t('lw.dirty_money')}</b></div>}
        <div className="vf-line"><span>{t('lw.bribe_effect')}</span><b>{formatNumber(Math.round(b.effect_bps / 100))}٪</b></div>
        {b.term_end && <div className="vf-line"><span>{t('lw.bribe_term')}</span><b>{atText(b.term_end)}</b></div>}
      </div>
      {b.may_answer && (
        <>
          <Hint>{t('lw.bribe_answer_hint')}</Hint>
          <div className="wk-btns">
            <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'bribe_refuse', { id: b.id })}>{t('lw.bribe_refuse')}</ActionButton>
            <ActionButton tone="red" small disabled={ctx.busy} onClick={() => act(ctx, 'bribe_accept', { id: b.id })}>{t('lw.bribe_accept')}</ActionButton>
          </div>
        </>
      )}
    </div>
  )
}

// -- the board ---------------------------------------------------------------------------------------

function Buy({ l, v, ctx, onClose }: { l: LawListingLine; v: LawV; ctx: FlowCtx; onClose: () => void }) {
  const brokers = v.brokers ?? []
  const [qty, setQty] = useState('1')
  const [broker, setBroker] = useState(brokers[0]?.code ?? '')
  const [dirty, setDirty] = useState('no')
  const needBroker = !l.fence
  const ok = Number(qty) > 0 && Number(qty) <= l.qty && (!needBroker || broker.trim().length > 0)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.buy_title', { item: l.item.name })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lw.buy_need')} onClick={() => { onClose(); act(ctx, 'buy', { id: l.id, qty, ...(needBroker ? { code: broker.trim() } : {}), ...(dirty === 'yes' ? { dirty: '1' } : {}) }) }}>{t('lw.buy_go', { price: money(l.price * Math.max(1, Number(qty) || 1)) })}</ActionButton>}>
      <NumField label={t('lw.qty')} value={qty} onChange={setQty} hint={t('lw.buy_left', { n: formatNumber(l.qty) })} />
      {needBroker && (brokers.length > 0
        ? <Choice label={t('lw.broker')} value={broker} onChange={setBroker} options={brokers.map((b) => ({ key: b.code, text: b.name }))} />
        : <label className="tc-f"><span>{t('lw.broker')}</span><input className="fx-field-input" dir="ltr" value={broker} onChange={(e) => setBroker(e.target.value)} aria-label={t('lw.broker')} /><small className="pu-hint">{t('lw.broker_hint')}</small></label>)}
      {v.board.dirty > 0 && <Choice label={t('lw.pay_from')} value={dirty} onChange={setDirty} options={[{ key: 'no', text: t('lw.pay_clean') }, { key: 'yes', text: t('lw.pay_dirty', { n: money(v.board.dirty) }) }]} />}
      <Hint>{l.fence ? t('lw.fence_hint') : t('lw.escrow_hint')}</Hint>
      <Hint>{t('lw.scam_risk')}</Hint>
    </Popup>
  )
}

function ListForm({ v, ctx, onClose }: { v: LawV; ctx: FlowCtx; onClose: () => void }) {
  const goods = v.goods ?? []
  const [code, setCode] = useState(goods[0]?.item.code ?? '')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const have = goods.find((g) => g.item.code === code)?.have ?? 0
  const ok = !!code && Number(qty) > 0 && Number(qty) <= have && Number(price) > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.list_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={goods.length === 0 ? t('lw.decl_no_goods') : ok ? undefined : t('lw.list_need')} onClick={() => { onClose(); act(ctx, 'list', { code, qty, amount: price }) }}>{t('lw.list_go')}</ActionButton>}>
      {goods.length > 0 ? <Choice label={t('lw.good')} value={code} onChange={setCode} options={goods.map((g) => ({ key: g.item.code, text: g.item.name }))} /> : <Hint>{t('lw.decl_no_goods')}</Hint>}
      <NumField label={t('lw.qty')} value={qty} onChange={setQty} hint={have > 0 ? t('lw.decl_have', { n: formatNumber(have) }) : undefined} />
      <NumField label={t('lw.price_each')} value={price} onChange={setPrice} />
      <Hint>{t('lw.list_hint')}</Hint>
    </Popup>
  )
}

function Listing({ l, v, ctx }: { l: LawListingLine; v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState(false)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{l.item.name}</b><EffectChip tone={l.fence ? 'info' : l.mine ? 'neutral' : 'warn'}>{l.fence ? t('lw.fence') : l.mine ? t('lw.listing_mine') : t('lw.listing_other')}</EffectChip></div>
      <div className="vf-list">
        <div className="vf-line"><span>{t('lw.qty')}</span><b>{formatNumber(l.qty)}</b></div>
        <div className="vf-line"><span>{t('lw.price_each')}</span><b>{money(l.price)}</b></div>
        {l.min_standing > 0 && <div className="vf-line"><span>{t('lw.min_standing')}</span><b>{formatNumber(l.min_standing)}</b></div>}
      </div>
      <div className="wk-btns">
        {l.mine
          ? <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'delist', { id: l.id })}>{t('lw.delist')}</ActionButton>
          : <ActionButton tone="gold" small disabled={ctx.busy || v.board.standing < l.min_standing} reason={v.board.standing < l.min_standing ? t('lw.standing_low') : undefined} onClick={() => setForm(true)}>{t('lw.buy')}</ActionButton>}
      </div>
      {form && <Buy l={l} v={v} ctx={ctx} onClose={() => setForm(false)} />}
    </div>
  )
}

function Escrow({ e, ctx }: { e: LawEscrowLine; ctx: FlowCtx }) {
  const [ask, setAsk] = useState<'scam' | 'refund' | null>(null)
  const held = e.status === 'held'
  const late = !!e.due_at && new Date(e.due_at).getTime() <= Date.now()
  const role = e.broker ? t('lw.role_broker') : e.buyer ? t('lw.role_buyer') : t('lw.role_seller')
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lw.escrow_line', { qty: formatNumber(e.qty), item: e.item.name })}</b><EffectChip tone={held ? 'warn' : e.status === 'scammed' ? 'bad' : 'neutral'}>{word(`lw.estatus.${e.status}`) || t('lw.other')}</EffectChip></div>
      <div className="mn-sub">{role}</div>
      <div className="vf-list">
        <div className="vf-line"><span>{t('lw.escrow_pot')}</span><b>{money(e.amount)}</b></div>
        {e.fee > 0 && <div className="vf-line"><span>{t('lw.escrow_fee')}</span><b>{money(e.fee)}</b></div>}
        {held && e.due_at && <div className="vf-line"><span>{t('lw.escrow_due')}</span><b>{atText(e.due_at)}</b></div>}
      </div>
      {held && e.buyer && <Hint>{t('lw.escrow_buyer_hint')}</Hint>}
      {held && (
        <div className="wk-btns">
          {e.buyer && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'confirm', { id: e.id })}>{t('lw.confirm')}</ActionButton>}
          {(!e.buyer || late) && <ActionButton tone="steel" small disabled={ctx.busy || (e.buyer && !late)} onClick={() => setAsk('refund')}>{t('lw.refund')}</ActionButton>}
          {e.broker && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setAsk('scam')}>{t('lw.scam')}</ActionButton>}
        </div>
      )}
      {ask === 'refund' && <Ask title={t('lw.refund_title')} body={t('lw.refund_body')} yes={t('lw.refund')} onYes={() => act(ctx, 'refund', { id: e.id })} onClose={() => setAsk(null)} />}
      {ask === 'scam' && <Ask title={t('lw.scam_title')} body={t('lw.scam_body')} hint={t('lw.scam_hint')} yes={t('lw.scam')} tone="red" onYes={() => act(ctx, 'scam', { id: e.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

function Board({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const b = v.board
  const [form, setForm] = useState<'list' | 'introduce' | 'broker' | null>(null)
  const listings = b.listings ?? []
  const escrows = b.escrows ?? []
  return (
    <>
      <SectionTitle>{t('lw.board')}</SectionTitle>
      <Panel>
        <Hint>{t('lw.board_intro')}</Hint>
        <div className="vf-list">
          <div className="vf-line"><span>{t('lw.standing')}</span><b>{formatNumber(b.standing)}</b></div>
          <div className="vf-line"><span>{t('lw.dirty_money')}</span><b>{money(b.dirty)}</b></div>
          {b.broker && <div className="vf-line"><span>{t('lw.broker_rep')}</span><b>{formatNumber(b.rep)}</b></div>}
          {b.broker && <div className="vf-line"><span>{t('lw.broker_cap')}</span><b>{money(b.broker_cap)}</b></div>}
        </div>
        <Hint>{t('lw.dirty_hint')}</Hint>
        <div className="wk-btns">
          <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('list')}>{t('lw.list')}</ActionButton>
          <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('introduce')}>{t('lw.introduce')}</ActionButton>
          {!b.broker && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('broker')}>{t('lw.broker_be')}</ActionButton>}
        </div>
      </Panel>
      <SectionTitle>{t('lw.listings')}</SectionTitle>
      <Panel>
        {listings.length === 0 && <Lead>{t('lw.listings_none')}</Lead>}
        <div className="mn-list">{listings.map((l) => <Listing key={l.id} l={l} v={v} ctx={ctx} />)}</div>
      </Panel>
      {escrows.length > 0 && (
        <>
          <SectionTitle>{t('lw.escrows')}</SectionTitle>
          <Panel><div className="mn-list">{escrows.map((e) => <Escrow key={e.id} e={e} ctx={ctx} />)}</div></Panel>
        </>
      )}
      {form === 'list' && <ListForm v={v} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'introduce' && <PlayerForm title={t('lw.introduce_title')} hint={t('lw.introduce_hint')} go={t('lw.introduce_go')} ctx={ctx} onClose={() => setForm(null)} onGo={(player) => act(ctx, 'introduce', { player })} />}
      {form === 'broker' && <Ask title={t('lw.broker_title')} body={t('lw.broker_body')} hint={t('lw.broker_risk')} yes={t('lw.broker_be')} onYes={() => act(ctx, 'broker')} onClose={() => setForm(null)} />}
    </>
  )
}

/** Without standing: one quiet card, nothing said of what there is. */
function AskAround({ ctx }: { ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <SectionTitle>{t('lw.ask_title')}</SectionTitle>
      <Panel>
        <Hint>{t('lw.ask_hint')}</Hint>
        <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setOpen(true)}>{t('lw.ask_go')}</ActionButton></div>
      </Panel>
      {open && <PlayerForm title={t('lw.ask_form')} hint={t('lw.ask_form_hint')} go={t('lw.ask_go')} ctx={ctx} onClose={() => setOpen(false)} onGo={(player) => act(ctx, 'ask', { player })} />}
    </>
  )
}

// -- laundering --------------------------------------------------------------------------------------

function Front({ f, v, ctx }: { f: LawFrontLine; v: LawV; ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const dirty = v.board.dirty
  const ok = Number(amount) > 0 && Number(amount) <= dirty
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{f.company.name}</b><EffectChip tone="warn">{t('lw.front')}</EffectChip></div>
      {(f.batches ?? []).length === 0 && <div className="mn-sub">{t('lw.batches_none')}</div>}
      {(f.batches ?? []).map((b) => (
        <div key={b.id} className="vf-line"><span>{word(`lw.batch.${b.state}`) || t('lw.other')}{b.stage_due && b.state !== 'integrated' && b.state !== 'frozen' ? ` – ${t('lw.batch_next', { at: atText(b.stage_due) })}` : ''}</span><b>{money(b.amount)}</b></div>
      ))}
      <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy || dirty <= 0} reason={dirty <= 0 ? t('lw.launder_none') : undefined} onClick={() => setOpen(true)}>{t('lw.launder')}</ActionButton></div>
      {open && (
        <Popup open onClose={() => setOpen(false)} tone="gold" title={t('lw.launder_title', { name: f.company.name })}
          footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lw.launder_over', { n: money(dirty) })} onClick={() => { setOpen(false); act(ctx, 'launder', { code: f.company.code, amount }) }}>{t('lw.launder_go')}</ActionButton>}>
          <div className="vf-line"><span>{t('lw.dirty_money')}</span><b>{money(dirty)}</b></div>
          <NumField label={t('lw.launder_amount')} value={amount} onChange={setAmount} />
          <Hint>{t('lw.launder_hint')}</Hint>
          <Hint>{t('lw.launder_risk')}</Hint>
        </Popup>
      )}
    </div>
  )
}

function Fronts({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  const companies = (v.companies ?? []).filter((c) => !(v.fronts ?? []).some((f) => f.company.code === c.code))
  const [code, setCode] = useState('')
  return (
    <>
      <SectionTitle>{t('lw.fronts')}</SectionTitle>
      <Panel>
        {!v.open.launder ? <NotYet text={t('lw.part_off')} /> : (
          <>
            <Hint>{t('lw.fronts_hint')}</Hint>
            {(v.fronts ?? []).length === 0 && <Lead>{t('lw.fronts_none')}</Lead>}
            <div className="mn-list">{(v.fronts ?? []).map((f) => <Front key={f.company.code} f={f} v={v} ctx={ctx} />)}</div>
            <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy || companies.length === 0} reason={companies.length === 0 ? t('lw.front_no_company') : undefined} onClick={() => { setCode(companies[0]?.code ?? ''); setOpen(true) }}>{t('lw.front_add')}</ActionButton></div>
          </>
        )}
      </Panel>
      {open && (
        <Popup open onClose={() => setOpen(false)} tone="gold" title={t('lw.front_title')}
          footer={<ActionButton tone="gold" disabled={ctx.busy || !code} onClick={() => { setOpen(false); act(ctx, 'front', { code }) }}>{t('lw.front_go')}</ActionButton>}>
          <Choice label={t('lw.company')} value={code} onChange={setCode} options={companies.map((c) => ({ key: c.code, text: c.name }))} />
          <Hint>{t('lw.front_hint')}</Hint>
        </Popup>
      )}
    </>
  )
}

// -- a gang ------------------------------------------------------------------------------------------

function Gang({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [ask, setAsk] = useState<'mark' | 'declare' | null>(null)
  const g = v.gang
  if (!g) return null
  return (
    <>
      <SectionTitle>{t('lw.gang')}</SectionTitle>
      <Panel>
        <div className="mn-head"><b>{t('lw.gang_state')}</b><EffectChip tone={g.declared ? 'warn' : g.marked ? 'info' : 'neutral'}>{g.declared ? t('lw.gang_open') : g.marked ? t('lw.gang_hidden') : t('lw.gang_none')}</EffectChip></div>
        {g.marked && (
          <>
            <div className="vf-line"><span>{t('lw.heat')}</span><b>{t('lw.heat_n', { a: formatNumber(g.heat), b: formatNumber(g.max) })}</b></div>
            <Meter value={g.heat} max={Math.max(1, g.max)} bad={g.heat >= g.max * 0.7} />
            <Hint>{t('lw.heat_hint')}</Hint>
          </>
        )}
        {!g.leader && <Hint>{t('lw.gang_not_leader')}</Hint>}
        {g.leader && (
          <div className="wk-btns">
            {!g.marked && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('mark')}>{t('lw.gang_mark')}</ActionButton>}
            {g.marked && !g.declared && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setAsk('declare')}>{t('lw.gang_declare')}</ActionButton>}
          </div>
        )}
      </Panel>
      {ask === 'mark' && <Ask title={t('lw.gang_mark_title')} body={t('lw.gang_mark_body')} hint={t('lw.gang_mark_hint')} yes={t('lw.gang_mark')} onYes={() => act(ctx, 'gang_mark')} onClose={() => setAsk(null)} />}
      {ask === 'declare' && <Ask title={t('lw.gang_declare_title')} body={t('lw.gang_declare_body')} hint={t('lw.gang_declare_hint')} yes={t('lw.gang_declare')} tone="red" onYes={() => act(ctx, 'gang_declare')} onClose={() => setAsk(null)} />}
    </>
  )
}

// -- the tab -----------------------------------------------------------------------------------------

export function Shadow({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState(false)
  const bribes = v.bribes ?? []
  return (
    <>
      <SectionTitle>{t('lw.bribes')}</SectionTitle>
      <Panel>
        <Hint>{t('lw.bribes_hint')}</Hint>
        {bribes.length === 0 && <Lead>{t('lw.bribes_none')}</Lead>}
        <div className="mn-list">{bribes.map((b) => <Bribe key={b.id} b={b} ctx={ctx} />)}</div>
        {(v.open.police || v.open.courts) && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm(true)}>{t('lw.bribe_new')}</ActionButton></div>}
      </Panel>
      {v.board.known ? <Board v={v} ctx={ctx} /> : (
        <>
          {v.board.dirty > 0 && <Panel><div className="vf-line"><span>{t('lw.dirty_money')}</span><b>{money(v.board.dirty)}</b></div><Hint>{t('lw.dirty_hint')}</Hint></Panel>}
          {v.open.black && <AskAround ctx={ctx} />}
        </>
      )}
      {(v.board.known || (v.fronts ?? []).length > 0 || v.board.dirty > 0) && <Fronts v={v} ctx={ctx} />}
      <Gang v={v} ctx={ctx} />
      {form && <BribeOffer v={v} ctx={ctx} onClose={() => setForm(false)} />}
    </>
  )
}
