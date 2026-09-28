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

// Action icons used to get a second, separate map here (out of sync with
// src/lib/icons.ts — e.g. "join" drawn as handcuffs, "buy" as coins here but
// cart on the native screens). That one map is now the single source of
// truth for every `action:*` key, so both areas render the same glyph for
// the same action; the shared Icon component already resolves through it.

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
