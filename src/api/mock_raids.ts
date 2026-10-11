// Raids and the town's insurance of the mock (ADR 0074), ?mock=1&raid=off|on|warned|unwarned|settled|noperm and &ins=closed|open.
import { back, mockOk, refreshA } from './mock_neutral'
import type { RaidLine, RaidView, SettlementInsuranceView } from './views.gen'

const q = (k: string, d: string) => { try { return new URLSearchParams(location.search).get(k) ?? d } catch { return d } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const st = { filed: [] as RaidLine[], joined: false, tribute: 0, insOpen: q('ins', 'open') === 'open', scale: 10000, bought: [] as { no: number; product: string; covers: string; building: string | null }[], seq: 1 }

function view(notice = ''): RaidView {
  const m = q('raid', 'on')
  const mine: RaidLine[] = []
  if (m !== 'off') {
    mine.push({ id: 'r-in', side: 'defender', other: N('v-q7m2', 'سرخه'), status: 'filed', start_at: iso(9), end_at: iso(9.5), fee: 800, raiders: 6, joined: 2, standing: st.joined ? 3 : 2, me: st.joined, tribute: st.tribute, warned: m !== 'unwarned', warned_by: 'watchtower', lead_secs: 9 * 3600, outcome: null, can_join: false, can_stand: !st.joined, can_offer: false, can_accept: false })
    mine.push({ id: 'r-out', side: 'attacker', other: N('v-x1', 'گلستان'), status: m === 'settled' ? 'settled' : 'resolved', start_at: iso(-30), end_at: iso(-29.5), fee: 900, raiders: 4, joined: 3, standing: 5, me: true, tribute: 0, warned: false, warned_by: '', lead_secs: 0,
      outcome: { taken: true, cash: 2400, goods: [{ item: N('timber', 'چوب'), qty: 12 }], buildings: 2, damage: 1800, falls: 1, fell_me: m === 'fell', attacker_units: 9, defender_units: 6 }, can_join: false, can_stand: false, can_offer: false, can_accept: false })
    mine.push({ id: 'r-new', side: 'attacker', other: N('v-k8', 'نمین'), status: 'filed', start_at: iso(7), end_at: iso(7.5), fee: 800, raiders: 0, joined: 1, standing: 0, me: false, tribute: st.tribute, warned: false, warned_by: '', lead_secs: 7 * 3600, outcome: null, can_join: !st.joined, can_stand: false, can_offer: false, can_accept: st.tribute > 0 })
    mine.push(...st.filed)
  }
  return {
    village: 'آمل', on: m !== 'off', starts_at: m === 'off' ? iso(4 * 24) : null, may: m !== 'noperm', may_offer: true, fee: 800, npc_raider_wage: 150, max_npc_raiders: 6, tribute_min: 500, min_lead_hours: 6, max_lead_hours: 48, window_minutes: 30, transports: ['foot', 'cart', 'horse', 'rail'],
    mine, targets: [{ settlement: N('v-q7m2', 'سرخه'), distance_km: 48, residents: 7 }, { settlement: N('v-k8', 'نمین'), distance_km: 96, residents: 3 }, { settlement: N('v-x1', 'گلستان'), distance_km: 140, residents: 12 }],
    watch: [{ building: N('b-w1', 'lookout_post'), kind: 'lookout_post', held: true, idle: '', sight_m: 600 }, { building: N('b-w2', 'watchtower'), kind: 'watchtower', held: false, idle: 'no_wage', sight_m: 1500 }], notice,
  }
}
const ins = (notice = ''): SettlementInsuranceView => ({
  village: 'آمل', open: st.insOpen, fund: 48200, scale_bps: st.scale, may_run: q('raid', 'on') !== 'noperm',
  products: [
    { product: N('kit', 'بیمهٔ از پا افتادن'), covers: 'death_loss', premium: 250, prem_bps: 200, cover_bps: 8000, deductible_bps: 2000, max_claim: 4000, waiting_seconds: 86400, held: st.bought.some((b) => b.covers === 'death_loss'), targets: null },
    { product: N('raid_cover', 'بیمهٔ آسیب یورش'), covers: 'raid_damage', premium: 600, prem_bps: 300, cover_bps: 7000, deductible_bps: 3000, max_claim: 9000, waiting_seconds: 172800, held: false, targets: [N('b-lot-1', 'کلبهٔ شخصی'), N('b-3', 'انبار غله')] },
  ],
  policies: st.bought.map((b) => ({ no: b.no, product: N(b.product, b.product === 'kit' ? 'بیمهٔ از پا افتادن' : 'بیمهٔ آسیب یورش'), covers: b.covers, building: b.building ? N(b.building, b.building === 'b-lot-1' ? 'کلبهٔ شخصی' : 'انبار غله') : null, status: 'active', paid: b.covers === 'death_loss' ? 250 : 600 })), notice,
})
const refuse = (kind: string, extra: Record<string, number> = {}) => ({ ...mockOk('village_refusal', { kind, back: { command: 'settlement.raid', args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, []), ok: false, error: { code: `village_${kind}`, args: extra } })

export function mockRaidCommand(command: string, a: Record<string, unknown>): unknown | null {
  const act = String(a.action ?? '')
  if (command === 'settlement.raid') {
    if (act === 'file') {
      const n = Number(a.n)
      if (n < 6) return refuse('raid_lead_short', { min: 6 })
      if (n > 48) return refuse('raid_lead_long', { max: 48 })
      st.filed.push({ id: `r-f${st.seq++}`, side: 'attacker', other: N(String(a.code), String(a.code) === 'v-q7m2' ? 'سرخه' : 'نمین'), status: 'filed', start_at: iso(n), end_at: iso(n + 0.5), fee: 800, raiders: Number(a.raiders ?? 0), joined: 0, standing: 0, me: false, tribute: 0, warned: false, warned_by: '', lead_secs: n * 3600, outcome: null, can_join: false, can_stand: false, can_offer: false, can_accept: false })
      return mockOk('settlement_raid', view('raid_filed'), [back('settlement.overview'), refreshA('settlement.raid')])
    }
    if (act === 'join') { st.joined = true; return mockOk('settlement_raid', view('raid_joined'), [back('settlement.overview')]) }
    if (act === 'stand') { st.joined = true; return mockOk('settlement_raid', view('raid_standing'), [back('settlement.overview')]) }
    if (act === 'offer') { const n = Number(a.n); if (n < 500) return refuse('raid_tribute_low', { min: 500 }); st.tribute = n; return mockOk('settlement_raid', view('raid_offered'), [back('settlement.overview')]) }
    if (act === 'accept') { st.tribute = 0; return mockOk('settlement_raid', view('raid_settled'), [back('settlement.overview')]) }
    return mockOk('settlement_raid', view(), [back('settlement.overview'), refreshA('settlement.raid')])
  }
  if (command === 'settlement.insurance') {
    if (act === 'open') { st.insOpen = true; return mockOk('settlement_insurance', ins('opened'), [back('settlement.overview')]) }
    if (act === 'scale') { const n = Number(a.n); if (n < 5000 || n > 20000) return refuse('insurance_bad_scale'); st.scale = n; return mockOk('settlement_insurance', ins('scaled'), [back('settlement.overview')]) }
    if (act === 'buy') { const code = String(a.code); if (code === 'raid_cover' && !a.n) return refuse('insurance_no_building'); st.bought.push({ no: st.seq++, product: code, covers: code === 'kit' ? 'death_loss' : 'raid_damage', building: code === 'kit' ? null : String(a.n) }); return mockOk('settlement_insurance', ins('bought'), [back('settlement.overview')]) }
    return mockOk('settlement_insurance', ins(), [back('settlement.overview')])
  }
  return null
}
