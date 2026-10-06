// Mock answers (?mock=1) of the screens the activities work adds: the hub, the work home, the health home, the
// crime hub's empty reason, and what a settlement teaches and posts. The mock player is a village resident whose
// village has a market, so crime is listed; `?as=city` makes them a player standing in the central city instead.

import { mockStandsIn } from '../support/mock'
import { mockLaborCommand } from './mock_labor'

type Args = Record<string, unknown> | undefined

const ok = (screen: string, view: unknown) => ({ ok: true, screen, view, actions: [] })

/** The mock player stands in a city, not in their village (`?as=city`). */
export const AS_CITY = (() => { try { return new URLSearchParams(location.search).get('as') === 'city' } catch { return false } })()

const VILLAGE = { code: 'v-k3x9', name: 'آمل' }
const PLACE = AS_CITY ? { code: 'support', name: 'شهر مرکزی', tier: 'city', neutral: true } : { ...VILLAGE, tier: 'city', neutral: false }
const MONEY = AS_CITY ? null : { code: 'AML', name: 'سکهٔ آمل', symbol: '' }

type Entry = { code: string; name: { en: string; fa: string } }
const e = (code: string, en: string, fa: string): Entry => ({ code, name: { en, fa } })

/** The catalogue names these screens mention (the mock's copy of GET /api/v1/content for them). */
export const P1_CONTENT: Record<string, Entry[]> = {
  course: [e('first_aid', 'First aid', 'کمک‌های اولیه'), e('driving_licence', 'Driving licence', 'گواهینامهٔ رانندگی'), e('bookkeeping', 'Bookkeeping', 'دفترداری'), e('culinary_arts', 'Culinary arts', 'هنر آشپزی')],
  mission_board: [e('village_works', 'Village works board', 'تابلوی کارهای شهر'), e('city_hall', 'Civic noticeboard', 'تابلوی اعلانات شهرداری'), e('police', 'Police board', 'تابلوی پلیس')],
  mission: [e('village_first_lesson', 'First lesson', 'اولین درس'), e('village_bread_run', 'Bread for the store', 'نان برای انبار'), e('village_bandage_run', 'Bandages for the health house', 'باند برای خانهٔ بهداشت'), e('first_steps', 'First steps', 'قدم‌های اول')],
  settlement_knowledge: [e('basic_medicine', 'Basic medicine', 'پزشکی ابتدایی')],
  building_role: [e('education', 'A class', 'کلاس'), e('health', 'A health house', 'خانهٔ بهداشت')],
}

const COURSE = (code: string, name: string, fee: number, secs: number, min = 1, eligible = true) => ({ course: { code, name }, duration_seconds: secs, eligible, fee, min_level: min })

function education() {
  if (AS_CITY) {
    return ok('education', {
      current: null, certificates: [{ code: 'first_aid', name: 'کمک‌های اولیه' }], place: { code: '', name: '' }, tier: '', currency: null, literacy: null,
      courses: [COURSE('driving_licence', 'گواهینامهٔ رانندگی', 900, 10800), COURSE('bookkeeping', 'دفترداری', 1200, 14400), COURSE('culinary_arts', 'هنر آشپزی', 2400, 28800, 4, false)],
      elsewhere: null, empty: '', build: null, page: 1, pages: 1,
    })
  }
  return ok('education', {
    current: null, certificates: null, place: VILLAGE, tier: 'city', currency: MONEY,
    literacy: { share_bps: 1800 },
    courses: [],
    elsewhere: [{ course: { code: 'first_aid', name: 'First Aid' }, fee: 4200, duration_seconds: 7200, nearest: { code: 'support', name: 'شهر مرکزی' },
      needs: [{ kind: 'knowledge', code: 'basic_medicine', role: '', tier: 0 }, { kind: 'building', code: 'health_house', role: 'health', tier: 1 }] }],
    empty: 'nothing_taught', build: null, page: 1, pages: 1,
  })
}

const OBJ = (kind: string, count: number, target?: { kind: string; code: string; name: string }) => ({ kind, target: target ?? { kind: '', code: '', name: '' }, count, done: 0 })

