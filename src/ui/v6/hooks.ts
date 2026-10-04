// The shell's data, all from what the server already sends: the state-sync store (src/state), the session's
// profile, the village layout and the village's own screens. Nothing here is invented client-side: a figure the
// server does not send is simply not shown (the list of missing fields is in REVIEW.md).

import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/client'
import type { ProfileView, VillageLayout } from '../../api/types'
import { entitiesOf, entityOf } from '../../state/store'
import { meterNow, useStoreView, useTick } from '../../state/useSync'
import { useSession } from '../../state/SessionContext'
import { getTelegramUser } from '../../lib/telegram'
import { noticeLine } from '../../notices/wording'
import { hasKey, t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'
import { serverNow } from '../../village/clock'
import { constructionProgress } from '../../village/progress'
import { clock, faNum, fa, waitText } from './format'

/** Whether the window is wide enough for the desktop layout (rail, docked panel). */
export function useDesktop(): boolean {
  const q = '(min-width: 900px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setD(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

// -- HUD ---------------------------------------------------------------------------------------

/** The portrait chain: Telegram's own photo_url, then our server's copy (/api/me/photo), then initials on a
 * coloured disc. A step that fails (blocked, missing, 404) falls through to the next. */
export function usePortrait(name: string): { src: string | null; initials: string; hue: number } {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let blob: string | null = null
    const tryUrl = (u: string) => new Promise<boolean>((resolve) => {
      const im = new Image()
      im.onload = () => resolve(true)
      im.onerror = () => resolve(false)
      im.src = u
    })
    void (async () => {
      const tg = getTelegramUser()?.photo_url
      if (tg && await tryUrl(tg)) { if (!cancelled) setSrc(tg); return }
      const mine = await api.fetchMyPhoto().catch(() => null)
      if (mine) { blob = mine; if (!cancelled) setSrc(mine); return }
      if (!cancelled) setSrc(null)
    })()
    return () => { cancelled = true; if (blob) URL.revokeObjectURL(blob) }
  }, [])
  const initials = useMemo(() => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0]).join('‌'), [name])
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return { src, initials, hue: h }
}

export interface HudData {
  level: string
  xp: number
  health: { v: number; max: number; fullIn: number }
  energy: { v: number; max: number; fullIn: number }
  nerve: { v: number; max: number; fullIn: number } | null
  cash: number
  gem: number | null
  pending: boolean
}

/** The personal HUD: own vitals, own cash and the premium gem. Nothing about the village (the HUD is personal only). */
export function useHud(profile: ProfileView | null): HudData {
  const view = useStoreView()
  const wallets = entitiesOf(view, 'wallet')
  const gem = wallets.find(([, w]) => w.premium)?.[1]
  const tgt = useTick(5000)
  void tgt
  const hasNerve = typeof profile?.nerve === 'number' && typeof profile?.max_nerve === 'number'
  return {
    level: profile ? fa(profile.level) : '',
    xp: profile && profile.next_level_xp ? Math.min(1, profile.xp / profile.next_level_xp) : 0,
    health: { v: profile?.health ?? 0, max: profile?.max_health ?? 100, fullIn: 0 },
    energy: { v: profile?.energy ?? 0, max: profile?.max_energy ?? 100, fullIn: profile?.energy_full_in_seconds ?? 0 },
    nerve: hasNerve ? { v: profile!.nerve as number, max: profile!.max_nerve as number, fullIn: (profile!.nerve_full_in_seconds as number) ?? 0 } : null,
    cash: profile?.cash ?? 0,
    gem: gem ? gem.cash : null,
    pending: !!profile?.pending_money,
  }
}

// -- my work and events ---------------------------------------------------------------------------

export interface WipSlot { key: 'shift' | 'study' | 'build'; icon: string; label: string; time: string; idle: boolean; tip: string }

const KIND_SLOT: Record<string, 'shift' | 'study' | 'build'> = { work_shift: 'shift', education: 'study', settlement_work: 'build' }

/** The left column / the rail's «my work»: my shift, my study, my build. A slot with a running timed action
 * counts down; the build slot also counts a construction of mine in the village (the head's own, or a resident's
 * own house) and shows idle (dashed, pulsing) when I may build and nothing is going up. */
