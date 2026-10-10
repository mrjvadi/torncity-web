// The stall keeper of a stall's owner (ADR 0062 and its addendum), on the «کارکنان» tab of «مدیریت قطعهٔ من»: who keeps the stall, what he is paid,
// the free people of the labour pool and the hire or the dismissal. Two pay forms: a share of the sales made while the owner is away, or a fixed day
// wage. Hiring is two choice chips, one number (a stepper) and then the ordinary ask and confirm popup.

import { useState } from 'react'
import type { LotKeeperLine } from '../../api/views.gen'
import { ActionButton, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'

export type Pay = 'share' | 'wage'

/** How he is paid, in a few words. `share` is in basis points, `wage` in minor units. */
export function payWords(pay: Pay, share_bps: number, wage: number): string {
  return pay === 'wage' ? t('lm.keeper.pay_wage', { w: money(wage) }) : t('lm.keeper.pay_share', { p: formatNumber(Math.round(share_bps / 100)) })
}
export const payText = (k: LotKeeperLine): string => payWords(k.pay === 'wage' ? 'wage' : 'share', k.share_bps, k.wage)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const STEP: Record<Pay, number> = { share: 100, wage: 100 }

export default function KeeperCard({ k, manage, busy, onHire, onEnd }: { k: LotKeeperLine; manage: boolean; busy: boolean; onHire: (pay: Pay, n: number) => void; onEnd: () => void }) {
  const [pay, setPay] = useState<Pay>('share')
  const [share, setShare] = useState(k.share_bps)
  const [wage, setWage] = useState(k.wage)
  const range: Record<Pay, [number, number]> = { share: [k.share_min_bps, k.share_max_bps], wage: [k.wage_min, k.wage_max] }
  const val = pay === 'share' ? share : wage
  const set = (n: number) => (pay === 'share' ? setShare(clamp(n, ...range.share)) : setWage(clamp(n, ...range.wage)))
  const why = !k.can && k.reason ? (hasKey(`lm.keeper.reason.${k.reason}`) ? t(`lm.keeper.reason.${k.reason}` as Key) : t('lm.reason.other')) : ''
  const how = k.hired ? (k.pay === 'wage' ? t('lm.keeper.how_wage') : t('lm.keeper.how_share')) : t('lm.keeper.how_pick')
  return (
    <div className="lm-keeper">
      <Section>{t('lm.keeper.title')}</Section>
      <Note>{k.hired ? t('lm.keeper.kept') : t('lm.keeper.none')}</Note>
      {!k.hired && k.left === 'wage_unpaid' && <Note tone="bad">{t('lm.keeper.left_unpaid')}</Note>}
      <StatGrid>
        <StatCard icon="people" palette="emerald" label={t('lm.keeper.pay')} value={k.hired ? payText(k) : t('lm.keeper.pay_none')} />
        <StatCard icon="person" palette="sapphire" label={t('lm.keeper.free')} value={formatNumber(k.seats_free)} />
      </StatGrid>
      <div className="gc-note">{how}</div>
      {why && <Note tone="bad">{why}</Note>}
      {manage && !k.hired && k.can && (
        <div className="lm-keeper-pick">
          <div className="lm-keeper-chips" role="radiogroup" aria-label={t('lm.keeper.pay')}>
            {(['share', 'wage'] as Pay[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={pay === p} className={`dk-chip${pay === p ? ' all' : ''}`} onClick={() => setPay(p)}>{t(`lm.keeper.form_${p}` as Key)}</button>
            ))}
          </div>
          <div className="lm-keeper-step">
            <button type="button" className="lm-keeper-pm" aria-label={t('lm.keeper.less')} disabled={val <= range[pay][0]} onClick={() => set(val - STEP[pay])}>−</button>
            <div className="lm-keeper-val">{payWords(pay, val, val)}</div>
            <button type="button" className="lm-keeper-pm" aria-label={t('lm.keeper.more')} disabled={val >= range[pay][1]} onClick={() => set(val + STEP[pay])}>+</button>
          </div>
          <div className="gc-note lm-keeper-range">{pay === 'share' ? t('lm.keeper.range_share', { a: formatNumber(Math.round(k.share_min_bps / 100)), b: formatNumber(Math.round(k.share_max_bps / 100)) }) : t('lm.keeper.range_wage', { a: money(k.wage_min), b: money(k.wage_max) })}</div>
        </div>
      )}
      {manage && (k.hired
        ? <ActionButton tone="steel" small disabled={busy} onClick={onEnd}>{t('lm.keeper.end')}</ActionButton>
        : <ActionButton tone="gold" small disabled={busy || !k.can} onClick={() => onHire(pay, val)}>{t('lm.keeper.hire')}</ActionButton>)}
    </div>
  )
}
