// The charter (web map section 8, «شهرداری» tile and the city panel): the offices the players created, who holds them and
// what each may do, the creating and editing of an office (title, seats, permission set), appointing, dismissing and
// resigning, and the append-only audit. Every act is shown only to someone who holds its permission (bootstrap
// `permissions`, owner rule P28); the server checks again and nobody can grant a permission they do not hold. Offices a
// viewer cannot change are shown read-only, with who holds them. Popups are centred (never a sheet); on a desktop the
// editor is two columns: the permissions on one side, the summary on the other.

import { useMemo, useState } from 'react'
import Popup, { ActionButton, ActionRow, Note, Section } from '../../ui/Popup'
import { CardGrid, PCard, PRow, PSec } from '../../ui/v6/panel'
import { Empty, Header, ScreenScroll } from '../native/kit/Parts'
import { money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'
import { fa } from '../../ui/v6/format'
import { holds } from '../../lib/permissions'
import { atText, deviceZone, zoneClock, zoneLabel } from '../../lib/duration'
import { useNow } from '../../village/useVillage'
import { useToast } from '../../state/ToastContext'
import { useVillageCommand } from '../../village/useVillage'
import type { ScreenProps } from '../types'
import type { CommandArgs } from '../../api/client'
import type { CharterGrantView, CharterOfficeView, CharterPermissionView, CharterView } from '../../api/views.gen'
import { useVillageView } from './common'
import './village.css'

const permKey = (code: string) => `charter.perm.${code.replace(':', '.')}`
/** A permission or group the client has no word for is never shown as its code. */
const permName = (code: string) => (hasKey(permKey(code)) ? t(permKey(code) as Key) : t('charter.perm.other'))
const groupName = (g: string) => (hasKey(`charter.group.${g}`) ? t(`charter.group.${g}` as Key) : t('charter.group.other'))
const howName = (a: string) => (hasKey(`charter.how.${a}`) ? t(`charter.how.${a}` as Key) : t('charter.how.appointment'))
const actionName = (a: string, title: string) => (hasKey(`charter.action.${a}`) ? t(`charter.action.${a}` as Key, { title }) : t('charter.action.other', { title }))
const grantText = (g: CharterGrantView) => (g.limit > 0 ? t('charter.perm_limit', { name: permName(g.permission), limit: money(g.limit) }) : permName(g.permission))

/** When an audit line happened, as a rough "N ago". */
function agoText(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  const [n, unit] = s >= 86400 ? [Math.round(s / 86400), 'd'] : s >= 3600 ? [Math.round(s / 3600), 'h'] : [Math.max(1, Math.round(s / 60)), 'm']
  return t('common.ago', { t: t(`time.${unit}` as Key, { n }) })
}

export default function Charter({ response }: ScreenProps) {
  const { view: v, loading, refresh } = useVillageView<CharterView>('settlement.charter.view', response)
  const cmd = useVillageCommand()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null) // an office's key
  const [edit, setEdit] = useState<CharterOfficeView | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [zoneOpen, setZoneOpen] = useState(false)
  const now = useNow(30_000)

  const offices = v?.offices ?? []
  const mine = v?.mine ?? []
  const officeOf = (key: string | null) => (key === null ? undefined : offices.find((o) => (o.id || 'founder') === key))
  const current = officeOf(open)

  async function act(command: string, args: CommandArgs): Promise<boolean> {
    setBusy(true)
    const r = await cmd(command, args, { write: true })
    setBusy(false)
    if (!r.ok) return false
    const c = r.res?.view as { action?: string; title?: string } | undefined
    if (c?.action) toast.push(actionName(c.action, c.title ?? ''), { kind: 'success' })
    await refresh()
    return true
  }

  return (
    <ScreenScroll>
      <Header title={t('charter.title')} />
      {loading && !v && <Empty>{t('common.loading')}</Empty>}
      {v && (
        <>
          <PSec>{t('charter.offices')}</PSec>
          {offices.length === 0 && <Empty>{t('charter.none')}</Empty>}
          <CardGrid>
            {offices.map((o) => (
              <PCard
                key={o.id || 'founder'} icon={o.founder ? 'banner' : 'people'} title={o.title}
                sub={t('charter.seats', { filled: formatNumber(o.seats - o.open), seats: formatNumber(o.seats) })}
                badge={o.mine ? t('charter.mine_badge') : o.founder ? t('charter.founder') : undefined} tone={o.mine ? 'good' : undefined}
                facts={(o.holders ?? []).length ? (o.holders ?? []).map((h) => h.name).join('، ') : t('charter.vacant')}
                onClick={() => setOpen(o.id || 'founder')}
              />
            ))}
          </CardGrid>
          {v.can_create && (
            <div className="ch-new">
              <ActionButton tone="gold" onClick={() => setEdit('new')}>{t('charter.new')}</ActionButton>
            </div>
          )}

          <PSec>{t('charter.zone')}</PSec>
          <div className="ch-zone">
            <p><b>{zoneLabel(v.zone_minutes)}</b> · {t('charter.zone_now', { at: fa(zoneClock(now, v.zone_minutes)) })}</p>
            {v.zone_minutes !== deviceZone() && <p className="pn-hint">{t('charter.zone_device', { zone: zoneLabel(deviceZone()) })}</p>}
            <p className="pn-hint">{t('charter.zone_what')}</p>
            {holds(mine.map((g) => g.permission), 'settings.timezone') && (
              <>
                <ActionButton tone="gold" disabled={!v.can_set_zone} onClick={() => setZoneOpen(true)}>{t('charter.zone_change')}</ActionButton>
                {!v.can_set_zone && v.zone_next_change && <p className="pn-hint">{t('charter.zone_cooldown', { at: atText(v.zone_next_change, now) })}</p>}
              </>
            )}
          </div>

          <PSec>{t('charter.mine')}</PSec>
          {mine.length === 0 ? <p className="pn-hint">{t('charter.mine_none')}</p> : (
            <div className="ch-chips">{mine.map((g) => <span key={g.permission} className="nx-chip nx-chip-gold">{grantText(g)}</span>)}</div>
          )}

          <PSec>{t('charter.audit')}</PSec>
          {(v.audit ?? []).length === 0 && <p className="pn-hint">{t('charter.audit_none')}</p>}
          <div className="ch-audit">
            {(v.audit ?? []).map((a, i) => (
              <PRow key={i} icon="scroll" title={actionName(a.action, a.title)} sub={`${a.actor} · ${agoText(a.at)}`} />
            ))}
          </div>

          {current && (
            <OfficePopup
              o={current} v={v} busy={busy} onClose={() => setOpen(null)}
              onEdit={() => { setEdit(current); setOpen(null) }}
              onClose_={async () => { if (await act('settlement.charter.office.close', { office: current.id })) setOpen(null) }}
              onAppoint={async (player) => { await act('settlement.charter.appoint', { office: current.id, player }) }}
              onDismiss={async (player) => { await act('settlement.charter.dismiss', { office: current.id, player }) }}
              onResign={async () => { if (await act('settlement.charter.resign', { office: current.id })) setOpen(null) }}
            />
          )}
          {zoneOpen && (
            <ZonePopup
              current={v.zone_minutes} busy={busy} onClose={() => setZoneOpen(false)}
              onSave={async (offset) => { if (await act('settlement.timezone.set', { offset_minutes: offset })) setZoneOpen(false) }}
            />
          )}
          {edit && (
            <EditPopup
              v={v} office={edit === 'new' ? null : edit} busy={busy} onClose={() => setEdit(null)}
              onSave={async (args) => { if (await act('settlement.charter.office.save', args)) setEdit(null) }}
            />
          )}
        </>
      )}
      {!v && !loading && <Note>{t('common.load_failed')}</Note>}
    </ScreenScroll>
  )
}

