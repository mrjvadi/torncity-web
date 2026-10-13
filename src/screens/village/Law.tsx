// «قانون و دادگاه» (ADR 0078, B14): the town's law (the offences its charter lists and the way it tries a case), the police posts and their day, the cases
// (LawCases.tsx), the lock-up with its cells and bail, customs, and what stays out of sight (LawShadow.tsx: bribes, the hidden board, laundering, a gang).
// One screen, `settlement.law`, with a row of tabs; a part that has not started or that the viewer may not use says so in one plain line. Facts from the
// server, words ours. Calm game wording: names, limits, risks and consequences; nothing here tells anyone how to do anything.

import { useEffect, useState } from 'react'
import type { LawBribeLine, LawLoadLine, LawOffenceLine, LawPostLine, LawSentenceLine } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { Ask, Choice, Closed, NoticeStrip, NumField, word } from './Polity'
import { Cases } from './LawCases'
import { Shadow } from './LawShadow'
import { Complain, Meter, NotYet, PlayerForm, Tabs, act, banWord, classWord, daysText, hoursText, manifest, manifestText, sentenceStatusWord, sentenceWord, serviceWord, type LawV } from './lawShared'
import { t } from '../../i18n'

registerWrites(['settlement.law'], () => true)

type Tab = 'law' | 'posts' | 'cases' | 'jail' | 'customs' | 'shadow'

// -- the town's law ----------------------------------------------------------------------------------

function OffenceSet({ o, ctx, onClose }: { o: LawOffenceLine; ctx: FlowCtx; onClose: () => void }) {
  const [fine, setFine] = useState('')
  const [jail, setJail] = useState('')
  const [ban, setBan] = useState('')
  const kinds = o.sentences ?? []
  const over = (Number(fine) > o.max_fine && o.max_fine > 0) || (Number(jail) > o.max_jail_hours && o.max_jail_hours > 0) || (Number(ban) > o.max_ban_days && o.max_ban_days > 0)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.set_title', { name: o.name })}
      footer={<ActionButton tone="gold" disabled={ctx.busy || over} reason={over ? t('lw.set_over') : undefined}
        onClick={() => { onClose(); act(ctx, 'offence', { code: o.code, ...(fine ? { amount: fine } : {}), ...(jail ? { hours: jail } : {}), ...(ban ? { days: ban } : {}) }) }}>{t('lw.set_go')}</ActionButton>}>
      <Hint>{t('lw.set_intro')}</Hint>
      {kinds.includes('fine') && <NumField label={t('lw.set_fine')} value={fine} onChange={setFine} hint={o.max_fine > 0 ? t('lw.set_max', { n: money(o.max_fine) }) : undefined} />}
      {kinds.includes('jail') && <NumField label={t('lw.set_jail')} value={jail} onChange={setJail} hint={o.max_jail_hours > 0 ? t('lw.set_max', { n: hoursText(o.max_jail_hours) }) : undefined} />}
      {kinds.includes('ban') && <NumField label={t('lw.set_ban')} value={ban} onChange={setBan} hint={o.max_ban_days > 0 ? t('lw.set_max', { n: daysText(o.max_ban_days) }) : undefined} />}
      <Hint>{t('lw.set_grace')}</Hint>
    </Popup>
  )
}

