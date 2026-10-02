// The neutral answers of the military, war and defence area for the mock (?mock=1): every screen of the
// area, typed by the generated Go views, with actions by id and named arguments, never a text or a label
// (docs/adr/0039-presentation-split.md). The player walks the area through its actions: the society hub's
// war tile, the ministry, forces, a branch, stationing; procurement and buying; the war board, declaring,
// the war room, a target, launching an operation and its report; the defence licences.
// `?mock=1&open=<command>&args={"here":"village"}` opens a service as a village player sees it: the
// "not available here" answer and nothing else.

import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import type {
  AssetGroup, BranchForces, Good, GovOffice, GovPlace, GovPlayer, LicenceEntry, Named, Notice, OperationLine, ProcureOffer, Ref, RoomTarget,
  ScreenViews, Unavailable, WarLine,
} from './views.gen'

type Entry = { code: string; name: { en: string; fa: string } }
const e = (code: string, en: string, fa: string): Entry => ({ code, name: { en, fa } })

/** The catalogue names of everything these screens mention (the web never shows the view's authored name). */
export const MILITARY_CONTENT: Record<string, Entry[]> = {
  branch: [e('ground', 'Ground forces', 'نیروی زمینی'), e('air', 'Air force', 'نیروی هوایی'), e('air_defence', 'Air defence', 'پدافند هوایی')],
  military_unit: [
    e('tank', 'Main battle tanks', 'تانک‌های جنگی'), e('ifv', 'Infantry fighting vehicles', 'نفربرهای رزمی'), e('artillery', 'Artillery', 'توپخانه'),
    e('ballistic', 'Ballistic missiles', 'موشک‌های بالستیک'), e('fighter', 'Fighter aircraft', 'جنگنده‌ها'), e('sam_medium', 'Medium-range air defence', 'پدافند میان‌برد'),
  ],
  force_band: [e('few', 'A handful', 'تعدادی انگشت‌شمار'), e('unit', 'A unit', 'یک یگان'), e('force', 'A force', 'یک نیرو'), e('large', 'A large force', 'نیروی بزرگ')],
  war_ground: [e('border_dispute', 'Border dispute', 'اختلاف مرزی'), e('self_defence', 'Self-defence', 'دفاع از خود'), e('protection', 'Protecting allies', 'حمایت از هم‌پیمانان')],
  war_operation: [e('air', 'Air strike', 'حملهٔ هوایی'), e('missile', 'Missile salvo', 'رگبار موشکی'), e('ground', 'Ground assault', 'یورش زمینی')],
  war_damage: [e('light', 'Light', 'سبک'), e('moderate', 'Moderate', 'متوسط'), e('heavy', 'Heavy', 'سنگین'), e('devastating', 'Devastating', 'ویرانگر')],
  war_objective: [e('air_defence', 'Air defences', 'پدافند'), e('industry', 'Industry', 'کارخانه‌ها'), e('depots', 'Supply depots', 'انبارهای تدارکات')],
  war_proposal: [e('ceasefire', 'Ceasefire', 'آتش‌بس'), e('peace', 'Peace', 'صلح')],
  war_chance: [e('likely', 'Likely', 'محتمل'), e('even', 'Even', 'نیمه‌نیمه'), e('unlikely', 'Unlikely', 'بعید')],
  attribute: [e('firepower', 'Firepower', 'قدرت آتش'), e('armour', 'Armour', 'زره'), e('range_km', 'Range (km)', 'برد (کیلومتر)'), e('speed', 'Speed', 'سرعت')],
  item: [e('main_battle_tank', 'Main battle tank', 'تانک جنگی'), e('ifv', 'Infantry fighting vehicle', 'نفربر رزمی'), e('fighter_jet', 'Fighter jet', 'جنگنده'), e('ballistic_missile', 'Ballistic missile', 'موشک بالستیک')],
  city: [e('calderis', 'Calderis', 'کالدریس'), e('azor', 'Azor', 'آزور'), e('brenholt', 'Brenholt', 'برنهولت'), e('kessra', 'Kessra', 'کسرا'), e('support', 'Central City', 'شهر مرکزی')],
  jurisdiction: [e('vantor_federation', 'Vantor Federation', 'فدراسیون ونتور'), e('default_country', 'Commonwealth', 'مشترک‌المنافع'), e('karvia', 'Karvia', 'کارویا')],
  office: [
    e('defence_minister', 'Defence minister', 'وزیر دفاع'), e('chief_of_general_staff', 'Chief of the general staff', 'رئیس ستاد کل'),
    e('ground_forces_commander', 'Ground forces commander', 'فرمانده نیروی زمینی'), e('air_force_commander', 'Air force commander', 'فرمانده نیروی هوایی'),
  ],
  company_type: [e('arms_factory', 'Arms factory', 'کارخانهٔ تسلیحات'), e('studio', 'Studio', 'استودیو'), e('garage', 'Garage', 'تعمیرگاه')],
  treaty_kind: [e('non_aggression', 'Non-aggression pact', 'پیمان عدم تجاوز'), e('alliance', 'Military alliance', 'پیمان نظامی')],
}

// -- people, places, goods --------------------------------------------------------------------------------

