// دوستان: the friend list (requests to answer first, then friends, then the requests I sent), a search for one player
// by an exact code or username, a friend's card (pay, invite to my faction, remove) and the short answers. Every
// button is an action the server sent; a pending or blocked friend has no card.

import { useState, type ReactNode } from 'react'
import type { NScreenProps } from '../../registry'
import type { Action } from '../../../api/types'
import type { FriendAcceptedView, FriendDetailView, FriendLine, FriendRemoveAskView, FriendRemovedView, FriendRequestedView, FriendsView, SearchView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, List, Loading, Note, Page, Section } from '../../ui'
import { formatNumber } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { avatar, isPager, label, Outcome, Pager, Rest, Said, usable, word } from './common'

const nameOf = (n: string) => n || t('soc.unknown_player')

/** The search box: a code or a username, answered by one player (`social.search`). */
function SearchBox({ initial = '' }: { initial?: string }) {
  const nav = useNav()
  const [q, setQ] = useState(initial)
  const go = () => { const query = q.trim(); if (query) nav.run('social.search', { query }) }
  return (
    <form className="n-soc-search" onSubmit={(e) => { e.preventDefault(); go() }} role="search">
      <Icon name="m_search" className="n-soc-search-ic" />
      <input className="n-input" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.search.placeholder')} aria-label={t('friends.search.title')} />
      <Button kind="cyan" small disabled={!q.trim()} onClick={go}>{t('friends.search.go')}</Button>
    </form>
  )
}

/** One person as a row: the avatar letter, the name, a line, and one round button at the end. */
function PersonRow({ name, sub, chip, end, button }: { name: string; sub?: string; chip?: ReactNode; end?: ReactNode; button?: { icon: string; label: string; onClick: () => void } }) {
  const av = avatar(name)
  return (
    <div className="n-row">
      <span className="n-row-av" style={{ background: `hsl(${av.hue} 42% 38%)` }}>{av.letter}</span>
      <span className="n-row-body">
        <span className="n-row-title">{name}</span>
        {sub && <span className="n-row-sub">{sub}</span>}
      </span>
      {chip}
      {end}
      {button && <button className="n-soc-round" aria-label={button.label} onClick={button.onClick}><Icon name={button.icon} /></button>}
    </div>
  )
}

