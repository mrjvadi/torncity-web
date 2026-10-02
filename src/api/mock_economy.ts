// The neutral answers of the economy and finance area for the mock (?mock=1): every screen of the area,
// typed by the generated Go views, with actions by id and named arguments, never a text or a label
// (docs/adr/0039-presentation-split.md). `?mock=1&open=<command>&args={"here":"village"}` opens a service
// as a village player sees it: the "not available here" state.

import { A, back, mockOk, refreshA, type MockAct } from './mock_neutral'
import { mockStandsIn } from '../support/mock'
import type {
  AmountOption, AuctionLine, Named, PaymentChoice, PledgeLine, Ref, Unavailable,
} from './views.gen'

const N = (code: string, name: string): Named => ({ code, name })

type Entry = { code: string; name: { en: string; fa: string } }
const e = (code: string, en: string, fa: string): Entry => ({ code, name: { en, fa } })

/** The catalogue names of everything the economy screens mention (the web never shows the view's authored name). */
export const ECONOMY_CONTENT: Record<string, Entry[]> = {
  item: [e('bread', 'Bread', 'نان'), e('sword', 'Sword', 'شمشیر'), e('plank', 'Plank', 'تخته'), e('rice', 'Rice', 'برنج')],
  place: [e('bazaar', 'Bazaar', 'بازارچه'), e('market_square', 'Market square', 'میدان بازار'), e('clinic', 'Clinic', 'درمانگاه'), e('square', 'Square', 'میدان')],
  shop: [e('grocery', 'Grocery', 'خواربارفروشی'), e('pharmacy', 'Pharmacy', 'داروخانه')],
  loan_product: [e('personal', 'Personal loan', 'وام شخصی'), e('mortgage', 'Mortgage', 'وام مسکن'), e('business', 'Business loan', 'وام کسب‌وکار')],
  insurance_product: [e('health', 'Health cover', 'بیمهٔ درمان'), e('war_cover', 'War cover', 'بیمهٔ جنگ')],
  budget_line: [e('infrastructure', 'Infrastructure', 'زیرساخت'), e('health', 'Health', 'سلامت'), e('education', 'Education', 'آموزش')],
  property_type: [e('house', 'House', 'خانه')],
  company_type: [e('studio', 'Studio', 'استودیو'), e('bakery', 'Bakery', 'نانوایی')],
}
const ref = (command: string, args: string[] | null = null): Ref => ({ command, args })
const AT = '2026-10-01T14:30:00Z'
const LATER = '2026-10-01T18:00:00Z'
const kind = (a: MockAct, k: string): MockAct => ({ ...a, kind: k })
const confirmA = (id: string, command: string, args: Record<string, string>) => kind(A(id, command, args), 'confirm')
const goA = (id: string, command: string, args?: Record<string, string>, subject?: string) => A(id, command, args, { subject, kind: 'navigation' })

const city = N('calderis', 'کالدریس')
const support = N('support', 'شهر مرکزی')
const country = { kind: 'country', code: 'default_country', name: 'کشور من' }
const place = { kind: 'city', code: 'calderis', name: 'کالدریس' }
const bread = N('bread', 'نان')
const sword = N('sword', 'شمشیر')
const pay2: PaymentChoice = { amount: 500, accepted: ['cash', 'card'], usable: ['cash', 'card'], cash: 1850, bank: 86300 }

// the mock's own bank, so a deposit shows its notice and the new balance
const bank = { cash: 12450, bank: 86300 }

const quick = (nonce: string, ...values: number[]): AmountOption[] => values.map((amount) => ({ amount, nonce, all: false }))

function unavailable(service: string, here: string, stage = 'city'): Unavailable {
  return {
    service, stage, here, requires: stage === 'support' ? null : [{ code: 'bank', role: '', tier: 0 }],
    nearest: support,
  }
}
const nearestActs = (backCommand: string): MockAct[] => [A('support.travel', 'travel.options', { city: 'support' }, { subject: 'support', kind: 'navigation' }), back(backCommand)]

const village = (args?: Record<string, unknown>) => args?.here === 'village' || args?.here === 'town'

interface Answer { ok: boolean; request_id?: string; screen: string; view?: unknown; actions?: MockAct[]; error?: { code: string; args?: Record<string, unknown> } }

