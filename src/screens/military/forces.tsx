// The ministry of defence, the forces by branch, one branch's equipment and the flow that stations it,
// the state retrofit and the upgrade-kit purchase, drawn from the view and the actions of the answer
// (docs/adr/0039-presentation-split.md). The words are this client's (src/i18n/ui.src.txt, keys mil.*);
// branches, classes, goods and cities are named from the catalogue.

import type {
  BranchForces, BranchView, ForcesView, KitPurchaseView, MilitaryNoticeView, MinistryView, StateRetrofitView, StationView,
} from '../../api/views.gen'
import { ListRow, SectionTitle } from '../native/kit/Parts'
import { formatNumber, money } from '../native/kit/format'
import { ActionButton } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { officeName, playersText } from '../society/common'
import {
  Attributes, ConfirmPopup, NoticeCard, NotHere, QtyRow, Tail, bandName, branchName, byId, cityName, className, find, goodName, place, rest,
} from './kit'
import { bpsPct } from './wording'

const key = (k: string) => k as Key

// -- the forces by branch ------------------------------------------------------------------------------

/** One branch and its classes: exact counts for the cleared, bands for everyone else. */
function BranchBlock({ ctx, b, cleared }: { ctx: FlowCtx; b: BranchForces; cleared: boolean }) {
  return (
    <div className="mil-block">
      <SectionTitle>{branchName(ctx, b.branch)}</SectionTitle>
      {(b.classes ?? []).length === 0 && <Hint>{t('mil.forces.none')}</Hint>}
      {(b.classes ?? []).map((c) => (
        <div key={c.class.code} className="mil-line">
          <span>{className(ctx, c.class)}</span>
          <b>{cleared ? formatNumber(c.count) : bandName(ctx, c.band)}</b>
        </div>
      ))}
    </div>
  )
}

const NAV: { id: string; icon: string; palette: 'gold' | 'ruby' | 'steel' | 'sapphire' | 'emerald' }[] = [
  { id: 'military.forces', icon: 'tank', palette: 'steel' },
  { id: 'military.procure', icon: 'cart', palette: 'gold' },
  { id: 'military.war', icon: 'swords', palette: 'ruby' },
  { id: 'military.licences', icon: 'quill', palette: 'steel' },
  { id: 'military.sanctions', icon: 'gavel', palette: 'ruby' },
  { id: 'military.treaties', icon: 'society', palette: 'sapphire' },
]

