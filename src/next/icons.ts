// The data hooks and the server name their icons with the old flat set's words (tool, book, ballot...). The new UI
// draws every icon from the amber 3D set; this is the one table from those words to its files.

const MAP: Record<string, string> = {
  user: 'person', person: 'person', portrait: 'person', tool: 'work', work: 'work', house: 'house', bag: 'market', banner: 'society',
  people: 'society', group: 'society', heart: 'health', health: 'health', bolt: 'energy', energy: 'energy', nerve: 'nerve',
  coin: 'coins', coins: 'coins', gem: 'diamond', scroll: 'missions', book: 'study', school: 'study', hammer: 'factory',
  ballot: 'vote', vote: 'vote', bank: 'bank', chest: 'x_chest', trophy: 'trophy', crime: 'crime', chat: 'm_chat', gift: 'x_present',
  globe: 'world', lock: 'm_lock', check: 'm_check', warn: 'x_wanted', timer: 'stopwatch', flask: 'x_sparkles', cross: 'x_cross',
  info: 'eye', road: 'x_map', pick: 'x_muscle', crate: 'box', ingot: 'x_goldbar', food: 'm_meal', bread: 'bread', cloth: 'x_vest',
  wheat: 'x_sprout', wood: 'box', logs: 'box', plank: 'box', stone: 'ore', axe: 'x_knife', up: 'rank',
}

/** The amber 3D file for an icon word; a word the set already uses (market, gavel, m_backpack...) passes through. */
export function icon3d(name: string | undefined, fallback = 'eye'): string {
  if (!name) return fallback
  return MAP[name] ?? name
}
