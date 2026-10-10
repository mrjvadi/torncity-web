import { liveView } from '../lib/live'
import { setDisplayMoney, type DisplayMoney } from '../lib/money'
import { observeServerTime } from '../village/clock'
import type { AuthResponse, Bootstrap, CommandResponse, CityMap, AssetManifest, ModelLibrary, RealtimeToken, WorldInfo, VillageLayout, SettlementPlayers, PlayerStatus } from './types'
import { report } from '../lib/reporter'
import { syncStore } from '../state/store'
import { beforeCommand } from '../state/optimistic'
import type { SyncDifference, SyncSnapshot } from '../state/syncTypes'

// VITE_API_BASE / VITE_WS_BASE point a dev build at a local stack (never set in production builds)
const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'https://apimmo.ir404.site'
const ASSET_BASE = 'https://webomm.ir404.site'
// Centrifugo's WebSocket endpoint (src/api/realtime.ts); same host pattern
// as API_BASE, defined the same way — a plain constant, no CDN, no
// telegram.org/Google dependency (players are in Iran).
const WS_BASE: string = import.meta.env.VITE_WS_BASE ?? 'wss://wsmmo.ir404.site'

const LS_ACCESS = 'tc.access_token'
const LS_REFRESH = 'tc.refresh_token'
const LS_PLAYER = 'tc.player'

export function getStoredPlayer(): AuthResponse['player'] | null {
  const raw = localStorage.getItem(LS_PLAYER)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem(LS_ACCESS)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(LS_REFRESH)
}

function storeAuth(auth: AuthResponse): void {
  localStorage.setItem(LS_ACCESS, auth.access_token)
  localStorage.setItem(LS_REFRESH, auth.refresh_token)
  localStorage.setItem(LS_PLAYER, JSON.stringify(auth.player))
}

export function clearAuth(): void {
  localStorage.removeItem(LS_ACCESS)
  localStorage.removeItem(LS_REFRESH)
  localStorage.removeItem(LS_PLAYER)
}

export function isLoggedIn(): boolean {
  return !!getAccessToken() && !!getRefreshToken()
}

class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function raw<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string } } | null)?.error
    throw new ApiError(err?.code ?? 'http_error', err?.message ?? res.statusText, res.status)
  }
  return body as T
}

let refreshing: Promise<void> | null = null

async function doRefresh(): Promise<void> {
  const rt = getRefreshToken()
  if (!rt) throw new ApiError('unauthorized', 'not signed in', 401)
  const auth = await raw<AuthResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  })
  storeAuth(auth)
}

async function authed<T>(path: string, init: RequestInit): Promise<T> {
  const token = getAccessToken()
  const headers = { ...(init.headers ?? {}), Authorization: `Bearer ${token ?? ''}` }
  try {
    return await raw<T>(path, { ...init, headers })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      if (!refreshing) {
        refreshing = doRefresh().finally(() => {
          refreshing = null
        })
      }
      try {
        await refreshing
      } catch (refreshErr) {
        clearAuth()
        report('auth', 'refresh failed, signed out')
        // the session tells the app: inside Telegram it signs in again with Telegram's own proof
        window.dispatchEvent(new Event('tc-auth-lost'))
        throw refreshErr
      }
      const token2 = getAccessToken()
      const headers2 = { ...(init.headers ?? {}), Authorization: `Bearer ${token2 ?? ''}` }
      return raw<T>(path, { ...init, headers: headers2 })
    }
    throw e
  }
}

/** Like authed(), but hands back the raw Response (any status) so a caller
 * can read a binary body or a 304; the 401 refresh dance is the same. */
