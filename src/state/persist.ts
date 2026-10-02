// The store's copy on the device (IndexedDB), behind a switch that is OFF by
// default (docs/adr/0034 open question 6). With it on, a start renders the
// stored copy at once and pulls only what changed since, instead of a whole
// snapshot.
//
// A cache, never the truth: iOS WebViews get a small quota and Safari may
// wipe script storage after days without a visit, so every call is wrapped
// and any failure means "no copy" — the store then reads a snapshot. The
// copy is keyed by player; a copy of another epoch is useless and the first
// pull answers it with a reset. Sign-out clears it.
//
// The switch: localStorage `tc.sync.persist` = "1" (per device), or the build
// flag VITE_SYNC_PERSIST=1.

import type { SyncPersistence } from './store'
import type { SyncSnapshot } from './syncTypes'

const DB = 'tc-sync'
const STORE = 'state'

export function persistenceEnabled(): boolean {
  try {
    if (localStorage.getItem('tc.sync.persist') === '1') return true
  } catch {
    // storage blocked: off
  }
  return (import.meta.env.VITE_SYNC_PERSIST ?? '') === '1'
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) {
      reject(e)
    }
  })
}

function key(playerId: string): string { return `state:${playerId}` }

export const idbPersistence: SyncPersistence = {
  async load(playerId) {
    try {
      const db = await open()
      return await new Promise<SyncSnapshot | null>((resolve) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key(playerId))
        req.onsuccess = () => {
          const v = req.result as SyncSnapshot | undefined
          resolve(v && typeof v.pts === 'number' && v.entities ? v : null)
        }
        req.onerror = () => resolve(null)
        tx.oncomplete = () => db.close()
      })
    } catch {
      return null
    }
  },
  save(playerId, snap) {
    void open().then((db) => {
      try {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(snap, key(playerId))
        tx.oncomplete = () => db.close()
        tx.onerror = () => db.close()
      } catch {
        db.close()
      }
    }).catch(() => undefined)
  },
  clear(playerId) {
    void open().then((db) => {
      try {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key(playerId))
        tx.oncomplete = () => db.close()
      } catch {
        db.close()
      }
    }).catch(() => undefined)
  },
}
