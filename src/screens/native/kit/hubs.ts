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
  local?: string
  /** The data tag that says the tile exists for the player (availability.yml): the tile is listed only once it does. */
  needs?: { kind: string; code: string }
}

/** How each activity the server lists (`activities.hub`, ADR 0038 3.3) looks: icon and name. The server decides which
 * entries a player has; this only dresses them. Gym and daily reward are not here: no server system exists for them. */
export const ACTIVITY_ENTRIES: Record<string, { icon: string; palette: IconPalette; title: Key }> = {
  work: { icon: 'work', palette: 'emerald', title: 'hub.job' },
  learn: { icon: 'study', palette: 'violet', title: 'hub.education' },
  health: { icon: 'hospital', palette: 'ruby', title: 'hub.health' },
  crime: { icon: 'crime', palette: 'ruby', title: 'hub.crime' },
  missions: { icon: 'missions', palette: 'violet', title: 'hub.missions' },
  rankings: { icon: 'podium', palette: 'gold', title: 'hub.leaderboard' },
}

export const ECONOMY_TILES: HubTile[] = [
  { key: 'inventory', icon: 'm_backpack', palette: 'gold', title: 'hub.inventory', command: 'inventory.show' },
  { key: 'market', icon: 'market', palette: 'emerald', title: 'hub.market', command: 'market.list' },
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
  { key: 'village', icon: 'house', palette: 'emerald', title: 'hub.village', local: 'village_home' },
]
