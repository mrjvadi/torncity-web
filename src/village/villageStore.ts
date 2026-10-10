// One settlement's client-side picture: the world's numbers, the layout the
// server last told us, the roster, and the live feed of its channel. It keeps
// that picture true by the rules of client-api.md section 5.4:
//
//  * `seq` orders the channel. A publication whose seq is not the last one
//    plus one (a jump, or lower than the last) means one was missed: the
//    layout and the roster are fetched again instead of trusted. An equal seq
//    is a redelivery and is ignored.
//  * `layout_version` on a publication that changes the layout names the
//    version the server will report for each kind of viewer; when ours is not
//    the same, the layout is fetched again (If-None-Match, so an unchanged
//    one costs a 304).
//  * A build's progress is never in the version: it is counted from
//    started_at/finish_at, and a fetch is made just after finish_at in case
//    the publication never came.
//  * State sync (client-api.md section 5.6, ADR 0034 P3): the player's own
//    log carries this settlement's summary with the layout version for THIS
//    viewer. When it names a version the held layout is not, the layout is
//    fetched — so a change whose channel publication was lost still shows.
//    The snapshot's `channels` seeds `seq`, so the first publication is
//    compared with the server's count, not taken on trust.
//
// A store lives as long as the app (screens come and go, the picture stays),
// listens to the settlement bus while at least one screen holds it, and hands
// React an immutable snapshot through useSyncExternalStore.

import * as api from '../api/client'
import { subscribeSettlement, isSettlementLive, onSettlementLive } from '../api/settlementBus'
import type { SettlementEvent, SettlementPlayers, VillageLayout, WorldInfo } from '../api/types'
import { decodeChunk } from './chunk'
import { WorldSampler } from './worldSampler'
import { loadVillageGround, type VillageGround } from './terrainModel'
import { serverNow } from './clock'
import { report } from '../lib/reporter'
import { entityOf, syncStore } from '../state/store'

export interface VillageSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  world: WorldInfo | null
  layout: VillageLayout | null
  ground: VillageGround | null
  players: SettlementPlayers | null
  /** 'forbidden' when the roster is refused (not a member). */
  playersError: string | null
  /** Bumped by every event that could change what a status screen shows. */
  tick: number
  /** The last events, newest first, for toasts. */
  lastEvent: SettlementEvent | null
  live: boolean
}

const EMPTY: VillageSnapshot = { status: 'idle', error: null, world: null, layout: null, ground: null, players: null, playersError: null, tick: 0, lastEvent: null, live: false }

/** The version a layout will have for this viewer, out of a publication's set. */
export function versionFor(layout: VillageLayout, v: NonNullable<SettlementEvent['layout_version']>): string {
  return layout.viewer.can_place ? v.head : layout.viewer.member ? v.member : v.public
}

export class VillageStore {
  private snap: VillageSnapshot = EMPTY
  private listeners = new Set<() => void>()
  private holders = 0
  private unsubBus: (() => void) | null = null
  private unsubLive: (() => void) | null = null
  private unsubSync: (() => void) | null = null
  /** the summary's layout version last acted on */
  private syncVersion = ''

  private lastSeq: number | null = null
  /** The roster's own seq: publications at or below it are already in it. */
  private baselineSeq = 0
  private sampler: WorldSampler | null = null
  private loadPromise: Promise<void> | null = null
  private layoutInFlight: Promise<void> | null = null
  private layoutAgain = false
  private playersTimer = 0
  private finishTimer = 0
  private pollTimer = 0
  /** Counters for tests and diagnostics. */
  readonly counters = { layoutFetches: 0, layout304: 0, playersFetches: 0, gaps: 0, events: 0, versionRefetches: 0, summaryRefetches: 0 }

  constructor(readonly id: string) {}

