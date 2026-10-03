// Dev-only mock answers (?mock=1) for the activities area, work, study and skills: the neutral contract of
// docs/adr/0039-presentation-split.md (a screen name, a view typed by the generated Go view, actions by meaning;
// never a text, a label or a row). Answers every screen of the area, including its refusals and results, the way a
// player reaches them (job.status, job.list, job.view, job.apply, job.work, job.promote, job.quit, education.list,
// education.view, education.enroll, skills.list) and by `mock.<state>` so a screenshot can open each state.

import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import type { ContentTables } from './mock_act_content'
import type {
  CourseCompletedView, CourseDetailView, CourseGap, CourseLine, CourseNeed, EducationView, EnrolledView, JobDetailView, JobHiredView, JobOpening,
  JobOpeningsView, JobPromotedView, JobQuitView, JobRef, JobStatusView, PaymentChoice, RefusalView, Requirement, ShiftStartedView,
  ShiftWorkedView, SkillLine, SkillsView,
} from './views.gen'
import { AS_CITY } from './mock_p0'

type Args = Record<string, unknown> | undefined

const e = (code: string, en: string, fa: string) => ({ code, name: { en, fa } })

/** The catalogue names these screens mention, in both languages. */
export const WORK_CONTENT: ContentTables = {
  career: [
    e('retail', 'Retail', 'فروشندگی'), e('hospitality', 'Hospitality', 'پذیرایی'), e('logistics', 'Logistics', 'حمل‌ونقل و انبار'),
    e('workshop', 'Workshop', 'کارگاه'), e('technology', 'Technology', 'فناوری'), e('healthcare', 'Healthcare', 'درمان'), e('finance', 'Finance', 'امور مالی'),
  ],
  career_tier: [
    e('retail.entry', 'Sales trainee', 'شاگرد فروشنده'), e('retail.skilled', 'Skilled salesperson', 'فروشندهٔ ماهر'), e('retail.senior', 'Senior salesperson', 'فروشندهٔ ارشد'), e('retail.manager', 'Shop manager', 'مدیر فروشگاه'),
    e('hospitality.entry', 'Waiter', 'پیشخدمت'), e('hospitality.skilled', 'Head waiter', 'سرپیشخدمت'),
    e('logistics.entry', 'Porter', 'باربر'), e('logistics.skilled', 'Driver', 'راننده'),
    e('workshop.entry', 'Workshop apprentice', 'شاگرد کارگاه'), e('workshop.skilled', 'Craftsman', 'استادکار'),
    e('technology.entry', 'Tech trainee', 'کارآموز فناوری'), e('technology.skilled', 'Programmer', 'برنامه‌نویس'),
    e('healthcare.entry', 'Nursing aide', 'کمک‌پرستار'), e('healthcare.skilled', 'Nurse', 'پرستار'),
    e('finance.entry', 'Junior clerk', 'کمک‌حسابدار'), e('finance.skilled', 'Accountant', 'حسابدار'),
  ],
  skill: [
    e('programming', 'Programming', 'برنامه‌نویسی'), e('engineering', 'Engineering', 'مهندسی'), e('mechanics', 'Mechanics', 'مکانیکی'), e('cooking', 'Cooking', 'آشپزی'),
    e('logistics', 'Logistics', 'انبارداری'), e('driving', 'Driving', 'رانندگی'), e('medicine', 'Medicine', 'پزشکی'), e('management', 'Management', 'مدیریت'),
    e('finance', 'Finance', 'حسابداری'), e('stealth', 'Stealth', 'پنهان‌کاری'), e('lockpicking', 'Lockpicking', 'قفل‌گشایی'), e('deception', 'Deception', 'فریبکاری'),
    e('streetwise', 'Streetwise', 'شم خیابان'), e('literacy', 'Literacy', 'سواد'),
  ],
  course: [
    e('first_aid', 'First aid', 'کمک‌های اولیه'), e('driving_licence', 'Driving licence', 'گواهینامهٔ رانندگی'), e('bookkeeping', 'Bookkeeping', 'دفترداری'),
    e('culinary_arts', 'Culinary arts', 'هنر آشپزی'), e('nursing', 'Nursing', 'پرستاری'), e('reading_writing', 'Reading and writing', 'خواندن و نوشتن'),
    e('programming_fundamentals', 'Programming basics', 'مبانی برنامه‌نویسی'),
  ],
  city: [e('calderis', 'Calderis', 'کالدریس'), e('support', 'Central city', 'شهر مرکزی')],
}

