// What the town's screens share: a command read by a local screen (and read again when the town changes), the 3D icon
// of a building by its role, the word for a server code when the web has one. Logic only: no markup here.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../../api/client'
import type { CommandResponse } from '../../../api/types'
import { useSettlementId, useVillage } from '../../../village/useVillage'
import { hasKey, t, type Key } from '../../../i18n'

/** Reads a command for a screen that has no answer of its own (a local screen), on entry and whenever the town's
 * channel ticks. `initial` is the answer the shell already has, when it has one. */
export function useCommand(command: string, initial: CommandResponse | null = null, args?: Record<string, string>) {
  const id = useSettlementId()
  const { tick } = useVillage(id)
  const [res, setRes] = useState<CommandResponse | null>(initial)
  const [loading, setLoading] = useState(!initial)
  const argsRef = useRef(args); argsRef.current = args
  const read = useCallback(async () => {
    try {
      const r = await api.runCommand(command, argsRef.current ?? {})
      setRes(r)
    } catch { /* keep the last answer; with none the screen says it did not load */ }
    finally { setLoading(false) }
  }, [command])
  const first = useRef(!!initial)
  useEffect(() => {
    // the answer the shell handed over is the first read; the town's later ticks read again
    if (first.current) { first.current = false; return }
    void read()
  }, [read, tick])
  return { res, loading, reload: read }
}

/** The word for a code when the web has one, else '' (a code is never shown). */
export function word(key: string, params?: Record<string, string | number>): string {
  return hasKey(key) ? t(key as Key, params) : ''
}

/** A building's 3D icon by its role (the catalogue's `role`). */
const ROLE_ICON: Record<string, string> = {
  security: 'shield', military: 'helmet', craft: 'gears', extraction: 'ore', forestry: 'x_sprout', water_infra: 'world', water: 'world',
  food: 'bread', health: 'hospital', education: 'study', research: 'study', market: 'market', commerce: 'trade', storage: 'box',
  hospitality: 'bed', finance: 'bank', signal: 'radar', home: 'house', housing: 'house', governance: 'city', infrastructure: 'x_map',
  recreation: 'x_flower', transport: 'cart', training: 'x_muscle', justice: 'gavel',
}
export function roleIcon(role: string | undefined, kind?: string): string {
  if (kind === 'civic_hall') return 'city'
  if (kind === 'road') return 'x_map'
  return ROLE_ICON[role ?? ''] ?? 'house'
}

/** The 3D icon of each «کارهای شهر» entry (cityItems.ts keys). */
export const ITEM_ICON: Record<string, string> = {
  status: 'city', who: 'society', knowledge: 'study', progress: 'factory', charter: 'x_scroll', leave: 'walk',
  registry: 'x_map', terms: 'quill', mining: 'ore', haul: 'cart', rail: 'train', chain: 'gears', projects: 'x_crown',
  treasury: 'coins', storage: 'box', licences: 'x_seal', tenders: 'checklist', debts: 'money', insurance: 'shield',
  law: 'gavel', raid: 'swords', unions: 'x_flag', treaties: 'f_hands', intel: 'radar',
}

/** A role's name («امنیت»), or the plain «other services». */
export function roleName(role: string): string {
  return word(`role.${role}`) || t('role.other')
}
