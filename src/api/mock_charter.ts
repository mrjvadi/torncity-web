// The mock of the players' charter (settlement.charter.*), typed by the generated views: offices the players create, their
// permission sets and seats, the appoint / dismiss / resign acts, the append-only audit. It follows internal/domain/charter:
// limit 0 is no ceiling, nobody grants what they do not hold, the founder's office (id "" until the first edit writes it)
// cannot be closed or reduced, a city always keeps a manager (office.edit + charter.amend).

import { mockOk, mockRefusal } from './mock_neutral'
import type { CharterAuditView, CharterBallotView, CharterGrantView, CharterOfficeView, CharterPermissionView, CharterPetitionView, CharterView } from './views.gen'

const CATALOGUE: [string, string, boolean, boolean][] = [
  ['treasury.spend', 'treasury', true, true], ['payroll.set', 'treasury', true, false], ['budget.allocate', 'treasury', false, false], ['storage.take', 'treasury', false, true],
  ['fiscal.set:sales_tax', 'fiscal', false, true], ['fiscal.set:shop_price', 'fiscal', false, true], ['fiscal.set:market_fee', 'fiscal', false, false], ['fiscal.set:levy', 'fiscal', false, false],
  ['road.draw', 'land', false, true], ['zone.open', 'land', false, false], ['zone.close', 'land', false, false], ['lot.sell', 'land', false, true], ['public.build', 'land', false, true], ['public.demolish', 'land', false, true],
  ['citizen.admit', 'people', false, false], ['citizen.ban', 'people', false, false], ['staff.hire', 'people', false, true], ['staff.fire', 'people', false, true], ['jobs.post', 'people', false, true],
  ['research.start', 'knowledge', false, true],
  ['police.patrol', 'order', false, false], ['police.fine', 'order', true, false], ['court.judge', 'order', false, false],
  ['election.call', 'politics', false, false], ['office.create', 'politics', false, true], ['office.edit', 'politics', false, true], ['office.appoint', 'politics', false, true], ['office.dismiss', 'politics', false, true], ['charter.amend', 'politics', false, true],
  ['treaty.propose', 'foreign', false, false], ['union.propose', 'foreign', false, false], ['raid.declare', 'foreign', false, false],
  ['notice.post', 'info', false, false], ['settings.timezone', 'settings', false, true],
]
export const ALL_PERMISSIONS = CATALOGUE.map((c) => c[0])
const ALL: CharterGrantView[] = CATALOGUE.map(([permission]) => ({ permission, limit: 0 }))
const LIMITS = { max_offices: 12, max_seats: 20, max_permissions: 40, title_min: 2, title_max: 24 }
const ME = { name: 'سارا', code: 'K7Q2M9A' }

/** ?zone=330 puts the mock settlement five and a half hours east of UTC (default: Tehran, UTC+3:30). */
export const MOCK_ZONE = (() => { try { const z = Number(new URLSearchParams(location.search).get('zone')); return Number.isFinite(z) && new URLSearchParams(location.search).has('zone') ? z : 210 } catch { return 210 } })()
let zone = MOCK_ZONE
let zoneNext: string | null = null

interface State { offices: CharterOfficeView[]; audit: CharterAuditView[]; seq: number; ballots: CharterBallotView[]; petitions: CharterPetitionView[] }

