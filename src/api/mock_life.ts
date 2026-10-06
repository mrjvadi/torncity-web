// Dev-only mock answers (?mock=1) for the life area: the neutral contract of docs/adr/0039-presentation-split.md
// (a screen name, a view typed by the generated Go view, actions by meaning; never a text, a label or a row).
// Names in the views are the authored English ones the real server sends; the web must word them from the
// catalogue (LIFE_CONTENT is the mock's copy of GET /api/v1/content for what this area names).

import type { ScreenViews } from './views.gen'
import { A, back, confirmA, mockOk, refreshA, type MockAct } from './mock_neutral'
import { mockStandsIn } from '../support/mock'
import { MOCK_WORLD, mockVillagePlace } from './mock_village_world'
import { offsetLatLon } from '../village/geo'

type Args = Record<string, unknown> | undefined

const N = (code: string, name: string) => ({ code, name })
const iso = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString()

/** The catalogue tables this area's screens name things from, in both languages. */
export const LIFE_CONTENT: Record<string, { code: string; name: { en: string; fa: string } }[]> = {
  city: [{ code: 'calderis', name: { en: 'Calderis', fa: 'کالدریس' } }, { code: 'support', name: { en: 'Central City', fa: 'شهر مرکزی' } }],
  place: [
    { code: 'old_town', name: { en: 'Old Town', fa: 'مرکز شهر' } }, { code: 'harbour', name: { en: 'Harbour', fa: 'بندر' } },
    { code: 'business_district', name: { en: 'Business District', fa: 'محله‌ی کسب‌وکار' } }, { code: 'bazaar', name: { en: 'Bazaar', fa: 'بازار' } },
    { code: 'university', name: { en: 'University', fa: 'دانشگاه' } }, { code: 'registry', name: { en: 'Land Registry', fa: 'ثبت اسناد' } },
    { code: 'hostel_row', name: { en: 'Hostel Row', fa: 'خیابان مسافرخانه‌ها' } }, { code: 'station', name: { en: 'Station', fa: 'ایستگاه' } },
  ],
  mode: [{ code: 'bus', name: { en: 'Bus', fa: 'اتوبوس' } }, { code: 'train', name: { en: 'Train', fa: 'قطار' } }, { code: 'flight', name: { en: 'Flight', fa: 'پرواز' } }, { code: 'bicycle', name: { en: 'Bicycle', fa: 'دوچرخه' } }],
  item: [
    { code: 'bread', name: { en: 'Bread', fa: 'نان' } }, { code: 'bandage', name: { en: 'Bandage', fa: 'باند' } }, { code: 'phone', name: { en: 'Phone', fa: 'تلفن' } },
    { code: 'lockpick_set', name: { en: 'Lockpick set', fa: 'ست قفل‌باز' } }, { code: 'bicycle', name: { en: 'Bicycle', fa: 'دوچرخه' } },
  ],
  life_rank: [
    { code: 'newcomer', name: { en: 'Newcomer', fa: 'تازه‌وارد' } }, { code: 'breadwinner', name: { en: 'Breadwinner', fa: 'نان‌آور' } },
    { code: 'trader', name: { en: 'Trader', fa: 'بازرگان' } },
  ],
  life_stage: [{ code: 'youth', name: { en: 'Youth', fa: 'جوانی' } }, { code: 'adult', name: { en: 'Adult', fa: 'بزرگسالی' } }],
  sleep_spot: [{ code: 'bench', name: { en: 'Park bench', fa: 'نیمکت پارک' } }, { code: 'hostel', name: { en: 'Hostel bed', fa: 'تخت مسافرخانه' } }],
  property_type: [
    { code: 'small_house', name: { en: 'Small house', fa: 'خانهٔ کوچک' } }, { code: 'apartment_unit', name: { en: 'Apartment', fa: 'آپارتمان' } },
    { code: 'corner_shop', name: { en: 'Corner shop', fa: 'مغازهٔ سر نبش' } },
  ],
  achievement: [
    { code: 'first_journey', name: { en: 'First journey', fa: 'نخستین سفر' } }, { code: 'first_shift', name: { en: 'First shift', fa: 'نخستین شیفت' } },
    { code: 'homeowner', name: { en: 'Homeowner', fa: 'صاحب‌خانه' } }, { code: 'graduate', name: { en: 'Graduate', fa: 'دانش‌آموخته' } },
  ],
  avatar: [{ code: 'fox', name: { en: 'Fox', fa: 'روباه' } }, { code: 'wolf', name: { en: 'Wolf', fa: 'گرگ' } }, { code: 'owl', name: { en: 'Owl', fa: 'جغد' } }],
  career_tier: [{ code: 'retail.senior', name: { en: 'Senior seller', fa: 'فروشندهٔ ارشد' } }],
  course: [{ code: 'mgmt101', name: { en: 'Basic management', fa: 'مدیریت پایه' } }],
  shop: [{ code: 'bakery', name: { en: 'Bakery', fa: 'نانوایی' } }],
  crime_category: [{ code: 'theft', name: { en: 'Theft', fa: 'دزدی' } }],
}

