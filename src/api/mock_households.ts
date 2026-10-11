// The NPC households of the mock (ADR 0073), ?mock=1&hh=dual|live|off|none|player: settlement.households with its acts (admit, close, tax, rent_open, rent_close).
import { A, back, mockOk, refreshA } from './mock_neutral'
import type { HouseholdLine, HouseholdsView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('hh') ?? 'live' } catch { return 'live' } }
const st = { open: true, tax: 1000, rent: { open: false, n: 0 } }
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const hl = (i: number, a: number, d: number, e: number, sat: number, state: string, worst: string, w: number): HouseholdLine => ({ index: i, adults: a, dependants: d, earners: e, satisfaction_bps: sat, state, worst, wallet: w, arrived_at: iso(-i * 20) })

function view(): HouseholdsView {
  const m = mode()
  const list = [hl(1, 2, 1, 2, 8200, 'living', '', 640), hl(2, 1, 2, 1, 5600, 'living', 'warmth', 210), hl(3, 2, 0, 1, 3100, 'living', 'water', 90), hl(4, 1, 0, 1, 1800, 'leaving', 'food', 15)]
  return {
    name: 'آمل', phase: m === 'none' ? 'none' : m === 'dual' || m === 'off' ? m : 'live', open: st.open, income_tax_bps: st.tax, living: 3, leaving: 1, persons: 9, earners: 5, homes: 4, mood_bps: 5600, worst: 'warmth', wallets: 940,
    target_pool: 8, pool: m === 'dual' ? 5 : 8, last_day: { households: 4, arrivals: 1, departures: 1, at: iso(-9) }, list: m === 'live' || m === 'player' || m === 'dual' ? list : [],
    news: [{ kind: 'arrived', detail: '2+1', at: iso(-3) }, { kind: 'notice', detail: 'home', at: iso(-8) }, { kind: 'left', detail: 'food', at: iso(-20) }, { kind: 'grant', detail: '300', at: iso(-30) }, { kind: 'born', detail: '', at: iso(-40) }],
    dwellings: m === 'player' || m === 'live' ? [{ building: { code: 'b-lot-1', name: 'کلبهٔ شخصی' }, slots: 2, open: st.rent.open, rent: st.rent.n || 120, tenants: st.rent.open ? 1 : 0 }] : [],
    max_rent: 500, may_admit: m !== 'player', may_tax: m !== 'player', tax_presets: [0, 500, 1000, 1500, 2500], rent_presets: [60, 120, 200, 300],
  }
}

export function mockHouseholdsCommand(command: string, a: Record<string, unknown>): unknown | null {
  if (command !== 'settlement.households') return null
  const act = String(a.action ?? '')
  if (act === 'admit') st.open = true
  else if (act === 'close') st.open = false
  else if (act === 'tax') { const n = Number(a.n); if (!(n >= 0 && n <= 5000)) return mockOk('village_refusal', { kind: 'not_found', back: { command: 'settlement.households', args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: { code: '', name: '' }, needs: null, personal: null, obstacles: null, foundation: null }, []); st.tax = n }
  else if (act === 'rent_open') st.rent = { open: true, n: Number(a.n) }
  else if (act === 'rent_close') st.rent = { open: false, n: 0 }
  return mockOk('households', view(), [back('settlement.who'), refreshA('settlement.households')])
}
export { A }