async function authedResponse(path: string, init: RequestInit): Promise<Response> {
  const send = () => fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${getAccessToken() ?? ''}` } })
  const res = await send()
  if (res.status !== 401) return res
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  try {
    await refreshing
  } catch (refreshErr) {
    clearAuth()
    report('auth', 'refresh failed, signed out')
    // the session tells the app: inside Telegram it signs in again with Telegram's own proof
    window.dispatchEvent(new Event('tc-auth-lost'))
    throw refreshErr
  }
  return send()
}

async function errorOf(res: Response): Promise<ApiError> {
  let body: { error?: { code: string; message: string } } | null = null
  try {
    body = await res.json()
  } catch {
    // no body
  }
  return new ApiError(body?.error?.code ?? 'http_error', body?.error?.message ?? res.statusText, res.status)
}

/** The player's own photo, as our server keeps it (a proxy of Telegram's profile photo): an object URL, or null when
 * there is none (404, not signed in, an older server). The caller revokes the URL. */
export async function fetchMyPhoto(): Promise<string | null> {
  const res = await authedResponse('/api/me/photo', { method: 'GET' })
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null
  return URL.createObjectURL(await res.blob())
}

export async function loginWithLinkCode(code: string, deviceName: string): Promise<AuthResponse> {
  const auth = await raw<AuthResponse>('/api/v1/auth/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, device_name: deviceName }),
  })
  storeAuth(auth)
  return auth
}

export async function loginWithTelegram(initData: string, deviceName: string): Promise<AuthResponse> {
  const auth = await raw<AuthResponse>('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: initData, device_name: deviceName }),
  })
  storeAuth(auth)
  return auth
}

export async function logout(): Promise<void> {
  try {
    await authed('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    // sign out locally regardless
  }
  clearAuth()
}

export async function getBootstrap(): Promise<Bootstrap> {
  return authed<Bootstrap>('/api/v1/bootstrap', { method: 'GET' })
}

/** Every command answer's view, for whoever keeps a live copy of the
 * player's numbers (the HUD): any screen that carries cash, energy and the
 * rest brings them up to date, whichever screen fetched it. */
const viewListeners = new Set<(view: Record<string, unknown>, screen: string) => void>()

export function onView(fn: (view: Record<string, unknown>, screen: string) => void): () => void {
  viewListeners.add(fn)
  return () => viewListeners.delete(fn)
}

/** Command arguments: strings, except where the contract names a number or a
 * bool (settlement.build.place takes x and y as numbers, rotated as a bool),
 * or a list of lots (settlement.build.place_many takes lots: [{x, y}]). */
export type CommandArgs = Record<string, string | number | boolean | { x: number; y: number }[] | { permission: string; limit?: number }[]>

export async function runCommand(
  command: string,
  args: CommandArgs = {},
  idempotencyKey?: string,
): Promise<CommandResponse> {
  // state sync (store.ts): a cheap, predictable write shows its effect at
  // once; the answer's own records confirm it, or a refusal takes it away
  beforeCommand(command, args as Record<string, unknown>, idempotencyKey)
  let res: CommandResponse
  try {
    res = await authed<CommandResponse>('/api/v1/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args, idempotency_key: idempotencyKey }),
    })
  } catch (e) {
    if (idempotencyKey) syncStore.dropOverlay(idempotencyKey)
    throw e
  }
  // the viewer's display money rides on every neutral answer (lib/money.ts); an answer without it means SUP only
  if (res && typeof res === 'object' && res.screen) setDisplayMoney((res as { money?: DisplayMoney | null }).money ?? null)
  if (res?.updates) syncStore.commandUpdates(res.updates)
  if (idempotencyKey) {
    if (res?.ok === false) syncStore.dropOverlay(idempotencyKey)
    else syncStore.bindOverlay(idempotencyKey, res?.request_id)
  }
  // the server leaves an action's id empty when it equals its command: the id is then the command, so the wording
  // and the screens' filters by id work the same whichever way the server sent it
  if (res && Array.isArray(res.actions)) for (const a of res.actions) if (!a.id && a.command) a.id = a.command
  if (res && res.view && typeof res.view === 'object') {
    for (const fn of viewListeners) fn(res.view as Record<string, unknown>, res.screen ?? '')
    // the view's remaining/elapsed fields become end times on the server's clock (lib/live.ts)
    res.view = liveView(res.view)
  }
  return res
}

// -- state sync (client-api.md section 5.6) ----------------------------------

/** GET /state: every entity and the pts it is current to. */
export async function getState(): Promise<SyncSnapshot> {
  const sent = Date.now()
  const snap = await authed<SyncSnapshot>('/api/v1/state', { method: 'GET' })
  // the snapshot carries the server's time: refine the offset of the shared clock with the round trip
  observeServerTime(snap?.server_time, sent, Date.now())
  return snap
}

/** GET /updates?since=: what came after, or a reset. */
export async function getUpdates(since: number, epoch: string): Promise<SyncDifference> {
  const q = `?since=${encodeURIComponent(String(since))}` + (epoch ? `&epoch=${encodeURIComponent(epoch)}` : '')
  return authed<SyncDifference>(`/api/v1/updates${q}`, { method: 'GET' })
}

/** A Centrifugo connection token: the player's own channel is subscribed
 * server-side (the token's "channels" claim), never asked for by the
 * client (client-api.md §5.1). Fetched again whenever the SDK's own
 * getToken callback asks for one. */
export async function getRealtimeToken(): Promise<RealtimeToken> {
  return authed<RealtimeToken>('/api/v1/realtime/token', { method: 'GET' })
}

export async function getContent(sinceVersion?: string): Promise<unknown> {
  const q = sinceVersion ? `?since=${encodeURIComponent(sinceVersion)}` : ''
  return authed(`/api/v1/content${q}`, { method: 'GET' })
}

export async function getCityMap(code?: string): Promise<CityMap> {
  const q = code ? `?code=${encodeURIComponent(code)}` : ''
  return authed<CityMap>(`/api/v1/world/city${q}`, { method: 'GET' })
}

export async function getAssetManifest(): Promise<AssetManifest> {
  const res = await fetch(`${ASSET_BASE}/assets/manifest.json`)
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  return res.json()
}

export async function getModelLibrary(path: string): Promise<ModelLibrary> {
  const url = path.startsWith('http') ? path : `${ASSET_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`library ${res.status}`)
  return res.json()
}

