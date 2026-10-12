// «معدن» (ADR 0075): the deposits with their survey, the mineheads (levels with props and water, the crew, the kilograms a shift moves and what limits them,
// the reasons it stands idle), the modules to order with their wage, the works in hand, and the post to work as. A neutral view: facts from the server, words ours.

import { useState } from 'react'
import type { MineDepositLine, MineLine, MiningView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, EffectRow, Note } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { durationText } from './common'
import { hasKey, t, type Key } from '../../i18n'

registerWrites(['settlement.mining'], (a) => !!a.args?.action)

export const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)
export const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`
export const sendCmd = (ctx: FlowCtx, command: string, args: Record<string, string>) => ctx.go({ command, args, kind: 'secondary', id: command, icon: 'action:default' } as never)
/** Materials in a line: «۴ چوب، ۲ سنگ». */
export const matLine = (ctx: FlowCtx, l: { component: { code: string; name: string }; quantity: number }[] | null) => (l ?? []).map((m) => `${formatNumber(m.quantity)} ${ctx.names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ')
const POSTS = ['miner', 'mine_hauler', 'timberman', 'banksman', 'pumper']

function Deposit({ d }: { d: MineDepositLine }) {
  if (!d.surveyed) return <div className="mn-card"><div className="mn-head"><b>{d.resource.name}</b><EffectChip tone="neutral">{t('mn.maybe')}</EffectChip></div><div className="mn-sub">{t('mn.maybe_hint')}</div></div>
  const [s, a, b] = d.left_bps
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{d.resource.name}</b><EffectChip tone={d.band === 'rich' ? 'good' : d.band === 'lean' ? 'warn' : 'neutral'}>{word(`mn.band.${d.band}`, d.band)}</EffectChip></div>
      <div className="mn-sub">{t('mn.grade', { g: formatNumber(Math.round(d.grade_permille / 10)) })}</div>
      <div className="vf-list">
        <div className="vf-line"><span>{t('mn.left_surface')}</span><b>{pct(s ?? 0)}</b></div>
        <div className="vf-line"><span>{t('mn.left_l1')}</span><b>{pct(a ?? 0)}</b></div>
        <div className="vf-line"><span>{t('mn.left_l2')}</span><b>{pct(b ?? 0)}</b></div>
      </div>
    </div>
  )
}

function Bar({ bps, bad }: { bps: number; bad?: boolean }) { return <div className="mn-bar"><i className={bad ? 'bad' : ''} style={{ width: `${Math.max(0, Math.min(100, bps / 100))}%` }} /></div> }

function Mine({ m, v, ctx }: { m: MineLine; v: MiningView; ctx: FlowCtx }) {
  const [post, setPost] = useState('')
  const reasons = m.reasons ?? []
  const limits: Record<string, number> = { face: m.face_kg, hoist: m.hoist_kg, haul: m.haul_kg }
  return (
    <div className="mn-card">
      <div className="mn-head"><b>{ctx.bname(m.building.code, m.building.name)}</b><EffectChip tone={reasons.length ? 'warn' : 'good'}>{reasons.length ? t('mn.idle') : t('mn.working')}</EffectChip></div>
      <div className="mn-sub">{t('mn.shift_moves', { kg: formatNumber(m.output_kg) })}</div>
      <div className="vf-list">
        {(['face', 'hoist', 'haul'] as const).map((k) => <div key={k} className="vf-line"><span>{word(`mn.cap.${k}`, k)}{m.limit === k ? ` – ${t('mn.limits')}` : ''}</span><b className={m.limit === k ? 'bad' : ''}>{t('mn.kg', { n: formatNumber(limits[k]) })}</b></div>)}
      </div>
      {(m.levels ?? []).map((l) => (
        <div key={l.depth} className="mn-level">
          <div className="mn-head"><span>{t('mn.level', { n: formatNumber(l.depth), m: formatNumber(l.depth_m) })}</span><EffectChip tone={l.status === 'ok' ? 'good' : 'bad'}>{word(`mn.status.${l.status}`, l.status)}</EffectChip></div>
          <div className="mn-sub">{t('mn.props')}</div><Bar bps={l.condition_bps} bad={l.condition_bps < 3000} />
          <div className="mn-sub">{l.drained ? t('mn.drained') : t('mn.water')}</div><Bar bps={l.water_bps} bad={l.water_bps > 6000} />
          {l.status !== 'ok' && <Note tone="bad">{l.status === 'flooded' ? t('mn.flooded_note') : t('mn.repair_note')}</Note>}
        </div>
      ))}
      <div className="mn-sub">{t('mn.crew')}: {(m.crew ?? []).map((c) => `${c.role.name} ${formatNumber(c.working)}/${formatNumber(c.slots)}`).join('، ') || '—'}</div>
      <div className="mn-sub">{t('mn.adit', { a: formatNumber(m.adit_m), b: formatNumber(m.adit_need_m[1] ?? 0) })}</div>
      {reasons.length > 0 && <div className="mn-reasons">{reasons.map((r) => <Note key={r} tone="bad">{word(`mn.reason.${r}`, r)}</Note>)}</div>}
      <div className="tc-f"><span>{t('mn.post')}</span>
        <div className="rc-chips" role="radiogroup" aria-label={t('mn.post')}>
          <button type="button" role="radio" aria-checked={post === ''} className={`dk-chip${post === '' ? ' all' : ''}`} onClick={() => setPost('')}>{t('mn.post_auto')}</button>
          {POSTS.map((p) => <button key={p} type="button" role="radio" aria-checked={post === p} className={`dk-chip${post === p ? ' all' : ''}`} onClick={() => setPost(p)}>{word(`mn.post.${p}`, p)}</button>)}
        </div>
      </div>
      <ActionButton tone="green" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.work', { id: m.building_id, ...(post ? { recipe: post } : {}) })}>{t('mn.work')}</ActionButton>
      {v.may_run && <div className="gc-note">{t('mn.order_below')}</div>}
    </div>
  )
}

