// Factions: the factions of a city and a faction's page, founding one, a member's own screen,
// its members, invitations and applications, its bank and its organised crimes, and the answers.
// Everything private to a member is the member's own page; nothing here shows another's money.

import type {
  FactionAnsweredView, FactionAppliedView, FactionBankView, FactionConfirmView, FactionCrimeBoardView, FactionFoundedView, FactionFoundView,
  FactionHomeView, FactionInvitedView, FactionLeftView, FactionLinkedView, FactionListView, FactionMembersView, FactionOperationLine,
  FactionPageView, FactionRefusalView,
} from '../../api/views.gen'
import type { Action } from '../../api/types'
import { Bar, Chip, ListRow, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { formatNumber } from '../../lib/persian'
import { money } from '../native/kit/format'
import { t } from '../../i18n'
import { Btns, Cancel, Facts, Hint, Lead, Page, Panel, Rest, type FlowCtx } from '../village/flow'
import { screen } from './host'
import { bpsText, key, playerText, playersText, span, word } from './common'
import { durationText } from '../village/common'

const rank = (r: string) => word(`soc.faction.rank.${r}`, r)
const cityOf = (ctx: FlowCtx, code: string, name: string) => ctx.names.name(['city'], code, name)

function Operation({ ctx, o }: { ctx: FlowCtx; o: FactionOperationLine }) {
  const crime = ctx.names.name(['crime'], o.crime.code, o.crime.name)
  const place = ctx.names.name(['place'], o.place.code, o.place.name)
  return (
    <>
      <SectionTitle>{t('soc.faction.op.title')}</SectionTitle>
      <Facts rows={[
        { label: t('soc.faction.op.crime'), value: crime, gold: true },
        { label: t('soc.faction.op.place'), value: `${place} · ${cityOf(ctx, o.city_code, o.city)}` },
        { label: t('soc.faction.op.status'), value: word(`soc.faction.op.${o.status}`, o.status) },
        ...(o.left_seconds > 0 ? [{ label: o.status === 'gathering' ? t('soc.faction.op.gather_left') : t('soc.faction.op.end_left'), value: span(o.left_seconds) }] : []),
        { label: t('soc.faction.op.crew'), value: t('soc.faction.op.crew_of', { n: formatNumber((o.crew ?? []).length), min: formatNumber(o.min), max: formatNumber(o.max) }) },
        { label: t('soc.faction.op.chance'), value: bpsText(o.chance_bps) },
        { label: t('soc.faction.op.nerve'), value: formatNumber(o.nerve) },
      ]} />
      {(o.crew ?? []).length > 0 && <Hint>{t('soc.faction.op.crew_list', { crew: playersText((o.crew ?? []).map((m) => m.player)) })}</Hint>}
    </>
  )
}

// -- the list and a faction's page -------------------------------------------------------------

const FactionList = screen<FactionListView>(({ view: v, ctx }) => {
  const view = ctx.acts.filter((a) => a.id === 'faction.view')
  return (
    <Page title={v.city ? t('soc.faction.list_city', { city: cityOf(ctx, v.city_code, v.city) }) : t('soc.faction.list')} tone="gold">
      {(v.factions ?? []).length === 0 && <Panel tone="gold"><Lead>{t('soc.faction.none_here')}</Lead></Panel>}
      <div className="vf-stack">
        {(v.factions ?? []).map((f) => {
          const act = view.find((a) => a.args?.code === f.ref.code)
          return <ListRow key={f.ref.code} icon="lion" palette="gold" title={f.ref.name} sub={`${f.ref.code} · ${t('soc.faction.member_count', { n: formatNumber(f.members) })}`}
            onClick={act ? () => ctx.go(act) : undefined} />
        })}
      </div>
      <Panel tone="gold">
        {v.mine ? <Lead>{t('soc.faction.list_mine', { name: v.mine.name })}</Lead>
          : v.founding && !v.founding.open ? (
            // the founding rule: enough people must live here; shown locked with the reason and the progress
            <>
              <Lead tone="bad">{t('soc.faction.locked', { need: formatNumber(v.founding.need) })}</Lead>
              <Bar frac={v.founding.need ? Math.min(1, v.founding.have / v.founding.need) : 0} color="#f2c255"
                label={t('soc.faction.founders')} sub={t('soc.faction.founders_progress', { have: formatNumber(v.founding.have), need: formatNumber(v.founding.need) })} />
            </>
          ) : <Lead>{t('soc.faction.list_found', { fee: money(v.fee) })}</Lead>}
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id === 'faction.view'} />
    </Page>
  )
})

