// The web's own words for the economy contract (docs/adr/0039-presentation-split.md): the server
// sends ids, codes and numbers, never a sentence. An action is worded by its `id`, a notice or a
// refusal by its code, a kind of service by its code; content names come from the catalogue.

import { getDisplayMoney } from '../../lib/money'
import type { Action } from '../../api/types'
import type { Unavailable } from '../../api/views.gen'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { registerLabeler } from '../village/wording'
import type { ContentNames } from '../../village/useVillage'

const key = (k: string) => k as Key

/** A number the server sent as a string argument. */
export function num(a: Action, name: string): number | undefined {
  const raw = a.args?.[name]
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** The ids this area words, and what their label says about the action's own numbers. */
const IDS = new Set([
  'bank.deposit', 'bank.deposit_all', 'bank.deposit_custom', 'bank.withdraw', 'bank.withdraw_all', 'bank.withdraw_custom',
  'bank.pay', 'bank.finance', 'bank.show',
  'pay.cash', 'pay.cash_all', 'pay.cash_custom', 'pay.card', 'pay.card_all', 'pay.card_custom', 'pay.local', 'pay.local_all', 'pay.local_custom', 'pay.confirm', 'pay.cancel', 'pay.again',
  'payment.cash', 'payment.card', 'payment.back', 'social.search', 'budget.change', 'budget.bills',
  'gold.buy', 'gold.sell', 'gold.sell_yes', 'finance.portfolio', 'finance.exchange', 'finance.gold', 'finance.savings', 'finance.insurance',
  'finance.product', 'finance.loan', 'finance.pledge', 'finance.option', 'finance.take', 'finance.payoff', 'finance.payoff_yes',
  'savings.deposit', 'savings.withdraw', 'savings.deposit_custom', 'savings.withdraw_custom',
  'insurance.insure', 'insurance.insure_property', 'insurance.cancel', 'insurance.cancel_yes',
  'stock.open', 'stock.buy', 'stock.sell', 'stock.ipo', 'stock.dividend', 'stock.confirm_buy', 'stock.confirm_sell', 'stock.cancel',
  'stock.ipo_yes', 'stock.ipo_option', 'stock.dividend_yes', 'stock.dividend_option',
  'market.book', 'market.mine', 'market.auctions', 'market.goods', 'market.buy_at', 'market.bid_at', 'market.sell_at', 'market.ask_at',
  'market.ask_all', 'market.cancel', 'market.list', 'place.walk', 'support.travel',
  'shop.open', 'shop.all', 'shop.buy', 'shop.qty', 'shop.sell_to', 'shop.list', 'item.bag',
  'auction.open', 'auction.mine', 'auction.terms', 'auction.house',
])

/** Everything an economy action's label can say. */
function params(a: Action, names?: ContentNames): Record<string, string | number> {
  const amount = num(a, 'amount')
  const grams = num(a, 'grams')
  const qty = num(a, 'qty')
  const price = num(a, 'price')
  const subject = a.subject ?? ''
  const name = subject && names ? names.name(['loan_product', 'insurance_product', 'item', 'shop', 'city', 'place', 'component'], subject) : subject
  return {
    // a local payment's amount is in units of the money, never SUP
    n: amount !== undefined && String(a.id ?? '').startsWith('pay.local') ? `${formatNumber(amount)} ${getDisplayMoney()?.name ?? ''}` : amount !== undefined ? money(amount) : grams !== undefined ? formatNumber(grams) : qty !== undefined ? formatNumber(qty) : '',
    qty: qty !== undefined ? formatNumber(qty) : '',
    price: price !== undefined ? money(price) : '',
    term: formatNumber(num(a, 'term') ?? 0),
    name,
  }
}

registerLabeler((a, names) => {
  const id = a.id ?? ''
  if (!IDS.has(id)) return undefined
  const k = `eco.act.${id}`
  return hasKey(k) ? t(key(k), params(a, names)) : undefined
})

/** Which of an economy screen's actions change the world (never twice: the host asks for each once). */
const WRITE_IDS = new Set([
  'savings.deposit', 'savings.withdraw', 'savings.deposit_custom', 'savings.withdraw_custom', 'stock.cancel', 'market.cancel', 'shop.sell_to',
  'bank.deposit_custom', 'bank.withdraw_custom', 'pay.cash_custom', 'pay.card_custom', 'pay.local_custom',
])

export function isEcoWrite(a: Action): boolean {
  const id = a.id ?? ''
  if (!IDS.has(id)) return false
  return !!a.args?.nonce || id.startsWith('payment.') || WRITE_IDS.has(id)
}

/** The name of a service that is not offered here. */
export function serviceName(code: string): string {
  const k = `eco.service.${code}`
  if (hasKey(k)) return t(key(k))
  // the other areas name their own services under their own prefix (military: mil.service.*)
  const other = `mil.service.${code}`
  return hasKey(other) ? t(key(other)) : t('eco.service.unknown')
}

/** Why a service is not here, in a sentence (the stage it starts at, or the neutral city only). */
export function unavailableReason(u: Unavailable, city?: string): string {
  const service = serviceName(u.service)
  if (u.stage === 'support') return t('eco.na.only_support', { service, place: city ?? t('eco.na.somewhere') })
  return t('eco.na.from', { service })
}

/** The wording of a coded notice a screen carries (`notice` + `notice_args`), or '' for none. */
export function noticeLine(area: 'bank' | 'pay' | 'finance' | 'gold' | 'stock', code: string, args: Record<string, unknown> | null | undefined, who?: string): string {
  if (!code) return ''
  const k = `eco.notice.${area}.${code}`
  if (!hasKey(k)) return ''
  const p: Record<string, string | number> = {}
  for (const [name, v] of Object.entries(args ?? {})) {
    if (typeof v === 'number') p[name] = ['grams', 'no', 'qty', 'count'].includes(name) ? formatNumber(v) : money(v)
    else if (typeof v === 'string') p[name] = v
  }
  if (who !== undefined) p.player = who || t('eco.someone')
  return t(key(k), p)
}
