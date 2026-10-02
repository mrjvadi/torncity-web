// Recruiting specialists: a company's recruitment hub, a campaign and its candidates, the campaign being built, the
// company's specialists, and a refused request. Drawn from the view and the actions of each answer
// (docs/adr/0039-presentation-split.md). A specialist is named from a seed and the two lists the catalogue holds;
// skills, cities and technologies are named from the content catalogue.

import type {
  RecruitCampaignLine, RecruitCampaignView, RecruitDraftView, RecruitHubView, RecruitOffer, RecruitRefusalView, SpecialistLine, SpecialistsView,
} from '../../api/views.gen'
import { ListRow } from '../native/kit/Parts'
import Popup, { ActionButton, ActionRow } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, flow, isBack, registerFlow } from '../village/flow'
import { clockText } from '../economy/time'
import { bps } from '../economy/kit'
import { BackBtn, Chip, Facts, Hint, Lead, Notice, Page, Panel, byId, formatNumber, money, roughDuration } from './kit'
import { TABLES, skillLevel, specialistName } from './wording'
import type { FlowCtx } from '../village/flow'

const key = (k: string) => k as Key
const col = { display: 'flex', flexDirection: 'column', gap: 8 } as const
const city = (ctx: FlowCtx, n: { code: string; name: string }) => ctx.names.name([...TABLES.city], n.code, n.name)

function Cancel({ ctx }: { ctx: FlowCtx }) {
  const b = ctx.acts.find(isBack)
  return <ActionButton tone="steel" onClick={() => { if (b) ctx.go(b) }}>{t('vx.cancel')}</ActionButton>
}

/** A campaign's package, as facts. */
function OfferFacts({ o }: { o: RecruitOffer }) {
  return (
    <Facts rows={[
      { label: t('co.offer.salary'), value: money(o.salary), gold: true },
      { label: t('co.offer.housing'), value: o.housing > 0 ? money(o.housing) : t('co.none') },
      { label: t('co.offer.signing'), value: o.signing > 0 ? money(o.signing) : t('co.none') },
      { label: t('co.offer.relocation'), value: o.relocation > 0 ? t('co.offer.up_to', { amount: money(o.relocation) }) : t('co.none') },
      { label: t('co.offer.term'), value: t('co.offer.periods', { count: formatNumber(o.term) }) },
      { label: t('co.offer.shares'), value: o.shares > 0 ? t('co.offer.shares_value', { count: formatNumber(o.shares) }) : t('co.none') },
    ]} />
  )
}

// -- the hub ----------------------------------------------------------------------------------------------

function campaignSub(ctx: FlowCtx, l: RecruitCampaignLine): string {
  const base = t(`co.rc.line.${l.status}` as Key, {
    cities: formatNumber(l.cities), hired: formatNumber(l.hired), positions: formatNumber(l.positions), time: clockText(l.next_at),
  })
  return l.pending > 0 ? `${base} - ${t('co.rc.pending', { count: formatNumber(l.pending) })}` : base
}

const Hub = flow<RecruitHubView>(({ view: v, ctx }) => (
  <Page title={t('co.rc.hub_title', { name: v.ref.name })} tone="teal">
    <Facts rows={[
      { label: t('co.rc.staff'), value: t('co.of', { a: formatNumber(v.staff), b: formatNumber(v.max_staff) }) },
      { label: t('co.rc.running'), value: t('co.of', { a: formatNumber(v.running), b: formatNumber(v.max_campaign) }) },
    ]} />
    <Lead>{t('co.rc.campaigns')}</Lead>
    {(v.campaigns ?? []).length === 0 && <Notice>{t('co.rc.none')}</Notice>}
    <div style={col}>
      {(v.campaigns ?? []).map((l) => (
        <ListRow key={l.no} icon="x_mega" palette={l.status === 'running' ? 'gold' : l.status === 'filled' ? 'emerald' : 'steel'}
          title={t('co.rc.campaign', { no: formatNumber(l.no), what: skillLevel(ctx.names, l.skill, l.level) })} sub={campaignSub(ctx, l)}
          onClick={() => { const a = ctx.acts.find((x) => x.id === 'recruit.campaign' && x.args?.no === String(l.no)); if (a) ctx.go(a) }} />
      ))}
    </div>
    <Hint>{t('co.rc.hint')}</Hint>
    <Btns ctx={ctx} list={byId(ctx, 'recruit.new', 'recruit.specialists')} />
    <BackBtn ctx={ctx} />
  </Page>
))

