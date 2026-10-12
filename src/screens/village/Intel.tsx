// «دفتر اطلاعات» (ADR 0077 6): a town that keeps a bureau can engage agents who live in another town, ask them for surveys (reports in BANDS with an age and a
// confidence, never a figure) and, with the research and inside a weekly cap, spoil a thing there. The other town sees acts done to it, puts agents out
// and can vet newcomers. Also here: the parts that live elsewhere (the offer on «من», the vetting rule on the city panel). Facts from the server, words ours.

import { useEffect, useState } from 'react'
import * as api from '../../api/client'
import type { IntelAgentLine, IntelOpLine, IntelReportLine, IntelView, Named } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { PRow } from '../../ui/v6/panel'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber } from '../native/kit/format'
import { sendCmd } from './Mining'
import { Ask, Choice, Closed, NoticeStrip, NumField, word } from './Polity'
import { lacks } from './Project'
import { useToast } from '../../state/ToastContext'
import { noticeText, refusalText, t } from '../../i18n'

registerWrites(['settlement.intel'], (a) => !!a.args?.action)

const act = (ctx: FlowCtx, action: string, args: Record<string, string>) => sendCmd(ctx, 'settlement.intel', { action, ...args })
const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = { offered: 'warn', active: 'good', declined: 'neutral', expelled: 'bad', recalled: 'neutral' }

/** The other towns, for a list to choose from (the view of treaties carries them). */
export function useTowns(): Named[] {
  const [towns, setTowns] = useState<Named[]>([])
  useEffect(() => {
    let on = true
    api.runCommand('settlement.treaty', {}).then((r) => { const l = (r.view as unknown as { targets?: Named[] | null } | undefined)?.targets; if (on && r.ok !== false) setTowns(l ?? []) }).catch(() => undefined)
    return () => { on = false }
  }, [])
  return towns
}

const bandText = (b: string) => word(`gi.band.${b}`) || t('gi.band.unknown')
const metricText = (m: string) => word(`gi.metric.${m}`) || t('gi.metric.unknown')
const opText = (code: string, ops: IntelOpLine[], fallback = '') => word(`gi.op.${code}`, ops.find((o) => o.code === code)?.name ?? fallback) || t('gi.op.unknown')

// -- forms ---------------------------------------------------------------------------------------

