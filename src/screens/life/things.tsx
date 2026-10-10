// What the player carries and owns, drawn from the neutral views (docs/adr/0039-presentation-split.md): one
// good or piece of the bag and what happens to it, the player's property (a kind the city sells, an offer, one
// of their own, leaving a rented home), and the refusal of work and study. A decision with a price is a popup
// (the cost, what is missing, one main button); words are the web's own, names come from the catalogue.

import type {
  ErrorView, ItemDetailView, ItemDroppedView, ItemGivenView, ItemRefusalView, ItemUsedView, PropertyLeaveView, PropertyOfferView, PropertyRefusalView,
  PropertyTypeView, PropertyDetailView, RefusalView, Requirement,
} from '../../api/views.gen'
import { Bar, ListRow, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { clamp01, hms, money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, { ActionButton, ActionRow, CostSummary, Hero, Medallion, Note, StatCard, StatGrid, Unavailable } from '../../ui/Popup'
import { hasKey, refusalText, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, flow, isBack, isRefresh } from '../village/flow'
import type { FlowCtx } from '../village/flow'
import { bps, cityName, clockText, nameOf, tf, tx } from './common'
import { CardGrid } from '../../ui/v6/panel'

const ITEM_ICON: Record<string, string> = { bread: 'bread', bandage: 'pill', phone: 'phone', lockpick_set: 'keys' }
const CATEGORY_ICON: Record<string, string> = { food: 'bread', medicine: 'pill', gear: 'gears', electronics: 'phone', defence: 'shield', vehicles: 'x_car' }

const itemIcon = (code: string, category: string) => ITEM_ICON[code] ?? CATEGORY_ICON[category] ?? 'box'
const categoryName = (c: string) => tx(`inventory.cat.${c}`) === `inventory.cat.${c}` ? c.replace(/_/g, ' ') : tx(`inventory.cat.${c}`)

/** The wording of a refusal of the screens of this file: the web's own sentence for its code, with the data it carries. */
function refused(ctx: FlowCtx, fallback: string, extra: Record<string, unknown> = {}): string {
  return refusalText(ctx.res.error?.code ?? fallback, undefined, { ...(ctx.res.error?.args ?? {}), ...extra })
}

// -- one good or piece -----------------------------------------------------------------------------------------

export const ItemDetail = flow<ItemDetailView>(({ view: v, ctx }) => {
  const name = nameOf(ctx, 'item', v.item)
  const effects = v.effects ?? []
  const gear = v.gear
  const gives = ctx.acts.filter((a) => a.id === 'item.give')
  const friend = (code: string) => (v.give_to ?? []).find((f) => f.code === code)?.name ?? code
  return (
    <Page title={name} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('lf.item.category'), value: categoryName(v.category) },
          ...(v.piece
            ? [{ label: t('lf.item.quality'), value: formatNumber(v.quality) }, ...(v.durability > 0 ? [{ label: t('lf.item.durability'), value: `${formatNumber(v.durability)}%` }, { label: t('lf.item.uses'), value: formatNumber(v.uses_left) }] : [])]
            : [{ label: t('lf.item.qty'), value: formatNumber(v.qty) }]),
          { label: t('lf.item.worth'), value: money(v.worth), gold: true },
        ]} />
      </Panel>
      {effects.length > 0 && (
        <Panel>
          <SectionTitle>{t('lf.item.effects')}</SectionTitle>
          <div className="vf-list">
            {effects.map((e, i) => (
              <div key={i} className="vf-line">
                <span>{tx(`lf.vital.${e.target}`)}</span>
                <b>{e.op === 'cap' ? t('lf.item.cap', { n: formatNumber(e.value) }) : e.op === 'add' ? `${e.value < 0 ? '−' : '+'}${formatNumber(Math.abs(e.value))}` : t('lf.item.times', { n: formatNumber(e.value / 100) })}</b>
              </div>
            ))}
          </div>
          {v.cooldown_seconds > 0 && <Hint>{t('lf.item.cooldown', { t: hms(v.cooldown_seconds) })}</Hint>}
        </Panel>
      )}
      {gear && (
        <Panel>
          <SectionTitle>{t('lf.item.gear', { for: [...(gear.categories ?? []).map((c) => ctx.names.name('crime_category', c.code, c.name)), ...(gear.crimes ?? []).map((c) => ctx.names.name('crime', c.code, c.name))].join('، ') })}</SectionTitle>
          <div className="vf-list">
            {([['success', gear.success_bps], ['catch', gear.catch_bps], ['witness', gear.witness_bps], ['solve', gear.solve_bps], ['reward', gear.reward_bps]] as const).filter(([, n]) => n !== 0).map(([k, n]) => (
              <div key={k} className="vf-line"><span>{tx(`lf.gear.${k}`)}</span><b>{n > 0 ? '+' : '−'}{bps(Math.abs(n))}</b></div>
            ))}
            {gear.nerve !== 0 && <div className="vf-line"><span>{t('lf.gear.nerve')}</span><b>{gear.nerve > 0 ? '+' : '−'}{formatNumber(Math.abs(gear.nerve))}</b></div>}
          </div>
          {gear.confiscated && <Hint tone="bad">{t('lf.gear.evidence')}</Hint>}
        </Panel>
      )}
      {v.cooling_for_seconds > 0 && <Panel tone="sapphire"><Lead>{t('lf.item.cooling', { t: hms(v.cooling_for_seconds) })}</Lead>{v.ready_at && <Hint>{t('lf.item.ready_at', { at: clockText(v.ready_at) })}</Hint>}</Panel>}
      <Btns ctx={ctx} list={ctx.by('item.use')} tone="gold" />
      <Btns ctx={ctx} list={[...ctx.by('item.sell_market'), ...ctx.by('item.auction'), ...ctx.by('item.sell_shop')]} />
      {v.tradeable && (gives.length > 0
        ? (
          <>
            <SectionTitle>{t('lf.item.give')}</SectionTitle>
            <div className="vf-btns row">
              {gives.map((a) => <Slab key={a.subject} tone="blue" radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>{friend(a.subject ?? '')}</Slab>)}
            </div>
          </>
        )
        : <Hint>{t('lf.item.give_nobody')}</Hint>)}
      <Btns ctx={ctx} list={ctx.by('item.drop')} />
    </Page>
  )
})

