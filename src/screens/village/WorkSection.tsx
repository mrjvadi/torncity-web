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
const FIX: Record<string, Door | undefined> = { no_staff: 'village_labor', no_input: 'village_storage', storage_full: 'village_storage', employer_broke: 'village_overview', no_keeper: 'village_storage', budget_spent: 'village_labor' }

const word = (key: string, fallback: string, args?: Record<string, string | number>) => (hasKey(key) ? t(key as Key, args) : fallback)

export default function WorkSection({ work: w, names, onOpen, onClose }: {
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
  const reasons = (w.reasons ?? []).filter((r) => r.code !== 'no_function')
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
  return (
    <div className="wk">
      <Section>{t('work.title')}</Section>
      <EffectRow>
        <EffectChip tone={tone(w.status)}>{word(`work.status.${w.status}`, w.status)}</EffectChip>
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
          {!(job?.paused === r.code) && fix(r.code)}
        </div>
      ))}
      {w.status === 'idle' && !paused && w.if_unstaffed && <div className="gc-note">{word(`work.unstaffed.${w.if_unstaffed}`, '')}</div>}
    </div>
  )
}
