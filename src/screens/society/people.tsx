// People and boards: the friend list, a search for one player, and the leaderboards. A search names
// exactly one player by an exact identifier and never shows an account's Telegram id.

import { useEffect, useState } from 'react'
import * as api from '../../api/client'
import type { Action } from '../../api/types'
import Popup, { ActionButton, Hero, Medallion, Note } from '../../ui/Popup'
import { PRow, CardGrid } from '../../ui/v6/panel'
import type { FlowCtx } from '../village/flow'
import type { BoardView, FriendAcceptedView, FriendDetailView, FriendLine, FriendRemoveAskView, FriendRemovedView, FriendRequestedView, FriendsView, SearchView } from '../../api/views.gen'
import { Chip, ListRow, Segmented } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { money } from '../native/kit/format'
import { t } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest } from '../village/flow'
import { screen } from './host'
import { Pager } from './governance'
import { key, word } from './common'

/** The search the empty friend list promises: a code or a username, answered by one player (`social.search`). */
function SearchBox({ ctx }: { ctx: FlowCtx }) {
  const [q, setQ] = useState('')
  const go = () => { const query = q.trim(); if (query) ctx.go({ kind: 'navigation', command: 'social.search', args: { query } }) }
  return (
    <form className="vf-stack" onSubmit={(e) => { e.preventDefault(); go() }}>
      <input className="sc-input" dir="ltr" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.search.placeholder')} aria-label={t('friends.search.title')} />
      <Slab tone="gold" radius={12} lip={3} disabled={ctx.busy || !q.trim()} onClick={go}>{t('friends.search.go')}</Slab>
    </form>
  )
}

const name = (n: string) => n || t('soc.unknown_player')

/** A friend, opened as the v6 centred popup. The card is the server's (`social.friend.view`: code, faction, whether I may
 * invite), and so are its actions: pay, invite to my faction, remove. A pending or blocked edge has no card. */
