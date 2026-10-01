// The neutral answers of the companies, production and recruitment area for the mock (?mock=1): every screen of the
// area, typed by the generated Go views, with actions by id and named arguments, never a text or a label
// (docs/adr/0039-presentation-split.md). The mock player owns «استودیو دانا» and manages «نان و شیرینی کاوه»; from
// the Economy hub tile «شرکت‌های من» (company.mine) every screen is reached through the actions. Two screens belong
// to the military area's flows (the upgrade kit purchase and the retrofit): `?mock=1&open=military.kitbuy` and
// `?mock=1&open=company.retrofit` open them. A refusal of each part is one wrong step away (see the comments).

import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import type {
  AttributeLine, Candidate, CompanyApplicationLine, CompanyEmployeeLine, CompanyLine, CompanyManageView, CompanyOpeningLine, CompanyPeriodSummary,
  CompanyRef, DesignLine, Good, GoodsLine, JobRef, ListingLine, Named, NextStep, PaymentChoice, ProduceTarget, ProductionLine, RecipeLine,
  RecruitCampaignLine, RecruitCandidateLine, RecruitPresets, SampleLine, Shortage, SlotLine, SpecialistLine, TechLine, Way,
} from './views.gen'

const N = (code: string, name: string): Named => ({ code, name })
const AT = '2026-10-01T14:30:00Z'
const LATER = '2026-10-01T18:00:00Z'

type Entry = { code: string; name: { en: string; fa: string } }
const e = (code: string, en: string, fa: string): Entry => ({ code, name: { en, fa } })

/** The catalogue names of everything these screens mention (the web never shows a view's authored name). */
export const COMPANIES_CONTENT: Record<string, Entry[]> = {
  company_type: [e('studio', 'Design studio', 'استودیو'), e('bakery', 'Bakery', 'نانوایی'), e('foundry', 'Foundry', 'ریخته‌گری'), e('pharma', 'Pharmacy lab', 'دارویی'), e('aerospace', 'Aerospace works', 'هوافضا')],
  component: [e('flour', 'Flour', 'آرد'), e('yeast', 'Yeast', 'مخمر'), e('dough', 'Dough', 'خمیر'), e('salt', 'Salt', 'نمک'), e('iron_bar', 'Iron bar', 'شمش آهن'), e('timber', 'Timber', 'الوار')],
  item: [e('bread', 'Bread', 'نان'), e('cake', 'Cake', 'کیک'), e('sword', 'Sword', 'شمشیر')],
  technology: [e('fermentation', 'Fermentation', 'تخمیر'), e('oven_craft', 'Oven craft', 'کوره‌کاری'), e('pastry', 'Pastry', 'شیرینی‌پزی'), e('steel', 'Steel making', 'فولادسازی')],
  supplier: [e('mill', 'The mill', 'آسیاب'), e('saltworks', 'The saltworks', 'نمکزار')],
  design_slot: [e('base', 'Base', 'پایه'), e('filling', 'Filling', 'مایه'), e('topping', 'Topping', 'روکش')],
  attribute: [e('taste', 'Taste', 'مزه'), e('shelf_life', 'Shelf life', 'ماندگاری'), e('nutrition', 'Nutrition', 'ارزش غذایی')],
  specialist_name: [e('first', 'Ali|Sara|Reza|Mina|Kian', 'علی|سارا|رضا|مینا|کیان'), e('last', 'Rad|Nouri|Azadi', 'راد|نوری|آزادی')],
  career: [e('retail', 'Retail', 'تجارت'), e('craft', 'Craft', 'پیشه‌وری'), e('technology', 'Technology', 'فناوری')],
  career_tier: [e('retail.entry', 'Seller', 'فروشنده'), e('craft.entry', 'Baker', 'نانوا'), e('craft.senior', 'Master baker', 'استادنانوا'), e('technology.entry', 'Technician', 'تکنسین')],
  course: [e('baking101', 'Baking basics', 'مبانی نانوایی'), e('mgmt101', 'Basic management', 'مدیریت پایه')],
  skill: [e('baking', 'Baking', 'نانوایی'), e('chemistry', 'Chemistry', 'شیمی'), e('design', 'Design', 'طراحی')],
  building_role: [e('craft', 'Workshop', 'کارگاه'), e('market', 'Market', 'بازار')],
  city: [e('riverside', 'Riverside', 'ساحل'), e('ostmarch', 'Ostmarch', 'استمارش')],
}

// -- the people, the companies -------------------------------------------------------------------------------------

const ME = { name: 'سارا', code: 'K7Q2M9A' }
const KAVEH = { name: 'کاوه', code: 'B3C4D5F' }
const MINA = { name: 'مینا', code: 'M1' }
const BAKERY = N('bakery', 'نانوایی')
const STUDIO = N('studio', 'استودیو')
const OWN: CompanyRef = { code: 'Q7M2K9B', name: 'استودیو دانا', type: STUDIO }
const WORK: CompanyRef = { code: 'B2N4K1C', name: 'نان و شیرینی کاوه', type: BAKERY }
const OTHER: CompanyRef = { code: 'D3F5G7H', name: 'نانوایی رضا', type: BAKERY }
const REFS: Record<string, CompanyRef> = { [OWN.code]: OWN, [WORK.code]: WORK, [OTHER.code]: OTHER }
const refOf = (code: string): CompanyRef => REFS[code] ?? OWN

const city = N('calderis', 'کالدریس')
const place = N('city_hall', 'شهرداری')
const support = N('support', 'شهر مرکزی')
const pay2: PaymentChoice = { amount: 2000, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 12450, bank: 86300 }

const job = (career: string, rank: string, title: string): JobRef => ({ career_code: career, career_name: career, rank, title })
const SELLER = job('retail', 'entry', 'فروشنده')
const BAKER = job('craft', 'entry', 'نانوا')
const MASTER = job('craft', 'senior', 'استادنانوا')

const bread: Good = { component: false, item: N('bread', 'نان'), design: 'نان سنگک ویژه', design_no: 4 }
const flour: Good = { component: true, item: N('flour', 'آرد'), design: '', design_no: 0 }
const dough: Good = { component: true, item: N('dough', 'خمیر'), design: '', design_no: 0 }
const cake: Good = { component: false, item: N('cake', 'کیک'), design: '', design_no: 0 }
const target = (g: Good): string => (g.design_no ? `d:${g.design_no}` : g.component ? `c:${g.item.code}` : `i:${g.item.code}`)

// -- the state the mock keeps so a tap shows its answer -------------------------------------------------------------

const co = {
  balance: 9800, priceBps: 10000, auto: false, applications: [{ no: 3, who: MINA, job: SELLER, level: 4 }] as { no: number; who: { name: string; code: string }; job: JobRef; level: number }[],
  notice: null as null | { kind: string; amount: number; tax: number; net: number; price_bps: number; player: { name: string; code: string } },
  positions: 2, designName: '', designFilled: false, slotQty: 300, mode: 'private', researched: false,
  listed: 0, ordered: false, campaigns: 1, draftCities: ['calderis'], draftSalary: 900, hired: false,
}

const line = (ref: CompanyRef, mine: boolean, stars = 4, staff = 3, openings = 1): CompanyLine => ({ ref, stars, rated: true, staff, openings, mine })

