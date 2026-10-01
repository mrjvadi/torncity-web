// Hub tile definitions: real commands from configs/commands.yml where the
// server serves the screen, openLocal previews (registered by the features
// agent) for what doesn't exist server-side yet.

import type { IconPalette } from '../../../ui/Icon'
import type { Key } from '../../../i18n'

export interface HubTile {
  key: string
  icon: string
  palette?: IconPalette
  /** an i18n key (t(tile.title)) */
  title: Key
  sub?: Key
  command?: string
  /** A command per stage of the player's settlement, where the screen differs by stage (the village's
   * market stall is not the city's bazaar); the stage with no entry uses `command`. */
  byStage?: Partial<Record<string, string>>
  local?: string
  /** The data tag that says the tile exists for the player (availability.yml): the tile is listed only once it does. */
  needs?: { kind: string; code: string }
}

export const ACTIVITY_TILES: HubTile[] = [
  { key: 'crime', icon: 'crime', palette: 'ruby', title: 'hub.crime', command: 'crime.hub' },
  { key: 'job', icon: 'work', palette: 'emerald', title: 'hub.job', command: 'job.status' },
  { key: 'education', icon: 'study', palette: 'violet', title: 'hub.education', command: 'education.list' },
  { key: 'hospital', icon: 'hospital', palette: 'ruby', title: 'hub.hospital', command: 'health.hospital' },
  { key: 'missions', icon: 'missions', palette: 'violet', title: 'hub.missions', command: 'mission.board' },
  { key: 'leaderboard', icon: 'podium', palette: 'gold', title: 'hub.leaderboard', command: 'life.top' },
  { key: 'gym', icon: 'x_muscle', palette: 'amber', title: 'hub.gym', local: 'gym' },
  { key: 'daily', icon: 'gift', palette: 'ruby', title: 'hub.daily', local: 'daily' },
]

export const ECONOMY_TILES: HubTile[] = [
  { key: 'inventory', icon: 'm_backpack', palette: 'gold', title: 'hub.inventory', command: 'inventory.show' },
  // the market is the settlement's own store and stall in a village or a town («انبار و بازار»), and the city's bazaar in a city
  { key: 'market', icon: 'market', palette: 'emerald', title: 'hub.market', command: 'market.list', byStage: { village: 'settlement.materials', town: 'settlement.materials' } },
  { key: 'bank', icon: 'bank', palette: 'sapphire', title: 'hub.bank', command: 'bank.show' },
  { key: 'companies', icon: 'factory', palette: 'amber', title: 'hub.companies', command: 'company.mine' },
  { key: 'property', icon: 'house', palette: 'emerald', title: 'hub.property', command: 'property.mine' },
  { key: 'stocks', icon: 'chart', palette: 'emerald', title: 'hub.stocks', command: 'stock.list' },
]

export const SOCIETY_TILES: HubTile[] = [
  { key: 'inbox', icon: 'inbox', palette: 'sapphire', title: 'hub.inbox', command: 'inbox.show' },
  { key: 'faction', icon: 'lion', palette: 'gold', title: 'hub.faction', command: 'faction.mine', needs: { kind: 'faction', code: 'faction' } },
  { key: 'friends', icon: 'society', palette: 'emerald', title: 'hub.friends', command: 'social.friend.list' },
  { key: 'elections', icon: 'vote', palette: 'violet', title: 'hub.elections', command: 'election.list' },
  { key: 'government', icon: 'gavel', palette: 'gold', title: 'hub.government', command: 'gov.city' },
  { key: 'war', icon: 'swords', palette: 'ruby', title: 'hub.war', local: 'war', needs: { kind: 'government_action', code: 'country.war' } },
]