const COUNTRY: GovPlace = { kind: 'country', code: 'vantor_federation', name: 'Vantor Federation' }
const OTHER: GovPlace = { kind: 'country', code: 'default_country', name: 'Commonwealth' }
const THIRD: GovPlace = { kind: 'country', code: 'karvia', name: 'Karvia' }
const city = (code: string, name: string): GovPlace => ({ kind: 'city', code, name })
const CALDERIS = city('calderis', 'Calderis')
const AZOR = city('azor', 'Azor')
const BRENHOLT = city('brenholt', 'Brenholt')
const KESSRA = city('kessra', 'Kessra')
const KAVEH: GovPlayer = { name: 'کاوه', code: 'KAV4E7Z' }
const NILOO: GovPlayer = { name: 'نیلوفر', code: 'NIL0F2R' }
const N = (code: string, name: string = code): Named => ({ code, name })
const good = (item: string, design = ''): Good => ({ component: false, item: N(item), design, design_no: design ? 4 : 0 })
const company = (code: string, name: string, type = 'arms_factory') => ({ code, name, type: N(type) })
const AT = '2026-10-02T18:00:00Z'
const ref = (command: string, args: string[] | null = null): Ref => ({ command, args })
const cc = COUNTRY.code

// -- the gate: a village or a town has none of this yet ------------------------------------------------------

function gate(service: string, args: Record<string, unknown>): Unavailable | null {
  const here = args.here
  if (here !== 'village' && here !== 'town') return null
  return { service, stage: 'country', here: String(here), requires: null, nearest: N('support', 'شهر مرکزی') }
}

const gateActs = (): MockAct[] => [A('support.travel', 'travel.options', { city: 'support' }, { subject: 'support', kind: 'navigation' }), back('player.profile.get')]

const nav = (id: string, command: string, args: Record<string, string>, subject?: string): MockAct => A(id, command, args, { kind: 'navigation', subject })
const confirmA = (id: string, command: string, args: Record<string, string>): MockAct => ({ ...A(id, command, args), kind: 'confirm' })
const asking = (a: MockAct, field: string): MockAct => ({ ...a, input: { field } })

const notice = (code: string, o: Partial<Notice> = {}): Notice => ({ code, count: 0, good: good(''), city_code: '', city: '', time_seconds: 0, total: 0, kind: '', target: { kind: '', code: '', name: '' }, ...o })

// -- the mock's own state, so a step shows its notice and its new numbers -----------------------------------

const st = {
  fund: 1240000,
  moves: [{ good: good('main_battle_tank', 'سیمرغ'), qty: 12, city_code: 'azor', city: 'Azor', left_seconds: 5400, at: AT }] as { good: Good; qty: number; city_code: string; city: string; left_seconds: number; at: string }[],
  bought: 0,
  declared: false,
  proposals: true,
  licences: {
    pending: [{ no: 31, company: company('AR1', 'صنایع آراز', 'garage'), kind: 'contractor', basis: 'minister', status: 'pending', effective_at: null }] as LicenceEntry[],
    inForce: [
      { no: 27, company: company('FN2', 'فولاد نوین'), kind: 'manufacturer', basis: 'rank', status: 'active', effective_at: null },
      { no: 22, company: company('SH3', 'سپر هوایی'), kind: 'contractor', basis: 'minister', status: 'revoking', effective_at: '2026-10-04T10:00:00Z' },
    ] as LicenceEntry[],
    ended: [{ no: 14, company: company('KV4', 'کیان صنعت'), kind: 'manufacturer', basis: 'grandfathered', status: 'revoked', effective_at: '2026-09-20T10:00:00Z' }] as LicenceEntry[],
  },
}

// -- the ministry, the forces, a branch ---------------------------------------------------------------------

const classLine = (code: string, band: string, count: number) => ({ class: N(code), band, count })
const BRANCHES: BranchForces[] = [
  { branch: N('ground'), classes: [classLine('tank', 'force', 24), classLine('ifv', 'force', 31), classLine('artillery', 'unit', 9)] },
  { branch: N('air'), classes: [classLine('fighter', 'unit', 12)] },
  { branch: N('air_defence'), classes: [classLine('sam_medium', 'few', 3)] },
]
/** What an outsider reads: bands only. */
const bands = (b: BranchForces[]): BranchForces[] => b.map((x) => ({ ...x, classes: (x.classes ?? []).map((c) => ({ ...c, count: 0 })) }))

const office = (code: string, holders: GovPlayer[] | null, acting: GovPlayer[] | null = null): GovOffice => ({ code, seats: 1, holders, acting_code: acting ? 'president' : '', acting })

