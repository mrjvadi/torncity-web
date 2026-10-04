// Offline labour market for ?mock=1 (client-api.md, settlement.labor.*): a
// woodcutter's camp and a cottage going up, a job on each, day labourers and the
// wage curve of internal/domain/labor. Shifts are shortened so a demo sees them
// end. Shapes follow the contract; values are plausible sample data.

import type { LaborBoardView, LaborJobView, LaborMarketView, LaborMineView, LaborShiftView, LaborSiteView } from './laborTypes'
import { A, back, mockOk, mockRefusal, refreshA, type MockAct } from './mock_neutral'

const SHIFT_MS = 9000
const NPC_BPS = 8500
const CURVE: [number, number][] = [[0, 7000], [5000, 10000], [10000, 15000], [20000, 25000]]
const BASE_WAGE = 30
const MIN_WAGE = 10

interface Site { id: string; code: string; fa: string; en: string; x: number; y: number; required: number; done: number; jobId: string; left: number; total: number; crew: number; wage: number; status: 'building' | 'complete'; employer: string }
interface Shift { id: string; siteId: string; npc: boolean; name: string; level: string; finish: number; wage: number; points: number }

const S = {
  ready: false,
  housing: 4,
  residents: 2,
  sites: [] as Site[],
  shifts: [] as Shift[],
  shiftsWorked: 9,
  earned: 310,
  cash: 1200,
  seq: 1,
}

const RESERVED = 2
const RESERVED_FROM: string | null = new Date(Date.now() + 36 * 3600_000).toISOString()

function init() {
  if (S.ready) return
  S.ready = true
  S.sites = [
    { id: 'lb-site-1', code: 'woodcutter_camp', fa: 'کارگاه هیزم‌شکنی', en: 'Woodcutter camp', x: 1, y: 0, required: 120, done: 42, jobId: 'lb-job-1', left: 3, total: 4, crew: 0, wage: 30, status: 'building', employer: '' },
    { id: 'lb-site-2', code: 'cottage', fa: 'خانهٔ کوچک', en: 'Cottage', x: 3, y: 1, required: 240, done: 0, jobId: 'lb-job-2', left: 6, total: 6, crew: 0, wage: 45, status: 'building', employer: 'سارا' },
  ]
  S.shifts = [{ id: 'lb-shift-0', siteId: 'lb-site-1', npc: false, name: 'سارا', level: 'journeyman', finish: Date.now() + 5 * 60_000, wage: 30, points: 60 }]
}

function tick() {
  const now = Date.now()
  for (const sh of [...S.shifts]) {
    if (sh.finish > now) continue
    S.shifts.splice(S.shifts.indexOf(sh), 1)
    const site = S.sites.find((x) => x.id === sh.siteId)
    if (!site || site.status !== 'building') continue
    site.done = Math.min(site.required, site.done + sh.points)
    if (sh.name === 'شما') { S.shiftsWorked++; S.earned += sh.wage; S.cash += sh.wage }
    if (site.done >= site.required) {
      site.status = 'complete'
      if (site.code === 'cottage') S.housing += 4
    }
  }
}

function market(): LaborMarketView {
  const pool = Math.ceil(((8 + S.housing - S.residents) * 6000) / 10000)
  const npcWorking = S.shifts.filter((s) => s.npc).length
  const vacancies = S.sites.filter((s) => s.status === 'building').reduce((n, s) => n + Math.min(s.left, Math.ceil((s.required - s.done) / 60)), 0)
  const force = pool + S.residents
  const tight = Math.floor(((S.shifts.length + vacancies) * 10000) / Math.max(1, force))
  let mult = CURVE[CURVE.length - 1][1]
  if (tight <= 0) mult = CURVE[0][1]
  else for (let i = 1; i < CURVE.length; i++) {
    if (tight <= CURVE[i][0]) {
      const [t0, w0] = CURVE[i - 1], [t1, w1] = CURVE[i]
      mult = w0 + Math.floor(((w1 - w0) * (tight - t0)) / (t1 - t0))
      break
    }
  }
  const level = tight < 4000 ? 'slack' : tight < 10000 ? 'balanced' : tight < 20000 ? 'tight' : 'short'
  return {
    housing: S.housing, pool, available: Math.max(0, pool - npcWorking - RESERVED), reserved: RESERVED, reserved_from: RESERVED_FROM, working: S.shifts.length, vacancies, tightness_bps: tight,
    level, npc_wage: Math.max(MIN_WAGE, Math.floor((BASE_WAGE * mult) / 10000)), min_wage: MIN_WAGE,
  }
}

