// «پیمان‌ها» (ADR 0076 6): the treaties of a town or of a union (alliance, non-aggression, trade, passage): the live ones with their end, the offers that
// came and the ones we sent, the cooling after an alliance or a pact is ended, and the record of the ones that ended. Facts from the server, words ours.

import { useState } from 'react'
import type { SettlementTreatyLine, SettlementTreatyView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, pct, word } from './Polity'
import { t } from '../../i18n'

registerWrites(['settlement.treaty'], (a) => !!a.args?.action)

const LIVE = ['active']
const OFFER = ['proposed']

function Line({ l, v, ctx, union }: { l: SettlementTreatyLine; v: SettlementTreatyView; ctx: FlowCtx; union: string }) {
  const [ask, setAsk] = useState<'end' | 'withdraw' | 'decline' | null>(null)
  const cooling = !!l.cooling_until && Date.parse(l.cooling_until) > Date.now()
  const base: Record<string, string> = union ? { union } : {}
  const kind = word(`pt.kind.${l.kind.code}`, l.kind.name)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('pt.with', { kind, who: l.other.name })}</b><EffectChip tone={l.status === 'active' ? 'good' : l.status === 'proposed' ? 'warn' : 'neutral'}>{word(`pt.status.${l.status}`)}</EffectChip></div>
      <div className="mn-sub">{[l.alliance ? t('pt.alliance') : '', l.passage ? t('pt.passage') : ''].filter(Boolean).join('، ') || t('pt.plain')}</div>
      {l.status === 'proposed' && l.expires_at && <div className="mn-sub">{t('pt.answer_by', { at: atText(l.expires_at) })}</div>}
      {l.status === 'active' && l.proposed_at && <div className="mn-sub">{t('pt.since', { at: atText(l.proposed_at) })}</div>}
      {l.ended_at && <div className="mn-sub">{t('pt.ended_at', { at: atText(l.ended_at) })}</div>}
      {l.status === 'terminated' && l.ended_party && <Note tone="bad">{t('pt.ended_by', { who: l.ended_party.name })}</Note>}
      {cooling && <Note tone="bad">{t('pt.cooling', { at: atText(l.cooling_until) })}</Note>}
      <div className="wk-btns">
        {LIVE.includes(l.status) && v.may_end && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setAsk('end')}>{t('pt.end')}</ActionButton>}
        {OFFER.includes(l.status) && !l.mine && v.may_sign && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.treaty', { ...base, action: 'accept', no: String(l.no) })}>{t('pt.accept')}</ActionButton>}
        {OFFER.includes(l.status) && !l.mine && v.may_sign && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('decline')}>{t('pt.decline')}</ActionButton>}
        {OFFER.includes(l.status) && l.mine && v.may_propose && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('withdraw')}>{t('pt.withdraw')}</ActionButton>}
      </div>
      {ask === 'end' && (
        <Ask tone="red" title={t('pt.end_title')} body={t('pt.end_body', { who: l.other.name })} hint={l.alliance || l.kind.code === 'non_aggression' ? t('pt.end_cooling', { n: formatNumber(v.cooling_days) }) : t('pt.end_plain')} yes={t('pt.end_yes')}
          onYes={() => sendCmd(ctx, 'settlement.treaty', { ...base, action: 'end', no: String(l.no) })} onClose={() => setAsk(null)} />
      )}
      {ask === 'decline' && <Ask title={t('pt.decline_title')} body={t('pt.decline_body', { who: l.other.name })} yes={t('pt.decline')} onYes={() => sendCmd(ctx, 'settlement.treaty', { ...base, action: 'decline', no: String(l.no) })} onClose={() => setAsk(null)} />}
      {ask === 'withdraw' && <Ask title={t('pt.withdraw_title')} body={t('pt.withdraw_body', { who: l.other.name })} yes={t('pt.withdraw')} onYes={() => sendCmd(ctx, 'settlement.treaty', { ...base, action: 'withdraw', no: String(l.no) })} onClose={() => setAsk(null)} />}
    </div>
  )
}

