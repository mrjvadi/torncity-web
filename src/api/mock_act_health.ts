// Dev-only mock answers (?mock=1) for the activities area, health and missions: the neutral contract of
// docs/adr/0039-presentation-split.md (a screen name, a view typed by the generated Go view, actions by meaning;
// never a text, a label or a row). Answers every screen of the area, including its refusals and results. The
// actions mirror the Go constructors (internal/presentation/life/activity_screens.go): ids, commands, args.
// `?as=city` puts the mock player in the central city (a city's boards, no currency of their own).

import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import type { ContentTables } from './mock_act_content'
import { AS_CITY } from './mock_p0'
import type {
  CompanyRef, MissionBoardRef, MissionLine, MissionObjective, MissionProgressLine, MissionReward, PaymentChoice, TreatOption,
} from './views.gen'

type Args = Record<string, unknown> | undefined

const e = (code: string, en: string, fa: string) => ({ code, name: { en, fa } })

/** The catalogue names these screens mention, in both languages. */
export const HEALTH_CONTENT: ContentTables = {
  mission: [
    e('first_steps', 'First steps', 'قدم‌های اول'), e('study_up', 'Back to class', 'برگشت به کلاس'), e('city_courier', 'City courier', 'پیک شهر'),
    e('medicine_drive', 'Medicine drive', 'پویش دارو'), e('market_day', 'Market day', 'روز بازار'), e('road_watch', 'Road watch', 'مراقبت جاده‌ها'),
    e('first_aid_course', 'First aid training', 'آموزش کمک‌های اولیه'),
    e('village_first_lesson', 'First lesson', 'اولین درس'), e('village_bread_run', 'Bread for the store', 'نان برای انبار'),
    e('village_bandage_run', 'Bandages for the health house', 'باند برای خانهٔ بهداشت'),
  ],
  mission_board: [e('village_works', 'Village works board', 'تابلوی کارهای شهر'), e('city_hall', 'Civic noticeboard', 'تابلوی اعلانات شهرداری'), e('police', 'Police board', 'تابلوی پلیس')],
  item: [e('bread', 'Bread', 'نان'), e('bandage', 'Bandage', 'باند'), e('sandwich', 'Sandwich', 'ساندویچ'), e('painkiller', 'Painkiller', 'مسکن')],
  crime: [e('pickpocket', 'Pickpocketing', 'جیب‌بری'), e('shoplift', 'Shoplifting', 'دزدی از مغازه')],
  crime_category: [e('petty_theft', 'Petty theft', 'دزدی‌های ریز')],
  course: [e('first_aid', 'First aid', 'کمک‌های اولیه'), e('bookkeeping', 'Bookkeeping', 'دفترداری')],
  career: [e('farmhand', 'Farmhand', 'کارگر مزرعه'), e('clerk', 'Clerk', 'منشی')],
  city: [e('support', 'The central city', 'شهر مرکزی'), e('calderis', 'Calderis', 'کالدریس')],
  place: [e('city_hall', 'City centre', 'مرکز شهر'), e('police_station', 'Police station', 'کلانتری')],
  skill: [e('medicine', 'Medicine', 'پزشکی')],
}

const NONE = { code: '', name: '' }
const NO_CLINIC: CompanyRef = { code: '', name: '', type: NONE }
const CLINIC_SHIFA: CompanyRef = { code: 'C-4F2K', name: 'شفا', type: { code: 'clinic', name: 'Clinic' } }
const CLINIC_NILOOFAR: CompanyRef = { code: 'C-9Q7M', name: 'نیلوفر', type: { code: 'clinic', name: 'Clinic' } }
const CLINIC_AFTAB: CompanyRef = { code: 'C-2B8D', name: 'آفتاب', type: { code: 'clinic', name: 'Clinic' } }

const CITY_OPTION: TreatOption = { provider: 'city', clinic: NO_CLINIC, price: 1800, saves_seconds: 1200, doctor: 0, stock: 0, open: true, can_treat: true, medicine: '', idle: '' }
const clinic = (ref: CompanyRef, price: number, doctor: number, stock: number, open: boolean, saves: number): TreatOption => ({
  provider: 'clinic', clinic: ref, price, saves_seconds: saves, doctor, stock, open, can_treat: open && stock > 0, medicine: '', idle: '',
})
const CLINICS: TreatOption[] = [
  clinic(CLINIC_SHIFA, 1200, 12, 18, true, 900),
  clinic(CLINIC_NILOOFAR, 500, 1, 0, false, 0),
  clinic(CLINIC_AFTAB, 0, 6, 4, true, 600),
]

