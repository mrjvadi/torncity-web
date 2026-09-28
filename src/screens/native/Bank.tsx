import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { money, pct } from './kit/format'

interface BankView {
  city?: string; cash?: number; bank?: number; withdrawal_fee_bps?: number
  no_city?: boolean; travelling?: boolean; jailed?: boolean; notice?: string
}

export default function Bank({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as BankView
  if (loading && !response) return <ScreenScroll><Header title="بانک" tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="بانک" tone="sapphire" onRefresh={() => run('bank.show')} />

      {v.notice && <Notice>{v.notice}</Notice>}
      {v.travelling && <Notice alert>در سفر هستید؛ به بانک دسترسی ندارید.</Notice>}

      <StatPair
        left={<Stat icon="coins" palette="gold" label="نقد" value={money(v.cash)} />}
        right={<Stat icon="bank" palette="sapphire" label="موجودی بانک" value={money(v.bank)} />}
      />

      {v.city && (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>شعبه‌ی {v.city}</div>
          {!!v.withdrawal_fee_bps && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>کارمزد برداشت: {pct((v.withdrawal_fee_bps ?? 0) / 10000)}</div>
          )}
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="bank.show" />
    </ScreenScroll>
  )
}
