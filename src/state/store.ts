// The player's state, kept the way Telegram's clients keep theirs: one
// snapshot, then an ordered log of changes (api/client-api.md section 5.6,
// docs/adr/0034). Framework-free; React reads it through useSync.ts.
//
// The rules, all in this file:
//  * Every change is a record with the player's own counter `pts` (1, 2, 3…
//    with no holes). Records apply strictly in pts order: one at or below
//    the copy's pts is a duplicate and is dropped; the next one applies; a
//    later one is a GAP — it is kept aside for half a second (a reordered
//    push usually arrives meanwhile, Telegram's own advice), then the log is
//    pulled from the copy's pts and the kept records drain behind it.
//  * Within an applied record an entity changes only to a newer version `v`;
//    a delete removes it. So a snapshot read a moment after a record, a
//    command's answer and the push carrying the same records, and a
//    redelivered publication all change nothing twice.
//  * Start: subscribe first (publications are held), then read the snapshot
//    (or a stored copy plus a pull), then apply what was held. Nothing that
//    commits in between is lost.
//  * Pull whenever the app comes back (visible, focus, online, the Mini
//    App's `activated`), after the socket reconnects, and every 20 s while
//    there is no socket — whatever the socket claims, it may be a zombie.
//  * A reset (the client is too far behind, or the log was rebuilt) throws
//    the copy away and reads a fresh snapshot; optimistic overlays survive it.
//  * Optimistic changes (a deposit, using an item, marking the inbox read)
//    are overlays: functions applied on top of the confirmed copy every time
//    it changes (the rebase, for free), dropped when the record caused by
//    their command arrives, when the command fails, or after a timeout. They
//    are never stored.
//  * A notice toasts once per id, only an instant one, and only when it
//    arrived live — never from a snapshot or the backlog of a start.

import type {
  CommandUpdates, KindData, SyncDifference, SyncKind, SyncPublication, SyncRecord, SyncSnapshot,
} from './syncTypes'

export interface SyncTransport {
  getState(): Promise<SyncSnapshot>
  getUpdates(since: number, epoch: string): Promise<SyncDifference>
}

/** A stored copy (persist.ts), when persistence is on. */
export interface SyncPersistence {
  load(playerId: string): Promise<SyncSnapshot | null>
  save(playerId: string, snap: SyncSnapshot): void
  clear(playerId: string): void
}

interface Held { v: number; d: unknown }

/** One entity's optimistic change: the shown data from the confirmed one
 * (undefined in and out: not held / removed). */
export interface OverlayPatch {
  kind: SyncKind
  id: string
  fn: (d: unknown) => unknown
}

interface Overlay {
  key: string
  command: string
  requestId?: string
  patches: OverlayPatch[]
  expires: number
}

/** What React reads: immutable, replaced on every change. */
export interface StoreView {
  ready: boolean
  live: boolean
  pts: number
  epoch: string
  /** changes on every change */
  version: number
  entities: ReadonlyMap<SyncKind, ReadonlyMap<string, unknown>>
  /** "kind/id" of entities under an optimistic overlay */
  pending: ReadonlySet<string>
}

export interface NoticeEvent { id: string; data: KindData['notice'] }

const GAP_GRACE_MS = 500
const POLL_MS = 20_000
const OVERLAY_TTL_MS = 10_000
const PULL_MIN_GAP_MS = 1500

const EMPTY: StoreView = { ready: false, live: false, pts: 0, epoch: '', version: 0, entities: new Map(), pending: new Set() }

export class SyncStore {
  private confirmed = new Map<SyncKind, Map<string, Held>>()
  private pts = 0
  private epoch = ''
  private channels: Record<string, number> = {}
  private ready = false
  private live = false
  private view: StoreView = EMPTY
  private listeners = new Set<() => void>()
  private noticeListeners = new Set<(n: NoticeEvent) => void>()

  /** publications held while starting, or kept aside after a gap, by pts */
  private holding = true
  private held: SyncPublication[] = []
  private aside = new Map<number, SyncRecord>()
  private gapTimer = 0
  private pulling: Promise<void> | null = null
  private pullAgain = false
  private lastPullAt = 0
  private pollTimer = 0

  private overlays = new Map<string, Overlay>()
  private causes = new Set<string>()
  private sessionStartPts = Number.POSITIVE_INFINITY
  private toasted = new Set<string>()

  private transport: SyncTransport | null = null
  private persistence: SyncPersistence | null = null
  private playerId = ''
  private stopFns: (() => void)[] = []
  private saveTimer = 0