// B5 (ADR 0069): the care a founded settlement built: the health house (first aid, free) and the clinic (medicine, a fee into the treasury)
const HOUSE: TreatOption = { provider: 'health_house', clinic: NO_CLINIC, price: 0, saves_seconds: 540, doctor: 0, stock: 3, open: true, can_treat: true, medicine: 'bandage', idle: '' }
const VCLINIC: TreatOption = { provider: 'village_clinic', clinic: NO_CLINIC, price: 350, saves_seconds: 1500, doctor: 0, stock: 2, open: true, can_treat: true, medicine: 'painkillers', idle: '' }
const closed = (o: TreatOption, idle: string): TreatOption => ({ ...o, open: false, can_treat: false, idle, medicine: '' })
const site = (code: string, name: string, present: boolean, open: boolean, idle = '') => ({ building: { code, name }, present, open, idle })
type VillageMode = 'house' | 'both' | 'closed' | 'empty' | 'nomed'
const villageHospital = (mode: VillageMode) => {
  const village = mode === 'house' ? [HOUSE] : mode === 'both' ? [HOUSE, VCLINIC] : mode === 'closed' ? [closed(HOUSE, 'no_staff'), closed(VCLINIC, 'no_wage')] : mode === 'nomed' ? [closed(HOUSE, 'no_supplies')] : []
  const care = {
    city_hospital_gone: true,
    house: site('health_house', 'خانهٔ بهداشت', mode !== 'empty', mode === 'house' || mode === 'both', mode === 'closed' ? 'no_staff' : mode === 'nomed' ? 'no_supplies' : ''),
    clinic: site('clinic', 'درمانگاه', mode === 'both' || mode === 'closed', mode === 'both', mode === 'closed' ? 'no_wage' : ''),
    apothecary: { code: 'apothecary', name: 'عطاری' }, no_medicine: mode === 'empty' || mode === 'nomed', refer: { code: 'support', name: 'شهر مرکزی' },
  }
  return mockOk('hospital', {
    health: 34, max: 100, full_in_seconds: 0, city_code: 'v-k3x9', city: 'آمل', in_hospital: true, cause: 'fight', remaining_seconds: 2700, ends_at: inMinutes(45), treated: false, treated_by: HOUSE,
    city_hospital: null, clinics: null, village, care, founded: true,
  }, [
    ...village.filter((o) => o.can_treat).map((o) => A('health.treat', 'health.treat', { provider: o.provider }, { subject: o.provider })),
    back('player.profile.get'), refreshA('health.hospital'),
  ])
}
const inMinutes = (m: number) => new Date(Date.now() + m * 60000).toISOString()
const PAY: PaymentChoice = { amount: 1800, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 6400, bank: 20500 }
const PAY_BROKE: PaymentChoice = { amount: 1800, accepted: ['cash', 'card'], usable: [], cash: 300, bank: 120 }

// -- state of the mock: a stay that can be treated, a clinic's desk, the player's missions ----------------------------

let treatedBy: TreatOption | null = null
const desk = { price: 1200, open: true, stock: 18, treated: 7, earned: 8400 }

const hospitalView = (mode: 'in' | 'out' | 'clinics') => {
  const inHospital = mode === 'in'
  const treated = treatedBy !== null
  return mockOk('hospital', {
    health: inHospital ? 34 : 88, max: 100, full_in_seconds: mode === 'out' ? 5400 : 0,
    city_code: 'support', city: 'شهر مرکزی', in_hospital: inHospital, cause: inHospital ? 'crime' : '', remaining_seconds: inHospital ? (treated ? 1500 : 2700) : 0,
    ends_at: inHospital ? inMinutes(treated ? 25 : 45) : null, treated: inHospital && treated, treated_by: inHospital && treated ? treatedBy! : CITY_OPTION,
    city_hospital: inHospital && !treated ? CITY_OPTION : null,
    clinics: mode === 'out' ? null : CLINICS, village: null, care: null, founded: false,
  }, [
    ...(inHospital && !treated
      ? [CITY_OPTION, CLINICS[0], CLINICS[2]].map((o) => { const p = o.provider === 'city' ? 'city' : o.clinic.code; return A('health.treat', 'health.treat', { provider: p }, { subject: p }) })
      : []),
    back('player.profile.get'), refreshA('health.hospital'),
  ])
}