function Offence({ o, v, ctx }: { o: LawOffenceLine; v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState<'set' | 'unset' | 'complain' | null>(null)
  const waiting = o.listed && o.effective_at && new Date(o.effective_at).getTime() > Date.now()
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{o.name || t('lw.other')}</b><EffectChip tone={o.listed ? (waiting ? 'warn' : 'good') : 'neutral'}>{o.listed ? (waiting ? t('lw.listed_wait') : t('lw.listed')) : t('lw.not_listed')}</EffectChip></div>
      <div className="mn-sub">{classWord(o.class)}</div>
      {waiting && o.effective_at && <Hint>{t('lw.grace', { at: atText(o.effective_at) })}</Hint>}
      <div className="rc-chips lw-kinds">{(o.sentences ?? []).map((k) => <span key={k} className="dk-chip">{sentenceWord(k)}</span>)}</div>
      <div className="vf-list">
        {o.max_fine > 0 && <div className="vf-line"><span>{t('lw.max_fine')}</span><b>{money(o.max_fine)}</b></div>}
        {o.max_jail_hours > 0 && <div className="vf-line"><span>{t('lw.max_jail')}</span><b>{hoursText(o.max_jail_hours)}</b></div>}
        {o.max_ban_days > 0 && <div className="vf-line"><span>{t('lw.max_ban')}</span><b>{daysText(o.max_ban_days)}</b></div>}
      </div>
      {!o.available && <Hint>{t('lw.not_here')}</Hint>}
      <div className="wk-btns">
        {v.mays.set && o.available && !o.listed && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('set')}>{t('lw.set')}</ActionButton>}
        {v.mays.set && o.listed && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('unset')}>{t('lw.unset')}</ActionButton>}
        {o.listed && !waiting && v.open.police && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('complain')}>{t('lw.complain')}</ActionButton>}
      </div>
      {form === 'set' && <OffenceSet o={o} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'unset' && <Ask title={t('lw.unset_title', { name: o.name })} body={t('lw.unset_body')} yes={t('lw.unset')} tone="red" onYes={() => act(ctx, 'offence_unset', { code: o.code })} onClose={() => setForm(null)} />}
      {form === 'complain' && <Complain v={v} ctx={ctx} offence={o.code} onClose={() => setForm(null)} />}
    </div>
  )
}

function Model({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(v.model || 'adversarial')
  useEffect(() => setKind(v.model || 'adversarial'), [v.model])
  const name = (k: string) => word(`lw.model.${k}`) || t('lw.other')
  return (
    <>
      <div className="vf-line"><span>{t('lw.model_label')}</span><b>{name(v.model)}</b></div>
      <Hint>{word(`lw.model_hint.${v.model}`)}</Hint>
      {v.mays.set && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setOpen(true)}>{t('lw.model_change')}</ActionButton></div>}
      {open && (
        <Popup open onClose={() => setOpen(false)} tone="gold" title={t('lw.model_title')}
          footer={<ActionButton tone="gold" disabled={ctx.busy || kind === v.model} reason={kind === v.model ? t('lw.model_same') : undefined} onClick={() => { setOpen(false); act(ctx, 'model', { kind }) }}>{t('lw.model_go')}</ActionButton>}>
          <Choice label={t('lw.model_label')} value={kind} onChange={setKind} options={['adversarial', 'inquisitorial'].map((k) => ({ key: k, text: name(k) }))} />
          <Hint>{word(`lw.model_hint.${kind}`)}</Hint>
          <Hint>{t('lw.model_note')}</Hint>
        </Popup>
      )}
    </>
  )
}

function LawTab({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const offences = v.offences ?? []
  const parts: [string, boolean][] = [['police', v.open.police], ['courts', v.open.courts], ['customs', v.open.customs]]
  return (
    <>
      <Panel>
        <Hint>{t('lw.intro')}</Hint>
        <div className="vf-list">{parts.map(([k, on]) => <div key={k} className="vf-line"><span>{word(`lw.part.${k}`)}</span><b>{on ? t('lw.part_on') : t('lw.part_off')}</b></div>)}</div>
        {v.captured && <Note>{t('lw.captured')}</Note>}
        <Model v={v} ctx={ctx} />
      </Panel>
      <SectionTitle>{t('lw.offences')}</SectionTitle>
      <Panel>
        <Hint>{v.mays.set ? t('lw.offences_hint_holder') : t('lw.offences_hint')}</Hint>
        {offences.length === 0 && <Lead>{t('lw.offences_none')}</Lead>}
        <div className="mn-list">{offences.map((o) => <Offence key={o.code} o={o} v={v} ctx={ctx} />)}</div>
      </Panel>
    </>
  )
}

// -- the posts ---------------------------------------------------------------------------------------

function PostCard({ p, ctx }: { p: LawPostLine; ctx: FlowCtx }) {
  const name = p.building?.code ? ctx.bname(p.building.code, p.building.name) : serviceWord(p.service)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{name}</b><EffectChip tone={!p.stands ? 'neutral' : p.open ? 'good' : 'warn'}>{!p.stands ? t('lw.post_none') : p.open ? t('lw.post_open') : t('lw.post_idle')}</EffectChip></div>
      {name !== serviceWord(p.service) && <div className="mn-sub">{serviceWord(p.service)}</div>}
      {!p.stands && <Hint>{word(`lw.post_build.${p.service}`)}</Hint>}
      {p.stands && !p.open && <Hint>{t('lw.post_idle_hint')}</Hint>}
      {p.stands && p.service === 'custody' && <div className="vf-line"><span>{t('lw.cells')}</span><b>{t('lw.cells_n', { held: formatNumber(p.held), n: formatNumber(p.cells) })}</b></div>}
    </div>
  )
}

