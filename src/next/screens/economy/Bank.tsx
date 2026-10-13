// The bank and paying another player, in the new UI: the wallet as a hero (the bank balance large, cash on hand, the
// village money held), deposit and withdraw through an amount sheet (25/50/100% chips and a number), the other ways
// on as rows; paying a player by cash, card or a village money; the confirm, the sent and the declined pages.

import { useState } from 'react'
import type { Action } from '../../../api/types'
import type { BankView, PayConfirmView, PaySentView, PayView, PaymentDeclinedView } from '../../../api/views.gen'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Hero, Icon, Note, Page, Segmented, Sheet, hueOf, letterOf } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { useStoreView } from '../../../state/useSync'
import { entitiesOf } from '../../../state/store'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { actionLabel } from '../../../screens/village/wording'
import { t } from '../../../i18n'
import {
  BigMoney, Done, Facts, More, NoAnswer, NotHere, Said, actsOf, bpsText, byId, ecoNotice, find, idOf, isBack, toWestern, withArgs,
} from './eco'

const MAX_DIGITS = 12

// -- the amount sheet --------------------------------------------------------------------------------------

/** How much to move: the figure large in a field, chips for a quarter, a half and all of what there is, the result
 * after, the fee, and the one button. */
function AmountSheet({ mode, source, feeBps, cash, bank, onGo, onClose }: {
  mode: 'deposit' | 'withdraw'; source: number; feeBps: number; cash: number; bank: number; onGo: (amount: number) => void; onClose: () => void
}) {
  const [digits, setDigits] = useState('')
  const amount = Number(digits || '0')
  const over = amount > source
  const fee = mode === 'withdraw' ? Math.floor((amount * feeBps) / 10000) : 0
  const ready = amount > 0 && !over
  const after = mode === 'deposit'
    ? t('bank.after_deposit', { cash: formatNumber(cash), a: formatNumber(cash - amount), b: formatNumber(bank + amount) })
    : t('bank.after_withdraw', { cash: formatNumber(cash), a: formatNumber(cash + amount - fee), b: formatNumber(bank - amount) })
  const parts = [{ f: 0.25, label: formatNumber(25) + '٪' }, { f: 0.5, label: formatNumber(50) + '٪' }, { f: 1, label: t('bank.all') }]
  return (
    <Sheet title={t(mode === 'deposit' ? 'bank.deposit_tab' : 'bank.withdraw_tab')} icon={mode === 'deposit' ? 'bank' : 'x_cash'} onClose={onClose}>
      <div className="n-eco-src">
        <Icon name={mode === 'deposit' ? 'coins' : 'bank'} size={30} />
        <span>{t(mode === 'deposit' ? 'next.wallet.cash' : 'bank.balance')}</span>
        <b>{money(source)}</b>
      </div>
      <label className={`n-eco-amount${over ? ' over' : ''}`}>
        <input dir="ltr" inputMode="numeric" autoComplete="off" placeholder={formatNumber(0)} aria-label={t('eco.pay.amount')}
          value={digits ? formatNumber(amount) : ''}
          onChange={(e) => setDigits(toWestern(e.target.value).replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS))} />
        <span>{t('unit.money')}</span>
      </label>
      <div className="n-eco-chips wide">
        {parts.map((p) => {
          const v = Math.floor(source * p.f)
          return <button key={p.f} aria-pressed={amount > 0 && amount === v} disabled={v <= 0} onClick={() => setDigits(String(v))}>{p.label}</button>
        })}
      </div>
      <p className={`n-eco-hint${over ? ' bad' : ''}`}>{over ? t('bank.too_much') : amount > 0 ? after : t(feeBps && mode === 'withdraw' ? 'bank.fee_pct' : 'bank.no_fee', { p: bpsText(feeBps) })}</p>
      {amount > 0 && fee > 0 && !over && <p className="n-eco-hint">{t('bank.fee_pct', { p: bpsText(feeBps) })}: {money(fee)}</p>}
      <Buttons lead>
        <Button disabled={!ready} onClick={() => ready && onGo(amount)}>
          {amount > 0 ? t(mode === 'deposit' ? 'bank.submit_deposit' : 'bank.submit_withdraw', { n: `${formatNumber(amount)} ${t('unit.money')}` }) : t('bank.enter_amount')}
        </Button>
        <Button kind="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      </Buttons>
    </Sheet>
  )
}

