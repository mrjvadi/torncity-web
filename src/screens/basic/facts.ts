// Structured facts for the result/confirm screens whose views are simple,
// straight from the server's `view` (client-api.md section 3.1). Screens not
// listed fall back to the facts read out of the text (text.ts).

import { t, type Key } from '../../i18n'
import { formatNumber, hms, money } from '../native/kit/format'
import type { Fact } from './text'

type Fmt = 'money' | 'num' | 'time' | 'text' | 'name'
type Spec = [path: string, label: Key, fmt: Fmt]
type Obj = Record<string, unknown>

const SPECS: Record<string, Spec[]> = {
  pay_confirm: [['payee_name', 'fact.to', 'text'], ['amount', 'fact.amount', 'money'], ['fee', 'fact.fee', 'money'], ['total', 'fact.total', 'money'], ['after', 'fact.after', 'money']],
  pay_sent: [['payee_name', 'fact.to', 'text'], ['amount', 'fact.amount', 'money'], ['fee', 'fact.fee', 'money']],
  payment_notice: [['payer_name', 'fact.from', 'text'], ['amount', 'fact.amount', 'money']],
  shift_worked: [['gross', 'fact.gross', 'money'], ['tax', 'fact.tax', 'money'], ['net', 'fact.net', 'money'], ['xp', 'fact.xp', 'num'], ['performance', 'fact.performance', 'num'], ['energy', 'fact.energy', 'num']],
  enrolled: [['course.name', 'fact.course', 'text'], ['fee', 'fact.fee', 'money'], ['duration_seconds', 'fact.duration', 'time']],
  treated: [['paid', 'fact.paid', 'money'], ['remaining_seconds', 'fact.remaining', 'time']],
  travel_started: [['mode_name', 'fact.mode', 'text'], ['fare', 'fact.fare', 'money'], ['duration_seconds', 'fact.duration', 'time'], ['energy', 'fact.energy', 'num']],
  walk_started: [['to.name', 'fact.to', 'text'], ['duration_seconds', 'fact.duration', 'time'], ['energy', 'fact.energy', 'num']],
  item_used: [['item.name', 'fact.item', 'text'], ['left', 'fact.left', 'num']],
  jail: [['bail', 'fact.bail', 'money'], ['remaining_seconds', 'fact.remaining', 'time']],
}

function dig(o: Obj, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Obj)[k] : undefined), o)
}

export function factsFor(screen: string, view: unknown): Fact[] {
  const spec = SPECS[screen]
  if (!spec || !view || typeof view !== 'object') return []
  const out: Fact[] = []
  for (const [path, label, fmt] of spec) {
    const v = dig(view as Obj, path)
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'number' && v === 0 && (fmt === 'money' && path !== 'amount')) continue
    let value: string
    if (fmt === 'money' && typeof v === 'number') value = money(v)
    else if (fmt === 'num' && typeof v === 'number') value = formatNumber(v)
    else if (fmt === 'time' && typeof v === 'number') value = hms(v)
    else value = String(v)
    out.push({ label: t(label), value })
  }
  return out
}
