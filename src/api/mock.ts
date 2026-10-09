// Dev-only mock mode (?mock=1): stubs window.fetch for our own API host so
// the login flow, shell, HUD and city can be screenshotted without a real
// backend. Never enabled unless the query string asks for it.

import { API_BASE } from './client'
import { mockEconomyCommand } from './mock_economy'
import { mockCompaniesCommand } from './mock_companies'
import { mockMilitaryCommand } from './mock_military'
import { mockFeatureCommand } from './mock_features'
import { mockNativeCommand } from './mock_views'
import { mockMoreCommand } from './mock_more'
import { mockFoundingCommand } from './mock_founding'
import { mockLifeCommand } from './mock_life'
import { mockCrimeCommand } from './mock_act_crime'
import { mockWorkCommand } from './mock_act_work'
import { mockHealthCommand } from './mock_act_health'
import { mockBasicCommand } from './mock_basic'
import { mockLocation, mockSupportCommand } from '../support/mock'
import { mockFxCommand } from './mock_fx'
import { mockReserveCommand } from './mock_reserve'
import { mockResearchCommand } from './mock_research'
import { mockLotCommand } from './mock_lot'
import { installVillageMockHandles, mockBootstrapSettlement, mockVillageCommand, mockVillageRoute } from './mock_village'
import { mockSocietyCommand } from './mock_society'
import { mockP0Command } from './mock_p0'
import { mockState, mockSyncCommand, mockUpdates } from './mock_sync'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// the language the mock "server" holds for the player (player.language.set changes it)
let mockLang: 'fa' | 'en' = (() => { try { return localStorage.getItem('tc.lang') === 'en' ? 'en' : 'fa' } catch { return 'fa' } })()
const MOCK_PLAYER = { id: 'mock-1', code: 'K7Q2M9A', name: 'سارا', get lang() { return mockLang }, city_code: 'calderis', city: 'کالدریس' }

const MOCK_AUTH = {
  access_token: 'mock.access.token',
  token_type: 'Bearer',
  expires_in: 900,
  refresh_token: 'tcr1.mock-refresh-token',
  player: MOCK_PLAYER,
}

const MOCK_PROFILE_VIEW = {
  name: 'سارا', code: 'K7Q2M9A', avatar: '🦊', city_code: 'calderis', city: 'کالدریس',
  place: { code: 'old_town', name: 'مرکز شهر' },
  level: 7, xp: 5400, next_level_xp: 6500, energy: 72, max_energy: 100, energy_full_in_seconds: 720,
  health: 88, max_health: 100, cash: 12450, bank: 86300, travelling: false,
  rank: { code: 'citizen', name: 'شهروند', emoji: '🎖' },
  // matches job.status's mock below (business_district, no active shift):
  // the home overlay's ready-toast and shift-ready world bubble read this
  work: {
    job: { job: { career_code: 'retail', career_name: 'تجارت', rank: 'senior', title: 'فروشنده‌ی ارشد' }, city_code: 'calderis', city: 'کالدریس', pay: 1850, shift_ends_in_seconds: 0 },
    course: { course: { code: 'mgmt101', name: 'مدیریت پایه' }, remaining_seconds: 0, paused: false },
    certificates: 2,
  },
  jail: null, hospital: null,
}

const MOCK_CITY_MAP = {
  city: 'کالدریس', version: 1, grid: { w: 12, h: 12 }, water: { side: 'south', width: 3 },
  roads: (() => {
    const r: [number, number][] = []
    for (let i = 0; i < 12; i++) {
      r.push([i, 5], [5, i])
    }
    return r
  })(),
  plots: [
    { id: 'place:old_town', x: 4, y: 3, w: 2, h: 2, kind: 'place', model: 'place:old_town', rot: 0, ref: { table: 'place', code: 'old_town' }, name: { fa: 'مرکز شهر', en: 'Old Town' } },
    { id: 'company:Q7M2K9B', x: 8, y: 3, w: 2, h: 2, kind: 'company', model: 'company:factory', rot: 90, ref: { table: 'company_type', code: 'factory', company_id: 'Q7M2K9B', owner: 'سارا' }, name: { fa: 'استودیو دانا', en: 'Dana Studio' } },
    { id: 'place:harbour', x: 2, y: 8, w: 2, h: 2, kind: 'place', model: 'place:harbour', rot: 0, ref: { table: 'place', code: 'harbour' }, name: { fa: 'باغ آسمان', en: 'Harbour' } },
    // matches job.status's mock workplace, so the shift-ready world bubble
    // (the world view) has a real building to anchor itself over
    { id: 'place:business_district', x: 6, y: 8, w: 2, h: 2, kind: 'place', model: 'place:bazaar', rot: 0, ref: { table: 'place', code: 'business_district' }, name: { fa: 'فروشگاه‌های البرز', en: 'Alborz Shops' } },
  ],
}

