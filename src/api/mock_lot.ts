// «مدیریت قطعهٔ من» (settlement.lot.manage), ?lot=: default (a cottage, detail), order (an order under way), menu (two buildings), reason (the add is refused),
// use (a change of use with the fee and the desk offered), public (a settlement building, head with public.build).
import { A, back, confirmA, mockOk, mockRefusal } from './mock_neutral'
import type { LotLook, LotManageView, LotQuote } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('lot') ?? 'default' } catch { return 'default' } }
const N = (code: string, name: string) => ({ code, name })
export const LOT_LOOK: LotLook = { version: 1, function: 'dwelling', level: 1, w: 2, d: 2, storeys: 1, material: 'timber', roof: 'gable', modules: { bedroom: 1, hearth: 1, storeroom: 1 }, condition: 9400, seed: 4821, palette: 'temperate_grassland', wobble: 1, windows: 3, door: 's', hue: 6, prop: 'woodpile', chimney: true, awning: false }
let bedrooms = 1
/** ?lot=stall: my stall (a keeper can be hired); ?lot=stall-hired: he already keeps it; ?lot=stall-full: nobody free in the pool */
const keeper = { hired: (() => { try { return new URLSearchParams(location.search).get('lot') === 'stall-hired' } catch { return false } })(), pay: 'share', n: 1000 }

/** ?lot=workplace: my bakery, a job posted with 2 hands; workplace-none: no job yet; workplace-noinput: the store has no flour; workplace-noroom: the store is full */
const wp = { job: true, crew: 2, wage: 100, shifts: 40, shiftsToday: 5, shiftsTotal: 61, flour: 9, bread: 4, room: 18 }
const isWp = (m: string) => m.startsWith('workplace')
if (typeof location !== 'undefined') { try { const m = new URLSearchParams(location.search).get('lot') ?? ''; if (m === 'workplace-none') wp.job = false; if (m === 'workplace-noinput') wp.flour = 1; if (m === 'workplace-noroom') wp.room = 0 } catch { /* none */ } }
const workplaceLine = (): NonNullable<LotManageView['workplace']> => {
  const m = mode()
  const paused = wp.flour < 3 ? 'no_input' : wp.room < 2 ? 'storage_full' : ''
  const sold = (n: number) => ({ shifts: n, produced: n ? [{ item: N('bread', 'نان'), qty: n * 2 }] : null, wages: n * 100, levy: n * 5, produced_value: n * 140 })
  return { job: wp.job ? { id: 'b-lot-1', crew: wp.crew, working: paused ? 0 : Math.min(wp.crew, 1), wage: wp.wage, shifts_left: wp.shifts, paused: m === 'workplace-noinput' || m === 'workplace-noroom' ? paused : '' } : null,
    slots: 2, shift_minutes: 30, inputs: [{ item: N('flour', 'آرد'), per_shift: 3, have: wp.flour }], outputs: [{ item: N('bread', 'نان'), per_shift: 2, have: wp.bread }],
    tools_have: 1, tool_wear_bps: 4300, room_free: wp.room, room_needed: m === 'workplace-noroom' ? 2 : 0, food_have: 12, food_per_shift: 2, today: sold(wp.shiftsToday), total: sold(wp.shiftsTotal) }
}