export function mockEconomyCommand(command: string, args: Record<string, unknown> = {}): Answer | null {
  const a = (k: string) => String(args[k] ?? '')
  switch (command) {
    // -- the bank and paying a player
    case 'bank.show': {
      // a village keeps no bank: the wallet, the reason and the way to the central city, no amounts to move
      const noBank = args.here === 'village' || args.here === 'town' || mockStandsIn() === 'village'
      return mockOk('bank', {
        city_code: 'calderis', city: city.name, travelling: false, no_city: false, jailed: false, cash: bank.cash, bank: bank.bank,
        withdrawal_fee_bps: noBank ? 0 : 150, deposits: noBank ? null : quick('n1', 1000, 5000, 10000), withdrawals: noBank ? null : quick('n2', 10000, 50000),
        can_deposit: !noBank, can_withdraw: !noBank, notice: '', notice_args: null,
        unavailable: noBank ? unavailable('bank', 'village') : null,
      }, noBank ? [A('bank.pay', 'bank.pay', undefined, { kind: 'navigation' }), ...nearestActs('player.profile.get')] : [
        A('bank.deposit_custom', 'bank.deposit', undefined, { kind: 'primary' }), A('bank.withdraw_custom', 'bank.withdraw', undefined, { kind: 'primary' }),
        A('bank.pay', 'bank.pay', undefined, { kind: 'navigation' }), A('bank.finance', 'loan.hub', undefined, { kind: 'navigation' }),
        back('player.profile.get'), refreshA('bank.show'),
      ].map((x) => (x.id?.endsWith('_custom') ? { ...x, input: { field: 'amount' } } : x)))
    }
    case 'bank.deposit':
    case 'bank.withdraw': {
      const amount = Number(args.amount ?? 0)
      const dep = command === 'bank.deposit'
      bank.cash += dep ? -amount : amount
      bank.bank += dep ? amount : -amount
      return mockOk('bank', {
        city_code: 'calderis', city: city.name, travelling: false, no_city: false, jailed: false, cash: bank.cash, bank: bank.bank,
        withdrawal_fee_bps: 150, deposits: quick('n3', 1000, 5000), withdrawals: quick('n4', 10000), can_deposit: true, can_withdraw: true,
        notice: dep ? 'deposited' : 'withdrew', notice_args: { amount }, unavailable: null,
      }, [
        { ...A('bank.deposit_custom', 'bank.deposit', undefined, { kind: 'primary' }), input: { field: 'amount' } },
        { ...A('bank.withdraw_custom', 'bank.withdraw', undefined, { kind: 'primary' }), input: { field: 'amount' } },
        A('bank.pay', 'bank.pay', undefined, { kind: 'navigation' }), A('bank.finance', 'loan.hub', undefined, { kind: 'navigation' }),
        back('player.profile.get'), refreshA('bank.show'),
      ])
    }
    case 'bank.pay':
      if (!args.to) return mockOk('pay_help', {}, [A('social.search', 'social.search', undefined, { kind: 'navigation' }), back('bank.show')])
      if (args.amount && args.method) {
        return mockOk('pay_confirm', {
          payee_name: 'کاوه', payee_code: 'K7Q2M9A', method: a('method'), amount: Number(args.amount), fee: a('method') === 'card' ? 50 : 0,
          total: Number(args.amount) + (a('method') === 'card' ? 50 : 0), after: 7000, nonce: 'pn1', origin: '',
        }, [
          confirmA('pay.confirm', 'bank.pay.send', { to: 'K7Q2M9A', amount: a('amount'), method: a('method'), nonce: 'pn1' }),
          goA('pay.cancel', 'bank.pay', { to: 'K7Q2M9A' }), back('bank.show'),
        ])
      }
      return mockOk('pay', {
        payee_name: 'کاوه', payee_code: 'K7Q2M9A', together: true, city_code: 'calderis', city: city.name, payer_city_code: 'calderis', payer_city: city.name,
        card_fee_bps: 100, cash: bank.cash, bank: bank.bank, cash_options: quick('p1', 1000, 5000), card_options: quick('p2', 1000, 5000, 20000),
        can_cash: true, can_card: true, origin: '', notice: args.refused ? 'short_cash' : '', notice_args: args.refused ? { available: 850, needed: 5000 } : null,
      }, [
        goA('pay.cash', 'bank.pay', { to: 'K7Q2M9A', amount: '1000', method: 'cash' }), goA('pay.cash', 'bank.pay', { to: 'K7Q2M9A', amount: '5000', method: 'cash' }),
        { ...A('pay.cash_custom', 'bank.pay', { to: 'K7Q2M9A', method: 'cash' }, { kind: 'secondary' }), input: { field: 'amount' } },
        goA('pay.card', 'bank.pay', { to: 'K7Q2M9A', amount: '1000', method: 'card' }), goA('pay.card', 'bank.pay', { to: 'K7Q2M9A', amount: '20000', method: 'card' }),
        { ...A('pay.card_custom', 'bank.pay', { to: 'K7Q2M9A', method: 'card' }, { kind: 'secondary' }), input: { field: 'amount' } },
        back('bank.show'), refreshA('bank.pay', { to: 'K7Q2M9A' }),
      ])
    case 'bank.pay.send':
      return mockOk('pay_sent', { payee_name: 'کاوه', payee_code: 'K7Q2M9A', method: a('method') || 'card', amount: Number(args.amount ?? 5000), fee: 50, held: false }, [
        goA('bank.show', 'bank.show'), goA('pay.again', 'bank.pay', { to: 'K7Q2M9A' }), back('player.profile.get'),
      ])
    case 'payment.declined':
      return mockOk('payment_declined', { amount: 90000, cash: 1850, bank: 4300, accepted: ['cash', 'card'], back_label: 'shop.button.back_to_shop', back: ref('shop.view', ['grocery']) }, [
        goA('payment.back', 'shop.view', { shop: 'grocery' }), goA('bank.show', 'bank.show'), back('player.profile.get'),
      ])
    case 'city.budget':
      return mockOk('budget', {
        no_city: false, city: place, lever: 'city.allocation', can_propose: true, spend_share_bps: 3000, order: ['infrastructure', 'health', 'education'],
        allocation: { infrastructure: 5000, health: 3000, education: 2000 }, pending: { infrastructure: 4000, health: 4000, education: 2000 }, pending_in_seconds: 5400,
        treasury: 420000,
        last: { spent: 126000, spendable: 126000, lines: [{ code: 'infrastructure', effect: 'war_repair', spent: 63000, effect_bps: 2500 }, { code: 'health', effect: 'hospital_price', spent: 37800, effect_bps: 1200 }] },
        next_at: LATER, next_in_seconds: 9000,
      }, [goA('budget.change', 'gov.lever', { lever: 'city.allocation', city: 'calderis' }), goA('budget.bills', 'law.list'), back('gov.city'), refreshA('city.budget')])

    // -- gold
    case 'gold.show': {
      if (village(args)) return mockOk('gold', goldView(unavailable('gold', a('here'))), nearestActs('player.profile.get'))
      return mockOk('gold', goldView(null), [
        ...[1, 10, 50].map((g) => goA('gold.buy', 'gold.buy', { grams: String(g) })), ...[1, 10].map((g) => goA('gold.sell', 'gold.sell', { grams: String(g) })),
        goA('finance.portfolio', 'stock.mine'), back('player.profile.get'), refreshA('gold.show'),
      ])
    }
    case 'gold.buy':
      if (a('method') && a('nonce')) return mockOk('gold', { ...goldView(null), notice: 'buy_done', notice_args: { grams: Number(args.grams ?? 10), total: 8240 } }, [back('player.profile.get')])
      return mockOk('gold_trade', { side: 'buy', grams: Number(args.grams ?? 10), price: 824, total: 8240, payment: { ...pay2, amount: 8240 }, nonce: 'g1' }, [
        goA('payment.cash', 'gold.buy', { grams: a('grams') || '10', method: 'cash', nonce: 'g1' }), goA('payment.card', 'gold.buy', { grams: a('grams') || '10', method: 'card', nonce: 'g1' }), back('gold.show'),
      ])
    case 'gold.sell':
      return mockOk('gold_trade', { side: 'sell', grams: Number(args.grams ?? 10), price: 776, total: 7760, payment: pay2, nonce: 'g2' }, [
        confirmA('gold.sell_yes', 'gold.sell', { grams: a('grams') || '10', nonce: 'g2' }), back('gold.show'),
      ])

    // -- the national bank
    case 'loan.hub':
      if (village(args)) return mockOk('finance_hub', { ...hub(), unavailable: unavailable('loans', a('here')) }, nearestActs('bank.show'))
      return mockOk('finance_hub', hub(), [
        goA('finance.product', 'loan.offer', { product: 'personal' }, 'personal'), goA('finance.product', 'loan.offer', { product: 'mortgage' }, 'mortgage'),
        goA('finance.loan', 'loan.view', { no: '12' }), goA('finance.savings', 'save.show'), goA('finance.insurance', 'insure.list'),
        goA('finance.exchange', 'stock.list'), goA('finance.gold', 'gold.show'), goA('finance.portfolio', 'stock.mine'), back('bank.show'), refreshA('loan.hub'),
      ])
    case 'loan.offer':
      if (a('product') === 'mortgage' && !args.pledge) {
        return mockOk('loan_offer', { ...offer('mortgage', 'mortgage'), pledges: [pledge(7), pledge(9)], options: null }, [
          goA('finance.pledge', 'loan.offer', { product: 'mortgage', pledge: '7' }), goA('finance.pledge', 'loan.offer', { product: 'mortgage', pledge: '9' }), back('loan.hub'),
        ])
      }
      return mockOk('loan_offer', offer(a('product') || 'personal', 'player'), [
        goA('finance.option', 'loan.take', { product: a('product') || 'personal', amount: '20000', term: '12', pledge: '0' }),
        goA('finance.option', 'loan.take', { product: a('product') || 'personal', amount: '40000', term: '24', pledge: '0' }), back('loan.hub'),
      ])
    case 'loan.take':
      if (a('nonce')) return mockOk('finance_hub', { ...hub(), notice: 'taken', args: null }, [back('bank.show')])
      return mockOk('loan_confirm', {
        product: N('personal', 'وام شخصی'), amount: Number(args.amount ?? 20000), term: Number(args.term ?? 12), rate_bps: 2600, interest: 2900, instalment: 1908, total: 22900,
        first_at: LATER, pledge: null, nonce: 'l1',
      }, [confirmA('finance.take', 'loan.take', { product: 'personal', amount: a('amount') || '20000', term: a('term') || '12', pledge: '0', nonce: 'l1' }), back('loan.offer')])
    case 'loan.view':
      return mockOk('loan_detail', {
        loan: loan(12), principal: 20000, interest: 2900, rate_bps: 2600, periods: 12, paid: 4, fees_due: 0, payoff: 15200, pledge: null, opened_at: AT, next_at: LATER,
        missed: 0, recovered: 0, written_off: 0, nonce: 'l2', notice: '', notice_args: null, confirm_open: false,
      }, [goA('finance.payoff', 'loan.repay', { no: '12' }), back('loan.hub'), refreshA('loan.view', { no: '12' })])
    case 'loan.repay':
      return mockOk('loan_detail', {
        loan: { ...loan(12), status: 'repaid', owed: 0, next: 0, left: 0 }, principal: 20000, interest: 2900, rate_bps: 2600, periods: 12, paid: 12, fees_due: 0, payoff: 0, pledge: null,
        opened_at: AT, next_at: null, missed: 0, recovered: 0, written_off: 0, nonce: 'l2', notice: 'paid_off', notice_args: null, confirm_open: false,
      }, [back('loan.hub')])
    case 'save.show':
      if (village(args)) return mockOk('savings', { ...savingsView(), unavailable: unavailable('savings', a('here')) }, nearestActs('bank.show'))
      return mockOk('savings', savingsView(), [
        ...[1000, 5000, 20000].map((n) => goA('savings.deposit', 'save.deposit', { amount: String(n) })), ...[1000, 5000].map((n) => goA('savings.withdraw', 'save.withdraw', { amount: String(n) })),
        { ...A('savings.deposit_custom', 'save.deposit', undefined, { kind: 'primary' }), input: { field: 'amount' } },
        { ...A('savings.withdraw_custom', 'save.withdraw', undefined, { kind: 'primary' }), input: { field: 'amount' } },
        back('loan.hub'), refreshA('save.show'),
      ])
    case 'save.deposit':
    case 'save.withdraw':
      return mockOk('savings', { ...savingsView(), notice: command === 'save.deposit' ? 'deposited' : 'withdrawn', notice_args: { amount: Number(args.amount ?? 1000) } }, [back('loan.hub')])
    case 'insure.list':
      if (village(args)) return mockOk('insurance', { ...insuranceView(), unavailable: unavailable('insurance', a('here')) }, nearestActs('bank.show'))
      return mockOk('insurance', insuranceView(), [
        goA('insurance.insure', 'insure.buy', { product: 'health', property: '0' }, 'health'),
        goA('insurance.insure_property', 'insure.buy', { product: 'war_cover', property: '7' }, 'war_cover'),
        goA('insurance.cancel', 'insure.cancel', { no: '3' }), back('loan.hub'), refreshA('insure.list'),
      ])
    case 'insure.buy':
      return mockOk('insure_confirm', {
        product: N('health', 'بیمهٔ درمان'), covers: 'health', property: null, premium: 400, cover_bps: 7000, max_claim: 20000, waiting_seconds: 7200, payment: { ...pay2, amount: 400 },
      }, [
        goA('payment.cash', 'insure.buy', { product: 'health', property: '0', method: 'cash' }), goA('payment.card', 'insure.buy', { product: 'health', property: '0', method: 'card' }), back('insure.list'),
      ])
    case 'insure.cancel':
      return mockOk('insurance', { ...insuranceView(), cancel: policy(3) }, [confirmA('insurance.cancel_yes', 'insure.cancel', { no: '3', confirm: 'yes' }), back('loan.hub')])
    case 'finance.refused':
      return mockOk('finance_refusal', { kind: 'score', amount: 0, score: 560, count: 0, wait_seconds: 0, back: ref('loan.hub') }, [back('loan.hub')])

    // -- the stock exchange
    case 'stock.list':
      if (village(args)) return mockOk('exchange', { lines: null, unavailable: unavailable('stocks', a('here')) }, nearestActs('player.profile.get'))
      return mockOk('exchange', {
        lines: [
          { company: N('Q7M2K9B', 'استودیو دانا'), type: N('studio', 'استودیو'), city: place, price: 132, prev: 125, volume: 480, cap: 132000 },
          { company: N('R3N8L2C', 'نانوایی سحر'), type: N('bakery', 'نانوایی'), city: place, price: 48, prev: 52, volume: 120, cap: 48000 },
        ], unavailable: null,
      }, [goA('stock.open', 'stock.view', { code: 'Q7M2K9B' }), goA('stock.open', 'stock.view', { code: 'R3N8L2C' }), goA('finance.portfolio', 'stock.mine'), back('player.profile.get'), refreshA('stock.list')])
    case 'stock.view':
      return mockOk('stock', stockView(), [
        goA('stock.buy', 'stock.buy', { code: 'Q7M2K9B', qty: '1', price: '134' }, 'Q7M2K9B'), goA('stock.buy', 'stock.buy', { code: 'Q7M2K9B', qty: '10', price: '134' }, 'Q7M2K9B'),
        goA('stock.sell', 'stock.sell', { code: 'Q7M2K9B', qty: '10', price: '132' }, 'Q7M2K9B'), goA('stock.dividend', 'stock.dividend', { code: 'Q7M2K9B' }, 'Q7M2K9B'),
        back('stock.list'), refreshA('stock.view', { code: 'Q7M2K9B' }),
      ])
    case 'stock.buy':
    case 'stock.sell': {
      const buying = command === 'stock.buy'
      const done = !!args.nonce
      return mockOk('stock_order', {
        company: N('Q7M2K9B', 'استودیو دانا'), side: buying ? 'buy' : 'sell', qty: Number(args.qty ?? 10), price: Number(args.price ?? 134), reserve: 1340, bank: 86300, fee_bps: 150,
        nonce: 'so1', placed: done, no: 5, filled: done ? 4 : 0, spent: done ? 536 : 0, got: done ? 528 : 0, rests: done, expires_at: done ? LATER : null,
      }, done
        ? [goA('stock.cancel', 'stock.cancel', { no: '5' }), goA('stock.open', 'stock.view', { code: 'Q7M2K9B' }), back('stock.mine')]
        : [confirmA(buying ? 'stock.confirm_buy' : 'stock.confirm_sell', command, { code: 'Q7M2K9B', qty: a('qty') || '10', price: a('price') || '134', nonce: 'so1' }), goA('stock.open', 'stock.view', { code: 'Q7M2K9B' }), back('stock.mine')])
    }
    case 'stock.mine':
      if (village(args)) return mockOk('portfolio', { ...portfolio(), unavailable: unavailable('stocks', a('here')) }, nearestActs('player.profile.get'))
      return mockOk('portfolio', portfolio(), [
        goA('stock.open', 'stock.view', { code: 'Q7M2K9B' }), goA('stock.cancel', 'stock.cancel', { no: '5' }), goA('finance.exchange', 'stock.list'), goA('finance.gold', 'gold.show'),
        goA('finance.savings', 'save.show'), back('loan.hub'), refreshA('stock.mine'),
      ])
    case 'stock.cancel':
      return mockOk('portfolio', { ...portfolio(), notice: 'cancelled', notice_args: { no: 5 } }, [back('loan.hub')])
    case 'stock.ipo':
      if (a('nonce')) return mockOk('stock', { ...stockView(), notice: 'listed', notice_args: null }, [back('stock.list')])
      if (a('qty')) {
        return mockOk('listing', {
          company: N('R3N8L2C', 'نانوایی سحر'), refused: '', age_seconds: 90000, min_age_seconds: 86400, revenue: 52000, min_revenue: 40000, book: 48, total: 1000, fee: 500,
          floats: null, prices: null, chosen: { qty: 100, price: 48 }, nonce: 'ip1',
        }, [confirmA('stock.ipo_yes', 'stock.ipo', { code: 'R3N8L2C', qty: a('qty'), price: a('price'), nonce: 'ip1' }), back('stock.view')])
      }
      return mockOk('listing', {
        company: N('R3N8L2C', 'نانوایی سحر'), refused: '', age_seconds: 90000, min_age_seconds: 86400, revenue: 52000, min_revenue: 40000, book: 48, total: 1000, fee: 500,
        floats: [{ qty: 100, price: 0 }, { qty: 250, price: 0 }], prices: [{ qty: 0, price: 48 }], chosen: null, nonce: '',
      }, [goA('stock.ipo_option', 'stock.ipo', { code: 'R3N8L2C', qty: '100', price: '48' }), goA('stock.ipo_option', 'stock.ipo', { code: 'R3N8L2C', qty: '250', price: '48' }), back('stock.view')])
    case 'stock.dividend':
      if (a('nonce')) {
        return mockOk('dividend', { company: N('Q7M2K9B', 'استودیو دانا'), free: 31500, tax_bps: 1000, total: 1000, options: null, chosen: null, nonce: '', paid: 9000, per_share: 9, holders: 4, refused: '' }, [back('stock.view')])
      }
      if (a('amount')) {
        return mockOk('dividend', { company: N('Q7M2K9B', 'استودیو دانا'), free: 31500, tax_bps: 1000, total: 1000, options: null, chosen: { qty: 9, price: 10000 }, nonce: 'dv1', paid: 0, per_share: 0, holders: 0, refused: '' },
          [confirmA('stock.dividend_yes', 'stock.dividend', { code: 'Q7M2K9B', amount: a('amount'), nonce: 'dv1' }), back('stock.view')])
      }
      return mockOk('dividend', { company: N('Q7M2K9B', 'استودیو دانا'), free: 31500, tax_bps: 1000, total: 1000, options: [{ qty: 5, price: 5000 }, { qty: 9, price: 10000 }], chosen: null, nonce: '', paid: 0, per_share: 0, holders: 0, refused: '' },
        [goA('stock.dividend_option', 'stock.dividend', { code: 'Q7M2K9B', amount: '5000' }), goA('stock.dividend_option', 'stock.dividend', { code: 'Q7M2K9B', amount: '10000' }), back('stock.view')])

    // -- the item market
    case 'market.list':
      return mockOk('market', {
        city_code: 'calderis', city: city.name, books: [{ item: bread, best_bid: 38, best_ask: 44, last: 40 }, { item: N('plank', 'تخته'), best_bid: 0, best_ask: 90, last: 85 }], yours: [sword],
        at_market: !args.away, way: args.away ? { place: N('bazaar', 'بازارچه'), walk_seconds: 240 } : null,
      }, [
        goA('market.book', 'market.book', { item: 'bread' }, 'bread'), goA('market.book', 'market.book', { item: 'plank' }, 'plank'), goA('market.book', 'market.book', { item: 'sword' }, 'sword'),
        goA('market.mine', 'market.mine'), goA('market.auctions', 'auction.list'), goA('market.goods', 'company.goods'),
        ...(args.away ? [goA('place.walk', 'place.go', { place: 'bazaar', then: 'market.list' }, 'bazaar')] : []), back('map.list'), refreshA('market.list'),
      ])
    case 'market.book':
      return mockOk('book', {
        item: args.item === 'sword' ? sword : bread, city_code: 'calderis', city: city.name, bids: [{ price: 38, qty: 12 }, { price: 36, qty: 30 }], asks: [{ price: 44, qty: 8 }, { price: 48, qty: 20 }],
        trades: [{ qty: 2, price: 40, at: AT }, { qty: 6, price: 41, at: AT }], reference: 40, holding: 4, at_market: true, way: null, nonce: 'mk1',
      }, [
        goA('market.buy_at', 'market.order', { side: 'buy', item: 'bread', qty: '1', price: '44' }), goA('market.bid_at', 'market.order', { side: 'buy', item: 'bread', qty: '1', price: '40' }),
        goA('market.sell_at', 'market.order', { side: 'sell', item: 'bread', qty: '1', price: '38', nonce: 'mk1' }), goA('market.ask_at', 'market.order', { side: 'sell', item: 'bread', qty: '1', price: '40', nonce: 'mk1' }),
        goA('market.ask_all', 'market.order', { side: 'sell', item: 'bread', qty: '4', price: '40', nonce: 'mk1' }), goA('market.mine', 'market.mine'), back('market.list'), refreshA('market.book', { item: 'bread' }),
      ])
    case 'market.order':
      if (a('method') || (a('side') === 'sell' && a('nonce'))) {
        return mockOk('order_placed', { item: bread, side: a('side') || 'buy', no: 12, qty: Number(args.qty ?? 2), filled: 1, price: Number(args.price ?? 44), rests: true, spent: 44, got: 38, expires_at: LATER, method: a('method') || 'cash', embargoed: 0 },
          [goA('market.mine', 'market.mine'), goA('market.book', 'market.book', { item: 'bread' }, 'bread'), back('market.list')])
      }
      return mockOk('market_checkout', { item: bread, qty: Number(args.qty ?? 2), price: Number(args.price ?? 44), reserve: 88, payment: { ...pay2, amount: 88 }, nonce: 'mk2' }, [
        goA('payment.cash', 'market.order', { side: 'buy', item: 'bread', qty: a('qty') || '2', price: a('price') || '44', nonce: 'mk2', method: 'cash' }),
        goA('payment.card', 'market.order', { side: 'buy', item: 'bread', qty: a('qty') || '2', price: a('price') || '44', nonce: 'mk2', method: 'card' }), back('market.book'),
      ])
    case 'market.cancel':
      return mockOk('order_cancelled', { item: bread, side: 'buy', no: 12, left: 1, refund: 44 }, [goA('market.mine', 'market.mine'), back('market.list')])
    case 'market.mine':
      return mockOk('my_orders', {
        orders: [
          { no: 12, item: bread, side: 'buy', qty: 2, filled: 1, price: 44, status: 'open', city_code: 'calderis', city: city.name, expires_at: LATER },
          { no: 9, item: sword, side: 'sell', qty: 1, filled: 1, price: 900, status: 'filled', city_code: 'calderis', city: city.name, expires_at: null },
        ],
      }, [goA('market.cancel', 'market.cancel', { no: '12' }), back('market.list'), refreshA('market.mine')])
    case 'market.refused':
      return { ...mockOk('market_refusal', { kind: 'too_many', item: bread, count: 5 }, [goA('market.list', 'market.list'), back('player.profile.get')]), ok: false, error: { code: 'market_too_many', args: { count: 5 } } }

    // -- the shops
    case 'shop.list':
      return mockOk('shops', {
        city_code: 'calderis', city: city.name, shops: [{ shop: N('grocery', 'خواربارفروشی'), place: N('bazaar', 'بازارچه'), here: true }, { shop: N('pharmacy', 'داروخانه'), place: N('clinic', 'درمانگاه'), here: false }], place: null,
      }, [goA('shop.open', 'shop.view', { shop: 'grocery' }, 'grocery'), goA('shop.open', 'shop.view', { shop: 'pharmacy' }, 'pharmacy'), goA('item.bag', 'inventory.show'), back('map.list'), refreshA('shop.list')])
    case 'shop.view':
      return mockOk('shop_detail', {
        shop: N('grocery', 'خواربارفروشی'), place: N('bazaar', 'بازارچه'), here: !args.away, walk_seconds: args.away ? 180 : 0,
        shelves: [{ item: bread, price: 40, stock: 12, busy: false, buyback: 18, next_restock: null }, { item: N('rice', 'برنج'), price: 120, stock: 0, busy: true, buyback: 0, next_restock: LATER }], tax_bps: 500,
      }, [
        ...(args.away ? [goA('place.walk', 'place.go', { place: 'bazaar', then: 'shop.view', arg: 'grocery' }, 'bazaar')] : [goA('shop.buy', 'shop.buy', { shop: 'grocery', item: 'bread', qty: '1' }, 'bread')]),
        back('shop.list'), refreshA('shop.view', { shop: 'grocery' }),
      ])
    case 'shop.buy':
      if (a('method')) {
        return mockOk('shop_bought', { shop: N('grocery', 'خواربارفروشی'), item: bread, qty: Number(args.qty ?? 1), total: 40, tax: 2, method: a('method') }, [goA('item.bag', 'inventory.show'), goA('shop.open', 'shop.view', { shop: 'grocery' }), back('player.profile.get')])
      }
      return mockOk('shop_checkout', { shop: N('grocery', 'خواربارفروشی'), item: bread, qty: Number(args.qty ?? 1), unit: 40, total: 40 * Number(args.qty ?? 1), tax: 2, tax_bps: 500, stock: 12, payment: { ...pay2, amount: 42 }, nonce: 'sh1' }, [
        goA('payment.cash', 'shop.buy', { shop: 'grocery', item: 'bread', qty: a('qty') || '1', method: 'cash', nonce: 'sh1' }),
        goA('payment.card', 'shop.buy', { shop: 'grocery', item: 'bread', qty: a('qty') || '1', method: 'card', nonce: 'sh1' }),
        goA('shop.qty', 'shop.buy', { shop: 'grocery', item: 'bread', qty: '5' }), goA('shop.qty', 'shop.buy', { shop: 'grocery', item: 'bread', qty: '10' }), back('shop.view'),
      ])
    case 'shop.offers':
      return mockOk('sell_offers', { item: bread, ref: 'ab12', offers: [{ shop: N('grocery', 'خواربارفروشی'), place: N('bazaar', 'بازارچه'), price: 18 }] }, [goA('shop.sell_to', 'shop.sell', { shop: 'grocery', item: 'ab12' }, 'grocery'), back('inventory.item')])
    case 'shop.sell':
      return mockOk('shop_sold', { shop: N('grocery', 'خواربارفروشی'), item: bread, price: 18, left: 3 }, [goA('item.bag', 'inventory.show'), back('player.profile.get')])
    case 'shop.refused':
      return { ...mockOk('shop_refusal', { kind: 'sold_out', shop: N('grocery', 'خواربارفروشی'), item: N('rice', 'برنج'), stock: 0, next_restock: LATER }, [goA('shop.list', 'shop.list'), back('player.profile.get')]), ok: false, error: { code: 'shop_sold_out' } }

    // -- the auction house
    case 'auction.list':
      if (village(args)) return mockOk('auctions', { city_code: 'calderis', city: city.name, auctions: null, at_house: false, way: null, unavailable: unavailable('auction_house', a('here')) }, nearestActs('market.list'))
      return mockOk('auctions', { city_code: 'calderis', city: city.name, auctions: [auction(9), auction(10, true)], at_house: true, way: null, unavailable: null }, [
        goA('auction.open', 'auction.view', { no: '9' }), goA('auction.open', 'auction.view', { no: '10' }), goA('auction.mine', 'auction.mine'), goA('item.bag', 'inventory.show'),
        back('market.list'), refreshA('auction.list'),
      ])
    case 'auction.view':
      return mockOk('auction_detail', { line: auction(9), min_next: 55, bids: 3, payment: { ...pay2, amount: 55 }, nonce: 'au1', seller: 'کاوه' }, [
        goA('payment.cash', 'auction.bid', { no: '9', amount: '55', nonce: 'au1', method: 'cash' }), goA('payment.card', 'auction.bid', { no: '9', amount: '55', nonce: 'au1', method: 'card' }), back('auction.list'),
      ])
    case 'auction.bid':
      return mockOk('bid_placed', { no: 9, item: sword, amount: 55, method: a('method') || 'cash', ends_at: LATER }, [goA('auction.open', 'auction.view', { no: '9' }), back('auction.list')])
    case 'auction.new':
      if (a('nonce')) return mockOk('auction_opened', { no: 11, item: sword, reserve: 4000, duration_seconds: 3600, ends_at: LATER }, [goA('auction.open', 'auction.view', { no: '11' }), back('auction.list')])
      return mockOk('auction_new', { item: sword, ref: 'ab12', quality: 3, reserves: [4000, 8000], durations: [3600, 14400], nonce: 'an1' }, [
        goA('auction.terms', 'auction.new', { item: 'ab12', reserve: '4000', duration: '0', nonce: 'an1' }), goA('auction.terms', 'auction.new', { item: 'ab12', reserve: '8000', duration: '0', nonce: 'an1' }),
        goA('auction.terms', 'auction.new', { item: 'ab12', reserve: '4000', duration: '1', nonce: 'an1' }), goA('auction.terms', 'auction.new', { item: 'ab12', reserve: '8000', duration: '1', nonce: 'an1' }), back('inventory.item'),
      ])
    case 'auction.mine':
      return mockOk('my_auctions', { auctions: [auction(10, true), { ...auction(8), status: 'sold', remaining_seconds: 0, mine: true }] }, [goA('auction.open', 'auction.view', { no: '10' }), back('auction.list'), refreshA('auction.mine')])
    case 'auction.refused':
      return { ...mockOk('auction_refusal', { kind: 'too_low', no: 9, min_next: 55, count: 0 }, [goA('auction.open', 'auction.view', { no: '9' }), goA('auction.house', 'auction.list'), back('player.profile.get')]), ok: false, error: { code: 'auction_too_low', args: { min: 55 } } }
  }
  return null
}