const act = (id: string, command: string, args?: Record<string, string>, subject?: string, kind?: string): MockAct => A(id, command, args, { subject, kind: kind ?? 'navigation' })
const primary = (id: string, command: string, args?: Record<string, string>, subject?: string): MockAct => A(id, command, args, { subject, kind: 'primary' })
const danger = (id: string, command: string, args?: Record<string, string>): MockAct => A(id, command, args, { kind: 'danger' })
const confirmA = (id: string, command: string, args: Record<string, string>): MockAct => A(id, command, { ...args, confirm: 'yes' }, { kind: 'confirm' })
const ask = (a: MockAct, field: string, text = false): MockAct => ({ ...a, input: { field, ...(text ? { text: true } : {}) } })

const mineLines = (): CompanyLine[] => [line(OWN, true, 4, 3, 1), line(WORK, false, 3, 5, 2)]

function refusal(screen: 'company_refusal' | 'production_refusal' | 'recruit_refusal', area: string, kind: string, view: Record<string, unknown>, backA: MockAct) {
  return { ok: false, request_id: 'mock', screen, view, error: { code: `${area}_${kind}` }, actions: [backA] }
}

const company = (code: string) => String(code || OWN.code)

// -- the companies ----------------------------------------------------------------------------------------------------

function registry() {
  return mockOk('company_registry', {
    no_city: false, city_code: 'calderis', city: city.name,
    companies: [line(OWN, true), line(WORK, false, 3, 5, 2), line(OTHER, false, 5, 2, 0)], mine: 2,
  }, [
    ...[OWN, WORK, OTHER].map((c) => act('company.open', 'company.view', { code: c.code }, c.code)),
    act('company.register', 'company.register'), act('company.mine', 'company.mine'), back('player.profile.get'), refreshA('company.list'),
  ])
}

function page(code: string) {
  const ref = refOf(code)
  const own = ref.code === OWN.code
  const openings: CompanyOpeningLine[] = own ? [] : [{ no: 11, job: BAKER, wage: 300, positions: 3, filled: 1 }, { no: 12, job: SELLER, wage: 260, positions: 2, filled: 1 }]
  return mockOk('company_page', {
    ref, city_code: 'calderis', city: city.name, place: N('workshop', 'کارگاه'), owner: own ? ME : KAVEH, manager: own ? null : ME, staff: own ? 3 : 5, max_staff: 8, stars: own ? 4 : 3, rated: true,
    dissolved: false, openings, can_manage: own || ref.code === WORK.code, products: own ? [bread] : [bread, cake], published: own ? [N('fermentation', 'تخمیر')] : null,
  }, [
    ...((own || ref.code === WORK.code) ? [act('company.manage', 'company.manage', { company: ref.code })] : []),
    ...openings.map((o) => act('company.opening', 'company.opening', { no: String(o.no) }, o.job.career_code)),
    back('company.list'), refreshA('company.view', { code: ref.code }),
  ])
}

function types(args: Record<string, unknown>) {
  const village = args.here === 'village'
  return mockOk('company_types', {
    no_city: false, city_code: 'calderis', city: city.name, owned: 2, max: 3,
    types: [
      { type: N('bakery', 'نانوایی'), fee: 2000, upkeep: 200, licensed: false, unavailable: null },
      { type: N('studio', 'استودیو'), fee: 3000, upkeep: 300, licensed: false, unavailable: null },
      { type: N('foundry', 'ریخته‌گری'), fee: 9000, upkeep: 700, licensed: false, unavailable: { service: 'foundry', stage: 'city', here: 'town', requires: [{ code: '', role: 'craft', tier: 3 }], nearest: support } },
      { type: N('pharma', 'دارویی'), fee: 12000, upkeep: 900, licensed: false, unavailable: { service: 'pharma', stage: 'support', here: village ? 'village' : 'town', requires: null, nearest: support } },
      { type: N('aerospace', 'هوافضا'), fee: 90000, upkeep: 2000, licensed: true, unavailable: { service: 'aerospace', stage: 'country', here: 'town', requires: [{ code: 'airfield', role: '', tier: 0 }], nearest: null } },
    ],
  }, [act('company.type', 'company.type', { type: 'bakery' }, 'bakery'), act('company.type', 'company.type', { type: 'studio' }, 'studio'), act('support.travel', 'travel.options', { city: 'support' }, 'support'), back('company.list')])
}

function typeDetail(code: string) {
  const common = {
    city_code: 'calderis', city: city.name, place, careers: [BAKER, SELLER], fee: 2000, upkeep: 200, max_staff: 8, period_seconds: 21600, name_min: 3, name_max: 24, max: 3, rank: job('', '', ''),
  }
  if (code === 'foundry') {
    return mockOk('company_type_detail', { ...common, type: N('foundry', 'ریخته‌گری'), payment: null, way: null, blocked: 'stage',
      unavailable: { service: 'foundry', stage: 'city', here: 'town', requires: [{ code: '', role: 'craft', tier: 3 }], nearest: support } },
    [act('support.travel', 'travel.options', { city: 'support' }, 'support'), back('company.register')])
  }
  if (code === 'aerospace') {
    return mockOk('company_type_detail', { ...common, type: N('aerospace', 'هوافضا'), payment: null, way: null, blocked: 'defence', unavailable: null, rank: job('military', 'officer', 'افسر') },
    [act('job.openings', 'job.list'), back('company.register')])
  }
  const way: Way | null = code === 'studio' ? { place, walk_seconds: 240 } : null
  const payment = way ? null : pay2
  return mockOk('company_type_detail', { ...common, type: N(code, code), payment, way, blocked: '', unavailable: null },
    way ? [A('place.walk', 'place.go', { place: 'city_hall', then: 'company.type', args: code }, { subject: 'city_hall', kind: 'navigation' }), back('company.register')]
      : [ask(primary('company.found_cash', 'company.found', { type: code, method: 'cash' }, code), 'name', true), ask(primary('company.found_card', 'company.found', { type: code, method: 'card' }, code), 'name', true), back('company.register')])
}

function founded(args: Record<string, unknown>) {
  const name = String(args.name ?? 'نانوایی تازه')
  const ref: CompanyRef = { code: 'N9P8Q7R', name, type: N(String(args.type ?? 'bakery'), 'نانوایی') }
  REFS[ref.code] = ref
  return mockOk('company_founded', { ref, city_code: 'calderis', city: city.name, fee: 2000, method: String(args.method ?? 'cash') },
    [act('company.manage', 'company.manage', { company: ref.code }), act('company.page', 'company.view', { code: ref.code }), back('company.list')])
}

const period: CompanyPeriodSummary = {
  revenue: 5400, sales_tax: 270, wages: 1800, upkeep: 600, upkeep_paid: 600, debt: 0, shifts: 6, quality_bps: 7200, sold: 54, wanted: 60, capacity: 80, balance: 9800,
  citizen_workers: 1, citizen_shifts: 2, citizen_wages: 240,
}

