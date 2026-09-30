// The live half of the HUD: a Centrifugo WebSocket carrying the player's
// vitals (client-api.md §5) as they change on the server, from any source —
// a Telegram command, another device, energy regen — not only the ones this
// tab itself sent. Everything here is best effort and silent: a failure
// anywhere (no token, a blocked socket, a bad message) is reported for the
// operator (lib/reporter) and otherwise swallowed, because SessionContext's
// existing HTTP polling is the fallback that always works regardless of
// this module.
//
// Loaded lazily (a dynamic import of 'centrifuge' from SessionContext), so
// a player who never gets this far — signed out, or a server that says
// realtime is off (bootstrap.realtime) — never pays for this code in their
// first paint.
import type { Centrifuge as CentrifugeClient } from 'centrifuge'
import type { RealtimeVitals } from './types'
import { getRealtimeToken, WS_BASE } from './client'
import { report } from '../lib/reporter'
import { publishSettlement, setSettlementLive } from './settlementBus'
import type { SettlementEvent } from './types'

export type VitalsListener = (v: RealtimeVitals) => void
export type InboxListener = (unread: number) => void
/** Told true once the socket is actually connected, false on every drop —
 * so the caller can slow its HTTP poll down while the socket is doing the
 * job, and speed it back up the moment it isn't. */
export type LiveListener = (live: boolean) => void

export interface RealtimeHandle {
  disconnect: () => void
}

/** Connects to the player's personal Centrifugo channel — subscribed
 * server-side by the connection token itself, never asked for by this
 * client (client-api.md §5.1) — and calls onVitals for every "vitals"
 * publication, onInbox for every "inbox" one. Resolves to null when even
 * the first token fetch fails (realtime not configured, signed out, no
 * network): the caller then simply keeps polling. */
export async function connectRealtime(
  onVitals: VitalsListener,
  onInbox: InboxListener,
  onLive?: LiveListener,
): Promise<RealtimeHandle | null> {
  let first: Awaited<ReturnType<typeof getRealtimeToken>>
  try {
    first = await getRealtimeToken()
  } catch (e) {
    report('realtime', 'no connection token, staying on polling: ' + String(e))
    return null
  }
  if (!first.token || !first.channels || first.channels.length === 0) {
    return null
  }

  let client: CentrifugeClient
  try {
    const { Centrifuge } = await import('centrifuge')
    client = new Centrifuge(`${WS_BASE}/connection/websocket`, {
      token: first.token,
      // Not called on every reconnect, only when a fresh token is actually
      // needed — the SDK's own backoff (500ms..20s by default) covers a
      // dropped connection in between.
      getToken: async () => {
        const t = await getRealtimeToken()
        return t.token
      },
    })
  } catch (e) {
    report('realtime', 'centrifuge client failed to start: ' + String(e))
    return null
  }

  client.on('publication', (ctx) => {
    // a settlement's channel (client-api.md section 5.4), subscribed
    // server-side by the connection token: handed to the village store
    if (typeof ctx.channel === 'string' && ctx.channel.startsWith('settlement:')) {
      const ev = ctx.data as SettlementEvent | null | undefined
      if (ev && typeof ev === 'object' && typeof ev.type === 'string') {
        publishSettlement({ ...ev, settlement_id: ev.settlement_id || ctx.channel.slice('settlement:'.length) })
      }
      return
    }
    const data = ctx.data as { type?: string; unread?: number } | null | undefined
    if (!data || typeof data !== 'object') return
    if (data.type === 'vitals') {
      onVitals(data as unknown as RealtimeVitals)
    } else if (data.type === 'inbox' && typeof data.unread === 'number') {
      onInbox(data.unread)
    }
  })
  client.on('error', (ctx) => {
    report('realtime', `centrifugo ${ctx.type}: ${ctx.error?.message ?? ''}`)
  })
  client.on('connected', () => { onLive?.(true); setSettlementLive(true) })
  client.on('disconnected', () => { onLive?.(false); setSettlementLive(false) })

  client.connect()

  return {
    disconnect: () => {
      onLive?.(false)
      setSettlementLive(false)
      try {
        client.disconnect()
      } catch {
        // already gone
      }
    },
  }
}
