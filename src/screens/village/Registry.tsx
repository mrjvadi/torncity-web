// The land registry (ADR 0072; web map section «ثبت زمین»): my parcels with join and split, the town's zones and commons, the claimed tiles, the foundations and
// the slope bands, and the forms of the holders of zone.open, zone.close, land.claim and the foundation. Every act is asked first (a quote card with the price
// and a confirm) and then sent again with `confirm`; the answer is this screen with a notice. A zone binds only new buildings: the page says so.

import { useState } from 'react'
import type { LandRegistryView, ParcelLine, RegCell, ZoneLine } from '../../api/views.gen'
import { Slab } from '../../kit'
import { Btns, Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, EffectRow, Note } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'

registerWrites(['settlement.parcel.join', 'settlement.parcel.split', 'settlement.zone.open', 'settlement.zone.close', 'settlement.claim', 'settlement.foundation.lay'], (a) => !!a.args?.confirm || a.command === 'settlement.zone.close')

const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)
/** A lot as the server takes it: "x-y", an "m" before a negative number. */
export const lotToken = (x: number, y: number): string => `${x < 0 ? 'm' + -x : x}-${y < 0 ? 'm' + -y : y}`
const last = { command: '', args: {} as Record<string, string> }
const ask = (ctx: FlowCtx, command: string, args: Record<string, string>) => { last.command = command; last.args = args; ctx.go({ command, args, kind: 'secondary', id: command, icon: 'action:default' } as never) }
const cellText = (c: RegCell) => t('rg.cell', { x: formatNumber(c.x + 1), y: formatNumber(c.y + 1) })
const spanOf = (cells: RegCell[] | null): string => {
  const l = cells ?? []
  if (!l.length) return ''
  const xs = l.map((c) => c.x), ys = l.map((c) => c.y)
  const a = { x: Math.min(...xs), y: Math.min(...ys) }, b = { x: Math.max(...xs), y: Math.max(...ys) }
  return a.x === b.x && a.y === b.y ? cellText(a) : t('rg.span', { a: cellText(a), b: cellText(b) })
}
const kindName = (k: string) => word(`rg.kind.${k}`, k)

/** Two corner inputs of a rectangle of lots: «از خانهٔ (x، y) تا (x، y)». The numbers are the ones the land map shows (from 1). */
function Corners({ v, set }: { v: string[]; set: (n: string[]) => void }) {
  const f = (i: number, label: string) => <input className="fx-field-input rg-n" dir="ltr" inputMode="numeric" value={v[i]} aria-label={label} placeholder={label} onChange={(e) => { const n = [...v]; n[i] = e.target.value.replace(/[^0-9-]/g, ''); set(n) }} />
  return <div className="rg-corners"><span>{t('rg.from')}</span>{f(0, t('rg.col'))}{f(1, t('rg.row'))}<span>{t('rg.to')}</span>{f(2, t('rg.col'))}{f(3, t('rg.row'))}</div>
}
const corner = (v: string[]): { from: string; to: string } | null => {
  const n = v.map((x) => parseInt(x, 10))
  if (n.some((x) => !Number.isFinite(x))) return null
  return { from: lotToken(n[0] - 1, n[1] - 1), to: lotToken(n[2] - 1, n[3] - 1) }
}