/** ?acting=1: the head seat is vacant and the sheriff acts for it. */
const ACTING = (() => { try { return new URLSearchParams(location.search).get('acting') === '1' } catch { return false } })()
const RULES = { election_term_days: 14, candidacy_hours: 48, voting_hours: 72, recall_min_tenure_days: 5, recall_signature_bps: 2000, recall_min_signatures: 3, recall_vote_hours: 72, amend_vote_hours: 72, acting_days: 7 }
let state: State | null = null

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const NILOO = { name: 'نیلو', code: 'NIL4R8D' }, KAVEH = { name: 'کاوه', code: 'KAV7M3X' }
function ballots(): CharterBallotView[] {
  const base = { target: null, candidacy_ends: null, needed: 0, candidates: null, proposal: null, yes: null, no: null, winners: null, voted: false, standing: false, can_vote: false, can_stand: false, eligible: 8 }
  return [
    { ...base, id: 'b-1', kind: 'election', office_id: 'o-council', office: 'شورا', phase: 'candidacy', status: 'open', opens_at: hours(-28), candidacy_ends: hours(20), closes_at: hours(92), candidates: [{ ...NILOO, votes: null }, { ...KAVEH, votes: null }], can_stand: true },
    { ...base, id: 'b-2', kind: 'election', office_id: 'o-sheriff', office: 'کلانتر', phase: 'voting', status: 'open', opens_at: hours(-60), candidacy_ends: hours(-12), closes_at: hours(60), candidates: [{ ...NILOO, votes: null }, { name: 'رضا', code: 'REZ5T2Q', votes: null }], can_vote: true },
    { ...base, id: 'b-3', kind: 'recall', office_id: 'o-council', office: 'شورا', phase: 'voting', status: 'open', opens_at: hours(-12), closes_at: hours(60), target: { name: 'رضا', code: 'REZ5T2Q' }, needed: 3, can_vote: true },
    { ...base, id: 'b-4', kind: 'amendment', office_id: 'o-sheriff', office: 'کلانتر', phase: 'voting', status: 'open', opens_at: hours(-22), closes_at: hours(50), needed: 3, can_vote: true,
      proposal: { op: 'save', title: 'کلانتر', seats: 3, acquisition: 'election', deputy: true, grants: [{ permission: 'police.fine', limit: 500000 }, { permission: 'police.patrol', limit: 0 }, { permission: 'treasury.spend', limit: 100000 }] } },
    { ...base, id: 'b-5', kind: 'election', office_id: 'o-council', office: 'شورا', phase: 'closed', status: 'passed', opens_at: hours(-400), candidacy_ends: hours(-352), closes_at: hours(-280), candidates: [{ ...NILOO, votes: 4 }, { ...KAVEH, votes: 3 }], winners: [NILOO], voted: true },
    { ...base, id: 'b-6', kind: 'recall', office_id: 'o-sheriff', office: 'کلانتر', phase: 'closed', status: 'failed', opens_at: hours(-300), closes_at: hours(-230), target: NILOO, needed: 3, yes: 2, no: 4, voted: true },
  ]
}

function init(isHead: boolean): State {
  if (state) return state
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
  state = {
    seq: 1,
    offices: [
      { id: 'founder', title: 'شهردار', seats: 1, open: ACTING ? 1 : 0, acquisition: 'head', term_days: 0, founder: true, manager: true, mine: isHead && !ACTING, deputy: false, term_ends: null, can_recall: false, grants: ALL, holders: ACTING ? [] : [isHead ? ME : { name: 'کاوه', code: 'KAV7M3X' }] },
      { id: 'o-sheriff', title: 'کلانتر', seats: 2, open: 1, acquisition: 'appointment', term_days: 0, founder: false, manager: false, mine: false, deputy: true, term_ends: null, can_recall: isHead,
        grants: [{ permission: 'police.fine', limit: 500000 }, { permission: 'police.patrol', limit: 0 }, { permission: 'notice.post', limit: 0 }], holders: [{ name: 'نیلو', code: 'NIL4R8D' }] },
      { id: 'o-council', title: 'شورا', seats: 3, open: 1, acquisition: 'election', term_days: 14, founder: false, manager: false, mine: false, deputy: false, term_ends: new Date(Date.now() + 9 * 86_400_000).toISOString(), can_recall: isHead,
        grants: [{ permission: 'notice.post', limit: 0 }, { permission: 'election.call', limit: 0 }], holders: [{ name: 'کاوه', code: 'KAV7M3X' }, { name: 'رضا', code: 'REZ5T2Q' }] },
    ],
    ballots: ballots(),
    petitions: [{ id: 'p-1', office_id: 'o-council', office: 'شورا', target: { name: 'رضا', code: 'REZ5T2Q' }, signatures: 2, needed: 3, signed: false, can_sign: true }],
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
    zone_minutes: zone, can_set_zone: holds(mine, 'settings.timezone') && !zoneNext, zone_next_change: zoneNext,
    can_call_election: holds(mine, 'election.call'), head_vacant: ACTING,
    acting: ACTING ? { player: NILOO, office: 'کلانتر', ends: hours(5 * 24), spend_cap: 200000 } : null,
    ballots: s.ballots, petitions: s.petitions, rules: RULES,
  }
}

