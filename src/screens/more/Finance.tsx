// The national bank (internal/telegram/screens/finance.go, FinanceHubView):
// credit standing, the loan products on offer and the player's own loans.
// Savings, insurance, the exchange, gold and the portfolio are reached
// through the server's own buttons (Actions), same as every other hub.

import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, Ring, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { clamp01, formatNumber, money, pct } from '../native/kit/format'

interface Named { code?: string; name?: string }
interface CreditView {
  score?: number; min?: number; max?: number
  missed?: number; defaults?: number
}
interface LoanProductLine { product?: Named; kind?: string; rate_bps?: number; limit?: number; min_score?: number }
interface LoanLine { no?: number; product?: Named; company?: Named; status?: string; next?: number; owed?: number; left?: number; arrears?: number }

interface FinanceHubView {
  country?: Named
  credit?: CreditView
  policy_bps?: number
  products?: LoanProductLine[] | null
  loans?: LoanLine[] | null
  savings?: number; savings_bps?: number
  lendable?: number
  notice?: string
}

export default function FinanceHub({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as FinanceHubView
  if (loading && !response) return <ScreenScroll><Header title="بانک ملی" tone="sapphire" /></ScreenScroll>

  const c = v.credit
  const span = Math.max(1, (c?.max ?? 850) - (c?.min ?? 300))

  return (
    <ScreenScroll>
      <Header title="بانک ملی" tone="sapphire" onBack={() => run('bank.show')} onRefresh={() => run('loan.hub')} />

      {v.notice && <Notice>{v.notice}</Notice>}
      {!v.lendable && <Notice alert>در حال حاضر بانک وامی نمی‌دهد.</Notice>}

      {c && (
        <Card tone="sapphire">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Ring frac={clamp01(((c.score ?? 0) - (c.min ?? 0)) / span)} color="var(--sapphire)" size={84}>
              <span className="display" style={{ fontSize: 20, color: '#fff' }}>{formatNumber(c.score ?? 0)}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>اعتبار</span>
            </Ring>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              نرخ سیاستی: {pct((v.policy_bps ?? 0) / 10000)}
              {!!c.missed && <div style={{ marginTop: 4 }}>{formatNumber(c.missed)} قسط عقب‌افتاده</div>}
              {!!c.defaults && <div style={{ marginTop: 4, color: 'var(--anar)' }}>{formatNumber(c.defaults)} نکول</div>}
            </div>
          </div>
        </Card>
      )}

      {!!(v.products && v.products.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.products!.filter((p) => (p.limit ?? 0) > 0).map((p, i) => (
            <ListRow key={i} icon="bank" palette="sapphire" title={p.product?.name ?? '—'}
              sub={`${pct((p.rate_bps ?? 0) / 10000)} سالانه · سقف ${money(p.limit)}`}
              onClick={() => p.product?.code && run('loan.offer', { product: p.product.code })} />
          ))}
        </div>
      )}

      {!!(v.loans && v.loans.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div className="nx-sec">وام‌های من</div>
          {v.loans!.map((l, i) => (
            <ListRow
              key={i}
              icon={l.arrears ? 'x_wanted' : 'money'}
              palette={l.status !== 'active' ? 'steel' : l.arrears ? 'ruby' : 'emerald'}
              tone={l.arrears ? 'ruby' : undefined}
              title={l.product?.name ?? '—'}
              sub={l.status === 'active' ? `قسط بعدی ${money(l.next)} · مانده ${money(l.owed)}` : 'تسویه شده'}
              onClick={() => l.no !== undefined && run('loan.view', { no: String(l.no) })}
            />
          ))}
        </div>
      )}

      {!!v.savings && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>سپرده: {money(v.savings)} · سود {pct((v.savings_bps ?? 0) / 10000)}</div>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
