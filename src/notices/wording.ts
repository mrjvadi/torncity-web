// What the server pushes to a player without being asked (a notice) arrives as data
// (docs/adr/0039-presentation-split.md, section 8): the notice's screen is its code, the
// view its facts. This module words it in the player's language from the client's own
// table (keys `pn.*` in ui.src.txt) and says how loud it is. Nothing here parses a
// sentence from the server, and nothing is worded from the server's authored names: a
// game entity is named by its content code from the catalogue.
//
// The tone is decided by the notice's code and its facts, never by reading its words:
// success is good news, warning is news that needs a look, info is neutral. A notice is
// never an error: red is for a refusal of something the player just did.

import type * as V from '../api/views.gen'
import { t, hasKey, type Key } from '../i18n'
import { formatNumber } from '../lib/persian'

export type NoticeTone = 'success' | 'info' | 'warning'

export interface NoticeLine {
  text: string
  tone: NoticeTone
}

/** Names a content code in the player's language (the catalogue's tables, in order). */
export type Namer = (tables: string | string[], code: string, authored?: string) => string

type Params = Record<string, string | number>

const money = (n: number | undefined | null): string => `${formatNumber(n ?? 0)} ${t('unit.money')}`
const num = (n: number | undefined | null): string => formatNumber(n ?? 0)

function span(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  if (s >= 86400) return t('time.d', { n: Math.round(s / 86400) })
  if (s >= 3600) return t('time.h', { n: Math.round(s / 3600) })
  if (s >= 60) return t('time.m', { n: Math.max(1, Math.round(s / 60)) })
  return t('time.s', { n: s })
}

function line(key: string, params: Params, tone: NoticeTone): NoticeLine {
  return { text: t(key as Key, params), tone }
}

/** The key if this client has wording for it, else the fallback. */
function pick(key: string, fallback: string): string {
  return hasKey(key) ? key : fallback
}

function person(p: { name?: string } | null | undefined): string {
  return p?.name?.trim() || t('pn.someone')
}

function placeName(n: Namer, p: V.Place | null | undefined): string {
  if (!p) return ''
  return p.kind === 'city' ? n('city', p.code, p.name) : p.name || p.code
}

function officeName(n: Namer, code: string): string {
  return code ? n('office', code, code) : ''
}

/** "Mayor of Calderis": an office and where. */
function electionTitle(n: Namer, office: string, place: V.Place): string {
  return `${officeName(n, office)} ${placeName(n, place)}`.trim()
}

/** The generic line for a notice this client has no wording of (a screen not carried as data yet). */
export function genericLine(): NoticeLine {
  return { text: t('pn.generic'), tone: 'info' }
}

/**
 * The line for a notice, by its screen name (the notice's code). Null when the screen is not
 * one this client words; the caller then shows `genericLine()`.
 */
