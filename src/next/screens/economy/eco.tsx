// The pieces the economy screens of the new UI share: the server's actions by id, content names, an item's 3D icon,
// the "not here" card, the walk to a service, the ways to pay one charge, a result page, the quantity sheet and the
// rest of a screen's actions as rows. Everything is drawn from the view and the actions of the answer.

import { useState, type ReactNode } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import type { Named, PaymentChoice, Unavailable, Way } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Icon, KV, List, Loading, Note, Page, Row, Section, Sheet } from '../../ui'
import { icon3d } from '../../icons'
import { useContentNames } from '../../../village/useVillage'
import { actionLabel } from '../../../screens/village/wording'
import { formatNumber, hms, money, pct, splitMoney } from '../../../screens/native/kit/format'
import { hasKey, noticeText, refusalText, t, type Key } from '../../../i18n'
import './economy.css'

export const key = (k: string) => k as Key

// -- actions -----------------------------------------------------------------------------------------------

/** An action's meaning: its id, or its command when the server blanked an id equal to it. */
export const idOf = (a: Action): string => a.id || a.command || ''
export const isBack = (a: Action) => a.kind === 'back' || a.id === 'back'
export const isRefresh = (a: Action) => a.id === 'refresh'

export function actsOf(r: CommandResponse | null | undefined): Action[] { return r?.actions ?? [] }

/** The actions with one of these ids (or commands). */
export function byId(acts: Action[], ...ids: string[]): Action[] {
  return acts.filter((a) => ids.includes(idOf(a)))
}

/** The first action with this id whose arguments include all of `args`. */
export function find(acts: Action[], id: string, args: Record<string, string | number> = {}): Action | undefined {
  return acts.find((a) => idOf(a) === id && Object.entries(args).every(([k, v]) => String(a.args?.[k] ?? '') === String(v)))
}

/** An action with some arguments changed (a quantity, an amount); a value-asking input is dropped since the value is
 * now given, and the kind is plain so the shell runs it at once (the screen itself asked). */
export function withArgs(a: Action, args: Record<string, string>, kind = 'primary'): Action {
  return { ...a, input: undefined, kind, args: { ...(a.args ?? {}), ...args } }
}

/** A number argument of an action. */
export function argNum(a: Action | undefined, name: string): number {
  const n = Number(a?.args?.[name])
  return Number.isFinite(n) ? n : 0
}

// -- names and icons ---------------------------------------------------------------------------------------

export type Names = ReturnType<typeof useContentNames>
export function useNames() {
  const names = useContentNames()
  return {
    names,
    item: (n: Named | null | undefined) => (n ? names.name(['item', 'component'], n.code, n.name) : ''),
    shop: (n: Named | null | undefined) => (n ? names.name(['shop'], n.code, n.name) : ''),
    place: (n: Named | null | undefined) => (n ? names.name(['place'], n.code, n.name) : ''),
    city: (code: string, name?: string) => names.name(['city'], code, name),
  }
}

/** The amber 3D set (public/icons3d/amber): an item whose code is a file there is drawn by it. */
const AMBER = new Set(('a_foxkid activity arm bank bed book box bread bus cart chart check checklist city clock coins crime crowncoin diamond ' +
  'energy eye factory flagobj gavel gears gift handcuffs health heat helmet histogram hospital house inbox keys m_backpack m_bench m_brief ' +
  'm_chat m_check m_coffee m_hand m_lock m_meal m_popcorn m_search market medal missile money moon nerve ore phone pill pistol plane ' +
  'quill radar rank ribbon rifle ring shield soda stetho stopwatch swords tag tank tent toaster trade train trophy walk work world ' +
  'x_car x_cards x_cash x_chest x_crown x_dice x_flag x_flame x_flower x_gem x_goldbar x_knife x_map x_news x_phone x_present x_quill ' +
  'x_scroll x_seal x_shield x_sprout x_star x_ticket x_vest f_bottle f_rose f_ringbox f_rings f_diamond f_letter').split(' '))