const optionOf = (provider: string): TreatOption => (provider === 'city' ? CITY_OPTION : provider === 'health_house' ? HOUSE : provider === 'village_clinic' ? VCLINIC : CLINICS.find((c) => c.clinic.code === provider) ?? CLINICS[0])

function treatConfirm(provider: string, pay: 'ok' | 'broke') {
  const option = optionOf(provider)
  const payment = option.price === 0 ? null : pay === 'broke' ? PAY_BROKE : { ...PAY, amount: option.price }
  const usable = payment?.usable ?? []
  const acts: MockAct[] = !payment
    ? [A('health.confirm_free', 'health.treat', { provider, method: 'free' })]
    : usable.length ? usable.map((m) => A(`pay.${m}`, 'health.treat', { provider, method: m })) : [A('bank', 'bank.show')]
  return mockOk('treat_confirm', { option, remaining_seconds: 2700, ends_at: inMinutes(45 - Math.round(option.saves_seconds / 60)), payment }, [...acts, back('health.hospital')])
}

function treated(provider: string, method: string) {
  const option = optionOf(provider)
  treatedBy = option
  const left = Math.max(0, 2700 - option.saves_seconds)
  return mockOk('treated', {
    option, paid: method === 'free' ? 0 : option.price, method, saved_seconds: option.saves_seconds, remaining_seconds: left, ends_at: inMinutes(left / 60),
  }, [back('player.profile.get'), refreshA('health.hospital')])
}

function clinicDesk(open = desk.open, stocked = true) {
  return mockOk('clinic_desk', { ref: CLINIC_SHIFA, price: desk.price, open, stock: stocked ? desk.stock : 1, stocked, units: 2, doctor: 12, reduction_bps: 1500, treated: desk.treated, earned: desk.earned }, [
    { ...A('health.price', 'health.price', { company: CLINIC_SHIFA.code }), input: { field: 'price' } },
    A(open ? 'health.close' : 'health.open', 'health.open', { company: CLINIC_SHIFA.code, on: open ? 'off' : 'on' }),
    A('production.warehouse', 'production.warehouse', { company: CLINIC_SHIFA.code }),
    back('company.manage', { company: CLINIC_SHIFA.code }), refreshA('health.clinic', { company: CLINIC_SHIFA.code }),
  ])
}

const healthRefusal = (kind: string) => ({
  ...mockOk('health_refusal', { kind }, [A('health.hospital', 'health.hospital'), back('player.profile.get')]),
  ok: false, error: { code: `health_${kind}` },
})

// -- missions ----------------------------------------------------------------------------------------------------

const OBJ = (kind: string, count: number, target?: { kind: string; code: string; name: string }, done = 0): MissionObjective => ({ kind, target: target ?? { kind: '', code: '', name: '' }, count, done })
const ITEM = (code: string, name: string) => ({ kind: 'item', code, name })
const MONEY = { code: 'AML', name: 'سکهٔ آمل', symbol: '' }
const reward = (cash: number, xp: number, items?: { code: string; name: string; qty: number }[]): MissionReward => ({ cash, xp, items: items ? items.map((i) => ({ item: { code: i.code, name: i.name }, qty: i.qty })) : null })

interface Def { code: string; name: string; board: string; reward: MissionReward; objectives: MissionObjective[]; min_level: number; requires: string[]; repeatable: boolean; cooldown: number; limit: number }

