// What the society screens share: catalogue names of places, offices and policies, the wording of a policy's value,
// players as avatars, the label of an action, and the one-sentence answer screen (stood, voted, joined, refused...).
// The server sends codes and figures; every word is this client's (src/i18n/ui.src.txt).

import type { ReactNode } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import type { GovLever, GovPlace, GovPlayer } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { useSession } from '../../../state/SessionContext'
import { seedScreen } from '../../../state/useScreen'
import { Button, Buttons, Hero, List, Note, Page, Row, hueOf, letterOf } from '../../ui'
import { icon3d } from '../../icons'
import { useContentNames, type ContentNames } from '../../../village/useVillage'
import { actionLabel } from '../../../screens/village/wording'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { words } from '../../../lib/duration'
import { fa } from '../../../ui/v6/format'
import { hasKey, isRtl, noticeText, refusalText, t, type Key } from '../../../i18n'
import './society.css'

export type Names = ContentNames
export const useNames = useContentNames

/** A word from the table when it has the key, else the fallback. */
export function word(k: string, fallback = '', params?: Record<string, string | number>): string {
  return hasKey(k) ? t(k as Key, params) : fallback
}

export const placeName = (n: Names, p: GovPlace | null | undefined): string =>
  !p ? '' : p.kind === 'city' ? n.name(['city'], p.code, p.name) : n.name(['jurisdiction', 'city'], p.code, p.name)
export const officeName = (n: Names, code: string): string => (code ? n.name(['office'], code, '') : '')
export const leverName = (n: Names, code: string): string => (code ? n.name(['lever'], code, '') : '') || t('soc.unnamed_lever')
export const cityName = (n: Names, code: string, name: string): string => n.name(['city'], code, name)

export const who = (p: GovPlayer | null | undefined): string => p?.name || p?.code || t('soc.unknown_player')
export const avatar = (name: string) => ({ letter: letterOf(name || '؟'), hue: hueOf(name || '?') })

/** A span in its two coarsest parts ("۲ روز و ۴ ساعت"). */
export const span = (s: number): string => words(s)

/** Basis points as a percent: 450 is 4.5%, kept as one left-to-right run. */
export const bps = (v: number): string => `⁦${fa((Math.round(v) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })).replace('.', isRtl() ? '٫' : '.')}%⁩`

/** A policy's value in its unit, or in its words when the policy's values are named choices. */
export function leverValue(l: Pick<GovLever, 'code' | 'type'>, v: number): string {
  const named = `soc.lv.${l.code}.${v}`
  if (hasKey(named)) return t(named as Key)
  if (l.type === 'bps') return bps(v)
  if (l.type === 'money') return money(v)
  return formatNumber(v)
}

/** The shares of an allocation, in the policy's order, the empty ones left out. */
export function allocationText(n: Names, shares: Record<string, number> | null | undefined, order: string[] | null | undefined): string {
  const codes = order && order.length ? order : Object.keys(shares ?? {}).sort()
  const parts = codes.filter((c) => (shares?.[c] ?? 0) > 0).map((c) => t('soc.alloc.share', { line: n.name(['budget_line'], c, ''), share: bps(shares![c]) }))
  return parts.length ? parts.join(t('common.sep') + ' ') : t('soc.alloc.nothing')
}

export const leverNow = (n: Names, l: GovLever): string => (l.type === 'allocation' ? allocationText(n, l.allocation, l.categories) : leverValue(l, l.value))

/** The title of an election: its usual name, or the office and the place. */
export function electionTitle(n: Names, office: string, place: GovPlace): string {
  const p = placeName(n, place)
  const k = `soc.election.name.${office}`
  return hasKey(k) ? t(k as Key, { place: p }) : t('soc.election.of', { office: officeName(n, office), place: p })
}

/** The label of a server action: the area's own word for its id (soc.act.*), else the app's. The subject (a policy,
 * an office, a crime) is named from the catalogue. */
export function label(a: Action, n?: Names): string {
  const id = a.id || ''
  const tables = id.startsWith('gov.') ? ['lever', 'office'] : id.startsWith('diplomacy.') ? ['sanction_measure', 'sanction_ground', 'jurisdiction']
    : id.startsWith('military.') ? ['jurisdiction', 'city'] : ['crime', 'city']
  const name = a.subject && n ? n.name(tables, a.subject) : a.subject ?? ''
  for (const k of [...(id ? [`soc.act.${id}`] : []), ...(a.command ? [`soc.act.${a.command}`] : [])]) if (hasKey(k)) return t(k as Key, { name })
  return actionLabel(a, n)
}

/** The actions worth a button: not back, not refresh (the shell has both). */
export function usable(r: CommandResponse | null): Action[] {
  return (r?.actions ?? []).filter((a) => a.kind !== 'back' && a.id !== 'back' && a.id !== 'refresh')
}