function Posts({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState<'recruit' | 'audit' | 'books' | null>(null)
  const posts = v.posts ?? []
  const constab = posts.find((p) => p.service === 'constabulary')
  const informants = v.informants ?? []
  return (
    <>
      <Panel>
        <Hint>{t('lw.posts_intro')}</Hint>
        <div className="mn-list">{posts.map((p) => <PostCard key={p.service} p={p} ctx={ctx} />)}</div>
      </Panel>
      <SectionTitle>{t('lw.day')}</SectionTitle>
      <Panel>
        <div className="vf-line"><span>{t('lw.points')}</span><b>{t('lw.points_n', { spent: formatNumber(v.spent), n: formatNumber(v.points) })}</b></div>
        <Meter value={v.spent} max={Math.max(1, v.points)} bad={v.points > 0 && v.spent >= v.points} />
        <div className="vf-line"><span>{t('lw.patrols')}</span><b>{formatNumber(v.patrol)}</b></div>
        <Hint>{t('lw.patrol_hint')}</Hint>
        {v.mays.patrol && <div className="wk-btns"><ActionButton tone="green" small disabled={ctx.busy || !constab?.open || v.spent >= v.points} reason={!constab?.open ? t('lw.post_idle_hint') : v.spent >= v.points ? t('lw.no_points') : undefined} onClick={() => act(ctx, 'patrol')}>{t('lw.patrol')}</ActionButton></div>}
      </Panel>
      {(v.mays.informants || informants.length > 0) && (
        <>
          <SectionTitle>{t('lw.informants')}</SectionTitle>
          <Panel>
            <Hint>{t('lw.informants_hint')}</Hint>
            {informants.length === 0 && <Lead>{t('lw.informants_none')}</Lead>}
            <div className="mn-list">{informants.map((i) => <Informant key={i.id} i={i} ctx={ctx} may={v.mays.informants} />)}</div>
            {v.mays.informants && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('recruit')}>{t('lw.recruit')}</ActionButton></div>}
          </Panel>
        </>
      )}
      {(v.mays.audit_integrity || v.mays.audit_books) && (
        <>
          <SectionTitle>{t('lw.audits')}</SectionTitle>
          <Panel>
            <Hint>{t('lw.audits_hint')}</Hint>
            <div className="wk-btns">
              {v.mays.audit_integrity && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('audit')}>{t('lw.audit_people')}</ActionButton>}
              {v.mays.audit_books && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('books')}>{t('lw.audit_books')}</ActionButton>}
            </div>
          </Panel>
        </>
      )}
      {form === 'recruit' && <PlayerForm title={t('lw.recruit_title')} hint={t('lw.recruit_hint')} go={t('lw.recruit_go')} ctx={ctx} onClose={() => setForm(null)} onGo={(player) => act(ctx, 'recruit', { player })} />}
      {form === 'audit' && <PlayerForm title={t('lw.audit_title')} hint={t('lw.audit_hint')} go={t('lw.audit_go')} ctx={ctx} onClose={() => setForm(null)} onGo={(player) => act(ctx, 'audit', { player })} />}
      {form === 'books' && <CompanyForm ctx={ctx} v={v} onClose={() => setForm(null)} />}
    </>
  )
}

