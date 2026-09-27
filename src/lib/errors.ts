// The browser's own network-error text ("Failed to fetch", "Load failed"...)
// is not something to show a Persian, RTL player; translate the common ones
// and pass anything that looks like a real (already localized) API message
// straight through.
const NETWORK_HINTS = ['failed to fetch', 'load failed', 'network', 'ns_error']

// The API's error codes (api/client-api.md section 6), in the player's words.
const CODES: Record<string, string> = {
  invalid_code: 'این کد درست نیست، یا قبلاً استفاده شده، یا منقضی شده. از ربات یک کد تازه بگیرید.',
  invalid_init_data: 'ورود از طریق تلگرام انجام نشد. صفحه را دوباره باز کنید.',
  init_data_expired: 'اطلاعات ورود تلگرام قدیمی شده. صفحه را دوباره باز کنید.',
  init_data_replayed: 'این ورود قبلاً استفاده شده. صفحه را دوباره باز کنید.',
  rate_limited: 'درخواست‌ها زیاد شد. چند ثانیه صبر کنید و دوباره امتحان کنید.',
  refresh_token_reused: 'برای امنیت، از این دستگاه خارج شدید. دوباره وارد شوید.',
  invalid_refresh_token: 'نشست شما تمام شده. دوباره وارد شوید.',
  unauthorized: 'نشست شما تمام شده. دوباره وارد شوید.',
  banned: 'این حساب مسدود شده است.',
  timeout: 'سرور دیر جواب داد. دوباره امتحان کنید.',
  internal: 'مشکلی پیش آمد. کمی بعد دوباره امتحان کنید.',
}

export function friendlyError(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  if (typeof code === 'string' && CODES[code]) return CODES[code]
  const raw = e instanceof Error ? e.message : String(e)
  const lower = raw.toLowerCase()
  if (NETWORK_HINTS.some((h) => lower.includes(h))) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'
  }
  return raw
}
