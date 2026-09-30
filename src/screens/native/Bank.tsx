// The bank, after the prototype's bank screen (screens_proto.gd `_s_bank`):
// balance banner, deposit/withdraw tabs, the amount with quick chips and a
// number pad, and one big submit slab. It sends the same commands the
// server's own buttons do (`bank.deposit` / `bank.withdraw` with an amount);
// the rest of the server's actions (pay a player, the national bank) follow.

import { useState } from 'react'
import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, money, pct } from './kit/format'
import { t } from '../../i18n'
import './bank.css'

interface BankView {
  city?: string; cash?: number; bank?: number; withdrawal_fee_bps?: number
  no_city?: boolean; travelling?: boolean; jailed?: boolean; notice?: string
  can_deposit?: boolean; can_withdraw?: boolean
}

const QUICK = [1000, 5000, 10000]
const MAX_DIGITS = 12

export default function Bank({ response, loading, onAction, run }: ScreenProps) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [digits, setDigits] = useState('')
  const v = (response?.view ?? {}) as BankView
  if (loading && !response) return <ScreenScroll><Header title={t('bank.title')} tone="sapphire" /></ScreenScroll>

  const cash = v.cash ?? 0
  const bank = v.bank ?? 0
  const feeBps = mode === 'withdraw' ? v.withdrawal_fee_bps ?? 0 : 0
  const amount = Number(digits || '0')
  const source = mode === 'deposit' ? cash : bank
  const fee = Math.floor((amount * feeBps) / 10000)
  const over = amount > source
  const locked = !!(v.travelling || v.jailed || v.no_city) || (mode === 'deposit' ? v.can_deposit === false : v.can_withdraw === false)
  const ready = amount > 0 && !over && !locked

  const push = (d: string) => setDigits((cur) => (cur + d).replace(/^0+/, '').slice(0, MAX_DIGITS))
  const after = mode === 'deposit'
    ? t('bank.after_deposit', { cash: formatNumber(cash), a: formatNumber(cash - amount), b: formatNumber(bank + amount) })
    : t('bank.after_withdraw', { cash: formatNumber(cash), a: formatNumber(cash + amount - fee), b: formatNumber(bank - amount) })

  function submit() {
    if (!ready) return
    onAction({
      label: t(mode === 'deposit' ? 'bank.submit_deposit' : 'bank.submit_withdraw', { n: money(amount) }),
      command: mode === 'deposit' ? 'bank.deposit' : 'bank.withdraw',
      args: { amount: String(amount) }, row: 0, kind: 'primary',
    })
    setDigits('')
  }

  return (
    <ScreenScroll>
      <Header title={t('bank.title')} tone="sapphire" onRefresh={() => run('bank.show')} />

      {v.notice && <Notice>{v.notice}</Notice>}
      {v.travelling && <Notice alert>{t('bank.travelling')}</Notice>}
      {v.jailed && <Notice alert>{t('bank.jailed')}</Notice>}

      <Card tone="sapphire">
        <StatPair
          left={<Stat icon="coins" palette="gold" label={t('bank.cash')} value={money(cash)} />}
          right={<Stat icon="bank" palette="sapphire" label={t('bank.balance')} value={money(bank)} />}
        />
        {v.city && <div className="bk-branch">{t('bank.branch', { city: v.city })}</div>}
      </Card>

      <div className="bk-tabs" role="tablist">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={`bk-tab display${mode === m ? ' on' : ''}`}
            onClick={() => { setMode(m); setDigits('') }}>
            {t(m === 'deposit' ? 'bank.deposit_tab' : 'bank.withdraw_tab')}
          </button>
        ))}
      </div>

      <div className={`bk-amount${over ? ' over' : ''}`}>
        <button className="bk-clear" aria-label="clear" onClick={() => setDigits('')} disabled={!digits}>×</button>
        <span className="bk-amount-value display" dir="ltr">{formatNumber(amount)}</span>
        <span className="bk-amount-unit">{t('unit.money')}</span>
      </div>
      <div className="bk-hint">{over ? t('bank.too_much') : after}</div>

      <div className="bk-quick">
        {QUICK.map((q) => (
          <button key={q} className="bk-chip" onClick={() => setDigits(String(Math.min(source, (amount || 0) + q)))}>+{formatNumber(q)}</button>
        ))}
        <button className="bk-chip bk-chip-all" onClick={() => setDigits(String(source))}>{t('bank.all')}</button>
      </div>

      <div className="bk-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="bk-key display" onClick={() => push(d)}>{d}</button>)}
        <button className="bk-key bk-key-blue display" onClick={() => push('000')}>000</button>
        <button className="bk-key display" onClick={() => push('0')}>0</button>
        <button className="bk-key bk-key-red display" aria-label="backspace" onClick={() => setDigits((c) => c.slice(0, -1))}>⌫</button>
      </div>

      <button className="bk-submit" disabled={!ready} onClick={submit}>
        <span className="bk-fee">{feeBps ? t('bank.fee_pct', { p: pct(feeBps / 10000) }) : t('bank.no_fee')}</span>
        <span className="bk-submit-text display">
          {amount > 0 ? t(mode === 'deposit' ? 'bank.submit_deposit' : 'bank.submit_withdraw', { n: money(amount) }) : t('bank.enter_amount')}
        </span>
      </button>

      <Actions response={response} onAction={onAction} refreshCommand="bank.show"
        only={(a) => a.command !== 'bank.deposit' && a.command !== 'bank.withdraw' && a.kind !== 'back'} />
    </ScreenScroll>
  )
}