// -- a campaign ---------------------------------------------------------------------------------------------

const Campaign = flow<RecruitCampaignView>(({ view: v, ctx }) => {
  const l = v.line
  const what = skillLevel(ctx.names, l.skill, l.level)
  const close = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  const noticeName = v.notice_seed ? specialistName(ctx.names, v.notice_seed) : ''
  return (
    <Page title={t('co.rc.campaign_title', { no: formatNumber(l.no), what })} tone="teal">
      {v.notice && hasKey(`co.rc.notice.${v.notice}`) && <Notice>{t(key(`co.rc.notice.${v.notice}`), { name: noticeName })}</Notice>}
      <Panel>
        <Lead>{t(`co.rc.status.${l.status}` as Key, { time: clockText(l.next_at), checks: formatNumber(v.checks_left) })}</Lead>
        <Facts rows={[
          { label: t('co.rc.cities'), value: (v.cities ?? []).map((c) => city(ctx, c)).join('، ') || t('co.none') },
          { label: t('co.rc.hired'), value: t('co.of', { a: formatNumber(l.hired), b: formatNumber(l.positions) }) },
          { label: t('co.available'), value: money(v.available) },
        ]} />
        <OfferFacts o={v.offer} />
        <Hint>{t(v.auto ? 'co.rd.auto_on' : 'co.rd.auto_off')}</Hint>
      </Panel>
      <Lead>{t('co.rc.candidates')}</Lead>
      {(v.candidates ?? []).length === 0 && <Notice>{t(`co.rc.candidates_none.${l.status}` as Key)}</Notice>}
      {(v.candidates ?? []).map((c) => {
        const name = specialistName(ctx.names, c.name_seed)
        const decide = ctx.acts.filter((a) => a.args?.no === String(c.no) && ['recruit.hire', 'recruit.reject'].includes(a.id ?? ''))
        return (
          <Panel key={c.no}>
            <ListRow icon="person" palette={c.status === 'pending' ? 'gold' : c.status === 'hired' ? 'emerald' : 'steel'} title={name}
              sub={t(`co.rc.candidate.${c.status}` as Key, {
                what: skillLevel(ctx.names, c.skill, c.level), city: city(ctx, c.home), expected: money(c.expected), time: clockText(c.expires_at),
              })} right={c.abroad ? t('co.rc.abroad') : undefined} />
            {decide.length > 0 && (
              <div className="vf-btns row">
                {decide.map((a) => <Chip key={a.id} ctx={ctx} a={a}>{a.id === 'recruit.hire' ? t('co.rc.hire', { name, amount: money(c.cost) }) : t('co.rc.reject')}</Chip>)}
              </div>
            )}
          </Panel>
        )
      })}
      {l.status === 'running' && !v.confirm_cancel && <Btns ctx={ctx} list={byId(ctx, 'recruit.cancel')} />}
      <BackBtn ctx={ctx} />
      {v.confirm_cancel && (
        <Popup open onClose={close} title={t('co.rc.cancel_title')} tone="red"
          footer={(
            <ActionRow>
              {byId(ctx, 'recruit.cancel_confirm').map((a) => <ActionButton key="y" tone="red" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('co.rc.cancel_yes')}</ActionButton>)}
              <Cancel ctx={ctx} />
            </ActionRow>
          )}>
          <p className="pp-note">{t('co.rc.cancel_body')}</p>
        </Popup>
      )}
    </Page>
  )
})

// -- a campaign being built --------------------------------------------------------------------------------------

