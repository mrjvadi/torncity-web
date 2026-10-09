// Dev-only mock answers (?mock=1) for the activities area, crime, jail and cases: the neutral contract of
// docs/adr/0039-presentation-split.md (a screen name, a view typed by the generated Go view, actions by meaning;
// never a text, a label or a row). Answers every screen of the area, including its refusals and results.
// Every state also opens by name: `?mock=1&open=mock.crime_result_caught`.

import type { CrimeDetailView, CrimeHubView, CrimeRefusalView, CrimeRequirement, CrimeResultView, JailView, Named, PaymentChoice } from './views.gen'
import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import type { ContentTables } from './mock_act_content'

type Args = Record<string, unknown> | undefined

const N = (code: string, name: string): Named => ({ code, name })
const iso = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString()
const e = (code: string, en: string, fa: string) => ({ code, name: { en, fa } })

/** The catalogue names these screens mention, in both languages. */
export const CRIME_CONTENT: ContentTables = {
  crime: [
    e('pickpocketing', 'Pickpocketing', 'جیب‌بری'), e('shoplifting', 'Shoplifting', 'دزدی از مغازه'), e('bag_snatching', 'Bag snatching', 'کیف‌قاپی'),
    e('mugging', 'Mugging', 'زورگیری'), e('house_burglary', 'House burglary', 'دزدی از خانه'), e('phone_scam', 'Phone scam', 'کلاهبرداری تلفنی'),
    e('contraband_run', 'Contraband run', 'قاچاق بار'),
  ],
  crime_category: [
    e('petty_theft', 'Petty theft', 'دزدی خُرد'), e('street_crime', 'Street crime', 'جرم خیابانی'), e('burglary', 'Burglary', 'سرقت از اماکن'),
    e('fraud', 'Fraud', 'کلاه‌برداری'), e('smuggling', 'Smuggling', 'قاچاق'),
  ],
  crime_tier: [e('novice', 'Novice', 'تازه‌کار'), e('hustler', 'Hustler', 'کارکشته'), e('professional', 'Professional', 'حرفه‌ای')],
  venue: [e('bazaar', 'Bazaar', 'بازارچه'), e('old_town', 'Old Town', 'مرکز شهر'), e('harbour', 'Harbour', 'بندر'), e('market_square', 'Market square', 'میدان بازارچه')],
  city: [e('calderis', 'Calderis', 'کالدریس'), e('support', 'Central City', 'شهر مرکزی')],
  item: [
    e('lockpick_set', 'Lockpick set', 'ست قفل‌باز'), e('gloves', 'Gloves', 'دستکش'), e('bread', 'Bread', 'نان'), e('phone', 'Phone', 'تلفن'),
    e('wallet', 'Wallet', 'کیف پول'), e('watch', 'Watch', 'ساعت'),
  ],
  skill: [e('stealth', 'Stealth', 'پنهان‌کاری'), e('persuasion', 'Persuasion', 'اقناع'), e('driving', 'Driving', 'رانندگی')],
  course: [e('street_smarts', 'Street smarts', 'کوچه‌شناسی'), e('basic_driving', 'Basic driving', 'رانندگی پایه')],
  facility: [e('warehouse', 'Warehouse', 'انبار'), e('police_post', 'Police post', 'پاسگاه')],
}

// -- the world of the mock: a thief who can be jailed and bailed, so the screens are reached the way a player would --

const world = { jailedUntil: 0, busyUntil: 0, attempt: 0 }
const NERVE = { nerve: 14, max: 20, full_in_seconds: 1800 }
const HEAT = { heat: 34, max: 100, wanted: 2, stars: 2 }
const TIER = { tier: N('hustler', 'Hustler'), xp: 420, next: N('professional', 'Professional'), next_xp: 1000 }
const VENUE = N('bazaar', 'Bazaar')