/** Item codes whose picture is another file of the set. */
const ITEM_ICON: Record<string, string> = {
  bandage: 'pill', medkit: 'x_cross', painkiller: 'pill', medicine: 'pill', water_bottle: 'f_bottle', water: 'f_bottle', milk: 'f_bottle',
  rice: 'm_meal', meal: 'm_meal', soup: 'm_meal', tea: 'm_coffee', coffee: 'm_coffee', cola: 'soda', juice: 'soda', popcorn: 'm_popcorn',
  sword: 'x_knife', knife: 'x_knife', dagger: 'x_knife', axe: 'x_knife', plank: 'box', timber: 'box', wood: 'box', logs: 'box',
  stone: 'ore', iron_ore: 'ore', coal: 'ore', bag_sack: 'm_backpack', backpack: 'm_backpack', satchel: 'm_backpack', mobile: 'phone',
  smartphone: 'phone', gold: 'x_goldbar', gold_bar: 'x_goldbar', gem: 'x_gem', jewel: 'x_gem', car: 'x_car', vest: 'x_vest', armor: 'x_vest',
  rose: 'f_rose', flower: 'x_flower', seed: 'x_sprout', wheat: 'x_sprout', letter: 'f_letter', ticket: 'x_ticket', cards: 'x_cards',
  dice: 'x_dice', crown: 'x_crown', newspaper: 'x_news', fuel: 'x_flame', gun: 'pistol', revolver: 'pistol',
}
/** A shelf group or catalogue category's picture, when the item's own is not in the set. */
const GROUP_ICON: Record<string, string> = {
  food: 'm_meal', drink: 'soda', medicine: 'pill', gear: 'gears', tools: 'gears', electronics: 'phone', valuables: 'x_gem', vehicles: 'x_car',
  materials: 'box', wood: 'box', fuel: 'x_flame', farm: 'x_sprout', weapons: 'pistol', weapon: 'pistol', defence: 'shield', mineral: 'ore',
  metal_ore: 'ore', clothing: 'x_vest', bags: 'm_backpack',
}

export function itemIcon(code: string | undefined, group?: string, category?: string): string {
  const c = code ?? ''
  if (AMBER.has(c)) return c
  if (ITEM_ICON[c]) return ITEM_ICON[c]
  const head = c.split('_')[0]
  if (AMBER.has(head)) return head
  if (ITEM_ICON[head]) return ITEM_ICON[head]
  return GROUP_ICON[group ?? ''] ?? GROUP_ICON[category ?? ''] ?? 'box'
}

/** A shelf group's word (goods.cat.*), or the catalogue's own label. */
export function groupWord(group: string, label?: string): string {
  const k = `goods.cat.${group}`
  if (hasKey(k)) return t(key(k))
  if (hasKey(`inventory.cat.${group}`)) return t(key(`inventory.cat.${group}`))
  return label || t('goods.cat.other')
}

/** A percent from basis points, in the player's digits. */
export function bpsText(bps: number): string {
  return pct(bps / 10000)
}