export const Mining = flow<MiningView>(({ view: v, ctx }) => {
  if (!v.open) return <Page title={t('mn.title')} tone="gold"><Panel><Lead>{t('mn.off')}</Lead><Hint>{v.starts_at ? t('mn.off_from', { at: atText(v.starts_at) }) : t('mn.off_hint')}</Hint></Panel></Page>
  const mines = v.mines ?? []
  const first = mines[0]
  const [len, setLen] = useState(50)
  return (
    <Page title={t('mn.title')} tone="gold">
      {v.notice && hasKey(`mn.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`mn.notice.${v.notice}`)}</Lead></Panel>}
      {v.pits_from && <Panel><Hint>{t('mn.pits_from', { at: atText(v.pits_from) })}</Hint></Panel>}
      <SectionTitle>{t('mn.deposits')}</SectionTitle>
      <Panel>
        {(v.deposits ?? []).length === 0 && <Hint>{t('mn.deposits_none')}</Hint>}
        <div className="mn-list">{(v.deposits ?? []).map((d) => <Deposit key={d.resource.code} d={d} />)}</div>
        {v.may_run && (v.deposits ?? []).some((d) => !d.surveyed) && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => sendCmd(ctx, 'settlement.mining', { action: 'survey' })}>{t('mn.survey')}</ActionButton>}
        {(v.deposits ?? []).some((d) => !d.surveyed) && <Hint>{t('mn.survey_hint')}</Hint>}
      </Panel>
      <SectionTitle>{t('mn.mines')}</SectionTitle>
      <Panel>
        {mines.length === 0 && <Hint>{t('mn.mines_none')}</Hint>}
        <div className="mn-list">{mines.map((m) => <Mine key={m.building_id} m={m} v={v} ctx={ctx} />)}</div>
      </Panel>
      {(v.works ?? []).length > 0 && (
        <>
          <SectionTitle>{t('mn.works')}</SectionTitle>
          <Panel><div className="vf-list">{(v.works ?? []).map((w) => <div key={w.id} className="vf-line"><span>{w.module.name}{w.detail > 0 ? ` – ${t('mn.metres', { n: formatNumber(w.detail) })}` : ''}</span><b>{w.left_seconds > 0 ? t('mn.left', { t: durationText(w.left_seconds) }) : atText(w.due_at)}</b></div>)}</div></Panel>
        </>
      )}
      {first && (
        <>
          <SectionTitle>{t('mn.modules')}</SectionTitle>
          <Panel>
            <Hint>{t('mn.modules_hint', { name: ctx.bname(first.building.code, first.building.name) })}</Hint>
            <div className="mn-list">
              {(v.modules ?? []).map((m) => (
                <div key={m.module.code} className="mn-card">
                  <div className="mn-head"><b>{m.module.name}</b><span>{t('mn.have', { a: formatNumber(m.have), b: formatNumber(m.max) })}</span></div>
                  <div className="mn-sub">{t('mn.cost', { list: matLine(ctx, m.cost) || '—', w: money(m.wage) })}{m.unit > 0 ? ` ${t('mn.per', { n: formatNumber(m.unit) })}` : ''}</div>
                  {(m.missing ?? []).length > 0 && <Note tone="bad">{t('mn.missing', { list: (m.missing ?? []).map((x) => x.name).join('، ') })}</Note>}
                  {m.module.code === 'adit' && m.can_order && v.may_run && (
                    <div className="lm-keeper-step"><button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={len <= 50} onClick={() => setLen(len - 50)}>−</button><div className="lm-keeper-val">{t('mn.metres', { n: formatNumber(len) })}</div><button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={len >= 500} onClick={() => setLen(len + 50)}>+</button></div>
                  )}
                  {v.may_run && <ActionButton tone="gold" small disabled={ctx.busy || !m.can_order} onClick={() => sendCmd(ctx, 'settlement.mining', { action: 'works', code: m.module.code, n: first.building_id, ...(m.module.code === 'adit' ? { m: String(len) } : {}) })}>{t('mn.order')}</ActionButton>}
                </div>
              ))}
            </div>
            {!v.may_run && <Hint>{t('mn.not_head')}</Hint>}
          </Panel>
        </>
      )}
    </Page>
  )
})
