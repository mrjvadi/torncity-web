// The legislature: the proposals put to a body's vote in the player's places, one proposal with its
// votes, and the refusals. A legislator's vote is public record, unlike a ballot.

import type { BillRefusalView, BillsView, BillSubject, BillView } from '../../api/views.gen'
import { Chip, ListRow, SectionTitle } from '../native/kit/Parts'
import { formatNumber } from '../../lib/persian'
import { t } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, type FlowCtx } from '../village/flow'
import { screen } from './host'
import { allocationText, key, leverName, leverValue, officeName, placeName, playerText, span, word } from './common'
import { CardGrid } from '../../ui/v6/panel'

/** What a proposal would do, in one line. */
function subjectText(ctx: FlowCtx, s: BillSubject): string {
  if (s.kind === 'action') {
    const act = word(`soc.law.action.${s.code}`, t('soc.law.action_unnamed'))
    return s.target ? `${act} ${t('soc.law.action_target', { target: placeName(ctx.names, s.target) })}` : act
  }
  if (s.lever_type === 'allocation') return t('soc.law.subject_allocation', { lever: leverName(ctx.names, s.code), shares: allocationText(ctx.names, s.allocation, s.categories) })
  return t('soc.law.subject_lever', { lever: leverName(ctx.names, s.code), value: leverValue({ code: s.code, type: s.lever_type }, s.value) })
}

/** "2/3" in this language's digits. */
function fraction(raw: string): string {
  const [n, d] = raw.split('/')
  if (!d) return raw
  return t('soc.law.fraction', { num: formatNumber(Number(n)), den: formatNumber(Number(d)) })
}

function statusText(v: BillView): string {
  switch (v.status) {
    case 'open': return t('soc.law.status.open', { remaining: span(v.remaining_seconds), yes: formatNumber(v.yes), no: formatNumber(v.nay) })
    case 'passed': return t('soc.law.status.passed', { yes: formatNumber(v.yes), no: formatNumber(v.nay) })
    case 'lapsed': return t('soc.law.status.lapsed', { why: word(`soc.law.lapse.${v.lapsed_why || 'changed'}`, '') })
    default: return t('soc.law.status.failed', { yes: formatNumber(v.yes), no: formatNumber(v.nay) })
  }
}

const tone = (s: string) => (s === 'passed' ? 'emerald' : s === 'open' ? 'violet' : 'ruby')

const Bills = screen<BillsView>(({ view: v, ctx }) => {
  const open = ctx.acts.filter((a) => a.id === 'law.view')
  return (
    <Page title={t('soc.law.list_title')} tone="violet">
      {(v.bills ?? []).length === 0 && <Panel tone="violet"><Lead>{t('soc.law.list_empty')}</Lead></Panel>}
      <CardGrid>
        {(v.bills ?? []).map((b) => {
          const act = open.find((a) => a.args?.no === String(b.no))
          return (
            <ListRow key={b.no} icon="vote" palette="violet" title={`${t('soc.law.no', { no: formatNumber(b.no) })} · ${placeName(ctx.names, b.place)}`}
              sub={`${subjectText(ctx, b.subject)} — ${statusText(b)}`} right={<Chip tone={tone(b.status)}>{t(key(`soc.law.chip.${b.status}`))}</Chip>}
              onClick={act ? () => ctx.go(act) : undefined} />
          )
        })}
      </CardGrid>
      <Rest ctx={ctx} skip={(a) => a.id === 'law.view'} />
    </Page>
  )
})

const Bill = screen<BillView>(({ view: v, ctx }) => {
  const body = officeName(ctx.names, v.body)
  const place = placeName(ctx.names, v.place)
  const notice = v.notice ? word(`soc.law.notice.${v.notice}`, '', { body, place }) : ''
  const votes = ctx.acts.filter((a) => a.id === 'law.vote.for' || a.id === 'law.vote.against')
  return (
    <Page title={t('soc.law.title', { no: formatNumber(v.no), place })} tone={tone(v.status)}>
      {notice && <Panel tone="emerald"><Lead tone="good">{notice}</Lead></Panel>}
      <Panel tone={tone(v.status)}>
        <Lead>{subjectText(ctx, v.subject)}</Lead>
        <Hint>{t('soc.law.proposed_by', { office: officeName(ctx.names, v.office), player: playerText(v.by) })}</Hint>
        <Facts rows={[
          { label: t('soc.law.body'), value: t('soc.law.body_seats', { body, held: formatNumber(v.held), seats: formatNumber(v.seats) }) },
          { label: t('soc.law.rule'), value: v.rule === 'supermajority' ? t('soc.law.rule.supermajority', { threshold: fraction(v.threshold) }) : v.rule === 'unanimous' ? t('soc.law.rule.unanimous') : t('soc.law.rule.majority') },
          ...(v.quorum ? [{ label: t('soc.law.quorum'), value: fraction(v.quorum) }] : []),
          { label: t('soc.law.status'), value: statusText(v), gold: true },
          ...(v.status === 'open' ? [{ label: t('soc.law.needs'), value: t('soc.law.needs_of', { needs: formatNumber(v.needs), held: formatNumber(v.held) }) }] : []),
        ]} />
        {v.status === 'open' && v.can_vote && <Btns ctx={ctx} list={votes} row />}
      </Panel>
      {(v.votes ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('soc.law.votes')}</SectionTitle>
          {(v.votes ?? []).map((x, i) => (
            <div key={i} className="sc-line"><span className="sc-line-title">{playerText(x.player)}</span><span className={`sc-line-end ${x.yes ? 'sc-yes' : 'sc-no'}`}>{t(x.yes ? 'soc.law.vote_yes' : 'soc.law.vote_no')}</span></div>
          ))}
        </Panel>
      )}
      <Rest ctx={ctx} skip={(a) => votes.includes(a)} />
    </Page>
  )
})

const BillRefusal = screen<BillRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`soc.refusal.bill.${v.kind}`, t('soc.refusal.unknown'), { body: officeName(ctx.names, v.body) || t('soc.unnamed_office'), no: formatNumber(v.no) })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const LEGISLATURE_SCREENS = { bills: Bills, bill: Bill, bill_refusal: BillRefusal }