function Engage({ ctx, onClose }: { ctx: FlowCtx; onClose: () => void }) {
  const towns = useTowns()
  const [player, setPlayer] = useState('')
  const [to, setTo] = useState('')
  const ok = player.trim().length > 0 && !!to
  return (
    <Popup open onClose={onClose} tone="gold" title={t('gi.engage_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={ok ? undefined : t('gi.engage_need')} onClick={() => { onClose(); act(ctx, 'engage', { player: player.trim(), code: to }) }}>{t('gi.engage_go')}</ActionButton>}>
      <label className="tc-f"><span>{t('gi.player')}</span>
        <input className="fx-field-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value)} aria-label={t('gi.player')} />
        <small className="pu-hint">{t('gi.player_hint')}</small>
      </label>
      <Choice label={t('gi.target')} value={to} onChange={setTo} options={towns.map((x) => ({ key: x.code, text: x.name }))} />
      {towns.length === 0 && <Hint>{t('gi.no_towns')}</Hint>}
      <Hint>{t('gi.engage_hint')}</Hint>
    </Popup>
  )
}

function Survey({ v, agents, ctx, onClose }: { v: IntelView; agents: IntelAgentLine[]; ctx: FlowCtx; onClose: () => void }) {
  const ops = (v.ops ?? []).filter((o) => o.kind === 'survey')
  const [agent, setAgent] = useState(agents[0]?.id ?? '')
  const [op, setOp] = useState((ops.find((o) => o.available) ?? ops[0])?.code ?? '')
  const sel = ops.find((o) => o.code === op)
  const ok = !!agent && !!sel?.available
  return (
    <Popup open onClose={onClose} tone="gold" title={t('gi.survey_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={sel && !sel.available ? t('gi.op_missing', { list: lacks(ctx, sel.missing) || t('pj.kind_missing_any') }) : undefined} onClick={() => { onClose(); act(ctx, 'op', { id: agent, code: op }) }}>{t('gi.survey_go')}</ActionButton>}>
      {agents.length > 1 && <Choice label={t('gi.agent')} value={agent} onChange={setAgent} options={agents.map((a) => ({ key: a.id, text: `${a.player.name} (${a.target.name})` }))} />}
      <Choice label={t('gi.op')} value={op} onChange={setOp} options={ops.map((o) => ({ key: o.code, text: opText(o.code, ops, o.name) }))} />
      {sel && !sel.available && <Note>{t('gi.op_missing', { list: lacks(ctx, sel.missing) || t('pj.kind_missing_any') })}</Note>}
      <Hint>{t('gi.survey_hint')}</Hint>
    </Popup>
  )
}

function Spoil({ v, agents, ctx, onClose }: { v: IntelView; agents: IntelAgentLine[]; ctx: FlowCtx; onClose: () => void }) {
  const ops = (v.ops ?? []).filter((o) => o.kind === 'sabotage')
  const [agent, setAgent] = useState(agents[0]?.id ?? '')
  const [op, setOp] = useState((ops.find((o) => o.available) ?? ops[0])?.code ?? '')
  const [ref, setRef] = useState('')
  const [sure, setSure] = useState(false)
  const sel = ops.find((o) => o.code === op)
  const ok = !!agent && !!sel?.available && ref.trim().length > 0
  return (
    <Popup open onClose={onClose} tone="red" title={t('gi.spoil_title')}
      footer={<ActionButton tone="red" disabled={ctx.busy || !ok || !sure} reason={!sure ? t('gi.spoil_tick') : !ref.trim() ? t('gi.spoil_ref_need') : undefined} onClick={() => { onClose(); act(ctx, 'sabotage', { id: agent, code: op, ref: ref.trim() }) }}>{t('gi.spoil_go')}</ActionButton>}>
      <Note>{t('gi.spoil_calm')}</Note>
      {agents.length > 1 && <Choice label={t('gi.agent')} value={agent} onChange={setAgent} options={agents.map((a) => ({ key: a.id, text: `${a.player.name} (${a.target.name})` }))} />}
      <Choice label={t('gi.spoil_kind')} value={op} onChange={setOp} options={ops.map((o) => ({ key: o.code, text: opText(o.code, ops, o.name) }))} />
      {sel && <Hint>{word(`gi.spoil_what.${sel.code}`)}</Hint>}
      {sel && !sel.available && <Note>{t('gi.op_missing', { list: lacks(ctx, sel.missing) || t('pj.kind_missing_any') })}</Note>}
      <label className="tc-f"><span>{t('gi.spoil_ref')}</span>
        <input className="fx-field-input" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} aria-label={t('gi.spoil_ref')} />
        <small className="pu-hint">{t('gi.spoil_ref_hint')}</small>
      </label>
      <Choice label={t('gi.spoil_sure_label')} value={sure ? 'yes' : 'no'} onChange={(k) => setSure(k === 'yes')} options={[{ key: 'no', text: t('gi.spoil_not_yet') }, { key: 'yes', text: t('gi.spoil_sure') }]} />
      <Hint>{t('gi.spoil_cap')}</Hint>
    </Popup>
  )
}

function Share({ r, ctx, onClose }: { r: IntelReportLine; ctx: FlowCtx; onClose: () => void }) {
  const towns = useTowns()
  const [to, setTo] = useState('')
  return (
    <Popup open onClose={onClose} tone="gold" title={t('gi.share_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !to} onClick={() => { onClose(); act(ctx, 'share', { id: r.id, code: to }) }}>{t('gi.share_go')}</ActionButton>}>
      <Choice label={t('gi.share_to')} value={to} onChange={setTo} options={towns.map((x) => ({ key: x.code, text: x.name }))} />
      <Hint>{t('gi.share_hint')}</Hint>
    </Popup>
  )
}

function Vetting({ v, ctx }: { v: IntelView; ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  const [n, setN] = useState(String(v.vetting_days))
  return (
    <>
      <div className="vf-line"><span>{t('gi.vet_label')}</span><b>{v.vetting_days > 0 ? t('gi.vet_days', { n: formatNumber(v.vetting_days) }) : t('gi.vet_none')}</b></div>
      {v.may_vet && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setOpen(true)}>{t('gi.vet_change')}</ActionButton></div>}
      {open && (
        <Popup open onClose={() => setOpen(false)} tone="gold" title={t('gi.vet_title')}
          footer={<ActionButton tone="gold" disabled={ctx.busy || n === '' || Number(n) > 60} reason={Number(n) > 60 ? t('gi.vet_max') : undefined} onClick={() => { setOpen(false); act(ctx, 'vet', { n }) }}>{t('gi.vet_go')}</ActionButton>}>
          <NumField label={t('gi.vet_field')} value={n} onChange={setN} hint={t('gi.vet_field_hint')} />
        </Popup>
      )}
    </>
  )
}

// -- cards ---------------------------------------------------------------------------------------

function Offer({ o, ctx }: { o: IntelAgentLine; ctx: FlowCtx }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('gi.offer_line', { sponsor: o.sponsor.name, target: o.target.name })}</b><EffectChip tone="warn">{t('gi.offer')}</EffectChip></div>
      <div className="mn-sub">{t('gi.offer_cover')}</div>
      <div className="wk-btns">
        <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'accept', { id: o.id })}>{t('gi.accept')}</ActionButton>
        <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'refuse', { id: o.id })}>{t('gi.refuse')}</ActionButton>
      </div>
    </div>
  )
}