const FactionPage = screen<FactionPageView>(({ view: v, ctx }) => (
  <Page title={v.ref.name} tone="gold">
    <Panel tone="gold">
      <Facts rows={[
        { label: t('soc.faction.code'), value: v.ref.code },
        { label: t('soc.faction.city'), value: cityOf(ctx, v.city_code, v.city) },
        { label: t('soc.faction.members'), value: formatNumber((v.members ?? []).length) },
      ]} />
      {v.linked && <Chip tone="emerald">{t('soc.faction.linked_chip')}</Chip>}
    </Panel>
    <Panel>
      <SectionTitle>{t('soc.faction.members')}</SectionTitle>
      {(v.members ?? []).map((m, i) => <div key={i} className="sc-line"><span className="sc-line-title">{playerText(m.player)}</span><span className="sc-line-end">{rank(m.rank)}</span></div>)}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- founding ------------------------------------------------------------------------------------

const FactionFound = screen<FactionFoundView>(({ view: v, ctx }) => {
  const pays = ctx.acts.filter((a) => a.id === 'faction.found.pay')
  const p = v.payment
  return (
    <Page title={t('soc.faction.found_title')} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('soc.faction.fee'), value: money(v.fee), gold: true },
          { label: t('soc.faction.city'), value: cityOf(ctx, v.city_code, v.city) },
          { label: t('soc.faction.name_rule'), value: t('soc.faction.name_range', { min: formatNumber(v.name_min), max: formatNumber(v.name_max) }) },
        ]} />
        <Hint>{t('soc.faction.found_rules')}</Hint>
        <Hint>{t('soc.faction.balances', { cash: money(p.cash), bank: money(p.bank) })}</Hint>
        {pays.length > 0 ? (
          <>
            <Lead>{t('soc.faction.found_how')}</Lead>
            <div className="vf-btns">
              {pays.map((a) => (
                <Slab key={a.args?.method} tone="gold" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{word(`soc.faction.pay.${a.args?.method}`, '', { amount: money(p.amount) })}</Slab>
              ))}
            </div>
          </>
        ) : <Lead tone="bad">{t('soc.faction.cannot_afford')}</Lead>}
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id === 'faction.found.pay'} />
    </Page>
  )
})

const FactionFounded = screen<FactionFoundedView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.founded_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('soc.faction.founded', { name: v.ref.name, city: cityOf(ctx, v.city_code, v.city) })}</Lead>
      {v.fee > 0 && <Hint>{t('soc.faction.founded_fee', { fee: money(v.fee), method: word(`soc.paid.${v.method}`, '') })}</Hint>}
      <Hint>{t('soc.faction.founded_next', { code: v.ref.code })}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- a member's own screen ----------------------------------------------------------------------

const FactionHome = screen<FactionHomeView>(({ view: v, ctx }) => (
  <Page title={v.ref.name} tone="gold">
    <Panel tone="gold">
      <Facts rows={[
        { label: t('soc.faction.your_rank'), value: rank(v.rank), gold: true },
        { label: t('soc.faction.city'), value: cityOf(ctx, v.city_code, v.city) },
        { label: t('soc.faction.members'), value: t('soc.faction.members_of', { a: formatNumber(v.members), b: formatNumber(v.max_members) }) },
        { label: t('soc.faction.bank'), value: money(v.bank) },
        ...(v.applications > 0 ? [{ label: t('soc.faction.applications'), value: formatNumber(v.applications) }] : []),
      ]} />
      {v.linked ? <Chip tone="emerald">{t('soc.faction.linked_chip')}</Chip> : <Hint>{t('soc.faction.unlinked', { code: v.ref.code })}</Hint>}
    </Panel>
    {v.operation && <Panel><Operation ctx={ctx} o={v.operation} /></Panel>}
    <Rest ctx={ctx} />
  </Page>
))

