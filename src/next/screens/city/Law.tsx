// «قانون و دادگاه» (`settlement.law` -> `settlement_law`): the town's law in the new design. Tabs: the town's law (its
// four services and how each stands today, the way it tries a case, the patrol day, the offences its charter can list,
// each opening to its limits), the cases (each with its path from open to final and the strength of its evidence; one
// case opens to its evidence and the verbs the server allows), the lock-up (my sentences, bail) and customs (my loads).
// One command with an `action` verb, like the server's; the answer replaces the screen's view in place. Facts from the
// server, words ours; a code the web has no word for reads as a plain «دیگر».

import { useEffect, useState } from 'react'
import type { NScreenProps } from '../../registry'
import type { CommandResponse } from '../../../api/types'
import type { LawCaseDetail, LawCaseLine, LawOffenceLine, LawPostLine, LawSentenceLine, LawLoadLine, LawView, Named } from '../../../api/views.gen'
import { Button, Buttons, Card, Chip, Confirm, Empty, Icon, KV, Loading, Meter, Note, Page, Section, Segmented, Sheet, Steps } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { atText } from '../../../lib/duration'
import { useContentNames } from '../../../village/useVillage'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { word } from './shared'
import './city.css'

type Tab = 'law' | 'cases' | 'jail' | 'customs'
type Send = (action: string, args?: Record<string, string>) => void
type Tone = 'accent' | 'cyan' | 'ok' | 'warn' | 'bad' | undefined

const other = (key: string) => word(key) || t('lw.other')
const hours = (n: number) => t('time.h', { n: formatNumber(n) })
const days = (n: number) => t('time.d', { n: formatNumber(n) })
const person = (n: Named) => n.name || t('lw.unknown_person')

const SERVICE_ICON: Record<string, string> = { constabulary: 'shield', court: 'gavel', custody: 'handcuffs', customs: 'tag' }
const SEVERITY: Record<string, number> = { petty: 1, serious: 2, grave: 3, mature: 3 }
const STATE_TONE: Record<string, Tone> = { open: 'cyan', charged: 'warn', hearing: 'warn', decided: 'cyan', appealed: 'warn', final: undefined, dropped: undefined, lapsed: undefined }
/** The path of a case; an appeal waits at the verdict. */
const PATH = ['open', 'charged', 'hearing', 'decided', 'final']
const stepOf = (state: string) => (state === 'appealed' ? 3 : PATH.indexOf(state))

// -- small parts -------------------------------------------------------------------------------------

function Dots({ n }: { n: number }) {
  return <span className="n-city-dots" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
}

function PathOf({ state }: { state: string }) {
  const at = stepOf(state)
  if (at < 0) return null
  return <Steps steps={PATH.map((s) => other(`lw.state.${s}`))} at={at} />
}

/** One of the town's four services: built or not, open today or not, the lock-up's cells. */
function Post({ p }: { p: LawPostLine }) {
  const tone: Tone = !p.stands ? undefined : p.open ? 'ok' : 'warn'
  return (
    <div className={`n-city-post${p.stands ? '' : ' off'}`}>
      <Icon name={SERVICE_ICON[p.service] ?? 'eye'} className="n-city-post-ic" />
      <b>{other(`lw.service.${p.service}`)}</b>
      <Chip tone={tone}>{!p.stands ? t('lw.post_none') : p.open ? t('lw.post_open') : t('lw.post_idle')}</Chip>
      {p.stands && p.service === 'custody' && p.cells > 0 && <small>{t('lw.cells_n', { held: formatNumber(p.held), n: formatNumber(p.cells) })}</small>}
    </div>
  )
}