// -- The world and the village (client-api.md section 4.3, 5.5) -------------

let worldCache: Promise<WorldInfo> | null = null

/** The active world's numbers; a world does not change while the app is
 * open, so it is read once and kept (the server revalidates by ETag for
 * anything that comes back to it later). */
export function getWorld(): Promise<WorldInfo> {
  if (!worldCache) {
    worldCache = authed<WorldInfo>('/api/v1/world', { method: 'GET' }).catch((e) => {
      worldCache = null
      throw e
    })
  }
  return worldCache
}

/** One binary chunk (Content-Type application/vnd.torncity.chunk). Chunks
 * are immutable, so the browser's HTTP cache serves repeats. */
export async function getChunkBytes(face: number, lod: number, x: number, y: number): Promise<ArrayBuffer> {
  const res = await authedResponse(`/api/v1/world/chunks/${face}/${lod}/${x}/${y}`, { method: 'GET' })
  if (!res.ok) throw await errorOf(res)
  return res.arrayBuffer()
}

/** The layout's ETag, spelled the way the server does ("<version>.<detail>"),
 * so a copy in hand can be revalidated without reading a response header
 * the browser might hide from cross-origin scripts. */
export function layoutEtag(l: Pick<VillageLayout, 'version' | 'detail'>): string {
  return etags.get(l) ?? `"${l.version}.${l.detail}"`
}
/** The ETag the server really sent with a layout (it also carries the woods mark, ADR 0065), when the browser lets the page read it. */
const etags = new WeakMap<object, string>()

/** GET /settlements/{id}/layout. With `have` (the copy already held) sends
 * If-None-Match and answers `null` on 304. */
export async function getLayout(id: string, have?: VillageLayout | null): Promise<VillageLayout | null> {
  const path = `/api/v1/settlements/${encodeURIComponent(id)}/layout`
  const go = (conditional: boolean) => authedResponse(path, {
    method: 'GET',
    headers: conditional && have ? { 'If-None-Match': layoutEtag(have) } : {},
  })
  let res: Response
  try {
    res = await go(true)
  } catch (e) {
    // a server that does not allow the header cross-origin fails the
    // preflight: ask again without it
    if (!have) throw e
    res = await go(false)
  }
  if (res.status === 304) return null
  if (!res.ok) throw await errorOf(res)
  const layout = (await res.json()) as VillageLayout
  const tag = res.headers.get('ETag')
  if (tag) etags.set(layout, tag)
  return layout
}

export async function getSettlementPlayers(id: string): Promise<SettlementPlayers> {
  return authed<SettlementPlayers>(`/api/v1/settlements/${encodeURIComponent(id)}/players`, { method: 'GET' })
}

export async function getPlayerStatus(id: string): Promise<PlayerStatus> {
  return authed<PlayerStatus>(`/api/v1/players/${encodeURIComponent(id)}/status`, { method: 'GET' })
}

/** Keeps the player "online" while the app is open but idle (section 5.5). */
export async function heartbeat(): Promise<{ ok: boolean; ttl_seconds: number }> {
  return authed('/api/v1/realtime/heartbeat', { method: 'POST' })
}

export function assetUrl(path: string): string {
  return `${ASSET_BASE}/assets/${path}`
}

export { ApiError, API_BASE, ASSET_BASE, WS_BASE }
