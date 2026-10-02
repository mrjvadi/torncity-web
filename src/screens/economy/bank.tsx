// The bank, paying another player and the city budget, drawn from the view and the actions of the
// answer (docs/adr/0039-presentation-split.md). The words are this client's (src/i18n/ui.src.txt);
// content names come from the catalogue. The bank keeps the prototype's look: the balance banner, the
// deposit/withdraw tabs, an amount with quick chips, one big submit.

import { useEffect, useState } from 'react'
import type {
  BankView, BudgetView, PayConfirmView, PayHelpView, PaySentView, PayView, PaymentDeclinedView,
} from '../../api/views.gen'
import { Card, ListRow, Notice, Stat, StatPair } from '../native/kit/Parts'
import { formatNumber, money, pct } from '../native/kit/format'
import { toWesternDigits } from '../../lib/persian'
import { ActionButton, ActionRow, CostSummary, Note } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, isRefresh, registerFlow, type FlowCtx } from '../village/flow'
import { durationText } from '../village/common'
import { ConfirmPopup, byId, find, rest } from './kit'
import { noticeLine } from './wording'
import '../native/bank.css'
import { useSession } from '../../state/SessionContext'
import { usePending, useStoreView, primaryWallet } from '../../state/useSync'
import { setOptimisticHint } from '../../state/optimistic'

const key = (k: string) => k as Key
const MAX_DIGITS = 12

// -- the bank ---------------------------------------------------------------------------------

