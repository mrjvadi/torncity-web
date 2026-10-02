// Hub tile definitions: real commands from configs/commands.yml where the
// server serves the screen, openLocal previews (registered by the features
// agent) for what doesn't exist server-side yet.

import type { IconPalette } from '../../../ui/Icon'
import type { Key } from '../../../i18n'

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

/** How each entry of the Economy hub the server lists (`economy.hub`) looks: icon and name. The server decides which
 * entries a player has, and which command each opens; this only dresses them. */
export const ECONOMY_ENTRIES: Record<string, { icon: string; palette: IconPalette; title: Key }> = {
  inventory: { icon: 'm_backpack', palette: 'gold', title: 'hub.inventory' },
  market: { icon: 'market', palette: 'emerald', title: 'hub.market' },
  bank: { icon: 'bank', palette: 'sapphire', title: 'hub.bank' },
  companies: { icon: 'factory', palette: 'amber', title: 'hub.companies' },
  property: { icon: 'house', palette: 'emerald', title: 'hub.property' },
  stocks: { icon: 'chart', palette: 'emerald', title: 'hub.stocks' },
}

/** The same for the Society hub (`society.hub`). */
export const SOCIETY_ENTRIES: Record<string, { icon: string; palette: IconPalette; title: Key }> = {
  inbox: { icon: 'inbox', palette: 'sapphire', title: 'hub.inbox' },
  faction: { icon: 'lion', palette: 'gold', title: 'hub.faction' },
  friends: { icon: 'society', palette: 'emerald', title: 'hub.friends' },
  elections: { icon: 'vote', palette: 'violet', title: 'hub.elections' },
  government: { icon: 'gavel', palette: 'gold', title: 'hub.government' },
  war: { icon: 'swords', palette: 'ruby', title: 'hub.war' },
}
