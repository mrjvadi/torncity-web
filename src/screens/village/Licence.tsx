// «مجوزها» (ADR 0077 7), under «بازارچه»: the public register of rights the town gives (a stall, a craft, a contractor's rank), the kinds the charter asks for
// and when, how a licence is had (a first grant in the grace, a fixed fee, a sealed-bid auction), renewing, selling it on the exchange board, and for an
// official the rule, the decisions and a revocation. A kind with no reader yet says so and cannot be required. Facts from the server, words ours.

import { useState } from 'react'
import type { LicenceApplicationLine, LicenceAuctionLine, LicenceKindLine, LicenceLine, LicenceListingLine, LicenceView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, NumField, pct, word } from './Polity'
import { lacks } from './Project'
import { t } from '../../i18n'

registerWrites(['settlement.licence'], (a) => !!a.args?.action)

const act = (ctx: FlowCtx, action: string, args: Record<string, string>) => sendCmd(ctx, 'settlement.licence', { action, ...args })
const kindText = (code: string, fallback = '') => word(`lc.kind.${code}`, fallback) || t('lc.kind.other')
const passed = (iso: string | null | undefined) => !!iso && Date.parse(iso) <= Date.now()
const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = { active: 'good', notice: 'warn', revoked: 'bad', expired: 'neutral', transferred: 'neutral' }

/** «برای خودم» or one of my companies. */
function Holder({ v, value, onChange }: { v: LicenceView; value: string; onChange: (k: string) => void }) {
  const cs = v.companies ?? []
  if (cs.length === 0) return null
  return <Choice label={t('lc.for')} value={value} onChange={onChange} options={[{ key: '', text: t('lc.for_me') }, ...cs.map((c) => ({ key: c.code, text: c.name }))]} />
}

// -- forms ---------------------------------------------------------------------------------------

function SetKind({ k, ctx, onClose }: { k: LicenceKindLine; ctx: FlowCtx; onClose: () => void }) {
  const [mode, setMode] = useState<'fixed' | 'auction'>(k.mode === 'auction' ? 'auction' : 'fixed')
  const [fee, setFee] = useState(k.fee > 0 ? String(k.fee) : '')
  const [reserve, setReserve] = useState(k.reserve > 0 ? String(k.reserve) : '')
  const [term, setTerm] = useState(k.term_days > 0 ? String(k.term_days) : '30')
  const [tr, setTr] = useState<'yes' | 'no'>(k.transferable ? 'yes' : 'no')
  const ok = Number(term) > 0 && (mode === 'fixed' ? Number(fee) > 0 : Number(reserve) > 0)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lc.rule_title', { name: kindText(k.code, k.name) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lc.rule_need')} onClick={() => { onClose(); act(ctx, 'set_kind', { code: k.code, mode, fee: mode === 'fixed' ? fee : '0', reserve: mode === 'auction' ? reserve : '0', term, transferable: tr === 'yes' ? '1' : '0' }) }}>{t('lc.rule_go')}</ActionButton>}>
      <Lead>{kindText(k.code, k.name)}</Lead>
      <Choice label={t('lc.mode')} value={mode} onChange={setMode} options={[{ key: 'fixed', text: t('lc.mode.fixed') }, { key: 'auction', text: t('lc.mode.auction') }]} />
      {mode === 'fixed' ? <NumField label={`${t('lc.fee')} (${t('unit.money')})`} value={fee} onChange={setFee} hint={t('lc.fee_hint')} /> : <NumField label={`${t('lc.reserve')} (${t('unit.money')})`} value={reserve} onChange={setReserve} hint={t('lc.reserve_hint')} />}
      <NumField label={t('lc.term')} value={term} onChange={setTerm} hint={t('lc.term_hint')} />
      <Choice label={t('lc.transfer')} value={tr} onChange={setTr} options={[{ key: 'yes', text: t('lc.transfer_yes') }, { key: 'no', text: t('lc.transfer_no') }]} />
      <Hint>{t('lc.rule_grace')}</Hint>
    </Popup>
  )
}

