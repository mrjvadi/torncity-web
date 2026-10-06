// The work block of a building's panel (W1, docs/ui/web-structure.md building panel): what the building does, whether
// someone works there, the posts as a row of seats, one shift (inputs -> outputs, time, wage), the labourers' crew and
// every reason it is held back, each with its way out. Codes and numbers come from `BuildingView.work`; the words are ours.

import type { WorkNode, WorkReason } from '../../api/views.gen'
import { EffectChip, EffectRow, Note, Section, ActionButton } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { words } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'

type Door = 'village_labor' | 'village_storage' | 'village_overview'
const tone = (s: string) => (s === 'working' ? 'good' : s === 'paused' ? 'bad' : 'warn')
const FIX: Record<string, Door | undefined> = { no_food: 'village_storage', no_staff: 'village_labor', no_input: 'village_storage', storage_full: 'village_storage', employer_broke: 'village_overview', no_keeper: 'village_storage', budget_spent: 'village_labor' }

const pct = (bps: number, dec = 0) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: dec }).format(bps / 100)}٪`
const word = (key: string, fallback: string, args?: Record<string, string | number>) => (hasKey(key) ? t(key as Key, args) : fallback)

export default function WorkSection({ work: w, names, onOpen, onClose, act, manage = false, buildingId = '' }: {
  /** runs a labour command for this building (post a repair, take a shift, hire a crew); the panel reloads after it */
  act?: (command: string, args: Record<string, string>) => void
  manage?: boolean
  buildingId?: string
  work: WorkNode
  names: ContentNames
  onOpen?: (screen: Door) => void
  onClose: () => void
}) {
  const goods = (i: { code: string; name: string }) => names.name(['component', 'item'], i.code, i.name)
  const className = (c: string) => word(`sm.st.class.${c}`, t('work.class.other'))
  if (w.kind === 'none') {
    return (
      <>
        <Section>{t('work.title')}</Section>
        <Note>{t('work.none')}</Note>
      </>
    )
  }
  const slots = w.slots ?? []
  const reasons = (w.reasons ?? []).filter((r) => r.code !== 'no_function' && r.code !== 'needs_repair' && r.code !== w.job?.paused)
  const job = w.job
  const line = (items: WorkNode['inputs']) => (items ?? []).map((l) => `${formatNumber(l.qty)} ${goods(l.item)}`).join('، ')
  const shift = [
    (w.inputs ?? []).length || (w.outputs ?? []).length ? (w.inputs ?? []).length ? `${line(w.inputs)} ← ${line(w.outputs) || t('work.nothing')}` : line(w.outputs) : '',
    w.shift_seconds > 0 ? words(w.shift_seconds) : '',
    w.wage > 0 ? t('work.wage', { n: money(w.wage) }) : '',
  ].filter(Boolean)
  const go = (d: Door) => { onClose(); onOpen?.(d) }
  const why = (r: WorkReason): string => {
    const a = { have: formatNumber(r.have), need: formatNumber(r.need), item: r.item ? goods(r.item) : '', class: className(r.class) }
    return word(`work.reason.${r.code}`, t('work.reason.other'), a)
  }
  const fix = (code: string) => {
    const d = FIX[code]
    return d && onOpen ? <ActionButton tone="steel" small onClick={() => go(d)}>{t(`work.fix.${code}` as Key)}</ActionButton> : null
  }
  const paused = w.status === 'paused' || !!job?.paused
  const cond = w.condition
  const closed = !!cond?.closed
  const rjob = cond?.repair_job ?? null
  const mats = (cond?.repair_materials ?? []).map((l) => `${formatNumber(l.qty)} ${goods(l.item)}`).join('، ')
  return (
    <div className="wk">
      <Section>{t('work.title')}</Section>
      <EffectRow>
        <EffectChip tone={closed ? 'bad' : tone(w.status)}>{closed ? t('work.status.closed') : word(`work.status.${w.status}`, w.status)}</EffectChip>
        <EffectChip tone="neutral">{word(`work.kind.${w.kind}`, t('work.kind.other'))}</EffectChip>
      </EffectRow>
      {w.max > 0 && (
        <div className="wk-seats" role="list" aria-label={t('work.seats', { filled: formatNumber(w.filled), max: formatNumber(w.max) })}>
          {Array.from({ length: w.max }, (_, i) => {
            const s = slots[i]
            const who = s && s.worker !== 'empty' ? s : null
            return (
              <div key={i} role="listitem" className={`wk-seat${who ? ' on' : ''}${who?.worker === 'npc' ? ' npc' : ''}`}>
                <b>{s ? word(`work.role.${s.role}`, names.name(['staff_role'], s.role, t('work.role.worker'))) : t('work.role.worker')}</b>
                <span>{who ? (who.worker === 'npc' ? t('work.npc') : who.name || t('work.player')) : t('work.empty')}</span>
              </div>
            )
          })}
        </div>
      )}
      {w.max > 0 && <div className="gc-note">{t('work.seats', { filled: formatNumber(w.filled), max: formatNumber(w.max) })}</div>}
      {shift.length > 0 && (
        <div className="wk-shift">
          <small>{t('work.shift')}</small>
          <div>{shift.join(' · ')}</div>
          {(w.outputs ?? []).length > 0 && w.storage_class && <small>{t('work.goes_to', { class: className(w.storage_class), free: formatNumber(w.storage_free) })}</small>}
        </div>
      )}
      {w.meal_points > 0 && (
        <>
          <div className="gc-note">{t('work.food', { n: formatNumber(w.meal_points), m: formatNumber(w.food_shifts) })}</div>
          {w.food_shifts === 0 && <Note tone="bad">{t('work.hungry')}</Note>}
        </>
      )}
      {cond && (
        <div className="wk-cond">
          <div className="wk-cond-head"><span>{t('work.cond')}</span><b>{pct(cond.bps)}</b></div>
          <div className={`wk-cond-bar${closed ? ' closed' : cond.bps < 5000 ? ' worn' : ''}`} role="img" aria-label={t('work.cond_aria', { p: pct(cond.bps) })}>
            <i style={{ width: `${Math.max(0, Math.min(100, cond.bps / 100))}%` }} />
            <u style={{ insetInlineStart: '25%' }} /><u style={{ insetInlineStart: '50%' }} />
          </div>
          <div className="wk-cond-legend"><span>{t('work.band.closed')}</span><span>{t('work.band.worn')}</span><span>{t('work.band.ok')}</span></div>
          <div className="gc-note">{t('work.output', { p: pct(cond.output_bps) })} · {t('work.decay', { p: pct(cond.decay_bps_per_day, 1) })}</div>
          {closed && <Note tone="bad">{t('work.closed')}</Note>}
        </div>
      )}
      {cond && (cond.can_repair || rjob || closed) && (
        <div className="wk-repair">
          <Section>{t('work.repair')}</Section>
          {!rjob && <Note>{t('work.repair_need', { n: formatNumber(cond.repair_shifts) })}{mats ? ` ${t('work.repair_mats', { list: mats })}` : ''}</Note>}
          {!rjob && cond.can_repair && manage && act && <ActionButton tone="gold" small onClick={() => act('settlement.labor.post', { id: buildingId, n: 'repair' })}>{t('work.repair_post')}</ActionButton>}
          {!rjob && cond.can_repair && !manage && <div className="gc-note">{t('work.repair_head')}</div>}
          {rjob && (
            <>
              <Note>{t('work.repair_job', { left: formatNumber(rjob.shifts_left), wage: money(rjob.wage), n: formatNumber(rjob.npc_crew) })}</Note>
              {rjob.paused && <Note tone="bad">{t('work.paused')} {word(`work.reason.${rjob.paused}`, t('work.reason.other'), { have: '', need: '', item: '', class: '' })}</Note>}
              {act && (
                <div className="wk-btns">
                  <ActionButton tone="green" small onClick={() => act('settlement.labor.take', { id: rjob.id })}>{t('work.repair_take')}</ActionButton>
                  {manage && [1, 2, 3].map((n) => <ActionButton key={n} tone="steel" small onClick={() => act('settlement.labor.hire', { id: rjob.id, n: String(n) })}>{t('labor.hire_n', { n })}</ActionButton>)}
                  {manage && rjob.npc_crew > 0 && <ActionButton tone="steel" small onClick={() => act('settlement.labor.hire', { id: rjob.id, n: '0' })}>{t('labor.hire_none')}</ActionButton>}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {job && (
        <Note>{t('work.crew', { n: formatNumber(job.npc_crew), wage: money(job.wage), left: formatNumber(job.shifts_left) })}</Note>
      )}
      {paused && (
        <Note tone="bad">
          {t('work.paused')}{job?.paused ? ` ${word(`work.reason.${job.paused}`, t('work.reason.other'), { have: '', need: '', item: '', class: '' })}` : ''}
        </Note>
      )}
      {job?.paused && fix(job.paused)}
      {reasons.map((r) => (
        <div key={r.code + (r.item?.code ?? r.class)} className="wk-reason">
          <span>{why(r)}</span>
          {r.code !== 'needs_repair' && !(job?.paused === r.code) && fix(r.code)}
        </div>
      ))}
      {w.status === 'idle' && !paused && w.if_unstaffed && <div className="gc-note">{word(`work.unstaffed.${w.if_unstaffed}`, '')}</div>}
    </div>
  )
}