const refuse = (kind: string) => mockRefusal(kind, { back: { command: 'settlement.charter.view', args: null } })
const changed = (action: string, title: string, ballot_id = '') => mockOk('village_charter_changed', { action, title, ballot_id })

type Args = Record<string, unknown>

/** The answer of a charter command, or null when the command is not a charter one. */
export function mockCharter(command: string, args: Args, isHead: boolean) {
  if (!command.startsWith('settlement.charter.') && command !== 'settlement.timezone.set') return null
  const s = init(isHead)
  const mine = mineOf(s, isHead)
  const log = (action: string, o: CharterOfficeView) => s.audit.unshift({ action, actor: ME.name, office: o.id, title: o.title, at: new Date().toISOString() })
  const office = () => s.offices.find((o) => o.id === String(args.office ?? ''))
  switch (command) {
    case 'settlement.charter.view': return mockOk('village_charter', view(isHead))
    case 'settlement.timezone.set': {
      if (!holds(mine, 'settings.timezone')) return refuse('not_office_holder')
      const off = Number(args.offset_minutes)
      if (!Number.isInteger(off) || off % 15 !== 0 || off < -720 || off > 840) return refuse('charter_zone_invalid')
      if (zoneNext && Date.parse(zoneNext) > Date.now()) return refuse('charter_zone_cooldown')
      zone = off; zoneNext = new Date(Date.now() + 7 * 86_400_000).toISOString()
      s.audit.unshift({ action: 'timezone_changed', actor: ME.name, office: '', title: '', at: new Date().toISOString() })
      return changed('timezone_changed', '')
    }
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
      if (args.acquisition === 'head') return refuse('charter_acquisition')
      const acq = args.acquisition === 'election' ? 'election' : 'appointment'
      const deputy = args.deputy === true || args.deputy === 'true'
      if (deputy && s.offices.some((x) => x.deputy && x.id !== id)) return refuse('charter_deputy_taken')
      if (creating) {
        const seats = Math.max(1, Number(args.seats ?? 1))
        const o: CharterOfficeView = { id: `o-${++s.seq}`, title, seats, open: seats, acquisition: acq, term_days: acq === 'election' ? 14 : 0, founder: false, deputy, term_ends: null, can_recall: false, manager: grants.some((g) => g.permission === 'office.edit') && grants.some((g) => g.permission === 'charter.amend'), mine: false, grants, holders: [] }
        s.offices.push(o); log('office_created', o)
        const f = s.offices[0]; if (f.id === 'founder') f.id = 'o-founder'
        return changed('office_created', title)
      }
      const o = office(); if (!o) return refuse('not_found')
      if (o.founder) { o.title = title; if (o.id === 'founder') o.id = 'o-founder' }
      else {
        const seats = Math.max(1, Number(args.seats ?? o.seats))
        if (seats < (o.holders ?? []).length) return refuse('charter_seats_full')
        const structural = JSON.stringify([...(o.grants ?? [])].sort((a, b) => a.permission.localeCompare(b.permission))) !== JSON.stringify([...grants].sort((a, b) => a.permission.localeCompare(b.permission))) || o.acquisition !== acq || o.deputy !== deputy
        if (structural) {
          if (s.ballots.some((b) => b.kind === 'amendment' && b.status === 'open')) return refuse('charter_vote_pending')
          const b: CharterBallotView = { id: `b-${++s.seq}`, kind: 'amendment', office_id: o.id, office: o.title, target: null, phase: 'voting', status: 'open', opens_at: hours(0), candidacy_ends: null, closes_at: hours(72), eligible: 8, needed: 3, candidates: null,
            proposal: { op: 'save', title, seats, acquisition: acq, deputy, grants }, yes: null, no: null, winners: null, voted: false, standing: false, can_vote: true, can_stand: false }
          s.ballots.unshift(b); log('amendment_proposed', o)
          return changed('amendment_proposed', o.title, b.id)
        }
        Object.assign(o, { title, seats, open: seats - (o.holders ?? []).length, grants, deputy, acquisition: acq, term_days: Number(args.term_days ?? o.term_days) })
      }
      log('office_changed', o)
      return changed('office_changed', o.title)
    }
    case 'settlement.charter.election.open': {
      if (!holds(mine, 'election.call')) return refuse('not_office_holder')
      const o = office() ?? s.offices[0]; if (!o) return refuse('not_found')
      if (o.acquisition !== 'election' && !o.founder) return refuse('charter_not_elected')
      if (o.open < 1 && !ACTING) return refuse('charter_no_vacancy')
      if (s.ballots.some((b) => b.kind === 'election' && b.office_id === o.id && b.status === 'open')) return refuse('charter_election_open')
      const b: CharterBallotView = { id: `b-${++s.seq}`, kind: 'election', office_id: o.id, office: o.title, target: null, phase: 'candidacy', status: 'open', opens_at: hours(0), candidacy_ends: hours(48), closes_at: hours(120), eligible: 8, needed: 0, candidates: [], proposal: null, yes: null, no: null, winners: null, voted: false, standing: false, can_vote: false, can_stand: true }
      s.ballots.unshift(b); log('election_opened', o)
      return changed('election_opened', o.title, b.id)
    }
    case 'settlement.charter.stand': {
      const b = s.ballots.find((x) => x.id === String(args.ballot)); if (!b) return refuse('charter_no_ballot')
      if (b.phase !== 'candidacy') return refuse('charter_not_candidacy')
      if (b.standing) return refuse('charter_already_standing')
      b.candidates = [...(b.candidates ?? []), { ...ME, votes: null }]; b.standing = true; b.can_stand = false
      s.audit.unshift({ action: 'candidate_stood', actor: ME.name, office: b.office_id, title: b.office, at: new Date().toISOString() })
      return changed('candidate_stood', b.office, b.id)
    }
    case 'settlement.charter.vote': {
      const b = s.ballots.find((x) => x.id === String(args.ballot)); if (!b) return refuse('charter_no_ballot')
      if (b.phase !== 'voting') return refuse('charter_not_voting')
      if (b.voted) return refuse('charter_already_voted')
      const choice = String(args.choice ?? '')
      if (b.kind === 'election' ? !(b.candidates ?? []).some((c) => c.code === choice) : choice !== 'yes' && choice !== 'no') return refuse('charter_bad_choice')
      b.voted = true; b.can_vote = false
      s.audit.unshift({ action: 'vote_cast', actor: ME.name, office: b.office_id, title: b.office, at: new Date().toISOString() })
      return changed('vote_cast', b.office, b.id)
    }
    case 'settlement.charter.recall.start': {
      const o = office(); if (!o) return refuse('not_found')
      if (!o.can_recall) return refuse('charter_not_holder')
      const code = String(args.player ?? '')
      const target = (o.holders ?? []).find((h) => h.code === code); if (!target) return refuse('charter_not_holder')
      if (s.petitions.some((p) => p.office_id === o.id && p.target.code === code)) return refuse('charter_recall_open')
      s.petitions.unshift({ id: `p-${++s.seq}`, office_id: o.id, office: o.title, target, signatures: 1, needed: 3, signed: true, can_sign: false })
      s.audit.unshift({ action: 'recall_petition_started', actor: ME.name, office: o.id, title: o.title, at: new Date().toISOString() })
      return changed('recall_petition_started', o.title)
    }
    case 'settlement.charter.recall.sign': {
      const p = s.petitions.find((x) => x.id === String(args.petition)); if (!p) return refuse('charter_no_ballot')
      p.signatures += 1; p.signed = true; p.can_sign = false
      if (p.signatures >= p.needed) {
        s.petitions = s.petitions.filter((x) => x !== p)
        s.ballots.unshift({ id: `b-${++s.seq}`, kind: 'recall', office_id: p.office_id, office: p.office, target: p.target, phase: 'voting', status: 'open', opens_at: hours(0), candidacy_ends: null, closes_at: hours(72), eligible: 8, needed: 3, candidates: null, proposal: null, yes: null, no: null, winners: null, voted: false, standing: false, can_vote: true, can_stand: false })
        s.audit.unshift({ action: 'recall_vote_opened', actor: ME.name, office: p.office_id, title: p.office, at: new Date().toISOString() })
      }
      return changed('recall_signed', p.office)
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