/** A first grant (in the grace) or an application (a fixed fee after it). */
function Get({ v, k, how, ctx, onClose }: { v: LicenceView; k: LicenceKindLine; how: 'claim' | 'apply'; ctx: FlowCtx; onClose: () => void }) {
  const [target, setTarget] = useState('')
  const [co, setCo] = useState('')
  const needTarget = !!k.target
  const price = k.mode === 'auction' ? k.reserve : k.fee
  const ok = !needTarget || target.trim().length > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t(how === 'claim' ? 'lc.claim_title' : 'lc.apply_title', { name: kindText(k.code, k.name) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lc.target_need')} onClick={() => { onClose(); act(ctx, how, { code: k.code, ...(needTarget ? { target: target.trim() } : {}), ...(co ? { company: co } : {}) }) }}>{t(how === 'claim' ? 'lc.claim_go' : 'lc.apply_go')}</ActionButton>}>
      <Lead>{kindText(k.code, k.name)}</Lead>
      <Holder v={v} value={co} onChange={setCo} />
      {needTarget && (
        <label className="tc-f"><span>{t(`lc.target.${k.target}` as 'lc.target.craft')}</span>
          <input className="fx-field-input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('lc.target_label')} />
        </label>
      )}
      <Lead>{t(how === 'claim' ? 'lc.claim_price' : 'lc.apply_price', { m: money(price) })}</Lead>
      <Hint>{t(how === 'claim' ? 'lc.claim_hint' : 'lc.apply_hint')}</Hint>
    </Popup>
  )
}

function Bid({ v, a, ctx, onClose }: { v: LicenceView; a: LicenceAuctionLine; ctx: FlowCtx; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [co, setCo] = useState('')
  const n = Number(amount) || 0
  const ok = n >= a.reserve && n > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lc.bid_title', { name: kindText(a.kind) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lc.bid_low', { m: money(a.reserve) })} onClick={() => { onClose(); act(ctx, 'bid', { id: a.id, amount: String(n), ...(co ? { company: co } : {}) }) }}>{t('lc.bid_go')}</ActionButton>}>
      <Lead>{kindText(a.kind)}{a.target ? ` – ${a.target}` : ''}</Lead>
      <Holder v={v} value={co} onChange={setCo} />
      <NumField label={`${t('lc.amount')} (${t('unit.money')})`} value={amount} onChange={setAmount} hint={t('lc.bid_hint', { m: money(a.reserve) })} />
      <Hint>{t('lc.bid_sealed')}</Hint>
    </Popup>
  )
}

function OpenAuction({ v, ctx, onClose }: { v: LicenceView; ctx: FlowCtx; onClose: () => void }) {
  const kinds = (v.kinds ?? []).filter((k) => !k.deferred && k.available)
  const [code, setCode] = useState(kinds[0]?.code ?? '')
  const k = kinds.find((x) => x.code === code)
  const [target, setTarget] = useState('')
  const [reserve, setReserve] = useState('')
  const [window, setWindow] = useState('48')
  const ok = !!code && Number(reserve) > 0 && Number(window) > 0 && (!k?.target || target.trim().length > 0)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lc.auction_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('lc.auction_need')} onClick={() => { onClose(); act(ctx, 'auction', { code, reserve, window, ...(k?.target ? { target: target.trim() } : {}) }) }}>{t('lc.auction_go')}</ActionButton>}>
      <Choice label={t('lc.kind_label')} value={code} onChange={setCode} options={kinds.map((x) => ({ key: x.code, text: kindText(x.code, x.name) }))} />
      {k?.target && (
        <label className="tc-f"><span>{t(`lc.target.${k.target}` as 'lc.target.craft')}</span>
          <input className="fx-field-input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('lc.target_label')} />
        </label>
      )}
      <NumField label={`${t('lc.reserve')} (${t('unit.money')})`} value={reserve} onChange={setReserve} hint={t('lc.reserve_hint')} />
      <NumField label={t('lc.window')} value={window} onChange={setWindow} hint={t('lc.window_hint')} />
    </Popup>
  )
}