function missions(args: Args) {
  if (AS_CITY) {
    const boards = [{ code: 'city_hall', name: 'تابلوی اعلانات شهرداری', place: { code: 'city_hall', name: 'مرکز شهر' }, open: 2 }, { code: 'police', name: 'تابلوی پلیس', place: { code: 'police_station', name: 'کلانتری' }, open: 1 }]
    const code = String(args?.board ?? '')
    if (!code) return ok('mission_board', { city: 'شهر مرکزی', city_code: 'support', tier: 'city', currency: null, boards, board: null, here: false, missions: null })
    return ok('mission_board', {
      city: 'شهر مرکزی', city_code: 'support', tier: 'city', currency: null, boards, board: boards.find((b) => b.code === code) ?? boards[0], here: true,
      missions: [
        { mission: { code: 'first_steps', name: 'قدم‌های اول' }, blocked: '', repeatable: false, wait_seconds: 0, reward: { cash: 300, xp: 40, items: [{ item: { code: 'sandwich', name: 'ساندویچ' }, qty: 2 }] },
          objectives: [OBJ('work_shift', 2), OBJ('buy_item', 1, { kind: 'item', code: 'bandage', name: 'باند' })] },
      ],
    })
  }
  const boards = [{ code: 'village_works', name: 'تابلوی کارهای شهر', place: { code: '', name: '' }, open: 3 }]
  const code = String(args?.board ?? '')
  if (!code) return ok('mission_board', { city: 'آمل', city_code: VILLAGE.code, tier: 'city', currency: MONEY, boards, board: null, here: true, missions: null })
  return ok('mission_board', {
    city: 'آمل', city_code: VILLAGE.code, tier: 'city', currency: MONEY, boards, board: boards[0], here: true,
    missions: [
      { mission: { code: 'village_first_lesson', name: 'اولین درس' }, blocked: '', repeatable: false, wait_seconds: 0, reward: { cash: 200, xp: 30, items: null }, objectives: [OBJ('course', 1)] },
      { mission: { code: 'village_bread_run', name: 'نان برای انبار' }, blocked: '', repeatable: true, wait_seconds: 0, reward: { cash: 300, xp: 25, items: null },
        objectives: [OBJ('deliver', 3, { kind: 'item', code: 'bread', name: 'نان' })] },
      { mission: { code: 'village_bandage_run', name: 'باند برای خانهٔ بهداشت' }, blocked: 'cooldown', repeatable: true, wait_seconds: 5400, reward: { cash: 400, xp: 30, items: null },
        objectives: [OBJ('deliver', 3, { kind: 'item', code: 'bandage', name: 'باند' })] },
    ],
  })
}