const RANK = { code: 'breadwinner', name: 'Breadwinner', emoji: '🏅' }
const NEEDS = { hunger: 34, sleep: 52, stress: 22, happiness: 71, body_bps: 10000, xpbps: 10000, pressing: null }

function hubActions(): MockAct[] {
  return [
    A('profile.map', 'map.list'), A('job.mine', 'job.status'), A('crime.hub', 'crime.hub'), A('education', 'education.list'), A('bank', 'bank.show'),
    A('property.mine', 'property.mine'), A('shops', 'shop.list'), A('city.gov', 'gov.city'), A('companies', 'company.list'), A('faction.mine', 'faction.mine'),
    A('missions', 'mission.mine'), A('social', 'social.friend.list'), A('skills', 'skills.list'), A('life', 'life.me'), A('achievements', 'achievement.list'),
    A('life.top', 'life.top'), A('settings', 'player.settings'), refreshA('player.profile.get'),
  ]
}

export function mockProfile() {
  return mockOk('profile', {
    name: 'سارا', code: 'K7Q2M9A', city_code: 'calderis', city: 'Calderis', place: N('old_town', 'Old Town'), walk: null, level: 7, xp: 5400, next_level_xp: 6500,
    energy: 72, max_energy: 100, energy_full_in_seconds: 720, health: 88, max_health: 100, cash: 12450, bank: 86300, travelling: false, travel_to_code: '', travel_to: '',
    travel_remaining_seconds: 0, travel_zone_minutes: 0, work: {
      job: { job: { career_code: 'retail', career_name: 'Retail', rank: 'senior', title: 'Senior seller' }, city_code: 'calderis', city: 'Calderis', pay: 1850, shift_ends_in_seconds: 0 },
      course: { course: N('mgmt101', 'Basic management'), remaining_seconds: 5400, paused: false }, certificates: 2,
    }, jail: null, hospital: null, achievements: 4, avatar: '🦊', rank: RANK, age: 27, stage: N('adult', 'Adult'), needs: NEEDS, village: null,
  }, hubActions())
}

function dashboard() {
  return mockOk('dashboard', {
    name: 'سارا', city_code: 'calderis', city: 'Calderis', place: N('old_town', 'Old Town'), walk: null, level: 7, energy: 72, max_energy: 100, travelling: false, cash: 12450, bank: 86300, jail: null,
  }, hubActions())
}

const PLACES: ScreenViews['city_map']['places'] = [
  { place: N('old_town', 'Old Town'), walk_seconds: 0, energy: 0, services: null, departures: null, shops: null, here: true },
  { place: N('business_district', 'Business District'), walk_seconds: 150, energy: 2, services: ['bank', 'city_hall'], departures: null, shops: null, here: false },
  { place: N('bazaar', 'Bazaar'), walk_seconds: 240, energy: 3, services: ['market'], departures: null, shops: [N('bakery', 'Bakery')], here: false },
  { place: N('university', 'University'), walk_seconds: 420, energy: 4, services: ['university'], departures: null, shops: null, here: false },
  { place: N('station', 'Station'), walk_seconds: 300, energy: 3, services: null, departures: ['bus', 'train'], shops: null, here: false },
]

function cityMap() {
  const acts: MockAct[] = [
    ...PLACES!.filter((p) => !p.here).map((p) => A('walk', 'place.go', { place: p.place.code }, { kind: 'primary', subject: p.place.code })),
    A('shops.at', 'place.go', { place: 'bazaar', then: 'shop.list', args: 'bazaar' }, { subject: 'bazaar' }),
    A('map.cities', 'map.cities'), A('city.gov', 'gov.city'), back('player.profile.get'), refreshA('map.list'),
  ]
  return mockOk('city_map', { city_code: 'calderis', city: 'Calderis', no_city: false, travelling: false, travelling_to_code: '', travelling_to: '', here: N('old_town', 'Old Town'), walking: null, others: 2, places: PLACES }, acts)
}

// the mock cities sit around the mock village at their stated distances (so the world map has places to show)
const placeAt = (km: number, bearingDeg: number) => {
  const c = mockVillagePlace(11).centre
  const b = (bearingDeg * Math.PI) / 180
  return offsetLatLon(c.lat, c.lon, Math.sin(b) * km * 1000, Math.cos(b) * km * 1000, MOCK_WORLD.planet_radius_km)
}

