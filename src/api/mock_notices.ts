// Offline notices for ?mock=1: one of every notice screen the server pushes (api/client-api.md
// section 5.3), typed by the generated views, so the inbox, the toasts and the screenshots
// exercise every one. `category` is the inbox category the server files it under.

import type { ScreenViews } from './views.gen'

type Key = keyof ScreenViews

export interface MockNotice<K extends Key = Key> {
  category: string
  kind: string
  screen: K
  view: ScreenViews[K]
  ago: number
}

const n = (code: string, name = code) => ({ code, name })
const city = { kind: 'city', code: 'calderis', name: 'Calderis' }

function item<K extends Key>(category: string, kind: string, screen: K, view: ScreenViews[K], ago: number): MockNotice {
  return { category, kind, screen, view, ago } as unknown as MockNotice
}

export const MOCK_NOTICES: MockNotice[] = [
  item('finance', 'bank.payment_received', 'payment_notice', { payer_name: 'کاوه', payer_code: 'B3C4D5F', method: 'card', amount: 12500 }, 300),
  item('achievements', 'achievement.awarded', 'achievement_notice', { achievement: n('first_job'), cash: 500, withheld: 0 }, 900),
  item('government', 'governance.appointed', 'office_notice', { office: 'deputy_mayor', place: city, by: { name: 'مینا', code: 'M1' }, by_office: 'mayor', dismissed: false }, 1500),
  item('market', 'auction.outbid', 'auction_notice', { kind: 'outbid', no: 14, item: n('bread'), amount: 900, fee: 0 }, 2100),
  item('crime', 'crime.victimised', 'victim_notice', { crime: n('pickpocket'), venue: n('bazaar'), city_code: 'calderis', city: 'Calderis', amount: 1500, thief_name: '', thief_code: '', crime_id: 'c1', report_fee: 100, report_within_seconds: 3600, item: null }, 3000),
  item('crime', 'crime.case_solved', 'case_solved_notice', { crime: n('pickpocket'), city_code: 'calderis', city: 'Calderis', solved: true, thief: 'رضا', thief_code: 'R2', stolen: 1500, restored: 1100, shortfall: 400, fine: 0, fine_paid: 0, term_seconds: 0, returned: null }, 3600),
  item('crime', 'crime.convicted', 'convicted_notice', { crime: n('pickpocket'), city_code: 'calderis', city: 'Calderis', solved: true, thief: '', thief_code: '', stolen: 1500, restored: 1100, shortfall: 0, fine: 300, fine_paid: 300, term_seconds: 240, returned: null }, 4200),
  item('government', 'diplomacy.treaty_proposed', 'treaty_proposed_notice', { country: { kind: 'country', code: 'ir', name: 'ایران' }, other: { kind: 'country', code: 'tr', name: 'ترکیه' }, kind: n('trade'), no: 7, ttl_seconds: 7200 }, 4800),
  item('government', 'election.result', 'election_result_notice', { no: 3, office: 'mayor', place: city, elected: true, votes: 41, cast: 90, deposit: 500, deposit_returned: true }, 5400),
  item('social', 'faction.invited', 'faction_request_notice', { no: 8, kind: 'invite', ref: { code: 'owls', name: 'جغدهای شب' }, player: { name: 'مینا', code: 'M1' } }, 6000),
  item('social', 'faction.answered', 'faction_answer_notice', { ref: { code: 'owls', name: 'جغدهای شب' }, kind: 'apply', accepted: true, player: { name: 'رضا', code: 'R2' } }, 6600),
  item('crime', 'faction.crime_settled', 'faction_crime_notice', { ref: { code: 'owls', name: 'جغدهای شب' }, crime: n('warehouse_heist'), result: 'succeeded', share: 3000, take: 12000, cut: 3000, xp: 40, jail: null, fine: 0, fine_paid: 0, injury: null }, 7200),
  item('finance', 'loan.missed', 'finance_notice', { kind: 'missed', no: 2, product: n('personal'), amount: 800, other: 80, count: 2, at: null, pledge: null }, 7800),
  item('health', 'health.hospitalised', 'hospitalised_notice', { city_code: 'calderis', city: 'Calderis', cause: 'crime', damage: 25, health: 60, max: 100, ends_at: null, remaining_seconds: 1800 }, 8400),
  item('health', 'health.clinic_treated', 'clinic_treated_notice', { ref: { code: 'CL1', name: 'نسیم', type: n('clinic') }, patient: 'کاوه', price: 700, item: n('bandage'), units: 1, saved_seconds: 600 }, 9000),
  item('government', 'legislature.decided', 'bill_decided_notice', { no: 6, place: city, subject: { kind: 'lever', code: 'tax_rate', lever_type: 'bps', value: 800, allocation: null, categories: null, target: null }, body: 'city_council', status: 'passed', lapsed_why: '', yes: 5, nay: 2 }, 9600),
  item('life', 'life.rank_changed', 'rank_notice', { rank: { code: 'merchant', name: 'Merchant', emoji: '' }, from: { code: 'citizen', name: 'Citizen', emoji: '' }, up: true, worth: 54000 }, 10200),
  item('life', 'life.hunger_low', 'hunger_notice', {}, 10800),
  item('market', 'market.filled', 'market_filled_notice', { side: 'sell', item: n('bread'), qty: 10, price: 90, amount: 900, fee: 18, city_code: 'calderis', city: 'Calderis' }, 11400),
  item('missions', 'mission.completed', 'mission_completed_notice', { mission: n('deliver_flour'), cash: 600, withheld: 0, xp: 20, items: [{ item: n('bread'), qty: 2 }] }, 12000),
  item('property', 'property.sold', 'property_notice', { kind: 'sold', type: n('cottage'), no: 12, city: city, player: { name: 'کاوه', code: 'B3C4D5F' }, amount: 40000 }, 12600),
  item('companies', 'company.recruit', 'recruit_notice', { kind: 'applied', company: { code: 'CO1', name: 'نان کاوه', type: n('bakery') }, campaign_no: 5, count: 2, name_seed: 1, skill: 'baking', level: 2, reason: '', amount: 0 }, 13200),
  item('finance', 'stock.dividend', 'stock_notice', { kind: 'dividend', company: n('kaveh_bakery', 'نان کاوه'), side: '', qty: 20, price: 15, amount: 300, player: '' }, 13800),
  item('government', 'settlement.news', 'village_news', { village: 'کورندال', items: [{ kind: 'built', building: n('granary'), knowledge: n(''), percent: 0, player: '', amount: 0, tier: '' }] }, 14400),
]

/** The notice of a screen, for the mock's toast hook. */
export function mockNotice(screen: string): MockNotice | undefined {
  return MOCK_NOTICES.find((x) => x.screen === screen)
}

export function mockInboxCategories(): { category: string; count: number }[] {
  const by = new Map<string, number>()
  for (const x of MOCK_NOTICES) by.set(x.category, (by.get(x.category) ?? 0) + 1)
  return [...by].map(([category, count]) => ({ category, count }))
}

export function mockInboxItems(category: string) {
  return MOCK_NOTICES.filter((x) => x.category === category).map((x) => ({
    kind: x.kind, notice: { screen: x.screen, view: x.view, text: '' }, ago_seconds: x.ago, link: { command: '', args: null },
  }))
}