const Ministry = flow<MinistryView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.title')} tone="ruby" />
  const exports = `soc.lv.country.arms_exports.${v.arms_exports}`
  const navs = NAV.map((n) => ({ n, a: find(ctx, n.id) })).filter((x) => x.a)
  return (
    <Page title={t('mil.ministry.title', { country: place(ctx, v.country) })} tone="ruby">
      <NoticeCard ctx={ctx} n={v.notice} />
      <div className="mil-list">
        {navs.map(({ n, a }) => (
          <ListRow key={n.id} icon={n.icon} palette={n.palette} title={ctx.label(a!)} sub={t(key(`mil.nav.${n.id}`))}
            right={n.id === 'military.licences' && v.pending_licences > 0 ? t('mil.nav.pending', { n: formatNumber(v.pending_licences) }) : undefined}
            onClick={() => ctx.go(a!)} />
        ))}
      </div>

      <Panel tone="ruby">
        <SectionTitle>{t('mil.ministry.money')}</SectionTitle>
        <Facts rows={[
          { label: t('mil.ministry.treasury'), value: money(v.treasury) },
          { label: t('mil.ministry.fund'), value: money(v.fund), gold: true },
          { label: t('mil.ministry.share'), value: bpsPct(v.revenue_share_bps) },
          { label: t('mil.ministry.budget'), value: bpsPct(v.defence_budget_bps) },
          { label: t('mil.ministry.exports'), value: hasKey(exports) ? t(key(exports)) : formatNumber(v.arms_exports) },
        ]} />
        {v.last && (
          <>
            <Hint>{t('mil.ministry.last')}</Hint>
            <Facts rows={[
              { label: t('mil.period.levy'), value: money(v.last.levy) },
              { label: t('mil.period.appropriation'), value: money(v.last.appropriation) },
              { label: t('mil.period.upkeep_due'), value: money(v.last.upkeep_due) },
              { label: t('mil.period.upkeep_paid'), value: money(v.last.upkeep_paid) },
            ]} />
          </>
        )}
        {v.next_in_seconds > 0 && <Hint>{t('mil.ministry.next', { in: durationText(v.next_in_seconds) })}</Hint>}
      </Panel>

      <Panel>
        <SectionTitle>{t('mil.ministry.offices')}</SectionTitle>
        {(v.offices ?? []).map((o) => (
          <div key={o.code} className="mil-block">
            <div className="mil-head"><span>{officeName(ctx.names, o.code) || o.code}</span></div>
            <Hint>{(o.holders ?? []).length ? playersText(o.holders) : (o.acting ?? []).length ? t('mil.ministry.acting', { who: playersText(o.acting) }) : t('mil.ministry.vacant')}</Hint>
          </div>
        ))}
        {(v.offices ?? []).length === 0 && <Hint>{t('mil.ministry.no_offices')}</Hint>}
      </Panel>

      <Panel tone="teal">
        <SectionTitle>{t('mil.ministry.forces')}</SectionTitle>
        {(v.forces ?? []).map((b) => <BranchBlock key={b.branch.code} ctx={ctx} b={b} cleared={v.cleared} />)}
        {(v.forces ?? []).length === 0 && <Hint>{t('mil.forces.none')}</Hint>}
        {v.cleared ? (
          <Facts rows={[
            { label: t('mil.readiness'), value: bpsPct(v.readiness) },
            { label: t('mil.upkeep'), value: money(v.upkeep) },
          ]} />
        ) : <Hint>{t('mil.forces.bands_only')}</Hint>}
      </Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

const Forces = flow<ForcesView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('mil.forces.title')} tone="ruby" />
  return (
    <Page title={t('mil.forces.title_of', { country: place(ctx, v.country) })} tone="teal">
      {(v.branches ?? []).map((b) => {
        const mine = ctx.acts.find((a) => a.id === 'military.branch' && a.subject === b.branch.code)
        return (
          <Panel key={b.branch.code} tone="teal">
            <BranchBlock ctx={ctx} b={b} cleared={v.cleared} />
            {mine && <Btns ctx={ctx} list={[mine]} />}
          </Panel>
        )
      })}
      {(v.branches ?? []).length === 0 && <Panel><Hint>{t('mil.forces.none')}</Hint></Panel>}
      <Panel>
        {v.cleared ? (
          <Facts rows={[
            { label: t('mil.readiness'), value: bpsPct(v.readiness) },
            { label: t('mil.upkeep'), value: money(v.upkeep) },
            { label: t('mil.moving'), value: formatNumber(v.moving) },
          ]} />
        ) : <Hint>{t('mil.forces.bands_only')}</Hint>}
      </Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

// -- one branch ----------------------------------------------------------------------------------------

const Branch = flow<BranchView>(({ view: v, ctx }) => {
  // stationing actions are told apart by the good's item; two groups of one item take the actions in order
  const stations = ctx.acts.filter((a) => a.id === 'military.station')
  const used = new Set<number>()
  return (
    <Page title={branchName(ctx, v.branch)} tone="teal">
      <NoticeCard ctx={ctx} n={v.notice} />
      {(v.moves ?? []).length > 0 && (
        <Panel tone="sapphire">
          <SectionTitle>{t('mil.branch.moves')}</SectionTitle>
          {(v.moves ?? []).map((m, i) => (
            <div key={i} className="mil-line">
              <span>{t('mil.branch.move', { qty: formatNumber(m.qty), good: goodName(ctx, m.good), city: cityName(ctx, m.city_code, m.city) })}</span>
              <b>{durationText(m.left_seconds)}</b>
            </div>
          ))}
        </Panel>
      )}
      {(v.groups ?? []).length === 0 && <Panel><Hint>{t('mil.branch.none')}</Hint></Panel>}
      {(v.groups ?? []).map((g, i) => {
        const idx = stations.findIndex((a, j) => !used.has(j) && a.subject === g.good.item.code)
        if (idx >= 0) used.add(idx)
        const station = idx >= 0 ? stations[idx] : undefined
        return (
          <Panel key={i} tone="teal">
            <SectionTitle>{goodName(ctx, g.good)}</SectionTitle>
            <Hint>{ctx.names.name(['military_unit'], g.class.code, g.class.name)}</Hint>
            <Facts rows={[
              { label: t('mil.group.count'), value: formatNumber(g.count), gold: true },
              { label: t('mil.group.quality'), value: formatNumber(g.quality) },
              ...(g.depot > 0 ? [{ label: t('mil.group.depot'), value: formatNumber(g.depot) }] : []),
              ...(g.moving > 0 ? [{ label: t('mil.group.moving'), value: formatNumber(g.moving) }] : []),
              ...(g.committed > 0 ? [{ label: t('mil.group.committed'), value: formatNumber(g.committed) }] : []),
              ...(g.damaged > 0 ? [{ label: t('mil.group.damaged'), value: formatNumber(g.damaged) }] : []),
            ]} />
            {(g.garrisons ?? []).length > 0 && (
              <div className="mil-block">
                <Hint>{t('mil.group.garrisons')}</Hint>
                {(g.garrisons ?? []).map((r) => (
                  <div key={r.city_code} className="mil-line"><span>{cityName(ctx, r.city_code, r.city)}</span><b>{formatNumber(r.count)}</b></div>
                ))}
              </div>
            )}
            <Attributes ctx={ctx} list={g.attributes} />
            {g.seen_at > 0 && <Hint>{t('mil.group.seen_at', { km: formatNumber(g.seen_at), radar: formatNumber(v.reference_radar_km) })}</Hint>}
            {station && <Btns ctx={ctx} list={[station]} />}
          </Panel>
        )
      })}
      <Tail ctx={ctx} />
    </Page>
  )
})

// -- stationing equipment: the city, how many, confirm -------------------------------------------------

const Station = flow<StationView>(({ view: v, ctx }) => {
  const good = goodName(ctx, v.good)
  const title = t('mil.station.title', { good })
  if (v.confirm) {
    const yes = byId(ctx, 'military.station_confirm')[0]
    return (
      <ConfirmPopup title={title} ctx={ctx} tone="navy"
        footer={yes && <ActionButton tone="green" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={[
          { label: t('mil.station.good'), value: good },
          { label: t('mil.station.qty'), value: formatNumber(v.qty), gold: true },
          { label: t('mil.station.to'), value: cityName(ctx, v.city_code, v.city) },
          { label: t('mil.station.takes'), value: durationText(v.time_seconds) },
        ]} />
        <Hint>{t('mil.station.confirm_hint')}</Hint>
      </ConfirmPopup>
    )
  }
  const cities = byId(ctx, 'military.station_city')
  const qty = byId(ctx, 'military.station_qty')
  const custom = byId(ctx, 'military.station_custom')
  return (
    <Page title={title} tone="teal">
      <Panel tone="teal">
        <Facts rows={[
          { label: t('mil.station.good'), value: good },
          { label: t('mil.station.available'), value: formatNumber(v.available), gold: true },
        ]} />
        {!v.city_code ? (
          <>
            <Lead>{t('mil.station.pick_city')}</Lead>
            {cities.length === 0 && <Hint>{t('mil.station.no_cities')}</Hint>}
            <div className="mil-list">
              {cities.map((a) => <ListRow key={a.subject} icon="flagobj" palette="sapphire" title={ctx.label(a)} onClick={() => ctx.go(a)} />)}
            </div>
          </>
        ) : (
          <>
            <Lead>{t('mil.station.pick_qty', { city: cityName(ctx, v.city_code, v.city) })}</Lead>
            <QtyRow ctx={ctx} list={qty} />
            <Btns ctx={ctx} list={custom} />
          </>
        )}
      </Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

// -- retrofit and upgrade kits -------------------------------------------------------------------------

const StateRetrofit = flow<StateRetrofitView>(({ view: v, ctx }) => {
  const rows = [
    { label: t('mil.retrofit.good'), value: goodName(ctx, v.good) },
    { label: t('mil.retrofit.version'), value: t('mil.retrofit.versions', { from: formatNumber(v.from_ver), to: formatNumber(v.to_ver) }) },
    { label: t('mil.retrofit.takes'), value: durationText(v.duration_seconds) },
  ]
  if (!v.started) {
    const yes = byId(ctx, 'military.retrofit_confirm')[0]
    return (
      <ConfirmPopup title={t('mil.retrofit.title')} ctx={ctx} tone="navy"
        footer={yes && <ActionButton tone="green" disabled={ctx.busy} onClick={() => ctx.go(yes)}>{ctx.label(yes)}</ActionButton>}>
        <Facts rows={rows} />
        <Hint>{t('mil.retrofit.confirm_hint')}</Hint>
      </ConfirmPopup>
    )
  }
  return (
    <Page title={t('mil.retrofit.title')} tone="teal">
      <Panel tone="emerald"><Lead tone="good">{t('mil.retrofit.started')}</Lead><Facts rows={rows} /></Panel>
      <Tail ctx={ctx} />
    </Page>
  )
})

const KitPurchase = flow<KitPurchaseView>(({ view: v, ctx }) => (
  <Page title={t('mil.kit.title')} tone="gold">
    <Panel tone={v.bought ? 'emerald' : 'gold'}>
      <Lead tone={v.bought ? 'good' : undefined}>{t(v.bought ? 'mil.kit.bought' : 'mil.kit.plan', { seller: v.seller })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
    <Tail ctx={ctx} />
  </Page>
))

const MoveArrivedNotice = flow<MilitaryNoticeView>(({ view: v, ctx }) => (
  <Page title={t('mil.arrived.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('mil.arrived.body', { qty: formatNumber(v.qty), good: goodName(ctx, v.good), city: cityName(ctx, v.city_code, v.city), branch: branchName(ctx, v.branch) })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
    <Tail ctx={ctx} />
  </Page>
))

registerFlow({
  ministry: Ministry, forces: Forces, branch: Branch, station: Station, state_retrofit: StateRetrofit, kit_purchase: KitPurchase,
  move_arrived_notice: MoveArrivedNotice,
})

/** The screens this file draws. */
export const FORCES_SCREENS = ['ministry', 'forces', 'branch', 'station', 'state_retrofit', 'kit_purchase', 'move_arrived_notice']
