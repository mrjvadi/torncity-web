// انتخابات: the elections of the player's city and above it, the one running now as a hero with its time left and
// the way in; one election with its path (candidacy, voting, count), its candidates (their votes as meters once
// counted), standing and voting. A ballot is secret: nothing says who voted for whom.

import { useState } from 'react'
import type { NScreenProps } from '../../registry'
import type { ElectionLine, ElectionRefusalView, ElectionsView, ElectionView, StoodView, VotedView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, List, Loading, Meter, Note, Page, Row, Section, Steps } from '../../ui'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { avatar, bps, electionTitle, label, Outcome, placeName, Rest, Said, span, usable, useNames, who, word } from './common'

const PHASES = ['candidacy', 'voting', 'counting', 'counted']
const phaseText = (p: string) => word(`soc.phase.${p}`, p)
const phaseTone = (p: string) => (p === 'voting' ? 'accent' : p === 'counted' ? 'ok' : p === 'counting' ? 'warn' : 'cyan') as 'accent' | 'ok' | 'warn' | 'cyan'

function lineSub(l: ElectionLine): string {
  switch (l.phase) {
    case 'counted': return l.elected && l.elected.length ? t('soc.election.winner', { names: l.elected.map(who).join(t('common.sep') + ' ') }) : t('soc.election.unfilled')
    case 'counting': return t('soc.election.line.counting')
    case 'voting': return t('soc.election.line.voting', { remaining: span(l.remaining_seconds), count: formatNumber(l.candidates) })
    default: return t('soc.election.line.candidacy', { remaining: span(l.remaining_seconds), count: formatNumber(l.candidates) })
  }
}

