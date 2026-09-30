// MOCK of what the server is adding (see location.ts): the bootstrap's
// `location`, `travel.destinations` and `travel.start` between Support and
// the villages. Dev only (?mock=1); it answers nothing unless `?loc=` asks:
//   ?loc=support   the player is in Support
//   ?loc=village   in their own village (`location` present, kind settlement)
//   ?loc=foreign   visiting the other mock village
//   ?loc=travel    on the road to Support
// A journey started in the mock lasts 15 seconds, then the player arrives.

import type { PlayerLocation, TravelDestination } from './location'
import { MOCK_VILLAGE_IDS } from '../api/mock_village_ids'

const SUPPORT = { kind: 'city' as const, code: 'support', name: 'ساپورت' }
const OWN = { kind: 'village' as const, code: 'v-k3x9', name: 'آمل', settlement_id: MOCK_VILLAGE_IDS.own, emblem: { shape: 'shield', color_a: 'crimson', color_b: 'gold', icon: 'wheat' }, motto: 'با هم می‌سازیم' }
const OTHER = { kind: 'village' as const, code: 'v-q7m2', name: 'سرخه', settlement_id: MOCK_VILLAGE_IDS.other, emblem: { shape: 'banner', color_a: 'azure', color_b: 'ivory', icon: 'tree' }, motto: 'سرزمین درختان' }
const FAR = { kind: 'village' as const, code: 'v-z1p8', name: 'کوهدشت', settlement_id: 'mock-village-3', emblem: { shape: 'hexagon', color_a: 'green', color_b: 'gold', icon: 'wheat' }, motto: '' }

const DEST: TravelDestination[] = [
  { ...SUPPORT, distance_km: 42, duration_seconds: 900, fare: 6300 },
  { ...OWN, distance_km: 42, duration_seconds: 900, fare: 6300 },
  { ...OTHER, distance_km: 118, duration_seconds: 1800, fare: 9100 },
  { ...FAR, distance_km: 460, duration_seconds: 5400, fare: 24800 },
]

let where: 'support' | 'own' | 'foreign' | 'travel' | null = (() => {
  const v = new URLSearchParams(location.search).get('loc')
  return v === 'support' ? 'support' : v === 'village' ? 'own' : v === 'foreign' ? 'foreign' : v === 'travel' ? 'travel' : null
})()
let trip: { to: TravelDestination; mode: string; started: number; total: number } | null =
  where === 'travel' ? { to: DEST[0], mode: 'train', started: Date.now() - 20000, total: 60000 } : null

const MODE_NAME: Record<string, string> = { bus: 'اتوبوس', car: 'خودرو', train: 'قطار', flight: 'هواپیما' }

function tick() {
  if (trip && Date.now() >= trip.started + trip.total) {
    where = trip.to.code === 'support' ? 'support' : trip.to.code === OWN.code ? 'own' : 'foreign'
    if (where === 'foreign' && trip.to.code !== OTHER.code) where = 'foreign'
    foreign = trip.to.code === FAR.code ? FAR : OTHER
    trip = null
  }
}
let foreign: typeof OTHER | typeof FAR = OTHER

export function mockLocation(): PlayerLocation | undefined {
  tick()
  if (!where) return undefined
  if (trip) {
    const left = Math.max(0, Math.round((trip.started + trip.total - Date.now()) / 1000))
    return {
      kind: 'travelling', code: trip.to.code, name: trip.to.name, settlement_id: trip.to.settlement_id,
      from: SUPPORT, to: trip.to, mode_code: trip.mode, mode_name: MODE_NAME[trip.mode], remaining_seconds: left, total_seconds: Math.round(trip.total / 1000),
      arrives_at: new Date(trip.started + trip.total).toISOString(),
    }
  }
  if (where === 'support') return { kind: 'city', code: 'support', name: SUPPORT.name }
  if (where === 'own') return { kind: 'settlement', code: OWN.code, name: OWN.name, settlement_id: OWN.settlement_id }
  return { kind: 'settlement', code: foreign.code, name: foreign.name, settlement_id: foreign.settlement_id }
}

export function mockSupportCommand(command: string, args: Record<string, unknown> = {}): unknown | null {
  if (!where) return null
  if (command === 'travel.destinations') {
    tick()
    return { ok: true, screen: 'travel_destinations', text: 'مقصدها', view: { destinations: DEST.filter((d) => d.code !== OWN.code || where !== 'own'), mock: true }, actions: [] }
  }
  if (command === 'travel.start') {
    const to = DEST.find((d) => d.code === args.city)
    if (!to) return { ok: false, screen: 'error', text: 'no', error: { code: 'not_found', message: 'مقصد نامعتبر' } }
    trip = { to, mode: String(args.mode ?? 'bus'), started: Date.now(), total: 15000 }
    return { ok: true, screen: 'travel_status', text: 'سفر آغاز شد', view: { from: 'ساپورت', to: to.name, mode_name: MODE_NAME[trip.mode], remaining_seconds: 15 }, actions: [] }
  }
  return null
}
