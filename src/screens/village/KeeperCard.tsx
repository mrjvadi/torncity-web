// The stall keeper of a stall's owner (ADR 0062), on the «کارکنان» tab of «مدیریت قطعهٔ من»: who keeps the stall, what he is paid, the free people
// of the labour pool and the hire or the dismissal. The way he is paid is one line (`payText`) so a second form (a fixed day wage, ADR 0062 section 6)
// fits without a new card: the server will add `pay`, `daily_wage` and `left` to the block.

import type { LotKeeperLine } from '../../api/views.gen'
import { ActionButton, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import { formatNumber, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'

/** The keeper block as the server will send it once the pay choice lands (the extra fields are optional until then). */
export type KeeperBlock = LotKeeperLine & { pay?: 'share' | 'wage'; daily_wage?: number; left?: string }

/** How he is paid, in a few words: a share of the sales made while the owner is away, or a day wage. */
export function payText(k: KeeperBlock): string {
  if (k.pay === 'wage') return t('lm.keeper.pay_wage', { w: money(k.daily_wage ?? 0) })
  return t('lm.keeper.pay_share', { p: formatNumber(Math.round(k.share_bps / 100)) })
}

export default function KeeperCard({ k, manage, busy, onHire, onEnd }: { k: KeeperBlock; manage: boolean; busy: boolean; onHire: () => void; onEnd: () => void }) {
  const why = !k.can && k.reason && hasKey(`lm.keeper.reason.${k.reason}`) ? t(`lm.keeper.reason.${k.reason}` as Key) : !k.can && k.reason ? t('lm.reason.other') : ''
  return (
    <div className="lm-keeper">
      <Section>{t('lm.keeper.title')}</Section>
      <Note>{k.hired ? t('lm.keeper.kept') : t('lm.keeper.none')}</Note>
      {k.left === 'wage_unpaid' && <Note tone="bad">{t('lm.keeper.left_unpaid')}</Note>}
      <StatGrid>
        <StatCard icon="people" palette="emerald" label={t('lm.keeper.pay')} value={k.hired ? payText(k) : t('lm.keeper.pay_none')} />
        <StatCard icon="person" palette="sapphire" label={t('lm.keeper.free')} value={formatNumber(k.seats_free)} />
      </StatGrid>
      <div className="gc-note">{t('lm.keeper.how')}</div>
      {why && <Note tone="bad">{why}</Note>}
      {manage && (k.hired
        ? <ActionButton tone="steel" small disabled={busy} onClick={onEnd}>{t('lm.keeper.end')}</ActionButton>
        : <ActionButton tone="gold" small disabled={busy || !k.can} onClick={onHire}>{t('lm.keeper.hire')}</ActionButton>)}
    </div>
  )
}
