// The «فعالیت» area's shared pieces: finding the server's actions, the content names, a page with a back button,
// a result hero, a list of conditions, payment buttons and the leftover actions. Pure presentation over the parts
// in ../../ui; every figure comes from the server's view.

import type { ReactNode } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import type { PaymentChoice } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, List, Loading, Note, Page, Row, Section } from '../../ui'
import { icon3d } from '../../icons'
import { hasKey, noticeText, refusalText, t, type Key } from '../../../i18n'
import { actionLabel } from '../../../screens/village/wording'
import { useContentNames, type ContentNames } from '../../../village/useVillage'
import { formatNumber, money, splitMoney } from '../../../screens/native/kit/format'
import { hasNativeBack } from '../../../lib/nativeBack'
import { fa } from '../../../ui/v6/format'
import './activity.css'

export type { ContentNames }
export { useContentNames }

// -- words ---------------------------------------------------------------------------------------------------

/** A key that may not exist (a code the server sends): its words, else the fallback. */
export function tk(key: string, fallback = '', params?: Record<string, string | number>): string {
  return hasKey(key) ? t(key as Key, params) : fallback
}

/** A basis-points share as a percent («۶۲٪»). */
export const pctOf = (bps: number): string => fa(`${Math.round(bps) / 100}%`)

/** A signed basis-points share («+۱۴٪», «−۶٪»). */
export const signedPct = (bps: number): string => `\u200E${bps > 0 ? '+' : bps < 0 ? '−' : ''}${pctOf(Math.abs(bps))}`

/** «a تا b», or one figure when both ends are the same. */
export const range = (a: string, b: string): string => (a === b ? a : t('ac.crime.range', { a, b }))

export const n = (x: number): string => formatNumber(x)

/** Money for a tight spot (a chip, a button, a tile): the player's own money only when they have a chartered one, else
 * the plain amount. `money()` is the source; the SUP twin is left to the places with room (`MoneyBig`). */
export function cash(x: number): string {
  const m = money(x)
  return (splitMoney(m)?.[0] ?? m).trim()
}

/** A plus before a figure that stays on its left in a right-to-left line («+۱۲۰»). */
export const plus = (s: string): string => `\u200E+${s}`

/** A large money figure: the amount, its SUP twin small under it when the player has a money of their own. */
export function MoneyBig({ amount, sign }: { amount: number; sign?: '+' | '−' }) {
  const m = money(amount)
  const [main, sup] = splitMoney(m) ?? [m, '']
  return <>{sign ? `\u200E${sign}` : ''}{main.trim()}{sup && <small className="n-act-sup">{sup}</small>}</>
}

/** A city's name from the catalogue, the authored name last. */
export const cityName = (names: ContentNames, code: string, authored: string): string => (code ? names.name('city', code, authored) : authored)

/** A travel quote («کرایه ۱۲۰ ساپ – ۱۵ دقیقه راه»), '' when the server sent none. */
export function tripText(trip: { fare: number; wait_seconds: number } | null | undefined, rough: (s: number) => string): string {
  return trip ? t('trip.hint', { fare: money(trip.fare), wait: rough(trip.wait_seconds) }) : ''
}

// -- actions -------------------------------------------------------------------------------------------------

/** The name of an action: its id, or its command when the server left the id out (an id equal to its command). */
export const idOf = (a: Action): string => a.id || a.command || ''
const isBack = (a: Action) => a.kind === 'back' || a.id === 'back'
const isRefresh = (a: Action) => a.id === 'refresh'

/** The answer's actions, by name. Back and refresh are the shell's (the back button, the pull to read again). */
export function useActs(response: CommandResponse | null) {
  const names = useContentNames()
  const all = (response?.actions ?? []).filter((a) => !isBack(a) && !isRefresh(a))
  return {
    all,
    names,
    /** the first action of a name, optionally the one that also matches */
    find: (id: string, match?: (a: Action) => boolean) => all.find((a) => idOf(a) === id && (!match || match(a))),
    /** every action of a name */
    every: (id: string) => all.filter((a) => idOf(a) === id),
    /** the action for one content code (its subject or one of its args) */
    of: (id: string, code: string) => all.find((a) => idOf(a) === id && (a.subject === code || Object.values(a.args ?? {}).includes(code))),
    /** everything except the names given (and except what `skip` drops) */
    rest: (ids: string[], skip?: (a: Action) => boolean) => all.filter((a) => !ids.includes(idOf(a)) && !(skip?.(a))),
    label: (a: Action) => actionLabel(a, names),
  }
}
export type Acts = ReturnType<typeof useActs>

