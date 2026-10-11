// The teaching network (ADR 0071), under «آموزش»: «شاگردی» (the apprenticeships panel: my lines as an apprentice and as a master, the pool's craftsman to join) and
// «استادان» (the directory per craft). Neutral views: facts from the server, words ours; every act is a write of the flow host that answers the panel again.

import { useState } from 'react'
import type { ApprenticeLine, ApprenticeRefusalView, ApprenticesView, TeachersView, TeacherEntry } from '../../api/views.gen'
import { Slab } from '../../kit'
import { Btns, Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from '../village/flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, EffectRow, Note } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'

registerWrites(['settlement.apprentice.accept', 'settlement.apprentice.leave', 'settlement.apprentice.dismiss', 'settlement.apprentice.exam', 'settlement.apprentice.join', 'settlement.apprentice.offer'])

const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)
const act = (command: string, args: Record<string, string>) => ({ command, args, kind: 'secondary' as const, id: command, icon: 'action:default' }) as never
const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`
const craftName = (ctx: FlowCtx, code: string) => ctx.names.name(['course', 'skill'], code, code)

function Line({ l, ctx }: { l: ApprenticeLine; ctx: FlowCtx }) {
  const [asking, setAsking] = useState(false)
  const master = l.role === 'master'
  const who = l.npc || !l.with.name ? t('tc.npc_master') : l.with.name
  const live = l.status === 'active'
  return (
    <Panel tone={live ? 'emerald' : undefined}>
      <Lead>{master ? t('tc.line_master', { who, craft: craftName(ctx, l.craft) }) : t('tc.line_apprentice', { who, craft: craftName(ctx, l.craft) })}</Lead>
      <EffectRow>
        <EffectChip tone={live ? 'good' : l.status === 'offered' ? 'warn' : l.status === 'completed' ? 'good' : 'neutral'}>{word(`tc.status.${l.status}`, l.status)}</EffectChip>
        {l.certified && <EffectChip tone="good">{t('tc.certified')}</EffectChip>}
      </EffectRow>
      <div className="vf-list">
        <div className="vf-line"><span>{t('tc.workshop')}</span><b>{ctx.bname(l.workshop.code, l.workshop.name)}</b></div>
        <div className="vf-line"><span>{t('tc.term')}</span><b>{t('tc.days', { n: formatNumber(l.term_days) })}{live && l.ends_at ? ` – ${t('tc.until', { at: atText(l.ends_at) })}` : ''}</b></div>
        <div className="vf-line"><span>{t('tc.fee')}</span><b>{l.fee > 0 ? money(l.fee) : t('common.free')}</b></div>
        <div className="vf-line"><span>{t('tc.share')}</span><b>{pct(l.wage_share_bps)}</b></div>
        {live && <div className="vf-line"><span>{t('tc.shifts')}</span><b>{t('tc.of', { a: formatNumber(l.shifts), b: formatNumber(l.exam_shifts) })}</b></div>}
        {live && !master && l.extra_xp > 0 && <div className="vf-line"><span>{t('tc.extra_xp')}</span><b>{formatNumber(l.extra_xp)}</b></div>}
      </div>
      {live && l.shifts < l.exam_shifts && <Hint>{master ? t('tc.wait_shifts_master') : t('tc.wait_shifts')}</Hint>}
      {l.can_exam && <Hint>{t('tc.exam_ready')}</Hint>}
      <div className="wk-btns">
        {l.can_accept && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.accept', { id: l.id }))}>{l.fee > 0 ? t('tc.accept_fee', { fee: money(l.fee) }) : t('tc.accept')}</ActionButton>}
        {l.can_leave && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.leave', { id: l.id }))}>{l.status === 'offered' ? t('tc.decline') : t('tc.leave')}</ActionButton>}
        {l.can_exam && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.exam', { id: l.id, pass: 'pass' }))}>{t('tc.exam_pass')}</ActionButton>}
        {l.can_exam && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.exam', { id: l.id, pass: 'fail' }))}>{t('tc.exam_fail')}</ActionButton>}
        {l.can_dismiss && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setAsking(!asking)}>{t('tc.dismiss')}</ActionButton>}
      </div>
      {asking && l.can_dismiss && (
        <div className="tc-reason">
          <Note>{t('tc.dismiss_why')}</Note>
          <div className="wk-btns">
            <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.dismiss', { id: l.id, reason: 'idle' }))}>{t('tc.reason.idle')}</ActionButton>
            <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.dismiss', { id: l.id, reason: 'abusive' }))}>{t('tc.reason.abusive')}</ActionButton>
          </div>
        </div>
      )}
    </Panel>
  )
}

export const Apprentices = flow<ApprenticesView>(({ view: v, ctx }) => {
  const lines = v.lines ?? []
  const join = v.can_join ?? []
  return (
    <Page title={t('tc.title')} tone="violet">
      {v.notice && hasKey(`tc.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`tc.notice.${v.notice}`)}</Lead></Panel>}
      {lines.map((l) => <Line key={l.id} l={l} ctx={ctx} />)}
      {lines.length === 0 && <Panel><Lead>{t('tc.none')}</Lead><Hint>{t('tc.none_hint')}</Hint></Panel>}
      {join.length > 0 && (
        <>
          <SectionTitle>{t('tc.join_title')}</SectionTitle>
          <Panel>
            <Hint>{t('tc.join_hint')}</Hint>
            {join.map((j) => (
              <Slab key={j.workshop.code} tone="blue" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(act('settlement.apprentice.join', { building: j.workshop.code }))}>
                {t('tc.join', { craft: craftName(ctx, j.craft), place: ctx.bname(j.workshop.code, j.workshop.name) })}
              </Slab>
            ))}
            <div className="gc-note">{t('tc.join_up_to', { n: formatNumber(join[0].up_to) })}</div>
          </Panel>
        </>
      )}
      <Btns ctx={ctx} list={ctx.by('teachers').slice(0, 1)} />
    </Page>
  )
})