  /** For tests, the mock and diagnostics. */
  readonly counters = { applied: 0, duplicates: 0, gaps: 0, pulls: 0, resets: 0, snapshots: 0, overlays: 0, toasts: 0 }

  getView = (): StoreView => this.view
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  onNotice(fn: (n: NoticeEvent) => void): () => void {
    this.noticeListeners.add(fn)
    return () => this.noticeListeners.delete(fn)
  }

  isReady(): boolean { return this.ready }
  currentPts(): number { return this.pts }
  /** the settlement channel's seq as of the snapshot (client-api.md 5.4) */
  channelSeq(channel: string): number | undefined { return this.channels[channel] }

  // -- starting and stopping -----------------------------------------------------------------

  /** Starts the store for a player. The socket is the caller's: it is
   * already subscribed (publications go to receive() and are held until
   * the copy is loaded). */
  async start(playerId: string, transport: SyncTransport, persistence: SyncPersistence | null = null): Promise<void> {
    this.stop()
    this.playerId = playerId
    this.transport = transport // from here publications are held until the copy is loaded
    this.persistence = persistence
    this.holding = true
    let loaded = false
    if (persistence) {
      try {
        const stored = await persistence.load(playerId)
        if (stored) {
          this.loadSnapshot(stored)
          this.publish()
          await this.pull() // a stored copy is caught up, not replaced
          loaded = true
        }
      } catch {
        loaded = false
      }
    }
    if (!loaded) await this.fetchSnapshot()
    this.sessionStartPts = this.pts
    this.holding = false
    const held = this.held
    this.held = []
    for (const p of held) this.receive(p)
    this.installLifecycle()
  }

  stop(): void {
    for (const fn of this.stopFns) fn()
    this.stopFns = []
    clearTimeout(this.gapTimer)
    clearInterval(this.pollTimer)
    clearTimeout(this.saveTimer)
    this.transport = null
    this.ready = false
    this.holding = true
    this.held = []
    this.aside.clear()
    this.confirmed.clear()
    this.overlays.clear()
    this.causes.clear()
    this.toasted.clear()
    this.pts = 0
    this.epoch = ''
    this.channels = {}
    this.sessionStartPts = Number.POSITIVE_INFINITY
    this.view = EMPTY
    this.emit()
  }

  /** Sign-out: the stored copy goes too. */
  forget(): void {
    if (this.persistence && this.playerId) this.persistence.clear(this.playerId)
    this.stop()
  }

  private installLifecycle(): void {
    const back = () => {
      if (document.visibilityState === 'visible') void this.pullSoon()
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    window.addEventListener('online', back)
    window.addEventListener('pageshow', back)
    document.addEventListener('resume', back)
    // the Mini App's own lifecycle (Bot API 8.0): restored from minimised
    const tg = (window as unknown as { Telegram?: { WebApp?: { onEvent?: (e: string, f: () => void) => void; offEvent?: (e: string, f: () => void) => void } } }).Telegram?.WebApp
    tg?.onEvent?.('activated', back)
    this.stopFns.push(() => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
      window.removeEventListener('online', back)
      window.removeEventListener('pageshow', back)
      document.removeEventListener('resume', back)
      tg?.offEvent?.('activated', back)
    })
    this.armPoll()
  }

  /** The socket's state. Coming back up means publications may have been
   * lost: pull. */
  setLive(live: boolean): void {
    if (this.live === live) return
    this.live = live
    this.armPoll()
    if (live && this.ready) void this.pull()
    this.publish()
  }

  private armPoll(): void {
    clearInterval(this.pollTimer)
    if (!this.transport) return
    this.pollTimer = window.setInterval(() => {
      if (!this.live && document.visibilityState === 'visible') void this.pull()
    }, POLL_MS)
  }

  // -- reading the server ------------------------------------------------------------------

  private async fetchSnapshot(): Promise<void> {
    if (!this.transport) return
    const snap = await this.transport.getState()
    this.counters.snapshots++
    this.loadSnapshot(snap)
    this.publish()
    this.scheduleSave()
  }

  private loadSnapshot(s: SyncSnapshot): void {
    this.confirmed.clear()
    for (const [kind, byId] of Object.entries(s.entities ?? {}) as [SyncKind, Record<string, { v: number; d: unknown }>][]) {
      const m = new Map<string, Held>()
      for (const [id, e] of Object.entries(byId ?? {})) m.set(id, { v: e.v, d: e.d })
      this.confirmed.set(kind, m)
    }
    this.pts = s.pts
    this.epoch = s.epoch
    this.channels = { ...(s.channels ?? {}) }
    this.ready = true
    this.aside.clear()
    // every notice in a snapshot is history: none of them toasts
    for (const id of this.confirmed.get('notice')?.keys() ?? []) this.toasted.add(id)
  }