// -- the page ------------------------------------------------------------------------------------------------

/** A screen of this area: the large title, a back button outside Telegram (inside it Telegram's own is the way back),
 * the refusal or the notice the answer carries first. */
export function ActPage({ title, sub, art, response, children }: { title: ReactNode; sub?: ReactNode; art?: string; response?: CommandResponse | null; children: ReactNode }) {
  const nav = useNav()
  return (
    <Page title={title} sub={sub} art={art} onBack={!nav.atRoot && !hasNativeBack() ? nav.back : undefined}>
      {response && <Said response={response} />}
      {children}
    </Page>
  )
}

/** The refusal or the notice of an answer, as a note above the screen. */
export function Said({ response }: { response: CommandResponse }) {
  if (response.ok === false && response.error) return <Note tone="bad" icon="x_wanted">{refusalText(response.error.code, response.error.message, response.error.args)}</Note>
  if (response.notice) {
    const text = noticeText(response.notice)
    return text ? <Note tone={response.notice.alert ? 'bad' : 'ok'} icon={response.notice.alert ? 'x_wanted' : 'm_check'}>{text}</Note> : null
  }
  return null
}

/** The page while there is no view yet, or when the answer carries none. */
export function NoView({ title, loading }: { title: string; loading: boolean }) {
  return <ActPage title={title}>{loading ? <Loading /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</ActPage>
}

// -- results -------------------------------------------------------------------------------------------------

/** The hero of a result: a glow by its tone (a win green, a loss red), a 3D icon, a small line above, the big line,
 * chips under it. */
export function ResultHero({ tone = 'win', art, kicker, big, sub, chips }: { tone?: 'win' | 'loss' | 'plain'; art: string; kicker?: ReactNode; big: ReactNode; sub?: ReactNode; chips?: ReactNode }) {
  return (
    <div className={`n-act-result ${tone}`}>
      <span className="n-act-result-glow" aria-hidden="true" />
      <Icon name={art} className="n-act-result-art" />
      {kicker && <p className="n-act-result-kicker">{kicker}</p>}
      <p className="n-act-result-big">{big}</p>
      {sub && <p className="n-act-result-sub">{sub}</p>}
      {chips && <div className="n-chips n-act-result-chips">{chips}</div>}
    </div>
  )
}

/** The top card of a screen about one thing (a job, a course, a crime): its icon, a small line, the name large, chips. */
export function ThingHero({ art, kicker, title, chips, children }: { art: string; kicker?: ReactNode; title: ReactNode; chips?: ReactNode; children?: ReactNode }) {
  return (
    <Hero art={art}>
      {kicker && <p className="n-label">{kicker}</p>}
      <p className="n-big n-act-name">{title}</p>
      {chips && <div className="n-chips n-hero-line">{chips}</div>}
      {children}
    </Hero>
  )
}

/** A card that is one tap (a mission on a board, my current job): the card's look on a real button. */
export function TapCard({ children, tone, dim, onClick }: { children: ReactNode; tone?: 'lit' | 'bad'; dim?: boolean; onClick: () => void }) {
  return <button className={`n-card n-act-tap${tone ? ' ' + tone : ''}${dim ? ' n-act-off' : ''}`} onClick={onClick}>{children}</button>
}

// -- conditions ----------------------------------------------------------------------------------------------

export interface Cond { met: boolean; text: string; sub?: string; end?: ReactNode }

/** Conditions, met or not: a green tick or a lock, the words, what is still missing in red. */
export function Conds({ title, items }: { title?: string; items: Cond[] }) {
  if (!items.length) return null
  return (
    <>
      {title && <Section title={title} note={t('n.act.conds_met', { a: n(items.filter((c) => c.met).length), b: n(items.length) })} />}
      <List>
        {items.map((c, i) => (
          <Row key={i} icon={c.met ? 'm_check' : 'm_lock'} title={c.text} sub={c.sub}
            end={c.end ?? <Chip tone={c.met ? 'ok' : 'bad'}>{c.met ? t('ac.crime.req.met') : t('ac.crime.req.miss')}</Chip>} />
        ))}
      </List>
    </>
  )
}

// -- payment -------------------------------------------------------------------------------------------------

/** Paying for something: the amount, what the player has, one button per way to pay (the first the orange one) or
 * the way to the bank when no way is open. The pay actions are `pay.cash` / `pay.card`. */
export function PayBox({ payment, acts, title }: { payment: PaymentChoice; acts: Acts; title?: string }) {
  const nav = useNav()
  const pays = acts.all.filter((a) => idOf(a).startsWith('pay.'))
  const bank = acts.find('bank')
  const can = (payment.usable ?? []).length > 0
  return (
    <div className="n-card n-act-pay">
      <div className="n-act-pay-head">
        <span>{title ?? t('n.act.pay.total')}</span>
        <b><MoneyBig amount={payment.amount} /></b>
      </div>
      <div className="n-chips">
        <Chip><Icon name="x_cash" size={18} />{t('ac.crime.pay.cash')}: {cash(payment.cash)}</Chip>
        <Chip><Icon name="bank" size={18} />{t('ac.crime.pay.bank')}: {cash(payment.bank)}</Chip>
      </div>
      {!can && <p className="n-why">{t('n.act.pay.short')}</p>}
      {pays.length > 0 && (
        <Buttons>
          {pays.map((a, i) => <Button key={idOf(a)} kind={i === 0 ? 'primary' : 'cyan'} icon={idOf(a) === 'pay.card' ? 'bank' : 'x_cash'} onClick={() => nav.act(a)}>{tk(`lf.${idOf(a)}`, acts.label(a))}</Button>)}
        </Buttons>
      )}
      {!can && bank && <Button kind="ghost" block icon="bank" onClick={() => nav.act(bank)}>{acts.label(bank)}</Button>}
    </div>
  )
}

// -- the rest ------------------------------------------------------------------------------------------------

/** The actions a screen does not draw itself: rows with their 3D icon (danger ones as red buttons, the pager as two
 * small buttons). */
export function MoreActs({ acts, list, title }: { acts: Acts; list: Action[]; title?: string }) {
  const nav = useNav()
  const pager = list.filter((a) => idOf(a) === 'page.prev' || idOf(a) === 'page.next')
  const danger = list.filter((a) => a.kind === 'danger' && !pager.includes(a))
  const rows = list.filter((a) => !pager.includes(a) && !danger.includes(a))
  return (
    <>
      {pager.length > 0 && <Buttons>{pager.map((a) => <Button key={idOf(a)} kind="ghost" small onClick={() => nav.act(a)}>{acts.label(a)}</Button>)}</Buttons>}
      {rows.length > 0 && (
        <>
          {title && <Section title={title} />}
          <List>{rows.map((a, i) => <Row key={i} icon={ICON_OF[idOf(a)] ?? icon3d(a.icon?.startsWith('action:') ? undefined : a.icon, 'eye')} title={acts.label(a)} onClick={() => nav.act(a)} />)}</List>
        </>
      )}
      {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{acts.label(a)}</Button>)}
    </>
  )
}