export const ItemUsed = flow<ItemUsedView>(({ view: v, ctx }) => (
  <Page title={t('lf.item.used_title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('lf.item.used', { item: nameOf(ctx, 'item', v.item) })}</Lead>
      {(v.changes ?? []).map((c, i) => (
        <Bar key={i} frac={clamp01(c.after / Math.max(1, c.max))} color="var(--leaf)" label={`${tx(`lf.vital.${c.target}`)}: ${formatNumber(c.before)} ← ${formatNumber(c.after)}`} />
      ))}
      <Facts rows={[
        { label: t('lf.item.left'), value: formatNumber(v.left) },
        ...(v.ready_at ? [{ label: t('lf.item.next_use'), value: hms(v.cooldown_seconds) }] : []),
      ]} />
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const ItemGiven = flow<ItemGivenView>(({ view: v, ctx }) => (
  <Page title={t('lf.item.given_title')} tone="emerald">
    <Panel tone="emerald"><Lead tone="good">{t('lf.item.given', { item: nameOf(ctx, 'item', v.item), player: v.to.name })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

/** Asks before a good is thrown away: a popup with one red button. */
export const DropConfirm = flow<ItemDroppedView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const yes = ctx.acts.find((a) => a.id === 'item.drop_confirm')
  return (
    <Page title={t('lf.item.drop_title')} tone="ruby">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="red" dismissible={!ctx.busy} title={t('lf.item.drop_title')}
        footer={<ActionRow><ActionButton tone="steel" small onClick={() => back && ctx.go(back)}>{t('common.cancel')}</ActionButton>{yes && <ActionButton tone="red" busy={ctx.busy} onClick={() => ctx.go(yes)}>{t('lf.item.drop_yes')}</ActionButton>}</ActionRow>}
      >
        <Hero><Medallion icon="box" palette="ruby" /></Hero>
        <Note>{t('lf.item.drop_ask', { item: nameOf(ctx, 'item', v.item) })}</Note>
      </Popup>
    </Page>
  )
})

export const ItemDropped = flow<ItemDroppedView>(({ view: v, ctx }) => (
  <Page title={t('lf.item.dropped_title')} tone="emerald">
    <Panel><Lead>{t('lf.item.dropped', { item: nameOf(ctx, 'item', v.item) })}</Lead></Panel>
    <Rest ctx={ctx} />
  </Page>
))

export const ItemRefusal = flow<ItemRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{tx(`lf.item.refused.${v.kind}`, { item: nameOf(ctx, 'item', v.item), t: hms(v.wait_seconds) })}</Lead>
      {v.kind === 'cooling' && v.ready_at && <Hint>{t('lf.item.ready_at', { at: clockText(v.ready_at) })}</Hint>}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- property -------------------------------------------------------------------------------------------------------

const KIND_ICON: Record<string, string> = { residential: 'house', home: 'house', commercial: 'factory', shop: 'market' }
const kindIcon = (kind: string, home: boolean) => (home ? 'house' : KIND_ICON[kind] ?? 'factory')

/** The payment part of a decision: what is missing, the ways to pay, or where to go to do it. */
function Decide({ ctx, price, payment, blocked, max, way }: {
  ctx: FlowCtx
  price: number
  payment: { usable: string[] | null; cash: number; bank: number } | null
  blocked: string
  max: number
  way: { place: { code: string; name: string }; walk_seconds: number } | null
}) {
  const pays = ctx.acts.filter((a) => a.id?.startsWith('pay.'))
  const walk = ctx.acts.find((a) => a.id === 'walk')
  if (blocked) return <Unavailable reason={tx(`lf.property.refused.${blocked}`, { max: formatNumber(max) })} icon="m_stop" />
  if (way) {
    return <Unavailable reason={t('lf.property.at_registry', { place: nameOf(ctx, 'place', way.place) })} nearest={walk ? { name: `${nameOf(ctx, 'place', way.place)} – ${hms(way.walk_seconds)}`, onGo: () => ctx.go(walk), label: t('lf.walk.go') } : undefined} />
  }
  if (!payment) return null
  const afford = (payment.usable ?? []).length > 0
  return (
    <>
      <CostSummary lines={[]} total={{ amount: money(price) }} />
      {afford
        ? <Note>{t('lf.pay.balances', { cash: money(payment.cash), bank: money(payment.bank) })}</Note>
        : <Note tone="bad">{t('lf.pay.cannot', { cash: money(payment.cash), bank: money(payment.bank) })}</Note>}
      <ActionRow>{pays.map((a) => <ActionButton key={a.id} tone="gold" busy={ctx.busy} onClick={() => ctx.go(a)}>{tx(`lf.pay.${a.id!.slice(4)}`)}</ActionButton>)}</ActionRow>
    </>
  )
}

export const PropertyType = flow<PropertyTypeView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const name = nameOf(ctx, 'property_type', v.type)
  return (
    <Page title={name} tone="emerald">
      <Popup open onClose={() => back && ctx.go(back)} tone="green" dismissible={!ctx.busy} title={t('lf.property.type_title', { type: name, city: v.city.name ? cityName(ctx, v.city.code, v.city.name) : '' })}>
        <Hero><Medallion icon={kindIcon(v.kind, v.home)} palette="emerald" chip={tx(`lf.property.kind.${v.kind}`)} /></Hero>
        {v.bought > 0 && <Note tone="good">{t('lf.property.bought', { no: formatNumber(v.bought), type: name })}</Note>}
        <StatGrid>
          <StatCard icon="x_map" palette="sapphire" label={t('lf.property.size')} value={formatNumber(v.size)} />
          <StatCard icon="x_star" palette="gold" label={t('lf.property.quality')} value={formatNumber(v.quality)} />
          <StatCard icon="coins" palette="amber" label={t('lf.property.upkeep')} value={money(v.upkeep)} />
          <StatCard icon="chart" palette="steel" label={t('lf.property.tax')} value={bps(v.tax_bps)} />
        </StatGrid>
        <Note>{t('lf.property.where', { place: nameOf(ctx, 'place', v.place) })} – {t('lf.property.left', { n: formatNumber(v.left) })}</Note>
        {v.home && <Note>{t('lf.property.home_note', { n: formatNumber(v.rest_energy) })}</Note>}
        <Decide ctx={ctx} price={v.price} payment={v.payment} blocked={v.blocked} max={v.max} way={v.way} />
      </Popup>
      <Btns ctx={ctx} list={ctx.by('property.mine')} />
    </Page>
  )
})

export const PropertyOffer = flow<PropertyOfferView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const name = nameOf(ctx, 'property_type', v.offer.type)
  const rent = v.offer.kind === 'rent'
  return (
    <Page title={name} tone="emerald">
      <Popup open onClose={() => back && ctx.go(back)} tone="green" dismissible={!ctx.busy} title={t('lf.property.offer_title', { no: formatNumber(v.offer.property_no), type: name })}>
        <Hero><Medallion icon={kindIcon(v.kind, v.home)} palette="emerald" chip={rent ? t('property.rent') : t('property.sale')} /></Hero>
        <StatGrid>
          <StatCard icon="x_map" palette="sapphire" label={t('lf.property.size')} value={formatNumber(v.size)} />
          <StatCard icon="x_star" palette="gold" label={t('lf.property.quality')} value={formatNumber(v.quality)} />
          <StatCard icon={rent ? 'keys' : 'coins'} palette="amber" label={rent ? t('lf.property.rent') : t('lf.property.upkeep')} value={money(rent ? v.offer.price : v.upkeep)} />
        </StatGrid>
        <Note>{t('lf.property.seller', { name: v.offer.seller.name || v.offer.seller.code })}{v.city.name ? ` – ${cityName(ctx, v.city.code, v.city.name)}` : ''}</Note>
        {v.home && <Note>{t('lf.property.home_residence')}</Note>}
        <Decide ctx={ctx} price={v.offer.price} payment={v.payment} blocked={v.blocked} max={v.max} way={v.way} />
        <Btns ctx={ctx} list={ctx.by('property.cancel')} />
      </Popup>
    </Page>
  )
})

export const Property = flow<PropertyDetailView>(({ view: v, ctx }) => {
  const p = v.property
  const name = nameOf(ctx, 'property_type', p.type)
  return (
    <Page title={t('lf.property.mine_title', { no: formatNumber(p.no), type: name })} tone="emerald">
      {v.notice && <Hint tone="good">{tx(`lf.property.notice.${v.notice}`)}</Hint>}
      <Panel tone="emerald">
        <Facts rows={[
          { label: t('lf.property.where_label'), value: nameOf(ctx, 'place', v.place) },
          { label: t('lf.property.city'), value: cityName(ctx, p.city.code, p.city.name) },
          { label: t('lf.property.size'), value: formatNumber(p.size) },
          { label: t('lf.property.quality'), value: formatNumber(p.quality) },
          { label: t('lf.property.value'), value: money(p.value), gold: true },
          { label: t('lf.property.upkeep'), value: money(v.upkeep) },
          { label: t('lf.property.tax'), value: bps(v.tax_bps) },
        ]} />
        {p.home && <Hint>{t('lf.property.lived_in')}</Hint>}
        {p.tenant && <Hint>{t('lf.property.let_to', { tenant: p.tenant.name || p.tenant.code, rent: money(p.rent) })}</Hint>}
        {p.offer && <Hint>{p.offer.kind === 'rent' ? t('lf.property.offered_rent', { price: money(p.offer.price) }) : t('lf.property.offered_sale', { price: money(p.offer.price) })}</Hint>}
        {p.debt > 0 && <Hint tone="bad">{t('lf.property.debt', { debt: money(p.debt), n: formatNumber(p.unpaid_periods) })} {t('lf.property.debt_blocks')}</Hint>}
        {!p.tenant && !p.offer && p.debt <= 0 && <Hint>{t('lf.property.offer_limits', { price: money(v.max_price), rent: money(v.max_rent) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={[...ctx.by('property.sell'), ...ctx.by('property.let'), ...ctx.by('property.cancel')]} />
    </Page>
  )
})

/** Leaving a rented home: a popup with one red button. */
export const PropertyLeave = flow<PropertyLeaveView>(({ view: v, ctx }) => {
  const back = ctx.acts.find(isBack)
  const yes = ctx.acts.find((a) => a.id === 'property.leave_confirm')
  return (
    <Page title={t('lf.property.leave_title')} tone="ruby">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="red" dismissible={!ctx.busy} title={t('lf.property.leave_title')}
        footer={<ActionRow><ActionButton tone="steel" small onClick={() => back && ctx.go(back)}>{t('common.cancel')}</ActionButton>{yes && <ActionButton tone="red" busy={ctx.busy} onClick={() => ctx.go(yes)}>{t('lf.property.leave_yes')}</ActionButton>}</ActionRow>}
      >
        <Hero><Medallion icon="house" palette="ruby" /></Hero>
        <Note>{t('lf.property.leave_ask', { type: nameOf(ctx, 'property_type', v.type), city: cityName(ctx, v.city.code, v.city.name) })}</Note>
      </Popup>
    </Page>
  )
})

export const PropertyRefusal = flow<PropertyRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby"><Lead tone="bad">{refused(ctx, `property_${v.kind}`, { max: money(v.max), wait_seconds: v.wait_seconds })}</Lead></Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

// -- a refused request of work or study ------------------------------------------------------------------------------

/** One condition of a position or a course, met or not, in words. */
function reqLine(ctx: FlowCtx, r: Requirement): string {
  const p = {
    need: formatNumber(r.need), have: formatNumber(r.have), skill: tx(`skill.${r.skill}`) === `skill.${r.skill}` ? ctx.names.name('skill', r.skill, r.skill) : tx(`skill.${r.skill}`),
    course: ctx.names.name('course', r.course_code, r.course_name), city: cityName(ctx, r.city_code, r.city), t: hms(r.wait_seconds),
  }
  return tf(`lf.req.${r.kind}${r.met ? '_met' : ''}`, `lf.req.${r.kind}` as Key, p)
}

export const Refusal = flow<RefusalView>(({ view: v, ctx }) => {
  const missing = v.missing ?? []
  return (
    <Page title={t('msg.refusal')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{refusalText(ctx.res.error?.code ?? `refusal_${v.kind}`, undefined, { ...(ctx.res.error?.args ?? {}), city: cityName(ctx, v.city_code, v.city), fee: money(v.fee), cash: money(v.cash), wait_seconds: v.wait_seconds })}</Lead>
        {missing.length > 0 && (
          <CardGrid>
            {missing.map((r, i) => <ListRow key={i} icon={r.met ? 'check' : 'm_stop'} palette={r.met ? 'emerald' : 'ruby'} title={reqLine(ctx, r)} />)}
          </CardGrid>
        )}
        {v.kind === 'shift_in_progress' && v.ends_at && <Hint>{t('lf.req.shift_until', { t: hms(v.wait_seconds), at: clockText(v.ends_at) })}</Hint>}
      </Panel>
      <Rest ctx={ctx} />
      <Btns ctx={ctx} list={ctx.acts.filter((a) => isBack(a) && !isRefresh(a))} />
    </Page>
  )
})

// -- a command the game refused or could not run: the core sends a code and its numbers ----------------------

export const ErrorScreen = flow<ErrorView>(({ view: v, ctx }) => {
  const args = v.args ?? {}
  const n = (k: string) => Number(args[k] ?? 0)
  const bank = v.code.startsWith('bank.')
  const code = typeof args.office === 'string' ? args.office : ''
  const named = code ? ctx.names.name('office', code, '') : ''
  const office = named && named !== code ? named : ''
  const text = tf(`lf.err.${v.code}`, 'lf.err.error.internal', {
    needed: bank ? money(n('needed')) : formatNumber(n('needed')), current: formatNumber(n('current')),
    min: money(n('min')), max: money(n('max')), available: money(n('available')), time: hms(n('seconds') || n('remaining_seconds')),
    office: office || t('lf.err.office_any'),
  })
  return (
    <Page title={t('lf.err.title')} tone="ruby">
      <Panel tone="ruby"><Lead tone="bad">{text}</Lead></Panel>
      <Rest ctx={ctx} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

export const THING_SCREENS = {
  item_detail: ItemDetail, item_used: ItemUsed, item_given: ItemGiven, drop_confirm: DropConfirm, item_dropped: ItemDropped, item_refusal: ItemRefusal,
  property_type: PropertyType, property_offer: PropertyOffer, property: Property, property_leave: PropertyLeave, property_refusal: PropertyRefusal,
  refusal: Refusal, error: ErrorScreen,
}
