// The charter's votes (web map section 8): the acting head, open and finished ballots (elections, recalls, amendments), the
// recall petitions and the rules in plain words. Ballots are SECRET: the server sends counts only once a ballot is settled,
// so an open ballot shows who may vote and what it needs, never a running tally. Every button comes from a view flag
// (`can_stand`, `can_vote`, `can_sign`), never from a guess.

import { useState } from 'react'
import Popup, { ActionButton, ActionRow, Note, Section } from '../../ui/Popup'
import { CardGrid, PBar, PCard } from '../../ui/v6/panel'
import { money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'
import { atText, words } from '../../lib/duration'
import { useNow } from '../../village/useVillage'
import type { CharterActingView, CharterBallotView, CharterGrantView, CharterPetitionView, CharterRulesView } from '../../api/views.gen'

const permKey = (code: string) => `charter.perm.${code.replace(':', '.')}`
const permName = (code: string) => (hasKey(permKey(code)) ? t(permKey(code) as Key) : t('charter.perm.other'))
const grantText = (g: CharterGrantView) => (g.limit > 0 ? t('charter.perm_limit', { name: permName(g.permission), limit: money(g.limit) }) : permName(g.permission))
const howName = (a: string) => t(a === 'election' ? 'charter.how_opt.election' : 'charter.how_opt.appointment')

export function ballotTitle(b: CharterBallotView): string {
  const kind = b.kind === 'recall' ? 'charter.kind.recall' : b.kind === 'amendment' ? 'charter.kind.amendment' : 'charter.kind.election'
  return t(kind, { office: b.office, target: b.target?.name ?? '' })
}

/** What the ballot's outcome says, in a sentence, for a settled one. */
export function resultText(b: CharterBallotView): string {
  if (b.status === 'open') return ''
  if (b.status === 'void' || b.status === 'cancelled' || b.status === 'no_result') {
    const k = `charter.result.${b.kind}.${b.status}`
    return hasKey(k) ? t(k as Key) : t(`charter.result.${b.status}` as Key)
  }
  if (b.kind === 'election') return b.status === 'passed' ? t('charter.result.election.passed', { names: (b.winners ?? []).map((w) => w.name).join('، ') }) : t('charter.result.election.failed')
  return t(`charter.result.${b.kind}.${b.status === 'passed' ? 'passed' : 'failed'}` as Key)
}

// -- the acting head ------------------------------------------------------------------------------------------------------

export function ActingBanner({ acting, vacant, head }: { acting: CharterActingView | null; vacant: boolean; head: string }) {
  if (acting) return <Note>{t('charter.acting', { name: acting.player.name, office: acting.office, at: atText(acting.ends), head, cap: money(acting.spend_cap) })}</Note>
  if (vacant) return <Note>{t('charter.vacant_head', { head })}</Note>
  return null
}

// -- ballots ------------------------------------------------------------------------------------------------------

export function BallotCards({ ballots, onOpen }: { ballots: CharterBallotView[]; onOpen: (id: string) => void }) {
  return (
    <CardGrid>
      {ballots.map((b) => (
        <PCard
          key={b.id} icon={b.kind === 'election' ? 'scroll' : b.kind === 'recall' ? 'cross' : 'banner'} title={ballotTitle(b)}
          sub={b.status === 'open' ? t(`charter.phase.${b.phase}` as Key) : resultText(b)}
          badge={b.status === 'open' ? (b.can_vote || b.can_stand ? t(b.can_stand ? 'charter.stand' : 'charter.vote') : b.voted ? t('charter.voted') : b.standing ? t('charter.standing') : undefined) : undefined}
          tone={b.status === 'open' && (b.can_vote || b.can_stand) ? 'good' : b.status !== 'open' ? 'off' : undefined}
          onClick={() => onOpen(b.id)}
        />
      ))}
    </CardGrid>
  )
}

export function BallotPopup({ b, busy, onClose, onStand, onVote }: {
  b: CharterBallotView; busy: boolean; onClose: () => void; onStand: () => void; onVote: (choice: string) => void
}) {
  const now = useNow(30_000)
  const [pick, setPick] = useState('')
  const open = b.status === 'open'
  const end = b.phase === 'candidacy' ? b.candidacy_ends : b.closes_at
  const left = end ? Math.max(0, (Date.parse(end) - now) / 1000) : 0
  const candidates = b.candidates ?? []
  return (
    <Popup
      onClose={onClose} title={ballotTitle(b)} tone="navy" dismissible={!busy}
      footer={open && (b.can_stand || b.can_vote) ? (
        b.kind === 'election' ? (
          b.can_stand ? <ActionButton tone="green" busy={busy} onClick={onStand}>{t('charter.stand')}</ActionButton>
            : <ActionButton tone="green" busy={busy} disabled={!pick} onClick={() => onVote(pick)}>{t('charter.vote')}</ActionButton>
        ) : (
          <ActionRow>
            <ActionButton tone="red" disabled={busy} onClick={() => onVote('no')}>{t('charter.no')}</ActionButton>
            <ActionButton tone="green" disabled={busy} onClick={() => onVote('yes')}>{t('charter.yes')}</ActionButton>
          </ActionRow>
        )
      ) : undefined}
    >
      {open ? (
        <>
          <Note>{t(b.phase === 'candidacy' ? 'charter.candidacy_left' : 'charter.voting_left', { left: words(left), at: atText(end, now) })}</Note>
          <p className="pn-hint">{t('charter.eligible', { n: formatNumber(b.eligible) })}</p>
          {b.kind === 'recall' && <p className="pn-hint">{t('charter.needed_recall', { n: formatNumber(b.needed) })}</p>}
          {b.kind === 'amendment' && <p className="pn-hint">{t('charter.needed_amend', { n: formatNumber(b.needed) })}</p>}
          <p className="pn-hint">{t('charter.secret')}</p>
          {b.voted && <Note tone="good">{t('charter.voted')}</Note>}
          {b.standing && <Note tone="good">{t('charter.standing')}</Note>}
        </>
      ) : (
        <>
          <Note tone={b.status === 'passed' ? 'good' : undefined}>{resultText(b)}</Note>
          {b.yes !== null && b.no !== null && <p className="pn-hint">{t('charter.tally', { yes: formatNumber(b.yes), no: formatNumber(b.no) })}</p>}
        </>
      )}

      {b.kind === 'election' && (
        <>
          <Section>{t('charter.candidates')}</Section>
          {candidates.length === 0 && <p className="pn-hint">{t('charter.no_candidates')}</p>}
          <div className="ch-list">
            {candidates.map((c) => {
              const win = (b.winners ?? []).some((w) => w.code === c.code)
              const selectable = open && b.can_vote
              return (
                <button
                  key={c.code} type="button" role={selectable ? 'radio' : undefined} aria-checked={selectable ? pick === c.code : undefined}
                  className={`ch-cand${pick === c.code ? ' on' : ''}${win ? ' win' : ''}`} disabled={!selectable} onClick={() => setPick(c.code)}
                >
                  <span className="ch-name">{c.name}<small dir="ltr" data-latin>{c.code}</small></span>
                  {c.votes !== null && <b>{t('charter.votes_n', { n: formatNumber(c.votes) })}</b>}
                  {win && <b className="ch-win">{t('charter.winners')}</b>}
                </button>
              )
            })}
          </div>
          {open && b.can_vote && <p className="pn-hint">{t('charter.pick_candidate')}</p>}
        </>
      )}

      {b.kind === 'amendment' && b.proposal && (
        <>
          <Section>{t('charter.proposal')}</Section>
          {b.proposal.op === 'close' ? <p>{t('charter.proposal.close')}</p> : (
            <>
              <p>{t('charter.proposal.save', { title: b.proposal.title, seats: formatNumber(b.proposal.seats), how: howName(b.proposal.acquisition), deputy: b.proposal.deputy ? t('charter.proposal.deputy') : '' })}</p>
              <div className="ch-chips">{(b.proposal.grants ?? []).map((g) => <span key={g.permission} className="nx-chip nx-chip-gold">{grantText(g)}</span>)}</div>
            </>
          )}
        </>
      )}
    </Popup>
  )
}

// -- recall petitions -----------------------------------------------------------------------------------------------------

export function PetitionCards({ petitions, busy, onSign }: { petitions: CharterPetitionView[]; busy: boolean; onSign: (id: string) => void }) {
  return (
    <CardGrid>
      {petitions.map((p) => (
        <PCard
          key={p.id} icon="cross" title={t('charter.petition_line', { target: p.target.name, office: p.office })}
          facts={<><PBar frac={p.needed > 0 ? Math.min(1, p.signatures / p.needed) : 0} /><span>{t('charter.petition_progress', { n: formatNumber(p.signatures), needed: formatNumber(p.needed) })}</span></>}
          foot={p.can_sign ? <button className="pn-btn" disabled={busy} onClick={() => onSign(p.id)}>{t('charter.sign')}</button> : p.signed ? <span className="pn-hint">{t('charter.signed')}</span> : undefined}
        />
      ))}
    </CardGrid>
  )
}

// -- the rules in plain words --------------------------------------------------------------------------------------------

export function RulesHelp({ r, head }: { r: CharterRulesView; head: string }) {
  return (
    <div className="ch-rules">
      <p>{t('charter.rule.election', { c: formatNumber(r.candidacy_hours), v: formatNumber(r.voting_hours), d: formatNumber(r.election_term_days) })}</p>
      <p>{t('charter.rule.recall', { t: formatNumber(r.recall_min_tenure_days), p: formatNumber(r.recall_signature_bps / 100), m: formatNumber(r.recall_min_signatures), h: formatNumber(r.recall_vote_hours) })}</p>
      <p>{t('charter.rule.amend', { h: formatNumber(r.amend_vote_hours) })}</p>
      <p>{t('charter.rule.acting', { head, a: formatNumber(r.acting_days) })}</p>
    </div>
  )
}