function cities(page: number) {
  const p1 = placeAt(42, 70), p2 = placeAt(118, 200), p3 = placeAt(460, 320)
  const dests = [
    { code: 'support', name: 'Support', distance_km: 42, emblem: '', village: false, settlement_id: '', lat: p1.lat, lon: p1.lon, fare: 6300, wait_seconds: 3600 },
    { code: 'v-q7m2', name: 'سرخه', distance_km: 118, emblem: '🌳', village: true, settlement_id: 'mock-village-2', lat: p2.lat, lon: p2.lon, fare: 9100, wait_seconds: 9000 },
    { code: 'v-z1p8', name: 'کوهدشت', distance_km: 460, emblem: '🌾', village: true, settlement_id: 'mock-village-3', lat: p3.lat, lon: p3.lon, fare: 24800, wait_seconds: 27600 },
  ]
  return mockOk('cities', { destinations: dests, page, pages: 2, origin_code: 'calderis', origin: 'Calderis', travelling: false, travelling_to_code: '', travelling_to: '' }, [
    ...dests.map((d) => A('travel.to', 'travel.options', { city: d.code }, { subject: d.code })),
    ...(page > 1 ? [A('page.prev', 'map.cities', { page: String(page - 1) })] : []), ...(page < 2 ? [A('page.next', 'map.cities', { page: String(page + 1) })] : []),
    back('map.list'), refreshA('map.cities', { page: String(page) }),
  ])
}

const MODES = [
  { mode_code: 'bus', mode_name: 'Bus', fare: 31785, wait_seconds: 27600, energy: 4, busy: false, vehicle: null, condition: 0 },
  { mode_code: 'train', mode_name: 'Train', fare: 9800, wait_seconds: 19800, energy: 3, busy: true, vehicle: null, condition: 0 },
  { mode_code: 'ship', mode_name: 'کشتی', fare: 21000, wait_seconds: 46800, energy: 3, busy: false, vehicle: null, condition: 0 },
  { mode_code: 'bicycle', mode_name: 'Bicycle', fare: 0, wait_seconds: 90000, energy: 12, busy: false, vehicle: N('bicycle', 'Bicycle'), condition: 8200 },
]

function travelOptions(to: string) {
  return mockOk('travel_options', { from_code: 'calderis', from: 'Calderis', to_code: to, to: to === 'support' ? 'Support' : to, options: MODES, cash: 12450, requoted: false }, [
    ...MODES.map((o) => A('travel.go', 'travel.start', { city: to, mode: o.mode_code, max: String(o.fare) }, { subject: o.mode_code })), back('map.list'), refreshA('travel.options', { city: to }),
  ])
}

function checkout(to: string, mode: string, afford: boolean) {
  const m = MODES.find((x) => x.mode_code === mode) ?? MODES[0]
  const payment = { amount: m.fare, accepted: ['cash', 'card'], usable: afford ? ['cash', 'card'] : [], cash: afford ? 12450 : 300, bank: afford ? 86300 : 100 }
  return mockOk('travel_checkout', { from_code: 'calderis', from: 'Calderis', to_code: to, to: to === 'support' ? 'Support' : to, mode_code: m.mode_code, mode_name: m.mode_name, fare: m.fare, wait_seconds: m.wait_seconds, energy: m.energy, busy: m.busy, payment }, [
    ...(afford ? [A('pay.cash', 'travel.start', { city: to, mode, max: String(m.fare), method: 'cash' }), A('pay.card', 'travel.start', { city: to, mode, max: String(m.fare), method: 'card' })] : [A('bank', 'bank.show')]),
    A('travel.options', 'travel.options', { city: to }), back('map.list'),
  ])
}

function started(to: string, mode: string) {
  const m = MODES.find((x) => x.mode_code === mode) ?? MODES[0]
  return mockOk('travel_started', { from_code: 'calderis', from: 'Calderis', to_code: to, to: to === 'support' ? 'Support' : to, mode_code: m.mode_code, mode_name: m.mode_name, duration_seconds: m.wait_seconds, arrives_at: iso(m.wait_seconds / 60), zone_minutes: 540, energy: m.energy, fare: m.fare }, [back('player.profile.get'), refreshA('travel.status')])
}

const mockStatus = () => mockOk('travel_status', { from_code: 'calderis', from: 'Calderis', to_code: 'support', to: 'Support', mode_code: 'train', mode_name: 'Train', remaining_seconds: 97200, arrives_at: iso(1620), zone_minutes: 540 }, [back('player.profile.get'), refreshA('travel.status')])

const arrived = () => mockOk('travel_arrived', { city_code: 'support', city: 'Support', xp: 12 }, [A('profile', 'player.profile.get'), A('profile.map', 'map.list')])
const travelHere = () => mockOk('travel_here', { reason: 'already_there', village: 'آمل', village_code: 'v-k3x9' }, [A('travel.elsewhere', 'map.cities')])
const walkStarted = () => mockOk('walk_started', { from: N('old_town', 'Old Town'), to: N('business_district', 'Business District'), duration_seconds: 150, arrives_at: iso(2.5), energy: 2, then: 'work' }, [A('profile.map', 'map.list'), back('player.profile.get')])

