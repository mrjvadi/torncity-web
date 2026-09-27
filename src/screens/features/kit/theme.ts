// Shared palette/icon language for the feature screens, matching the
// prototype's colour tints and glyph choices (torncity-client/proto).

import type { IconPalette } from '../../../ui/Icon'

export type Tint =
  | 'ruby' | 'rose' | 'gold' | 'saffron' | 'sapphire' | 'emerald' | 'violet' | 'steel' | 'teal'

/** Tint -> the icon palette that reads well against it. */
export const TINT_ICON_PALETTE: Record<Tint, IconPalette> = {
  ruby: 'ruby', rose: 'ruby', gold: 'gold', saffron: 'amber', sapphire: 'sapphire',
  emerald: 'emerald', violet: 'violet', steel: 'steel', teal: 'teal',
}

/** A server action icon key (configs/actions.yml) the shared Icon resolver
 * has no 1:1 file for, mapped to a real glyph in public/icons. Only the
 * military/war keys this area renders; everything else still falls back to
 * Icon's own resolver. */
export const ACTION_ICON_OVERRIDES: Record<string, string> = {
  'action:military': 'shield',
  'action:war': 'swords',
  'action:station': 'flagobj',
  'action:procure': 'cart',
  'action:buy': 'coins',
  'action:upgrade_kit': 'gears',
  'action:retrofit': 'gears',
  'action:license': 'quill',
  'action:declare': 'x_flag',
  'action:join': 'handcuffs',
  'action:propose': 'f_letter',
  'action:target': 'radar',
  'action:launch': 'missile',
  'action:end': 'x_flag',
}

export function resolveActionIcon(icon: string | undefined): string | undefined {
  if (!icon) return icon
  return ACTION_ICON_OVERRIDES[icon] ?? icon
}

/** One preview/native screen's hero: title fallback, icon and tint — the
 * ribbon colour the prototype opens each screen with. */
export interface FeatureMeta {
  title: string
  sub?: string
  icon: string
  tint: Tint
}

export const FEATURE_META: Record<string, FeatureMeta> = {
  // military / war (real, native)
  'military.ministry': { title: 'وزارت دفاع', icon: 'shield', tint: 'steel' },
  'military.forces': { title: 'نیروهای مسلح', icon: 'swords', tint: 'steel' },
  'military.branch': { title: 'یگان‌ها', icon: 'tank', tint: 'steel' },
  'military.station': { title: 'استقرار', icon: 'flagobj', tint: 'sapphire' },
  'military.procure': { title: 'تدارکات', icon: 'cart', tint: 'saffron' },
  'military.buy': { title: 'خرید تسلیحات', icon: 'coins', tint: 'gold' },
  'military.licences': { title: 'مجوزهای دفاعی', icon: 'quill', tint: 'steel' },
  'military.licence': { title: 'مجوز دفاعی', icon: 'quill', tint: 'steel' },
  'war.board': { title: 'جنگ', icon: 'swords', tint: 'ruby' },
  'war.declare': { title: 'اعلان جنگ', icon: 'x_flag', tint: 'ruby' },
  'war.join': { title: 'پیوستن به جنگ', icon: 'handcuffs', tint: 'ruby' },
  'war.propose': { title: 'پیشنهاد صلح', icon: 'f_letter', tint: 'ruby' },
  'war.answer': { title: 'پاسخ به پیشنهاد', icon: 'f_letter', tint: 'ruby' },
  'war.resume': { title: 'از سرگیری جنگ', icon: 'swords', tint: 'ruby' },
  'war.room': { title: 'اتاق جنگ', icon: 'radar', tint: 'ruby' },
  'war.target': { title: 'هدف', icon: 'radar', tint: 'ruby' },
  'war.launch': { title: 'شروع عملیات', icon: 'missile', tint: 'ruby' },

  // previews (local, missing on the server)
  family: { title: 'خانواده', icon: 'f_rings', tint: 'rose' },
  proposal: { title: 'خواستگاری', icon: 'f_heartplus', tint: 'rose' },
  child: { title: 'فرزند', icon: 'f_baby', tint: 'saffron' },
  divorce: { title: 'طلاق', icon: 'f_broken', tint: 'ruby' },
  wedding: { title: 'عروسی', icon: 'f_rings', tint: 'rose' },
  meet: { title: 'آشنایی', icon: 'f_heartplus', tint: 'rose' },
  relationship: { title: 'رابطه', icon: 'f_hearts', tint: 'rose' },
  date: { title: 'قرار', icon: 'm_meal', tint: 'rose' },
  chats: { title: 'گفتگوها', icon: 'm_chat', tint: 'sapphire' },
  chat: { title: 'گفتگو', icon: 'm_chat', tint: 'sapphire' },
  tutorial: { title: 'راهنما', icon: 'fox', tint: 'gold' },
  daily: { title: 'جایزه‌ی روزانه', icon: 'x_flame', tint: 'saffron' },
  gym: { title: 'باشگاه', icon: 'x_lift', tint: 'ruby' },
  attack: { title: 'حمله', icon: 'swords', tint: 'ruby' },
  fight: { title: 'نتیجه‌ی نبرد', icon: 'x_laurel', tint: 'ruby' },
  bounty: { title: 'تحت تعقیب', icon: 'x_wanted', tint: 'saffron' },
  news: { title: 'روزنامه', icon: 'x_news', tint: 'steel' },
  invite: { title: 'دعوت دوستان', icon: 'x_present', tint: 'sapphire' },
  casino: { title: 'کازینو', icon: 'x_cards', tint: 'violet' },
  slots: { title: 'اسلات', icon: 'x_slot', tint: 'violet' },
  race: { title: 'مسابقه', icon: 'x_car', tint: 'ruby' },
  plot: { title: 'زمین‌ها', icon: 'x_field', tint: 'emerald' },
  will: { title: 'وصیت‌نامه', icon: 'x_scroll', tint: 'steel' },
  cosmetics: { title: 'ظاهر', icon: 'x_crown', tint: 'violet' },
  event: { title: 'جشن نوروز', icon: 'x_flower', tint: 'emerald' },
  levelup: { title: 'ارتقای سطح', icon: 'x_star', tint: 'gold' },
}

export const RELATIONSHIP_LADDER = ['غریبه', 'آشنا', 'دوست', 'صمیمی', 'دلداده', 'نامزد', 'همسر']