/** A pick list of people: chips when few, a search box above when many. */
function PickName({ items, value, onChange }: { items: Named[]; value: string; onChange: (code: string) => void }) {
  const [q, setQ] = useState('')
  if (items.length === 0) return <p className="n-city-quiet">{t('lw.pick_none')}</p>
  const many = items.length > 8
  const shown = many && q.trim() ? items.filter((x) => x.name.includes(q.trim())) : items
  return (
    <>
      {many && <input className="n-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('lw.pick_search')} aria-label={t('lw.pick_search')} />}
      <div className={`n-city-pick${many ? ' many' : ''}`} role="radiogroup" aria-label={t('lw.player')}>
        {shown.map((x) => <button key={x.code} type="button" role="radio" aria-checked={value === x.code} onClick={() => onChange(x.code)}>{person(x)}</button>)}
        {shown.length === 0 && <p className="n-city-quiet">{t('lw.pick_nomatch')}</p>}
      </div>
    </>
  )
}

/** The complaint: an offence the town lists and a resident picked by name. */
function Complain({ v, offence, send, onClose }: { v: LawView; offence?: string; send: Send; onClose: () => void }) {
  const listed = (v.offences ?? []).filter((o) => o.listed)
  const [code, setCode] = useState(offence ?? listed[0]?.code ?? '')
  const [player, setPlayer] = useState('')
  const ok = !!code && !!player
  return (
    <Sheet title={t('lw.complain_title')} icon="gavel" onClose={onClose}>
      <div className="n-field">
        <span>{t('lw.offence')}</span>
        <div className="n-city-pick" role="radiogroup" aria-label={t('lw.offence')}>
          {listed.map((o) => <button key={o.code} type="button" role="radio" aria-checked={code === o.code} onClick={() => setCode(o.code)}>{o.name || t('lw.other')}</button>)}
        </div>
      </div>
      <div className="n-field"><span>{t('lw.player')}</span><PickName items={v.people ?? []} value={player} onChange={setPlayer} /></div>
      <Note tone="info">{t('lw.complain_hint')}</Note>
      <Button block disabled={!ok} reason={t('lw.complain_need')} onClick={() => { onClose(); send('complain', { code, player }) }}>{t('lw.complain_go')}</Button>
    </Sheet>
  )
}

// -- the town's law ----------------------------------------------------------------------------------

function Offence({ o, v, open, onToggle, send, onComplain }: { o: LawOffenceLine; v: LawView; open: boolean; onToggle: () => void; send: Send; onComplain: () => void }) {
  const [ask, setAsk] = useState<'set' | 'unset' | null>(null)
  const waiting = o.listed && !!o.effective_at && Date.parse(o.effective_at) > Date.now()
  const tone: Tone = o.listed ? (waiting ? 'warn' : 'ok') : undefined
  const status = o.listed ? (waiting ? t('lw.listed_wait') : t('lw.listed')) : t('lw.not_listed')
  return (
    <div className={`n-city-off${open ? ' open' : ''}`}>
      <button className="n-city-off-head" aria-expanded={open} onClick={onToggle}>
        <span className="n-city-off-name">
          <b>{o.name || t('lw.other')}</b>
          <small><Dots n={SEVERITY[o.class] ?? 1} />{other(`lw.class.${o.class}`)}</small>
        </span>
        <Chip tone={tone}>{status}</Chip>
        <svg className="n-city-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="n-city-off-body">
          {(o.sentences ?? []).length > 0 && <div className="n-chips">{(o.sentences ?? []).map((k) => <Chip key={k}>{other(`lw.sent.${k}`)}</Chip>)}</div>}
          {o.max_fine > 0 && <KV label={t('lw.max_fine')} value={money(o.max_fine)} />}
          {o.max_jail_hours > 0 && <KV label={t('lw.max_jail')} value={hours(o.max_jail_hours)} />}
          {o.max_ban_days > 0 && <KV label={t('lw.max_ban')} value={days(o.max_ban_days)} />}
          {waiting && o.effective_at && <Note tone="info" icon="clock">{t('lw.grace', { at: atText(o.effective_at) })}</Note>}
          {!o.available && <p className="n-city-quiet">{t('lw.not_here')}</p>}
          {(v.mays.set || (o.listed && !waiting && v.open.police)) && (
            <Buttons>
              {o.listed && !waiting && v.open.police && <Button kind="cyan" small onClick={onComplain}>{t('lw.complain')}</Button>}
              {v.mays.set && o.available && !o.listed && <Button kind="ghost" small onClick={() => setAsk('set')}>{t('lw.set')}</Button>}
              {v.mays.set && o.listed && <Button kind="ghost" small onClick={() => setAsk('unset')}>{t('lw.unset')}</Button>}
            </Buttons>
          )}
        </div>
      )}
      {ask === 'set' && (
        <Confirm title={t('lw.set_title', { name: o.name })} icon="gavel" confirm={t('lw.set_go')} onConfirm={() => { setAsk(null); send('offence', { code: o.code }) }} onClose={() => setAsk(null)}>
          <p className="n-text">{t('lw.set_grace')}</p>
        </Confirm>
      )}
      {ask === 'unset' && (
        <Confirm title={t('lw.unset_title', { name: o.name })} icon="gavel" danger confirm={t('lw.unset')} onConfirm={() => { setAsk(null); send('offence_unset', { code: o.code }) }} onClose={() => setAsk(null)}>
          <p className="n-text">{t('lw.unset_body')}</p>
        </Confirm>
      )}
    </div>
  )
}