function goldView(un: Unavailable | null) {
  return {
    buy: 824, sell: 776, mid: 800, prev: 780, stock: 498750, history: [{ price: 800, at: AT }, { price: 780, at: AT }], grams: 25, cost: 19800, options: [1, 10, 50],
    next_at: LATER, notice: '', notice_args: null, unavailable: un,
  }
}

const pledge = (no: number): PledgeLine => ({ no, code: '', type: N('house', 'خانه'), city: place, value: 120000, limit: 80000 })
const loan = (no: number) => ({ no, product: N('personal', 'وام شخصی'), company: N('', ''), status: 'active', next: 1908, owed: 15200, left: 8, arrears: 0 })

function hub() {
  return {
    country, credit: { score: 672, min: 300, max: 850, payment_bps: 9000, debt_bps: 7500, history_bps: 4000, income_bps: 6500, worth_bps: 3000, new_credit_bps: 7500, missed: 1, defaults: 0 },
    policy_bps: 1500, lendable: 800000, next_at: LATER, notice: '', args: null, savings: 5000, savings_bps: 900,
    products: [
      { product: N('personal', 'وام شخصی'), kind: 'player', rate_bps: 2600, limit: 40000, min_score: 500 },
      { product: N('mortgage', 'وام مسکن'), kind: 'mortgage', rate_bps: 2100, limit: 320000, min_score: 560 },
      { product: N('business', 'وام کسب‌وکار'), kind: 'company', rate_bps: 2300, limit: 0, min_score: 700 },
    ],
    loans: [loan(12), { ...loan(4), status: 'repaid', owed: 0, next: 0, left: 0 }], unavailable: null as Unavailable | null,
  }
}

