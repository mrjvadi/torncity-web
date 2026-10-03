// A goal still ahead in the city's development readout, as a sentence with its progress (0..1). The goal kinds are
// the server's (`PromotionCriterionView`, shared by the readout's `next`): residents, literacy, buildings, knowledge,
// treasury, or a service building of a role at a level.

import type { PromotionCriterionView } from '../../api/views.gen'
import { hasKey, t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'

export function goalLine(c: PromotionCriterionView): { text: string; frac: number } {
  const frac = c.required > 0 ? Math.min(1, c.current / c.required) : 1
  switch (c.kind) {
    case 'residents': return { text: t('vx.goal.residents', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'literacy': return { text: t('vx.goal.literacy', { cur: formatNumber(c.current / 100), req: formatNumber(c.required / 100) }), frac }
    case 'buildings': return { text: t('vx.goal.buildings', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'knowledge': return { text: t('vx.goal.knowledge', { cur: formatNumber(c.current), req: formatNumber(c.required) }), frac }
    case 'treasury': return { text: t('vx.goal.treasury', { cur: money(c.current), req: money(c.required) }), frac }
    default: {
      const k = `vx.goal.role.${c.role}.${c.required}`
      const role = hasKey(`role.${c.role}`) ? t(`role.${c.role}` as Key) : ''
      return { text: hasKey(k) ? t(k as Key) : t('vx.goal.role_any', { role }), frac: c.met ? 1 : 0 }
    }
  }
}
