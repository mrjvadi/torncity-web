// A company's design studio, research lab and reverse-engineering lab: the studio and its designs, one design
// (the editor while it is a draft, the record once it is final), improvement and retrofit jobs, buying upgrade
// kits, the lab and one technology, and taking a sample apart. Drawn from the view and the actions of each
// answer (docs/adr/0039-presentation-split.md); components, slots, attributes and technologies are named from
// the content catalogue.

import { useState } from 'react'
import type {
  DesignView, ImprovementView, KitPurchaseView, LabView, RetrofitView, ReverseLabView, StudioView, TechView,
} from '../../api/views.gen'
import { ListRow } from '../native/kit/Parts'
import Popup, { ActionButton, ActionRow } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, flow, isBack, registerFlow } from '../village/flow'
import { clockText } from '../economy/time'
import { bps } from '../economy/kit'
import {
  BackBtn, Checks, Do, Facts, Hint, Lead, Local, Notice, Page, Panel, byId, formatNumber, go, left, money, nameOf, roughDuration,
} from './kit'
import { TABLES, goodName, namedOf, skillLevel, unitQty } from './wording'
import { unlockHint } from './production'
import type { FlowCtx } from '../village/flow'
import { CardGrid } from '../../ui/v6/panel'

const key = (k: string) => k as Key

const attrName = (ctx: FlowCtx, code: string) => ctx.names.name([...TABLES.attribute], code, code)
const slotName = (ctx: FlowCtx, code: string) => ctx.names.name([...TABLES.slot], code, code)
const designTitle = (name: string, no: number) => name || t('co.design.unnamed', { no: formatNumber(no) })

function Cancel({ ctx }: { ctx: FlowCtx }) {
  const b = ctx.acts.find(isBack)
  return <ActionButton tone="steel" onClick={() => { if (b) ctx.go(b) }}>{t('vx.cancel')}</ActionButton>
}

// -- the studio --------------------------------------------------------------------------------------