function offer(code: string, k: string) {
  return {
    product: N(code, code === 'mortgage' ? 'وام مسکن' : 'وام شخصی'), kind: k, rate_bps: 2600, limit: 40000, terms: [12, 24],
    options: [{ amount: 20000, term: 12, instalment: 1908 }, { amount: 40000, term: 24, instalment: 1850 }], pledges: null, pledge: null, late_fee_bps: 500, default_after: 3, unavailable: null as Unavailable | null,
  }
}

function savingsView() {
  return { balance: 5000, rate_bps: 900, earned: 340, next: 38, bank: 86300, deposits: [1000, 5000, 20000], withdrawals: [1000, 5000], next_at: LATER, notice: '', notice_args: null, unavailable: null as Unavailable | null }
}

const policy = (no: number) => ({ no, product: N('health', 'بیمهٔ درمان'), covers: 'health', property: null, status: 'active', reason: '', premium: 400, paid: 0, from: AT, started: AT, claimable: true })

function insuranceView() {
  return {
    country, fund: 1200000, notice: '', notice_args: null, cancel: null as ReturnType<typeof policy> | null, unavailable: null as Unavailable | null,
    products: [
      { product: N('health', 'بیمهٔ درمان'), covers: 'health', premium: 400, prem_bps: 0, cover_bps: 7000, max_claim: 20000, waiting_seconds: 7200, targets: null, held: false },
      { product: N('war_cover', 'بیمهٔ جنگ'), covers: 'war_damage', premium: 100, prem_bps: 50, cover_bps: 5000, max_claim: 60000, waiting_seconds: 14400, targets: [pledge(7)], held: false },
    ],
    policies: [policy(3)],
  }
}