// -- the world of these screens ---------------------------------------------------------------------------------------------

const CITY = { code: 'calderis', name: 'کالدریس' }

const TITLE: Record<string, string> = {
  'retail.entry': 'Sales Trainee', 'retail.skilled': 'Skilled Salesperson', 'retail.senior': 'Senior Salesperson', 'retail.manager': 'Shop Manager',
  'hospitality.entry': 'Waiter', 'logistics.entry': 'Porter', 'workshop.entry': 'Workshop Apprentice', 'technology.entry': 'Tech Trainee',
  'technology.skilled': 'Programmer', 'healthcare.entry': 'Nursing Aide', 'finance.entry': 'Junior Clerk',
}
const CAREER: Record<string, string> = { retail: 'Retail', hospitality: 'Hospitality', logistics: 'Logistics', workshop: 'Workshop', technology: 'Technology', healthcare: 'Healthcare', finance: 'Finance' }

/** A position, as the views carry it (the authored English name is only a last resort for the web). */
const jr = (career: string, rank = 'entry'): JobRef => ({ career_code: career, career_name: CAREER[career] ?? career, rank, title: TITLE[`${career}.${rank}`] ?? `${career} ${rank}` })

const PAY: Record<string, number> = { retail: 120, hospitality: 110, logistics: 130, workshop: 140, technology: 180, healthcare: 160, finance: 150 }
const LOCKED = new Set(['technology', 'healthcare'])

const iso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()
const req = (kind: string, met: boolean, o: Partial<Requirement> = {}): Requirement => ({ kind, met, skill: '', need: 0, have: 0, course_code: '', course_name: '', city_code: '', city: '', wait_seconds: 0, trip: null, ...o })

// the player's job in the mock: it changes with applying, promotion and resigning
let held: JobRef | null = jr('retail')
let working = 0 // the time a shift in progress ends (ms)

const shiftLeft = () => Math.max(0, Math.round((working - Date.now()) / 1000))

// -- work ------------------------------------------------------------------------------------------------------------------

function status(o: { employed?: boolean; shift?: boolean; promo?: boolean; away?: boolean; walk?: boolean; top?: boolean } = {}) {
  const employed = o.employed ?? !!held
  if (!employed) {
    const v: JobStatusView = {
      employed: false, job: jr('retail'), employer: '', city_code: '', city: '', pay: 0, energy_cost: 0, energy: 80, max_energy: 100, performance: 0, shifts_in_tier: 0,
      total_earned: 0, at_workplace: false, top_tier: false, shift_length_seconds: 0, workplace: { code: '', name: '' }, walk_to_work_seconds: 0, shift: null,
      next: jr('retail'), promotion_ready: false, missing: null,
    }
    return mockOk('job_status', v, [A('job.openings', 'job.list'), back('player.profile.get'), refreshA('job.status')])
  }
  const job = held ?? jr('retail')
  const shift = o.shift || shiftLeft() > 0
  const left = shift ? (shiftLeft() || 540) : 0
  const promo = !!o.promo
  const v: JobStatusView = {
    employed: true, job, employer: '', city_code: CITY.code, city: CITY.name, pay: PAY[job.career_code] ?? 120, energy_cost: 15, energy: 72, max_energy: 100,
    performance: 64, shifts_in_tier: 7, total_earned: 2840, at_workplace: !o.away, top_tier: !!o.top, shift_length_seconds: 14400,
    workplace: { code: 'business_district', name: 'فروشگاه‌های البرز' }, walk_to_work_seconds: o.walk ? 420 : 0,
    shift: shift ? { remaining_seconds: left, ends_at: iso(left) } : null,
    next: o.top ? jr('retail', 'manager') : jr('retail', 'skilled'), promotion_ready: promo,
    missing: promo || o.top ? null : [req('performance', false, { need: 70, have: 64 }), req('shifts', false, { need: 12, have: 7 })],
  }
  const a: MockAct[] = []
  if (!o.away && !shift) a.push(A('job.work', 'job.work'))
  if (promo && !shift) a.push(A('job.promote', 'job.promote'))
  if (!shift) a.push(A('job.quit', 'job.quit', undefined, { kind: 'danger' }))
  a.push(back('player.profile.get'), refreshA('job.status'))
  return mockOk('job_status', v, a)
}

