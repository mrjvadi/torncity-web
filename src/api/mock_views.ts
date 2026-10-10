// Dev-only mock views (?mock=1) for the native screens this area owns
// (src/screens/native/*): real view shapes adapted from the goldens at
// internal/telegram/screens/testdata/view-snapshots/fa/*.json, translated
// to plausible Persian sample data. Wired into src/api/mock.ts.

import { MOCK_NOTICES, mockInboxCategories, mockInboxItems, mockNoticeCategoryOf, mockNoticeRead, mockNoticeReadAll, mockUnreadCount } from './mock_notices'

function back(command: string): Record<string, unknown> {
  return { label: 'بازگشت', command, row: 9, kind: 'back', icon: 'action:player' }
}
function refresh(command: string): Record<string, unknown> {
  return { label: 'تازه‌سازی', command, row: 9, kind: 'navigation', icon: 'clock' }
}

type Ctx = { args?: Record<string, unknown> }

const TABLE: Record<string, (ctx: Ctx) => { screen: string; text: string; view?: unknown; actions?: unknown[] }> = {
  'crime.hub': () => ({
    screen: 'crime_hub', text: 'جرم',
    view: {
      city: 'کالدریس', city_code: 'calderis', venue: { code: 'bazaar', name: 'بازار' },
      nerve: { nerve: 14, max: 20, full_in_seconds: 1800 },
      heat: { heat: 23, max: 100, wanted: 2, stars: 5 },
      tier: { tier: { code: 'novice', name: 'تازه‌کار' }, xp: 96, next: { code: 'hustler', name: 'حرفه‌ای' }, next_xp: 150 },
      travelling: false, jail: null, busy: null,
      categories: [
        { code: 'petty_theft', name: 'جیب‌بری' }, { code: 'street_crime', name: 'خیابانی' },
        { code: 'burglary', name: 'دزدی از خانه' }, { code: 'fraud', name: 'کلاه‌برداری' },
      ],
    },
    actions: [refresh('crime.hub'), back('player.profile.get')],
  }),
  'crime.list': (ctx) => ({
    screen: 'crime_list', text: 'فهرست جرم',
    view: {
      category: { code: ctx.args?.category ?? 'petty_theft', name: 'جیب‌بری' },
      crimes: [
        { crime: { code: 'pickpocketing', name: 'جیب‌بری' }, duration_seconds: 0, eligible: true, nerve: 2 },
        { crime: { code: 'shoplifting', name: 'دزدی از مغازه' }, duration_seconds: 0, eligible: false, nerve: 2 },
        { crime: { code: 'car_theft', name: 'سرقت خودرو' }, duration_seconds: 1800, eligible: true, nerve: 8 },
      ],
      page: 1, pages: 1,
    },
    actions: [back('crime.hub')],
  }),

  'job.status': () => ({
    screen: 'job_status', text: 'کار',
    view: {
      employed: true, city: 'کالدریس', employer: '',
      job: { career_code: 'retail', career_name: 'تجارت', rank: 'senior', title: 'فروشنده‌ی ارشد' },
      pay: 1850, energy_cost: 20, energy: 96, max_energy: 100,
      performance: 64, shifts_in_tier: 3, total_earned: 12400,
      at_workplace: true, top_tier: false, shift_length_seconds: 360,
      workplace: { code: 'business_district', name: 'فروشگاه‌های البرز' }, walk_to_work_seconds: 0,
      shift: null,
      next: { career_code: 'retail', career_name: 'تجارت', rank: 'supervisor', title: 'سرپرست فروش' },
      promotion_ready: false, missing: null,
    },
    actions: [
      { label: 'شروع شیفت', command: 'job.work', row: 0, kind: 'primary', icon: 'action:default' },
      { label: 'فرصت‌های شغلی دیگر', command: 'job.list', row: 1, kind: 'secondary', icon: 'work' },
      refresh('job.status'), back('player.profile.get'),
    ],
  }),

  'education.list': () => ({
    screen: 'education', text: 'آموزش',
    view: {
      current: { course: { code: 'mgmt101', name: 'مدیریت پایه' }, percent: 62, remaining_seconds: 5340, paused: false },
      certificates: [{ code: 'first_aid', name: 'کمک‌های اولیه' }, { code: 'english', name: 'زبان انگلیسی' }],
      courses: [
        { course: { code: 'driving', name: 'رانندگی حرفه‌ای' }, duration_seconds: 7200, eligible: true, fee: 1200, min_level: 1 },
        { course: { code: 'chem', name: 'شیمی صنعتی' }, duration_seconds: 21600, eligible: true, fee: 5200, min_level: 1 },
        { course: { code: 'swe', name: 'مهندسی نرم‌افزار' }, duration_seconds: 36000, eligible: false, fee: 9000, min_level: 10 },
      ],
      page: 1, pages: 1,
    },
    actions: [refresh('education.list'), back('player.profile.get')],
  }),

  'health.hospital': () => ({
    screen: 'hospital', text: 'بیمارستان',
    view: {
      health: 34, max: 100, full_in_seconds: 25320, city: 'کالدریس',
      in_hospital: true, cause: 'crime', remaining_seconds: 2530, treated: false,
      clinics: [
        { clinic: { name: 'درمانگاه شفا' }, price: 1200, doctor: 12, open: true, stock: 18, saves_seconds: 270, can_treat: true },
        { clinic: { name: 'تعمیرگاه نیلوفر' }, price: 500, doctor: 1, open: false, stock: 0, saves_seconds: 0, can_treat: false },
      ],
    },
    actions: [refresh('health.hospital'), back('player.profile.get')],
  }),

  'mission.board': (ctx) => ({
    screen: 'mission_board', text: 'مأموریت‌ها',
    view: {
      city: 'کالدریس', boards: null,
      board: { code: (ctx.args?.board as string) ?? 'city_hall', name: 'تابلوی شهرداری', place: { name: 'مرکز شهر' } },
      here: true,
      missions: [
        { mission: { code: 'first_steps', name: 'قدم اول' }, blocked: '', repeatable: false, reward: { cash: 300, xp: 40 }, wait_seconds: 0 },
        { mission: { code: 'study_up', name: 'برگرد به مدرسه' }, blocked: 'requires', repeatable: false, reward: { cash: 500, xp: 60 }, wait_seconds: 0 },
        { mission: { code: 'courier', name: 'پیک شهر' }, blocked: 'cooldown', repeatable: true, reward: { cash: 250, xp: 25 }, wait_seconds: 840 },
      ],
    },
    actions: [refresh('mission.board'), back('player.profile.get')],
  }),

  'life.top': (ctx) => ({
    screen: 'leaderboard', text: 'رتبه‌ها',
    view: {
      at: new Date().toISOString(), board: (ctx.args?.board as string) ?? 'companies',
      lines: [
        { position: 1, name: 'نان و شیرینی کاوه', city: { name: 'برن‌هاون' }, tag_name: 'نانوایی', value: 840000, mine: false },
        { position: 2, name: 'تعمیرگاه نیلوفر', city: { name: 'اوستمارش' }, tag_name: 'تعمیرگاه', value: 212000, mine: false },
        { position: 3, name: 'سارا', city: { name: 'کالدریس' }, tag_name: '', value: 101950, mine: true },
      ],
      ranks: null,
    },
    actions: [back('player.profile.get')],
  }),

  'inventory.show': () => ({
    screen: 'inventory', text: 'کوله‌پشتی',
    view: {
      lines: [
        { item: { code: 'pistol', name: 'کلت' }, category: 'weapon', qty: 1, durability: 72 },
        { item: { code: 'pill', name: 'دارو' }, category: 'medical', qty: 2, uses_left: 2 },
        { item: { code: 'soda', name: 'نوشابه' }, category: 'food', qty: 4 },
        { item: { code: 'bread', name: 'نان' }, category: 'food', qty: 6 },
        { item: { code: 'ring', name: 'انگشتر' }, category: 'goods', qty: 1 },
      ],
      page: 1, pages: 1, total: 5, in_escrow: 0,
    },
    actions: [refresh('inventory.show'), back('economy_hub')],
  }),



  'company.mine': () => ({
    screen: 'company_mine', text: '<b>شرکت‌های من</b>\nهنوز شرکتی ثبت نکرده‌ای.',
    actions: [{ label: 'شرکت جدید', command: 'company.type', row: 0, kind: 'primary', icon: 'action:default' }, back('economy_hub')],
  }),

  'property.mine': () => ({
    screen: 'property_mine', text: 'ملک من',
    view: {
      owned: [
        { no: 16, type: { name: 'آپارتمان استودیویی' }, kind: 'apartment', size: 35, quality: 2, value: 46350, rent: 0, debt: 0, unpaid_periods: 0, home: true, tenant: null, city: { name: 'کالدریس' } },
        { no: 12, type: { name: 'خانه‌ی خانوادگی' }, kind: 'house', size: 140, quality: 3, value: 180000, rent: 1500, debt: 0, unpaid_periods: 0, home: true, tenant: { name: 'کاوه' }, city: { name: 'کالدریس' } },
      ],
      rented: null, residence: { name: 'کالدریس' }, grace: 3, can_rest: true, rest_energy: 25, rest_in_seconds: 0, notice: '',
    },
    actions: [refresh('property.mine'), { label: 'بازار ملک', command: 'property.list', row: 1, kind: 'navigation', icon: 'action:default' }, back('economy_hub')],
  }),
  'property.list': () => ({
    screen: 'property_market', text: 'بازار ملک',
    view: {
      no_city: false, city: { name: 'کالدریس' },
      types: [
        { type: { code: 'studio', name: 'آپارتمان استودیویی' }, kind: 'apartment', size: 35, quality: 2, left: 28, price: 46350, home: true },
        { type: { code: 'family_house', name: 'خانه‌ی خانوادگی' }, kind: 'house', size: 140, quality: 3, left: 8, price: 180000, home: true },
      ],
      offers: [
        { no: 7, kind: 'sale', price: 210000, type: { name: 'خانه‌ی خانوادگی' }, seller: { name: 'کاوه' }, mine: false },
        { no: 8, kind: 'rent', price: 900, type: { name: 'آپارتمان استودیویی' }, seller: { name: 'نیلوفر' }, mine: false },
      ],
    },
    actions: [refresh('property.list'), back('economy_hub')],
  }),


  'inbox.show': () => ({
    screen: 'inbox_hub', text: '',
    view: { total: mockUnreadCount(), categories: mockInboxCategories() },
    actions: [refresh('inbox.show'), back('society_hub')],
  }),
  'inbox.read_all': () => {
    mockNoticeReadAll()
    return { screen: 'inbox_hub', text: '', view: { total: 0, categories: [] }, actions: [refresh('inbox.show'), back('society_hub')] }
  },
  // opening ONE notice reads only it; the same category's list comes back with every other notice where it was
  'inbox.read': (ctx) => {
    const id = String(ctx.args?.id ?? '')
    mockNoticeRead(id)
    const category = mockNoticeCategoryOf(id) || 'finance'
    return { screen: 'inbox_category', text: '', view: { category, items: mockInboxItems(category), page: 1, total_pages: 1 }, actions: [back('inbox.show')] }
  },
  'inbox.category': (ctx) => ({
    screen: 'inbox_category', text: '',
    view: {
      category: (ctx.args?.category as string) ?? 'finance',
      items: mockInboxItems((ctx.args?.category as string) ?? 'finance'),
      page: 1, total_pages: 1,
    },
    actions: [back('inbox.show')],
  }),

  'faction.mine': () => ({
    screen: 'faction_home', text: 'جناح',
    view: {
      ref: { code: 'L10N5ZA', name: 'شیرهای البرز' }, rank: 'leader', city: 'کالدریس',
      members: 18, max_members: 25, bank: 420000, applications: 2,
      operation: { crime: { name: 'سرقت از بانک مرکزی' }, status: 'gathering', left_seconds: 8070, min: 2, max: 5 },
    },
    actions: [refresh('faction.mine'), back('society_hub')],
  }),
  'faction.list': () => ({
    screen: 'faction_list', text: 'جناح‌ها',
    view: { city: 'کالدریس', factions: [{ ref: { code: 'L10N5ZA', name: 'شیرهای البرز' }, members: 18 }, { ref: { code: 'SH4D3SB', name: 'سایه‌ها' }, members: 6 }], fee: 50000, mine: { code: 'L10N5ZA', name: 'شیرهای البرز' } },
    actions: [back('society_hub')],
  }),

  'social.friend.list': () => ({
    screen: 'friends', text: '<b>دوستان</b>\n۱۲ دوست – ۴ آنلاین',
    actions: [back('society_hub')],
  }),

  'election.list': () => ({
    screen: 'elections', text: 'انتخابات',
    view: {
      no_city: false, place: { name: 'کالدریس' },
      elections: [
        { no: 4, office: 'mayor', place: { name: 'کالدریس' }, seats: 1, phase: 'candidacy', remaining_seconds: 111600, candidates: 2, elected: null },
        { no: 5, office: 'city_council', place: { name: 'کالدریس' }, seats: 5, phase: 'voting', remaining_seconds: 43200, candidates: 6, elected: null },
        { no: 1, office: 'mayor', place: { name: 'کالدریس' }, seats: 1, phase: 'counted', remaining_seconds: 0, candidates: 0, elected: [{ name: 'کاوه' }] },
      ],
    },
    actions: [refresh('election.list'), back('society_hub')],
  }),
  'election.view': (ctx) => ({
    screen: 'election', text: 'انتخابات',
    view: {
      no: Number(ctx.args?.no ?? 5), office: 'city_council', place: { name: 'کالدریس' }, seats: 5, phase: 'voting',
      remaining_seconds: 43200, votes_cast: 2340,
      candidates: [
        { player: { name: 'رضا' }, votes: 1076, mine: false, elected: false },
        { player: { name: 'مینا' }, votes: 889, mine: true, elected: false },
        { player: { name: 'دانا' }, votes: 375, mine: false, elected: false },
      ],
      deposit: 25000, min_level: 5, standing: false, voted: true,
    },
    actions: [back('election.list')],
  }),

  'gov.city': () => ({
    screen: 'city_governance', text: 'دولت شهر',
    view: {
      city: { name: 'کالدریس' }, holds_office: true, no_city: false,
      sections: [{
        place: { name: 'کالدریس' },
        offices: [
          { code: 'mayor', holders: [{ name: 'سارا' }], seats: 1 },
          { code: 'city_council', holders: [{ name: 'کاوه' }, { name: 'نیلوفر' }], seats: 5 },
        ],
        levers: [
          { code: 'city.tax_rate', type: 'bps', value: 450, held_by: 'mayor' },
          { code: 'city.minimum_wage', type: 'money', value: 100, held_by: 'mayor' },
          { code: 'city.shift_window_hours', type: 'int', value: 24, held_by: 'mayor' },
        ],
      }],
    },
    actions: [refresh('gov.city'), back('society_hub')],
  }),

  'travel.options': (ctx) => ({
    screen: 'travel_options', text: 'سفر',
    view: {
      from: 'کالدریس', to: 'برن‌هاون', to_code: (ctx.args?.city as string) ?? 'brennhaven', cash: 12450,
      options: [
        { mode_code: 'bus', mode_name: 'اتوبوس', fare: 0, wait_seconds: 750, energy: 8, busy: false },
        { mode_code: 'car', mode_name: 'خودرو', fare: 6300, wait_seconds: 420, energy: 14, busy: false },
        { mode_code: 'train', mode_name: 'قطار', fare: 7720, wait_seconds: 240, energy: 6, busy: true },
        { mode_code: 'flight', mode_name: 'هواپیما', fare: 10480, wait_seconds: 120, energy: 4, busy: false },
      ],
    },
    actions: [back('player.profile.get')],
  }),
  'travel.status': () => ({
    screen: 'travel_status', text: 'در راه',
    view: { from: 'کالدریس', to: 'برن‌هاون', mode_name: 'قطار', remaining_seconds: 8100 },
    actions: [refresh('travel.status'), back('player.profile.get')],
  }),

  'life.me': () => ({
    screen: 'life', text: 'زندگی',
    view: {
      needs: { hunger: 100, sleep: 35, stress: 12, happiness: 68 }, age: 20, stage: { name: 'جوانی' },
      rank: { name: 'نان‌آور', emoji: '🍞' }, next: { name: 'تاجر', emoji: '🛍' }, next_need: 18500,
      worth: { cash: 4200, bank: 21000, property: 0, goods: 2800, savings: 5000, total: 38100 },
      spots: [{ spot: { name: 'تخت هاستل' }, place: { name: 'محله‌ی مسکونی' }, price: 150, rest: 55, relief: 8 }],
      sleep_in_seconds: 0, home: false, notice: '',
    },
    actions: [
      { label: 'کارت من', command: 'life.card', row: 0, kind: 'secondary', icon: 'person' },
      refresh('life.me'), back('player.profile.get'),
    ],
  }),
}

export function mockNativeCommand(command: string, args?: Record<string, unknown>): { screen: string; text: string; view?: unknown; actions?: unknown[] } | undefined {
  const entry = TABLE[command]
  if (!entry) return undefined
  return entry({ args })
}