function ministry(args: Record<string, unknown>) {
  const un = gate('armed_forces', args)
  if (un) return mockOk('ministry', blankMinistry(un), gateActs())
  return mockOk('ministry', {
    unavailable: null, country: COUNTRY,
    offices: [office('defence_minister', [KAVEH]), office('chief_of_general_staff', [NILOO]), office('ground_forces_commander', null, [KAVEH]), office('air_force_commander', null)],
    treasury: 4820000, fund: st.fund, revenue_share_bps: 1800, defence_budget_bps: 2200, arms_exports: 1,
    last: { levy: 480000, appropriation: 600000, upkeep_due: 62000, upkeep_paid: 62000 }, next_in_seconds: 21600, next_at: AT,
    forces: BRANCHES, cleared: true, readiness: 8200, upkeep: 62000, can_procure: true,
    notice: st.bought > 0 ? notice('buy_done', { count: st.bought, good: good('main_battle_tank'), total: st.bought * 8200 }) : null,
    pending_licences: st.licences.pending.length,
  }, [
    nav('military.forces', 'military.forces', { country: cc }), nav('military.procure', 'military.procure', { country: cc }),
    nav('military.sanctions', 'diplomacy.sanctions', { country: cc }), nav('military.treaties', 'diplomacy.treaties', { country: cc }),
    nav('military.war', 'war.board', { country: cc }), nav('military.licences', 'military.licences', { country: cc }),
    back('gov.city'), refreshA('military.ministry', { country: cc }),
  ])
}

function blankMinistry(un: Unavailable): ScreenViews['ministry'] {
  return {
    unavailable: un, country: { kind: '', code: '', name: '' }, offices: null, treasury: 0, fund: 0, revenue_share_bps: 0, defence_budget_bps: 0, arms_exports: 0, last: null,
    next_in_seconds: 0, next_at: null, forces: null, cleared: false, readiness: 0, upkeep: 0, can_procure: false, notice: null, pending_licences: 0,
  }
}

function forces(args: Record<string, unknown>) {
  const un = gate('armed_forces', args)
  if (un) {
    return mockOk('forces', { unavailable: un, country: { kind: '', code: '', name: '' }, branches: null, cleared: false, readiness: 0, upkeep: 0, moving: 0 }, gateActs())
  }
  return mockOk('forces', { unavailable: null, country: COUNTRY, branches: BRANCHES, cleared: true, readiness: 8200, upkeep: 62000, moving: 12 }, [
    ...BRANCHES.map((b) => nav('military.branch', 'military.branch', { country: cc, branch: b.branch.code }, b.branch.code)),
    back('military.ministry', { country: cc }), refreshA('military.forces', { country: cc }),
  ])
}

const GROUPS: Record<string, AssetGroup[]> = {
  ground: [
    {
      good: good('main_battle_tank', 'سیمرغ'), class: N('tank'), count: 24, quality: 78,
      garrisons: [{ city_code: 'calderis', city: 'Calderis', count: 18 }, { city_code: 'azor', city: 'Azor', count: 6 }], depot: 0, moving: 12, committed: 0, damaged: 2,
      attributes: [{ name: 'firepower', value: 120, observable: true }, { name: 'armour', value: 95, observable: true }, { name: 'speed', value: 62, observable: false }], seen_at: 0,
    },
    {
      good: good('ifv'), class: N('ifv'), count: 31, quality: 65, garrisons: [{ city_code: 'calderis', city: 'Calderis', count: 31 }], depot: 4, moving: 0, committed: 0, damaged: 0,
      attributes: [{ name: 'firepower', value: 45, observable: true }, { name: 'armour', value: 50, observable: true }], seen_at: 0,
    },
  ],
  air: [{
    good: good('fighter_jet'), class: N('fighter'), count: 12, quality: 82, garrisons: [{ city_code: 'calderis', city: 'Calderis', count: 12 }], depot: 0, moving: 0, committed: 4, damaged: 0,
    attributes: [{ name: 'range_km', value: 1800, observable: true }, { name: 'speed', value: 2100, observable: true }], seen_at: 310,
  }],
  air_defence: [],
}

function branch(args: Record<string, unknown>) {
  const code = String(args.branch ?? 'ground')
  const groups = GROUPS[code] ?? []
  const acts = [
    ...groups.map((g) => nav('military.station', 'military.station', { country: cc, target: g.good.item.code }, g.good.item.code)),
    back('military.forces', { country: cc }), refreshA('military.branch', { country: cc, branch: code }),
  ]
  const moved = st.moves.length > 1
  return mockOk('branch', {
    country: COUNTRY, branch: N(code), groups, moves: code === 'ground' ? st.moves : null, can_station: true, reference_radar_km: 400,
    notice: moved ? notice('station_started', { count: st.moves[st.moves.length - 1].qty, good: st.moves[st.moves.length - 1].good, city_code: 'azor', city: 'Azor', time_seconds: 5400 }) : null,
  }, acts)
}

function station(args: Record<string, unknown>) {
  const target = String(args.target ?? 'main_battle_tank')
  const cityCode = String(args.city ?? '')
  const qty = Number(args.qty ?? 0)
  const g = good(target, target === 'main_battle_tank' ? 'سیمرغ' : '')
  const base = { country: COUNTRY, branch: N('ground'), good: g, available: 12, cities: [CALDERIS, AZOR] as GovPlace[], city_code: '', city: '', qty: 0, time_seconds: 0, confirm: false }
  const here = { country: cc, target }
  if (!cityCode) {
    return mockOk('station', base, [
      ...base.cities!.map((c) => nav('military.station_city', 'military.station', { ...here, city: c.code }, c.code)),
      back('military.branch', { country: cc, branch: 'ground' }),
    ])
  }
  const c = cityCode === 'azor' ? AZOR : CALDERIS
  if (!qty) {
    return mockOk('station', { ...base, city_code: c.code, city: c.name, time_seconds: 5400 }, [
      ...[1, 5, 10, 12].map((q) => A('military.station_qty', 'military.station', { ...here, city: c.code, qty: String(q) })),
      asking(A('military.station_custom', 'military.station', { ...here, city: c.code }), 'qty'),
      back('military.station', here),
    ])
  }
  if (!args.confirm) {
    return mockOk('station', { ...base, city_code: c.code, city: c.name, qty, time_seconds: 5400, confirm: true }, [
      confirmA('military.station_confirm', 'military.station', { ...here, city: c.code, qty: String(qty), confirm: 'yes' }),
      back('military.station', { ...here, city: c.code }),
    ])
  }
  if (qty > 12) return milRefusal('stock', { max: 12, back: ref('military.station', [cc, target]) })
  st.moves.push({ good: g, qty, city_code: c.code, city: c.name, left_seconds: 5400, at: AT })
  return branch({ branch: 'ground' })
}

