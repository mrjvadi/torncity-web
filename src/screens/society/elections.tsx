// Elections: the list for the player's city and above it, one election with its candidates,
// standing and voting, and the answers (stood, voted, refused). A ballot is secret: no screen
// says who voted for whom, and the counts show only once the count is done.

import type { ElectionRefusalView, ElectionsView, ElectionView, StoodView, VotedView, ElectionLine } from '../../api/views.gen'
import type { Action } from '../../api/types'
import { Bar, Chip, ListRow, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { money } from '../native/kit/format'
import { t } from '../../i18n'
import { Facts, Hint, Lead, Page, Panel, Rest } from '../village/flow'
import { screen } from './host'
import { bpsText, electionTitle, officeName, phaseText, placeName, playerText, playersText, span, word } from './common'

const lineSub = (l: ElectionLine): string => {
  switch (l.phase) {
    case 'counted': return l.elected && l.elected.length ? t('soc.election.winner', { names: playersText(l.elected) }) : t('soc.election.unfilled')
    case 'counting': return t('soc.election.line.counting')
    case 'voting': return t('soc.election.line.voting', { remaining: span(l.remaining_seconds), count: formatNumber(l.candidates) })
    default: return t('soc.election.line.candidacy', { remaining: span(l.remaining_seconds), count: formatNumber(l.candidates) })
  }
}

const Elections = screen<ElectionsView>(({ view: v, ctx }) => {
  if (v.no_city) {
    return (
      <Page title={t('soc.election.title_plain')} tone="violet">
        <Panel tone="violet"><Lead>{t('soc.election.no_city')}</Lead></Panel>
        <Rest ctx={ctx} />
      </Page>
    )
  }
  const open = ctx.acts.filter((a) => a.id === 'election.open')
  return (
    <Page title={t('soc.election.title', { place: placeName(ctx.names, v.place) })} tone="violet">
      {(v.elections ?? []).length === 0 && <Panel tone="violet"><Lead>{t('soc.election.none')}</Lead></Panel>}
      <div className="vf-stack">
        {(v.elections ?? []).map((l) => {
          const act = open.find((a) => a.args?.no === String(l.no))
          return (
            <ListRow key={l.no} icon="vote" palette="violet" title={`${formatNumber(l.no)}. ${electionTitle(ctx.names, l.office, l.place)}`}
              sub={lineSub(l)} right={<Chip tone={l.phase === 'counted' ? 'emerald' : 'violet'}>{phaseText(l.phase)}</Chip>}
              onClick={act ? () => ctx.go(act) : undefined} />
          )
        })}
      </div>
      <Hint>{t(v.place.kind === 'village' ? 'soc.election.hint_village' : 'soc.election.hint')}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'election.open'} />
    </Page>
  )
})

function standLabel(a: Action, v: ElectionView): string {
  const m = a.args?.method
  return m ? word(`soc.election.pay.${m}`, m, { amount: money(v.deposit) }) : t('soc.act.election.stand')
}