  /** A pull at most every 1.5 s for lifecycle triggers (focus and
   * visibility often fire together). */
  private pullSoon(): Promise<void> {
    if (Date.now() - this.lastPullAt < PULL_MIN_GAP_MS) return Promise.resolve()
    return this.pull()
  }

  /** GET /updates?since= until caught up; a reset reads a new snapshot. */
  pull(): Promise<void> {
    if (!this.transport || !this.ready) return Promise.resolve()
    if (this.pulling) {
      this.pullAgain = true
      return this.pulling
    }
    this.pulling = (async () => {
      do {
        this.pullAgain = false
        this.lastPullAt = Date.now()
        try {
          for (let page = 0; page < 50; page++) {
            this.counters.pulls++
            const d = await this.transport!.getUpdates(this.pts, this.epoch)
            if (d.reset) {
              this.counters.resets++
              await this.fetchSnapshot()
              break
            }
            this.applyRecords(d.updates ?? [])
            if (!d.more) break
          }
        } catch {
          // offline or the server is down: the next trigger pulls again
        }
      } while (this.pullAgain)
      this.drainAside()
      this.publish()
      this.scheduleSave()
    })().finally(() => { this.pulling = null })
    return this.pulling
  }

  // -- the push ----------------------------------------------------------------------------

  /** One publication of the player's channel. Ignored while the store is
   * not started (a server without state sync, or signed out). */
  receive(p: SyncPublication): void {
    if (!this.transport) return
    if (this.holding) {
      this.held.push(p)
      return
    }
    if (p.type === 'updates_too_long') {
      void this.pull()
      return
    }
    if (p.to <= this.pts) {
      this.counters.duplicates += p.updates?.length ?? 1
      return
    }
    this.takeRecords(p.updates ?? [])
  }

  /** A command's own records (POST /command "updates"). */
  commandUpdates(u: CommandUpdates | undefined | null): void {
    if (!u || !u.records?.length || this.holding) return
    this.takeRecords(u.records)
  }

  /** Records from the push or a command: apply what follows on, keep the
   * rest aside, and pull if a gap is still open half a second later. */
  private takeRecords(recs: SyncRecord[]): void {
    for (const r of recs) {
      if (r.pts > this.pts) this.aside.set(r.pts, r)
      else this.counters.duplicates++
    }
    this.drainAside()
    this.publish()
    this.scheduleSave()
    if (this.aside.size > 0) {
      this.counters.gaps++
      clearTimeout(this.gapTimer)
      this.gapTimer = window.setTimeout(() => {
        this.drainAside()
        if (this.aside.size > 0) void this.pull()
      }, GAP_GRACE_MS)
    }
  }

  private drainAside(): void {
    for (const pts of [...this.aside.keys()]) if (pts <= this.pts) this.aside.delete(pts)
    for (;;) {
      const next = this.aside.get(this.pts + 1)
      if (!next) break
      this.aside.delete(next.pts)
      this.applyRecords([next])
    }
  }

  /** Applies records in pts order; one past a gap is kept aside and applied
   * (drainAside) once the gap is filled. Returns how many applied here. */
  private applyRecords(recs: SyncRecord[]): number {
    const sorted = [...recs].sort((a, b) => a.pts - b.pts)
    let n = 0
    for (const r of sorted) {
      if (r.pts <= this.pts) {
        this.counters.duplicates++
        continue
      }
      if (r.pts > this.pts + 1) {
        this.aside.set(r.pts, r)
        continue
      }
      this.pts = r.pts
      n++
      this.counters.applied++
      let byId = this.confirmed.get(r.entity)
      if (!byId) {
        byId = new Map()
        this.confirmed.set(r.entity, byId)
      }
      if (r.op === 'del') {
        byId.delete(r.id)
      } else if (r.op === 'set') {
        const held = byId.get(r.id)
        if (!held || r.v > held.v) byId.set(r.id, { v: r.v, d: r.data })
      }
      if (r.cause) this.confirmCause(r.cause)
      if (r.entity === 'notice' && r.op === 'set') this.maybeToast(r)
    }
    this.drainAside()
    return n
  }

