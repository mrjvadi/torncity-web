// «خانوارهای شهر» (ADR 0073): the NPC households of a settlement. A neutral view: the count, how content they are, which need goes unmet most, the earners,
// the wallets in aggregate, the list (no names: «خانوار n»), the news, and the levers: the head opens or closes the town to newcomers and sets the wage tax;
// a player opens his own home to tenants and sets the rent. Phases: none (not available here), dual (getting ready), live, off (stopped).

import type { HouseholdDwellingLine, HouseholdLine, HouseholdsView } from '../../api/views.gen'
import { Slab } from '../../kit'
import { Hint, Lead, Page, Panel, flow, registerWrites, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, EffectRow, Note, StatCard, StatGrid } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'

registerWrites(['settlement.households'], (a) => !!a.args?.action)

const word = (key: string, fallback = ''): string => (hasKey(key) ? t(key as Key) : fallback)
const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`
const send = (ctx: FlowCtx, args: Record<string, string>) => ctx.go({ command: 'settlement.households', args, kind: 'secondary', id: 'settlement.households', icon: 'action:default' } as never)
const mood = (bps: number) => (bps >= 7000 ? 'good' : bps >= 4000 ? 'warn' : 'bad')

function Household({ h }: { h: HouseholdLine }) {
  const leaving = h.state === 'leaving'
  return (
    <div className={`hh-row${leaving ? ' leaving' : ''}`}>
      <div className="hh-head"><b>{t('hh.n', { n: formatNumber(h.index) })}</b><EffectChip tone={leaving ? 'bad' : mood(h.satisfaction_bps)}>{leaving ? t('hh.leaving') : pct(h.satisfaction_bps)}</EffectChip></div>
      <div className="hh-sub">{t('hh.people', { a: formatNumber(h.adults), d: formatNumber(h.dependants), e: formatNumber(h.earners) })} – {t('hh.wallet', { w: money(h.wallet) })}</div>
      {h.worst && <div className="hh-sub">{leaving ? t('hh.leaving_why', { need: word(`hh.need.${h.worst}`, h.worst) }) : t('hh.lacks', { need: word(`hh.need.${h.worst}`, h.worst) })}</div>}
    </div>
  )
}

function Dwelling({ d, v, ctx }: { d: HouseholdDwellingLine; v: HouseholdsView; ctx: FlowCtx }) {
  const presets = v.rent_presets ?? []
  return (
    <div className="hh-row">
      <div className="hh-head"><b>{ctx.bname(d.building.code, d.building.name)}</b><EffectChip tone={d.open ? 'good' : 'neutral'}>{d.open ? t('hh.rent_open') : t('hh.rent_closed')}</EffectChip></div>
      <div className="hh-sub">{t('hh.slots', { n: formatNumber(d.slots) })}{d.open ? ` – ${t('hh.rent_is', { r: money(d.rent) })} – ${t('hh.tenants', { n: formatNumber(d.tenants) })}` : ''}</div>
      <div className="wk-btns">
        {presets.map((r) => <ActionButton key={r} tone={d.open && d.rent === r ? 'gold' : 'steel'} small disabled={ctx.busy} onClick={() => send(ctx, { action: 'rent_open', code: d.building.code, n: String(r) })}>{money(r)}</ActionButton>)}
        {d.open && <ActionButton tone="steel" small disabled={ctx.busy} onClick={() => send(ctx, { action: 'rent_close', code: d.building.code })}>{t('hh.rent_stop')}</ActionButton>}
      </div>
    </div>
  )
}

export const Households = flow<HouseholdsView>(({ view: v, ctx }) => {
  if (v.phase === 'none') return <Page title={t('hh.title')} tone="teal"><Panel><Lead>{t('hh.none')}</Lead><Hint>{t('hh.none_hint')}</Hint></Panel></Page>
  const ready = v.phase === 'dual'
  const off = v.phase === 'off'
  const list = v.list ?? []
  const news = v.news ?? []
  return (
    <Page title={t('hh.title')} tone="teal">
      {ready && <Panel tone="gold"><Lead>{t('hh.dual')}</Lead><Hint>{t('hh.dual_hint', { have: formatNumber(v.pool), want: formatNumber(v.target_pool) })}</Hint></Panel>}
      {off && <Panel tone="ruby"><Lead tone="bad">{t('hh.off')}</Lead><Hint>{t('hh.off_hint')}</Hint></Panel>}
      {!off && (
        <>
          <Panel>
            <StatGrid>
              <StatCard icon="house" palette="emerald" label={t('hh.s.homes')} value={formatNumber(v.living)} />
              <StatCard icon="people" palette="sapphire" label={t('hh.s.persons')} value={formatNumber(v.persons)} />
              <StatCard icon="tool" palette="amber" label={t('hh.s.earners')} value={formatNumber(v.earners)} />
              <StatCard icon="coins" palette="gold" label={t('hh.s.wallets')} value={money(v.wallets)} />
            </StatGrid>
            <EffectRow>
              <EffectChip tone={mood(v.mood_bps)}>{t('hh.mood', { p: pct(v.mood_bps) })}</EffectChip>
              {v.leaving > 0 && <EffectChip tone="bad">{t('hh.leaving_n', { n: formatNumber(v.leaving) })}</EffectChip>}
              <EffectChip tone={v.open ? 'good' : 'neutral'}>{v.open ? t('hh.open') : t('hh.closed')}</EffectChip>
            </EffectRow>
            {v.worst && <Hint>{t('hh.worst', { need: word(`hh.need.${v.worst}`, v.worst) })}</Hint>}
            <Hint>{t('hh.pool', { have: formatNumber(v.pool), want: formatNumber(v.target_pool) })}</Hint>
            {v.last_day && <Hint>{t('hh.last_day', { a: formatNumber(v.last_day.arrivals), d: formatNumber(v.last_day.departures), at: atText(v.last_day.at) })}</Hint>}
          </Panel>

          {(v.may_admit || v.may_tax) && (
            <>
              <SectionTitle>{t('hh.levers')}</SectionTitle>
              <Panel>
                {v.may_admit && (
                  <>
                    <Hint>{v.open ? t('hh.admit_on') : t('hh.admit_off')}</Hint>
                    <Slab tone={v.open ? 'steel' : 'green'} radius={12} lip={3} disabled={ctx.busy} onClick={() => send(ctx, { action: v.open ? 'close' : 'admit' })}>{v.open ? t('hh.close_btn') : t('hh.open_btn')}</Slab>
                  </>
                )}
                {v.may_tax && (
                  <>
                    <Hint>{t('hh.tax_is', { p: pct(v.income_tax_bps) })}</Hint>
                    <div className="wk-btns">{(v.tax_presets ?? []).map((p) => <ActionButton key={p} tone={v.income_tax_bps === p ? 'gold' : 'steel'} small disabled={ctx.busy} onClick={() => send(ctx, { action: 'tax', n: String(p) })}>{pct(p)}</ActionButton>)}</div>
                  </>
                )}
              </Panel>
            </>
          )}

          {(v.dwellings ?? []).length > 0 && (
            <>
              <SectionTitle>{t('hh.dwellings')}</SectionTitle>
              <Panel><Hint>{t('hh.dwellings_hint', { max: money(v.max_rent) })}</Hint><div className="hh-list">{(v.dwellings ?? []).map((d) => <Dwelling key={d.building.code} d={d} v={v} ctx={ctx} />)}</div></Panel>
            </>
          )}

          <SectionTitle>{t('hh.list')}</SectionTitle>
          <Panel>
            {list.length === 0 && <Hint>{t('hh.list_none')}</Hint>}
            <div className="hh-list">{list.map((h) => <Household key={h.index} h={h} />)}</div>
          </Panel>

          {news.length > 0 && (
            <>
              <SectionTitle>{t('hh.news')}</SectionTitle>
              <Panel>
                <div className="vf-list">
                  {news.map((n, i) => {
                    const need = n.detail && hasKey(`hh.need.${n.detail}`) ? word(`hh.need.${n.detail}`) : n.detail
                    const text = n.kind === 'arrived' ? t('hh.news.arrived', { d: n.detail }) : n.kind === 'left' ? t('hh.news.left', { need }) : n.kind === 'notice' ? (n.detail === 'home' ? t('hh.news.notice_home') : t('hh.news.notice', { need })) : n.kind === 'grant' ? t('hh.news.grant', { m: money(Number(n.detail) || 0) }) : word(`hh.news.${n.kind}`, n.kind)
                    return <div key={i} className="vf-line"><span>{text}</span><b>{atText(n.at)}</b></div>
                  })}
                </div>
              </Panel>
            </>
          )}
          <Note>{t('hh.note')}</Note>
        </>
      )}
    </Page>
  )
})
