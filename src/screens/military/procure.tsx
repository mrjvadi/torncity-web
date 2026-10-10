// Procurement: the military goods the state may buy, one listing and how many, and the refusal of a
// military command, drawn from the view and the actions of the answer (docs/adr/0039-presentation-split.md).

import type { ArmsBuyView, MilitaryRefusalView, ProcureOffer, ProcureView } from '../../api/views.gen'
import { ListRow } from '../native/kit/Parts'
import { formatNumber, money } from '../native/kit/format'
import { ActionButton } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { Attributes, ConfirmPopup, NoticeCard, NotHere, QtyRow, Tail, byId, cityName, goodName, officeText, place } from './kit'
import { CardGrid } from '../../ui/v6/panel'

const key = (k: string) => k as Key

/** Where a listing is, who sells it and what is left. */
function offerSub(ctx: FlowCtx, o: ProcureOffer): string {
  return t('mil.procure.offer_sub', { company: o.company.name || o.company.code, city: cityName(ctx, o.city_code, o.city), left: formatNumber(o.left) })
}

const Procure = flow<ProcureView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.procure.title')} tone="gold" />
  const opens = byId(ctx, 'military.buy_open')
  return (
    <Page title={t('mil.procure.title_of', { country: place(ctx, v.country) })} tone="gold">
      <NoticeCard ctx={ctx} n={v.notice} />
      <Panel tone="gold">
        <Facts rows={[{ label: t('mil.procure.fund'), value: money(v.fund), gold: true }]} />
        <Hint>{t('mil.procure.hint')}</Hint>
      </Panel>
      <CardGrid>
        {(v.offers ?? []).map((o) => {
          const open = opens.find((a) => a.args?.no === String(o.no))
          const why = o.blocked ? (hasKey(`mil.procure.blocked.${o.blocked}`) ? t(key(`mil.procure.blocked.${o.blocked}`)) : t('mil.procure.blocked.other')) : ''
          return (
            <ListRow key={o.no} icon="box" palette={o.blocked ? 'steel' : 'gold'} title={goodName(ctx, o.good)}
              sub={why ? `${offerSub(ctx, o)} – ${why}` : offerSub(ctx, o)} right={money(o.price)}
              onClick={open ? () => ctx.go(open) : undefined} />
          )
        })}
      </CardGrid>
      {(v.offers ?? []).length === 0 && <Panel><Hint>{t('mil.procure.none')}</Hint></Panel>}
      <Tail ctx={ctx} />
    </Page>
  )
})

const ArmsBuy = flow<ArmsBuyView>(({ view: v, ctx }) => {
  const o = v.offer
  const good = goodName(ctx, o.good)
  if (v.confirm) {
    const yes = byId(ctx, 'military.buy_confirm')[0]
    return (
      <ConfirmPopup title={t('mil.buy.confirm_title')} ctx={ctx} tone="navy"
        footer={yes && <ActionButton tone="green" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={[
          { label: t('mil.buy.good'), value: good },
          { label: t('mil.buy.qty'), value: formatNumber(v.qty), gold: true },
          { label: t('mil.buy.each'), value: money(o.price) },
          { label: t('mil.buy.total'), value: money(v.total), gold: true },
          { label: t('mil.buy.after'), value: money(v.fund - v.total) },
        ]} />
        <Hint>{t('mil.buy.confirm_hint')}</Hint>
      </ConfirmPopup>
    )
  }
  const qty = byId(ctx, 'military.buy_qty')
  const custom = byId(ctx, 'military.buy_custom')
  return (
    <Page title={good} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('mil.buy.seller'), value: o.company.name || o.company.code },
          { label: t('mil.buy.where'), value: cityName(ctx, o.city_code, o.city) },
          { label: t('mil.buy.left'), value: formatNumber(o.left) },
          { label: t('mil.buy.each'), value: money(o.price), gold: true },
          { label: t('mil.procure.fund'), value: money(v.fund) },
        ]} />
        <Attributes ctx={ctx} list={v.attributes} />
        {qty.length === 0 && custom.length === 0 && <Hint tone="bad">{t('mil.buy.cannot')}</Hint>}
        {(qty.length > 0 || custom.length > 0) && <Lead>{t('mil.buy.pick_qty')}</Lead>}
        <QtyRow ctx={ctx} list={qty} />
        <Btns ctx={ctx} list={custom} />
      </Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

/** The sentence of a refused military command. */
const MilitaryRefusal = flow<MilitaryRefusalView>(({ view: v, ctx }) => {
  const k = `mil.refused.${v.kind}`
  const text = hasKey(k)
    ? t(key(k), {
      country: place(ctx, v.country), office: officeText(ctx, v.office) || t('mil.unnamed_office'), need: money(v.need), have: money(v.have), max: formatNumber(v.max),
    })
    : t('refusal.unknown')
  return (
    <Page title={t('mil.refused.title')} tone="ruby">
      <Panel tone="ruby"><Lead tone="bad">{text}</Lead></Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({ procure: Procure, arms_buy: ArmsBuy, military_refusal: MilitaryRefusal })

/** The screens this file draws. */
export const PROCURE_SCREENS = ['procure', 'arms_buy', 'military_refusal']
