// «اتحادها و کشورها» (ADR 0076 4 and 5): the unions the town belongs to, the proposals waiting for an answer (each town ratifies by its own charter, the people vote
// on the deep ones), founding a league or a country, and one union's page: members and their dues, the purse, the motions (admit, expel, dissolve) with the tally,
// leaving with notice, the union charter (offices, appointing, recall) and the record. Facts from the server, words ours.

import { useState } from 'react'
import type { UnionBallotLine, UnionDetail, UnionLine, UnionMemberLine, UnionMotionLine, UnionOfficeLine, UnionProposalLine, UnionView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, Multi, NoticeStrip, NumField, Tally, pct, word } from './Polity'
import { OfficeForm, emptyOffice, grantsOf, type OfficeDraft } from './UnionOffice'
import { permName } from './Charter'
import { t } from '../../i18n'

registerWrites(['settlement.union'], (a) => !!a.args?.action)

const sendU = (ctx: FlowCtx, args: Record<string, unknown>) => sendCmd(ctx, 'settlement.union', args as Record<string, string>)
const kindName = (k: string) => word(`pu.kind.${k}`)
const classList = (list: string[] | null) => (list ?? []).map((c) => word(`pu.class.${c}`)).filter(Boolean).join('، ')

// -- founding --------------------------------------------------------------------------------------------------------------

function Propose({ v, ctx, onClose }: { v: UnionView; ctx: FlowCtx; onClose: () => void }) {
  const classes = v.classes ?? []
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'league' | 'country'>('league')
  const [mode, setMode] = useState<'one_member' | 'weighted' | 'double_majority'>('one_member')
  const [exit, setExit] = useState<'free' | 'consent'>('free')
  const [deleg, setDeleg] = useState<string[]>(['treaty'])
  const [fixed, setFixed] = useState('0')
  const [share, setShare] = useState('0')
  const [invite, setInvite] = useState<string[]>([])
  const [offices, setOffices] = useState<OfficeDraft[]>([{ ...emptyOffice(), title: '' }])
  const [cur, setCur] = useState(0)
  const country = kind === 'country'
  const need = ['war', 'treaty', 'courts']
  const missing = country ? need.filter((c) => !deleg.includes(c)) : []
  const nameOk = name.trim().length >= 2 && name.trim().length <= 32
  const officesOk = offices.length > 0 && offices.every((o) => o.title.trim().length >= 2 && Object.keys(o.grants).length > 0) && offices.some((o) => o.holders.length > 0)
  const ok = nameOk && invite.length > 0 && missing.length === 0 && officesOk
  const reason = !nameOk ? t('pu.p.need_name') : invite.length === 0 ? t('pu.p.need_invite') : missing.length ? t('pu.p.need_country', { list: missing.map((c) => word(`pu.class.${c}`)).join('، ') }) : !officesOk ? t('pu.p.need_office') : undefined
  const setOffice = (i: number, d: OfficeDraft) => setOffices((list) => list.map((o, j) => (j === i ? d : o)))
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pu.p.title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : reason} onClick={() => {
        onClose()
        sendU(ctx, { action: 'propose', name: name.trim(), kind, mode, exit, delegations: deleg.join(','), dues_fixed: fixed || '0', dues_share: String(Math.round((Number(share) || 0) * 100)), invite: invite.join(','),
          offices: offices.map((o) => ({ title: o.title.trim(), seats: o.seats, grants: grantsOf(o), holders: o.holders })) })
      }}>{t('pu.p.go')}</ActionButton>}>
      <div className="ch-edit">
        <div className="ch-col">
          <label className="ch-field"><span>{t('pu.p.name')}</span><input className="vd-input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} aria-label={t('pu.p.name')} /></label>
          <Choice label={t('pu.p.kind')} value={kind} onChange={setKind} options={[{ key: 'league', text: t('pu.kind.league') }, { key: 'country', text: t('pu.kind.country') }]} />
          <Hint>{country ? t('pu.p.country_hint', { n: formatNumber(v.country_min_residents) }) : t('pu.p.league_hint')}</Hint>
          <Multi label={t('pu.p.deleg')} values={deleg} onChange={setDeleg} options={classes.map((c) => ({ key: c, text: word(`pu.class.${c}`) })).filter((o) => o.text)} />
          <Hint>{t('pu.p.deleg_hint')}</Hint>
          <Choice label={t('pu.p.mode')} value={mode} onChange={setMode} options={(['one_member', 'weighted', 'double_majority'] as const).map((k) => ({ key: k, text: t(`pu.mode.${k}`) }))} />
          <Hint>{t(`pu.mode_hint.${mode}`)}</Hint>
          <Choice label={t('pu.p.exit')} value={exit} onChange={setExit} options={[{ key: 'free', text: t('pu.exit.free') }, { key: 'consent', text: t('pu.exit.consent') }]} />
          <NumField label={t('pu.p.dues_fixed')} value={fixed} onChange={setFixed} hint={t('pu.p.dues_hint')} />
          <NumField label={t('pu.p.dues_share')} value={share} onChange={setShare} hint={t('pu.p.share_hint')} />
        </div>
        <div className="ch-col">
          <Multi label={t('pu.p.invite')} values={invite} onChange={setInvite} options={(v.targets ?? []).map((x) => ({ key: x.code, text: x.name }))} />
          {(v.targets ?? []).length === 0 && <Hint>{t('pu.p.no_targets')}</Hint>}
          <SectionTitle>{t('pu.p.offices')}</SectionTitle>
          <Hint>{t('pu.p.offices_hint')}</Hint>
          <div className="rc-chips" role="tablist" aria-label={t('pu.p.offices')}>
            {offices.map((o, i) => <button key={i} type="button" role="tab" aria-selected={cur === i} className={`dk-chip${cur === i ? ' all' : ''}`} onClick={() => setCur(i)}>{o.title.trim() || t('pu.p.office_n', { n: formatNumber(i + 1) })}</button>)}
            {offices.length < 6 && <button type="button" className="dk-chip" onClick={() => { setOffices((l) => [...l, emptyOffice()]); setCur(offices.length) }}>{t('pu.p.office_add')}</button>}
          </div>
          {offices[cur] && <OfficeForm draft={offices[cur]} onChange={(d) => setOffice(cur, d)} withHolders />}
          {offices.length > 1 && <ActionButton tone="steel" small onClick={() => { setOffices((l) => l.filter((_, j) => j !== cur)); setCur(0) }}>{t('pu.p.office_drop')}</ActionButton>}
        </div>
      </div>
    </Popup>
  )
}

