// The web's own words for the companies, production and recruitment contract
// (docs/adr/0039-presentation-split.md): the server sends ids, codes and numbers, never a sentence. An
// action is worded by its `id`, a refusal by its kind, a state by its code; content names (company types,
// components, technologies, suppliers, slots, attributes, careers, specialists) come from the catalogue.

import type { Action } from '../../api/types'
import type { Good, JobRef, Named } from '../../api/views.gen'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { registerLabeler } from '../village/wording'
import type { ContentNames } from '../../village/useVillage'

const key = (k: string) => k as Key

/** The top of a company's public rating (a domain constant the view does not carry). */
export const MAX_STARS = 5

/** The catalogue tables each kind of name lives in. */
export const TABLES: Record<'type' | 'component' | 'item' | 'tech' | 'skill' | 'career' | 'city' | 'place' | 'slot' | 'attribute' | 'supplier' | 'course' | 'role', string[]> = {
  type: ['company_type'],
  component: ['component', 'item'],
  item: ['item', 'component'],
  tech: ['technology'],
  skill: ['skill'],
  career: ['career'],
  city: ['city'],
  place: ['place'],
  slot: ['design_slot'],
  attribute: ['attribute'],
  supplier: ['supplier'],
  course: ['course'],
  role: ['building_role'],
}

/** Every table a subject code may be named from, in the order they are tried. */
const SUBJECT_TABLES = ['component', 'item', 'technology', 'skill', 'career', 'company_type', 'city', 'attribute', 'design_slot', 'supplier', 'course', 'place']

/** A number the server sent as a string argument. */
function num(a: Action, name: string): number | undefined {
  const raw = a.args?.[name]
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

const OWN_PREFIX = ['company.', 'production.', 'recruit.']
const OWN_IDS = new Set(['job.openings', 'job.my_job', 'job.work', 'health.desk', 'military.procure'])

/** Whether an action id belongs to this area's wording. */
export function isOwn(id: string): boolean {
  return OWN_IDS.has(id) || OWN_PREFIX.some((p) => id.startsWith(p))
}

function params(a: Action, names?: ContentNames): Record<string, string | number> {
  const subject = a.subject ?? ''
  const name = subject && names ? names.name(SUBJECT_TABLES, subject) : subject
  const qty = num(a, 'qty')
  const price = num(a, 'price')
  const positions = num(a, 'positions')
  const level = num(a, 'level')
  return {
    name,
    qty: qty !== undefined ? formatNumber(qty) : '',
    price: price !== undefined ? money(price) : '',
    positions: positions !== undefined ? formatNumber(positions) : '',
    level: level !== undefined ? formatNumber(level) : '',
  }
}

registerLabeler((a, names) => {
  const id = a.id ?? ''
  if (!isOwn(id)) return undefined
  const k = `co.act.${id}`
  return hasKey(k) ? t(key(k), params(a, names)) : undefined
})

/** The actions of this area that change the world. The host runs each once, with an idempotency key, and
 * shows the answer (the next screen, or the refusal). A read only opens a screen. */
const WRITE_IDS = new Set([
  'company.deposit_cash', 'company.deposit_card', 'company.withdraw', 'company.cheaper', 'company.dearer', 'company.auto_on', 'company.auto_off',
  'company.manager', 'company.post', 'company.slot_up', 'company.slot_down', 'company.slot_close', 'company.accept', 'company.reject', 'company.apply',
  'company.found_cash', 'company.found_card',
  'production.supply', 'production.supply_other', 'production.research', 'production.mode_private', 'production.mode_license',
  'production.new_design', 'production.candidate', 'production.slot_clear', 'production.slot_qty', 'production.name', 'production.finalize',
  'production.revise', 'production.stock_up', 'production.step_supply', 'production.unlist', 'production.price', 'production.price_reference',
  'recruit.new', 'recruit.hire', 'recruit.reject', 'recruit.renew', 'recruit.raise', 'recruit.gap',
  'recruit.set_skill', 'recruit.set_city', 'recruit.level_down', 'recruit.level_up', 'recruit.fewer', 'recruit.more', 'recruit.auto_on', 'recruit.auto_off',
])

/** Writes whose id starts with one of these (the several ways to set one field of a campaign draft). */
const WRITE_PREFIX = ['recruit.scope_', 'recruit.preset_', 'recruit.type_', 'production.mode_']

export function isCompanyWrite(a: Action): boolean {
  const id = a.id ?? ''
  // a purchase or a sale is a write once the way to pay or the price is chosen; before that it only opens its screen
  if (a.command === 'company.buy') return !!a.args?.method
  if (a.command === 'company.sell') return !!a.args?.price
  if (!isOwn(id)) return false
  if (a.input) return true
  return WRITE_IDS.has(id) || WRITE_PREFIX.some((p) => id.startsWith(p))
}

// -- states ---------------------------------------------------------------------------------------

/** A coded word of this area ("co.<group>.<code>"), or the neutral word when this client has none. */
export function coded(group: string, code: string, fallback = 'co.unknown'): string {
  const k = `co.${group}.${code}`
  return hasKey(k) ? t(key(k)) : t(key(fallback))
}

/** The name of a good: a component or an item, with the design it was made to when it has one. */
export function goodName(names: ContentNames, g: Good | null | undefined): string {
  if (!g) return ''
  const base = names.name(g.component ? TABLES.component : TABLES.item, g.item.code, g.item.name)
  return g.design ? t('co.good_designed', { design: g.design, item: base }) : base
}

/** A position's title from the catalogue ("<career>.<rank>"). */
export function jobTitle(names: ContentNames, j: JobRef | null | undefined): string {
  if (!j) return ''
  return names.name(['career_tier'], `${j.career_code}.${j.rank}`, j.title || j.career_name)
}

/** A career's name. */
export function careerName(names: ContentNames, j: JobRef): string {
  return names.name(TABLES.career, j.career_code, j.career_name)
}

export function namedOf(names: ContentNames, tables: string[], n: Named | null | undefined): string {
  if (!n) return ''
  return names.name([...tables], n.code, n.name)
}

/** A specialist's name: the view carries a seed, the catalogue the two lists a name is drawn from. */
export function specialistName(names: ContentNames, seed: number): string {
  const list = (part: string) => names.name(['specialist_name'], part, '').split('|').map((s) => s.trim()).filter(Boolean)
  const first = list('first')
  const last = list('last')
  if (!first.length) return t('co.someone')
  const f = first[Math.abs(seed) % first.length]
  const l = last.length ? last[Math.floor(Math.abs(seed) / first.length) % last.length] : ''
  return l ? `${f} ${l}` : f
}

/** "{skill} level {n}" for a skill code. */
export function skillLevel(names: ContentNames, skill: string, level: number): string {
  const name = names.name(TABLES.skill, skill, skill)
  return level > 0 ? t('co.skill_level', { skill: name, level: formatNumber(level) }) : name
}

/** A length of a unit a design slot is measured in ("g", "ml"): worded when there is a word for it. */
export function unitQty(unit: string, qty: number): string {
  const k = `co.unit.${unit}`
  return unit && hasKey(k) ? t(key(k), { qty: formatNumber(qty) }) : formatNumber(qty)
}