function LawTab({ v, send, onComplain }: { v: LawView; send: Send; onComplain: (code?: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const posts = v.posts ?? []
  const offences = v.offences ?? []
  const constab = posts.find((p) => p.service === 'constabulary')
  return (
    <>
      <Section title={t('n.city.law.services')} />
      {posts.length > 0 && <div className="n-city-grid">{posts.map((p) => <Post key={p.service} p={p} />)}</div>}
      <div className="n-rows">
        <KV label={t('lw.model_label')} value={other(`lw.model.${v.model}`)} />
      </div>
      {v.captured && <Note tone="bad" icon="x_wanted">{t('lw.captured')}</Note>}
      {v.mays.patrol && (
        <Card>
          <Meter frac={v.points > 0 ? v.spent / v.points : 0} tone={v.points > 0 && v.spent >= v.points ? 'bad' : 'cyan'} label={t('lw.points')} value={t('lw.points_n', { spent: formatNumber(v.spent), n: formatNumber(v.points) })} />
          <div className="n-city-card-foot">
            <span className="n-label">{t('lw.patrols')}: <b>{formatNumber(v.patrol)}</b></span>
            <Button kind="cyan" small disabled={!constab?.open || v.spent >= v.points} onClick={() => send('patrol')}>{t('lw.patrol')}</Button>
          </div>
          {(!constab?.open || v.spent >= v.points) && <p className="n-city-quiet">{!constab?.open ? t('lw.post_idle_hint') : t('lw.no_points')}</p>}
        </Card>
      )}

      <Section title={t('lw.offences')} note={offences.length ? t('city.dim.of', { load: formatNumber(offences.filter((o) => o.listed).length), cap: formatNumber(offences.length) }) : undefined} />
      <p className="n-city-quiet">{v.mays.set ? t('lw.offences_hint_holder') : t('lw.offences_hint')}</p>
      {offences.length === 0 ? <Empty icon="gavel">{t('lw.offences_none')}</Empty> : (
        <div className="n-city-offs">
          {offences.map((o) => <Offence key={o.code} o={o} v={v} open={open === o.code} onToggle={() => setOpen(open === o.code ? null : o.code)} send={send} onComplain={() => onComplain(o.code)} />)}
        </div>
      )}
    </>
  )
}

// -- the cases ---------------------------------------------------------------------------------------

function CaseCard({ c, v, onOpen }: { c: LawCaseLine; v: LawView; onOpen: () => void }) {
  const offence = (v.offences ?? []).find((x) => x.code === c.offence.code)?.name || c.offence.name || t('lw.other')
  return (
    <button className="n-card n-city-case" onClick={onOpen}>
      <span className="n-city-case-head">
        <b>{t('lw.case_no', { n: formatNumber(c.no) })}</b>
        <Chip tone={STATE_TONE[c.state]}>{other(`lw.state.${c.state}`)}</Chip>
      </span>
      <span className="n-city-case-sub">{offence} – {person(c.accused)} – {other(`lw.source.${c.source}`)}</span>
      <PathOf state={c.state} />
      <Meter frac={c.strength / 100} tone={c.strength >= 70 ? 'accent' : 'cyan'} label={t('lw.case_strength')} value={formatNumber(c.strength)} />
      {c.custody && <span className="n-city-case-note">{c.custody_until ? t('lw.custody_until', { at: atText(c.custody_until) }) : t('lw.custody')}</span>}
    </button>
  )
}

function Verdict({ d, v, send, onClose }: { d: LawCaseDetail; v: LawView; send: Send; onClose: () => void }) {
  const o = (v.offences ?? []).find((x) => x.code === d.line.offence.code)
  const [guilty, setGuilty] = useState<'guilty' | 'acquit'>('guilty')
  const [fine, setFine] = useState('')
  const n = Number(fine.replace(/[۰-۹]/g, (x) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))))
  const over = !!o && o.max_fine > 0 && n > o.max_fine
  const ok = guilty === 'acquit' || (n > 0 && !over)
  return (
    <Sheet title={t('lw.verdict_title')} icon="gavel" onClose={onClose}>
      <p className="n-text">{t('lw.verdict_intro', { total: formatNumber(d.total), q: formatNumber(d.quality) })}</p>
      <Segmented items={[{ key: 'guilty' as const, label: t('lw.guilty') }, { key: 'acquit' as const, label: t('lw.acquit') }]} value={guilty} onChange={setGuilty} />
      {guilty === 'guilty' && (
        <label className="n-field">
          <span>{t('lw.set_fine')}</span>
          <input className="n-input" inputMode="numeric" dir="ltr" value={fine} onChange={(e) => setFine(e.target.value.replace(/[^\d۰-۹]/g, ''))} />
          {o && o.max_fine > 0 && <small className="n-city-quiet">{t('lw.set_max', { n: money(o.max_fine) })}</small>}
        </label>
      )}
      <Button block disabled={!ok} reason={over ? t('lw.set_over') : t('lw.verdict_need')}
        onClick={() => { onClose(); send('verdict', { id: d.line.id, code: guilty, ...(guilty === 'guilty' ? { items: `fine:${n}` } : {}) }) }}>{t('lw.verdict_go')}</Button>
    </Sheet>
  )
}

