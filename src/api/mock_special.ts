// Great works, intelligence and licences of the mock (ADR 0077), ?mock=1&special=off|on|noperm|empty|official.
// Commands: settlement.project, settlement.intel, settlement.licence. The mine of «من» shows an offer of work.
import { back, mockOk, refreshA } from './mock_neutral'
import type { IntelView, LicenceView, ProjectLine, ProjectView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('special') ?? 'on' } catch { return 'on' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const st = {
  started: false, pledged: false, unpledged: false, funded: 0, delivered: 0, worked: false, hired: false, cancelled: false, tender: false, bid: false, awarded: false, defect: false,
  engaged: false, accepted: false, refused: false, recalled: false, surveyed: false, shared: false, vet: 7, spoiled: false,
  ruleSet: false, ruleUnset: false, claimed: false, applied: false, issued: false, bidSealed: false, renewed: false, listed: false, bought: false, revoked: false, auctionOpened: false,
}
const refuse = (kind: string, command: string) => ({ ...mockOk('village_refusal', { kind, back: { command, args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, []), ok: false, error: { code: `village_${kind}`, args: {} } })

// -- great works ---------------------------------------------------------------------------------

function project(notice = ''): ProjectView {
  const m = mode(), perm = m !== 'noperm', empty = m === 'empty'
  if (m === 'off') return { village: 'آمل', open: false, may_start: false, fee: 0, pledge_min: 0, shift_minutes: 0, kinds: null, projects: null, board: null, companies: null, notice }
  const contract = (status: string) => ({ id: 'ct1', status, rule: 'lowest_price', budget_cap: 90000, bond_bps: 1000, retention_bps: 1000, defects_days: 7, due_days: 30, closes_at: iso(st.awarded ? -2 : 20), company: st.awarded ? N('c-x', 'عمران سرخه') : null, price: st.awarded ? 82000 : 0, due_at: st.awarded ? iso(24 * 20) : null, stages_paid: st.awarded ? 1 : 0, retention_held: st.awarded ? 9000 : 0,
    bids: [{ id: 'bd1', company: N('c-x', 'عمران سرخه'), price: 82000, days: 25, record: 7, bond: 8200, status: st.awarded ? 'won' : 'standing', mine: false }, ...(st.bid ? [{ id: 'bd2', company: N('c-mine', 'ساختمان‌سازی البرز'), price: 85000, days: 20, record: 4, bond: 8500, status: st.awarded ? 'lost' : 'standing', mine: true }] : [])],
    may_bid: false, may_award: perm && !st.awarded, may_cancel: perm, may_defect: perm && st.awarded })
  const wall: ProjectLine = {
    id: 'p1', kind: N('city_wall', 'حصار شهر'), effect: 'garrison', status: st.cancelled ? 'cancelled' : 'active', stage: 2, stages: 4, hours: 20 + (st.worked ? 8 : 0), need_hour: 48, fund: 14200 + st.funded + (st.pledged ? 5000 : 0) - (st.unpledged ? 5000 : 0), waiting: st.delivered > 0 ? 'crew' : 'materials',
    materials: [{ item: 'stone', need: 80, have: 52 + st.delivered }, { item: 'timber', need: 20, have: 20 }], min_until: iso(9), delay: null, held: false, idle: '',
    donors: [{ id: 'd1', name: 'آریا', kind: 'player', amount: 5000, at: iso(-30), status: st.unpledged ? 'refunded' : 'held', mine: true, refunds: false, anonymous: false }, { id: 'd2', name: '', kind: 'player', amount: 3000, at: iso(-20), status: 'held', mine: false, refunds: false, anonymous: true }, { id: 'd3', name: 'سیما', kind: 'player', amount: 6200, at: iso(-9), status: 'held', mine: false, refunds: false, anonymous: false },
      ...(st.pledged ? [{ id: 'd4', name: 'آریا', kind: 'player', amount: 5000, at: iso(0), status: st.unpledged ? 'refunded' : 'held', mine: true, refunds: true, anonymous: false }] : [])],
    done: [{ stage: 1, hours: 40, at: iso(-60) }], shifts: [{ id: 's1', player: N('p-sima', 'سیما'), hours: 4, status: 'running', ends_at: iso(1), mine: false }, { id: 's2', player: N('p-aria', 'آریا'), hours: 4, status: st.worked ? 'running' : 'done', ends_at: iso(st.worked ? 1.5 : -3), mine: true }],
    contract: null, my_shift: st.worked ? { id: 's2', player: N('p-aria', 'آریا'), hours: 4, status: 'running', ends_at: iso(1.5), mine: true } : null,
    may_pledge: true, may_fund: perm, may_cancel: perm, may_work: true, may_hire: perm, may_tender: false, hired_today: st.hired ? 6 : 2, hire_per_day: 12, shift_hours: 4,
  }
  const aq: ProjectLine = {
    id: 'p4', kind: N('aqueduct', 'آبراه'), effect: 'household_water', status: 'active', stage: 1, stages: 5, hours: 0, need_hour: 30, fund: 2000, waiting: 'materials', materials: [{ item: 'stone', need: 40, have: 0 }, { item: 'plank', need: 10, have: 4 }], min_until: null, delay: null, held: false, idle: '',
    donors: null, done: null, shifts: null, contract: st.tender ? contract(st.awarded ? 'awarded' : 'open') : null, my_shift: null,
    may_pledge: true, may_fund: perm, may_cancel: perm, may_work: !st.tender, may_hire: false, may_tender: perm && !st.tender, hired_today: 0, hire_per_day: 12, shift_hours: 4,
  }
  const lib: ProjectLine = { id: 'p2', kind: N('great_library', 'کتابخانهٔ بزرگ'), effect: 'research', status: 'finished', stage: 3, stages: 3, hours: 0, need_hour: 0, fund: 0, waiting: '', materials: null, min_until: null, delay: null, held: true, idle: '', donors: [{ id: 'd9', name: 'سیما', kind: 'player', amount: 9000, at: iso(-400), status: 'held', mine: false, refunds: false, anonymous: false }], done: [{ stage: 1, hours: 24, at: iso(-500) }, { stage: 2, hours: 32, at: iso(-450) }, { stage: 3, hours: 24, at: iso(-410) }], shifts: null, contract: null, my_shift: null, may_pledge: false, may_fund: false, may_cancel: false, may_work: false, may_hire: false, may_tender: false, hired_today: 0, hire_per_day: 0, shift_hours: 4 }
  const temple: ProjectLine = { ...lib, id: 'p3', kind: N('great_temple', 'نیایشگاه بزرگ'), effect: 'trade_footfall', stages: 4, stage: 4, held: false, idle: 'no_wage' }
  const kinds = [
    { code: 'great_library', name: 'کتابخانهٔ بزرگ', stages: 3, effect: 'research', available: true, missing: null },
    { code: 'city_wall', name: 'حصار شهر', stages: 4, effect: 'garrison', available: true, missing: null },
    { code: 'aqueduct', name: 'آبراه', stages: 5, effect: 'household_water', available: true, missing: null },
    { code: 'great_beacon', name: 'فانوس بزرگ', stages: 4, effect: 'detector', available: false, missing: ['writing', 'masonry'] },
    { code: 'great_canal', name: 'کانال بزرگ', stages: 6, effect: 'farm_water', available: false, missing: ['irrigation'] },
    { code: 'great_temple', name: 'نیایشگاه بزرگ', stages: 4, effect: 'trade_footfall', available: true, missing: null },
  ]
  return {
    village: 'آمل', open: true, may_start: perm, fee: 1200, pledge_min: 100, shift_minutes: 30, kinds,
    projects: empty ? null : [wall, aq, lib, temple, ...(st.started ? [{ ...aq, id: 'p5', kind: N('great_canal', 'کانال بزرگ'), effect: 'farm_water', stages: 6, donors: null, contract: null, may_tender: false }] : [])],
    board: [{ contract: { ...contract('open'), id: 'ct9', may_bid: true, may_award: false, may_cancel: false, bids: [] }, project: N('great_beacon', 'فانوس بزرگ'), settlement: N('v-q7m2', 'سرخه') }],
    companies: [{ company: N('c-mine', 'ساختمان‌سازی البرز'), record: 4, debarred_until: null }],
    notice,
  }
}

// -- intelligence -------------------------------------------------------------------------------

function intel(notice = ''): IntelView {
  const m = mode(), perm = m !== 'noperm'
  const base = { village: 'آمل', open: m !== 'off', bureau_built: m !== 'empty', bureau_open: m !== 'empty', may_run: perm, may_read: perm, may_vet: perm, sabotage_open: true, vetting_days: st.vet, counter: 'light', notice }
  if (m === 'off') return { ...base, agents: null, offers: null, reports: null, ops: null, acts: null, expelled: null }
  const ops = [
    { code: 'survey_stock', name: 'انبار و خزانه', kind: 'survey', available: true, missing: null },
    { code: 'survey_garrison', name: 'نگهبان‌ها', kind: 'survey', available: true, missing: null },
    { code: 'survey_projects', name: 'کارهای بزرگ', kind: 'survey', available: false, missing: ['masonry'] },
    { code: 'delay_work', name: 'کندکردن کار', kind: 'sabotage', available: true, missing: null },
    { code: 'spoil_stock', name: 'تباه‌کردن', kind: 'sabotage', available: true, missing: null },
    { code: 'blind_post', name: 'کورکردن دیده‌بانی', kind: 'sabotage', available: false, missing: ['irrigation'] },
  ]
  const ag = (id: string, status: string, who: string, extra: Record<string, unknown> = {}) => ({ id, player: N(`p-${id}`, who), sponsor: N('v-k3x9', 'آمل'), target: N('v-q7m2', 'سرخه'), status, cover_days: 12, ops_today: 0, mine: false, may_accept: false, may_recall: true, may_operate: status === 'active', created_at: iso(-300), ended_at: null, ...extra })
  return {
    ...base,
    agents: m === 'empty' ? null : [ag('a1', 'active', 'سیما'), ag('a2', st.engaged ? 'offered' : 'declined', 'نیما', { may_operate: false, may_recall: st.engaged }), { ...ag('a3', 'active', 'آریا', { mine: true, sponsor: N('v-b2', 'بابل'), target: N('v-k3x9', 'آمل'), may_operate: false }) }],
    offers: st.accepted || st.refused ? null : [{ id: 'o1', player: N('p-aria', 'آریا'), sponsor: N('v-b2', 'بابل'), target: N('v-k3x9', 'آمل'), status: 'offered', cover_days: 0, ops_today: 0, mine: true, may_accept: true, may_recall: false, may_operate: false, created_at: iso(-3), ended_at: null }],
    reports: [
      { id: 'r1', op: 'survey_stock', target: N('v-q7m2', 'سرخه'), confidence: 'high', fields: [{ metric: 'treasury', band: 'ample' }, { metric: 'food', band: 'enough' }, { metric: 'materials', band: 'scarce' }], taken_at: iso(-5), old: false, shared: false, may_share: true },
      { id: 'r2', op: 'survey_garrison', target: N('v-q7m2', 'سرخه'), confidence: 'low', fields: [{ metric: 'seats', band: 'few' }, { metric: 'watch_posts', band: 'several' }], taken_at: iso(-24 * 9), old: true, shared: st.shared, may_share: false },
      ...(st.surveyed ? [{ id: 'r3', op: 'survey_stock', target: N('v-q7m2', 'سرخه'), confidence: 'medium', fields: [{ metric: 'treasury', band: 'modest' }], taken_at: iso(0), old: false, shared: false, may_share: true }] : []),
    ],
    ops,
    acts: [{ kind: 'delay_work', done: true, by_us: false, target: N('v-k3x9', 'آمل'), sponsor: null, at: iso(-30), repair: '', repaired: false }, { kind: 'spoil_stock', done: true, by_us: true, target: N('v-q7m2', 'سرخه'), sponsor: N('v-k3x9', 'آمل'), at: iso(-80), repair: '', repaired: true }],
    expelled: [{ sponsor: null, until: iso(24 * 4), at: iso(-24 * 3) }, { sponsor: N('v-b2', 'بابل'), until: iso(24 * 9), at: iso(-24) }],
  }
}

// -- licences -----------------------------------------------------------------------------------

function licence(notice = ''): LicenceView {
  const m = mode(), official = m === 'official', perm = m !== 'noperm'
  if (m === 'off') return { village: 'آمل', open: false, may_set_kind: false, may_issue: false, may_auction: false, may_revoke: false, kinds: null, mine: null, register: null, auctions: null, applications: null, board: null, events: null, companies: null, transfer_fee_bps: 0, listing_fee: 0, notice }
  const kind = (code: string, name: string, extra: Record<string, unknown>) => ({ code, name, target: '', gate: '', duty: '', available: true, missing: null, required: false, mode: '', fee: 0, reserve: 0, term_days: 0, transferable: false, effective_at: null, in_grace: false, deferred: false, ...extra })
  const lic = (id: string, no: number, k: string, who: string, extra: Record<string, unknown> = {}) => ({ id, no, kind: k, holder: N(`h-${id}`, who), holder_kind: 'player', target: '', via: 'fee', status: 'active', paid: 800, term_end: iso(24 * 20), notice_until: null, cause: '', mine: false, may_renew: false, may_list: false, may_revoke: official, proposed: false, ...extra })
  const mineStall = lic('l1', 7, 'craft_privilege', 'آریا', { mine: true, target: 'نانوایی', transferable: true, may_renew: true, may_list: true, may_revoke: false })
  return {
    village: 'آمل', open: true, may_set_kind: official, may_issue: official, may_auction: official, may_revoke: official, transfer_fee_bps: 500, listing_fee: 50, notice,
    kinds: [
      kind('stall_right', 'حق غرفه در بازارچه', { gate: 'stall', required: true, mode: 'fixed', fee: 800, term_days: 30, transferable: true, effective_at: iso(24 * 6), in_grace: true }),
      kind('works_class', 'رتبهٔ پیمانکاری', { gate: 'works', required: true, mode: 'fixed', fee: 2000, term_days: 60, effective_at: iso(-24 * 3), in_grace: false }),
      kind('craft_privilege', 'امتیاز یک پیشه', { target: 'craft', gate: 'craft', required: true, mode: 'auction', reserve: 1500, term_days: 45, transferable: true, effective_at: iso(-24 * 3) }),
      kind('concession', 'امتیاز بهره‌برداری', { target: 'deposit', deferred: true }),
      kind('toll_franchise', 'امتیاز عوارض راه', { target: 'link', deferred: true, available: false, missing: ['writing'] }),
    ],
    mine: [mineStall, ...(st.claimed ? [lic('l2', 12, 'stall_right', 'آریا', { mine: true, via: 'first_grant' })] : []), lic('l3', 5, 'works_class', 'ساختمان‌سازی البرز', { holder_kind: 'company', mine: true, status: 'notice', notice_until: iso(24 * 5), may_revoke: false })],
    register: [
      mineStall, lic('l4', 8, 'stall_right', 'سیما'), lic('l5', 9, 'craft_privilege', 'نیما', { target: 'نجاری', transferable: true, may_list: false }),
      lic('l6', 3, 'works_class', 'عمران سرخه', { holder_kind: 'company', proposed: official && !st.revoked }),
      lic('l7', 2, 'stall_right', 'کاوه', { status: 'revoked', cause: 'non_use', may_revoke: false }),
    ],
    auctions: [
      { id: 'au1', kind: 'craft_privilege', target: 'آهنگری', reserve: 1500, status: 'open', closes_at: iso(30), price: 0, bids: 3 + (st.bidSealed ? 1 : 0), my_bid: st.bidSealed ? { id: 'b1', amount: 1800, status: 'standing' } : null, may_bid: perm },
      { id: 'au2', kind: 'craft_privilege', target: 'نجاری', reserve: 1500, status: 'awarded', closes_at: iso(-50), price: 2300, bids: 4, my_bid: null, may_bid: false },
      ...(st.auctionOpened ? [{ id: 'au3', kind: 'craft_privilege', target: 'رنگرزی', reserve: 1500, status: 'open', closes_at: iso(48), price: 0, bids: 0, my_bid: null, may_bid: true }] : []),
    ],
    applications: st.applied && !st.issued ? [{ id: 'ap1', kind: 'works_class', target: '', holder: N('p-aria', 'آریا'), holder_kind: 'player', fee: 2000, at: iso(-1), mine: true, may_decide: false }] : official && !st.issued ? [{ id: 'ap2', kind: 'works_class', target: '', holder: N('c-x', 'بنایان شمال'), holder_kind: 'company', fee: 2000, at: iso(-2), mine: false, may_decide: true }] : [],
    board: st.bought ? [] : [{ id: 'ls1', licence: lic('l8', 4, 'craft_privilege', 'سیما', { target: 'نجاری', transferable: true }), price: 1200, fee: 60, mine: false, may_buy: true }, { id: 'ls2', licence: mineStall, price: 1000, fee: 50, mine: true, may_buy: false }],
    events: [{ kind: 'granted', actor: N('p-x', 'سیما'), licence: 8, at: iso(-30) }, { kind: 'auction_awarded', actor: N('', ''), licence: 9, at: iso(-50) }, { kind: 'revoked', actor: N('p-y', 'کاوه'), licence: 2, at: iso(-120) }, { kind: 'rule_set', actor: N('', ''), licence: 0, at: iso(-24 * 5) }],
    companies: [N('c-mine', 'ساختمان‌سازی البرز')],
  }
}

export function mockSpecialCommand(command: string, a: Record<string, unknown>): unknown | null {
  const act = String(a.action ?? '')
  if (command === 'settlement.project') {
    const ok = (n = '') => mockOk('settlement_project', project(n), [back('settlement.overview'), refreshA(command)])
    if (act === 'start') { st.started = true; return ok('project_started') }
    if (act === 'pledge') { if (Number(a.amount) < 100) return refuse('project_below_min', command); st.pledged = true; return ok('project_pledged') }
    if (act === 'unpledge') { st.unpledged = true; return ok('project_unpledged') }
    if (act === 'allocate') { st.funded += Number(a.amount) || 0; return ok('project_allocated') }
    if (act === 'deliver' || act === 'give') { st.delivered += Number(a.n) || 0; return ok('project_delivered') }
    if (act === 'work') { st.worked = true; return ok('project_working') }
    if (act === 'hire') { st.hired = true; return ok('project_hired') }
    if (act === 'cancel') { if (String(a.id) === 'p1') return refuse('project_too_late_to_cancel', command); st.cancelled = true; return ok('project_cancelled') }
    if (act === 'tender') { st.tender = true; return ok('project_tender') }
    if (act === 'bid') { if (Number(a.price) === 1) return refuse('project_bad_bid', command); st.bid = true; st.tender = true; return ok('project_bid') }
    if (act === 'withdraw') { st.bid = false; return ok('project_bid_withdrawn') }
    if (act === 'award') { st.awarded = true; return ok('project_awarded') }
    if (act === 'defect') { st.defect = true; return ok('project_defect') }
    return ok()
  }
  if (command === 'settlement.intel') {
    const ok = (n = '') => mockOk('settlement_intel', intel(n), [back('settlement.overview'), refreshA(command)])
    if (act === 'engage') { if (!String(a.player ?? '').trim()) return refuse('intel_no_player', command); st.engaged = true; return ok('intel_engaged') }
    if (act === 'accept') { st.accepted = true; return ok('intel_accepted') }
    if (act === 'refuse') { st.refused = true; return ok('intel_refused') }
    if (act === 'recall') { st.recalled = true; return ok('intel_recalled') }
    if (act === 'op') { st.surveyed = true; return ok('intel_op_clean') }
    if (act === 'sabotage') { if (String(a.ref) === 'x') return refuse('intel_sabotage_refused_weekly_limit', command); st.spoiled = true; return ok('intel_sabotage_done') }
    if (act === 'share') { st.shared = true; return ok('intel_shared') }
    if (act === 'vet') { st.vet = Number(a.n) || 0; return ok('intel_vetting_set') }
    return ok()
  }
  if (command === 'settlement.licence') {
    const ok = (n = '') => mockOk('settlement_licence', licence(n), [back('market.list'), refreshA(command)])
    if (act === 'set_kind') { if (String(a.code) === 'concession') return refuse('licence_kind_deferred', command); st.ruleSet = true; return ok('licence_kind_set') }
    if (act === 'unset_kind') { st.ruleUnset = true; return ok('licence_kind_closed') }
    if (act === 'claim') { st.claimed = true; return ok('licence_granted') }
    if (act === 'apply') { if (String(a.code) === 'concession') return refuse('licence_kind_deferred', command); st.applied = true; return ok('licence_applied') }
    if (act === 'issue') { st.issued = true; return ok('licence_granted') }
    if (act === 'decline') { st.issued = true; return ok('licence_declined') }
    if (act === 'withdraw') { st.applied = false; return ok('licence_application_withdrawn') }
    if (act === 'auction') { st.auctionOpened = true; return ok('licence_auction_opened') }
    if (act === 'bid') { if (Number(a.amount) < 1500) return refuse('licence_below_reserve', command); st.bidSealed = true; return ok('licence_bid_placed') }
    if (act === 'renew') { st.renewed = true; return ok('licence_renewed') }
    if (act === 'list') { st.listed = true; return ok('licence_listed') }
    if (act === 'buy') { st.bought = true; return ok('licence_bought') }
    if (act === 'delist') { st.listed = false; return ok('licence_delisted') }
    if (act === 'revoke') { st.revoked = true; return ok(String(a.cause ?? '') ? 'licence_notice_given' : 'licence_revoked') }
    return ok()
  }
  return null
}
