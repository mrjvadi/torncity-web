import type { AuthResponse, Bootstrap, CommandResponse, CityMap, AssetManifest, ModelLibrary, RealtimeToken } from './types'
import { report } from '../lib/reporter'

const API_BASE = 'https://apimmo.ir404.site'
const ASSET_BASE = 'https://webomm.ir404.site'
// Centrifugo's WebSocket endpoint (src/api/realtime.ts); same host pattern
// as API_BASE, defined the same way — a plain constant, no CDN, no
// telegram.org/Google dependency (players are in Iran).
const WS_BASE = 'wss://wsmmo.ir404.site'

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
        throw refreshErr
      }
      const token2 = getAccessToken()
      const headers2 = { ...(init.headers ?? {}), Authorization: `Bearer ${token2 ?? ''}` }
      return raw<T>(path, { ...init, headers: headers2 })
    }
    throw e
  }
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
const viewListeners = new Set<(view: Record<string, unknown>) => void>()

export function onView(fn: (view: Record<string, unknown>) => void): () => void {
  viewListeners.add(fn)
  return () => viewListeners.delete(fn)
}

export async function runCommand(
  command: string,
  args: Record<string, string> = {},
  idempotencyKey?: string,
): Promise<CommandResponse> {
  const res = await authed<CommandResponse>('/api/v1/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args, idempotency_key: idempotencyKey }),
  })
  if (res && res.view && typeof res.view === 'object') {
    for (const fn of viewListeners) fn(res.view as Record<string, unknown>)
  }
  return res
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

export function assetUrl(path: string): string {
  return `${ASSET_BASE}/assets/${path}`
}

export { ApiError, API_BASE, ASSET_BASE, WS_BASE }