function manage(code: string) {
  const ref = refOf(code)
  const owner = ref.code !== WORK.code
  const step: NextStep = { kind: 'sell', good: bread, qty: 0, batch: 0, total: 0, component: N('', ''), item: N('', ''), tech: N('', ''), design_no: 0, design_name: '', finish_at: null, left_seconds: 0, can_research: owner }
  const v: CompanyManageView = {
    ref, clinic: false, city_code: 'calderis', city: city.name, owner, manager: owner ? null : ME, balance: co.balance, reserved: 300, available: co.balance - 300, debt: 0, upkeep: 600, arrears: 0, grace: 3,
    price_bps: co.priceBps, price_min: 8000, price_max: 13000, price_step: 500, staff: 3, max_staff: 8, openings: 2, pending: co.applications.length, auto_accept: co.auto,
    citizens: { vacant: 2, workers: 1, wages: 240 }, tax_bps: 1000, last: period, next_at: LATER, next_in_seconds: 12600, notice: co.notice, step, defence: owner ? { status: '', contractor: false, eligible: true, effective_at: null } : null,
    specialists: 1, recruiting: co.campaigns,
  }
  co.notice = null
  return mockOk('company_manage', v, [
    primary('production.step_sell', 'company.sell', { company: ref.code, target: target(bread) }, 'bread'),
    ask(A('company.deposit_cash', 'company.deposit', { company: ref.code, method: 'cash' }, { kind: 'primary' }), 'amount'),
    ask(A('company.deposit_card', 'company.deposit', { company: ref.code, method: 'card' }, { kind: 'primary' }), 'amount'),
    ...(owner ? [ask(primary('company.withdraw', 'company.withdraw', { company: ref.code }), 'amount')] : []),
    act('company.cheaper', 'company.price', { company: ref.code, price: String(co.priceBps - 500) }), act('company.dearer', 'company.price', { company: ref.code, price: String(co.priceBps + 500) }),
    act('company.staff', 'company.staff', { company: ref.code }), act('company.openings', 'company.openings', { company: ref.code }),
    act('recruit.hub', 'company.recruit', { company: ref.code }), act('recruit.specialists', 'company.npcs', { company: ref.code }),
    act('production.warehouse', 'company.warehouse', { company: ref.code }),
    ...(owner ? [act('company.defence', 'company.defence', { company: ref.code })] : []),
    A(co.auto ? 'company.auto_off' : 'company.auto_on', 'company.auto', { company: ref.code, on: co.auto ? 'off' : 'on' }, { kind: 'primary' }),
    ...(owner ? [ask(act('company.manager', 'company.manager', { company: ref.code }), 'to', true), danger('company.close', 'company.close', { company: ref.code })] : []),
    back('company.view', { code: ref.code }), refreshA('company.manage', { company: ref.code }),
  ])
}

function openings(code: string) {
  const ref = refOf(code)
  const list: CompanyOpeningLine[] = [{ no: 11, job: BAKER, wage: 300, positions: co.positions, filled: 1 }, { no: 12, job: SELLER, wage: 260, positions: 1, filled: 1 }]
  return mockOk('company_openings', { ref, openings: list, careers: [MASTER, job('technology', 'entry', 'تکنسین')], minimum_wage: 120, room: 3, at_max: false }, [
    ...list.flatMap((o) => [
      act('company.slot_up', 'company.slots', { no: String(o.no), positions: String(o.positions + 1) }, o.job.career_code),
      act(o.positions <= 1 ? 'company.slot_close' : 'company.slot_down', 'company.slots', { no: String(o.no), positions: String(Math.max(0, o.positions - 1)) }, o.job.career_code),
    ]),
    ask(primary('company.post', 'company.post', { company: ref.code, career: 'craft' }, 'craft'), 'wage'),
    ask(primary('company.post', 'company.post', { company: ref.code, career: 'technology' }, 'technology'), 'wage'),
    back('company.manage', { company: ref.code }), refreshA('company.openings', { company: ref.code }),
  ])
}

function staff(code: string, args: Record<string, unknown>) {
  const ref = refOf(code)
  const employees: CompanyEmployeeLine[] = [
    { player: KAVEH, job: BAKER, wage: 300, shifts: 14, working: true }, { player: { name: 'رضا', code: 'R2' }, job: SELLER, wage: 260, shifts: 9, working: false },
  ]
  const apps: CompanyApplicationLine[] = co.applications.map((a) => ({ no: a.no, player: a.who, job: a.job, level: a.level }))
  const firing = args.player ? employees.find((x) => x.player.code === String(args.player)) ?? null : null
  const decided = args.decided ? apps[0] ?? { no: 3, player: MINA, job: SELLER, level: 4 } : null
  return mockOk('company_staff', { ref, employees, citizens: { vacant: 2, workers: 1, wages: 240 }, applications: firing ? null : apps, firing, decided, hired: args.verdict === 'yes' }, firing
    ? [confirmA('company.fire_confirm', 'company.fire', { company: ref.code, player: firing.player.code }), back('company.staff', { company: ref.code })]
    : [
      ...apps.flatMap((a) => [act('company.accept', 'company.decide', { no: String(a.no), verdict: 'yes' }, a.player.code, 'confirm'), act('company.reject', 'company.decide', { no: String(a.no), verdict: 'no' }, a.player.code)]),
      ...employees.filter((x) => !x.working).map((x) => danger('company.fire', 'company.fire', { company: ref.code, player: x.player.code })),
      back('company.manage', { company: ref.code }), refreshA('company.staff', { company: ref.code }),
    ])
}

function opening(no: number) {
  const j = no === 12 ? SELLER : BAKER
  return mockOk('company_opening', {
    no, company: WORK, job: j, city_code: 'calderis', city: city.name, place: N('workshop', 'کارگاه'), wage: j === SELLER ? 260 : 300, energy_cost: 10, shift_length_seconds: 1800, free: 2,
    requirements: [
      { kind: 'level', met: true, skill: '', need: 3, have: 7, course_code: '', course_name: '', city_code: '', city: '', wait_seconds: 0 },
      { kind: 'skill', met: false, skill: 'baking', need: 2, have: 1, course_code: '', course_name: '', city_code: '', city: '', wait_seconds: 0 },
    ], can_apply: true, applied: false, employed: false, auto_accept: false, closed: false,
  }, [primary('company.apply', 'company.apply', { no: String(no) }), act('company.page', 'company.view', { code: WORK.code }), back('job.list'), refreshA('company.opening', { no: String(no) })])
}

const close = (code: string, done: boolean) => mockOk('company_close', { ref: refOf(code), done, debt_paid: 0, tax: done ? 500 : 480, net: done ? 4500 : 4320, staff: 3 },
  done ? [act('company.registry', 'company.list'), back('player.profile.get')] : [confirmA('company.close_confirm', 'company.close', { company: code }), back('company.manage', { company: code })])

// -- production ----------------------------------------------------------------------------------------------------------

const next: NextStep = { kind: 'sell', good: bread, qty: 0, batch: 0, total: 0, component: N('', ''), item: N('', ''), tech: N('', ''), design_no: 0, design_name: '', finish_at: null, left_seconds: 0, can_research: true }