function Parcel({ p, ctx, byId }: { p: ParcelLine; ctx: FlowCtx; byId: (id: string) => RegCell[] | null }) {
  const [split, setSplit] = useState(false)
  const [c, setC] = useState(['', '', '', ''])
  const cells = p.cells ?? []
  return (
    <div className={`rg-card${p.mine ? ' mine' : ''}`}>
      <div className="rg-head"><b>{p.treasury ? t('rg.commons') : p.mine ? t('rg.mine') : t('rg.of', { who: p.owner.name })}</b><span>{t('rg.cells', { n: formatNumber(cells.length) })}</span></div>
      <div className="rg-sub">{spanOf(cells)}{p.use ? ` – ${word(`rg.use.${p.use}`, p.use)}` : ''}</div>
      {p.zone && <EffectRow><EffectChip tone="neutral">{t('rg.in_zone', { name: p.zone.name })}</EffectChip></EffectRow>}
      {p.mine && (
        <div className="wk-btns">
          {(p.can_join ?? []).map((o) => <ActionButton key={o} tone="steel" small disabled={ctx.busy} onClick={() => ask(ctx, 'settlement.parcel.join', { parcel: p.id, with: o })}>{t('rg.join', { to: spanOf(byId(o)) || o })}</ActionButton>)}
          {p.can_split && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => setSplit(!split)}>{t('rg.split')}</ActionButton>}
        </div>
      )}
      {split && p.can_split && (
        <div className="rg-form">
          <Hint>{t('rg.split_hint')}</Hint>
          <Corners v={c} set={setC} />
          <ActionButton tone="gold" small disabled={ctx.busy || !corner(c)} onClick={() => { const k = corner(c)!; ask(ctx, 'settlement.parcel.split', { parcel: p.id, from: k.from, to: k.to }) }}>{t('rg.split_go')}</ActionButton>
        </div>
      )}
    </div>
  )
}

function Zone({ z, ctx }: { z: ZoneLine; ctx: FlowCtx }) {
  return (
    <div className="rg-card">
      <div className="rg-head"><b>{z.name}</b><span>{t('rg.cells', { n: formatNumber(z.cells) })}</span></div>
      <div className="rg-sub">{kindName(z.kind)} – {z.effective ? t('rg.zone_on') : t('rg.zone_notice', { at: atText(z.effective_at) })}{z.opened_by.name ? ` – ${t('rg.opened_by', { who: z.opened_by.name })}` : ''}</div>
      {z.can_close && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ask(ctx, 'settlement.zone.close', { zone: z.id })}>{t('rg.zone_close')}</ActionButton>}
    </div>
  )
}

function ZoneForm({ v, ctx }: { v: LandRegistryView; ctx: FlowCtx }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState((v.zone_kinds ?? [])[0] ?? '')
  const [c, setC] = useState(['', '', '', ''])
  if (!open) return <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => setOpen(true)}>{t('rg.zone_open')}</ActionButton>
  return (
    <div className="rg-form">
      <Hint>{t('rg.zone_binds')}</Hint>
      <label className="tc-f"><span>{t('rg.zone_name')}</span><input className="fx-field-input" dir="auto" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label={t('rg.zone_name')} /></label>
      <div className="tc-f"><span>{t('rg.zone_kind')}</span>
        <div className="rc-chips" role="radiogroup" aria-label={t('rg.zone_kind')}>{(v.zone_kinds ?? []).map((k) => <button key={k} type="button" role="radio" aria-checked={k === kind} className={`dk-chip${k === kind ? ' all' : ''}`} onClick={() => setKind(k)}>{kindName(k)}</button>)}</div>
      </div>
      <div className="tc-f"><span>{t('rg.zone_lots', { n: formatNumber(v.zone_max_cells) })}</span><Corners v={c} set={setC} /></div>
      <Hint>{t('rg.zone_fee', { fee: money(v.zone_open_fee) })}</Hint>
      <ActionButton tone="gold" small disabled={ctx.busy || !name.trim() || !kind || !corner(c)} onClick={() => { const k = corner(c)!; ask(ctx, 'settlement.zone.open', { name: name.trim(), kind, from: k.from, to: k.to }) }}>{t('rg.zone_ask')}</ActionButton>
    </div>
  )
}

function LotAct({ title, hint, label, command, ctx }: { title: string; hint: string; label: string; command: string; ctx: FlowCtx }) {
  const [c, setC] = useState(['', ''])
  const ok = c.every((x) => /^-?\d+$/.test(x))
  return (
    <div className="rg-form">
      <div className="rg-head"><b>{title}</b></div>
      <Hint>{hint}</Hint>
      <div className="rg-corners"><input className="fx-field-input rg-n" dir="ltr" inputMode="numeric" value={c[0]} placeholder={t('rg.col')} aria-label={t('rg.col')} onChange={(e) => setC([e.target.value.replace(/[^0-9-]/g, ''), c[1]])} /><input className="fx-field-input rg-n" dir="ltr" inputMode="numeric" value={c[1]} placeholder={t('rg.row')} aria-label={t('rg.row')} onChange={(e) => setC([c[0], e.target.value.replace(/[^0-9-]/g, '')])} /></div>
      <ActionButton tone="steel" small disabled={ctx.busy || !ok} onClick={() => ask(ctx, command, { lot: lotToken(parseInt(c[0], 10) - 1, parseInt(c[1], 10) - 1) })}>{label}</ActionButton>
    </div>
  )
}

