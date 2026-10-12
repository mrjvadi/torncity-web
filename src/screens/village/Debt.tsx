// «وام‌ها» (ADR 0076 11): loans between towns and unions. Treasury money only: the offer, the answer, the schedule of instalments, the
// restructure (never more than is owed), the default and the write-off, and the borrowing record that every lender can read.

import { useState } from 'react'
import type { DebtLoanLine, DebtRecordLine, DebtView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, NumField, pct, word } from './Polity'
import { t } from '../../i18n'

registerWrites(['settlement.debt'], (a) => !!a.args?.action)

const GOOD = ['active', 'repaid']
const BAD = ['defaulted']

function Terms({ v, ctx, loan, onClose }: { v: DebtView; ctx: FlowCtx; loan?: DebtLoanLine; onClose: () => void }) {
  const [to, setTo] = useState('')
  const [principal, setPrincipal] = useState(String(loan?.owed ?? ''))
  const [rate, setRate] = useState(String(loan ? Math.round(loan.rate_bps / 100) : ''))
  const [periods, setPeriods] = useState(String(loan?.periods ?? ''))
  const p = Number(principal) || 0, r = Number(rate) || 0, n = Number(periods) || 0
  const cap = loan ? loan.owed : v.lendable
  const tooMuch = p > cap
  const badRate = r * 100 > v.max_rate_bps
  const badN = n < 1 || n > v.max_instalments
  const ok = p > 0 && !tooMuch && !badRate && !badN && (!!loan || !!to)
  const reason = tooMuch ? (loan ? t('pb.more_than_owed') : t('pb.more_than_lendable')) : badRate ? t('pb.rate_high', { p: pct(v.max_rate_bps) }) : badN && periods ? t('pb.periods_range', { n: formatNumber(v.max_instalments) }) : undefined
  const base: Record<string, string> = v.party_kind === 'union' ? { union: v.party.code } : {}
  return (
    <Popup open onClose={onClose} tone="gold" title={loan ? t('pb.restructure_title') : t('pb.offer_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : reason} onClick={() => { onClose(); sendCmd(ctx, 'settlement.debt', loan ? { ...base, action: 'restructure', id: loan.id, principal, rate: String(r * 100), periods } : { ...base, action: 'offer', code: to, principal, rate: String(r * 100), periods }) }}>{loan ? t('pb.restructure_go') : t('pb.offer_go')}</ActionButton>}>
      {!loan && <Choice label={t('pb.to_label')} value={to} onChange={setTo} options={(v.targets ?? []).map((x) => ({ key: x.code, text: x.name }))} />}
      {!loan && (v.targets ?? []).length === 0 && <Hint>{t('pb.no_targets')}</Hint>}
      <NumField label={t('pb.principal')} value={principal} onChange={setPrincipal} hint={loan ? t('pb.owed_now', { m: money(loan.owed) }) : t('pb.lendable', { m: money(v.lendable) })} />
      <NumField label={t('pb.rate')} value={rate} onChange={setRate} hint={t('pb.rate_max', { p: pct(v.max_rate_bps) })} />
      <NumField label={t('pb.periods')} value={periods} onChange={setPeriods} hint={t('pb.periods_max', { n: formatNumber(v.max_instalments) })} />
      <Hint>{loan ? t('pb.restructure_hint') : t('pb.offer_hint')}</Hint>
    </Popup>
  )
}

function Loan({ l, v, ctx }: { l: DebtLoanLine; v: DebtView; ctx: FlowCtx }) {
  const [ask, setAsk] = useState<'decline' | 'withdraw' | 'writeoff' | null>(null)
  const [terms, setTerms] = useState(false)
  const base: Record<string, string> = v.party_kind === 'union' ? { union: v.party.code } : {}
  const done = l.periods > 0 ? Math.round((l.paid / Math.max(1, l.instalment * l.periods)) * 100) : 0
  const role = l.mine === 'lender' ? t('pb.role.lender') : l.mine === 'borrower' ? t('pb.role.borrower') : ''
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('pb.line', { a: l.lender.name, b: l.borrower.name })}</b><EffectChip tone={GOOD.includes(l.status) ? 'good' : BAD.includes(l.status) ? 'bad' : l.status === 'offered' ? 'warn' : 'neutral'}>{word(`pb.status.${l.status}`)}</EffectChip></div>
      {role && <div className="mn-sub">{role}</div>}
      <div className="vf-list">
        <div className="vf-line"><span>{t('pb.principal')}</span><b>{money(l.principal)}</b></div>
        <div className="vf-line"><span>{t('pb.rate')}</span><b>{pct(l.rate_bps)}</b></div>
        {l.instalment > 0 && <div className="vf-line"><span>{t('pb.instalment')}</span><b>{money(l.instalment)}</b></div>}
        {['active', 'defaulted', 'restructured'].includes(l.status) && <div className="vf-line"><span>{t('pb.owed')}</span><b className={l.arrears > 0 ? 'bad' : ''}>{money(l.owed)}</b></div>}
      </div>
      {['active', 'defaulted', 'repaid', 'restructured'].includes(l.status) && (
        <>
          <div className="mn-sub">{t('pb.schedule', { a: formatNumber(Math.min(l.periods, Math.round(l.paid / Math.max(1, l.instalment)))), b: formatNumber(l.periods) })}</div>
          <div className="mn-bar"><i className={l.status === 'defaulted' ? 'bad' : ''} style={{ width: `${Math.min(100, done)}%` }} /></div>
        </>
      )}
      {l.status === 'active' && l.next_due_at && <div className="mn-sub">{t('pb.next', { at: atText(l.next_due_at) })}</div>}
      {l.status === 'offered' && l.expires_at && <div className="mn-sub">{t('pb.answer_by', { at: atText(l.expires_at) })}</div>}
      {l.arrears > 0 && l.status === 'active' && <Note tone="bad">{t('pb.late', { m: money(l.arrears), f: money(l.fees_due) })}</Note>}
      {l.status === 'defaulted' && <Note tone="bad">{t('pb.defaulted', { m: money(l.owed) })}</Note>}
      <div className="wk-btns">
        {l.may_accept && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.debt', { ...base, action: 'accept', id: l.id })}>{t('pb.accept')}</ActionButton>}
        {l.may_accept && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('decline')}>{t('pb.decline')}</ActionButton>}
        {l.may_withdraw && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('withdraw')}>{t('pb.withdraw')}</ActionButton>}
        {l.may_restructure && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setTerms(true)}>{t('pb.restructure')}</ActionButton>}
        {l.may_write_off && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setAsk('writeoff')}>{t('pb.writeoff')}</ActionButton>}
      </div>
      {terms && <Terms v={v} ctx={ctx} loan={l} onClose={() => setTerms(false)} />}
      {ask === 'decline' && <Ask title={t('pb.decline_title')} body={t('pb.decline_body', { who: l.lender.name, m: money(l.principal) })} yes={t('pb.decline')} onYes={() => sendCmd(ctx, 'settlement.debt', { ...base, action: 'decline', id: l.id })} onClose={() => setAsk(null)} />}
      {ask === 'withdraw' && <Ask title={t('pb.withdraw_title')} body={t('pb.withdraw_body', { who: l.borrower.name })} yes={t('pb.withdraw')} onYes={() => sendCmd(ctx, 'settlement.debt', { ...base, action: 'withdraw', id: l.id })} onClose={() => setAsk(null)} />}
      {ask === 'writeoff' && <Ask tone="red" title={t('pb.writeoff_title')} body={t('pb.writeoff_body', { who: l.borrower.name, m: money(l.owed) })} hint={t('pb.writeoff_hint')} yes={t('pb.writeoff_yes')} onYes={() => sendCmd(ctx, 'settlement.debt', { ...base, action: 'writeoff', id: l.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

function Record({ r, who }: { r: DebtRecordLine; who: string }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{who}</b></div>
      <div className="mn-sub">{t('pb.record_line', { a: formatNumber(r.taken), b: formatNumber(r.repaid), c: formatNumber(r.late), d: formatNumber(r.defaulted) })}</div>
    </div>
  )
}

export const Debt = flow<DebtView>(({ view: v, ctx }) => {
  const [offer, setOffer] = useState(false)
  const loans = v.loans ?? []
  const title = v.party_kind === 'union' ? t('pb.title_union', { name: v.party.name }) : t('pb.title')
  if (!v.open) return <Page title={title} tone="gold"><Closed text={t('pb.off')} hint={t('pu.off_hint')} /></Page>
  const offers = loans.filter((l) => l.status === 'offered')
  const running = loans.filter((l) => !['offered', 'repaid', 'declined', 'withdrawn', 'expired', 'written_off'].includes(l.status))
  const closed = loans.filter((l) => ['repaid', 'declined', 'withdrawn', 'expired', 'written_off'].includes(l.status))
  return (
    <Page title={title} tone="gold">
      <NoticeStrip prefix="pb.notice" code={v.notice} />
      <Panel>
        <Hint>{t('pb.intro')}</Hint>
        <div className="vf-list">
          <div className="vf-line"><span>{t('pb.lendable_label')}</span><b>{money(v.lendable)}</b></div>
          <div className="vf-line"><span>{t('pb.income')}</span><b>{money(v.income)}</b></div>
          <div className="vf-line"><span>{t('pb.service')}</span><b className={v.income > 0 && v.service > v.income ? 'bad' : ''}>{money(v.service)}</b></div>
        </div>
      </Panel>
      {offers.length > 0 && (<><SectionTitle>{t('pb.offers')}</SectionTitle><Panel><div className="mn-list">{offers.map((l) => <Loan key={l.id} l={l} v={v} ctx={ctx} />)}</div></Panel></>)}
      <SectionTitle>{t('pb.running')}</SectionTitle>
      <Panel>
        {running.length === 0 && <Lead>{t('pb.running_none')}</Lead>}
        <div className="mn-list">{running.map((l) => <Loan key={l.id} l={l} v={v} ctx={ctx} />)}</div>
      </Panel>
      {v.may_lend ? <ActionButton tone="gold" disabled={ctx.busy} onClick={() => setOffer(true)}>{t('pb.offer')}</ActionButton> : <Panel><Hint>{t('pb.not_lend')}</Hint></Panel>}
      {!v.may_borrow && <Panel><Hint>{t('pb.not_borrow')}</Hint></Panel>}
      {closed.length > 0 && (<><SectionTitle>{t('pb.closed')}</SectionTitle><Panel><div className="mn-list">{closed.map((l) => <Loan key={l.id} l={l} v={v} ctx={ctx} />)}</div></Panel></>)}
      <SectionTitle>{t('pb.record')}</SectionTitle>
      <Panel>
        <Hint>{t('pb.record_hint')}</Hint>
        <Record r={v.record} who={t('pb.record_me')} />
        {(v.others ?? []).length > 0 && <div className="mn-list">{(v.others ?? []).map((r) => <Record key={r.party.code} r={r} who={r.party.name} />)}</div>}
      </Panel>
      {offer && <Terms v={v} ctx={ctx} onClose={() => setOffer(false)} />}
    </Page>
  )
})
