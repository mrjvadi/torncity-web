// React bindings for the village store, the once-a-second clock the countdowns
// run on, the village commands and the settlement building catalogue.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as api from '../api/client'
import type { CatalogueBuilding, CommandResponse } from '../api/types'
import { useSession } from '../state/SessionContext'
import { useToast } from '../state/ToastContext'
import { refusalText } from '../i18n'
import { getVillageStore, type VillageSnapshot, type VillageStore } from './villageStore'
import { serverNow } from './clock'

/** The id of the settlement a village screen shows: an explicit one (a
 * neighbour's), else the player's own from the bootstrap. */
export function useSettlementId(explicit?: string): string | undefined {
  const { bootstrap } = useSession()
  return explicit || bootstrap?.settlement?.id
}

export function useVillage(id: string | undefined): (VillageSnapshot & { store: VillageStore | null }) {
  const store = id ? getVillageStore(id) : null
  const noop = useRef(() => () => undefined).current
  const empty = useRef<VillageSnapshot>({ status: 'idle', error: null, world: null, layout: null, ground: null, players: null, playersError: null, tick: 0, lastEvent: null, live: false }).current
  const snap = useSyncExternalStore(store ? store.subscribe : noop, store ? store.getSnapshot : () => empty)
  useEffect(() => (store ? store.acquire() : undefined), [store])
  return { ...snap, store }
}

/** Server time in ms, refreshed every `everyMs`. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(serverNow())
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

export interface VillageResult {
  ok: boolean
  res: CommandResponse | null
  /** Localized refusal text when !ok. */
  message: string
  code?: string
}

let keySeq = 0

/** Runs a village command; a refusal (200 with ok:false) is turned into text
 * by its code. Writes carry an idempotency key. */
export function useVillageCommand() {
  const toast = useToast()
  return useCallback(async (command: string, args: api.CommandArgs = {}, opts: { write?: boolean; silent?: boolean } = {}): Promise<VillageResult> => {
    try {
      const key = opts.write ? `web-v-${Date.now().toString(36)}-${++keySeq}` : undefined
      const res = await api.runCommand(command, args, key)
      if (res.ok === false) {
        const message = refusalText(res.error?.code, res.error?.message)
        if (!opts.silent) toast.push(message)
        return { ok: false, res, message, code: res.error?.code }
      }
      return { ok: true, res, message: '' }
    } catch (e) {
      const message = refusalText((e as { code?: string })?.code ?? 'network', undefined)
      if (!opts.silent) toast.push(message)
      return { ok: false, res: null, message }
    }
  }, [toast])
}

// -- settlement building catalogue (footprints, names by language) ----------------------

let catalogue: Promise<Map<string, CatalogueBuilding>> | null = null

export function loadBuildingCatalogue(): Promise<Map<string, CatalogueBuilding>> {
  if (!catalogue) {
    catalogue = api.getContent().then((c) => {
      const entries = (c as { entries?: Record<string, CatalogueBuilding[]> } | null)?.entries?.settlement_building ?? []
      return new Map(entries.map((e) => [e.code, e]))
    }).catch(() => {
      catalogue = null
      return new Map<string, CatalogueBuilding>()
    })
  }
  return catalogue
}

export function useBuildingCatalogue(): Map<string, CatalogueBuilding> {
  const [map, setMap] = useState<Map<string, CatalogueBuilding>>(new Map())
  useEffect(() => {
    let cancelled = false
    void loadBuildingCatalogue().then((m) => { if (!cancelled) setMap(m) })
    return () => { cancelled = true }
  }, [])
  return map
}

/** A building's Persian name: the catalogue's `fa` entry, else the authored one. */
export function buildingName(cat: Map<string, CatalogueBuilding>, code: string, authored?: string): string {
  return cat.get(code)?.name?.fa || authored || code
}