export function Elections({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  if (!response) return <Page title={t('soc.election.title_plain')}>{loading ? <Loading blocks={[200, 64, 64]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as Partial<ElectionsView>
  const acts = usable(response)
  const open = (l: ElectionLine) => acts.find((a) => a.id === 'election.open' && a.args?.no === String(l.no))
  const list = v.elections ?? []
  // the one that asks something of the player now: a vote first, else a candidacy
  const lead = list.find((l) => l.phase === 'voting') ?? list.find((l) => l.phase === 'candidacy')
  const leadAct = lead ? open(lead) : undefined
  if (v.no_city) {
    return (
      <Page title={t('soc.election.title_plain')}>
        <Said r={response} />
        <Empty icon="vote">{t('soc.election.no_city')}</Empty>
        <Rest acts={acts.filter((a) => a.id !== 'election.open')} names={names} />
      </Page>
    )
  }
  return (
    <Page title={v.place ? t('soc.election.title', { place: placeName(names, v.place) }) : t('soc.election.title_plain')}>
      <Said r={response} />
      {lead && (
        <Hero art="vote">
          <div className="n-chips"><Chip tone={phaseTone(lead.phase)}>{phaseText(lead.phase)}</Chip>{lead.seats > 1 && <Chip>{t('n.soc.election.seats', { n: formatNumber(lead.seats) })}</Chip>}</div>
          <p className="n-soc-hero-title">{electionTitle(names, lead.office, lead.place)}</p>
          {lead.remaining_seconds > 0 && (
            <>
              <p className="n-label">{lead.phase === 'voting' ? t('n.soc.election.count_left') : t('n.soc.election.voting_left')}</p>
              <p className="n-soc-time">{span(lead.remaining_seconds)}</p>
            </>
          )}
          <p className="n-label n-soc-line"><Icon name="person" size={18} />{t('n.soc.election.candidates_n', { n: formatNumber(lead.candidates) })}</p>
          {leadAct && (
            <div className="n-hero-foot">
              <Button block icon={lead.phase === 'voting' ? 'vote' : 'x_scroll'} onClick={() => nav.act(leadAct)}>
                {lead.phase === 'voting' ? t('n.soc.election.vote_now') : t('n.soc.election.see')}
              </Button>
            </div>
          )}
        </Hero>
      )}
      {list.length === 0 && <Empty icon="vote">{t('soc.election.none')}</Empty>}
      {list.length > 0 && (
        <>
          <Section title={t('n.soc.election.all')} note={formatNumber(list.length)} />
          <List>
            {list.map((l) => {
              const a = open(l)
              return <Row key={l.no} icon={l.phase === 'counted' ? 'x_laurel' : 'vote'} title={electionTitle(names, l.office, l.place)} sub={lineSub(l)}
                end={<Chip tone={phaseTone(l.phase)}>{phaseText(l.phase)}</Chip>} onClick={a ? () => nav.act(a) : undefined} />
            })}
          </List>
        </>
      )}
      <Note tone="info" icon="m_lock">{t('soc.election.hint')}</Note>
      <Rest acts={acts.filter((a) => a.id !== 'election.open')} names={names} />
    </Page>
  )
}

export function Election({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useNames()
  const [pick, setPick] = useState<number | null>(null)
  if (!response) return <Page title={t('soc.election.title_plain')}>{loading ? <Loading blocks={[200, 80, 80, 80]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as unknown as ElectionView
  const acts = usable(response)
  const votes = acts.filter((a) => a.id === 'election.vote')
  const stands = acts.filter((a) => a.id === 'election.stand')
  const cands = v.candidates ?? []
  const total = cands.reduce((s, c) => s + c.votes, 0) || v.votes_cast || 0
  const at = Math.max(0, PHASES.indexOf(v.phase))
  const voteOf = (i: number) => votes.find((a) => a.args?.candidate === String(i + 1))
  const chosen = pick !== null ? voteOf(pick) : undefined
  const p = v.payment
  const title = v.office ? electionTitle(names, v.office, v.place) : t('soc.election.title_plain')

  return (
    <Page title={title}>
      <Said r={response} />
      <Hero art={v.phase === 'counted' ? 'x_laurel' : 'vote'}>
        <div className="n-chips">
          <Chip tone={phaseTone(v.phase)}>{phaseText(v.phase)}</Chip>
          <Chip>{t('n.soc.election.seats', { n: formatNumber(v.seats) })}</Chip>
        </div>
        {v.phase !== 'counted' && v.remaining_seconds > 0 && (
          <>
            <p className="n-label n-soc-line">{v.phase === 'candidacy' ? t('n.soc.election.voting_left') : t('n.soc.election.count_left')}</p>
            <p className="n-soc-time">{span(v.remaining_seconds)}</p>
          </>
        )}
        {v.phase === 'counted' && (
          <>
            <p className="n-label n-soc-line">{t('soc.election.cast')}</p>
            <p className="n-soc-time">{formatNumber(v.votes_cast)}</p>
          </>
        )}
        <div className="n-soc-steps"><Steps steps={PHASES.map(phaseText)} at={at} /></div>
      </Hero>

      {v.standing && v.phase !== 'counted' && <Note tone="ok" icon="m_check">{t('soc.election.you_stand')}</Note>}
      {v.voted && <Note tone="ok" icon="m_lock">{t('soc.election.you_voted')}</Note>}

      <Section title={t('soc.election.candidates')} note={cands.length ? formatNumber(cands.length) : undefined} />
      {cands.length === 0 && <Empty icon="person">{t('soc.election.no_candidates')}</Empty>}
      <div className="n-rows">
        {cands.map((c, i) => {
          const name = who(c.player)
          const av = avatar(name)
          const can = !!voteOf(i)
          const on = pick === i
          const body = (
            <>
              <span className="n-row-av" style={{ background: `hsl(${av.hue} 42% 38%)` }}>{av.letter}</span>
              <span className="n-row-body">
                <span className="n-row-title">{name}{c.mine ? ` ${t('soc.you')}` : ''}</span>
                {c.counted && <Meter frac={total ? c.votes / total : 0} tone={c.elected ? 'accent' : 'cyan'} label={t('soc.election.votes', { n: formatNumber(c.votes) })}
                  value={total ? bps((c.votes / total) * 10000) : undefined} />}
              </span>
              {c.elected && <Chip tone="solid">{t('soc.election.elected')}</Chip>}
              {can && <span className="n-soc-radio" data-on={on || undefined} aria-hidden="true" />}
            </>
          )
          return can
            ? <button key={i} className={`n-row n-soc-cand${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setPick(on ? null : i)}>{body}</button>
            : <div key={i} className={`n-row n-soc-cand${c.elected ? ' won' : ''}`}>{body}</div>
        })}
      </div>

      {votes.length > 0 && (
        <>
          <p className="n-label n-soc-center">{chosen ? t('soc.election.secret') : t('soc.election.vote_how')}</p>
          <Button block icon="vote" disabled={!chosen} onClick={() => chosen && nav.act(chosen)}>
            {chosen && pick !== null ? t('soc.election.vote_for', { player: who(cands[pick]?.player) }) : t('n.soc.election.vote_now')}
          </Button>
        </>
      )}
      {!v.voted && !v.can_vote && v.vote_blocked && v.phase === 'voting' && (
        <Note tone="bad" icon="x_wanted">{word(`soc.election.cannot_vote.${v.vote_blocked}`, t('soc.election.cannot_vote.other'))}</Note>
      )}

      {!v.standing && stands.length > 0 && (
        <>
          <Section title={t('soc.act.election.stand')} />
          <div className="n-card flat n-soc-stack">
            <p className="n-text">{t('soc.election.stand_how', { deposit: money(v.deposit) })}</p>
            {v.refund_share_bps > 0 && <p className="n-label">{t('soc.election.deposit_note', { share: bps(v.refund_share_bps) })}</p>}
            {p && <p className="n-label">{t('soc.election.balances', { cash: money(p.cash), bank: money(p.bank) })}</p>}
            {p && (p.usable ?? []).length === 0 && <p className="n-why">{t('soc.election.cannot_afford')}</p>}
            <div className="n-soc-stack">
              {stands.map((a, i) => {
                const m = a.args?.method ?? ''
                const off = !!p && !(p.usable ?? []).includes(m)
                return <Button key={m || i} block kind={votes.length === 0 && i === 0 ? 'primary' : 'cyan'} disabled={off} onClick={() => nav.act(a)}>
                  {m ? word(`soc.election.pay.${m}`, label(a, names), { amount: money(v.deposit) }) : label(a, names)}
                </Button>
              })}
            </div>
          </div>
        </>
      )}
      {!v.standing && !v.can_stand && v.stand_blocked && v.phase === 'candidacy' && (
        <Note tone="bad" icon="x_wanted">{word(`soc.election.cannot_stand.${v.stand_blocked}`, t('soc.election.cannot_stand.other'), { level: formatNumber(v.min_level) })}</Note>
      )}
      <Rest acts={acts.filter((a) => a.id !== 'election.vote' && a.id !== 'election.stand')} names={names} />
    </Page>
  )
}

export function Stood({ response }: NScreenProps) {
  const names = useNames()
  const v = (response?.view ?? {}) as Partial<StoodView>
  return (
    <Outcome response={response} names={names} title={t('soc.election.stood_title')} icon="x_scroll" tone="ok"
      lead={t('soc.election.stood', { election: v.office && v.place ? electionTitle(names, v.office, v.place) : t('soc.election.this') })}
      lines={[
        v.deposit ? t('soc.election.stood_deposit', { deposit: money(v.deposit), method: word(`soc.paid.${v.method ?? ''}`) }) : null,
        v.voting_in_seconds ? t('soc.election.voting_starts', { span: span(v.voting_in_seconds) }) : null,
      ]} />
  )
}

export function Voted({ response }: NScreenProps) {
  const names = useNames()
  const v = (response?.view ?? {}) as Partial<VotedView>
  return (
    <Outcome response={response} names={names} title={t('soc.election.voted_title')} icon="vote" tone="ok"
      lead={t('soc.election.voted', { election: v.office && v.place ? electionTitle(names, v.office, v.place) : t('soc.election.this'), player: who(v.candidate) })}
      lines={[t('soc.election.secret'), v.count_in_seconds ? t('soc.election.count_starts', { span: span(v.count_in_seconds) }) : null]} />
  )
}

export function ElectionRefusal({ response }: NScreenProps) {
  const names = useNames()
  const v = (response?.view ?? {}) as Partial<ElectionRefusalView>
  const election = v.office && v.place ? electionTitle(names, v.office, v.place) : t('soc.election.this')
  return (
    <Outcome response={response} names={names} title={t('soc.refused.title')} icon="x_wanted" tone="bad"
      lead={word(`soc.refusal.election.${v.kind ?? ''}`, t('soc.refusal.unknown'), { election, office: v.office ? names.name(['office'], v.office, '') : '' })} />
  )
}