const PAGE = 4

function openings(page: number, o: { employed?: boolean; travelling?: boolean; empty?: boolean } = {}) {
  const employed = o.employed ?? !!held
  const all = Object.keys(PAY)
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const p = Math.min(Math.max(1, page), pages)
  const slice = o.empty ? [] : all.slice((p - 1) * PAGE, p * PAGE)
  const list: JobOpening[] = slice.map((c) => ({ job: jr(c), pay: PAY[c], eligible: !LOCKED.has(c) }))
  const companies = p === 1 && !o.empty && !o.travelling ? [
    { no: 12, company: 'نانوایی سحر', job: jr('retail', 'skilled'), pay: 150, eligible: true },
    { no: 15, company: 'استودیو دانا', job: jr('technology', 'skilled'), pay: 210, eligible: false },
  ] : null
  const v: JobOpeningsView = {
    companies, city_code: CITY.code, city: CITY.name, travelling: !!o.travelling, employed, current: employed ? (held ?? jr('retail')) : jr('retail'),
    openings: list.length ? list : null, page: p, pages: o.empty ? 1 : pages,
    gaps: p === 1 && !o.empty && !o.travelling ? [
      { job: jr('finance'), nearest: { code: 'support', name: 'شهر مرکزی' }, nearest_trip: TRIP, needs: [{ kind: 'knowledge', code: 'double_entry_bookkeeping', name: 'دفترداری دوطرفه', role: '', tier: 0 }, { kind: 'building', code: 'bank', name: 'بانک', role: '', tier: 0 }] },
      { job: jr('technology'), nearest: { code: 'support', name: 'شهر مرکزی' }, nearest_trip: TRIP, needs: [{ kind: 'knowledge', code: 'computing', name: 'رایانه', role: '', tier: 0 }] },
    ] : null,
  }
  const a: MockAct[] = []
  if (!o.travelling) {
    for (const x of list) a.push(A('job.opening', 'job.view', { role: x.job.career_code }, { subject: x.job.career_code }))
    for (const c of companies ?? []) a.push(A('company.opening', 'company.opening', { no: String(c.no) }, { subject: c.job.career_code }))
    if (employed) a.push(A('job.mine', 'job.status'))
    if (p > 1) a.push(A('page.prev', 'job.list', { page: String(p - 1) }))
    if (p < v.pages) a.push(A('page.next', 'job.list', { page: String(p + 1) }))
  }
  a.push(back('player.profile.get'), refreshA('job.list'))
  return mockOk('job_openings', v, a)
}

function detail(role: string, employed = !!held) {
  const locked = LOCKED.has(role)
  const requirements = locked
    ? [req('level', true, { need: 1, have: 4 }), req('skill', false, { skill: role === 'technology' ? 'programming' : 'medicine', need: 2, have: 0 }),
      req('certificate', false, { course_code: role === 'technology' ? 'programming_fundamentals' : 'nursing', course_name: 'x' })]
    : [req('level', true, { need: 1, have: 4 }), req('residence', true, { city_code: CITY.code, city: CITY.name })]
  const v: JobDetailView = {
    job: jr(role), city_code: CITY.code, city: CITY.name, pay: PAY[role] ?? 120, energy_cost: 15, requirements, can_apply: !locked && !employed, employed,
  }
  const a: MockAct[] = []
  if (v.can_apply) a.push(A('job.apply', 'job.apply', { role }, { subject: role }))
  a.push(back('job.list'), refreshA('job.view', { role }))
  return mockOk('job_detail', v, a)
}

function hired(role: string) {
  held = jr(role)
  const v: JobHiredView = { job: held, employer: '', city_code: CITY.code, city: CITY.name, pay: PAY[role] ?? 120 }
  return mockOk('job_hired', v, [A('job.work', 'job.work'), A('job.mine', 'job.status'), back('player.profile.get')])
}