// -- the bank ----------------------------------------------------------------------------------------------

export function BankScreen({ response, loading }: NScreenProps) {
  const nav = useNav()
  const { synced } = useSession()
  const store = useStoreView()
  const [sheet, setSheet] = useState<'deposit' | 'withdraw' | null>(null)
  if (!response) return <NoAnswer loading={loading} title={t('bank.title')} />
  const v = response.view as unknown as BankView
  const acts = actsOf(response)
  if (v.unavailable) return <NotHere u={v.unavailable} acts={acts} title={t('bank.title')} />

  // the village's own money the player holds, beside the game's (one line per held purse)
  const purses = synced ? entitiesOf(store, 'wallet').filter(([, w]) => !w.primary && !w.premium && (w.cash > 0 || w.bank > 0)) : []
  const closed = v.travelling || v.no_city
  const dep = find(acts, 'bank.deposit_custom') ?? find(acts, 'bank.deposit')
  const wd = find(acts, 'bank.withdraw_custom') ?? find(acts, 'bank.withdraw')
  const notice = ecoNotice('bank', v.notice, v.notice_args)
  const drawn = (a: Action) => a === dep || a === wd || ['bank.deposit_custom', 'bank.withdraw_custom', 'bank.deposit', 'bank.withdraw', 'bank.deposit_all', 'bank.withdraw_all'].includes(idOf(a))

  function go(a: Action | undefined, amount: number) {
    setSheet(null)
    if (a) nav.act(withArgs(a, { amount: String(amount) }))
  }

  return (
    <Page title={t('bank.title')} sub={v.city && !closed ? t('bank.branch', { city: v.city }) : undefined}>
      <Said r={response} />
      {notice && <Note tone="ok" icon="m_check">{notice}</Note>}
      {v.travelling && <Note tone="bad" icon="plane">{t('bank.travelling')}</Note>}
      {v.no_city && !v.travelling && <Note tone="bad" icon="city">{t('eco.bank.no_city')}</Note>}
      {v.jailed && <Note tone="bad" icon="handcuffs">{t('bank.jailed')}</Note>}

      <Hero art="bank">
        <p className="n-label">{t('bank.balance')}</p>
        <BigMoney n={v.bank} />
        <div className="n-hero-line n-chips">
          <Chip><Icon name="coins" size={18} />{t('next.wallet.cash')}: {money(v.cash)}</Chip>
          {purses.map(([id, w]) => (
            <Chip key={id} tone="cyan"><Icon name="x_cash" size={18} />{t('bank.village_purse', { currency: w.name || w.currency, cash: formatNumber(w.cash), bank: formatNumber(w.bank) })}</Chip>
          ))}
        </div>
        {!closed && (dep || wd) && (
          <div className="n-hero-foot">
            <Buttons>
              {dep && <Button icon="bank" disabled={!v.can_deposit || v.cash <= 0} onClick={() => setSheet('deposit')}>{t('bank.deposit_tab')}</Button>}
              {wd && <Button kind="cyan" icon="x_cash" disabled={!v.can_withdraw || v.jailed || v.bank <= 0} onClick={() => setSheet('withdraw')}>{t('bank.withdraw_tab')}</Button>}
            </Buttons>
          </div>
        )}
      </Hero>

      {!closed && v.withdrawal_fee_bps > 0 && <p className="n-eco-hint">{t('bank.fee', { p: bpsText(v.withdrawal_fee_bps) })}</p>}

      <More acts={acts} skip={drawn} title={t('n.eco.more_ways')} />

      {sheet && (
        <AmountSheet mode={sheet} source={sheet === 'deposit' ? v.cash : v.bank} feeBps={sheet === 'withdraw' ? v.withdrawal_fee_bps : 0}
          cash={v.cash} bank={v.bank} onClose={() => setSheet(null)} onGo={(n) => go(sheet === 'deposit' ? dep : wd, n)} />
      )}
    </Page>
  )
}

// -- paying a player ---------------------------------------------------------------------------------------

export function PayHelp({ response, loading }: NScreenProps) {
  if (!response) return <NoAnswer loading={loading} title={t('eco.pay.title_plain')} />
  const acts = actsOf(response)
  return (
    <Page title={t('eco.pay.title_plain')} art="coins">
      <Said r={response} />
      <div className="n-card">
        <p className="n-text">{t('eco.pay.help')}</p>
      </div>
      <Note tone="info" icon="coins">{t('eco.pay.help_cash')}</Note>
      <More acts={acts} title="" />
    </Page>
  )
}