function notHere(walking: boolean) {
  return mockOk('not_here', {
    need: 'bank', need_args: null, mode: '', crime: N('', ''), shop: N('', ''), place: N('business_district', 'Business District'), here: N('old_town', 'Old Town'), walk_seconds: 150,
    walking, remaining_seconds: walking ? 90 : 0, arrives_at: walking ? iso(1.5) : null, then: walking ? '' : 'bank.show', then_args: null,
  }, walking ? [A('profile.map', 'map.list'), back('player.profile.get')] : [A('walk', 'place.go', { place: 'business_district', then: 'bank.show' }, { subject: 'business_district' }), back('player.profile.get')])
}

function life(notice: string) {
  return mockOk('life', {
    needs: NEEDS, age: 27, stage: N('adult', 'Adult'), intelligence: 62, intelligence_max: 100, course_bps: 300, skill_bps: 200, rank: RANK, next: { code: 'trader', name: 'Trader', emoji: '📦' }, next_need: 250000,
    worth: { cash: 12450, bank: 86300, escrow: 0, equity: 0, property: 120000, goods: 4300, debts: 0, savings: 0, gold: 0, loans: 0, total: 223050 },
    // a village has no hostel or park bench: sleeping is in the player's own house
    spots: mockStandsIn() === 'village' ? null : [
      { spot: N('bench', 'Park bench'), place: N('old_town', 'Old Town'), price: 0, rest: 30, relief: 5, way: null },
      { spot: N('hostel', 'Hostel bed'), place: N('hostel_row', 'Hostel Row'), price: 800, rest: 60, relief: 12, way: { place: N('hostel_row', 'Hostel Row'), walk_seconds: 180 } },
    ], village_home: mockStandsIn() === 'village' ? { building: N('cottage', 'Cottage'), can_rest: false, rest_in_seconds: 16440 } : null, sleep_in_seconds: 0, home: true, notice, notice_args: notice === 'slept' ? { spot: 'bench', rest: 30 } : null,
  }, [
    A('life.sleep', 'life.sleep', { spot: 'bench' }, { subject: 'bench' }), A('life.sleep_walk', 'place.go', { place: 'hostel_row', then: 'life.me' }, { subject: 'hostel' }),
    A('life.home_rest', 'property.rest'), A('life.history', 'life.history'), A('life.card', 'life.card'), A('life.top', 'life.top'), back('player.profile.get'), refreshA('life.me'),
  ])
}

function card(notice: string) {
  return mockOk('card', {
    name: 'سارا', code: 'K7Q2M9A', avatar: { code: 'fox', emoji: '🦊', photo: false }, bio: notice === 'bio_gone' ? '' : 'عاشق سفر و کتاب', rank: RANK, age: 27, stage: N('adult', 'Adult'), level: 7, achievements: 4, entries: 11,
    joined_at: new Date(Date.now() - 86400000 * 40).toISOString(), self: true, photo: null, notice,
  }, [A('life.history', 'life.history'), { ...A('life.bio', 'life.bio'), input: { field: 'text', text: true } } as MockAct, A('life.avatar', 'life.avatar'), A('life.bio_clear', 'life.bio', { clear: 'yes' }), back('life.me'), refreshA('life.card')])
}

function history(page: number) {
  const lines = [
    { kind: 'joined', at: iso(-60 * 24 * 40), code: '', name: '', sub: '', sub_name: '', place_kind: '', place: N('', ''), amount: 0, number: 0, backfilled: false, private: false },
    { kind: 'first_job', at: iso(-60 * 24 * 35), code: 'retail', name: 'Retail', sub: 'junior', sub_name: 'Junior seller', place_kind: 'city', place: N('calderis', 'Calderis'), amount: 0, number: 0, backfilled: false, private: false },
    { kind: 'promoted', at: iso(-60 * 24 * 12), code: 'retail', name: 'Retail', sub: 'senior', sub_name: 'Senior seller', place_kind: '', place: N('', ''), amount: 0, number: 0, backfilled: false, private: false },
    { kind: 'rank_up', at: iso(-60 * 24 * 6), code: 'breadwinner', name: 'Breadwinner', sub: 'newcomer', sub_name: '', place_kind: '', place: N('', ''), amount: 0, number: 0, backfilled: false, private: false },
    { kind: 'property_bought', at: iso(-60 * 24 * 3), code: 'small_house', name: 'Small house', sub: '', sub_name: '', place_kind: 'city', place: N('calderis', 'Calderis'), amount: 120000, number: 0, backfilled: false, private: true },
    { kind: 'achievement', at: iso(-60 * 24), code: 'first_journey', name: 'First journey', sub: '', sub_name: '', place_kind: '', place: N('', ''), amount: 0, number: 0, backfilled: true, private: false },
  ]
  return mockOk('history', { name: 'سارا', code: 'K7Q2M9A', self: true, lines, page, pages: 2, total: 11 }, [
    ...(page > 1 ? [A('page.prev', 'life.history', { code: '', page: String(page - 1) })] : []), ...(page < 2 ? [A('page.next', 'life.history', { code: '', page: String(page + 1) })] : []), back('life.me'), refreshA('life.history', { page: String(page) }),
  ])
}

