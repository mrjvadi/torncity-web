// The cases of the law screen (ADR 0078 3.4 to 3.7): the list and the page of one case. The evidence with its strength and whether it is proper, the warrant a judge
// signs, the arrest (the custody clock runs), the charge, the defence, the trial and its verdict, the one appeal for each side, and the sentences. Which verbs
// are drawn comes from the server's `may_*` flags; a refusal is the plain refusal page. Calm wording, mechanics only.

import { useState } from 'react'
import type { LawCaseDetail, LawCaseLine, LawEvidenceLine, LawOffenceLine, LawVerdictLine } from '../../api/views.gen'
import { Hint, Lead, Panel, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { atText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { Ask, Choice, NumField, word } from './Polity'
import { Complain, Meter, STATE_TONE, act, banWord, daysText, evidenceWord, hoursText, offenceName, sentenceStatusWord, sentenceWord, sourceWord, stateWord, type LawV } from './lawShared'
import { t } from '../../i18n'

const custodyUntil = (c: LawCaseLine) => c.custody_until ?? null

// -- the list ----------------------------------------------------------------------------------------

function CaseCard({ c, v, ctx }: { c: LawCaseLine; v: LawV; ctx: FlowCtx }) {
  const until = custodyUntil(c)
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{t('lw.case_no', { n: formatNumber(c.no) })}</b><EffectChip tone={STATE_TONE[c.state] ?? 'neutral'}>{stateWord(c.state)}</EffectChip></div>
      <div className="mn-sub">{offenceName(v, c.offence)} – {c.accused.name || t('lw.unknown_person')}</div>
      <div className="vf-line"><span>{t('lw.case_source')}</span><b>{sourceWord(c.source)}</b></div>
      <div className="vf-line"><span>{t('lw.case_strength')}</span><b>{formatNumber(c.strength)}</b></div>
      <Meter value={c.strength} />
      {c.custody && <Note>{until ? t('lw.custody_until', { at: atText(until) }) : t('lw.custody')}</Note>}
      <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'open', { id: c.id })}>{t('lw.case_open')}</ActionButton></div>
    </div>
  )
}

// -- the verdict form --------------------------------------------------------------------------------

function VerdictForm({ d, o, ctx, onClose }: { d: LawCaseDetail; o: LawOffenceLine | undefined; ctx: FlowCtx; onClose: () => void }) {
  const kinds = o?.sentences ?? ['fine', 'jail', 'ban', 'restitution', 'forfeiture', 'caution']
  const [guilty, setGuilty] = useState<'guilty' | 'acquit'>('guilty')
  const [fine, setFine] = useState('')
  const [jail, setJail] = useState('')
  const [ban, setBan] = useState('')
  const [scope, setScope] = useState('market')
  const [rest, setRest] = useState('')
  const [forf, setForf] = useState('')
  const [caution, setCaution] = useState(false)
  const parts = [
    kinds.includes('fine') && Number(fine) > 0 ? `fine:${Number(fine)}` : '',
    kinds.includes('jail') && Number(jail) > 0 ? `jail:${Number(jail)}` : '',
    kinds.includes('ban') && Number(ban) > 0 ? `ban:${scope}:${Number(ban)}` : '',
    kinds.includes('restitution') && Number(rest) > 0 ? `restitution:${Number(rest)}` : '',
    kinds.includes('forfeiture') && Number(forf) > 0 ? `forfeiture:${Number(forf)}` : '',
    kinds.includes('caution') && caution ? 'caution' : '',
  ].filter(Boolean)
  const over = !!o && ((o.max_fine > 0 && Number(fine) > o.max_fine) || (o.max_jail_hours > 0 && Number(jail) > o.max_jail_hours) || (o.max_ban_days > 0 && Number(ban) > o.max_ban_days))
  const ok = guilty === 'acquit' || (parts.length > 0 && !over)
  return (
    <Popup open onClose={onClose} tone="gold" title={t('lw.verdict_title')}
      footer={<ActionButton tone="gold" disabled={ctx.busy || !ok} reason={over ? t('lw.set_over') : !ok ? t('lw.verdict_need') : undefined}
        onClick={() => { onClose(); act(ctx, 'verdict', { id: d.line.id, code: guilty, ...(guilty === 'guilty' ? { items: parts.join(',') } : {}) }) }}>{t('lw.verdict_go')}</ActionButton>}>
      <Hint>{t('lw.verdict_intro', { total: formatNumber(d.total), q: formatNumber(d.quality) })}</Hint>
      <Choice label={t('lw.verdict_label')} value={guilty} onChange={setGuilty} options={[{ key: 'guilty', text: t('lw.guilty') }, { key: 'acquit', text: t('lw.acquit') }]} />
      {guilty === 'guilty' && (
        <>
          {kinds.includes('fine') && <NumField label={t('lw.set_fine')} value={fine} onChange={setFine} hint={o && o.max_fine > 0 ? t('lw.set_max', { n: money(o.max_fine) }) : undefined} />}
          {kinds.includes('jail') && <NumField label={t('lw.set_jail')} value={jail} onChange={setJail} hint={o && o.max_jail_hours > 0 ? t('lw.set_max', { n: hoursText(o.max_jail_hours) }) : undefined} />}
          {kinds.includes('ban') && (
            <>
              <NumField label={t('lw.set_ban')} value={ban} onChange={setBan} hint={o && o.max_ban_days > 0 ? t('lw.set_max', { n: daysText(o.max_ban_days) }) : undefined} />
              <Choice label={t('lw.ban_scope')} value={scope} onChange={setScope} options={['market', 'office'].map((k) => ({ key: k, text: banWord(k) }))} />
            </>
          )}
          {kinds.includes('restitution') && <NumField label={t('lw.s_rest')} value={rest} onChange={setRest} hint={t('lw.rest_hint')} />}
          {kinds.includes('forfeiture') && <NumField label={t('lw.s_forf')} value={forf} onChange={setForf} hint={t('lw.forf_hint')} />}
          {kinds.includes('caution') && <Choice label={t('lw.s_caution')} value={caution ? 'yes' : 'no'} onChange={(k) => setCaution(k === 'yes')} options={[{ key: 'no', text: t('lw.no') }, { key: 'yes', text: t('lw.yes') }]} />}
          <Hint>{t('lw.verdict_limit')}</Hint>
        </>
      )}
      {guilty === 'acquit' && <Hint>{t('lw.acquit_hint')}</Hint>}
    </Popup>
  )
}

