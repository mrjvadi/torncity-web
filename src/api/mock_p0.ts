// Mock answers (?mock=1) of the screens the activities work adds: the hub, the work home, the health home and the
// crime hub's empty reason. The mock player is a village resident, so crime is not listed.

type Args = Record<string, unknown> | undefined

const ok = (screen: string, view: unknown) => ({ ok: true, screen, view, actions: [] })

export function mockP0Command(command: string, _args?: Args) {
  if (command === 'activities.hub') {
    return ok('activities_hub', {
      place: { code: 'v-k3x9', name: 'آمل', tier: 'village', neutral: false },
      entries: [
        { code: 'work', command: 'work.home' }, { code: 'learn', command: 'education.list' }, { code: 'health', command: 'health.home' },
        { code: 'missions', command: 'mission.board' }, { code: 'rankings', command: 'life.top' },
      ],
    })
  }
  if (command === 'work.home') {
    return ok('work_home', {
      place: { code: 'v-k3x9', name: 'آمل', tier: 'village' }, resident: true, energy: 72, max_energy: 100, working: null, is_head: false,
      jobs: [{ id: 'j1', building_id: 'b1', building: { code: 'cottage', name: 'Cottage' }, kind: 'construction', employer_kind: 'settlement', employer: '', wage: 21, left: 6, total: 8, progress_bps: 3000, left_minutes: 300, workers: 1, npc_crew: 0, can_take: true, mine: false, points: 60 }],
      workplaces: [{ id: 'w1', building: { code: 'woodcutter_camp', name: 'Woodcutter camp' }, produces: [{ component: { code: 'timber', name: 'Timber' }, quantity: 4 }], consumes: [], wage: 18, shift_seconds: 600, workers: 2, busy: 0, ready: true }],
      market: { housing: 4, pool: 21, available: 21, working: 0, vacancies: 6, tightness_bps: 3000, level: 'slack', npc_wage: 21, min_wage: 15 }, empty: '', next: '',
    })
  }
  if (command === 'health.home') {
    return ok('health_home', {
      place: { code: 'v-k3x9', name: 'آمل', tier: 'village', neutral: false }, health: 88, max_health: 100, admitted: null,
      rest: { has: false, can_rest: false, wait_seconds: 0 },
      facilities: [{ kind: 'health_house', building: { code: 'health_house', name: 'Health house' } }],
      refer: { code: 'support', name: 'Support' }, empty: '',
    })
  }
  if (command === 'crime.hub') {
    return ok('crime_hub', {
      city: 'Amol', city_code: 'v-k3x9', venue: { code: '', name: '' }, nerve: { nerve: 20, max: 20, full_in_seconds: 0 },
      heat: { heat: 0, max: 100, wanted: 0, stars: 0 }, tier: { tier: { code: 'novice', name: 'novice' }, xp: 0, next: { code: '', name: '' }, next_xp: 0 },
      travelling: false, jail: null, busy: null, categories: [], empty: 'no_venue', min_level: 2,
    })
  }
  return null
}