const jailLeft = () => Math.max(0, Math.round((world.jailedUntil - Date.now()) / 1000))
const busyLeft = () => Math.max(0, Math.round((world.busyUntil - Date.now()) / 1000))

const CATEGORIES = [N('petty_theft', 'Petty theft'), N('street_crime', 'Street crime'), N('burglary', 'Burglary'), N('fraud', 'Fraud'), N('smuggling', 'Smuggling')]

// -- crime hub and list ----------------------------------------------------------------------------------------------------

function hubView(over: Partial<CrimeHubView> = {}): CrimeHubView {
  return {
    city_code: 'calderis', city: 'Calderis', venue: VENUE, nerve: NERVE, heat: HEAT, tier: TIER, travelling: false, jail: null, busy: null,
    categories: CATEGORIES, empty: '', min_level: 0, need_code: '', need_role: '', need_tier: 0, ...over,
  }
}

function hub(state = '') {
  let over: Partial<CrimeHubView> = {}
  const jl = jailLeft(), bl = busyLeft()
  if (state === 'level_too_low') over = { empty: 'level_too_low', min_level: 5, categories: null, tier: { ...TIER, xp: 0, tier: N('novice', 'Novice') } }
  else if (state === 'no_venue') over = { empty: 'no_venue', need_code: 'market_stall', need_role: 'market', need_tier: 1, venue: N('', ''), categories: null }
  else if (state === 'no_targets') over = { empty: 'no_targets', categories: null }
  else if (state === 'jail' || (state === '' && jl > 0)) over = { jail: { crime: N('pickpocketing', 'Pickpocketing'), remaining_seconds: jl || 780, ends_at: iso(13) } }
  else if (state === 'busy' || (state === '' && bl > 0)) over = { busy: { crime: N('contraband_run', 'Contraband run'), remaining_seconds: bl || 600, ends_at: iso(10) } }
  else if (state === 'travelling') over = { travelling: true }
  const acts: MockAct[] = []
  for (const c of over.categories === undefined ? CATEGORIES : over.categories ?? []) acts.push(A('crime.category', 'crime.list', { category: c.code }, { subject: c.code }))
  acts.push(A('crime.record', 'crime.record'), A('crime.cases', 'crime.cases'))
  if (over.jail) acts.push(A('crime.jail', 'crime.jail'))
  acts.push(back('player.profile.get'), refreshA('crime.hub'))
  return mockOk('crime_hub', hubView(over), acts)
}

const LISTS: Record<string, { code: string; name: string; nerve: number; seconds: number; eligible: boolean }[]> = {
  petty_theft: [
    { code: 'pickpocketing', name: 'Pickpocketing', nerve: 3, seconds: 0, eligible: true },
    { code: 'shoplifting', name: 'Shoplifting', nerve: 4, seconds: 0, eligible: false },
    { code: 'bag_snatching', name: 'Bag snatching', nerve: 5, seconds: 0, eligible: true },
  ],
  street_crime: [{ code: 'mugging', name: 'Mugging', nerve: 8, seconds: 0, eligible: true }],
  burglary: [{ code: 'house_burglary', name: 'House burglary', nerve: 10, seconds: 900, eligible: true }],
  fraud: [{ code: 'phone_scam', name: 'Phone scam', nerve: 6, seconds: 0, eligible: false }],
  smuggling: [{ code: 'contraband_run', name: 'Contraband run', nerve: 12, seconds: 1800, eligible: false }],
}
const CATEGORY_OF: Record<string, string> = Object.fromEntries(Object.entries(LISTS).flatMap(([c, l]) => l.map((x) => [x.code, c])))
const PAGE = 2