/** The preset chips of one money field: each is a value index the server knows. */
function Presets({ ctx, field, amounts }: { ctx: FlowCtx; field: string; amounts: number[] }) {
  return (
    <div className="vf-btns row">
      {amounts.map((amount, i) => {
        const a = ctx.acts.find((x) => x.id === `recruit.preset_${field}` && x.args?.value === String(i))
        return <Chip key={i} ctx={ctx} a={a}>{amount > 0 ? money(amount) : t('co.none')}</Chip>
      })}
    </div>
  )
}

const Draft = flow<RecruitDraftView>(({ view: v, ctx }) => {
  const what = skillLevel(ctx.names, v.skill, v.level)
  const chosen = (v.cities ?? []).filter((c) => c.on)
  const close = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  const p = v.presets
  const section = v.section
  return (
    <Page title={t('co.rd.title', { no: formatNumber(v.no), name: v.ref.name })} tone="teal">
      {v.notice && hasKey(`co.rd.notice.${v.notice}`) && <Notice>{t(key(`co.rd.notice.${v.notice}`))}</Notice>}
      <Hint>{t(`co.rd.section.${section || 'main'}` as Key)}</Hint>

      {!section && (
        <>
          <Panel>
            <Facts rows={[
              { label: t('co.rd.skill'), value: what },
              { label: t('co.rd.cities'), value: chosen.length ? chosen.map((c) => city(ctx, c)).join('، ') : t('co.rd.no_cities') },
              { label: t('co.rd.positions'), value: formatNumber(v.positions) },
              { label: t('co.offer.salary'), value: money(v.salary), gold: true },
              { label: t('co.offer.housing'), value: v.housing > 0 ? money(v.housing) : t('co.none') },
              { label: t('co.offer.signing'), value: v.signing > 0 ? money(v.signing) : t('co.none') },
              { label: t('co.offer.relocation'), value: v.relocation > 0 ? t('co.offer.up_to', { amount: money(v.relocation) }) : t('co.none') },
              { label: t('co.offer.term'), value: t('co.offer.periods', { count: formatNumber(v.term) }) },
              { label: t('co.offer.shares'), value: v.shares > 0 ? t('co.rd.shares_value', { count: formatNumber(v.shares), amount: money(v.share_value) }) : t('co.none') },
            ]} />
            <Hint>{t(v.auto ? 'co.rd.auto_on' : 'co.rd.auto_off')}</Hint>
          </Panel>
          <Panel>
            <Hint>{t('co.rd.market', { amount: money(v.market), city: ctx.names.name([...TABLES.city], v.city_code, v.city) })}</Hint>
            <Hint>{t('co.rd.reach', { count: formatNumber(v.reach), what })}</Hint>
            <Hint>{t('co.rd.chance', { percent: bps(v.chance_bps) })}</Hint>
            <Hint>{t('co.rd.fee', { amount: money(v.ad_fee * chosen.length), cities: formatNumber(chosen.length), fee: money(v.ad_fee), money: money(v.available) })}</Hint>
          </Panel>
          <Btns ctx={ctx} list={byId(ctx, 'recruit.section_skill', 'recruit.section_cities', 'recruit.section_pay', 'recruit.section_terms')} />
          <Btns ctx={ctx} list={byId(ctx, 'recruit.post')} tone="gold" />
        </>
      )}

      {section === 'skill' && !v.confirm && (
        <Panel>
          <div className="vf-btns row">
            {(v.skills ?? []).map((s) => {
              const a = ctx.acts.find((x) => x.id === 'recruit.set_skill' && x.args?.value === s)
              return <Chip key={s} ctx={ctx} a={a}>{`${s === v.skill ? '✓ ' : ''}${ctx.names.name([...TABLES.skill], s, s)}`}</Chip>
            })}
          </div>
          <Facts rows={[{ label: t('co.rd.level'), value: t('co.of', { a: formatNumber(v.level), b: formatNumber(v.max_level) }) }]} />
          <Btns ctx={ctx} row list={byId(ctx, 'recruit.level_down', 'recruit.level_up')} />
        </Panel>
      )}

      {section === 'cities' && !v.confirm && (
        <>
          <div style={col}>
            {(v.cities ?? []).map((c) => {
              const a = ctx.acts.find((x) => x.id === 'recruit.set_city' && x.args?.value === c.code)
              return <ListRow key={c.code} icon={c.on ? 'check' : 'city'} palette={c.on ? 'emerald' : 'steel'} title={city(ctx, c)} sub={c.abroad ? t('co.rd.abroad') : undefined}
                onClick={a ? () => ctx.go(a) : undefined} />
            })}
          </div>
          <Btns ctx={ctx} list={byId(ctx, 'recruit.scope_own', 'recruit.scope_nation', 'recruit.scope_all')} />
        </>
      )}

      {section === 'pay' && !v.confirm && (
        <>
          {([['salary', v.salary, p.salary], ['housing', v.housing, p.housing], ['signing', v.signing, p.signing], ['relocation', v.relocation, p.relocation]] as [string, number, number[] | null][]).map(([field, value, amounts]) => (
            <Panel key={field}>
              <Facts rows={[{ label: t(`co.offer.${field}` as Key), value: value > 0 ? money(value) : t('co.none'), gold: field === 'salary' }]} />
              <Presets ctx={ctx} field={field} amounts={amounts ?? []} />
              <Btns ctx={ctx} list={byId(ctx, `recruit.type_${field}`)} />
            </Panel>
          ))}
        </>
      )}

      {section === 'terms' && !v.confirm && (
        <>
          <Panel>
            <Facts rows={[{ label: t('co.offer.term'), value: t('co.offer.periods', { count: formatNumber(v.term) }) }]} />
            <div className="vf-btns row">
              {(p.terms ?? []).map((n, i) => <Chip key={i} ctx={ctx} a={ctx.acts.find((x) => x.id === 'recruit.preset_term' && x.args?.value === String(i))}>{t('co.offer.periods', { count: formatNumber(n) })}</Chip>)}
            </div>
          </Panel>
          <Panel>
            <Facts rows={[{ label: t('co.offer.shares'), value: v.shares > 0 ? t('co.rd.shares_value', { count: formatNumber(v.shares), amount: money(v.share_value) }) : t('co.none') }]} />
            <div className="vf-btns row">
              {(p.shares ?? []).map((n, i) => <Chip key={i} ctx={ctx} a={ctx.acts.find((x) => x.id === 'recruit.preset_shares' && x.args?.value === String(i))}>{n > 0 ? t('co.offer.shares_value', { count: formatNumber(n) }) : t('co.none')}</Chip>)}
            </div>
          </Panel>
          <Panel>
            <Facts rows={[{ label: t('co.rd.positions'), value: t('co.of', { a: formatNumber(v.positions), b: formatNumber(v.max_positions) }) }]} />
            <Btns ctx={ctx} row list={byId(ctx, 'recruit.fewer', 'recruit.more')} />
            <Hint>{t(v.auto ? 'co.rd.auto_on' : 'co.rd.auto_off')}</Hint>
            <Btns ctx={ctx} list={byId(ctx, 'recruit.auto_on', 'recruit.auto_off')} />
          </Panel>
        </>
      )}
      <BackBtn ctx={ctx} />
      {v.confirm && (
        <Popup open onClose={close} title={t('co.rd.confirm_title')} tone="navy"
          footer={(
            <ActionRow>
              {byId(ctx, 'recruit.post_confirm').map((a) => <ActionButton key="y" tone="green" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('co.rd.confirm_yes', { amount: money(v.ad_fee * chosen.length) })}</ActionButton>)}
              <Cancel ctx={ctx} />
            </ActionRow>
          )}>
          <p className="pp-note">{t('co.rd.confirm', {
            cities: formatNumber(chosen.length), amount: money(v.ad_fee * chosen.length), checks: formatNumber(v.checks), every: roughDuration(v.every_seconds),
          })}</p>
        </Popup>
      )}
    </Page>
  )
})

