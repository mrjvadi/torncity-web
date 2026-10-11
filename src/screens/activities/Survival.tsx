// «تشنگی و سرما» (ADR 0070): the player's thirst and warmth, the weather where he stands, how to drink and warm up, the garments he wears (six slots,
// a list and never a grid) and the ones he keeps or carries, and a sickness with its cure. A neutral view: the facts come from `SurvivalView`, the
// words are ours; every act is a write of the flow host (it answers this screen again with a `notice`).

import type { GarmentLine, SurvivalView } from '../../api/views.gen'
import { Slab } from '../../kit'
import { Btns, Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from '../village/flow'
import { SectionTitle } from '../native/kit/Parts'
import { hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'
import { clockText } from '../life/common'
import { NeedBar, NEED_SPEC } from '../native/Profile'
import { roughDuration } from '../native/kit/format'
import { ActionButton, EffectChip, EffectRow, Note } from '../../ui/Popup'

registerWrites(['health.drink', 'health.wear', 'health.remove', 'health.warm', 'health.cure'])

export const SLOTS = ['head', 'outer', 'mid', 'base', 'hands', 'feet'] as const
import { word, weatherLine, warmthWord, thirstWord, Forecast } from './survivalText'
import { atText } from '../../lib/duration'

const act = (command: string, args: Record<string, string>) => ({ command, args, kind: 'secondary' as const, id: command, icon: 'action:default' })
const when = (g: GarmentLine) => (g.left_seconds > 0 ? t('sv.left', { t: roughDuration(g.left_seconds) }) : '')

function Row({ slot, g, ctx }: { slot: string; g: GarmentLine | undefined; ctx: FlowCtx }) {
  return (
    <div className={`sv-row${g ? ' on' : ''}`}>
      <div className="sv-slot">{t(`sv.slot.${slot}` as Key)}</div>
      {g ? (
        <>
          <div className="sv-what"><b>{ctx.names.name(['component', 'item'], g.item.code, g.item.name)}</b><span>{t('sv.warm', { n: formatNumber(g.warmth) })}{when(g) ? ` – ${when(g)}` : ''}</span></div>
          <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => ctx.go(act('health.remove', { slot }) as never)}>{t('sv.remove')}</ActionButton>
        </>
      ) : <div className="sv-what none">{t('sv.empty_slot')}</div>}
    </div>
  )
}

export const Survival = flow<SurvivalView>(({ view: v, ctx }) => {
  if (!v.founded) return <Page title={t('sv.title')} tone="sapphire"><Panel><Lead>{v.starts_at ? t('sv.starts', { at: atText(v.starts_at) }) : t('sv.not_founded')}</Lead></Panel></Page>
  const worn = new Map((v.worn ?? []).map((g) => [g.slot, g]))
  const spare = [...(v.kept ?? []), ...(v.bag ?? [])]
  const ill = v.illness ?? []
  const wardrobeKey = (g: GarmentLine) => g.id || g.item.code
  return (
    <Page title={t('sv.title')} tone="sapphire">
      {v.notice && hasKey(`sv.notice.${v.notice}`) && <Panel tone="emerald"><Lead tone={v.notice === 'river_sick' || v.notice === 'collapsed' ? 'bad' : 'good'}>{word(`sv.notice.${v.notice}`)}</Lead></Panel>}
      <Panel>
        <div className="pf2-needs">
          <NeedBar {...NEED_SPEC.thirst} label={t('need.thirst')} value={v.thirst} />
          <NeedBar {...NEED_SPEC.warmth} label={t('need.warmth')} value={v.warmth} />
        </div>
        <EffectRow>
          {thirstWord(v.thirst_level) && <EffectChip tone={v.thirst_level > 1 ? 'bad' : 'warn'}>{thirstWord(v.thirst_level)}</EffectChip>}
          {warmthWord(v.warmth_level) && v.warmth_level !== 'fine' && <EffectChip tone={v.warmth_level === 'chilly' || v.warmth_level === 'hot' ? 'warn' : 'bad'}>{warmthWord(v.warmth_level)}</EffectChip>}
          {v.sheltered && <EffectChip tone="good">{t('sv.sheltered')}</EffectChip>}
        </EffectRow>
        {v.env && <Hint>{weatherLine(v.env)}</Hint>}
        {v.env?.cold_snap_until && <Note tone="bad">{t('sv.snap_until', { at: atText(v.env.cold_snap_until) })}</Note>}
        {v.env && <Forecast days={v.env.forecast} />}
      </Panel>

      <SectionTitle>{t('sv.drink_title')}</SectionTitle>
      <Panel>
        <div className="sv-btns">
          <Slab tone="blue" radius={12} lip={3} disabled={ctx.busy || !v.well_open} onClick={() => ctx.go(act('health.drink', { source: 'well' }) as never)}>{t('sv.drink.well')}</Slab>
          <Slab tone="blue" radius={12} lip={3} disabled={ctx.busy || v.carried < 1} onClick={() => ctx.go(act('health.drink', { source: 'bag' }) as never)}>{t('sv.drink.bag', { n: formatNumber(v.carried) })}</Slab>
          {v.river && <Slab tone="steel" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(act('health.drink', { source: 'boiled' }) as never)}>{t('sv.drink.boiled')}</Slab>}
          {v.river && <button type="button" className="sv-risky" disabled={ctx.busy} onClick={() => ctx.go(act('health.drink', { source: 'river' }) as never)}>{t('sv.drink.river')}</button>}
        </div>
        {!v.well_open && <Hint>{t('sv.well_closed')}</Hint>}
        {v.river && <Hint tone="bad">{t('sv.river_warn')}</Hint>}
      </Panel>

      {(v.warming_open || v.warmth_level !== 'fine') && (
        <Panel>
          <Slab tone="gold" radius={12} lip={3} disabled={ctx.busy || !v.warming_open} onClick={() => ctx.go(act('health.warm', {}) as never)}>{t('sv.warm_btn')}</Slab>
          {!v.warming_open && <Hint>{t('sv.warming_closed')}</Hint>}
        </Panel>
      )}

      {ill.length > 0 && (
        <Panel tone="ruby">
          {ill.map((i) => <Lead key={i.kind} tone="bad">{word(`sv.ill.${i.kind}`, i.kind)}{i.ends_at ? ` – ${t('sv.ill_until', { at: clockText(i.ends_at) })}` : ''}</Lead>)}
          <Hint>{t('sv.ill_hint')}</Hint>
          {v.can_cure ? <Slab tone="green" radius={12} lip={3} disabled={ctx.busy} onClick={() => ctx.go(act('health.cure', {}) as never)}>{t('sv.cure')}</Slab> : <Note>{t('sv.cure_none')}</Note>}
        </Panel>
      )}

      <SectionTitle>{t('sv.wardrobe')}</SectionTitle>
      <Panel>
        <div className="sv-list">{SLOTS.map((s) => <Row key={s} slot={s} g={worn.get(s)} ctx={ctx} />)}</div>
      </Panel>
      {spare.length > 0 && (
        <>
          <SectionTitle>{t('sv.spare')}</SectionTitle>
          <Panel>
            <div className="sv-list">
              {spare.map((g) => (
                <div key={`${g.id}-${g.item.code}`} className="sv-row">
                  <div className="sv-slot">{t(`sv.slot.${g.slot}` as Key)}</div>
                  <div className="sv-what"><b>{ctx.names.name(['component', 'item'], g.item.code, g.item.name)}</b><span>{t('sv.warm', { n: formatNumber(g.warmth) })}{g.qty > 1 ? ` – ${t('sv.qty', { n: formatNumber(g.qty) })}` : ''}{when(g) ? ` – ${when(g)}` : ''}</span></div>
                  <ActionButton tone="gold" small disabled={ctx.busy} onClick={() => ctx.go(act('health.wear', { item: wardrobeKey(g) }) as never)}>{t('sv.wear')}</ActionButton>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      {spare.length === 0 && (v.worn ?? []).length === 0 && <Hint>{t('sv.no_garments')}</Hint>}
      <Btns ctx={ctx} list={ctx.acts.filter((a) => a.kind === 'back' || a.id === 'back').slice(0, 0)} />
    </Page>
  )
})
