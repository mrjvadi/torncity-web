// The mock of the players' charter (settlement.charter.*), typed by the generated views: offices the players create, their
// permission sets and seats, the appoint / dismiss / resign acts, the append-only audit. It follows internal/domain/charter:
// limit 0 is no ceiling, nobody grants what they do not hold, the founder's office (id "" until the first edit writes it)
// cannot be closed or reduced, a city always keeps a manager (office.edit + charter.amend).

import { mockOk, mockRefusal } from './mock_neutral'
import type { CharterAuditView, CharterGrantView, CharterOfficeView, CharterPermissionView, CharterView } from './views.gen'

const CATALOGUE: [string, string, boolean, boolean][] = [
  ['treasury.spend', 'treasury', true, true], ['payroll.set', 'treasury', true, false], ['budget.allocate', 'treasury', false, false], ['storage.take', 'treasury', false, true],
  ['fiscal.set:sales_tax', 'fiscal', false, true], ['fiscal.set:shop_price', 'fiscal', false, true], ['fiscal.set:market_fee', 'fiscal', false, false], ['fiscal.set:levy', 'fiscal', false, false],
  ['road.draw', 'land', false, true], ['zone.open', 'land', false, false], ['zone.close', 'land', false, false], ['lot.sell', 'land', false, true], ['public.build', 'land', false, true], ['public.demolish', 'land', false, true],
  ['citizen.admit', 'people', false, false], ['citizen.ban', 'people', false, false], ['staff.hire', 'people', false, true], ['staff.fire', 'people', false, true], ['jobs.post', 'people', false, true],
  ['research.start', 'knowledge', false, true],
  ['police.patrol', 'order', false, false], ['police.fine', 'order', true, false], ['court.judge', 'order', false, false],
  ['election.call', 'politics', false, false], ['office.create', 'politics', false, true], ['office.edit', 'politics', false, true], ['office.appoint', 'politics', false, true], ['office.dismiss', 'politics', false, true], ['charter.amend', 'politics', false, true],
  ['treaty.propose', 'foreign', false, false], ['union.propose', 'foreign', false, false], ['raid.declare', 'foreign', false, false],
  ['notice.post', 'info', false, false],
]
export const ALL_PERMISSIONS = CATALOGUE.map((c) => c[0])
const ALL: CharterGrantView[] = CATALOGUE.map(([permission]) => ({ permission, limit: 0 }))
const LIMITS = { max_offices: 12, max_seats: 20, max_permissions: 40, title_min: 2, title_max: 24 }
const ME = { name: 'سارا', code: 'K7Q2M9A' }

interface State { offices: CharterOfficeView[]; audit: CharterAuditView[]; seq: number }
let state: State | null = null

function init(isHead: boolean): State {
  if (state) return state
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
  state = {
    seq: 1,
    offices: [
      { id: 'founder', title: 'شهردار', seats: 1, open: isHead ? 0 : 0, acquisition: 'head', term_days: 0, founder: true, manager: true, mine: isHead, grants: ALL, holders: [isHead ? ME : { name: 'کاوه', code: 'KAV7M3X' }] },
      { id: 'o-sheriff', title: 'کلانتر', seats: 2, open: 1, acquisition: 'appointment', term_days: 0, founder: false, manager: false, mine: false,
        grants: [{ permission: 'police.fine', limit: 500000 }, { permission: 'police.patrol', limit: 0 }, { permission: 'notice.post', limit: 0 }], holders: [{ name: 'نیلو', code: 'NIL4R8D' }] },
    ],
    audit: [
      { action: 'office_created', actor: isHead ? ME.name : 'کاوه', office: 'o-sheriff', title: 'کلانتر', at: at(30) },
      { action: 'seat_filled', actor: isHead ? ME.name : 'کاوه', office: 'o-sheriff', title: 'کلانتر', at: at(29) },
      { action: 'charter_written', actor: isHead ? ME.name : 'کاوه', office: '', title: 'شهردار', at: at(31) },
    ],
  }
  return state
}

const mineOf = (s: State, isHead: boolean): CharterGrantView[] => (isHead ? ALL : s.offices.filter((o) => o.mine).flatMap((o) => o.grants ?? []))
const holds = (mine: CharterGrantView[], code: string) => mine.some((g) => g.permission === code)

function view(isHead: boolean): CharterView {
  const s = init(isHead)
  const mine = mineOf(s, isHead)
  const permissions: CharterPermissionView[] = CATALOGUE.map(([code, group, limited, active]) => ({ code, group, limited, active }))
  return {
    village: 'آمل', settlement_id: 'mock-own', offices: s.offices, mine, can_create: holds(mine, 'office.create'), can_edit: holds(mine, 'office.edit'),
    can_appoint: holds(mine, 'office.appoint'), can_dismiss: holds(mine, 'office.dismiss'), permissions, audit: s.audit, limits: LIMITS,
  }
}

const refuse = (kind: string) => mockRefusal(kind, { back: { command: 'settlement.charter.view', args: null } })
const changed = (action: string, title: string) => mockOk('village_charter_changed', { action, title })

type Args = Record<string, unknown>