// -- procurement ---------------------------------------------------------------------------------------------

const OFFERS: ProcureOffer[] = [
  { no: 41, good: good('main_battle_tank', 'سیمرغ'), company: company('FN2', 'فولاد نوین'), city_code: 'calderis', city: 'Calderis', country: COUNTRY, left: 40, price: 8200, blocked: '' },
  { no: 42, good: good('ifv'), company: company('SH3', 'سپر هوایی'), city_code: 'azor', city: 'Azor', country: COUNTRY, left: 25, price: 5100, blocked: '' },
  { no: 43, good: good('fighter_jet'), company: company('KV4', 'کیان صنعت'), city_code: 'brenholt', city: 'Brenholt', country: OTHER, left: 6, price: 61000, blocked: 'embargo' },
  { no: 44, good: good('ballistic_missile'), company: company('FN2', 'فولاد نوین'), city_code: 'calderis', city: 'Calderis', country: COUNTRY, left: 10, price: 24000, blocked: 'export' },
]

function procure(args: Record<string, unknown>) {
  const un = gate('procurement', args)
  if (un) return mockOk('procure', { unavailable: un, country: { kind: '', code: '', name: '' }, fund: 0, offers: null, notice: null }, gateActs())
  return mockOk('procure', { unavailable: null, country: COUNTRY, fund: st.fund, offers: OFFERS, notice: null }, [
    ...OFFERS.filter((o) => !o.blocked).map((o) => nav('military.buy_open', 'military.buy', { country: cc, no: String(o.no) }, o.good.item.code)),
    back('military.ministry', { country: cc }), refreshA('military.procure', { country: cc }),
  ])
}

function armsBuy(args: Record<string, unknown>) {
  const o = OFFERS.find((x) => String(x.no) === String(args.no)) ?? OFFERS[0]
  const qty = Number(args.qty ?? 0)
  const attributes = [{ name: 'firepower', value: 120, observable: true }, { name: 'armour', value: 95, observable: true }, { name: 'range_km', value: 450, observable: true }]
  const here = { country: cc, no: String(o.no) }
  if (!qty) {
    return mockOk('arms_buy', { country: COUNTRY, offer: o, attributes, fund: st.fund, qty: 0, confirm: false, total: 0 }, [
      ...[1, 2, 5, 10].filter((q) => q <= o.left).map((q) => A('military.buy_qty', 'military.buy', { ...here, qty: String(q) })),
      asking(A('military.buy_custom', 'military.buy', here), 'qty'),
      back('military.procure', { country: cc }),
    ])
  }
  if (!args.confirm) {
    return mockOk('arms_buy', { country: COUNTRY, offer: o, attributes, fund: st.fund, qty, confirm: true, total: qty * o.price }, [
      confirmA('military.buy_confirm', 'military.buy', { ...here, qty: String(qty), confirm: 'yes' }), back('military.buy', here),
    ])
  }
  if (qty * o.price > st.fund) return milRefusal('funds', { need: qty * o.price, have: st.fund, back: ref('military.buy', [cc, String(o.no)]) })
  st.fund -= qty * o.price
  st.bought = qty
  return ministry({})
}

function milRefusal(kind: string, o: { office?: string; need?: number; have?: number; max?: number; back?: Ref } = {}) {
  const view = { kind, country: COUNTRY, office: o.office ?? '', need: o.need ?? 0, have: o.have ?? 0, max: o.max ?? 0, back: o.back ?? ref('military.ministry', [cc]) }
  return {
    ok: false, request_id: 'mock', screen: 'military_refusal', view,
    error: { code: `military_${kind}`, args: { country: cc, ...(o.need ? { need: o.need } : {}), ...(o.have ? { have: o.have } : {}), ...(o.max ? { max: o.max } : {}) } },
    actions: [back(view.back.command)],
  }
}

function warRefusal(kind: string, o: { in?: number; office?: string; back?: Ref } = {}) {
  const view = { kind, country: COUNTRY, office: o.office ?? '', in_seconds: o.in ?? 0, max: 0, back: o.back ?? ref('war.board', [cc]) }
  return {
    ok: false, request_id: 'mock', screen: 'war_refusal', view,
    error: { code: `war_${kind}`, args: { country: cc, ...(o.in ? { remaining_seconds: o.in } : {}) } },
    actions: [back(view.back.command)],
  }
}

