// Support's services: every one is a real building of the city, and a tap on
// it opens the screen of its command. The list follows the server content
// (configs/content/places.yml: bank, market, university, police, hospital,
// city hall, terminals...) and the commands the game serves for them
// (configs/commands.yml). `outer` services stand on the outskirts.

import type { Category } from './cityKit'
import type { Key } from '../i18n'
import type { IconPalette } from '../ui/Icon'

export type Emblem = 'cross' | 'coin' | 'siren' | 'flag' | 'book' | 'bus'

export interface SupportService {
  id: string
  /** the server's place code, for the plots the layout endpoint sends */
  place?: string
  icon: string
  tone: IconPalette
  /** the tint of the lot and the label border */
  color: string
  name: Key
  cats: Category[]
  /** a server command whose screen the tap opens, else a local screen */
  command?: string
  args?: Record<string, string>
  local?: string
  emblem?: Emblem
  /** outskirts rather than the centre */
  outer?: boolean
  /** a service that is a promise, not built yet */
  soon?: boolean
  /** labels are dropped in this order when the screen is crowded (high first) */
  weight: number
}

export const SERVICES: SupportService[] = [
  { id: 'reserve', icon: 'crowncoin', tone: 'gold', color: '#f2c255', name: 'sc.svc.reserve', cats: ['tower'], local: 'support_soon', args: { what: 'reserve' }, emblem: 'coin', soon: true, weight: 9 },
  { id: 'bank', place: 'business_district', icon: 'bank', tone: 'sapphire', color: '#5aa0f0', name: 'sc.svc.bank', cats: ['tower', 'office'], command: 'bank.show', emblem: 'coin', weight: 10 },
  { id: 'exchange', icon: 'chart', tone: 'emerald', color: '#4cc47e', name: 'sc.svc.exchange', cats: ['office', 'tower'], command: 'stock.list', weight: 6 },
  { id: 'auction', place: 'business_district', icon: 'gavel', tone: 'gold', color: '#f2c255', name: 'sc.svc.auction', cats: ['office'], command: 'auction.list', weight: 4 },
  { id: 'loan', icon: 'money', tone: 'sapphire', color: '#5aa0f0', name: 'sc.svc.loan', cats: ['office'], command: 'loan.hub', weight: 4 },
  { id: 'cityhall', place: 'city_hall', icon: 'flagobj', tone: 'gold', color: '#f2c255', name: 'sc.svc.cityhall', cats: ['office', 'apartment'], command: 'gov.city', emblem: 'flag', weight: 8 },
  { id: 'jobs', icon: 'work', tone: 'emerald', color: '#4cc47e', name: 'sc.svc.jobs', cats: ['office'], command: 'job.list', weight: 9 },
  { id: 'companies', icon: 'factory', tone: 'amber', color: '#e8a838', name: 'sc.svc.companies', cats: ['office', 'apartment'], command: 'company.list', weight: 6 },
  { id: 'market', place: 'bazaar', icon: 'market', tone: 'emerald', color: '#4cc47e', name: 'sc.svc.market', cats: ['factory', 'apartment'], command: 'market.list', weight: 10 },
  { id: 'shops', place: 'bazaar', icon: 'cart', tone: 'amber', color: '#e8a838', name: 'sc.svc.shops', cats: ['small', 'factory'], command: 'shop.list', weight: 7 },
  { id: 'university', place: 'university', icon: 'study', tone: 'violet', color: '#8e6cf0', name: 'sc.svc.university', cats: ['apartment', 'office'], command: 'education.list', emblem: 'book', weight: 9 },
  { id: 'training', place: 'university', icon: 'x_muscle', tone: 'violet', color: '#8e6cf0', name: 'sc.svc.training', cats: ['apartment', 'small'], command: 'skills.list', weight: 5 },
  { id: 'knowledge', icon: 'book', tone: 'teal', color: '#2bc4b2', name: 'sc.svc.knowledge', cats: ['small', 'apartment'], command: 'settlement.knowledge', emblem: 'book', weight: 7 },
  { id: 'hospital', place: 'hospital', icon: 'hospital', tone: 'ruby', color: '#e5484d', name: 'sc.svc.hospital', cats: ['apartment', 'office'], command: 'health.hospital', emblem: 'cross', weight: 10 },
  { id: 'police', place: 'police_station', icon: 'shield', tone: 'sapphire', color: '#5aa0f0', name: 'sc.svc.police', cats: ['apartment', 'office'], command: 'crime.hub', emblem: 'siren', weight: 8 },
  { id: 'jail', place: 'police_station', icon: 'handcuffs', tone: 'ruby', color: '#e5484d', name: 'sc.svc.jail', cats: ['factory', 'apartment'], command: 'crime.jail', outer: true, weight: 5 },
  { id: 'property', icon: 'house', tone: 'emerald', color: '#4cc47e', name: 'sc.svc.property', cats: ['apartment'], command: 'property.list', weight: 6 },
  { id: 'housing', place: 'residential_area', icon: 'f_house', tone: 'emerald', color: '#4cc47e', name: 'sc.svc.housing', cats: ['apartment'], command: 'property.mine', weight: 4 },
  { id: 'missions', icon: 'missions', tone: 'violet', color: '#8e6cf0', name: 'sc.svc.missions', cats: ['small', 'apartment'], command: 'mission.board', weight: 3 },
  { id: 'bus', place: 'bus_terminal', icon: 'bus', tone: 'teal', color: '#2bc4b2', name: 'sc.svc.bus', cats: ['factory', 'small'], local: 'support_travel', args: { mode: 'bus' }, emblem: 'bus', outer: true, weight: 8 },
  { id: 'train', place: 'train_station', icon: 'train', tone: 'teal', color: '#2bc4b2', name: 'sc.svc.train', cats: ['factory'], local: 'support_travel', args: { mode: 'train' }, outer: true, weight: 7 },
  { id: 'airport', place: 'airport', icon: 'plane', tone: 'teal', color: '#2bc4b2', name: 'sc.svc.airport', cats: ['factory'], local: 'support_travel', args: { mode: 'flight' }, outer: true, weight: 8 },
  { id: 'barracks', place: 'barracks', icon: 'helmet', tone: 'ruby', color: '#e5484d', name: 'sc.svc.barracks', cats: ['factory'], command: 'military.ministry', outer: true, weight: 2 },
]

export const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]))