function ListIt({ v, l, ctx, onClose }: { v: LicenceView; l: LicenceLine; ctx: FlowCtx; onClose: () => void }) {
  const [price, setPrice] = useState('')
  const ok = Number(price) > 0
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lc.list_title', { name: kindText(l.kind) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} onClick={() => { onClose(); act(ctx, 'list', { id: l.id, price }) }}>{t('lc.list_go')}</ActionButton>}>
      <Lead>{kindText(l.kind)}{l.target ? ` – ${l.target}` : ''}</Lead>
      <NumField label={`${t('lc.price')} (${t('unit.money')})`} value={price} onChange={setPrice} />
      <Hint>{t('lc.list_hint', { fee: money(v.listing_fee), p: pct(v.transfer_fee_bps) })}</Hint>
    </Popup>
  )
}

function Buy({ v, b, ctx, onClose }: { v: LicenceView; b: LicenceListingLine; ctx: FlowCtx; onClose: () => void }) {
  const [co, setCo] = useState('')
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lc.buy_title', { name: kindText(b.licence.kind) })}
      footer={<ActionButton tone="gold" disabled={ctx.busy} onClick={() => { onClose(); act(ctx, 'buy', { id: b.id, ...(co ? { company: co } : {}) }) }}>{t('lc.buy_go', { m: money(b.price) })}</ActionButton>}>
      <Lead>{kindText(b.licence.kind)}</Lead>
      <Holder v={v} value={co} onChange={setCo} />
      <Lead>{t('lc.buy_body', { m: money(b.price) })}</Lead>
      <Hint>{t('lc.buy_fee', { f: money(b.fee) })}</Hint>
    </Popup>
  )
}

function Revoke({ l, ctx, onClose }: { l: LicenceLine; ctx: FlowCtx; onClose: () => void }) {
  const [cause, setCause] = useState<'non_use' | 'none'>('non_use')
  return (
    <Popup open onClose={onClose} tone="red" title={t(l.proposed ? 'lc.revoke_confirm_title' : 'lc.revoke_title', { name: kindText(l.kind) })}
      footer={<div className="lm-craft-foot"><ActionButton tone="steel" small onClick={onClose}>{t('common.cancel')}</ActionButton><ActionButton tone="red" disabled={ctx.busy} onClick={() => { onClose(); act(ctx, 'revoke', { id: l.id, ...(cause === 'non_use' ? { cause: 'non_use' } : {}) }) }}>{t(l.proposed ? 'lc.revoke_confirm' : 'lc.revoke')}</ActionButton></div>}>
      <Lead>{t('lc.revoke_body', { who: l.holder.name })}</Lead>
      {!l.proposed && <Choice label={t('lc.cause')} value={cause} onChange={setCause} options={[{ key: 'non_use', text: t('lc.cause.non_use') }, { key: 'none', text: t('lc.cause.none') }]} />}
      <Hint>{cause === 'non_use' || l.proposed ? t('lc.cause.non_use_hint') : t('lc.cause.none_hint')}</Hint>
    </Popup>
  )
}

// -- cards ---------------------------------------------------------------------------------------