const FactionMembers = screen<FactionMembersView>(({ view: v, ctx }) => {
  const mine = (id: string, code: string, extra?: (a: Action) => boolean) => ctx.acts.filter((a) => a.id === id && a.args?.player === code && (!extra || extra(a)))
  const used = new Set<Action>()
  const take = (l: Action[]) => { l.forEach((a) => used.add(a)); return l }
  return (
    <Page title={t('soc.faction.members_title', { faction: v.ref.name })} tone="gold">
      <Panel tone="gold">
        <SectionTitle>{t('soc.faction.members_count', { n: formatNumber((v.members ?? []).length), max: formatNumber(v.max) })}</SectionTitle>
        {(v.members ?? []).map((m, i) => {
          const code = m.player.code
          const acts = take([...mine('faction.promote', code), ...mine('faction.demote', code), ...mine('faction.lead', code), ...mine('faction.kick', code)])
          return (
            <div key={i} className="sc-block">
              <div className="sc-line"><span className="sc-line-title">{playerText(m.player)}{m.self ? ` ${t('soc.you')}` : ''}</span><span className="sc-line-end">{rank(m.rank)}</span></div>
              <Btns ctx={ctx} list={acts} row />
            </div>
          )
        })}
      </Panel>
      {(v.requests ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('soc.faction.requests')}</SectionTitle>
          {(v.requests ?? []).map((q) => {
            const acts = take(ctx.acts.filter((a) => (a.id === 'faction.accept' || a.id === 'faction.decline') && a.args?.no === String(q.no)))
            return (
              <div key={q.no} className="sc-block">
                <Hint>{t(key(`soc.faction.request.${q.kind}`), { player: playerText(q.player) })}</Hint>
                {q.can_decide && <Btns ctx={ctx} list={acts} row />}
              </div>
            )
          })}
        </Panel>
      )}
      <Rest ctx={ctx} skip={(a) => used.has(a)} />
    </Page>
  )
})

const FactionInvited = screen<FactionInvitedView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.invited_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{t('soc.faction.invited', { player: playerText(v.player) })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FactionApplied = screen<FactionAppliedView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.applied_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{t('soc.faction.applied', { name: v.ref.name })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FactionAnswered = screen<FactionAnsweredView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.answered_title')} tone={v.accepted ? 'emerald' : 'sapphire'}>
    <Panel tone={v.accepted ? 'emerald' : 'sapphire'}>
      <Lead tone={v.accepted ? 'good' : undefined}>{t(key(`soc.faction.answered.${v.kind}_${v.accepted ? 'accepted' : 'declined'}`), { faction: v.ref.name, player: playerText(v.player) })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FactionConfirm = screen<FactionConfirmView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.confirm_title')} tone="ruby">
    <Panel tone="ruby"><Lead>{t(key(`soc.faction.confirm.${v.kind}`), { faction: v.ref.name, player: playerText(v.player) })}</Lead></Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => (a.id ?? '').startsWith('faction.confirm.'))} tone="red" />
    <Cancel ctx={ctx} />
  </Page>
))

