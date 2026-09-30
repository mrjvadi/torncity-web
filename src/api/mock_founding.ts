// Offline founding form for ?mock=1 (client-api.md section 4.4): the draft and
// the server's checks, so the form can be used and screenshotted without a
// backend. ?founding=other|expired|founded|none picks the state the draft is
// in; the default is a draft the player may complete. The rules here mirror
// internal/domain/settlement (lengths, letters, reserved words, taken names).

import type { FoundingFormView, FoundingProblem } from './types'

const LIMITS = { name_min: 3, name_max: 24, motto_max: 60, currency_name_min: 3, currency_name_max: 24, currency_code_len: 3, currency_symbol_max: 3 }
const DRAFT = '5b1c1d0e7a3f4e599c110d2f6a8b4c21'
const TAKEN_NAMES = ['آمل', 'کورندال', 'ashvale']
const TAKEN_CODES = ['KRD', 'AML']
const RESERVED_CODES = ['SUP', 'NIL', 'USD', 'EUR', 'IRR']
const BANNED = ['nazi', 'hitler']

const SHAPES = [['shield', 'سپر', '🛡'], ['circle', 'دایره', '⭕'], ['banner', 'پرچم', '🚩'], ['diamond', 'لوزی', '🔶'], ['hexagon', 'شش‌ضلعی', '⬢']]
const PALETTE = [
  ['crimson', 'سرخ', '🔴', '#b3261e'], ['orange', 'نارنجی', '🟠', '#d9731a'], ['gold', 'طلایی', '🟡', '#e2b53c'],
  ['green', 'سبز', '🟢', '#2f8f4e'], ['azure', 'آبی', '🔵', '#2b6fc4'], ['violet', 'بنفش', '🟣', '#7a4fc0'],
  ['brown', 'قهوه‌ای', '🟤', '#7a5236'], ['ivory', 'عاجی', '⚪', '#efe7d2'], ['slate', 'خاکستری تیره', '⚫', '#2a3140'],
]
const ICONS = [
  ['wheat', 'خوشهٔ گندم', '🌾'], ['tree', 'درخت', '🌳'], ['mountain', 'کوه', '⛰'], ['wave', 'موج', '🌊'],
  ['sun', 'خورشید', '☀️'], ['moon', 'ماه', '🌙'], ['star', 'ستاره', '⭐'], ['tower', 'برج', '🏰'],
  ['anchor', 'لنگر', '⚓'], ['hammer', 'چکش', '🔨'], ['flame', 'شعله', '🔥'], ['crown', 'تاج', '👑'],
  ['key', 'کلید', '🗝'], ['book', 'کتاب', '📖'], ['horse', 'اسب', '🐎'], ['fish', 'ماهی', '🐟'],
]

let founded: { id: string; name: string } | null = null

function stateParam(): string {
  return new URLSearchParams(window.location.search).get('founding') ?? 'mine'
}

function formView(): FoundingFormView {
  const state = founded ? 'founded' : (stateParam() as FoundingFormView['state'])
  return {
    state: state === ('founded' as string) || state === 'other' || state === 'expired' ? state : 'mine',
    draft: '5b1c1d0e-7a3f-4e59-9c11-0d2f6a8b4c21',
    expires_at: new Date(Date.now() + 27 * 60_000 + 40_000).toISOString(),
    founder: state === 'other' ? 'رضا' : 'سارا',
    suggested_name: 'کورندال',
    default_emblem: { shape: 'shield', color_a: 'azure', color_b: 'gold', icon: 'wheat' },
    limits: LIMITS,
    shapes: SHAPES.map(([code, name, emoji]) => ({ code, name, emoji })),
    palette: PALETTE.map(([code, name, emoji, hex]) => ({ code, name, emoji, hex })),
    icons: ICONS.map(([code, name, emoji]) => ({ code, name, emoji })),
    neutral_currency: 'SUP',
    ...(founded ? { settlement_id: founded.id, settlement_name: founded.name } : {}),
  }
}

