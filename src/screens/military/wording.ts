// The web's own words for the military, war and defence contract (docs/adr/0039-presentation-split.md):
// the server sends ids, codes and numbers, never a sentence. An action is worded by its `id`, a notice
// or a refusal by its code; content names (branches, classes, grounds, operations, goods) come from the
// catalogue tables, never from here.

import type { Action } from '../../api/types'
import type { Good, Named, Notice } from '../../api/views.gen'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { registerLabeler } from '../village/wording'
import { durationText } from '../village/common'
import type { ContentNames } from '../../village/useVillage'

const key = (k: string) => k as Key

/** The ids this area words (the label of each is `mil.act.<id>`). */
const IDS = new Set([
  'military.forces', 'military.procure', 'military.sanctions', 'military.treaties', 'military.war', 'military.licences',
  'military.branch', 'military.station', 'military.station_city', 'military.station_qty', 'military.station_custom', 'military.station_confirm',
  'military.buy_open', 'military.buy_qty', 'military.buy_custom', 'military.buy_confirm', 'military.retrofit_confirm',
  'war.accept', 'war.decline', 'war.ceasefire', 'war.peace', 'war.resume', 'war.join', 'war.room', 'war.declare',
  'war.declare_target', 'war.declare_ground', 'war.declare_confirm', 'war.join_confirm', 'war.resume_confirm', 'war.propose_confirm',
  'war.target', 'war.launch_open', 'war.launch_objective', 'war.launch_qty', 'war.launch_confirm', 'war.hospital',
  'defence.apply', 'defence.lab', 'defence.registry', 'defence.company', 'defence.approve', 'defence.reject', 'defence.revoke', 'defence.revoke_confirm',
])

/** Which catalogue tables an action's `subject` lives in, by the action's id. */
function subjectTables(id: string): string[] {
  switch (id) {
    case 'military.branch': return ['branch']
    case 'military.station': case 'military.buy_open': return ['item', 'component']
    case 'military.station_city': case 'war.target': return ['city']
    case 'war.declare_target': return ['jurisdiction', 'city']
    case 'war.declare_ground': return ['war_ground']
    case 'war.launch_open': return ['war_operation']
    case 'war.launch_objective': return ['war_objective']
    case 'war.propose_confirm': return ['war_proposal']
    default: return []
  }
}

function qtyOf(a: Action): number | undefined {
  const raw = a.args?.qty
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

registerLabeler((a, names) => {
  const id = a.id ?? ''
  if (!IDS.has(id)) return undefined
  const k = `mil.act.${id}`
  if (!hasKey(k)) return undefined
  const subject = a.subject ?? ''
  const tables = subjectTables(id)
  const name = subject && names && tables.length ? names.name(tables, subject) : subject
  const qty = qtyOf(a)
  return t(key(k), { name, qty: qty !== undefined ? formatNumber(qty) : '' })
})

/** Which of this area's actions change the world without a confirm step of their own. */
const WRITE_IDS = new Set(['war.accept', 'war.decline', 'defence.approve', 'defence.reject', 'defence.apply'])

export const isMilitaryWrite = (a: Action): boolean => WRITE_IDS.has(a.id ?? '')

/** The word of a service not offered here: its code is the view's `unavailable.service`. */
export function militaryServiceName(code: string): string | undefined {
  const k = `mil.service.${code}`
  return hasKey(k) ? t(key(k)) : undefined
}

/** A percentage of basis points, one left-to-right run: 8200 is 82%. */
export const bpsPct = (bps: number): string => `⁦${(Math.round(bps) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%⁩`

/** The wording of a coded notice (`Notice{Code, ...}`) a military screen carries, or '' for none. */
export function noticeWords(n: Notice | null | undefined, names: ContentNames, goodText: (g: Good) => string): string {
  if (!n || !n.code) return ''
  const k = `mil.notice.${n.code}`
  if (!hasKey(k)) return ''
  const target = n.target && (n.target.code || n.target.name)
    ? n.target.kind === 'city' ? names.name(['city'], n.target.code, n.target.name) : names.name(['jurisdiction', 'city'], n.target.code, n.target.name)
    : ''
  const kind = n.kind ? names.name(['war_operation', 'war_proposal'], n.kind, n.kind) : ''
  return t(key(k), {
    count: formatNumber(n.count), good: n.good && n.good.item.code ? goodText(n.good) : '', city: n.city_code ? names.name(['city'], n.city_code, n.city) : '',
    time: durationText(n.time_seconds), total: money(n.total), kind, target,
  })
}

/** A name from a catalogue table, falling back to the authored name and then the code. */
export function named(names: ContentNames, tables: string[], n: Named | null | undefined): string {
  return n ? names.name(tables, n.code, n.name) : ''
}
