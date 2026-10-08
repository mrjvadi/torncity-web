// The money market (fx.*): ?fx=empty (no orders), depth (default, a book with orders and a partly filled order of mine),
// band (every order is out of the band), cross (the conversion goes between two moneys through SUP).
import { A, back, confirmA, mockOk, refreshA } from './mock_neutral'
import type { FXBookView, FXOrderLine } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('fx') ?? 'depth' } catch { return 'depth' } }
const REF = 100000, NAME = 'مارک پولو'
const base = { settlement: 'mock-village', village: 'آمل', code: 'MKP', name: NAME, symbol: 'MKP' }
const open: FXOrderLine[] = [
  { id: 'o1', no: 41, side: 'buy', units: 2000, filled: 800, price: 99000, escrow_left: 118, status: 'open', created_at: null, expires_at: null },
  { id: 'o2', no: 42, side: 'sell', units: 1000, filled: 0, price: 108000, escrow_left: 1000, status: 'open', created_at: null, expires_at: null },
]
let cancelled = new Set<string>()

function book(notice = ''): ReturnType<typeof mockOk> {
  const empty = mode() === 'empty'
  const view: FXBookView = { ...base, r0: 10, x_ref_ppm: 1_000_000, ref_price: REF, last_price: empty ? 0 : 99000, band_low: 80000, band_high: 120000,
    bids: empty ? [] : [{ price: 99000, units: 1200, orders: 2 }, { price: 96000, units: 3000, orders: 3 }, { price: 92000, units: 8000, orders: 4 }],
    asks: empty ? [] : [{ price: 102000, units: 900, orders: 1 }, { price: 105000, units: 2500, orders: 2 }, { price: 108000, units: 6000, orders: 5 }],
    reserve_fee_bps: 50, village_fee_bps: 30, max_move_bps: 2000, min_order_sup: 5, cash_sup: 12450, units: 320, escrow_sup: empty ? 0 : 118, escrow_units: empty ? 0 : 1000,
    my_orders: empty ? [] : open.filter((o) => !cancelled.has(o.id)), trades: empty ? [] : [{ price: 99000, units: 800, at: null }, { price: 100000, units: 400, at: null }, { price: 98000, units: 1500, at: null }],
    preset_units: [100, 1000, 10000], min_trades: 8, window_periods: 7, notice }
  return mockOk('fx_book', view, [back('settlement.money'), refreshA('fx.book')])
}

function place(args: Record<string, unknown>) {
  const side = String(args.side) === 'sell' ? 'sell' : 'buy'
  const units = Number(args.units ?? 0), price = Math.round(Number(String(args.price)) * (Number(args.price) < 1000 ? 1_000_000 : 1))
  if (mode() === 'band' || price < 80000 || price > 120000) return mockOk('fx_refusal', { kind: 'fx_out_of_band', min: 80000, max: 120000, back: { command: 'fx.book', args: null } }, [back('fx.book')])
  const worth = Math.floor(units * price / 1_000_000), fee = side === 'buy' ? Math.ceil(worth * 50 / 10000) : 0
  const o: FXOrderLine = { id: 'new', no: 43, side, units, filled: 0, price, escrow_left: side === 'buy' ? worth + fee : units, status: 'open', created_at: null, expires_at: null }
  const crosses = side === 'buy' ? price >= 102000 : price <= 99000
  const view = { ...base, stage: args.confirm ? 'done' : 'ask', side, units, price, r0: 10, x_ref_ppm: 1_000_000, band_low: 80000, band_high: 120000, worth_sup: worth, escrow: side === 'buy' ? worth + fee : units, fee_bps: side === 'buy' ? 50 : 30,
    crosses, can_place: true, order: { ...o, filled: args.confirm && crosses ? Math.floor(units * 0.6) : 0 }, rested: !!args.confirm && (!crosses || true), units_moved: args.confirm && crosses ? Math.floor(units * 0.6) : 0, sup_moved: args.confirm && crosses ? Math.floor(units * 0.6 * price / 1_000_000) : 0, cash_sup: 12450, units_held: 320 }
  return mockOk('fx_order', view, args.confirm ? [back('fx.book'), A('fx.book', 'fx.book')] : [confirmA('fx.place', { side, units: String(units), price: String(args.price) }), back('fx.book')])
}

function history() {
  const periods = Array.from({ length: 8 }, (_, i) => ({ period_no: 40 - i, trades: 3 + (i % 4), volume_units: 1200 + i * 150, vwap: 99000 + (i % 3) * 1500, value_ppm: 0, window_trades: 6 + i, x_ref_before: 1_000_000 - i * 1800, x_ref_after: 1_000_000 - i * 1800 + 900, at: null }))
  return mockOk('fx_history', { ...base, r0: 10, x_ref_ppm: 1_000_000, min_trades: 8, window_periods: 7, period_seconds: 86400, periods: mode() === 'empty' ? [] : periods }, [back('fx.book')])
}

function convert(args: Record<string, unknown>) {
  const holdings = [{ ...base, units: 320 }, { settlement: 'mock-2', village: 'سرخه', code: 'SRK', name: 'درهم سرخه', symbol: 'SRK', units: 90 }]
  if (!args.from) return mockOk('fx_convert', { stage: 'menu', from: '', to: '', amount: 0, out: 0, min_out: 0, slippage_bps: 100, legs: null, complete: true, cash_sup: 12450, holdings, gave: 0, got: 0 }, [back('fx.book')])
  const amount = Number(args.amount ?? 0), cross = String(args.from) !== 'SUP' && String(args.to) !== 'SUP'
  const sell = { ...base, side: 'sell', units_in: amount, sup_in: 0, units_out: 0, sup_out: Math.floor(amount * 0.1), fee: Math.ceil(amount * 0.003), complete: true }
  const buy = { settlement: 'mock-2', village: 'سرخه', code: 'SRK', name: 'درهم سرخه', symbol: 'SRK', side: 'buy', units_in: 0, sup_in: sell.sup_out, units_out: Math.floor(sell.sup_out * 8), sup_out: 0, fee: 1, complete: true }
  const out = cross ? buy.units_out : args.to === 'SUP' ? sell.sup_out : Math.floor(amount * 9.9)
  const stage = args.confirm ? 'done' : 'ask'
  const legs = cross ? [sell, buy] : args.to === 'SUP' ? [sell] : [{ ...buy, sup_in: amount, units_out: out, settlement: base.settlement, village: base.village, code: base.code, name: base.name, symbol: base.symbol }]
  return mockOk('fx_convert', { stage, from: String(args.from), to: String(args.to), amount, out, min_out: Math.floor(out * 0.99), slippage_bps: 100, legs, complete: true, cash_sup: 12450, holdings, gave: amount, got: out },
    args.confirm ? [back('fx.book')] : [confirmA('fx.convert', { from: String(args.from), to: String(args.to), amount: String(amount), quote: String(out) }), back('fx.convert')])
}

export function mockFxCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  switch (command) {
    case 'fx.book': return book()
    case 'fx.place': return place(args)
    case 'fx.cancel': cancelled = new Set([...cancelled, String(args.order)]); return book('cancelled')
    case 'fx.history': return history()
    case 'fx.convert': return mode() === 'moved' && args.confirm ? { ok: false, request_id: 'mock', screen: 'fx_refusal', view: { kind: 'fx_moved', min: 0, max: 0, back: { command: 'fx.convert', args: null } }, actions: [back('fx.convert', { from: String(args.from), to: String(args.to), amount: String(args.amount) })] } : convert(args)
    default: return null
  }
}