// The profile's own buttons (internal/telegram/screens/profile.go, an
// established player's dashboard): hospital, current job, education, bank,
// home, shops, friends, faction, missions, skills, life, achievements, the
// leaderboard, settings. Filled in here (was empty) so every screen one tap
// away from the profile — not just this area's own — can be reached in
// ?mock=1 the way a player would reach it.
const MOCK_PROFILE_ACTIONS = [
  { label: 'بیمارستان', command: 'health.hospital', row: 0, kind: 'secondary', icon: 'hospital' },
  { label: 'شغل من', command: 'job.status', row: 0, kind: 'secondary', icon: 'work' },
  { label: 'آموزش', command: 'education.list', row: 1, kind: 'secondary', icon: 'study' },
  { label: 'بانک', command: 'bank.show', row: 1, kind: 'secondary', icon: 'bank' },
  { label: 'ملک من', command: 'property.mine', row: 2, kind: 'secondary', icon: 'house' },
  { label: 'مغازه‌ها', command: 'shop.list', row: 2, kind: 'secondary', icon: 'cart' },
  { label: 'دوستان', command: 'social.friend.list', row: 3, kind: 'secondary', icon: 'society' },
  { label: 'مأموریت‌ها', command: 'mission.board', row: 3, kind: 'secondary', icon: 'missions' },
  { label: 'مهارت‌ها', command: 'skills.list', row: 4, kind: 'secondary', icon: 'chart' },
  { label: 'زندگی', command: 'life.me', row: 4, kind: 'secondary', icon: 'moon' },
  { label: 'دستاوردها', command: 'achievement.list', row: 5, kind: 'secondary', icon: 'trophy' },
  { label: 'رتبه‌ها', command: 'life.top', row: 5, kind: 'secondary', icon: 'podium' },
  { label: 'تنظیمات', command: 'player.settings', row: 6, kind: 'navigation', icon: 'gears' },
  { label: 'تازه‌سازی', command: 'player.profile.get', row: 6, kind: 'navigation', icon: 'clock' },
]

/** ?cur=none: SUP only. Default: a chartered Marco Polo (r0 10, reference rate 1.00). */
export const MOCK_MONEY = (() => { try { return new URLSearchParams(location.search).get('cur') === 'none' ? null : { code: 'MKP', name: 'مارک پولو', symbol: 'MKP', r0: 10, x_ref_ppm: 1_000_000, rate_num: 10_000_000, rate_den: 1_000_000 } } catch { return null } })()

const OFFER_SCREENS = new Set(['village_donate_confirm', 'settlement_lot_buy_confirm', 'settlement_private_confirm', 'village_shop_checkout', 'course_detail', 'sleep_pay'])

function mockCommand(command: string, args?: Record<string, unknown>) {
  if (command === 'player.language.set') mockLang = args?.lang === 'en' ? 'en' : 'fa'
  // the companies, production and recruitment area: neutral answers of every screen of it (src/api/mock_companies.ts)
  const companies = mockCompaniesCommand(command, args ?? {})
  if (companies) return json(companies)
  // the military, war and defence area (src/api/mock_military.ts)
  const military = mockMilitaryCommand(command, args ?? {})
  if (military) return json(military)
  // the economy and finance area: neutral answers of every screen of it (src/api/mock_economy.ts)
  // health and missions answer first: the older boards of the P0 mock carry no actions
  const healthArea = mockHealthCommand(command, args)
  if (healthArea) return json(healthArea)
  // work and study answer first too: the P0 education board carries no actions
  const workArea = mockWorkCommand(command, args)
  if (workArea) return json(workArea)
  // crime answers first too: the P0 crime hub carries no actions
  const crimeArea = mockCrimeCommand(command, args)
  if (crimeArea) return json(crimeArea)
  const p0 = mockP0Command(command, args)
  if (p0) return json(p0)
  const economy = mockEconomyCommand(command, args ?? {})
  if (economy) return json(economy)
  const support = mockSupportCommand(command, args)
  if (support) return json(support)
  // the life area answers in the neutral contract (src/api/mock_life.ts)
  const lifeArea = mockLifeCommand(command, args)
  if (lifeArea) return json(lifeArea)
  // the activities (crime, work, study, skills, health, missions): neutral answers of every screen of them
  const activities = mockCrimeCommand(command, args) ?? mockWorkCommand(command, args)
  if (activities) return json(activities)
  const basic = mockBasicCommand(command, args)
  if (basic) return json({ ok: true, ...basic })
  // war/military (no structured view yet) and friends/search (structured):
  // the features area's own mock data (src/api/mock_features.ts).
  const founding = mockFoundingCommand(command, args)
  if (founding) return json(founding)
  const society = mockSocietyCommand(command, args)
  if (society) return json(society)
  const rsd = mockResearchCommand(command, args ?? {})
  if (rsd) return json(rsd)
  const lot = mockLotCommand(command, args ?? {})
  if (lot) return json(lot)
  const fx = mockFxCommand(command, args)
  const rs = mockReserveCommand(command, args ?? {})
  if (rs) return json(rs)
  if (fx) return json(fx)
  const village = mockVillageCommand(command, args)
  if (village) return json(village)
  const feature = mockFeatureCommand(command, args)
  if (feature) return json(feature)
  // Native screens with a real view (src/screens/native/*): real shapes
  // adapted from the golden view-snapshots (src/api/mock_views.ts).
  const native = mockNativeCommand(command, args)
  if (native) return json({ ok: true, ...native })
  // Screens this worktree's own area adds (src/screens/more/*): real
  // shapes adapted from the same goldens (src/api/mock_more.ts).
  const more = mockMoreCommand(command, args)
  if (more) return json({ ok: true, ...more })
  return json({
    ok: true,
    screen: command.replace('.', '_'),
    text: `<b>${command}</b>\nاین یک صفحه‌ی آزمایشی است.\n\n<blockquote expandable>جزئیات بیشتر اینجا نمایش داده می‌شود.</blockquote>`,
    actions: [
      { label: 'بازگشت', command: 'player.profile.get', row: 0, kind: 'back', icon: 'action:player' },
      { label: 'تازه‌سازی', command, row: 0, kind: 'navigation', icon: 'clock' },
    ],
  })
}