// -- one office: who holds it, what it may do, and the acts the viewer's permissions allow -------------------------------

function OfficePopup({ o, v, busy, onClose, onEdit, onClose_, onAppoint, onDismiss, onResign }: {
  o: CharterOfficeView; v: CharterView; busy: boolean; onClose: () => void; onEdit: () => void; onClose_: () => void
  onAppoint: (player: string) => void; onDismiss: (player: string) => void; onResign: () => void
}) {
  const [who, setWho] = useState('')
  const holders = o.holders ?? []
  const canEdit = v.can_edit
  return (
    <Popup
      onClose={onClose} title={o.title} tone="navy" dismissible={!busy}
      footer={(canEdit || o.mine || (v.can_edit && !o.founder)) ? (
        <ActionRow>
          {o.mine && <ActionButton tone="steel" small disabled={busy} onClick={onResign}>{t('charter.resign')}</ActionButton>}
          {v.can_edit && !o.founder && <ActionButton tone="red" small disabled={busy} onClick={onClose_}>{t('charter.close_office')}</ActionButton>}
          {canEdit && <ActionButton tone="gold" disabled={busy} onClick={onEdit}>{t('charter.edit')}</ActionButton>}
        </ActionRow>
      ) : undefined}
    >
      <Note>{t('charter.office_line', { how: howName(o.acquisition), filled: formatNumber(o.seats - o.open), seats: formatNumber(o.seats) })}</Note>
      <Section>{t('charter.holders')}</Section>
      {holders.length === 0 && <p className="pn-hint">{t('charter.vacant')}</p>}
      <div className="ch-list">
        {holders.map((h) => (
          <div key={h.code} className="ch-holder">
            <span className="ch-name">{h.name}<small dir="ltr" data-latin>{h.code}</small></span>
            {v.can_dismiss && <ActionButton tone="red" small disabled={busy} onClick={() => onDismiss(h.code)}>{t('charter.dismiss')}</ActionButton>}
          </div>
        ))}
      </div>
      {v.can_appoint && o.open > 0 && o.acquisition !== 'election' && (
        <div className="ch-appoint">
          <input className="vd-input" dir="ltr" value={who} placeholder={t('charter.player_code')} aria-label={t('charter.player_code')} onChange={(e) => setWho(e.target.value)} />
          <ActionButton tone="green" disabled={busy || who.trim().length < 3} onClick={() => { onAppoint(who.trim()); setWho('') }}>{t('charter.appoint')}</ActionButton>
        </div>
      )}
      <Section>{t('charter.may')}</Section>
      <div className="ch-chips">
        {(o.grants ?? []).map((g) => <span key={g.permission} className="nx-chip nx-chip-gold">{grantText(g)}</span>)}
      </div>
    </Popup>
  )
}

