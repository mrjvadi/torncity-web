// What THIS viewer may do with each building and how it stands (tier, the upgrade arrow, the verbs, idle reasons,
// staff): the server's per-viewer building overlay, carried by the settlement summary of state sync (client-api.md
// 5.6) and pushed live. Nothing is fetched per building and nothing is guessed here; a building the server sends no
// entry for (a standing road, or a village that is not mine) is «info» only.

import { useMemo } from 'react'
import { entitiesOf, entityOf } from '../../state/store'
import { useStoreView } from '../../state/useSync'
import type { BuildingOverlay, SettlementData } from '../../state/syncTypes'

/** The overlay of my own settlement, by building id. */
export function useBuildingOverlays(): Map<string, BuildingOverlay> {
  const view = useStoreView()
  return useMemo(() => {
    const mine = entityOf(view, 'residence', 'self')?.settlement
    const s = (mine ? entityOf(view, 'settlement', mine) : undefined) ?? entitiesOf(view, 'settlement').find(([, d]) => d.viewer !== 'public')?.[1]
    return overlayMap(s)
  }, [view])
}

export function overlayMap(s: SettlementData | undefined): Map<string, BuildingOverlay> {
  const m = new Map<string, BuildingOverlay>()
  for (const o of s?.buildings ?? []) m.set(o.id, o)
  return m
}
