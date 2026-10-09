// «مدیریت قطعهٔ من» (settlement.lot.manage), ?lot=: default (a cottage, detail), order (an order under way), menu (two buildings), reason (the add is refused),
// use (a change of use with the fee and the desk offered), public (a settlement building, head with public.build).
import { A, back, confirmA, mockOk } from './mock_neutral'
import type { LotLook, LotManageView, LotQuote } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('lot') ?? 'default' } catch { return 'default' } }
const N = (code: string, name: string) => ({ code, name })
export const LOT_LOOK: LotLook = { version: 1, function: 'dwelling', level: 1, w: 2, d: 2, storeys: 1, material: 'timber', roof: 'gable', modules: { bedroom: 1, hearth: 1, storeroom: 1 }, condition: 9400, seed: 4821, palette: 'temperate_grassland', wobble: 1, windows: 3, door: 's', hue: 6, prop: 'woodpile', chimney: true, awning: false }
let bedrooms = 1

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
    function: { code: 'dwelling', name: 'خانه', family: 'home', level: 1, max_level: 3, status: 'standing', permit: 'paid' }, storeys: 1, max_storeys: 2, stability_bps: 10000,
    area_used: 4 + (bedrooms - 1) * 2, area_capacity: 6,
    modules: [{ module: N('bedroom', 'اتاق خواب'), count: bedrooms, included: 1, max: 4, effect: 'housing', area_each: 2, housing_capacity: 2, personal_storage: 0, stall_slots: 0, removable: bedrooms > 1 },
      { module: N('hearth', 'اجاق'), count: 1, included: 1, max: 1, effect: '', area_each: 1, housing_capacity: 0, personal_storage: 0, stall_slots: 0, removable: false },
      { module: N('storeroom', 'انبارک'), count: 1, included: 1, max: 2, effect: 'storage', area_each: 1, housing_capacity: 0, personal_storage: 40, stall_slots: 0, removable: false }],
    additions: [
      { module: N('bedroom', 'اتاق خواب'), left: 3, materials: [{ item: N('timber', 'چوب'), qty: 3 }], shifts: 3, area_each: 2, can: m !== 'reason', reason: m === 'reason' ? 'area' : '', needs: null },
      { module: N('cellar', 'زیرزمین'), left: 1, materials: [{ item: N('stone', 'سنگ'), qty: 6 }], shifts: 4, area_each: 2, can: false, reason: 'requires', needs: [{ kind: 'knowledge', item: N('masonry', 'سنگ‌تراشی'), options: [N('masonry', 'سنگ‌تراشی')], have: 0, need: 1, makers: null, price: 0 }] },
    ],
    upgrade: { to: 2, building: N('private_cottage', 'کلبهٔ شخصی'), cost_money: 600, materials: [{ item: N('timber', 'چوب'), qty: 8 }], shifts: 5, adds: [N('bedroom', 'اتاق خواب')], can: true, reason: '', needs: null },
    storey_up: { to: 2, materials: [{ item: N('timber', 'چوب'), qty: 10 }], shifts: 6, can: true, reason: '' },
    functions: [
      { function: N('dwelling', 'خانه'), family: 'home', current: true, available: true, needs: null, cost_money: 0, materials: null, shifts: 0, fee_sup: 0, permit_fee: 0, effects: [] },
      { function: N('stall', 'غرفهٔ فروش'), family: 'trade', current: false, available: true, needs: null, cost_money: 400, materials: [{ item: N('timber', 'چوب'), qty: 4 }], shifts: 3, fee_sup: 24, permit_fee: 50, effects: ['پیشخوان فروش'] },
      { function: N('workshop', 'کارگاه'), family: 'craft', current: false, available: false, needs: [{ kind: 'building', item: N('carpentry_workshop', 'کارگاه نجاری'), options: [N('carpentry_workshop', 'کارگاه نجاری')], have: 0, need: 1, makers: null, price: 0 }], cost_money: 900, materials: null, shifts: 5, fee_sup: 40, permit_fee: 0, effects: [] },
    ],
    work: order ? { id: 'w1', adds: [{ module: N('bedroom', 'اتاق خواب'), count: 1 }], level_to: 0, storeys_to: 0, convert_to: N('', ''), shifts_total: 3, work_done: 1, work_needed: 3, progress_bps: 3300, job_open: true, paused: '', status: 'working' } : null,
    staff: [], housing_capacity: 2 * bedrooms, personal_storage: 40, stall_slots: 0, if_unstaffed: '', condition_bps: 9400, look,
    templates: [{ id: 't1', name: 'قالب ۱', code: 'K7M2Q', function: N('dwelling', 'خانه'), level: 1, storeys: 1, modules: [{ module: N('bedroom', 'اتاق خواب'), count: 2 }], mine: true, applicable: true, reason: '' },
      { id: 't2', name: 'کلبهٔ دوطبقه', code: 'P9X4A', function: N('dwelling', 'خانه'), level: 2, storeys: 2, modules: null, mine: false, applicable: false, reason: 'requires' }],
    cash: 12450, quote: null, reason: '', needs: null, code: '', n: 0, name: '', share_code: '', ...extra,
  }
}

function quote(action: string): LotQuote {
  const use = action === 'function'
  return { materials: [{ item: N('timber', 'چوب'), need: 3, have: use ? 2 : 6 }], money: use ? 400 : 0, fee_sup: use ? 24 : 0, permit_fee: 0, wages: 90, shifts: 3, cash: 12450, total: use ? 424 : 0, adds: null, level_to: 0, storeys_to: 0, convert_to: use ? N('stall', 'غرفهٔ فروش') : N('', ''), salvage: action === 'remove' ? [{ item: N('timber', 'چوب'), qty: 1 }] : null, skipped: action === 'template_apply' ? [N('workbench', 'میز کار')] : null }
}

export function mockLotCommand(command: string, args: Record<string, unknown>) {
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
  if (!args.confirm) {
    return mockOk('lot_manage', detail('ask', { action, quote: quote(action), reason, needs: reason === 'requires' ? detail('detail').additions![1].needs : null, code: String(args.code ?? ''), n: Number(args.n ?? 0) }), [confirmA('settlement.lot.manage', { building: 'b-lot-1', action, code: String(args.code ?? '') }), back('settlement.lot.manage', { building: 'b-lot-1' })])
  }
  if (action === 'add' && String(args.code) === 'bedroom') bedrooms++
  return mockOk('lot_manage', detail('done', { action, share_code: action === 'template_save' ? 'Q4Z8M' : '' }), acts)
}
