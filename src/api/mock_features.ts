// Mock data for this area's real, server-backed screens (military/war,
// friends/search), used by ?mock=1 (src/api/mock.ts) and by this area's own
// dev harness (src/screens/features/dev). Shaped exactly like the real
// answers: for military.*/war.*, `screen` is the command itself and `text`
// is the full Telegram rendering (api/client-api.md §3.1 — these two areas
// carry no structured view yet); for friends/search, `screen` is the fixed
// name (internal/telegram/screens/views.go) and `view` is structured.

import type { Action, CommandResponse } from './types'

function html(...lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

const NAV_BACK = (command: string, label = 'بازگشت'): Action => ({ label, command, row: 9, kind: 'back', icon: 'action:default' })

const MILITARY: Record<string, () => CommandResponse> = {
  'military.ministry': () => ({
    ok: true, screen: 'military.ministry',
    text: html(
      '<b>وزارت دفاع فنویک</b>',
      'وزیر دفاع: کیارش  ·  فرمانده کل: سارا',
      '',
      'خزانه: 4,820,000 ساپ',
      'صندوق دفاع: 1,240,000 ساپ',
      'سهم دفاع از بودجه: 18%',
      '',
      'نیروها: زمینی — یک لشکر  ·  هوایی — یک گردان  ·  پدافند — چند سامانه',
    ),
    actions: [
      { label: 'نیروهای مسلح', command: 'military.forces', row: 0, kind: 'navigation', icon: 'action:military' },
      { label: 'تدارکات', command: 'military.procure', row: 0, kind: 'primary', icon: 'action:procure' },
      { label: 'جنگ', command: 'war.board', row: 1, kind: 'navigation', icon: 'action:war' },
      { label: 'مجوزهای دفاعی', command: 'military.licences', row: 1, kind: 'navigation', icon: 'action:military' },
      NAV_BACK('player.profile.get'),
    ],
  }),
  'military.forces': () => ({
    ok: true, screen: 'military.forces',
    text: html(
      '<b>نیروهای مسلح فنویک</b>',
      'زمینی: تانک — یک لشکر  ·  نفربر — یک گردان',
      'هوایی: جنگنده — یک گردان  ·  بمب‌افکن — چند فروند',
      'پدافند: سامانه‌ی راداری — چند سامانه',
      '',
      'آمادگی: 82%  ·  هزینه‌ی نگه‌داری: 62,000 ساپ',
    ),
    actions: [
      { label: 'یگان زمینی', command: 'military.branch', args: { branch: 'ground' }, row: 0, kind: 'navigation', icon: 'action:military' },
      { label: 'یگان هوایی', command: 'military.branch', args: { branch: 'air' }, row: 0, kind: 'navigation', icon: 'action:military' },
      { label: 'پدافند هوایی', command: 'military.branch', args: { branch: 'air_defence' }, row: 1, kind: 'navigation', icon: 'action:military' },
      NAV_BACK('military.ministry'),
    ],
  }),
  'military.branch': () => ({
    ok: true, screen: 'military.branch',
    text: html(
      '<b>یگان زمینی — فنویک</b>',
      'تانک نوع «سیمرغ»  ·  240 دستگاه  ·  کیفیت 78',
      '— در کالدریس: 180  ·  در آزور: 60',
      'نفربر «شاهین»  ·  310 دستگاه  ·  کیفیت 65',
      '— در کالدریس: 310',
    ),
    actions: [
      { label: 'استقرار تانک', command: 'military.station', args: { good: 'tank' }, row: 0, kind: 'primary', icon: 'action:station' },
      NAV_BACK('military.forces'),
    ],
  }),
  'military.station': () => ({
    ok: true, screen: 'military.station',
    text: html('<b>استقرار تانک</b>', 'مقصد را انتخاب کنید:'),
    actions: [
      { label: 'آزور', command: 'military.station', args: { good: 'tank', city: 'azor' }, row: 0, kind: 'navigation', icon: 'nav:city' },
      { label: 'کالدریس', command: 'military.station', args: { good: 'tank', city: 'calderis' }, row: 0, kind: 'navigation', icon: 'nav:city' },
      NAV_BACK('military.branch'),
    ],
  }),
  'military.procure': () => ({
    ok: true, screen: 'military.procure',
    text: html('<b>تدارکات — فنویک</b>', 'صندوق دفاع: 1,240,000 ساپ', '', '1) تانک «سیمرغ»  ·  صنایع آراز  ·  کالدریس  ·  موجودی 40  ·  قیمت 8,200'),
    actions: [
      { label: 'خرید تانک «سیمرغ»  ·  8,200', command: 'military.buy', args: { no: '1' }, row: 0, kind: 'primary', icon: 'action:buy' },
      NAV_BACK('military.ministry'),
    ],
  }),
  'military.buy': () => ({
    ok: true, screen: 'military.buy',
    text: html('<b>خرید تانک «سیمرغ»</b>', 'فروشنده: صنایع آراز  ·  کالدریس', 'قیمت: 8,200  ·  موجودی: 40', '', 'چند عدد؟'),
    actions: [
      { label: '1 عدد', command: 'military.buy', args: { no: '1', qty: '1' }, row: 0, kind: 'navigation', icon: 'action:buy' },
      { label: '5 عدد', command: 'military.buy', args: { no: '1', qty: '5' }, row: 0, kind: 'navigation', icon: 'action:buy' },
      { label: 'تأیید خرید', command: 'military.buy', args: { no: '1', qty: '1', yes: '1' }, row: 1, kind: 'confirm', icon: 'action:buy' },
      NAV_BACK('military.procure'),
    ],
  }),
  'military.licences': () => ({
    ok: true, screen: 'military.licences',
    text: html('<b>مجوزهای دفاعی</b>', '2 درخواست در انتظار وزیر دفاع'),
    actions: [
      { label: 'مجوز صنایع آراز', command: 'military.licence', args: { no: '1' }, row: 0, kind: 'navigation', icon: 'action:license' },
      NAV_BACK('military.ministry'),
    ],
  }),
  'military.licence': () => ({
    ok: true, screen: 'military.licence',
    text: html('<b>مجوز دفاعی — صنایع آراز</b>', 'درخواست تولید و فروش تسلیحات زمینی'),
    actions: [
      { label: 'تأیید', command: 'military.licence', args: { no: '1', yes: '1' }, row: 0, kind: 'confirm', icon: 'action:license' },
      NAV_BACK('military.licences'),
    ],
  }),
}

const WAR: Record<string, () => CommandResponse> = {
  'war.board': () => ({
    ok: true, screen: 'war.board',
    text: html(
      '<b>جنگ — فنویک</b>',
      '',
      'جنگ #12: فنویک در برابر کالدریس  ·  فعال از 3 روز پیش',
      'زمین: مرزی',
      '',
      'عملیات‌های اخیر: حمله‌ی هوایی — آسیب سنگین  ·  تلفات ما: چند نفر',
    ),
    actions: [
      { label: 'اتاق جنگ', command: 'war.room', row: 0, kind: 'navigation', icon: 'action:war' },
      { label: 'اعلان جنگ', command: 'war.declare', row: 0, kind: 'primary', icon: 'action:declare' },
      { label: 'پیشنهاد آتش‌بس  ·  #12', command: 'war.propose', args: { no: '12', kind: 'ceasefire' }, row: 1, kind: 'navigation', icon: 'action:propose' },
      NAV_BACK('military.ministry'),
    ],
  }),
  'war.declare': () => ({
    ok: true, screen: 'war.declare',
    text: html('<b>اعلان جنگ</b>', 'هدف را انتخاب کنید:'),
    actions: [
      { label: 'کالدریس', command: 'war.declare', args: { target: 'calderis' }, row: 0, kind: 'navigation', icon: 'nav:city' },
      { label: 'آزور', command: 'war.declare', args: { target: 'azor' }, row: 0, kind: 'navigation', icon: 'nav:city' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.join': () => ({
    ok: true, screen: 'war.join',
    text: html('<b>پیوستن به جنگ</b>', 'به جنگ #12 در کنار فنویک بپیوندید؟'),
    actions: [
      { label: 'تأیید پیوستن', command: 'war.join', args: { no: '12', yes: '1' }, row: 0, kind: 'confirm', icon: 'action:war' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.propose': () => ({
    ok: true, screen: 'war.propose',
    text: html('<b>پیشنهاد آتش‌بس</b>', 'به کالدریس آتش‌بس پیشنهاد می‌شود.'),
    actions: [
      { label: 'ارسال پیشنهاد', command: 'war.propose', args: { no: '12', kind: 'ceasefire', yes: '1' }, row: 0, kind: 'confirm', icon: 'action:propose' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.answer': () => ({
    ok: true, screen: 'war.answer',
    text: html('<b>پاسخ به پیشنهاد صلح</b>', 'کالدریس پیشنهاد آتش‌بس داده است.'),
    actions: [
      { label: 'پذیرفتن', command: 'war.answer', args: { no: '3', a: 'accept' }, row: 0, kind: 'confirm', icon: 'action:war' },
      { label: 'رد کردن', command: 'war.answer', args: { no: '3', a: 'decline' }, row: 0, kind: 'danger', icon: 'action:war' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.resume': () => ({
    ok: true, screen: 'war.resume',
    text: html('<b>از سرگیری جنگ</b>', 'آتش‌بس با کالدریس را می‌شکنید؟'),
    actions: [
      { label: 'تأیید', command: 'war.resume', args: { no: '12', yes: '1' }, row: 0, kind: 'danger', icon: 'action:war' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.room': () => ({
    ok: true, screen: 'war.room',
    text: html('<b>اتاق جنگ — فنویک</b>', 'آمادگی: 82%', '', 'اهداف: بندر کالدریس — 40 کیلومتر'),
    actions: [
      { label: 'بندر کالدریس', command: 'war.target', args: { city: 'calderis_port' }, row: 0, kind: 'navigation', icon: 'action:target' },
      NAV_BACK('war.board'),
    ],
  }),
  'war.target': () => ({
    ok: true, screen: 'war.target',
    text: html('<b>بندر کالدریس</b>', 'گزینه‌های عملیات:', '— حمله‌ی هوایی: 12 جنگنده آماده از کالدریس‌آباد  ·  40 کیلومتر'),
    actions: [
      { label: 'شروع حمله‌ی هوایی', command: 'war.launch', args: { city: 'calderis_port', kind: 'air' }, row: 0, kind: 'primary', icon: 'action:launch' },
      NAV_BACK('war.room'),
    ],
  }),
  'war.launch': () => ({
    ok: true, screen: 'war.launch',
    text: html(
      '<b>شروع عملیات هوایی</b>', 'هدف: بندر کالدریس', 'مهمات: 24 بمب', '',
      'برآورد: احتمال اصابت — زیاد  ·  تلفات ما — کم  ·  آسیب — سنگین',
    ),
    actions: [
      { label: 'تأیید عملیات', command: 'war.launch', args: { city: 'calderis_port', kind: 'air', objective: 'damage', qty: '12', yes: '1' }, row: 0, kind: 'confirm', icon: 'action:launch' },
      NAV_BACK('war.target'),
    ],
  }),
}

const FRIENDS: CommandResponse = {
  ok: true, screen: 'friends',
  view: {
    friends: [
      { id: 'p1', name: 'کاوه', status: 'accepted', incoming: false },
      { id: 'p2', name: 'نیلوفر', status: 'pending', incoming: true },
      { id: 'p3', name: 'آرش', status: 'blocked', incoming: false },
    ],
    page: 1, pages: 1,
  },
  actions: [
    { label: 'قبول نیلوفر', command: 'social.friend.accept', args: { id: 'p2' }, row: 0, kind: 'primary', icon: 'action:accept' },
    NAV_BACK('player.profile.get'),
  ],
}

function searchResponse(query: string): CommandResponse {
  if (!query) {
    return { ok: true, screen: 'search', view: { help: true, by: '', query: '', found: null }, actions: [NAV_BACK('player.profile.get')] }
  }
  return {
    ok: true, screen: 'search',
    view: { help: false, by: 'username', query, found: { id: 'p9', code: 'B3C4D5F', name: 'کاوه', self: false } },
    actions: [
      { label: 'افزودن دوست کاوه', command: 'social.friend.add', args: { id: 'p9' }, row: 0, kind: 'primary', icon: 'action:social' },
      { label: 'پرداخت به کاوه', command: 'bank.pay', args: { code: 'B3C4D5F' }, row: 0, kind: 'navigation', icon: 'action:pay' },
      NAV_BACK('player.profile.get'),
    ],
  }
}

/** A mock answer for this area's real, server-backed commands — used by
 * ?mock=1 and by this area's own dev harness. Returns null for anything
 * outside military/war/friends/search, so the caller can fall back to its
 * own generic mock. */
export function mockFeatureCommand(command: string, args?: Record<string, unknown>): CommandResponse | null {
  if (MILITARY[command]) return MILITARY[command]()
  if (WAR[command]) return WAR[command]()
  if (command === 'social.friend.list') return FRIENDS
  if (command === 'social.search') return searchResponse(String(args?.query ?? args?.q ?? ''))
  return null
}
