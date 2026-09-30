// Dev-only mock mode (?mock=1): stubs window.fetch for our own API host so
// the login flow, shell, HUD and city can be screenshotted without a real
// backend. Never enabled unless the query string asks for it.

import { API_BASE } from './client'
import { mockFeatureCommand } from './mock_features'
import { mockNativeCommand } from './mock_views'
import { mockMoreCommand } from './mock_more'
import { installVillageMockHandles, mockBootstrapSettlement, mockVillageCommand, mockVillageRoute } from './mock_village'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_PLAYER = { id: 'mock-1', code: 'K7Q2M9A', name: 'سارا', lang: 'fa', city_code: 'calderis', city: 'کالدریس' }

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
    // (CityView) has a real building to anchor itself over
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
  { label: 'تحصیل', command: 'education.list', row: 1, kind: 'secondary', icon: 'study' },
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

function mockCommand(command: string, args?: Record<string, unknown>) {
  if (command === 'player.profile.get') {
    return json({ ok: true, screen: 'profile', text: 'سارا - شهروند', view: MOCK_PROFILE_VIEW, actions: MOCK_PROFILE_ACTIONS })
  }
  // war/military (no structured view yet) and friends/search (structured):
  // the features area's own mock data (src/api/mock_features.ts).
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
        cities: [{ code: 'calderis', name: 'کالدریس' }],
        places: [{ code: 'old_town', name: 'مرکز شهر' }],
        server_time: new Date().toISOString(),
        realtime: false,
        settlement: mockBootstrapSettlement(),
      })
    }
    const villageRes = mockVillageRoute(path, (init?.method ?? 'GET').toUpperCase(), new Headers(init?.headers))
    if (villageRes) return villageRes
    if (path === '/api/v1/world/city') {
      return json(MOCK_CITY_MAP)
    }
    if (path === '/api/v1/command' && init?.body) {
      const body = JSON.parse(String(init.body))
      return mockCommand(body.command, body.args)
    }
    if (path === '/api/v1/auth/logout') {
      return json({ ok: true })
    }
    return json({ ok: false, error: { code: 'not_found', message: 'mock: unhandled path ' + path } }, 404)
  }
}