// -- the specialists ---------------------------------------------------------------------------------------------

function SpecialistCard({ ctx, l }: { ctx: FlowCtx; l: SpecialistLine }) {
  const name = specialistName(ctx.names, l.name_seed)
  const mine = ctx.acts.filter((a) => a.args?.no === String(l.no) && ['recruit.renew', 'recruit.raise', 'recruit.dismiss'].includes(a.id ?? ''))
  return (
    <Panel>
      <ListRow icon="person" palette="teal" title={name} sub={`${skillLevel(ctx.names, l.skill, l.level)} - ${city(ctx, l.home)}`} />
      <Facts rows={[
        { label: t('co.sp.pay'), value: l.housing > 0 ? t('co.sp.pay_housing', { salary: money(l.salary), housing: money(l.housing) }) : money(l.salary) },
        { label: t('co.sp.contract'), value: t('co.sp.contract_value', { served: formatNumber(l.served), term: formatNumber(l.term) }) },
        ...(l.shares > 0 ? [{ label: t('co.offer.shares'), value: t('co.offer.shares_value', { count: formatNumber(l.shares) }) }] : []),
      ]} />
      {l.expiring && <Notice alert>{t('co.sp.expiring')}</Notice>}
      {l.underpaid && l.underpaid_left > 0 && <Notice alert>{t('co.sp.underpaid', { market: money(l.market_due), left: formatNumber(l.underpaid_left) })}</Notice>}
      {l.unpaid_left > 0 && <Notice alert>{t('co.sp.unpaid', { unpaid: formatNumber(l.unpaid_left) })}</Notice>}
      <Btns ctx={ctx} list={mine} />
    </Panel>
  )
}