// -- the editor: title, seats, permissions grouped; only permissions the editor holds can be switched on ----------------

function EditPopup({ v, office, busy, onClose, onSave }: {
  v: CharterView; office: CharterOfficeView | null; busy: boolean; onClose: () => void; onSave: (args: CommandArgs) => void
}) {
  const lim = v.limits
  const mine = v.mine ?? []
  const founder = !!office?.founder
  const [title, setTitle] = useState(office?.title ?? '')
  const [seats, setSeats] = useState(office?.seats ?? 1)
  const [grants, setGrants] = useState<Record<string, number>>(() => Object.fromEntries((office?.grants ?? []).map((g) => [g.permission, g.limit])))
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const groups = useMemo(() => {
    const m = new Map<string, CharterPermissionView[]>()
    for (const p of v.permissions ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p])
    return [...m.entries()]
  }, [v.permissions])
  const heldLimit = (code: string) => mine.find((g) => g.permission === code)?.limit ?? 0
  const selected = Object.keys(grants)
  const titleOk = title.trim().length >= lim.title_min && title.trim().length <= lim.title_max
  // a ceiling you hold caps what you may give; an unlimited holder may give any ceiling or none
  const limitOk = (p: CharterPermissionView) => {
    const own = heldLimit(p.code), set = grants[p.code] ?? 0
    return own === 0 || (set > 0 && set <= own)
  }
  const valid = titleOk && selected.length <= lim.max_permissions && (founder || (v.permissions ?? []).filter((p) => p.code in grants).every(limitOk))

  function toggle(p: CharterPermissionView) {
    setGrants((g) => {
      const n = { ...g }
      if (p.code in n) delete n[p.code]
      else n[p.code] = p.limited ? heldLimit(p.code) : 0
      return n
    })
  }

  return (
    <Popup
      onClose={onClose} title={t(office ? 'charter.edit_title' : 'charter.new_title')} tone="navy" dismissible={!busy}
      footer={
        <ActionButton tone="green" busy={busy} disabled={!valid} onClick={() => onSave({
          office: office?.id ?? '', title: title.trim(), seats, acquisition: 'appointment',
          grants: Object.entries(grants).map(([permission, limit]) => (limit > 0 ? { permission, limit } : { permission })),
        })}>{t('charter.save')}</ActionButton>
      }
    >
      <div className="ch-edit">
        <div className="ch-col">
          <label className="ch-field">
            <span>{t('charter.field.title')}</span>
            <input className="vd-input" value={title} maxLength={lim.title_max} onChange={(e) => setTitle(e.target.value)} aria-label={t('charter.field.title')} />
          </label>
          {!titleOk && title.length > 0 && <p className="pn-hint pn-bad">{t('charter.title_range', { min: formatNumber(lim.title_min), max: formatNumber(lim.title_max) })}</p>}
          {(
            <div className="ch-field">
              <span>{t('charter.field.seats')}</span>
              <div className="ch-step">
                <button type="button" aria-label="-" disabled={founder || seats <= Math.max(1, (office?.holders ?? []).length)} onClick={() => setSeats((n) => n - 1)}>−</button>
                <b>{formatNumber(seats)}</b>
                <button type="button" aria-label="+" disabled={founder || seats >= lim.max_seats} onClick={() => setSeats((n) => n + 1)}>+</button>
              </div>
            </div>
          )}
          <Section>{t('charter.field.perms')}</Section>
          {founder && <p className="pn-hint">{t('charter.founder_note')}</p>}
          <div className="ch-groups">
            {groups.map(([g, list]) => {
              const on = list.filter((p) => p.code in grants).length
              const isOpen = openGroup === g
              return (
                <div key={g} className="ch-group">
                  <button type="button" className="ch-ghead" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? null : g)}>
                    <span>{groupName(g)}</span><em>{t("charter.group_count", { on: formatNumber(on), total: formatNumber(list.length) })}</em>
                  </button>
                  {isOpen && list.map((p) => {
                    const can = !founder && holds(mine.map((x) => x.permission), p.code)
                    const checked = p.code in grants
                    return (
                      <div key={p.code} className={`ch-perm${can || checked ? '' : ' off'}`}>
                        <button type="button" role="switch" aria-checked={checked} disabled={!can} onClick={() => toggle(p)}>
                          <i className={checked ? 'on' : ''} />
                          <span>{permName(p.code)}{!p.active && <small>{t('charter.not_used')}</small>}</span>
                        </button>
                        {checked && p.limited && !founder && (
                          <input
                            className="vd-input ch-limit" inputMode="numeric" dir="ltr" value={grants[p.code] ? String(grants[p.code]) : ''}
                            placeholder={t('charter.no_ceiling')} aria-label={t('charter.ceiling')}
                            onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9]/g, '')) || 0; setGrants((m) => ({ ...m, [p.code]: n })) }}
                          />
                        )}
                        {!can && !checked && <small className="ch-lock">{t('charter.not_held')}</small>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <div className="ch-col ch-sum">
          <Section>{t('charter.summary')}</Section>
          <p className="ch-sum-title">{title.trim() || t('charter.untitled')}</p>
          <p className="pn-hint">{t('charter.sum_seats', { n: formatNumber(seats) })}</p>
          <div className="ch-chips">
            {selected.map((c) => <span key={c} className="nx-chip nx-chip-gold">{grants[c] > 0 ? t('charter.perm_limit', { name: permName(c), limit: money(grants[c]) }) : permName(c)}</span>)}
          </div>
          {selected.length === 0 && <p className="pn-hint">{t('charter.sum_none')}</p>}
        </div>
      </div>
    </Popup>
  )
}

/** The time zone picker: a list of UTC offsets in 15-minute steps, with the local clock each one would give. */
function ZonePopup({ current, busy, onClose, onSave }: { current: number; busy: boolean; onClose: () => void; onSave: (offset: number) => void }) {
  const [offset, setOffset] = useState(current)
  const now = Date.now()
  const options = useMemo(() => Array.from({ length: (840 + 720) / 15 + 1 }, (_, i) => -720 + i * 15), [])
  return (
    <Popup
      onClose={onClose} title={t('charter.zone_change')} tone="navy" dismissible={!busy}
      footer={<ActionButton tone="green" busy={busy} disabled={offset === current} onClick={() => onSave(offset)}>{t('charter.save')}</ActionButton>}
    >
      <Note>{t('charter.zone_warn')}</Note>
      <label className="ch-field">
        <span>{t('charter.zone')}</span>
        <select className="vd-input ch-select" dir="ltr" value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label={t('charter.zone')}>
          {options.map((o) => <option key={o} value={o}>{zoneLabel(o)} · {zoneClock(now, o)}</option>)}
        </select>
      </label>
    </Popup>
  )
}

/** The neutral answer after an act: the screen only reloads the charter. */
export function CharterChanged({ run }: ScreenProps) {
  useState(() => { run('settlement.charter.view'); return null })
  return null
}