const VILLAGE_BOARD: MissionBoardRef = { code: 'village_works', name: 'Village works board', place: NONE, open: 3 }
const CITY_BOARDS: MissionBoardRef[] = [
  { code: 'city_hall', name: 'Civic noticeboard', place: { code: 'city_hall', name: 'City centre' }, open: 2 },
  { code: 'police', name: 'Police board', place: { code: 'police_station', name: 'Police station' }, open: 1 },
]
const DEFS: Def[] = AS_CITY
  ? [
    { code: 'first_steps', name: 'First steps', board: 'city_hall', reward: reward(300, 40, [{ code: 'sandwich', name: 'Sandwich', qty: 2 }]), objectives: [OBJ('work_shift', 2), OBJ('buy_item', 1, ITEM('bandage', 'Bandage'))], min_level: 0, requires: [], repeatable: false, cooldown: 0, limit: 0 },
    { code: 'medicine_drive', name: 'Medicine drive', board: 'city_hall', reward: reward(900, 60), objectives: [OBJ('deliver', 4, ITEM('bandage', 'Bandage'))], min_level: 3, requires: ['first_steps'], repeatable: true, cooldown: 86400, limit: 7200 },
    { code: 'road_watch', name: 'Road watch', board: 'police', reward: reward(500, 35), objectives: [OBJ('travel', 1, { kind: 'city', code: 'calderis', name: 'Calderis' })], min_level: 0, requires: [], repeatable: true, cooldown: 43200, limit: 0 },
  ]
  : [
    { code: 'village_first_lesson', name: 'First lesson', board: 'village_works', reward: reward(200, 30), objectives: [OBJ('course', 1)], min_level: 0, requires: [], repeatable: false, cooldown: 0, limit: 0 },
    { code: 'village_bread_run', name: 'Bread for the store', board: 'village_works', reward: reward(300, 25), objectives: [OBJ('deliver', 3, ITEM('bread', 'Bread'))], min_level: 0, requires: [], repeatable: true, cooldown: 86400, limit: 10800 },
    { code: 'village_bandage_run', name: 'Bandages for the health house', board: 'village_works', reward: reward(400, 30), objectives: [OBJ('deliver', 3, ITEM('bandage', 'Bandage'))], min_level: 2, requires: ['village_first_lesson'], repeatable: true, cooldown: 86400, limit: 0 },
  ]
const BOARDS = AS_CITY ? CITY_BOARDS : [VILLAGE_BOARD]
const nm = (code: string) => ({ code, name: DEFS.find((d) => d.code === code)?.name ?? code })

let seq = 12
const active: MissionProgressLine[] = []
const recent: MissionProgressLine[] = [
  { no: 9, mission: nm(DEFS[1].code), status: 'completed', objectives: null, cash: 150, withheld: 50, left_seconds: 0, deliver: false },
  { no: 8, mission: nm(DEFS[0].code), status: 'abandoned', objectives: null, cash: 0, withheld: 0, left_seconds: 0, deliver: false },
  { no: 7, mission: nm(DEFS[2].code), status: 'expired', objectives: null, cash: 0, withheld: 0, left_seconds: 0, deliver: false },
]
let seeded = false
function seed() {
  if (seeded) return
  seeded = true
  const d = DEFS[1]
  active.push({ no: 11, mission: nm(d.code), status: 'active', objectives: d.objectives.map((o) => ({ ...o, done: o.kind === 'deliver' ? 1 : 0 })), cash: 0, withheld: 0, left_seconds: d.limit ? 5400 : 0, deliver: d.objectives.some((o) => o.kind === 'deliver') })
}
const maxMissions = 3

const blockedOf = (d: Def): { blocked: string; wait: number } => {
  if (active.some((m) => m.mission.code === d.code)) return { blocked: 'active', wait: 0 }
  if (!d.repeatable && recent.some((m) => m.mission.code === d.code && m.status === 'completed')) return { blocked: 'done', wait: 0 }
  if (d.code === DEFS[2].code) return { blocked: 'cooldown', wait: 5400 }
  if (d.min_level > 0 && !AS_CITY) return { blocked: 'level', wait: 0 }
  if (d.requires.length) return { blocked: 'requires', wait: 0 }
  if (active.length >= maxMissions) return { blocked: 'too_many', wait: 0 }
  return { blocked: '', wait: 0 }
}

const lineOf = (d: Def): MissionLine => {
  const b = blockedOf(d)
  return { mission: nm(d.code), reward: d.reward, blocked: b.blocked, wait_seconds: b.wait, repeatable: d.repeatable, objectives: d.objectives }
}

function missionBoard(code: string) {
  seed()
  const board = BOARDS.find((b) => b.code === code)
  const base = { city: AS_CITY ? 'شهر مرکزی' : 'آمل', city_code: AS_CITY ? 'support' : 'v-k3x9', tier: 'city', currency: AS_CITY ? null : MONEY }
  if (!board) {
    return mockOk('mission_board', { ...base, boards: BOARDS, board: null, here: true, missions: null }, [
      ...BOARDS.map((b) => A('mission.board', 'mission.board', { board: b.code }, { subject: b.code })),
      A('mission.mine', 'mission.mine'), back('player.profile.get'), refreshA('mission.board'),
    ])
  }
  const list = DEFS.filter((d) => d.board === board.code)
  return mockOk('mission_board', { ...base, boards: BOARDS, board, here: code !== 'police', missions: list.map(lineOf) }, [
    ...list.map((d) => A('mission.view', 'mission.view', { mission: d.code }, { subject: d.code })),
    A('mission.mine', 'mission.mine'), back('mission.board'), refreshA('mission.board', { board: board.code }),
  ])
}