const FactionLeft = screen<FactionLeftView>(({ view: v, ctx }) => (
  <Page title={t(v.disbanded ? 'soc.faction.disbanded_title' : 'soc.faction.left_title')} tone="sapphire">
    <Panel tone="sapphire">
      <Lead>{t(v.disbanded ? 'soc.faction.disbanded' : 'soc.faction.left', { name: v.ref.name })}</Lead>
      {v.disbanded && v.paid_out > 0 && <Hint>{t('soc.faction.disbanded_paid', { amount: money(v.paid_out) })}</Hint>}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const FactionLinked = screen<FactionLinkedView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.linked_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{t('soc.faction.linked', { name: v.ref.name })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- the bank ----------------------------------------------------------------------------------

const FactionBank = screen<FactionBankView>(({ view: v, ctx }) => (
  <Page title={t('soc.faction.bank_title', { faction: v.ref.name })} tone="gold">
    {v.done && (
      <Panel tone="emerald">
        <Lead tone="good">{t(v.done.deposit ? 'soc.faction.bank.deposited' : 'soc.faction.bank.withdrawn', { amount: money(v.done.amount) })}</Lead>
        {v.done.deposit && <Hint tone="good">{word(`soc.paid.${v.done.method}`, '')}</Hint>}
      </Panel>
    )}
    <Panel tone="gold">
      <Facts rows={[
        { label: t('soc.faction.bank.balance'), value: money(v.balance), gold: true },
        { label: t('soc.faction.bank.cash'), value: money(v.cash) },
        { label: t('soc.faction.bank.card'), value: money(v.bank_balance) },
        { label: t('soc.faction.bank.limits'), value: `${money(v.min)} – ${money(v.max)}` },
      ]} />
      <Hint>{t('soc.faction.bank.rules')}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- organised crime ---------------------------------------------------------------------------

const FactionCrime = screen<FactionCrimeBoardView>(({ view: v, ctx }) => {
  const plans = ctx.acts.filter((a) => a.id === 'faction.plan')
  return (
    <Page title={t('soc.faction.crime_title', { faction: v.ref.name })} tone="ruby">
      {v.notice && <Panel tone="emerald"><Lead tone="good">{word(`soc.faction.crime_notice.${v.notice}`, '')}</Lead></Panel>}
      {v.operation
        ? <Panel tone="ruby"><Operation ctx={ctx} o={v.operation} /></Panel>
        : (
          <Panel tone="ruby">
            <Lead>{t('soc.faction.crime_none')}</Lead>
            <div className="sc-lines">
              {(v.crimes ?? []).map((l) => {
                const plan = plans.find((a) => a.subject === l.crime.code || a.args?.crime === l.crime.code)
                return (
                  <div key={l.crime.code} className="sc-block">
                    <div className="sc-line">
                      <span className="sc-line-title">{ctx.names.name(['crime'], l.crime.code, l.crime.name)}</span>
                      <span className="sc-line-end">{t('soc.faction.crime_crew', { min: formatNumber(l.min), max: formatNumber(l.max) })}</span>
                    </div>
                    <Hint>{t('soc.faction.crime_line', { nerve: formatNumber(l.nerve), level: formatNumber(l.min_level), duration: durationText(l.duration_seconds) })}
                      {(l.places ?? []).length > 0 ? ` · ${(l.places ?? []).map((p) => ctx.names.name(['place'], p.code, p.name)).join(t('common.sep') + ' ')}` : ''}</Hint>
                    {plan && <Btns ctx={ctx} list={[plan]} />}
                  </div>
                )
              })}
            </div>
          </Panel>
        )}
      <Hint>{t('soc.faction.crime_rules', { cut: bpsText(v.cut_bps) })}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'faction.plan'} />
    </Page>
  )
})

const FactionRefusal = screen<FactionRefusalView>(({ view: v, ctx }) => (
  <Page title={t('soc.refused.title')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{word(`soc.refusal.faction.${v.kind}`, t('soc.refusal.unknown'), {
        min: formatNumber(v.min), max: formatNumber(v.max), amount: money(v.amount), balance: money(v.balance), need: formatNumber(v.need), have: formatNumber(v.have), level: formatNumber(v.level),
      })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const FACTION_SCREENS = {
  faction_list: FactionList, faction_page: FactionPage, faction_found: FactionFound, faction_founded: FactionFounded, faction_home: FactionHome,
  faction_members: FactionMembers, faction_invited: FactionInvited, faction_applied: FactionApplied, faction_answered: FactionAnswered,
  faction_confirm: FactionConfirm, faction_left: FactionLeft, faction_linked: FactionLinked, faction_bank: FactionBank, faction_crime: FactionCrime,
  faction_refusal: FactionRefusal,
}

