// Dev-only mock answers (?mock=1) for the fallback family
// (src/screens/basic): results, confirmations, refusals and a few content
// pages, with Telegram-style text like the real server sends and the views
// the goldens carry (internal/telegram/screens/testdata/view-snapshots).

type Ctx = Record<string, unknown> | undefined
type Answer = { screen: string; text: string; view?: unknown; actions?: unknown[] }

const back = (command: string) => ({ label: '🔙 بازگشت', command, row: 9, kind: 'back', icon: 'action:player' })

export function mockBasicCommand(command: string, args?: Ctx): Answer | null {
  switch (command) {
    case 'job.work':
      return {
        screen: 'shift_worked',
        text: '✅ <b>شیفت تمام شد</b>\n\n💵 درآمد ناخالص: 1,850 ساپ\n🏛 مالیات: 185 ساپ\n💰 خالص: 1,665 ساپ\n⭐ تجربه: +12\n\nعملکردت کمی بهتر شد.',
        view: { gross: 1850, tax: 185, net: 1665, xp: 12, performance: 66, performance_delta: 2, energy: 76, max_energy: 100 },
        actions: [{ label: '💼 وضعیت شغل', command: 'job.status', row: 0, kind: 'primary', icon: 'work' }, back('job.status')],
      }
    case 'inventory.item':
      return {
        screen: 'item_detail',
        text: '🍞 <b>نان</b>\n\nدسته: غذا\nتعداد: 3\nارزش هر عدد: 40 ساپ\n\nانرژی +10 و شادی +2 می‌دهد.',
        view: { item: { code: 'bread', name: 'نان' }, category: 'food', qty: 3, worth: 40, usable: true },
        actions: [
          { label: '🍽 مصرف کن', command: 'inventory.use', args: { item: 'bread' }, row: 0, kind: 'primary', icon: 'action:default' },
          { label: '🗑 دور بینداز', command: 'inventory.drop', args: { item: 'bread' }, row: 1, kind: 'danger', icon: 'action:default' },
          back('inventory.show'),
        ],
      }
    case 'inventory.use':
      return {
        screen: 'item_used',
        text: '🍞 <b>نان خوردی</b>\n\nانرژی: 40 ← 50\nمانده: 2 عدد\n\nدوباره تا 30 دقیقه دیگر می‌توانی.',
        view: { item: { code: 'bread', name: 'نان' }, left: 2, changes: [{ target: 'energy', before: 40, after: 50, max: 100 }] },
        actions: [back('inventory.show')],
      }
    case 'bank.pay':
      return {
        screen: 'pay_confirm',
        text: '💸 <b>پرداخت به بازیکن</b>\n\nگیرنده: کاوه\nمبلغ: 5,000 ساپ\nکارمزد: 0 ساپ\nجمع: 5,000 ساپ\n\nآیا مطمئنی؟',
        view: { payee_name: 'کاوه', payee_code: 'B3C4D5F', amount: 5000, fee: 0, total: 5000, after: 7450 },
        actions: [
          { label: '✅ بپرداز', command: 'bank.pay.send', args: { to: 'B3C4D5F', amount: '5000' }, row: 0, kind: 'primary', icon: 'action:pay' },
          back('bank.show'),
        ],
      }
    case 'bank.pay.send':
      return {
        screen: 'pay_sent',
        text: '✅ <b>پرداخت شد</b>\n\n5,000 ساپ برای کاوه فرستاده شد.',
        view: { payee_name: 'کاوه', amount: 5000, fee: 0, method: 'cash' },
        actions: [back('bank.show')],
      }
    case 'mock.refusal':
      return {
        screen: 'refusal',
        text: '⛔ <b>ثبت‌نام انجام نشد</b>\n\nبرای این دوره باید سطح 4 داشته باشی؛ تو الان سطح 2 هستی.\nمدرک «کمک‌های اولیه» هم لازم است.',
        view: { kind: 'course_requirements' },
        actions: [back('education.list')],
      }
    case 'map.list':
      return {
        screen: 'city_map',
        text: '🗺 <b>نقشه‌ی کالدریس</b>\n\nالان اینجایی: مرکز شهر\n\n• بازار · 15 ثانیه پیاده\n• بندر · 3 دقیقه پیاده · بانک\n• منطقه‌ی صنعتی · 1 دقیقه پیاده',
        view: { city: 'کالدریس', city_code: 'calderis', here: { code: 'old_town', name: 'مرکز شهر' }, places: [] },
        actions: [
          { label: '🛒 مغازه‌ها', command: 'shop.list', row: 0, kind: 'navigation', icon: 'cart' },
          { label: '✈️ سفر بین‌شهری', command: 'map.cities', row: 0, kind: 'navigation', icon: 'plane' },
          back('player.profile.get'),
        ],
      }
    case 'device.list':
      return {
        screen: 'devices',
        text: '📱 <b>دستگاه‌های متصل</b>\n\nمرورگر وب: فعال · همین حالا\nاندروید: آخرین ورود دیروز',
        view: { devices: [] },
        actions: [back('player.settings')],
      }
    default:
      return null
  }
  void args
}