function CompanyForm({ ctx, v, onClose }: { ctx: FlowCtx; v: LawV; onClose: () => void }) {
  const list = v.companies ?? []
  const [code, setCode] = useState(list[0]?.code ?? '')
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.books_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !code} reason={code ? undefined : t('lw.books_none')} onClick={() => { onClose(); act(ctx, 'audit_books', { code }) }}>{t('lw.books_go')}</ActionButton>}>
      {list.length > 0 ? <Choice label={t('lw.company')} value={code} onChange={setCode} options={list.map((c) => ({ key: c.code, text: c.name }))} /> : <Hint>{t('lw.books_none')}</Hint>}
      <Hint>{t('lw.books_hint')}</Hint>
    </Popup>
  )
}

function Informant({ i, ctx, may }: { i: import('../../api/views.gen').LawInformantLine; ctx: FlowCtx; may: boolean }) {
  const [form, setForm] = useState<'tip' | 'retire' | null>(null)
  const live = i.state === 'recruited' || i.state === 'active'
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{i.mine && i.source?.name ? i.source.name : t('lw.informant_anon')}</b><EffectChip tone={live ? 'good' : i.state === 'burned' ? 'bad' : 'neutral'}>{word(`lw.istate.${i.state}`) || t('lw.other')}</EffectChip></div>
      <div className="vf-line"><span>{t('lw.reliability')}</span><b>{formatNumber(i.reliability)}</b></div>
      <Meter value={i.reliability} bad={i.reliability < 30} />
      {i.since && <div className="mn-sub">{t('lw.since', { at: atText(i.since) })}</div>}
      {!i.mine && <Hint>{t('lw.informant_other')}</Hint>}
      {i.rotate_due && <Note>{t('lw.rotate_due')}</Note>}
      {may && live && (
        <div className="wk-btns">
          {i.mine && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => setForm('tip')}>{t('lw.tip')}</ActionButton>}
          {!i.mine && i.rotate_due && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => act(ctx, 'take', { id: i.id })}>{t('lw.take')}</ActionButton>}
          {i.mine && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('retire')}>{t('lw.retire')}</ActionButton>}
        </div>
      )}
      {form === 'tip' && <PlayerForm title={t('lw.tip_title')} hint={t('lw.tip_hint')} go={t('lw.tip_go')} ctx={ctx} onClose={() => setForm(null)} onGo={(player) => act(ctx, 'tip', { id: i.id, player, kind: 'press' })} />}
      {form === 'retire' && <Ask title={t('lw.retire_title')} body={t('lw.retire_body')} yes={t('lw.retire')} onYes={() => act(ctx, 'retire', { id: i.id })} onClose={() => setForm(null)} />}
    </div>
  )
}

// -- the lock-up -------------------------------------------------------------------------------------

function Sentence({ s, ctx }: { s: LawSentenceLine; ctx: FlowCtx }) {
  const [ask, setAsk] = useState(false)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{sentenceWord(s.kind)}{s.kind === 'ban' && s.ban ? ` (${banWord(s.ban)})` : ''}</b><EffectChip tone={s.status === 'active' ? 'warn' : 'neutral'}>{sentenceStatusWord(s.status)}</EffectChip></div>
      <div className="vf-list">
        {s.fine > 0 && <div className="vf-line"><span>{t('lw.s_fine')}</span><b>{t('lw.s_fine_paid', { paid: money(s.fine_paid), all: money(s.fine) })}</b></div>}
        {s.jail_hours > 0 && <div className="vf-line"><span>{t('lw.s_jail')}</span><b>{hoursText(s.jail_hours)}</b></div>}
        {s.kind === 'jail' && s.cell > 0 && <div className="vf-line"><span>{t('lw.s_cell')}</span><b>{formatNumber(s.cell)}</b></div>}
        {s.ban_days > 0 && <div className="vf-line"><span>{t('lw.s_ban')}</span><b>{daysText(s.ban_days)}</b></div>}
        {s.ends_at && s.status === 'active' && <div className="vf-line"><span>{t('lw.s_ends')}</span><b>{atText(s.ends_at)}</b></div>}
        {s.bail > 0 && s.status === 'active' && <div className="vf-line"><span>{t('lw.s_bail')}</span><b>{money(s.bail)}</b></div>}
      </div>
      {s.may_bail && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setAsk(true)}>{t('lw.bail')}</ActionButton></div>}
      {ask && <Ask title={t('lw.bail_title')} body={t('lw.bail_body', { price: money(s.bail) })} hint={t('lw.bail_hint')} yes={t('lw.bail_go')} onYes={() => act(ctx, 'bail', { id: s.id })} onClose={() => setAsk(false)} />}
    </div>
  )
}