function warehouse(code: string) {
  const ref = refOf(code)
  const lines = [
    { good: bread, qty: 12, quality: 71, listed: co.listed, sellable: true },
    { good: flour, qty: 40, quality: 0, listed: 0, sellable: false },
    { good: dough, qty: 6, quality: 0, listed: 0, sellable: true },
  ]
  return mockOk('warehouse', { ref, lines, running: co.ordered ? 1 : 0, researching: co.researched, listings: co.listed ? 1 : 0, can_research: true, next }, [
    primary('production.step_sell', 'company.sell', { company: ref.code, target: target(bread) }, 'bread'),
    act('production.sell', 'company.sell', { company: ref.code, target: target(bread) }, 'bread'), act('production.sell', 'company.sell', { company: ref.code, target: target(dough) }, 'dough'),
    act('production.suppliers', 'company.suppliers', { company: ref.code }), act('production.orders', 'company.orders', { company: ref.code }),
    act('production.studio', 'company.studio', { company: ref.code }), act('production.lab', 'company.lab', { company: ref.code }),
    act('production.reverse_lab', 'company.relab', { company: ref.code }), act('production.listings', 'company.listings', { company: ref.code }),
    back('company.manage', { company: ref.code }), refreshA('company.warehouse', { company: ref.code }),
  ])
}

function suppliers(code: string, bought: boolean) {
  const ref = refOf(code)
  const offers = [
    { supplier: N('mill', 'آسیاب'), component: N('flour', 'آرد'), price: 18, stock: 200 },
    { supplier: N('saltworks', 'نمکزار'), component: N('salt', 'نمک'), price: 6, stock: 80 },
  ]
  return mockOk('suppliers', { ref, city_code: 'calderis', city: city.name, offers, available: co.balance - 300, bought: bought ? { component: N('flour', 'آرد'), qty: 25, total: 450 } : null }, [
    ...offers.flatMap((o) => [...[10, 25, 50].map((q) => act('production.supply', 'company.supply', { company: ref.code, component: o.component.code, qty: String(q) }, o.component.code)),
      ask(act('production.supply_other', 'company.supply', { company: ref.code, component: o.component.code }, o.component.code), 'qty')]),
    back('company.warehouse', { company: ref.code }), refreshA('company.suppliers', { company: ref.code }),
  ])
}

const tgtBread: ProduceTarget = { good: bread, batch: 0 }
const tgtDough: ProduceTarget = { good: dough, batch: 4 }

function orders(code: string) {
  const ref = refOf(code)
  const running: ProductionLine = { no: 8, good: bread, output: 12, done: false, quality: 0, finish_at: LATER, left_seconds: 3600 }
  const done: ProductionLine = { no: 7, good: dough, output: 8, done: true, quality: 70, finish_at: AT, left_seconds: 0 }
  return mockOk('orders', {
    ref, targets: [tgtBread, tgtDough], locked: [{ good: cake, steps: [{ tech: N('pastry', 'شیرینی‌پزی'), research: true }, { tech: N('oven_craft', 'کوره‌کاری'), research: false }] }],
    orders: co.ordered ? [running, done] : [done], max: 3, running: co.ordered ? 1 : 0, crew: 4,
  }, [act('production.produce', 'company.produce', { company: ref.code, target: target(bread) }, 'bread'), act('production.produce', 'company.produce', { company: ref.code, target: target(dough) }, 'dough'),
    back('company.warehouse', { company: ref.code }), refreshA('company.orders', { company: ref.code })])
}

function produce(code: string, args: Record<string, unknown>, kit = false) {
  const ref = refOf(code)
  const isDough = String(args.target ?? '').includes('dough')
  const tg = isDough ? tgtDough : tgtBread
  const qty = Number(args.qty ?? 0)
  const placed = qty > 0 && args.confirm === 'yes'
  const per = isDough ? 2 : 3
  const have = isDough ? 40 : 20
  const recipe: RecipeLine[] = [{ component: N('flour', 'آرد'), per, need: per * qty, have }, { component: N('yeast', 'مخمر'), per: 1, need: qty, have: isDough ? 10 : 0 }]
  const short: Shortage[] = qty > 0 ? recipe.filter((r) => r.have < r.need).map((r) => ({ component: r.component, need: r.need, have: r.have, source: r.component.code === 'yeast' ? 'supplier' : 'companies' })) : []
  const addr = kit ? 'company.kit' : 'company.produce'
  if (placed) co.ordered = true
  return mockOk('produce', {
    ref, kit, target: tg, qty, output: qty * (tg.batch || 1), recipe, duration_seconds: qty * 600, finish_at: LATER, crew: 4, max_qty: 20, short: short.length ? short : null, stock_up: short.length ? 160 : 0, bought: 0,
    placed: placed ? { no: 8, good: tg.good, output: qty * (tg.batch || 1), done: false, quality: 0, finish_at: LATER, left_seconds: qty * 600 } : null,
  }, placed ? [act('production.orders', 'company.orders', { company: ref.code }), back('company.warehouse', { company: ref.code })] : [
    ...(qty > 0 && !short.length ? [confirmA('production.start_order', addr, { company: ref.code, target: String(args.target ?? target(bread)), qty: String(qty) })] : []),
    ...(short.length ? [act('production.stock_up', 'company.stockup', { company: ref.code, target: String(args.target ?? target(bread)), qty: String(qty) })] : []),
    ...[1, 5, 10].map((q) => act('production.size', addr, { company: ref.code, target: String(args.target ?? target(bread)), qty: String(q) })),
    act('production.size_max', addr, { company: ref.code, target: String(args.target ?? target(bread)), qty: '20' }),
    back('company.orders', { company: ref.code }),
  ])
}

function sell(code: string, args: Record<string, unknown>) {
  const ref = refOf(code)
  const t = String(args.target ?? target(bread))
  const good = t.includes('dough') || t.includes('flour') ? dough : bread
  const qty = Number(args.qty ?? 0)
  if (qty > 0 && args.price) {
    co.listed = qty
    return mockOk('listings', { ref, city_code: 'calderis', city: city.name, listings: [{ no: 31, good, left: qty, price: Number(args.price) }], notice: { kind: 'listed', listing: { no: 31, good, left: qty, price: Number(args.price) } } },
      [danger('production.unlist', 'company.unlist', { no: '31' }), back('company.warehouse', { company: ref.code }), refreshA('company.listings', { company: ref.code })])
  }
  return mockOk('sell', { ref, good, have: 12, qty, reference: 40 }, qty > 0
    ? [ask(primary('production.price', 'company.sell', { company: ref.code, target: t, qty: String(qty) }), 'price'), act('production.price_reference', 'company.sell', { company: ref.code, target: t, qty: String(qty), price: '40' }), back('company.warehouse', { company: ref.code })]
    : [...[3, 6].map((q) => act('production.size', 'company.sell', { company: ref.code, target: t, qty: String(q) })), act('production.sell_all', 'company.sell', { company: ref.code, target: t, qty: '12' }), back('company.warehouse', { company: ref.code })])
}

function listings(code: string, withdrawn = false) {
  const ref = refOf(code)
  const l: ListingLine[] = co.listed ? [{ no: 31, good: bread, left: co.listed, price: 40 }] : []
  return mockOk('listings', { ref, city_code: 'calderis', city: city.name, listings: l, notice: withdrawn ? { kind: 'withdrawn', listing: { no: 31, good: bread, left: 6, price: 40 } } : null },
    [...l.map((x) => danger('production.unlist', 'company.unlist', { no: String(x.no) })), back('company.warehouse', { company: ref.code }), refreshA('company.listings', { company: ref.code })])
}

