// Dev-only mock views (?mock=1) for the native screens this area owns
// (src/screens/more/*): real view shapes adapted from the goldens at
// internal/telegram/screens/testdata/view-snapshots/fa/*.json, translated
// to plausible Persian sample data. Wired into src/api/mock.ts, the same
// way src/api/mock_views.ts is.

function back(command: string, label = 'بازگشت'): Record<string, unknown> {
  return { label, command, row: 9, kind: 'back', icon: 'action:player' }
}
function refresh(command: string): Record<string, unknown> {
  return { label: 'تازه‌سازی', command, row: 9, kind: 'navigation', icon: 'clock' }
}

type Ctx = { args?: Record<string, unknown> }

const TABLE: Record<string, (ctx: Ctx) => { screen: string; text: string; view?: unknown; actions?: unknown[] }> = {
  'crime.view': (ctx) => {
    const timed = ctx.args?.crime === 'car_theft'
    return {
      screen: 'crime_detail', text: 'جرم',
      view: timed ? {
        crime: { code: 'car_theft', name: 'سرقت خودرو' }, category: { code: 'petty_theft', name: 'جیب‌بری' },
        nerve: 8, duration_seconds: 1800, chance_bps: 4200,
        hits_players: false, hits_np_cs: true, min_take: 800, max_take: 4200,
        jail_min_seconds: 900, jail_max_seconds: 3600, fine_min: 1000, fine_max: 6000,
        blocked: '', need: 0, have: 0, can_commit: true, nonce: 'f6e5d4c3b2a1',
        odds: { base: 3200, skill: 600, awareness: 400, heat: 0, gear: 0 },
        requirements: [{ kind: 'tool', met: true, tool: { code: 'slim_jim', name: 'ابزار قفل‌بازکنی' } }],
      } : {
        crime: { code: 'pickpocketing', name: 'جیب‌بری' }, category: { code: 'petty_theft', name: 'جیب‌بری' },
        nerve: 2, duration_seconds: 0, chance_bps: 5160,
        hits_players: true, hits_np_cs: true, min_take: 15, max_take: 90,
        jail_min_seconds: 120, jail_max_seconds: 360, fine_min: 100, fine_max: 400,
        blocked: '', need: 0, have: 0, can_commit: true, nonce: 'a1b2c3d4e5f6',
        odds: { base: 4000, skill: 800, awareness: 200, heat: -100, gear: 0 },
        requirements: [
          { kind: 'venue', met: true, here: { code: 'train_station', name: 'ایستگاه قطار' },
            venues: [{ code: 'city_centre', name: 'مرکز شهر' }, { code: 'train_station', name: 'ایستگاه قطار' }] },
        ],
      },
      actions: [
        timed
          ? { label: 'انجام جرم', command: 'crime.commit', args: { crime: 'car_theft', nonce: 'f6e5d4c3b2a1' }, row: 0, kind: 'primary', icon: 'crime' }
          : { label: 'انجام جرم', command: 'crime.commit', args: { crime: 'pickpocketing', nonce: 'a1b2c3d4e5f6' }, row: 0, kind: 'primary', icon: 'crime' },
        back('crime.list'),
      ],
    }
  },
  'crime.commit': (ctx) => {
    if (ctx.args?.crime === 'car_theft') {
      return {
        screen: 'crime_started', text: 'جرم آغاز شد',
        view: {
          crime: { code: 'car_theft', name: 'سرقت خودرو' }, venue: { code: 'harbour', name: 'بندر' },
          duration_seconds: 1800, ends_at: new Date(Date.now() + 1800000).toISOString(),
          nerve: { nerve: 6, max: 20 },
        },
        actions: [refresh('crime.hub'), back('crime.hub')],
      }
    }
    return {
      screen: 'crime_result', text: 'نتیجه',
      view: {
        player: 'سارا', crime: { code: 'pickpocketing', name: 'جیب‌بری' }, venue: { code: 'train_station', name: 'ایستگاه قطار' },
        city: 'کالدریس', city_code: 'calderis', result: 'succeeded', victim_player: true,
        take: 1500, dry_spell: false, xp: 5, criminal_xp: 8, level: 0,
        skills: [{ skill: 'stealth', xp: 12, level: 2 }],
        heat: { heat: 23, max: 100, wanted: 2, stars: 5 }, nerve: { nerve: 14, max: 20, full_in_seconds: 1800 },
        jail: null, fine: 0, fine_paid: 0, loot: null, notice: false,
      },
      actions: [refresh('crime.hub'), back('crime.hub')],
    }
  },

  'job.list': (ctx) => ({
    screen: 'job_openings', text: 'فرصت‌های شغلی',
    view: {
      city: 'کالدریس', city_code: 'calderis', travelling: false, employed: true,
      current: { career_code: 'retail', career_name: 'تجارت', rank: 'senior', title: 'فروشنده‌ی ارشد' },
      openings: [
        { eligible: true, job: { career_code: 'retail', career_name: 'تجارت', rank: 'entry', title: 'کارآموز فروش' }, pay: 120 },
        { eligible: true, job: { career_code: 'logistics', career_name: 'لجستیک', rank: 'entry', title: 'پیک' }, pay: 130 },
        { eligible: false, job: { career_code: 'technology', career_name: 'فناوری', rank: 'entry', title: 'برنامه‌نویس تازه‌کار' }, pay: 260 },
      ],
      companies: [
        { no: 4, company: 'نان و شیرینی کاوه', job: { career_code: 'retail', career_name: 'تجارت', rank: 'entry', title: 'فروشنده' }, pay: 300, eligible: true },
      ],
      page: Number(ctx.args?.page ?? 1), pages: 2,
    },
    actions: [back('job.status'), refresh('job.list')],
  }),
  'job.view': () => ({
    screen: 'job_detail', text: 'فرصت شغلی',
    view: {
      job: { career_code: 'retail', career_name: 'تجارت', rank: 'entry', title: 'کارآموز فروش' },
      city: 'کالدریس', city_code: 'calderis', pay: 120, energy_cost: 15,
      requirements: [{ kind: 'residence', met: true, city: 'کالدریس', city_code: 'calderis' }],
      can_apply: true, employed: false,
    },
    actions: [
      { label: 'درخواست استخدام', command: 'job.apply', args: { role: 'retail' }, row: 0, kind: 'primary', icon: 'work' },
      back('job.list'),
    ],
  }),

  'shop.list': () => ({
    screen: 'shops', text: 'مغازه‌ها',
    view: {
      city: 'کالدریس', city_code: 'calderis', place: { code: 'bazaar', name: 'بازار' },
      shops: [
        { shop: { code: 'grocery', name: 'خواربارفروشی' }, place: { code: 'bazaar', name: 'بازار' }, here: true },
        { shop: { code: 'hardware_store', name: 'ابزارفروشی' }, place: { code: 'bazaar', name: 'بازار' }, here: false },
      ],
    },
    actions: [
      { label: 'کیف', command: 'inventory.show', row: 0, kind: 'secondary', icon: 'm_backpack' },
      back('map.list'),
    ],
  }),

  'player.settings': () => ({
    screen: 'settings', text: 'تنظیمات',
    view: { language: 'fa', languages: ['en', 'fa'], language_changed: false },
    actions: [
      { label: 'English', command: 'player.language.set', args: { lang: 'en' }, row: 0, kind: 'secondary', icon: 'world' },
      { label: 'فارسی', command: 'player.language.set', args: { lang: 'fa' }, row: 0, kind: 'primary', icon: 'world' },
      back('player.profile.get'),
    ],
  }),

  'skills.list': () => ({
    screen: 'skills', text: 'مهارت‌ها',
    view: {
      lines: [
        { code: 'management', level: 2, xp: 400, next: 600, percent: 33, max: false },
        { code: 'programming', level: 1, xp: 120, next: 300, percent: 40, max: false },
        { code: 'cooking', level: 10, xp: 9000, next: 0, percent: 0, max: true },
      ],
    },
    actions: [back('player.profile.get'), refresh('skills.list')],
  }),

  'achievement.list': () => ({
    screen: 'achievements', text: 'دستاوردها',
    view: {
      lines: [
        { achievement: { code: 'first_shift', name: 'اولین روز کاری' }, count: 1, done: 1, reward: 100, earned: true, cash: 100 },
        { achievement: { code: 'homeowner', name: 'صاحب‌خانه' }, count: 1, done: 1, reward: 500, earned: true, cash: 500 },
        { achievement: { code: 'ten_crimes', name: 'جنایتکار حرفه‌ای' }, count: 10, done: 4, reward: 500, earned: false, cash: 0 },
        { achievement: { code: 'hard_worker', name: 'کارگر سخت‌کوش' }, count: 25, done: 3, reward: 0, earned: false, cash: 0 },
      ],
    },
    actions: [back('player.profile.get')],
  }),

  'life.card': (ctx) => ({
    screen: 'card', text: 'کارت',
    view: {
      name: 'سارا', code: 'K7Q2M9A', avatar: { code: 'fox', emoji: '🦊', photo: false },
      bio: 'عاشق سفر و کتاب؛ روزی شرکت خودم را می‌سازم', rank: { code: 'breadwinner', name: 'نان‌آور', emoji: '🍞' },
      age: 20, stage: { code: 'youth', name: 'جوانی' }, level: 7, achievements: 3, entries: 9,
      joined_at: '2026-08-24T11:05:00Z', self: !ctx.args?.code, notice: '',
    },
    actions: [
      { label: 'خاطرات', command: 'life.history', args: { code: 'K7Q2M9A' }, row: 0, kind: 'navigation', icon: 'book' },
      back('player.profile.get'),
    ],
  }),

  'loan.hub': () => ({
    screen: 'finance_hub', text: 'بانک',
    view: {
      country: { code: 'default_country', kind: 'country', name: 'مشترک‌المنافع' },
      credit: { score: 672, min: 300, max: 850, payment_bps: 9000, debt_bps: 7500, history_bps: 4000, income_bps: 6500, worth_bps: 3000, missed: 1, defaults: 0 },
      policy_bps: 1500,
      products: [
        { product: { code: 'personal', name: 'وام شخصی' }, kind: 'player', rate_bps: 2600, limit: 40000, min_score: 500 },
        { product: { code: 'mortgage', name: 'وام مسکن' }, kind: 'mortgage', rate_bps: 2100, limit: 320000, min_score: 560 },
        { product: { code: 'business', name: 'وام کسب‌وکار' }, kind: 'company', rate_bps: 2300, limit: 0, min_score: 700 },
      ],
      loans: [
        { no: 12, product: { code: 'personal', name: 'وام شخصی' }, company: { code: '', name: '' }, status: 'active', next: 1786, owed: 21430, left: 12, arrears: 0 },
        { no: 9, product: { code: 'business', name: 'وام کسب‌وکار' }, company: { code: 'Q7M2K9B', name: 'نان و شیرینی کاوه' }, status: 'active', next: 3900, owed: 42000, left: 11, arrears: 0 },
        { no: 4, product: { code: 'personal', name: 'وام شخصی' }, company: { code: '', name: '' }, status: 'repaid', next: 0, owed: 0, left: 0, arrears: 0 },
      ],
      savings: 15000, savings_bps: 900, lendable: 800000, notice: '',
    },
    actions: [
      { label: 'سپرده', command: 'save.show', row: 0, kind: 'secondary', icon: 'coins' },
      { label: 'بیمه', command: 'insure.list', row: 0, kind: 'secondary', icon: 'shield' },
      { label: 'بورس', command: 'stock.list', row: 1, kind: 'navigation', icon: 'chart' },
      { label: 'طلا', command: 'gold.show', row: 1, kind: 'navigation', icon: 'diamond' },
      { label: 'دارایی‌های من', command: 'stock.mine', row: 2, kind: 'navigation', icon: 'briefcase' },
      back('bank.show'),
    ],
  }),
}

export function mockMoreCommand(command: string, args?: Record<string, unknown>): { screen: string; text: string; view?: unknown; actions?: unknown[] } | undefined {
  const entry = TABLE[command]
  if (!entry) return undefined
  return entry({ args })
}
