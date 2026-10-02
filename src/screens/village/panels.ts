// The per-viewer facts about each standing building (its tier, whether THIS viewer can manage it, whether it has an
// upgrade), read from the building's own panel (settlement.building.view, contract 1.4). The layout does not carry
// them yet (see REVIEW.md, missing server fields), so they are fetched here, a few at a time, once per building
// state and once per layout version, and kept; the overlays only ever draw what the server answered.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildingPanelView, VillageLayout } from '../../api/types'
import { useVillageCommand } from '../../village/useVillage'

const MAX = 24

export function useBuildingPanels(layout: VillageLayout | null, enabled: boolean): { panels: Map<string, BuildingPanelView>; reload: (id: string) => void } {
  const cmd = useVillageCommand()
  const [panels, setPanels] = useState<Map<string, BuildingPanelView>>(new Map())
  const seen = useRef(new Map<string, string>())
  const cmdRef = useRef(cmd)
  cmdRef.current = cmd

  const load = useCallback(async (id: string) => {
    const r = await cmdRef.current('settlement.building.view', { building_id: id }, { silent: true })
    if (r.ok && r.res?.view) {
      const v = r.res.view as unknown as BuildingPanelView
      setPanels((cur) => { const n = new Map(cur); n.set(id, v); return n })
    }
  }, [])

  const version = layout?.version
  useEffect(() => {
    if (!enabled || !layout || layout.detail !== 'full') return
    let cancelled = false
    const todo = layout.buildings.filter((b) => b.id && b.type !== 'road' && seen.current.get(b.id) !== `${b.state}|${version}`).slice(0, MAX)
    void (async () => {
      for (const b of todo) {
        if (cancelled) return
        seen.current.set(b.id!, `${b.state}|${version}`)
        await load(b.id!)
      }
    })()
    return () => { cancelled = true }
  }, [enabled, layout, version, load])

  return { panels, reload: (id) => void load(id) }
}
