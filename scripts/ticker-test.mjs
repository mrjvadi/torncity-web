// Unit checks of the shared countdown machinery (src/lib/ticker.ts, src/lib/live.ts, src/village/clock.ts):
//  - a view's remaining/elapsed fields are anchored to the server clock once and read as end - now afterwards
//    (never decremented), durations are left alone, a skewed device clock is corrected;
//  - ONE interval serves every subscriber, it stops while the page is hidden and resumes (with a resync) on return.
// Run: node scripts/ticker-test.mjs (esbuild is already a dependency of vite).
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'ticker-'))
const entry = join(dir, 'entry.ts')
import { writeFileSync } from 'node:fs'
writeFileSync(entry, `export * from '${process.cwd()}/src/lib/ticker'; export * from '${process.cwd()}/src/lib/live'; export * from '${process.cwd()}/src/village/clock'`)
const out = join(dir, 'bundle.mjs')
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out, platform: 'node', logLevel: 'error' })

// a page just big enough for the ticker
let now = 1_000_000_000_000
const realNow = Date.now
Date.now = () => now
const intervals = new Map(); let iid = 0
globalThis.window = globalThis
const listeners = {}
globalThis.document = { hidden: false, addEventListener: (e, f) => { (listeners[e] ??= []).push(f) }, removeEventListener() {} }
globalThis.addEventListener = (e, f) => { (listeners[e] ??= []).push(f) }
globalThis.setInterval = (fn, ms) => { const id = ++iid; intervals.set(id, { fn, ms }); return id }
globalThis.clearInterval = (id) => intervals.delete(id)
const emit = (e) => (listeners[e] ?? []).forEach((f) => f())
const tickAll = () => [...intervals.values()].forEach((i) => i.fn())

const m = await import(pathToFileURL(out).href)

// -- the live view ------------------------------------------------------------------------------------
const view = { name: 'x', remaining_seconds: 90, duration_seconds: 600, jail: { remaining_seconds: 30 }, lines: [{ left_seconds: 10 }, { left_seconds: 0 }], ago_seconds: 5 }
const live = m.liveView(view)
assert.equal(live.remaining_seconds, 90)
assert.equal(live.duration_seconds, 600, 'a duration never moves')
assert.equal(live.jail.remaining_seconds, 30)
now += 5000
assert.equal(live.remaining_seconds, 85, 'recomputed from the clock, not decremented')
assert.equal(live.remaining_seconds, 85, 'reading twice does not count down twice')
assert.equal(live.lines[0].left_seconds, 5)
assert.equal(live.lines[1].left_seconds, 0)
assert.equal(live.ago_seconds, 10, 'an elapsed field counts up')
assert.equal(m.secondsToFirstDone(live), 5)
now += 6000
assert.equal(live.lines[0].left_seconds, 0, 'never below zero')
assert.equal(m.secondsToFirstDone(live), 19, "the jail line is next")
now += 100_000
assert.equal(m.secondsToFirstDone(live), Infinity, 'all counted down: nothing left to wait for')
assert.equal(JSON.parse(JSON.stringify(live)).name, 'x')
// a view with nothing live is returned as it is
const plain = { a: 1, duration_seconds: 5 }
assert.equal(m.liveView(plain), plain)

// -- the server clock offset --------------------------------------------------------------------------
now = 2_000_000_000_000
m.setServerTime(new Date(now + 120_000).toISOString()) // the device is 2 minutes behind the server
assert.equal(m.serverNow(), now + 120_000)
const v2 = m.liveView({ remaining_seconds: 60 })
now += 30_000
assert.equal(v2.remaining_seconds, 30, 'counted on the server clock')

// -- the shared ticker --------------------------------------------------------------------------------
let a = 0, b = 0, c = 0
const offA = m.subscribeTick(() => a++), offB = m.subscribeTick(() => b++), offC = m.subscribeTick(() => c++)
assert.equal(intervals.size, 1, 'one interval for every subscriber')
assert.equal([...intervals.values()][0].ms, 1000)
tickAll(); assert.deepEqual([a, b, c], [1, 1, 1])
let resynced = 0
const offR = m.onResync(() => resynced++)
document.hidden = true; emit('visibilitychange')
assert.equal(intervals.size, 0, 'no ticking while the page is hidden')
document.hidden = false; emit('visibilitychange')
assert.equal(intervals.size, 1, 'ticking again when it is back')
assert.equal(resynced, 1, 'a resync on return')
assert.ok(a >= 2, 'it ticks at once on return')
offA(); offB(); assert.equal(intervals.size, 1)
offC(); assert.equal(intervals.size, 0, 'nobody listens: the interval goes')
offR()
Date.now = realNow
console.log('ticker-test ok')
