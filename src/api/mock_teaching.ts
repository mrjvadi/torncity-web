// The teaching network of the mock (ADR 0071), ?mock=1&teach=apprentice|master|none: the apprenticeships panel with a stateful line (offered, accepted, shifts, exam, certificate),
// the pool's craftsman to join, the directory per craft and the refusals. Opens with open=settlement.apprentice.mine or education.teachers.
import { A, back, mockOk, mockRefusal } from './mock_neutral'
import type { ApprenticeLine, TeacherEntry } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('teach') ?? 'apprentice' } catch { return 'apprentice' } }
const N = (code: string, name: string) => ({ code, name })
const WS = N('b-weave-1', 'کارگاه بافندگی')
const st = { phase: '' as '' | 'offered' | 'active' | 'ready' | 'completed' | 'left' | 'dismissed', shifts: 0, notice: '', joined: false, offer: { days: 28, fee: 0, share: 5000 } }
const init = () => { if (st.phase === '' ) st.phase = mode() === 'none' ? 'left' : mode() === 'master' ? 'active' : 'offered' }

function lines(): ApprenticeLine[] {
  init()
  const master = mode() === 'master'
  const out: ApprenticeLine[] = []
  const phase = st.phase === 'active' && st.shifts >= 3 ? 'ready' : st.phase
  if (st.phase !== 'left' || st.notice) {
    out.push({
      id: 'ap1', craft: 'weaving_craft', role: master ? 'master' : 'apprentice', with: master ? N('P-4FK2', 'سارا') : N('P-9QXM', 'کاوه'), workshop: WS,
      status: phase === 'ready' ? 'active' : phase === 'completed' || phase === 'left' || phase === 'dismissed' ? (phase as string) : phase, npc: false,
      fee: st.offer.fee || 600, wage_share_bps: st.offer.share, term_days: st.offer.days, ends_at: phase === 'offered' ? null : new Date(Date.now() + 19 * 86400_000).toISOString(), shifts: st.shifts, exam_shifts: 3, extra_xp: st.shifts * 15,
      certified: phase === 'completed',
      can_accept: !master && phase === 'offered', can_leave: phase === 'offered' || (phase === 'active' || phase === 'ready') && !master, can_dismiss: master && (phase === 'active' || phase === 'ready'), can_exam: master && phase === 'ready',
    })
  }
  return out
}

const view = (notice = '') => {
  init()
  return mockOk('apprentices', { lines: lines(), can_join: st.joined || mode() === 'none' && false ? null : [{ workshop: N('b-pool-1', 'کارگاه بافندگی شهر'), craft: 'weaving_craft', up_to: 2 }], notice }, [back('education.list'), A('refresh', 'settlement.apprentice.mine', {})])
}
const refuse = (kind: string) => mockOk('apprentice_refusal', { kind }, [back('settlement.apprentice.mine')])

const entries = (craft: string): TeacherEntry[] => {
  const e = (kind: string, place: string, km: number, who: string, cl: number, tl: number, up: number, fee: number, seats: number, here = false): TeacherEntry => ({ kind, settlement: N(place === 'آمل' ? 'v-k3x9' : place, place), km, teacher: N(who ? `P-${who.length}K` : '', who), craft_level: cl, teaching_level: tl, up_to: up, fee, free_seats: seats, here })
  return craft === 'pottery_craft' ? [e('master', 'آمل', 0, 'نرگس', 4, 2, 3, 400, 1, true), e('city', 'شهر مرکزی', 212, '', 5, 0, 4, 1800, 12)]
    : [e('class', 'آمل', 0, 'کاوه', 3, 1, 2, 300, 5, true), e('master', 'آمل', 0, 'سارا', 5, 3, 4, 900, 1, true), e('npc_master', 'آمل', 0, '', 2, 0, 2, 0, 2, true), e('master', 'سرخه', 48, 'امیر', 4, 2, 3, 600, 0), e('city', 'شهر مرکزی', 212, '', 5, 0, 4, 1800, 12)]
}
const CRAFTS = ['weaving_craft', 'pottery_craft', 'milling_craft', 'baking_craft', 'tanning_craft', 'forestry_craft', 'herding_craft', 'farming_craft', 'tailoring_craft', 'carpentry_craft', 'masonry_craft', 'smithing_craft', 'herbal_medicine']
const CNAME: Record<string, string> = { weaving_craft: 'بافندگی', pottery_craft: 'سفالگری', milling_craft: 'آسیابانی', baking_craft: 'نانوایی', tanning_craft: 'دباغی', forestry_craft: 'جنگل‌داری', herding_craft: 'دامداری', farming_craft: 'کشاورزی', tailoring_craft: 'خیاطی', carpentry_craft: 'نجاری', masonry_craft: 'بنایی', smithing_craft: 'آهنگری', herbal_medicine: 'گیاهان دارویی' }
export const TEACH_CONTENT = { skill: CRAFTS.map((c) => ({ code: c.replace(/_craft$/, ''), name: { en: c, fa: CNAME[c] } })), course: CRAFTS.map((c) => ({ code: c, name: { en: c, fa: `استادکاری ${CNAME[c]}` } })) }

export function mockTeachingCommand(command: string, a: Record<string, unknown>): unknown | null {
  switch (command) {
    case 'settlement.apprentice.mine': return view()
    case 'education.teachers': { const craft = String(a.craft || 'weaving_craft'); return mockOk('teachers', { craft, course: N(craft, `استادکاری ${CNAME[craft] ?? craft}`), entries: entries(craft), crafts: CRAFTS }, [back('education.list')]) }
    case 'settlement.apprentice.offer': {
      const days = Number(a.days ?? 28), fee = Number(a.fee ?? 0), share = Number(a.share ?? 5000)
      if (!String(a.player ?? '').trim()) return refuse('apprentice_unknown')
      if (days < 7 || days > 90 || fee < 0 || fee > 5000 || share < 2000 || share > 8000) return refuse('range')
      st.phase = 'offered'; st.shifts = 0; st.offer = { days, fee, share }; mockModeMaster(); return view('offered')
    }
    case 'settlement.apprentice.accept': st.phase = 'active'; st.shifts = 3 - (mode() === 'apprentice' ? 3 : 0) + 0; st.shifts = 1; return view('started')
    case 'settlement.apprentice.leave': st.phase = 'left'; st.notice = 'left'; return view('left')
    case 'settlement.apprentice.dismiss': { if (!['idle', 'abusive'].includes(String(a.reason))) return refuse('reason'); st.phase = 'dismissed'; return view('dismissed') }
    case 'settlement.apprentice.exam': { if (st.shifts < 3) return refuse('exam_not_ready'); st.phase = String(a.pass) === 'pass' ? 'completed' : 'left'; st.notice = ''; return view('') }
    case 'settlement.apprentice.join': st.joined = true; st.phase = 'active'; st.shifts = 0; return view('started')
    case 'mock.apprentice_ready': st.phase = 'active'; st.shifts = 3; return view()
    case 'mock.apprentice_refuse': return refuse(String(a.kind ?? 'slots_full'))
  }
  return null
}
function mockModeMaster() { /* the offer is made by the master: the line the viewer sees stays his */ }
void mockRefusal