function shiftStarted(tired = false) {
  working = Date.now() + 20000
  const v: ShiftStartedView = { job: held ?? jr('retail'), duration_seconds: 14400, ends_at: iso(14400), fatigue_bps: tired ? 8200 : 10000, energy: 57, max_energy: 100 }
  return mockOk('shift_started', v, [back('player.profile.get'), refreshA('job.status')])
}

function shiftWorked(o: { injury?: boolean; tired?: boolean; level?: boolean } = {}) {
  const v: ShiftWorkedView = {
    gross: 120, tax: 12, net: 108, xp: 10, skills: [{ skill: 'management', xp: 15, level: o.level ? 3 : 0 }, { skill: 'finance', xp: 5, level: 0 }],
    performance: o.tired ? 58 : 66, performance_delta: o.tired ? -2 : 2, fatigue_bps: o.tired ? 8200 : 10000, level: o.level ? 5 : 0, energy: 57, max_energy: 100,
    injury: o.injury ? { damage: 18, health: 62, max: 100, hospital: true, ends_at: iso(3600) } : null,
  }
  const a: MockAct[] = o.injury ? [A('health.hospital', 'health.hospital')] : [A('job.work_again', 'job.work'), A('job.mine', 'job.status')]
  a.push(back('player.profile.get'))
  return mockOk('shift_worked', v, a)
}

function promoted() {
  held = jr('retail', 'skilled')
  const v: JobPromotedView = { job: held, pay: 150 }
  return mockOk('job_promoted', v, [A('job.mine', 'job.status'), back('player.profile.get')])
}

const quitConfirm = () => mockOk('job_quit_confirm', { job: held ?? jr('retail') } as JobQuitView, [A('job.quit_confirm', 'job.quit', { confirm: 'yes' }, { kind: 'danger' }), back('job.status')])
function quitDone() {
  const job = held ?? jr('retail')
  held = null
  working = 0
  return mockOk('job_quit', { job } as JobQuitView, [A('job.openings', 'job.list'), back('player.profile.get')])
}

// -- refusals of work and study ----------------------------------------------------------------------------------------------

const REFUSAL_NEXT: Record<string, [string, string]> = {
  job_requirements: ['job.openings', 'job.list'], promotion: ['job.mine', 'job.status'], not_employed: ['job.openings', 'job.list'], already_employed: ['job.mine', 'job.status'],
  job_not_offered: ['job.openings', 'job.list'], not_at_workplace: ['profile.map', 'map.list'], course_requirements: ['education', 'education.list'],
  course_not_found: ['education', 'education.list'], cannot_afford: ['education', 'education.list'], shift_in_progress: ['job.mine', 'job.status'], army_cannot_pay: ['job.mine', 'job.status'],
}

export function workRefusal(kind: string) {
  const missing: Requirement[] | null =
    kind === 'job_requirements' ? [req('level', true, { need: 1, have: 4 }), req('skill', false, { skill: 'programming', need: 2, have: 0 }), req('certificate', false, { course_code: 'programming_fundamentals', course_name: 'x' })]
      : kind === 'promotion' ? [req('performance', false, { need: 70, have: 64 }), req('shifts', false, { need: 12, have: 7 }), req('time', false, { wait_seconds: 5400 })]
        : kind === 'course_requirements' ? [req('level', false, { need: 4, have: 2 }), req('certificate', false, { course_code: 'first_aid', course_name: 'x' })]
          : null
  const v: RefusalView = {
    kind, missing, city_code: kind === 'not_at_workplace' ? CITY.code : '', city: kind === 'not_at_workplace' ? CITY.name : '', fee: kind === 'cannot_afford' ? 2400 : 0,
    cash: kind === 'cannot_afford' ? 800 : 0, wait_seconds: kind === 'shift_in_progress' ? 540 : 0, ends_at: kind === 'shift_in_progress' ? iso(540) : null,
  }
  const next = REFUSAL_NEXT[kind]
  return {
    ok: false, request_id: 'mock', screen: 'refusal', view: v,
    error: { code: `refusal_${kind}`, args: { fee: v.fee, cash: v.cash, wait_seconds: v.wait_seconds } },
    actions: [...(next ? [A(next[0], next[1])] : []), back('player.profile.get')],
  }
}

// -- study -------------------------------------------------------------------------------------------------------------------

