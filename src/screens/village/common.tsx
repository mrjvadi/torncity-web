// Pieces the village screens share: icons and palettes by building role,
// duration text, and a hook that keeps one status screen's command answer
// fresh (on entry, on refresh, and whenever the settlement channel reports
// something that could have changed it).

import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../api/client'
import type { CommandResponse } from '../../api/types'
import type { IconPalette } from '../../ui/Icon'
import { t } from '../../i18n'
import { useLive } from '../../lib/live'
import { hms } from '../native/kit/format'
import { useSettlementId, useVillage } from '../../village/useVillage'
import { Card, type Tone } from '../native/kit/Parts'
import Icon from '../../ui/Icon'
import type { ReactNode } from 'react'
import { words } from '../../lib/duration'

export const ROLE_ICON: Record<string, string> = {
  '': 'house', security: 'shield', craft: 'gears', extraction: 'ore', water_infra: 'world',
  food: 'bread', health: 'hospital', education: 'study', market: 'market', storage: 'box',
}
export const ROLE_PALETTE: Record<string, IconPalette> = {
  '': 'gold', security: 'ruby', craft: 'amber', extraction: 'steel', water_infra: 'sapphire',
  food: 'emerald', health: 'teal', education: 'violet', market: 'gold', storage: 'steel',
}
export const ROLE_TONE: Record<string, Tone> = {
  '': 'gold', security: 'ruby', craft: 'gold', extraction: 'sapphire', water_infra: 'sapphire',
  food: 'emerald', health: 'teal', education: 'violet', market: 'gold', storage: 'sapphire',
}

/** Icon/palette of a building type: by the role its catalogue entry carries. */
export function iconForRole(role: string | undefined) {
  const r = role ?? ''
  return { icon: ROLE_ICON[r] ?? 'house', palette: ROLE_PALETTE[r] ?? ('gold' as IconPalette) }
}

/** "3 ساعت" / "45 دقیقه", the coarsest useful unit, Western digits. */
export function durationText(seconds: number): string {
  return words(seconds)
}

/** A live countdown text "MM:SS" / "H:MM" to an instant, from the server clock. */
export function countdown(finishAt: string | null | undefined, now: number): string {
  if (!finishAt) return '—'
  return hms((Date.parse(finishAt) - now) / 1000)
}

/** Loads a village status command once on entry, then again on demand and
 * whenever the channel ticks. `initial` is the answer the shell already
 * fetched when it opened the screen as a server screen. */
export function useVillageView<V>(command: string, initial: CommandResponse | null, args: Record<string, string> = {}, enabled = true) {
  const id = useSettlementId()
  const { tick } = useVillage(id)
  const [res, setRes] = useState<CommandResponse | null>(initial)
  const [loading, setLoading] = useState(!initial)
  const [failed, setFailed] = useState(false)
  const argsRef = useRef(args)
  argsRef.current = args
  const run = useCallback(async () => {
    if (!enabled) return
    try {
      // an answer that never comes must not leave «…» on the screen for ever: after 20 s it is a failure the player can retry
      const r = await Promise.race([api.runCommand(command, argsRef.current), new Promise<never>((_, no) => window.setTimeout(() => no(new Error('timeout')), 20_000))])
      setRes(r)
      setFailed(r.ok === false && !r.view)
    } catch {
      // keep the last answer; with none, the screen says it did not load
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [command, enabled])
  useEffect(() => { void run() }, [run, tick])
  useLive(res?.view, () => void run())
  return { res, view: (res?.view ?? null) as V | null, loading, failed: failed && !res?.view, refresh: run }
}

/** A card with a header line (icon plate, title and subtitle, something at the
 * far end) and room for more underneath: the layout of a construction line or
 * a knowledge item, without a frame inside a frame. */
export function RowCard({ icon, palette, title, sub, right, tone, children }: {
  icon: string
  palette?: IconPalette
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  tone?: Tone
  children?: ReactNode
}) {
  return (
    <Card tone={tone}>
      <div className="vs-head">
        <span className="nx-row-plate"><Icon name={icon} palette={palette ?? 'steel'} size={20} /></span>
        <span className="nx-row-text">
          <span className="nx-row-title">{title}</span>
          {sub && <span className="nx-row-sub">{sub}</span>}
        </span>
        {right && <span className="nx-row-right">{right}</span>}
      </div>
      {children}
    </Card>
  )
}
