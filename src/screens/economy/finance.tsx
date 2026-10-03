// The national bank (loans, savings, insurance) and the gold dealer, drawn from the view and the
// actions of the answer (docs/adr/0039-presentation-split.md). A service the settlement does not
// offer arrives as `unavailable` and is drawn as the "not available here" card.

import type {
  FinanceHubView, FinanceRefusalView, GoldTradeView, GoldView, InsuranceView, InsureConfirmView, LoanConfirmView,
  LoanDetailView, LoanOfferView, LoanLine, PledgeLine, SavingsView,
} from '../../api/views.gen'
import { Card, ListRow, Notice, Ring, Stat, StatPair } from '../native/kit/Parts'
import { clamp01, formatNumber, money, pct } from '../native/kit/format'
import { ActionButton, ActionRow, CostSummary, Note } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { ConfirmPopup, Do, NotHere, PayFooter, Purses, byId, find, nameOf, payNote, rest } from './kit'
import { noticeLine } from './wording'
import { clockText, dateText } from './time'
import { CardGrid } from '../../ui/v6/panel'

const key = (k: string) => k as Key

/** A pledge as a line names it: a property by its number, type, city and value; a company by its name. */
export function pledgeName(ctx: FlowCtx, p: PledgeLine): string {
  if (p.code) return t('eco.pledge.company', { company: p.type.name })
  return t('eco.pledge.property', {
    no: formatNumber(p.no), type: nameOf(ctx, ['property_type'], p.type),
    city: ctx.names.name(['city'], p.city.code, p.city.name), value: money(p.value),
  })
}

/** A pledge's short name, for a row title: no value. */
function pledgeTitle(ctx: FlowCtx, p: PledgeLine): string {
  if (p.code) return t('eco.pledge.company', { company: p.type.name })
  return t('eco.pledge.property_short', { no: formatNumber(p.no), type: nameOf(ctx, ['property_type'], p.type), city: ctx.names.name(['city'], p.city.code, p.city.name) })
}

// -- the gold dealer -------------------------------------------------------------------------