/** The authored name is English, as on the real server; the web resolves names from the catalogue. */
const named = (s: Site) => ({ code: s.code, name: s.en })
const shiftView = (sh: Shift): LaborShiftView => ({
  id: sh.id, building: { code: '', name: '' }, kind: 'construction', worker: sh.name, worker_npc: sh.npc, level: sh.level,
  finish_at: new Date(sh.finish).toISOString(), left_seconds: Math.max(0, Math.round((sh.finish - Date.now()) / 1000)), wage: sh.wage, points: sh.points,
})

function jobView(s: Site): LaborJobView {
  const shifts = S.shifts.filter((x) => x.siteId === s.id)
  const pending = shifts.reduce((n, x) => n + x.points, 0)
  return {
    id: s.jobId, building_id: s.id, building: named(s), kind: 'construction', employer_kind: s.employer ? 'player' : 'settlement', employer: s.employer,
    wage: s.wage, left: s.left, total: s.total, progress_bps: Math.floor((s.done * 10000) / s.required), left_minutes: s.required - s.done,
    workers: shifts.length, npc_crew: s.crew, can_take: s.status === 'building' && s.left > 0 && s.required - s.done - pending > 0 && !mine(), mine: !!s.employer && false, points: 42, lot_x: s.x, lot_y: s.y,
  }
}

const mine = () => S.shifts.find((x) => x.name === 'شما')

function siteView(s: Site, just = ''): LaborSiteView {
  const m = market()
  const job = s.status === 'building' && s.jobId ? jobView(s) : null
  const shifts = S.shifts.filter((x) => x.siteId === s.id).map(shiftView)
  const head = !s.employer
  const my = mine()
  return {
    village: 'آمل', building: named(s), id: s.id, status: s.status, progress_bps: Math.floor((s.done * 10000) / s.required),
    required_minutes: s.required, done_minutes: s.done, left_minutes: s.required - s.done, job, workers: shifts.length ? shifts : null, market: m,
    can_work: !!job && job.can_take, work_wage: s.wage, work_points: 42, working: my ? shiftView(my) : null,
    can_employ: !!job && head, can_post: s.status === 'building' && !s.jobId && head,
    hire_presets: head && job ? [1, 2, 4] : null,
    wage_presets: head && job ? [100, 125, 150, 200].map((p) => ({ percent: p, wage: Math.floor((m.npc_wage * p) / 100) })) : null,
    npc_available: m.available, npc_wage: m.npc_wage, just,
  }
}

function fillCrew(s: Site) {
  const m = market()
  let free = m.available
  const have = S.shifts.filter((x) => x.siteId === s.id && x.npc).length
  for (let i = have; i < s.crew && free > 0 && s.left > 0; i++, free--) {
    S.shifts.push({ id: `lb-shift-${S.seq++}`, siteId: s.id, npc: true, name: '', level: '', finish: Date.now() + SHIFT_MS + i * 1500, wage: m.npc_wage, points: Math.floor((60 * NPC_BPS) / 10000) })
    s.left--
  }
}

const refusal = (kind: string) => mockRefusal(kind, { back: { command: 'settlement.labor.board', args: null } })

/** The sites raised by work, for the village's construction queue (settlement.build.progress). */
export function laborProgressLines() {
  init()
  tick()
  return S.sites.filter((x) => x.status === 'building').map((x) => ({ id: x.id, code: x.code, x: x.x, y: x.y, done: x.done, required: x.required }))
}

/** A site's screen with the actions of internal/presentation/village/screens.go LaborSite. */
function siteScreen(s: Site, just = '') {
  const v = siteView(s, just)
  const acts: MockAct[] = []
  const jobId = v.job?.id ?? ''
  if (v.can_work && jobId) acts.push(A('labor.take', 'settlement.labor.take', { id: jobId }))
  if (v.can_employ && jobId) {
    for (const n of v.hire_presets ?? []) acts.push(A('labor.hire', 'settlement.labor.hire', { id: jobId, n: String(n) }))
    for (const p of v.wage_presets ?? []) acts.push(A('labor.wage', 'settlement.labor.wage', { id: jobId, n: String(p.percent) }))
    acts.push(A('labor.close', 'settlement.labor.close', { id: jobId }, { kind: 'danger' }))
  }
  if (v.can_post) acts.push(A('labor.post', 'settlement.labor.post', { id: v.id }))
  acts.push(A('labor.board', 'settlement.labor.board'), A('labor.mine', 'settlement.labor.mine'), back('settlement.labor.board'), refreshA('settlement.labor.site', { id: v.id }))
  return mockOk('labor_site', v, acts)
}