function CaseDetail({ d, v, send }: { d: LawCaseDetail; v: LawView; send: Send }) {
  const c = d.line
  const [ask, setAsk] = useState<'arrest' | 'charge' | 'drop' | 'appeal' | 'verdict' | 'decide' | null>(null)
  const offence = (v.offences ?? []).find((x) => x.code === c.offence.code)?.name || c.offence.name || t('lw.other')
  // the verbs the server allows here, in the order of the path; the first is the lead
  const verbs: { key: string; label: string; go: () => void; danger?: boolean }[] = [
    ...(d.may_investigate ? [{ key: 'investigate', label: t('lw.investigate'), go: () => send('investigate', { id: c.id }) }] : []),
    ...(d.may_ask_warrant ? [{ key: 'warrant_ask', label: t('lw.warrant_ask'), go: () => send('warrant_ask', { id: c.id }) }] : []),
    ...(d.may_charge ? [{ key: 'charge', label: t('lw.charge'), go: () => setAsk('charge') }] : []),
    ...(d.may_arrest ? [{ key: 'arrest', label: t('lw.arrest'), go: () => setAsk('arrest') }] : []),
    ...(d.may_defend ? [{ key: 'defend', label: t('lw.defend'), go: () => send('defend', { id: c.id }) }] : []),
    ...(d.may_verdict ? [{ key: 'verdict', label: t('lw.verdict'), go: () => setAsk('verdict') }] : []),
    ...(d.may_decide ? [{ key: 'decide', label: t('lw.decide'), go: () => setAsk('decide') }] : []),
    ...(d.may_appeal ? [{ key: 'appeal', label: t('lw.appeal'), go: () => setAsk('appeal') }] : []),
    ...(d.may_drop ? [{ key: 'drop', label: t('lw.drop'), go: () => setAsk('drop'), danger: true }] : []),
  ]
  const lead = verbs.find((x) => !x.danger)
  const rest = verbs.filter((x) => x !== lead)
  return (
    <>
      <Button kind="text" onClick={() => send('open')}>{t('lw.case_back')}</Button>
      <Card>
        <div className="n-city-case-head">
          <b>{t('lw.case_no', { n: formatNumber(c.no) })}</b>
          <Chip tone={STATE_TONE[c.state]}>{other(`lw.state.${c.state}`)}</Chip>
        </div>
        <div className="n-city-gap"><PathOf state={c.state} /></div>
        {word(`lw.state_hint.${c.state}`) && <p className="n-city-quiet n-city-gap">{word(`lw.state_hint.${c.state}`)}</p>}
      </Card>
      <div className="n-rows">
        <KV label={t('lw.offence')} value={offence} />
        <KV label={t('lw.accused')} value={person(c.accused)} />
        <KV label={t('lw.case_source')} value={other(`lw.source.${c.source}`)} />
        <KV label={t('lw.model_label')} value={other(`lw.model.${d.model}`)} />
        {c.at && <KV label={t('lw.opened')} value={atText(c.at)} />}
      </div>
      {c.custody && <Note tone="bad" icon="handcuffs">{c.custody_until ? t('lw.custody_until', { at: atText(c.custody_until) }) : t('lw.custody')}</Note>}

      <Section title={t('lw.evidence')} note={formatNumber(d.total)} />
      <Card>
        <Meter frac={d.quality / 100} tone={d.quality < 60 ? 'bad' : undefined} thick label={t('lw.ev_quality')} value={formatNumber(d.quality)} />
        <p className="n-city-quiet n-city-gap">{t('lw.ev_quality_hint')}</p>
      </Card>
      {(d.evidence ?? []).length === 0 && <p className="n-city-quiet">{t('lw.ev_none')}</p>}
      {(d.evidence ?? []).map((e) => (
        <div key={e.id} className={`n-city-ev${e.excluded ? ' gone' : ''}`}>
          <div className="n-city-case-head">
            <b>{other(`lw.ev.${e.kind}`)}</b>
            {e.excluded ? <Chip>{t('lw.ev_excluded')}</Chip> : <Chip tone={e.proper ? 'ok' : 'warn'}>{e.proper ? t('lw.ev_proper') : t('lw.ev_improper')}</Chip>}
          </div>
          <Meter frac={e.strength / 100} tone={e.proper && !e.excluded ? 'accent' : 'warn'} label={t('lw.ev_strength')} value={formatNumber(e.strength)} />
          {!e.proper && !e.excluded && (d.may_defend || d.may_appeal_as === 'accused') && <Button kind="ghost" small onClick={() => send('exclude', { id: e.id })}>{t('lw.ev_exclude')}</Button>}
        </div>
      ))}

      {(d.warrants ?? []).length > 0 && (
        <>
          <Section title={t('lw.warrants')} />
          {(d.warrants ?? []).map((w, i) => (
            <Card key={w} flat>
              <div className="n-city-card-foot">
                <b>{t('lw.warrant_n', { n: formatNumber(i + 1) })}</b>
                {d.may_sign && <Buttons><Button kind="cyan" small onClick={() => send('warrant_sign', { id: w })}>{t('lw.warrant_sign')}</Button><Button kind="ghost" small onClick={() => send('warrant_refuse', { id: w })}>{t('lw.warrant_refuse')}</Button></Buttons>}
              </div>
            </Card>
          ))}
        </>
      )}

      {(d.verdicts ?? []).length > 0 && (
        <>
          <Section title={t('lw.verdicts')} />
          {(d.verdicts ?? []).map((x) => (
            <div key={x.instance} className="n-kv"><span>{x.instance > 1 ? t('lw.v_appeal') : t('lw.v_first')}</span><Chip tone={x.guilty ? 'bad' : 'ok'}>{x.guilty ? t('lw.guilty') : t('lw.acquit')}</Chip></div>
          ))}
        </>
      )}
      {(d.sentences ?? []).length > 0 && (
        <>
          <Section title={t('lw.sentences')} />
          {(d.sentences ?? []).map((s) => <Sentence key={s.id} s={s} send={send} />)}
        </>
      )}

      {verbs.length > 0 && (
        <>
          <Section title={t('lw.next')} />
          {rest.length > 0 && <div className="n-city-verbs">{rest.map((x) => <Button key={x.key} kind={x.danger ? 'danger' : 'ghost'} onClick={x.go}>{x.label}</Button>)}</div>}
          {lead && <Button block onClick={lead.go}>{lead.label}</Button>}
        </>
      )}

      {ask === 'arrest' && <Confirm title={t('lw.arrest_title')} icon="handcuffs" confirm={t('lw.arrest')} onConfirm={() => { setAsk(null); send('arrest', { id: c.id }) }} onClose={() => setAsk(null)}><p className="n-text">{t('lw.arrest_body', { name: person(c.accused) })}</p></Confirm>}
      {ask === 'charge' && <Confirm title={t('lw.charge_title')} icon="gavel" confirm={t('lw.charge')} onConfirm={() => { setAsk(null); send('charge', { id: c.id }) }} onClose={() => setAsk(null)}><p className="n-text">{t('lw.charge_body')}</p></Confirm>}
      {ask === 'drop' && <Confirm title={t('lw.drop_title')} icon="gavel" danger confirm={t('lw.drop')} onConfirm={() => { setAsk(null); send('drop', { id: c.id }) }} onClose={() => setAsk(null)}><p className="n-text">{t('lw.drop_body')}</p></Confirm>}
      {ask === 'appeal' && <Confirm title={t('lw.appeal_title')} icon="gavel" confirm={t('lw.appeal')} onConfirm={() => { setAsk(null); send('appeal', { id: c.id, kind: d.may_appeal_as || 'accused' }) }} onClose={() => setAsk(null)}><p className="n-text">{t('lw.appeal_body')}</p></Confirm>}
      {ask === 'verdict' && <Verdict d={d} v={v} send={send} onClose={() => setAsk(null)} />}
      {ask === 'decide' && (
        <Sheet title={t('lw.decide_title')} icon="gavel" onClose={() => setAsk(null)}>
          <p className="n-text">{t('lw.decide_hint')}</p>
          <Buttons lead>
            <Button onClick={() => { setAsk(null); send('appeal_decide', { id: c.id, code: 'quash' }) }}>{t('lw.decide_quash')}</Button>
            <Button kind="ghost" onClick={() => { setAsk(null); send('appeal_decide', { id: c.id, code: 'confirm' }) }}>{t('lw.decide_confirm')}</Button>
          </Buttons>
        </Sheet>
      )}
    </>
  )
}

