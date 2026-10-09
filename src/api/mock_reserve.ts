// The reserve screen (settlement.currency.reserve), ?rs=: head (default, the head with currency.issue and bank.policy), resident (looks only),
// wind (a wind-down with the holder's claim), retired, empty (no supply, no log).
import { A, back, confirmA, mockOk } from './mock_neutral'
import type { MoneyMacro, ReserveView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('rs') ?? 'head' } catch { return 'head' } }
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const macro = (i: number): MoneyMacro => ({ period_no: 30 + i, x_ref_ppm: 1_000_000, tradable_ppm: 1_000_000, non_tradable_ppm: 1_000_000, price_ppm: 1_000_000 + (i - 3) * 6000 + (i % 2) * 4000, pi_local_bps: 40, supply_growth_bps: 120 - i * 10, supply_units: 49750, msup: 4975, ysup: 900, coverage_bps: 10050, coverage_known: true, at: null })

function view(stage: string, extra: Partial<ReserveView> = {}): ReserveView {
  const m = mode(), head = m === 'head', wind = m === 'wind', empty = m === 'empty'
  return {
    village: 'آمل', name: 'مارک پولو', symbol: 'MKP', stage, action: '', status: m === 'retired' ? 'retired' : wind ? 'wind_down' : 'chartered', r0: 10, x_ref_ppm: 1_000_000,
    pot_sup: 5000, basis: 4800, excess: 200, supply: empty ? 0 : 49750, stabilisation: head ? 3000 : 0, market_cap_sup: 4975, coverage_bps: 10050, coverage_known: !empty,
    minted: 50000, burnt: 250, deposited: 5000, released: 0, intervention_out: 0, intervention_in: 0, mint_fee_bps: 50, reserve_fee_bps: 50, max_move_bps: 2000, withdraw_notice_hours: 48,
    cap_bps: 800, floor_bps: 200, delay_hours: 24, buy_budget_sup: 400, sell_budget_units: 3000, treasury_sup: 4000, treasury_units: 40000, cash_sup: 12450, my_units: 320,
    pending_withdrawals: head ? 1 : 0,
    interventions: empty ? null : [{ id: 'i1', side: 'buy', units: 8000, price: 100000, status: 'pending', sup_used: 0, refusal: '', posted_at: iso(-3), execute_after: iso(21) }, { id: 'i0', side: 'sell', units: 2000, price: 104000, status: 'done', sup_used: 208, refusal: '', posted_at: iso(-80), execute_after: iso(-56) }],
    withdrawals: empty ? null : [{ id: 'w1', sup: 100, status: 'pending', refusal: '', requested_at: iso(-6), execute_after: iso(42) }],
    macro: empty ? null : macro(6), trend: empty ? null : Array.from({ length: 7 }, (_, i) => macro(i)),
    wind_down_at: wind ? iso(-48) : null, wind_down_ends_at: wind ? iso(24 * 5) : null, my_share: wind ? 64 : 0, can_claim: wind,
    can_issue: head, can_policy: head, presets: [100, 1000, 5000], amount: 0, price: 0, out: 0, execute_after: null, reason: '', ...extra,
  }
}

export function mockReserveCommand(command: string, args: Record<string, unknown>) {
  if (command !== 'settlement.currency.reserve') return null
  const action = String(args.action ?? '')
  const acts = [back('settlement.money')]
  if (!action) return mockOk('village_reserve', view('menu'), acts)
  if (action === 'cancel') return mockOk('village_reserve', view('menu', { interventions: view('menu').interventions!.map((i) => (i.id === args.id ? { ...i, status: 'cancelled' } : i)) }), acts)
  const amount = Number(args.amount ?? 0)
  const delayed = action === 'buy' || action === 'sell' || action === 'withdraw'
  const reason = action === 'issue' && amount > 9000 ? 'reserve_funds' : action === 'withdraw' && amount > 200 ? 'reserve_no_excess' : ''
  const ex = { action, amount, price: Number(args.price ?? 0) * (Number(args.price) < 1000 ? 1_000_000 : 1), out: action === 'issue' ? Math.floor(amount * 10 * 0.995) : action === 'claim' ? 64 : 0, execute_after: delayed ? iso(action === 'withdraw' ? 48 : 24) : null, reason }
  if (!args.confirm) return mockOk('village_reserve', view('ask', ex), [confirmA('settlement.currency.reserve', { action, amount: String(amount) }), back('settlement.currency.reserve')])
  return mockOk('village_reserve', view('done', ex), acts)
}