/** The refusal or the notice the answer carries, as a note at the top. */
export function Said({ r }: { r: CommandResponse | null }) {
  if (!r) return null
  if (r.ok === false && r.error) return <Note tone="bad" icon="x_wanted">{refusalText(r.error.code, r.error.message, r.error.args)}</Note>
  const s = r.notice ? noticeText(r.notice) : ''
  return s ? <Note tone={r.notice!.alert ? 'bad' : 'ok'} icon={r.notice!.alert ? 'x_wanted' : 'm_check'}>{s}</Note> : null
}

/** The rest of a screen's actions as rows (danger ones as red buttons at the foot). */
export function Rest({ acts, names }: { acts: Action[]; names?: Names }) {
  const nav = useNav()
  const danger = acts.filter((a) => a.kind === 'danger')
  const rows = acts.filter((a) => a.kind !== 'danger')
  return (
    <>
      {rows.length > 0 && <List>{rows.map((a, i) => <Row key={i} icon={icon3d(rowIcon(a), 'eye')} title={label(a, names)} onClick={() => nav.act(a)} />)}</List>}
      {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{label(a, names)}</Button>)}
    </>
  )
}

const ROW_ICON: Record<string, string> = {
  election: 'vote', faction: 'x_flag', gov: 'gavel', law: 'f_scales', city: 'coins', military: 'swords', settlement: 'x_scroll', social: 'society',
  bank: 'bank', inbox: 'inbox', diplomacy: 'world', player: 'person', map: 'x_map',
}
function rowIcon(a: Action): string {
  if (a.id === 'gov.history' || a.command === 'gov.history') return 'x_scroll'
  if (a.id === 'gov.my_office' || a.command === 'gov.office') return 'x_crown'
  if (a.command === 'city.budget') return 'coins'
  if (a.command === 'law.list') return 'f_scales'
  return ROW_ICON[(a.command ?? '').split('.')[0]] ?? 'eye'
}

/** Runs a screen's own «yes» without asking again: the screen itself is the question (a confirm screen), so the
 * shell's are-you-sure sheet would ask twice. Anything with an input still goes through the shell. */
export function useYes(): (a: Action) => void {
  const nav = useNav()
  const { exec } = useSession()
  return (a: Action) => {
    if (!a.command || a.input || a.url) { nav.act(a); return }
    const cmd = a.command, args = a.args ?? {}
    void exec(cmd, args).then((res) => { if (!res) return; seedScreen(cmd, args, res); nav.run(cmd, args) })
  }
}

/** An answer of one sentence (stood, voted, invited, refused...): a hero with an icon and the sentence, a line or two
 * under it, then what the server offers next. The first forward action is the orange one. */
export function Outcome({ response, title, icon, lead, lines, tone, names, yes, children }: {
  response: CommandResponse | null; title: string; icon: string; lead: ReactNode; lines?: ReactNode[]; tone?: 'ok' | 'bad'; names?: Names; children?: ReactNode
  /** the action that says yes, when the screen asks something (else the server's confirm or primary one) */
  yes?: (a: Action) => boolean
}) {
  const nav = useNav()
  const go = useYes()
  const acts = usable(response)
  const confirm = acts.find((a) => (yes ? yes(a) : a.kind === 'confirm' || a.kind === 'primary'))
  const rest = acts.filter((a) => a !== confirm)
  return (
    <Page title={title}>
      <Hero art={icon}>
        <div className="n-soc-out">
          <p className={`n-soc-lead${tone ? ' ' + tone : ''}`}>{lead}</p>
          {(lines ?? []).filter(Boolean).map((l, i) => <p key={i} className="n-label n-soc-line">{l}</p>)}
        </div>
      </Hero>
      {children}
      {confirm && (
        <Buttons lead>
          <Button kind={tone === 'bad' ? 'danger' : 'primary'} onClick={() => go(confirm)}>{label(confirm, names)}</Button>
          <Button kind="ghost" onClick={() => nav.back()}>{t('common.cancel')}</Button>
        </Buttons>
      )}
      <Rest acts={rest} names={names} />
    </Page>
  )
}

/** The pager of a long list: two small buttons. */
export function Pager({ acts }: { acts: Action[] }) {
  const nav = useNav()
  const pages = acts.filter((a) => a.id === 'page.prev' || a.id === 'page.next')
  if (!pages.length) return null
  return <Buttons>{pages.map((a, i) => <Button key={i} kind="ghost" small onClick={() => nav.act(a)}>{label(a)}</Button>)}</Buttons>
}

export const isPager = (a: Action) => a.id === 'page.prev' || a.id === 'page.next'