const avatars = () => mockOk('avatars', { current: { code: 'fox', emoji: '🦊', photo: false }, avatars: [{ code: 'fox', name: 'Fox', emoji: '🦊' }, { code: 'wolf', name: 'Wolf', emoji: '🐺' }, { code: 'owl', name: 'Owl', emoji: '🦉' }] }, [
  A('avatar.choice', 'life.avatar', { choice: 'fox' }, { subject: 'fox' }), A('avatar.choice', 'life.avatar', { choice: 'wolf' }, { subject: 'wolf' }), A('avatar.choice', 'life.avatar', { choice: 'owl' }, { subject: 'owl' }),
  A('avatar.photo', 'life.avatar', { choice: 'photo' }), A('avatar.none', 'life.avatar', { choice: 'none' }), back('life.card'), refreshA('life.avatar'),
])

const sleepPay = () => mockOk('sleep_pay', { spot: N('hostel', 'Hostel bed'), rest: 60, relief: 12, payment: { amount: 800, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 12450, bank: 86300 } }, [
  A('pay.cash', 'life.sleep', { spot: 'hostel', method: 'cash' }), A('pay.card', 'life.sleep', { spot: 'hostel', method: 'card' }), back('life.me'),
])

function refusal(screen: 'life_refusal' | 'item_refusal' | 'property_refusal' | 'refusal') {
  const back1 = back('player.profile.get')
  switch (screen) {
    case 'life_refusal':
      return { ok: false, request_id: 'mock', screen, view: { kind: 'too_soon', wait_seconds: 1500, min: 0, max: 0 }, error: { code: 'life_too_soon', args: { wait_seconds: 1500 } }, actions: [back('life.me')] }
    case 'item_refusal':
      return { ok: false, request_id: 'mock', screen, view: { kind: 'cooling', item: N('bread', 'Bread'), wait_seconds: 1200, ready_at: iso(20) }, error: { code: 'item_cooling', args: { wait_seconds: 1200 } }, actions: [A('item.bag', 'inventory.show'), back1] }
    case 'property_refusal':
      return { ok: false, request_id: 'mock', screen, view: { kind: 'price', max: 1000000, wait_seconds: 0, back: { command: 'property.mine', args: null } }, error: { code: 'property_price', args: { max: 1000000 } }, actions: [back('property.mine')] }
    default:
      return {
        ok: false, request_id: 'mock', screen, error: { code: 'refusal_course_requirements', args: { fee: 0, cash: 0, wait_seconds: 0 } },
        view: { kind: 'course_requirements', missing: [
          { kind: 'level', met: false, skill: '', need: 4, have: 2, course_code: '', course_name: '', city_code: '', city: '', wait_seconds: 0 },
          { kind: 'certificate', met: false, skill: '', need: 0, have: 0, course_code: 'mgmt101', course_name: 'Basic management', city_code: '', city: '', wait_seconds: 0 },
        ], city_code: '', city: '', fee: 0, cash: 0, wait_seconds: 0, ends_at: null },
        actions: [A('education', 'education.list'), back1],
      }
  }
}

const devices = (notice = '') => mockOk('devices', { devices: [
  { id: 'd1', name: 'مرورگر', via: 'telegram', created_at: iso(-60 * 24 * 30), last_seen_at: iso(-5) },
  { id: 'd2', name: 'گوشی اندروید', via: 'link', created_at: iso(-60 * 24 * 3), last_seen_at: iso(-60 * 30) },
], notice }, [A('device.revoke', 'device.revoke', { device: 'd1' }, { kind: 'danger' }), A('device.revoke', 'device.revoke', { device: 'd2' }, { kind: 'danger' }), A('device.link', 'device.link'), back('player.profile.get'), refreshA('device.list')])

const deviceLink = () => mockOk('device_link', { code: 'K7Q2M9AB', expires_at: iso(10), valid_seconds: 600, mini_app_url: '' }, [A('devices', 'device.list'), back('player.profile.get')])

const settings = (lang: string, changed: boolean, vis = 'contacts', visChanged = false) => mockOk('settings', { language: lang, languages: ['fa', 'en'], language_changed: changed, presence_visibility: vis, presence_changed: visChanged }, [
  A('settings.language', 'player.language.set', { lang: lang === 'fa' ? 'en' : 'fa' }, { subject: lang === 'fa' ? 'en' : 'fa' }), back('player.profile.get'), refreshA('player.settings'),
])

