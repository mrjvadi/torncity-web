// The politics and society screens for `?mock=1`: neutral answers typed by the generated Go views
// (docs/adr/0039-presentation-split.md): a screen name, a view, actions with `id`, `command`, named
// `args`, `kind` and `subject`; never a `text` or a `label`. A refusal is `ok: false` with a code and
// its screen. Every command of the area answers here, writes included, so each screen can be walked.

import type {
  BillView, ElectionLine, ElectionView, FactionMemberLine, FactionOperationLine, GovLever, GovPlace, GovPlayer, GovSeat, Named, SanctionLine,
  ScreenViews, TreatyLine,
} from './views.gen'
import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import { AS_CITY } from './mock_p0'

// -- the names of content the screens mention, as the catalogue serves them (both languages) -------------------

const nm = (en: string, fa: string) => ({ en, fa })
export const SOCIETY_CONTENT = {
  entries: {
    office: [
      ['mayor', nm('Mayor', 'شهردار')], ['deputy_mayor', nm('Deputy mayor', 'معاون شهردار')], ['city_council', nm('City council', 'شورای شهر')],
      ['village_head', nm('Village head', 'شهردار')], ['president', nm('President', 'رئیس‌جمهور')], ['foreign_minister', nm('Foreign minister', 'وزیر امور خارجه')], ['police_chief', nm('Police chief', 'رئیس پلیس')],
      ['defence_minister', nm('Defence minister', 'وزیر دفاع')], ['parliament', nm('Parliament', 'مجلس')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    lever: [
      ['city.tax_rate', nm('Tax rate', 'نرخ مالیات')], ['city.minimum_wage', nm('Minimum wage', 'حداقل دستمزد')], ['city.budget', nm('City budget', 'بودجهٔ شهر')],
      ['village.local_levy', nm('Village levy', 'عوارض محلی شهر')], ['country.arms_exports', nm('Arms export policy', 'سیاست صادرات تسلیحات')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    jurisdiction: [{ code: 'vantor_federation', name: nm('Vantor Federation', 'فدراسیون ونتور') }, { code: 'default_country', name: nm('Commonwealth', 'مشترک‌المنافع') }],
    budget_line: [
      ['police', nm('Police', 'پلیس')], ['hospital', nm('Hospital subsidy', 'یارانهٔ بیمارستان')], ['education', nm('Education', 'آموزش')], ['infrastructure', nm('Infrastructure', 'زیرساخت و بازسازی')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    treaty_kind: [
      ['alliance', nm('Military alliance', 'پیمان نظامی')], ['non_aggression', nm('Non-aggression pact', 'پیمان عدم تجاوز')], ['trade_agreement', nm('Trade agreement', 'موافقت‌نامهٔ تجاری')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    sanction_measure: [
      ['trade', nm('Trade sanction', 'تحریم تجاری')], ['arms', nm('Arms sanction', 'تحریم تسلیحاتی')], ['technology', nm('Technology sanction', 'تحریم فناوری')],
      ['travel', nm('Travel ban', 'ممنوعیت سفر')], ['financial', nm('Financial sanction', 'تحریم مالی')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    sanction_ground: [
      ['aggression', nm('Military aggression', 'تجاوز نظامی')], ['proliferation', nm('Arms proliferation', 'اشاعهٔ تسلیحات')], ['unfair_trade', nm('Unfair trade', 'تجارت ناعادلانه')],
    ].map(([code, name]) => ({ code: code as string, name: name as { en: string; fa: string } })),
    crime: [{ code: 'bank_heist', name: nm('Central bank heist', 'سرقت از بانک مرکزی') }],
    life_rank: [{ code: 'tycoon', name: nm('Tycoon', 'سرمایه‌دار') }, { code: 'trader', name: nm('Trader', 'بازرگان') }],
    company_type: [{ code: 'bakery', name: nm('Bakery', 'نانوایی') }, { code: 'garage', name: nm('Garage', 'تعمیرگاه') }],
  },
  // what the data says exists where (configs/content/availability.yml): a faction is a town's, war a country's
  availability: [
    { kind: 'faction', code: 'faction', stage: 'town', requires: { buildings: [{ role: 'market', tier: 1 }] } },
    { kind: 'government_action', code: 'country.war', stage: 'country', requires: {} },
    { kind: 'office', code: 'village_head', stage: 'village', requires: {} },
    { kind: 'office', code: 'mayor', stage: 'city', requires: {} },
  ],
}

// -- sample people and places ---------------------------------------------------------------------------------

const city = (code = 'calderis', name = 'Calderis'): GovPlace => ({ kind: 'city', code, name })
const COUNTRY: GovPlace = { kind: 'country', code: 'vantor_federation', name: 'Vantor Federation' }
const OTHER: GovPlace = { kind: 'country', code: 'default_country', name: 'Commonwealth' }
const ME: GovPlayer = { name: 'سارا', code: 'SARA123' }
const KAVEH: GovPlayer = { name: 'کاوه', code: 'KAV4E7Z' }
const NILOO: GovPlayer = { name: 'نیلوفر', code: 'NIL0F2R' }
const named = (code: string, name: string): Named => ({ code, name })

const lever = (o: Partial<GovLever> & { code: string }): GovLever => ({
  type: 'bps', value: 450, default: 450, min: 0, max: 2500, from_office: true, set_by: ME, pending: null, held_by: 'mayor', notice_seconds: 86400,
  cooldown_seconds: 259200, vote: false, confirm_by: '', allocation: null, categories: null, ...o,
})
const TAX = lever({ code: 'city.tax_rate' })
const WAGE = lever({ code: 'city.minimum_wage', type: 'money', value: 100, default: 100, min: 50, max: 400, from_office: false, set_by: null })
const BUDGET = lever({
  code: 'city.budget', type: 'allocation', value: 0, default: 0, min: 0, max: 10000, from_office: false, set_by: null, confirm_by: 'city_council',
  allocation: { police: 3000, hospital: 3000, education: 2500, infrastructure: 1500 }, categories: ['police', 'hospital', 'education', 'infrastructure'],
})
const LEVY = lever({ code: 'village.local_levy', value: 200, default: 200, min: 0, max: 1000, held_by: 'village_head' })
const ARMS = lever({ code: 'country.arms_exports', type: 'int', value: 1, default: 0, min: 0, max: 2, held_by: 'president', set_by: KAVEH })

const act = (id: string, command: string, args?: Record<string, string>, o: { kind?: string; subject?: string } = {}) => A(id, command, args, o)
const page = (command: string, fixed: Record<string, string>, p: number, pages: number): MockAct[] => [
  ...(p > 1 ? [act('page.prev', command, { ...fixed, page: String(p - 1) })] : []),
  ...(p < pages ? [act('page.next', command, { ...fixed, page: String(p + 1) })] : []),
]

function refusal<K extends keyof ScreenViews>(screen: K, view: ScreenViews[K], code: string, actions: MockAct[], args: Record<string, unknown> = {}) {
  return { ok: false, request_id: 'mock', screen: screen as string, view, error: { code, ...(Object.keys(args).length ? { args } : {}) }, actions }
}

// -- governance -------------------------------------------------------------------------------------------------------

function cityGov(args: Record<string, unknown>) {
  const village = args.city === 'talvanro'
  const place = village ? city('talvanro', 'Talvanro') : city()
  const sections = village
    ? [{ place, offices: [{ code: 'village_head', seats: 1, holders: [ME], acting_code: '', acting: null }], levers: [LEVY] }]
    : [
      { place, offices: [{ code: 'mayor', seats: 1, holders: [ME], acting_code: '', acting: null }, { code: 'deputy_mayor', seats: 1, holders: null, acting_code: '', acting: null },
        { code: 'city_council', seats: 5, holders: [KAVEH, NILOO], acting_code: '', acting: null }],
      levers: [TAX, WAGE, { ...BUDGET, pending: { value: 0, allocation: { police: 4000, hospital: 2500, education: 2500, infrastructure: 1000 }, in_seconds: 43200, by: ME } }] },
      { place: COUNTRY, offices: [{ code: 'president', seats: 1, holders: [KAVEH], acting_code: '', acting: null }], levers: [ARMS] },
    ]
  const acts = [
    act('gov.history', 'gov.history', { city: place.code }), act('gov.elections', 'election.list'),
    ...(village ? [] : [act('gov.budget', 'city.budget', { city: place.code }), act('gov.laws', 'law.list')]),
    act('gov.my_office', 'gov.office'),
    ...(village ? [] : [act('military.ministry', 'military.ministry', { country: COUNTRY.code }, { subject: COUNTRY.code })]),
    back('map.list'), refreshA('gov.city', { city: place.code }),
  ]
  return mockOk('city_governance', { city: place, sections, holds_office: true, no_city: false, tier: village ? 'village' : 'city', military_open: !village }, acts)
}

const AS_VILLAGE_OFFICE = false

function myOffice() {
  const seats: GovSeat[] = [
    { office: 'mayor', place: city(), acting_for: '', levers: [TAX, WAGE], vote_levers: [{ ...BUDGET, vote: true, held_by: 'city_council' }],
      appointees: [{ office: 'deputy_mayor', place: city(), seat: 1, holder: null, can_appoint: true, can_dismiss: false },
        { office: 'police_chief', place: city(), seat: 1, holder: KAVEH, can_appoint: false, can_dismiss: true }] },
  ]
  const acts = [
    act('gov.lever.change', 'gov.lever', { lever: TAX.code, place: 'calderis' }, { subject: TAX.code }),
    act('gov.lever.change', 'gov.lever', { lever: WAGE.code, place: 'calderis' }, { subject: WAGE.code }),
    act('gov.lever.propose', 'gov.lever', { lever: BUDGET.code, place: 'calderis' }, { subject: BUDGET.code }),
    act('gov.appoint', 'gov.appoint', { office: 'deputy_mayor', place: 'calderis' }, { subject: 'deputy_mayor' }),
    act('gov.dismiss', 'gov.dismiss', { office: 'police_chief', place: 'calderis', seat: '1' }, { subject: 'police_chief' }),
    back('gov.city'), refreshA('gov.office'),
  ]
  return mockOk('my_office', { seats, military_open: !AS_VILLAGE_OFFICE }, acts)
}

const draftOf = (args: Record<string, unknown>, l: GovLever) => (args.value !== undefined && args.value !== '' ? Number(args.value) : l.value)

function leverEdit(args: Record<string, unknown>) {
  const l = args.lever === ARMS.code ? ARMS : args.lever === WAGE.code ? WAGE : TAX
  if (l.code === BUDGET.code) return allocEdit(args)
  const draft = draftOf(args, l)
  const fine = l.type === 'money' ? 10 : 25, coarse = l.type === 'money' ? 50 : 250
  const set = (id: string, x: number) => act(id, 'gov.lever', { lever: l.code, place: 'calderis', value: String(x) })
  const clamp = (x: number) => Math.min(l.max, Math.max(l.min, x))
  const acts: MockAct[] = []
  if (l.max - l.min <= 10) for (let x = l.min; x <= l.max; x++) { if (x !== draft) acts.push(set('gov.lever.choose', x)) }
  else {
    for (const [id, d] of [['gov.lever.down_coarse', -coarse], ['gov.lever.down_fine', -fine], ['gov.lever.up_fine', fine], ['gov.lever.up_coarse', coarse]] as [string, number][]) {
      if (clamp(draft + d) !== draft) acts.push(set(id, clamp(draft + d)))
    }
    for (const [id, x] of [['gov.lever.min', l.min], ['gov.lever.default', l.default], ['gov.lever.max', l.max]] as [string, number][]) { if (x !== draft) acts.push(set(id, x)) }
  }
  if (draft !== l.value) acts.push(act('gov.review', 'gov.confirm', { lever: l.code, place: 'calderis', value: String(draft) }))
  acts.push(back('gov.office'), refreshA('gov.lever', { lever: l.code, place: 'calderis' }))
  return mockOk('lever_edit', { place: city(), lever: l, draft, fine_step: fine, coarse_step: coarse, next_change_in_seconds: 0 }, acts)
}

function policyConfirm(args: Record<string, unknown>) {
  const l = args.lever === WAGE.code ? WAGE : TAX
  const v = draftOf(args, l)
  return mockOk('policy_confirm', { place: city(), lever: l, new_value: v, vote_by: '' }, [
    act('gov.confirm', 'gov.set', { lever: l.code, place: 'calderis', value: String(v) }, { kind: 'confirm' }),
    act('cancel', 'gov.lever', { lever: l.code, place: 'calderis', value: String(v) }),
  ])
}

function policySet(args: Record<string, unknown>) {
  const l = args.lever === WAGE.code ? WAGE : TAX
  const v = draftOf(args, l)
  if (v > l.max || v < l.min) {
    return refusal('policy_refused', { refusal: { kind: 'out_of_range', office: '', wait_seconds: 0 }, place: city(), lever: l }, 'gov_out_of_range',
      [act('gov.my_office', 'gov.office'), back('gov.lever', { lever: l.code, place: 'calderis' })])
  }
  return mockOk('policy_announced', { place: city(), lever: l, old: l.value, new: v, old_allocation: null, new_allocation: null, in_seconds: l.notice_seconds }, [
    act('gov.my_office', 'gov.office'), back('gov.office'), refreshA('gov.lever', { lever: l.code, place: 'calderis' })])
}

const LINES = ['police', 'hospital', 'education', 'infrastructure']
function parseDraft(d: string): Record<string, number> {
  const base = BUDGET.allocation ?? {}
  if (!d) return base
  const out: Record<string, number> = {}
  d.split(',').forEach((p, i) => { out[LINES[i]] = Number(p) || 0 })
  return out
}
const draftStr = (a: Record<string, number>) => LINES.map((c) => a[c] ?? 0).join(',')

function allocEdit(args: Record<string, unknown>) {
  const a = parseDraft(String(args.draft ?? ''))
  const total = LINES.reduce((s, c) => s + (a[c] ?? 0), 0)
  const step = (c: string, d: number) => draftStr({ ...a, [c]: Math.max(0, (a[c] ?? 0) + d) })
  const acts: MockAct[] = []
  const lines = LINES.map((code) => {
    const down = (a[code] ?? 0) >= 500 ? step(code, -500) : '', up = total + 500 <= 10000 ? step(code, 500) : ''
    if (down) acts.push(act('gov.alloc.down', 'gov.alloc', { lever: BUDGET.code, place: 'calderis', draft: down }, { subject: code }))
    if (up) acts.push(act('gov.alloc.up', 'gov.alloc', { lever: BUDGET.code, place: 'calderis', draft: up }, { subject: code }))
    return { code, share: a[code] ?? 0, down, up }
  })
  const changed = draftStr(a) !== draftStr(BUDGET.allocation ?? {})
  if (changed) acts.push(act('gov.review', 'gov.allocok', { lever: BUDGET.code, place: 'calderis', draft: draftStr(a) }))
  acts.push(back('gov.office'), refreshA('gov.alloc', { lever: BUDGET.code, place: 'calderis', draft: draftStr(a) }))
  return mockOk('allocation_edit', { place: city(), lever: BUDGET, draft: draftStr(a), lines, total, spend_share_bps: 2500, next_change_in_seconds: 0, changed }, acts)
}

function allocConfirm(args: Record<string, unknown>) {
  const draft = String(args.draft ?? '')
  return mockOk('allocation_confirm', { place: city(), lever: BUDGET, draft, new: parseDraft(draft), vote_by: 'city_council' }, [
    act('gov.confirm', 'gov.allocset', { lever: BUDGET.code, place: 'calderis', draft }, { kind: 'confirm' }),
    act('cancel', 'gov.alloc', { lever: BUDGET.code, place: 'calderis', draft }),
  ])
}

function govHistory(args: Record<string, unknown>) {
  const p = Number(args.page ?? 1) || 1
  const entries = [
    { place: city(), lever: 'city.tax_rate', type: 'bps', office: 'mayor', by: ME, old: 400, new: 450, ago_seconds: 90000, effective_in_seconds: -3600 },
    { place: city(), lever: 'city.minimum_wage', type: 'money', office: 'mayor', by: ME, old: 80, new: 100, ago_seconds: 400000, effective_in_seconds: -300000 },
    { place: city(), lever: 'city.budget', type: 'allocation', office: 'city_council', by: KAVEH, old: 0, new: 0, ago_seconds: 3600, effective_in_seconds: 43200 },
  ]
  return mockOk('gov_history', { city: city(), entries, page: p, pages: 2 }, [...page('gov.history', { city: 'calderis' }, p, 2), back('gov.city', { city: 'calderis' }), refreshA('gov.history', { city: 'calderis', page: String(p) })])
}

function appoint(command: string, args: Record<string, unknown>) {
  const office = String(args.office ?? 'deputy_mayor'), place = String(args.place ?? 'calderis')
  if (command === 'gov.appoint') {
    const to = String(args.to ?? '')
    if (to === 'nobody') return refusal('appoint_refusal', { kind: 'no_player', gov: null, office }, 'appoint_no_player', [back('gov.office')], { office })
    return mockOk('appoint_confirm', { office, place: city(place), player: KAVEH }, [
      act('gov.appoint.confirm', 'gov.seat', { office, place, to: KAVEH.code }, { kind: 'confirm' }), back('gov.office')])
  }
  if (command === 'gov.seat') return mockOk('appoint_done', { office, place: city(place), player: KAVEH, dismissed: false, term_ends_in_seconds: 2592000 }, [act('gov.my_office', 'gov.office'), back('gov.city')])
  if (command === 'gov.dismiss') {
    return mockOk('dismiss_confirm', { office, place: city(place), seat: 1, holder: KAVEH }, [
      act('gov.dismiss.confirm', 'gov.unseat', { office, place, seat: '1' }, { kind: 'confirm' }), back('gov.office')])
  }
  return mockOk('appoint_done', { office, place: city(place), player: KAVEH, dismissed: true, term_ends_in_seconds: 0 }, [act('gov.my_office', 'gov.office'), back('gov.city')])
}

// -- elections --------------------------------------------------------------------------------------------------------

const ELECTIONS: ElectionLine[] = [
  { no: 4, office: 'mayor', place: city(), phase: 'candidacy', seats: 1, ends_at: null, remaining_seconds: 111600, candidates: 2, elected: null },
  { no: 5, office: 'city_council', place: city(), phase: 'voting', seats: 5, ends_at: null, remaining_seconds: 43200, candidates: 6, elected: null },
  { no: 1, office: 'mayor', place: city(), phase: 'counted', seats: 1, ends_at: null, remaining_seconds: 0, candidates: 3, elected: [KAVEH] },
]

function electionView(no: number): ElectionView {
  const e = ELECTIONS.find((x) => x.no === no) ?? ELECTIONS[1]
  const counted = e.phase === 'counted'
  return {
    no: e.no, office: e.office, place: e.place, seats: e.seats, phase: e.phase, remaining_seconds: e.remaining_seconds, candidacy_ends_at: null, voting_ends_at: null,
    votes_cast: counted ? 2340 : 0,
    candidates: [
      { player: { name: 'رضا', code: 'REZ4A1B' }, mine: false, votes: counted ? 1076 : 0, counted, elected: counted },
      { player: { name: 'مینا', code: 'MIN7C9D' }, mine: no === 4, votes: counted ? 889 : 0, counted, elected: false },
      { player: { name: 'دانا', code: 'DAN2E5F' }, mine: false, votes: counted ? 375 : 0, counted, elected: false },
    ],
    deposit: e.phase === 'candidacy' ? 25000 : 0, refund_share_bps: 1000, min_level: 5,
    standing: false, voted: false, can_stand: e.phase === 'candidacy', can_vote: e.phase === 'voting', stand_blocked: '', vote_blocked: '',
    payment: e.phase === 'candidacy' ? { amount: 25000, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 31000, bank: 150000 } : null, nonce: 'n0nce',
  }
}

function election(command: string, args: Record<string, unknown>) {
  const no = Number(args.no ?? 5) || 5
  if (command === 'election.list') {
    return mockOk('elections', { no_city: false, place: city(), elections: ELECTIONS }, [
      ...ELECTIONS.map((e) => act('election.open', 'election.view', { no: String(e.no) })), back('gov.city', { city: 'calderis' }), refreshA('election.list')])
  }
  const v = electionView(no)
  if (command === 'election.view') {
    const acts: MockAct[] = []
    if (v.can_vote) (v.candidates ?? []).forEach((_, i) => acts.push(act('election.vote', 'election.vote', { no: String(no), candidate: String(i + 1), nonce: 'n0nce' })))
    if (v.can_stand) for (const m of ['cash', 'card']) acts.push(act('election.stand', 'election.stand', { no: String(no), method: m, nonce: 'n0nce' }))
    acts.push(back('election.list'), refreshA('election.view', { no: String(no) }))
    return mockOk('election', v, acts)
  }
  if (command === 'election.stand') {
    return mockOk('stood', { no, office: v.office, place: v.place, deposit: 25000, method: String(args.method ?? 'cash'), voting_at: null, voting_in_seconds: 111600 }, [back('election.view', { no: String(no) })])
  }
  if (args.candidate === '9') {
    return refusal('election_refusal', { kind: 'no_candidate', no, office: v.office, place: v.place }, 'election_no_candidate', [act('election.open', 'election.view', { no: String(no) }), back('election.list')], { no })
  }
  return mockOk('voted', { no, office: v.office, place: v.place, candidate: { name: 'رضا', code: 'REZ4A1B' }, count_at: null, count_in_seconds: 43200 }, [back('election.view', { no: String(no) })])
}

// -- factions ---------------------------------------------------------------------------------------------------------

const LIONS = named('L10N5ZA', 'شیرهای البرز')
const SHADES = named('SH4D3SB', 'سایه‌ها')
const member = (p: GovPlayer, rank: string, self: boolean, can = false): FactionMemberLine => ({ player: p, rank, self, can_kick: can, can_promote: can && rank === 'member', can_demote: can && rank === 'officer', can_lead: can })
const MEMBERS: FactionMemberLine[] = [member(ME, 'leader', true), member(KAVEH, 'officer', false, true), member(NILOO, 'member', false, true)]
const OP: FactionOperationLine = {
  no: 7, status: 'gathering', crime: named('bank_heist', 'Central bank heist'), place: named('old_town', 'Old Town'), city_code: 'calderis', city: 'Calderis', chance_bps: 6200, min: 2, max: 5, nerve: 12,
  crew: [member(ME, 'leader', true), member(KAVEH, 'officer', false)], left_seconds: 8070, at: null, expired: false,
}

function faction(command: string, args: Record<string, unknown>) {
  const mine = (id: string, c: string) => act(id, c)
  switch (command) {
    case 'faction.list':
      return mockOk('faction_list', { city_code: 'calderis', city: 'Calderis', fee: 50000, factions: [{ ref: LIONS, members: 18 }, { ref: SHADES, members: 6 }], mine: args.none ? null : LIONS, founding: args.none ? { have: 7, need: 20, open: false } : null }, [
        act('faction.view', 'faction.view', { code: LIONS.code }), act('faction.view', 'faction.view', { code: SHADES.code }), mine('faction.mine', 'faction.mine'), back('player.profile.get'), refreshA('faction.list')])
    case 'faction.view':
      if (args.code === 'nope') return refusal('faction_refusal', { kind: 'not_found', min: 0, max: 0, amount: 0, balance: 0, need: 0, have: 0, level: 0 }, 'faction_not_found', [act('faction.list', 'faction.list'), back('player.profile.get')])
      return mockOk('faction_page', { ref: String(args.code) === SHADES.code ? SHADES : LIONS, city_code: 'calderis', city: 'Calderis', linked: true, members: MEMBERS, mine: false, can_apply: true, can_link: false }, [
        act('faction.apply', 'faction.apply', { code: String(args.code ?? LIONS.code), confirm: 'yes' }), back('faction.list'), refreshA('faction.view', { code: String(args.code ?? LIONS.code) })])
    case 'faction.found':
      if (args.name) return mockOk('faction_founded', { ref: named('N3WF4C7', String(args.name)), city_code: 'calderis', city: 'Calderis', fee: 50000, method: String(args.method ?? 'cash') }, [mine('faction.mine', 'faction.mine'), back('player.profile.get')])
      return mockOk('faction_found', { city_code: 'calderis', city: 'Calderis', fee: 50000, payment: { amount: 50000, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 61000, bank: 320000 }, name_min: 3, name_max: 24 }, [
        act('faction.found.pay', 'faction.found', { method: 'cash' }), act('faction.found.pay', 'faction.found', { method: 'card' }), back('faction.list')])
    case 'faction.mine':
      // a player in no faction is sent to the list, which says what founding one still needs
      if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofaction')) return faction('faction.list', { none: true })
      return mockOk('faction_home', { ref: LIONS, rank: 'leader', linked: false, rights: ['invite'], city_code: 'calderis', city: 'Calderis', members: 18, max_members: 25, bank: 420000, applications: 2, operation: OP }, [
        mine('faction.members', 'faction.members'), mine('faction.bank', 'faction.bank'), mine('faction.crime', 'faction.crime'), act('faction.invite', 'faction.invite'),
        act('faction.leave', 'faction.leave', undefined, { kind: 'danger' }), back('player.profile.get'), refreshA('faction.mine')])
    case 'faction.members':
      return mockOk('faction_members', { ref: LIONS, max: 25, can_invite: true, members: MEMBERS, requests: [{ no: 3, kind: 'apply', player: { name: 'بهرام', code: 'BAH7R4M' }, can_decide: true }] }, [
        act('faction.promote', 'faction.rank', { player: NILOO.code, rank: 'officer' }), act('faction.lead', 'faction.rank', { player: NILOO.code, rank: 'leader' }), act('faction.kick', 'faction.kick', { player: NILOO.code }, { kind: 'danger' }),
        act('faction.demote', 'faction.rank', { player: KAVEH.code, rank: 'member' }), act('faction.lead', 'faction.rank', { player: KAVEH.code, rank: 'leader' }), act('faction.kick', 'faction.kick', { player: KAVEH.code }, { kind: 'danger' }),
        act('faction.accept', 'faction.answer', { no: '3', verdict: 'accept' }), act('faction.decline', 'faction.answer', { no: '3', verdict: 'decline' }), act('faction.invite', 'faction.invite'),
        back('faction.mine'), refreshA('faction.members')])
    case 'faction.invite':
      return mockOk('faction_invited', { player: { name: 'بهرام', code: String(args.to ?? 'BAH7R4M') } }, [act('faction.members', 'faction.members'), back('faction.mine')])
    case 'faction.apply':
      return mockOk('faction_applied', { ref: LIONS }, [act('faction.list', 'faction.list'), back('player.profile.get')])
    case 'faction.answer':
      return mockOk('faction_answered', { ref: LIONS, kind: 'apply', accepted: args.verdict !== 'decline', player: { name: 'بهرام', code: 'BAH7R4M' } }, [act('faction.members', 'faction.members'), back('player.profile.get')])
    case 'faction.kick':
    case 'faction.rank':
    case 'faction.leave': {
      if (args.confirm === 'yes') return mockOk('faction_left', { ref: LIONS, disbanded: false, paid_out: 0 }, [act('faction.list', 'faction.list'), back('player.profile.get')])
      const kind = command === 'faction.kick' ? 'kick' : command === 'faction.rank' ? 'lead' : 'leave'
      return mockOk('faction_confirm', { kind, ref: LIONS, player: NILOO }, [
        act(`faction.confirm.${kind}`, command, { ...(command === 'faction.leave' ? {} : { player: NILOO.code }), ...(command === 'faction.rank' ? { rank: 'leader' } : {}), confirm: 'yes' }, { kind: 'confirm' }), back('faction.mine')])
    }
    case 'faction.link':
      return mockOk('faction_linked', { ref: LIONS }, [mine('faction.crime', 'faction.crime')])
    case 'faction.bank':
      return mockOk('faction_bank', { ref: LIONS, balance: 420000, can_deposit: true, can_withdraw: true, cash: 31000, bank_balance: 150000, min: 100, max: 100000, methods: ['cash', 'card'], done: null }, [
        act('faction.deposit.cash', 'faction.deposit', { method: 'cash' }), act('faction.deposit.card', 'faction.deposit', { method: 'card' }), act('faction.withdraw', 'faction.withdraw'), back('faction.mine'), refreshA('faction.bank')])
    case 'faction.deposit':
    case 'faction.withdraw':
      return mockOk('faction_bank', { ref: LIONS, balance: 420000, can_deposit: true, can_withdraw: true, cash: 31000, bank_balance: 150000, min: 100, max: 100000, methods: ['cash', 'card'],
        done: { deposit: command === 'faction.deposit', amount: Number(args.amount ?? 5000), method: String(args.method ?? 'cash') } }, [
        act('faction.deposit.cash', 'faction.deposit', { method: 'cash' }), act('faction.withdraw', 'faction.withdraw'), back('faction.mine')])
    case 'faction.plan':
    case 'faction.join':
    case 'faction.launch':
    case 'faction.calloff':
    case 'faction.crime': {
      const notice = command === 'faction.plan' ? 'planned' : command === 'faction.join' ? 'joined' : command === 'faction.launch' ? 'launched' : command === 'faction.calloff' ? 'called_off' : ''
      const running = command !== 'faction.crime' && command !== 'faction.calloff'
      const op = command === 'faction.calloff' || (command === 'faction.crime' && args.none) ? null : { ...OP, status: command === 'faction.launch' ? 'running' : 'gathering' }
      const acts = op
        ? (running && command === 'faction.launch' ? [] : [act('faction.join', 'faction.join'), act('faction.launch', 'faction.launch'), act('faction.calloff', 'faction.calloff', undefined, { kind: 'danger' })])
        : [act('faction.plan', 'faction.plan', { crime: 'bank_heist' }, { subject: 'bank_heist' })]
      return mockOk('faction_crime', {
        ref: LIONS, notice, can_plan: true, can_launch: true, can_join: true, cut_bps: 1500, operation: op, in_crew: false,
        crimes: [{ crime: named('bank_heist', 'Central bank heist'), min: 2, max: 5, nerve: 12, min_level: 8, duration_seconds: 7200, places: [named('old_town', 'Old Town')] }],
      }, [...acts, back('faction.mine'), refreshA('faction.crime')])
    }
    default:
      return null
  }
}

// -- diplomacy --------------------------------------------------------------------------------------------------------

const sanction = (no: number, imposer: GovPlace, target: GovPlace, liftable: boolean): SanctionLine => ({
  no, imposer, target, measures: ['trade', 'arms'], ground: 'aggression', by: KAVEH, office: 'president', since_seconds: 259200, in_force_in_seconds: liftable ? 0 : 43200,
  liftable, liftable_in_seconds: liftable ? 0 : 86400,
})
const treaty = (no: number, kind: string, status: string, incoming: boolean): TreatyLine => ({
  no, kind: named(kind, kind), other: OTHER, status, incoming, expires_in_seconds: 172800, since_seconds: 400000,
})

function diplomacy(command: string, args: Record<string, unknown>) {
  const c = COUNTRY.code
  const hist = (p: number) => ({
    country: COUNTRY, page: p, pages: 2, entries: [
      { kind: 'sanction_imposed', country: COUNTRY, other: OTHER, measures: ['trade', 'arms'], ground: 'aggression', treaty: named('', ''), no: 4, by: KAVEH, office: 'president', ago_seconds: 259200 },
      { kind: 'treaty_signed', country: COUNTRY, other: OTHER, measures: null, ground: '', treaty: named('trade_agreement', 'Trade'), no: 2, by: null, office: '', ago_seconds: 900000 },
    ],
  })
  switch (command) {
    case 'diplomacy.sanctions':
      return mockOk('sanctions', { country: COUNTRY, imposed: [sanction(4, COUNTRY, OTHER, true), sanction(5, COUNTRY, OTHER, false)], suffered: [sanction(2, OTHER, COUNTRY, false)], can_impose: true,
        notice: args.done ? { kind: 'impose.done', place: OTHER, treaty: named('', ''), in_seconds: 86400 } : null }, [
        act('diplomacy.lift', 'diplomacy.lift', { no: '4' }), act('diplomacy.impose', 'diplomacy.impose'), act('diplomacy.treaties', 'diplomacy.treaties', { country: c }), act('diplomacy.history', 'diplomacy.history', { country: c }),
        back('military.ministry', { country: c }), refreshA('diplomacy.sanctions', { country: c })])
    case 'diplomacy.impose': {
      if (args.blocked) {
        return refusal('sanction_blocked', { measure: String(args.blocked), imposer: COUNTRY, target: OTHER, back: { command: 'player.profile.get', args: null } }, 'sanction_blocked',
          [act('diplomacy.sanctions', 'diplomacy.sanctions', { country: c }), back('player.profile.get')], { measure: String(args.blocked) })
      }
      const target = args.target ? OTHER : null
      if (args.target === 'self') return refusal('diplomacy_refusal', { kind: 'self', country: COUNTRY, office: '', in_seconds: 0, back: { command: 'diplomacy.sanctions', args: [c] } }, 'diplomacy_self', [back('diplomacy.sanctions', { country: c })])
      if (args.confirm === 'yes') return diplomacy('diplomacy.sanctions', { done: true })
      const mask = Number(args.mask ?? 0)
      const meas = ['trade', 'arms', 'technology', 'travel', 'financial']
      const toggles = meas.map((code, i) => ({ code, on: (mask & (1 << i)) !== 0, mask: mask ^ (1 << i) }))
      const chosen = meas.filter((_, i) => (mask & (1 << i)) !== 0)
      const acts: MockAct[] = []
      let view
      if (!target) {
        acts.push(act('diplomacy.target', 'diplomacy.impose', { target: OTHER.code }, { subject: OTHER.code }), back('diplomacy.sanctions', { country: c }))
        view = { country: COUNTRY, targets: [OTHER], target: null, mask: 0, measures: null, chosen: null, grounds: null, ground: '', notice_seconds: 86400, min_duration_seconds: 259200 }
      } else if (args.ground === undefined && args.mask !== '-' && !args.ground) {
        toggles.forEach((m) => acts.push(act('diplomacy.measure', 'diplomacy.impose', { target: OTHER.code, mask: String(m.mask) }, { subject: m.code })))
        if (mask) acts.push(act('diplomacy.next', 'diplomacy.impose', { target: OTHER.code, mask: String(mask), ground: '-' }))
        acts.push(back('diplomacy.impose'))
        view = { country: COUNTRY, targets: null, target: OTHER, mask, measures: toggles, chosen: null, grounds: null, ground: '', notice_seconds: 86400, min_duration_seconds: 259200 }
      } else if (args.ground === '-') {
        for (const g of ['aggression', 'proliferation', 'unfair_trade']) acts.push(act('diplomacy.ground', 'diplomacy.impose', { target: OTHER.code, mask: String(mask), ground: g }, { subject: g }))
        acts.push(back('diplomacy.impose', { target: OTHER.code, mask: String(mask) }))
        view = { country: COUNTRY, targets: null, target: OTHER, mask, measures: null, chosen, grounds: ['aggression', 'proliferation', 'unfair_trade'], ground: '', notice_seconds: 86400, min_duration_seconds: 259200 }
      } else {
        acts.push(act('diplomacy.impose.confirm', 'diplomacy.impose', { target: OTHER.code, mask: String(mask), ground: String(args.ground), confirm: 'yes' }, { kind: 'confirm' }), back('diplomacy.impose', { target: OTHER.code, mask: String(mask), ground: '-' }))
        view = { country: COUNTRY, targets: null, target: OTHER, mask, measures: null, chosen, grounds: null, ground: String(args.ground), notice_seconds: 86400, min_duration_seconds: 259200 }
      }
      return mockOk('impose', view, acts)
    }
    case 'diplomacy.lift':
      if (args.confirm === 'yes') return diplomacy('diplomacy.sanctions', { done: true })
      return mockOk('lift', { country: COUNTRY, sanction: sanction(4, COUNTRY, OTHER, true) }, [act('diplomacy.lift.confirm', 'diplomacy.lift', { no: '4', confirm: 'yes' }, { kind: 'confirm' }), back('diplomacy.sanctions', { country: c })])
    case 'diplomacy.treaties': {
      const ts = [treaty(7, 'alliance', 'proposed', true), treaty(8, 'trade_agreement', 'proposed', false), treaty(2, 'non_aggression', 'active', false), treaty(1, 'trade_agreement', 'terminated', false)]
      return mockOk('treaties', { country: COUNTRY, treaties: ts, can_act: true, notice: args.notice ? { kind: String(args.notice), place: OTHER, treaty: named('alliance', 'Alliance'), in_seconds: 0 } : null }, [
        act('diplomacy.accept', 'diplomacy.answer', { no: '7', verdict: 'accept' }), act('diplomacy.decline', 'diplomacy.answer', { no: '7', verdict: 'decline' }),
        act('diplomacy.withdraw', 'diplomacy.end', { no: '8' }), act('diplomacy.terminate', 'diplomacy.end', { no: '2' }, { kind: 'danger' }), act('diplomacy.propose', 'diplomacy.propose'),
        act('diplomacy.sanctions', 'diplomacy.sanctions', { country: c }), act('diplomacy.history', 'diplomacy.history', { country: c }), back('military.ministry', { country: c }), refreshA('diplomacy.treaties', { country: c })])
    }
    case 'diplomacy.propose': {
      if (args.confirm === 'yes') return diplomacy('diplomacy.treaties', { notice: 'propose.done' })
      if (!args.target) return mockOk('propose', { country: COUNTRY, partners: [OTHER], partner: null, kinds: null, kind: null, ttl_seconds: 172800 }, [act('diplomacy.partner', 'diplomacy.propose', { target: OTHER.code }, { subject: OTHER.code }), back('diplomacy.treaties', { country: c })])
      const kinds = [named('alliance', 'Alliance'), named('trade_agreement', 'Trade')]
      if (!args.kind) return mockOk('propose', { country: COUNTRY, partners: null, partner: OTHER, kinds, kind: null, ttl_seconds: 172800 }, [...kinds.map((k) => act('diplomacy.kind', 'diplomacy.propose', { target: OTHER.code, kind: k.code }, { subject: k.code })), back('diplomacy.propose')])
      return mockOk('propose', { country: COUNTRY, partners: null, partner: OTHER, kinds: null, kind: named(String(args.kind), String(args.kind)), ttl_seconds: 172800 }, [
        act('diplomacy.propose.confirm', 'diplomacy.propose', { target: OTHER.code, kind: String(args.kind), confirm: 'yes' }, { kind: 'confirm' }), back('diplomacy.propose', { target: OTHER.code })])
    }
    case 'diplomacy.answer':
      return diplomacy('diplomacy.treaties', { notice: args.verdict === 'decline' ? 'answer.declined' : 'answer.active' })
    case 'diplomacy.end':
      if (args.confirm === 'yes') return diplomacy('diplomacy.treaties', { notice: 'end.done_terminated' })
      return mockOk('end_treaty', { country: COUNTRY, treaty: treaty(Number(args.no ?? 2), 'non_aggression', Number(args.no) === 8 ? 'proposed' : 'active', false) }, [
        act(Number(args.no) === 8 ? 'diplomacy.withdraw.confirm' : 'diplomacy.terminate.confirm', 'diplomacy.end', { no: String(args.no ?? 2), confirm: 'yes' }, { kind: 'confirm' }), back('diplomacy.treaties', { country: c })])
    case 'diplomacy.history': {
      const p = Number(args.page ?? 1) || 1
      return mockOk('diplomacy_history', hist(p), [...page('diplomacy.history', { country: c }, p, 2), back('diplomacy.sanctions', { country: c }), refreshA('diplomacy.history', { country: c, page: String(p) })])
    }
    default:
      return null
  }
}

// -- the legislature --------------------------------------------------------------------------------------------------

const BILL: BillView = {
  no: 12, place: city(), subject: { kind: 'lever', code: 'city.budget', lever_type: 'allocation', value: 0, allocation: { police: 4000, hospital: 2500, education: 2500, infrastructure: 1000 }, categories: LINES, target: null },
  office: 'mayor', by: ME, body: 'city_council', rule: 'majority', threshold: '', quorum: '1/2', seats: 5, held: 3, needs: 2, status: 'open', lapsed_why: '', yes: 1, nay: 0,
  votes: [{ player: KAVEH, yes: true }], closes_at: null, remaining_seconds: 40000, decided_ago_seconds: 0, can_vote: true, notice: '',
}

function law(command: string, args: Record<string, unknown>) {
  const no = Number(args.no ?? 12) || 12
  const bills = [BILL, { ...BILL, no: 9, status: 'passed', yes: 3, nay: 1, can_vote: false, subject: { ...BILL.subject, kind: 'lever', code: 'city.tax_rate', lever_type: 'bps', value: 500, allocation: null, categories: null } },
    { ...BILL, no: 6, status: 'lapsed', lapsed_why: 'cooldown', can_vote: false, subject: { ...BILL.subject, kind: 'action', code: 'country.war', target: OTHER } }]
  if (command === 'law.list') return mockOk('bills', { bills }, [...bills.map((b) => act('law.view', 'law.view', { no: String(b.no) })), back('gov.city'), refreshA('law.list')])
  if (command === 'law.view') {
    const b = bills.find((x) => x.no === no) ?? BILL
    return mockOk('bill', b, [...(b.status === 'open' ? [act('law.vote.for', 'law.vote', { no: String(b.no), vote: 'yes' }), act('law.vote.against', 'law.vote', { no: String(b.no), vote: 'no' })] : []), act('law.list', 'law.list'), back('law.list'), refreshA('law.view', { no: String(b.no) })])
  }
  if (args.no === '99') return refusal('bill_refusal', { kind: 'not_found', no: 99, body: '' }, 'bill_not_found', [back('law.list')], { no: 99 })
  return mockOk('bill', { ...BILL, can_vote: false, yes: BILL.yes + 1, notice: 'voted' }, [act('law.list', 'law.list'), back('law.list'), refreshA('law.view', { no: String(no) })])
}

// -- people and boards ------------------------------------------------------------------------------------------------

// the friends the mock lists; the second one is in no faction, so the card offers an invitation
const FRIENDS = [
  { id: 'p3', name: KAVEH.name, code: KAVEH.code, faction: 'شیرهای البرز' },
  { id: 'p4', name: 'مینا', code: 'M1N4A7B', faction: '' },
]
const FRIENDS_CAN_INVITE = true

function social(command: string, args: Record<string, unknown>) {
  if (command === 'social.search') {
    const q = String(args.query ?? '')
    if (!q) return mockOk('search', { help: true, by: '', query: '', found: null }, [back('player.profile.get'), refreshA('social.friend.list')])
    if (q === 'nobody') return mockOk('search', { help: false, by: 'code', query: q, found: null }, [back('player.profile.get'), refreshA('social.friend.list')])
    const self = q === ME.code
    return mockOk('search', { help: false, by: 'code', query: q, found: { id: 'p9', name: self ? ME.name : KAVEH.name, code: self ? ME.code : KAVEH.code, self } }, [
      ...(self ? [] : [act('social.add_friend', 'social.friend.add', { player: 'p9' }), act('social.pay', 'bank.pay', { to: KAVEH.code })]), back('player.profile.get'), refreshA('social.friend.list')])
  }
  if (command === 'social.friend.add') return mockOk('friend_requested', { name: KAVEH.name }, [back('player.profile.get'), refreshA('social.friend.list')])
  if (command === 'social.friend.accept') return mockOk('friend_accepted', { name: NILOO.name }, [back('player.profile.get'), refreshA('social.friend.list')])
  if (command === 'social.friend.view') {
    const f = FRIENDS.find((x) => x.id === String(args.player)) ?? FRIENDS[1]
    return mockOk('friend_detail', { id: f.id, name: f.name, code: f.code, faction: f.faction, can_invite: !f.faction && FRIENDS_CAN_INVITE }, [
      act('social.pay', 'bank.pay', { to: f.code }),
      ...(!f.faction && FRIENDS_CAN_INVITE ? [act('social.friend_invite', 'faction.invite', { to: f.code })] : []),
      act('social.friend_remove', 'social.friend.remove', { player: f.id }), back('social.friend.list'), refreshA('social.friend.view', { player: f.id })])
  }
  if (command === 'social.friend.remove') {
    const f = FRIENDS.find((x) => x.id === String(args.player)) ?? FRIENDS[1]
    if (args.confirm !== 'yes') return mockOk('friend_remove_ask', { id: f.id, name: f.name }, [act('social.friend_remove_yes', 'social.friend.remove', { player: f.id, confirm: 'yes' }), back('social.friend.view', { player: f.id })])
    return mockOk('friend_removed', { name: f.name }, [back('social.friend.list'), refreshA('social.friend.list')])
  }
  const p = Number(args.page ?? 1) || 1
  return mockOk('friends', { friends: [{ id: 'p2', name: NILOO.name, code: NILOO.code, status: 'pending', incoming: true }, { id: 'p3', name: KAVEH.name, code: KAVEH.code, status: 'accepted', incoming: false }, { id: 'p4', name: 'مینا', code: 'M1N4A7B', status: 'accepted', incoming: false }, { id: 'p5', name: 'دانا', code: 'D4N2A9C', status: 'pending', incoming: false }], page: p, pages: 1 }, [
    act('social.accept', 'social.friend.accept', { player: 'p2' }), act('social.friend_view', 'social.friend.view', { player: 'p3' }), act('social.friend_view', 'social.friend.view', { player: 'p4' }), back('player.profile.get'), refreshA('social.friend.list', { page: '1' })])
}

function board(args: Record<string, unknown>) {
  // a player who lives in a village sees their neighbours' board first (not a player standing in a city)
  const home = AS_CITY ? null : { code: 'v-k3x9', name: 'آمل' }
  const b = String(args.board ?? (home ? 'village' : 'richest'))
  const lines = {
    village: [{ position: 1, code: 'N5B1V7F', name: 'نسیم', tag: 'trader', tag_name: '', city: named('', ''), value: 184000, extra: 0, extra2: 0, mine: false },
      { position: 2, code: ME.code, name: ME.name, tag: 'trader', tag_name: '', city: named('', ''), value: 31500, extra: 0, extra2: 0, mine: true },
      { position: 3, code: 'D4N2A9C', name: 'دانا', tag: 'tycoon', tag_name: '', city: named('', ''), value: 12200, extra: 0, extra2: 0, mine: false }],
    richest: [{ position: 1, code: 'T1', name: KAVEH.name, tag: 'tycoon', tag_name: '', city: named('', ''), value: 12400000, extra: 0, extra2: 0, mine: false },
      { position: 2, code: 'T2', name: NILOO.name, tag: 'trader', tag_name: '', city: named('', ''), value: 95000, extra: 0, extra2: 0, mine: false },
      { position: 3, code: ME.code, name: ME.name, tag: 'trader', tag_name: '', city: named('', ''), value: 31500, extra: 0, extra2: 0, mine: true }],
    companies: [{ position: 1, code: 'C1', name: 'نان و شیرینی کاوه', tag: 'bakery', tag_name: 'Bakery', city: named('calderis', 'Calderis'), value: 840000, extra: 0, extra2: 0, mine: false },
      { position: 2, code: 'C2', name: 'تعمیرگاه نیلوفر', tag: 'garage', tag_name: 'Garage', city: named('calderis', 'Calderis'), value: 212000, extra: 0, extra2: 0, mine: false }],
    cities: [{ position: 1, code: 'calderis', name: 'Calderis', tag: '', tag_name: '', city: named('', ''), value: 18, extra: 0, extra2: 4, mine: false }],
    workers: [{ position: 1, code: 'W1', name: NILOO.name, tag: '', tag_name: '', city: named('', ''), value: 5200, extra: 0, extra2: 0, mine: false }],
    investors: [{ position: 1, code: 'I1', name: KAVEH.name, tag: '', tag_name: '', city: named('', ''), value: 3100, extra: 0, extra2: 0, mine: false }],
  }[b] ?? []
  const acts = [...(home ? ['village'] : []), 'richest', 'companies', 'cities', 'workers', 'investors'].filter((x) => x !== b).map((x) => act('board.tab', 'life.top', { board: x }, { subject: x }))
  return mockOk('leaderboard', { board: b, lines, at: null, village: home ? named(home.code, home.name) : null, ranks: { tycoon: named('tycoon', 'Tycoon'), trader: named('trader', 'Trader') } }, [...acts, back('player.profile.get'), refreshA('life.top', { board: b })])
}

/** The answer of a politics and society command in the mock; null when the command is not this area's. */
export function mockSocietyCommand(command: string, args: Record<string, unknown> = {}) {
  switch (command) {
    case 'gov.city': return cityGov(args)
    case 'gov.office': return myOffice()
    case 'gov.lever': return leverEdit(args)
    case 'gov.confirm': return policyConfirm(args)
    case 'gov.set': return policySet(args)
    case 'gov.alloc': return allocEdit(args)
    case 'gov.allocok': return allocConfirm(args)
    case 'gov.allocset': return mockOk('policy_announced', { place: city(), lever: BUDGET, old: 0, new: 0, old_allocation: BUDGET.allocation, new_allocation: parseDraft(String(args.draft ?? '')), in_seconds: 86400 }, [act('gov.my_office', 'gov.office'), back('gov.office')])
    case 'gov.history': return govHistory(args)
    case 'gov.appoint': case 'gov.seat': case 'gov.dismiss': case 'gov.unseat': return appoint(command, args)
    case 'election.list': case 'election.view': case 'election.stand': case 'election.vote': return election(command, args)
    case 'life.top': return board(args)
    case 'social.search': case 'social.friend.list': case 'social.friend.add': case 'social.friend.accept': case 'social.friend.view': case 'social.friend.remove': return social(command, args)
    case 'law.list': case 'law.view': case 'law.vote': return law(command, args)
    default:
      if (command.startsWith('faction.')) return faction(command, args)
      if (command.startsWith('diplomacy.')) return diplomacy(command, args)
      return null
  }
}


/** The area's names under the other areas' tables: a table both name holds every code, the other area's entry first. */
export function mergeTables<T extends { code: string }>(mine: Record<string, T[]>, theirs: Record<string, T[]>): Record<string, T[]> {
  const out: Record<string, T[]> = { ...mine }
  for (const [table, list] of Object.entries(theirs)) {
    const have = new Set(list.map((e) => e.code))
    out[table] = [...list, ...(mine[table] ?? []).filter((e) => !have.has(e.code))]
  }
  return out
}