function FriendPopup({ f, ctx, onClose }: { f: FriendLine; ctx: FlowCtx; onClose: () => void }) {
  const [card, setCard] = useState<{ v: FriendDetailView | null; acts: Action[] } | null>(null)
  const open = ctx.acts.find((a) => a.id === 'social.friend_view' && a.args?.player === f.id)
  const accept = ctx.acts.find((a) => a.id === 'social.accept' && a.args?.player === f.id)
  useEffect(() => {
    if (!open?.command) { setCard({ v: null, acts: [] }); return }
    let live = true
    void api.runCommand(open.command, open.args ?? {}).then((r) => { if (live) setCard({ v: (r.view as unknown as FriendDetailView) ?? null, acts: r.actions ?? [] }) }).catch(() => { if (live) setCard({ v: null, acts: [] }) })
    return () => { live = false }
  }, [open?.command, open?.args?.player]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = (a: Action) => { onClose(); ctx.go(a) }
  const pay = card?.acts.find((a) => a.id === 'social.pay')
  const invite = card?.acts.find((a) => a.id === 'social.friend_invite')
  const remove = card?.acts.find((a) => a.id === 'social.friend_remove')
  return (
    <Popup open onClose={onClose} title={name(f.name)} tone="gold">
      <Hero><Medallion icon="person" palette={f.status === 'blocked' ? 'ruby' : 'emerald'} ring="#f4c441" chip={card?.v?.code || f.code || undefined} /></Hero>
      {card?.v?.faction && <Note>{t('soc.friends.faction')}: {card.v.faction}</Note>}
      {accept && <ActionButton tone="gold" disabled={ctx.busy} onClick={() => go(accept)}>{t('soc.act.social.accept', { name: name(f.name) })}</ActionButton>}
      {pay && <ActionButton tone="gold" onClick={() => go(pay)}>{t('soc.friends.pay')}</ActionButton>}
      {invite && <ActionButton tone="steel" onClick={() => go(invite)}>{t('soc.friends.invite')}</ActionButton>}
      {card && !invite && card.v && !card.v.faction && <Note>{t('soc.friends.invite_hint')}</Note>}
      {remove && <ActionButton tone="red" small onClick={() => go(remove)}>{t('soc.act.social.friend_remove')}</ActionButton>}
      {!card && <Note>…</Note>}
      {card && !card.v && !accept && <Note>{f.status === 'blocked' ? t('soc.friends.blocked') : t('soc.friends.pending')}</Note>}
    </Popup>
  )
}

const Friends = screen<FriendsView>(({ view: v, ctx }) => {
  const friends = v.friends ?? []
  const accept = ctx.acts.filter((a) => a.id === 'social.accept')
  const [open, setOpen] = useState<FriendLine | null>(null)
  return (
    <Page title={t('soc.friends.title')} tone="emerald">
      {friends.length === 0 && <Panel tone="emerald"><Lead>{t('soc.friends.empty')}</Lead></Panel>}
      <SearchBox ctx={ctx} />
      <CardGrid>
        {friends.map((f) => {
          const act = accept.find((a) => a.args?.player === f.id)
          const incoming = f.incoming && f.status === 'pending'
          const sub = incoming ? t('soc.friends.incoming') : f.status === 'pending' ? t('soc.friends.pending') : f.status === 'blocked' ? t('soc.friends.blocked') : undefined
          return <PRow key={f.id} icon="person" title={name(f.name)} sub={sub} tone={incoming ? 'busy' : undefined} badge={act ? t('soc.friends.answer') : undefined} onClick={() => setOpen(f)} />
        })}
      </CardGrid>
      {friends.length > 0 && <Pager ctx={ctx} page={v.page} pages={v.pages} />}
      <Rest ctx={ctx} skip={(a) => a.id === 'social.accept' || a.id === 'social.friend_view' || a.id === 'page.prev' || a.id === 'page.next'} />
      {open && <FriendPopup f={open} ctx={ctx} onClose={() => setOpen(null)} />}
    </Page>
  )
})

const Search = screen<SearchView>(({ view: v, ctx }) => {
  const f = v.found
  return (
    <Page title={t('soc.search.title')} tone="sapphire">
      <SearchBox ctx={ctx} />
      <Panel tone="sapphire">
        {v.help && <Lead>{t('soc.search.help')}</Lead>}
        {!v.help && !f && <Lead>{word(`soc.search.not_found.${v.by}`, t('soc.search.help'), { query: v.query })}</Lead>}
        {f && (
          <>
            <Facts rows={[
              { label: t('soc.search.player'), value: name(f.name), gold: true },
              ...(f.code ? [{ label: t('soc.search.code'), value: f.code }] : []),
            ]} />
            {f.self && <Hint>{t('soc.search.self')}</Hint>}
            <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'social.add_friend' || a.id === 'social.pay')} row />
          </>
        )}
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id === 'social.add_friend' || a.id === 'social.pay'} />
    </Page>
  )
})

/** One friend: who they are, and what to do with them (pay, invite to my faction, remove). */
const FriendDetail = screen<FriendDetailView>(({ view: v, ctx }) => {
  const mine = (a: { id?: string }) => a.id === 'social.pay' || a.id === 'social.friend_invite' || a.id === 'social.friend_remove'
  return (
    <Page title={name(v.name)} tone="emerald">
      <Panel tone="emerald">
        <Facts rows={[
          ...(v.code ? [{ label: t('soc.friends.code'), value: v.code }] : []),
          ...(v.faction ? [{ label: t('soc.friends.faction'), value: v.faction }] : []),
        ]} />
        {!v.can_invite && !v.faction && <Hint>{t('soc.friends.invite_hint')}</Hint>}
        <Btns ctx={ctx} list={ctx.acts.filter(mine)} row />
      </Panel>
      <Rest ctx={ctx} skip={mine} />
    </Page>
  )
})