const Specialists = flow<SpecialistsView>(({ view: v, ctx }) => {
  const c = v.confirm
  const close = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  const noticeName = v.notice_seed ? specialistName(ctx.names, v.notice_seed) : ''
  return (
    <Page title={t('co.sp.title', { name: v.ref.name, count: formatNumber((v.lines ?? []).length), max: formatNumber(v.max) })} tone="teal">
      {v.notice && hasKey(`co.sp.notice.${v.notice}`) && <Notice>{t(key(`co.sp.notice.${v.notice}`), { name: noticeName })}</Notice>}
      {(v.lines ?? []).length === 0 && <Notice>{t('co.sp.none')}</Notice>}
      {(v.lines ?? []).map((l) => <SpecialistCard key={l.no} ctx={ctx} l={l} />)}
      <Hint>{t('co.sp.hint')}</Hint>
      <Btns ctx={ctx} list={byId(ctx, 'recruit.hub')} />
      <BackBtn ctx={ctx} />
      {c && (
        <Popup open onClose={close} title={t('co.sp.dismiss_title')} tone="red"
          footer={(
            <ActionRow>
              {byId(ctx, 'recruit.dismiss_confirm').map((a) => <ActionButton key="y" tone="red" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('co.sp.dismiss_yes')}</ActionButton>)}
              <Cancel ctx={ctx} />
            </ActionRow>
          )}>
          <p className="pp-note">{t('co.sp.dismiss_body', { name: specialistName(ctx.names, c.name_seed) })}</p>
        </Popup>
      )}
    </Page>
  )
})

// -- a refused request -------------------------------------------------------------------------------------------

export const RecruitRefusal = flow<RecruitRefusalView>(({ view: v, ctx }) => {
  const k = `co.refused.recruit.${v.kind}`
  return (
    <Page title={t('co.refused.title')} tone="ruby">
      <Panel>
        <Lead tone="bad">{hasKey(k) ? t(key(k), {
          name: v.ref.name, need: money(v.need), money: money(v.have), max: formatNumber(v.max), person: specialistName(ctx.names, v.name_seed),
        }) : t('refusal.unknown')}</Lead>
      </Panel>
      <BackBtn ctx={ctx} />
    </Page>
  )
})

registerFlow({ recruit_hub: Hub, recruit_campaign: Campaign, recruit_draft: Draft, specialists: Specialists, recruit_refusal: RecruitRefusal })

export const RECRUIT_SCREENS = ['recruit_hub', 'recruit_campaign', 'recruit_draft', 'specialists', 'recruit_refusal']