/** The answer of a charter command, or null when the command is not a charter one. */
export function mockCharter(command: string, args: Args, isHead: boolean) {
  if (!command.startsWith('settlement.charter.')) return null
  const s = init(isHead)
  const mine = mineOf(s, isHead)
  const log = (action: string, o: CharterOfficeView) => s.audit.unshift({ action, actor: ME.name, office: o.id, title: o.title, at: new Date().toISOString() })
  const office = () => s.offices.find((o) => o.id === String(args.office ?? ''))
  switch (command) {
    case 'settlement.charter.view': return mockOk('village_charter', view(isHead))
    case 'settlement.charter.office.save': {
      const id = String(args.office ?? '').trim()
      const creating = id === ''
      if (!holds(mine, creating ? 'office.create' : 'office.edit')) return refuse('not_office_holder')
      const title = String(args.title ?? '').trim()
      if (title.length < LIMITS.title_min || title.length > LIMITS.title_max) return refuse('charter_title')
      if (s.offices.some((o) => o.title === title && o.id !== id)) return refuse('charter_title_taken')
      const grants = (Array.isArray(args.grants) ? (args.grants as unknown as { permission: string; limit?: number }[]) : []).map((g) => ({ permission: g.permission, limit: g.limit ?? 0 }))
      if (grants.length > LIMITS.max_permissions || Number(args.seats ?? 1) > LIMITS.max_seats || (creating && s.offices.length >= LIMITS.max_offices)) return refuse('charter_caps')
      if (grants.some((g) => !CATALOGUE.some((c) => c[0] === g.permission))) return refuse('charter_grant')
      if (grants.some((g) => !holds(mine, g.permission))) return refuse('charter_not_held')
      if (args.acquisition === 'election') return refuse('charter_acquisition')
      if (creating) {
        const seats = Math.max(1, Number(args.seats ?? 1))
        const o: CharterOfficeView = { id: `o-${++s.seq}`, title, seats, open: seats, acquisition: 'appointment', term_days: Number(args.term_days ?? 0), founder: false, manager: grants.some((g) => g.permission === 'office.edit') && grants.some((g) => g.permission === 'charter.amend'), mine: false, grants, holders: [] }
        s.offices.push(o); log('office_created', o)
        const f = s.offices[0]; if (f.id === 'founder') f.id = 'o-founder'
        return changed('office_created', title)
      }
      const o = office(); if (!o) return refuse('not_found')
      if (o.founder) { o.title = title; if (o.id === 'founder') o.id = 'o-founder' }
      else {
        const seats = Math.max(1, Number(args.seats ?? o.seats))
        if (seats < (o.holders ?? []).length) return refuse('charter_seats_full')
        Object.assign(o, { title, seats, open: seats - (o.holders ?? []).length, grants, term_days: Number(args.term_days ?? o.term_days) })
      }
      log('office_changed', o)
      return changed('office_changed', o.title)
    }
    case 'settlement.charter.office.close': {
      if (!holds(mine, 'office.edit')) return refuse('not_office_holder')
      const o = office(); if (!o) return refuse('not_found')
      if (o.founder) return refuse('charter_founder_office')
      s.offices = s.offices.filter((x) => x !== o); log('office_closed', o)
      return changed('office_closed', o.title)
    }
    case 'settlement.charter.appoint': {
      if (!holds(mine, 'office.appoint')) return refuse('not_office_holder')
      const o = office(); if (!o) return refuse('not_found')
      const code = String(args.player ?? '').trim().toUpperCase()
      if ((o.grants ?? []).some((g) => !holds(mine, g.permission))) return refuse('charter_not_held')
      if ((o.holders ?? []).some((h) => h.code === code)) return refuse('charter_already_seated')
      if (o.open < 1) return refuse('charter_seats_full')
      o.holders = [...(o.holders ?? []), { name: `ساکن ${code.slice(0, 3)}`, code }]; o.open -= 1; log('seat_filled', o)
      return changed('seat_filled', o.title)
    }
    case 'settlement.charter.dismiss': {
      if (!holds(mine, 'office.dismiss')) return refuse('not_office_holder')
      const o = office(); if (!o) return refuse('not_found')
      const code = String(args.player ?? '')
      if (o.manager && (o.holders ?? []).length <= 1 && !s.offices.some((x) => x !== o && x.manager && (x.holders ?? []).length > 0)) return refuse('charter_last_manager')
      o.holders = (o.holders ?? []).filter((h) => h.code !== code); o.open = o.seats - o.holders.length; log('seat_dismissed', o)
      return changed('seat_dismissed', o.title)
    }
    case 'settlement.charter.resign': {
      const o = office(); if (!o || !o.mine) return refuse('charter_not_held')
      if (o.manager && !s.offices.some((x) => x !== o && x.manager && (x.holders ?? []).length > 0)) return refuse('charter_last_manager')
      o.holders = (o.holders ?? []).filter((h) => h.code !== ME.code); o.open = o.seats - o.holders.length; o.mine = false; log('seat_resigned', o)
      return changed('seat_resigned', o.title)
    }
  }
  return null
}
