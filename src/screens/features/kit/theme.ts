// Shared palette/icon language for the feature screens, matching the
// prototype's colour tints and glyph choices (torncity-client/proto).

import type { IconPalette } from '../../../ui/Icon'
import { t } from '../../../i18n'

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
  'military.ministry': { title: t('f.theme.251'), icon: 'shield', tint: 'steel' },
  'military.forces': { title: t('f.theme.252'), icon: 'swords', tint: 'steel' },
  'military.branch': { title: t('f.theme.253'), icon: 'tank', tint: 'steel' },
  'military.station': { title: t('f.theme.254'), icon: 'flagobj', tint: 'sapphire' },
  'military.procure': { title: t('f.theme.255'), icon: 'cart', tint: 'saffron' },
  'military.buy': { title: t('f.theme.256'), icon: 'coins', tint: 'gold' },
  'military.licences': { title: t('f.theme.257'), icon: 'quill', tint: 'steel' },
  'military.licence': { title: t('f.theme.258'), icon: 'quill', tint: 'steel' },
  'war.board': { title: t('f.theme.259'), icon: 'swords', tint: 'ruby' },
  'war.declare': { title: t('f.theme.260'), icon: 'x_flag', tint: 'ruby' },
  'war.join': { title: t('f.theme.261'), icon: 'handcuffs', tint: 'ruby' },
  'war.propose': { title: t('f.theme.262'), icon: 'f_letter', tint: 'ruby' },
  'war.answer': { title: t('f.theme.263'), icon: 'f_letter', tint: 'ruby' },
  'war.resume': { title: t('f.theme.264'), icon: 'swords', tint: 'ruby' },
  'war.room': { title: t('f.theme.265'), icon: 'radar', tint: 'ruby' },
  'war.target': { title: t('f.theme.266'), icon: 'radar', tint: 'ruby' },
  'war.launch': { title: t('f.theme.267'), icon: 'missile', tint: 'ruby' },

  // previews (local, missing on the server)
  family: { title: t('f.family.179'), icon: 'f_rings', tint: 'rose' },
  proposal: { title: t('f.dating.150'), icon: 'f_heartplus', tint: 'rose' },
  child: { title: t('f.theme.268'), icon: 'f_baby', tint: 'saffron' },
  divorce: { title: t('f.family.190'), icon: 'f_broken', tint: 'ruby' },
  wedding: { title: t('f.theme.269'), icon: 'f_rings', tint: 'rose' },
  meet: { title: t('f.dating.137'), icon: 'f_heartplus', tint: 'rose' },
  relationship: { title: t('f.theme.270'), icon: 'f_hearts', tint: 'rose' },
  date: { title: t('f.dating.149'), icon: 'm_meal', tint: 'rose' },
  chats: { title: t('f.chats.46'), icon: 'm_chat', tint: 'sapphire' },
  chat: { title: t('f.theme.271'), icon: 'm_chat', tint: 'sapphire' },
  tutorial: { title: t('f.theme.272'), icon: 'fox', tint: 'gold' },
  daily: { title: t('f.theme.273'), icon: 'x_flame', tint: 'saffron' },
  gym: { title: t('f.theme.274'), icon: 'x_lift', tint: 'ruby' },
  attack: { title: t('f.combat.91'), icon: 'swords', tint: 'ruby' },
  fight: { title: t('f.theme.275'), icon: 'x_laurel', tint: 'ruby' },
  bounty: { title: t('f.combat.124'), icon: 'x_wanted', tint: 'saffron' },
  news: { title: t('f.theme.276'), icon: 'x_news', tint: 'steel' },
  invite: { title: t('f.theme.277'), icon: 'x_present', tint: 'sapphire' },
  casino: { title: t('f.theme.278'), icon: 'x_cards', tint: 'violet' },
  slots: { title: t('f.casino.7'), icon: 'x_slot', tint: 'violet' },
  race: { title: t('f.theme.279'), icon: 'x_car', tint: 'ruby' },
  plot: { title: t('f.theme.280'), icon: 'x_field', tint: 'emerald' },
  will: { title: t('f.theme.281'), icon: 'x_scroll', tint: 'steel' },
  cosmetics: { title: t('f.theme.282'), icon: 'x_crown', tint: 'violet' },
  event: { title: t('f.theme.283'), icon: 'x_flower', tint: 'emerald' },
  levelup: { title: t('f.theme.284'), icon: 'x_star', tint: 'gold' },
}

export const RELATIONSHIP_LADDER = [t('f.theme.285'), t('f.theme.286'), t('f.theme.287'), t('f.chats.58'), t('f.theme.288'), t('f.theme.289'), t('f.theme.290')]