const FriendRemoveAsk = screen<FriendRemoveAskView>(({ view: v, ctx }) => (
  <Page title={t('soc.friends.remove_title')} tone="ruby">
    <Panel tone="ruby"><Lead>{t('soc.friends.ask_remove', { name: name(v.name) })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FriendRemoved = screen<FriendRemovedView>(({ view: v, ctx }) => (
  <Page title={t('soc.friends.remove_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{t('soc.friends.removed', { name: name(v.name) })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FriendRequested = screen<FriendRequestedView>(({ view: v, ctx }) => (
  <Page title={t('soc.friends.requested_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{v.name ? t('soc.friends.requested', { player: v.name }) : t('soc.friends.requested_anon')}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FriendAccepted = screen<FriendAcceptedView>(({ view: v, ctx }) => (
  <Page title={t('soc.friends.accepted_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{v.name ? t('soc.friends.accepted', { player: v.name }) : t('soc.friends.accepted_anon')}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- the boards -----------------------------------------------------------------------------------------

const BOARDS = ['richest', 'companies', 'cities', 'workers', 'investors']

const Leaderboard = screen<BoardView>(({ view: v, ctx }) => {
  // the other boards: the server names them `board.tab`, with the board as the subject or the argument; every other
  // `life.top` action is the same screen again (refresh) and is never drawn as a button of its own
  const isTop = (a: { command?: string }) => a.command === 'life.top'
  const tabs = ctx.acts.filter((a) => a.id === 'board.tab' || (isTop(a) && !!(a.subject || a.args?.board)))
  const boardOf = (a: { subject?: string; args?: Record<string, string> }) => a.args?.board ?? a.subject
  // a player who lives in a settlement sees their neighbours' board first
  const boards = v.village ? ['village', ...BOARDS] : BOARDS
  const open = (b: string) => {
    const a = tabs.find((x) => boardOf(x) === b)
    if (a) ctx.go(a)
  }
  const label = (l: BoardView['lines'] extends (infer U)[] | null ? U : never): string => {
    if (v.board === 'cities') return ctx.names.name(['city'], l.code, l.name)
    return l.name || t('soc.unknown_player')
  }
  const tag = (l: NonNullable<BoardView['lines']>[number]): string => {
    switch (v.board) {
      case 'village':
      case 'richest': return v.ranks?.[l.tag] ? ctx.names.name(['rank'], l.tag, v.ranks[l.tag].name) : ''
      case 'companies': return `${ctx.names.name(['company_type'], l.tag, l.tag_name)} – ${ctx.names.name(['city'], l.city.code, l.city.name)}`
      case 'workers': return l.tag ? ctx.names.name(['career'], l.tag, l.tag_name) : t('soc.board.no_job')
      default: return l.tag_name
    }
  }
  const value = (l: NonNullable<BoardView['lines']>[number]): string => (v.board === 'richest' || v.board === 'village' || v.board === 'companies' ? money(l.value) : formatNumber(l.value))
  return (
    <Page title={v.board === 'village' ? t('soc.board.village', { place: v.village?.name ?? '' }) : t(key(`soc.board.${v.board}`))} tone="gold">
      <Segmented wrap options={boards.map((b) => ({ key: b, label: t(key(`soc.board.tab.${b}`)) }))} value={v.board} onChange={open} />
      <div className="vf-stack">
        {(v.lines ?? []).length === 0 && <Panel><Lead>{t('soc.board.empty')}</Lead></Panel>}
        {(v.lines ?? []).map((l) => (
          <ListRow key={`${l.position}-${l.code}`} icon="trophy" palette={l.mine ? 'gold' : 'steel'} tone={l.mine ? 'gold' : undefined}
            title={`${formatNumber(l.position)}. ${label(l)}${l.mine ? ` ${t('soc.you')}` : ''}`} sub={tag(l) || undefined}
            right={<Chip>{value(l)}</Chip>} />
        ))}
      </div>
      <Hint>{t(key(`soc.board.hint.${v.board}`))}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'board.tab' || isTop(a)} />
    </Page>
  )
})

export const PEOPLE_SCREENS = { friends: Friends, search: Search, friend_requested: FriendRequested, friend_accepted: FriendAccepted, friend_detail: FriendDetail, friend_remove_ask: FriendRemoveAsk, friend_removed: FriendRemoved, leaderboard: Leaderboard }