function list(category: string, page: number) {
  const all = LISTS[category] ?? []
  const pages = Math.max(1, Math.ceil(all.length / PAGE))
  const p = Math.min(Math.max(1, page), pages)
  const rows = all.slice((p - 1) * PAGE, p * PAGE)
  const acts: MockAct[] = rows.map((c) => A('crime.view', 'crime.view', { crime: c.code }, { subject: c.code }))
  if (p > 1) acts.push(A('page.prev', 'crime.list', { category, page: String(p - 1) }))
  if (p < pages) acts.push(A('page.next', 'crime.list', { category, page: String(p + 1) }))
  acts.push(back('crime.hub'), refreshA('crime.list', { category, page: String(p) }))
  const cat = CATEGORIES.find((c) => c.code === category) ?? N(category, category)
  return mockOk('crime_list', {
    category: cat, page: p, pages,
    crimes: rows.map((c) => ({ crime: N(c.code, c.name), nerve: c.nerve, duration_seconds: c.seconds, eligible: c.eligible })),
  }, acts)
}

// -- one crime in detail ---------------------------------------------------------------------------------------------------

const req = (r: Partial<CrimeRequirement> & { kind: string }): CrimeRequirement => ({
  met: true, skill: '', need: 0, have: 0, course_code: '', course_name: '', city_code: '', city: '', wait_seconds: 0, trip: null, until: null,
  tier: N('', ''), have_tier: N('', ''), venues: null, here: N('', ''), facility: '', tool: N('', ''), ...r,
})

const MEETS: CrimeRequirement[] = [
  req({ kind: 'crime_tier', tier: N('novice', 'Novice'), have_tier: N('hustler', 'Hustler') }),
  req({ kind: 'venue', venues: [N('bazaar', 'Bazaar'), N('old_town', 'Old Town')], here: N('bazaar', 'Bazaar') }),
  req({ kind: 'skill', skill: 'stealth', need: 2, have: 3 }),
]
const MISSING: CrimeRequirement[] = [
  req({ kind: 'crime_tier', tier: N('professional', 'Professional'), have_tier: N('hustler', 'Hustler'), met: false }),
  req({ kind: 'venue', venues: [N('harbour', 'Harbour')], here: N('bazaar', 'Bazaar'), met: false }),
  req({ kind: 'skill', skill: 'persuasion', need: 5, have: 2, met: false }),
  req({ kind: 'certificate', course_code: 'street_smarts', course_name: 'Street smarts', met: false }),
  req({ kind: 'tool', tool: N('lockpick_set', 'Lockpick set'), met: false }),
  req({ kind: 'facility', facility: 'warehouse', met: false }),
  req({ kind: 'level', need: 5, have: 3, met: false }),
]

function detailView(code: string, over: Partial<CrimeDetailView> = {}): CrimeDetailView {
  const line = (LISTS[CATEGORY_OF[code] ?? 'petty_theft'] ?? []).find((c) => c.code === code)
  const cat = CATEGORIES.find((c) => c.code === (CATEGORY_OF[code] ?? 'petty_theft')) ?? CATEGORIES[0]
  return {
    crime: N(code, line?.name ?? code), category: cat, nerve: line?.nerve ?? 3, duration_seconds: line?.seconds ?? 0, chance_bps: 6200,
    hits_players: true, hits_np_cs: true, min_take: 800, max_take: 2400, jail_min_seconds: 600, jail_max_seconds: 1800, fine_min: 300, fine_max: 900,
    requirements: MEETS, blocked: '', need: 0, have: 0, wait_seconds: 0, can_commit: true, nonce: 'a1b2c3d4e5f6',
    odds: { base: 5000, skill: 1400, awareness: -600, heat: -400, gear: 800 },
    gear_catch_bps: -500, gear_witness_bps: -300, gear_solve_bps: 0, gear_reward_bps: 1000, cooldown_seconds: 120, cooldown_left_seconds: 0, ...over,
  }
}