function Kind({ k, v, ctx, onForm }: { k: LicenceKindLine; v: LicenceView; ctx: FlowCtx; onForm: (f: { k: LicenceKindLine; f: 'rule' | 'claim' | 'apply' }) => void }) {
  const [ask, setAsk] = useState(false)
  const miss = lacks(ctx, k.missing)
  const grace = k.required && k.in_grace
  const after = k.required && !k.in_grace
  const own = (v.mine ?? []).some((l) => l.kind === k.code && (l.status === 'active' || l.status === 'notice'))
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{kindText(k.code, k.name)}</b>
        {k.deferred ? <EffectChip tone="neutral">{t('lc.deferred')}</EffectChip> : k.required ? <EffectChip tone={grace ? 'warn' : 'good'}>{grace ? t('lc.in_grace') : t('lc.required')}</EffectChip> : <EffectChip tone="neutral">{t('lc.not_required')}</EffectChip>}
      </div>
      <div className="mn-sub">{word(`lc.duty.${k.code}`)}</div>
      {k.deferred ? <Note>{t('lc.deferred_hint')}</Note> : (
        <>
          {k.gate && <div className="mn-sub">{t('lc.gate', { what: word(`lc.gate.${k.gate}`) })}</div>}
          {k.required && (
            <div className="vf-list">
              <div className="vf-line"><span>{t('lc.mode')}</span><b>{word(`lc.mode.${k.mode}`)}</b></div>
              <div className="vf-line"><span>{k.mode === 'auction' ? t('lc.reserve') : t('lc.fee')}</span><b>{money(k.mode === 'auction' ? k.reserve : k.fee)}</b></div>
              <div className="vf-line"><span>{t('lc.term')}</span><b>{t('lc.days', { n: formatNumber(k.term_days) })}</b></div>
              <div className="vf-line"><span>{t('lc.transfer')}</span><b>{k.transferable ? t('lc.transfer_yes') : t('lc.transfer_no')}</b></div>
            </div>
          )}
          {grace && k.effective_at && <Note>{t('lc.grace_note', { at: atText(k.effective_at) })}</Note>}
          {after && k.effective_at && <Hint>{t('lc.since', { at: atText(k.effective_at) })}</Hint>}
          {!k.available && <Note>{t('lc.kind_missing', { list: miss || t('pj.kind_missing_any') })}</Note>}
          <div className="wk-btns">
            {grace && k.available && !own && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => onForm({ k, f: 'claim' })}>{t('lc.claim')}</ActionButton>}
            {after && k.available && !own && k.mode === 'fixed' && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => onForm({ k, f: 'apply' })}>{t('lc.apply')}</ActionButton>}
            {v.may_set_kind && k.available && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => onForm({ k, f: 'rule' })}>{t(k.required ? 'lc.rule_change' : 'lc.rule_set')}</ActionButton>}
            {v.may_set_kind && k.required && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk(true)}>{t('lc.rule_unset')}</ActionButton>}
          </div>
          {after && k.mode === 'auction' && !own && <Hint>{t('lc.auction_only')}</Hint>}
          {own && <Hint>{t('lc.have_it')}</Hint>}
        </>
      )}
      {ask && <Ask title={t('lc.unset_title', { name: kindText(k.code, k.name) })} body={t('lc.unset_body')} hint={t('lc.unset_hint')} yes={t('lc.rule_unset')} onYes={() => act(ctx, 'unset_kind', { code: k.code })} onClose={() => setAsk(false)} />}
    </div>
  )
}

function Held({ l, v, ctx, mineList }: { l: LicenceLine; v: LicenceView; ctx: FlowCtx; mineList?: boolean }) {
  const [form, setForm] = useState<'list' | 'revoke' | null>(null)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lc.no', { n: formatNumber(l.no), name: kindText(l.kind) })}</b><EffectChip tone={STATUS_TONE[l.status] ?? 'neutral'}>{word(`lc.status.${l.status}`)}</EffectChip></div>
      <div className="mn-sub">{[l.target && t('lc.on', { what: l.target }), l.holder.name, l.holder_kind === 'company' ? t('lc.company') : ''].filter(Boolean).join(' – ')}</div>
      {l.term_end && <div className="mn-sub">{l.status === 'active' || l.status === 'notice' ? t('lc.until', { at: atText(l.term_end) }) : ''}</div>}
      {l.status === 'notice' && l.notice_until && <Note tone="bad">{t('lc.notice', { at: atText(l.notice_until) })}</Note>}
      {l.status === 'revoked' && l.cause && <Hint>{word(`lc.cause.${l.cause}`)}</Hint>}
      {l.proposed && <Note>{t('lc.revoke_proposed')}</Note>}
      <div className="wk-btns">
        {l.may_renew && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'renew', { id: l.id })}>{t('lc.renew')}</ActionButton>}
        {l.may_list && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('list')}>{t('lc.list')}</ActionButton>}
        {!mineList && l.may_revoke && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setForm('revoke')}>{t(l.proposed ? 'lc.revoke_confirm' : 'lc.revoke')}</ActionButton>}
      </div>
      {form === 'list' && <ListIt v={v} l={l} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'revoke' && <Revoke l={l} ctx={ctx} onClose={() => setForm(null)} />}
    </div>
  )
}

