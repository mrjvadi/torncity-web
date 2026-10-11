// «کارگاه من» (ADR 0066), on the «کارکنان» tab of «مدیریت قطعهٔ من» for a workplace twin the viewer owns: the job he posted (crew, who works,
// wage, shifts left, why it stopped), what a shift takes from and gives to his own store, tools, room and food, and what it made today and
// since the start. Every act is an existing command: settlement.labor.post|hire|wage|close, settlement.work (he works it himself) and the repair job.

import { useEffect, useState } from 'react'
import * as api from '../../api/client'
import type { ApprenticeBounds, ApprenticesView, LotWorkplaceLine, LotStockLine, LotTakings, VillageNeed } from '../../api/views.gen'
import { ActionButton, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'

export interface WpResult { code: string; message: string; needs: VillageNeed[]; missing: number }

const HIRE = [1, 2, 4]
const WAGES = [100, 125, 150, 200]
const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`

function Stock({ list, names, inputs }: { list: LotStockLine[] | null; names: ContentNames; inputs: boolean }) {
  return (
    <div className="vf-list">
      {(list ?? []).map((s) => {
        const short = inputs && s.have < s.per_shift
        return (
          <div key={s.item.code} className="vf-line">
            <span>{names.name(['component', 'item'], s.item.code, s.item.name)}</span>
            <b className={short ? 'bad' : ''}>{t('wp.stock', { have: formatNumber(s.have), per: formatNumber(s.per_shift) })}</b>
          </div>
        )
      })}
    </div>
  )
}

function Takings({ title, x, names }: { title: string; x: LotTakings; names: ContentNames }) {
  const made = (x.produced ?? []).map((p) => `${formatNumber(p.qty)} ${names.name(['component', 'item'], p.item.code, p.item.name)}`).join('، ')
  return (
    <>
      <Section>{title}</Section>
      <StatGrid>
        <StatCard icon="hammer" palette="amber" label={t('wp.t.shifts')} value={formatNumber(x.shifts)} />
        <StatCard icon="coins" palette="gold" label={t('wp.t.value')} value={money(x.produced_value)} />
        <StatCard icon="people" palette="sapphire" label={t('wp.t.wages')} value={money(x.wages)} />
        <StatCard icon="coins" palette="ruby" label={t('wp.t.levy')} value={money(x.levy)} />
      </StatGrid>
      <div className="gc-note">{made ? t('wp.t.made', { list: made }) : t('wp.t.nothing')}</div>
    </>
  )
}

const DEFAULT_BOUNDS: ApprenticeBounds = { min_days: 7, max_days: 90, default_days: 28, max_fee: 5000, min_share_bps: 2000, default_share_bps: 5000, max_share_bps: 8000 }
const clampTo = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** A number with a minus and a plus inside its bounds (the same stepper as the keeper's pay). */
function Step({ label, value, min, max, step, show, onChange }: { label: string; value: number; min: number; max: number; step: number; show: (n: number) => string; onChange: (n: number) => void }) {
  return (
    <div className="tc-f">
      <span>{label} <em className="tc-range">{t('tc.range', { a: show(min), b: show(max) })}</em></span>
      <div className="lm-keeper-step">
        <button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={value <= min} onClick={() => onChange(clampTo(value - step, min, max))}>−</button>
        <div className="lm-keeper-val">{show(value)}</div>
        <button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={value >= max} onClick={() => onChange(clampTo(value + step, min, max))}>+</button>
      </div>
    </div>
  )
}

function ApprenticeForm({ busy, onOffer }: { busy: boolean; onOffer: (a: { player: string; days: number; fee: number; share: number }) => void }) {
  const [open, setOpen] = useState(false)
  const [bd, setBd] = useState<ApprenticeBounds>(DEFAULT_BOUNDS)
  const [player, setPlayer] = useState('')
  const [days, setDays] = useState(DEFAULT_BOUNDS.default_days)
  const [fee, setFee] = useState(0)
  const [share, setShare] = useState(DEFAULT_BOUNDS.default_share_bps)
  // the bounds are the server's: read once when the form opens
  useEffect(() => {
    if (!open) return
    let on = true
    api.runCommand('settlement.apprentice.mine', {}).then((r) => {
      const b = (r.view as unknown as ApprenticesView | undefined)?.bounds
      if (on && b) { setBd(b); setDays(b.default_days); setShare(b.default_share_bps); setFee(0) }
    }).catch(() => undefined)
    return () => { on = false }
  }, [open])
  const feeStep = Math.max(50, Math.round(bd.max_fee / 50 / 10) * 10)
  const pctOf = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`
  return (
    <div className="tc-offer">
      <Section>{t('tc.offer_title')}</Section>
      {!open ? <ActionButton tone="steel" small disabled={busy} onClick={() => setOpen(true)}>{t('tc.offer_open')}</ActionButton> : (
        <>
          <div className="gc-note">{t('tc.offer_note')}</div>
          <label className="tc-f"><span>{t('tc.f.player')}</span><input className="fx-field-input" dir="ltr" value={player} onChange={(e) => setPlayer(e.target.value.trim())} placeholder="P-XXXX" aria-label={t('tc.f.player')} /></label>
          <Step label={t('tc.f.days')} value={days} min={bd.min_days} max={bd.max_days} step={1} show={(n) => t('tc.days', { n: formatNumber(n) })} onChange={setDays} />
          <Step label={t('tc.f.fee')} value={fee} min={0} max={bd.max_fee} step={feeStep} show={(n) => (n > 0 ? money(n) : t('common.free'))} onChange={setFee} />
          <Step label={t('tc.f.share')} value={share} min={bd.min_share_bps} max={bd.max_share_bps} step={500} show={pctOf} onChange={setShare} />
          <ActionButton tone="gold" small disabled={busy || !player} onClick={() => onOffer({ player, days, fee, share })}>{t('tc.offer_send')}</ActionButton>
        </>
      )}
    </div>
  )
}