/** ?lot=craft: a home with a workbench and a loom (ADR 0068): recipes, the running jobs (two at most) and the start; craft-full: two jobs already run; craft-poor: the store lacks the inputs */
const mat = (code: string, name: string, quantity: number) => ({ component: N(code, name), quantity })
const crafts: { id: string; recipe: ReturnType<typeof N>; batches: number; finish: number }[] = []
function craftLine(): NonNullable<LotManageView['craft']> {
  const m = mode()
  if (m === 'craft-full' && crafts.length < 2) { crafts.push({ id: 'cj-1', recipe: N('plank', 'تخته'), batches: 2, finish: Date.now() + 41 * 60000 }, { id: 'cj-2', recipe: N('cloth', 'پارچه'), batches: 1, finish: Date.now() + 18 * 60000 }) }
  const rec = (station: string, code: string, name: string, inputs: ReturnType<typeof mat>[], outputs: ReturnType<typeof mat>[], minutes: number, available = true, missing: ReturnType<typeof N>[] | null = null) => ({ station, code, name: N(code, name), default: false, selected: false, inputs, outputs, available, missing, minutes })
  return {
    stations: ['workbench', 'loom'],
    recipes: [
      rec('workbench', 'plank', 'تخته', [mat('timber', 'چوب', 4)], [mat('plank', 'تخته', 4)], 20),
      rec('workbench', 'handle', 'دسته و چوب‌دست', [mat('timber', 'چوب', 2)], [mat('handle', 'دسته', 6)], 15),
      rec('loom', 'cloth', 'پارچه', [mat('wool', 'پشم', 3)], [mat('cloth', 'پارچه', 2)], 30),
      rec('loom', 'rope', 'طناب', [mat('flax', 'کتان', 3)], [mat('rope', 'طناب', 2)], 25, false, [N('rope_making', 'طناب‌بافی')]),
    ],
    jobs: crafts.map((c) => ({ id: c.id, building: N('private_cottage', 'کلبهٔ شخصی'), recipe: c.recipe, batches: c.batches, finish_at: new Date(c.finish).toISOString(), left_seconds: Math.max(0, Math.round((c.finish - Date.now()) / 1000)), planned: null })),
    max_jobs: 2, max_batches: 4, yield_bps: 9000,
    have: [mat('timber', 'چوب', m === 'craft-poor' ? 3 : 14), mat('wool', 'پشم', 7), mat('flax', 'کتان', 0)],
  }
}
export function mockCraftStart(args: Record<string, unknown>) {
  const m = mode()
  const line = craftLine()
  const rec = (line.recipes ?? []).find((r) => r.code === String(args.recipe ?? ''))
  const refuse = (kind: string) => mockRefusal(kind, { back: { command: 'settlement.lot.manage', args: null } })
  if (!rec) return refuse('recipe_not_here')
  const n = Number(args.batches)
  if (!(n >= 1 && n <= 4)) return refuse('craft_batches')
  if (crafts.length >= 2) return refuse('craft_too_many')
  if (m === 'craft-poor' || (rec.inputs ?? []).some((i) => ((line.have ?? []).find((h) => h.component.code === i.component.code)?.quantity ?? 0) < i.quantity * n)) return refuse('craft_no_inputs')
  if (m === 'craft-room') return refuse('craft_no_room')
  const job = { id: `cj-${crafts.length + 1}`, recipe: rec.name, batches: n, finish: Date.now() + rec.minutes * n * 60000 }
  crafts.push(job)
  return mockOk('craft_started', { village: 'آمل', job: { id: job.id, building: N('private_cottage', 'کلبهٔ شخصی'), recipe: rec.name, batches: n, finish_at: new Date(job.finish).toISOString(), left_seconds: rec.minutes * n * 60, planned: null } }, [back('settlement.lot.manage', { building: 'b-lot-1' })])
}

const LOOKS: Record<string, Partial<LotLook>> = {
  'b-look-2': { roof: 'hip', storeys: 2, hue: -12, door: 'e', chimney: false, prop: 'barrels', windows: 3, seed: 11 },
  'b-look-3': { roof: 'flat', storeys: 1, material: 'stone', hue: 0, door: 'n', chimney: false, awning: true, prop: 'crates', seed: 23 },
  'b-look-4': { roof: 'shed', storeys: 3, hue: 14, door: 'w', chimney: true, prop: 'cart', windows: 4, seed: 37 },
  'b-look-5': { roof: 'gable', storeys: 2, hue: 8, door: 's', chimney: true, awning: true, prop: 'bench', seed: 41 },
  'b-look-6': { roof: 'hip', storeys: 1, material: 'stone', hue: -6, door: 's', chimney: false, prop: 'none', seed: 59 },
  'b-look-7': { roof: 'gable', storeys: 3, hue: -15, door: 'e', chimney: true, prop: 'woodpile', seed: 71 },
}