export function useWip(layout: VillageLayout | null, canBuild: boolean): WipSlot[] {
  const view = useStoreView()
  const now = useTick(1000)
  const left = new Map<'shift' | 'study' | 'build', number>()
  for (const [, a] of entitiesOf(view, 'timed_action')) {
    const slot = KIND_SLOT[a.kind]
    if (!slot || !a.finish_at) continue
    const s = (Date.parse(a.finish_at) - now) / 1000
    if (s <= 0) continue
    left.set(slot, Math.min(left.get(slot) ?? Infinity, s))
  }
  if (layout) {
    for (const b of layout.buildings) {
      const mineOrHead = layout.viewer.can_place || b.mine
      if (!mineOrHead || (b.state !== 'under_construction') || !b.finish_at) continue
      const s = (Date.parse(b.finish_at) - now) / 1000
      if (s > 0) left.set('build', Math.min(left.get('build') ?? Infinity, s))
    }
  }
  const out: WipSlot[] = []
  const def = (key: WipSlot['key'], icon: string, label: Key, tipKey: Key): void => {
    const s = left.get(key)
    if (s !== undefined) out.push({ key, icon, label: t(label), time: clock(s), idle: false, tip: t(tipKey, { t: clock(s) }) })
    else if (key === 'build' && canBuild) out.push({ key, icon, label: t(label), time: '', idle: true, tip: t('v6.tip.build_idle') })
  }
  def('shift', 'tool', 'v6.wip.shift', 'v6.tip.shift')
  def('study', 'book', 'v6.wip.study', 'v6.tip.study')
  def('build', 'hammer', 'v6.wip.build', 'v6.tip.build')
  return out
}

export interface EventSlot { key: string; icon: string; label: string; time: string; tip: string; open: { command?: string; local?: string } }

/** The right column: time-limited events only, each with the end time the server sends in the settlement entity:
 * the village's research, and the open election (the candidacy, then the vote). Market days do not exist in the game
 * yet, so none is shown. */
export function useEvents(): EventSlot[] {
  const view = useStoreView()
  const now = useTick(1000)
  const out: EventSlot[] = []
  const mine = entityOf(view, 'residence', 'self')?.settlement
  const st = (mine ? entityOf(view, 'settlement', mine) : undefined) ?? entitiesOf(view, 'settlement').find(([, d]) => d.viewer !== 'public')?.[1]
  const res = st?.research
  if (res?.finish_at) {
    const s = (Date.parse(res.finish_at) - now) / 1000
    if (s > 0) out.push({ key: 'research', icon: 'book', label: t('v6.ev.research'), time: waitText(s, t('v6.day')), tip: t('v6.tip.research', { t: waitText(s, t('v6.day')) }), open: { local: 'village_knowledge' } })
  }
  const el = st?.election
  if (el) {
    const cand = (Date.parse(el.candidacy_ends_at) - now) / 1000
    const vote = (Date.parse(el.voting_ends_at) - now) / 1000
    const phase = cand > 0 ? 'candidacy' : 'voting'
    const s = phase === 'candidacy' ? cand : vote
    if (s > 0) {
      const when = waitText(s, t('v6.day'))
      out.push({ key: 'election', icon: 'ballot', label: t('v6.ev.election'), time: when, tip: t(`v6.tip.election.${phase}` as Key, { t: when }), open: { command: 'election.list' } })
    }
  }
  return out
}

// -- quest strip + ticker -------------------------------------------------------------------------------

/** `command` is the screen the goal points at (the server's `go_to` address, ':' read as '.'). */
export interface Quest { text: string; prog: string; done: boolean; command: string }

/** The quest strip's sentence: the server's next goal (the `goal` entity of state sync: a mission I took, else, for the
 * head, a next step of the city's growth: `growth.research` or `growth.build` with the content code in `args.code`),
 * one imperative sentence with its progress. Nothing when the server sends no goal. */
export function useQuest(): Quest | null {
  const view = useStoreView()
  const names = useContentNames()
  const g = entityOf(view, 'goal', 'self')
  if (!g) return null
  const [source, kind = ''] = g.code.split('.')
  const command = g.go_to.replace(':', '.')
  if (source === 'growth') {
    const code = g.args.code ?? ''
    const what = kind === 'research' ? names.name('knowledge', code, '') : names.name('settlement_building', code, '')
    return { text: t(kind === 'research' ? 'v6.q.growth_research' : 'v6.q.growth_build', { what }), prog: '', done: false, command }
  }
  const k = `v6.q.mission.${kind}`
  const text = hasKey(k) ? t(k as Key, { req: faNum(g.target) }) : t('v6.q.mission')
  return { text, prog: `${fa(g.progress)}/${fa(g.target)}`, done: false, command }
}

/** The ticker: the newest notice, worded by the same web wording the toasts use. */
export function useTicker(): string | null {
  const view = useStoreView()
  const names = useContentNames()
  const latest = useMemo(() => {
    const all = entitiesOf(view, 'notice')
    if (!all.length) return null
    return [...all].sort((a, b) => Date.parse(b[1].created_at) - Date.parse(a[1].created_at))[0][1]
  }, [view])
  if (!latest) return null
  return noticeLine(latest.screen, latest.view, names.name)?.text ?? null
}

/** Unread notices, for the society tab's dot (capped at 9+ where drawn). */
export function useUnread(): number {
  const view = useStoreView()
  return entityOf(view, 'inbox', 'self')?.unread ?? 0
}

/** A building under construction's percent, from the layout's own timestamps. */
export function buildPercent(b: VillageLayout['buildings'][number]): number {
  return Math.round(constructionProgress(b, serverNow()) * 100)
}

export { meterNow }
