// The shell's data, all from what the server already sends: the state-sync store (src/state), the session's
// profile, the village layout and the village's own screens. Nothing here is invented client-side: a figure the
// server does not send is simply not shown (the list of missing fields is in REVIEW.md).

import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/client'
import type { ProfileView, VillageLayout } from '../../api/types'
import type { DevelopmentView } from '../../api/views.gen'
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

/** The right column: time-limited events only. What the server sends today: the village's research with its end
 * time (the settlement entity). Elections and market days are not sent yet. */
export function useEvents(): EventSlot[] {
  const view = useStoreView()
  const now = useTick(1000)
  const out: EventSlot[] = []
  const res = entitiesOf(view, 'settlement')[0]?.[1]?.research
  if (res?.finish_at) {
    const s = (Date.parse(res.finish_at) - now) / 1000
    if (s > 0) out.push({ key: 'research', icon: 'book', label: t('v6.ev.research'), time: waitText(s, t('v6.day')), tip: t('v6.tip.research', { t: waitText(s, t('v6.day')) }), open: { local: 'village_knowledge' } })
  }
  return out
}

// -- quest strip + ticker -------------------------------------------------------------------------------

export interface Quest { text: string; prog: string; done: boolean }

/** The quest strip's sentence: the next goal still ahead in the city's development readout
 * (settlement.development.view, neutral view `village_development`), one imperative sentence with its progress.
 * Only a viewer who holds the matching permission (`enabled`, the server's can_place) gets it; the rest see no
 * sentence. Gone when nothing is ahead. */
export function useQuest(settlementId: string | undefined, layoutVersion: string | undefined, enabled = true): Quest | null {
  const [q, setQ] = useState<Quest | null>(null)
  useEffect(() => {
    if (!settlementId || !enabled) { setQ(null); return }
    let cancelled = false
    void api.runCommand('settlement.development.view', {}).then((r) => {
      if (cancelled) return
      const v = r.ok !== false ? (r.view as unknown as DevelopmentView | undefined) : undefined
      const crit = (v?.next ?? []).find((c) => !c.met)
      setQ(crit ? questOf(crit) : null)
    }).catch(() => { if (!cancelled) setQ(null) })
    return () => { cancelled = true }
  }, [settlementId, layoutVersion, enabled])
  return q
}

function questOf(c: { kind: string; role: string; current: number; required: number }): Quest {
  const pct = c.required > 0 ? Math.min(100, Math.floor((c.current / c.required) * 100)) : 0
  switch (c.kind) {
    case 'residents': return { text: t('v6.q.residents', { req: faNum(c.required) }), prog: `${fa(c.current)}/${fa(c.required)}`, done: false }
    case 'literacy': return { text: t('v6.q.literacy', { req: faNum(c.required / 100) }), prog: `${fa(pct)}٪`, done: false }
    case 'buildings': return { text: t('v6.q.buildings', { req: faNum(c.required) }), prog: `${fa(c.current)}/${fa(c.required)}`, done: false }
    case 'knowledge': return { text: t('v6.q.knowledge', { req: faNum(c.required) }), prog: `${fa(c.current)}/${fa(c.required)}`, done: false }
    case 'treasury': return { text: t('v6.q.treasury'), prog: `${fa(pct)}٪`, done: false }
    default: {
      const k = `vx.goal.role.${c.role}.${c.required}`
      const what = hasKey(k) ? t(k as Key) : t('vx.goal.role_any', { role: hasKey(`role.${c.role}`) ? t(`role.${c.role}` as Key) : c.role })
      return { text: t('v6.q.build_what', { what }), prog: '۰/۱', done: false }
    }
  }
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