function detail(stage: string, extra: Partial<LotManageView> = {}, id = 'b-lot-1'): LotManageView {
  const m = mode()
  const order = m === 'order'
  const look = { ...LOT_LOOK, modules: { ...LOT_LOOK.modules, bedroom: bedrooms }, ...(LOOKS[id] ?? {}) }
  return {
    village: 'آمل', stage, action: '', buildings: null, id, building: N('private_cottage', 'کلبهٔ شخصی'), x: 2, y: 0, w: 2, d: 2, mine: m !== 'public', public: m === 'public', can_manage: !order, built: true,
    function: isWp(m) ? { code: 'bakery_own', name: 'نانوایی (شخصی)', family: 'craft', level: 1, max_level: 3, status: 'standing', permit: 'paid' } : { code: m.startsWith('stall') ? 'stall' : 'dwelling', name: m.startsWith('stall') ? 'دکهٔ بازار' : 'خانه', family: m.startsWith('stall') ? 'trade' : 'home', level: 1, max_level: 3, status: 'standing', permit: 'paid' }, storeys: 1, max_storeys: 2, stability_bps: 10000,
    area_used: 4 + (bedrooms - 1) * 2, area_capacity: 6,
    modules: [{ module: N('bedroom', 'اتاق خواب'), count: bedrooms, included: 1, max: 4, effect: 'housing', area_each: 2, housing_capacity: 2, personal_storage: 0, stall_slots: 0, removable: bedrooms > 1 },
      { module: N('hearth', 'اجاق'), count: 1, included: 1, max: 1, effect: '', area_each: 1, housing_capacity: 0, personal_storage: 0, stall_slots: 0, removable: false },
      { module: N('storeroom', 'انبارک'), count: 1, included: 1, max: 2, effect: 'storage', area_each: 1, housing_capacity: 0, personal_storage: 40, stall_slots: 0, removable: false }],
    additions: [
      { module: N('bedroom', 'اتاق خواب'), left: 3, materials: [{ item: N('timber', 'چوب'), qty: 3 }], shifts: 3, area_each: 2, can: m !== 'reason', reason: m === 'reason' ? 'area' : '', needs: null },
      { module: N('cellar', 'زیرزمین'), left: 1, materials: [{ item: N('stone', 'سنگ'), qty: 6 }], shifts: 4, area_each: 2, can: false, reason: 'requires', needs: [{ kind: 'knowledge', item: N('masonry', 'سنگ‌تراشی'), options: [N('masonry', 'سنگ‌تراشی')], have: 0, need: 1, makers: null, price: 0 }] },
      ...(m.startsWith('craft') ? [
        ['workbench', 'میز کار', 'timber', 'چوب', 6, 2, 2], ['forge', 'کورهٔ آهنگری', 'stone', 'سنگ', 10, 4, 3], ['loom', 'دار', 'timber', 'چوب', 8, 3, 3],
        ['kiln', 'کوره', 'clay', 'گل رس', 8, 4, 3], ['oven', 'تنور', 'clay', 'گل رس', 6, 3, 2], ['millstone', 'سنگ آسیاب', 'stone', 'سنگ', 8, 3, 2],
      ].map(([c, nm, ic, inm, q, sh, ar]) => ({ module: N(String(c), String(nm)), left: 1, materials: [{ item: N(String(ic), String(inm)), qty: Number(q) }], shifts: Number(sh), area_each: Number(ar), can: true, reason: '', needs: null })) : []),
    ],
    upgrade: { to: 2, building: N('private_cottage', 'کلبهٔ شخصی'), cost_money: 600, materials: [{ item: N('timber', 'چوب'), qty: 8 }], shifts: 5, adds: [N('bedroom', 'اتاق خواب')], can: m !== 'upblock', reason: m === 'upblock' ? 'requires' : '',
      needs: m === 'upblock' ? [{ kind: 'knowledge', item: N('masonry', 'سنگ‌تراشی'), options: [N('masonry', 'سنگ‌تراشی')], have: 0, need: 1, makers: null, price: 0 }, { kind: 'material', item: N('stone', 'سنگ'), options: null, have: 2, need: 6, makers: [{ building: N('masonry_workshop', 'کارگاه سنگ‌تراشی'), built: false }], price: 30 }] : null },
    storey_up: { to: 2, materials: [{ item: N('timber', 'چوب'), qty: 10 }], shifts: 6, can: true, reason: '' },
    functions: [
      { function: N('dwelling', 'خانه'), family: 'home', current: true, available: true, needs: null, cost_money: 0, materials: null, shifts: 0, fee_sup: 0, permit_fee: 0, effects: [] },
      { function: N('stall', 'غرفهٔ فروش'), family: 'trade', current: false, available: true, needs: null, cost_money: 400, materials: [{ item: N('timber', 'چوب'), qty: 4 }], shifts: 3, fee_sup: 24, permit_fee: 50, effects: ['پیشخوان فروش'] },
      { function: N('workshop', 'کارگاه'), family: 'craft', current: false, available: false, needs: [{ kind: 'building', item: N('carpentry_workshop', 'کارگاه نجاری'), options: [N('carpentry_workshop', 'کارگاه نجاری')], have: 0, need: 1, makers: null, price: 0 }], cost_money: 900, materials: null, shifts: 5, fee_sup: 40, permit_fee: 0, effects: [] },
      ...(isWp(m) ? [] : [
        { function: N('charcoal_clamp_own', 'کورهٔ زغال (شخصی)'), family: 'industry', current: false, available: true, needs: null, cost_money: 700, materials: [{ item: N('timber', 'چوب'), qty: 6 }], shifts: 4, fee_sup: 30, permit_fee: 60, effects: ['انبار شخصی ۴۰'] },
        { function: N('carpentry_workshop_own', 'کارگاه نجاری (شخصی)'), family: 'craft', current: false, available: true, needs: null, cost_money: 800, materials: [{ item: N('timber', 'چوب'), qty: 8 }], shifts: 4, fee_sup: 30, permit_fee: 60, effects: ['انبار شخصی ۴۰'] },
        { function: N('smithy_own', 'آهنگری (شخصی)'), family: 'craft', current: false, available: false, needs: null, cost_money: 1100, materials: null, shifts: 5, fee_sup: 40, permit_fee: 80, effects: [] },
        { function: N('bakery_own', 'نانوایی (شخصی)'), family: 'food', current: false, available: true, needs: null, cost_money: 650, materials: [{ item: N('timber', 'چوب'), qty: 5 }], shifts: 3, fee_sup: 25, permit_fee: 50, effects: ['انبار شخصی ۴۰'] },
      ]),
    ],
    work: order ? { id: 'w1', adds: [{ module: N('bedroom', 'اتاق خواب'), count: 1 }], level_to: 0, storeys_to: 0, convert_to: N('', ''), shifts_total: 3, work_done: 1, work_needed: 3, progress_bps: 3300, job_open: true, paused: '', status: 'working' } : null,
    staff: isWp(m) ? [{ role: 'baker', slots: 2 }] : [], workplace: isWp(m) ? workplaceLine() : null, housing_capacity: 2 * bedrooms, personal_storage: 40, stall_slots: 0, if_unstaffed: '', condition_bps: 9400, look,
    templates: [{ id: 't1', name: 'قالب ۱', code: 'K7M2Q', function: N('dwelling', 'خانه'), level: 1, storeys: 1, modules: [{ module: N('bedroom', 'اتاق خواب'), count: 2 }], mine: true, applicable: true, reason: '' },
      { id: 't2', name: 'کلبهٔ دوطبقه', code: 'P9X4A', function: N('dwelling', 'خانه'), level: 2, storeys: 2, modules: null, mine: false, applicable: false, reason: 'requires' }],
    keeper: m.startsWith('stall') ? { hired: keeper.hired, pay: keeper.hired ? keeper.pay : '', share_bps: keeper.hired && keeper.pay === 'share' ? keeper.n : 1000, share_min_bps: 500, share_max_bps: 2000, wage: keeper.hired && keeper.pay === 'wage' ? keeper.n : 600, wage_min: 300, wage_max: 1500, left: !keeper.hired && m === 'stall-left' ? 'wage_unpaid' : '', can: !keeper.hired && m !== 'stall-full', reason: !keeper.hired && m === 'stall-full' ? 'no_seat' : '', seats_free: m === 'stall-full' ? 0 : keeper.hired ? 2 : 3, sold_away: keeper.hired ? 18400 : 0, cut_total: keeper.hired ? 1840 : 0, sold_away_today: keeper.hired ? 3200 : 0, cut_today: keeper.hired ? 320 : 0 } : null,
    craft: m.startsWith('craft') ? craftLine() : null,
    cash: 12450, quote: null, reason: '', needs: null, code: '', n: 0, name: '', share_code: '', ...extra,
  }
}