function detail(code: string, state = '') {
  const cat = CATEGORY_OF[code] ?? 'petty_theft'
  let over: Partial<CrimeDetailView> = {}
  if (state === 'requirements' || code === 'shoplifting' || code === 'phone_scam' || code === 'contraband_run') {
    over = { requirements: MISSING, can_commit: false, chance_bps: 2400, odds: { base: 3000, skill: -200, awareness: -300, heat: -100, gear: 0 }, gear_catch_bps: 0, gear_witness_bps: 0, gear_reward_bps: 0, hits_players: false }
  } else if (state === 'nerve' || code === 'mugging') over = { blocked: 'nerve', need: 8, have: 5, can_commit: false }
  else if (state === 'cooldown') over = { blocked: 'cooldown', wait_seconds: 540, cooldown_left_seconds: 540, can_commit: false }
  else if (state === 'jail') over = { blocked: 'jail', can_commit: false }
  else if (state === 'hospital') over = { blocked: 'hospital', can_commit: false }
  else if (state === 'busy') over = { blocked: 'busy', can_commit: false }
  else if (state === 'work') over = { blocked: 'work', can_commit: false }
  else if (state === 'travelling') over = { blocked: 'travelling', can_commit: false }
  else if (state === 'walking') over = { blocked: 'walking', can_commit: false }
  else if (state === 'nowhere') over = { blocked: 'nowhere', can_commit: false }
  if (code === 'contraband_run' || code === 'house_burglary') over = { ...over, duration_seconds: code === 'house_burglary' ? 900 : 1800 }
  const v = detailView(code, over)
  const acts: MockAct[] = []
  if (v.can_commit) acts.push(A('crime.commit', 'crime.commit', { crime: code, nonce: v.nonce }, { subject: code }))
  acts.push(back('crime.list', { category: cat }), refreshA('crime.view', { crime: code }))
  return mockOk('crime_detail', v, acts)
}

// -- results ---------------------------------------------------------------------------------------------------------------

function result(outcome: 'succeeded' | 'escaped' | 'caught', o: { injury?: boolean; extra?: boolean } = {}) {
  const base: CrimeResultView = {
    player: 'رضا', crime: N('pickpocketing', 'Pickpocketing'), venue: VENUE, city_code: 'calderis', city: 'Calderis', result: outcome, victim_player: false,
    take: 0, dry_spell: false, xp: 0, criminal_xp: 0, skills: null, level: 0, heat: HEAT, nerve: { ...NERVE, nerve: 11 }, jail: null, fine: 0, fine_paid: 0,
    notice: false, loot: null, stolen: null, confiscated: null, injury: null,
  }
  let v: CrimeResultView = base
  if (outcome === 'succeeded') {
    v = { ...base, take: 1650, xp: 12, criminal_xp: 30, skills: [{ skill: 'stealth', xp: 8, level: 0 }], loot: [{ item: N('wallet', 'Wallet'), qty: 1 }] }
    if (o.extra) v = { ...v, level: 4, skills: [{ skill: 'stealth', xp: 8, level: 4 }, { skill: 'persuasion', xp: 3, level: 0 }], victim_player: true, stolen: N('watch', 'Watch'), loot: [{ item: N('wallet', 'Wallet'), qty: 2 }, { item: N('phone', 'Phone'), qty: 1 }] }
  } else if (outcome === 'escaped') {
    v = { ...base, xp: 3, criminal_xp: 6, dry_spell: !!o.extra, heat: { ...HEAT, heat: 41 } }
  } else {
    v = {
      ...base, xp: 2, criminal_xp: 4, jail: { crime: N('pickpocketing', 'Pickpocketing'), remaining_seconds: 780, ends_at: iso(13) }, fine: 600, fine_paid: 600,
      confiscated: [N('lockpick_set', 'Lockpick set'), N('gloves', 'Gloves')], heat: { ...HEAT, heat: 58, wanted: 3, stars: 3 },
    }
  }
  if (o.injury) v = { ...v, injury: { damage: 18, health: 54, max: 100, hospital: true, ends_at: iso(25) } }
  if (outcome === 'caught') world.jailedUntil = Date.now() + 780000
  const acts: MockAct[] = []
  if (v.injury?.hospital) acts.push(A('health.hospital', 'health.hospital'))
  if (outcome === 'caught') acts.push(A('crime.jail', 'crime.jail'))
  else acts.push(A('crime.again', 'crime.view', { crime: 'pickpocketing' }, { subject: 'pickpocketing' }))
  acts.push(A('crime.hub', 'crime.hub'), back('player.profile.get'))
  return mockOk('crime_result', v, acts)
}

