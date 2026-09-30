import { t, type Key } from '../i18n'

// The browser's own network-error text ("Failed to fetch", "Load failed"...)
// is not something to show a Persian, RTL player; translate the common ones
// and pass anything that looks like a real (already localized) API message
// straight through.
const NETWORK_HINTS = ['failed to fetch', 'load failed', 'network', 'ns_error']

// The API's error codes (api/client-api.md section 6), in the player's words.
const CODES = ['invalid_code', 'invalid_init_data', 'init_data_expired', 'init_data_replayed', 'rate_limited', 'refresh_token_reused', 'invalid_refresh_token', 'unauthorized', 'banned', 'timeout', 'internal']

export function friendlyError(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  if (typeof code === 'string' && CODES.includes(code)) return t(`err.${code}` as Key)
  const raw = e instanceof Error ? e.message : String(e)
  const lower = raw.toLowerCase()
  if (NETWORK_HINTS.some((h) => lower.includes(h))) {
    return t('err.network')
  }
  return raw
}