/** A coded notice of an area (eco.notice.<area>.<code>), with its money and counts worded. */
export function ecoNotice(area: string, code: string, args: Record<string, unknown> | null | undefined, who?: string): string {
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

// -- money -------------------------------------------------------------------------------------------------

/** A money figure's main part only (the local money when there is one, else SUP), for tight places: a book's line,
 * a row's end. The full figure (with SUP beside) is in the hero and the totals. */
export function moneyMain(n: number): string {
  const s = money(n)
  return splitMoney(s)?.[0] ?? s
}

/** A hero's figure: the main part large, the SUP under it small. */
export function BigMoney({ n }: { n: number }) {
  const s = money(n)
  const [main, sup] = splitMoney(s) ?? [s, '']
  return (
    <>
      <p className="n-big n-eco-big">{main}</p>
      {sup && <p className="n-label">{sup}</p>}
    </>
  )
}

// -- page states -------------------------------------------------------------------------------------------

/** The answer's refusal and notice, on top of any economy screen. */
export function Said({ r }: { r: CommandResponse }) {
  return (
    <>
      {r.ok === false && r.error && <Note tone="bad" icon="x_wanted">{refusalText(r.error.code, r.error.message, r.error.args)}</Note>}
      {r.notice && noticeText(r.notice) && <Note tone={r.notice.alert ? 'bad' : 'ok'} icon={r.notice.alert ? 'x_wanted' : 'm_check'}>{noticeText(r.notice)}</Note>}
    </>
  )
}

/** The page while there is no answer to draw. */
export function NoAnswer({ loading, title = '' }: { loading: boolean; title?: string }) {
  return <Page title={title}>{loading ? <Loading /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>
}

/** A service this place does not keep: why, what a settlement needs for it, and the way to the nearest one. */
export function NotHere({ u, acts, title }: { u: Unavailable; acts: Action[]; title: string }) {
  const nav = useNav()
  const { names } = useNames()
  const svc = hasKey(`eco.service.${u.service}`) ? t(key(`eco.service.${u.service}`)) : t('eco.service.unknown')
  const city = u.nearest ? names.name(['city'], u.nearest.code, u.nearest.name) : ''
  const go = find(acts, 'support.travel')
  return (
    <Page title={title}>
      <div className="n-eco-closed">
        <Icon name="m_lock" className="n-eco-closed-ic" />
        <p className="n-eco-closed-title">{u.stage === 'support' ? t('eco.na.only_support', { service: svc, place: city || t('eco.na.somewhere') }) : t('eco.na.from', { service: svc })}</p>
        {(u.requires ?? []).filter((b) => b.code).length > 0 && (
          <p className="n-eco-closed-sub">{t('eco.na.hint', { buildings: (u.requires ?? []).filter((b) => b.code).map((b) => names.name(['settlement_building'], b.code)).join('، ') })}</p>
        )}
      </div>
      {go && city && <Button block icon="plane" onClick={() => nav.act(go)}>{t('eco.na.go', { city })}</Button>}
      <More acts={acts} skip={(a) => a === go} />
    </Page>
  )
}

/** The walk to where a service is: the place and the time, with the button that goes. */
export function WalkTo({ way, acts, ghost }: { way: Way | null | undefined; acts: Action[]; ghost?: boolean }) {
  const nav = useNav()
  const n = useNames()
  if (!way) return null
  const go = find(acts, 'place.walk')
  const place = n.place(way.place)
  return (
    <div className="n-card flat n-eco-walk">
      <Icon name="walk" size={40} />
      <div className="n-eco-walk-body">
        <b>{place}</b>
        <span>{t('market.walk', { t: hms(way.walk_seconds), place })}</span>
      </div>
      {go && <Button small kind={ghost ? 'ghost' : 'cyan'} onClick={() => nav.act(go)}>{t('n.eco.go')}</Button>}
    </div>
  )
}

/** The rest of a screen's actions (not a way back, not a refresh, not what the screen drew) as rows; danger in red. */
export function More({ acts, skip, title }: { acts: Action[]; skip?: (a: Action) => boolean; title?: string }) {
  const nav = useNav()
  const list = acts.filter((a) => !isBack(a) && !isRefresh(a) && !(skip?.(a)))
  if (!list.length) return null
  const danger = list.filter((a) => a.kind === 'danger')
  const rows = list.filter((a) => a.kind !== 'danger')
  return (
    <>
      {title !== '' && rows.length > 0 && <Section title={title ?? t('next.actions')} />}
      {rows.length > 0 && <List>{rows.map((a, i) => <Row key={i} icon={actIcon(a)} title={actionLabel(a)} onClick={() => nav.act(a)} />)}</List>}
      {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{actionLabel(a)}</Button>)}
    </>
  )
}

/** The picture of a known action, else the server's icon word, else a neutral one. */
const ACT_ICON: Record<string, string> = {
  'bank.pay': 'coins', 'bank.finance': 'chart', 'bank.show': 'bank', 'pay.again': 'coins', 'social.search': 'm_search',
  'market.mine': 'checklist', 'market.auctions': 'gavel', 'market.goods': 'factory', 'market.list': 'market', 'market.book': 'trade',
  'item.bag': 'm_backpack', 'shop.open': 'market', 'shop.list': 'market', 'shops': 'market', 'market': 'trade', 'auction.mine': 'checklist',
  'auction.open': 'gavel', 'auction.house': 'gavel', 'property.mine': 'keys', 'property.market': 'house', 'property.rest': 'bed',
  'stock.open': 'chart', 'finance.portfolio': 'histogram', 'finance.exchange': 'chart', 'finance.gold': 'x_goldbar', 'finance.savings': 'x_chest',
  'support.travel': 'plane', 'place.walk': 'walk', 'payment.back': 'market',
}
export function actIcon(a: Action): string {
  return ACT_ICON[idOf(a)] ?? icon3d(a.icon && !a.icon.startsWith('action:') ? a.icon : undefined, 'eye')
}

// -- paying ------------------------------------------------------------------------------------------------

/** What the player holds beside a price: cash and bank. */
export function Purses({ p }: { p: PaymentChoice }) {
  return (
    <div className="n-eco-purses">
      <div><Icon name="coins" size={28} /><span>{t('eco.pay.cash')}</span><b>{moneyMain(p.cash)}</b></div>
      <div><Icon name="bank" size={28} /><span>{t('eco.pay.bank')}</span><b>{moneyMain(p.bank)}</b></div>
    </div>
  )
}

/** Why a way to pay is missing, in a line. */
export function payNote(p: PaymentChoice): string {
  const acc = p.accepted ?? []
  const use = p.usable ?? []
  if (acc.length === 1) return t(acc[0] === 'cash' ? 'eco.pay.cash_only' : 'eco.pay.card_only')
  if (acc.includes('cash') && acc.includes('card') && use.length === 1) return t(use[0] === 'card' ? 'eco.pay.only_card' : 'eco.pay.only_cash')
  return ''
}

/** The ways to pay one charge (payment.cash / payment.card): the first as the orange button, the other cyan; with none,
 * why, and the way to the bank. `label` words a pay button (a bid says «bid 55 in cash»). */
export function PayButtons({ acts, p, label }: { acts: Action[]; p: PaymentChoice | null | undefined; label?: (a: Action) => string }) {
  const nav = useNav()
  const pays = byId(acts, 'payment.cash', 'payment.card')
  if (!pays.length) {
    const bank = find(acts, 'bank.show')
    return (
      <>
        {p && <Note tone="bad" icon="x_wanted">{t('eco.pay.cannot', { amount: money(p.amount) })}</Note>}
        {bank && <Button block kind="cyan" icon="bank" onClick={() => nav.act(bank)}>{actionLabel(bank)}</Button>}
      </>
    )
  }
  return (
    <div className="n-eco-pays">
      {pays.map((a, i) => (
        <Button key={i} block kind={i === 0 ? 'primary' : 'cyan'} icon={idOf(a) === 'payment.card' ? 'bank' : 'coins'} onClick={() => nav.act(withArgs(a, {}))}>
          {label ? label(a) : t(idOf(a) === 'payment.card' ? 'n.eco.pay_card' : 'n.eco.pay_cash')}
        </Button>
      ))}
    </div>
  )
}

// -- a result ----------------------------------------------------------------------------------------------

/** A finished act (paid, bought, used): a big picture, what happened, the figures, then where to go next: the first
 * action as the one orange button, the rest as ghost buttons. */
export function Done({ title, icon, tone = 'ok', lead, children, acts }: {
  title: string; icon: string; tone?: 'ok' | 'bad' | 'info'; lead?: ReactNode; children?: ReactNode; acts: Action[]
}) {
  const nav = useNav()
  const next = acts.filter((a) => !isBack(a) && !isRefresh(a))
  const back = acts.find(isBack)
  return (
    <Page title={title}>
      <section className={`n-eco-done ${tone}`}>
        <span className="n-eco-done-glow" aria-hidden="true" />
        <Icon name={icon} className="n-eco-done-ic" />
        <span className="n-eco-done-badge" aria-hidden="true"><Icon name={tone === 'bad' ? 'x_wanted' : 'm_check'} size={30} /></span>
        {lead && <p className="n-eco-done-lead">{lead}</p>}
      </section>
      {children}
      {next.length > 0 && (
        <div className="n-eco-next">
          {next.map((a, i) => <Button key={i} block kind={i === 0 ? 'primary' : 'ghost'} icon={actIcon(a)} onClick={() => nav.act(a)}>{actionLabel(a)}</Button>)}
        </div>
      )}
      {back && !next.length && <Button block kind="ghost" onClick={() => nav.act(back)}>{actionLabel(back)}</Button>}
    </Page>
  )
}

/** Figures as label/value lines in one group. */
export function Facts({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  if (!rows.length) return null
  return <div className="n-rows">{rows.map((r, i) => <KV key={i} label={r.label} value={r.value} />)}</div>
}

// -- quantity ----------------------------------------------------------------------------------------------

/** How many: minus, the count large, plus, and quick chips (1, 5, 10, all). `max` 0 means no known bound. */
export function Qty({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const top = max > 0 ? max : 999
  const set = (n: number) => onChange(Math.max(1, Math.min(top, n)))
  const quick = [1, 5, 10].filter((n) => n < top)
  return (
    <div className="n-eco-qty">
      <div className="n-eco-qty-row">
        <button className="n-eco-step" aria-label={t('n.eco.less')} onClick={() => set(value - 1)} disabled={value <= 1}>−</button>
        <input className="n-eco-qty-in" inputMode="numeric" dir="ltr" aria-label={t('eco.market.qty')} value={formatNumber(value)}
          onChange={(e) => { const d = toWestern(e.target.value).replace(/\D/g, ''); set(Number(d || '1')) }} />
        <button className="n-eco-step" aria-label={t('n.eco.more')} onClick={() => set(value + 1)} disabled={value >= top}>+</button>
      </div>
      <div className="n-eco-chips">
        {quick.map((n) => <button key={n} aria-pressed={value === n} onClick={() => set(n)}>{formatNumber(n)}</button>)}
        {max > 1 && <button aria-pressed={value === max} onClick={() => set(max)}>{t('n.eco.all_n', { n: formatNumber(max) })}</button>}
      </div>
    </div>
  )
}

const FA_D = '۰۱۲۳۴۵۶۷۸۹', AR_D = '٠١٢٣٤٥٦٧٨٩'
/** Persian and Arabic digits as Western ones. */
export function toWestern(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(FA_D.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_D.indexOf(d)))
}

/** A buy (or sell) sheet: the good large, the unit price, how many, the total, and the one button. */
export function QtySheet({ title, icon, unit, max, sub, confirm, extra, onConfirm, onClose }: {
  title: string; icon: string; unit: number; max: number; sub?: ReactNode; confirm: (qty: number, total: number) => string
  extra?: ReactNode; onConfirm: (qty: number) => void; onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  const total = unit * qty
  return (
    <Sheet title={title} icon={icon} onClose={onClose}>
      {sub && <p className="n-label">{sub}</p>}
      <div className="n-eco-sheet-price">
        <span>{t('eco.market.price_each')}</span><b>{money(unit)}</b>
      </div>
      <Qty value={qty} max={max} onChange={setQty} />
      <div className="n-eco-total"><span>{t('n.eco.total')}</span><b>{money(total)}</b></div>
      {extra}
      <Buttons lead>
        <Button onClick={() => onConfirm(qty)}>{confirm(qty, total)}</Button>
        <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      </Buttons>
    </Sheet>
  )
}

/** A chip of a count left in stock: green with plenty, amber when few, red when none. */
export function StockChip({ n }: { n: number }) {
  if (n <= 0) return <Chip tone="bad">{t('eco.shops.empty')}</Chip>
  return <Chip tone={n <= 3 ? 'warn' : 'ok'}>{t('sm.mk.shop_left', { n: formatNumber(n) })}</Chip>
}