interface CourseRow { code: string; fee: number; secs: number; min?: number; inst: string; skills: [string, number][]; certifies: boolean; seats?: number }
const COURSES: Record<string, CourseRow> = {
  reading_writing: { code: 'reading_writing', fee: 0, secs: 3600, inst: 'training_center', skills: [['literacy', 100]], certifies: true },
  first_aid: { code: 'first_aid', fee: 600, secs: 7200, inst: 'training_center', skills: [['medicine', 150]], certifies: true },
  driving_licence: { code: 'driving_licence', fee: 900, secs: 10800, inst: 'training_center', skills: [['driving', 250]], certifies: true, seats: 6 },
  bookkeeping: { code: 'bookkeeping', fee: 1200, secs: 14400, inst: 'training_center', skills: [['finance', 250]], certifies: true },
  culinary_arts: { code: 'culinary_arts', fee: 2400, secs: 28800, min: 4, inst: 'training_center', skills: [['cooking', 400]], certifies: true },
  nursing: { code: 'nursing', fee: 5200, secs: 86400, inst: 'university', skills: [['medicine', 800]], certifies: true },
}
const nm = (code: string) => (WORK_CONTENT.course.find((c) => c.code === code)?.name.fa ?? code)
const cref = (code: string) => ({ code, name: nm(code) })
const line = (code: string, eligible = true): CourseLine => ({ course: cref(code), fee: COURSES[code].fee, duration_seconds: COURSES[code].secs, min_level: COURSES[code].min ?? 1, eligible })

const VILLAGE = { code: 'v-k3x9', name: 'آمل' }
const TRIP = { mode: 'bus', mode_name: 'اتوبوس', fare: 120, wait_seconds: 900 }
const MONEY = { code: 'AML', name: 'سکهٔ آمل', symbol: '' }

const need = (kind: string, code: string, role = ''): CourseNeed => ({ kind, code, name: '', role, tier: 0 })
const gap = (code: string, needs: CourseNeed[]): CourseGap => ({ course: cref(code), fee: COURSES[code].fee, duration_seconds: COURSES[code].secs, nearest: { code: 'support', name: 'شهر مرکزی' }, nearest_trip: TRIP, needs })

function education(page: number, mode: string) {
  const city = AS_CITY || mode === 'city'
  const base: EducationView = {
    current: null, certificates: null, place: city ? { code: '', name: '' } : VILLAGE, tier: city ? '' : 'village', currency: city ? null : MONEY,
    literacy: city ? null : { share_bps: 1800 }, courses: null, elsewhere: null, empty: '', build: null, page: 1, pages: 1,
  }
  let v: EducationView
  if (city) {
    const all = ['driving_licence', 'bookkeeping', 'first_aid', 'culinary_arts', 'nursing']
    const p = Math.min(Math.max(1, page), 2)
    v = { ...base, certificates: [cref('reading_writing')], courses: all.slice((p - 1) * 3, p * 3).map((c) => line(c, !COURSES[c].min)), page: p, pages: 2 }
  } else if (mode === 'empty') {
    v = { ...base, empty: 'nothing_taught', elsewhere: [gap('first_aid', [need('knowledge', 'basic_medicine'), need('building', 'health_house', 'health')])] }
  } else if (mode === 'no_class') {
    v = { ...base, literacy: { share_bps: 600 }, empty: 'no_class', build: { code: 'school', name: 'School' }, elsewhere: [gap('reading_writing', [need('building', 'school', 'education')])] }
  } else {
    v = {
      ...base, courses: [line('reading_writing'), line('bookkeeping'), line('culinary_arts', false)], elsewhere: [gap('first_aid', [need('knowledge', 'basic_medicine')]), gap('nursing', [need('teacher', '', 'health')])],
      ...(mode === 'current' ? { current: { course: cref('bookkeeping'), percent: 42, remaining_seconds: 8300, ends_at: iso(8300), paused: false }, certificates: [cref('reading_writing')] } : {}),
    }
  }
  const a: MockAct[] = (v.courses ?? []).map((c) => A('education.course', 'education.view', { course: c.course.code }, { subject: c.course.code }))
  if (v.page > 1) a.push(A('page.prev', 'education.list', { page: String(v.page - 1) }))
  if (v.page < v.pages) a.push(A('page.next', 'education.list', { page: String(v.page + 1) }))
  a.push(back('player.profile.get'), refreshA('education.list', { page: String(v.page) }))
  return mockOk('education', v, a)
}