// -- the war board and its decisions --------------------------------------------------------------------------

const wars = (): WarLine[] => [
  {
    no: 7, attacker: COUNTRY, defender: OTHER, attacker_allies: [THIRD], defender_allies: null, ground: 'border_dispute', status: 'active', active_in_seconds: 0, active_at: null,
    since_seconds: 259200, broke: true,
    proposals: st.proposals ? [{ no: 3, kind: 'ceasefire', other: OTHER, incoming: true, expires_in_seconds: 36000 }] : null, can_propose: true, can_resume: false,
  },
  {
    no: 8, attacker: THIRD, defender: COUNTRY, attacker_allies: null, defender_allies: null, ground: 'self_defence', status: 'declared', active_in_seconds: 7200, active_at: AT,
    since_seconds: 1800, broke: false, proposals: null, can_propose: false, can_resume: false,
  },
  {
    no: 9, attacker: COUNTRY, defender: THIRD, attacker_allies: null, defender_allies: null, ground: 'protection', status: 'ceasefire', active_in_seconds: 0, active_at: null,
    since_seconds: 604800, broke: false, proposals: null, can_propose: true, can_resume: true,
  },
  ...(st.declared ? [{
    no: 10, attacker: COUNTRY, defender: THIRD, attacker_allies: null, defender_allies: null, ground: 'border_dispute', status: 'declared', active_in_seconds: 43200, active_at: AT,
    since_seconds: 60, broke: false, proposals: null, can_propose: true, can_resume: false,
  }] : []),
]

const operations = (): OperationLine[] => [
  {
    no: 21, kind: 'air', objective: 'air_defence', country: COUNTRY, city_code: 'brenholt', city: 'Brenholt', target: OTHER, pending: true, strikes_in_seconds: 900, called_off: false,
    damage_band: '', lost_band: '', enemy_lost_band: '', captured: false, ago_seconds: 0,
  },
  {
    no: 19, kind: 'missile', objective: 'industry', country: OTHER, city_code: 'calderis', city: 'Calderis', target: COUNTRY, pending: false, strikes_in_seconds: 0, called_off: false,
    damage_band: 'moderate', lost_band: 'few', enemy_lost_band: 'unit', captured: false, ago_seconds: 14400,
  },
  {
    no: 18, kind: 'ground', objective: 'depots', country: COUNTRY, city_code: 'kessra', city: 'Kessra', target: OTHER, pending: false, strikes_in_seconds: 0, called_off: false,
    damage_band: 'heavy', lost_band: 'unit', enemy_lost_band: 'force', captured: true, ago_seconds: 90000,
  },
]

function warBoard(args: Record<string, unknown>, n: Notice | null = null) {
  const un = gate('war', args)
  if (un) return mockOk('war_board', blankBoard(un), gateActs())
  const list = wars()
  const acts: MockAct[] = []
  for (const w of list) {
    for (const p of w.proposals ?? []) {
      if (p.incoming && w.can_propose) {
        acts.push({ ...A('war.accept', 'war.answer', { no: String(p.no), verdict: 'accept' }), kind: 'primary' }, A('war.decline', 'war.answer', { no: String(p.no), verdict: 'decline' }))
      }
    }
    if (w.can_propose) {
      if (w.status === 'active' || w.status === 'declared') acts.push(A('war.ceasefire', 'war.propose', { no: String(w.no), kind: 'ceasefire' }, { kind: 'primary' }))
      acts.push(A('war.peace', 'war.propose', { no: String(w.no), kind: 'peace' }, { kind: 'primary' }))
    }
    if (w.can_resume) acts.push(nav('war.resume', 'war.resume', { no: String(w.no) }))
  }
  acts.push(A('war.join', 'war.join', { no: '12' }, { kind: 'primary' }), nav('war.room', 'war.room', {}), A('war.declare', 'war.declare', {}, { kind: 'primary' }),
    back('military.ministry', { country: cc }), refreshA('war.board', { country: cc }))
  return mockOk('war_board', {
    unavailable: null, country: COUNTRY, wars: list, joinable: [{ war_no: 12, ally: OTHER, enemy: THIRD }],
    occupied: [{ city_code: 'kessra', city: 'Kessra', controller: COUNTRY, de_jure: OTHER, since_seconds: 86400 }],
    damaged: [{ city_code: 'calderis', city: 'Calderis', band: 'moderate', closed_in_seconds: 10800 }, { city_code: 'azor', city: 'Azor', band: 'light', closed_in_seconds: 0 }],
    operations: operations(), can_declare: true, can_command: true, notice: n,
  }, acts)
}

function blankBoard(un: Unavailable): ScreenViews['war_board'] {
  return { unavailable: un, country: { kind: '', code: '', name: '' }, wars: null, joinable: null, occupied: null, damaged: null, operations: null, can_declare: false, can_command: false, notice: null }
}