const attrs: AttributeLine[] = [{ name: 'taste', value: 74, observable: true }, { name: 'shelf_life', value: 52, observable: true }, { name: 'nutrition', value: 61, observable: false }]
const goodsLines = (): GoodsLine[] => [
  { no: 41, company: WORK, good: bread, left: 30, price: 38, attributes: attrs, quality: 71 },
  { no: 42, company: OTHER, good: dough, left: 12, price: 22, attributes: null, quality: 0 },
]

function goods() {
  return mockOk('company_goods', { no_city: false, city_code: 'calderis', city: city.name, lines: goodsLines() },
    [...goodsLines().map((l) => act('production.buy', 'company.buy', { no: String(l.no) }, l.good.item.code)), back('market.list'), refreshA('company.goods')])
}

function buy(no: number, args: Record<string, unknown>) {
  const line = goodsLines().find((l) => l.no === no) ?? goodsLines()[0]
  const qty = Number(args.qty ?? 1) || 1
  if (args.method) {
    const forCompany = args.method !== 'cash' && args.method !== 'card'
    return mockOk('company_buy', { line, qty, payment: null, companies: null, bought: { qty, total: line.price * qty, for: forCompany ? OWN.name : '', for_code: forCompany ? OWN.code : '' } },
      [forCompany ? act('production.company_warehouse', 'company.warehouse', { company: OWN.code }, OWN.code) : act('item.bag', 'inventory.show'), back('company.goods')])
  }
  return mockOk('company_buy', { line, qty, payment: pay2, companies: [OWN], bought: null }, [
    A('payment.cash', 'company.buy', { no: String(no), qty: String(qty), method: 'cash' }, { kind: 'primary' }), A('payment.card', 'company.buy', { no: String(no), qty: String(qty), method: 'card' }, { kind: 'primary' }),
    act('production.pay_company', 'company.buy', { no: String(no), qty: String(qty), method: OWN.code }, OWN.code), ask(act('production.buy_qty', 'company.buy', { no: String(no) }), 'qty'),
    back('company.goods'), refreshA('company.buy', { no: String(no) }),
  ])
}

// -- the studio ------------------------------------------------------------------------------------------------------------

const slots = (filled: boolean, choosing = ''): { slots: SlotLine[]; candidates: Candidate[] | null } => ({
  slots: [
    { slot: 'base', optional: false, min: 200, max: 500, unit: 'g', component: filled ? N('flour', 'آرد') : N('', ''), qty: filled ? co.slotQty : 0 },
    { slot: 'filling', optional: true, min: 1, max: 1, unit: '', component: N('', ''), qty: 0 },
    { slot: 'topping', optional: false, min: 5, max: 20, unit: 'g', component: filled ? N('salt', 'نمک') : N('', ''), qty: filled ? 10 : 0 },
  ],
  candidates: choosing ? [{ component: N('flour', 'آرد'), price: 18, locked: false, quality: 70 }, { component: N('dough', 'خمیر'), price: 22, locked: false, quality: 66 }, { component: N('iron_bar', 'شمش آهن'), price: 90, locked: true, quality: 80 }] : null,
})

function studio(code: string) {
  const ref = refOf(code)
  const designs: DesignLine[] = [{ no: 4, name: 'نان سنگک ویژه', item: N('bread', 'نان'), status: 'final', origin: 'authored' }, { no: 5, name: co.designName, item: N('bread', 'نان'), status: 'draft', origin: 'authored' }]
  return mockOk('studio', {
    ref, designs, kinds: [N('bread', 'نان')], next: [{ item: N('cake', 'کیک'), steps: [{ tech: N('pastry', 'شیرینی‌پزی'), research: true }] }], hidden: true, can_research: true, need: 2, can_design: true, max: 6,
  }, [...designs.map((d) => act('production.design', 'company.design', { no: String(d.no) })), act('production.new_design', 'company.dnew', { company: ref.code, item: 'bread' }, 'bread'),
    act('production.lab', 'company.lab', { company: ref.code }), back('company.warehouse', { company: ref.code }), refreshA('company.studio', { company: ref.code })])
}

function design(no: number, args: Record<string, unknown>) {
  const draft = no !== 4
  const choosing = String(args.slot ?? '')
  const s = slots(co.designFilled || !draft, choosing)
  const base = {
    ref: OWN, no, name: draft ? co.designName : 'نان سنگک ویژه', item: N('bread', 'نان'), status: draft ? 'draft' : 'final', origin: 'authored', source: '', ...s, choosing: draft ? choosing : '',
    attributes: co.designFilled || !draft ? attrs : null, cost_floor: co.designFilled || !draft ? 41 : 0, quality_loss_bps: 0, overhead_bps: 0, complete: co.designFilled, locked: null, version: draft ? 1 : 2,
    prev_attributes: draft ? null : { taste: 70, shelf_life: 52 },
  }
  if (!draft) {
    return mockOk('design', base, [
      act('production.produce_design', 'company.produce', { company: OWN.code, target: 'd:4' }), act('production.kit', 'company.kit', { company: OWN.code, target: 'd:4' }), act('production.revise', 'company.drevise', { no: '4' }),
      ...attrs.map((a) => act('production.improve', 'company.improve', { no: '4', slot: a.name }, a.name)), confirmA('production.retire', 'company.dretire', { no: '4' }),
      back('company.studio', { company: OWN.code }), refreshA('company.design', { no: '4' }),
    ])
  }
  if (choosing) {
    return mockOk('design', base, [
      ...(s.candidates ?? []).filter((c) => !c.locked).map((c) => act('production.candidate', 'company.dfill', { no: String(no), slot: choosing, component: c.component.code }, c.component.code, 'primary')),
      act('production.slot_clear', 'company.dfill', { no: String(no), slot: choosing, component: 'none' }), ask(act('production.slot_qty', 'company.dqty', { no: String(no), slot: choosing }), 'qty'),
      back('company.design', { no: String(no) }), refreshA('company.design', { no: String(no), slot: choosing }),
    ])
  }
  return mockOk('design', base, [
    ...s.slots.map((x) => act('production.slot', 'company.design', { no: String(no), slot: x.slot }, x.slot, 'primary')), ask(primary('production.name', 'company.dname', { no: String(no) }), 'name', true),
    ...(co.designFilled && co.designName ? [primary('production.finalize', 'company.dfinal', { no: String(no) })] : []),
    back('company.studio', { company: OWN.code }), refreshA('company.design', { no: String(no) }),
  ])
}

function improvement(no: number, slot: string, started: boolean) {
  return mockOk('improvement', { ref: OWN, no, design: bread, attribute: N(slot, slot), gain_bps: 400, cost: 1200, duration_seconds: 10800, finish_at: LATER, started },
    started ? [back('company.design', { no: String(no) })] : [confirmA('production.improve_confirm', 'company.improve', { no: String(no), slot }), back('company.design', { no: String(no) })])
}

// -- the lab ------------------------------------------------------------------------------------------------------------------

const techs = (): TechLine[] => [
  { tech: N('fermentation', 'تخمیر'), state: 'owned', mode: co.mode, price: 500, cost: 1500, missing: null, offers: 0 },
  { tech: N('oven_craft', 'کوره‌کاری'), state: co.researched ? 'running' : 'available', mode: '', price: 0, cost: 2200, missing: null, offers: 1 },
  { tech: N('pastry', 'شیرینی‌پزی'), state: 'locked', mode: '', price: 0, cost: 3000, missing: [N('oven_craft', 'کوره‌کاری')], offers: 0 },
]