export function mockP0Command(command: string, args?: Args) {
  if (command === 'training.home') {
    return ok('training_home', {
      place: AS_CITY ? { code: 'support', name: 'شهر مرکزی' } : { code: VILLAGE.code, name: 'آمل' }, energy: 70, max_energy: 100, stamina: 112, strength_level: 2, energy_cost: 10, max_energy_cap: 30,
      venues: [
        { code: 'yard', efficiency_bps: 4000, fee: 0, available: true, missing: null, unkept: false },
        ...(AS_CITY ? [{ code: 'gym', efficiency_bps: 10000, fee: 60, available: true, missing: null, unkept: false }]
          : [{ code: 'ground', efficiency_bps: 4000, fee: 0, available: true, missing: null, unkept: true }]),
      ],
    })
  }
  if (command === 'training.start') {
    return ok('trained', { venue: 'yard', stamina: 2, max_energy_added: 0, strength_level: 0, strength_xp: 12, fee: 0, energy: 60, max_energy: 100 })
  }
  if (command === 'education.list') return education()
  if (command === 'mission.board') return missions(args)
  if (command === 'activities.hub') {
    return ok('activities_hub', {
      place: PLACE,
      entries: [
        { code: 'work', command: 'work.home' }, { code: 'learn', command: 'education.list' }, { code: 'health', command: 'health.home' }, { code: 'training', command: 'training.home' }, ...(AS_CITY ? [] : [{ code: 'crime', command: 'crime.hub' }]),
        { code: 'missions', command: 'mission.board' }, { code: 'rankings', command: 'life.top' },
      ],
    })
  }
  if (command === 'economy.hub' || command === 'society.hub') {
    // what exists where the mock player stands: a village (no bank, no exchange, no property market, a smallholding
    // possible) or the central city (everything the city has)
    const city = mockStandsIn() === 'city'
    const place = city ? { code: 'support', name: 'شهر مرکزی', tier: 'city', neutral: true } : { code: 'v-k3x9', name: 'آمل', tier: 'city', neutral: false }
    const e = (code: string, cmd: string) => ({ code, command: cmd })
    if (command === 'economy.hub') {
      return ok('economy_hub', {
        place,
        entries: [
          e('inventory', 'inventory.show'), e('market', 'market.list'), ...(city ? [] : [e('storehouse', 'settlement.materials')]), e('bank', 'bank.show'),
          ...(city ? [e('companies', 'company.mine'), e('property', 'property.mine'), e('stocks', 'stock.list')] : [e('companies', 'company.mine')]),
        ],
      })
    }
    return ok('society_hub', {
      place,
      entries: [
        e('inbox', 'inbox.show'), ...(city ? [e('faction', 'faction.mine')] : []), e('friends', 'social.friend.list'), e('elections', 'election.list'),
        e('government', 'gov.city'), ...(city ? [e('war', 'military.ministry')] : []),
      ],
    })
  }
  if (command === 'work.home') {
    const labor = (mockLaborCommand('settlement.labor.board') as { view?: { jobs?: unknown[] | null; working?: unknown } } | null)?.view
    return ok('work_home', {
      place: { code: 'v-k3x9', name: 'آمل', tier: 'city' }, resident: true, energy: 72, max_energy: 100, working: labor?.working ?? null, is_head: false,
      // the jobs are the labour mock's own, so taking one finds it on the board
      jobs: [...(labor?.jobs?.length ? labor.jobs : [{ id: 'j1', building_id: 'b1', building: { code: 'cottage', name: 'Cottage' }, kind: 'construction', employer_kind: 'settlement', employer: '', wage: 21, left: 6, total: 8, progress_bps: 3000, left_minutes: 300, workers: 1, npc_crew: 0, can_take: true, mine: false, points: 60, lot_x: 12, lot_y: 7 }]),
        // a road is built segment by segment: dozens of jobs of the same kind
        ...Array.from({ length: 14 }, (_, i) => ({ id: `road-${i}`, building_id: `r${i}`, building: { code: 'road', name: 'Road' }, kind: 'construction', employer_kind: 'settlement', employer: '', wage: 27 + (i % 5) * 8, left: 2, total: 2, progress_bps: i * 500, left_minutes: 120, workers: 0, npc_crew: 0, can_take: true, mine: false, points: 60, lot_x: i, lot_y: 3 }))],
      workplaces: [{ id: 'w1', building: { code: 'woodcutter_camp', name: 'Woodcutter camp' }, produces: [{ component: { code: 'timber', name: 'Timber' }, quantity: 4 }], consumes: [], wage: 18, shift_seconds: 600, workers: 2, busy: 0, ready: true }],
      market: { housing: 4, pool: 21, available: 21, working: 0, vacancies: 6, tightness_bps: 3000, level: 'slack', npc_wage: 21, min_wage: 15 }, empty: '', next: '',
    })
  }
  if (command === 'health.home') {
    // a settlement's own health house, or the central city, which has its own hospital and refers nobody
    return ok('health_home', {
      place: PLACE, health: 88, max_health: 100, admitted: null,
      rest: { has: false, can_rest: false, wait_seconds: 0 },
      facilities: AS_CITY ? [] : [{ kind: 'health_house', building: { code: 'health_house', name: 'Health house' } }],
      refer: AS_CITY ? null : { code: 'support', name: 'Support' }, empty: '',
    })
  }
  if (command === 'crime.hub') {
    return ok('crime_hub', {
      city: 'Amol', city_code: 'v-k3x9', venue: { code: '', name: '' }, nerve: { nerve: 20, max: 20, full_in_seconds: 0 },
      heat: { heat: 0, max: 100, wanted: 0, stars: 0 }, tier: { tier: { code: 'novice', name: 'novice' }, xp: 0, next: { code: '', name: '' }, next_xp: 0 },
      travelling: false, jail: null, busy: null, categories: [{ code: 'petty_theft', name: 'Petty theft' }], empty: '', min_level: 0,
    })
  }
  return null
}
