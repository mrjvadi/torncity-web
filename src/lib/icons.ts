// The white game-icons.net glyphs in public/icons (CC BY 3.0 — credited in
// About / the settings screen). This is the exact file list, used to pick a
// safe fallback when the server names an icon key we don't have a 1:1 file
// for (`action:deposit`, `nav:profile`, `place:harbour`...).

export const ICON_NAMES = new Set([
  'activity', 'a_foxkid', 'a_rabbit', 'a_raccoon', 'arm', 'a_wolf', 'bank', 'bed', 'book', 'box',
  'bread', 'bus', 'cart', 'chart', 'checklist', 'check', 'city', 'clock', 'close', 'coins', 'crime',
  'crowncoin', 'diamond', 'eagle', 'energy', 'eye', 'factory', 'f_baby', 'f_bottle', 'f_broken',
  'f_diamond', 'f_dove', 'f_gavel', 'f_grad', 'f_hands', 'f_heartplus', 'f_hearts', 'f_house',
  'flagobj', 'f_letter', 'f_lovers', 'fox', 'f_party', 'f_ringbox', 'f_rings', 'f_rose', 'f_scales',
  'f_school', 'f_slide', 'f_tree', 'gavel', 'gears', 'gift', 'handcuffs', 'health', 'heat', 'helmet',
  'histogram', 'hospital', 'house', 'inbox', 'keys', 'lion', 'market', 'm_backpack', 'm_bench',
  'm_brief', 'm_chat', 'm_check', 'm_coffee', 'medal', 'menu', 'm_hand', 'missile', 'missions',
  'm_lock', 'm_meal', 'money', 'mood', 'moon', 'm_popcorn', 'm_search', 'm_stop', 'nerve', 'ore',
  'person', 'phone', 'pill', 'pistol', 'plane', 'plus', 'podium', 'quill', 'radar', 'rank', 'ribbon',
  'rifle', 'ring', 'shield', 'sleepy', 'society', 'soda', 'stetho', 'stopwatch', 'study', 'sun',
  'swords', 'tag', 'tank', 'tent', 'toaster', 'trade', 'train', 'trophy', 'u_airforce', 'u_ammo',
  'u_antiship', 'u_artillery', 'u_ballistic', 'u_bomber', 'u_bomb', 'u_carrier', 'u_cruise',
  'u_drone', 'u_fighter', 'u_fort', 'u_frigate', 'u_helmet', 'u_ifv', 'u_radar', 'u_sam', 'u_stealth',
  'u_sub', 'u_tank', 'u_transport', 'u_troops', 'vote', 'walk', 'work', 'world', 'x_biceps', 'x_brush',
  'x_butterfly', 'x_cal', 'x_cards', 'x_car', 'x_cash', 'x_celebrate', 'x_chest', 'x_cross', 'x_crown',
  'x_dice', 'x_dodge', 'x_field', 'x_fist', 'x_flag', 'x_flame', 'x_flower', 'x_gem', 'x_goldbar',
  'x_hosp', 'x_knife', 'x_laurel', 'x_lchest', 'x_lift', 'x_map', 'x_mega', 'x_muscle', 'x_news',
  'x_ninja', 'x_phone', 'x_podium', 'x_present', 'x_punch', 'x_quill', 'x_scroll', 'x_seal', 'x_send',
  'x_share', 'x_shield', 'x_skull', 'x_slot', 'x_sparkles', 'x_speed', 'x_sprint', 'x_sprout',
  'x_star', 'x_stopwatch', 'x_ticket', 'x_vest', 'x_wanted',
])

