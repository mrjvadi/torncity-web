// «یورش و دیده‌بانی» and «بیمهٔ شهر» (ADR 0074): the raid screen (file a raid, join or stand, tribute, my raids with their outcome, the watch line) and the town's
// insurance. A neutral view: facts from the server, words ours; every act is a host write that answers the screen with a `notice`. Tone calm: nobody dies,
// a player is at risk only when he pressed join or stand.

import { useState } from 'react'
import type { RaidLine, RaidView, SettlementInsuranceView, WatchLine } from '../../api/views.gen'
import { Slab } from '../../kit'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, EffectRow, Note } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { roughDuration } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'

registerWrites(['settlement.raid', 'settlement.insurance'], (a) => !!a.args?.action)

const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)
const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`
const send = (ctx: FlowCtx, command: string, args: Record<string, string>) => ctx.go({ command, args, kind: 'secondary', id: command, icon: 'action:default' } as never)

function Outcome({ l }: { l: RaidLine }) {
  const o = l.outcome
  if (!o) return null
  const goods = (o.goods ?? []).map((g) => `${formatNumber(g.qty)} ${g.item.name}`).join('، ')
  return (
    <div className="rd-out">
      <b>{o.taken ? (l.side === 'attacker' ? t('rz.out.won') : t('rz.out.lost')) : (l.side === 'attacker' ? t('rz.out.failed') : t('rz.out.held'))}</b>
      {o.taken && <span>{t('rz.out.cash', { c: money(o.cash) })}{goods ? ` – ${goods}` : ''}</span>}
      {o.buildings > 0 && <span>{t('rz.out.buildings', { n: formatNumber(o.buildings), d: pct(o.damage) })}</span>}
      <span>{t('rz.out.units', { a: formatNumber(o.attacker_units), d: formatNumber(o.defender_units) })}</span>
      {o.falls > 0 && <span>{t('rz.out.falls', { n: formatNumber(o.falls) })}</span>}
      {o.fell_me && <span className="rd-fell">{t('rz.out.fell_me')}</span>}
    </div>
  )
}

function Mine({ l, v, ctx }: { l: RaidLine; v: RaidView; ctx: FlowCtx }) {
  const [tribute, setTribute] = useState('')
  const attacker = l.side === 'attacker'
  const live = l.status === 'filed' || l.status === 'open'
  const n = Number(tribute.replace(/[^0-9]/g, '')) || 0
  return (
    <div className={`rd-card ${live ? 'live' : ''}`}>
      <div className="rd-head"><b>{attacker ? t('rz.to', { who: l.other.name }) : t('rz.from', { who: l.other.name })}</b><EffectChip tone={l.status === 'open' ? 'bad' : live ? 'warn' : 'neutral'}>{word(`rz.status.${l.status}`, l.status)}</EffectChip></div>
      <div className="rd-sub">{l.start_at ? t('rz.starts', { at: atText(l.start_at) }) : ''}{l.end_at && l.status === 'open' ? ` – ${t('rz.ends', { at: atText(l.end_at) })}` : ''}</div>
      <div className="rd-sub">{t('rz.people', { r: formatNumber(l.raiders), j: formatNumber(l.joined), s: formatNumber(l.standing) })}{l.fee > 0 ? ` – ${t('rz.fee_paid', { f: money(l.fee) })}` : ''}</div>
      {!attacker && live && <Note tone={l.warned ? undefined : 'bad'}>{l.warned ? t('rz.warned', { by: word(`rz.by.${l.warned_by}`, ''), t: roughDuration(l.lead_secs) }) : t('rz.unwarned')}</Note>}
      {l.tribute > 0 && <div className="rd-sub">{t('rz.tribute_is', { m: money(l.tribute) })}</div>}
      {l.me && <EffectRow><EffectChip tone="warn">{attacker ? t('rz.me_ride') : t('rz.me_stand')}</EffectChip></EffectRow>}
      <div className="wk-btns">
        {l.can_join && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.raid', { action: 'join', code: l.id })}>{t('rz.join')}</ActionButton>}
        {l.can_stand && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.raid', { action: 'stand', code: l.id })}>{t('rz.stand')}</ActionButton>}
        {l.can_accept && <ActionButton tone="green" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.raid', { action: 'accept', code: l.id })}>{t('rz.accept', { m: money(l.tribute) })}</ActionButton>}
      </div>
      {(l.can_join || l.can_stand) && <Hint>{t('rz.risk')}</Hint>}
      {l.can_offer && (
        <div className="rd-form">
          <Hint>{t('rz.offer_hint', { min: money(v.tribute_min) })}</Hint>
          <input className="fx-field-input" dir="ltr" inputMode="numeric" value={tribute} placeholder={money(v.tribute_min)} onChange={(e) => setTribute(e.target.value)} aria-label={t('rz.tribute')} />
          <ActionButton tone="steel" small disabled={ctx.busy || n < v.tribute_min} onClick={() => send(ctx, 'settlement.raid', { action: 'offer', code: l.id, n: String(n) })}>{t('rz.offer')}</ActionButton>
        </div>
      )}
      <Outcome l={l} />
    </div>
  )
}

function FileForm({ v, target, ctx }: { v: RaidView; target: { code: string; name: string }; ctx: FlowCtx }) {
  const [lead, setLead] = useState(Math.max(v.min_lead_hours, 6))
  const [raiders, setRaiders] = useState(0)
  const [tr, setTr] = useState((v.transports ?? [])[0] ?? 'foot')
  const step = (val: number, d: number, lo: number, hi: number, set: (n: number) => void) => set(Math.min(hi, Math.max(lo, val + d)))
  const cost = v.fee + raiders * v.npc_raider_wage
  return (
    <div className="rd-form">
      <Hint>{t('rz.file_hint', { a: formatNumber(v.min_lead_hours), b: formatNumber(v.max_lead_hours), w: formatNumber(v.window_minutes) })}</Hint>
      <div className="lm-keeper-step"><button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={lead <= v.min_lead_hours} onClick={() => step(lead, -1, v.min_lead_hours, v.max_lead_hours, setLead)}>−</button><div className="lm-keeper-val">{t('rz.lead', { n: formatNumber(lead) })}</div><button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={lead >= v.max_lead_hours} onClick={() => step(lead, 1, v.min_lead_hours, v.max_lead_hours, setLead)}>+</button></div>
      <div className="lm-keeper-step"><button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={raiders <= 0} onClick={() => step(raiders, -1, 0, v.max_npc_raiders, setRaiders)}>−</button><div className="lm-keeper-val">{t('rz.raiders', { n: formatNumber(raiders) })}</div><button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={raiders >= v.max_npc_raiders} onClick={() => step(raiders, 1, 0, v.max_npc_raiders, setRaiders)}>+</button></div>
      <div className="rc-chips" role="radiogroup" aria-label={t('rz.transport')}>{(v.transports ?? []).map((x) => <button key={x} type="button" role="radio" aria-checked={x === tr} className={`dk-chip${x === tr ? ' all' : ''}`} onClick={() => setTr(x)}>{word(`rz.tr.${x}`, x)}</button>)}</div>
      <Hint>{t('rz.cost', { m: money(cost) })}</Hint>
      <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.raid', { action: 'file', code: target.code, n: String(lead), raiders: String(raiders), transport: tr })}>{t('rz.file_go', { who: target.name })}</ActionButton>
    </div>
  )
}

function Watch({ w }: { w: WatchLine }) {
  return (
    <div className="vf-line"><span>{word(`rz.watch.${w.kind}`, w.building.name)}</span><b>{w.held ? t('rz.watch_open', { m: formatNumber(w.sight_m) }) : w.idle ? word(`rz.idle.${w.idle}`, t('rz.idle.other')) : t('rz.watch_shut')}</b></div>
  )
}

export const Raid = flow<RaidView>(({ view: v, ctx }) => {
  const [pick, setPick] = useState('')
  if (!v.on) return <Page title={t('rz.title')} tone="ruby"><Panel><Lead>{t('rz.off')}</Lead><Hint>{v.starts_at ? t('rz.off_from', { at: atText(v.starts_at) }) : t('rz.off_hint')}</Hint></Panel></Page>
  const mine = v.mine ?? []
  const targets = v.targets ?? []
  const chosen = targets.find((x) => x.settlement.code === pick)
  return (
    <Page title={t('rz.title')} tone="ruby">
      {v.notice && hasKey(`rz.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`rz.notice.${v.notice}`)}</Lead></Panel>}
      <Panel><Hint>{t('rz.intro')}</Hint></Panel>
      <SectionTitle>{t('rz.mine')}</SectionTitle>
      <Panel>
        {mine.length === 0 && <Hint>{t('rz.mine_none')}</Hint>}
        <div className="rd-list">{mine.map((l) => <Mine key={l.id} l={l} v={v} ctx={ctx} />)}</div>
      </Panel>
      {v.may && (
        <>
          <SectionTitle>{t('rz.targets')}</SectionTitle>
          <Panel>
            <Hint>{t('rz.targets_hint', { fee: money(v.fee) })}</Hint>
            {targets.length === 0 && <Hint>{t('rz.targets_none')}</Hint>}
            <div className="rd-list">{targets.map((x) => (
              <div key={x.settlement.code} className={`rd-card${pick === x.settlement.code ? ' live' : ''}`}>
                <div className="rd-head"><b>{x.settlement.name}</b><span>{t('rz.km', { n: formatNumber(Math.round(x.distance_km)) })}</span></div>
                <div className="rd-sub">{t('rz.residents', { n: formatNumber(x.residents) })}</div>
                <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setPick(pick === x.settlement.code ? '' : x.settlement.code)}>{pick === x.settlement.code ? t('rz.pick_off') : t('rz.pick')}</ActionButton>
                {pick === x.settlement.code && chosen && <FileForm v={v} target={chosen.settlement} ctx={ctx} />}
              </div>
            ))}</div>
          </Panel>
        </>
      )}
      <SectionTitle>{t('rz.watch_title')}</SectionTitle>
      <Panel>
        {(v.watch ?? []).length === 0 && <Hint>{t('rz.watch_none')}</Hint>}
        <div className="vf-list">{(v.watch ?? []).map((w) => <Watch key={w.building.code} w={w} />)}</div>
        <Hint>{t('rz.watch_hint')}</Hint>
      </Panel>
    </Page>
  )
})