type Method = 'cash' | 'card' | 'local'

export function Pay({ response, loading }: NScreenProps) {
  const nav = useNav()
  const v = (response?.view ?? {}) as unknown as PayView
  const acts = actsOf(response)
  const methods: Method[] = [
    ...(v.together && v.can_cash ? ['cash' as const] : []),
    ...(v.can_card ? ['card' as const] : []),
    ...(v.can_local ? ['local' as const] : []),
  ]
  const [method, setMethod] = useState<Method>(methods[0] ?? 'card')
  const [digits, setDigits] = useState('')
  if (!response) return <NoAnswer loading={loading} title={t('eco.pay.title_plain')} />

  const who = v.payee_name || t('eco.someone')
  const na = (v.notice_args ?? {}) as Record<string, unknown>
  const notice = v.notice === 'short_local'
    ? t('eco.notice.pay.short_local', { name: String(na.name ?? v.local_name), needed: formatNumber(Number(na.needed ?? 0)), available: formatNumber(Number(na.available ?? 0)) })
    : ecoNotice('pay', v.notice, v.notice_args, v.payee_name)
  const m: Method = methods.includes(method) ? method : methods[0] ?? 'card'
  const quick = byId(acts, `pay.${m}`, `pay.${m}_all`)
  const own = find(acts, `pay.${m}_custom`)
  const source = m === 'cash' ? v.cash : m === 'card' ? v.bank : v.local
  const unit = (n: number) => (m === 'local' ? `${formatNumber(n)} ${v.local_name}` : money(n))
  const amount = Number(digits || '0')
  const over = amount > source
  const drawn = (a: Action) => idOf(a).startsWith('pay.')
  const label = (k: Method) => (k === 'cash' ? t('eco.pay.by_cash') : k === 'card' ? t('eco.pay.by_card') : t('eco.pay.by_local', { name: v.local_name }))

  return (
    <Page title={t('eco.pay.title', { player: who })}>
      <Said r={response} />
      {notice && <Note tone="bad" icon="x_wanted">{notice}</Note>}

      <Hero>
        <div className="n-eco-payee">
          <span className="n-eco-av" style={{ background: `hsl(${hueOf(who)} 42% 38%)` }}>{letterOf(who)}</span>
          <div>
            <p className="n-eco-payee-name">{who}</p>
            {v.payee_code && <Chip><span dir="ltr">{v.payee_code}</span></Chip>}
          </div>
        </div>
        <p className="n-label n-eco-where">{v.together ? t('eco.pay.together', { city: v.city }) : t('eco.pay.apart')}</p>
      </Hero>

      {methods.length === 0 ? <Note tone="bad" icon="x_wanted">{t('eco.pay.cannot_afford')}</Note> : (
        <>
          {methods.length > 1 && <Segmented items={methods.map((k) => ({ key: k, label: label(k) }))} value={m} onChange={(k) => { setMethod(k); setDigits('') }} />}
          <div className="n-card n-eco-paybox">
            <div className="n-eco-src">
              <Icon name={m === 'cash' ? 'coins' : m === 'card' ? 'bank' : 'x_cash'} size={30} />
              <span>{m === 'cash' ? t('eco.pay.cash') : m === 'card' ? t('eco.pay.bank') : v.local_name}</span>
              <b>{unit(source)}</b>
            </div>
            {m === 'card' && v.payer_city && <p className="n-eco-hint">{v.card_fee_bps > 0 ? t('eco.pay.card_fee', { city: v.payer_city, p: bpsText(v.card_fee_bps) }) : t('eco.pay.card_free', { city: v.payer_city })}</p>}
            {m === 'local' && <p className="n-eco-hint">{t('eco.pay.local_note')}</p>}
            {quick.length > 0 && (
              <div className="n-eco-chips wide">
                {quick.map((a, i) => <button key={i} onClick={() => nav.act(withArgs(a, {}, 'navigation'))}>{actionLabel(a)}</button>)}
              </div>
            )}
            {own && (
              <>
                <label className={`n-eco-amount${over ? ' over' : ''}`}>
                  <input dir="ltr" inputMode="numeric" autoComplete="off" placeholder={formatNumber(0)} aria-label={t('eco.pay.amount')}
                    value={digits ? formatNumber(amount) : ''}
                    onChange={(e) => setDigits(toWestern(e.target.value).replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS))} />
                  <span>{m === 'local' ? v.local_name : t('unit.money')}</span>
                </label>
                {over && <p className="n-eco-hint bad">{t('bank.too_much')}</p>}
                <Button block disabled={!(amount > 0) || over} onClick={() => nav.act(withArgs(own, { amount: String(amount) }, 'navigation'))}>
                  {amount > 0 ? t('n.eco.pay_n', { n: unit(amount) }) : t('bank.enter_amount')}
                </Button>
              </>
            )}
          </div>
          <p className="n-eco-hint">{t('eco.pay.hint')}</p>
        </>
      )}
      <More acts={acts} skip={drawn} />
    </Page>
  )
}

