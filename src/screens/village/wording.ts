// The web's own words for the village contract (docs/adr/0039-presentation-split.md):
// the server sends ids, codes and data, never a sentence. An action is worded by its
// `id` (or its command when it has none), a building by its kind, role and code, a
// refusal by its code. Content names come from the catalogue, never from here.

import type { Action, BuildingPanelView } from '../../api/types'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import type { ContentNames } from '../../village/useVillage'

const NUMERIC_ARGS = ['amount', 'n', 'qty', 'lot_price', 'permit_fee', 'tax_bps', 'percent', 'value']
const MONEY_IDS = new Set(['donate.amount', 'terms.lot_price', 'terms.permit_fee'])

/** Which catalogue tables an action's `subject` code lives in, by the action's id. */
function subjectTables(id: string): string[] {
  if (id.startsWith('support.')) return ['city']
  if (id === 'needs.buy' || id === 'materials.buy') return ['component', 'item']
  if (id === 'needs.knowledge') return ['knowledge']
  return ['settlement_building']
}

/** The numeric argument an action carries, worded for its label ("۲۵۰ ساپ", "۲٪", "۴"). */
function amountOf(a: Action): string {
  const args = a.args ?? {}
  for (const k of NUMERIC_ARGS) {
    const raw = args[k]
    if (raw === undefined || raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    if (a.id === 'terms.tax_bps') return `${formatNumber(n / 100)}%`
    if (a.id === 'labor.wage') return `${formatNumber(n)}%`
    if (MONEY_IDS.has(a.id ?? '')) return money(n)
    return formatNumber(n)
  }
  return ''
}

/** Other screen areas word their own actions: a labeler answers for the ids it knows and gives up (undefined) for the rest. */
const LABELERS: ((a: Action, names?: ContentNames) => string | undefined)[] = []

export function registerLabeler(fn: (a: Action, names?: ContentNames) => string | undefined): void {
  LABELERS.push(fn)
}

/** The text of an action's button. Falls back to the command's own key, then to a neutral
 * word, so a screen never shows a raw id. */
export function actionLabel(a: Action, names?: ContentNames): string {
  for (const fn of LABELERS) {
    const s = fn(a, names)
    if (s !== undefined) return s
  }
  const id = a.id || ''
  const subject = a.subject ?? ''
  const name = subject && names ? names.name(subjectTables(id), subject) : subject
  const params: Record<string, string | number> = { name, n: amountOf(a), city: name }
  const keys = [...(id ? [`act.${id}`] : []), `cmd.${a.command ?? ''}`]
  for (const key of keys) if (hasKey(key)) return t(key as Key, params)
  if (id.startsWith('support.')) return t('act.support.any', { name })
  noteLabelGap(a)
  return t('act.fallback')
}

/** Action ids the web has no word for (a gap to close with a key in ui.src.txt): readable as `window.__labelGaps` in
 * dev and mock, so a generic «ادامه» on a button never goes unnoticed. */
const labelGaps = new Set<string>()
if (typeof window !== 'undefined') (window as unknown as { __labelGaps?: Set<string> }).__labelGaps = labelGaps
export function noteLabelGap(a: Action): void {
  labelGaps.add(a.id || a.command || '?')
}

/** The sentence under a building's name, from what it is: its kind, role and code. */
export function buildingBlurb(v: Pick<BuildingPanelView, 'kind' | 'role'> & { building: { code: string } }): string {
  const code = `bld.desc.code.${v.building.code}`
  if (hasKey(code)) return t(code as Key)
  if (v.kind === 'road' || v.kind === 'civic_hall') return t(`bld.desc.${v.kind}` as Key)
  const role = `bld.desc.role.${v.role ?? ''}`
  if (v.role && hasKey(role)) return t(role as Key)
  return t('bld.desc.generic')
}
