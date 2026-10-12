// Mines, carriage, rail and the chain of the mock (ADR 0075), ?mock=1&mine=off|on|flooded|noperm. Commands: settlement.mining, haul, rail, chain.
import { back, mockOk, refreshA } from './mock_neutral'
import type { ChainView, HaulView, MiningView, RailView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('mine') ?? 'on' } catch { return 'on' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const mat = (code: string, name: string, quantity: number) => ({ component: N(code, name), quantity })
const st = { surveyed: false, haulLink: false, lineDrawn: false, built: 0, trainMade: false, started: false, tick: 0, orders: [] as string[], booked: false, rate: 0 }
const refuse = (kind: string, extra: Record<string, number> = {}) => ({ ...mockOk('village_refusal', { kind, back: { command: 'settlement.mining', args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, []), ok: false, error: { code: `village_${kind}`, args: extra } })

function mining(notice = ''): MiningView {
  const m = mode(), flooded = m === 'flooded'
  return {
    village: 'آمل', open: m !== 'off', starts_at: m === 'off' ? iso(5 * 24) : null, pits_from: m === 'on' || m === 'flooded' ? iso(9 * 24) : null, may_run: m !== 'noperm',
    deposits: [{ resource: N('iron', 'آهن'), surveyed: st.surveyed, grade_permille: 420, band: 'medium', capacity_estimate: 90000, taken_units: 1200, left_bps: [9400, 10000, 10000], item: N('iron_ore_lean', 'کانهٔ آهن') }, { resource: N('copper', 'مس'), surveyed: false, grade_permille: 0, band: '', capacity_estimate: 0, taken_units: 0, left_bps: [0, 0, 0], item: N('', '') }],
    mines: [{ building: N('mine', 'معدن'), building_id: 'b-mine-1', shafts: 1, hoist: 0, pump: flooded ? -1 : 1, ore_bin: true, vent: false, adit_m: 100, fall_m: 6, adit_need_m: [0, 250],
      levels: [{ depth: 1, depth_m: 12, condition_bps: flooded ? 2200 : 8400, water_bps: flooded ? 9000 : 1500, status: flooded ? 'flooded' : 'ok', drained: !flooded, left_bps: 10000 }, { depth: 2, depth_m: 24, condition_bps: 2600, water_bps: 4200, status: 'needs_repair', drained: false, left_bps: 10000 }],
      crew: [{ role: N('miner', 'کانه‌کن'), slots: 3, working: 2 }, { role: N('mine_hauler', 'باربر معدن'), slots: 2, working: 1 }, { role: N('timberman', 'چوب‌بند'), slots: 1, working: 0 }],
      face_kg: 1200, hoist_kg: 800, haul_kg: 1500, output_kg: 800, limit: 'hoist', reasons: flooded ? ['closed'] : [] }],
    works: [{ id: 'w1', module: N('adit', 'تونل'), detail: 100, due_at: iso(3), left_seconds: 3 * 3600, building: 'b-mine-1' }],
    modules: [
      { module: N('shaft_level', 'طبقهٔ چاه'), have: 1, max: 2, cost: [mat('timber_prop', 'چوب‌بست', 12), mat('timber', 'چوب', 8)], wage: 900, unit: 0, missing: null, can_order: true },
      { module: N('hoist_gin', 'بالابر اسبی'), have: 0, max: 1, cost: [mat('timber', 'چوب', 20), mat('iron_bar', 'شمش آهن', 4)], wage: 1200, unit: 0, missing: [N('iron_rail', 'ریل آهنی')], can_order: false },
      { module: N('adit', 'تونل'), have: 100, max: 500, cost: [mat('timber_prop', 'چوب‌بست', 6)], wage: 400, unit: 50, missing: null, can_order: true },
      { module: N('pump', 'تلمبه'), have: 1, max: 1, cost: [mat('timber', 'چوب', 14)], wage: 700, unit: 0, missing: null, can_order: false },
    ], notice,
  }
}
function haul(notice = ''): HaulView {
  return {
    village: 'آمل', open: mode() !== 'off', may_order: mode() !== 'noperm', may_draw: mode() !== 'noperm',
    carriers: [{ id: 'c1', mode: N('ox_cart', 'گاری گاوی'), kind: 'cart', capacity_kg: 600, status: 'idle', settlement: N('v-k3x9', 'آمل') }, { id: 'c2', mode: N('ox_cart', 'گاری گاوی'), kind: 'cart', capacity_kg: 600, status: 'moving', settlement: N('v-q7m2', 'سرخه') }],
    links: [{ id: 'l1', other: N('v-q7m2', 'سرخه'), class: 'track', length_m: 48200, condition_bps: 8800, toll: 20, status: 'open', mine: true }, { id: 'l2', other: N('v-k8', 'نمین'), class: 'path', length_m: 96000, condition_bps: 10000, toll: 0, status: st.haulLink ? 'building' : 'closed', mine: false }],
    loads: [{ id: 'ld1', item: N('timber', 'چوب'), qty: 40, from: N('v-k3x9', 'آمل'), to: N('v-q7m2', 'سرخه'), due_at: iso(2.5), left_seconds: 9000, carrier: 'c2' }],
    orders: st.orders.map((o, i) => ({ id: `o${i}`, item: N(o, o), qty: 10, from: N('v-k3x9', 'آمل'), to: N('v-q7m2', 'سرخه'), mode: 'road', fee: 120, status: 'open', at: iso(0) })),
    modes: [{ mode: N('ox_cart', 'گاری گاوی'), capacity_kg: 600, surface: 'track', cost: [mat('timber', 'چوب', 10), mat('iron_bar', 'شمش آهن', 1)], wage: 500, hours: 4, can_order: true, missing: null }, { mode: N('horse_cart', 'گاری اسبی'), capacity_kg: 900, surface: 'road', cost: [mat('timber', 'چوب', 14)], wage: 700, hours: 6, can_order: false, missing: [N('wagonway', 'راه گاری‌رو')] }],
    targets: [N('v-k8', 'نمین'), N('v-x1', 'گلستان')], notice,
  }
}
function rail(notice = '', quote: RailView['quote'] = null): RailView {
  const stops = [{ id: 's1', building: N('rail_station', 'ایستگاه'), settlement: N('v-k3x9', 'آمل'), after_seq: 0, open: true }, { id: 's2', building: N('rail_station', 'ایستگاه'), settlement: N('v-q7m2', 'سرخه'), after_seq: 1, open: st.tick % 2 === 0 }]
  return {
    village: 'آمل', open: mode() !== 'off', may_draw: mode() !== 'noperm', may_order: mode() !== 'noperm', stations: [stops[0], stops[1]],
    classes: [{ class: N('wood_rail', 'ریل چوبی'), speed_kmh: 8, consist_kg: 2400, wagon_kg: 800, max_grade_bps: 400, lot_cost: [mat('sleeper', 'تراورس', 6)], lot_hours: 1, lot_minutes: 30, team_price: 400, wagon_cost: [mat('timber', 'چوب', 10)], can_lay: true, missing: null }, { class: N('iron_rail', 'ریل آهنی'), speed_kmh: 20, consist_kg: 8000, wagon_kg: 2000, max_grade_bps: 250, lot_cost: [mat('rail', 'ریل', 4)], lot_hours: 2, lot_minutes: 60, team_price: 1200, wagon_cost: [mat('bar_iron', 'شمش آهن', 6)], can_lay: false, missing: [N('iron_rail', 'ریل آهنی')] }],
    lines: st.lineDrawn ? [{ id: 'ln1', name: 'خط آمل به سرخه', class: N('wood_rail', 'ریل چوبی'), status: st.built >= 12 ? 'open' : st.built > 0 ? 'building' : 'planned', sections: 12, built: st.built, length_m: 48200, worst_condition_bps: 9100, rate_per_tonne_km: st.rate, mine: true, stops, loops: [], laying: false, due_at: null, trains: st.trainMade ? 1 : 0 }] : [],
    trains: st.trainMade ? [{ id: 't1', line: 'ln1', name: 'قطار ۱', status: st.started ? 'running' : 'idle', wagons: 3, capacity_kg: 2400, at: N('v-k3x9', 'آمل'), heading: 1, pos: 0, steps: [{ seq: 1, stop: stops[0], op: 'load', item: N('iron_ore_lean', 'کانهٔ آهن'), stock_floor: 0, wait_minutes: 10 }, { seq: 2, stop: stops[1], op: 'unload', item: N('iron_ore_lean', 'کانهٔ آهن'), stock_floor: 0, wait_minutes: 0 }], cargo: [{ item: N('iron_ore_lean', 'کانهٔ آهن'), qty: 1800, to: N('v-q7m2', 'سرخه') }], next_at: iso(1), reason: st.started ? '' : 'station_closed', stuck: false, mine: true, legs: 2 }] : [],
    bookings: st.booked ? [{ id: 'bk1', line: 'ln1', item: N('timber', 'چوب'), qty: 20, from: N('v-k3x9', 'آمل'), to: N('v-q7m2', 'سرخه'), fee: 150, status: 'booked' }] : [], quote, notice,
  }
}
function chain(code: string, n: number): ChainView {
  const lines = code ? [
    { node: N('smithy', 'آهنگری'), item: N('bar_iron', 'شمش آهن'), need_milli: n * 1000, have_milli: Math.round(n * 600), count: 1, running: 1, add: 1, starved: true, depth: 0 },
    { node: N('bloomery', 'کورهٔ آهن'), item: N('iron_bloom', 'آهن اسفنجی'), need_milli: n * 1500, have_milli: n * 1500, count: 2, running: 2, add: 0, starved: false, depth: 1 },
    { node: N('mine', 'معدن'), item: N('iron_ore_lean', 'کانهٔ آهن'), need_milli: n * 3000, have_milli: Math.round(n * 1800), count: 1, running: 1, add: 1, starved: true, depth: 2 },
  ] : []
  return { village: 'آمل', open: mode() !== 'off', targets: [N('bar_iron', 'شمش آهن'), N('plank', 'تخته'), N('bread', 'نان')], target: code ? N(code, code === 'bar_iron' ? 'شمش آهن' : code) : N('', ''), per_hour_milli: n * 1000, lines, raw: code ? [{ item: N('charcoal', 'زغال'), need_milli: n * 2000, stock: 40 }] : [], first: lines[0] ?? null,
    nodes: [{ node: N('carpentry_workshop', 'کارگاه نجاری'), built: 2, running: 1, shift_minutes: 60, slots: 3, out: [{ item: N('plank', 'تخته'), milli: 4000 }], in: [{ item: N('timber', 'چوب'), milli: 4000 }], feeds: [{ item: N('timber', 'چوب'), need_milli: 8000, have_milli: 5000, makers: [N('woodcutter_camp', 'کارگاه هیزم‌شکنی')], stock: 30 }], last_hour: [] }, { node: N('mine', 'معدن'), built: 1, running: 1, shift_minutes: 30, slots: 5, out: [{ item: N('iron_ore_lean', 'کانهٔ آهن'), milli: 1600 }], in: [{ item: N('timber_prop', 'چوب‌بست'), milli: 500 }], feeds: [{ item: N('timber_prop', 'چوب‌بست'), need_milli: 500, have_milli: 500, makers: [N('carpentry_workshop', 'کارگاه نجاری')], stock: 12 }], last_hour: [] }] }
}

export function mockMinesCommand(command: string, a: Record<string, unknown>): unknown | null {
  const act = String(a.action ?? '')
  const ok = (screen: 'settlement_mining' | 'settlement_haul' | 'settlement_rail', view: unknown) => mockOk(screen as never, view as never, [back('settlement.overview'), refreshA(command)])
  if (command === 'settlement.mining') {
    if (act === 'survey') { st.surveyed = true; return ok('settlement_mining', mining('mine_surveyed')) }
    if (act === 'works') { if (String(a.code) === 'pump') return refuse('mine_module_have'); return ok('settlement_mining', mining('mine_works_ordered')) }
    return ok('settlement_mining', mining())
  }
  if (command === 'settlement.haul') {
    if (act === 'link') { st.haulLink = true; return ok('settlement_haul', haul('haul_link_ordered')) }
    if (act === 'carrier') return ok('settlement_haul', haul('haul_carrier_ordered'))
    if (act === 'send') { if (Number(a.n) > 600) return refuse('haul_too_heavy', { max: 600 }); st.orders.push(String(a.code)); return ok('settlement_haul', haul('haul_sent')) }
    return ok('settlement_haul', haul())
  }
  if (command === 'settlement.rail') {
    if (act === 'plan') return ok('settlement_rail', rail('rail_quoted', { class: N(String(a.code), 'ریل چوبی'), from: N('v-k3x9', 'ایستگاه آمل'), to: N('v-q7m2', 'ایستگاه سرخه'), sections: 12, lots: 12, length_m: 48200, max_grade_bps: 300, materials: [mat('sleeper', 'تراورس', 72), mat('wooden_rail', 'ریل چوبی', 48)], wage: 2400, minutes: 360 }))
    if (act === 'draw') { st.lineDrawn = true; return ok('settlement_rail', rail('rail_drawn')) }
    if (act === 'build') { st.built = Math.min(12, st.built + 10); return ok('settlement_rail', rail('rail_build_ordered')) }
    if (act === 'train') { st.trainMade = true; return ok('settlement_rail', rail('rail_train_made')) }
    if (act === 'start') { st.started = true; return ok('settlement_rail', rail('rail_train_started')) }
    if (act === 'halt') { st.started = false; return ok('settlement_rail', rail('rail_train_halted')) }
    if (act === 'rate') { st.rate = Number(a.n); return ok('settlement_rail', rail('rail_rate_set')) }
    if (act === 'book') { st.booked = true; return ok('settlement_rail', rail('rail_booked')) }
    if (act === 'cancel') { st.booked = false; return ok('settlement_rail', rail('rail_booking_cancelled')) }
    if (act === 'step') return ok('settlement_rail', rail('rail_step_added'))
    if (act === 'clear') return ok('settlement_rail', rail('rail_schedule_cleared'))
    return ok('settlement_rail', rail())
  }
  if (command === 'settlement.chain') return mockOk('settlement_chain', chain(String(a.code ?? ''), Math.max(1, Number(a.n ?? 1))), [back('settlement.overview')])
  return null
}