function declare(args: Record<string, unknown>) {
  const un = gate('war', args)
  if (un) return mockOk('war_declare', { unavailable: un, country: COUNTRY, targets: null, target: null, grounds: null, ground: '', notice_seconds: 0, breaks: null, allies: null }, gateActs())
  const base = { unavailable: null, country: COUNTRY, targets: [OTHER, THIRD] as GovPlace[], target: null as GovPlace | null, grounds: null as string[] | null, ground: '', notice_seconds: 0, breaks: null as Named[] | null, allies: null as GovPlace[] | null }
  const targetCode = String(args.target ?? '')
  const ground = String(args.ground ?? '')
  if (!targetCode) return mockOk('war_declare', base, [...base.targets!.map((c) => nav('war.declare_target', 'war.declare', { target: c.code }, c.code)), back('war.board', { country: cc })])
  const target = targetCode === 'karvia' ? THIRD : OTHER
  const grounds = ['border_dispute', 'self_defence', 'protection']
  if (!ground) {
    return mockOk('war_declare', { ...base, target, grounds }, [...grounds.map((g) => nav('war.declare_ground', 'war.declare', { target: target.code, ground: g }, g)), back('war.declare', {})])
  }
  if (!args.confirm) {
    return mockOk('war_declare', { ...base, target, grounds, ground, notice_seconds: 43200, breaks: [N('non_aggression')], allies: [OTHER] }, [
      confirmA('war.declare_confirm', 'war.declare', { target: target.code, ground, confirm: 'yes' }), back('war.declare', { target: target.code }),
    ])
  }
  if (target.code === OTHER.code) return warRefusal('at_war')
  st.declared = true
  return warBoard({}, notice('declare_done', { target, time_seconds: 43200 }))
}

function decision(kind: string, args: Record<string, unknown>) {
  const no = String(args.no ?? '7')
  const view = { kind, country: COUNTRY, war_no: Number(no), other: kind === 'join' ? THIRD : OTHER, ally: kind === 'join' ? OTHER : { kind: '', code: '', name: '' }, notice_seconds: 43200, ttl_seconds: 86400 }
  const confirmId = kind === 'join' ? 'war.join_confirm' : kind === 'resume' ? 'war.resume_confirm' : 'war.propose_confirm'
  const command = kind === 'join' ? 'war.join' : kind === 'resume' ? 'war.resume' : 'war.propose'
  const cargs: Record<string, string> = kind === 'join' || kind === 'resume' ? { no, confirm: 'yes' } : { no, kind, confirm: 'yes' }
  return mockOk('war_decision', view, [{ ...confirmA(confirmId, command, cargs), ...(kind === 'ceasefire' || kind === 'peace' ? { subject: kind } : {}) }, back('war.board', { country: cc })])
}

function warCommand(command: string, args: Record<string, unknown>) {
  switch (command) {
    case 'war.board': return warBoard(args)
    case 'war.declare': return declare(args)
    case 'war.join':
      return args.confirm ? warBoard({}, notice('join_done', { target: THIRD })) : decision('join', args)
    case 'war.propose':
      return args.confirm ? warBoard({}, notice('propose_done', { kind: String(args.kind), target: OTHER })) : decision(String(args.kind ?? 'ceasefire'), args)
    case 'war.answer': {
      const accept = args.verdict === 'accept'
      st.proposals = false
      return warBoard({}, notice(accept ? 'answer_accept' : 'answer_decline'))
    }
    case 'war.resume':
      return args.confirm ? warRefusal('not_yet', { in: 7200 }) : decision('resume', args)
    case 'war.room': return warRoom(args)
    case 'war.target': return warTarget(args)
    case 'war.launch': return warLaunch(args)
    case 'war.blocked': return warBlocked(args)
    default: return null
  }
}

// -- the war room, a target, launching an operation, its report ----------------------------------------------

const TARGETS: RoomTarget[] = [
  { city_code: 'brenholt', city: 'Brenholt', country: OTHER, war_no: 7, distance_km: 240, damage_band: '' },
  { city_code: 'kessra', city: 'Kessra', country: OTHER, war_no: 7, distance_km: 410, damage_band: 'heavy' },
]

function warRoom(args: Record<string, unknown>) {
  const un = gate('war', args)
  if (un) return mockOk('war_room', { unavailable: un, country: { kind: '', code: '', name: '' }, targets: null, running: null, readiness: 0, notice: null }, gateActs())
  return mockOk('war_room', { unavailable: null, country: COUNTRY, targets: TARGETS, running: operations().filter((o) => o.country.code === cc), readiness: 8200, notice: null }, [
    ...TARGETS.map((tg) => A('war.target', 'war.target', { city: tg.city_code }, { kind: 'primary', subject: tg.city_code })),
    back('war.board', { country: cc }), refreshA('war.room', {}),
  ])
}

const option = (kind: string, cls: string, ready: number, can = true) => ({
  kind, class: N(cls), ready, from_code: 'calderis', from: 'Calderis', distance_km: 240, munitions: kind === 'air' ? 30 : 0, can_launch: can, office: can ? '' : 'air_force_commander',
})

function warTarget(args: Record<string, unknown>) {
  const tg = TARGETS.find((x) => x.city_code === args.city) ?? TARGETS[0]
  const options = [option('air', 'fighter', 8), option('missile', 'ballistic', 6), option('ground', 'tank', 18, false)]
  return mockOk('war_target', {
    country: COUNTRY, target: tg, options, occupied: tg.city_code === 'kessra' ? { city_code: 'kessra', city: 'Kessra', controller: COUNTRY, de_jure: OTHER, since_seconds: 86400 } : null,
  }, [
    ...options.filter((o) => o.can_launch).map((o) => A('war.launch_open', 'war.launch', { city: tg.city_code, kind: o.kind, class: o.kind === 'ground' ? 'all' : o.class.code }, { kind: 'primary', subject: o.kind })),
    back('war.room', {}), refreshA('war.target', { city: tg.city_code }),
  ])
}