export function mockLaborCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  if (!command.startsWith('settlement.labor.')) return null
  init()
  tick()
  const site = S.sites.find((s) => s.id === String(args.id ?? '') || s.jobId === String(args.id ?? ''))
  switch (command) {
    case 'settlement.labor.board': {
      const jobs = S.sites.filter((s) => s.status === 'building' && s.jobId).map(jobView)
      const my = mine()
      const view: LaborBoardView = {
        village: 'آمل', jobs: jobs.length ? jobs : null, market: market(), working: my ? shiftView(my) : null, resident: true,
        sites: S.sites.filter((s) => s.status === 'building' && !s.jobId).map((s) => ({ id: s.id, building: named(s), progress_bps: Math.floor((s.done * 10000) / s.required) })),
      }
      const acts: MockAct[] = [
        ...jobs.map((j) => A('labor.job', 'settlement.labor.site', { id: j.building_id }, { subject: j.building.code })),
        ...(view.sites ?? []).map((x) => A('labor.post', 'settlement.labor.post', { id: x.id }, { subject: x.building.code })),
        A('labor.mine', 'settlement.labor.mine'), A('village.build', 'settlement.build'), back('settlement.overview'), refreshA('settlement.labor.board'),
      ]
      return mockOk('labor_board', view, acts)
    }
    case 'settlement.labor.site':
      return site ? siteScreen(site) : refusal('labor_no_site')
    case 'settlement.labor.take': {
      if (!site || !site.jobId) return refusal('labor_no_job')
      if (mine()) return refusal('already_working')
      site.left--
      S.shifts.push({ id: `lb-shift-${S.seq++}`, siteId: site.id, npc: false, name: 'شما', level: 'journeyman', finish: Date.now() + SHIFT_MS, wage: site.wage, points: 60 })
      return siteScreen(site, 'worked')
    }
    case 'settlement.labor.hire': {
      if (!site) return refusal('labor_no_site')
      site.crew = Math.max(0, Number(args.n ?? 0))
      const before = S.shifts.length
      fillCrew(site)
      if (site.crew > 0 && S.shifts.length === before) return refusal('labor_no_npc')
      return siteScreen(site, 'hired')
    }
    case 'settlement.labor.wage': {
      if (!site) return refusal('labor_no_site')
      site.wage = Math.floor((market().npc_wage * Number(args.n ?? 100)) / 100)
      return siteScreen(site, 'wage')
    }
    case 'settlement.labor.close': {
      if (!site) return refusal('labor_no_site')
      site.jobId = ''
      return siteScreen(site, 'closed')
    }
    case 'settlement.labor.post': {
      if (!site) return refusal('labor_no_site')
      site.jobId = `lb-job-${S.seq++}`
      site.left = Math.ceil((site.required - site.done) / 60) * 2
      site.total = site.left
      site.wage = market().npc_wage
      return siteScreen(site, 'posted')
    }
    case 'settlement.labor.mine': {
      const my = mine()
      const lv = S.shiftsWorked >= 30 ? 'master' : S.shiftsWorked >= 6 ? 'journeyman' : 'apprentice'
      const view: LaborMineView = {
        village: 'آمل', shifts: S.shiftsWorked, earned: S.earned, level: lv, productivity_bps: lv === 'master' ? 13000 : lv === 'journeyman' ? 10000 : 7000,
        next_level: lv === 'master' ? '' : lv === 'journeyman' ? 'master' : 'journeyman', next_shifts: lv === 'master' ? 0 : lv === 'journeyman' ? 30 - S.shiftsWorked : 6 - S.shiftsWorked,
        working: my ? shiftView(my) : null, market: market(),
      }
      return mockOk('labor_mine', view, [A('labor.board', 'settlement.labor.board'), A('village.work', 'settlement.work'), back('settlement.labor.board'), refreshA('settlement.labor.mine')])
    }
    default: return null
  }
}