/** The pager of a list: «صفحهٔ ۱ از ۲» between two small buttons. */
export function Pager({ acts, page, pages }: { acts: Acts; page: number; pages: number }) {
  const nav = useNav()
  if (pages <= 1) return null
  const prev = acts.find('page.prev')
  const next = acts.find('page.next')
  return (
    <div className="n-act-pager">
      <Button kind="ghost" small disabled={!prev} onClick={() => prev && nav.act(prev)}>{t('n.act.prev')}</Button>
      <span>{t('ac.work.openings.page', { a: n(page), b: n(pages) })}</span>
      <Button kind="ghost" small disabled={!next} onClick={() => next && nav.act(next)}>{t('n.act.next')}</Button>
    </div>
  )
}

/** The 3D icon of the actions this area's screens leave to the rest list. */
const ICON_OF: Record<string, string> = {
  'job.mine': 'work', 'job.openings': 'm_search', 'job.work': 'work', 'job.work_again': 'work', 'job.quit': 'm_stop',
  'education.open': 'study', 'health.hospital': 'hospital', 'crime.hub': 'crime', 'crime.jail': 'handcuffs', 'crime.record': 'checklist',
  'crime.cases': 'f_scales', 'crime.again': 'crime', 'mission.mine': 'missions', 'mission.boards': 'checklist', 'bank': 'bank',
  'profile.map': 'x_map', map: 'x_map', education: 'study',
}