function warLaunch(args: Record<string, unknown>) {
  const tg = TARGETS.find((x) => x.city_code === args.city) ?? TARGETS[0]
  const kind = String(args.kind ?? 'air')
  const cls = String(args.class ?? 'fighter')
  const objective = String(args.objective ?? '')
  const qty = Number(args.qty ?? 0)
  const opt = option(kind, kind === 'ground' ? 'tank' : cls, kind === 'missile' ? 6 : 8)
  const base = { country: COUNTRY, target: tg, option: opt, objectives: ['air_defence', 'industry', 'depots'], objective: '', quantities: [1, 2, 4], qty: 0, confirm: false, prepare_seconds: kind === 'ground' ? 21600 : 1200, munitions: opt.munitions, estimate: null }
  const here = { city: tg.city_code, kind, class: cls }
  if (!objective) {
    return mockOk('war_launch', base, [...base.objectives.map((o) => A('war.launch_objective', 'war.launch', { ...here, objective: o }, { kind: 'secondary', subject: o })), back('war.target', { city: tg.city_code })])
  }
  if (!qty) {
    return mockOk('war_launch', { ...base, objective }, [...base.quantities.map((q) => A('war.launch_qty', 'war.launch', { ...here, objective, qty: String(q) })), back('war.launch', here)])
  }
  if (!args.confirm) {
    return mockOk('war_launch', { ...base, objective, qty, confirm: true, estimate: { chance: 'likely', loss_band: 'few', damage_band: 'moderate' } }, [
      confirmA('war.launch_confirm', 'war.launch', { ...here, objective, qty: String(qty), confirm: 'yes' }), back('war.launch', { ...here, objective }),
    ])
  }
  return mockOk('strike_report', {
    no: 22, kind, objective, country: COUNTRY, target: OTHER, city_code: tg.city_code, city: tg.city, class: opt.class, ours: true, called_off: false,
    committed: qty, lost: 0, damaged: 1, enemy_lost: 3, enemy_dmg: 5, seen_at_km: 0, fired: kind === 'ground' ? 0 : qty * 4, munitions: kind === 'air' ? 20 : 0, hits: kind === 'ground' ? 0 : qty * 3,
    damage_bps: 3200, damage_band: 'moderate', captured: false, liberated: false,
  }, [nav('war.room', 'war.room', {}), back('war.board', { country: cc })])
}

function warBlocked(args: Record<string, unknown>) {
  const border = args.kind === 'border'
  const view = { border, from: CALDERIS, to: OTHER, city_code: 'calderis', city: 'Calderis', in_seconds: 10800, back: ref('player.profile.get') }
  const view2 = border ? { ...view, from: COUNTRY, to: OTHER } : view
  return {
    ok: false, request_id: 'mock', screen: 'war_blocked', view: view2,
    error: { code: border ? 'war_blocked_border' : 'war_blocked_city', args: border ? { from: cc, to: OTHER.code } : { city: 'calderis', remaining_seconds: 10800 } },
    actions: [back('player.profile.get')],
  }
}

// -- the defence licences -------------------------------------------------------------------------------------

function licences(args: Record<string, unknown>, n = '', nCompany = '') {
  const un = gate('defence_licence', args)
  if (un) return mockOk('licences', { unavailable: un, country: { kind: '', code: '', name: '' }, pending: null, in_force: null, ended: null, can_decide: false, notice: '', notice_company: '', confirm: null, revoke_notice_seconds: 0 }, gateActs())
  const l = st.licences
  const acts: MockAct[] = []
  for (const x of l.pending) acts.push({ ...A('defence.approve', 'military.licence', { no: String(x.no), verdict: 'approve' }), kind: 'primary' }, { ...A('defence.reject', 'military.licence', { no: String(x.no), verdict: 'reject' }), kind: 'danger' })
  for (const x of l.inForce) if (x.status === 'active') acts.push({ ...A('defence.revoke', 'military.licence', { no: String(x.no), verdict: 'revoke' }), kind: 'danger' })
  acts.push(back('military.ministry', { country: cc }), refreshA('military.licences', { country: cc }))
  return mockOk('licences', { unavailable: null, country: COUNTRY, pending: l.pending, in_force: l.inForce, ended: l.ended, can_decide: true, notice: n, notice_company: nCompany, confirm: null, revoke_notice_seconds: 172800 }, acts)
}