function Report({ r, ctx, ops }: { r: IntelReportLine; ctx: FlowCtx; ops: IntelOpLine[] }) {
  const [share, setShare] = useState(false)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('gi.report_of', { target: r.target.name })}</b><EffectChip tone={r.confidence === 'high' ? 'good' : r.confidence === 'low' ? 'warn' : 'neutral'}>{t('gi.confidence', { c: word(`gi.conf.${r.confidence}`) || t('gi.conf.medium') })}</EffectChip></div>
      <div className="mn-sub">{opText(r.op, ops)} – {r.taken_at ? t('gi.taken', { at: atText(r.taken_at) }) : ''}{r.old ? ` – ${t('gi.old')}` : ''}</div>
      {r.old && <Note>{t('gi.old_hint')}</Note>}
      <div className="vf-list">
        {(r.fields ?? []).map((f) => <div key={f.metric} className="vf-line"><span>{metricText(f.metric)}</span><b>{bandText(f.band)}</b></div>)}
      </div>
      {r.shared && <Hint>{t('gi.shared')}</Hint>}
      {r.may_share && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setShare(true)}>{t('gi.share')}</ActionButton></div>}
      {share && <Share r={r} ctx={ctx} onClose={() => setShare(false)} />}
    </div>
  )
}

function Agent({ a, ctx }: { a: IntelAgentLine; ctx: FlowCtx }) {
  const [ask, setAsk] = useState(false)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{a.mine ? t('gi.agent_me', { target: a.target.name }) : t('gi.agent_line', { who: a.player.name, target: a.target.name })}</b><EffectChip tone={STATUS_TONE[a.status] ?? 'neutral'}>{word(`gi.status.${a.status}`)}</EffectChip></div>
      {a.mine && <div className="mn-sub">{t('gi.agent_for', { sponsor: a.sponsor.name })}</div>}
      {a.status === 'active' && <div className="mn-sub">{t('gi.cover', { n: formatNumber(a.cover_days) })} – {t('gi.ops_today', { n: formatNumber(a.ops_today) })}</div>}
      {a.may_recall && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsk(true)}>{t('gi.recall')}</ActionButton></div>}
      {ask && <Ask title={t('gi.recall_title')} body={t('gi.recall_body', { who: a.player.name })} hint={t('gi.recall_hint')} yes={t('gi.recall')} onYes={() => act(ctx, 'recall', { id: a.id })} onClose={() => setAsk(false)} />}
    </div>
  )
}

// -- the screen ----------------------------------------------------------------------------------

