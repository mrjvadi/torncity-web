// The office form of a union's charter (ADR 0076 4.4): a title, seats and the powers the office holds, picked from the catalogue by group. The same form is used
// in the founding charter of a proposal and in editing an office of a standing union. Nobody gives a power they do not hold: powers outside `held` are locked.

import { useEffect, useMemo, useState } from 'react'
import type { CharterPermissionView, CharterView } from '../../api/views.gen'
import * as api from '../../api/client'
import { permName, groupName } from './Charter'
import { formatNumber } from '../../lib/persian'
import { money } from '../native/kit/format'
import { t } from '../../i18n'

export interface OfficeDraft {
  title: string
  seats: number
  /** permission code to its ceiling (0 = none) */
  grants: Record<string, number>
  /** public codes of the players who sit in it from the founding */
  holders: string[]
}

export const emptyOffice = (): OfficeDraft => ({ title: '', seats: 1, grants: {}, holders: [] })

let cache: CharterPermissionView[] | null = null

/** The settlement catalogue, for a founding charter (a standing union brings its own list, `UnionDetail.permissions`). */
export function useCatalogue(): CharterPermissionView[] | null {
  const [list, setList] = useState<CharterPermissionView[] | null>(cache)
  useEffect(() => {
    if (cache) return
    let live = true
    api.runCommand('settlement.charter.view', {}).then((r) => {
      const have = ((r.view as unknown as CharterView | undefined)?.permissions ?? [])
      cache = have
      if (live) setList(cache)
    }).catch(() => { if (live) setList([]) })
    return () => { live = false }
  }, [])
  return list
}

export function OfficeForm({ draft, onChange, held, withHolders, lockSeats, catalogue, delegations }: { draft: OfficeDraft; onChange: (d: OfficeDraft) => void; held?: string[]; withHolders?: boolean; lockSeats?: number; catalogue?: CharterPermissionView[] | null; delegations?: string[] | null }) {
  const own = useCatalogue()
  const cat = catalogue ?? own
  const [open, setOpen] = useState<string | null>(null)
  const groups = useMemo(() => {
    const m = new Map<string, CharterPermissionView[]>()
    for (const p of cat ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p])
    return [...m.entries()]
  }, [cat])
  const set = (p: Partial<OfficeDraft>) => onChange({ ...draft, ...p })
  const toggle = (p: CharterPermissionView) => {
    const g = { ...draft.grants }
    if (p.code in g) delete g[p.code]; else g[p.code] = 0
    set({ grants: g })
  }
  const chosen = Object.keys(draft.grants)
  return (
    <div className="ch-col">
      <label className="ch-field">
        <span>{t('pu.office.title')}</span>
        <input className="vd-input" value={draft.title} maxLength={32} onChange={(e) => set({ title: e.target.value })} aria-label={t('pu.office.title')} />
      </label>
      <div className="ch-field">
        <span>{t('pu.office.seats')}</span>
        <div className="ch-step">
          <button type="button" aria-label="-" disabled={draft.seats <= Math.max(1, lockSeats ?? 1)} onClick={() => set({ seats: draft.seats - 1 })}>−</button>
          <b>{formatNumber(draft.seats)}</b>
          <button type="button" aria-label="+" disabled={draft.seats >= 9} onClick={() => set({ seats: draft.seats + 1 })}>+</button>
        </div>
      </div>
      {withHolders && (
        <label className="ch-field">
          <span>{t('pu.office.holders')}</span>
          <input className="vd-input" dir="ltr" value={draft.holders.join(', ')} onChange={(e) => set({ holders: e.target.value.split(/[,،\s]+/).filter(Boolean) })} aria-label={t('pu.office.holders')} />
          <small className="pu-hint">{t('pu.office.holders_hint')}</small>
        </label>
      )}
      <div className="ch-groups">
        {cat === null && <p className="pn-hint">{t('common.loading')}</p>}
        {groups.map(([g, list]) => {
          const on = list.filter((p) => p.code in draft.grants).length
          const isOpen = open === g
          return (
            <div key={g} className="ch-group">
              <button type="button" className="ch-ghead" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g)}>
                <span>{groupName(g)}</span><em>{t('charter.group_count', { on: formatNumber(on), total: formatNumber(list.length) })}</em>
              </button>
              {isOpen && list.map((p) => {
                const handed = !p.class || !delegations || delegations.includes(p.class)
                const can = handed && (!held || held.includes(p.code))
                const checked = p.code in draft.grants
                return (
                  <div key={p.code} className={`ch-perm${can || checked ? '' : ' off'}`}>
                    <button type="button" role="switch" aria-checked={checked} disabled={!can && !checked} onClick={() => toggle(p)}>
                      <i className={checked ? 'on' : ''} />
                      <span>{permName(p.code)}{!p.active && <small>{t('charter.not_used')}</small>}</span>
                    </button>
                    {checked && p.limited && (
                      <input className="vd-input ch-limit" inputMode="numeric" dir="ltr" value={draft.grants[p.code] ? String(draft.grants[p.code]) : ''} placeholder={t('charter.no_ceiling')} aria-label={t('charter.ceiling')}
                        onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9]/g, '')) || 0; set({ grants: { ...draft.grants, [p.code]: n } }) }} />
                    )}
                    {!can && !checked && <small className="ch-lock">{handed ? t('charter.not_held') : t('pu.not_handed')}</small>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="ch-chips">
        {chosen.map((c) => <span key={c} className="nx-chip nx-chip-gold">{draft.grants[c] > 0 ? t('charter.perm_limit', { name: permName(c), limit: money(draft.grants[c]) }) : permName(c)}</span>)}
      </div>
      {chosen.length === 0 && <p className="pn-hint">{t('charter.sum_none')}</p>}
    </div>
  )
}

/** The grants of a draft as the command wants them. */
export const grantsOf = (d: OfficeDraft) => Object.entries(d.grants).map(([permission, limit]) => (limit > 0 ? { permission, limit } : { permission }))
