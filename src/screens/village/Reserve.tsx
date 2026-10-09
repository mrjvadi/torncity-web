// «صندوق ذخیره» (ADR 0033 phase 4): the valuation of a settlement's own money (pot, basis, excess), its coverage, the head's public and delayed
// tools (issue, burn, buy, sell, withdraw excess, retire), the public log, the wind-down claim. Coverage is a measure of confidence; nobody is owed it.
// Every act is ask, then confirm (the same action, amount and price the ask showed). Requests execute later, at the first period close.

import { useState } from 'react'
import type { MoneyMacro, ReserveView } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, Note, ProgressRow, Section, StatCard, StatGrid } from '../../ui/Popup'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { Chip } from '../native/kit/Parts'
import { formatNumber } from '../native/kit/format'
import { atText, words } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'
import { useVillageCommand } from '../../village/useVillage'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack } from './flow'
import { parseNum } from './Fx'

const sup = (n: number) => `${formatNumber(n)} ${t('unit.money')}`
const pct = (bps: number) => `\u2066${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(bps / 100)}٪\u2069`
const idx = (ppm: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(ppm / 10000)

function Trend({ list }: { list: MoneyMacro[] }) {
  if (list.length < 2) return null
  const vals = list.map((m) => m.price_ppm), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const pts = vals.map((x, i) => `${(i / (vals.length - 1)) * 200},${46 - ((x - lo) / span) * 40}`).join(' ')
  return <svg className="fx-spark" viewBox="0 0 200 50" preserveAspectRatio="none" role="img" aria-label={t('rs.trend')}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
}

export const ReserveScreen = flow<ReserveView>(({ view: v0, ctx }) => {
  const cmd = useVillageCommand()
  const [v, setV] = useState(v0)
  const [pick, setPick] = useState<'issue' | 'burn' | 'buy' | 'sell' | 'withdraw' | 'retire' | null>(null)
  const [amt, setAmt] = useState('')
  const [price, setPrice] = useState('')
  const [ask, setAsk] = useState<ReserveView | null>(null)
  const [busy, setBusy] = useState(false)
  const back = ctx.acts.find(isBack)
  const units = (n: number) => `${formatNumber(n)} ${v.name}`

  async function call(args: Record<string, string>, write = false) {
    setBusy(true)
    const r = await cmd('settlement.currency.reserve', args, { write })
    setBusy(false)
    return r.ok && r.res?.view ? (r.res.view as unknown as ReserveView) : null
  }
  async function reload() { const nv = await call({}); if (nv) setV(nv) }
  async function doAsk(action: string) {
    const nv = await call({ action, ...(action !== 'retire' && action !== 'claim' ? { amount: String(Math.floor(parseNum(amt)) || 0) } : {}), ...((action === 'buy' || action === 'sell') && price ? { price: String(parseNum(price)) } : {}) })
    if (nv) setAsk(nv)
  }
  async function confirm() {
    if (!ask) return
    const args: Record<string, string> = { action: ask.action, confirm: 'confirm' }
    if (ask.amount) args.amount = String(ask.amount)
    if (ask.price) args.price = String(ask.price)
    const nv = await call(args, true)
    setAsk(null); setPick(null); setAmt(''); setPrice('')
    if (nv) setV(nv); else void reload()
  }
  async function simple(args: Record<string, string>) { const nv = await call(args, true); if (nv) setV(nv); else void reload() }

  const wind = v.status === 'wind_down', retired = v.status === 'retired'
  const tools: { key: NonNullable<typeof pick>; icon: string; unit: 'sup' | 'units' | 'none'; show: boolean }[] = [
    { key: 'issue', icon: 'coin', unit: 'sup', show: v.can_issue }, { key: 'burn', icon: 'chest', unit: 'units', show: v.can_issue },
    { key: 'buy', icon: 'plus', unit: 'units', show: v.can_policy }, { key: 'sell', icon: 'crate', unit: 'units', show: v.can_policy },
    { key: 'withdraw', icon: 'coin', unit: 'sup', show: v.can_policy }, { key: 'retire', icon: 'scroll', unit: 'none', show: v.can_issue && v.status === 'chartered' },
  ]
  const when = (a: string | null) => (a ? atText(a) : '')

  return (
    <Page title={t('rs.title', { name: v.name })} tone="gold">
      <Panel tone={wind || retired ? 'ruby' : 'gold'}>
        <Chip tone={wind || retired ? 'ruby' : 'emerald'}>{t(`rs.status.${v.status}` as Key)}</Chip>
        <StatGrid>
          <StatCard icon="coins" palette="gold" label={t('rs.pot')} value={sup(v.pot_sup)} />
          <StatCard icon="box" palette="steel" label={t('rs.basis')} value={sup(v.basis)} />
          <StatCard icon="chart" palette="emerald" label={t('rs.excess')} value={sup(v.excess)} />
          <StatCard icon="people" palette="sapphire" label={t('rs.supply')} value={units(v.supply)} />
        </StatGrid>
        {v.coverage_known ? <ProgressRow frac={Math.min(1, v.coverage_bps / 20000)} label={<span dir="rtl" style={{ unicodeBidi: 'isolate' }}>{t('rs.coverage_l')}: <bdi dir="ltr">{pct(v.coverage_bps)}</bdi></span>} color="#56d447" /> : <Hint>{t('rs.coverage_none')}</Hint>}
        <Hint>{t('rs.coverage_note')}</Hint>
        <Facts rows={[
          { label: t('rs.stab'), value: units(v.stabilisation) },
          { label: t('rs.cap'), value: sup(v.market_cap_sup) },
        ]} />
        <Section>{t('rs.levers')}</Section>
        <ul className="rs-levers">
          <li><span>{t('rs.lv_mint')}</span><b>{pct(v.mint_fee_bps)}</b></li>
          <li><span>{t('rs.lv_fx')}</span><b>{pct(v.reserve_fee_bps)}</b></li>
          <li><span>{t('rs.lv_band')}</span><b>{pct(v.max_move_bps)}</b></li>
          <li><span>{t('rs.lv_notice')}</span><b>{t('rs.hours', { n: formatNumber(v.withdraw_notice_hours) })}</b></li>
        </ul>
      </Panel>

      {v.macro && (
        <Panel>
          <Lead>{t('rs.macro')}</Lead>
          <Facts rows={[
            { label: t('rs.price_idx'), value: `${idx(v.macro.price_ppm)}٪` },
            { label: t('rs.supply_growth'), value: pct(v.macro.supply_growth_bps) },
            { label: t('rs.macro_cov'), value: v.macro.coverage_known ? pct(v.macro.coverage_bps) : '—' },
          ]} />
          <div className="fx-spark-box"><Trend list={v.trend ?? []} /></div>
        </Panel>
      )}

      {wind && (
        <Panel tone="ruby">
          <Lead tone="bad">{t('rs.wind_lead')}</Lead>
          {v.wind_down_ends_at && <Hint>{t('rs.wind_ends', { at: when(v.wind_down_ends_at) })}</Hint>}
          {v.can_claim ? (
            <>
              <Hint>{t('rs.claim_hint', { share: sup(v.my_share), units: units(v.my_units) })}</Hint>
              <ActionButton tone="gold" busy={busy} onClick={() => void doAsk('claim')}>{t('rs.claim')}</ActionButton>
            </>
          ) : <Hint>{t('rs.nothing_to_claim')}</Hint>}
        </Panel>
      )}

      {(v.can_issue || v.can_policy) && !retired && (
        <>
          <Section>{t('rs.tools')}</Section>
          <Hint>{t('rs.tools_note', { h: formatNumber(v.delay_hours) })}</Hint>
          <CardGrid>
            {tools.filter((x) => x.show && !wind).map((x) => (
              <PCard key={x.key} icon={x.icon} title={t(`rs.act.${x.key}` as Key)} sub={t(`rs.act.${x.key}_sub` as Key)} tone={x.key === 'retire' ? 'danger' : 'busy'}
                onClick={() => { setPick(x.key); setAmt(''); setPrice('') }} />
            ))}
          </CardGrid>
          {v.can_policy && <Hint>{t('rs.limits', { cap: pct(v.cap_bps), floor: pct(v.floor_bps), buy: sup(v.buy_budget_sup), sell: units(v.sell_budget_units) })}</Hint>}
        </>
      )}

      <Section>{t('rs.log')}</Section>
      {(v.interventions ?? []).length === 0 && (v.withdrawals ?? []).length === 0 && <Hint>{t('rs.log_empty')}</Hint>}
      <div className="rs-log">
        {(v.interventions ?? []).map((i) => (
          <div key={i.id} className="rs-row">
            <b>{t(i.side === 'buy' ? 'rs.log_buy' : 'rs.log_sell', { n: units(i.units) })}</b>
            <span>{t(`rs.st.${i.status}` as Key)}{i.status === 'pending' && i.execute_after ? ` · ${t('rs.exec', { at: when(i.execute_after) })}` : ''}{i.refusal ? ` · ${i.refusal}` : ''}</span>
            {i.status === 'pending' && v.can_policy && <button type="button" className="dk-chip" disabled={busy} onClick={() => void simple({ action: 'cancel', id: i.id })}>{t('rs.cancel')}</button>}
          </div>
        ))}
        {(v.withdrawals ?? []).map((w) => (
          <div key={w.id} className="rs-row">
            <b>{t('rs.log_withdraw', { n: sup(w.sup) })}</b>
            <span>{t(`rs.st.${w.status}` as Key)}{w.status === 'pending' && w.execute_after ? ` · ${t('rs.exec', { at: when(w.execute_after) })}` : ''}</span>
            {w.status === 'pending' && v.can_policy && <button type="button" className="dk-chip" disabled={busy} onClick={() => void simple({ action: 'cancel', id: w.id })}>{t('rs.cancel')}</button>}
          </div>
        ))}
      </div>
      {back && <Btns ctx={ctx} list={[back]} />}

      {pick && !ask && (
        <Popup open onClose={() => setPick(null)} tone="gold" dismissible={!busy} title={t(`rs.act.${pick}` as Key)}
          footer={<ActionRow>
            <ActionButton tone="steel" small onClick={() => setPick(null)}>{t('building.no')}</ActionButton>
            <ActionButton tone="gold" busy={busy} disabled={pick !== 'retire' && !(parseNum(amt) >= 1)} onClick={() => void doAsk(pick)}>{t('rs.review')}</ActionButton>
          </ActionRow>}>
          <Note>{t(`rs.act.${pick}_help` as Key, { h: formatNumber(v.delay_hours), n: formatNumber(v.withdraw_notice_hours) })}</Note>
          {pick !== 'retire' && (
            <>
              <label className="fx-field"><span>{pick === 'issue' || pick === 'withdraw' ? t('rs.amount_sup') : t('rs.amount_units', { name: v.name })}</span>
                <input inputMode="numeric" dir="ltr" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0" /></label>
              <div className="fx-chips">{(v.presets ?? []).map((p) => <button key={p} type="button" className="dk-chip" onClick={() => setAmt(String(p))}>{formatNumber(p)}</button>)}</div>
            </>
          )}
          {(pick === 'buy' || pick === 'sell') && (
            <label className="fx-field"><span>{t('rs.price_opt')}</span><input inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('rs.price_ref')} /></label>
          )}
        </Popup>
      )}

      {ask && (
        <Popup open onClose={() => setAsk(null)} tone={ask.action === 'retire' ? 'red' : 'gold'} dismissible={!busy} title={t(`rs.act.${ask.action}` as Key)}
          footer={<ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)}>{t('building.no')}</ActionButton>
            {!ask.reason && <ActionButton tone={ask.action === 'retire' ? 'red' : 'gold'} busy={busy} onClick={() => void confirm()}>{t(ask.action === 'retire' ? 'rs.retire_yes' : 'rs.confirm')}</ActionButton>}
          </ActionRow>}>
          <StatGrid>
            {ask.amount > 0 && <StatCard icon="coins" palette="amber" label={t('rs.you_set')} value={ask.action === 'issue' || ask.action === 'withdraw' ? sup(ask.amount) : units(ask.amount)} />}
            {ask.out > 0 && <StatCard icon="coins" palette="gold" label={t('rs.you_get')} value={ask.action === 'claim' ? sup(ask.out) : ask.action === 'issue' ? units(ask.out) : sup(ask.out)} />}
          </StatGrid>
          {ask.execute_after && <Note>{t('rs.exec_note', { at: when(ask.execute_after), w: words(Math.max(0, (Date.parse(ask.execute_after) - Date.now()) / 1000)) })}</Note>}
          {ask.action === 'retire' && <Note tone="bad">{t('rs.retire_warn')}</Note>}
          {ask.action === 'claim' && <Note>{t('rs.claim_warn')}</Note>}
          {ask.reason && <Note tone="bad">{hasKey(`rs.reason.${ask.reason}`) ? t(`rs.reason.${ask.reason}` as Key) : t('rs.reason.other')}</Note>}
        </Popup>
      )}
    </Page>
  )
})