// -- the page of one case ----------------------------------------------------------------------------

function Evidence({ e, d, ctx }: { e: LawEvidenceLine; d: LawCaseDetail; ctx: FlowCtx }) {
  const may = d.may_defend || d.may_appeal_as === 'accused'
  return (
    <div className={`mn-card${e.excluded ? ' lw-gone' : ''}`}>
      <div className="mn-head"><b>{evidenceWord(e.kind)}</b>
        {e.excluded ? <EffectChip tone="neutral">{t('lw.ev_excluded')}</EffectChip> : <EffectChip tone={e.proper ? 'good' : 'warn'}>{e.proper ? t('lw.ev_proper') : t('lw.ev_improper')}</EffectChip>}
      </div>
      <div className="vf-line"><span>{t('lw.ev_strength')}</span><b>{formatNumber(e.strength)}</b></div>
      <Meter value={e.strength} />
      {!e.proper && !e.excluded && <Hint>{t('lw.ev_improper_hint')}</Hint>}
      {!e.proper && !e.excluded && may && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'exclude', { id: e.id })}>{t('lw.ev_exclude')}</ActionButton></div>}
    </div>
  )
}

function Verdict({ x }: { x: LawVerdictLine }) {
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{x.instance > 1 ? t('lw.v_appeal') : t('lw.v_first')}</b><EffectChip tone={x.guilty ? 'bad' : 'good'}>{x.guilty ? t('lw.guilty') : t('lw.acquit')}</EffectChip></div>
      <div className="mn-sub">{x.npc ? t('lw.v_npc') : t('lw.v_player')} – {x.defence ? t('lw.v_defence') : t('lw.v_no_defence')}</div>
      <div className="vf-line"><span>{t('lw.v_weight')}</span><b>{t('lw.v_weight_n', { eff: formatNumber(x.effective), total: formatNumber(x.total) })}</b></div>
      <div className="vf-line"><span>{t('lw.v_quality')}</span><b>{formatNumber(x.quality)}</b></div>
      {x.at && <div className="mn-sub">{atText(x.at)}</div>}
    </div>
  )
}

