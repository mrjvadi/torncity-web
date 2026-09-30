import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { money, pct } from './kit/format'
import { t } from '../../i18n'

interface BankView {
  city?: string; cash?: number; bank?: number; withdrawal_fee_bps?: number
  no_city?: boolean; travelling?: boolean; jailed?: boolean; notice?: string
}

export default function Bank({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as BankView
  if (loading && !response) return <ScreenScroll><Header title={t('bank.title')} tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('bank.title')} tone="sapphire" onRefresh={() => run('bank.show')} />

      {v.notice && <Notice>{v.notice}</Notice>}
      {v.travelling && <Notice alert>{t('bank.travelling')}</Notice>}

      <StatPair
        left={<Stat icon="coins" palette="gold" label={t('bank.cash')} value={money(v.cash)} />}
        right={<Stat icon="bank" palette="sapphire" label={t('bank.balance')} value={money(v.bank)} />}
      />

      {v.city && (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('bank.branch', { city: v.city })}</div>
          {!!v.withdrawal_fee_bps && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{t('bank.fee', { p: pct((v.withdrawal_fee_bps ?? 0) / 10000) })}</div>
          )}
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="bank.show" />
    </ScreenScroll>
  )
}