function missionView(code: string, abandoning = false, no = 11) {
  seed()
  const d = DEFS.find((x) => x.code === code)
  if (!d) return missionRefusal('not_found')
  const board = BOARDS.find((b) => b.code === d.board) ?? BOARDS[0]
  const b = blockedOf(d)
  const view = {
    mission: nm(d.code), no: abandoning ? no : 0, board, objectives: d.objectives, reward: d.reward, min_level: d.min_level, requires: d.requires.map(nm), blocked: abandoning ? '' : b.blocked,
    wait_seconds: b.wait, repeatable: d.repeatable, cooldown_seconds: d.cooldown, time_limit_seconds: d.limit, abandoning, max: maxMissions,
  }
  if (abandoning) return mockOk('mission', view, [A('mission.abandon_confirm', 'mission.abandon', { no: String(no), confirm: 'yes' }, { kind: 'danger' }), back('mission.mine')])
  return mockOk('mission', view, [...(b.blocked ? [] : [A('mission.accept', 'mission.accept', { mission: d.code }, { subject: d.code })]), back('mission.board', { board: board.code })])
}

type NoticeKind = 'accepted' | 'delivered' | 'completed' | 'abandoned'
function missionsMine(notice?: { kind: NoticeKind; mission: string; qty?: number; cash?: number; withheld?: number; xp?: number }) {
  seed()
  const acts: MockAct[] = []
  for (const m of active) {
    if (m.deliver) acts.push(A('mission.deliver', 'mission.deliver', { no: String(m.no) }, { subject: m.mission.code }))
    acts.push(A('mission.abandon', 'mission.abandon', { no: String(m.no) }, { kind: 'danger', subject: m.mission.code }))
  }
  return mockOk('missions_mine', {
    notice: notice ? { kind: notice.kind, mission: nm(notice.mission), qty: notice.qty ?? 0, cash: notice.cash ?? 0, withheld: notice.withheld ?? 0, xp: notice.xp ?? 0 } : null,
    max: maxMissions, active: active.length ? active : null, recent,
  }, [...acts, A('mission.boards', 'mission.board'), back('player.profile.get'), refreshA('mission.mine')])
}

function missionRefusal(kind: string, o: { blocked?: string; wait?: number; level?: number; max?: number } = {}) {
  return {
    ...mockOk('mission_refusal', { kind, blocked: o.blocked ?? '', wait_seconds: o.wait ?? 0, level: o.level ?? 0, max: o.max ?? 0 }, [A('mission.mine', 'mission.mine'), back('mission.board')]),
    ok: false, error: { code: `mission_${kind}`, args: { wait_seconds: o.wait ?? 0, level: o.level ?? 0, max: o.max ?? 0 } },
  }
}

function accept(code: string) {
  seed()
  const d = DEFS.find((x) => x.code === code)
  if (!d) return missionRefusal('not_found')
  const b = blockedOf(d)
  if (b.blocked) return missionRefusal('blocked', { blocked: b.blocked, wait: b.wait, level: d.min_level, max: maxMissions })
  active.push({ no: ++seq, mission: nm(d.code), status: 'active', objectives: d.objectives.map((o) => ({ ...o, done: 0 })), cash: 0, withheld: 0, left_seconds: d.limit, deliver: d.objectives.some((o) => o.kind === 'deliver') })
  return missionsMine({ kind: 'accepted', mission: d.code })
}

function deliver(no: number) {
  seed()
  const m = active.find((x) => x.no === no)
  if (!m) return missionRefusal('not_active')
  const o = (m.objectives ?? []).find((x) => x.kind === 'deliver')
  if (!o || o.done >= o.count) return missionRefusal('nothing_to_deliver')
  const qty = Math.min(2, o.count - o.done)
  o.done += qty
  if (o.done < o.count) return missionsMine({ kind: 'delivered', mission: m.mission.code, qty })
  active.splice(active.indexOf(m), 1)
  const d = DEFS.find((x) => x.code === m.mission.code)
  recent.unshift({ ...m, status: 'completed', cash: d?.reward.cash ?? 0, withheld: 0, deliver: false })
  return missionsMine({ kind: 'completed', mission: m.mission.code, cash: d?.reward.cash ?? 0, xp: d?.reward.xp ?? 0 })
}

