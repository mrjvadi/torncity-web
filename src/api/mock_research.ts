// The research desk (settlement.research), ?res=: one (one free slot and a library with an empty post, default), full (all slots busy),
// pact (an active pact and an offer to answer), none (no research building).
import { A, back, mockOk, refreshA } from './mock_neutral'
import type { ResearchBoardView } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('res') ?? 'one' } catch { return 'one' } }
const N = (code: string, name: string) => ({ code, name })
const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
let took = false

export function researchBoard(): ResearchBoardView {
  const m = mode(), full = m === 'full', none = m === 'none', pact = m === 'pact'
  const lib = { id: 'b-lib', building: N('library', 'کتابخانه'), open: !none, idle: '', slots: 1, needed: 2, posts: 2, players: took ? 1 : 0, np_cs: 1, wage: 40, bonus_bps: 1300, upkeep: [{ item: N('wool', 'پشم'), qty: 1, have: 5 }], mine: took, can_take: !took }
  const buildings = none ? [] : [m === 'one' && !took ? { ...lib, open: true, idle: '' } : lib, ...(full ? [{ ...lib, id: 'b-lab', building: N('laboratory', 'آزمایشگاه'), open: false, idle: 'no_upkeep', players: 0, np_cs: 0, mine: false, can_take: true, upkeep: [{ item: N('glass', 'شیشه'), qty: 2, have: 0 }] }] : [])]
  const slots = [{ ref: 'free', building: N('', ''), capacity: 1, used: full ? 1 : 0, bonus_bps: 0, staff_bps: 0 }, ...(none ? [] : [{ ref: 'b-lib', building: N('library', 'کتابخانه'), capacity: 1, used: full || m === 'pact' ? 1 : 0, bonus_bps: 1300, staff_bps: 0 }])]
  const projects = full || pact
    ? [{ knowledge: N('masonry', 'سنگ‌تراشی'), slot: 'b-lib', building: N('library', 'کتابخانه'), speed_bps: 11300, ahead_bps: 13000, discount_bps: 1200, share_bps: pact ? 2000 : 0, finish_at: iso(30), left_seconds: 30 * 3600 },
      ...(full ? [{ knowledge: N('writing', 'نوشتن'), slot: 'free', building: N('', ''), speed_bps: 10000, ahead_bps: 10000, discount_bps: 0, share_bps: 0, finish_at: iso(11), left_seconds: 11 * 3600 }] : [])] : []
  return {
    name: 'آمل', capacity: slots.reduce((a, s) => a + s.capacity, 0), running: projects.length, frontier: 3, literacy_percent: 41, slots, buildings, projects,
    pacts: pact ? [{ id: 'p1', partner: N('v-q7m2', 'سرخه'), state: 'active' }, { id: 'p2', partner: N('v-z1p8', 'کوهدشت'), state: 'incoming' }] : [],
    neighbours: [N('v-q7m2', 'سرخه'), N('v-z1p8', 'کوهدشت')], experience: [{ field: 'farming', points: 70, per: 100, max_bps: 3000 }, { field: 'craft', points: 20, per: 100, max_bps: 3000 }, { field: 'building', points: 0, per: 100, max_bps: 3000 }],
    may_share: true, share_cap_bps: 5000,
  }
}

export function mockResearchCommand(command: string, args: Record<string, unknown>) {
  if (command !== 'settlement.research') return null
  if (args.action === 'post') took = true
  if (args.action === 'leave') took = false
  return mockOk('research', researchBoard(), [back('settlement.knowledge'), refreshA('settlement.research')])
}