const Election = screen<ElectionView>(({ view: v, ctx }) => {
  const cands = v.candidates ?? []
  const total = cands.reduce((s, c) => s + c.votes, 0) || v.votes_cast || 0
  const votes = ctx.acts.filter((a) => a.id === 'election.vote')
  const stands = ctx.acts.filter((a) => a.id === 'election.stand')
  const p = v.payment
  return (
    <Page title={electionTitle(ctx.names, v.office, v.place)} tone="violet">
      <Panel tone="violet">
        <Facts rows={[
          { label: t('soc.election.seats'), value: formatNumber(v.seats) },
          { label: t('soc.election.phase'), value: phaseText(v.phase), gold: true },
          ...(v.phase === 'candidacy' ? [{ label: t('soc.election.voting_in'), value: span(v.remaining_seconds) }] : []),
          ...(v.phase === 'voting' ? [{ label: t('soc.election.count_in'), value: span(v.remaining_seconds) }] : []),
          ...(v.phase === 'counted' ? [{ label: t('soc.election.cast'), value: formatNumber(v.votes_cast) }] : []),
          ...(v.phase === 'candidacy' && v.deposit > 0 ? [{ label: t('soc.election.deposit'), value: money(v.deposit) }] : []),
        ]} />
        {v.phase === 'candidacy' && v.deposit > 0 && <Hint>{t('soc.election.deposit_note', { share: bpsText(v.refund_share_bps) })}</Hint>}
      </Panel>

      <Panel>
        <SectionTitle>{t('soc.election.candidates')}</SectionTitle>
        {cands.length === 0 && <Hint>{t('soc.election.no_candidates')}</Hint>}
        {cands.map((c, i) => {
          const vote = votes.find((a) => a.args?.candidate === String(i + 1))
          return (
            <div key={i} className="sc-cand">
              <div className="sc-cand-head">
                <span className={c.mine ? 'sc-mine' : undefined}>{playerText(c.player)}{c.mine ? ` ${t('soc.you')}` : ''}</span>
                {c.elected && <Chip tone="gold">{t('soc.election.elected')}</Chip>}
              </div>
              {c.counted && <Bar frac={total ? Math.min(1, c.votes / total) : 0} color={c.mine ? '#46d27a' : '#4a7bd9'} label={t('soc.election.votes', { n: formatNumber(c.votes) })} />}
              {vote && <Slab tone="gold" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(vote)}>{t('soc.election.vote_for', { player: c.player.name || c.player.code })}</Slab>}
            </div>
          )
        })}
      </Panel>

      <Panel>
        {v.standing && v.phase !== 'counted' && <Lead tone="good">{t('soc.election.you_stand')}</Lead>}
        {!v.standing && v.can_stand && (
          <>
            <Lead>{t('soc.election.stand_how', { deposit: money(v.deposit) })}</Lead>
            {p && <Hint>{t('soc.election.balances', { cash: money(p.cash), bank: money(p.bank) })}</Hint>}
            {p && (p.usable ?? []).length === 0 && <Hint tone="bad">{t('soc.election.cannot_afford')}</Hint>}
            <div className="vf-btns">
              {stands.map((a) => (
                <Slab key={a.args?.method ?? 'free'} tone="gold" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{standLabel(a, v)}</Slab>
              ))}
            </div>
          </>
        )}
        {!v.standing && !v.can_stand && v.stand_blocked && v.phase === 'candidacy' && (
          <Hint tone="bad">{word(`soc.election.cannot_stand.${v.stand_blocked}`, t('soc.election.cannot_stand.other'), { level: formatNumber(v.min_level) })}</Hint>
        )}
        {v.voted && <Lead tone="good">{t('soc.election.you_voted')}</Lead>}
        {!v.voted && v.can_vote && <Hint>{t('soc.election.vote_how')}</Hint>}
        {!v.voted && !v.can_vote && v.vote_blocked && v.phase === 'voting' && (
          <Hint tone="bad">{word(`soc.election.cannot_vote.${v.vote_blocked}`, t('soc.election.cannot_vote.other'))}</Hint>
        )}
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id === 'election.vote' || a.id === 'election.stand'} />
    </Page>
  )
})

const Stood = screen<StoodView>(({ view: v, ctx }) => (
  <Page title={t('soc.election.stood_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('soc.election.stood', { election: electionTitle(ctx.names, v.office, v.place) })}</Lead>
      {v.deposit > 0 && <Hint>{t('soc.election.stood_deposit', { deposit: money(v.deposit), method: word(`soc.paid.${v.method}`, '') })}</Hint>}
      <Hint>{t('soc.election.voting_starts', { span: span(v.voting_in_seconds) })}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const Voted = screen<VotedView>(({ view: v, ctx }) => (
  <Page title={t('soc.election.voted_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('soc.election.voted', { election: electionTitle(ctx.names, v.office, v.place), player: playerText(v.candidate) })}</Lead>
      <Hint>{t('soc.election.secret')}</Hint>
      <Hint>{t('soc.election.count_starts', { span: span(v.count_in_seconds) })}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const ElectionRefusal = screen<ElectionRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`soc.refusal.election.${v.kind === 'away' && v.place.kind === 'village' ? 'away_village' : v.kind}`, t('soc.refusal.unknown'), {
        election: v.office ? electionTitle(ctx.names, v.office, v.place) : t('soc.election.this'), office: officeName(ctx.names, v.office),
      })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const ELECTION_SCREENS = { elections: Elections, election: Election, stood: Stood, voted: Voted, election_refusal: ElectionRefusal }