function lab(code: string) {
  const ref = refOf(code)
  return mockOk('lab', { ref, available: co.balance - 300, running: co.researched ? { tech: N('oven_craft', 'کوره‌کاری'), finish_at: LATER, left_seconds: 7200 } : null, techs: techs(), hidden: 2 },
    [...techs().map((x) => act('production.tech', 'company.lab', { company: ref.code, tech: x.tech.code }, x.tech.code)), back('company.warehouse', { company: ref.code }), refreshA('company.lab', { company: ref.code })])
}

function tech(code: string, tc: string, args: Record<string, unknown>) {
  const ref = refOf(code)
  const line = techs().find((x) => x.tech.code === tc) ?? techs()[0]
  const base = {
    ref, tech: line.tech, state: line.state, cost: line.cost, time_seconds: 7200, requires: line.missing ? line.missing.map((m) => ({ tech: m, met: false })) : null, skill: 'baking', level: 2, best: 2,
    unlocks: [N('dough', 'خمیر')], mode: line.mode, price: line.price, sold: 2, blocked: line.state === 'locked' ? 'prerequisite' : '', available: co.balance - 300, running: null,
    offers: line.state === 'available' ? [{ company: WORK, price: 800 }] : null, confirm_publish: false, confirm_license: null, notice: null, gap: null,
  }
  if (args.mode === 'published' && args.confirm !== 'yes') {
    return mockOk('tech', { ...base, confirm_publish: true }, [confirmA('production.publish_confirm', 'company.techmode', { company: ref.code, tech: tc, mode: 'published', price: '0' }), back('company.lab', { company: ref.code, tech: tc })])
  }
  if (args.mode === 'published') co.mode = 'published'
  if (args.mode === 'private') co.mode = 'private'
  if (args.mode === 'license') { co.mode = 'license' }
  if (args.company2) { /* a license from another company */ }
  const owned = line.state === 'owned'
  return mockOk('tech', { ...base, mode: co.mode, notice: args.mode ? { kind: String(args.mode) === 'license' ? 'license' : String(args.mode), price: 500, company: OWN } : null }, [
    ...(line.state === 'available' ? [primary('production.research', 'company.research', { company: ref.code, tech: tc })] : []),
    ...(owned && co.mode !== 'published' ? [act('production.mode_private', 'company.techmode', { company: ref.code, tech: tc, mode: 'private' }),
      ask(act('production.mode_license', 'company.techmode', { company: ref.code, tech: tc, mode: 'license' }), 'price'), act('production.mode_publish', 'company.techmode', { company: ref.code, tech: tc, mode: 'published' })] : []),
    ...(line.state === 'available' ? [act('production.license', 'company.license', { company: ref.code, tech: tc, from: WORK.code }, WORK.code)] : []),
    back('company.lab', { company: ref.code }), refreshA('company.lab', { company: ref.code, tech: tc }),
  ])
}

function reverseLab(code: string, args: Record<string, unknown>) {
  const ref = refOf(code)
  const samples: SampleLine[] = [{ serial: 'S-1', good: { component: false, item: N('cake', 'کیک'), design: 'کیک شهری', design_no: 0 }, maker: 'نانوایی رضا', quality: 64, chance_bps: 5500 }]
  const confirm = args.serial && args.confirm !== 'yes' ? samples[0] : null
  const started = args.confirm === 'yes' ? { good: samples[0].good, finish_at: LATER, left_seconds: 14400 } : null
  return mockOk('reverse_lab', {
    ref, samples: started ? null : samples, jobs: [{ no: 2, good: bread, status: 'succeeded', finish_at: AT, left_seconds: 0, result: 'نان ساده', result_no: 6 }, { no: 3, good: dough, status: 'failed', finish_at: AT, left_seconds: 0, result: '', result_no: 0 }],
    confirm, skill: 'design', level: 3, time_seconds: 14400, started,
  }, confirm ? [confirmA('production.reverse_confirm', 'company.reverse', { company: ref.code, serial: 'S-1' }), back('company.relab', { company: ref.code })]
    : [...(started ? [] : samples.map((s) => act('production.reverse', 'company.reverse', { company: ref.code, serial: s.serial }, s.good.item.code))), act('production.design', 'company.design', { no: '6' }),
      back('company.warehouse', { company: ref.code }), refreshA('company.relab', { company: ref.code })])
}

// -- recruitment -----------------------------------------------------------------------------------------------------------------

const campaignLine = (no: number, status: string): RecruitCampaignLine => ({ no, status, skill: 'baking', level: 2, cities: 2, positions: 2, hired: status === 'filled' ? 2 : co.hired ? 1 : 0, pending: status === 'running' ? 2 : 0, next_at: LATER })

function hub(code: string) {
  const ref = refOf(code)
  const lines = [campaignLine(5, 'running'), campaignLine(4, 'ended')]
  return mockOk('recruit_hub', { ref, staff: 1, max_staff: 4, running: 1, max_campaign: 2, campaigns: lines }, [
    ...lines.map((l) => act('recruit.campaign', 'company.rcamp', { no: String(l.no) }, 'baking')),
    act('recruit.new', 'company.rnew', { company: ref.code }), act('recruit.specialists', 'company.npcs', { company: ref.code }),
    back('company.manage', { company: ref.code }), refreshA('company.recruit', { company: ref.code }),
  ])
}

const candidates = (): RecruitCandidateLine[] => [
  { no: 21, name_seed: 7, skill: 'baking', level: 3, home: N('calderis', 'کالدریس'), abroad: false, expected: 900, cost: 600, status: 'pending', expires_at: LATER },
  { no: 22, name_seed: 12, skill: 'baking', level: 2, home: N('ostmarch', 'استمارش'), abroad: true, expected: 800, cost: 1500, status: co.hired ? 'hired' : 'pending', expires_at: LATER },
  { no: 23, name_seed: 4, skill: 'baking', level: 2, home: N('riverside', 'ساحل'), abroad: false, expected: 700, cost: 400, status: 'expired', expires_at: AT },
]

function campaign(no: number, notice = '') {
  const line = campaignLine(no, no === 4 ? 'ended' : 'running')
  return mockOk('recruit_campaign', {
    ref: OWN, line, checks_left: 4, offer: { salary: 900, housing: 200, signing: 300, relocation: 1000, term: 6, shares: 10 }, cities: [N('calderis', 'کالدریس'), N('ostmarch', 'استمارش')], ad_fee: 400, auto: false,
    candidates: candidates(), available: co.balance - 300, confirm_cancel: false, notice, notice_seed: notice ? 7 : 0,
  }, [
    ...candidates().filter((c) => c.status === 'pending').flatMap((c) => [act('recruit.hire', 'company.rdecide', { no: String(c.no), verdict: 'yes' }, 'baking', 'confirm'), act('recruit.reject', 'company.rdecide', { no: String(c.no), verdict: 'no' }, 'baking')]),
    ...(line.status === 'running' ? [danger('recruit.cancel', 'company.rcancel', { no: String(no) })] : []),
    back('company.recruit', { company: OWN.code }), refreshA('company.rcamp', { no: String(no) }),
  ])
}

