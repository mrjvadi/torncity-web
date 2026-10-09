// «میز پژوهش» (ADR 0048): a settlement runs as many research projects at once as it has slots: one free slot and those of its research
// buildings that worked today. The desk shows the slots (free, used, locked), the buildings with their scholars' posts, the running projects with
// the quote each started on, the research pacts and the work experience by field. Nothing here starts a project: that is the knowledge list.

import { useState } from 'react'
import type { ResearchBoardView, ResearchBuildingLine } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, Note, ProgressRow, Section } from '../../ui/Popup'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { formatNumber, money } from '../native/kit/format'
import { atText, words } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'
import { useVillageCommand, useContentNames } from '../../village/useVillage'
import { Btns, Hint, Lead, Page, Panel, flow, isBack } from './flow'

export const bp = (b: number) => `⁦${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(b / 100)}٪⁩`
/** the notes of a quote: faster or slower pace, ahead of the era, breakthrough discount, pact bonus */
export function quoteNotes(q: { speed_bps: number; ahead_bps: number; discount_bps: number; share_bps: number }): string[] {
  const out: string[] = []
  if (q.speed_bps && q.speed_bps !== 10000) out.push(t('rd.q.speed', { p: bp(q.speed_bps) }))
  if (q.ahead_bps > 10000) out.push(t('rd.q.ahead', { p: bp(q.ahead_bps - 10000) }))
  if (q.discount_bps > 0) out.push(t('rd.q.discount', { p: bp(q.discount_bps) }))
  if (q.share_bps > 0) out.push(t('rd.q.share', { p: bp(q.share_bps) }))
  return out
}

function Seats({ b }: { b: ResearchBuildingLine }) {
  const filled = b.players + b.np_cs
  const n = Math.max(b.needed, filled, 1)
  return (
    <div className="wk-seats" role="list" aria-label={t('rd.seats', { a: formatNumber(filled), b: formatNumber(b.needed) })}>
      {Array.from({ length: n }, (_, i) => {
        const kind = i < b.players ? 'player' : i < filled ? 'npc' : 'empty'
        return (
          <div key={i} role="listitem" className={`wk-seat${kind !== 'empty' ? ' on' : ''}${kind === 'npc' ? ' npc' : ''}`}>
            <b>{t('rd.scholar')}</b>
            <span>{kind === 'player' ? t('rd.s.player') : kind === 'npc' ? t('rd.s.npc') : t('work.empty')}</span>
          </div>
        )
      })}
    </div>
  )
}

/** where a research upkeep good is made, for the «بساز» fix */
const PRODUCER: Record<string, string> = { paper: 'paper_mill', firewood: 'woodcutter_camp' }