const Studio = flow<StudioView>(({ view: v, ctx }) => {
  const news = byId(ctx, 'production.new_design')
  return (
    <Page title={t('co.studio.title', { name: v.ref.name })} tone="violet">
      {(v.designs ?? []).length === 0 && <Notice>{t('co.studio.none')}</Notice>}
      <CardGrid>
        {(v.designs ?? []).map((d) => (
          <ListRow key={d.no} icon={d.status === 'final' ? 'check' : 'quill'} palette={d.status === 'final' ? 'emerald' : 'gold'} title={designTitle(d.name, d.no)}
            sub={`${nameOf(ctx, TABLES.item, d.item)} - ${t(`co.design.status.${d.status}` as Key)}${d.origin === 'reverse_engineered' ? ` - ${t('co.design.copy_short')}` : ''}`}
            onClick={go(ctx, 'production.design', { no: d.no })} />
        ))}
      </CardGrid>
      {v.can_design ? (
        <>
          <Lead>{(v.kinds ?? []).length > 0 ? t('co.studio.new') : t('co.studio.no_kinds')}</Lead>
          <CardGrid>
            {(v.kinds ?? []).map((k) => {
              const a = news.find((x) => x.args?.item === k.code)
              return <ListRow key={k.code} icon="quill" palette="gold" title={nameOf(ctx, TABLES.item, k)} onClick={a ? () => ctx.go(a) : undefined} />
            })}
          </CardGrid>
        </>
      ) : <Notice alert>{t('co.studio.at_max', { max: formatNumber(v.max) })}</Notice>}
      {(v.next ?? []).length > 0 && (
        <>
          <Lead>{(v.kinds ?? []).length === 0 ? t('co.studio.none_ready') : t('co.studio.next')}</Lead>
          <CardGrid>
            {(v.next ?? []).map((k) => <ListRow key={k.item.code} icon="m_lock" palette="steel" title={nameOf(ctx, TABLES.item, k.item)} sub={unlockHint(ctx, k.steps ?? [])} />)}
          </CardGrid>
        </>
      )}
      {v.hidden && <Hint>{t('co.studio.later')}</Hint>}
      {v.can_research && (v.next ?? []).length > 0 && <Btns ctx={ctx} list={byId(ctx, 'production.lab')} />}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

// -- one design ---------------------------------------------------------------------------------------

const Design = flow<DesignView>(({ view: v, ctx }) => {
  const [retire, setRetire] = useState(false)
  const retireAct = byId(ctx, 'production.retire')[0]
  const draft = v.status === 'draft'
  const final = v.status === 'final'
  const item = nameOf(ctx, TABLES.item, v.item)
  const title = `${designTitle(v.name, v.no)} - ${item}`
  const slot = (v.slots ?? []).find((s) => s.slot === v.choosing)
  const delta = (name: string, value: number) => {
    const prev = v.prev_attributes?.[name]
    if (prev === undefined || prev === value) return ''
    return ` (${value > prev ? '+' : ''}${formatNumber(value - prev)})`
  }
  const attrs = (
    <>
      {(v.attributes ?? []).length > 0 && (
        <Panel>
          <Facts rows={(v.attributes ?? []).map((a) => ({
            label: a.observable ? t('co.design.seen', { name: attrName(ctx, a.name) }) : attrName(ctx, a.name),
            value: `${formatNumber(a.value)}${delta(a.name, a.value)}`,
          }))} />
          {v.cost_floor > 0 && <Hint>{t('co.design.cost_floor', { cost: money(v.cost_floor) })}</Hint>}
        </Panel>
      )}
    </>
  )
  // choosing the part of one slot
  if (draft && slot) {
    return (
      <Page title={t('co.design.choose', { slot: slotName(ctx, slot.slot) })} tone="violet">
        {slot.min !== slot.max && <Hint>{t('co.design.range', { lo: unitQty(slot.unit, slot.min), hi: unitQty(slot.unit, slot.max) })}</Hint>}
        <CardGrid>
          {(v.candidates ?? []).map((c) => {
            const a = ctx.acts.find((x) => x.id === 'production.candidate' && x.args?.component === c.component.code)
            return (
              <ListRow key={c.component.code} icon={c.locked ? 'm_lock' : 'gears'} palette={c.locked ? 'steel' : 'gold'} title={nameOf(ctx, TABLES.component, c.component)}
                sub={c.locked ? t('co.design.locked_part') : t('co.design.candidate', { price: money(c.price), quality: formatNumber(c.quality) })}
                onClick={a && !c.locked ? () => ctx.go(a) : undefined} />
            )
          })}
        </CardGrid>
        <Btns ctx={ctx} list={byId(ctx, 'production.slot_clear', 'production.slot_qty')} />
        <BackBtn ctx={ctx} />
      </Page>
    )
  }
  const slotRows = (v.slots ?? []).map((s) => {
    const a = ctx.acts.find((x) => x.id === 'production.slot' && x.args?.slot === s.slot)
    const filled = !!s.component.code
    return (
      <ListRow key={s.slot} icon={filled ? 'check' : 'quill'} palette={filled ? 'emerald' : s.optional ? 'steel' : 'gold'} title={slotName(ctx, s.slot)}
        sub={filled ? `${nameOf(ctx, TABLES.component, s.component)} - ${unitQty(s.unit, s.qty)}` : t(s.optional ? 'co.design.slot_optional' : 'co.design.slot_empty')}
        onClick={draft && a ? () => ctx.go(a) : undefined} />
    )
  })
  return (
    <Page title={title} tone="violet">
      <Panel>
        <Lead>{t(`co.design.state.${v.status}` as Key)}</Lead>
        {v.origin === 'reverse_engineered' && <Hint>{t('co.design.copy', { source: v.source, loss: bps(v.quality_loss_bps), overhead: bps(v.overhead_bps) })}</Hint>}
        {v.version > 1 && <Hint>{t('co.design.version', { version: formatNumber(v.version) })}</Hint>}
      </Panel>
      <CardGrid>{slotRows}</CardGrid>
      {attrs}
      {draft && (
        <>
          {(v.locked ?? []).length > 0 && <Notice alert>{t('co.design.locked', { techs: (v.locked ?? []).map((x) => namedOf(ctx.names, TABLES.tech, x)).join('، ') })}</Notice>}
          <Hint>{t(v.complete ? 'co.design.ready' : 'co.design.incomplete')}</Hint>
          <Btns ctx={ctx} list={byId(ctx, 'production.name')} />
          <Btns ctx={ctx} list={byId(ctx, 'production.finalize')} tone="gold" />
        </>
      )}
      {final && (
        <>
          <Btns ctx={ctx} list={byId(ctx, 'production.produce_design', 'production.kit', 'production.revise')} tone="gold" />
          {(v.attributes ?? []).length > 0 && (
            <Panel>
              <Lead>{t('co.design.improve')}</Lead>
              <Btns ctx={ctx} list={byId(ctx, 'production.improve')} />
            </Panel>
          )}
          {retireAct && <Local tone="red" onClick={() => setRetire(true)}>{t('co.act.production.retire')}</Local>}
        </>
      )}
      <BackBtn ctx={ctx} />
      <Popup open={retire} onClose={() => setRetire(false)} title={t('co.design.retire_title')} tone="red"
        footer={<ActionRow><ActionButton tone="red" disabled={ctx.busy} onClick={() => { setRetire(false); if (retireAct) ctx.go(retireAct) }}>{t('common.confirm')}</ActionButton><ActionButton tone="steel" onClick={() => setRetire(false)}>{t('vx.cancel')}</ActionButton></ActionRow>}>
        <p className="pp-note">{t('co.design.retire_body')}</p>
      </Popup>
    </Page>
  )
})

const Improvement = flow<ImprovementView>(({ view: v, ctx }) => {
  const good = goodName(ctx.names, v.design)
  const attribute = attrName(ctx, v.attribute.code)
  return (
    <Page title={t('co.improve.title', { attribute })} tone="violet">
      <Panel>
        {v.started
          ? <Lead tone="good">{t('co.improve.started', { attribute, good, time: clockText(v.finish_at), duration: roughDuration(v.duration_seconds) })}</Lead>
          : (
            <>
              <Lead>{t('co.improve.plan', { attribute, good })}</Lead>
              <Facts rows={[
                { label: t('co.improve.gain'), value: bps(v.gain_bps) },
                { label: t('co.improve.cost'), value: money(v.cost), gold: true },
                { label: t('co.improve.duration'), value: roughDuration(v.duration_seconds) },
              ]} />
            </>
          )}
      </Panel>
      {!v.started && <Btns ctx={ctx} list={byId(ctx, 'production.improve_confirm')} tone="gold" />}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Retrofit = flow<RetrofitView>(({ view: v, ctx }) => {
  const good = goodName(ctx.names, v.good)
  return (
    <Page title={t('co.retrofit.title', { good })} tone="violet">
      <Panel>
        <Lead tone={v.started ? 'good' : undefined}>{t(v.started ? 'co.retrofit.started' : 'co.retrofit.plan', {
          good, from: formatNumber(v.from_ver), to: formatNumber(v.to_ver), time: clockText(v.finish_at), duration: roughDuration(v.duration_seconds),
        })}</Lead>
      </Panel>
      <Btns ctx={ctx} list={byId(ctx, 'production.orders')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const KitPurchase = flow<KitPurchaseView>(({ view: v, ctx }) => (
  <Page title={t('co.kit.title')} tone="violet">
    <Panel tone={v.bought ? 'emerald' : undefined}>
      <Lead tone={v.bought ? 'good' : undefined}>{t(v.bought ? 'co.kit.bought' : 'co.kit.plan', { seller: v.seller })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={byId(ctx, 'military.procure')} />
    <BackBtn ctx={ctx} />
  </Page>
))

// -- the research lab ---------------------------------------------------------------------------------------

const Lab = flow<LabView>(({ view: v, ctx }) => (
  <Page title={t('co.lab.title', { name: v.ref.name })} tone="violet">
    <Facts rows={[{ label: t('co.available'), value: money(v.available), gold: true }]} />
    {v.running && (
      <Notice>{t('co.lab.running', { tech: namedOf(ctx.names, TABLES.tech, v.running.tech), time: clockText(v.running.finish_at), duration: left(v.running.left_seconds) })}</Notice>
    )}
    {(v.techs ?? []).length === 0 && <Notice>{t('co.lab.none')}</Notice>}
    <CardGrid>
      {(v.techs ?? []).map((x) => {
        const name = namedOf(ctx.names, TABLES.tech, x.tech)
        const sub =
          x.state === 'owned' ? t(`co.lab.mode.${x.mode}` as Key, { price: money(x.price) })
          : x.state === 'available' ? t('co.lab.cost', { cost: money(x.cost) })
          : x.state === 'locked' ? t('co.lab.missing', { techs: (x.missing ?? []).map((m) => namedOf(ctx.names, TABLES.tech, m)).join('، ') })
          : t(`co.tech.state.${x.state}` as Key)
        return (
          <ListRow key={x.tech.code} icon={x.state === 'locked' ? 'm_lock' : x.state === 'running' ? 'clock' : 'gears'}
            palette={x.state === 'owned' || x.state === 'licensed' || x.state === 'published' ? 'emerald' : x.state === 'locked' ? 'steel' : 'violet'}
            title={name} sub={[sub, x.offers > 0 && x.state !== 'owned' ? t('co.lab.offers', { count: formatNumber(x.offers) }) : ''].filter(Boolean).join(' - ')}
            onClick={go(ctx, 'production.tech', { tech: x.tech.code })} />
        )
      })}
    </CardGrid>
    {v.hidden > 0 && <Hint>{t('co.lab.later', { count: formatNumber(v.hidden) })}</Hint>}
    <Hint>{t('co.lab.hint')}</Hint>
    <BackBtn ctx={ctx} />
  </Page>
))

const Tech = flow<TechView>(({ view: v, ctx }) => {
  const name = namedOf(ctx.names, TABLES.tech, v.tech)
  const confirmPublish = v.confirm_publish
  const confirmLicense = v.confirm_license
  const n = v.notice
  const close = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  return (
    <Page title={name} tone="violet">
      {n && <Notice>{t(`co.tech.notice.${n.kind}` as Key, { price: money(n.price), company: n.company.name })}</Notice>}
      <Panel>
        <Lead>{t(`co.tech.is.${v.state}` as Key)}</Lead>
        <Facts rows={[
          { label: t('co.tech.cost'), value: money(v.cost), gold: true },
          { label: t('co.tech.time'), value: roughDuration(v.time_seconds) },
          ...(v.skill ? [{ label: t('co.tech.skill'), value: skillLevel(ctx.names, v.skill, v.level) }, { label: t('co.tech.best'), value: t('common.level', { n: formatNumber(v.best) }) }] : []),
          ...(v.sold > 0 ? [{ label: t('co.tech.sold'), value: formatNumber(v.sold) }] : []),
        ]} />
        {(v.requires ?? []).length > 0 && <Checks lines={(v.requires ?? []).map((r) => ({ label: t('co.tech.requires', { tech: namedOf(ctx.names, TABLES.tech, r.tech) }), met: r.met }))} />}
        {(v.unlocks ?? []).length > 0 && <Hint>{t('co.tech.unlocks', { components: (v.unlocks ?? []).map((u) => nameOf(ctx, TABLES.component, u)).join('، ') })}</Hint>}
        {v.state === 'owned' && <Hint>{t(`co.tech.mode.${v.mode}` as Key, { price: money(v.price) })}</Hint>}
        {v.blocked && hasKey(`co.tech.blocked.${v.blocked}`) && v.state !== 'owned' && (
          <Lead tone="bad">{t(`co.tech.blocked.${v.blocked}` as Key, { skill: skillLevel(ctx.names, v.skill, v.level), level: formatNumber(v.level), money: money(v.available), need: money(v.cost) })}</Lead>
        )}
        {v.running && <Hint>{t('co.lab.running', { tech: namedOf(ctx.names, TABLES.tech, v.running.tech), time: clockText(v.running.finish_at), duration: left(v.running.left_seconds) })}</Hint>}
      </Panel>
      {v.state === 'available' && !v.blocked && <Btns ctx={ctx} list={byId(ctx, 'production.research')} tone="gold" />}
      {v.gap && v.blocked === 'skill' && <Btns ctx={ctx} list={ctx.acts.filter((a) => ['recruit.gap', 'recruit.course'].includes(a.id ?? ''))} tone="gold" />}
      {v.state === 'owned' && v.mode !== 'published' && <Btns ctx={ctx} list={byId(ctx, 'production.mode_private', 'production.mode_license', 'production.mode_publish')} />}
      {(v.offers ?? []).length > 0 && v.state !== 'owned' && v.state !== 'licensed' && v.state !== 'published' && (
        <Panel>
          <Lead>{t('co.tech.offers')}</Lead>
          {(v.offers ?? []).map((o) => {
            const a = ctx.acts.find((x) => x.id === 'production.license' && x.subject === o.company.code)
            return a ? <Do key={o.company.code} ctx={ctx} a={a} label={t('co.tech.license_from', { company: o.company.name, price: money(o.price) })} /> : null
          })}
        </Panel>
      )}
      <BackBtn ctx={ctx} />
      {(confirmPublish || confirmLicense) && (
        <Popup open onClose={close} title={t(confirmPublish ? 'co.tech.publish_title' : 'co.tech.license_title')} tone="navy"
          footer={(
            <ActionRow>
              {ctx.acts.filter((a) => a.id === 'production.publish_confirm' || a.id === 'production.license_confirm').map((a) => (
                <ActionButton key={a.id} tone="green" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t(confirmPublish ? 'co.tech.publish_yes' : 'co.tech.license_yes', { price: money(confirmLicense?.price ?? 0) })}</ActionButton>
              ))}
              <Cancel ctx={ctx} />
            </ActionRow>
          )}>
          <p className="pp-note">{confirmPublish ? t('co.tech.publish_body', { tech: name }) : t('co.tech.license_body', { tech: name, company: confirmLicense?.company.name ?? '', price: money(confirmLicense?.price ?? 0), money: money(v.available) })}</p>
        </Popup>
      )}
    </Page>
  )
})

// -- reverse engineering ---------------------------------------------------------------------------------------

const ReverseLab = flow<ReverseLabView>(({ view: v, ctx }) => {
  const samples = byId(ctx, 'production.reverse')
  const c = v.confirm
  const close = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  return (
    <Page title={t('co.relab.title', { name: v.ref.name })} tone="violet">
      {v.started && <Notice>{t('co.relab.started', { good: goodName(ctx.names, v.started.good), time: clockText(v.started.finish_at), duration: left(v.started.left_seconds) })}</Notice>}
      <Facts rows={[
        { label: t('co.relab.engineer'), value: skillLevel(ctx.names, v.skill, v.level) },
        { label: t('co.relab.time'), value: roughDuration(v.time_seconds) },
      ]} />
      <Lead>{t('co.relab.samples')}</Lead>
      {(v.samples ?? []).length === 0 && <Notice>{t('co.relab.no_samples')}</Notice>}
      <CardGrid>
        {(v.samples ?? []).map((s, i) => (
          <ListRow key={s.serial} icon="m_search" palette="violet" title={goodName(ctx.names, s.good)}
            sub={t('co.relab.sample', { maker: s.maker, quality: formatNumber(s.quality), chance: bps(s.chance_bps) })}
            onClick={samples[i] ? () => ctx.go(samples[i]) : undefined} />
        ))}
      </CardGrid>
      {(v.jobs ?? []).length > 0 && (
        <>
          <Lead>{t('co.relab.jobs')}</Lead>
          <CardGrid>
            {(v.jobs ?? []).map((j) => {
              const open = j.result_no > 0 ? ctx.acts.find((a) => a.id === 'production.design' && a.args?.no === String(j.result_no)) : undefined
              return (
                <ListRow key={j.no} icon={j.status === 'running' ? 'clock' : j.status === 'succeeded' ? 'check' : 'close'} palette={j.status === 'running' ? 'gold' : j.status === 'succeeded' ? 'emerald' : 'ruby'}
                  title={goodName(ctx.names, j.good)}
                  sub={j.status === 'running' ? t('co.relab.job_running', { time: clockText(j.finish_at), duration: left(j.left_seconds) })
                    : j.status === 'succeeded' ? t('co.relab.job_ok', { result: j.result }) : t('co.relab.job_failed')}
                  onClick={open ? () => ctx.go(open) : undefined} />
              )
            })}
          </CardGrid>
        </>
      )}
      <Hint>{t('co.relab.hint')}</Hint>
      <BackBtn ctx={ctx} />
      {c && (
        <Popup open onClose={close} title={t('co.relab.confirm_title')} tone="navy"
          footer={(
            <ActionRow>
              {ctx.acts.filter((a) => a.id === 'production.reverse_confirm').map((a) => (
                <ActionButton key="y" tone="green" disabled={ctx.busy} onClick={() => ctx.go(a)}>{t('co.relab.confirm_yes')}</ActionButton>
              ))}
              <Cancel ctx={ctx} />
            </ActionRow>
          )}>
          <p className="pp-note">{t('co.relab.confirm', { good: goodName(ctx.names, c.good), maker: c.maker, chance: bps(c.chance_bps), duration: roughDuration(v.time_seconds) })}</p>
        </Popup>
      )}
    </Page>
  )
})

registerFlow({ studio: Studio, design: Design, improvement: Improvement, retrofit: Retrofit, kit_purchase: KitPurchase, lab: Lab, tech: Tech, reverse_lab: ReverseLab })

export const DESIGN_SCREENS = ['studio', 'design', 'improvement', 'retrofit', 'kit_purchase', 'lab', 'tech', 'reverse_lab']