// -- the list ---------------------------------------------------------------------------------------------------------------

function Ballot({ b, ctx }: { b: UnionBallotLine; ctx: FlowCtx }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{b.petition ? t('pu.ballot.petition', { who: b.subject.name }) : t('pu.ballot.vote', { who: b.subject.name })}</b>{b.closes_at && <span>{t('pu.until', { at: atText(b.closes_at) })}</span>}</div>
      {b.petition ? <div className="mn-sub">{t('pu.ballot.signatures', { a: formatNumber(b.signatures), b: formatNumber(b.need) })}</div> : <Tally yes={b.yes} no={b.no} need={b.need} />}
      {b.voted && <EffectChip tone="good">{t('pu.voted')}</EffectChip>}
      {b.may_vote && !b.voted && !b.petition && (
        <div className="wk-btns">
          <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'vote', id: b.id, choice: 'yes' })}>{t('pu.yes')}</ActionButton>
          <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'vote', id: b.id, choice: 'no' })}>{t('pu.no')}</ActionButton>
        </div>
      )}
    </div>
  )
}

function Proposal({ p, ctx }: { p: UnionProposalLine; ctx: FlowCtx }) {
  const [ask, setAsk] = useState<'refuse' | 'withdraw' | null>(null)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{p.name}</b><EffectChip tone="warn">{kindName(p.kind)}</EffectChip></div>
      <div className="mn-sub">{t('pu.deleg_line', { list: classList(p.delegations) || '—' })}</div>
      {p.deadline && <div className="mn-sub">{t('pu.answer_by', { at: atText(p.deadline) })}</div>}
      <div className="vf-list">{(p.invites ?? []).map((i) => <div key={i.settlement.code} className="vf-line"><span>{i.settlement.name}</span><b>{word(`pu.decision.${i.decision}`)}</b></div>)}</div>
      {p.mine && <div className="mn-sub">{t('pu.fee_paid', { m: money(p.fee) })}</div>}
      {p.needs_assembly && !p.ballot && p.may_ratify && <Hint>{t('pu.needs_assembly')}</Hint>}
      {p.ballot && <Ballot b={p.ballot} ctx={ctx} />}
      <div className="wk-btns">
        {p.may_ratify && !p.ballot && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'ratify', id: p.id })}>{p.needs_assembly ? t('pu.ratify_assembly') : t('pu.ratify')}</ActionButton>}
        {p.may_ratify && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('refuse')}>{t('pu.refuse')}</ActionButton>}
        {p.mine && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk('withdraw')}>{t('pu.withdraw')}</ActionButton>}
      </div>
      {ask === 'refuse' && <Ask title={t('pu.refuse_title')} body={t('pu.refuse_body', { name: p.name })} yes={t('pu.refuse')} onYes={() => sendU(ctx, { action: 'refuse', id: p.id })} onClose={() => setAsk(null)} />}
      {ask === 'withdraw' && <Ask title={t('pu.withdraw_title')} body={t('pu.withdraw_body', { name: p.name })} hint={t('pu.withdraw_hint')} yes={t('pu.withdraw')} onYes={() => sendU(ctx, { action: 'withdraw', id: p.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

function UnionCard({ u, ctx }: { u: UnionLine; ctx: FlowCtx }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{u.name}</b><EffectChip tone={u.kind === 'country' ? 'warn' : 'good'}>{kindName(u.kind)}</EffectChip></div>
      <div className="mn-sub">{t('pu.card', { n: formatNumber(u.members), m: money(u.purse) })}</div>
      <div className="mn-sub">{t('pu.deleg_line', { list: classList(u.delegations) || '—' })}</div>
      {u.my_status && u.my_status !== 'active' && <Note tone="bad">{word(`pu.member.${u.my_status}`)}</Note>}
      <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => sendU(ctx, { id: u.id })}>{t('pu.open')}</ActionButton>
    </div>
  )
}

// -- one union ---------------------------------------------------------------------------------------------------------------

function Member({ m }: { m: UnionMemberLine }) {
  return (
    <div className="vf-line">
      <span>{m.settlement.name} <EffectChip tone={m.status === 'active' ? 'good' : m.status === 'notice' ? 'warn' : 'neutral'}>{word(`pu.member.${m.status}`)}</EffectChip></span>
      <b className={m.arrears > 0 ? 'bad' : ''}>{t('pu.member_line', { r: formatNumber(m.residents), p: money(m.paid) })}{m.arrears > 0 ? ` – ${t('pu.arrears', { n: formatNumber(m.arrears) })}` : ''}{m.notice_ends ? ` – ${t('pu.notice_ends', { at: atText(m.notice_ends) })}` : ''}</b>
    </div>
  )
}

function Motion({ m, d, ctx }: { m: UnionMotionLine; d: UnionDetail; ctx: FlowCtx }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t(`pu.motion.${m.kind}` as never, { who: m.subject.name })}</b>{m.closes_at && <span>{t('pu.until', { at: atText(m.closes_at) })}</span>}</div>
      <Tally yes={m.yes} no={m.no} need={d.members} />
      {d.vote_mode === 'double_majority' && <Hint>{t('pu.double_note')}</Hint>}
      {m.my_vote && <EffectChip tone="good">{t('pu.my_vote', { v: m.my_vote === 'yes' ? t('pu.yes_word') : t('pu.no_word') })}</EffectChip>}
      {m.may_vote && !m.my_vote && (
        <div className="wk-btns">
          <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'motion_vote', id: m.id, choice: 'yes' })}>{t('pu.yes')}</ActionButton>
          <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'motion_vote', id: m.id, choice: 'no' })}>{t('pu.no')}</ActionButton>
        </div>
      )}
    </div>
  )
}