function abandon(no: number, confirmed: boolean) {
  seed()
  const m = active.find((x) => x.no === no)
  if (!m) return missionRefusal('not_active')
  if (!confirmed) return missionView(m.mission.code, true, no)
  active.splice(active.indexOf(m), 1)
  recent.unshift({ ...m, status: 'abandoned', deliver: false })
  return missionsMine({ kind: 'abandoned', mission: m.mission.code })
}

/** The answer of a health or mission command in the mock, or null when it is not one. */
export function mockHealthCommand(command: string, a: Args): unknown | null {
  const args = (a ?? {}) as Record<string, unknown>
  const s = (k: string, d = '') => String(args[k] ?? d)
  switch (command) {
    case 'health.hospital': return hospitalView('in')
    case 'health.treat': return args.method ? treated(s('provider', 'city'), s('method')) : treatConfirm(s('provider', 'city'), 'ok')
    case 'health.clinic': return clinicDesk()
    case 'health.open': { desk.open = s('on') === 'on'; return clinicDesk() }
    case 'health.price': { desk.price = Math.max(0, Number(args.price) || 0); return clinicDesk() }
    case 'mission.board': return missionBoard(s('board'))
    case 'mission.view': return missionView(s('mission'))
    case 'mission.accept': return accept(s('mission'))
    case 'mission.mine': return missionsMine()
    case 'mission.deliver': return deliver(Number(args.no))
    case 'mission.abandon': return abandon(Number(args.no), !!args.confirm)

    // screenshot states: ?mock=1&open=mock.<name>
    case 'mock.hospital': treatedBy = null; return hospitalView('in')
    case 'mock.hospital_treated': treatedBy = CITY_OPTION; return hospitalView('in')
    case 'mock.village_care_house': treatedBy = null; return villageHospital('house')
    case 'mock.village_care_both': treatedBy = null; return villageHospital('both')
    case 'mock.village_care_closed': return villageHospital('closed')
    case 'mock.village_care_empty': return villageHospital('empty')
    case 'mock.village_care_nomed': return villageHospital('nomed')
    case 'mock.hospital_out': return hospitalView('out')
    case 'mock.hospital_clinics': return hospitalView('clinics')
    case 'mock.treat_confirm': return treatConfirm('city', 'ok')
    case 'mock.treat_clinic': return treatConfirm(CLINIC_SHIFA.code, 'ok')
    case 'mock.treat_free': return treatConfirm(CLINIC_AFTAB.code, 'ok')
    case 'mock.treat_broke': return treatConfirm('city', 'broke')
    case 'mock.treated': return treated('city', 'cash')
    case 'mock.treated_free': return treated(CLINIC_AFTAB.code, 'free')
    case 'mock.clinic_desk': return clinicDesk(true, true)
    case 'mock.clinic_closed': return clinicDesk(false, false)
    case 'mock.health_refusal': return healthRefusal(s('kind', 'no_hospitals'))
    case 'mock.mission_boards': return missionBoard('')
    case 'mock.mission_board': return missionBoard(BOARDS[0].code)
    case 'mock.mission': return missionView(DEFS[0].code)
    case 'mock.mission_blocked': return missionView(DEFS[1].code)
    case 'mock.mission_cooldown': return missionView(DEFS[2].code)
    case 'mock.mission_abandoning': { seed(); return missionView(active[0]?.mission.code ?? DEFS[1].code, true, active[0]?.no ?? 11) }
    case 'mock.missions_mine': return missionsMine()
    case 'mock.missions_empty': { seed(); active.length = 0; return missionsMine() }
    case 'mock.mission_completed': return missionsMine({ kind: 'completed', mission: DEFS[0].code, cash: 300, withheld: 100, xp: 40 })
    case 'mock.mission_refusal': return missionRefusal(s('kind', 'not_found'), { blocked: s('blocked', 'level'), wait: Number(args.wait ?? 5400), level: Number(args.level ?? 3), max: maxMissions })
    default: return null
  }
}