function started() {
  world.busyUntil = Date.now() + 1800000
  return mockOk('crime_started', {
    player: 'رضا', crime: N('contraband_run', 'Contraband run'), venue: N('harbour', 'Harbour'), duration_seconds: 1800, ends_at: iso(30), nerve: { ...NERVE, nerve: 2 },
  }, [A('crime.hub', 'crime.hub'), back('player.profile.get')])
}

function record(empty = false) {
  const lines = [['pickpocketing', 'succeeded', 20], ['bag_snatching', 'caught', 180], ['pickpocketing', 'escaped', 400], ['mugging', 'succeeded', 1600]] as const
  return mockOk('crime_record', {
    nerve: NERVE, heat: HEAT, tier: TIER, attempts: empty ? 0 : 27, successes: empty ? 0 : 15, arrests: empty ? 0 : 4, convictions: empty ? 0 : 2,
    unpaid_restitution: empty ? 0 : 400, unpaid_fines: empty ? 0 : 150,
    recent: empty ? null : lines.map(([c, r, m]) => ({ crime: N(c, c), result: r, at: iso(-m) })),
  }, [A('crime.hub', 'crime.hub'), back('crime.hub'), refreshA('crime.record')])
}

// -- jail and bail ---------------------------------------------------------------------------------------------------------

const payment = (afford: boolean): PaymentChoice => ({ amount: 1200, accepted: ['cash', 'card'], usable: afford ? ['cash', 'card'] : [], cash: afford ? 12450 : 300, bank: afford ? 86300 : 100 })

function jail(state = '') {
  const free = state === 'free' || (state === '' && jailLeft() === 0)
  if (free) return mockOk('jail', { in_jail: false, city_code: '', city: '', reason: '', remaining_seconds: 0, ends_at: null, bail: 0, nonce: '', payment: null }, [A('crime.hub', 'crime.hub'), back('crime.hub'), refreshA('crime.jail')])
  const afford = state !== 'poor'
  const v: JailView = {
    in_jail: true, city_code: 'calderis', city: 'Calderis', reason: state === 'conviction' ? 'conviction' : 'arrest', remaining_seconds: jailLeft() || 780, ends_at: iso(13),
    bail: 1200, nonce: 'b7c8d9e0f1a2', payment: payment(afford),
  }
  const acts: MockAct[] = afford ? (['cash', 'card'] as const).map((m) => A(`pay.${m}`, 'crime.bail', { nonce: v.nonce, method: m })) : []
  acts.push(back('crime.hub'), refreshA('crime.jail'))
  return mockOk('jail', v, acts)
}

function bailed(method: string) {
  world.jailedUntil = 0
  return mockOk('bailed', { player: 'رضا', bail: 1200, method }, [A('crime.hub', 'crime.hub'), back('player.profile.get')])
}

// -- the victim's reports ----------------------------------------------------------------------------------------------------

function reportConfirm(state = '') {
  const free = state === 'free'
  const poor = state === 'poor'
  const pay: PaymentChoice | null = free ? null : { amount: 100, accepted: ['cash', 'card'], usable: poor ? [] : ['cash', 'card'], cash: poor ? 40 : 12450, bank: poor ? 10 : 86300 }
  const acts: MockAct[] = free
    ? [A('crime.report_confirm', 'crime.report', { crime: 'c1', confirm: 'yes' }, { kind: 'confirm' })]
    : poor ? [A('bank', 'bank.show')] : (['cash', 'card'] as const).map((m) => A(`pay.${m}`, 'crime.report', { crime: 'c1', confirm: m }))
  acts.push(back('crime.cases'))
  return mockOk('report_confirm', {
    crime_id: 'c1', crime: N('pickpocketing', 'Pickpocketing'), city_code: 'calderis', city: 'Calderis', amount: 1500, fee: free ? 0 : 100,
    investigation_seconds: 7200, report_within_seconds: 3600 * 20, payment: pay,
  }, acts)
}