const Bank = flow<BankView>(({ view: v, ctx }) => {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [digits, setDigits] = useState('')
  // state sync: the balance is the store's — live, and at once after a
  // deposit or a withdrawal (an optimistic overlay until it is confirmed)
  const { synced } = useSession()
  const wallet = primaryWallet(useStoreView())
  const pending = usePending('wallet', synced ? wallet?.currency : undefined)
  useEffect(() => { setOptimisticHint('bank.withdraw', { fee_bps: v.withdrawal_fee_bps ?? 0 }) }, [v.withdrawal_fee_bps])
  const cash = synced && wallet ? wallet.cash : v.cash
  const bank = synced && wallet ? wallet.bank : v.bank
  const feeBps = mode === 'withdraw' ? v.withdrawal_fee_bps : 0
  const amount = Number(digits || '0')
  const source = mode === 'deposit' ? cash : bank
  const fee = Math.floor((amount * feeBps) / 10000)
  const over = amount > source
  const closed = v.travelling || v.no_city
  const locked = closed || (mode === 'deposit' ? !v.can_deposit : !v.can_withdraw || v.jailed)
  const ready = amount > 0 && !over && !locked
  const typed = byId(ctx, mode === 'deposit' ? 'bank.deposit_custom' : 'bank.withdraw_custom')[0]
  const options = (mode === 'deposit' ? v.deposits : v.withdrawals) ?? []
  const notice = noticeLine('bank', v.notice, v.notice_args)

  const after = mode === 'deposit'
    ? t('bank.after_deposit', { cash: formatNumber(cash), a: formatNumber(cash - amount), b: formatNumber(bank + amount) })
    : t('bank.after_withdraw', { cash: formatNumber(cash), a: formatNumber(cash + amount - fee), b: formatNumber(bank - amount) })

  function submit() {
    if (!ready || !typed) return
    ctx.go({ ...typed, args: { ...(typed.args ?? {}), amount: String(amount) } })
    setDigits('')
  }

  return (
    <Page title={t('bank.title')} tone="sapphire">
      {notice && <Notice>{notice}</Notice>}
      {v.travelling && <Notice alert>{t('bank.travelling')}</Notice>}
      {v.no_city && !v.travelling && <Notice alert>{t('eco.bank.no_city')}</Notice>}
      {v.jailed && <Notice alert>{t('bank.jailed')}</Notice>}

      <Card tone="sapphire" className={pending ? 'sync-pending' : undefined}>
        <StatPair
          left={<Stat icon="coins" palette="gold" label={t('bank.cash')} value={money(cash)} />}
          right={<Stat icon="bank" palette="sapphire" label={t('bank.balance')} value={money(bank)} />}
        />
        {v.city && !closed && <div className="bk-branch">{t('bank.branch', { city: ctx.names.name(['city'], v.city_code, v.city) })}</div>}
      </Card>

      {!closed && (
        <>
          <div className="bk-tabs" role="tablist">
            {(['deposit', 'withdraw'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={`bk-tab display${mode === m ? ' on' : ''}`}
                onClick={() => { setMode(m); setDigits('') }}>
                {t(m === 'deposit' ? 'bank.deposit_tab' : 'bank.withdraw_tab')}
              </button>
            ))}
          </div>

          <label className={`bk-amount${over ? ' over' : ''}`}>
            <input
              className="bk-input display" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="0"
              value={digits ? formatNumber(amount) : ''}
              onChange={(e) => setDigits(toWesternDigits(e.target.value).replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS))}
            />
            <span className="bk-amount-unit">{t('unit.money')}</span>
          </label>
          <div className="bk-hint">{over ? t('bank.too_much') : after}</div>

          <div className="bk-quick">
            {options.map((o, i) => (
              <button key={i} className="bk-chip" onClick={() => setDigits(String(Math.min(source, o.amount)))}>
                {o.all ? t('bank.all') : `+${formatNumber(o.amount)}`}
              </button>
            ))}
          </div>

          <button className="bk-submit" disabled={!ready || ctx.busy} onClick={submit}>
            <span className="bk-fee">{feeBps ? t('bank.fee_pct', { p: pct(feeBps / 10000) }) : t('bank.no_fee')}</span>
            <span className="bk-submit-text display">
              {amount > 0 ? t(mode === 'deposit' ? 'bank.submit_deposit' : 'bank.submit_withdraw', { n: money(amount) }) : t('bank.enter_amount')}
            </span>
          </button>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {byId(ctx, 'bank.pay', 'bank.finance').map((a) => (
          <ListRow key={a.id} icon={a.id === 'bank.pay' ? 'coins' : 'bank'} palette={a.id === 'bank.pay' ? 'gold' : 'sapphire'}
            title={ctx.label(a)} sub={t(a.id === 'bank.pay' ? 'eco.bank.pay_sub' : 'eco.bank.finance_sub')} onClick={() => ctx.go(a)} />
        ))}
      </div>
    </Page>
  )
})

// -- paying a player -------------------------------------------------------------------------

const PayHelp = flow<PayHelpView>(({ ctx }) => (
  <Page title={t('eco.pay.title_plain')} tone="gold">
    <Panel tone="gold">
      <Lead>{t('eco.pay.help')}</Lead>
      <Hint>{t('eco.pay.help_cash')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={rest(ctx, () => false)} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

const PayScreen = flow<PayView>(({ view: v, ctx }) => {
  const notice = noticeLine('pay', v.notice, v.notice_args, v.payee_name)
  const who = v.payee_name || t('eco.someone')
  const cashActs = byId(ctx, 'pay.cash', 'pay.cash_all')
  const cardActs = byId(ctx, 'pay.card', 'pay.card_all')
  const cashOwn = find(ctx, 'pay.cash_custom')
  const cardOwn = find(ctx, 'pay.card_custom')
  const city = v.payer_city ? ctx.names.name(['city'], v.payer_city_code, v.payer_city) : ''
  const where = v.together ? t('eco.pay.together', { city: ctx.names.name(['city'], v.city_code, v.city) }) : t('eco.pay.apart')
  const cannot = !v.can_card && !(v.together && v.can_cash)
  return (
    <Page title={t('eco.pay.title', { player: who })} tone="gold">
      {notice && <Notice alert>{notice}</Notice>}
      <Panel tone="gold">
        <Facts rows={[
          ...(v.payee_code ? [{ label: t('eco.pay.code'), value: <span dir="ltr">{v.payee_code}</span> }] : []),
          { label: t('eco.pay.cash'), value: money(v.cash) },
          { label: t('eco.pay.bank'), value: money(v.bank) },
        ]} />
        <Hint>{where}</Hint>
        {city && <Hint>{v.card_fee_bps > 0 ? t('eco.pay.card_fee', { city, p: pct(v.card_fee_bps / 10000) }) : t('eco.pay.card_free', { city })}</Hint>}
      </Panel>
      {v.together && v.can_cash && (
        <Panel>
          <Lead>{t('eco.pay.by_cash')}</Lead>
          <Btns ctx={ctx} list={cashActs} row tone="green" />
          {cashOwn && <Btns ctx={ctx} list={[cashOwn]} tone="steel" />}
        </Panel>
      )}
      {v.can_card && (
        <Panel>
          <Lead>{t('eco.pay.by_card')}</Lead>
          <Btns ctx={ctx} list={cardActs} row tone="gold" />
          {cardOwn && <Btns ctx={ctx} list={[cardOwn]} tone="steel" />}
        </Panel>
      )}
      <Hint tone={cannot ? 'bad' : undefined}>{cannot ? t('eco.pay.cannot_afford') : t('eco.pay.hint')}</Hint>
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const PayConfirm = flow<PayConfirmView>(({ view: v, ctx }) => {
  const who = v.payee_name || t('eco.someone')
  const confirm = byId(ctx, 'pay.confirm')[0]
  const cancel = byId(ctx, 'pay.cancel')[0]
  return (
    <ConfirmPopup title={t('eco.pay.confirm_title', { player: who })} ctx={ctx} tone="gold"
      footer={(
        <ActionRow>
          {cancel && <ActionButton tone="steel" small onClick={() => ctx.go(cancel)}>{ctx.label(cancel)}</ActionButton>}
          {confirm && <ActionButton tone="green" disabled={ctx.busy} onClick={() => ctx.go(confirm)}>{ctx.label(confirm)}</ActionButton>}
        </ActionRow>
      )}>
      <Note>{t(v.method === 'cash' ? 'eco.pay.method_cash' : 'eco.pay.method_card')}</Note>
      <CostSummary
        lines={[{ label: t('eco.pay.amount'), amount: money(v.amount) }, ...(v.fee > 0 ? [{ label: t('eco.pay.fee'), amount: money(v.fee) }] : [])]}
        total={{ amount: money(v.total) }} />
      <Hint>{t(v.method === 'cash' ? 'eco.pay.after_cash' : 'eco.pay.after_bank', { n: money(v.after) })}</Hint>
    </ConfirmPopup>
  )
})

const PaySent = flow<PaySentView>(({ view: v, ctx }) => {
  const who = v.payee_name || t('eco.someone')
  return (
    <Page title={t('eco.pay.sent_title')} tone="gold">
      <Panel tone="gold">
        <Lead tone="good">
          {v.held ? t('eco.pay.held', { player: who, amount: money(v.amount) })
            : v.method === 'cash' ? t('eco.pay.sent_cash', { player: who, amount: money(v.amount) })
              : t('eco.pay.sent_card', { player: who, amount: money(v.amount) })}
        </Lead>
        {!v.held && v.method !== 'cash' && v.fee > 0 && <Hint>{t('eco.pay.sent_fee', { fee: money(v.fee) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

const PaymentDeclined = flow<PaymentDeclinedView>(({ view: v, ctx }) => {
  const only = (v.accepted ?? []).length === 1 ? t((v.accepted ?? [])[0] === 'cash' ? 'eco.pay.cash_only' : 'eco.pay.card_only') : ''
  return (
    <Page title={t('eco.pay.declined_title')} tone="ruby">
      <Panel tone="ruby">
        <Lead tone="bad">{t('eco.pay.declined', { amount: money(v.amount) })}</Lead>
        <Facts rows={[
          { label: t('eco.pay.cash'), value: money(v.cash) },
          { label: t('eco.pay.bank'), value: money(v.bank) },
        ]} />
        {only && <Hint>{only}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

// -- the city budget -------------------------------------------------------------------------

function shares(ctx: FlowCtx, map: Record<string, number> | null, order: string[] | null): string {
  const codes = (order ?? []).filter((c) => (map?.[c] ?? 0) > 0)
  if (!codes.length) return t('eco.budget.nothing')
  return codes.map((c) => t('eco.budget.share', { line: ctx.names.name(['budget_line'], c), share: pct((map?.[c] ?? 0) / 10000) })).join('، ')
}

const Budget = flow<BudgetView>(({ view: v, ctx }) => {
  if (v.no_city) {
    return (
      <Page title={t('eco.budget.title_plain')} tone="gold">
        <Panel><Lead>{t('eco.budget.no_city')}</Lead></Panel>
        <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
      </Page>
    )
  }
  const city = ctx.names.name(['city'], v.city.code, v.city.name)
  const last = v.last
  return (
    <Page title={t('eco.budget.title', { city })} tone="gold">
      <Panel tone="gold">
        <Facts rows={[
          { label: t('eco.budget.treasury'), value: money(v.treasury), gold: true },
          { label: t('eco.budget.spend_share'), value: pct(v.spend_share_bps / 10000) },
        ]} />
        <Lead>{t('eco.budget.allocation', { shares: shares(ctx, v.allocation, v.order) })}</Lead>
        {v.pending && <Hint>{t('eco.budget.pending', { shares: shares(ctx, v.pending, v.order), when: durationText(v.pending_in_seconds) })}</Hint>}
      </Panel>
      <Panel>
        {last ? (
          <>
            <Lead>{t('eco.budget.last', { spent: money(last.spent) })}</Lead>
            <div className="vf-list">
              {(last.lines ?? []).filter((l) => l.spent > 0).map((l) => (
                <div key={l.code} className="vf-line">
                  <span>{ctx.names.name(['budget_line'], l.code)}</span>
                  <b>{money(l.spent)}</b>
                  <Hint>{hasKey(`eco.budget.effect.${l.effect}`) ? t(key(`eco.budget.effect.${l.effect}`), { share: pct(l.effect_bps / 10000) }) : ''}</Hint>
                </div>
              ))}
            </div>
          </>
        ) : <Hint>{t('eco.budget.no_period')}</Hint>}
        {v.next_at && <Hint>{t('eco.budget.next', { in: durationText(v.next_in_seconds) })}</Hint>}
      </Panel>
      <Btns ctx={ctx} list={rest(ctx, () => false)} />
      <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
    </Page>
  )
})

registerFlow({
  bank: Bank, pay_help: PayHelp, pay: PayScreen, pay_confirm: PayConfirm, pay_sent: PaySent,
  payment_declined: PaymentDeclined, budget: Budget,
})

/** The screens this file draws. */
export const BANK_SCREENS = ['bank', 'pay_help', 'pay', 'pay_confirm', 'pay_sent', 'payment_declined', 'budget']
