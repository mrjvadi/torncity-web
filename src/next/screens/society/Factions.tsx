// جناح: a member's own faction (its crest, rank, members, bank, the group job running), the factions of a city, one
// faction's page, its members and requests, its bank, its organised crime, and the short answers. What is private to
// members is only on the member's own screens.

import { useState, type CSSProperties } from 'react'
import type { NScreenProps } from '../../registry'
import type { Action } from '../../../api/types'
import type {
  FactionAnsweredView, FactionAppliedView, FactionBankView, FactionConfirmView, FactionCrimeBoardView, FactionFoundedView, FactionFoundView,
  FactionHomeView, FactionInvitedView, FactionLeftView, FactionLinkedView, FactionListView, FactionMemberLine, FactionMembersView,
  FactionOperationLine, FactionPageView, FactionRefusalView,
} from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, KV, List, Loading, Meter, Note, Now, Page, Row, Section, Sheet, Stat, Stats, Strip, Tile, Tiles } from '../../ui'
import { formatNumber, hms, money, splitMoney } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { avatar, bps, cityName, label, Outcome, Rest, Said, span, usable, useNames, who, word, type Names } from './common'

const rank = (r: string) => word(`soc.faction.rank.${r}`, r)
const rankTone = (r: string) => (r === 'leader' ? 'solid' : r === 'officer' ? 'accent' : undefined) as 'solid' | 'accent' | undefined

/** The faction's crest: its first letter on its own colour. */
function Crest({ name, big }: { name: string; big?: boolean }) {
  const av = avatar(name)
  return <span className={`n-soc-crest${big ? ' big' : ''}`} style={{ '--h': av.hue } as CSSProperties} aria-hidden="true">{av.letter}</span>
}