function NewMotion({ d, v, ctx, onClose }: { d: UnionDetail; v: UnionView; ctx: FlowCtx; onClose: () => void }) {
  const kinds = [...(d.may_admit ? ['admit'] : []), ...(d.may_expel ? ['expel'] : []), ...(d.may_vote_member ? ['dissolve'] : [])] as ('admit' | 'expel' | 'dissolve')[]
  const [kind, setKind] = useState<'admit' | 'expel' | 'dissolve'>(kinds[0] ?? 'admit')
  const members = new Set((d.roster ?? []).map((r) => r.settlement.code))
  const pool = kind === 'admit' ? (v.targets ?? []).filter((x) => !members.has(x.code)) : kind === 'expel' ? (d.roster ?? []).filter((r) => r.status === 'active').map((r) => r.settlement) : []
  const [code, setCode] = useState('')
  const ok = kind === 'dissolve' || !!code
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pu.nm.title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('pu.nm.need')} onClick={() => { onClose(); sendU(ctx, { action: 'motion', id: d.id, kind, ...(kind === 'dissolve' ? {} : { code }) }) }}>{t('pu.nm.go')}</ActionButton>}>
      <Choice label={t('pu.nm.kind')} value={kind} onChange={(k) => { setKind(k); setCode('') }} options={kinds.map((k) => ({ key: k, text: t(`pu.nm.k.${k}` as never) }))} />
      <Hint>{t(`pu.nm.hint.${kind}` as never)}</Hint>
      {kind !== 'dissolve' && <Choice label={t('pu.nm.who')} value={code} onChange={setCode} options={pool.map((x) => ({ key: x.code, text: x.name }))} />}
      {kind !== 'dissolve' && pool.length === 0 && <Hint>{t('pu.nm.nobody')}</Hint>}
    </Popup>
  )
}