export const ResearchDesk = flow<ResearchBoardView>(({ view: v0, ctx }) => {
  const cmd = useVillageCommand()
  const names = useContentNames()
  const [v, setV] = useState(v0)
  const [busy, setBusy] = useState(false)
  const [pact, setPact] = useState<string | null>(null)
  const back = ctx.acts.find(isBack)
  const kn = (n: { code: string; name: string }) => names.name('knowledge', n.code, n.name)
  const bn = (n: { code: string; name: string }) => ctx.bname(n.code, n.name)

  async function act(action: string, code: string) {
    setBusy(true)
    const r = await cmd('settlement.research', { action, code }, { write: true })
    setBusy(false)
    if (r.ok && r.res?.view) setV(r.res.view as unknown as ResearchBoardView)
  }
  const free = v.slots?.filter((s) => s.ref === 'free') ?? []
  const used = v.running
  const locked = !(v.buildings ?? []).some((b) => b.open)
  const idleWhy = (b: ResearchBuildingLine) => (b.idle && hasKey(`rd.idle.${b.idle}`) ? t(`rd.idle.${b.idle}` as Key) : '')
  const mine = (v.buildings ?? []).find((b) => b.mine)

  return (
    <Page title={t('rd.title')} tone="violet">
      <Panel tone="violet">
        <Lead>{t('rd.lead', { a: formatNumber(v.running), b: formatNumber(v.capacity) })}</Lead>
        <ul className="rd-rules">{(['r1', 'r2', 'r3', 'r4'] as const).map((k) => <li key={k}>{t(`rd.rules.${k}` as Key)}</li>)}</ul>
      </Panel>

      {v.stand_in_until && <Note>{t('rd.standin_note', { at: atText(v.stand_in_until) })}</Note>}
      <Section>{t('rd.slots')}</Section>
      <CardGrid>
        {(v.slots ?? []).flatMap((s) => Array.from({ length: s.capacity }, (_, i) => {
          const busyOne = i < s.used
          const prj = (v.projects ?? []).filter((p) => p.slot === s.ref)[i]
          return (
            <PCard key={`${s.ref}-${i}`} icon={busyOne ? 'book' : 'plus'} tone={busyOne ? 'busy' : 'good'}
              title={busyOne && prj ? kn(prj.knowledge) : t('rd.slot_free')}
              sub={s.ref === 'free' ? t('rd.slot_of_town') : bn(s.building)}
              facts={busyOne && prj ? <span>{t('rd.left', { w: words(prj.left_seconds) })}{prj.finish_at ? ` · ${atText(prj.finish_at)}` : ''}</span> : t('rd.slot_ready')}
              foot={busyOne && prj ? <span className="rd-notes">{quoteNotes(prj).join(' · ') || t('rd.q.plain')}</span> : undefined} />
          )
        }))}
        {locked && <PCard icon="chest" off title={t('rd.slot_locked')} sub={t('rd.locked_sub')} facts={<span className="dk-why">{t('rd.not_here')}</span>} />}
      </CardGrid>
      {free.length === 0 && used >= v.capacity && <Note tone="bad">{t('rd.full')}</Note>}
      {locked && <Hint>{t('rd.locked_hint')}</Hint>}

      {(v.buildings ?? []).length > 0 && <Section>{t('rd.buildings')}</Section>}
      {(v.buildings ?? []).map((b) => (
        <Panel key={b.id} tone={b.open ? 'emerald' : undefined}>
          <Lead>{bn(b.building)} · {b.open ? t('rd.open') : t('rd.idle')}</Lead>
          {!b.open && idleWhy(b) && <Note tone="bad">{idleWhy(b)}</Note>}
          <Seats b={b} />
          <Hint>{t('rd.b_facts', { slots: formatNumber(b.slots), wage: money(b.wage), bonus: bp(b.bonus_bps) })}</Hint>
          {(b.upkeep ?? []).length > 0 && (
            <div className="vf-list">
              {(b.upkeep ?? []).map((u) => (
                <div key={u.item.code} className="vf-line rd-up">
                  <span>{t('rd.upkeep')}: {names.name(['component', 'item'], u.item.code, u.item.name)}
                    {u.stand_in?.code && v.stand_in_until && <small className="rd-notes">{t('rd.standin', { stand: names.name(['component', 'item'], u.stand_in.code, u.stand_in.name), n: formatNumber(u.stand_in_have), at: atText(v.stand_in_until) })}</small>}
                    {u.have < u.qty && !(u.stand_in?.code && v.stand_in_until && u.stand_in_have >= u.qty - u.have) && <small className="dk-why">{t('rd.upkeep_missing', { item: names.name(['component', 'item'], u.item.code, u.item.name) })}</small>}
                    {u.have < u.qty && !(u.stand_in?.code && v.stand_in_until && u.stand_in_have >= u.qty - u.have) && (
                      <span className="wk-fixes">
                        <button type="button" className="dk-chip all" onClick={() => ctx.openLocal('village_storage')}>{t('rd.fix_buy')}</button>
                        {PRODUCER[u.item.code] && <button type="button" className="dk-chip" onClick={() => ctx.openLocal('village_home', { build: '1' })}>{t('rd.fix_build', { name: ctx.bname(PRODUCER[u.item.code], '') })}</button>}
                      </span>
                    )}
                  </span>
                  <b className={u.have < u.qty ? 'bad' : ''}>{formatNumber(u.have)} / {formatNumber(u.qty)}</b>
                </div>
              ))}
            </div>
          )}
          <ActionRow>
            {b.mine
              ? <ActionButton tone="steel" small disabled={busy} onClick={() => void act('leave', b.id)}>{t('rd.leave')}</ActionButton>
              : <ActionButton tone="gold" small disabled={busy || !b.can_take || !!mine} onClick={() => void act('post', b.id)}>{t('rd.take')}</ActionButton>}
          </ActionRow>
          {!b.mine && !b.can_take && <Hint>{t('rd.cannot_take')}</Hint>}
        </Panel>
      ))}

      <Section>{t('rd.exp')}</Section>
      {(v.experience ?? []).length === 0 ? <Hint>{t('rd.exp_none')}</Hint> : (
        <CardGrid>
          {(v.experience ?? []).map((e) => (
            <PCard key={e.field} icon="scroll" title={hasKey(`rd.field.${e.field}`) ? t(`rd.field.${e.field}` as Key) : e.field} tone="busy"
              sub={t('rd.exp_pts', { a: formatNumber(e.points), b: formatNumber(e.per) })}
              foot={<span className="rd-notes"><ProgressRow frac={Math.min(1, e.points / Math.max(1, e.per))} label={t('rd.exp_max', { p: bp(e.max_bps) })} color="#8e6cf0" /></span>} />
          ))}
        </CardGrid>
      )}
      <Hint>{t('rd.exp_note')}</Hint>

      <Section>{t('rd.pacts')}</Section>
      <Hint>{t('rd.pact_note', { cap: bp(v.share_cap_bps) })}</Hint>
      {(v.pacts ?? []).length === 0 && <Hint>{t('rd.pact_none')}</Hint>}
      <CardGrid>
        {(v.pacts ?? []).map((p) => (
          <PCard key={p.id} icon="people" title={p.partner.name} tone={p.state === 'active' ? 'good' : 'busy'} sub={t(`rd.pact.${p.state}` as Key)}
            foot={v.may_share ? (
              <span className="dk-chips">
                {p.state === 'incoming' && <><button type="button" className="dk-chip all" disabled={busy} onClick={() => void act('accept', p.id)}>{t('rd.accept')}</button><button type="button" className="dk-chip" disabled={busy} onClick={() => void act('decline', p.id)}>{t('rd.decline')}</button></>}
                {p.state !== 'incoming' && <button type="button" className="dk-chip" disabled={busy} onClick={() => void act('end', p.id)}>{p.state === 'active' ? t('rd.end') : t('rd.withdraw')}</button>}
              </span>
            ) : undefined} />
        ))}
      </CardGrid>
      {v.may_share ? (
        (v.neighbours ?? []).length > 0 && <ActionButton tone="gold" small onClick={() => setPact('')}>{t('rd.offer')}</ActionButton>
      ) : <Hint>{t('rd.pact_gate')}</Hint>}

      {pact !== null && (
        <Popup open onClose={() => setPact(null)} tone="violet" title={t('rd.offer')} dismissible={!busy}>
          <Note>{t('rd.offer_help')}</Note>
          <CardGrid>
            {(v.neighbours ?? []).map((n) => <PCard key={n.code} icon="house" title={n.name} tone="busy" onClick={() => { setPact(null); void act('propose', n.code) }} />)}
          </CardGrid>
        </Popup>
      )}
      {back && <Btns ctx={ctx} list={[back]} />}
    </Page>
  )
})
