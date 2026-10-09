// «بازرگان» (ADR 0049, the market day): once a local day a travelling trader buys the surplus of the goods the head put on sale, if the barter
// post stands with its clerk and the treasury can pay him. The desk shows each good (stock, the trader's price, the head's keep amount and on/off),
// what the trader can take today, why a market day stopped and how to fix it, and the last market day. Order controls need `trade.export`.

import { useState } from 'react'
import type { TradeDeskView, TradeItemLine } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, Note, Section } from '../../ui/Popup'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { formatNumber, money, splitMoney } from '../native/kit/format'
import { rich } from '../../ui/v6/rich'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'
import { useVillageCommand } from '../../village/useVillage'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack } from './flow'

const short1 = (s: string) => splitMoney(s)?.[0] ?? s
const pct = (bps: number) => `⁦${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(bps / 100)}٪⁩`

function ItemCard({ it, v, name, busy, onAct }: { it: TradeItemLine; v: TradeDeskView; name: string; busy: boolean; onAct: (action: 'keep' | 'off', code: string, n?: number) => void }) {
  const [keep, setKeep] = useState(it.on ? it.keep : Math.max(0, Math.min(it.stock, v.keep_presets?.[1] ?? 0)))
  const step = Math.max(1, Math.round(((v.keep_presets ?? [10])[0] || 10) / 2))
  return (
    <PCard icon="crate" title={name} tone={it.on ? 'good' : 'busy'}
      sub={t('tr.stock', { n: formatNumber(it.stock) })}
      badge={it.on ? t('tr.on') : undefined}
      facts={(
        <span className="tr-facts">
          <b className="tr-price">{rich(money(it.unit))}</b>
          <small>{t('tr.ref', { p: short1(money(it.reference)), c: pct(v.price_bps) })}</small>
          {it.on && <b className={it.surplus > 0 ? 'good' : ''}>{it.surplus > 0 ? t('tr.surplus', { n: formatNumber(it.surplus) }) : t('tr.no_surplus')}</b>}
        </span>
      )}
      foot={v.may_order ? (
        <span className="tr-ctl">
          <span className="dk-step" role="group" aria-label={t('tr.keep')}>
            <button type="button" disabled={busy || keep <= 0} onClick={() => setKeep(Math.max(0, keep - step))} aria-label={t('sm.desk.fee_less')}>−</button>
            <b><span className="tr-lbl">{t('tr.keep')}</span> {formatNumber(keep)}</b>
            <button type="button" disabled={busy} onClick={() => setKeep(keep + step)} aria-label={t('sm.desk.fee_more')}>+</button>
          </span>
          <span className="dk-chips">
            {(v.keep_presets ?? []).map((p) => <button key={p} type="button" className="dk-chip" onClick={() => setKeep(p)}>{formatNumber(p)}</button>)}
          </span>
          <span className="dk-chips">
            <button type="button" className="dk-chip all" disabled={busy || !v.has_post} onClick={() => onAct('keep', it.item.code, keep)}>{it.on ? t('tr.update') : t('tr.sell')}</button>
            {it.on && <button type="button" className="dk-chip" disabled={busy} onClick={() => onAct('off', it.item.code)}>{t('tr.stop')}</button>}
          </span>
        </span>
      ) : it.on ? <span className="rd-notes">{t('tr.kept', { n: formatNumber(it.keep) })}</span> : undefined} />
  )
}

/** What the server will add: the next visit and the clerk's seat (`next_at`, `clerk {seat, filled, wage}`); a clean slot that lights up when they arrive. */
type TradeX = TradeDeskView & { next_at?: string | null; clerk?: { seat: string; filled: boolean; wage: number } | null }