  private maybeToast(r: SyncRecord): void {
    if (this.toasted.has(r.id)) return
    this.toasted.add(r.id)
    const d = r.data as KindData['notice'] | undefined
    if (!d || r.pts <= this.sessionStartPts || !d.instant) return
    this.counters.toasts++
    for (const fn of [...this.noticeListeners]) {
      try { fn({ id: r.id, data: d }) } catch { /* one listener must not stop the others */ }
    }
  }

  // -- optimistic overlays -----------------------------------------------------------------

  /** Shows a command's expected effect at once, until its own records
   * arrive (or it fails, or 10 s pass). */
  addOverlay(key: string, command: string, patches: OverlayPatch[]): void {
    if (!this.ready || patches.length === 0) return
    this.counters.overlays++
    this.overlays.set(key, { key, command, patches, expires: Date.now() + OVERLAY_TTL_MS })
    window.setTimeout(() => this.dropOverlay(key), OVERLAY_TTL_MS + 50)
    this.publish()
  }

  /** The command answered: its request id names the records it caused. */
  bindOverlay(key: string, requestId: string | undefined): void {
    const o = this.overlays.get(key)
    if (!o) return
    if (!requestId) return
    if (this.causes.has(requestId)) {
      this.dropOverlay(key)
      return
    }
    o.requestId = requestId
  }

  dropOverlay(key: string): void {
    if (this.overlays.delete(key)) this.publish()
  }

  private confirmCause(cause: string): void {
    this.causes.add(cause)
    if (this.causes.size > 500) this.causes = new Set([...this.causes].slice(-200))
    for (const o of this.overlays.values()) if (o.requestId === cause) this.overlays.delete(o.key)
  }

  // -- the view ----------------------------------------------------------------------------

  private publish(): void {
    const entities = new Map<SyncKind, Map<string, unknown>>()
    for (const [kind, byId] of this.confirmed) {
      const m = new Map<string, unknown>()
      for (const [id, h] of byId) m.set(id, h.d)
      entities.set(kind, m)
    }
    const pending = new Set<string>()
    const now = Date.now()
    for (const o of this.overlays.values()) {
      if (o.expires < now) continue
      for (const p of o.patches) {
        let m = entities.get(p.kind)
        if (!m) {
          m = new Map()
          entities.set(p.kind, m)
        }
        const next = p.fn(m.get(p.id))
        if (next === undefined) m.delete(p.id)
        else m.set(p.id, next)
        pending.add(`${p.kind}/${p.id}`)
      }
    }
    // keep the identity of entities that did not change, so a selector of
    // one of them does not re-render for another's change
    const prev = this.view.entities
    for (const [kind, m] of entities) {
      const old = prev.get(kind)
      if (!old) continue
      for (const [id, d] of m) if (old.get(id) === d) m.set(id, old.get(id))
    }
    this.view = {
      ready: this.ready, live: this.live, pts: this.pts, epoch: this.epoch,
      version: this.view.version + 1, entities, pending,
    }
    this.emit()
  }

  private emit(): void {
    for (const fn of [...this.listeners]) {
      try { fn() } catch { /* a listener's failure is its own */ }
    }
  }

  private scheduleSave(): void {
    if (!this.persistence || !this.ready) return
    clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => {
      if (!this.persistence || !this.ready) return
      const entities: SyncSnapshot['entities'] = {}
      for (const [kind, byId] of this.confirmed) {
        const out: Record<string, { v: number; d: unknown }> = {}
        for (const [id, h] of byId) out[id] = { v: h.v, d: h.d }
        entities[kind] = out
      }
      this.persistence.save(this.playerId, { pts: this.pts, epoch: this.epoch, server_time: '', entities, channels: this.channels })
    }, 2000)
  }
}

/** The one store of the app. */
export const syncStore = new SyncStore()

/** An entity as the store shows it (confirmed, with overlays on top). */
export function entityOf<K extends SyncKind>(v: StoreView, kind: K, id: string): KindData[K] | undefined {
  return v.entities.get(kind)?.get(id) as KindData[K] | undefined
}

/** Every entity of a kind. */
export function entitiesOf<K extends SyncKind>(v: StoreView, kind: K): [string, KindData[K]][] {
  const m = v.entities.get(kind)
  return m ? ([...m.entries()] as [string, KindData[K]][]) : []
}

/** The player's main wallet: the one the server marks as the game's money. */
export function primaryWallet(v: StoreView): KindData['wallet'] | undefined {
  const all = entitiesOf(v, 'wallet')
  return (all.find(([, w]) => w.primary) ?? all.find(([, w]) => !w.premium))?.[1]
}
