// «باجهٔ تبدیل»: the village money desk. A resident of a settlement with its own money swaps SUP for it and back at the live rate,
// the desk keeps a small fee, and a confirm with price protection settles it in one step. The head sets the fee within the bounds.
// Reached from the money panel and from the purse pills; nothing converts silently anywhere else.

import { useCallback, useEffect, useState } from 'react'
import type { DeskView } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, Note, StatCard, StatGrid } from '../../ui/Popup'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { formatNumber } from '../native/kit/format'
import { t } from '../../i18n'
import * as api from '../../api/client'
import { useVillageCommand } from '../../village/useVillage'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, type FlowCtx } from './flow'

const pctOf = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(bps / 100)}٪`
const rateOf = (v: DeskView) => (v.x_ref_ppm > 0 ? (v.r0 * 1_000_000) / v.x_ref_ppm : 0)
const rateText = (v: DeskView) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(rateOf(v))
/** SUP exactly as it is paid at the desk: plain, never shown through the local-money formatter */
const sup = (n: number) => `${formatNumber(n)} ${t('unit.money')}`
const units = (n: number, v: { name: string }) => `${formatNumber(n)} ${v.name}`

/** The head's fee: the current fee and a stepper inside the bounds. A resident sees the fee only. */
export function FeeControl({ v, onChange }: { v: Pick<DeskView, 'fee_bps' | 'can_set_fee' | 'min_fee_bps' | 'max_fee_bps'>; onChange: (bps: number) => void }) {
  const cmd = useVillageCommand()
  const [busy, setBusy] = useState(false)
  const step = 10
  async function set(bps: number) {
    const b = Math.max(v.min_fee_bps, Math.min(v.max_fee_bps, bps))
    if (b === v.fee_bps) return
    setBusy(true)
    const r = await cmd('settlement.currency.fee', { bps: String(b) }, { write: true })
    setBusy(false)
    if (r.ok) onChange(b)
  }
  return (
    <div className="dk-fee">
      <span>{t('sm.desk.fee_now', { p: pctOf(v.fee_bps) })}</span>
      {v.can_set_fee && (
        <span className="dk-step" role="group" aria-label={t('sm.desk.fee_set')}>
          <button type="button" disabled={busy || v.fee_bps <= v.min_fee_bps} onClick={() => void set(v.fee_bps - step)} aria-label={t('sm.desk.fee_less')}>−</button>
          <b>{pctOf(v.fee_bps)}</b>
          <button type="button" disabled={busy || v.fee_bps >= v.max_fee_bps} onClick={() => void set(v.fee_bps + step)} aria-label={t('sm.desk.fee_more')}>+</button>
        </span>
      )}
    </div>
  )
}

/** The fee control on the money panel: reads the desk's menu once (the money view carries no fee). */
export function MoneyFee() {
  const [d, setD] = useState<DeskView | null>(null)
  const load = useCallback(async () => {
    try { const r = await api.runCommand('settlement.currency.desk', {}); if (r.ok && r.view) setD(r.view as unknown as DeskView) } catch { /* the panel just has no fee line */ }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!d) return null
  return (
    <div className="dk-panelfee">
      <Hint>{t('sm.desk.fee_hint')}</Hint>
      <FeeControl v={d} onChange={(b) => setD({ ...d, fee_bps: b })} />
    </div>
  )
}

function Side({ v, ctx, side }: { v: DeskView; ctx: FlowCtx; side: 'buy' | 'sell' }) {
  const buy = side === 'buy'
  const presets = (buy ? v.presets_sup : v.presets_units) ?? []
  const have = buy ? v.cash_sup : v.cash_units
  const can = buy ? v.can_buy : v.can_sell
  const show = (n: number) => (buy ? sup(n) : units(n, v))
  const go = (amount: number) => ctx.run('settlement.currency.desk', { side, amount: String(amount) })
  const why = !can ? (buy ? t('sm.desk.empty') : t('sm.desk.nothing_to_sell')) : have <= 0 ? t('sm.desk.no_funds') : ''
  return (
    <PCard icon="coin" tone={can ? 'busy' : 'off'} off={!can}
      title={buy ? t('sm.desk.buy', { name: v.name }) : t('sm.desk.sell', { name: v.name })}
      sub={buy ? t('sm.desk.you_hold_sup', { n: sup(have) }) : t('sm.desk.you_hold_units', { n: units(have, v) })}
      facts={why ? <span className="dk-why">{why}</span> : <span>{t('sm.desk.pick')}</span>}
      foot={can ? (
        <span className="dk-chips">
          {presets.map((n) => <button key={n} type="button" className="dk-chip" disabled={ctx.busy || n > have} onClick={() => go(n)}>{buy ? formatNumber(n) : formatNumber(n)}</button>)}
          <button type="button" className="dk-chip all" disabled={ctx.busy || have <= 0} onClick={() => go(have)} aria-label={show(have)}>{t('sm.desk.all')}</button>
        </span>
      ) : undefined} />
  )
}

export const Desk = flow<DeskView>(({ view: v, ctx }) => {
  const [fee, setFee] = useState(v.fee_bps)
  useEffect(() => setFee(v.fee_bps), [v.fee_bps])
  const back = ctx.acts.find(isBack)
  const ok = ctx.acts.find((a) => a.id === 'confirm')
  const buy = v.side === 'buy'
  if (v.stage === 'ask') {
    const pay = buy ? sup(v.amount) : units(v.amount, v)
    const get = buy ? units(v.units, v) : sup(v.sup)
    const feeText = buy ? sup(v.fee) : units(v.fee, v)
    const confirm = () => (ok ? ctx.go(ok) : ctx.run('settlement.currency.desk', { side: v.side, amount: String(v.amount), quote: String(buy ? v.units : v.sup), confirm: 'confirm' }))
    return (
      <Page title={t('sm.desk.title')} tone="gold">
        <Popup open onClose={() => back && ctx.go(back)} tone="gold" dismissible={!ctx.busy} title={buy ? t('sm.desk.buy', { name: v.name }) : t('sm.desk.sell', { name: v.name })}
          footer={<ActionRow>
            {back && <ActionButton tone="steel" small onClick={() => ctx.go(back)} disabled={ctx.busy}>{t('building.no')}</ActionButton>}
            <ActionButton tone="gold" busy={ctx.busy} onClick={confirm}>{t('sm.desk.confirm')}</ActionButton>
          </ActionRow>}>
          <StatGrid>
            <StatCard icon="coins" palette="amber" label={t('sm.desk.you_pay')} value={pay} />
            <StatCard icon="coins" palette="gold" label={t('sm.desk.you_get')} value={get} />
            <StatCard icon="box" palette="steel" label={t('sm.desk.fee_taken', { p: pctOf(v.fee_bps) })} value={feeText} />
            <StatCard icon="chart" palette="sapphire" label={t('sm.desk.rate')} value={t('sm.desk.rate_line', { rate: rateText(v), name: v.name })} />
          </StatGrid>
          <Note>{t('sm.desk.protect', { p: pctOf(v.slippage_bps) })}</Note>
        </Popup>
      </Page>
    )
  }
  if (v.stage === 'done') {
    return (
      <Page title={t('sm.desk.title')} tone="emerald">
        <Panel tone="emerald">
          <Lead tone="good">{buy ? t('sm.desk.done_buy', { get: units(v.units, v), pay: sup(v.amount) }) : t('sm.desk.done_sell', { get: sup(v.sup), pay: units(v.amount, v) })}</Lead>
          <Facts rows={[
            { label: t('sm.desk.fee_taken', { p: pctOf(v.fee_bps) }), value: buy ? sup(v.fee) : units(v.fee, v) },
            { label: t('sm.desk.left_sup'), value: sup(v.cash_sup) },
            { label: v.name, value: formatNumber(v.cash_units) },
          ]} />
        </Panel>
        <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a))} />
        <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
      </Page>
    )
  }
  return (
    <Page title={t('sm.desk.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('sm.desk.lead', { name: v.name })}</Lead>
        <Hint>{t('sm.desk.rate_live', { rate: rateText(v), name: v.name })}</Hint>
        <FeeControl v={{ ...v, fee_bps: fee }} onChange={setFee} />
      </Panel>
      {v.desk_units <= 0 && <Panel tone="ruby"><Lead tone="bad">{t('sm.desk.empty')}</Lead><Hint>{t('sm.desk.empty_hint')}</Hint></Panel>}
      <CardGrid>
        <Side v={v} ctx={ctx} side="buy" />
        <Side v={v} ctx={ctx} side="sell" />
      </CardGrid>
      <ActionButton tone="steel" small onClick={() => ctx.run('fx.book', {})}>{t('fx.market')}</ActionButton>
      <Hint>{t('sm.desk.desk_has', { u: units(v.desk_units, v), s: sup(v.desk_sup) })}</Hint>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})