export function PayConfirm({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as PayConfirmView
  const acts = actsOf(response)
  const who = v.payee_name || t('eco.someone')
  const amt = (n: number) => (v.method === 'local' ? `${formatNumber(n)} ${v.currency}` : money(n))
  const confirm = find(acts, 'pay.confirm')
  const cancel = find(acts, 'pay.cancel') ?? acts.find(isBack)
  return (
    <Page title={t('eco.pay.confirm_title', { player: who })}>
      <Said r={response} />
      <Hero art={v.method === 'cash' ? 'coins' : v.method === 'card' ? 'bank' : 'x_cash'}>
        <p className="n-label">{t('eco.pay.amount')}</p>
        {v.method === 'local' ? <p className="n-big n-eco-big">{amt(v.total)}</p> : <BigMoney n={v.total} />}
        <p className="n-hero-line"><Chip>{t(v.method === 'local' ? 'eco.pay.method_local' : v.method === 'cash' ? 'eco.pay.method_cash' : 'eco.pay.method_card', { name: v.currency })}</Chip></p>
      </Hero>
      <Facts rows={[
        { label: t('eco.pay.amount'), value: amt(v.amount) },
        ...(v.fee > 0 ? [{ label: t('eco.pay.fee'), value: amt(v.fee) }] : []),
        { label: t('n.eco.total'), value: amt(v.total) },
      ]} />
      <p className="n-eco-hint">{v.method === 'local' ? t('eco.pay.after_local', { n: amt(v.after) }) : t(v.method === 'cash' ? 'eco.pay.after_cash' : 'eco.pay.after_bank', { n: money(v.after) })}</p>
      <Buttons lead>
        {confirm && <Button icon="m_check" onClick={() => nav.act(withArgs(confirm, {}))}>{actionLabel(confirm)}</Button>}
        {cancel && <Button kind="ghost" onClick={() => nav.act(cancel)}>{actionLabel(cancel)}</Button>}
      </Buttons>
    </Page>
  )
}

export function PaySent({ response, loading }: NScreenProps) {
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as PaySentView
  const who = v.payee_name || t('eco.someone')
  const amt = v.method === 'local' ? `${formatNumber(v.amount)} ${v.currency}` : money(v.amount)
  const lead = v.held ? t('eco.pay.held', { player: who, amount: amt })
    : v.method === 'local' ? t('eco.pay.sent_local', { player: who, amount: amt })
    : t(v.method === 'cash' ? 'eco.pay.sent_cash' : 'eco.pay.sent_card', { player: who, amount: amt })
  return (
    <Done title={t('eco.pay.sent_title')} icon={v.method === 'cash' ? 'coins' : 'x_send'} tone={v.held ? 'info' : 'ok'} lead={lead} acts={actsOf(response)}>
      {!v.held && v.method !== 'cash' && v.fee > 0 && <p className="n-eco-hint">{t('eco.pay.sent_fee', { fee: money(v.fee) })}</p>}
    </Done>
  )
}

export function PaymentDeclined({ response, loading }: NScreenProps) {
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as PaymentDeclinedView
  const acc = v.accepted ?? []
  const only = acc.length === 1 ? t(acc[0] === 'cash' ? 'eco.pay.cash_only' : 'eco.pay.card_only') : ''
  return (
    <Done title={t('eco.pay.declined_title')} icon="x_cash" tone="bad" lead={t('eco.pay.declined', { amount: money(v.amount) })} acts={actsOf(response)}>
      <Facts rows={[{ label: t('eco.pay.cash'), value: money(v.cash) }, { label: t('eco.pay.bank'), value: money(v.bank) }]} />
      {only && <p className="n-eco-hint">{only}</p>}
    </Done>
  )
}