function caseFiled() {
  return mockOk('case_filed', { investigation_seconds: 7200, ends_at: iso(120) }, [A('crime.cases', 'crime.cases'), back('player.profile.get')])
}

function cases(empty = false) {
  return mockOk('cases', {
    cases: empty ? null : [
      { crime: N('pickpocketing', 'Pickpocketing'), city_code: 'calderis', city: 'Calderis', amount: 1500, status: 'investigating', remaining_seconds: 5400, thief: '', restored: 0 },
      { crime: N('bag_snatching', 'Bag snatching'), city_code: 'calderis', city: 'Calderis', amount: 2200, status: 'solved', remaining_seconds: 0, thief: 'رضا', restored: 1700 },
      { crime: N('mugging', 'Mugging'), city_code: 'support', city: 'Central City', amount: 900, status: 'unsolved', remaining_seconds: 0, thief: '', restored: 0 },
    ],
  }, [back('crime.hub'), refreshA('crime.cases')])
}

// -- refusals --------------------------------------------------------------------------------------------------------------

const NEXT: Record<string, [string, string]> = {
  requirements: ['crime.hub', 'crime.hub'], not_found: ['crime.hub', 'crime.hub'], jail: ['crime.jail', 'crime.jail'], hospital: ['health.hospital', 'health.hospital'],
  busy: ['crime.hub', 'crime.hub'], work: ['job.mine', 'job.status'], travelling: ['map', 'map.list'], walking: ['map', 'map.list'], nowhere: ['map', 'map.list'],
  nerve: ['crime.hub', 'crime.hub'], no_victim: ['crime.hub', 'crime.hub'], not_yours: ['crime.cases', 'crime.cases'], expired: ['crime.cases', 'crime.cases'],
  cannot_afford: ['bank', 'bank.show'], not_jailed: ['crime.hub', 'crime.hub'], nothing_stolen: ['crime.cases', 'crime.cases'], cooldown: ['crime.hub', 'crime.hub'],
}

function refusal(kind: string) {
  const none = kind === 'not_found' || kind === 'not_yours' || kind === 'expired' || kind === 'no_victim' || kind === 'not_jailed' || kind === 'nothing_stolen'
  const v: CrimeRefusalView = {
    kind, crime: none ? N('', '') : N('shoplifting', 'Shoplifting'),
    missing: kind === 'requirements' ? MISSING.slice(0, 5) : null,
    need: kind === 'nerve' ? 8 : 0, have: kind === 'nerve' ? 5 : 0, wait_seconds: kind === 'cooldown' ? 540 : kind === 'nerve' ? 1500 : 0,
    amount: kind === 'cannot_afford' ? 1200 : 0, cash: kind === 'cannot_afford' ? 300 : 0, remaining_seconds: kind === 'jail' ? 780 : kind === 'busy' ? 600 : 0,
  }
  const [id, command] = NEXT[kind] ?? NEXT.requirements
  return {
    ok: false, request_id: 'mock', screen: 'crime_refusal', view: v,
    error: { code: `crime_${kind}`, args: { need: v.need, have: v.have, wait_seconds: v.wait_seconds, amount: v.amount, cash: v.cash, remaining_seconds: v.remaining_seconds } },
    actions: [A(id, command), back('crime.hub')],
  }
}