export const Insurance = flow<SettlementInsuranceView>(({ view: v, ctx }) => {
  const [lvl, setLvl] = useState(v.scale_bps)
  return (
    <Page title={t('in.title')} tone="sapphire">
      {v.notice && hasKey(`in.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`in.notice.${v.notice}`)}</Lead></Panel>}
      {!v.open ? (
        <Panel>
          <Lead>{t('in.closed')}</Lead><Hint>{t('in.closed_hint')}</Hint>
          {v.may_run && <Slab tone="gold" radius={12} lip={3} disabled={ctx.busy} onClick={() => send(ctx, 'settlement.insurance', { action: 'open' })}>{t('in.open_btn')}</Slab>}
        </Panel>
      ) : (
        <>
          <Panel>
            <div className="vf-list">
              <div className="vf-line"><span>{t('in.fund')}</span><b>{money(v.fund)}</b></div>
              <div className="vf-line"><span>{t('in.scale')}</span><b>{pct(v.scale_bps)}</b></div>
            </div>
            {v.may_run && (
              <div className="lm-keeper-step">
                <button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={lvl <= 5000} onClick={() => setLvl(Math.max(5000, lvl - 500))}>−</button>
                <div className="lm-keeper-val">{pct(lvl)}</div>
                <button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={lvl >= 20000} onClick={() => setLvl(Math.min(20000, lvl + 500))}>+</button>
              </div>
            )}
            {v.may_run && lvl !== v.scale_bps && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.insurance', { action: 'scale', n: String(lvl) })}>{t('in.scale_set', { p: pct(lvl) })}</ActionButton>}
            <Hint>{t('in.scale_hint')}</Hint>
          </Panel>
          <SectionTitle>{t('in.products')}</SectionTitle>
          <Panel>
            <div className="rd-list">
              {(v.products ?? []).map((p) => (
                <div key={p.product.code} className="rd-card">
                  <div className="rd-head"><b>{p.product.name}</b><EffectChip tone={p.held ? 'good' : 'neutral'}>{p.held ? t('in.held') : word(`in.covers.${p.covers}`, p.covers)}</EffectChip></div>
                  <div className="rd-sub">{t('in.line', { prem: money(p.premium), cover: pct(p.cover_bps), own: pct(p.deductible_bps) })}</div>
                  <div className="rd-sub">{t('in.cap', { m: money(p.max_claim), w: roughDuration(p.waiting_seconds) })}</div>
                  {!p.held && p.covers === 'raid_damage' ? (
                    <div className="wk-btns">{(p.targets ?? []).length === 0 ? <Hint>{t('in.no_building')}</Hint> : (p.targets ?? []).map((b) => <ActionButton key={b.code} tone="steel" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.insurance', { action: 'buy', code: p.product.code, n: b.code })}>{t('in.buy_for', { b: ctx.bname(b.code, b.name) })}</ActionButton>)}</div>
                  ) : !p.held && <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => send(ctx, 'settlement.insurance', { action: 'buy', code: p.product.code })}>{t('in.buy', { m: money(p.premium) })}</ActionButton>}
                </div>
              ))}
            </div>
          </Panel>
          {(v.policies ?? []).length > 0 && (
            <>
              <SectionTitle>{t('in.policies')}</SectionTitle>
              <Panel><div className="vf-list">{(v.policies ?? []).map((p) => <div key={p.no} className="vf-line"><span>{p.product.name}{p.building ? ` – ${ctx.bname(p.building.code, p.building.name)}` : ''}</span><b>{word(`in.status.${p.status}`, p.status)} – {money(p.paid)}</b></div>)}</div></Panel>
            </>
          )}
        </>
      )}
    </Page>
  )
})