function refuse(kind: string, problems: FoundingProblem[] = []) {
  return {
    ok: false, screen: 'founding_refusal', text: '', actions: [],
    view: { kind, problems, limits: LIMITS }, error: { code: `founding_${kind}`, message: kind },
  }
}

const key = (s: string) => s.toLowerCase().replace(/[\s\-‌]/g, '')

function check(a: Record<string, unknown>): FoundingProblem[] {
  const out: FoundingProblem[] = []
  const add = (field: string, code: string) => out.push({ field, code })
  const s = (k: string) => String(a[k] ?? '').trim().replace(/\s+/g, ' ')
  const name = s('name'), motto = s('motto'), cname = s('currency_name'), code = String(a.currency_code ?? '').toUpperCase().trim()
  const sym = String(a.currency_symbol ?? '').trim() || code
  const letters = /^[\p{Script=Arabic}\p{Script=Latin}‌\- ]+$/u
  const link = /(http|www|t\.me|@|#|\/|:\/\/|\w\.\w{2,})/i
  const len = (x: string) => [...x].length
  if (link.test(name)) add('name', 'name_link')
  else if (!letters.test(name) || /\p{Nd}/u.test(name)) add('name', 'name_chars')
  else if (len(name) < LIMITS.name_min) add('name', 'name_short')
  else if (len(name) > LIMITS.name_max) add('name', 'name_long')
  else if (BANNED.some((b) => key(name).includes(b))) add('name', 'name_forbidden')
  else if (TAKEN_NAMES.some((n) => key(n) === key(name))) add('name', 'name_taken')
  if (motto) {
    if (link.test(motto)) add('motto', 'motto_link')
    else if (len(motto) > LIMITS.motto_max) add('motto', 'motto_long')
  }
  if (!letters.test(cname)) add('currency_name', 'currency_name_chars')
  else if (len(cname) < LIMITS.currency_name_min) add('currency_name', 'currency_name_short')
  else if (len(cname) > LIMITS.currency_name_max) add('currency_name', 'currency_name_long')
  if (!/^[A-Z]{3}$/.test(code)) add('currency_code', 'currency_code_format')
  else if (RESERVED_CODES.includes(code)) add('currency_code', 'currency_code_reserved')
  else if (TAKEN_CODES.includes(code)) add('currency_code', 'currency_code_taken')
  if (len(sym) < 1 || len(sym) > LIMITS.currency_symbol_max || /\s/.test(sym)) add('currency_symbol', 'currency_symbol_invalid')
  const ok = (list: string[][], c: unknown) => list.some((x) => x[0] === c)
  if (!ok(SHAPES, a.shape) || !ok(ICONS, a.icon) || !ok(PALETTE, a.color_a) || !ok(PALETTE, a.color_b) || a.color_a === a.color_b) add('emblem', 'emblem_invalid')
  return out
}

/** The founding form's commands, or null for any other command. */
export function mockFoundingCommand(command: string, args?: Record<string, unknown>) {
  if (command === 'settlement.found.draft') {
    if (stateParam() === 'none') return refuse('no_draft')
    return { ok: true, screen: 'founding_form', text: '', actions: [], view: formView() }
  }
  if (command === 'settlement.found.submit') {
    const a = args ?? {}
    const problems = check(a)
    if (problems.length) return refuse('invalid', problems)
    if (a.check) return { ok: true, screen: 'founding_checked', text: '', actions: [], view: { name: a.name } }
    founded = { id: 'v-own', name: String(a.name).trim() }
    return {
      ok: true, screen: 'settlement_founded', text: '', actions: [],
      view: { name: founded.name, settlement_id: founded.id, emblem: { shape: a.shape, color_a: a.color_a, color_b: a.color_b, icon: a.icon }, currency_code: String(a.currency_code).toUpperCase() },
    }
  }
  return null
}
