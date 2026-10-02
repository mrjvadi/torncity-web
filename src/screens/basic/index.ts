// The fallback family: every server screen without a bespoke native layout
// is registered here under a kind (result, notice, refusal, confirm, page),
// so nothing falls through to the raw-Telegram-text GenericScreen except an
// unknown future screen name.

import type { ScreenSet } from '../types'
import { makeMessage, type Kind } from './Message'

const KINDS: Record<Kind, string[]> = {
  result: ['shift_worked', 'shift_started', 'job_hired', 'job_promoted', 'enrolled', 'course_completed', 'treated', 'pay_sent', 'order_placed', 'order_cancelled', 'bid_placed', 'shop_bought', 'shop_sold', 'faction_founded', 'faction_left', 'faction_answered', 'faction_linked', 'stood', 'voted', 'policy_announced', 'appoint_done', 'bailed', 'auction_opened', 'faction_found'],
  notice: ['achievement_notice', 'rank_notice', 'payment_notice', 'hospitalised_notice', 'clinic_treated_notice', 'victim_notice', 'convicted_notice', 'case_solved_notice', 'faction_request_notice', 'faction_answer_notice', 'faction_crime_notice', 'mission_completed_notice', 'election_result_notice', 'market_filled_notice', 'bill_decided_notice', 'treaty_proposed_notice', 'property_notice', 'recruit_notice', 'finance_notice', 'stock_notice', 'office_notice', 'auction_notice', 'hunger_notice'],
  refusal: ['crime_refusal', 'market_refusal', 'shop_refusal', 'faction_refusal', 'finance_refusal', 'health_refusal', 'auction_refusal', 'bill_refusal', 'diplomacy_refusal', 'election_refusal', 'recruit_refusal', 'policy_refused', 'appoint_refusal', 'payment_declined', 'sanction_blocked', 'mission_refusal'],
  confirm: ['pay_confirm', 'treat_confirm', 'insure_confirm', 'loan_confirm', 'shop_checkout', 'market_checkout', 'report_confirm', 'faction_confirm', 'policy_confirm', 'allocation_confirm', 'appoint_confirm', 'dismiss_confirm'],
  page: ['jail', 'crime_record', 'cases', 'course_detail', 'my_orders', 'sell_offers', 'stock', 'stock_order', 'listing', 'dividend', 'gold', 'gold_trade', 'savings', 'insurance', 'loan_offer', 'loan_detail', 'faction_page', 'faction_members', 'faction_bank', 'faction_crime', 'my_office', 'lever_edit', 'allocation_edit', 'budget', 'bills', 'bill', 'treaties', 'propose', 'end_treaty', 'sanctions', 'impose', 'lift', 'diplomacy_history', 'auctions', 'auction_detail', 'auction_new', 'my_auctions', 'mission', 'missions_mine', 'pay', 'shop_detail'],
}

const SERVER: ScreenSet['SERVER'] = {}
for (const kind of Object.keys(KINDS) as Kind[]) {
  for (const name of KINDS[kind]) SERVER[name] = makeMessage(kind, name)
}

const screens: ScreenSet = { SERVER, LOCAL: {} }
export default screens