function Office({ o, d, ctx, onEdit }: { o: UnionOfficeLine; d: UnionDetail; ctx: FlowCtx; onEdit: () => void }) {
  const [player, setPlayer] = useState('')
  const [ask, setAsk] = useState<{ kind: 'dismiss' | 'recall' | 'close'; who: string; name: string } | null>(null)
  const free = o.seats - (o.holders ?? []).length
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{o.title}</b><span>{t('pu.seats', { a: formatNumber((o.holders ?? []).length), b: formatNumber(o.seats) })}</span></div>
      <div className="ch-chips">{(o.grants ?? []).map((g) => <span key={g.permission} className="nx-chip nx-chip-gold">{g.limit > 0 ? t('charter.perm_limit', { name: permName(g.permission), limit: money(g.limit) }) : permName(g.permission)}</span>)}</div>
      {(o.holders ?? []).length > 0 && <div className="vf-list">{(o.holders ?? []).map((h) => (
        <div key={h.code} className="vf-line"><span>{h.name}</span>
          <b>
            {d.may_dismiss && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk({ kind: 'dismiss', who: h.code, name: h.name })}>{t('pu.dismiss')}</ActionButton>}
            {d.my_status === 'active' && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk({ kind: 'recall', who: h.code, name: h.name })}>{t('pu.recall')}</ActionButton>}
          </b>
        </div>
      ))}</div>}
      {(o.holders ?? []).length === 0 && <Hint>{t('pu.vacant')}</Hint>}
      {d.may_appoint && free > 0 && (
        <div className="pu-row">
          <input className="vd-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value.trim())} placeholder={t('pu.appoint_ph')} aria-label={t('pu.appoint_ph')} />
          <ActionButton tone="gold" small disabled={ctx.busy || !player} onClick={() => { sendU(ctx, { action: 'appoint', id: d.id, office: o.id, player }); setPlayer('') }}>{t('pu.appoint')}</ActionButton>
        </div>
      )}
      <div className="wk-btns">
        {d.may_office && <ActionButton tone="steel" small disabled={ctx.busy} onClick={onEdit}>{t('pu.edit')}</ActionButton>}
        {d.may_office && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk({ kind: 'close', who: '', name: o.title })}>{t('pu.office_close')}</ActionButton>}
      </div>
      {ask?.kind === 'dismiss' && <Ask title={t('pu.dismiss_title')} body={t('pu.dismiss_body', { who: ask.name, office: o.title })} yes={t('pu.dismiss')} onYes={() => sendU(ctx, { action: 'dismiss', id: d.id, office: o.id, player: ask.who })} onClose={() => setAsk(null)} />}
      {ask?.kind === 'recall' && <Ask tone="red" title={t('pu.recall_title')} body={t('pu.recall_body', { who: ask.name, office: o.title })} hint={t('pu.recall_hint')} yes={t('pu.recall_yes')} onYes={() => sendU(ctx, { action: 'recall', id: d.id, office: o.id, player: ask.who })} onClose={() => setAsk(null)} />}
      {ask?.kind === 'close' && <Ask tone="red" title={t('pu.office_close_title')} body={t('pu.office_close_body', { office: o.title })} yes={t('pu.office_close')} onYes={() => sendU(ctx, { action: 'office_close', id: d.id, office: o.id })} onClose={() => setAsk(null)} />}
    </div>
  )
}