function Jail({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const jail = (v.posts ?? []).find((p) => p.service === 'custody')
  const mine = v.mine ?? []
  return (
    <>
      <Panel>
        <Hint>{t('lw.jail_intro')}</Hint>
        {jail ? <PostCard p={jail} ctx={ctx} /> : <NotYet text={t('lw.post_none')} hint={t('lw.post_build.custody')} />}
        {(!jail || !jail.stands) && <Hint>{t('lw.jail_missing')}</Hint>}
      </Panel>
      <SectionTitle>{t('lw.mine')}</SectionTitle>
      <Panel>
        {mine.length === 0 && <Lead>{t('lw.mine_none')}</Lead>}
        <div className="mn-list">{mine.map((s) => <Sentence key={s.id} s={s} ctx={ctx} />)}</div>
        {mine.some((s) => s.kind === 'jail' && s.status === 'active') && <Hint>{t('lw.jail_end')}</Hint>}
      </Panel>
    </>
  )
}

// -- customs -----------------------------------------------------------------------------------------

function Declare({ v, ctx, onClose }: { v: LawV; ctx: FlowCtx; onClose: () => void }) {
  const towns = v.towns ?? []
  const goods = v.goods ?? []
  const [to, setTo] = useState(towns[0]?.code ?? '')
  const [carry, setCarry] = useState<Record<string, string>>({})
  const [decl, setDecl] = useState<Record<string, string>>({})
  const have = Object.entries(carry).some(([, n]) => Number(n) > 0)
  const over = goods.some((g) => Number(carry[g.item.code] ?? 0) > g.have)
  const ok = !!to && have && !over
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.decl_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={!to ? t('lw.decl_need_town') : !have ? t('lw.decl_need_goods') : over ? t('lw.decl_over') : undefined}
        onClick={() => { onClose(); act(ctx, 'declare', { code: to, items: manifest(decl), carry: manifest(carry) }) }}>{t('lw.decl_go')}</ActionButton>}>
      <Choice label={t('lw.decl_to')} value={to} onChange={setTo} options={towns.map((x) => ({ key: x.code, text: x.name }))} />
      {towns.length === 0 && <Hint>{t('lw.decl_no_towns')}</Hint>}
      {goods.length === 0 && <Hint>{t('lw.decl_no_goods')}</Hint>}
      {goods.map((g) => (
        <div key={g.item.code} className="lw-good">
          <b>{g.item.name}</b><small>{t('lw.decl_have', { n: formatNumber(g.have) })}</small>
          <NumField label={t('lw.decl_carry')} value={carry[g.item.code] ?? ''} onChange={(x) => { setCarry({ ...carry, [g.item.code]: x }); if (decl[g.item.code] === undefined || decl[g.item.code] === (carry[g.item.code] ?? '')) setDecl({ ...decl, [g.item.code]: x }) }} />
          <NumField label={t('lw.decl_say')} value={decl[g.item.code] ?? ''} onChange={(x) => setDecl({ ...decl, [g.item.code]: x })} />
        </div>
      ))}
      <Hint>{t('lw.decl_hint')}</Hint>
    </Popup>
  )
}