const achievements = () => mockOk('achievements', { lines: [
  { achievement: N('first_journey', 'First journey'), count: 1, done: 1, reward: 500, earned: true, cash: 500 },
  { achievement: N('first_shift', 'First shift'), count: 1, done: 1, reward: 300, earned: true, cash: 300 },
  { achievement: N('homeowner', 'Homeowner'), count: 1, done: 0, reward: 1500, earned: false, cash: 0 },
  { achievement: N('graduate', 'Graduate'), count: 3, done: 1, reward: 2000, earned: false, cash: 0 },
] }, [back('player.profile.get'), refreshA('achievement.list')])

const BAG = [
  { item: N('bread', 'Bread'), category: 'food', shelf: { code: 'food.bakery', group: 'food', label: 'نان', group_label: 'item_shelf_group.food' }, qty: 3, serial: '', quality: 0, uses_left: 0, durability: 0, design: '' },
  { item: N('bandage', 'Bandage'), category: 'medicine', shelf: { code: 'medicine.first_aid', group: 'medicine', label: 'کمک‌های اولیه', group_label: 'item_shelf_group.medicine' }, qty: 2, serial: '', quality: 0, uses_left: 0, durability: 0, design: '' },
  { item: N('phone', 'Phone'), category: 'electronics', shelf: { code: 'tools.devices', group: 'tools', label: 'دستگاه', group_label: 'item_shelf_group.tools' }, qty: 1, serial: 'ph-7f3a', quality: 74, uses_left: 18, durability: 80, design: '' },
]

const inventory = () => mockOk('inventory', {
  lines: BAG, page: 1, pages: 1, total: 3, in_escrow: 2,
  bags: [{ slot: 'belt', bag: null }, { slot: 'back', bag: { item: N('bag_sack', 'کیسه'), serial: 'sk-1a2b', full_space: 12, space: 12, wear: 70, wear_max: 100, torn: false, comfort_kg: 8, hard_kg: 14 } }],
  carry: { used: 14, reserved: 2, capacity: 20, base: 8, load_g: 5200, comfort_g: 12000, hard_g: 20000 },
  home: { capacity: 40, used: 6, here: true, lines: [{ item: N('plank', 'تخته'), category: 'wood', shelf: { code: 'materials.wood', group: 'materials', label: 'چوب', group_label: 'item_shelf_group.materials' }, qty: 3, serial: '', quality: 0, uses_left: 0, durability: 0, design: '' }] },
  claims: [{ item: N('bandage', 'Bandage'), category: 'medicine', shelf: { code: 'medicine.first_aid', group: 'medicine', label: 'کمک‌های اولیه', group_label: 'item_shelf_group.medicine' }, qty: 2, serial: '', quality: 0, uses_left: 0, durability: 0, design: '' }],
}, [
  ...BAG.map((l) => A('item.open', 'inventory.item', { item: l.serial || l.item.code }, { subject: l.item.code })), A('shops', 'shop.list'), A('market', 'market.list'), back('player.profile.get'), refreshA('inventory.show'),
])

function itemDetail(ref: string) {
  const piece = ref === 'ph-7f3a'
  const item = piece ? N('phone', 'Phone') : N('bread', 'Bread')
  return mockOk('item_detail', {
    item, category: piece ? 'electronics' : 'food', qty: piece ? 1 : 3, ref, piece, quality: piece ? 74 : 0, uses_left: piece ? 18 : 0, durability: piece ? 80 : 0, worth: piece ? 9000 : 40,
    effects: piece ? null : [{ target: 'hunger', op: 'add', value: -25 }, { target: 'energy', op: 'add', value: 10 }], gear: piece ? { categories: [N('theft', 'Theft')], crimes: null, success_bps: 500, catch_bps: -300, witness_bps: 0, solve_bps: 0, reward_bps: 0, nerve: 0, confiscated: true } : null,
    usable: !piece, tradeable: true, can_store: !piece, bag: null, cooldown_seconds: piece ? 0 : 1800, cooling_for_seconds: 0, ready_at: null, nonce: 'n1', give_to: [N('B3C4D5F', 'کاوه')],
  }, [
    ...(piece ? [] : [A('item.use', 'inventory.use', { item: ref, nonce: 'n1' }, { kind: 'primary', subject: 'bread' })]),
    A('item.sell_market', 'market.book', { item: item.code }), A('item.sell_shop', 'shop.offers', { item: ref }),
    A('item.give', 'inventory.give', { item: ref, nonce: 'n1', to: 'B3C4D5F' }, { subject: 'B3C4D5F' }), A('item.drop', 'inventory.drop', { item: ref }, { kind: 'danger' }), back('inventory.show'), refreshA('inventory.item', { item: ref }),
  ])
}