export default function WorkplaceCard({ w, lotId, manage, busy, condBps, names, onAct, onOffer }: {
  /** a master's offer to an apprentice (settlement.apprentice.offer): a player code, days, fee, share in basis points */
  onOffer?: (a: { player: string; days: number; fee: number; share: number }) => void
  w: LotWorkplaceLine; lotId: string; manage: boolean; busy: boolean; condBps: number; names: ContentNames
  /** runs a command; null when it went through, else the refusal */
  onAct: (command: string, args: Record<string, string>) => Promise<WpResult | null>
}) {
  const [refused, setRefused] = useState<WpResult | null>(null)
  const job = w.job
  const act = async (command: string, args: Record<string, string>) => { setRefused(null); setRefused(await onAct(command, args)) }
  const paused = job?.paused ?? ''
  const worn = paused === 'needs_repair' || condBps < 5000
  const pausedText = paused ? (hasKey(`wp.paused.${paused}`) ? t(`wp.paused.${paused}` as Key) : t('wp.paused.other')) : ''
  const refuseText = refused ? (hasKey(`wp.refuse.${refused.code}`) ? t(`wp.refuse.${refused.code}` as Key, { n: formatNumber(refused.missing) }) : refused.message) : ''
  const roomBad = w.room_needed > w.room_free
  const foodBad = w.food_per_shift > 0 && w.food_have < w.food_per_shift
  return (
    <div className="lm-keeper wp">
      <Section>{t('wp.title')}</Section>
      <Note>{job ? t('wp.job_open') : t('wp.job_none')}</Note>
      {job && (
        <StatGrid>
          <StatCard icon="people" palette="sapphire" label={t('wp.crew')} value={t('wp.crew_of', { crew: formatNumber(job.crew), slots: formatNumber(w.slots) })} />
          <StatCard icon="hammer" palette="emerald" label={t('wp.working')} value={formatNumber(job.working)} />
          <StatCard icon="coins" palette="gold" label={t('wp.wage')} value={money(job.wage)} />
          <StatCard icon="clock" palette="amber" label={t('wp.left')} value={formatNumber(job.shifts_left)} />
        </StatGrid>
      )}
      {pausedText && <Note tone="bad">{pausedText}</Note>}
      <div className="gc-note">{t('wp.shift_len', { n: formatNumber(w.shift_minutes) })}</div>

      <Section>{t('wp.inputs')}</Section>
      {(w.inputs ?? []).length ? <Stock list={w.inputs} names={names} inputs /> : <div className="gc-note">{t('wp.none_needed')}</div>}
      <Section>{t('wp.outputs')}</Section>
      <Stock list={w.outputs} names={names} inputs={false} />
      <div className="gc-note">{t('wp.store_note')}</div>

      <StatGrid>
        <StatCard icon="tool" palette="steel" label={t('wp.tools')} value={formatNumber(w.tools_have)} />
        <StatCard icon="chest" palette={roomBad ? 'ruby' : 'amber'} label={t('wp.room')} value={formatNumber(w.room_free)} />
        <StatCard icon="bread" palette={foodBad ? 'ruby' : 'emerald'} label={t('wp.food')} value={t('wp.food_of', { have: formatNumber(w.food_have), per: formatNumber(w.food_per_shift) })} />
      </StatGrid>
      {w.tool_wear_bps > 0 && <div className="gc-note">{t('wp.tool_wear', { n: formatNumber(Math.round(10000 / w.tool_wear_bps)) })}</div>}
      {roomBad && <Note tone="bad">{t('wp.room_short', { need: formatNumber(w.room_needed), free: formatNumber(w.room_free) })}</Note>}

      {refuseText && (
        <Note tone="bad">
          {refuseText}
          {refused && refused.needs.length > 0 && (
            <span className="wp-needs">{refused.needs.map((n) => `${names.name(['component', 'item'], n.item.code, n.item.name)} (${formatNumber(n.have)} ${t('wp.of')} ${formatNumber(n.need)})`).join('، ')}</span>
          )}
        </Note>
      )}

      {manage && (
        <div className="wk-btns">
          <ActionButton tone="green" small disabled={busy} onClick={() => void act('settlement.work', { id: lotId })}>{t('wp.work_self')}</ActionButton>
          {worn && <ActionButton tone="gold" small disabled={busy} onClick={() => void act('settlement.labor.post', { id: lotId, n: 'repair' })}>{t('wp.repair')}</ActionButton>}
          {!job && <ActionButton tone="gold" small disabled={busy} onClick={() => void act('settlement.labor.post', { id: lotId })}>{t('wp.post')}</ActionButton>}
        </div>
      )}
      {manage && job && (
        <>
          <Section>{t('wp.hire')}</Section>
          <div className="wk-btns">
            {HIRE.map((n) => <ActionButton key={n} tone="steel" small disabled={busy || n > w.slots} onClick={() => void act('settlement.labor.hire', { id: job.id, n: String(n) })}>{t('labor.hire_n', { n: formatNumber(n) })}</ActionButton>)}
            {job.crew > 0 && <ActionButton tone="steel" small disabled={busy} onClick={() => void act('settlement.labor.hire', { id: job.id, n: '0' })}>{t('labor.hire_none')}</ActionButton>}
          </div>
          <Section>{t('wp.wage_set')}</Section>
          <div className="wk-btns">
            {WAGES.map((p) => <ActionButton key={p} tone="steel" small disabled={busy} onClick={() => void act('settlement.labor.wage', { id: job.id, n: String(p) })}>{t('work.wage_pct', { p: formatNumber(p) })}</ActionButton>)}
          </div>
          <ActionButton tone="steel" small disabled={busy} onClick={() => void act('settlement.labor.close', { id: job.id })}>{t('wp.close')}</ActionButton>
        </>
      )}

      {manage && onOffer && <ApprenticeForm busy={busy} onOffer={onOffer} />}
      <Takings title={t('wp.today')} x={w.today} names={names} />
      <Takings title={t('wp.total')} x={w.total} names={names} />
      <div className="gc-note">{t('wp.value_note')}</div>
    </div>
  )
}