function quote(action: string): LotQuote {
  const use = action === 'function'
  return { materials: [{ item: N('timber', 'چوب'), need: 3, have: use ? 2 : 6 }], money: use ? 400 : 0, fee_sup: use ? 24 : 0, permit_fee: 0, wages: 90, shifts: 3, cash: 12450, total: use ? 424 : 0, adds: null, level_to: 0, storeys_to: 0, convert_to: use ? N('stall', 'غرفهٔ فروش') : N('', ''), salvage: action === 'remove' ? [{ item: N('timber', 'چوب'), qty: 1 }] : null, skipped: action === 'template_apply' ? [N('workbench', 'میز کار')] : null }
}

export function mockLotCommand(command: string, args: Record<string, unknown>) {
  if (command === 'settlement.craft') return mockCraftStart(args)
  if (isWp(mode()) && /^settlement\.(labor\.(post|hire|wage|close)|work)$/.test(command) && args.id === 'b-lot-1') {
    const back = { command: 'settlement.lot.manage', args: null }
    if (command === 'settlement.work') {
      if (wp.flour < 3) return mockRefusal('materials', { back, needs: [{ kind: 'material', item: N('flour', 'آرد'), options: null, have: wp.flour, need: 3, makers: null, price: 12 }] })
      if (wp.room < 2) return mockRefusal('storage_full', { back, args: { missing: 2 - wp.room } })
      wp.flour -= 3; wp.bread += 2; wp.room -= 2; wp.shiftsToday++; wp.shiftsTotal++
    } else if (command === 'settlement.labor.post') { if (args.n !== 'repair') wp.job = true }
    else if (command === 'settlement.labor.hire') wp.crew = Number(args.n) || 0
    else if (command === 'settlement.labor.wage') wp.wage = Number(args.n) || 100
    else if (command === 'settlement.labor.close') wp.job = false
    return mockOk('labor_board', {} as never, [])
  }
  if (command !== 'settlement.lot.manage') return null
  const m = mode()
  if (!args.building && m === 'menu') {
    return mockOk('lot_manage', { ...detail('menu'), buildings: [
      { id: 'b-lot-1', building: N('private_cottage', 'کلبهٔ شخصی'), x: 2, y: 0, function: 'dwelling', function_name: 'خانه', level: 1, storeys: 1, built: true, has_order: false },
      { id: 'b-lot-2', building: N('private_stall', 'غرفهٔ فروش'), x: 4, y: 0, function: 'stall', function_name: 'غرفه', level: 1, storeys: 1, built: true, has_order: true }] }, [back('settlement.mine')])
  }
  const action = String(args.action ?? '')
  const acts = [back('settlement.mine'), A('refresh', 'settlement.lot.manage', { building: 'b-lot-1' })]
  if (!action) return mockOk('lot_manage', detail('detail', {}, String(args.building ?? 'b-lot-1')), acts)
  const reason = m === 'reason' && action === 'add' ? 'area' : action === 'add' && String(args.code) === 'cellar' ? 'requires' : ''
  if ((action === 'keeper_hire' && keeper.hired) || (action === 'keeper_end' && !keeper.hired)) return mockRefusal(action === 'keeper_hire' ? 'lot_keeper_none' : 'lot_no_keeper', { back: { command: 'settlement.lot.manage', args: null } })
  if (action === 'keeper_hire') {
    const n = Number(args.name) || 0, code = String(args.code)
    if ((code === 'share' && (n < 500 || n > 2000)) || (code === 'wage' && (n < 300 || n > 1500)) || (code !== 'share' && code !== 'wage')) return mockRefusal('lot_keeper_terms', { back: { command: 'settlement.lot.manage', args: null } })
  }
  if (action.startsWith('keeper_') && !args.confirm) return mockOk('lot_manage', detail('ask', { action }), [confirmA('settlement.lot.manage', { building: 'b-lot-1', action }), back('settlement.lot.manage', { building: 'b-lot-1' })])
  if (action.startsWith('keeper_')) { keeper.hired = action === 'keeper_hire'; if (keeper.hired) { keeper.pay = String(args.code); keeper.n = Number(args.name) || 0 } return mockOk('lot_manage', detail('done', { action }), acts) }
  if (!args.confirm) {
    return mockOk('lot_manage', detail('ask', { action, quote: quote(action), reason, needs: reason === 'requires' ? detail('detail').additions![1].needs : null, code: String(args.code ?? ''), n: Number(args.n ?? 0) }), [confirmA('settlement.lot.manage', { building: 'b-lot-1', action, code: String(args.code ?? '') }), back('settlement.lot.manage', { building: 'b-lot-1' })])
  }
  if (action === 'add' && String(args.code) === 'bedroom') bedrooms++
  return mockOk('lot_manage', detail('done', { action, share_code: action === 'template_save' ? 'Q4Z8M' : '' }), acts)
}