const Gold = flow<GoldView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('eco.gold.title')} tone="gold" />
  const notice = noticeLine('gold', v.notice, v.notice_args)
  const move = v.prev > 0 ? (v.mid - v.prev) / v.prev : 0
  const options = v.options ?? []
  return (
    <Page title={t('eco.gold.title')} tone="gold">
      {notice && <Notice>{notice}</Notice>}
      <Card tone="gold">
        <StatPair
          left={<Stat icon="coins" palette="gold" label={t('eco.gold.buy_price')} value={money(v.buy)} />}
          right={<Stat icon="ring" palette="gold" label={t('eco.gold.sell_price')} value={money(v.sell)} />}
        />
        <div className="vh-hint" style={{ textAlign: 'center' }}>
          {t(move > 0 ? 'eco.gold.up' : move < 0 ? 'eco.gold.down' : 'eco.gold.flat', { p: pct(Math.abs(move)) })}
          {' · '}{t('eco.gold.stock', { n: formatNumber(v.stock) })}
          {v.next_at && <> · {t('eco.gold.next', { t: clockText(v.next_at) })}</>}
        </div>
      </Card>
      <Panel>
        <Facts rows={[
          { label: t('eco.gold.holding'), value: t('eco.gold.grams', { n: formatNumber(v.grams) }) },
          { label: t('eco.gold.value'), value: money(v.grams * v.sell), gold: true },
          { label: t('eco.gold.cost'), value: money(v.cost) },
        ]} />
      </Panel>
      <Panel>
        <Lead>{t('eco.gold.buy')}</Lead>
        <div className="vf-btns row">
          {options.map((g) => {
            const a = find(ctx, 'gold.buy', { grams: g })
            return a && <button key={g} className="bk-chip eco-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}><b>{t('eco.gold.grams', { n: formatNumber(g) })}</b><small>{money(g * v.buy)}</small></button>
          })}
        </div>
        {options.some((g) => g <= v.grams) && <Lead>{t('eco.gold.sell')}</Lead>}
        <div className="vf-btns row">
          {options.filter((g) => g <= v.grams).map((g) => {
            const a = find(ctx, 'gold.sell', { grams: g })
            return a && <button key={g} className="bk-chip eco-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}><b>{t('eco.gold.grams', { n: formatNumber(g) })}</b><small>{money(g * v.sell)}</small></button>
          })}
        </div>
      </Panel>
      {(v.history ?? []).length > 0 && (
        <Panel>
          <Lead>{t('eco.gold.history')}</Lead>
          <div className="vf-list">
            {(v.history ?? []).map((p, i) => <div key={i} className="vf-line"><span>{clockText(p.at)}</span><b>{money(p.price)}</b></div>)}
          </div>
        </Panel>
      )}
      <Btns ctx={ctx} list={rest(ctx, (a) => a.id === 'gold.buy' || a.id === 'gold.sell' || isBack(a))} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const GoldTrade = flow<GoldTradeView>(({ view: v, ctx }) => {
  const buying = v.side === 'buy'
  const sell = byId(ctx, 'gold.sell_yes')[0]
  return (
    <ConfirmPopup title={t(buying ? 'eco.gold.confirm_buy' : 'eco.gold.confirm_sell', { n: formatNumber(v.grams) })} ctx={ctx} tone="gold"
      footer={buying ? <PayFooter ctx={ctx} p={v.payment} bank={find(ctx, 'bank.show')} />
        : <ActionRow><ActionButton tone="green" disabled={ctx.busy} onClick={() => sell && ctx.go(sell)}>{sell ? ctx.label(sell) : t('common.confirm')}</ActionButton></ActionRow>}>
      <CostSummary
        lines={[{ label: t('eco.gold.amount'), amount: t('eco.gold.grams', { n: formatNumber(v.grams) }) }, { label: t('eco.gold.price_each'), amount: money(v.price) }]}
        total={{ amount: money(v.total) }} />
      {buying && <><Purses p={v.payment} />{payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}</>}
    </ConfirmPopup>
  )
})

// -- the national bank ---------------------------------------------------------------------

function band(score: number, min: number, max: number): string {
  const at = ((score - min) * 100) / Math.max(max - min, 1)
  return at < 30 ? 'poor' : at < 50 ? 'fair' : at < 70 ? 'good' : at < 85 ? 'very_good' : 'excellent'
}

function loanSub(l: LoanLine): string {
  if (l.status !== 'active') return t(key(`eco.loan.status.${l.status}`))
  return l.arrears > 0
    ? t('eco.loan.line_arrears', { next: money(l.next), owed: money(l.owed), arrears: formatNumber(l.arrears) })
    : t('eco.loan.line', { next: money(l.next), left: formatNumber(l.left), owed: money(l.owed) })
}

const FinanceHub = flow<FinanceHubView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('finance.title')} />
  const c = v.credit
  const span = Math.max(1, c.max - c.min)
  const notice = noticeLine('finance', v.notice, v.args)
  const products = (v.products ?? []).filter((p) => p.limit > 0)
  return (
    <Page title={t('finance.title')} tone="sapphire">
      {notice && <Notice>{notice}</Notice>}
      {v.lendable <= 0 && <Notice alert>{t('finance.no_lending')}</Notice>}
      <Card tone="sapphire">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring frac={clamp01((c.score - c.min) / span)} color="var(--sapphire)" size={84}>
            <span className="display" style={{ fontSize: 20, color: '#fff' }}>{formatNumber(c.score)}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t('finance.credit')}</span>
          </Ring>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {t(key(`eco.credit.band.${band(c.score, c.min, c.max)}`))}
            <div style={{ marginTop: 4 }}>{t('finance.policy_rate', { p: pct(v.policy_bps / 10000) })}</div>
            {c.missed > 0 && <div style={{ marginTop: 4 }}>{t('finance.missed', { n: formatNumber(c.missed) })}</div>}
            {c.defaults > 0 && <div style={{ marginTop: 4, color: 'var(--anar)' }}>{t('finance.defaults', { n: formatNumber(c.defaults) })}</div>}
          </div>
        </div>
      </Card>

      {products.length > 0 && (
        <CardGrid>
          <div className="nx-sec">{t('eco.loan.products')}</div>
          {products.map((p) => (
            <ListRow key={p.product.code} icon="bank" palette="sapphire" title={nameOf(ctx, ['loan_product'], p.product)}
              sub={t('finance.product_sub', { p: pct(p.rate_bps / 10000), limit: money(p.limit) })}
              onClick={() => { const a = find(ctx, 'finance.product', { product: p.product.code }); if (a) ctx.go(a) }} />
          ))}
        </CardGrid>
      )}
      {(v.loans ?? []).length > 0 && (
        <CardGrid>
          <div className="nx-sec">{t('finance.my_loans')}</div>
          {(v.loans ?? []).map((l) => (
            <ListRow key={l.no} icon={l.arrears ? 'x_wanted' : 'money'} palette={l.status !== 'active' ? 'steel' : l.arrears ? 'ruby' : 'emerald'}
              tone={l.arrears ? 'ruby' : undefined} title={nameOf(ctx, ['loan_product'], l.product)} sub={loanSub(l)}
              onClick={() => { const a = find(ctx, 'finance.loan', { no: l.no }); if (a) ctx.go(a) }} />
          ))}
          {v.next_at && <Hint>{t('eco.loan.next_due', { t: clockText(v.next_at) })}</Hint>}
        </CardGrid>
      )}
      <Hint>{t('finance.deposit', { n: money(v.savings), p: pct(v.savings_bps / 10000) })}</Hint>
      <CardGrid>
        {byId(ctx, 'finance.savings', 'finance.insurance', 'finance.exchange', 'finance.gold', 'finance.portfolio').map((a) => (
          <ListRow key={a.id} icon={a.id === 'finance.insurance' ? 'shield' : a.id === 'finance.savings' ? 'bank' : a.id === 'finance.gold' ? 'ring' : 'chart'}
            palette="sapphire" title={ctx.label(a)} onClick={() => ctx.go(a)} />
        ))}
      </CardGrid>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const LoanOffer = flow<LoanOfferView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('eco.loan.title_plain')} />
  const pledges = v.pledges ?? []
  const options = v.options ?? []
  return (
    <Page title={nameOf(ctx, ['loan_product'], v.product)} tone="sapphire">
      <Panel tone="sapphire">
        <Lead>{t(key(`eco.loan.kind.${v.kind}`))}</Lead>
        <Facts rows={[
          { label: t('eco.loan.rate'), value: pct(v.rate_bps / 10000) },
          { label: t('eco.loan.late_fee'), value: pct(v.late_fee_bps / 10000) },
          { label: t('eco.loan.default_after'), value: t('eco.loan.instalments', { n: formatNumber(v.default_after) }) },
        ]} />
        {v.pledge && <Hint>{t('eco.loan.pledged', { pledge: pledgeName(ctx, v.pledge) })}</Hint>}
      </Panel>
      {pledges.length > 0 && !v.pledge && (
        <Panel>
          <Lead>{t(key(`eco.loan.choose_pledge.${v.kind}`))}</Lead>
          <CardGrid>
          {pledges.map((p) => {
            const a = find(ctx, 'finance.pledge', { pledge: p.code || p.no })
            return <ListRow key={p.code || p.no} icon="house" palette="sapphire" title={pledgeTitle(ctx, p)} sub={p.code ? t('eco.loan.secures', { n: money(p.limit) }) : `${t('eco.pledge.worth', { n: money(p.value) })} · ${t('eco.loan.secures', { n: money(p.limit) })}`} onClick={() => a && ctx.go(a)} />
          })}
          </CardGrid>
        </Panel>
      )}
      {!(pledges.length > 0 && !v.pledge) && (
        options.length === 0 ? <Panel><Hint>{t('eco.loan.nothing')}</Hint></Panel> : (
          <Panel>
            <Lead>{t('eco.loan.limit', { n: money(v.limit) })}</Lead>
            <CardGrid>
            {options.map((o) => {
              const a = find(ctx, 'finance.option', { amount: o.amount, term: o.term })
              return <ListRow key={`${o.amount}-${o.term}`} icon="money" palette="emerald" title={money(o.amount)}
                sub={t('eco.loan.option_sub', { term: formatNumber(o.term), instalment: money(o.instalment) })} onClick={() => a && ctx.go(a)} />
            })}
            </CardGrid>
          </Panel>
        )
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const LoanConfirm = flow<LoanConfirmView>(({ view: v, ctx }) => {
  const take = byId(ctx, 'finance.take')[0]
  return (
    <ConfirmPopup title={t('eco.loan.confirm_title', { product: nameOf(ctx, ['loan_product'], v.product) })} ctx={ctx} tone="gold"
      footer={<ActionRow><ActionButton tone="green" disabled={ctx.busy} onClick={() => take && ctx.go(take)}>{t('eco.loan.take', { n: money(v.amount) })}</ActionButton></ActionRow>}>
      <CostSummary
        lines={[
          { label: t('eco.loan.amount'), amount: money(v.amount) },
          { label: t('eco.loan.interest', { p: pct(v.rate_bps / 10000) }), amount: money(v.interest) },
          { label: t('eco.loan.instalment', { n: formatNumber(v.term) }), amount: money(v.instalment) },
        ]}
        total={{ label: t('eco.loan.total'), amount: money(v.total) }} />
      <Hint>{t('eco.loan.first', { t: dateText(v.first_at) })}</Hint>
      {v.pledge && <Hint>{t('eco.loan.pledged', { pledge: pledgeName(ctx, v.pledge) })}</Hint>}
      <Note tone="bad">{t('eco.loan.warning')}</Note>
    </ConfirmPopup>
  )
})

const LoanDetail = flow<LoanDetailView>(({ view: v, ctx }) => {
  const l = v.loan
  const notice = noticeLine('finance', v.notice, v.notice_args)
  const payoff = byId(ctx, 'finance.payoff', 'finance.payoff_yes')[0]
  return (
    <Page title={t('eco.loan.detail_title', { no: formatNumber(l.no), product: nameOf(ctx, ['loan_product'], l.product) })} tone="sapphire">
      {notice && <Notice>{notice}</Notice>}
      <Panel tone="sapphire">
        <Facts rows={[
          { label: t('eco.loan.principal'), value: money(v.principal) },
          { label: t('eco.loan.interest', { p: pct(v.rate_bps / 10000) }), value: money(v.interest) },
          { label: t('eco.loan.opened'), value: dateText(v.opened_at) },
          { label: t('eco.loan.progress'), value: t('eco.loan.progress_of', { paid: formatNumber(v.paid), n: formatNumber(v.periods), missed: formatNumber(v.missed) }) },
        ]} />
        {v.pledge && <Hint>{t('eco.loan.pledged', { pledge: pledgeName(ctx, v.pledge) })}</Hint>}
        {l.status === 'active' && (
          <>
            <Facts rows={[
              { label: t('eco.loan.owed'), value: money(l.owed), gold: true },
              { label: t('eco.loan.next'), value: money(l.next) },
            ]} />
            {(l.arrears > 0 || v.fees_due > 0) && <Lead tone="bad">{t('eco.loan.arrears', { n: formatNumber(l.arrears), fees: money(v.fees_due) })}</Lead>}
            {v.next_at && <Hint>{t('eco.loan.next_due', { t: clockText(v.next_at) })}</Hint>}
          </>
        )}
        {l.status === 'defaulted' && <Lead tone="bad">{t('eco.loan.defaulted', { recovered: money(v.recovered), lost: money(v.written_off) })}</Lead>}
        {l.status === 'repaid' && <Lead tone="good">{t('eco.loan.repaid')}</Lead>}
        {v.confirm_open && <Lead tone="bad">{t('eco.loan.payoff_confirm', { n: money(v.payoff) })}</Lead>}
      </Panel>
      {payoff && l.status === 'active' && v.payoff > 0 && (
        <Do ctx={ctx} a={payoff} tone={v.confirm_open ? 'green' : 'gold'} label={t(v.confirm_open ? 'eco.loan.payoff_yes' : 'eco.loan.payoff', { n: money(v.payoff) })} />
      )}
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- savings and insurance ----------------------------------------------------------------

const Savings = flow<SavingsView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('eco.savings.title')} />
  const notice = noticeLine('finance', v.notice, v.notice_args)
  const typedIn = byId(ctx, 'savings.deposit_custom')[0]
  const typedOut = byId(ctx, 'savings.withdraw_custom')[0]
  return (
    <Page title={t('eco.savings.title')} tone="sapphire">
      {notice && <Notice>{notice}</Notice>}
      <Card tone="sapphire">
        <StatPair
          left={<Stat icon="bank" palette="sapphire" label={t('eco.savings.balance')} value={money(v.balance)} />}
          right={<Stat icon="coins" palette="gold" label={t('eco.savings.bank')} value={money(v.bank)} />}
        />
      </Card>
      <Panel>
        <Facts rows={[
          { label: t('eco.savings.rate'), value: pct(v.rate_bps / 10000) },
          { label: t('eco.savings.earned'), value: money(v.earned) },
          { label: t('eco.savings.next'), value: money(v.next) },
        ]} />
        <Hint>{t('eco.savings.hint')}</Hint>
        {v.next_at && <Hint>{t('eco.savings.next_at', { t: clockText(v.next_at) })}</Hint>}
      </Panel>
      <Panel>
        <Lead>{t('eco.savings.put')}</Lead>
        <div className="vf-btns row">
          {(v.deposits ?? []).map((n) => { const a = find(ctx, 'savings.deposit', { amount: n }); return a && <button key={n} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{money(n)}</button> })}
          {typedIn && <button className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(typedIn)}>{ctx.label(typedIn)}</button>}
        </div>
        <Lead>{t('eco.savings.take')}</Lead>
        <div className="vf-btns row">
          {(v.withdrawals ?? []).map((n) => { const a = find(ctx, 'savings.withdraw', { amount: n }); return a && <button key={n} className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(a)}>{money(n)}</button> })}
          {typedOut && <button className="bk-chip" disabled={ctx.busy} onClick={() => ctx.go(typedOut)}>{ctx.label(typedOut)}</button>}
        </div>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const Insurance = flow<InsuranceView>(({ view: v, ctx }) => {
  if (v.unavailable) return <NotHere u={v.unavailable} ctx={ctx} title={t('eco.insurance.title_plain')} />
  const notice = noticeLine('finance', v.notice, v.notice_args)
  const country = ctx.names.name(['country', 'city'], v.country.code, v.country.name)
  return (
    <Page title={t('eco.insurance.title', { country })} tone="sapphire">
      {notice && <Notice>{notice}</Notice>}
      <Panel tone="sapphire"><Facts rows={[{ label: t('eco.insurance.fund'), value: money(v.fund), gold: true }]} /></Panel>
      {(v.products ?? []).map((p) => {
        const name = nameOf(ctx, ['insurance_product'], p.product)
        const kind = hasKey(`eco.insurance.covers.${p.covers}`) ? t(key(`eco.insurance.covers.${p.covers}`)) : ''
        const buys = p.covers === 'war_damage'
          ? (p.targets ?? []).map((tg) => ({ a: find(ctx, 'insurance.insure_property', { product: p.product.code, property: tg.no }), tg }))
          : p.held ? [] : [{ a: find(ctx, 'insurance.insure', { product: p.product.code }), tg: null as PledgeLine | null }]
        return (
          <Panel key={p.product.code}>
            <Lead>{name}</Lead>
            <Hint>{kind}</Hint>
            <Facts rows={[
              { label: t('eco.insurance.premium'), value: p.prem_bps > 0 ? t('eco.insurance.premium_valued', { fixed: money(p.premium), p: pct(p.prem_bps / 10000) }) : money(p.premium) },
              { label: t('eco.insurance.cover'), value: pct(p.cover_bps / 10000) },
              { label: t('eco.insurance.max'), value: money(p.max_claim) },
              { label: t('eco.insurance.wait'), value: durationText(p.waiting_seconds) },
            ]} />
            {buys.map(({ a, tg }, i) => a && (
              <Do key={i} ctx={ctx} a={a} tone="gold" label={tg ? t('eco.insurance.insure_for', { pledge: pledgeName(ctx, tg) }) : t('eco.insurance.insure', { name })} />
            ))}
            {p.held && <Hint tone="good">{t('eco.insurance.held')}</Hint>}
          </Panel>
        )
      })}
      {(v.policies ?? []).length > 0 && (
        <Panel>
          <Lead>{t('eco.insurance.mine')}</Lead>
          {(v.policies ?? []).map((p) => (
            <div key={p.no} className="vf-need">
              <div className="vf-need-head">
                <span>{t('eco.insurance.policy', { no: formatNumber(p.no), product: nameOf(ctx, ['insurance_product'], p.product) })}</span>
                <b>{p.status === 'active' ? (p.claimable ? t('eco.insurance.active') : t('eco.insurance.waiting', { t: clockText(p.from) })) : t(key(`eco.insurance.ended.${p.reason || 'cancelled'}`))}</b>
              </div>
              <Hint>{t('eco.insurance.policy_sub', { premium: money(p.premium), paid: money(p.paid) })}{p.property ? ` · ${pledgeName(ctx, p.property)}` : ''}</Hint>
              {p.status === 'active' && !v.cancel && (() => { const a = find(ctx, 'insurance.cancel', { no: p.no }); return a ? <Btns ctx={ctx} list={[a]} tone="red" /> : null })()}
            </div>
          ))}
        </Panel>
      )}
      {v.cancel && (
        <Panel tone="ruby">
          <Lead tone="bad">{t('eco.insurance.cancel_confirm', { no: formatNumber(v.cancel.no), product: nameOf(ctx, ['insurance_product'], v.cancel.product) })}</Lead>
          <Btns ctx={ctx} list={byId(ctx, 'insurance.cancel_yes')} tone="red" />
        </Panel>
      )}
      <Hint>{t('eco.insurance.hint')}</Hint>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const InsureConfirm = flow<InsureConfirmView>(({ view: v, ctx }) => (
  <ConfirmPopup title={t('eco.insurance.confirm_title', { product: nameOf(ctx, ['insurance_product'], v.product) })} ctx={ctx} tone="gold"
    footer={<PayFooter ctx={ctx} p={v.payment} bank={find(ctx, 'bank.show')} />}>
    <CostSummary
      lines={[
        { label: t('eco.insurance.cover'), amount: pct(v.cover_bps / 10000) },
        { label: t('eco.insurance.max'), amount: money(v.max_claim) },
        { label: t('eco.insurance.wait'), amount: durationText(v.waiting_seconds) },
      ]}
      total={{ label: t('eco.insurance.premium'), amount: money(v.premium) }} />
    {v.property && <Hint>{t('eco.insurance.for', { pledge: pledgeName(ctx, v.property) })}</Hint>}
    <Hint>{t('eco.insurance.every_period')}</Hint>
    <Purses p={v.payment} />
    {payNote(v.payment) && <Hint>{payNote(v.payment)}</Hint>}
  </ConfirmPopup>
))

// -- a refused request -------------------------------------------------------------------------

const FinanceRefusal = flow<FinanceRefusalView>(({ view: v, ctx }) => {
  const k = `eco.finance.refused.${v.kind}`
  return (
    <Page title={t('eco.refused.title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{hasKey(k) ? t(key(k), { amount: money(v.amount), score: formatNumber(v.score), count: formatNumber(v.count), wait: durationText(v.wait_seconds) }) : t('refusal.unknown')}</Lead>
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({
  gold: Gold, gold_trade: GoldTrade, finance_hub: FinanceHub, loan_offer: LoanOffer, loan_confirm: LoanConfirm,
  loan_detail: LoanDetail, savings: Savings, insurance: Insurance, insure_confirm: InsureConfirm, finance_refusal: FinanceRefusal,
})

/** The screens this file draws. */
export const FINANCE_SCREENS = [
  'gold', 'gold_trade', 'finance_hub', 'loan_offer', 'loan_confirm', 'loan_detail', 'savings', 'insurance', 'insure_confirm', 'finance_refusal',
]