export function Friends({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <Page title={t('soc.friends.title')}>{loading ? <Loading blocks={[56, 64, 64, 64]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as Partial<FriendsView>
  const acts = usable(response)
  const friends = v.friends ?? []
  const accept = (f: FriendLine) => acts.find((a) => a.id === 'social.accept' && a.args?.player === f.id)
  const view = (f: FriendLine) => acts.find((a) => a.id === 'social.friend_view' && a.args?.player === f.id)
  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming)
  const mine = friends.filter((f) => f.status === 'accepted')
  const waiting = friends.filter((f) => !mine.includes(f) && !incoming.includes(f))
  const used = (a: Action) => a.id === 'social.accept' || a.id === 'social.friend_view' || isPager(a)

  return (
    <Page title={t('soc.friends.title')} sub={mine.length ? t('n.soc.friends.count', { n: formatNumber(mine.length) }) : undefined}>
      <Said r={response} />
      <SearchBox />
      {friends.length === 0 && <Empty icon="society">{t('soc.friends.empty')}</Empty>}

      {incoming.length > 0 && (
        <>
          <Section title={t('n.soc.friends.requests')} note={formatNumber(incoming.length)} />
          <List>
            {incoming.map((f) => {
              const a = accept(f)
              return <PersonRow key={f.id} name={nameOf(f.name)} sub={t('soc.friends.incoming')}
                end={a ? <Button kind="cyan" small icon="f_hands" onClick={() => nav.act(a)}>{t('soc.act.faction.accept')}</Button> : undefined} />
            })}
          </List>
        </>
      )}

      {mine.length > 0 && (
        <>
          <Section title={t('n.soc.friends.mine')} note={formatNumber(mine.length)} />
          <List>
            {mine.map((f) => {
              const a = view(f)
              return (
                <PersonRow key={f.id} name={nameOf(f.name)} sub={f.code || undefined}
                  button={a ? { icon: 'person', label: t('n.soc.friends.open', { name: nameOf(f.name) }), onClick: () => nav.act(a) } : undefined} />
              )
            })}
          </List>
        </>
      )}

      {waiting.length > 0 && (
        <>
          <Section title={t('n.soc.friends.waiting')} />
          <List>
            {waiting.map((f) => (
              <PersonRow key={f.id} name={nameOf(f.name)}
                chip={f.status === 'blocked' ? <Chip tone="bad">{t('soc.friends.blocked')}</Chip> : <Chip>{t('soc.friends.pending')}</Chip>} />
            ))}
          </List>
        </>
      )}
      <Pager acts={acts} />
      <Rest acts={acts.filter((a) => !used(a))} />
    </Page>
  )
}

export function Search({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <Page title={t('soc.search.title')}>{loading ? <Loading blocks={[56, 160]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as Partial<SearchView>
  const acts = usable(response)
  const add = acts.find((a) => a.id === 'social.add_friend')
  const pay = acts.find((a) => a.id === 'social.pay')
  const f = v.found
  return (
    <Page title={t('soc.search.title')}>
      <Said r={response} />
      <SearchBox initial={v.query ?? ''} />
      {v.help && <Note tone="info" icon="m_search">{t('soc.search.help')}</Note>}
      {!v.help && !f && <Empty icon="m_search">{word(`soc.search.not_found.${v.by ?? ''}`, t('soc.search.help'), { query: v.query ?? '' })}</Empty>}
      {f && (
        <Hero>
          <div className="n-soc-who">
            <span className="n-soc-bigav" style={{ background: `hsl(${avatar(f.name).hue} 46% 40%)` }}>{avatar(nameOf(f.name)).letter}</span>
            <div>
              <p className="n-big">{nameOf(f.name)}</p>
              {f.code && <Chip><span className="n-ltr">{f.code}</span></Chip>}
            </div>
          </div>
          {f.self && <p className="n-label n-soc-line">{t('soc.search.self')}</p>}
          {(add || pay) && (
            <div className="n-hero-foot">
              <Buttons>
                {add && <Button icon="society" onClick={() => nav.act(add)}>{label(add)}</Button>}
                {pay && <Button kind="cyan" icon="coins" onClick={() => nav.act(pay)}>{label(pay)}</Button>}
              </Buttons>
            </div>
          )}
        </Hero>
      )}
      <Rest acts={acts.filter((a) => a !== add && a !== pay)} />
    </Page>
  )
}

export function FriendDetail({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <Page title={t('soc.friends.title')}>{loading ? <Loading blocks={[180, 64]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as Partial<FriendDetailView>
  const acts = usable(response)
  const pay = acts.find((a) => a.id === 'social.pay')
  const invite = acts.find((a) => a.id === 'social.friend_invite')
  const remove = acts.find((a) => a.id === 'social.friend_remove')
  const name = nameOf(v.name ?? '')
  return (
    <Page title={name}>
      <Said r={response} />
      <Hero>
        <div className="n-soc-who">
          <span className="n-soc-bigav" style={{ background: `hsl(${avatar(name).hue} 46% 40%)` }}>{avatar(name).letter}</span>
          <div>
            <p className="n-big">{name}</p>
            <div className="n-chips">
              {v.code && <Chip><span className="n-ltr">{v.code}</span></Chip>}
              {v.faction && <Chip tone="accent"><Icon name="x_flag" size={16} />{v.faction}</Chip>}
            </div>
          </div>
        </div>
        {(pay || invite) && (
          <div className="n-hero-foot">
            <Buttons>
              {pay && <Button icon="coins" onClick={() => nav.act(pay)}>{t('soc.friends.pay')}</Button>}
              {invite && <Button kind="cyan" icon="x_flag" onClick={() => nav.act(invite)}>{t('soc.friends.invite')}</Button>}
            </Buttons>
          </div>
        )}
      </Hero>
      {!v.can_invite && !v.faction && <Note tone="info" icon="x_flag">{t('soc.friends.invite_hint')}</Note>}
      <Rest acts={acts.filter((a) => a !== pay && a !== invite && a !== remove)} />
      {remove && <Button kind="danger" block onClick={() => nav.act(remove)}>{label(remove)}</Button>}
    </Page>
  )
}

export function FriendRemoveAsk({ response }: NScreenProps) {
  const v = (response?.view ?? {}) as Partial<FriendRemoveAskView>
  return <Outcome response={response} title={t('soc.friends.remove_title')} icon="society" tone="bad" lead={t('soc.friends.ask_remove', { name: nameOf(v.name ?? '') })}
    yes={(a) => a.id === 'social.friend_remove_yes'} />
}

export function FriendRemoved({ response }: NScreenProps) {
  const v = (response?.view ?? {}) as Partial<FriendRemovedView>
  return <Outcome response={response} title={t('soc.friends.remove_title')} icon="society" lead={t('soc.friends.removed', { name: nameOf(v.name ?? '') })} />
}

export function FriendRequested({ response }: NScreenProps) {
  const v = (response?.view ?? {}) as Partial<FriendRequestedView>
  return <Outcome response={response} title={t('soc.friends.requested_title')} icon="x_send" tone="ok"
    lead={v.name ? t('soc.friends.requested', { player: v.name }) : t('soc.friends.requested_anon')} />
}

export function FriendAccepted({ response }: NScreenProps) {
  const v = (response?.view ?? {}) as Partial<FriendAcceptedView>
  return <Outcome response={response} title={t('soc.friends.accepted_title')} icon="f_hands" tone="ok"
    lead={v.name ? t('soc.friends.accepted', { player: v.name }) : t('soc.friends.accepted_anon')} />
}