export const TradeDesk = flow<TradeDeskView>(({ view: v0, ctx }) => {
  const cmd = useVillageCommand()
  const [v, setV] = useState(v0)
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState<{ action: 'keep' | 'off'; code: string; n?: number } | null>(null)
  const back = ctx.acts.find(isBack)
  const nameOf = (i: { code: string; name: string }) => ctx.names.name(['component', 'item'], i.code, i.name)

  async function confirm() {
    if (!ask) return
    setBusy(true)
    const r = await cmd('settlement.trade', { action: ask.action, code: ask.code, ...(ask.n !== undefined ? { n: String(ask.n) } : {}) }, { write: true })
    setBusy(false); setAsk(null)
    if (r.ok && r.res?.view) setV(r.res.view as unknown as TradeDeskView)
  }
  const last = v.last
  const stop = last && last.outcome !== 'sold' ? last.outcome : ''
  const items = v.items ?? []
  const asked = ask ? items.find((i) => i.item.code === ask.code) : null

  if (!v.has_post) {
    return (
      <Page title={t('tr.title')} tone="gold">
        <Panel tone="gold">
          <Lead>{t('tr.no_post')}</Lead>
          <Note tone="bad">{t('tr.not_here')}</Note>
          <Hint>{t('tr.no_post_fix')}</Hint>
          <ActionButton tone="gold" small onClick={() => ctx.openLocal('village_home', { build: '1' })}>{t('ug.fix.build')}</ActionButton>
        </Panel>
        {back && <Btns ctx={ctx} list={[back]} />}
      </Page>
    )
  }
  return (
    <Page title={t('tr.title')} tone="gold">
      <Panel tone="gold">
        <Lead>{t('tr.lead')}</Lead>
        <Facts rows={[
          { label: t('tr.when'), value: (v as TradeX).next_at ? atText((v as TradeX).next_at) : t('tr.when_v') },
          { label: t('tr.cap'), value: t('tr.cap_v', { n: formatNumber(v.cap) }) },
          { label: t('tr.prospect'), value: t('tr.prospect_v', { n: formatNumber(v.prospect) }) },
          { label: t('tr.price'), value: t('tr.price_v', { p: pct(v.price_bps) }) },
        ]} />
        {!v.may_order && <Hint>{t('tr.read_only')}</Hint>}
      </Panel>

      {(v as TradeX).clerk && (
        <CardGrid><PCard icon="people" tone={(v as TradeX).clerk!.filled ? 'good' : 'off'} off={!(v as TradeX).clerk!.filled} title={t('tr.clerk')} sub={(v as TradeX).clerk!.filled ? t('tr.clerk_in') : t('tr.clerk_empty')}
          facts={t('tr.clerk_wage', { w: money((v as TradeX).clerk!.wage) })}
          foot={!(v as TradeX).clerk!.filled ? <button type="button" className="dk-chip all" onClick={() => ctx.run('settlement.labor.board', {})}>{t('tr.fix_board')}</button> : undefined} /></CardGrid>
      )}
      {stop && (
        <Panel tone="ruby">
          <Lead tone="bad">{t('tr.stopped')}</Lead>
          <Note tone="bad">{hasKey(`tr.out.${stop}`) ? t(`tr.out.${stop}` as Key) : t('tr.out.other')}</Note>
          <Hint>{hasKey(`tr.fix.${stop}`) ? t(`tr.fix.${stop}` as Key) : ''}</Hint>
          {stop === 'no_wage' && <ActionButton tone="gold" small onClick={() => ctx.openLocal('village_overview')}>{t('ug.fix.treasury')}</ActionButton>}
          {stop === 'no_clerk' && <ActionButton tone="gold" small onClick={() => ctx.run('settlement.labor.board', {})}>{t('tr.fix_board')}</ActionButton>}
        </Panel>
      )}

      <Section>{t('tr.goods')}</Section>
      {!items.some((i) => i.on) && <Hint>{t('tr.none_on')}</Hint>}
      <CardGrid>
        {items.map((i) => <ItemCard key={i.item.code} it={i} v={v} name={nameOf(i.item)} busy={busy} onAct={(a, c, n) => setAsk({ action: a, code: c, n })} />)}
      </CardGrid>

      <Section>{t('tr.last')}</Section>
      {!last ? <Hint>{t('tr.last_none')}</Hint> : (
        <Panel tone={last.outcome === 'sold' ? 'emerald' : undefined}>
          <Lead tone={last.outcome === 'sold' ? 'good' : undefined}>{last.at ? atText(last.at) : ''} · {hasKey(`tr.out.${last.outcome}`) ? t(`tr.out.${last.outcome}` as Key) : last.outcome}</Lead>
          {(last.lines ?? []).length > 0 && (
            <div className="vf-list">{(last.lines ?? []).map((l) => <div key={l.item.code} className="vf-line"><span>{nameOf(l.item)} × {formatNumber(l.qty)}</span><b>{t('tr.at_unit', { p: money(l.unit) })}</b></div>)}</div>
          )}
          <Facts rows={[
            { label: t('tr.gross'), value: money(last.gross) },
            { label: t('tr.wage'), value: money(last.wage) },
            { label: t('tr.net'), value: money(last.gross - last.wage), gold: true },
          ]} />
        </Panel>
      )}

      {ask && (
        <Popup open onClose={() => setAsk(null)} tone="gold" dismissible={!busy} title={ask.action === 'keep' ? t('tr.confirm_sell') : t('tr.confirm_stop')}
          footer={<ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)}>{t('building.no')}</ActionButton>
            <ActionButton tone="gold" busy={busy} onClick={() => void confirm()}>{t('building.yes')}</ActionButton>
          </ActionRow>}>
          {asked && <Note>{ask.action === 'keep' ? t('tr.confirm_sell_body', { name: nameOf(asked.item), keep: formatNumber(ask.n ?? 0), price: money(asked.unit) }) : t('tr.confirm_stop_body', { name: nameOf(asked.item) })}</Note>}
          {ask.action === 'keep' && <Note>{t('tr.confirm_note', { w: money(0) })}</Note>}
        </Popup>
      )}
      {back && <Btns ctx={ctx} list={[back]} />}
    </Page>
  )
})