const itemUsed = () => mockOk('item_used', { item: N('bread', 'Bread'), changes: [{ target: 'hunger', before: 60, after: 35, max: 100 }, { target: 'energy', before: 62, after: 72, max: 100 }], left: 2, cooldown_seconds: 1800, ready_at: iso(30) }, [A('item.bag', 'inventory.show'), back('player.profile.get')])
const itemGiven = () => mockOk('item_given', { item: N('bread', 'Bread'), to: N('B3C4D5F', 'کاوه') }, [A('item.bag', 'inventory.show'), back('player.profile.get')])
const dropConfirm = (ref: string) => mockOk('drop_confirm', { item: N('bread', 'Bread'), ref, nonce: 'n1' }, [confirmA('inventory.drop', { item: ref, confirm: 'yes', nonce: 'n1' }), back('inventory.item', { item: ref })])
const itemDropped = () => mockOk('item_dropped', { item: N('bread', 'Bread'), ref: 'bread', nonce: '' }, [A('item.bag', 'inventory.show'), back('player.profile.get')])

const CITY = { kind: 'city', code: 'calderis', name: 'Calderis' }
const OFFER = { no: 12, kind: 'sale', type: N('small_house', 'Small house'), property_no: 41, price: 118000, seller: { name: 'آرش', code: 'A1B2C3D' }, mine: false }

const propertyMarket = () => mockOk('property_market', { no_city: false, city: CITY, types: [
  { type: N('small_house', 'Small house'), kind: 'house', size: 60, quality: 40, price: 120000, left: 4, home: true },
  { type: N('apartment_unit', 'Apartment'), kind: 'apartment', size: 45, quality: 55, price: 90000, left: 0, home: true },
  { type: N('corner_shop', 'Corner shop'), kind: 'shop', size: 30, quality: 50, price: 160000, left: 2, home: false },
], offers: [OFFER, { ...OFFER, no: 13, kind: 'rent', price: 2400, type: N('apartment_unit', 'Apartment'), property_no: 7 }] }, [
  A('property.type', 'property.type', { type: 'small_house' }, { subject: 'small_house' }), A('property.type', 'property.type', { type: 'corner_shop' }, { subject: 'corner_shop' }),
  A('property.offer', 'property.offer', { no: '12' }), A('property.mine', 'property.mine'), back('map.list'), refreshA('property.list'),
])

function propertyType(bought = 0, blocked = '', way = false) {
  const payment = bought || blocked || way ? null : { amount: 120000, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 12450, bank: 86300 }
  return mockOk('property_type', {
    city: CITY, type: N('small_house', 'Small house'), kind: 'house', size: 60, quality: 40, upkeep: 600, home: true, rest_energy: 30, place: N('registry', 'Land Registry'), price: 120000, left: 4, tax_bps: 100,
    payment, blocked, max: 3, way: way ? { place: N('registry', 'Land Registry'), walk_seconds: 240 } : null, bought,
  }, [
    ...(payment ? [A('pay.cash', 'property.purchase', { type: 'small_house', method: 'cash' }), A('pay.card', 'property.purchase', { type: 'small_house', method: 'card' })] : []),
    ...(way ? [A('walk', 'place.go', { place: 'registry', then: 'property.type', args: 'small_house' }, { subject: 'registry' })] : []),
    A('property.mine', 'property.mine'), back('property.list'), refreshA('property.type', { type: 'small_house' }),
  ])
}

const propertyOffer = () => mockOk('property_offer', { offer: OFFER, city: CITY, kind: 'house', size: 60, quality: 40, upkeep: 600, home: true, payment: { amount: 118000, accepted: ['cash', 'card'], usable: ['card'], cash: 12450, bank: 160000 }, blocked: '', max: 0, way: null }, [
  A('pay.card', 'property.buy', { no: '12', method: 'card' }), back('property.list'), refreshA('property.offer', { no: '12' }),
])

const OWNED = { no: 41, type: N('small_house', 'Small house'), kind: 'house', size: 60, quality: 40, city: CITY, value: 120000, debt: 0, unpaid_periods: 0, home: true, offer: null, tenant: null, rent: 0, arrears: 0 }

const VILLAGE_HELD = [{ settlement: N('v-k3x9', 'آمل'), lots: 6, value: 40000, can_rest: false, rest_in_seconds: 16440, buildings: [{ building: N('cottage', 'Cottage'), state: 'complete', home: true, value: 30000 }, { building: N('stall', 'Stall'), state: 'complete', home: false, value: 9000 }] }]
const propertyMine = (notice = '') => mockOk('property_mine', { village: mockStandsIn() === 'village' ? VILLAGE_HELD : null, owned: mockStandsIn() === 'village' ? [] : [OWNED, { ...OWNED, no: 44, type: N('corner_shop', 'Corner shop'), kind: 'shop', home: false, value: 160000, offer: { ...OFFER, kind: 'rent', price: 2800, type: N('corner_shop', 'Corner shop'), property_no: 44, mine: true } }], rented: null, residence: CITY, grace: 3, can_rest: true, rest_in_seconds: 0, rest_energy: 30, notice, notice_args: notice === 'rested' ? { energy: 30, rest: 20 } : notice === 'bought_offer' ? { no: 12 } : null }, [
  A('property.manage', 'property.view', { no: '41' }), A('property.manage', 'property.view', { no: '44' }), A('property.rest', 'property.rest'), A('property.market', 'property.list'), back('player.profile.get'), refreshA('property.mine'),
])