function Auction({ a, v, ctx }: { a: LicenceAuctionLine; v: LicenceView; ctx: FlowCtx }) {
  const [bid, setBid] = useState(false)
  const done = a.status !== 'open'
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{kindText(a.kind)}{a.target ? ` – ${a.target}` : ''}</b><EffectChip tone={done ? 'neutral' : 'warn'}>{word(`lc.auction.${a.status}`)}</EffectChip></div>
      <div className="mn-sub">{t('lc.reserve_line', { m: money(a.reserve) })}</div>
      {!done && a.closes_at && <div className="mn-sub">{passed(a.closes_at) ? t('lc.closed_at', { at: atText(a.closes_at) }) : t('lc.closes', { at: atText(a.closes_at) })}</div>}
      {done && a.status === 'awarded' && <div className="mn-sub">{t('lc.won_for', { m: money(a.price) })}</div>}
      <div className="mn-sub">{t('lc.bids_n', { n: formatNumber(a.bids) })}</div>
      {a.my_bid && <Note tone="good">{t('lc.my_bid', { m: money(a.my_bid.amount) })}{a.my_bid.status !== 'standing' ? ` – ${word(`lc.bid.${a.my_bid.status}`)}` : ''}</Note>}
      <div className="wk-btns">{a.may_bid && !a.my_bid && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setBid(true)}>{t('lc.bid')}</ActionButton>}</div>
      {bid && <Bid v={v} a={a} ctx={ctx} onClose={() => setBid(false)} />}
    </div>
  )
}

function Application({ a, ctx }: { a: LicenceApplicationLine; ctx: FlowCtx }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lc.app_line', { kind: kindText(a.kind), who: a.holder.name })}</b><EffectChip tone="warn">{t('lc.app_wait')}</EffectChip></div>
      <div className="mn-sub">{[a.target && t('lc.on', { what: a.target }), t('lc.app_fee', { m: money(a.fee) }), a.at ? atText(a.at) : ''].filter(Boolean).join(' – ')}</div>
      <div className="wk-btns">
        {a.may_decide && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'issue', { id: a.id })}>{t('lc.issue')}</ActionButton>}
        {a.may_decide && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'decline', { id: a.id })}>{t('lc.decline')}</ActionButton>}
        {a.mine && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'withdraw', { id: a.id })}>{t('lc.app_withdraw')}</ActionButton>}
      </div>
    </div>
  )
}

function Listing({ b, v, ctx }: { b: LicenceListingLine; v: LicenceView; ctx: FlowCtx }) {
  const [buy, setBuy] = useState(false)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lc.no', { n: formatNumber(b.licence.no), name: kindText(b.licence.kind) })}</b></div>
      <div className="vf-line"><span>{t('lc.price')}</span><b>{money(b.price)}</b></div>
      <div className="mn-sub">{[b.licence.target && t('lc.on', { what: b.licence.target }), t('lc.seller', { who: b.licence.holder.name }), b.licence.term_end ? t('lc.until', { at: atText(b.licence.term_end) }) : ''].filter(Boolean).join(' – ')}</div>
      <div className="wk-btns">
        {b.may_buy && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setBuy(true)}>{t('lc.buy')}</ActionButton>}
        {b.mine && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'delist', { id: b.id })}>{t('lc.delist')}</ActionButton>}
      </div>
      {buy && <Buy v={v} b={b} ctx={ctx} onClose={() => setBuy(false)} />}
    </div>
  )
}

// -- the screen ----------------------------------------------------------------------------------

