// The browser's own network-error text ("Failed to fetch", "Load failed"...)
// is not something to show a Persian, RTL player; translate the common ones
// and pass anything that looks like a real (already localized) API message
// straight through.
const NETWORK_HINTS = ['failed to fetch', 'load failed', 'network', 'ns_error']

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  const lower = raw.toLowerCase()
  if (NETWORK_HINTS.some((h) => lower.includes(h))) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'
  }
  return raw
}