const propertyView = (notice = '') => mockOk('property', { property: OWNED, place: N('old_town', 'Old Town'), upkeep: 600, tax_bps: 100, max_price: 240000, max_rent: 4800, notice }, [
  { ...A('property.sell', 'property.sell', { no: '41' }), input: { field: 'price' } } as MockAct, { ...A('property.let', 'property.let', { no: '41' }), input: { field: 'price' } } as MockAct, back('property.mine'), refreshA('property.view', { no: '41' }),
])

const propertyLeave = () => mockOk('property_leave', { lease_no: 9, type: N('apartment_unit', 'Apartment'), city: CITY }, [confirmA('property.leave', { no: '9', confirm: 'yes' }), back('property.mine')])

function errorScreen(code: string, args: Record<string, unknown> | null) {
  return mockOk('error', { code, args }, [A('job.mine', 'job.status'), back('player.profile.get')])
}

/** The answer of a life-area command in the mock, or null when it is not one. */
export function mockLifeCommand(command: string, a: Args): unknown | null {
  const args = (a ?? {}) as Record<string, unknown>
  switch (command) {
    case 'player.profile.get': return mockProfile()
    case 'mock.dashboard': return dashboard()
    case 'map.list': return cityMap()
    case 'map.cities': return cities(Number(args.page ?? 1) || 1)
    case 'travel.options': return travelOptions(String(args.city ?? 'support'))
    case 'travel.start': {
      if (!args.method) return checkout(String(args.city ?? 'support'), String(args.mode ?? 'bus'), args.broke !== 'yes')
      return started(String(args.city ?? 'support'), String(args.mode ?? 'bus'))
    }
    case 'mock.broke': return checkout('support', 'train', false)
    case 'travel.status': return mockStatus()
    case 'mock.arrived': return arrived()
    case 'travel.here': return travelHere()
    case 'place.go': return walkStarted()
    case 'mock.not_here': return notHere(false)
    case 'mock.not_here_walking': return notHere(true)
    case 'life.me': return life('')
    case 'life.sleep': return args.method || args.spot === 'bench' ? life('slept') : sleepPay()
    case 'life.card': return card('')
    case 'life.bio': return card(args.clear ? 'bio_gone' : 'bio')
    case 'life.history': return history(Number(args.page ?? 1) || 1)
    case 'life.avatar': return args.choice ? card('avatar') : avatars()
    case 'mock.life_refusal': return refusal('life_refusal')
    case 'mock.item_refusal': return refusal('item_refusal')
    case 'mock.property_refusal': return refusal('property_refusal')
    case 'mock.refusal': return refusal('refusal')
    case 'mock.error': return errorScreen(String(args.code ?? 'error.not_enough_energy'), (args.code ? null : { needed: 40, current: 12 }) as Record<string, unknown> | null)
    case 'player.settings': return settings('fa', false)
    case 'player.language.set': return settings(args.lang === 'en' ? 'en' : 'fa', true)
    case 'player.presence.set': return settings('fa', false, String(args.visibility ?? 'contacts'), true)
    case 'device.list': return devices()
    case 'device.revoke': return devices('revoked')
    case 'device.link': return deviceLink()
    case 'achievement.list': return achievements()
    case 'inventory.show': return inventory()
    case 'inventory.item': return itemDetail(String(args.item ?? 'bread'))
    case 'inventory.use': return itemUsed()
    case 'inventory.give': return itemGiven()
    case 'inventory.drop': return args.confirm ? itemDropped() : dropConfirm(String(args.item ?? 'bread'))
    case 'property.list': return propertyMarket()
    case 'property.type': return propertyType()
    case 'property.purchase': return propertyType(41)
    case 'mock.property_blocked': return propertyType(0, 'too_many')
    case 'mock.property_way': return propertyType(0, '', true)
    case 'property.offer': return propertyOffer()
    case 'property.buy': case 'property.rent': return propertyMine('bought_offer')
    case 'property.mine': return propertyMine()
    case 'property.rest': return propertyMine('rested')
    case 'property.view': return propertyView()
    case 'property.sell': case 'property.let': return propertyView('listed')
    case 'property.cancel': return propertyView('cancelled')
    case 'property.leave': return args.confirm ? propertyMine('left') : propertyLeave()
    default: return null
  }
}