function CaseDetail({ d, v, ctx }: { d: LawCaseDetail; v: LawV; ctx: FlowCtx }) {
  const c = d.line
  const o = (v.offences ?? []).find((x) => x.code === c.offence.code)
  const [form, setForm] = useState<'verdict' | 'defend' | 'appeal' | 'decide' | 'charge' | 'drop' | 'arrest' | null>(null)
  const [kind, setKind] = useState<'self' | 'npc'>('self')
  const until = custodyUntil(c)
  const may = d.may_investigate || d.may_ask_warrant || d.may_arrest || d.may_charge || d.may_drop || d.may_defend || d.may_verdict || d.may_appeal || d.may_decide
  const warrants = d.warrants ?? []
  const sentences = d.sentences ?? []
  return (
    <>
      <Panel>
        <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'open')}>{t('lw.case_back')}</ActionButton></div>
        <div className="mn-head"><b>{t('lw.case_no', { n: formatNumber(c.no) })}</b><EffectChip tone={STATE_TONE[c.state] ?? 'neutral'}>{stateWord(c.state)}</EffectChip></div>
        <div className="vf-list">
          <div className="vf-line"><span>{t('lw.offence')}</span><b>{offenceName(v, c.offence)}</b></div>
          <div className="vf-line"><span>{t('lw.accused')}</span><b>{c.accused.name || t('lw.unknown_person')}</b></div>
          <div className="vf-line"><span>{t('lw.case_source')}</span><b>{sourceWord(c.source)}</b></div>
          <div className="vf-line"><span>{t('lw.model_label')}</span><b>{word(`lw.model.${d.model}`) || t('lw.other')}</b></div>
          {c.at && <div className="vf-line"><span>{t('lw.opened')}</span><b>{atText(c.at)}</b></div>}
        </div>
        <Hint>{word(`lw.state_hint.${c.state}`)}</Hint>
        {c.custody && <Note>{until ? t('lw.custody_until', { at: atText(until) }) : t('lw.custody')}</Note>}
      </Panel>

      <SectionTitle>{t('lw.evidence')}</SectionTitle>
      <Panel>
        <div className="vf-line"><span>{t('lw.ev_total')}</span><b>{formatNumber(d.total)}</b></div>
        <div className="vf-line"><span>{t('lw.ev_quality')}</span><b>{formatNumber(d.quality)}</b></div>
        <Meter value={d.quality} bad={d.quality < 60} />
        <Hint>{t('lw.ev_quality_hint')}</Hint>
        {(d.evidence ?? []).length === 0 && <Lead>{t('lw.ev_none')}</Lead>}
        <div className="mn-list">{(d.evidence ?? []).map((e) => <Evidence key={e.id} e={e} d={d} ctx={ctx} />)}</div>
      </Panel>

      {warrants.length > 0 && (
        <>
          <SectionTitle>{t('lw.warrants')}</SectionTitle>
          <Panel>
            <div className="mn-list">
              {warrants.map((w, i) => (
                <div key={w} className="mn-card">
                  <div className="mn-head"><b>{t('lw.warrant_n', { n: formatNumber(i + 1) })}</b></div>
                  {d.may_sign && (
                    <div className="wk-btns">
                      <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'warrant_sign', { id: w })}>{t('lw.warrant_sign')}</ActionButton>
                      <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'warrant_refuse', { id: w })}>{t('lw.warrant_refuse')}</ActionButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Hint>{t('lw.warrant_hint')}</Hint>
          </Panel>
        </>
      )}

      {may && (
        <>
          <SectionTitle>{t('lw.next')}</SectionTitle>
          <Panel>
            <div className="wk-btns">
              {d.may_investigate && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => act(ctx, 'investigate', { id: c.id })}>{t('lw.investigate')}</ActionButton>}
              {d.may_ask_warrant && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'warrant_ask', { id: c.id })}>{t('lw.warrant_ask')}</ActionButton>}
              {d.may_arrest && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('arrest')}>{t('lw.arrest')}</ActionButton>}
              {d.may_charge && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('charge')}>{t('lw.charge')}</ActionButton>}
              {d.may_drop && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('drop')}>{t('lw.drop')}</ActionButton>}
              {d.may_defend && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => setForm('defend')}>{t('lw.defend')}</ActionButton>}
              {d.may_verdict && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('verdict')}>{t('lw.verdict')}</ActionButton>}
              {d.may_appeal && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setForm('appeal')}>{t('lw.appeal')}</ActionButton>}
              {d.may_decide && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setForm('decide')}>{t('lw.decide')}</ActionButton>}
            </div>
            {d.may_arrest && <Hint>{t('lw.arrest_hint')}</Hint>}
            {d.may_charge && <Hint>{t('lw.charge_hint')}</Hint>}
            {d.may_appeal && <Hint>{t('lw.appeal_hint')}</Hint>}
          </Panel>
        </>
      )}

      {(d.verdicts ?? []).length > 0 && (
        <>
          <SectionTitle>{t('lw.verdicts')}</SectionTitle>
          <Panel><div className="mn-list">{(d.verdicts ?? []).map((x) => <Verdict key={x.instance} x={x} />)}</div></Panel>
        </>
      )}

      {(d.appeals ?? []).length > 0 && (
        <Panel>
          <div className="vf-list">{(d.appeals ?? []).map((p) => <div key={p} className="vf-line"><span>{t('lw.appeal_by')}</span><b>{word(`lw.party.${p}`) || t('lw.other')}</b></div>)}</div>
        </Panel>
      )}

      {sentences.length > 0 && (
        <>
          <SectionTitle>{t('lw.sentences')}</SectionTitle>
          <Panel>
            <div className="mn-list">
              {sentences.map((s) => (
                <div key={s.id} className="mn-card">
                  <div className="mn-head"><b>{sentenceWord(s.kind)}{s.kind === 'ban' && s.ban ? ` (${banWord(s.ban)})` : ''}</b><EffectChip tone={s.status === 'active' ? 'warn' : 'neutral'}>{sentenceStatusWord(s.status)}</EffectChip></div>
                  <div className="mn-sub">{[s.fine > 0 ? money(s.fine) : '', s.jail_hours > 0 ? hoursText(s.jail_hours) : '', s.ban_days > 0 ? daysText(s.ban_days) : ''].filter(Boolean).join(` $– `)}</div>
                  {s.may_pardon && <div className="wk-btns"><ActionButton tone="steel" small disabled={ctx.busy} onClick={() => act(ctx, 'pardon', { id: s.id })}>{t('lw.pardon')}</ActionButton></div>}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {form === 'verdict' && <VerdictForm d={d} o={o} ctx={ctx} onClose={() => setForm(null)} />}
      {form === 'arrest' && <Ask title={t('lw.arrest_title')} body={t('lw.arrest_body', { name: c.accused.name || t('lw.unknown_person') })} hint={t('lw.arrest_hint')} yes={t('lw.arrest')} onYes={() => act(ctx, 'arrest', { id: c.id })} onClose={() => setForm(null)} />}
      {form === 'charge' && <Ask title={t('lw.charge_title')} body={t('lw.charge_body')} hint={t('lw.charge_hint')} yes={t('lw.charge')} onYes={() => act(ctx, 'charge', { id: c.id })} onClose={() => setForm(null)} />}
      {form === 'drop' && <Ask title={t('lw.drop_title')} body={t('lw.drop_body')} yes={t('lw.drop')} tone="red" onYes={() => act(ctx, 'drop', { id: c.id })} onClose={() => setForm(null)} />}
      {form === 'appeal' && <Ask title={t('lw.appeal_title')} body={t('lw.appeal_body')} hint={t('lw.appeal_hint')} yes={t('lw.appeal')} onYes={() => act(ctx, 'appeal', { id: c.id, kind: d.may_appeal_as || 'accused' })} onClose={() => setForm(null)} />}
      {form === 'defend' && (
        <Popup open onClose={() => setForm(null)} tone="gold" title={t('lw.defend_title')}
          footer={<ActionButton tone="gold" disabled={ctx.busy} onClick={() => { setForm(null); act(ctx, 'defend', { id: c.id, ...(kind === 'npc' ? { kind: 'npc' } : {}) }) }}>{t('lw.defend_go')}</ActionButton>}>
          <Choice label={t('lw.defend_who')} value={kind} onChange={setKind} options={[{ key: 'self', text: t('lw.defend_self') }, { key: 'npc', text: t('lw.defend_npc') }]} />
          <Hint>{kind === 'npc' ? t('lw.defend_npc_hint') : t('lw.defend_self_hint')}</Hint>
        </Popup>
      )}
      {form === 'decide' && (
        <Popup open onClose={() => setForm(null)} tone="gold" title={t('lw.decide_title')}
          footer={<div className="lm-craft-foot">
            <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => { setForm(null); act(ctx, 'appeal_decide', { id: c.id, code: 'confirm' }) }}>{t('lw.decide_confirm')}</ActionButton>
            <ActionButton tone="gold" disabled={ctx.busy} onClick={() => { setForm(null); act(ctx, 'appeal_decide', { id: c.id, code: 'quash' }) }}>{t('lw.decide_quash')}</ActionButton>
          </div>}>
          <Hint>{t('lw.decide_hint')}</Hint>
        </Popup>
      )}
    </>
  )
}

// -- the tab -----------------------------------------------------------------------------------------

export function Cases({ v, ctx }: { v: LawV; ctx: FlowCtx }) {
  const [form, setForm] = useState(false)
  if (v.case) return <CaseDetail d={v.case} v={v} ctx={ctx} />
  const cases = v.cases ?? []
  return (
    <>
      <Panel>
        <Hint>{t('lw.cases_intro')}</Hint>
        {cases.length === 0 && <Lead>{t('lw.cases_none')}</Lead>}
        <div className="mn-list">{cases.map((c) => <CaseCard key={c.id} c={c} v={v} ctx={ctx} />)}</div>
        {v.open.police && <div className="wk-btns"><ActionButton tone="gold" small disabled={ctx.busy || !(v.offences ?? []).some((o) => o.listed)} reason={!(v.offences ?? []).some((o) => o.listed) ? t('lw.complain_none') : undefined} onClick={() => setForm(true)}>{t('lw.complain')}</ActionButton></div>}
      </Panel>
      {form && <Complain v={v} ctx={ctx} onClose={() => setForm(false)} />}
    </>
  )
}