/** The command and arguments a quote is confirmed with: the ones just asked, else rebuilt from the quote itself (a reload, or a quote opened from a ring verb). */
function confirmOf(q: NonNullable<LandRegistryView['quote']>): { command: string; args: Record<string, string> } | null {
  if (last.command && `settlement:${last.command.replace(/^settlement\./, '')}` === q.act) return { command: last.command, args: last.args }
  const command = q.act.replace(':', '.')
  const a = q.args ?? []
  if (q.act.endsWith('claim') || q.act.endsWith('foundation.lay')) return q.lot ? { command, args: { lot: lotToken(q.lot.x, q.lot.y) } } : null
  if (q.act.endsWith('parcel.join') && a.length >= 2) return { command, args: { parcel: a[0], with: a[1] } }
  if (q.act.endsWith('parcel.split') && a.length >= 3) return { command, args: { parcel: a[0], from: a[1], to: a[2] } }
  return null
}

export const Registry = flow<LandRegistryView>(({ view: v, ctx }) => {
  const q = v.quote
  const mine = (v.parcels ?? []).filter((p) => p.mine)
  const others = (v.parcels ?? []).filter((p) => !p.mine)
  const byId = (id: string) => (v.parcels ?? []).find((p) => p.id === id)?.cells ?? null
  return (
    <Page title={t('rg.title')} tone="gold">
      {v.notice && hasKey(`rg.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone="good">{word(`rg.notice.${v.notice}`)}</Lead></Panel>}
      {q && (
        <Panel tone="gold">
          <Lead>{word(`rg.quote.${q.act.replace('settlement:', '')}`, t('rg.quote.other'))}</Lead>
          <div className="vf-list">
            <div className="vf-line"><span>{t('rg.q.cost')}</span><b>{money(q.money)}</b></div>
            {q.cells > 0 && <div className="vf-line"><span>{t('rg.q.cells')}</span><b>{formatNumber(q.cells)}</b></div>}
            {q.stone_need > 0 && <div className="vf-line"><span>{t('rg.q.stone')}</span><b>{t('rg.q.stone_v', { need: formatNumber(q.stone_need), have: formatNumber(q.stone_have), buy: formatNumber(q.stone_buy) })}</b></div>}
            <div className="vf-line"><span>{t('rg.q.cash')}</span><b className={q.cash < q.money ? 'bad' : ''}>{money(q.cash)}</b></div>
          </div>
          {q.cash < q.money && <Note tone="bad">{t('rg.q.poor')}</Note>}
          <div className="wk-btns">
            <ActionButton tone="gold" disabled={ctx.busy || q.cash < q.money || !confirmOf(q)} onClick={() => { const c = confirmOf(q); if (c) ctx.go({ command: c.command, args: { ...c.args, confirm: 'confirm' }, kind: 'confirm', id: 'confirm', icon: 'action:default' } as never) }}>{t('rg.q.confirm', { cost: money(q.money) })}</ActionButton>
            <ActionButton tone="steel" disabled={ctx.busy} onClick={() => ctx.run('settlement.land.registry')}>{t('rg.q.cancel')}</ActionButton>
          </div>
        </Panel>
      )}

      {(!v.zoning_on || !v.slope_on) && (
        <Panel>
          {!v.zoning_on && <Hint>{v.zoning_starts_at ? t('rg.rule.zoning_from', { at: atText(v.zoning_starts_at) }) : t('rg.rule.zoning_off')}</Hint>}
          {!v.slope_on && <Hint>{v.slope_starts_at ? t('rg.rule.slope_from', { at: atText(v.slope_starts_at) }) : t('rg.rule.slope_off')}</Hint>}
        </Panel>
      )}

      <SectionTitle>{t('rg.parcels')}</SectionTitle>
      <Panel>
        {mine.length === 0 && <Hint>{t('rg.parcels_none')}</Hint>}
        <div className="rg-list">{mine.map((p) => <Parcel key={p.id} p={p} ctx={ctx} byId={byId} />)}</div>
        {mine.length > 0 && <Hint>{t('rg.parcel_fee', { fee: money(v.parcel_change_fee), n: formatNumber(v.parcel_max_cells) })}</Hint>}
      </Panel>

      <SectionTitle>{t('rg.zones')}</SectionTitle>
      <Panel>
        <Hint>{t('rg.zone_binds')}</Hint>
        {(v.zones ?? []).length === 0 && <Hint>{t('rg.zones_none')}</Hint>}
        <div className="rg-list">{(v.zones ?? []).map((z) => <Zone key={z.id} z={z} ctx={ctx} />)}</div>
        {others.filter((p) => p.treasury).length > 0 && <Hint>{t('rg.commons_n', { n: formatNumber(others.filter((p) => p.treasury).reduce((a, p) => a + (p.cells ?? []).length, 0)) })}</Hint>}
        {v.can_zone && <ZoneForm v={v} ctx={ctx} />}
      </Panel>

      <SectionTitle>{t('rg.claims')}</SectionTitle>
      <Panel>
        {(v.claims ?? []).length === 0 && <Hint>{t('rg.claims_none')}</Hint>}
        <div className="vf-list">{(v.claims ?? []).map((c) => <div key={c.id} className="vf-line"><span>{t('rg.tile', { x: formatNumber(c.gx), y: formatNumber(c.gy) })}</span><b>{c.paid_through ? t('rg.paid_to', { at: atText(c.paid_through) }) : ''}</b></div>)}</div>
        {(v.claims ?? []).length > 0 && <Hint>{t('rg.claim_upkeep', { fee: money(v.claim_upkeep_per_day) })}</Hint>}
        {v.can_claim && <LotAct title={t('rg.claim_title')} hint={t('rg.claim_hint', { cost: money(v.claim_cost), n: formatNumber(v.claim_max_tiles) })} label={t('rg.claim_ask')} command="settlement.claim" ctx={ctx} />}
      </Panel>

      <SectionTitle>{t('rg.ground')}</SectionTitle>
      <Panel>
        <div className="vf-list">
          <div className="vf-line"><span>{t('rg.band.flat')}</span><b>{t('rg.band_flat', { n: formatNumber(v.slope_flat_m) })}</b></div>
          <div className="vf-line"><span>{t('rg.band.gentle')}</span><b>{t('rg.band_gentle', { a: formatNumber(v.slope_flat_m), b: formatNumber(v.slope_gentle_m) })}</b></div>
          <div className="vf-line"><span>{t('rg.band.steep')}</span><b>{t('rg.band_steep', { a: formatNumber(v.slope_gentle_m), b: formatNumber(v.slope_unusable_m) })}</b></div>
          <div className="vf-line"><span>{t('rg.band.none')}</span><b>{t('rg.band_none', { n: formatNumber(v.slope_unusable_m) })}</b></div>
        </div>
        <Hint>{t('rg.ground_hint')}</Hint>
        <div className="gc-note">{t('rg.foundations', { n: formatNumber(v.foundations) })}</div>
        {v.can_lay_foundation && <LotAct title={t('rg.found_title')} hint={t('rg.found_hint', { stone: formatNumber(v.foundation_stone), wage: money(v.foundation_wage) })} label={t('rg.found_ask')} command="settlement.foundation.lay" ctx={ctx} />}
      </Panel>
      <Btns ctx={ctx} list={[]} />
      <Slab tone="steel" radius={12} lip={3} onClick={() => ctx.run('settlement.land')}>{t('rg.buy_land')}</Slab>
    </Page>
  )
})