const pay = (usable: string[], amount: number): PaymentChoice => ({ amount, accepted: ['cash', 'card'], usable, cash: usable.includes('cash') ? 4000 : 800, bank: usable.includes('card') ? 9000 : 300 })

function courseDetail(code: string) {
  const c = COURSES[code] ?? COURSES.first_aid
  const elsewhere = !AS_CITY && c.code === 'first_aid'
  const lowLevel = !!c.min && c.min > 1
  const poor = c.code === 'nursing'
  const requirements: Requirement[] = [
    req('level', !lowLevel, { need: c.min ?? 1, have: lowLevel ? 2 : 4 }),
    ...(elsewhere ? [req('course_city', false, { city_code: 'support', city: 'شهر مرکزی' })] : []),
  ]
  const can = !elsewhere && !lowLevel
  const v: CourseDetailView = {
    course: cref(c.code), institution: c.inst, city_code: elsewhere ? 'support' : '', city: elsewhere ? 'شهر مرکزی' : '', fee: c.fee, duration_seconds: c.secs, seats_left: c.seats ?? 0,
    staff: c.code === 'reading_writing' ? [{ id: 'tc1', kind: 'npc', name: '', students: 1, max: 12, mine: false, can_end: true }, { id: 'tc2', kind: 'home', name: 'کاوه', students: 0, max: 12, mine: false, can_end: false }] : null,
    teaching: c.code === 'reading_writing' ? { can_hire: false, hire_wage: 120, no_pool: false, can_school: false, can_home: true, school_wage: 120, tax_bps: 500 } : null,
    limited: !!c.seats, skills: c.skills.map(([skill, xp]) => ({ skill, xp, level: 0 })), certifies: c.certifies, requirements, can_enrol: can,
    payment: can && c.fee > 0 ? pay(poor ? [] : c.code === 'bookkeeping' ? ['cash'] : ['cash', 'card'], c.fee) : null,
  }
  const a: MockAct[] = []
  if (can) {
    if (v.payment) {
      if ((v.payment.usable ?? []).length) for (const m of v.payment.usable ?? []) a.push(A(`pay.${m}`, 'education.enroll', { course: c.code, method: m }))
      else a.push(A('bank', 'bank.show'))
    } else a.push(A('education.enrol', 'education.enroll', { course: c.code }, { subject: c.code }))
  }
  if (c.code === 'reading_writing') {
    a.push(A('education.teach_home', 'education.teach', { course: c.code, mode: 'home' }), A('education.unteach', 'education.unteach', { course: c.code, id: 'tc1' }))
  }
  a.push(back('education.list'), refreshA('education.view', { course: c.code }))
  return mockOk('course_detail', v, a)
}

function enrolled(code: string, method: string) {
  const c = COURSES[code] ?? COURSES.first_aid
  const v: EnrolledView = { course: cref(c.code), duration_seconds: c.secs, ends_at: iso(c.secs), fee: c.fee, method: c.fee > 0 ? method || 'cash' : '' }
  return mockOk('enrolled', v, [A('education.open', 'education.list'), back('player.profile.get')])
}

function completed(certified = true) {
  const v: CourseCompletedView = { course: cref('bookkeeping'), certified, skills: [{ skill: 'finance', xp: 250, level: 2 }] }
  return mockOk('course_completed', v, [A('education.open', 'education.list'), A('job.openings', 'job.list')])
}

// -- skills ------------------------------------------------------------------------------------------------------------------

function skills(none = false) {
  const all = ['management', 'finance', 'cooking', 'driving', 'medicine', 'programming']
  const lines: SkillLine[] = all.map((code) => ({ code, level: 0, xp: 0, from: 0, next: 100, percent: 0, max: false }))
  if (!none) {
    Object.assign(lines[0], { level: 3, xp: 340, from: 300, next: 500, percent: 20 })
    Object.assign(lines[1], { level: 2, xp: 309, from: 300, next: 600, percent: 3 })
    Object.assign(lines[3], { level: 5, xp: 1500, next: 0, percent: 100, max: true })
  }
  return mockOk('skills', { lines } as SkillsView, [back('player.profile.get'), refreshA('skills.list')])
}