const OPTIMISTIC_WRITES = new Set(['bank.deposit', 'bank.withdraw', 'inventory.use', 'inbox.read_all', 'inbox.read'])

export function installMockApi(): void {
  installVillageMockHandles()
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(API_BASE)) return realFetch(input, init)
    const path = url.slice(API_BASE.length).split('?')[0]

    if (path === '/api/v1/auth/link' || path === '/api/v1/auth/telegram' || path === '/api/v1/auth/refresh') {
      return json(MOCK_AUTH)
    }
    if (path === '/api/v1/bootstrap') {
      return json({
        player: MOCK_PLAYER,
        content_version: 1,
        languages: [{ code: 'fa', name: 'فارسی' }],
        cities: [{ code: 'calderis', name: 'کالدریس' }, { code: 'support', name: 'شهر مرکزی' }],
        places: [{ code: 'old_town', name: 'مرکز شهر' }],
        server_time: new Date().toISOString(),
        realtime: false,
        settlement: mockBootstrapSettlement(),
        location: mockLocation(),
        // state sync (client-api.md 5.6): the mock serves it, ?sync=0 turns it off
        features: { updates: new URLSearchParams(location.search).get('sync') !== '0' },
      })
    }
    if (path === '/api/v1/state') return json(mockState())
    if (path === '/api/v1/updates') {
      const q = new URL(url).searchParams
      return json(mockUpdates(Number(q.get('since') ?? 0), q.get('epoch') ?? ''))
    }
    const villageRes = mockVillageRoute(path, (init?.method ?? 'GET').toUpperCase(), new Headers(init?.headers))
    if (villageRes) return villageRes
    if (path === '/api/v1/world/city') {
      return json(MOCK_CITY_MAP)
    }
    if (path === '/api/v1/command' && init?.body) {
      const body = JSON.parse(String(init.body))
      // the writes the store shows optimistically take a phone network's
      // moment, so the overlay is seen before the answer confirms it
      if (OPTIMISTIC_WRITES.has(body.command)) await new Promise((r) => setTimeout(r, 700))
      const res = mockCommand(body.command, body.args)
      // the command's effect on the player's state and its own records (state sync)
      // ?offer=convert (default) | local | none | moved: the village desk offered inside a confirm (response.offer)
      const scen = new URLSearchParams(location.search).get('offer') ?? 'convert'
      if (body.args?.convert && scen === 'moved') return json({ ok: false, request_id: 'mock', screen: 'error', error: { code: 'desk_moved', message: '' }, actions: [] })
      const out = mockSyncCommand(body.command, body.args, await res.json()) as Record<string, unknown>
      // the viewer's display money rides on every neutral answer (?cur=none: a city with no money of its own, SUP only)
      if (out && typeof out === 'object' && out.screen && MOCK_MONEY) out.money = MOCK_MONEY
      if (MOCK_MONEY && scen !== 'none' && OFFER_SCREENS.has(String(out.screen))) {
        const acts = (out.actions ?? []) as { id?: string; command?: string; args?: Record<string, string>; kind?: string }[]
        const a = acts.find((x) => x.id === 'confirm' || x.id?.startsWith('pay.') || x.id === 'shop.pay' || x.id === 'education.enrol')
        const local = scen === 'local'
        out.offer = { settlement: 'mock-village', code: 'MKP', name: 'مارک پولو', sup: 100, units: 1000, holds: local ? 1500 : 320, local, can_convert: !local, convert_sup: 1011, convert_fee: 4, convert_units: 680, fee_bps: 30,
          convert: a ? { id: 'convert', command: a.command, args: { ...(a.args ?? {}), convert: '1', max_sup: '1011' }, params: { ...(a.args ?? {}), convert: '1', max_sup: '1011' }, kind: 'primary' } : undefined }
      }
      return json(out, res.status)
    }
    if (path === '/api/v1/auth/logout') {
      return json({ ok: true })
    }
    return json({ ok: false, error: { code: 'not_found', message: 'mock: unhandled path ' + path } }, 404)
  }
}