function campaignCancel(no: number) {
  return mockOk('recruit_campaign', { ref: OWN, line: campaignLine(no, 'running'), checks_left: 4, offer: { salary: 900, housing: 200, signing: 300, relocation: 1000, term: 6, shares: 10 }, cities: [N('calderis', 'کالدریس')], ad_fee: 400, auto: false,
    candidates: null, available: co.balance - 300, confirm_cancel: true, notice: '', notice_seed: 0 },
  [confirmA('recruit.cancel_confirm', 'company.rcancel', { no: String(no) }), back('company.rcamp', { no: String(no) })])
}

const presets: RecruitPresets = { salary: [600, 900, 1200], housing: [0, 200, 400], signing: [0, 300, 600], relocation: [0, 1000, 2000], terms: [3, 6, 12], shares: [0, 10, 25] }

function draft(no: number, section: string, notice = '', confirm = false) {
  const chosen = co.draftCities
  const all = [{ code: 'calderis', name: 'کالدریس', abroad: false }, { code: 'riverside', name: 'ساحل', abroad: false }, { code: 'ostmarch', name: 'استمارش', abroad: true }]
  const v = {
    ref: OWN, no, section, skill: 'baking', level: 2, max_level: 5, skills: ['baking', 'chemistry', 'design'], cities: all.map((c) => ({ ...c, on: chosen.includes(c.code) })),
    city_code: 'calderis', city: 'کالدریس', positions: 2, max_positions: 4, salary: co.draftSalary, housing: 200, signing: 300, relocation: 1000, term: 6, shares: 10, share_value: 120, auto: false,
    market: 850, reach: 14, chance_bps: 4200, ad_fee: 400, available: co.balance - 300, presets, checks: 6, every_seconds: 14400, confirm, notice,
  }
  const set = (id: string, ...kv: string[]): MockAct => {
    const [field, value, extra] = kv
    return act(id, 'company.rset', { no: String(no), field, value, ...(extra !== undefined ? { extra } : {}) })
  }
  let actions: MockAct[] = []
  if (confirm) actions = [confirmA('recruit.post_confirm', 'company.rpost', { no: String(no) })]
  else if (section === 'skill') actions = [...v.skills.map((s) => act('recruit.set_skill', 'company.rset', { no: String(no), field: 'skill', value: s }, s)), set('recruit.level_down', 'level', '1'), set('recruit.level_up', 'level', '3')]
  else if (section === 'cities') actions = [...all.map((c) => act('recruit.set_city', 'company.rset', { no: String(no), field: 'city', value: c.code, extra: chosen.includes(c.code) ? '0' : '1' }, c.code)),
    set('recruit.scope_own', 'scope', 'own'), set('recruit.scope_nation', 'scope', 'nation'), set('recruit.scope_all', 'scope', 'all')]
  else if (section === 'pay') actions = (['salary', 'housing', 'signing', 'relocation'] as const).flatMap((f) => [
    ...presets[f]!.map((_, i) => set(`recruit.preset_${f}`, f, String(i))), ask(act(`recruit.type_${f}`, 'company.ramount', { no: String(no), field: f }), 'amount')])
  else if (section === 'terms') actions = [...presets.terms!.map((_, i) => set('recruit.preset_term', 'term', String(i))), ...presets.shares!.map((_, i) => set('recruit.preset_shares', 'shares', String(i))),
    set('recruit.fewer', 'positions', '1'), set('recruit.more', 'positions', '3'), set('recruit.auto_on', 'auto', '1')]
  else actions = [...['skill', 'cities', 'pay', 'terms'].map((s) => act(`recruit.section_${s}`, 'company.rdraft', { no: String(no), section: s })), primary('recruit.post', 'company.rpost', { no: String(no) })]
  return mockOk('recruit_draft', v, [...actions, back(section ? 'company.rdraft' : 'company.recruit', section ? { no: String(no) } : { company: OWN.code }), refreshA('company.rdraft', { no: String(no) })])
}

const specialistLines = (): SpecialistLine[] => [
  { no: 61, name_seed: 3, skill: 'baking', level: 3, home: N('calderis', 'کالدریس'), salary: 900, housing: 200, served: 6, term: 6, expiring: true, underpaid: false, underpaid_left: 0, unpaid_left: 0, market_due: 900, shares: 10 },
  { no: 62, name_seed: 9, skill: 'chemistry', level: 2, home: N('riverside', 'ساحل'), salary: 700, housing: 0, served: 2, term: 8, expiring: false, underpaid: true, underpaid_left: 2, unpaid_left: 0, market_due: 850, shares: 0 },
]

function specialists(notice = '', confirm: SpecialistLine | null = null) {
  const lines = specialistLines()
  return mockOk('specialists', { ref: OWN, lines, max: 4, confirm, confirm_act: confirm ? 'dismiss' : '', notice, notice_seed: notice ? 3 : 0 },
    confirm ? [confirmA('recruit.dismiss_confirm', 'company.npc', { no: String(confirm.no), act: 'dismiss' }), back('company.npcs', { company: OWN.code })]
      : [act('recruit.renew', 'company.npc', { no: '61', act: 'renew' }, 'baking'), act('recruit.dismiss', 'company.npc', { no: '61', act: 'dismiss' }, 'baking'),
        act('recruit.raise', 'company.npc', { no: '62', act: 'raise' }, 'chemistry'), act('recruit.dismiss', 'company.npc', { no: '62', act: 'dismiss' }, 'chemistry'),
        act('recruit.hub', 'company.recruit', { company: OWN.code }), back('company.manage', { company: OWN.code }), refreshA('company.npcs', { company: OWN.code })])
}

// -- the dispatcher -------------------------------------------------------------------------------------------------------------------

interface Answer { ok: boolean; request_id?: string; screen: string; view?: unknown; actions?: MockAct[]; error?: { code: string; args?: Record<string, unknown> } }