const KIND: Record<string, string> = { class: 'tc.kind.class', master: 'tc.kind.master', npc_master: 'tc.kind.npc_master', city: 'tc.kind.city' }

function Entry({ e, ctx }: { e: TeacherEntry; ctx: FlowCtx }) {
  const name = e.kind === 'city' ? t('tc.city_school') : e.kind === 'npc_master' || !e.teacher.name ? t('tc.npc_master') : e.teacher.name
  return (
    <div className={`tc-entry${e.here ? ' here' : ''}`}>
      <div className="tc-head"><b>{name}</b><EffectChip tone={e.here ? 'good' : 'neutral'}>{word(KIND[e.kind] ?? '', e.kind)}</EffectChip></div>
      <div className="tc-meta">
        <span>{e.here ? t('tc.here') : t('tc.away', { place: ctx.names.name('city', e.settlement.code, e.settlement.name), km: formatNumber(e.km) })}</span>
        <span>{t('tc.levels', { have: formatNumber(e.craft_level), up: formatNumber(e.up_to) })}</span>
        <span>{e.fee > 0 ? money(e.fee) : t('common.free')} – {e.free_seats > 0 ? t('tc.seats', { n: formatNumber(e.free_seats) }) : t('tc.no_seats')}</span>
      </div>
      {!e.here && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.run('travel.options', { city: e.settlement.code })}>{t('tc.go', { place: ctx.names.name('city', e.settlement.code, e.settlement.name) })}</ActionButton>}
    </div>
  )
}

export const Teachers = flow<TeachersView>(({ view: v, ctx }) => {
  const list = [...(v.entries ?? [])].sort((a, b) => Number(b.here) - Number(a.here) || a.km - b.km)
  return (
    <Page title={t('tc.dir_title')} tone="violet">
      <div className="rc-chips tc-crafts" role="radiogroup" aria-label={t('tc.craft')}>
        {(v.crafts ?? []).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === v.craft} className={`dk-chip${c === v.craft ? ' all' : ''}`} onClick={() => ctx.run('education.teachers', { craft: c })}>{craftName(ctx, c)}</button>
        ))}
      </div>
      <Panel><Lead>{t('tc.dir_lead', { craft: v.course.name || craftName(ctx, v.craft) })}</Lead><Hint>{t('tc.rule')}</Hint></Panel>
      {list.length === 0 && <Panel><Lead>{t('tc.dir_none')}</Lead></Panel>}
      {list.length > 0 && <Panel><div className="tc-list">{list.map((e, i) => <Entry key={i} e={e} ctx={ctx} />)}</div></Panel>}
    </Page>
  )
})

export const ApprenticeRefusal = flow<ApprenticeRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`tc.refused.${v.kind}`, t('tc.refused.other'))}</Lead>
      {hasKey(`tc.refused_hint.${v.kind}`) && <Hint>{word(`tc.refused_hint.${v.kind}`)}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.kind === 'back').slice(0, 0)} />
  </Page>
))
