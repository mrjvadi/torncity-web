// Unit checks of the state sync store (src/state/store.ts): apply idempotence,
// duplicates, out-of-order and gaps, reset, notice dedupe, overlays, two
// cursors. Run: node scripts/sync-store-test.mjs (esbuild is already a
// dependency of vite).
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(mkdtempSync(join(tmpdir(), 'syncstore-')), 'store.mjs')
await build({ entryPoints: ['src/state/store.ts'], bundle: true, format: 'esm', outfile: out, platform: 'node', logLevel: 'error' })

// a browser just big enough for the store
const timers = new Map()
let tid = 0
globalThis.window = globalThis
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.setTimeout = (fn, ms) => { const id = ++tid; timers.set(id, { fn, ms }); return id }
globalThis.clearTimeout = (id) => timers.delete(id)
globalThis.setInterval = () => ++tid
globalThis.clearInterval = () => {}
const fire = () => { const t = [...timers]; timers.clear(); for (const [, x] of t) x.fn() }

const { SyncStore } = await import(pathToFileURL(out).href)

// a fake server: one log
function server() {
  const s = { pts: 0, ents: {}, log: [], epoch: '1', min: 1, calls: { state: 0, updates: 0 } }
  s.set = (entity, id, data, cause) => {
    const v = (s.ents[entity + '/' + id]?.v ?? 0) + 1
    s.ents[entity + '/' + id] = { v, d: data }
    const r = { pts: ++s.pts, type: entity + '.set', entity, id, v, op: 'set', data, at: 'x', cause }
    s.log.push(r)
    return r
  }
  s.snapshot = () => {
    const entities = {}
    for (const [k, e] of Object.entries(s.ents)) {
      const [kind, id] = k.split('/')
      ;(entities[kind] ??= {})[id] = e
    }
    return { pts: s.pts, epoch: s.epoch, server_time: '', entities, channels: { 'settlement:x': 7 } }
  }
  s.transport = {
    getState: async () => { s.calls.state++; return s.snapshot() },
    getUpdates: async (since, epoch) => {
      s.calls.updates++
      if (epoch !== s.epoch || since < s.min - 1) return { pts: s.pts, updates: [], more: false, reset: true, reason: 'too_long', epoch: s.epoch }
      const rest = s.log.filter((r) => r.pts > since)
      return { pts: s.pts, updates: rest.slice(0, 2), more: rest.length > 2, epoch: s.epoch }
    },
  }
  return s
}
const wallet = (cash) => ({ currency: 'SUP', cash, bank: 0, premium: false, primary: true })
const cashOf = (st) => st.getView().entities.get('wallet')?.get('SUP')?.cash
const tick = () => new Promise((r) => setImmediate(r))

let n = 0
async function t(name, fn) { await fn(); n++; console.log('ok  ' + name) }

await t('snapshot then in-order push applies, duplicates drop', async () => {
  const sv = server(); sv.set('wallet', 'SUP', wallet(10))
  const st = new SyncStore(); await st.start('p', sv.transport)
  const r1 = sv.set('wallet', 'SUP', wallet(20))
  st.receive({ type: 'updates', from: 1 + 1, to: 2, updates: [r1] })
  assert.equal(cashOf(st), 20); assert.equal(st.currentPts(), 2)
  st.receive({ type: 'updates', from: 2, to: 2, updates: [r1] })
  assert.equal(st.counters.duplicates, 1); assert.equal(cashOf(st), 20)
  assert.equal(st.channelSeq('settlement:x'), 7)
})

await t('out of order within the grace window needs no pull', async () => {
  const sv = server(); const st = new SyncStore(); await st.start('p', sv.transport)
  const a = sv.set('wallet', 'SUP', wallet(1)), b = sv.set('wallet', 'SUP', wallet(2))
  st.receive({ type: 'updates', from: 2, to: 2, updates: [b] }) // arrives first
  assert.equal(st.currentPts(), 0)
  st.receive({ type: 'updates', from: 1, to: 1, updates: [a] })
  assert.equal(st.currentPts(), 2); assert.equal(cashOf(st), 2)
  fire(); await tick()
  assert.equal(sv.calls.updates, 0)
})

await t('a lost publication is a gap: pull after the grace, in pages', async () => {
  const sv = server(); const st = new SyncStore(); await st.start('p', sv.transport)
  const rs = [1, 2, 3, 4, 5].map((i) => sv.set('wallet', 'SUP', wallet(i)))
  st.receive({ type: 'updates', from: 5, to: 5, updates: [rs[4]] }) // 1..4 lost
  assert.equal(st.currentPts(), 0)
  fire(); await tick(); await tick(); await tick(); await tick()
  assert.equal(st.currentPts(), 5); assert.equal(cashOf(st), 5)
  assert.ok(sv.calls.updates >= 3, 'paged with more')
})