// -- the lock-up and customs -------------------------------------------------------------------------

function Sentence({ s, send, lead }: { s: LawSentenceLine; send: Send; lead?: boolean }) {
  const [ask, setAsk] = useState(false)
  return (
    <Card flat>
      <div className="n-city-case-head">
        <b>{other(`lw.sent.${s.kind}`)}{s.kind === 'ban' && s.ban ? ` (${other(`lw.ban.${s.ban}`)})` : ''}</b>
        <Chip tone={s.status === 'active' ? 'warn' : undefined}>{other(`lw.sstatus.${s.status}`)}</Chip>
      </div>
      <div className="n-city-facts n-city-gap">
        {s.fine > 0 && <KV label={t('lw.s_fine')} value={t('lw.s_fine_paid', { paid: money(s.fine_paid), all: money(s.fine) })} />}
        {s.jail_hours > 0 && <KV label={t('lw.s_jail')} value={hours(s.jail_hours)} />}
        {s.ban_days > 0 && <KV label={t('lw.s_ban')} value={days(s.ban_days)} />}
        {s.ends_at && s.status === 'active' && <KV label={t('lw.s_ends')} value={atText(s.ends_at)} />}
        {s.bail > 0 && s.status === 'active' && <KV label={t('lw.s_bail')} value={money(s.bail)} />}
      </div>
      {(s.may_bail || s.may_pardon) && (
        <div className="n-city-gap">
          {s.may_bail && <Button kind={lead ? 'primary' : 'cyan'} block onClick={() => setAsk(true)}>{t('lw.bail')}</Button>}
          {s.may_pardon && <Button kind="ghost" small onClick={() => send('pardon', { id: s.id })}>{t('lw.pardon')}</Button>}
        </div>
      )}
      {ask && <Confirm title={t('lw.bail_title')} icon="handcuffs" confirm={t('lw.bail_go')} onConfirm={() => { setAsk(false); send('bail', { id: s.id }) }} onClose={() => setAsk(false)}><p className="n-text">{t('lw.bail_body', { price: money(s.bail) })}</p></Confirm>}
    </Card>
  )
}