function Loader({ loading, title }: { loading: boolean; title: string }) {
  return <Page title={title}>{loading ? <Loading blocks={[180, 72, 128]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
}

function crewText(o: FactionOperationLine): string {
  return t('soc.faction.op.crew_of', { n: formatNumber((o.crew ?? []).length), min: formatNumber(o.min), max: formatNumber(o.max) })
}

/** One person of the faction as a row: the avatar, the name, the rank as a chip, and an optional round button. */
function MemberRow({ m, more }: { m: FactionMemberLine; more?: () => void }) {
  const name = who(m.player)
  const av = avatar(name)
  return (
    <div className="n-row">
      <span className="n-row-av" style={{ background: `hsl(${av.hue} 42% 38%)` }}>{av.letter}</span>
      <span className="n-row-body">
        <span className="n-row-title">{name}{m.self ? ` ${t('soc.you')}` : ''}</span>
        {m.player.code && <span className="n-row-sub n-ltr">{m.player.code}</span>}
      </span>
      <Chip tone={rankTone(m.rank)}>{rank(m.rank)}</Chip>
      {more && <button className="n-soc-round" aria-label={t('n.soc.faction.manage', { name })} onClick={more}><Icon name="gears" /></button>}
    </div>
  )
}

// -- a member's own faction ------------------------------------------------------------------------------------

const TILE: Record<string, { icon: string; key: string }> = {
  'faction.members': { icon: 'society', key: 'soc.act.faction.members' },
  'faction.bank': { icon: 'bank', key: 'soc.act.faction.bank' },
  'faction.crime': { icon: 'crime', key: 'soc.act.faction.crime' },
}
const tileOf = (a: Action) => TILE[a.id || a.command || '']

export function FactionHome({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('hub.faction')} />
  const v = response.view as unknown as FactionHomeView
  const acts = usable(response)
  const tiles = acts.filter((a) => tileOf(a))
  const invite = acts.find((a) => a.id === 'faction.invite' || a.command === 'faction.invite')
  const crime = acts.find((a) => (a.id || a.command) === 'faction.crime')
  const o = v.operation
  const [bankMain, bankSup] = splitMoney(money(v.bank)) ?? [money(v.bank), '']
  return (
    <Page title={v.ref.name}>
      <Said r={response} />
      <Hero art="lion">
        <div className="n-soc-who">
          <Crest name={v.ref.name} big />
          <div>
            <p className="n-soc-hero-title">{v.ref.name}</p>
            <div className="n-chips">
              <Chip tone="solid">{rank(v.rank)}</Chip>
              <Chip><Icon name="city" size={16} />{cityName(names, v.city_code, v.city)}</Chip>
            </div>
          </div>
        </div>
        <div className="n-soc-meter"><Meter frac={v.max_members ? v.members / v.max_members : 0} tone="accent"
          label={t('soc.faction.members')} value={t('soc.faction.members_of', { a: formatNumber(v.members), b: formatNumber(v.max_members) })} /></div>
        {invite && <div className="n-hero-foot"><Button block icon="f_letter" onClick={() => nav.act(invite)}>{label(invite, names)}</Button></div>}
      </Hero>
      <Stats>
        <Stat icon="bank" label={t('soc.faction.bank')} value={bankMain} note={bankSup || undefined} />
        <Stat icon="x_scroll" label={t('soc.faction.applications')} value={formatNumber(v.applications)} tone={v.applications > 0 ? 'lit' : undefined} />
      </Stats>
      {v.linked ? <Note tone="ok" icon="m_chat">{t('soc.faction.linked_chip')}</Note> : <Note tone="info" icon="m_chat">{t('soc.faction.unlinked', { code: v.ref.code })}</Note>}

      {o && (
        <>
          <Section title={t('soc.faction.op.title')} />
          <Now icon="crime" lit title={names.name(['crime'], o.crime.code, o.crime.name)}
            sub={`${word(`soc.faction.op.${o.status}`, o.status)} · ${crewText(o)}`}
            time={o.left_seconds > 0 ? hms(o.left_seconds) : undefined} onClick={crime ? () => nav.act(crime) : undefined} />
        </>
      )}

      {tiles.length > 0 && (
        <>
          <Section title={t('next.sections')} />
          <Tiles three={tiles.length === 3}>
            {tiles.map((a, i) => {
              const k = tileOf(a)!
              const badge = (a.id || a.command) === 'faction.members' && v.applications > 0 ? formatNumber(v.applications) : undefined
              return <Tile key={i} icon={k.icon} title={t(k.key as 'soc.act.faction.bank')} badge={badge} onClick={() => nav.act(a)} />
            })}
          </Tiles>
        </>
      )}
      <Rest acts={acts.filter((a) => !tileOf(a) && a !== invite)} names={names} />
    </Page>
  )
}

// -- the factions of a city and one faction's page ----------------------------------------------------------

export function FactionList({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.faction.list')} />
  const v = response.view as unknown as FactionListView
  const acts = usable(response)
  const viewOf = (code: string) => acts.find((a) => a.id === 'faction.view' && a.args?.code === code)
  const mine = acts.find((a) => (a.id || a.command) === 'faction.mine')
  const found = acts.find((a) => (a.id || a.command) === 'faction.found')
  const list = v.factions ?? []
  const f = v.founding
  return (
    <Page title={v.city ? t('soc.faction.list_city', { city: cityName(names, v.city_code, v.city) }) : t('soc.faction.list')}>
      <Said r={response} />
      <Hero art="x_flag">
        {v.mine ? (
          <>
            <div className="n-soc-who"><Crest name={v.mine.name} big /><div><p className="n-label">{t('n.soc.faction.yours')}</p><p className="n-soc-hero-title">{v.mine.name}</p></div></div>
            {mine && <div className="n-hero-foot"><Button block onClick={() => nav.act(mine)}>{label(mine, names)}</Button></div>}
          </>
        ) : f && !f.open ? (
          <>
            <p className="n-soc-lead">{t('soc.faction.locked', { need: formatNumber(f.need) })}</p>
            <div className="n-soc-meter"><Meter thick frac={f.need ? f.have / f.need : 0} tone="warn" label={t('soc.faction.founders')}
              value={t('soc.faction.founders_progress', { have: formatNumber(f.have), need: formatNumber(f.need) })} /></div>
          </>
        ) : (
          <>
            <p className="n-soc-lead">{t('soc.faction.list_found', { fee: money(v.fee) })}</p>
            {found && <div className="n-hero-foot"><Button block icon="x_flag" onClick={() => nav.act(found)}>{label(found, names)}</Button></div>}
          </>
        )}
      </Hero>
      <Section title={t('soc.faction.list')} note={list.length ? formatNumber(list.length) : undefined} />
      {list.length === 0 && <Empty icon="x_flag">{t('soc.faction.none_here')}</Empty>}
      {list.length > 0 && (
        <List>
          {list.map((x) => {
            const a = viewOf(x.ref.code)
            return (
              <Row key={x.ref.code} avatar={avatar(x.ref.name)} title={x.ref.name} sub={t('soc.faction.member_count', { n: formatNumber(x.members) })}
                end={v.mine?.code === x.ref.code ? <Chip tone="accent">{t('n.soc.faction.yours')}</Chip> : undefined}
                onClick={a ? () => nav.act(a) : undefined} />
            )
          })}
        </List>
      )}
      <Rest acts={acts.filter((a) => a.id !== 'faction.view' && a !== mine && a !== found)} names={names} />
    </Page>
  )
}

export function FactionPage({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.faction.list')} />
  const v = response.view as unknown as FactionPageView
  const acts = usable(response)
  const apply = acts.find((a) => (a.id || a.command) === 'faction.apply')
  const link = acts.find((a) => (a.id || a.command) === 'faction.link')
  const lead = apply ?? link
  const members = v.members ?? []
  return (
    <Page title={v.ref.name}>
      <Said r={response} />
      <Hero art="lion">
        <div className="n-soc-who">
          <Crest name={v.ref.name} big />
          <div>
            <p className="n-soc-hero-title">{v.ref.name}</p>
            <div className="n-chips">
              <Chip><span className="n-ltr">{v.ref.code}</span></Chip>
              <Chip><Icon name="city" size={16} />{cityName(names, v.city_code, v.city)}</Chip>
              {v.linked && <Chip tone="ok">{t('soc.faction.linked_chip')}</Chip>}
            </div>
          </div>
        </div>
        <p className="n-label n-soc-line"><Icon name="society" size={18} />{t('soc.faction.member_count', { n: formatNumber(members.length) })}</p>
        {lead && <div className="n-hero-foot"><Button block onClick={() => nav.act(lead)}>{label(lead, names)}</Button></div>}
      </Hero>
      <Section title={t('soc.faction.members')} note={formatNumber(members.length)} />
      {members.length > 0 && <List>{members.map((m, i) => <MemberRow key={i} m={m} />)}</List>}
      <Rest acts={acts.filter((a) => a !== lead)} names={names} />
    </Page>
  )
}

// -- members and requests ---------------------------------------------------------------------------------

const MEMBER_IDS = ['faction.promote', 'faction.demote', 'faction.lead', 'faction.kick']

export function FactionMembers({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  const [open, setOpen] = useState<FactionMemberLine | null>(null)
  if (!response?.view) return <Loader loading={loading} title={t('soc.faction.members')} />
  const v = response.view as unknown as FactionMembersView
  const acts = usable(response)
  const members = v.members ?? []
  const requests = v.requests ?? []
  const of = (code: string) => acts.filter((a) => MEMBER_IDS.includes(a.id ?? '') && a.args?.player === code)
  const reqActs = (no: number) => acts.filter((a) => (a.id === 'faction.accept' || a.id === 'faction.decline') && a.args?.no === String(no))
  const invite = acts.find((a) => a.id === 'faction.invite' || a.command === 'faction.invite')
  const used = (a: Action) => MEMBER_IDS.includes(a.id ?? '') || a.id === 'faction.accept' || a.id === 'faction.decline' || a === invite
  const sheet = open ? of(open.player.code) : []
  return (
    <Page title={t('soc.faction.members_title', { faction: v.ref.name })}>
      <Said r={response} />
      <div className="n-card">
        <Meter thick frac={v.max ? members.length / v.max : 0} tone="accent" label={t('soc.faction.members')}
          value={t('soc.faction.members_count', { n: formatNumber(members.length), max: formatNumber(v.max) })} />
      </div>
      {invite && <Button block icon="f_letter" onClick={() => nav.act(invite)}>{label(invite, names)}</Button>}

      {requests.length > 0 && (
        <>
          <Section title={t('soc.faction.requests')} note={formatNumber(requests.length)} />
          <div className="n-rows">
            {requests.map((q) => {
              const name = who(q.player)
              const two = q.can_decide ? reqActs(q.no) : []
              return (
                <div key={q.no} className="n-soc-ask">
                  <Row avatar={avatar(name)} title={name} sub={word(`soc.faction.request.${q.kind}`, '', { player: name })} />
                  {two.length > 0 && <Buttons>{two.map((a, i) => <Button key={i} small kind={a.id === 'faction.accept' ? 'cyan' : 'ghost'} onClick={() => nav.act(a)}>{label(a, names)}</Button>)}</Buttons>}
                </div>
              )
            })}
          </div>
        </>
      )}

      <Section title={t('soc.faction.members')} note={formatNumber(members.length)} />
      <List>
        {members.map((m, i) => <MemberRow key={i} m={m} more={of(m.player.code).length ? () => setOpen(m) : undefined} />)}
      </List>
      <Rest acts={acts.filter((a) => !used(a))} names={names} />

      {open && (
        <Sheet title={who(open.player)} icon="society" onClose={() => setOpen(null)}>
          <div className="n-chips"><Chip tone={rankTone(open.rank)}>{rank(open.rank)}</Chip>{open.player.code && <Chip><span className="n-ltr">{open.player.code}</span></Chip>}</div>
          {sheet.map((a, i) => (
            <Button key={i} block kind={a.id === 'faction.kick' ? 'danger' : a.id === 'faction.lead' ? 'ghost' : 'cyan'} onClick={() => { setOpen(null); nav.act(a) }}>{label(a, names)}</Button>
          ))}
        </Sheet>
      )}
    </Page>
  )
}

// -- the bank -------------------------------------------------------------------------------------------

export function FactionBank({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.act.faction.bank')} />
  const v = response.view as unknown as FactionBankView
  const acts = usable(response)
  const cash = acts.find((a) => a.id === 'faction.deposit.cash')
  const card = acts.find((a) => a.id === 'faction.deposit.card')
  const out = acts.find((a) => a.id === 'faction.withdraw')
  return (
    <Page title={t('soc.faction.bank_title', { faction: v.ref.name })}>
      <Said r={response} />
      {v.done && (
        <Note tone="ok" icon="m_check">
          {t(v.done.deposit ? 'soc.faction.bank.deposited' : 'soc.faction.bank.withdrawn', { amount: money(v.done.amount) })}
          {v.done.deposit && v.done.method ? ` ${word(`soc.paid.${v.done.method}`)}` : ''}
        </Note>
      )}
      <Hero art="bank">
        <p className="n-label">{t('soc.faction.bank.balance')}</p>
        <p className="n-big">{(splitMoney(money(v.balance)) ?? [money(v.balance)])[0]}</p>
        {(splitMoney(money(v.balance)) ?? [])[1] && <p className="n-label">{splitMoney(money(v.balance))![1]}</p>}
        <div className="n-chips n-soc-line">
          <Chip><Icon name="coins" size={16} />{t('soc.faction.bank.cash')}: {money(v.cash)}</Chip>
          <Chip><Icon name="bank" size={16} />{t('soc.faction.bank.card')}: {money(v.bank_balance)}</Chip>
        </div>
        {(cash || card || out) && (
          <div className="n-hero-foot n-soc-stack">
            <Buttons>
              {cash && <Button icon="coins" onClick={() => nav.act(cash)}>{label(cash, names)}</Button>}
              {card && <Button kind={cash ? 'cyan' : 'primary'} onClick={() => nav.act(card)}>{label(card, names)}</Button>}
            </Buttons>
            {out && <Button kind="ghost" block onClick={() => nav.act(out)}>{label(out, names)}</Button>}
          </div>
        )}
      </Hero>
      <KV label={t('soc.faction.bank.limits')} value={`${money(v.min)} – ${money(v.max)}`} />
      <Note tone="info" icon="m_lock">{t('soc.faction.bank.rules')}</Note>
      <Rest acts={acts.filter((a) => a !== cash && a !== card && a !== out)} names={names} />
    </Page>
  )
}

// -- organised crime ----------------------------------------------------------------------------------

function Operation({ o, names, acts }: { o: FactionOperationLine; names: Names; acts: Action[] }) {
  const nav = useNav()
  const join = acts.find((a) => a.id === 'faction.join')
  const launch = acts.find((a) => a.id === 'faction.launch')
  const off = acts.find((a) => a.id === 'faction.calloff')
  const crew = o.crew ?? []
  return (
    <>
      <Hero art="crime">
        <div className="n-chips"><Chip tone={o.status === 'running' ? 'accent' : 'cyan'}>{word(`soc.faction.op.${o.status}`, o.status)}</Chip></div>
        <p className="n-soc-hero-title">{names.name(['crime'], o.crime.code, o.crime.name)}</p>
        <p className="n-label">{names.name(['place'], o.place.code, o.place.name)} – {cityName(names, o.city_code, o.city)}</p>
        {o.left_seconds > 0 && (
          <>
            <p className="n-label n-soc-line">{o.status === 'gathering' ? t('soc.faction.op.gather_left') : t('soc.faction.op.end_left')}</p>
            <p className="n-soc-time">{span(o.left_seconds)}</p>
          </>
        )}
        <div className="n-soc-meter"><Meter frac={o.chance_bps / 10000} tone="accent" label={t('soc.faction.op.chance')} value={bps(o.chance_bps)} /></div>
        {(join || launch) && (
          <div className="n-hero-foot">
            <Buttons>
              {join && <Button onClick={() => nav.act(join)}>{label(join, names)}</Button>}
              {launch && <Button kind={join ? 'cyan' : 'primary'} onClick={() => nav.act(launch)}>{label(launch, names)}</Button>}
            </Buttons>
          </div>
        )}
      </Hero>
      <Strip items={[
        { label: t('soc.faction.op.crew'), value: `${formatNumber(crew.length)}/${formatNumber(o.max)}` },
        { label: t('n.soc.faction.op.min'), value: formatNumber(o.min) },
        { label: t('soc.faction.op.nerve'), value: formatNumber(o.nerve) },
      ]} />
      {crew.length > 0 && (
        <div className="n-soc-faces" aria-label={t('soc.faction.op.crew')}>
          {crew.map((m, i) => { const av = avatar(who(m.player)); return <span key={i} className="n-soc-face" style={{ background: `hsl(${av.hue} 42% 38%)` }} title={who(m.player)}>{av.letter}</span> })}
          <span className="n-label">{crewText(o)}</span>
        </div>
      )}
      {off && <Button kind="danger" block onClick={() => nav.act(off)}>{label(off, names)}</Button>}
    </>
  )
}

export function FactionCrime({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.act.faction.crime')} />
  const v = response.view as unknown as FactionCrimeBoardView
  const acts = usable(response)
  const plans = acts.filter((a) => a.id === 'faction.plan')
  const used = (a: Action) => ['faction.plan', 'faction.join', 'faction.launch', 'faction.calloff'].includes(a.id ?? '')
  return (
    <Page title={t('soc.faction.crime_title', { faction: v.ref.name })}>
      <Said r={response} />
      {v.notice && <Note tone="ok" icon="m_check">{word(`soc.faction.crime_notice.${v.notice}`)}</Note>}
      {v.operation ? <Operation o={v.operation} names={names} acts={acts} /> : (
        <>
          <Note tone="info" icon="crime">{t('soc.faction.crime_none')}</Note>
          <div className="n-rows">
            {(v.crimes ?? []).map((l, i) => {
              const plan = plans.find((a) => a.subject === l.crime.code || a.args?.crime === l.crime.code)
              return (
                <div key={l.crime.code} className="n-card n-soc-stack">
                  <div className="n-soc-plan-head">
                    <span className="n-row-well"><Icon name="crime" /></span>
                    <div className="n-row-body">
                      <span className="n-row-title">{names.name(['crime'], l.crime.code, l.crime.name)}</span>
                      <span className="n-row-sub">{(l.places ?? []).map((p) => names.name(['place'], p.code, p.name)).join(t('common.sep') + ' ')}</span>
                    </div>
                    <Chip>{t('soc.faction.crime_crew', { min: formatNumber(l.min), max: formatNumber(l.max) })}</Chip>
                  </div>
                  <p className="n-label">{t('soc.faction.crime_line', { nerve: formatNumber(l.nerve), level: formatNumber(l.min_level), duration: span(l.duration_seconds) })}</p>
                  {plan && <Button kind={i === 0 ? 'primary' : 'cyan'} block onClick={() => nav.act(plan)}>{label(plan, names)}</Button>}
                </div>
              )
            })}
          </div>
        </>
      )}
      <Note icon="m_lock">{t('soc.faction.crime_rules', { cut: bps(v.cut_bps) })}</Note>
      <Rest acts={acts.filter((a) => !used(a))} names={names} />
    </Page>
  )
}

// -- founding --------------------------------------------------------------------------------------------

export function FactionFound({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.faction.found_title')} />
  const v = response.view as unknown as FactionFoundView
  const acts = usable(response)
  const pays = acts.filter((a) => a.id === 'faction.found.pay')
  const p = v.payment
  return (
    <Page title={t('soc.faction.found_title')}>
      <Said r={response} />
      <Hero art="x_flag">
        <p className="n-label">{t('soc.faction.fee')}</p>
        <p className="n-big">{(splitMoney(money(v.fee)) ?? [money(v.fee)])[0]}</p>
        {(splitMoney(money(v.fee)) ?? [])[1] && <p className="n-label">{splitMoney(money(v.fee))![1]}</p>}
        <p className="n-label">{cityName(names, v.city_code, v.city)} · {t('soc.faction.name_rule')}: {t('soc.faction.name_range', { min: formatNumber(v.name_min), max: formatNumber(v.name_max) })}</p>
        {p && <p className="n-label n-soc-line">{t('soc.faction.balances', { cash: money(p.cash), bank: money(p.bank) })}</p>}
        {pays.length > 0 && (
          <div className="n-hero-foot n-soc-stack">
            {pays.map((a, i) => {
                const m = a.args?.method ?? ''
                return <Button key={m || i} block kind={i === 0 ? 'primary' : 'cyan'} disabled={!!p && !(p.usable ?? []).includes(m)} onClick={() => nav.act(a)}>
                  {word(`soc.faction.pay.${m}`, label(a, names), { amount: money(p?.amount ?? v.fee) })}
                </Button>
              })}
          </div>
        )}
      </Hero>
      {pays.length === 0 && <Note tone="bad" icon="x_wanted">{t('soc.faction.cannot_afford')}</Note>}
      <Note tone="info" icon="x_scroll">{t('soc.faction.found_rules')}</Note>
      <Rest acts={acts.filter((a) => a.id !== 'faction.found.pay')} names={names} />
    </Page>
  )
}

export function FactionFounded({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as FactionFoundedView | undefined
  if (!v) return null
  return <Outcome response={response} names={names} title={t('soc.faction.founded_title')} icon="x_flag" tone="ok"
    lead={t('soc.faction.founded', { name: v.ref.name, city: cityName(names, v.city_code, v.city) })}
    lines={[v.fee > 0 ? t('soc.faction.founded_fee', { fee: money(v.fee), method: word(`soc.paid.${v.method}`) }) : null, t('soc.faction.founded_next', { code: v.ref.code })]} />
}

// -- the short answers --------------------------------------------------------------------------------------

export function FactionConfirm({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionConfirmView | undefined
  if (!v) return null
  const icon = { leave: 'walk', kick: 'm_stop', lead: 'x_crown', disband: 'x_flag' }[v.kind] ?? 'x_flag'
  return <Outcome response={response} title={t('soc.faction.confirm_title')} icon={icon} tone="bad"
    lead={word(`soc.faction.confirm.${v.kind}`, t('soc.faction.confirm_title'), { faction: v.ref.name, player: who(v.player) })}
    yes={(a) => (a.id ?? '').startsWith('faction.confirm.')} />
}

export function FactionInvited({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionInvitedView | undefined
  return <Outcome response={response} title={t('soc.faction.invited_title')} icon="x_send" tone="ok" lead={t('soc.faction.invited', { player: who(v?.player) })} />
}

export function FactionApplied({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionAppliedView | undefined
  return <Outcome response={response} title={t('soc.faction.applied_title')} icon="x_send" tone="ok" lead={t('soc.faction.applied', { name: v?.ref.name ?? '' })} />
}

export function FactionAnswered({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionAnsweredView | undefined
  if (!v) return null
  return <Outcome response={response} title={t('soc.faction.answered_title')} icon={v.accepted ? 'f_hands' : 'x_cross'} tone={v.accepted ? 'ok' : undefined}
    lead={word(`soc.faction.answered.${v.kind}_${v.accepted ? 'accepted' : 'declined'}`, '', { faction: v.ref.name, player: who(v.player) })} />
}

export function FactionLeft({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionLeftView | undefined
  if (!v) return null
  return <Outcome response={response} title={t(v.disbanded ? 'soc.faction.disbanded_title' : 'soc.faction.left_title')} icon="walk"
    lead={t(v.disbanded ? 'soc.faction.disbanded' : 'soc.faction.left', { name: v.ref.name })}
    lines={[v.disbanded && v.paid_out > 0 ? t('soc.faction.disbanded_paid', { amount: money(v.paid_out) }) : null]} />
}

export function FactionLinked({ response }: NScreenProps) {
  const v = response?.view as unknown as FactionLinkedView | undefined
  return <Outcome response={response} title={t('soc.faction.linked_title')} icon="m_chat" tone="ok" lead={t('soc.faction.linked', { name: v?.ref.name ?? '' })} />
}

export function FactionRefusal({ response }: NScreenProps) {
  const v = (response?.view ?? {}) as Partial<FactionRefusalView>
  const n = (x?: number) => formatNumber(x ?? 0)
  return <Outcome response={response} title={t('soc.refused.title')} icon="x_wanted" tone="bad"
    lead={word(`soc.refusal.faction.${v.kind ?? ''}`, t('soc.refusal.unknown'), {
      min: n(v.min), max: n(v.max), amount: money(v.amount ?? 0), balance: money(v.balance ?? 0), need: n(v.need), have: n(v.have), level: n(v.level),
    })} />
}
