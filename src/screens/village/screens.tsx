// Every village screen that draws from its view and its actions alone (flow.tsx hosts them):
// the refusal with what is missing, the donate, promotion and residence steps, the land and
// the private-building flow, the resident's property, the head's terms, work, the roster,
// the build menu, grid and confirms, a building's own page. Words are the web's own
// (src/i18n/ui.src.txt); content names come from the catalogue.

import { useState, type ReactNode } from 'react'
import type {
  BatchConfirmView, BuildMenuView, BuildingPanelView, DonateView, GridGrowView, LandView, LotAccessView, LotBuyView, LotConfirmView, LotGridView, LotRepairView,
  MaterialBuyConfirmView, MineView, PrivateConfirmView, PrivateLotsView, PrivateMenuView, PromotionView, ResidenceView,
  SettlementWhoView, TermsView, VillageRefusalView, WorkView,
} from '../../api/types'
import type { LotAccess, LotCell, PrivateMaterial, LandCell, VillageNeed } from '../../api/views.gen'
import { Bar, Chip, Empty, ListRow, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { hasKey, refusalText, t, type Key } from '../../i18n'
import { durationText, iconForRole, ROLE_TONE } from './common'
import { buildingBlurb } from './wording'
import {
  Btns, Cancel, Facts, flow, Hint, Lead, Page, Panel, registerFlow, Rest, isBack, isRefresh, type FlowCtx,
} from './flow'

const Empt = Empty

const key = (k: string) => k as Key

/** The 0/1 argument of a rotate toggle, as the server reads it. */
const token = (x: number, y: number, rotated = false) => `${x}-${y}${rotated ? '-r' : ''}`

function tierName(tier: string): string {
  return hasKey(`village.tier.${tier}`) ? t(key(`village.tier.${tier}`)) : tier
}

function mats(ctx: FlowCtx, list: { component: { code: string; name: string }; quantity: number }[] | null | undefined): ReactNode {
  const l = list ?? []
  if (!l.length) return null
  return (
    <div className="vf-list">
      {l.map((m) => (
        <div key={m.component.code} className="vf-line"><span>{ctx.names.name(['component', 'item'], m.component.code, m.component.name)}</span><b>{formatNumber(m.quantity)}</b></div>
      ))}
    </div>
  )
}

// -- refusal, with what is missing ---------------------------------------------------------

function needsTitleName(ctx: FlowCtx, v: VillageRefusalView): string {
  if (!v.subject?.code) return ''
  return v.action === 'research'
    ? ctx.names.name(['knowledge'], v.subject.code, v.subject.name)
    : ctx.bname(v.subject.code, v.subject.name)
}

function NeedLine({ ctx, n }: { ctx: FlowCtx; n: VillageNeed }) {
  if (n.kind === 'material') {
    const name = ctx.names.name(['component', 'item'], n.item.code, n.item.name)
    return (
      <div className="vf-need">
        <div className="vf-need-head">
          <span>{t('vx.need.material', { name, need: formatNumber(n.need), have: formatNumber(n.have) })}</span>
        </div>
        <Bar frac={n.need > 0 ? n.have / n.need : 0} color="#f5a11f" label={<span className="vs-ltr">{formatNumber(n.have)} / {formatNumber(n.need)}</span>} />
        <ul className="vf-src">
          {(n.makers ?? []).map((m) => (
            <li key={m.building.code}>{t(m.built ? 'vx.need.made_built' : 'vx.need.made_unbuilt', { building: ctx.bname(m.building.code, m.building.name) })}</li>
          ))}
          {n.price > 0 && <li>{t('vx.need.buy', { price: money(n.price) })}</li>}
        </ul>
      </div>
    )
  }
  if (n.kind === 'knowledge') {
    const opts = (n.options ?? []).map((o) => ctx.names.name(['knowledge'], o.code, o.name))
    return (
      <div className="vf-need">
        {opts.length > 1
          ? t('vx.need.knowledge_any', { names: opts.join('، ') })
          : t('vx.need.knowledge', { name: opts[0] ?? ctx.names.name(['knowledge'], n.item.code, n.item.name) })}
      </div>
    )
  }
  const opts = (n.options ?? []).map((o) => ctx.bname(o.code, o.name))
  return <div className="vf-need">{t('vx.need.building', { names: opts.join('، ') })}</div>
}

const Refusal = flow<VillageRefusalView>(({ view: v, ctx }) => {
  const code = ctx.res.error?.code ?? `village_${v.kind}`
  const args = { ...(ctx.res.error?.args ?? {}) }
  const needs = v.needs ?? []
  const lots = v.lots ?? []
  const subject = needsTitleName(ctx, v)
  return (
    <Page title={t('vx.rf.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(`vx.rf.screen.${code}`) ? t(key(`vx.rf.screen.${code}`), args as Record<string, string | number>) : refusalText(code, undefined, args)}</Lead>
        {lots.length > 0 && (
          <ul className="vf-src">
            {lots.map((l) => (
              <li key={`${l.x}-${l.y}`}>{t('vx.rf.batch_lot', { y: l.y + 1, x: l.x + 1, reason: hasKey(`vx.rf.batch.${l.kind}`) ? t(key(`vx.rf.batch.${l.kind}`)) : t('vx.rf.batch.other') })}</li>
            ))}
          </ul>
        )}
        {needs.length > 0 && (
          <>
            <SectionTitle>{subject ? t(key(`vx.needs.${v.action || 'build'}`), { name: subject }) : t('vx.needs.any')}</SectionTitle>
            {needs.map((n, i) => <NeedLine key={i} ctx={ctx} n={n} />)}
          </>
        )}
      </Panel>
      <Rest ctx={ctx} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- donate ----------------------------------------------------------------------------------

function AmountBox({ v, ctx, cmd }: { v: DonateView; ctx: FlowCtx; cmd: string }) {
  const [typed, setTyped] = useState('')
  const n = Number(typed.replace(/[^0-9]/g, '')) || 0
  const ok = n >= v.min && n <= v.max
  return (
    <div className="vd-custom">
      <input className="vd-input" inputMode="numeric" dir="ltr" placeholder={t('donate.custom')} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('donate.custom')} />
      <Slab tone="blue" radius={14} lip={4} disabled={ctx.busy || !ok} onClick={() => ctx.go({ command: cmd, args: { amount: String(n) }, kind: 'primary' })}>{t('donate.next')}</Slab>
    </div>
  )
}

const DonateMenu = flow<DonateView>(({ view: v, ctx }) => {
  const presets = ctx.by('donate.amount')
  return (
    <Page title={t('donate.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('donate.body', { treasury: money(v.treasury), cash: money(v.cash) })}</Lead>
        <Hint>{t('donate.range', { min: money(v.min), max: money(v.max) })}</Hint>
        <Btns ctx={ctx} list={presets.filter((a) => Number(a.args?.amount) <= v.cash)} row tone="gold" />
        <AmountBox v={v} ctx={ctx} cmd={presets[0]?.command ?? 'settlement.donate'} />
      </Panel>
    </Page>
  )
})

const DonateConfirm = flow<DonateView>(({ view: v, ctx }) => (
  <Page title={t('donate.title')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('donate.ask', { amount: money(v.amount) })}</Lead>
      <Hint>{t('donate.ask_hint')}</Hint>
      <Facts rows={[{ label: t('vx.donate.cash_after'), value: money(v.cash - v.amount) }, { label: t('vx.donate.treasury_after'), value: money(v.treasury + v.amount), gold: true }]} />
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('donate.yes')} />
    <Cancel ctx={ctx} />
  </Page>
))

const DonateDone = flow<DonateView>(({ view: v, ctx }) => (
  <Page title={t('donate.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('donate.done', { amount: money(v.amount) })}</Lead>
      <Hint tone="good">{t('donate.done_body', { treasury: money(v.treasury) })}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- promotion -------------------------------------------------------------------------------

function criterionLine(ctx: FlowCtx, c: PromotionView['criteria'] extends (infer U)[] | null ? U : never): { text: string; frac: number } {
  const frac = c.required > 0 ? Math.min(1, c.current / c.required) : 1
  switch (c.kind) {
    case 'residents': return { text: t('vx.goal.residents', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'literacy': return { text: t('vx.goal.literacy', { cur: formatNumber(c.current / 100), req: formatNumber(c.required / 100) }), frac }
    case 'buildings': return { text: t('vx.goal.buildings', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'knowledge': return { text: t('vx.goal.knowledge', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'treasury': return { text: t('vx.goal.treasury', { cur: money(c.current), req: money(c.required) }), frac }
    default: {
      const k = `vx.goal.role.${c.role}.${c.required}`
      return { text: hasKey(k) ? t(key(k)) : t('vx.goal.role_any', { role: hasKey(`role.${c.role}`) ? t(key(`role.${c.role}`)) : c.role }), frac: c.met ? 1 : 0 }
    }
  }
}

/** The goals of the next tier, with progress. Also the block the status page carries. */
export function Goals({ v, ctx }: { v: PromotionView; ctx: FlowCtx }) {
  return (
    <div className="vf-goals">
      {(v.criteria ?? []).map((c, i) => {
        const l = criterionLine(ctx, c)
        return (
          <div key={i} className={`vf-goal${c.met ? ' met' : ''}`}>
            <span className="vf-goal-mark">{c.met ? '✓' : '○'}</span>
            <div className="vf-goal-body">
              <div>{l.text}</div>
              {!c.met && c.kind !== 'role' && <Bar frac={l.frac} color="#8e6cf0" label={`${Math.round(l.frac * 100)}%`} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Promotion = flow<PromotionView>(({ view: v, ctx }) => (
  <Page title={t('vx.promo.title', { tier: tierName(v.to) })} tone="violet">
    <Panel tone="violet">
      <Lead>{t('vx.promo.intro', { village: v.village, tier: tierName(v.to) })}</Lead>
      <Goals v={v} ctx={ctx} />
      <Hint tone={v.met ? 'good' : undefined}>{v.met ? (v.can_promote ? t('vx.promo.ready_head', { tier: tierName(v.to) }) : t('vx.promo.ready_member')) : t('vx.promo.not_ready')}</Hint>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const PromoteConfirm = flow<PromotionView>(({ view: v, ctx }) => (
  <Page title={t('vx.promo.ask_title', { village: v.village, tier: tierName(v.to) })} tone="violet">
    <Panel tone="violet">
      <Lead>{hasKey(`vx.promo.ask_body.${v.to}`) ? t(key(`vx.promo.ask_body.${v.to}`)) : t('vx.promo.ask_body.any')}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('vx.promo.yes')} />
    <Cancel ctx={ctx} />
  </Page>
))

const Promoted = flow<PromotionView>(({ view: v, ctx }) => (
  <Page title={t('vx.promo.done_title', { village: v.village, tier: tierName(v.to) })} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{hasKey(`vx.promo.done_body.${v.to}`) ? t(key(`vx.promo.done_body.${v.to}`)) : t('vx.promo.done_body.any')}</Lead>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- residence -------------------------------------------------------------------------------

const ResidenceConfirm = flow<ResidenceView>(({ view: v, ctx }) => {
  const home = ctx.names.name(['city'], v.home_code, v.home)
  return (
    <Page title={v.leaving ? t('vx.res.leave_title', { village: v.village }) : t('vx.res.join_title', { village: v.village })} tone="emerald">
      <Panel tone="emerald">
        <Lead>{v.leaving ? t('vx.res.leave_body', { home }) : t('vx.res.join_body', { village: v.village })}</Lead>
        {v.cooldown_seconds > 0 && <Hint>{t('vx.res.cooldown', { time: durationText(v.cooldown_seconds) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={v.leaving ? t('vx.res.leave_yes') : t('vx.res.join_yes')} />
      <Cancel ctx={ctx} />
    </Page>
  )
})

const ResidenceDone = flow<ResidenceView>(({ view: v, ctx }) => {
  const home = ctx.names.name(['city'], v.home_code, v.home)
  return (
    <Page title={v.leaving ? t('vx.res.left_title') : t('vx.res.joined_title', { village: v.village })} tone="emerald">
      <Panel tone="emerald">
        <Lead tone="good">{v.leaving ? t('vx.res.left_body', { home }) : t('vx.res.joined_body', { n: formatNumber(v.population) })}</Lead>
        {v.cooldown_seconds > 0 && <Hint>{t('vx.res.cooldown', { time: durationText(v.cooldown_seconds) })}</Hint>}
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})

// -- lot grids (land, build, private) ---------------------------------------------------------

type GridCell = { x: number; y: number; state: string; fits?: boolean; owner?: string; building?: string; access?: string }

/** A square map of lots. `pick` decides which cells can be pressed. */
export function LotMap({ rows, pick, onPick, mark }: { rows: (GridCell[] | null)[] | null; pick: (c: GridCell) => boolean; onPick: (c: GridCell) => void; mark?: { x: number; y: number } | null }) {
  const grid = (rows ?? []).map((r) => r ?? [])
  const n = grid.length
  if (!n) return null
  return (
    <div className="vf-map" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      {grid.flat().map((c) => {
        const can = pick(c)
        const s = `vf-cell s-${c.state}${c.access ? ` a-${c.access}` : ''}${can ? ' can' : ''}${mark && mark.x === c.x && mark.y === c.y ? ' mark' : ''}`
        return (
          <button key={`${c.x}-${c.y}`} className={s} disabled={!can} onClick={() => onPick(c)}
            aria-label={t('citizen.buy.lot', { x: c.x + 1, y: c.y + 1 })} />
        )
      })}
    </div>
  )
}

function Legend({ items }: { items: { cls: string; label: string }[] }) {
  return <div className="vf-legend">{items.map((i) => <span key={i.cls}><i className={`vf-dot s-${i.cls}`} />{i.label}</span>)}</div>
}

const landItems = () => [
  { cls: 'free', label: t('citizen.legend.free') }, { cls: 'needs', label: t('citizen.legend.needs') }, { cls: 'bridge', label: t('citizen.legend.bridge') },
  { cls: 'locked', label: t('citizen.legend.locked') }, { cls: 'mine', label: t('citizen.legend.mine') }, { cls: 'mine-locked', label: t('citizen.legend.mine_locked') },
  { cls: 'taken', label: t('citizen.legend.taken') }, { cls: 'reserved', label: t('citizen.legend.reserved') },
  { cls: 'building', label: t('vx.legend.building') }, { cls: 'water', label: t('vx.legend.water') },
]

const Land = flow<LandView>(({ view: v, ctx }) => {
  return (
    <Page title={t('menu.land')} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('citizen.buy.price'), value: money(v.price), gold: true },
          { label: t('citizen.buy.cash'), value: money(v.cash) },
          { label: t('vx.land.owned'), value: <span className="vs-ltr">{formatNumber(v.owned)} / {formatNumber(v.max)}</span> },
          { label: t('vx.land.free'), value: formatNumber(v.free_lots) },
        ]} />
        <Legend items={landItems()} />
        <LotMap
          rows={v.rows as (LandCell[] | null)[] | null}
          pick={(c) => (c.state === 'free' && v.can_buy) || (c.state === 'mine' && !c.building)}
          onPick={(c) => (c.state === 'free'
            ? ctx.go({ command: 'settlement.lot.buy', args: { lot: token(c.x, c.y) }, kind: 'primary', id: 'lot.buy' })
            : c.access && c.access !== 'road'
              ? ctx.go({ command: 'settlement.lot.access', args: { lot: token(c.x, c.y) }, kind: 'navigation', id: 'lot.access' })
              : ctx.go({ command: 'settlement.private', kind: 'navigation', id: 'citizen.build_house' }))}
        />
        <Hint>{v.can_buy ? t('vx.land.hint') : v.owned >= v.max ? t('vx.land.limit') : t('vx.land.hint_none')}</Hint>
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})

/** One action of the screen worded with this page's own text (the label carries the price). */
function Do({ ctx, a, label, tone, hold }: {
  ctx: FlowCtx; a: Parameters<FlowCtx['go']>[0]; label: string; tone?: 'gold' | 'green' | 'red' | 'steel'
  /** A press that cannot be undone asks once more: the first press only arms the button. */
  hold?: { armed: boolean; arm: () => void }
}) {
  return (
    <div className="vf-btns">
      <Slab tone={tone ?? 'steel'} radius={14} lip={4} disabled={ctx.busy}
        onClick={() => { if (hold && !hold.armed) hold.arm(); else ctx.go(a) }}>{hold?.armed ? t('citizen.fix.sure') : label}</Slab>
    </div>
  )
}

/** How a road reaches a lot, in the web's own words: the road to lay and what it costs. */
function accessText(a: LotAccess): string {
  switch (a.kind) {
    case 'road': return t('citizen.access.road')
    case 'needs_road': return t('citizen.access.needs_road', { n: a.roads })
    case 'needs_bridge': return t('citizen.access.needs_bridge', { n: a.roads - a.crossings, c: a.crossings })
    default: return t('citizen.access.none')
  }
}

/** The nearest lots that have a road: each one opens its own purchase. */
function NearbyButtons({ ctx, lots }: { ctx: FlowCtx; lots: { x: number; y: number; access: LotAccess }[] | null }) {
  const list = lots ?? []
  return (
    <Panel tone="gold">
      <SectionTitle>{t('citizen.access.nearby')}</SectionTitle>
      {list.length === 0 && <Hint>{t('citizen.access.nearby_none')}</Hint>}
      <div className="vf-btns">
        {list.map((n) => (
          <Slab key={`${n.x}-${n.y}`} tone="steel" radius={14} lip={4} disabled={ctx.busy}
            onClick={() => ctx.go({ command: 'settlement.lot.buy', args: { lot: token(n.x, n.y) }, kind: 'primary', id: 'lot.nearby' })}>
            {t('citizen.buy.lot', { x: n.x + 1, y: n.y + 1 })}{n.access.cost > 0 ? ` · ${money(n.access.cost)}` : ''}
          </Slab>
        ))}
      </div>
    </Panel>
  )
}

const LotBuyConfirm = flow<LotBuyView>(({ view: v, ctx }) => {
  const none = v.access.kind === 'none'
  const carve = ctx.acts.find((a) => a.id === 'lot.carve')
  return (
    <Page title={t('citizen.buy.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 })}</Lead>
        <Facts rows={[
          { label: t('citizen.buy.price'), value: money(v.price), gold: true },
          { label: t('citizen.access.req'), value: accessText(v.access) },
          ...(v.access.cost > 0 ? [{ label: t('citizen.access.cost'), value: money(v.access.cost), gold: true }] : []),
          ...(none ? [] : [{ label: t('citizen.access.total'), value: money(v.total), gold: true }]),
          { label: t('citizen.buy.cash'), value: money(v.cash) },
          ...(none ? [] : [{ label: t('citizen.buy.after'), value: money(v.cash - v.total) }]),
        ]} />
        {none
          ? <Hint tone="bad">{t('citizen.access.none_note')}</Hint>
          : <Hint>{v.access.cost > 0 ? (v.road === 'carve' ? t('citizen.access.carve_note', { n: v.access.carved?.length ?? 0 }) : t('citizen.access.road_note')) : t('citizen.buy.note')}</Hint>}
      </Panel>
      {none && v.carve && carve && (
        <Panel tone="gold">
          <Hint>{t('citizen.access.carve_note', { n: v.carve.carved?.length ?? 0 })}</Hint>
          <Do ctx={ctx} a={carve} tone="gold" label={t('citizen.access.carve_btn', { p: money(v.carve.cost) })} />
        </Panel>
      )}
      {none && <NearbyButtons ctx={ctx} lots={v.nearby} />}
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')}
        yes={v.access.cost > 0 ? t('citizen.buy.confirm_road', { p: money(v.total) }) : t('citizen.buy.confirm', { p: money(v.total) })} />
      <Cancel ctx={ctx} />
    </Page>
  )
})

/** A lot of one's own that no road reaches (or a building refused for want of a road): the road at its
 * price, the road through one's own land, or the sale rescinded. Each is one press; the page's costs
 * are the confirmation. */
const LotAccessPage = flow<LotAccessView>(({ view: v, ctx }) => {
  const connect = ctx.by('lot.connect'), carve = ctx.by('lot.carve'), refund = ctx.by('lot.refund')
  const [armed, setArmed] = useState('')
  return (
    <Page title={t('citizen.fix.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 })}</Lead>
        {v.building?.code && <Hint tone="bad">{t('citizen.access.refused', { name: ctx.bname(v.building.code, v.building.name) })}</Hint>}
        <Facts rows={[
          { label: t('citizen.access.req'), value: accessText(v.access), gold: v.access.kind === 'road' },
          ...(v.access.cost > 0 ? [{ label: t('citizen.access.cost'), value: money(v.access.cost), gold: true }] : []),
          { label: t('citizen.buy.cash'), value: money(v.cash) },
        ]} />
        {v.access.kind === 'road' && <Hint tone="good">{t('citizen.fix.ok')}</Hint>}
        {v.access.kind === 'none' && <Hint tone="bad">{t('citizen.fix.none')}</Hint>}
      </Panel>
      {connect.length > 0 && <Do ctx={ctx} a={connect[0]} tone="green" label={t('citizen.fix.connect', { p: money(v.access.cost) })} />}
      {carve.length > 0 && v.carve && (
        <>
          <Hint>{t('citizen.access.carve_note', { n: v.carve.carved?.length ?? 0 })}</Hint>
          <Do ctx={ctx} a={carve[0]} tone="gold" label={t('citizen.fix.carve', { n: v.carve.carved?.length ?? 0, p: money(v.carve.cost) })}
            hold={{ armed: armed === 'carve', arm: () => setArmed('carve') }} />
        </>
      )}
      {refund.length > 0 && (
        <>
          <Hint>{t('citizen.fix.refund_note')}</Hint>
          <Do ctx={ctx} a={refund[0]} tone="red" label={t('citizen.fix.refund', { p: money(v.refund) })}
            hold={{ armed: armed === 'refund', arm: () => setArmed('refund') }} />
        </>
      )}
      {!v.own && <NearbyButtons ctx={ctx} lots={v.nearby} />}
      <Rest ctx={ctx} skip={(a) => !!a.id?.startsWith('lot.') || a.id === 'citizen.mine'} />
    </Page>
  )
})

const LotRepairDone = flow<LotRepairView>(({ view: v, ctx }) => (
  <Page title={t('citizen.fix.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t(`citizen.fix.done_${v.option}` as Key)}</Lead>
      <Facts rows={[
        { label: t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 }), value: v.option === 'refund' ? money(v.refund) : money(v.paid) },
        { label: t('citizen.buy.cash'), value: money(v.cash) },
      ]} />
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const LotBuyDone = flow<LotBuyView>(({ view: v, ctx }) => (
  <Page title={t('citizen.buy.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('citizen.buy.done')}</Lead>
      <Facts rows={[{ label: t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 }), value: money(v.price) }, { label: t('citizen.buy.cash'), value: money(v.cash) }]} />
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- a private building on one's own lot -------------------------------------------------------

function matLine(m: PrivateMaterial, ctx: FlowCtx): string {
  return t('citizen.build.material', { name: ctx.names.name(['component', 'item'], m.component.code, m.component.name), need: m.need, have: m.have, buy: m.buy })
}

const PrivateMenu = flow<PrivateMenuView>(({ view: v, ctx }) => {
  const places = ctx.by('citizen.place')
  return (
    <Page title={t('menu.house')} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('citizen.buy.cash'), value: money(v.cash), gold: true },
          { label: t('vx.land.mine'), value: formatNumber(v.owned_lots) },
          { label: t('vx.land.bare'), value: formatNumber(v.free_lots) },
        ]} />
        {v.owned_lots === 0 && <Lead>{t('citizen.build.no_land')}</Lead>}
        {v.owned_lots > 0 && v.free_lots === 0 && <Lead>{t('vx.private.no_free')}</Lead>}
      </Panel>
      {v.owned_lots > 0 && (v.lines ?? []).length === 0 && <Empt>{t('citizen.build.empty')}</Empt>}
      <div className="vf-stack">
        {(v.lines ?? []).map((l) => {
          const act = places.find((a) => a.subject === l.building.code)
          const name = ctx.bname(l.building.code, l.building.name)
          return (
            <Panel key={l.building.code}>
              <ListRow icon="house" palette={l.home ? 'gold' : 'amber'} title={name}
                sub={`${durationText(l.build_time_seconds)} · ${l.footprint_w}×${l.footprint_h}`}
                right={<span className="vc-line-price">{money(l.total)}</span>} />
              <Facts rows={[
                { label: t('citizen.build.cost'), value: money(l.cost_money) },
                { label: t('citizen.build.permit'), value: money(l.permit_fee) },
              ]} />
              {(l.materials ?? []).map((m) => <Hint key={m.component.code}>{matLine(m, ctx)}</Hint>)}
              {!l.affordable && <Hint tone="bad">{t('citizen.build.short')}</Hint>}
              {act && <Btns ctx={ctx} list={[act]} />}
            </Panel>
          )
        })}
      </div>
      <Hint>{t('citizen.build.pay_note')}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'citizen.place'} />
    </Page>
  )
})

const PrivateLots = flow<PrivateLotsView>(({ view: v, ctx }) => (
  <Page title={ctx.bname(v.building.code, v.building.name)} tone="gold">
    <Panel tone="gold">
      <Lead>{t('vx.private.pick')}</Lead>
      <Legend items={[{ cls: 'mine', label: t('vx.private.yours') }, { cls: 'taken', label: t('citizen.legend.taken') }, { cls: 'free', label: t('citizen.legend.free') }]} />
      <LotMap
        rows={(v.rows as (LotCell[] | null)[] | null)?.map((r) => (r ?? []).map((c) => (c.own || c.fits ? { ...c, state: 'mine' } : c))) ?? null}
        pick={(c) => !!c.fits}
        onPick={(c) => ctx.go({ command: 'settlement.private.place', args: { code: v.building.code, lot: token(c.x, c.y, v.rotated) }, kind: 'primary', id: 'private.place' })}
      />
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const PrivateConfirm = flow<PrivateConfirmView>(({ view: v, ctx }) => (
  <Page title={ctx.bname(v.building.code, v.building.name)} tone="gold">
    <Panel tone="gold">
      <Lead>{t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 })}</Lead>
      <Facts rows={[
        { label: t('citizen.build.cost'), value: money(v.cost_money) },
        { label: t('citizen.build.permit'), value: money(v.permit_fee) },
        ...(v.materials_cost > 0 ? [{ label: t('citizen.build.materials'), value: money(v.materials_cost) }] : []),
        { label: t('citizen.build.total'), value: money(v.total), gold: true },
        { label: t('citizen.buy.cash'), value: money(v.cash) },
        { label: t('citizen.build.time'), value: durationText(v.build_time_seconds) },
      ]} />
      {(v.materials ?? []).map((m) => <Hint key={m.component.code}>{matLine(m, ctx)}</Hint>)}
      {v.cash < v.total && <Hint tone="bad">{t('citizen.build.short')}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('citizen.build.start', { p: money(v.total) })} />
    <Cancel ctx={ctx} />
  </Page>
))

// -- the resident's own property -------------------------------------------------------------

const Mine = flow<MineView>(({ view: v, ctx }) => {
  const lots = v.lots ?? []
  const noticeKey = v.notice ? (v.notice === 'rested' ? 'citizen.mine.rested' : v.notice === 'tax_paid' ? 'citizen.mine.paid' : 'citizen.mine.nothing_paid') : ''
  return (
    <Page title={t('citizen.mine.title')} tone="gold">
      {noticeKey && <Panel tone="emerald"><Lead tone="good">{t(key(noticeKey))}</Lead></Panel>}
      <Panel tone="gold">
        {v.home
          ? <ListRow icon="house" palette="gold" title={`${t('citizen.mine.home')}: ${ctx.bname(v.home.code, v.home.name)}`} sub={`${t('citizen.mine.cash')}: ${money(v.cash)}`} />
          : <><Lead>{t('citizen.mine.no_home')}</Lead><Facts rows={[{ label: t('citizen.mine.cash'), value: money(v.cash), gold: true }]} /></>}
        <SectionTitle>{t('citizen.mine.lots')}</SectionTitle>
        {lots.length === 0 && <Hint>{t('citizen.mine.no_lots')}</Hint>}
        <Facts rows={lots.map((l) => ({
          label: t('citizen.buy.lot', { x: l.x + 1, y: l.y + 1 }),
          value: l.building ? `${ctx.bname(l.building)}${l.state === 'building' || l.left_seconds > 0 ? ` · ${t('vx.mine.going', { t: durationText(l.left_seconds) })}` : ''}` : l.access && l.access !== 'road' ? t('citizen.mine.lot_no_road') : t('citizen.mine.lot_bare'),
        }))} />
        {lots.filter((l) => !l.building && l.access && l.access !== 'road').map((l) => (
          <Do key={`${l.x}-${l.y}`} ctx={ctx} a={{ command: 'settlement.lot.access', args: { lot: token(l.x, l.y) }, kind: 'navigation', id: 'lot.access' }}
            label={t('citizen.mine.fix', { x: l.x + 1, y: l.y + 1 })} />
        ))}
        <Facts rows={[
          { label: t('citizen.mine.assessed'), value: money(v.assessed) },
          { label: t('citizen.mine.tax'), value: `${money(v.tax_per_period)} · ${formatNumber(v.tax_bps / 100)}%` },
          ...(v.debt > 0 ? [{ label: t('citizen.mine.debt'), value: t('vx.mine.debt', { amount: money(v.debt), n: v.debt_periods }), gold: true }] : []),
        ]} />
        {v.home && !v.can_rest && <Hint>{t('citizen.mine.rest_wait', { t: durationText(v.rest_wait_seconds) })}</Hint>}
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id === 'citizen.rest' && !v.can_rest} />
    </Page>
  )
})

// -- the head's terms ------------------------------------------------------------------------

const Terms = flow<TermsView>(({ view: v, ctx }) => {
  const lever = (title: string, now: string, range: string, presets: number[] | null, id: 'lot_price' | 'permit_fee' | 'tax_bps', fmt: (n: number) => string) => (
    <div className="vf-lever">
      <div className="vf-lever-head"><b>{title}</b><span className="gold">{now}</span></div>
      <Hint>{range}</Hint>
      <div className="vf-btns row">
        {(presets ?? []).map((p) => (
          <Slab key={p} tone="steel" radius={12} lip={3} disabled={ctx.busy}
            onClick={() => ctx.go({ command: 'settlement.terms', args: { [id]: String(p) }, kind: 'secondary', id: `terms.${id}` })}>{fmt(p)}</Slab>
        ))}
      </div>
    </div>
  )
  const pct = (bps: number) => `${formatNumber(bps / 100)}%`
  return (
    <Page title={t('vx.terms.title', { village: v.village })} tone="gold">
      <Panel tone="gold">
        {lever(t('vx.terms.lot'), money(v.lot_price), t('vx.terms.range', { min: money(v.lot_price_min), max: money(v.lot_price_max) }), v.lot_presets, 'lot_price', money)}
        {lever(t('vx.terms.permit'), money(v.permit_fee), t('vx.terms.upto', { max: money(v.permit_fee_max) }), v.permit_presets, 'permit_fee', money)}
        {lever(t('vx.terms.tax'), pct(v.tax_bps), t('vx.terms.upto', { max: pct(v.tax_bps_max) }), v.tax_presets, 'tax_bps', pct)}
        <Hint>{t('vx.terms.note')}</Hint>
      </Panel>
      <Rest ctx={ctx} skip={(a) => a.id?.startsWith('terms.') === true} />
    </Page>
  )
})

// -- work ------------------------------------------------------------------------------------

const Work = flow<WorkView>(({ view: v, ctx }) => {
  const starts = ctx.by('work.start')
  const goods = (l: { component: { code: string; name: string }; quantity: number }[] | null) =>
    (l ?? []).map((m) => `${formatNumber(m.quantity)} ${ctx.names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ')
  return (
    <Page title={t('vx.work.title', { village: v.village })} tone="sapphire">
      {v.started && <Panel tone="emerald"><Lead tone="good">{t('vx.work.started')}</Lead></Panel>}
      {v.mine && (
        <Panel tone="gold">
          <ListRow icon="gears" palette="amber" title={t('vx.work.mine', { building: ctx.bname(v.mine.building.code, v.mine.building.name) })}
            sub={t('vx.work.mine_sub', { t: durationText(v.mine.left_seconds), wage: money(v.mine.wage) })} />
          {(v.mine.produces ?? []).length > 0 && <Hint>{t('vx.work.makes', { list: goods(v.mine.produces) })}</Hint>}
        </Panel>
      )}
      {!v.resident && <Panel><Lead>{t('vx.work.not_resident')}</Lead></Panel>}
      {(v.places ?? []).length === 0 && <Empt>{t('vx.work.none')}</Empt>}
      {(v.places ?? []).length === 0 && (v.suggest ?? []).length > 0 && (
        <Hint>{t('vx.work.suggest', { names: (v.suggest ?? []).slice(0, 3).map((n) => ctx.bname(n.code, n.name)).join('، ') })}</Hint>
      )}
      <div className="vf-stack">
        {(v.places ?? []).map((p) => {
          const { icon, palette } = iconForRole(ctx.cat.get(p.building.code)?.category)
          const act = starts.find((a) => a.subject === p.building.code)
          return (
            <Panel key={p.id}>
              <ListRow icon={icon} palette={palette} tone={ROLE_TONE[ctx.cat.get(p.building.code)?.category ?? '']} title={ctx.bname(p.building.code, p.building.name)}
                sub={t('vx.work.place_sub', { shift: durationText(p.shift_seconds), wage: money(p.wage) })}
                right={<Chip>{t('vx.work.busy', { busy: p.busy, total: p.workers })}</Chip>} />
              {(p.consumes ?? []).length > 0 && <Hint>{t('vx.work.uses', { list: goods(p.consumes) })}</Hint>}
              {(p.produces ?? []).length > 0 && <Hint>{t('vx.work.makes', { list: goods(p.produces) })}</Hint>}
              {act && <Btns ctx={ctx} list={[act]} />}
            </Panel>
          )
        })}
      </div>
      <Hint>{t('vx.work.hint')}</Hint>
      <Hint>{t('vx.work.capacity', { used: formatNumber(v.used), cap: formatNumber(v.capacity) })}</Hint>
      <Rest ctx={ctx} skip={(a) => a.id === 'work.start'} />
    </Page>
  )
})

// -- the roster ------------------------------------------------------------------------------

const Who = flow<SettlementWhoView>(({ view: v, ctx }) => (
  <Page title={t('who.title')} tone="teal">
    <Panel tone="teal">
      <Lead>{t('vx.who.head', { village: v.name, n: (v.online ?? []).length })}</Lead>
      {(v.online ?? []).length === 0 && <Hint>{t('vx.who.nobody')}</Hint>}
      {(v.online ?? []).map((p, i) => (
        <ListRow key={i} icon="person" palette="emerald"
          title={<span><i className="vs-dot on" />{p.name}</span>}
          sub={[hasKey(`activity.${p.activity}`) ? t(key(`activity.${p.activity}`)) : '', p.place ? ctx.names.name(['place'], p.place) : ''].filter(Boolean).join(' · ')} />
      ))}
      {v.offline > 0 && <Hint>{t('vx.who.offline', { n: v.offline })}</Hint>}
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- a group or a player without a village ------------------------------------------------------

const HomeCall = flow<Record<string, never>>(({ ctx }) => (
  <Page title={t('village.title')} tone="emerald">
    <Panel tone="emerald">
      <div className="vc-title display">{t('village.call.title')}</div>
      <div className="vc-body">{t('vx.call.body')}</div>
    </Panel>
    <Rest ctx={ctx} />
  </Page>
))

const HomeNone = flow<Record<string, never>>(({ ctx }) => (
  <Page title={t('village.title')} tone="emerald">
    <Panel tone="emerald"><Lead>{t('village.none')}</Lead><Hint>{t('village.none_hint')}</Hint></Panel>
    <Rest ctx={ctx} />
  </Page>
))

// -- the build menu, the lot grid and the confirms ----------------------------------------------

const BuildMenu = flow<BuildMenuView>(({ view: v, ctx }) => {
  const places = ctx.by('build.place')
  const lines = v.lines ?? []
  return (
    <Page title={t('village.btn.build')} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('know.treasury'), value: money(v.treasury), gold: true },
          { label: t('vx.build.running'), value: <span className="vs-ltr">{formatNumber(v.running_builds)} / {formatNumber(v.concurrent_cap)}</span> },
        ]} />
      </Panel>
      {lines.length === 0 && <Empt>{t('vx.build.empty')}</Empt>}
      <div className="vf-stack">
        {lines.map((l) => {
          const locked = l.state !== 'available'
          const { icon, palette } = iconForRole(l.role)
          const act = places.find((a) => a.subject === l.building.code)
          const missing = [...(l.missing ?? []).map((m) => ctx.names.name(['knowledge'], m.code, m.name)), ...(l.missing_buildings ?? []).map((m) => ctx.bname(m.code, m.name))]
          return (
            <Panel key={l.building.code}>
              <ListRow icon={locked ? 'm_lock' : icon} palette={locked ? 'steel' : palette} title={ctx.bname(l.building.code, l.building.name)}
                sub={`${durationText(l.build_time_seconds)}${l.role ? ` · ${t(key(`role.${l.role}`))}` : ''}`}
                right={<span className="vc-line-price">{money(l.cost_money)}</span>} />
              {mats(ctx, l.materials)}
              {!locked && (l.short ?? []).length > 0 && <Hint tone="bad">{t('vx.build.short', { list: (l.short ?? []).map((m) => `${formatNumber(m.quantity)} ${ctx.names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ') })}</Hint>}
              {locked && missing.length > 0 && <Hint tone="bad">{t('build.needs', { list: missing.join('، ') })}</Hint>}
              {act && <Btns ctx={ctx} list={[act]} />}
            </Panel>
          )
        })}
      </div>
      <Rest ctx={ctx} skip={(a) => a.id === 'build.place'} />
    </Page>
  )
})

const BuildLots = flow<LotGridView>(({ view: v, ctx }) => {
  const code = v.building.code
  const rot = v.rotated ? '1' : '0'
  const onPick = (c: GridCell) => {
    if (v.line === 'line') ctx.go({ command: 'settlement.build.lots', args: { code, rotate: rot, from: token(c.x, c.y) }, kind: 'navigation', id: 'lots.from' })
    else if (v.line === 'end') ctx.go({ command: 'settlement.build.place_many', args: { code, from: token(v.from.x, v.from.y), to: token(c.x, c.y) }, kind: 'primary', id: 'lots.to' })
    else ctx.go({ command: 'settlement.build.place', args: { code, lot: token(c.x, c.y, v.rotated) }, kind: 'primary', id: 'lots.place' })
  }
  return (
    <Page title={ctx.bname(code, v.building.name)} tone="gold">
      <Panel tone="gold">
        <Lead>{v.line === 'line' ? t('vx.lots.line_from') : v.line === 'end' ? t('vx.lots.line_to') : t('vx.lots.pick')}</Lead>
        <Legend items={[{ cls: 'free', label: t('vx.lots.fits') }, { cls: 'occupied', label: t('vx.legend.building') }, { cls: 'road', label: t('vx.legend.road') }, { cls: 'water', label: t('vx.legend.water') }, { cls: 'steep', label: t('vx.legend.steep') }]} />
        <LotMap rows={v.rows as (LotCell[] | null)[] | null} pick={(c) => (v.line === 'end' ? c.state === 'free' || !!c.fits : !!c.fits)} onPick={onPick} mark={v.line === 'end' ? v.from : null} />
        {v.rotated && <Hint>{t('vx.lots.rotated')}</Hint>}
      </Panel>
      <Rest ctx={ctx} />
    </Page>
  )
})

const BuildConfirm = flow<LotConfirmView>(({ view: v, ctx }) => (
  <Page title={ctx.bname(v.building.code, v.building.name)} tone="gold">
    <Panel tone="gold">
      <Lead>{t('citizen.buy.lot', { x: v.x + 1, y: v.y + 1 })}</Lead>
      <Facts rows={[
        { label: t('citizen.build.cost'), value: money(v.cost_money), gold: true },
        { label: t('citizen.build.time'), value: durationText(v.build_time_seconds) },
        ...(v.auto_roads > 0 ? [{ label: t('vx.build.roads'), value: formatNumber(v.auto_roads) }] : []),
      ]} />
      {mats(ctx, v.materials)}
      {(v.materials ?? []).length > 0 && <Hint>{t('vx.build.from_stock')}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('vx.build.yes', { p: money(v.cost_money) })} />
    <Cancel ctx={ctx} />
  </Page>
))

const BatchConfirm = flow<BatchConfirmView>(({ view: v, ctx }) => (
  <Page title={ctx.bname(v.building.code, v.building.name)} tone="gold">
    <Panel tone="gold">
      <Lead>{t('vx.batch.count', { n: v.count })}</Lead>
      <Facts rows={[
        { label: t('citizen.build.cost'), value: money(v.cost_money), gold: true },
        { label: t('citizen.build.time'), value: durationText(v.build_time_seconds) },
      ]} />
      {mats(ctx, v.materials)}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('vx.build.yes', { p: money(v.cost_money) })} />
    <Cancel ctx={ctx} />
  </Page>
))

const GridGrow = flow<GridGrowView>(({ view: v, ctx }) => (
  <Page title={t('vx.grow.title')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('vx.grow.body', { from: v.side, to: v.new_side })}</Lead>
      <Facts rows={[
        { label: t('vx.grow.lots'), value: formatNumber(v.lots_gained) },
        { label: t('vx.grow.buildable'), value: formatNumber(v.buildable_gained) },
        { label: t('citizen.buy.price'), value: money(v.price), gold: true },
        { label: t('know.treasury'), value: money(v.treasury) },
      ]} />
      {v.treasury < v.price && <Hint tone="bad">{t('vx.grow.short')}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('vx.grow.yes', { p: money(v.price) })} />
    <Cancel ctx={ctx} />
  </Page>
))

const MaterialBuyConfirm = flow<MaterialBuyConfirmView>(({ view: v, ctx }) => (
  <Page title={t('storage.confirm.title')} tone="sapphire">
    <Panel tone="sapphire">
      <Lead>{t('storage.confirm.body', { qty: formatNumber(v.qty), name: ctx.names.name(['component', 'item'], v.item.code, v.item.name), unit: money(v.unit), total: money(v.total) })}</Lead>
      <Hint>{t('storage.confirm.hint', { treasury: money(v.treasury), free: formatNumber(v.free) })}</Hint>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'confirm')} yes={t('storage.confirm.yes', { total: money(v.total) })} />
    <Cancel ctx={ctx} />
  </Page>
))

// -- one building's own page -------------------------------------------------------------------

const EFFECT_KEYS = ['local_security_bps', 'food_coverage_bps', 'job_coverage_bps', 'service_coverage_bps', 'happiness_bps', 'housing_capacity']

const BuildingPage = flow<BuildingPanelView>(({ view: v, ctx }) => {
  const name = ctx.bname(v.building.code, v.building.name)
  const { icon, palette } = iconForRole(v.role)
  const going = v.state === 'building'
  const effects = (v.effects ?? []).filter((e) => EFFECT_KEYS.includes(e.target))
  const confirming = v.mode === 'dm' || v.mode === 'cx'
  return (
    <Page title={name} tone="gold">
      <Panel tone="gold">
        <ListRow icon={icon} palette={palette} title={t(key(`building.state.${going ? 'under_construction' : 'built'}`))}
          sub={`${t('building.at', { x: v.x + 1, y: v.y + 1 })} · ${t('build.footprint', { w: v.w, h: v.h })}`} />
        <Lead>{buildingBlurb(v)}</Lead>
        {going && (
          <>
            <Bar frac={v.progress_percent / 100} color="#f5a11f" label={t('progress.percent', { p: v.progress_percent })} />
            {v.left_seconds > 0 && <Hint>{t('vx.bld.left', { t: durationText(v.left_seconds) })}</Hint>}
          </>
        )}
        {!going && v.kind === 'storage' && (
          <div className="vf-list">
            {(v.stock ?? []).length === 0 ? <Hint>{t('building.storage.empty')}</Hint>
              : (v.stock ?? []).map((s) => (
                <div key={s.item.code} className="vf-line"><span>{ctx.names.name(['component', 'item'], s.item.code, s.item.name)}</span><b>{formatNumber(s.qty)}</b></div>
              ))}
            {v.stock_capacity > 0 && <Hint>{t('vx.bld.stock_used', { used: formatNumber(v.stock_used), cap: formatNumber(v.stock_capacity) })}</Hint>}
          </div>
        )}
        {!going && v.kind === 'school' && <Hint>{v.teaching ? t('building.school.teaching') : t('building.school.idle')}</Hint>}
        {!going && v.kind === 'civic_hall' && (
          <Facts rows={[
            { label: t('building.civic.population'), value: formatNumber(v.population) },
            { label: t('building.civic.treasury'), value: money(v.treasury), gold: true },
            ...(v.research ? [{ label: t('vx.bld.research'), value: `${ctx.names.name(['knowledge'], v.research.knowledge.code, v.research.knowledge.name)} · ${durationText(v.research.left_seconds)}` }] : []),
          ]} />
        )}
        {effects.length > 0 && (
          <div className="vh-effects">
            {effects.map((e) => <span key={e.target} className="vh-effect">{t(key(`building.effect.${e.target}`), { v: formatNumber(e.target === 'housing_capacity' ? e.value : Math.round(e.value / 100)) })}</span>)}
          </div>
        )}
        {v.upkeep > 0 && v.kind !== 'road' && <Hint>{t('building.upkeep', { amount: money(v.upkeep) })}</Hint>}
        {confirming && <Lead tone="bad">{t(v.mode === 'dm' ? 'building.confirm_demolish' : 'building.confirm_cancel')}</Lead>}
        {v.mode === 'up' && (
          <>
            <SectionTitle>{t('building.upgrade.intro')}</SectionTitle>
            {(v.upgrades ?? []).length === 0 && <Hint>{t('building.upgrade.none')}</Hint>}
            {(v.upgrades ?? []).map((u) => (
              <div key={u.building.code} className="vf-line">
                <span>{ctx.bname(u.building.code, u.building.name)}</span>
                <b>{money(u.cost_money)}</b>
                {!u.available && <Hint tone="bad">{(u.missing ?? []).length > 0 ? t('build.needs', { list: (u.missing ?? []).map((m) => ctx.names.name(['knowledge'], m.code, m.name)).join('، ') }) : t('building.upgrade.locked')}</Hint>}
              </div>
            ))}
          </>
        )}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a) && !(a.id ?? '').startsWith('village.') && a.kind !== 'danger' && a.id !== 'build.place')} />
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.id === 'build.place')} />
      {v.kind === 'civic_hall' && <Btns ctx={ctx} list={ctx.acts.filter((a) => (a.id ?? '').startsWith('village.'))} />}
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.kind === 'danger')} />
      {confirming && <Cancel ctx={ctx} />}
    </Page>
  )
})

registerFlow({
  village_refusal: Refusal,
  village_donate_menu: DonateMenu, village_donate_confirm: DonateConfirm, village_donate_done: DonateDone,
  village_promotion: Promotion, village_promote_confirm: PromoteConfirm, village_promoted: Promoted,
  village_residence_confirm: ResidenceConfirm, village_residence_done: ResidenceDone,
  settlement_land: Land, settlement_lot_buy_confirm: LotBuyConfirm, settlement_lot_buy_done: LotBuyDone,
  settlement_lot_access: LotAccessPage, settlement_lot_repair_done: LotRepairDone,
  settlement_private_menu: PrivateMenu, settlement_private_lots: PrivateLots, settlement_private_confirm: PrivateConfirm,
  settlement_mine: Mine, settlement_terms: Terms, village_work: Work, village_work_started: Work,
  settlement_who: Who, village_home_call: HomeCall, village_home_none: HomeNone,
  settlement_build_menu: BuildMenu, settlement_build_lots: BuildLots, settlement_build_confirm: BuildConfirm,
  settlement_build_batch_confirm: BatchConfirm, settlement_grid_grow: GridGrow,
  village_materials_buy_confirm: MaterialBuyConfirm, settlement_building_view: BuildingPage,
})

/** The server screens the flow host draws. */
export const FLOW_SCREENS = [
  'village_refusal', 'village_donate_menu', 'village_donate_confirm', 'village_donate_done', 'village_promotion', 'village_promote_confirm',
  'village_promoted', 'village_residence_confirm', 'village_residence_done', 'settlement_land', 'settlement_lot_buy_confirm', 'settlement_lot_buy_done',
  'settlement_lot_access', 'settlement_lot_repair_done',
  'settlement_private_menu', 'settlement_private_lots', 'settlement_private_confirm', 'settlement_mine', 'settlement_terms', 'village_work',
  'village_work_started', 'settlement_who', 'village_home_call', 'village_home_none', 'settlement_build_menu', 'settlement_build_lots',
  'settlement_build_confirm', 'settlement_build_batch_confirm', 'settlement_grid_grow', 'village_materials_buy_confirm', 'settlement_building_view',
]