function Propose({ v, ctx, union, onClose }: { v: SettlementTreatyView; ctx: FlowCtx; union: string; onClose: () => void }) {
  const kinds = v.kinds ?? []
  const [kind, setKind] = useState(kinds[0]?.kind.code ?? '')
  const [to, setTo] = useState('')
  const k = kinds.find((x) => x.kind.code === kind)
  const parties = (v.parties ?? []).length > 0 ? (v.parties ?? []) : (v.targets ?? []).map((x) => ({ party: x, kind: 'settlement' }))
  const picked = parties.find((x) => x.party.code === to)
  const taken = (v.treaties ?? []).some((l) => l.kind.code === kind && l.other.code === to && (l.status === 'active' || l.status === 'proposed'))
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pt.new_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !kind || !to || taken} reason={taken ? t('pt.taken') : undefined} onClick={() => { onClose(); sendCmd(ctx, 'settlement.treaty', { ...(union ? { union } : {}), action: 'propose', kind, ...(picked && picked.kind !== 'settlement' ? { to_union: to } : { code: to }) }) }}>{t('pt.send')}</ActionButton>}>
      <Choice label={t('pt.kind_label')} value={kind} onChange={setKind} options={kinds.map((x) => ({ key: x.kind.code, text: word(`pt.kind.${x.kind.code}`, x.kind.name) }))} />
      {k && (
        <div className="mn-sub">
          {[k.alliance ? t('pt.alliance') : '', k.non_aggression ? t('pt.nonagg') : '', k.passage ? t('pt.passage') : '', k.tariff_discount_bps > 0 ? t('pt.tariff', { p: pct(k.tariff_discount_bps) }) : ''].filter(Boolean).join('، ') || t('pt.plain')}
        </div>
      )}
      <Choice label={t('pt.to_label')} value={to} onChange={setTo} options={parties.map((x) => ({ key: x.party.code, text: x.kind === 'settlement' ? x.party.name : `${x.party.name} (${word(`pu.kind.${x.kind}`)})` }))} />
      {parties.length === 0 && <Hint>{t('pt.no_targets')}</Hint>}
      <Hint>{t('pt.send_hint')}</Hint>
    </Popup>
  )
}

export const Treaty = flow<SettlementTreatyView>(({ view: v, ctx }) => {
  const [adding, setAdding] = useState(false)
  // for a union the party's code is the union's id, and every write repeats it
  const union = v.party_kind === 'union' ? v.party.code : ''
  const list = v.treaties ?? []
  const live = list.filter((l) => l.status === 'active')
  const offers = list.filter((l) => l.status === 'proposed')
  const past = list.filter((l) => !['active', 'proposed'].includes(l.status))
  const title = v.party_kind === 'union' ? t('pt.title_union', { name: v.party.name }) : t('pt.title')
  if (!v.open) return <Page title={title} tone="gold"><Closed text={t('pt.off')} hint={t('pu.off_hint')} /></Page>
  return (
    <Page title={title} tone="gold">
      <NoticeStrip prefix="pt.notice" code={v.notice} />
      <Panel><Hint>{t('pt.intro')}</Hint></Panel>
      <SectionTitle>{t('pt.live')}</SectionTitle>
      <Panel>
        {live.length === 0 && <Hint>{t('pt.live_none')}</Hint>}
        <div className="mn-list">{live.map((l) => <Line key={l.no} l={l} v={v} ctx={ctx} union={union} />)}</div>
      </Panel>
      {offers.length > 0 && (
        <>
          <SectionTitle>{t('pt.offers')}</SectionTitle>
          <Panel><div className="mn-list">{offers.map((l) => <Line key={l.no} l={l} v={v} ctx={ctx} union={union} />)}</div></Panel>
        </>
      )}
      {v.may_propose ? (
        <ActionButton tone="gold" disabled={ctx.busy} onClick={() => setAdding(true)}>{t('pt.new')}</ActionButton>
      ) : <Panel><Hint>{t('pt.not_allowed')}</Hint></Panel>}
      <SectionTitle>{t('pt.record')}</SectionTitle>
      <Panel>
        <Hint>{t('pt.record_hint')}</Hint>
        {past.length === 0 && <Lead>{t('pt.record_none')}</Lead>}
        <div className="mn-list">{past.map((l) => <Line key={l.no} l={l} v={v} ctx={ctx} union={union} />)}</div>
        {past.length > 0 && <Hint>{t('pt.record_count', { n: formatNumber(past.filter((l) => l.status === 'terminated').length) })}</Hint>}
      </Panel>
      {adding && <Propose v={v} ctx={ctx} union={union} onClose={() => setAdding(false)} />}
    </Page>
  )
})
