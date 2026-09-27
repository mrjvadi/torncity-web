// Hub tile definitions: real commands from configs/commands.yml where the
// server serves the screen, openLocal previews (registered by the features
// agent) for what doesn't exist server-side yet.

import type { IconPalette } from '../../../ui/Icon'

export interface HubTile {
  key: string
  icon: string
  palette?: IconPalette
  title: string
  sub?: string
  command?: string
  local?: string
}

export const ACTIVITY_TILES: HubTile[] = [
  { key: 'crime', icon: 'crime', palette: 'ruby', title: 'جرم', command: 'crime.hub' },
  { key: 'job', icon: 'work', palette: 'emerald', title: 'کار', command: 'job.status' },
  { key: 'education', icon: 'study', palette: 'violet', title: 'تحصیل', command: 'education.list' },
  { key: 'hospital', icon: 'hospital', palette: 'ruby', title: 'بیمارستان', command: 'health.hospital' },
  { key: 'missions', icon: 'missions', palette: 'violet', title: 'مأموریت‌ها', command: 'mission.board' },
  { key: 'leaderboard', icon: 'podium', palette: 'gold', title: 'رتبه‌ها', command: 'life.top' },
  { key: 'gym', icon: 'x_muscle', palette: 'amber', title: 'باشگاه', local: 'gym' },
  { key: 'daily', icon: 'gift', palette: 'ruby', title: 'جایزه‌ی روز', local: 'daily' },
]

export const ECONOMY_TILES: HubTile[] = [
  { key: 'inventory', icon: 'm_backpack', palette: 'gold', title: 'کوله‌پشتی', command: 'inventory.show' },
  { key: 'market', icon: 'market', palette: 'emerald', title: 'بازار', command: 'market.list' },
  { key: 'bank', icon: 'bank', palette: 'sapphire', title: 'بانک', command: 'bank.show' },
  { key: 'companies', icon: 'factory', palette: 'amber', title: 'شرکت‌های من', command: 'company.mine' },
  { key: 'property', icon: 'house', palette: 'emerald', title: 'ملک', command: 'property.mine' },
  { key: 'stocks', icon: 'chart', palette: 'emerald', title: 'بورس', command: 'stock.list' },
]

export const SOCIETY_TILES: HubTile[] = [
  { key: 'inbox', icon: 'inbox', palette: 'sapphire', title: 'پیام‌ها', command: 'inbox.show' },
  { key: 'faction', icon: 'lion', palette: 'gold', title: 'جناح', command: 'faction.mine' },
  { key: 'friends', icon: 'society', palette: 'emerald', title: 'دوستان', command: 'social.friend.list' },
  { key: 'elections', icon: 'vote', palette: 'violet', title: 'انتخابات', command: 'election.list' },
  { key: 'government', icon: 'gavel', palette: 'gold', title: 'دولت شهر', command: 'gov.city' },
  { key: 'war', icon: 'swords', palette: 'ruby', title: 'ارتش و جنگ', local: 'war' },
  { key: 'family', icon: 'f_hearts', palette: 'ruby', title: 'خانواده', local: 'family' },
]