function EditOffice({ o, d, ctx, onClose }: { o: UnionOfficeLine | null; d: UnionDetail; ctx: FlowCtx; onClose: () => void }) {
  const [draft, setDraft] = useState<OfficeDraft>(() => o ? { title: o.title, seats: o.seats, grants: Object.fromEntries((o.grants ?? []).map((g) => [g.permission, g.limit])), holders: [] } : emptyOffice())
  const ok = draft.title.trim().length >= 2 && Object.keys(draft.grants).length > 0
  return (
    <Popup open onClose={onClose} tone="navy" title={o ? t('pu.edit_title') : t('pu.new_office_title')}
      footer={<ActionButton tone="green" disabled={ctx.busy || !ok} reason={ok ? undefined : t('pu.p.need_office')} onClick={() => { onClose(); sendU(ctx, { action: 'office', id: d.id, ...(o ? { office: o.id } : {}), title: draft.title.trim(), seats: draft.seats, grants: grantsOf(draft) }) }}>{t('charter.save')}</ActionButton>}>
      <Hint>{t('pu.ceiling_note')}</Hint>
      <OfficeForm draft={draft} onChange={setDraft} held={d.held ?? []} lockSeats={o ? (o.holders ?? []).length : 1} />
    </Popup>
  )
}

function Rules({ d, ctx, onClose }: { d: UnionDetail; ctx: FlowCtx; onClose: () => void }) {
  const [fixed, setFixed] = useState(String(d.dues_fixed))
  const [share, setShare] = useState(String(d.dues_share / 100))
  return (
    <Popup open onClose={onClose} tone="gold" title={t('pu.rules_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy} onClick={() => { onClose(); sendU(ctx, { action: 'rules', id: d.id, dues_fixed: fixed || '0', dues_share: String(Math.round((Number(share) || 0) * 100)) }) }}>{t('pu.rules_go')}</ActionButton>}>
      <NumField label={t('pu.p.dues_fixed')} value={fixed} onChange={setFixed} hint={t('pu.p.dues_hint')} />
      <NumField label={t('pu.p.dues_share')} value={share} onChange={setShare} hint={t('pu.p.share_hint')} />
    </Popup>
  )
}

function Detail({ d, v, ctx }: { d: UnionDetail; v: UnionView; ctx: FlowCtx }) {
  const [motion, setMotion] = useState(false)
  const [edit, setEdit] = useState<UnionOfficeLine | 'new' | null>(null)
  const [rules, setRules] = useState(false)
  const [leave, setLeave] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const notice = d.my_status === 'notice'
  const canMotion = d.may_admit || d.may_expel || d.may_vote_member
  const canRules = (d.held ?? []).includes('charter.amend')
  return (
    <Page title={d.name} tone="gold">
      <NoticeStrip prefix="pu.notice" code={v.notice} />
      <Panel>
        <div className="mn-head"><EffectChip tone={d.kind === 'country' ? 'warn' : 'good'}>{kindName(d.kind)}</EffectChip>{d.my_status && <EffectChip tone={notice ? 'warn' : 'good'}>{word(`pu.member.${d.my_status}`)}</EffectChip>}</div>
        <div className="vf-list">
          <div className="vf-line"><span>{t('pu.members')}</span><b>{formatNumber(d.members)}</b></div>
          <div className="vf-line"><span>{t('pu.purse')}</span><b>{money(d.purse)}</b></div>
          <div className="vf-line"><span>{t('pu.dues')}</span><b>{t('pu.dues_line', { f: money(d.dues_fixed), s: pct(d.dues_share) })}</b></div>
          <div className="vf-line"><span>{t('pu.mode_label')}</span><b>{word(`pu.mode.${d.vote_mode}`)}</b></div>
          <div className="vf-line"><span>{t('pu.exit_label')}</span><b>{word(`pu.exit.${d.exit_rule}`)}</b></div>
        </div>
        <Hint>{t('pu.deleg_line', { list: classList(d.delegations) || '—' })}</Hint>
        {canRules && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setRules(true)}>{t('pu.rules')}</ActionButton>}
      </Panel>
      <div className="wk-btns">
        <ActionButton tone="steel" small onClick={() => sendCmd(ctx, 'settlement.treaty', { union: d.id })}>{t('pu.treaties')}</ActionButton>
        <ActionButton tone="steel" small onClick={() => sendCmd(ctx, 'settlement.debt', { union: d.id })}>{t('pu.debts')}</ActionButton>
        <ActionButton tone="steel" small onClick={() => sendCmd(ctx, 'settlement.tender', { union: d.id })}>{t('pu.tenders')}</ActionButton>
      </div>
      <SectionTitle>{t('pu.roster')}</SectionTitle>
      <Panel><div className="vf-list">{(d.roster ?? []).map((m) => <Member key={m.settlement.code} m={m} />)}</div></Panel>
      <SectionTitle>{t('pu.motions')}</SectionTitle>
      <Panel>
        {(d.motions ?? []).length === 0 && <Hint>{t('pu.motions_none')}</Hint>}
        <div className="mn-list">{(d.motions ?? []).map((m) => <Motion key={m.id} m={m} d={d} ctx={ctx} />)}</div>
        {canMotion ? <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setMotion(true)}>{t('pu.motion_new')}</ActionButton> : <Hint>{t('pu.motion_not')}</Hint>}
      </Panel>
      {(d.ballots ?? []).length > 0 && (<><SectionTitle>{t('pu.ballots')}</SectionTitle><Panel><div className="mn-list">{(d.ballots ?? []).map((b) => <Ballot key={b.id} b={b} ctx={ctx} />)}</div></Panel></>)}
      <SectionTitle>{t('pu.offices')}</SectionTitle>
      <Panel>
        <Hint>{t('pu.offices_hint')}</Hint>
        {(d.held ?? []).length > 0 && <Hint>{t('pu.held')}</Hint>}
        {(d.held ?? []).length > 0 && <div className="ch-chips">{(d.held ?? []).map((c) => <span key={c} className="nx-chip">{permName(c)}</span>)}</div>}
        <div className="mn-list">{(d.offices ?? []).map((o) => <Office key={o.id} o={o} d={d} ctx={ctx} onEdit={() => setEdit(o)} />)}</div>
        {d.may_office && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setEdit('new')}>{t('pu.office_new')}</ActionButton>}
      </Panel>
      {d.my_status && (
        <>
          <SectionTitle>{t('pu.leave_section')}</SectionTitle>
          <Panel>
            {notice ? <Lead>{t('pu.leaving')}</Lead> : <Hint>{d.exit_rule === 'consent' ? t('pu.leave_consent') : t('pu.leave_free')}</Hint>}
            <div className="wk-btns">
              {d.may_leave && !notice && <ActionButton tone="red" small disabled={ctx.busy} onClick={() => setLeave(true)}>{t('pu.leave')}</ActionButton>}
              {d.may_leave && notice && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'stay', id: d.id })}>{t('pu.stay')}</ActionButton>}
              {d.may_accede && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'accede', id: d.id })}>{t('pu.accede')}</ActionButton>}
            </div>
          </Panel>
        </>
      )}
      {!d.my_status && d.may_accede && <ActionButton tone="gold" disabled={ctx.busy} onClick={() => sendU(ctx, { action: 'accede', id: d.id })}>{t('pu.accede')}</ActionButton>}
      <SectionTitle>{t('pu.audit')}</SectionTitle>
      <Panel>
        <button type="button" className="dk-chip" aria-expanded={showAudit} onClick={() => setShowAudit(!showAudit)}>{showAudit ? t('pu.audit_hide') : t('pu.audit_show', { n: formatNumber((d.audit ?? []).length) })}</button>
        {showAudit && <div className="vf-list">{(d.audit ?? []).map((a, i) => <div key={i} className="vf-line"><span>{word(`pu.audit.${a.action}`) || t('pu.audit.other')}{a.office ? ` – ${a.office}` : ''}</span><b>{atText(a.at)}</b></div>)}</div>}
      </Panel>
      {motion && <NewMotion d={d} v={v} ctx={ctx} onClose={() => setMotion(false)} />}
      {edit && <EditOffice o={edit === 'new' ? null : edit} d={d} ctx={ctx} onClose={() => setEdit(null)} />}
      {rules && <Rules d={d} ctx={ctx} onClose={() => setRules(false)} />}
      {leave && <Ask tone="red" title={t('pu.leave_title')} body={t('pu.leave_body', { name: d.name })} hint={d.exit_rule === 'consent' ? t('pu.leave_hint_consent') : t('pu.leave_hint_free')} yes={t('pu.leave_yes')} onYes={() => sendU(ctx, { action: 'leave', id: d.id })} onClose={() => setLeave(false)} />}
    </Page>
  )
}