function licence(args: Record<string, unknown>) {
  const no = Number(args.no)
  const l = st.licences
  const entry = [...l.pending, ...l.inForce].find((x) => x.no === no)
  if (!entry) return milRefusal('licence_state', { back: ref('military.licences', [cc]) })
  const verdict = String(args.verdict)
  if (verdict === 'revoke' && !args.confirm) {
    return mockOk('licences', {
      unavailable: null, country: COUNTRY, pending: l.pending, in_force: l.inForce, ended: l.ended, can_decide: true, notice: '', notice_company: '', confirm: entry, revoke_notice_seconds: 172800,
    }, [confirmA('defence.revoke_confirm', 'military.licence', { no: String(no), verdict: 'revoke', confirm: 'yes' }), back('military.licences', { country: cc })])
  }
  const name = entry.company.name
  if (verdict === 'revoke') {
    entry.status = 'revoking'
    entry.effective_at = '2026-10-04T10:00:00Z'
  } else {
    l.pending = l.pending.filter((x) => x.no !== no)
    if (verdict === 'approve') l.inForce.unshift({ ...entry, status: 'active' })
    else l.ended.unshift({ ...entry, status: 'rejected' })
  }
  return licences({}, verdict, name)
}

function companyDefence(args: Record<string, unknown>) {
  const code = String(args.company ?? 'AR1')
  const apply = !!args.apply || args.yes === 'yes'
  const manufacturer = code === 'FN2'
  const licenceEntry = manufacturer ? st.licences.inForce[0] : apply ? st.licences.pending[0] : null
  const can = !manufacturer && !apply
  return mockOk('company_defence', {
    ref: company(code, manufacturer ? 'فولاد نوین' : 'صنایع آراز', manufacturer ? 'arms_factory' : 'garage'), licence: licenceEntry, manufacturer, owned: 5, tier: 3, min_techs: 4, min_tier: 3, can_apply: can, applied: apply, no_minister: false,
  }, [
    ...(can ? [{ ...A('defence.apply', 'company.defence', { company: code, apply: 'yes' }), kind: 'primary' }] : []),
    back('company.manage', { company: code }), refreshA('company.defence', { company: code }),
  ])
}

function kit(args: Record<string, unknown>) {
  return mockOk('kit_purchase', { bought: !!args.confirm, seller: 'فولاد نوین', country: cc }, [nav('military.procure', 'military.procure', { country: cc }), back('military.ministry', { country: cc })])
}

function retrofit(args: Record<string, unknown>) {
  const started = !!args.confirm
  const view = { country: cc, kit_serial: 'K-2041', target_serial: 'T-0178', good: good('main_battle_tank', 'سیمرغ'), from_ver: 1, to_ver: 2, duration_seconds: 43200, finish_at: AT, started }
  return mockOk('state_retrofit', view, [
    ...(started ? [] : [confirmA('military.retrofit_confirm', 'military.retrofit', { country: cc, target: 'T-0178', city: 'K-2041', confirm: 'yes' })]),
    back('military.forces', { country: cc }),
  ])
}

// -- the notices pushed to a player (opened from the inbox) ---------------------------------------------------

function warNotice(args: Record<string, unknown>) {
  const kind = String(args.kind ?? 'struck')
  const view = {
    kind, country: COUNTRY, other: OTHER, ally: OTHER, city_code: 'calderis', city: 'Calderis', war_no: 7, proposal_no: 3, proposal_kind: 'ceasefire', band: 'moderate', in_seconds: 36000,
    injury: kind === 'struck' ? { damage: 35, health: 55, max: 100, hospital: true, ends_at: AT } : null,
  }
  const acts: MockAct[] = []
  if (kind === 'ally') acts.push(A('war.join', 'war.join', { no: '7' }, { kind: 'primary' }))
  if (kind === 'proposal') acts.push({ ...A('war.accept', 'war.answer', { no: '3', verdict: 'accept' }), kind: 'primary' }, A('war.decline', 'war.answer', { no: '3', verdict: 'decline' }))
  if (kind === 'struck') acts.push(A('war.hospital', 'health.hospital', {}, { kind: 'navigation' }))
  acts.push(back('war.board', { country: cc }))
  return mockOk('war_notice', view, acts)
}

/** Every command of the area answers here, writes included; null for a command that is not the area's. */
export function mockMilitaryCommand(command: string, args: Record<string, unknown> = {}) {
  switch (command) {
    case 'military.ministry': return ministry(args)
    case 'military.forces': return forces(args)
    case 'military.branch': return branch(args)
    case 'military.station': return station(args)
    case 'military.procure': return procure(args)
    case 'military.buy': return armsBuy(args)
    case 'military.licences': return licences(args)
    case 'military.licence': return licence(args)
    case 'military.kitbuy': return kit(args)
    case 'military.retrofit': return retrofit(args)
    case 'company.defence': return companyDefence(args)
    case 'military.arrived':
      return mockOk('move_arrived_notice', { country: COUNTRY, good: good('main_battle_tank', 'سیمرغ'), qty: 12, city_code: 'azor', city: 'Azor', branch: N('ground') }, [
        nav('military.branch', 'military.branch', { country: cc, branch: 'ground' }, 'ground'), back('military.forces', { country: cc }),
      ])
    case 'military.licence_notice':
      return mockOk('licence_notice', { kind: String(args.kind ?? 'applied'), company: company('AR1', 'صنایع آراز', 'garage'), country: COUNTRY, effective_at: '2026-10-04T10:00:00Z' }, [
        nav('defence.registry', 'military.licences', { country: cc }), back('player.profile.get'),
      ])
    case 'war.notice': return warNotice(args)
    default:
      return command.startsWith('war.') ? warCommand(command, args) : null
  }
}