export function mockCompaniesCommand(command: string, args: Record<string, unknown> = {}): Answer | null {
  const a = (k: string) => String(args[k] ?? '')
  const num = (k: string) => Number(args[k] ?? 0)
  switch (command) {
    case 'company.mine':
      return mockOk('company_mine', { companies: mineLines() }, [...mineLines().map((l) => act('company.manage', 'company.manage', { company: l.ref.code }, l.ref.code)), back('company.list')])
    case 'company.list': return registry()
    case 'company.view': return page(a('code'))
    case 'company.register': return types(args)
    case 'company.type': return typeDetail(a('type'))
    case 'company.found': {
      // a name that is too short is refused (the registration refusal of the area)
      if (a('name').trim().length < 3) {
        return refusal('company_refusal', 'company', 'name_length', { kind: 'name_length', ref: { code: '', name: '', type: N('', '') }, need: 0, have: 0, min: 3, max: 24, city_code: 'calderis', city: city.name }, back('company.register'))
      }
      return founded(args)
    }
    case 'company.manage': return manage(company(a('company')))
    case 'company.deposit': {
      co.balance += num('amount'); co.notice = { kind: 'deposited', amount: num('amount'), tax: 0, net: 0, price_bps: 0, player: { name: '', code: '' } }
      return manage(company(a('company')))
    }
    case 'company.withdraw': {
      const amount = num('amount')
      if (amount > co.balance - 300) return refusal('company_refusal', 'company', 'not_enough', { kind: 'not_enough', ref: OWN, need: amount, have: co.balance - 300, min: 0, max: 0, city_code: '', city: '' }, back('company.manage', { company: OWN.code }))
      co.balance -= amount; co.notice = { kind: 'withdrawn', amount, tax: Math.round(amount / 10), net: amount - Math.round(amount / 10), price_bps: 0, player: { name: '', code: '' } }
      return manage(company(a('company')))
    }
    case 'company.price': co.priceBps = num('price'); co.notice = { kind: 'price', amount: 0, tax: 0, net: 0, price_bps: co.priceBps, player: { name: '', code: '' } }; return manage(company(a('company')))
    case 'company.auto': co.auto = a('on') === 'on'; co.notice = { kind: co.auto ? 'auto_on' : 'auto_off', amount: 0, tax: 0, net: 0, price_bps: 0, player: { name: '', code: '' } }; return manage(company(a('company')))
    case 'company.manager':
      // only a known player code is accepted (the mock's refusal for a typed value)
      if (a('to') !== 'M1' && a('to') !== MINA.name) return refusal('company_refusal', 'company', 'no_player', { kind: 'no_player', ref: OWN, need: 0, have: 0, min: 0, max: 0, city_code: '', city: '' }, back('company.manage', { company: OWN.code }))
      co.notice = { kind: 'manager_set', amount: 0, tax: 0, net: 0, price_bps: 0, player: MINA }; return manage(company(a('company')))
    case 'company.close': return close(company(a('company')), a('confirm') === 'yes')
    case 'company.openings': return openings(company(a('company')))
    case 'company.post': return openings(company(a('company')))
    case 'company.slots': co.positions = Math.max(1, num('positions')); return openings(OWN.code)
    case 'company.staff': return staff(company(a('company')), args)
    case 'company.decide': co.applications = []; return staff(OWN.code, { ...args, decided: true })
    case 'company.fire': return staff(company(a('company')), args)
    case 'company.opening': return opening(num('no'))
    case 'company.apply': return mockOk('company_applied', { company: WORK, job: num('no') === 12 ? SELLER : BAKER }, [act('job.openings', 'job.list'), act('company.page', 'company.view', { code: WORK.code }), back('player.profile.get')])
    case 'company.warehouse': return warehouse(company(a('company')))
    case 'company.suppliers': return suppliers(company(a('company')), false)
    case 'company.supply': {
      if (num('qty') > 200) return refusal('production_refusal', 'production', 'supplier_empty', { kind: 'supplier_empty', ref: OWN, back: { command: 'company.suppliers', args: [OWN.code] }, skill: '', level: 0, have: 0, techs: null, shortages: null, need: 0, have_money: 0, max: 200, city_code: 'calderis', city: city.name, gap: null }, back('company.suppliers', { company: OWN.code }))
      return suppliers(company(a('company')), true)
    }
    case 'company.stockup': return produce(company(a('company')), { ...args, confirm: '' })
    case 'company.orders': return orders(company(a('company')))
    case 'company.produce': return produce(company(a('company')), args)
    case 'company.kit': return produce(company(a('company')), args, true)
    case 'company.sell': return sell(company(a('company')), args)
    case 'company.listings': return listings(company(a('company')))
    case 'company.unlist': co.listed = 0; return listings(OWN.code, true)
    case 'company.goods': return goods()
    case 'company.buy': return buy(num('no'), args)
    case 'company.studio': return studio(company(a('company')))
    case 'company.dnew': return design(5, {})
    case 'company.design': return design(num('no'), args)
    case 'company.dfill': co.designFilled = true; return design(num('no'), {})
    case 'company.dqty': co.slotQty = num('qty'); return design(num('no'), {})
    case 'company.dname': co.designName = a('name'); return design(num('no'), {})
    case 'company.dfinal': return design(4, {})
    case 'company.drevise': return design(5, {})
    case 'company.dretire': return studio(OWN.code)
    case 'company.improve': return improvement(num('no'), a('slot'), a('confirm') === 'yes')
    case 'company.retrofit':
      return mockOk('retrofit', { ref: OWN, kit_no: 3, good: bread, from_ver: 1, to_ver: 2, duration_seconds: 5400, finish_at: LATER, started: a('confirm') === 'yes' }, [act('production.orders', 'company.orders', { company: OWN.code }), back('company.orders', { company: OWN.code })])
    case 'military.kitbuy':
      return mockOk('kit_purchase', { bought: a('confirm') === 'yes', seller: 'کارگاه فولاد پارس', country: 'default_country' }, [act('military.procure', 'military.procure', { country: 'default_country' })])
    case 'company.lab': return a('tech') ? tech(company(a('company')), a('tech'), args) : lab(company(a('company')))
    case 'company.research': co.researched = true; return lab(company(a('company')))
    case 'company.techmode': return tech(company(a('company')), a('tech'), args)
    case 'company.license': return lab(company(a('company')))
    case 'company.relab': return reverseLab(company(a('company')), {})
    case 'company.reverse': return reverseLab(company(a('company')), args)
    case 'company.recruit': return hub(company(a('company')))
    case 'company.rnew': return draft(7, '', 'created')
    case 'company.rdraft': return draft(num('no'), a('section'))
    case 'company.rset': {
      if (a('field') === 'city') co.draftCities = a('extra') === '1' ? [...co.draftCities, a('value')] : co.draftCities.filter((c) => c !== a('value'))
      if (a('field') === 'salary') co.draftSalary = presets.salary![Number(a('value'))] ?? co.draftSalary
      return draft(num('no'), ['skill', 'level'].includes(a('field')) ? 'skill' : a('field') === 'city' || a('field') === 'scope' ? 'cities' : ['salary', 'housing', 'signing', 'relocation'].includes(a('field')) ? 'pay' : 'terms', 'set')
    }
    case 'company.ramount': co.draftSalary = a('field') === 'salary' ? num('amount') : co.draftSalary; return draft(num('no'), 'pay', 'set')
    case 'company.rpost':
      if (a('confirm') === 'yes') { co.campaigns = 2; return campaign(6, 'posted') }
      return draft(num('no'), '', '', true)
    case 'company.rcamp': return campaign(num('no'))
    case 'company.rdecide': {
      // the second applicant is no longer there (the recruitment refusal of the area)
      if (num('no') === 22) return refusal('recruit_refusal', 'recruit', 'gone', { kind: 'gone', ref: OWN, back: { command: 'company.rcamp', args: ['5'] }, need: 0, have: 0, max: 0, name_seed: 12 }, back('company.rcamp', { no: '5' }))
      if (a('verdict') === 'yes') co.hired = true
      return campaign(5, a('verdict') === 'yes' ? 'hired' : 'rejected')
    }
    case 'company.rcancel': return a('confirm') === 'yes' ? hub(OWN.code) : campaignCancel(num('no'))
    case 'company.npcs': return specialists()
    case 'company.npc': {
      const line = specialistLines().find((l) => l.no === num('no')) ?? null
      if (a('act') === 'dismiss' && a('confirm') !== 'yes') return specialists('', line)
      return specialists(a('act') === 'renew' ? 'renewed' : a('act') === 'raise' ? 'raised' : 'dismissed')
    }
    case 'company.defence': return manage(company(a('company')))
    default: return null
  }
}

