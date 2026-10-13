import type { ScreenProps } from '../types'
import ServerHub from './ServerHub'
import { ECONOMY_ENTRIES } from './kit/hubs'
import { money, splitMoney } from './kit/format'
import { Ic } from '../../ui/v6/parts'
import { useSession } from '../../state/SessionContext'
import { t } from '../../i18n'

/** The Economy hub: the wallet on top (bank balance large, the cash on hand under it, the bank and a payment one tap
 * away), then the entries the server lists for where the player stands (`economy.hub`). */
export default function EconomyHub({ run }: ScreenProps) {
  return <ServerHub command="economy.hub" title="hub.economy" look={ECONOMY_ENTRIES} run={run} top={<Wallet run={run} />} />
}

function Wallet({ run }: Pick<ScreenProps, 'run'>) {
  const { profile } = useSession()
  if (!profile) return null
  const bank = money(profile.bank)
  const [main, sup] = splitMoney(bank) ?? [bank, '']
  return (
    <section className="hub-wallet">
      <Ic name="bank" className="hub-wallet-art" />
      <div className="hub-wallet-body">
        <span className="hub-wallet-label">{t('bank.balance')}</span>
        <b className="hub-wallet-sum">{main}</b>
        {sup && <span className="hub-wallet-sup">{sup}</span>}
        <span className="hub-wallet-cash"><Ic name="coin" />{t('hub.wallet.cash')}: <b>{money(profile.cash)}</b></span>
      </div>
      <div className="hub-wallet-btns">
        <button className="nx-primary" onClick={() => run('bank.show')}>{t('hub.bank')}</button>
        <button className="hub-btn-cyan" onClick={() => run('bank.pay')}>{t('hub.wallet.pay')}</button>
      </div>
    </section>
  )
}