function Load({ l, v, ctx }: { l: LawLoadLine; v: LawV; ctx: FlowCtx }) {
  const known = (v.goods ?? []).map((g) => g.item)
  const tone = l.status === 'seized' ? 'bad' : l.status === 'crossed' ? 'good' : 'warn'
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lw.load_to', { town: l.to.name })}</b><EffectChip tone={tone}>{word(`lw.load.${l.status}`) || t('lw.other')}</EffectChip></div>
      <div className="vf-list">
        <div className="vf-line"><span>{t('lw.load_declared')}</span><b>{manifestText(ctx, l.declared, known) || t('lw.nothing')}</b></div>
        {l.inspected && <div className="vf-line"><span>{t('lw.load_carried')}</span><b>{manifestText(ctx, l.carried, known) || t('lw.nothing')}</b></div>}
        {l.duty > 0 && <div className="vf-line"><span>{t('lw.load_duty')}</span><b>{money(l.duty)}</b></div>}
        {l.penalty > 0 && <div className="vf-line"><span>{t('lw.load_penalty')}</span><b>{money(l.penalty)}</b></div>}
      </div>
      {l.inspected && l.status === 'crossed' && <Hint>{t('lw.load_clean')}</Hint>}
      {l.status === 'seized' && <Hint>{t('lw.load_seized')}</Hint>}
      {l.may_cross && <div className="wk-btns"><ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'cross', { id: l.id })}>{t('lw.cross')}</ActionButton></div>}
    </div>
  )
}

function Customs({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState(false)
  const house = (v.posts ?? []).find((p) => p.service === 'customs')
  const loads = v.loads ?? []
  return (
    <>
      <Panel>
        <Hint>{t('lw.customs_intro')}</Hint>
        {house ? <PostCard p={house} ctx={ctx} /> : <NotYet text={t('lw.post_none')} hint={t('lw.post_build.customs')} />}
      </Panel>
      <SectionTitle>{t('lw.loads')}</SectionTitle>
      <Panel>
        {loads.length === 0 && <Lead>{t('lw.loads_none')}</Lead>}
        <div className="mn-list">{loads.map((l) => <Load key={l.id} l={l} v={v} ctx={ctx} />)}</div>
        <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy || !v.open.customs} reason={!v.open.customs ? t('lw.part_off') : undefined} onClick={() => setForm(true)}>{t('lw.declare')}</ActionButton></div>
      </Panel>
      {form && <Declare v={v} ctx={ctx} onClose={() => setForm(false)} />}
    </>
  )
}

// -- the screen --------------------------------------------------------------------------------------

export const Law = flow<LawV>(({ view: v, ctx }) => {
  const [tab, setTab] = useState<Tab>('law')
  const openAny = v.open.police || v.open.courts || v.open.customs || v.open.launder || v.open.black
  if (!openAny) return <Page title={t('lw.title')} tone="ruby"><Closed text={t('lw.off')} hint={t('lw.off_hint')} /></Page>
  const bribes: LawBribeLine[] = v.bribes ?? []
  const shadow = v.open.black || v.open.launder || bribes.length > 0 || (v.fronts ?? []).length > 0 || v.board.dirty > 0 || !!v.gang
  const tabs: { key: Tab; text: string }[] = [
    { key: 'law', text: t('lw.tab.law') },
    ...(v.open.police || (v.posts ?? []).some((p) => p.service === 'constabulary') ? [{ key: 'posts' as Tab, text: t('lw.tab.posts') }] : []),
    ...(v.open.police || v.open.courts ? [{ key: 'cases' as Tab, text: t('lw.tab.cases') }] : []),
    ...(v.open.courts || (v.mine ?? []).length > 0 ? [{ key: 'jail' as Tab, text: t('lw.tab.jail') }] : []),
    ...(v.open.customs || (v.loads ?? []).length > 0 ? [{ key: 'customs' as Tab, text: t('lw.tab.customs') }] : []),
    ...(shadow ? [{ key: 'shadow' as Tab, text: t('lw.tab.shadow') }] : []),
  ]
  const on = tabs.some((x) => x.key === tab) ? tab : 'law'
  return (
    <Page title={t('lw.title')} tone="ruby">
      <NoticeStrip prefix="lw.notice" code={v.notice} />
      <Tabs tabs={tabs} value={on} onChange={setTab} />
      {on === 'law' && <LawTab v={v} ctx={ctx} />}
      {on === 'posts' && <Posts v={v} ctx={ctx} />}
      {on === 'cases' && <Cases v={v} ctx={ctx} />}
      {on === 'jail' && <Jail v={v} ctx={ctx} />}
      {on === 'customs' && <Customs v={v} ctx={ctx} />}
      {on === 'shadow' && <Shadow v={v} ctx={ctx} />}
    </Page>
  )
})