// Every `action:<key>` the server hands out (configs/actions.yml, kept in
// sync by hand from that read-only server repo) mapped to a local glyph
// when the bare name after the ':' is not itself a file. Grouped roughly
// the way actions.yml is, so a new server key is easy to place.
const KEY_MAP: Record<string, string> = {
  'action:default': 'box',

  // money (bank/company/save/loan all reuse these)
  'action:deposit': 'money',
  'action:withdraw': 'cart',
  'action:pay': 'coins',
  'action:loan': 'bank',
  'action:offer': 'gift',
  'action:take': 'cart',
  'action:repay': 'coins',
  'action:rent': 'coins',
  'action:price': 'x_cash',
  'action:dividend': 'coins',
  'action:allocate': 'chart',

  // people / player / social
  'action:player': 'person',
  'action:avatar': 'person',
  'action:social': 'person',
  'action:npc': 'person',
  'action:accept': 'check',
  'action:mark_read': 'check',
  'action:language': 'world',
  'action:invite': 'f_letter',
  'action:join': 'f_hands',
  'action:recruit': 'f_hands',
  'action:link': 'x_share',
  'action:device': 'phone',

  // travel / map
  'action:travel': 'plane',
  'action:map': 'x_map',

  // government / law / elections
  'action:gov': 'gavel',
  'action:lever': 'x_lift',
  'action:set': 'gears',
  'action:appoint': 'ribbon',
  'action:seat': 'medal',
  'action:dismiss': 'x_cross',
  'action:law': 'f_scales',
  'action:election': 'podium',
  'action:stand': 'flagobj',
  'action:city': 'city',

  // job / education
  'action:job': 'm_brief',
  'action:apply': 'quill',
  'action:promote': 'medal',
  'action:quit': 'walk',
  'action:education': 'study',
  'action:enroll': 'f_grad',

  // crime
  'action:crime': 'crime',
  'action:commit': 'pistol',
  'action:bail': 'keys',
  'action:report': 'x_wanted',

  // inventory / shop / market / auction
  'action:inventory': 'box',
  'action:use': 'checklist',
  'action:give': 'gift',
  'action:drop': 'x_cross',
  'action:shop': 'trade',
  'action:buy': 'cart',
  'action:sell': 'tag',
  'action:market': 'market',
  'action:cancel': 'close',
  'action:auction': 'trade',

  // company
  'action:company': 'factory',
  'action:register': 'checklist',
  'action:manage': 'checklist',
  'action:close': 'close',
  'action:post': 'checklist',
  'action:staff': 'f_hands',
  'action:decide': 'checklist',
  'action:fire': 'x_cross',
  'action:supply': 'trade',
  'action:research': 'book',
  'action:license': 'tag',
  'action:studio': 'x_mega',
  'action:design': 'quill',
  'action:revise': 'book',
  'action:retire': 'x_cross',
  'action:improve': 'chart',
  'action:upgrade_kit': 'gears',
  'action:retrofit': 'arm',
  'action:produce': 'gears',
  'action:reverse': 'gears',
  'action:goods': 'box',
  'action:stockup': 'x_chest',
  'action:auto': 'gears',

  // military / diplomacy / war
  'action:military': 'helmet',
  'action:station': 'tent',
  'action:procure': 'trade',
  'action:diplomacy': 'flagobj',
  'action:impose': 'handcuffs',
  'action:lift': 'x_lift',
  'action:propose': 'f_letter',
  'action:end': 'close',
  'action:war': 'swords',
  'action:declare': 'flagobj',
  'action:target': 'radar',
  'action:launch': 'missile',

  // health / faction / missions
  'action:health': 'health',
  'action:treat': 'stetho',
  'action:faction': 'shield',
  'action:kick': 'x_cross',
  'action:mission': 'missions',

  // property
  'action:property': 'house',
  'action:let': 'keys',

  // life / achievements
  'action:life': 'mood',
  'action:card': 'tag',
  'action:bio': 'book',
  'action:sleep': 'bed',
  'action:top': 'trophy',
  'action:achievement': 'trophy',

  // stocks / savings / insurance / gold
  'action:save': 'bank',
  'action:insure': 'shield',
  'action:stock': 'chart',
  'action:ipo': 'x_star',
  'action:gold': 'crowncoin',

  // skills / inbox
  'action:skills': 'study',
  'action:inbox': 'inbox',

  'nav:profile': 'person',
  'nav:city': 'city',
  'nav:market': 'market',
  'nav:society': 'society',
  'nav:activity': 'activity',
}

const FALLBACK = 'box'

/** Resolve a server/UI icon key ("action:deposit", "city", "place:harbour") to a public/icons file name. */
export function resolveIconName(key: string | undefined | null): string {
  if (!key) return FALLBACK
  if (ICON_NAMES.has(key)) return key
  if (KEY_MAP[key]) return KEY_MAP[key]
  const bare = key.includes(':') ? key.split(':').pop()! : key
  if (ICON_NAMES.has(bare)) return bare
  return FALLBACK
}

export function iconUrl(name: string): string {
  return `${import.meta.env.BASE_URL}icons/${resolveIconName(name)}.svg`
}