function portfolio() {
  return {
    holdings: [{ company: N('Q7M2K9B', 'استودیو دانا'), shares: 60, locked: 10, price: 132, value: 7920, cost: 7200, listed: true }, { company: N('R3N8L2C', 'نانوایی سحر'), shares: 100, locked: 0, price: 48, value: 4800, cost: 5000, listed: false }],
    orders: [{ no: 5, company: N('Q7M2K9B', 'استودیو دانا'), side: 'sell', qty: 10, filled: 4, price: 140 }], gold: 25, gold_val: 19400, savings: 5000, value: 37120, gain: -480,
    notice: '', notice_args: null, unavailable: null as Unavailable | null,
  }
}

function auction(no: number, mine = false): AuctionLine {
  return { no, item: sword, quality: 3, high_bid: mine ? 0 : 50, reserve: 40, remaining_seconds: 5400, ends_at: LATER, status: 'open', mine, leading: false }
}


function stockView() {
  return {
    company: N('Q7M2K9B', 'استودیو دانا'), type: N('studio', 'استودیو'), city: place, listed: true, price: 132, prev: 125, ipo: 100, book: 118, total: 1000,
  bids: [{ price: 130, qty: 40 }, { price: 128, qty: 15 }], asks: [{ price: 134, qty: 25 }, { price: 140, qty: 60 }],
  trades: [{ qty: 10, price: 132, at: AT }, { qty: 5, price: 131, at: AT }], holding: 60, locked: 10, cost: 7200, owner: true, controller: 'سارا',
  buys: [{ qty: 1, price: 134 }, { qty: 10, price: 134 }], sells: [{ qty: 10, price: 132 }], last_div: 9, fee_bps: 150, notice: '', notice_args: null, unavailable: null,
  }
}
