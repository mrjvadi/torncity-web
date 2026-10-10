// Defence licences: a country's public registry with the minister's verdicts, a company's own licence
// screen and the notice of a licence, drawn from the view and the actions of the answer
// (docs/adr/0039-presentation-split.md). Who may make arms is public record; deciding is the minister's.

import type { CompanyDefenceView, LicenceEntry, LicenceNoticeView, LicencesView } from '../../api/views.gen'
import { SectionTitle } from '../native/kit/Parts'
import { formatNumber } from '../native/kit/format'
import { ActionButton } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { serverNow } from '../../village/clock'
import { useSecond } from '../../lib/ticker'
import { ConfirmPopup, NotHere, Tail, byId, place } from './kit'

const key = (k: string) => k as Key
const word = (k: string): string => (hasKey(k) ? t(key(k)) : '')

const companyName = (ctx: FlowCtx, e: LicenceEntry): string => e.company.name || e.company.code
const typeName = (ctx: FlowCtx, e: { company: { type: { code: string; name: string } } }): string => ctx.names.name(['company_type'], e.company.type.code, e.company.type.name)

/** Seconds until an instant on the server's clock, never negative. */
const until = (at: string | null | undefined): number => (at ? Math.max(0, Math.round((Date.parse(at) - serverNow()) / 1000)) : 0)

function EntryBlock({ ctx, e, acts }: { ctx: FlowCtx; e: LicenceEntry; acts: ReturnType<typeof byId> }) {
  useSecond() // the notice counts down on the shared ticker
  const ends = e.status === 'revoking' ? until(e.effective_at) : 0
  return (
    <div className="mil-block">
      <div className="mil-head"><span>{companyName(ctx, e)}</span><span>{t('mil.lic.no', { no: formatNumber(e.no) })}</span></div>
      <Hint>{[typeName(ctx, e), word(`mil.lic.kind.${e.kind}`), word(`mil.lic.basis.${e.basis}`)].filter(Boolean).join(` – `)}</Hint>
      <Hint>{word(`mil.lic.status.${e.status}`)}{ends > 0 ? ` – ${t('mil.lic.ends_in', { in: durationText(ends) })}` : ''}</Hint>
      <Btns ctx={ctx} list={acts} row />
    </div>
  )
}

const Licences = flow<LicencesView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.lic.title')} tone="teal" />
  if (v.confirm) {
    const yes = byId(ctx, 'defence.revoke_confirm')[0]
    return (
      <ConfirmPopup title={t('mil.lic.revoke_title')} ctx={ctx} tone="red"
        footer={yes && <ActionButton tone="red" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={[
          { label: t('mil.lic.company'), value: companyName(ctx, v.confirm) },
          { label: t('mil.lic.kind'), value: word(`mil.lic.kind.${v.confirm.kind}`) },
        ]} />
        <Hint tone="bad">{t('mil.lic.revoke_hint', { in: durationText(v.revoke_notice_seconds) })}</Hint>
      </ConfirmPopup>
    )
  }
  const forEntry = (e: LicenceEntry, ids: string[]) => ctx.acts.filter((a) => ids.includes(a.id ?? '') && a.args?.no === String(e.no))
  const verdict = v.notice && hasKey(`mil.lic.notice.${v.notice}`) ? t(key(`mil.lic.notice.${v.notice}`), { company: v.notice_company }) : ''
  return (
    <Page title={t('mil.lic.title_of', { country: place(ctx, v.country) })} tone="teal">
      {verdict && <Panel tone="emerald"><Lead tone="good">{verdict}</Lead></Panel>}
      <Panel tone="teal">
        <SectionTitle>{t('mil.lic.pending')}</SectionTitle>
        {(v.pending ?? []).length === 0 && <Hint>{t('mil.lic.none_pending')}</Hint>}
        {(v.pending ?? []).map((e) => <EntryBlock key={e.no} ctx={ctx} e={e} acts={forEntry(e, ['defence.approve', 'defence.reject'])} />)}
      </Panel>
      <Panel>
        <SectionTitle>{t('mil.lic.in_force')}</SectionTitle>
        {(v.in_force ?? []).length === 0 && <Hint>{t('mil.lic.none_in_force')}</Hint>}
        {(v.in_force ?? []).map((e) => <EntryBlock key={e.no} ctx={ctx} e={e} acts={forEntry(e, ['defence.revoke'])} />)}
      </Panel>
      {(v.ended ?? []).length > 0 && (
        <Panel>
          <SectionTitle>{t('mil.lic.ended')}</SectionTitle>
          {(v.ended ?? []).map((e) => <EntryBlock key={e.no} ctx={ctx} e={e} acts={[]} />)}
        </Panel>
      )}
      {!v.can_decide && <Hint>{t('mil.lic.public_hint')}</Hint>}
      <Tail ctx={ctx} />
    </Page>
  )
})

const CompanyDefence = flow<CompanyDefenceView>(({ view: v, ctx }) => {
  const l = v.licence
  const state = v.manufacturer ? 'manufacturer' : !l ? 'none' : l.status
  return (
    <Page title={t('mil.def.title', { company: v.ref.name || v.ref.code })} tone="teal">
      <Panel tone="teal">
        <Hint>{ctx.names.name(['company_type'], v.ref.type.code, v.ref.type.name)}</Hint>
        <Lead>{t(`mil.def.state.${state}` as Key)}</Lead>
        {l && (
          <Facts rows={[
            { label: t('mil.lic.kind'), value: word(`mil.lic.kind.${l.kind}`) },
            { label: t('mil.lic.basis'), value: word(`mil.lic.basis.${l.basis}`) },
            { label: t('mil.lic.status'), value: word(`mil.lic.status.${l.status}`) },
          ]} />
        )}
        {v.applied && <Hint tone="good">{t('mil.def.applied')}</Hint>}
      </Panel>
      {!v.manufacturer && (
        <Panel>
          <SectionTitle>{t('mil.def.standing')}</SectionTitle>
          <Facts rows={[
            { label: t('mil.def.techs'), value: t('mil.def.of', { have: formatNumber(v.owned), need: formatNumber(v.min_techs) }), gold: v.owned >= v.min_techs },
            { label: t('mil.def.tier'), value: t('mil.def.of', { have: formatNumber(v.tier), need: formatNumber(v.min_tier) }), gold: v.tier >= v.min_tier },
          ]} />
          {v.no_minister && <Hint tone="bad">{t('mil.def.no_minister')}</Hint>}
        </Panel>
      )}
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
      <Tail ctx={ctx} />
    </Page>
  )
})

const LicenceNotice = flow<LicenceNoticeView>(({ view: v, ctx }) => {
  useSecond()
  const kind = ['applied', 'approved', 'rejected', 'revoked'].includes(v.kind) ? v.kind : 'applied'
  const ends = until(v.effective_at)
  return (
    <Page title={t(`mil.lic_notice.title_${kind}` as Key)} tone={kind === 'approved' ? 'emerald' : kind === 'applied' ? 'sapphire' : 'ruby'}>
      <Panel tone={kind === 'approved' ? 'emerald' : kind === 'applied' ? 'sapphire' : 'ruby'}>
        <Lead>{t(`mil.lic_notice.${kind}` as Key, { company: v.company.name || v.company.code, country: place(ctx, v.country), in: durationText(ends) })}</Lead>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
      <Tail ctx={ctx} />
    </Page>
  )
})

registerFlow({ licences: Licences, company_defence: CompanyDefence, licence_notice: LicenceNotice })

/** The screens this file draws. */
export const LICENCE_SCREENS = ['licences', 'company_defence', 'licence_notice']