// -- the commands --------------------------------------------------------------------------------------------------------------

export function mockWorkCommand(command: string, a: Args): unknown | null {
  const args = (a ?? {}) as Record<string, unknown>
  const page = Number(args.page ?? 1) || 1
  switch (command) {
    case 'job.status': return status()
    case 'job.list': return openings(page)
    case 'job.view': return detail(String(args.role ?? 'retail'))
    case 'job.apply': return held ? workRefusal('already_employed') : LOCKED.has(String(args.role)) ? workRefusal('job_requirements') : hired(String(args.role ?? 'retail'))
    case 'job.work':
      if (!held) return workRefusal('not_employed')
      return shiftLeft() > 0 ? workRefusal('shift_in_progress') : shiftStarted()
    case 'job.promote': return held ? promoted() : workRefusal('not_employed')
    case 'job.quit': return args.confirm ? quitDone() : quitConfirm()
    case 'education.list': return education(page, 'class')
    case 'education.view': return courseDetail(String(args.course ?? 'first_aid'))
    case 'education.enroll': {
      const course = String(args.course ?? '')
      if (course === 'culinary_arts') return workRefusal('course_requirements')
      if (course === 'nursing') return workRefusal('cannot_afford')
      if (!COURSES[course]) return workRefusal('course_not_found')
      return enrolled(course, String(args.method ?? ''))
    }
    case 'skills.list': return skills()

    // states for screenshots: ?mock=1&open=mock.<name>
    case 'mock.job_status_none': return status({ employed: false })
    case 'mock.job_status_shift': return status({ employed: true, shift: true })
    case 'mock.job_status_promo': return status({ employed: true, promo: true })
    case 'mock.job_status_walk': return status({ employed: true, walk: true })
    case 'mock.job_status_away': return status({ employed: true, away: true })
    case 'mock.job_status_top': return status({ employed: true, top: true })
    case 'mock.openings': return openings(1, { employed: false })
    case 'mock.openings_p2': return openings(2, { employed: false })
    case 'mock.openings_employed': return openings(1, { employed: true })
    case 'mock.openings_travelling': return openings(1, { travelling: true })
    case 'mock.openings_empty': return openings(1, { empty: true, employed: false })
    case 'mock.job_detail': return detail('hospitality', false)
    case 'mock.job_detail_locked': return detail('technology', false)
    case 'mock.job_detail_employed': return detail('workshop', true)
    case 'mock.job_hired': return hired('hospitality')
    case 'mock.shift_started': return shiftStarted()
    case 'mock.shift_started_tired': return shiftStarted(true)
    case 'mock.shift_worked': return shiftWorked()
    case 'mock.shift_worked_level': return shiftWorked({ level: true })
    case 'mock.shift_worked_tired': return shiftWorked({ tired: true })
    case 'mock.shift_worked_injury': return shiftWorked({ injury: true })
    case 'mock.job_promoted': return promoted()
    case 'mock.job_quit_confirm': return quitConfirm()
    case 'mock.job_quit': return quitDone()
    case 'mock.education': return education(1, 'class')
    case 'mock.education_current': return education(1, 'current')
    case 'mock.education_empty': return education(1, 'empty')
    case 'mock.education_no_class': return education(1, 'no_class')
    case 'mock.education_city': return education(1, 'city')
    case 'mock.education_city_p2': return education(2, 'city')
    case 'mock.course_payable': return courseDetail('driving_licence')
    case 'mock.course_cash_only': return courseDetail('bookkeeping')
    case 'mock.course_poor': return courseDetail('nursing')
    case 'mock.course_elsewhere': return courseDetail('first_aid')
    case 'mock.course_locked': return courseDetail('culinary_arts')
    case 'mock.course_free': return courseDetail('reading_writing')
    case 'mock.enrolled': return enrolled('driving_licence', 'card')
    case 'mock.enrolled_free': return enrolled('reading_writing', '')
    case 'mock.course_completed': return completed()
    case 'mock.skills': return skills()
    case 'mock.skills_none': return skills(true)
    default:
      if (command.startsWith('mock.work_refusal_')) {
        const kind = command.slice('mock.work_refusal_'.length)
        return kind in REFUSAL_NEXT ? workRefusal(kind) : null
      }
      return null
  }
}