  getSnapshot = (): VillageSnapshot => this.snap
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<VillageSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const fn of [...this.listeners]) fn()
  }

  /** A screen starts using the store: load if needed, listen to the channel. */
  acquire(): () => void {
    this.holders++
    if (this.holders === 1) {
      this.unsubBus = subscribeSettlement(this.id, this.onEvent)
      this.unsubLive = onSettlementLive((live) => {
        this.set({ live })
        // a socket that just came back may have missed publications
        if (live && this.snap.status === 'ready') this.recover()
        this.armPoll()
      })
      this.set({ live: isSettlementLive() })
      this.armPoll()
      this.seedSeq()
      this.unsubSync = syncStore.subscribe(this.onSync)
    }
    void this.load()
    return () => {
      this.holders--
      if (this.holders === 0) this.stop()
    }
  }

  private stop() {
    this.unsubBus?.()
    this.unsubLive?.()
    this.unsubSync?.()
    this.unsubBus = this.unsubLive = this.unsubSync = null
    clearTimeout(this.playersTimer)
    clearTimeout(this.finishTimer)
    clearInterval(this.pollTimer)
  }

  /** Without a live socket, look for changes gently (a 304 when none). */
  private armPoll() {
    clearInterval(this.pollTimer)
    if (this.holders === 0) return
    this.pollTimer = window.setInterval(() => {
      if (document.hidden || isSettlementLive()) return
      void this.refetchLayout()
    }, 30_000)
  }

  async load(force = false): Promise<void> {
    if (this.loadPromise && !force) return this.loadPromise
    if (this.snap.status === 'ready' && !force) return
    this.loadPromise = this.doLoad().finally(() => { this.loadPromise = null })
    return this.loadPromise
  }

  private async doLoad(): Promise<void> {
    this.set({ status: 'loading', error: null })
    try {
      const [world, layout] = await Promise.all([api.getWorld(), api.getLayout(this.id)])
      if (!layout) throw new Error('empty layout')
      this.sampler = new WorldSampler(world, async (face, lod, x, y) => decodeChunk(await api.getChunkBytes(face, lod, x, y)))
      this.set({ world, layout, status: 'ready' })
      this.scheduleFinishFetch()
      if (layout.viewer.member) void this.refetchPlayers()
    } catch (e) {
      report('village', 'load failed: ' + String(e))
      this.set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  private groundPromise: Promise<VillageGround | null> | null = null

  /** The 3D ground (chunks fetched and decoded, terrain grids built): only
   * the village home needs it, so it is made on request and kept. */
  ensureGround(): Promise<VillageGround | null> {
    if (this.snap.ground) return Promise.resolve(this.snap.ground)
    if (!this.groundPromise) {
      this.groundPromise = (async () => {
        await this.load()
        const { world, layout } = this.snap
        if (!world || !layout || !this.sampler) return null
        try {
          const ground = await loadVillageGround(world, layout, this.sampler)
          this.set({ ground })
          return ground
        } catch (e) {
          report('village', 'ground failed: ' + String(e))
          this.groundPromise = null
          return null
        }
      })()
    }
    return this.groundPromise
  }

  /** The ground is built once; a later layout only changes what stands on it. */
  async refetchLayout(): Promise<void> {
    if (this.layoutInFlight) { this.layoutAgain = true; return this.layoutInFlight }
    this.layoutInFlight = (async () => {
      do {
        this.layoutAgain = false
        try {
          this.counters.layoutFetches++
          const next = await api.getLayout(this.id, this.snap.layout)
          if (next === null) this.counters.layout304++
          else {
            const old = this.snap.layout
            // bought land: the grid is bigger, so the ground (and the scene made
            // from it) is made again; the chunks stay cached in the sampler
            const grown = !!old && (old.grid.lots !== next.grid.lots || old.grid.origin.lat !== next.grid.origin.lat || old.grid.origin.lon !== next.grid.origin.lon)
            if (grown) this.groundPromise = null
            this.set(grown ? { layout: next, ground: null, tick: this.snap.tick + 1 } : { layout: next, tick: this.snap.tick + 1 })
          }
          this.scheduleFinishFetch()
        } catch (e) {
          report('village', 'layout refetch failed: ' + String(e))
        }
      } while (this.layoutAgain)
    })().finally(() => { this.layoutInFlight = null })
    return this.layoutInFlight
  }

  async refetchPlayers(): Promise<void> {
    if (!this.snap.layout?.viewer.member) return
    try {
      this.counters.playersFetches++
      const players = await api.getSettlementPlayers(this.id)
      // a roster is current to its own seq: anything at or below it is old news
      this.baselineSeq = Math.max(this.baselineSeq, players.seq)
      this.lastSeq = Math.max(this.lastSeq ?? 0, players.seq)
      this.set({ players, playersError: null, tick: this.snap.tick + 1 })
    } catch (e) {
      const code = (e as { code?: string })?.code
      this.set({ playersError: code === 'not_in_settlement' ? 'forbidden' : 'failed' })
    }
  }

  /** Fetch everything that could be stale. */
  recover(): void {
    void this.refetchLayout()
    void this.refetchPlayers()
    this.set({ tick: this.snap.tick + 1 })
  }

  private scheduleFinishFetch() {
    clearTimeout(this.finishTimer)
    const layout = this.snap.layout
    if (!layout) return
    let next = Infinity
    for (const b of layout.buildings) {
      if ((b.state === 'under_construction' || b.state === 'planned') && b.finish_at) {
        const t = Date.parse(b.finish_at)
        if (t > serverNow() - 60_000) next = Math.min(next, t)
      }
    }
    if (!Number.isFinite(next)) return
    const delay = Math.max(1500, next - serverNow() + 2000)
    this.finishTimer = window.setTimeout(() => void this.refetchLayout(), Math.min(delay, 2_000_000_000))
  }

  private onEvent = (ev: SettlementEvent) => {
    this.counters.events++
    if (ev.seq <= this.baselineSeq) return
    const last = this.lastSeq
    if (last !== null) {
      if (ev.seq === last) return // a redelivery
      if (ev.seq !== last + 1) {
        // a jump, or an older one arriving late: the picture may be wrong
        this.counters.gaps++
        this.lastSeq = Math.max(last, ev.seq)
        this.set({ lastEvent: ev })
        this.recover()
        return
      }
    }
    this.lastSeq = ev.seq

    const layout = this.snap.layout
    let refetch = false
    if (ev.layout_version && layout) {
      if (versionFor(layout, ev.layout_version) !== layout.version) {
        this.counters.versionRefetches++
        refetch = true
      }
    }
    if (ev.type === 'head_changed' && ev.layout_stale) refetch = true
    // a cut, a quarrying, a planting or a clearing order: the trees and rocks of the lots changed (ADR 0065). The fetch is conditional (the ETag carries the woods mark), so the second one costs a 304 when the first already saw it.
    const land = ev.type === 'land_changed' && !!ev.kind && ev.kind !== 'road_planned' && ev.kind !== 'road_cancelled'
    if (land) refetch = true
    if (ev.type === 'member_joined' || ev.type === 'member_left' || ev.type === 'head_changed') {
      clearTimeout(this.playersTimer)
      this.playersTimer = window.setTimeout(() => void this.refetchPlayers(), 400)
    }
    this.set({ lastEvent: ev, tick: this.snap.tick + 1 })
    if (refetch) void this.refetchTo(ev.layout_version && layout ? versionFor(layout, ev.layout_version) : null)
    if (land) window.setTimeout(() => void this.refetchLayout(), 1500)
  }

  /** The snapshot's seq of this settlement's channel, when the store has one
   * and the channel has not been counted yet. */
  private seedSeq() {
    const seq = syncStore.channelSeq(`settlement:${this.id}`)
    if (typeof seq === 'number' && this.lastSeq === null) {
      this.lastSeq = seq
      this.baselineSeq = Math.max(this.baselineSeq, seq)
    }
  }

  /** The player's log moved: if this settlement's summary names a layout
   * version the held layout is not, fetch it. */
  private onSync = () => {
    this.seedSeq()
    const s = entityOf(syncStore.getView(), 'settlement', this.id)
    const layout = this.snap.layout
    if (!s || !s.layout_version || !layout || this.snap.status !== 'ready') return
    if (s.layout_version === layout.version || s.layout_version === this.syncVersion) return
    this.syncVersion = s.layout_version
    this.counters.summaryRefetches++
    void this.refetchTo(s.layout_version)
  }

  /** Fetches the layout and, when the publication named the version it will have
   * and the answer is still the older one (the change had not committed yet),
   * asks again a few times. */
  private async refetchTo(expected: string | null): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.refetchLayout()
      if (!expected || this.snap.layout?.version === expected) return
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
    }
  }
}

const stores = new Map<string, VillageStore>()

export function getVillageStore(id: string): VillageStore {
  let s = stores.get(id)
  if (!s) {
    s = new VillageStore(id)
    stores.set(id, s)
    // the checks read the counters in mock mode (?mock=1) only
    if (new URLSearchParams(location.search).get('mock') === '1') {
      ;(window as unknown as { __villageStores?: unknown }).__villageStores = stores
    }
  }
  return s
}