export const Licence = flow<LicenceView>(({ view: v, ctx }) => {
  const [form, setForm] = useState<{ k: LicenceKindLine; f: 'rule' | 'claim' | 'apply' } | null>(null)
  const [auction, setAuction] = useState(false)
  if (!v.open) return <Page title={t('lc.title')} tone="emerald"><Closed text={t('lc.off')} hint={t('sp.off_hint')} /></Page>
  const mine = v.mine ?? []
  const kinds = v.kinds ?? []
  const apps = v.applications ?? []
  const auctions = v.auctions ?? []
  const reg = v.register ?? []
  const board = v.board ?? []
  const events = v.events ?? []
  return (
    <Page title={t('lc.title')} tone="emerald">
      <NoticeStrip prefix="lc.notice" code={v.notice} />
      <Panel><Hint>{t('lc.intro')}</Hint></Panel>

      <SectionTitle>{t('lc.mine')}</SectionTitle>
      <Panel>
        {mine.length === 0 && <Lead>{t('lc.mine_none')}</Lead>}
        <div className="mn-list">{mine.map((l) => <Held key={l.id} l={l} v={v} ctx={ctx} mineList />)}</div>
      </Panel>

      <SectionTitle>{t('lc.kinds')}</SectionTitle>
      <Panel>
        <Hint>{t('lc.kinds_hint')}</Hint>
        {kinds.length === 0 && <Lead>{t('lc.kinds_none')}</Lead>}
        <div className="mn-list">{kinds.map((k) => <Kind key={k.code} k={k} v={v} ctx={ctx} onForm={setForm} />)}</div>
      </Panel>

      {(auctions.length > 0 || v.may_auction) && (
        <>
          <SectionTitle>{t('lc.auctions')}</SectionTitle>
          <Panel>
            {auctions.length === 0 && <Lead>{t('lc.auctions_none')}</Lead>}
            <div className="mn-list">{auctions.map((a) => <Auction key={a.id} a={a} v={v} ctx={ctx} />)}</div>
            {v.may_auction && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setAuction(true)}>{t('lc.auction_open')}</ActionButton></div>}
          </Panel>
        </>
      )}

      {apps.length > 0 && (
        <>
          <SectionTitle>{t('lc.apps')}</SectionTitle>
          <Panel>
            {v.may_issue && <Hint>{t('lc.apps_hint')}</Hint>}
            <div className="mn-list">{apps.map((a) => <Application key={a.id} a={a} ctx={ctx} />)}</div>
          </Panel>
        </>
      )}

      <SectionTitle>{t('lc.board')}</SectionTitle>
      <Panel>
        <Hint>{t('lc.board_hint', { p: pct(v.transfer_fee_bps) })}</Hint>
        {board.length === 0 && <Lead>{t('lc.board_none')}</Lead>}
        <div className="mn-list">{board.map((b) => <Listing key={b.id} b={b} v={v} ctx={ctx} />)}</div>
      </Panel>

      <SectionTitle>{t('lc.register')}</SectionTitle>
      <Panel>
        <Hint>{t('lc.register_hint')}</Hint>
        {reg.length === 0 && <Lead>{t('lc.register_none')}</Lead>}
        <div className="mn-list">{reg.map((l) => <Held key={l.id} l={l} v={v} ctx={ctx} />)}</div>
      </Panel>

      {events.length > 0 && (
        <>
          <SectionTitle>{t('lc.events')}</SectionTitle>
          <Panel>
            <div className="vf-list">
              {events.map((e, i) => <div key={i} className="vf-line"><span>{t('lc.event_line', { what: word(`lc.event.${e.kind}`) || t('lc.event.other'), who: e.actor.name || t('lc.event_town') })}</span><b>{e.at ? atText(e.at) : ''}</b></div>)}
            </div>
          </Panel>
        </>
      )}

      {form?.f === 'rule' && <SetKind k={form.k} ctx={ctx} onClose={() => setForm(null)} />}
      {form && form.f !== 'rule' && <Get v={v} k={form.k} how={form.f} ctx={ctx} onClose={() => setForm(null)} />}
      {auction && <OpenAuction v={v} ctx={ctx} onClose={() => setAuction(false)} />}
    </Page>
  )
})
