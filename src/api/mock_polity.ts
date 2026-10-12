// Unions, countries, treaties, tenders and loans of the mock (ADR 0076), ?mock=1&polity=off|on|country|noperm|empty.
// Commands: settlement.union, treaty, tender, debt. The society hub lists the unions tile and, for a country, the army tile.
import { back, mockOk, refreshA } from './mock_neutral'
import type { DebtView, SettlementTreatyLine, SettlementTreatyView, TenderView, UnionDetail, UnionView } from './views.gen'

export const polityMode = () => { try { return new URLSearchParams(location.search).get('polity') ?? 'on' } catch { return 'on' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const st = { founded: false, ratified: false, voted: false, motionVoted: false, left: false, treaties: [] as string[], ended: false, accepted: false, tenderPosted: false, bid: false, awarded: false, loan: false, loanAccepted: false, restructured: false, writtenOff: false, officeSaved: false, appointed: false }
const refuse = (kind: string, screen = 'settlement.union') => ({ ...mockOk('village_refusal', { kind, back: { command: screen, args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, []), ok: false, error: { code: `village_${kind}`, args: {} } })

const CLASSES = ['dues', 'treaty', 'defence', 'courts', 'currency', 'customs', 'war', 'roads', 'claims']
const detail = (): UnionDetail => ({
  id: 'u-alborz', name: 'اتحاد البرز', kind: 'league', members: 3, delegations: ['dues', 'treaty', 'roads'], purse: 18400, vote_mode: 'double_majority', exit_rule: 'free', dues_fixed: 200, dues_share: 150,
  my_status: st.left ? 'notice' : 'active',
  roster: [
    { settlement: N('v-k3x9', 'آمل'), status: st.left ? 'notice' : 'active', residents: 24, arrears: 0, joined_at: iso(-300), notice_ends: st.left ? iso(24 * 5) : null, paid: 4200 },
    { settlement: N('v-q7m2', 'سرخه'), status: 'active', residents: 31, arrears: 0, joined_at: iso(-300), notice_ends: null, paid: 6200 },
    { settlement: N('v-k8', 'نمین'), status: 'active', residents: 12, arrears: 2, joined_at: iso(-120), notice_ends: null, paid: 800 },
  ],
  offices: [
    { id: 'o1', title: 'دبیر اتحاد', seats: 1, acquisition: 'appointment', grants: [{ permission: 'union.admit', limit: 0 }, { permission: 'treaty.sign', limit: 0 }, { permission: 'treasury.spend', limit: 5000 }], holders: [N('p-aria', 'آریا')] },
    { id: 'o2', title: 'خزانه‌دار', seats: 2, acquisition: 'appointment', grants: [{ permission: 'treasury.spend', limit: 0 }, { permission: 'debt.lend', limit: 20000 }], holders: st.appointed ? [N('p-sima', 'سیما')] : [] },
  ],
  motions: st.motionVoted ? [] : [{ id: 'm1', kind: 'admit', subject: N('v-x1', 'گلستان'), closes_at: iso(30), yes: 2, no: 0, my_vote: '', may_vote: true, mode: 'double_majority', members: 3, yes_members: 2, no_members: 0, weight: 67, yes_weight: 55, no_weight: 0, members_bps: 5000, population_bps: 5000 }],
  ballots: [{ id: 'b1', kind: 'recall', subject: N('p-aria', 'آریا'), target: 'o1', closes_at: iso(40), yes: 5, no: 2, signatures: 0, need: 12, petition: false, may_vote: !st.voted, voted: st.voted }],
  audit: [{ action: 'founded', at: iso(-300), office: '' }, { action: 'admit', at: iso(-120), office: 'دبیر اتحاد' }],
  permissions: [{ code: 'union.admit', group: 'foreign', limited: false, active: true, class: '' }, { code: 'treaty.sign', group: 'foreign', limited: false, active: true, class: 'treaty' }, { code: 'treasury.spend', group: 'treasury', limited: true, active: true, class: '' }, { code: 'war.declare', group: 'foreign', limited: false, active: true, class: 'war' }, { code: 'military.command', group: 'defence', limited: false, active: true, class: 'defence' }, { code: 'debt.lend', group: 'money', limited: true, active: true, class: '' }, { code: 'office.create', group: 'politics', limited: false, active: true, class: '' }],
  held: ['union.admit', 'war.declare', 'treaty.sign', 'treasury.spend', 'charter.amend', 'office.create', 'office.edit'],
  may_office: true, may_appoint: true, may_dismiss: true, may_admit: true, may_expel: true, may_vote_member: true, may_leave: true, may_accede: false,
})

function union(notice = '', id = ''): UnionView {
  const m = polityMode()
  if (m === 'off') return { village: 'آمل', open: false, open_at: iso(24 * 9), may_propose: false, may_ratify: false, country_min_residents: 60, fee_league: 3000, fee_country: 8000, unions: null, proposals: null, detail: null, targets: null, classes: null, notice }
  const empty = m === 'empty'
  const perm = m !== 'noperm'
  return {
    village: 'آمل', open: true, open_at: null, may_propose: perm, may_ratify: perm, country_min_residents: 60, fee_league: 3000, fee_country: 8000, notice,
    unions: empty ? null : [
      { id: 'u-alborz', name: 'اتحاد البرز', kind: 'league', members: 3, delegations: ['dues', 'treaty', 'roads'], purse: 18400, vote_mode: 'double_majority', exit_rule: 'free', dues_fixed: 200, dues_share: 150, my_status: st.left ? 'notice' : 'active' },
      ...(m === 'country' ? [{ id: 'u-iran', name: 'کشور سرزمین سبز', kind: 'country', members: 5, delegations: ['dues', 'treaty', 'defence', 'courts', 'war', 'customs'], purse: 96000, vote_mode: 'weighted', exit_rule: 'consent', dues_fixed: 500, dues_share: 300, my_status: 'active' }] : []),
    ],
    proposals: empty ? null : [{ id: 'pr1', name: 'اتحاد دریای شمال', kind: 'league', delegations: ['treaty', 'roads'], deadline: iso(60), fee: 3000, mine: false, invites: [{ settlement: N('v-k3x9', 'آمل'), decision: st.ratified ? 'yes' : 'pending' }, { settlement: N('v-b2', 'بابل'), decision: 'yes' }, { settlement: N('v-n4', 'نوشهر'), decision: 'assembly' }], may_ratify: perm && !st.ratified, needs_assembly: false, ballot: null },
      { id: 'pr2', name: 'کشور شمال', kind: 'country', delegations: ['treaty', 'courts', 'war', 'defence'], deadline: iso(90), fee: 8000, mine: true, invites: [{ settlement: N('v-k3x9', 'آمل'), decision: 'assembly' }, { settlement: N('v-b2', 'بابل'), decision: 'pending' }], may_ratify: false, needs_assembly: true, ballot: { id: 'pb1', kind: 'assembly', subject: N('pr2', 'کشور شمال'), target: 'pr2', closes_at: iso(36), yes: 9, no: 4, signatures: 0, need: 14, petition: false, may_vote: !st.voted, voted: st.voted } }],
    detail: id ? detail() : null,
    targets: [N('v-b2', 'بابل'), N('v-n4', 'نوشهر'), N('v-x1', 'گلستان'), N('v-r5', 'رامسر')], classes: CLASSES,
  }
}

function treaty(notice = '', unionId = ''): SettlementTreatyView {
  const m = polityMode(), perm = m !== 'noperm'
  const line = (no: number, kind: string, other: string, status: string, o: Partial<SettlementTreatyLine> = {}): SettlementTreatyLine => ({ ended_party: null, no, kind: N(kind, kind), other: N(other, other), status, mine: false, proposed_at: iso(-200), expires_at: null, ended_at: null, passage: kind === 'passage', alliance: kind === 'alliance', cooling_until: null, ...o })
  return {
    village: 'آمل', open: m !== 'off', party: unionId ? N(unionId, 'اتحاد البرز') : N('v-k3x9', 'آمل'), party_kind: unionId ? 'union' : 'settlement', may_propose: perm, may_sign: perm, may_end: perm, notice,
    treaties: [
      line(1, 'alliance', 'سرخه', st.ended ? 'terminated' : 'active', st.ended ? { ended_at: iso(-1), cooling_until: iso(24 * 7) } : {}),
      line(2, 'passage', 'نمین', 'active'),
      line(3, 'non_aggression', 'بابل', st.accepted ? 'active' : 'proposed', { expires_at: iso(48) }),
      line(4, 'trade_agreement', 'نوشهر', 'proposed', { mine: true, expires_at: iso(72) }),
      line(5, 'alliance', 'رامسر', 'terminated', { ended_at: iso(-24 * 20), ended_party: N('v-r5', 'رامسر') }),
      line(6, 'passage', 'گلستان', 'declined'),
      ...st.treaties.map((k, i) => line(10 + i, k, 'گلستان', 'proposed', { mine: true, expires_at: iso(72) })),
    ],
    kinds: [
      { kind: N('alliance', 'alliance'), alliance: true, non_aggression: true, passage: true, tariff_discount_bps: 0 },
      { kind: N('non_aggression', 'non_aggression'), alliance: false, non_aggression: true, passage: false, tariff_discount_bps: 0 },
      { kind: N('trade_agreement', 'trade_agreement'), alliance: false, non_aggression: false, passage: false, tariff_discount_bps: 2500 },
      { kind: N('passage', 'passage'), alliance: false, non_aggression: false, passage: true, tariff_discount_bps: 0 },
    ],
    targets: [N('v-b2', 'بابل'), N('v-x1', 'گلستان'), N('v-r5', 'رامسر')],
    parties: [{ party: N('v-b2', 'بابل'), kind: 'settlement' }, { party: N('v-x1', 'گلستان'), kind: 'settlement' }, { party: N('v-r5', 'رامسر'), kind: 'settlement' }, { party: N('u-iran', 'کشور سرزمین سبز'), kind: 'country' }],
    cooling_days: 7,
  }
}

function tender(notice = ''): TenderView {
  const m = polityMode(), perm = m !== 'noperm'
  const bids = (st.bid ? [{ id: 'bd0', company: N('c-mine', 'ساختمان‌سازی البرز'), price: 8200, days: 12, record: 4, bond: 820, status: st.awarded ? 'won' : 'standing', mine: true }] : [])
  const other = [{ id: 'bd1', company: N('c-x', 'عمران سرخه'), price: 9100, days: 10, record: 7, bond: 910, status: st.awarded ? 'lost' : 'standing', mine: false }, { id: 'bd2', company: N('c-y', 'بنایان شمال'), price: 8700, days: 14, record: 2, bond: 870, status: st.awarded ? 'lost' : 'standing', mine: false }]
  return {
    village: 'آمل', open: m !== 'off', may_tender: perm, may_accept: perm, fee: 400, bond_bps: 1000, retention_bps: 1000, notice,
    tenders: [
      { id: 't1', building: N('tavern', 'میخانه'), settlement: N('v-k3x9', 'آمل'), payer: N('v-k3x9', 'آمل'), payer_kind: 'settlement', status: st.awarded ? 'awarded' : 'open', rule: 'lowest_price', budget_cap: 10000, bond_bps: 1000, retention_bps: 1000, defects_days: 14, due_days: 14, closes_at: iso(st.awarded ? -2 : 20), company: st.awarded ? N('c-x', 'عمران سرخه') : null, price: st.awarded ? 8700 : 0, due_at: st.awarded ? iso(24 * 10) : null, stages_paid: st.awarded ? 1 : 0, retention_held: st.awarded ? 870 : 0, work_done: st.awarded ? 35 : 0, work_required: 100, bids: [...other, ...bids], stages: st.awarded ? [{ stage: 1, paid: 2610, held: 290, at: iso(-1) }, { stage: 2, paid: 0, held: 0, at: null }, { stage: 3, paid: 0, held: 0, at: null }] : [], may_bid: false, may_cancel: !st.awarded, may_award: true },
      { id: 't2', building: N('well', 'چاه همگانی'), settlement: N('v-k3x9', 'آمل'), payer: N('v-k3x9', 'آمل'), payer_kind: 'settlement', status: 'failed', rule: 'scored', budget_cap: 4000, bond_bps: 1000, retention_bps: 1000, defects_days: 14, due_days: 10, closes_at: iso(-300), company: N('c-z', 'کارگاه بی‌نام'), price: 3500, due_at: iso(-200), stages_paid: 1, retention_held: 0, work_done: 40, work_required: 100, bids: null, stages: null, may_bid: false, may_cancel: false, may_award: false },
    ],
    board: [{ id: 't9', building: N('market', 'بازارچه'), settlement: N('v-q7m2', 'سرخه'), payer: N('v-q7m2', 'سرخه'), payer_kind: 'settlement', status: 'open', rule: 'scored', budget_cap: 12000, bond_bps: 1000, retention_bps: 1000, defects_days: 14, due_days: 16, closes_at: iso(30), company: null, price: 0, due_at: null, stages_paid: 0, retention_held: 0, work_done: 0, work_required: 100, bids: bids.length ? bids : null, stages: null, may_bid: true, may_cancel: false, may_award: false }],
    sites: [{ id: 'bi-school-1', building: N('school', 'مدرسه'), work_required: 100, work_done: 10 }, { id: 'bi-clinic-1', building: N('health_post', 'خانهٔ بهداشت'), work_required: 100, work_done: 0 }],
    companies: [{ company: N('c-mine', 'ساختمان‌سازی البرز'), record: 4, debarred_until: null }, { company: N('c-bad', 'سازه‌های شتاب'), record: 1, debarred_until: iso(24 * 20) }],
  }
}

function debt(notice = '', unionId = ''): DebtView {
  const m = polityMode(), perm = m !== 'noperm'
  const loan = (id: string, status: string, mine: string, o: Record<string, unknown> = {}) => ({ id, lender: N('v-q7m2', mine === 'lender' ? 'آمل' : 'سرخه'), borrower: N('v-k3x9', mine === 'lender' ? 'سرخه' : 'آمل'), lender_kind: 'settlement', borrower_kind: 'settlement', status, principal: 20000, rate_bps: 600, periods: 10, paid: 4000, arrears: 0, instalment: 2000, owed: 16000, fees_due: 0, next_due_at: iso(30), expires_at: null, mine, may_accept: false, may_withdraw: false, may_restructure: false, may_write_off: false, ...o })
  return {
    village: 'آمل', open: m !== 'off', party: unionId ? N(unionId, 'اتحاد البرز') : N('v-k3x9', 'آمل'), party_kind: unionId ? 'union' : 'settlement', may_lend: perm, may_borrow: perm, may_restructure: perm, notice,
    loans: [
      loan('l1', st.loanAccepted ? 'active' : 'offered', 'borrower', { principal: 30000, paid: 0, owed: 30000, instalment: 3300, expires_at: iso(48), may_accept: perm && !st.loanAccepted, next_due_at: null }),
      loan('l2', 'active', 'borrower', { arrears: 2000, fees_due: 100, may_restructure: perm }),
      loan('l3', st.writtenOff ? 'written_off' : 'defaulted', 'lender', { principal: 12000, paid: 2400, owed: 9600, instalment: 1200, may_write_off: perm && !st.writtenOff }),
      loan('l4', st.loan ? 'offered' : 'repaid', 'lender', { principal: 5000, paid: 5000, owed: 0, instalment: 500, periods: 10, may_withdraw: st.loan }),
    ],
    targets: [N('v-q7m2', 'سرخه'), N('v-b2', 'بابل'), N('v-n4', 'نوشهر')],
    record: { party: N('v-k3x9', 'آمل'), taken: 3, repaid: 1, late: 1, defaulted: 0 }, others: [{ party: N('v-q7m2', 'سرخه'), taken: 5, repaid: 4, late: 0, defaulted: 1 }],
    lendable: 45000, income: 6000, service: 5300, max_instalments: 24, max_rate_bps: 1500,
  }
}

export function mockPolityCommand(command: string, a: Record<string, unknown>): unknown | null {
  const act = String(a.action ?? '')
  const uid = String(a.union ?? '')
  const ok = (screen: 'settlement_union' | 'settlement_treaty' | 'settlement_tender' | 'settlement_debt', view: unknown) => mockOk(screen as never, view as never, [back('settlement.overview'), refreshA(command)])
  if (command === 'settlement.union') {
    if (act === 'propose') { if (String(a.name ?? '').trim().length < 2) return refuse('union_bad_name'); st.founded = true; return ok('settlement_union', union('union_proposed')) }
    if (act === 'ratify') { st.ratified = true; return ok('settlement_union', union('union_ratified')) }
    if (act === 'refuse') return ok('settlement_union', union('union_refused'))
    if (act === 'withdraw') return ok('settlement_union', union('union_withdrawn'))
    if (act === 'vote') { st.voted = true; return ok('settlement_union', union('union_voted', String(a.id) === 'b1' ? 'u-alborz' : '')) }
    if (act === 'motion') return ok('settlement_union', union('union_motion_opened', 'u-alborz'))
    if (act === 'motion_vote') { st.motionVoted = true; return ok('settlement_union', union('union_voted', 'u-alborz')) }
    if (act === 'leave') { st.left = true; return ok('settlement_union', union('union_notice_given', 'u-alborz')) }
    if (act === 'stay') { st.left = false; return ok('settlement_union', union('union_notice_withdrawn', 'u-alborz')) }
    if (act === 'office') { st.officeSaved = true; return ok('settlement_union', union('union_office_saved', 'u-alborz')) }
    if (act === 'office_close') return ok('settlement_union', union('union_office_closed', 'u-alborz'))
    if (act === 'appoint') { if (!String(a.player ?? '').trim()) return refuse('union_no_player'); st.appointed = true; return ok('settlement_union', union('union_appointed', 'u-alborz')) }
    if (act === 'dismiss') return ok('settlement_union', union('union_dismissed', 'u-alborz'))
    if (act === 'recall') return ok('settlement_union', union('union_recall_started', 'u-alborz'))
    if (act === 'rules') return ok('settlement_union', union('union_rules_saved', 'u-alborz'))
    return ok('settlement_union', union('', String(a.id ?? '')))
  }
  if (command === 'settlement.treaty') {
    if (act === 'propose') { if (String(a.kind) === 'alliance' && String(a.code) === 'v-r5') return refuse('treaty_cooling', 'settlement.treaty'); st.treaties.push(String(a.kind)); return ok('settlement_treaty', treaty('treaty_proposed', uid)) }
    if (act === 'accept') { st.accepted = true; return ok('settlement_treaty', treaty('treaty_accepted', uid)) }
    if (act === 'decline') return ok('settlement_treaty', treaty('treaty_declined', uid))
    if (act === 'withdraw') return ok('settlement_treaty', treaty('treaty_withdrawn', uid))
    if (act === 'end') { st.ended = true; return ok('settlement_treaty', treaty('treaty_ended', uid)) }
    return ok('settlement_treaty', treaty('', uid))
  }
  if (command === 'settlement.tender') {
    if (act === 'post') { st.tenderPosted = true; return ok('settlement_tender', tender('tender_posted')) }
    if (act === 'bid') { if (String(a.company) === 'c-conflict') return refuse('tender_conflict', 'settlement.tender'); st.bid = true; return ok('settlement_tender', tender('tender_bid')) }
    if (act === 'withdraw') { st.bid = false; return ok('settlement_tender', tender('tender_bid_withdrawn')) }
    if (act === 'cancel') return ok('settlement_tender', tender('tender_cancelled'))
    if (act === 'award') { st.awarded = true; return ok('settlement_tender', tender('tender_awarded')) }
    if (act === 'settle') return ok('settlement_tender', tender('tender_stage_paid'))
    return ok('settlement_tender', tender())
  }
  if (command === 'settlement.debt') {
    if (act === 'offer') { st.loan = true; return ok('settlement_debt', debt('debt_offered', uid)) }
    if (act === 'accept') { st.loanAccepted = true; return ok('settlement_debt', debt('debt_accepted', uid)) }
    if (act === 'decline') return ok('settlement_debt', debt('debt_declined', uid))
    if (act === 'withdraw') { st.loan = false; return ok('settlement_debt', debt('debt_withdrawn', uid)) }
    if (act === 'restructure') { st.restructured = true; return ok('settlement_debt', debt('debt_restructured', uid)) }
    if (act === 'writeoff') { st.writtenOff = true; return ok('settlement_debt', debt('debt_written_off', uid)) }
    return ok('settlement_debt', debt('', uid))
  }
  return null
}