export const Union = flow<UnionView>(({ view: v, ctx }) => {
  const [adding, setAdding] = useState(false)
  if (!v.open) return <Page title={t('pu.title')} tone="gold"><Closed text={t('pu.off')} hint={v.open_at ? t('pu.off_from', { at: atText(v.open_at) }) : t('pu.off_hint')} /></Page>
  if (v.detail) return <Detail d={v.detail} v={v} ctx={ctx} />
  const unions = v.unions ?? [], props = v.proposals ?? []
  return (
    <Page title={t('pu.title')} tone="gold">
      <NoticeStrip prefix="pu.notice" code={v.notice} />
      <Panel><Hint>{t('pu.intro')}</Hint></Panel>
      <SectionTitle>{t('pu.mine')}</SectionTitle>
      <Panel>
        {unions.length === 0 && <Lead>{t('pu.mine_none')}</Lead>}
        <div className="mn-list">{unions.map((u) => <UnionCard key={u.id} u={u} ctx={ctx} />)}</div>
      </Panel>
      {props.length > 0 && (
        <>
          <SectionTitle>{t('pu.proposals')}</SectionTitle>
          <Panel>
            {!v.may_ratify && <Hint>{t('pu.not_ratify')}</Hint>}
            <div className="mn-list">{props.map((p) => <Proposal key={p.id} p={p} ctx={ctx} />)}</div>
          </Panel>
        </>
      )}
      {v.may_propose ? <ActionButton tone="gold" disabled={ctx.busy} onClick={() => setAdding(true)}>{t('pu.new')}</ActionButton> : <Panel><Hint>{t('pu.not_propose')}</Hint></Panel>}
      <div className="wk-btns">
        <ActionButton tone="steel" small onClick={() => sendCmd(ctx, 'settlement.treaty', {})}>{t('pu.town_treaties')}</ActionButton>
        <ActionButton tone="steel" small onClick={() => sendCmd(ctx, 'settlement.debt', {})}>{t('pu.town_debts')}</ActionButton>
      </div>
      {adding && <Propose v={v} ctx={ctx} onClose={() => setAdding(false)} />}
    </Page>
  )
})