export function noticeLine(screen: string, view: unknown, n: Namer): NoticeLine | null {
  switch (screen) {
    case 'payment_notice': {
      const v = view as V.PaymentView
      return line(v.method === 'cash' ? 'pn.payment.cash' : 'pn.payment.card', { player: person({ name: v.payer_name }), amount: money(v.amount) }, 'success')
    }
    case 'achievement_notice': {
      const v = view as V.AchievementView
      const parts = [t('pn.achievement', { name: n('achievement', v.achievement.code, v.achievement.name) })]
      if (v.cash > 0) parts.push(t('pn.achievement.cash', { cash: money(v.cash) }))
      if (v.withheld > 0) parts.push(t('pn.achievement.withheld', { amount: money(v.withheld) }))
      return { text: parts.join(' '), tone: 'success' }
    }
    case 'office_notice': {
      const v = view as V.OfficeView
      const by = [officeName(n, v.by_office), person(v.by)].filter(Boolean).join(' ')
      return line(v.dismissed ? 'pn.office.dismissed' : 'pn.office.appointed',
        { by, office: officeName(n, v.office), place: placeName(n, v.place) }, v.dismissed ? 'warning' : 'success')
    }
    case 'auction_notice': {
      const v = view as V.AuctionView
      const kind = ['outbid', 'won', 'sold', 'unsold'].includes(v.kind) ? v.kind : 'sold'
      const tone: NoticeTone = kind === 'outbid' ? 'warning' : kind === 'unsold' ? 'info' : 'success'
      return line(`pn.auction.${kind}`, { no: num(v.no), item: n('item', v.item.code, v.item.name), amount: money(v.amount), fee: money(v.fee) }, tone)
    }
    case 'victim_notice': {
      const v = view as V.VictimView
      const parts = [t('pn.victim', { city: n('city', v.city_code, v.city), crime: n('crime', v.crime.code, v.crime.name), amount: money(v.amount) })]
      if (v.item) parts.push(t('pn.victim.item', { item: n('item', v.item.code, v.item.name) }))
      if (v.thief_name) parts.push(t('pn.victim.seen', { thief: v.thief_name }))
      return { text: parts.join(' '), tone: 'warning' }
    }
    case 'case_solved_notice': {
      const v = view as V.CaseOutcomeView
      const city = n('city', v.city_code, v.city)
      if (!v.solved) return line('pn.case.closed', { city }, 'info')
      const parts = [t('pn.case.solved', { thief: v.thief || t('pn.someone'), city, restored: money(v.restored) })]
      if (v.shortfall > 0) parts.push(t('pn.case.shortfall', { amount: money(v.shortfall) }))
      return { text: parts.join(' '), tone: 'success' }
    }
    case 'convicted_notice': {
      const v = view as V.CaseOutcomeView
      const parts = [t('pn.convicted', {
        city: n('city', v.city_code, v.city), crime: n('crime', v.crime.code, v.crime.name),
        restored: money(v.restored), fine: money(v.fine_paid), term: span(v.term_seconds),
      })]
      if (v.shortfall > 0 || v.fine_paid < v.fine) parts.push(t('pn.convicted.unpaid', { debt: money(v.shortfall + Math.max(0, v.fine - v.fine_paid)) }))
      return { text: parts.join(' '), tone: 'warning' }
    }
    case 'treaty_proposed_notice': {
      const v = view as V.TreatyView
      return line('pn.treaty', { country: placeName(n, v.other), kind: n('treaty_type', v.kind.code, v.kind.name), no: num(v.no), time: span(v.ttl_seconds) }, 'info')
    }
    case 'election_result_notice': {
      const v = view as V.ElectionResultView
      const election = electionTitle(n, v.office, v.place)
      const parts = [t(v.elected ? 'pn.election.won' : 'pn.election.lost', { election, votes: num(v.votes), cast: num(v.cast) })]
      if (v.deposit > 0) parts.push(t(v.deposit_returned ? 'pn.election.deposit_back' : 'pn.election.deposit_kept', { deposit: money(v.deposit) }))
      return { text: parts.join(' '), tone: v.elected ? 'success' : 'info' }
    }
    case 'faction_request_notice': {
      const v = view as V.FactionRequestView
      return line(v.kind === 'apply' ? 'pn.faction.apply' : 'pn.faction.invite', { player: person(v.player), faction: v.ref.name || v.ref.code }, 'info')
    }
    case 'faction_answer_notice': {
      const v = view as V.FactionAnswerView
      const kind = v.kind === 'apply' ? 'apply' : 'invite'
      return line(`pn.faction.answer_${kind}_${v.accepted ? 'accepted' : 'declined'}`,
        { player: person(v.player), faction: v.ref.name || v.ref.code }, v.accepted ? 'success' : 'info')
    }
    case 'faction_crime_notice': {
      const v = view as V.FactionCrimeView
      const result = ['succeeded', 'escaped', 'caught'].includes(v.result) ? v.result : 'succeeded'
      const parts = [t(`pn.faction_crime.${result}` as Key, { crime: n('crime', v.crime.code, v.crime.name), faction: v.ref.name || v.ref.code })]
      if (result === 'succeeded') parts.push(t('pn.faction_crime.split', { take: money(v.take), cut: money(v.cut), share: money(v.share) }))
      if (v.jail) parts.push(t('pn.faction_crime.jail', { term: span(v.jail.remaining_seconds) }))
      if (v.fine > 0) parts.push(t('pn.faction_crime.fine', { fine: money(v.fine), paid: money(v.fine_paid) }))
      if (v.injury) parts.push(t('pn.injury', { damage: num(v.injury.damage) }))
      return { text: parts.join(' '), tone: result === 'succeeded' ? 'success' : 'warning' }
    }
    case 'finance_notice': {
      const v = view as V.FinanceView
      const insurance = ['claimed', 'lapsed', 'gone'].includes(v.kind)
      const product = n(insurance ? 'insurance_product' : 'loan_product', v.product.code, v.product.name)
      const kind = ['due', 'missed', 'defaulted', 'repaid', 'claimed', 'lapsed', 'gone'].includes(v.kind) ? v.kind : 'due'
      const tone: NoticeTone = kind === 'repaid' || kind === 'claimed' ? 'success' : kind === 'gone' ? 'info' : 'warning'
      return line(`pn.finance.${kind}`, { no: num(v.no), product, amount: money(v.amount), other: money(v.other), count: num(v.count) }, tone)
    }
    case 'hospitalised_notice': {
      const v = view as V.HospitalisedView
      return line('pn.hospitalised', { city: n('city', v.city_code, v.city), damage: num(v.damage), health: num(v.health), max: num(v.max) }, 'warning')
    }
    case 'clinic_treated_notice': {
      const v = view as V.ClinicTreatedView
      return line('pn.clinic', { name: v.ref.name || v.ref.code, patient: v.patient, price: money(v.price) }, 'success')
    }
    case 'bill_decided_notice': {
      const v = view as V.BillDecidedView
      const status = ['passed', 'failed', 'lapsed'].includes(v.status) ? v.status : 'passed'
      return line(`pn.bill.${status}`, { no: num(v.no), place: placeName(n, v.place), yes: num(v.yes), nay: num(v.nay) }, status === 'passed' ? 'success' : 'info')
    }
    case 'rank_notice': {
      const v = view as V.RankView
      return line(v.up ? 'pn.rank.up' : 'pn.rank.down',
        { rank: n('life_rank', v.rank.code, v.rank.name), from: n('life_rank', v.from.code, v.from.name), worth: money(v.worth) }, v.up ? 'success' : 'warning')
    }
    case 'hunger_notice':
      return line('pn.hunger', {}, 'warning')
    case 'market_filled_notice': {
      const v = view as V.MarketFilledView
      return line(v.side === 'buy' ? 'pn.market.bought' : 'pn.market.sold', {
        city: n('city', v.city_code, v.city), item: n('item', v.item.code, v.item.name), qty: num(v.qty), price: money(v.price), amount: money(v.amount), fee: money(v.fee),
      }, 'success')
    }
    case 'mission_completed_notice': {
      const v = view as V.MissionCompletedView
      const parts = [t('pn.mission', { mission: n('mission', v.mission.code, v.mission.name) })]
      if (v.cash > 0) parts.push(t('pn.mission.paid', { cash: money(v.cash) }))
      if (v.withheld > 0) parts.push(t('pn.mission.withheld', { amount: money(v.withheld) }))
      for (const it of v.items ?? []) parts.push(t('pn.mission.item', { qty: num(it.qty), item: n('item', it.item.code, it.item.name) }))
      return { text: parts.join(' '), tone: 'success' }
    }
    case 'property_notice': {
      const v = view as V.PropertyView
      const kind = ['sold', 'let', 'tenant_left', 'foreclosed', 'evicted', 'evicted_tenant'].includes(v.kind) ? v.kind : 'sold'
      const tone: NoticeTone = kind === 'sold' || kind === 'let' ? 'success' : kind === 'tenant_left' || kind === 'evicted_tenant' ? 'info' : 'warning'
      return line(`pn.property.${kind}`, {
        no: num(v.no), type: n('property_type', v.type.code, v.type.name), city: placeName(n, v.city), player: person(v.player), amount: money(v.amount),
      }, tone)
    }
    case 'recruit_notice': {
      const v = view as V.RecruitView
      const company = v.company.name || v.company.code
      const skill = n('skill', v.skill, v.skill)
      const what = v.level > 0 ? t('pn.recruit.what', { skill, level: num(v.level) }) : skill
      const kind = ['applied', 'hired', 'ended', 'filled', 'completed', 'left', 'unpaid'].includes(v.kind) ? v.kind : 'ended'
      const reason = v.reason && hasKey(`pn.recruit.leave.${v.reason}`) ? t(`pn.recruit.leave.${v.reason}` as Key) : ''
      const parts = [t(`pn.recruit.${kind}` as Key, { company, no: num(v.campaign_no), count: num(v.count), what, reason })]
      if (kind === 'completed' && v.amount > 0) parts.push(t('pn.recruit.equity', { amount: money(v.amount) }))
      const tone: NoticeTone = kind === 'hired' || kind === 'filled' ? 'success' : kind === 'left' || kind === 'unpaid' ? 'warning' : 'info'
      return { text: parts.join(' '), tone }
    }
    case 'stock_notice': {
      const v = view as V.StockView
      const company = v.company.name || v.company.code
      const key = v.kind === 'filled' ? `pn.stock.filled_${v.side === 'sell' ? 'sell' : 'buy'}` : pick(`pn.stock.${v.kind}`, 'pn.stock.dividend')
      return line(key, { company, qty: num(v.qty), price: money(v.price), amount: money(v.amount) }, v.kind === 'takeover_lost' ? 'warning' : 'success')
    }
    case 'village_news': {
      const v = view as V.VillageNewsView
      const items = v.items ?? []
      if (!items.length) return null
      const first = items[0]
      const text = t(pick(`pn.news.${first.kind}`, 'pn.news.built') as Key, {
        village: v.village, building: n('settlement_building', first.building.code, first.building.name),
        knowledge: n('settlement_knowledge', first.knowledge.code, first.knowledge.name), percent: num(first.percent), player: first.player || t('pn.someone'),
      })
      return { text: items.length > 1 ? `${text} ${t('pn.news.more', { n: items.length - 1 })}` : text, tone: 'info' }
    }
    case 'company_application_notice': {
      const v = view as V.CompanyApplicationNoticeView
      return line('pn.company.application', { player: person(v.player), level: num(v.level), title: n('career_tier', `${v.job.career_code}.${v.job.rank}`, v.job.title), company: v.company.name }, 'info')
    }
    case 'company_employee_notice': {
      const v = view as V.CompanyEmployeeNoticeView
      const kind = ['hired', 'rejected', 'fired', 'closed', 'manager'].includes(v.kind) ? v.kind : 'rejected'
      const tone: NoticeTone = kind === 'hired' || kind === 'manager' ? 'success' : kind === 'rejected' ? 'info' : 'warning'
      return line(`pn.company.${kind}`, { company: v.company.name, title: n('career_tier', `${v.job.career_code}.${v.job.rank}`, v.job.title), wage: money(v.wage), owner: person(v.owner) }, tone)
    }
    case 'company_period_notice': {
      const v = view as V.CompanyPeriodNoticeView
      if (v.dissolved) return line('pn.company.dissolved', { company: v.company.name }, 'warning')
      const parts = [t('pn.company.period', { company: v.company.name, revenue: money(v.period.revenue), wages: money(v.period.wages), upkeep: money(v.period.upkeep) })]
      if (v.arrears > 0) parts.push(t('pn.company.period_debt', { company: v.company.name, amount: money(v.period.debt), left: num(Math.max(0, v.grace - v.arrears)) }))
      return { text: parts.join(' '), tone: v.arrears > 0 ? 'warning' : 'info' }
    }
    case 'production_notice': {
      const v = view as V.ProductionNoticeView
      const kind = ['researched', 'produced', 'reversed_ok', 'reversed_failed', 'license_sold', 'sold'].includes(v.kind) ? v.kind : 'produced'
      const base = n(v.good.component ? 'component' : 'item', v.good.item.code, v.good.item.name)
      const good = v.good.design ? t('co.good_designed', { design: v.good.design, item: base }) : base
      const tone: NoticeTone = kind === 'reversed_failed' ? 'warning' : 'success'
      return line(`pn.production.${kind}`, {
        company: v.company.name, tech: n('technology', v.tech.code, v.tech.name), good, qty: num(v.qty), quality: num(v.quality),
        design: v.design, buyer: v.buyer || t('pn.someone'), price: money(v.price),
      }, tone)
    }
    default:
      return null
  }
}

/** True when this client words a notice of this screen. */
export function wordsNotice(screen: string): boolean {
  return NOTICE_SCREENS.has(screen)
}

const NOTICE_SCREENS = new Set([
  'payment_notice', 'achievement_notice', 'office_notice', 'auction_notice', 'victim_notice', 'case_solved_notice', 'convicted_notice',
  'treaty_proposed_notice', 'election_result_notice', 'faction_request_notice', 'faction_answer_notice', 'faction_crime_notice',
  'finance_notice', 'hospitalised_notice', 'clinic_treated_notice', 'bill_decided_notice', 'rank_notice', 'hunger_notice',
  'market_filled_notice', 'mission_completed_notice', 'property_notice', 'recruit_notice', 'stock_notice', 'village_news',
  'company_application_notice', 'company_employee_notice', 'company_period_notice', 'production_notice',
])