export const Intel = flow<IntelView>(({ view: v, ctx }) => {
  const [form, setForm] = useState<'engage' | 'survey' | 'spoil' | null>(null)
  if (!v.open) return <Page title={t('gi.title')} tone="sapphire"><Closed text={t('gi.off')} hint={t('sp.off_hint')} /></Page>
  const agents = v.agents ?? []
  const active = agents.filter((a) => a.status === 'active' && a.may_operate)
  const mine = agents.filter((a) => a.mine)
  const ours = agents.filter((a) => !a.mine)
  const ops = v.ops ?? []
  const hasSpoil = ops.some((o) => o.kind === 'sabotage')
  return (
    <Page title={t('gi.title')} tone="sapphire">
      <NoticeStrip prefix="gi.notice" code={v.notice} />
      <Panel>
        <Hint>{t('gi.intro')}</Hint>
        <div className="mn-head"><b>{t('gi.bureau')}</b><EffectChip tone={v.bureau_open ? 'good' : v.bureau_built ? 'warn' : 'neutral'}>{v.bureau_open ? t('gi.bureau_open') : v.bureau_built ? t('gi.bureau_closed') : t('gi.bureau_none')}</EffectChip></div>
        {!v.bureau_built && <Hint>{t('gi.bureau_none_hint')}</Hint>}
        {v.bureau_built && !v.bureau_open && <Hint>{t('gi.bureau_closed_hint')}</Hint>}
        <div className="vf-line"><span>{t('gi.counter_label')}</span><b>{word(`gi.counter.${v.counter}`) || t('gi.counter.none')}</b></div>
        <Vetting v={v} ctx={ctx} />
      </Panel>

      {(v.offers ?? []).length > 0 && (
        <>
          <SectionTitle>{t('gi.offers')}</SectionTitle>
          <Panel><div className="mn-list">{(v.offers ?? []).map((o) => <Offer key={o.id} o={o} ctx={ctx} />)}</div></Panel>
        </>
      )}

      {mine.length > 0 && (
        <>
          <SectionTitle>{t('gi.mine')}</SectionTitle>
          <Panel><div className="mn-list">{mine.map((a) => <Agent key={a.id} a={a} ctx={ctx} />)}</div></Panel>
        </>
      )}

      {(v.may_run || ours.length > 0) && (
        <>
          <SectionTitle>{t('gi.agents')}</SectionTitle>
          <Panel>
            {ours.length === 0 && <Lead>{t('gi.agents_none')}</Lead>}
            <div className="mn-list">{ours.map((a) => <Agent key={a.id} a={a} ctx={ctx} />)}</div>
            <div className="wk-btns">
              {v.may_run && <ActionButton tone="gold" small disabled={ctx.busy || !v.bureau_built} reason={!v.bureau_built ? t('gi.bureau_none_hint') : undefined} onClick={() => setForm('engage')}>{t('gi.engage')}</ActionButton>}
              {v.may_run && active.length > 0 && <ActionButton tone="green" small disabled={ctx.busy || !v.bureau_open} reason={!v.bureau_open ? t('gi.bureau_closed_hint') : undefined} onClick={() => setForm('survey')}>{t('gi.survey')}</ActionButton>}
            </div>
            {v.may_run && ours.length > 0 && active.length === 0 && <Hint>{t('gi.wait_agent')}</Hint>}
          </Panel>
        </>
      )}

      {v.may_read && (
        <>
          <SectionTitle>{t('gi.reports')}</SectionTitle>
          <Panel>
            <Hint>{t('gi.reports_hint')}</Hint>
            {(v.reports ?? []).length === 0 && <Lead>{t('gi.reports_none')}</Lead>}
            <div className="mn-list">{(v.reports ?? []).map((r) => <Report key={r.id} r={r} ctx={ctx} ops={ops} />)}</div>
          </Panel>
        </>
      )}

      {v.may_run && hasSpoil && (
        <>
          <SectionTitle>{t('gi.spoil')}</SectionTitle>
          <Panel>
            {!v.sabotage_open ? <Hint>{t('gi.spoil_off')}</Hint> : (
              <>
                <Hint>{t('gi.spoil_intro')}</Hint>
                <div className="wk-btns"><ActionButton tone="red" small disabled={ctx.busy || active.length === 0 || !v.bureau_open} reason={active.length === 0 ? t('gi.wait_agent') : !v.bureau_open ? t('gi.bureau_closed_hint') : undefined} onClick={() => setForm('spoil')}>{t('gi.spoil_btn')}</ActionButton></div>
              </>
            )}
          </Panel>
        </>
      )}

      {((v.acts ?? []).length > 0 || (v.expelled ?? []).length > 0) && (
        <>
          <SectionTitle>{t('gi.watch')}</SectionTitle>
          <Panel>
            <div className="mn-list">
              {(v.acts ?? []).map((a, i) => (
                <div key={`a${i}`} className="mn-card">
                  <b>{a.by_us ? t('gi.act_by_us', { kind: word(`gi.act.${a.kind}`) || t('gi.act.other'), target: a.target.name }) : t('gi.act_to_us', { kind: word(`gi.act.${a.kind}`) || t('gi.act.other'), sponsor: a.sponsor?.name ?? t('gi.unknown_hand') })}{a.repaired ? ` (${t('gi.repaired')})` : ''}</b>
                  {a.at && <div className="mn-sub">{atText(a.at)}</div>}
                </div>
              ))}
              {(v.expelled ?? []).map((e, i) => (
                <div key={`e${i}`} className="mn-card">
                  <b>{e.sponsor ? t('gi.expelled_known', { sponsor: e.sponsor.name }) : t('gi.expelled')}</b>
                  {e.until && <div className="mn-sub">{t('gi.until', { at: atText(e.until) })}</div>}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {form === 'engage' && <Engage ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'survey' && <Survey v={v} agents={active} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'spoil' && <Spoil v={v} agents={active} ctx={ctx} onClose={() => setForm(null)} />}
    </Page>
  )
})

// -- parts that live elsewhere -------------------------------------------------------------------

/** «من»: an offer of work from another town, to accept or refuse, and the cover the player is living now. */
export function IntelMine({ run }: { run: (command: string, args?: Record<string, string>) => void }) {
  const [v, setV] = useState<IntelView | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  useEffect(() => {
    let on = true
    api.runCommand('settlement.intel', {}).then((r) => { if (on && r.ok !== false) setV(r.view as unknown as IntelView) }).catch(() => undefined)
    return () => { on = false }
  }, [])
  const answer = async (action: 'accept' | 'refuse', id: string) => {
    setBusy(true)
    try {
      const r = await api.runCommand('settlement.intel', { action, id }, `web-intel-${Date.now().toString(36)}`)
      if (r.ok === false) toast.push(refusalText(r.error?.code, r.error?.message, r.error?.args), { kind: 'error' })
      else { setV(r.view as unknown as IntelView); const n = r.notice ? noticeText(r.notice) : ''; if (n) toast.push(n, { kind: 'success', user: true }) }
    } catch (e) {
      toast.push(refusalText((e as { code?: string })?.code ?? 'network'), { kind: 'error' })
    } finally { setBusy(false) }
  }
  if (!v || !v.open) return null
  const offers = v.offers ?? []
  const living = (v.agents ?? []).filter((a) => a.mine && a.status === 'active')
  if (offers.length === 0 && living.length === 0) return null
  return (
    <>
      {offers.map((o) => (
        <div key={o.id} className="mn-card pj-me">
          <div className="mn-head"><b>{t('gi.offer_line', { sponsor: o.sponsor.name, target: o.target.name })}</b><EffectChip tone="warn">{t('gi.offer')}</EffectChip></div>
          <div className="mn-sub">{t('gi.offer_cover')}</div>
          <div className="wk-btns">
            <ActionButton tone="green" small disabled={busy} onClick={() => void answer('accept', o.id)}>{t('gi.accept')}</ActionButton>
            <ActionButton tone="steel" small disabled={busy} onClick={() => void answer('refuse', o.id)}>{t('gi.refuse')}</ActionButton>
          </div>
        </div>
      ))}
      {living.map((a) => <PRow key={a.id} icon="person" title={t('gi.agent_me', { target: a.target.name })} sub={t('gi.cover', { n: formatNumber(a.cover_days) })} onClick={() => run('settlement.intel')} />)}
    </>
  )
}

/** The city panel: how this town looks at newcomers (the vetting rule), for everyone to read and for a holder to change. */
export function VettingRule({ run }: { run: (command: string, args?: Record<string, string>) => void }) {
  const [v, setV] = useState<IntelView | null>(null)
  useEffect(() => {
    let on = true
    api.runCommand('settlement.intel', {}).then((r) => { if (on && r.ok !== false) setV(r.view as unknown as IntelView) }).catch(() => undefined)
    return () => { on = false }
  }, [])
  if (!v || !v.open) return null
  return (
    <button type="button" className="sv-line" onClick={() => run('settlement.intel')}>
      <b>{t('gi.vet_label')}</b>
      <span>{v.vetting_days > 0 ? t('gi.vet_days', { n: formatNumber(v.vetting_days) }) : t('gi.vet_none')}</span>
      <span>{word(`gi.counter.${v.counter}`) || t('gi.counter.none')}</span>
    </button>
  )
}