function Load({ l, v, send }: { l: LawLoadLine; v: LawView; send: Send }) {
  const names = useContentNames()
  const tone: Tone = l.status === 'seized' ? 'bad' : l.status === 'crossed' ? 'ok' : 'warn'
  // a good by its catalogue name, else the name the view carries; never the bare code
  const good = (code: string) => {
    const known = (v.goods ?? []).find((g) => g.item.code === code)?.item.name
    const cat = names.name(['component', 'item'], code, '')
    return (cat && cat !== code ? cat : '') || (known && known !== code ? known : '') || t('lw.other')
  }
  const list = (m: Record<string, number> | null) => Object.entries(m ?? {}).map(([k, n]) => `${formatNumber(n)} ${good(k)}`).join('، ')
  return (
    <Card flat>
      <div className="n-city-case-head"><b>{t('lw.load_to', { town: l.to.name })}</b><Chip tone={tone}>{other(`lw.load.${l.status}`)}</Chip></div>
      <div className="n-city-facts n-city-gap">
        <KV label={t('lw.load_declared')} value={list(l.declared) || t('lw.nothing')} />
        {l.duty > 0 && <KV label={t('lw.load_duty')} value={money(l.duty)} />}
        {l.penalty > 0 && <KV label={t('lw.load_penalty')} value={money(l.penalty)} />}
      </div>
      {l.may_cross && <div className="n-city-gap"><Button kind="cyan" block onClick={() => send('cross', { id: l.id })}>{t('lw.cross')}</Button></div>}
    </Card>
  )
}