export function mockCrimeCommand(command: string, a: Args): unknown | null {
  const args = (a ?? {}) as Record<string, unknown>
  const crime = String(args.crime ?? 'pickpocketing')
  switch (command) {
    case 'crime.hub': return hub()
    case 'crime.list': return list(String(args.category ?? 'petty_theft'), Number(args.page ?? 1) || 1)
    case 'crime.view': return detail(crime)
    case 'crime.commit': {
      if (jailLeft() > 0) return refusal('jail')
      if (crime === 'contraband_run') return started()
      const outcome = (['succeeded', 'escaped', 'caught'] as const)[world.attempt++ % 3]
      return result(outcome)
    }
    case 'crime.record': return record()
    case 'crime.jail': return jail()
    case 'crime.bail': return args.method === 'card' || args.method === 'cash' ? bailed(String(args.method)) : refusal('not_jailed')
    case 'crime.report': return args.confirm ? caseFiled() : reportConfirm()
    case 'crime.cases': return cases()

    // every state by name, for a screenshot
    case 'mock.crime_hub': return hub('normal')
    case 'mock.crime_hub_level_low': return hub('level_too_low')
    case 'mock.crime_hub_no_venue': return hub('no_venue')
    case 'mock.crime_hub_no_targets': return hub('no_targets')
    case 'mock.crime_hub_jail': return hub('jail')
    case 'mock.crime_hub_busy': return hub('busy')
    case 'mock.crime_hub_travelling': return hub('travelling')
    case 'mock.crime_list': return list('petty_theft', 1)
    case 'mock.crime_list_page2': return list('petty_theft', 2)
    case 'mock.crime_detail': return detail('pickpocketing')
    case 'mock.crime_detail_timed': return detail('house_burglary')
    case 'mock.crime_detail_requirements': return detail('shoplifting')
    case 'mock.crime_detail_nerve': return detail('mugging')
    case 'mock.crime_detail_cooldown': return detail('bag_snatching', 'cooldown')
    case 'mock.crime_detail_jail': return detail('bag_snatching', 'jail')
    case 'mock.crime_detail_hospital': return detail('bag_snatching', 'hospital')
    case 'mock.crime_detail_busy': return detail('bag_snatching', 'busy')
    case 'mock.crime_detail_work': return detail('bag_snatching', 'work')
    case 'mock.crime_detail_travelling': return detail('bag_snatching', 'travelling')
    case 'mock.crime_detail_walking': return detail('bag_snatching', 'walking')
    case 'mock.crime_detail_nowhere': return detail('bag_snatching', 'nowhere')
    case 'mock.crime_result_succeeded': return result('succeeded')
    case 'mock.crime_result_succeeded_big': return result('succeeded', { extra: true })
    case 'mock.crime_result_escaped': return result('escaped')
    case 'mock.crime_result_escaped_dry': return result('escaped', { extra: true })
    case 'mock.crime_result_escaped_injury': return result('escaped', { injury: true })
    case 'mock.crime_result_caught': return result('caught')
    case 'mock.crime_result_caught_injury': return result('caught', { injury: true })
    case 'mock.crime_started': return started()
    case 'mock.crime_record': return record()
    case 'mock.crime_record_empty': return record(true)
    case 'mock.jail': return jail('arrest')
    case 'mock.jail_conviction': return jail('conviction')
    case 'mock.jail_poor': return jail('poor')
    case 'mock.jail_free': return jail('free')
    case 'mock.bailed': return bailed('cash')
    case 'mock.bailed_card': return bailed('card')
    case 'mock.report_confirm': return reportConfirm()
    case 'mock.report_confirm_free': return reportConfirm('free')
    case 'mock.report_confirm_poor': return reportConfirm('poor')
    case 'mock.case_filed': return caseFiled()
    case 'mock.cases': return cases()
    case 'mock.cases_empty': return cases(true)
    default:
      if (command.startsWith('mock.crime_refusal_')) return refusal(command.slice('mock.crime_refusal_'.length))
      return null
  }
}
