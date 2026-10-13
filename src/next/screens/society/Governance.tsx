// شهرداری: the city's government (who holds which office, the policies in force and what is announced), the holder's
// own office (the policies they can change, the offices they appoint), the flow that changes a policy (the draft with
// its steps, the review, the announcement), the budget's shares, the public record and appointments.

import type { NScreenProps } from '../../registry'
import type { Action } from '../../../api/types'
import type {
  AllocationConfirmView, AllocationEditView, AppointDoneView, AppointRefusalView, AppointView, CityGovView, DismissView, GovHistoryView, GovLever,
  GovRefusal, LeverEditView, MyOfficeView, PolicyAnnouncedView, PolicyConfirmView, PolicyRefusalView,
} from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, KV, List, Loading, Meter, Note, Page, Row, Section, Tile, Tiles } from '../../ui'
import { formatNumber } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import {
  allocationText, avatar, bps, isPager, label, leverName, leverNow, leverValue, officeName, Outcome, Pager, placeName, Rest, Said, span, usable, useNames, useYes, who, word,
  type Names,
} from './common'

function Loader({ loading, title }: { loading: boolean; title: string; art?: string }) {
  return <Page title={title}>{loading ? <Loading blocks={[160, 104, 64, 64]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
}

const pendingText = (n: Names, l: GovLever): string => {
  if (!l.pending) return ''
  const v = l.type === 'allocation' ? allocationText(n, l.pending.allocation, l.categories) : leverValue(l, l.pending.value)
  return t('soc.gov.pending', { value: v, when: span(l.pending.in_seconds) })
}

// -- the government page --------------------------------------------------------------------------------------

const GOV_TILE: Record<string, string> = {
  'gov.elections': 'vote', 'gov.laws': 'f_scales', 'gov.budget': 'coins', 'gov.history': 'x_scroll', 'gov.charter': 'x_seal', 'military.ministry': 'swords',
}
const tileId = (a: Action) => (GOV_TILE[a.id ?? ''] ? a.id! : GOV_TILE[a.command ?? ''] ? a.command! : '')

function LeverRow({ n, l }: { n: Names; l: GovLever }) {
  const alloc = l.type === 'allocation'
  const origin = l.from_office ? t('soc.gov.set_by', { player: who(l.set_by) }) : t('soc.gov.default')
  // an allocation's announced shares are long: the chip says one is announced, the line keeps the shares in force
  const sub = alloc ? leverNow(n, l) : [origin, pendingText(n, l)].filter(Boolean).join(' · ')
  return <Row icon={alloc ? 'coins' : 'chart'} title={leverName(n, l.code)} sub={sub}
    end={alloc ? (l.pending ? <Chip tone="warn">{t('n.soc.gov.announced')}</Chip> : undefined) : <b className="n-soc-val">{leverNow(n, l)}</b>} />
}

export function CityGovernance({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.gov.title_plain')} />
  const v = response.view as unknown as CityGovView
  const acts = usable(response)
  const office = acts.find((a) => (a.id || a.command) === 'gov.my_office' || a.command === 'gov.office')
  const tiles = acts.filter((a) => tileId(a))
  const place = placeName(names, v.city)
  if (v.no_city) {
    return (
      <Page title={t('soc.gov.title_plain')}>
        <Said r={response} />
        <Empty icon="gavel">{t('soc.gov.no_city')}</Empty>
        <Rest acts={acts} names={names} />
      </Page>
    )
  }
  const sections = v.sections ?? []
  const holders = sections.flatMap((s) => (s.offices ?? []).flatMap((o) => o.holders ?? []))
  return (
    <Page title={t('soc.gov.title', { place })}>
      <Said r={response} />
      <Hero art="gavel">
        <p className="n-label">{t('n.soc.gov.seat_of')}</p>
        <p className="n-soc-hero-title">{place}</p>
        {holders.length > 0 && (
          <div className="n-soc-faces">
            {holders.slice(0, 6).map((p, i) => { const av = avatar(who(p)); return <span key={i} className="n-soc-face" style={{ background: `hsl(${av.hue} 42% 38%)` }} title={who(p)}>{av.letter}</span> })}
            <span className="n-label">{t('n.soc.gov.holders', { n: formatNumber(holders.length) })}</span>
          </div>
        )}
        {v.holds_office && office && <div className="n-hero-foot"><Button block icon="x_crown" onClick={() => nav.act(office)}>{label(office, names)}</Button></div>}
      </Hero>

      {tiles.length > 0 && (
        <Tiles three>
          {tiles.map((a, i) => <Tile key={i} icon={GOV_TILE[tileId(a)]} title={label(a, names)} onClick={() => nav.act(a)} />)}
        </Tiles>
      )}

      {sections.map((s, i) => (
        <div key={i} className="n-soc-block">
          <Section title={placeName(names, s.place)} note={s.place.kind === 'country' ? t('n.soc.gov.country') : undefined} />
          {(s.offices ?? []).length === 0 && <Note tone="info">{t('soc.gov.no_offices')}</Note>}
          {(s.offices ?? []).length > 0 && (
            <List>
              {(s.offices ?? []).map((o, j) => {
                const hs = o.holders ?? []
                const acting = !hs.length && o.acting_code && (o.acting ?? []).length ? o.acting ?? [] : []
                const title = o.title || officeName(names, o.code) || t('soc.unnamed_office')
                const sub = hs.length ? hs.map(who).join(t('common.sep') + ' ')
                  : acting.length ? t('soc.gov.acting', { deputy: o.acting_title || officeName(names, o.acting_code) || t('soc.unnamed_office'), players: acting.map(who).join(t('common.sep') + ' ') })
                    : undefined
                const first = hs[0] ?? acting[0]
                return (
                  <Row key={o.code || j} avatar={first ? avatar(who(first)) : undefined} icon={first ? undefined : 'x_crown'} title={title} sub={sub}
                    end={!hs.length && !acting.length ? <Chip tone="warn">{t('soc.gov.vacant')}</Chip>
                      : o.seats > 1 ? <Chip>{`${formatNumber(hs.length)}/${formatNumber(o.seats)}`}</Chip> : undefined} />
                )
              })}
            </List>
          )}
          {(s.levers ?? []).length > 0 && (
            <>
              <p className="n-soc-sub">{t('soc.gov.policies')}</p>
              <List>{(s.levers ?? []).map((l) => <LeverRow key={l.code} n={names} l={l} />)}</List>
            </>
          )}
        </div>
      ))}
      <Rest acts={acts.filter((a) => a !== office && !tileId(a))} names={names} />
    </Page>
  )
}

// -- the holder's own office ----------------------------------------------------------------------------------

export function MyOffice({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.office.title')} art="x_crown" />
  const v = response.view as unknown as MyOfficeView
  const acts = usable(response)
  const seats = v.seats ?? []
  const used = new Set<Action>()
  const take = (a: Action | undefined) => { if (a) used.add(a); return a }
  return (
    <Page title={t('soc.office.title')}>
      <Said r={response} />
      {seats.length === 0 && <Empty icon="x_crown">{t('soc.office.none')}</Empty>}
      {seats.map((s, i) => {
        const place = placeName(names, s.place)
        const leverAct = (l: GovLever, id: string) => take(acts.find((a) => a.id === id && a.args?.lever === l.code && (!a.args?.place || a.args.place === s.place.code)))
        return (
          <div key={i} className="n-soc-block">
            <Hero art="x_crown">
              <p className="n-label">{t('n.soc.office.you_are')}</p>
              <p className="n-soc-hero-title">{t('soc.office.seat', { office: officeName(names, s.office), place })}</p>
              {s.acting_for && <p className="n-label n-soc-line">{t('soc.office.acting_for', { office: officeName(names, s.acting_for) })}</p>}
            </Hero>
            {(s.levers ?? []).length === 0 && (s.vote_levers ?? []).length === 0 && <Note tone="info">{t('soc.office.no_levers')}</Note>}
            {((s.levers ?? []).length > 0 || (s.vote_levers ?? []).length > 0) && (
              <>
                <Section title={t('n.soc.office.levers')} />
                <List>
                  {(s.levers ?? []).map((l) => {
                    const a = leverAct(l, 'gov.lever.change')
                    return <Row key={l.code} icon={l.type === 'allocation' ? 'coins' : 'chart'} title={leverName(names, l.code)}
                      sub={l.confirm_by ? t('soc.office.confirmed_by', { office: officeName(names, l.confirm_by) }) : (a ? label(a, names) : undefined)}
                      end={<b className="n-soc-val">{l.type === 'allocation' ? '' : leverNow(names, l)}</b>} onClick={a ? () => nav.act(a) : undefined} />
                  })}
                  {(s.vote_levers ?? []).map((l) => {
                    const a = leverAct(l, 'gov.lever.propose')
                    return <Row key={`v-${l.code}`} icon="vote" title={leverName(names, l.code)} sub={t('soc.office.by_vote', { office: officeName(names, l.held_by) })}
                      end={l.type === 'allocation' ? <Chip tone="cyan">{t('n.soc.office.propose')}</Chip> : <b className="n-soc-val">{leverNow(names, l)}</b>}
                      onClick={a ? () => nav.act(a) : undefined} />
                  })}
                </List>
              </>
            )}
            {(s.appointees ?? []).length > 0 && (
              <>
                <Section title={t('soc.office.appoints')} />
                <div className="n-rows">
                  {(s.appointees ?? []).map((ap, j) => {
                    const mine = acts.filter((a) => (a.id === 'gov.appoint' || a.id === 'gov.dismiss') && a.args?.office === ap.office && (!a.args?.place || a.args.place === ap.place.code))
                    mine.forEach((a) => used.add(a))
                    return (
                      <div key={j} className="n-soc-ask">
                        <Row avatar={ap.holder ? avatar(who(ap.holder)) : undefined} icon={ap.holder ? undefined : 'x_crown'} title={officeName(names, ap.office) || t('soc.unnamed_office')}
                          sub={ap.holder ? who(ap.holder) : undefined} end={ap.holder ? undefined : <Chip tone="warn">{t('soc.gov.vacant')}</Chip>} />
                        {mine.length > 0 && <Buttons>{mine.map((a, k) => <Button key={k} small kind={a.id === 'gov.dismiss' ? 'danger' : 'cyan'} onClick={() => nav.act(a)}>{label(a, names)}</Button>)}</Buttons>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )
      })}
      <Rest acts={acts.filter((a) => !used.has(a) && !(a.id ?? '').startsWith('gov.lever.') && a.id !== 'gov.appoint' && a.id !== 'gov.dismiss')} names={names} />
    </Page>
  )
}

// -- changing a policy -------------------------------------------------------------------------------------

const STEP_IDS = ['gov.lever.down_coarse', 'gov.lever.down_fine', 'gov.lever.up_fine', 'gov.lever.up_coarse']
const PRESET_IDS = ['gov.lever.min', 'gov.lever.default', 'gov.lever.max']

export function LeverEdit({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.office.title')} art="chart" />
  const v = response.view as unknown as LeverEditView
  const l = v.lever
  const acts = usable(response)
  const fmt = (n: number) => leverValue(l, n)
  const choices = acts.filter((a) => a.id === 'gov.lever.choose')
  const steps = STEP_IDS.map((id) => acts.find((a) => a.id === id)).filter((a): a is Action => !!a)
  const presets = acts.filter((a) => PRESET_IDS.includes(a.id ?? ''))
  const review = acts.find((a) => a.id === 'gov.review')
  const shown = new Set<Action>([...choices, ...steps, ...presets, ...(review ? [review] : [])])
  const waiting = v.next_change_in_seconds > 0
  const stepText = (a: Action) => `${(a.id ?? '').includes('.down') ? '−' : '+'}${fmt((a.id ?? '').endsWith('coarse') ? v.coarse_step : v.fine_step)}`
  const frac = l.max > l.min ? (v.draft - l.min) / (l.max - l.min) : 0
  return (
    <Page title={leverName(names, l.code)} sub={placeName(names, v.place)}>
      <Said r={response} />
      <Hero art="chart">
        <p className="n-label">{t('soc.edit.draft')}</p>
        <p className="n-soc-time n-ltr">{fmt(v.draft)}</p>
        <p className="n-label">{t('soc.edit.now')}: <b className="n-soc-val">{leverNow(names, l)}</b></p>
        {choices.length === 0 && <div className="n-soc-meter"><Meter frac={frac} tone="accent" label={fmt(l.min)} value={fmt(l.max)} /></div>}
        {!waiting && steps.length > 0 && (
          <div className="n-soc-steppers" dir="ltr">
            {steps.map((a, i) => <button key={i} className={`n-soc-step${(a.id ?? '').includes('.down') ? ' down' : ''}`} onClick={() => nav.act(a)}
              aria-label={label(a, names)}>{stepText(a)}</button>)}
          </div>
        )}
        {!waiting && choices.length > 0 && (
          <div className="n-soc-choices">
            {choices.map((a, i) => <Button key={i} kind="ghost" small onClick={() => nav.act(a)}>{fmt(Number(a.args?.value))}</Button>)}
          </div>
        )}
      </Hero>
      {waiting && <Note tone="bad" icon="stopwatch">{t('soc.edit.wait', { wait: span(v.next_change_in_seconds) })}</Note>}
      {!waiting && presets.length > 0 && (
        <div className="n-soc-choices">
          {presets.map((a, i) => <Button key={i} kind="ghost" small onClick={() => nav.act(a)}>{word(`soc.edit.${(a.id ?? '').slice('gov.lever.'.length)}`, '', { value: fmt(Number(a.args?.value)) })}</Button>)}
        </div>
      )}
      {l.pending && <Note tone="info" icon="x_mega">{pendingText(names, l)}</Note>}
      <div className="n-rows">
        {choices.length === 0 && <KV label={t('soc.edit.bounds')} value={t('soc.edit.range', { min: fmt(l.min), max: fmt(l.max) })} />}
        <KV label={t('soc.edit.default_label')} value={fmt(l.default)} />
        <KV label={t('soc.edit.notice')} value={span(l.notice_seconds)} />
        <KV label={t('soc.edit.cooldown')} value={span(l.cooldown_seconds)} />
      </div>
      {review && <Button block icon="m_check" onClick={() => nav.act(review)}>{label(review, names)}</Button>}
      <Rest acts={acts.filter((a) => !shown.has(a))} names={names} />
    </Page>
  )
}

/** The review of a change: from what to what, when it applies or whose vote it goes to, then yes or back. */
function Review({ response, names, lever, place, from, to, voteBy }: {
  response: NScreenProps['response']; names: Names; lever: GovLever; place: string; from: string; to: string; voteBy: string
}) {
  const nav = useNav()
  const go = useYes()
  const acts = usable(response)
  const yes = acts.find((a) => a.id === 'gov.confirm')
  const no = acts.find((a) => a.id === 'cancel')
  return (
    <Page title={t('soc.confirm.title')}>
      <Said r={response} />
      <Hero art="x_seal">
        <p className="n-label">{place}</p>
        <p className="n-soc-hero-title">{leverName(names, lever.code)}</p>
        <div className="n-soc-change">
          <span><small>{t('soc.announced.old')}</small><b>{from}</b></span>
          <Icon name="x_send" className="n-soc-arrow" />
          <span className="new"><small>{t('soc.announced.new')}</small><b>{to}</b></span>
        </div>
      </Hero>
      <Note tone="info" icon={voteBy ? 'vote' : 'x_mega'}>{voteBy ? t('soc.confirm.vote', { office: officeName(names, voteBy) }) : t('soc.confirm.notice', { notice: span(lever.notice_seconds) })}</Note>
      <Note icon="stopwatch">{t('soc.confirm.cooldown', { cooldown: span(lever.cooldown_seconds) })}</Note>
      <Buttons lead>
        {yes && <Button onClick={() => go(yes)}>{label(yes, names)}</Button>}
        <Button kind="ghost" onClick={() => (no ? nav.act(no) : nav.back())}>{t('common.cancel')}</Button>
      </Buttons>
      <Rest acts={acts.filter((a) => a !== yes && a !== no)} names={names} />
    </Page>
  )
}

export function PolicyConfirm({ response, loading }: NScreenProps) {
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.confirm.title')} />
  const v = response.view as unknown as PolicyConfirmView
  return <Review response={response} names={names} lever={v.lever} place={placeName(names, v.place)} from={leverValue(v.lever, v.lever.value)} to={leverValue(v.lever, v.new_value)} voteBy={v.vote_by} />
}

export function AllocationConfirm({ response, loading }: NScreenProps) {
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.confirm.title')} />
  const v = response.view as unknown as AllocationConfirmView
  return <Review response={response} names={names} lever={v.lever} place={placeName(names, v.place)} from={leverNow(names, v.lever)} to={allocationText(names, v.new, v.lever.categories)} voteBy={v.vote_by} />
}

export function PolicyAnnounced({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as PolicyAnnouncedView | undefined
  if (!v) return null
  const l = v.lever
  const side = (n: number, shares: Record<string, number> | null) => (l.type === 'allocation' ? allocationText(names, shares, l.categories) : leverValue(l, n))
  return <Outcome response={response} names={names} title={t('soc.announced.title')} icon="x_mega" tone="ok"
    lead={t('soc.announced.body', { lever: leverName(names, l.code), place: placeName(names, v.place) })}>
    <div className="n-rows">
      <KV label={t('soc.announced.old')} value={side(v.old, v.old_allocation)} />
      <KV label={t('soc.announced.new')} value={side(v.new, v.new_allocation)} />
      <KV label={t('soc.announced.when')} value={span(v.in_seconds)} />
    </div>
  </Outcome>
}

// -- the budget's shares --------------------------------------------------------------------------------------

export function AllocationEdit({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.alloc.draft')} art="coins" />
  const v = response.view as unknown as AllocationEditView
  const l = v.lever
  const acts = usable(response)
  const moves = acts.filter((a) => a.id === 'gov.alloc.down' || a.id === 'gov.alloc.up')
  const review = acts.find((a) => a.id === 'gov.review')
  const waiting = v.next_change_in_seconds > 0
  return (
    <Page title={leverName(names, l.code)} sub={placeName(names, v.place)}>
      <Said r={response} />
      <Hero art="coins">
        <p className="n-label">{t('soc.alloc.total')}</p>
        <p className="n-soc-time">{bps(v.total)}</p>
        <p className="n-label">{t('soc.alloc.left')}: <b className="n-soc-val">{bps(10000 - v.total)}</b></p>
        {v.spend_share_bps > 0 && <p className="n-label">{t('soc.alloc.spend')}: <b className="n-soc-val">{bps(v.spend_share_bps)}</b></p>}
      </Hero>
      {l.confirm_by && <Note tone="info" icon="vote">{t('soc.confirm.vote', { office: officeName(names, l.confirm_by) })}</Note>}
      {waiting && <Note tone="bad" icon="stopwatch">{t('soc.edit.wait', { wait: span(v.next_change_in_seconds) })}</Note>}
      {!waiting && (
        <>
          <Section title={t('soc.alloc.draft')} />
          <div className="n-rows">
            {(v.lines ?? []).map((line) => {
              const name = names.name(['budget_line'], line.code, '')
              const down = moves.find((a) => a.id === 'gov.alloc.down' && a.subject === line.code)
              const up = moves.find((a) => a.id === 'gov.alloc.up' && a.subject === line.code)
              return (
                <div key={line.code} className="n-card flat n-soc-alloc">
                  <button className="n-soc-round" disabled={!down} aria-label={t('soc.alloc.down', { line: name })} onClick={() => down && nav.act(down)}>−</button>
                  <div className="n-soc-alloc-mid"><Meter frac={line.share / 10000} tone="accent" label={name} value={bps(line.share)} /></div>
                  <button className="n-soc-round" disabled={!up} aria-label={t('soc.alloc.up', { line: name })} onClick={() => up && nav.act(up)}>+</button>
                </div>
              )
            })}
          </div>
        </>
      )}
      <div className="n-rows">
        <KV label={t('soc.edit.now')} value={leverNow(names, l)} />
        <KV label={t('soc.edit.notice')} value={span(l.notice_seconds)} />
        <KV label={t('soc.edit.cooldown')} value={span(l.cooldown_seconds)} />
      </div>
      {review && <Button block icon="m_check" onClick={() => nav.act(review)}>{label(review, names)}</Button>}
      <Rest acts={acts.filter((a) => !moves.includes(a) && a !== review)} names={names} />
    </Page>
  )
}

// -- the public record ------------------------------------------------------------------------------------

export function GovHistory({ response, loading }: NScreenProps) {
  const names = useNames()
  if (!response?.view) return <Loader loading={loading} title={t('soc.act.gov.history')} art="x_scroll" />
  const v = response.view as unknown as GovHistoryView
  const acts = usable(response)
  const entries = v.entries ?? []
  return (
    <Page title={t('soc.history.title', { city: placeName(names, v.city) })} sub={v.pages > 1 ? t('n.soc.page', { a: formatNumber(Math.max(1, v.page)), b: formatNumber(v.pages) }) : undefined}>
      <Said r={response} />
      {entries.length === 0 && <Empty icon="x_scroll">{t('soc.history.empty')}</Empty>}
      {entries.length > 0 && (
        <List>
          {entries.map((e, i) => {
            const lever = { code: e.lever, type: e.type }
            const alloc = e.type === 'allocation'
            const by = t('soc.history.by', { office: officeName(names, e.office), player: who(e.by), ago: span(e.ago_seconds) })
            const when = e.effective_in_seconds > 0 ? t('soc.history.in', { when: span(e.effective_in_seconds) }) : t('soc.history.since', { when: span(-e.effective_in_seconds) })
            return (
              <Row key={i} icon={alloc ? 'coins' : 'chart'} title={leverName(names, e.lever)}
                sub={<>{alloc ? null : <span className="n-soc-diff"><s>{leverValue(lever, e.old)}</s> ← <b>{leverValue(lever, e.new)}</b></span>}{`${by} · ${when}`}</>}
                end={alloc && e.effective_in_seconds > 0 ? <Chip tone="warn">{t('n.soc.gov.announced')}</Chip> : undefined} />
            )
          })}
        </List>
      )}
      <Pager acts={acts} />
      <Rest acts={acts.filter((a) => !isPager(a))} names={names} />
    </Page>
  )
}

// -- refusals and appointments ------------------------------------------------------------------------------

function govRefusalText(n: Names, r: GovRefusal, lever?: GovLever | null): string {
  const office = officeName(n, r.office || lever?.held_by || '')
  if (r.kind === 'cooldown') return r.wait_seconds > 0 ? t('soc.refusal.gov.cooldown', { wait: span(r.wait_seconds) }) : t('soc.refusal.gov.cooldown_later')
  if (r.kind === 'out_of_range') return lever ? t('soc.refusal.gov.out_of_range', { min: leverValue(lever, lever.min), max: leverValue(lever, lever.max) }) : t('soc.refusal.gov.out_of_range_plain')
  return word(`soc.refusal.gov.${r.kind}`, t('soc.refusal.unknown'), { office: office || t('soc.unnamed_office') })
}

export function PolicyRefused({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as PolicyRefusalView | undefined
  return <Outcome response={response} names={names} title={t('soc.refused.title')} icon="x_wanted" tone="bad"
    lead={v ? govRefusalText(names, v.refusal, v.lever) : t('soc.refusal.unknown')} />
}

export function AppointRefusal({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as AppointRefusalView | undefined
  return <Outcome response={response} names={names} title={t('soc.refused.title')} icon="x_wanted" tone="bad"
    lead={!v ? t('soc.refusal.unknown') : v.gov ? govRefusalText(names, v.gov) : word(`soc.refusal.appoint.${v.kind}`, t('soc.refusal.unknown'), { office: officeName(names, v.office) || t('soc.unnamed_office') })} />
}

export function AppointConfirm({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as AppointView | undefined
  if (!v) return null
  return <Outcome response={response} names={names} title={t('soc.appoint.title')} icon="x_crown"
    lead={t('soc.appoint.confirm', { player: who(v.player), office: officeName(names, v.office), place: placeName(names, v.place) })}
    yes={(a) => a.id === 'gov.appoint.confirm'} />
}

export function DismissConfirm({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as DismissView | undefined
  if (!v) return null
  return <Outcome response={response} names={names} title={t('soc.dismiss.title')} icon="x_crown" tone="bad"
    lead={t('soc.dismiss.confirm', { player: who(v.holder), office: officeName(names, v.office), place: placeName(names, v.place) })}
    lines={[t('soc.dismiss.note')]} yes={(a) => a.id === 'gov.dismiss.confirm'} />
}

export function AppointDone({ response }: NScreenProps) {
  const names = useNames()
  const v = response?.view as unknown as AppointDoneView | undefined
  if (!v) return null
  return <Outcome response={response} names={names} title={t(v.dismissed ? 'soc.dismiss.done_title' : 'soc.appoint.done_title')} icon="x_crown" tone="ok"
    lead={t(v.dismissed ? 'soc.dismiss.done' : 'soc.appoint.done', { player: who(v.player), office: officeName(names, v.office), place: placeName(names, v.place) })}
    lines={[!v.dismissed && v.term_ends_in_seconds > 0 ? t('soc.appoint.term', { term: span(v.term_ends_in_seconds) }) : null]} />
}
