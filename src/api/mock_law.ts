// The law of the mock (ADR 0078, B14), ?mock=1&open=settlement.law&law=on|judge|citizen|noperm|empty|off|gang.
// One command, settlement.law, like the server's. The modes: `on` (a sheriff: patrol, cases, informants, the hidden board known), `judge` (signs warrants,
// gives verdicts, sets the offences), `citizen` (no powers, the board unknown: only a quiet «ask around»), `noperm` and `empty` (nothing built yet), `off`
// (not started), `gang` (as `on`, with a gang the viewer leads). Writes change the state a little so a flow can be followed; a few refuse in plain words.
import { back, mockOk, refreshA } from './mock_neutral'
import type { LawCaseDetail, LawCaseLine, LawMays, LawOffenceLine, LawPostLine, LawSentenceLine, LawView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('law') ?? 'on' } catch { return 'on' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const st = {
  model: 'adversarial', listed: new Set<string>(['fraud', 'smuggling', 'bribery']), unlisted: new Set<string>(),
  patrolled: 0, recruited: false, retired: false, rotated: false, tipped: false,
  arrested: false, charged: false, dropped: false, defended: false, excluded: false, warrantAsked: false, warrantSigned: false, verdict: false, appealed: false, appealDecided: false, investigated: 0,
  bailed: false, pardoned: false,
  bribeAnswered: '', bribeSent: false, audited: false,
  asked: false, known: false, listedMine: false, delisted: false, bought: false, confirmed: false, broker: false, scammed: false, refunded: false,
  front: false, laundered: false,
  declared: false, crossed: false, gang: 'none' as 'none' | 'marked' | 'declared',
}
const refuse = (kind: string) => ({ ...mockOk('village_refusal', { kind, back: { command: 'settlement.law', args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, []), ok: false, error: { code: `village_${kind}`, args: {} } })

const OFFENCES: [string, string, string, string[], number, number, number, boolean][] = [
  ['theft', 'دزدی', 'petty', ['caution', 'fine', 'restitution', 'ban', 'jail'], 3000, 24, 14, false],
  ['fraud', 'کلاهبرداری', 'serious', ['fine', 'restitution', 'ban', 'jail', 'forfeiture'], 8000, 72, 60, true],
  ['assault', 'ضرب و جرح', 'serious', ['caution', 'fine', 'ban', 'jail'], 5000, 72, 30, false],
  ['smuggling', 'قاچاق', 'serious', ['fine', 'ban', 'jail', 'forfeiture'], 10000, 96, 60, true],
  ['forgery', 'جعل سند', 'serious', ['fine', 'ban', 'jail', 'forfeiture'], 8000, 72, 60, true],
  ['bribery', 'رشوه', 'serious', ['fine', 'ban', 'jail', 'forfeiture'], 12000, 96, 90, true],
  ['laundering', 'پول‌شویی', 'grave', ['fine', 'ban', 'jail', 'forfeiture'], 20000, 168, 180, true],
  ['racketeering', 'اخاذی سازمان‌یافته', 'grave', ['fine', 'ban', 'jail', 'forfeiture'], 25000, 240, 365, true],
  ['contempt', 'بی‌احترامی به دادگاه', 'petty', ['caution', 'fine'], 1000, 0, 0, true],
]
const GOODS = [{ item: N('bread', 'Bread'), qty: 6 }, { item: N('coffee', 'Coffee'), qty: 3 }]
const PEOPLE = Array.from({ length: 24 }, (_, i) => N(`P${i}XYZ`, ['سیما', 'نیما', 'کاوه', 'رضا', 'هادی', 'مهسا', 'آریا', 'نازنین'][i % 8] + (i >= 8 ? ` ${['اول', 'دوم'][i >= 16 ? 1 : 0]}` : '')))

function offences(): LawOffenceLine[] {
  return OFFENCES.map(([code, name, cls, sentences, mf, mj, mb, avail]) => ({
    code, name, class: cls, sentences, max_fine: mf, max_jail_hours: mj, max_ban_days: mb, available: avail,
    listed: (st.listed.has(code) && !st.unlisted.has(code)) || (code === 'laundering' && false),
    effective_at: code === 'smuggling' ? iso(48) : st.listed.has(code) ? iso(-24 * 6) : null,
  }))
}

const cases = (): LawCaseLine[] => [
  { id: 'c1', no: 14, offence: N('fraud', 'کلاهبرداری'), accused: N('p-kaveh', 'کاوه'), state: st.dropped ? 'dropped' : st.charged ? 'charged' : 'open', source: 'patrol', strength: st.investigated ? 74 : 52, custody: st.arrested, custody_until: st.arrested ? iso(20) : null, at: iso(-30) },
  { id: 'c2', no: 13, offence: N('bribery', 'رشوه'), accused: N('p-nima', 'نیما'), state: st.verdict ? 'decided' : 'hearing', source: 'audit', strength: 88, custody: false, custody_until: null, at: iso(-70) },
  { id: 'c3', no: 11, offence: N('smuggling', 'قاچاق'), accused: N('p-sima', 'سیما'), state: st.appealDecided ? 'final' : 'appealed', source: 'customs', strength: 95, custody: false, custody_until: null, at: iso(-190) },
]

function mays(m: string): LawMays {
  const none: LawMays = { set: false, patrol: false, investigate: false, arrest: false, warrant_ask: false, warrant_sign: false, charge: false, drop: false, defence: false, judge: false, appeal_hear: false, pardon: false, informants: false, audit_integrity: false, audit_books: false }
  if (m === 'judge') return { ...none, set: true, warrant_sign: true, judge: true, appeal_hear: true, pardon: true, audit_integrity: true, audit_books: true }
  if (m === 'citizen' || m === 'noperm' || m === 'empty') return none
  return { ...none, patrol: true, investigate: true, arrest: true, warrant_ask: true, charge: true, drop: true, defence: true, informants: true }
}

function detail(id: string, m: string): LawCaseDetail {
  const line = cases().find((c) => c.id === id) ?? cases()[0]
  const mm = mays(m)
  const base: LawCaseDetail = {
    line, model: st.model, evidence: null, warrants: null, verdicts: null, sentences: null, appeals: null, total: 0, quality: 100,
    may_investigate: false, may_ask_warrant: false, may_sign: false, may_arrest: false, may_charge: false, may_drop: false, may_defend: false, may_verdict: false, may_appeal: false, may_decide: false, may_appeal_as: '',
  }
  if (id === 'c2') {
    return { ...base, total: 88, quality: 100, line,
      evidence: [{ id: 'e1', kind: 'ledger_trace', strength: 52, proper: true, excluded: false }, { id: 'e2', kind: 'witness', strength: 36, proper: true, excluded: false }],
      verdicts: st.verdict ? [{ instance: 1, guilty: true, npc: false, defence: false, total: 88, effective: 88, quality: 100, at: iso(-1) }] : null,
      sentences: st.verdict ? [{ id: 's1', kind: 'fine', status: 'active', ban: '', fine: 4000, fine_paid: 0, jail_hours: 0, ban_days: 0, cell: 0, ends_at: null, bail: 0, may_bail: false, may_pardon: mm.pardon }] : null,
      may_verdict: mm.judge && !st.verdict, may_appeal: st.verdict && !st.appealed, may_appeal_as: 'accused', appeals: st.appealed ? ['accused'] : null }
  }
  if (id === 'c3') {
    return { ...base, total: 95, quality: 82, line,
      evidence: [{ id: 'e5', kind: 'inspection', strength: 60, proper: true, excluded: false }, { id: 'e6', kind: 'seized_item', strength: 45, proper: true, excluded: false }, { id: 'e7', kind: 'informant_report', strength: 20, proper: false, excluded: true }],
      verdicts: [{ instance: 1, guilty: true, npc: true, defence: true, total: 95, effective: 62, quality: 82, at: iso(-120) }, ...(st.appealDecided ? [{ instance: 2, guilty: true, npc: false, defence: true, total: 95, effective: 78, quality: 100, at: iso(-2) }] : [])],
      sentences: [
        { id: 's2', kind: 'jail', status: 'active', ban: '', fine: 0, fine_paid: 0, jail_hours: 48, ban_days: 0, cell: 2, ends_at: iso(30), bail: 2400, may_bail: false, may_pardon: mm.pardon },
        { id: 's3', kind: 'ban', status: 'active', ban: 'market', fine: 0, fine_paid: 0, jail_hours: 0, ban_days: 21, cell: 0, ends_at: iso(24 * 21), bail: 0, may_bail: false, may_pardon: mm.pardon },
        { id: 's4', kind: 'forfeiture', status: 'paid', ban: '', fine: 3000, fine_paid: 3000, jail_hours: 0, ban_days: 0, cell: 0, ends_at: null, bail: 0, may_bail: false, may_pardon: false },
      ],
      appeals: ['accused', 'prosecution'], may_decide: mm.appeal_hear && !st.appealDecided }
  }
  return { ...base, total: st.investigated ? 74 : 52, quality: st.excluded ? 100 : 80, line,
    evidence: [
      { id: 'e3', kind: 'witness', strength: 38, proper: true, excluded: false },
      { id: 'e4', kind: 'record', strength: 36 + (st.investigated ? 22 : 0), proper: true, excluded: false },
      { id: 'e8', kind: 'seized_item', strength: 30, proper: false, excluded: st.excluded },
      ...(st.tipped ? [{ id: 'e9', kind: 'informant_report', strength: 18, proper: true, excluded: false }] : []),
    ],
    warrants: st.warrantAsked || st.warrantSigned ? ['w1'] : null,
    may_investigate: mm.investigate && !st.charged, may_ask_warrant: mm.warrant_ask && !st.warrantAsked && !st.charged, may_sign: mm.warrant_sign && st.warrantAsked && !st.warrantSigned,
    may_arrest: mm.arrest && !st.arrested, may_charge: mm.charge && !st.charged, may_drop: mm.drop && !st.dropped, may_defend: mm.defence && st.charged && !st.defended,
  }
}

function posts(m: string): LawPostLine[] {
  if (m === 'empty' || m === 'noperm') return [{ service: 'constabulary', building: N('', ''), stands: false, open: false, cells: 0, held: 0 }, { service: 'court', building: N('', ''), stands: false, open: false, cells: 0, held: 0 }, { service: 'custody', building: N('', ''), stands: false, open: false, cells: 0, held: 0 }, { service: 'customs', building: N('', ''), stands: false, open: false, cells: 0, held: 0 }]
  return [
    { service: 'constabulary', building: N('police_post', 'پاسگاه'), stands: true, open: true, cells: 0, held: 0 },
    { service: 'court', building: N('courthouse', 'دادگاه'), stands: true, open: true, cells: 0, held: 0 },
    { service: 'custody', building: N('jail', 'بازداشتگاه'), stands: true, open: m !== 'citizen', cells: 4, held: 1 + (st.arrested ? 1 : 0) },
    { service: 'customs', building: N('customs_house', 'گمرک'), stands: m !== 'citizen', open: m !== 'citizen', cells: 0, held: 0 },
  ]
}

function law(notice = ''): LawView {
  const m = mode(), off = m === 'off', plain = m === 'citizen' || m === 'noperm' || m === 'empty'
  const mm = mays(m)
  const open = { police: !off, courts: !off, black: !off && m !== 'noperm' && m !== 'empty', customs: !off, launder: !off }
  const known = (m === 'on' || m === 'judge' || m === 'gang') ? true : st.known
  const dirty = known ? 9000 : st.bribeAnswered === 'accepted' ? 4000 : 0
  const mineSentence: LawSentenceLine[] = m === 'citizen' ? [
    { id: 's9', kind: 'jail', status: st.bailed ? 'bailed' : 'active', ban: '', fine: 0, fine_paid: 0, jail_hours: 36, ban_days: 0, cell: 3, ends_at: iso(20), bail: 1500, may_bail: !st.bailed, may_pardon: false },
    { id: 's10', kind: 'fine', status: 'active', ban: '', fine: 800, fine_paid: 300, jail_hours: 0, ban_days: 0, cell: 0, ends_at: null, bail: 0, may_bail: false, may_pardon: false },
  ] : []
  const v: LawView = {
    village: 'آمل', open, mature: true, model: st.model, mays: mm,
    posts: posts(m), points: 10, spent: 3 + st.patrolled * 2, patrol: 1 + st.patrolled,
    offences: m === 'empty' ? OFFENCES.slice(0, 2).map(([code, name, cls, sentences, mf, mj, mb]) => ({ code, name, class: cls, sentences, max_fine: mf, max_jail_hours: mj, max_ban_days: mb, available: false, listed: false, effective_at: null })) : offences(),
    cases: plain ? (m === 'citizen' ? cases().slice(2) : null) : cases(), case: null,
    mine: mineSentence.length ? mineSentence : null,
    informants: plain ? null : st.retired ? [] : [
      { id: 'i1', reliability: 72, state: 'active', mine: true, rotate_due: false, since: iso(-24 * 6), source: N('p-reza', 'رضا') },
      { id: 'i2', reliability: 38, state: st.rotated ? 'active' : 'active', mine: st.rotated, rotate_due: !st.rotated, since: iso(-24 * 13), source: st.rotated ? N('p-hadi', 'هادی') : N('', '') },
      ...(st.recruited ? [{ id: 'i3', reliability: 55, state: 'recruited', mine: true, rotate_due: false, since: iso(0), source: N('p-new', 'تازه‌وارد') }] : []),
    ],
    bribes: plain ? null : [
      ...(st.bribeAnswered ? [] : [{ id: 'b1', rung: 'warrant', status: 'offered', effect_bps: 1500, amount: 2500, dirty: false, mine: false, may_answer: true, term_end: iso(24 * 5) }]),
      ...(st.bribeAnswered ? [{ id: 'b1', rung: 'warrant', status: st.bribeAnswered, effect_bps: 1500, amount: 2500, dirty: false, mine: false, may_answer: false, term_end: iso(24 * 5) }] : []),
      { id: 'b2', rung: 'verdict', status: 'found', effect_bps: 1000, amount: 1800, dirty: true, mine: true, may_answer: false, term_end: null },
      ...(st.bribeSent ? [{ id: 'b3', rung: 'detection', status: 'offered', effect_bps: 800, amount: 900, dirty: false, mine: true, may_answer: false, term_end: iso(24 * 3) }] : []),
    ],
    captured: m === 'judge',
    board: {
      brokers: known ? [{ player: N('p-broker', 'ماهان'), reputation: 8, cap: 20000 }, { player: N('p-b2', 'آرمان'), reputation: 3, cap: 5000 }] : null,
      known, standing: known ? 14 : 0, broker: known && (m === 'judge' || st.broker), rep: 6, broker_cap: 20000, dirty,
      listings: known ? (st.bought ? [] : [
        { id: 'l1', item: N('fake_documents', 'Fake documents'), qty: 5, price: 1200, fence: true, mine: false, min_standing: 5 },
        { id: 'l2', item: N('coffee', 'Coffee'), qty: 8, price: 90, fence: false, mine: false, min_standing: 0 },
        ...(st.delisted ? [] : [{ id: 'l3', item: N('bread', 'Bread'), qty: 4, price: 40, fence: false, mine: true, min_standing: 0 }]),
      ]) : null,
      escrows: known ? [
        { id: 'x1', status: st.confirmed ? 'released' : st.refunded ? 'refunded' : st.scammed ? 'scammed' : 'held', amount: 360, fee: 20, qty: 4, item: N('coffee', 'Coffee'), buyer: true, broker: false, mine: true, due_at: iso(24) },
        { id: 'x2', status: 'held', amount: 4800, fee: 240, qty: 4, item: N('fake_documents', 'Fake documents'), buyer: false, broker: m === 'judge' || st.broker, mine: false, due_at: iso(-3) },
      ] : null,
    },
    fronts: known ? [{ company: N('c-mine', 'نانوایی البرز'), batches: [{ id: 'bt1', state: 'layered', amount: 3000, stage_due: iso(18) }, { id: 'bt2', state: 'integrated', amount: 2000, stage_due: null }, ...(st.laundered ? [{ id: 'bt3', state: 'placed', amount: 1500, stage_due: iso(8) }] : [])] }, ...(st.front ? [{ company: N('c-two', 'کارگاه سرخه'), batches: null }] : [])] : null,
    loads: plain && m !== 'citizen' ? null : [
      { id: 'ld1', status: 'crossed', to: N('v-b2', 'بابل'), declared: { bread: 2, coffee: 1 }, carried: { bread: 2, coffee: 1 }, inspected: true, duty: 60, penalty: 0, may_cross: false },
      { id: 'ld2', status: 'seized', to: N('v-x1', 'گلستان'), declared: { bread: 2 }, carried: { bread: 2, fake_documents: 3 }, inspected: true, duty: 40, penalty: 900, may_cross: false },
      ...(st.declared && !st.crossed ? [{ id: 'ld3', status: 'declared', to: N('v-r5', 'رامسر'), declared: { bread: 2 }, carried: { bread: 2 }, inspected: false, duty: 0, penalty: 0, may_cross: true }] : []),
      ...(st.declared && st.crossed ? [{ id: 'ld3', status: 'crossed', to: N('v-r5', 'رامسر'), declared: { bread: 2 }, carried: { bread: 2 }, inspected: false, duty: 40, penalty: 0, may_cross: false }] : []),
    ],
    notice,
    goods: [...GOODS, { item: N('fake_documents', 'Fake documents'), qty: 0 }], destinations: [N('v-b2', 'بابل'), N('v-x1', 'گلستان'), N('v-r5', 'رامسر')], companies: [N('c-mine', 'نانوایی البرز'), N('c-two', 'کارگاه سرخه')],
    people: m === 'noperm' ? null : PEOPLE,
    holders: plain ? null : [{ player: N('p-sima', 'سیما'), office: 'sheriff', rungs: ['detection', 'warrant'] }, { player: N('p-nima', 'نیما'), office: 'judge', rungs: ['verdict', 'warrant'] }, { player: N('p-kaveh', 'کاوه'), office: 'clerk', rungs: [] }],
    gang: m === 'gang' ? { faction: N('f-1', 'برادران شمال'), hidden: st.gang !== 'declared', leader: true, heat: st.gang === 'none' ? 0 : 38 } : null,
  }
  return v
}

export function mockLawCommand(command: string, a: Record<string, unknown>): unknown | null {
  if (command !== 'settlement.law') return null
  const m = mode()
  const act = String(a.action ?? '')
  const id = String(a.id ?? '')
  const ok = (n = '') => {
    const v = law(n)
    if (id && (act === '' || act === 'open' || ['investigate', 'warrant_ask', 'warrant_sign', 'warrant_refuse', 'arrest', 'charge', 'drop', 'defend', 'exclude', 'verdict', 'appeal', 'appeal_decide'].includes(act))) v.case = detail(id.startsWith('c') ? id : 'c1', m)
    return mockOk('settlement_law', v, [back('settlement.overview'), refreshA(command)])
  }
  if (act === '' || act === 'open') return ok()
  switch (act) {
    case 'model': st.model = String(a.kind); return ok('law_model')
    case 'offence': if (String(a.code) === 'theft') return refuse('law_research'); st.listed.add(String(a.code)); st.unlisted.delete(String(a.code)); return ok('law_offence')
    case 'offence_unset': st.unlisted.add(String(a.code)); return ok('law_offence_gone')
    case 'patrol': st.patrolled++; return ok(st.patrolled % 2 ? 'law_patrol_saw' : 'law_patrol_quiet')
    case 'complain': if (String(a.player).toUpperCase() === 'XXXX') return refuse('law_no_player'); return ok('law_complaint')
    case 'investigate': st.investigated++; return ok(st.investigated > 1 ? 'law_nothing_new' : 'law_investigated')
    case 'warrant_ask': if (st.investigated === 0) return refuse('law_weak_evidence'); st.warrantAsked = true; return ok('law_warrant_asked')
    case 'warrant_sign': st.warrantSigned = true; return ok('law_warrant_signed')
    case 'warrant_refuse': st.warrantAsked = false; return ok('law_warrant_refused')
    case 'arrest': st.arrested = true; return ok('law_arrested')
    case 'charge': if (st.investigated === 0) return refuse('law_weak_evidence'); st.charged = true; return ok('law_charged')
    case 'drop': st.dropped = true; return ok('law_dropped')
    case 'defend': st.defended = true; return ok('law_defended')
    case 'exclude': st.excluded = true; return ok('law_excluded')
    case 'verdict': if (/fine:(\d+)/.test(String(a.items)) && Number(/fine:(\d+)/.exec(String(a.items))?.[1]) > 5000) return refuse('law_judge_limit'); st.verdict = true; return ok('law_verdict')
    case 'appeal': st.appealed = true; return ok('law_appealed')
    case 'appeal_decide': st.appealDecided = true; return ok('law_appeal_decided')
    case 'pardon': st.pardoned = true; return ok('law_pardoned')
    case 'bail': if (id === 's-x') return refuse('law_no_money'); st.bailed = true; return ok('law_bailed')
    case 'recruit': if (String(a.player).toUpperCase() === 'XXXX') return refuse('law_no_player'); st.recruited = true; return ok('law_recruited')
    case 'tip': st.tipped = true; return ok('law_tip')
    case 'take': st.rotated = true; return ok('law_rotated')
    case 'retire': st.retired = true; return ok('law_retired')
    case 'bribe': st.bribeSent = true; return ok('law_bribe_offered')
    case 'bribe_accept': st.bribeAnswered = 'accepted'; return ok('law_bribe_taken')
    case 'bribe_refuse': st.bribeAnswered = 'refused'; return ok('law_bribe_refused')
    case 'audit': st.audited = true; return ok('law_audit_clean')
    case 'audit_books': return ok('law_audit_anomaly')
    case 'ask': if (!st.asked) { st.asked = true; return refuse('law_nobody_talks') } st.known = true; return ok('law_contact')
    case 'introduce': return ok('law_complaint')
    case 'broker': st.broker = true; return ok('law_broker')
    case 'list': return ok('law_listed')
    case 'delist': st.delisted = true; return ok('law_delisted')
    case 'buy': if (id === 'l1' && Number(a.qty) > 3) return refuse('law_no_standing'); st.bought = true; return ok(id === 'l1' ? 'law_bought' : 'law_escrowed')
    case 'confirm': st.confirmed = true; return ok('law_confirmed')
    case 'refund': st.refunded = true; return ok('law_refunded')
    case 'scam': st.scammed = true; return ok('law_scam_traced')
    case 'front': st.front = true; return ok('law_front')
    case 'launder': if (Number(a.amount) > 9000) return refuse('law_no_money'); st.laundered = true; return ok('law_laundered')
    case 'declare': st.declared = true; return ok('law_declared')
    case 'cross': st.crossed = true; return ok('law_crossed')
    case 'gang_mark': st.gang = 'marked'; return ok('law_gang_marked')
    case 'gang_declare': st.gang = 'declared'; return ok('law_gang_declared')
    default: return ok()
  }
}