// -- the screen --------------------------------------------------------------------------------------

export default function Law({ response, loading }: NScreenProps) {
  const { exec } = useSession()
  const [res, setRes] = useState<CommandResponse | null>(response)
  useEffect(() => setRes(response), [response])
  const [tab, setTab] = useState<Tab>('law')
  const [complain, setComplain] = useState<{ code?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const v = (res?.ok !== false || res?.view) ? (res?.view as LawView | undefined) : undefined
  if (!v || !v.open) return <Page title={t('lw.title')}>{loading ? <Loading /> : <Empty icon="gavel">{t('common.load_failed')}</Empty>}</Page>

  const send: Send = (action, args = {}) => {
    if (busy) return
    setBusy(true)
    void exec('settlement.law', { action, ...args }).then((r) => {
      // a refusal is toasted by exec and leaves the screen as it was
      if (r && r.ok !== false && r.screen === 'settlement_law' && r.view) {
        setRes(r)
        const nv = r.view as unknown as LawView
        if (nv.case) setTab('cases')
        // the answer's line (a complaint filed, a patrol's find) is at the top: bring it into view
        if (nv.notice || nv.case) document.querySelector('.n-page')?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }).finally(() => setBusy(false))
  }

  const openAny = v.open.police || v.open.courts || v.open.customs || v.open.launder || v.open.black
  if (!openAny) return <Page title={t('lw.title')}><Empty icon="gavel"><b>{t('lw.off')}</b><br />{t('lw.off_hint')}</Empty></Page>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'law', label: t('lw.tab.law') },
    ...(v.open.police || v.open.courts ? [{ key: 'cases' as Tab, label: t('lw.tab.cases') }] : []),
    ...(v.open.courts || (v.mine ?? []).length > 0 ? [{ key: 'jail' as Tab, label: t('lw.tab.jail') }] : []),
    ...(v.open.customs || (v.loads ?? []).length > 0 ? [{ key: 'customs' as Tab, label: t('lw.tab.customs') }] : []),
  ]
  const on = tabs.some((x) => x.key === tab) ? tab : 'law'
  const canComplain = v.open.police && (v.offences ?? []).some((o) => o.listed)
  const notice = v.notice ? word(`lw.notice.${v.notice}`) : ''
  const custody = (v.posts ?? []).find((p) => p.service === 'custody')
  const customs = (v.posts ?? []).find((p) => p.service === 'customs')
  const mine = v.mine ?? []
  const loads = v.loads ?? []

  return (
    <Page title={t('lw.title')} sub={v.village || undefined}>
      {notice && <Note tone="ok" icon="m_check">{notice}</Note>}
      <Segmented items={tabs} value={on} onChange={setTab} />

      {on === 'law' && <LawTab v={v} send={send} onComplain={(code) => setComplain({ code })} />}

      {on === 'cases' && (v.case ? <CaseDetail d={v.case} v={v} send={send} /> : (
        <>
          <p className="n-city-quiet">{t('lw.cases_intro')}</p>
          {(v.cases ?? []).length === 0 ? <Empty icon="checklist">{t('lw.cases_none')}</Empty>
            : (v.cases ?? []).map((c) => <CaseCard key={c.id} c={c} v={v} onOpen={() => send('open', { id: c.id })} />)}
        </>
      ))}

      {on === 'jail' && (
        <>
          <p className="n-city-quiet">{t('lw.jail_intro')}</p>
          {custody && <Post p={custody} />}
          <Section title={t('lw.mine')} />
          {mine.length === 0 ? <Empty icon="handcuffs">{t('lw.mine_none')}</Empty> : mine.map((s, i) => <Sentence key={s.id} s={s} send={send} lead={i === mine.findIndex((x) => x.may_bail)} />)}
        </>
      )}

      {on === 'customs' && (
        <>
          <p className="n-city-quiet">{t('lw.customs_intro')}</p>
          {customs && <Post p={customs} />}
          <Section title={t('lw.loads')} />
          {loads.length === 0 ? <Empty icon="cart">{t('lw.loads_none')}</Empty> : loads.map((l) => <Load key={l.id} l={l} v={v} send={send} />)}
        </>
      )}

      {(on === 'law' || (on === 'cases' && !v.case)) && v.open.police && (
        <Button block icon="gavel" disabled={!canComplain} reason={t('lw.complain_none')} onClick={() => setComplain({})}>{t('lw.complain')}</Button>
      )}
      {complain && <Complain v={v} offence={complain.code} send={send} onClose={() => setComplain(null)} />}
    </Page>
  )
}