await t('a stale version never overwrites a newer one; idempotent replay', async () => {
  const sv = server(); const r = [sv.set('wallet', 'SUP', wallet(1)), sv.set('wallet', 'SUP', wallet(2))]
  const st = new SyncStore(); await st.start('p', sv.transport) // snapshot already at pts 2
  for (const x of r) st.receive({ type: 'updates', from: x.pts, to: x.pts, updates: [x] })
  assert.equal(cashOf(st), 2); assert.equal(st.counters.applied, 0)
})

await t('reset: too_long reads a fresh snapshot', async () => {
  const sv = server(); const st = new SyncStore(); await st.start('p', sv.transport)
  for (let i = 0; i < 10; i++) sv.set('wallet', 'SUP', wallet(i))
  sv.min = 8
  await st.pull()
  assert.equal(st.counters.resets, 1); assert.equal(st.currentPts(), 10); assert.equal(cashOf(st), 9)
  sv.epoch = '2'; sv.set('wallet', 'SUP', wallet(99))
  await st.pull()
  assert.equal(st.counters.resets, 2); assert.equal(cashOf(st), 99)
})

await t('notice: toast once per id, live only, never from the snapshot', async () => {
  const sv = server(); sv.set('notice', 'n0', { kind: 'x', instant: true })
  const st = new SyncStore(); const seen = []; st.onNotice((x) => seen.push(x.id))
  await st.start('p', sv.transport)
  const live = sv.set('notice', 'n1', { kind: 'x', instant: true })
  const quiet = sv.set('notice', 'n2', { kind: 'x', instant: false })
  st.receive({ type: 'updates', from: 2, to: 3, updates: [live, quiet] })
  st.receive({ type: 'updates', from: 2, to: 3, updates: [live, quiet] })
  const re = sv.set('notice', 'n1', { kind: 'x', instant: true, read: true }) // a re-set of the same notice
  st.receive({ type: 'updates', from: 4, to: 4, updates: [re] })
  assert.deepEqual(seen, ['n1'])
})

await t('overlay shows at once and is replaced by its own records', async () => {
  const sv = server(); sv.set('wallet', 'SUP', wallet(100)); const st = new SyncStore(); await st.start('p', sv.transport)
  st.addOverlay('k', 'bank.deposit', [{ kind: 'wallet', id: 'SUP', fn: (d) => ({ ...d, cash: d.cash - 40, bank: d.bank + 40 }) }])
  assert.equal(cashOf(st), 60); assert.ok(st.getView().pending.has('wallet/SUP'))
  st.bindOverlay('k', 'req1')
  const r = sv.set('wallet', 'SUP', { ...wallet(60), bank: 40 }, 'req1')
  st.commandUpdates({ pts: r.pts, records: [r] })
  assert.equal(cashOf(st), 60); assert.equal(st.getView().pending.size, 0)
  // a command that fails drops its overlay
  st.addOverlay('k2', 'x', [{ kind: 'wallet', id: 'SUP', fn: (d) => ({ ...d, cash: 0 }) }]); st.dropOverlay('k2')
  assert.equal(cashOf(st), 60)
})

await t('overlay is rebased over a record that arrives meanwhile', async () => {
  const sv = server(); sv.set('wallet', 'SUP', wallet(100)); const st = new SyncStore(); await st.start('p', sv.transport)
  st.addOverlay('k', 'bank.deposit', [{ kind: 'wallet', id: 'SUP', fn: (d) => ({ ...d, cash: d.cash - 10 }) }])
  const r = sv.set('wallet', 'SUP', wallet(150))
  st.receive({ type: 'updates', from: 2, to: 2, updates: [r] })
  assert.equal(cashOf(st), 140)
})

await t('two devices with different cursors converge', async () => {
  const sv = server(); const a = new SyncStore(), b = new SyncStore()
  await a.start('p', sv.transport); sv.set('wallet', 'SUP', wallet(1)); sv.set('inventory', 'bread', { item: 'bread', qty: 2 })
  await b.start('p', sv.transport)
  sv.set('wallet', 'SUP', wallet(5)); sv.set('skill', 'trading', { skill: 'trading', level: 2, xp: 1 })
  await a.pull(); await b.pull()
  assert.deepEqual([...a.getView().entities.keys()].sort(), [...b.getView().entities.keys()].sort())
  assert.equal(a.currentPts(), b.currentPts()); assert.equal(cashOf(a), cashOf(b))
})

await t('a held start: publications during the snapshot are applied after it', async () => {
  const sv = server(); const st = new SyncStore()
  const slow = { ...sv.transport, getState: async () => { await tick(); return sv.transport.getState() } }
  const p = st.start('p', slow)
  const r = sv.set('wallet', 'SUP', wallet(3))
  st.receive({ type: 'updates', from: 1, to: 1, updates: [r] }) // before the snapshot lands
  await p
  assert.equal(cashOf(st), 3); assert.equal(st.currentPts(), 1)
})

console.log(`\n${n} store checks passed`)
process.exit(0)
