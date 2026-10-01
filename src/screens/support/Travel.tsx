// Travel between Support and the villages: the destinations list (Support
// first, villages by distance, with their emblem), a confirm sheet with the
// vehicles, the journey (a countdown) and the visit of a foreign village.
//
// The server side is coming (the bootstrap's `location`, a destinations list,
// village fares): this file codes against the contract in src/support/
// location.ts. A missing `travel.destinations` falls back to `map.cities`
// (cities only); the mock (?mock=1, src/support/mock.ts) serves both.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScreenProps } from '../types'
import { Card, Chip, Empty, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import { hms, money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { Emboss, Slab } from '../../kit'
import Emblem from '../../lib/emblem'
import { emblemHex } from '../../lib/emblemPalette'
import Popup, { ActionButton, Hero, Note, StatCard, StatGrid } from '../../ui/Popup'
import * as api from '../../api/client'
import { useSession } from '../../state/SessionContext'
import { useToast } from '../../state/ToastContext'
import { serverNow } from '../../village/clock'
import { refusalText, t, type Key } from '../../i18n'
import { homeScreen, locationOf, type Destination, type TravelDestination } from '../../support/location'
import { useContentNames } from '../../village/useVillage'
import VillageHome from '../village/VillageHome'
import './support.css'

const MODE_ICON: Record<string, string> = { bus: 'bus', car: 'x_car', train: 'train', flight: 'plane' }
const modeName = (code: string | undefined, fallback?: string) => (code && `sc.mode.${code}` in { 'sc.mode.bus': 1, 'sc.mode.train': 1, 'sc.mode.flight': 1 } ? t(`sc.mode.${code}` as Key) : fallback ?? code ?? '')

// -- destinations ------------------------------------------------------------

interface DestView { destinations?: TravelDestination[] | null; mock?: boolean }

async function loadDestinations(): Promise<{ list: TravelDestination[]; mock: boolean }> {
  try {
    const r = await api.runCommand('travel.destinations', {})
    const v = r.view as DestView | undefined
    if (r.ok !== false && Array.isArray(v?.destinations)) return { list: v!.destinations!, mock: !!v?.mock }
  } catch { /* the command is not served yet: cities only */ }
  const r = await api.runCommand('map.cities', {})
  const v = r.view as { destinations?: { code: string; name: string; distance_km: number }[] | null } | undefined
  return { list: (v?.destinations ?? []).map((d) => ({ kind: 'city' as const, code: d.code, name: d.name, distance_km: d.distance_km })), mock: false }
}

interface ModeOption { mode_code: string; mode_name?: string; fare: number; wait_seconds?: number; energy?: number; busy?: boolean }

export function SupportTravel({ openLocal, localArgs }: ScreenProps) {
  const { bootstrap, refreshBootstrap } = useSession()
  const toast = useToast()
  const [data, setData] = useState<{ list: TravelDestination[]; mock: boolean } | null>(null)
  const [failed, setFailed] = useState(false)
  const [sel, setSel] = useState<TravelDestination | null>(null)
  const loc = locationOf(bootstrap)
  const here = loc?.code ?? (loc ? '' : 'support')
  const hint = localArgs?.mode
  const service = localArgs?.service
  const names = useContentNames()

  const load = useCallback(() => {
    setFailed(false)
    loadDestinations().then(setData).catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])
  // «بازگشت به روستا»: open straight on the destination asked for
  const want = localArgs?.to
  useEffect(() => {
    if (want && data) { const d = data.list.find((x) => x.code === want); if (d) setSel(d) }
  }, [want, data])

  const list = useMemo(() => {
    const l = [...(data?.list ?? [])]
    if (!l.some((d) => d.code === 'support')) l.push({ kind: 'city', code: 'support', name: names.name('city', 'support', bootstrap?.cities.find((c) => c.code === 'support')?.name), distance_km: 0 })
    // Support first, then the villages by distance
    return l.sort((a, b) => (a.code === 'support' ? -1 : b.code === 'support' ? 1 : a.distance_km - b.distance_km))
  }, [data, bootstrap, names])

  const back = () => { const h = homeScreen(bootstrap); openLocal(h.local, h.args) }

  async function go(d: TravelDestination, mode: string, fare: number) {
    try {
      const r = await api.runCommand('travel.start', { city: d.code, mode, max: fare }, `web-tr-${Date.now().toString(36)}`)
      if (r.ok === false) { toast.push(refusalText(r.error?.code, r.error?.message), { kind: 'error' }); return }
      setSel(null)
      await refreshBootstrap()
      openLocal('support_journey')
    } catch (e) {
      toast.push(refusalText((e as { code?: string })?.code, t('sc.travel.failed')), { kind: 'error' })
    }
  }

  return (
    <ScreenScroll>
      <Header title={t('sc.dest.title')} tone="teal" onBack={back} onRefresh={load} />
      {hint && <Notice>{t('sc.dest.hint_mode', { mode: modeName(hint) })}</Notice>}
      {failed && <Empty>{t('common.load_failed')}</Empty>}
      {!failed && !data && <Empty>{t('sc.loading')}</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data && list.map((d) => {
          const isHome = d.code === bootstrap?.settlement?.code
          const isHere = d.code === here || (!!d.settlement_id && d.settlement_id === loc?.settlement_id)
          return (
            <button key={d.code} className={`nx-row nx-row-tap${isHere ? ' nx-row-teal' : ''}`} disabled={isHere} onClick={() => setSel(d)} style={{ opacity: isHere ? 0.7 : 1 }}>
              <span className="sc-emb"><DestEmblem d={d} size={34} /></span>
              <span className="nx-row-text">
                <span className="nx-row-title">{d.kind === 'city' ? names.name('city', d.code, d.name) : d.name}</span>
                <span className="nx-row-sub">
                  {isHere ? t('sc.dest.here') : isHome ? `${t('sc.dest.home')} · ` + `${t('sc.dest.km', { n: formatNumber(Math.round(d.distance_km)) })}` : `${d.kind === 'city' ? t('sc.dest.city') : t('sc.dest.village')} · ${t('sc.dest.km', { n: formatNumber(Math.round(d.distance_km)) })}${d.duration_seconds ? ` · ${hms(d.duration_seconds)}` : ''}`}
                </span>
              </span>
              {!isHere && d.fare !== undefined && <span className="nx-row-right">{money(d.fare)}</span>}
            </button>
          )
        })}
      </div>
      {data?.mock && <p className="sc-mock">{t('sc.dest.mock')}</p>}
      <ConfirmSheet dest={sel} hint={hint} service={service} onClose={() => setSel(null)} onGo={go} />
    </ScreenScroll>
  )
}

function DestEmblem({ d, size }: { d: Destination; size: number }) {
  if (d.emblem) return <Emblem shape={d.emblem.shape} colorA={emblemHex(d.emblem.color_a)} colorB={emblemHex(d.emblem.color_b)} icon={d.emblem.icon} size={size} />
  return <Emboss name={d.kind === 'city' ? 'city' : 'house'} palette={d.kind === 'city' ? 'gold' : 'emerald'} size={size * 0.8} />
}

function ConfirmSheet({ dest, hint, service, onClose, onGo }: { dest: TravelDestination | null; hint?: string; service?: string; onClose: () => void; onGo: (d: TravelDestination, mode: string, fare: number) => Promise<void> }) {
  const [options, setOptions] = useState<ModeOption[] | null>(null)
  const [mode, setMode] = useState('')
  const [busy, setBusy] = useState(false)
  const names = useContentNames()

  useEffect(() => {
    setOptions(null); setMode('')
    if (!dest) return
    let cancelled = false
    api.runCommand('travel.options', { city: dest.code }).then((r) => {
      if (cancelled) return
      const list = ((r.view as { options?: ModeOption[] | null } | undefined)?.options ?? []).filter((o) => o.mode_code)
      setOptions(list)
      const pref = list.find((o) => o.mode_code === hint && !o.busy) ?? list.find((o) => !o.busy)
      if (pref) setMode(pref.mode_code)
    }).catch(() => !cancelled && setOptions([]))
    return () => { cancelled = true }
  }, [dest, hint])

  if (!dest) return null
  const chosen = options?.find((o) => o.mode_code === mode)
  return (
    <Popup
      open onClose={onClose} tone="navy" dismissible={!busy}
      title={service ? t('lf.menu.service_to', { city: dest.kind === 'city' ? names.name('city', dest.code, dest.name) : dest.name, service: t(`lf.menu.service.${service}` as Key) }) : t('sc.confirm.title', { name: dest.kind === 'city' ? names.name('city', dest.code, dest.name) : dest.name })}
      footer={(
        <ActionButton
          tone="gold" cost={chosen ? (chosen.fare > 0 ? money(chosen.fare) : t('common.free')) : undefined} costIcon="coins" costPalette="gold"
          disabled={!chosen} busy={busy}
          onClick={() => { if (!chosen) return; setBusy(true); void onGo(dest, chosen.mode_code, chosen.fare).finally(() => setBusy(false)) }}
        >
          {t('sc.confirm.go')}
        </ActionButton>
      )}
    >
      <Hero>
        <div className="pp-medal-wrap">
          <div className="sc-emblem"><DestEmblem d={dest} size={92} /></div>
          {dest.motto && <div className="pp-medal-chip">{dest.motto}</div>}
        </div>
      </Hero>
      <StatGrid>
        <StatCard icon="x_map" palette="sapphire" label={t('sc.confirm.distance')} value={t('sc.dest.km', { n: formatNumber(Math.round(dest.distance_km)) })} />
        {dest.duration_seconds ? <StatCard icon="stopwatch" palette="amber" label={t('sc.confirm.time')} value={hms(dest.duration_seconds)} /> : null}
      </StatGrid>
      <div className="sc-modes">
        {options === null && <Note>{t('sc.confirm.loading')}</Note>}
        {options?.length === 0 && <Note tone="bad">{t('sc.confirm.no_mode')}</Note>}
        {options?.map((o) => (
          <ListRow
            key={o.mode_code}
            icon={MODE_ICON[o.mode_code] ?? 'plane'}
            palette={o.mode_code === mode ? 'gold' : 'teal'}
            tone={o.mode_code === mode ? 'gold' : undefined}
            title={o.mode_name ?? modeName(o.mode_code)}
            sub={`${hms(o.wait_seconds)}${o.busy ? ` · ${t('sc.confirm.busy')}` : ''}`}
            right={money(o.fare)}
            onClick={o.busy ? undefined : () => setMode(o.mode_code)}
          />
        ))}
      </div>
    </Popup>
  )
}

// -- the journey -------------------------------------------------------------

export function SupportJourney({ openLocal }: ScreenProps) {
  const { bootstrap, refreshBootstrap } = useSession()
  const loc = locationOf(bootstrap)
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const id = window.setInterval(() => setNow(serverNow()), 1000); return () => clearInterval(id) }, [])

  const arrivesMs = loc?.arrives_at ? Date.parse(loc.arrives_at) : NaN
  const left = Number.isFinite(arrivesMs) ? Math.max(0, Math.round((arrivesMs - now) / 1000)) : loc?.remaining_seconds ?? 0
  const total = loc?.total_seconds ?? Math.max(left, 1)
  const frac = Math.max(0, Math.min(1, 1 - left / total))
  const done = left <= 0

  // the server moves the player on arrival: ask again until the bootstrap says so
  useEffect(() => {
    const id = window.setInterval(() => { void refreshBootstrap() }, done ? 2500 : 10000)
    return () => clearInterval(id)
  }, [done, refreshBootstrap])

  const to = loc?.to
  return (
    <div className="sc-journey">
      <div style={{ opacity: 0.85, fontSize: 13 }}>{loc?.from ? t('sc.journey.from', { name: loc.from.name }) : t('sc.journey.title')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {to && <DestEmblem d={to} size={44} />}
        <div className="display" style={{ fontSize: 22 }}>{t('sc.journey.to', { name: to?.name ?? loc?.name ?? '' })}</div>
      </div>
      <div className="sc-road">
        <i style={{ width: `${frac * 100}%` }} />
        <b style={{ left: `${frac * 100}%` }}><Emboss name={MODE_ICON[loc?.mode_code ?? ''] ?? 'plane'} palette="gold" size={26} /></b>
      </div>
      {loc?.mode_code && <div style={{ fontSize: 13, color: '#dfe4ff' }}>{t('sc.journey.by', { mode: modeName(loc.mode_code, loc.mode_name) })}</div>}
      {done ? (
        <>
          <div className="display" style={{ fontSize: 26, color: '#ffd66b' }}>{t('sc.journey.arrived')}</div>
          <Slab tone="gold" radius={14} lip={4} onClick={() => { void refreshBootstrap().then(() => openLocal('support_journey')) }}>{t('sc.journey.enter')}</Slab>
        </>
      ) : (
        <>
          <div className="sc-timer display">{hms(left)}</div>
          <div style={{ fontSize: 13, color: '#dfe4ff' }}>{t('sc.journey.left')}</div>
        </>
      )}
    </div>
  )
}

// -- a foreign village -------------------------------------------------------

/** A village the player travelled to: the village scene (its coarse view) and
 * the way back out. */
export function VillageVisit(props: ScreenProps) {
  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <VillageHome {...props} />
      <div className="sc-side" style={{ top: 172 }}>
        <button className="k-hdr-btn" onClick={() => props.openLocal('support_travel')} aria-label={t('sc.travel')}><Emboss name="plane" palette="teal" size={22} /></button>
      </div>
    </div>
  )
}

// -- a promise ---------------------------------------------------------------

export function SupportSoon({ openLocal, localArgs }: ScreenProps) {
  const what = localArgs?.what ?? 'reserve'
  const svcIcon = what === 'reserve' ? 'crowncoin' : 'city'
  return (
    <ScreenScroll>
      <Header title={t('sc.soon.title')} tone="gold" onBack={() => openLocal('support_home')} />
      <Card tone="gold">
        <div className="sc-soon">
          <Emboss name={svcIcon} palette="gold" size={56} />
          <div className="display" style={{ fontSize: 18 }}>{t(what === 'reserve' ? 'sc.svc.reserve' : 'sc.soon.title')}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('sc.soon.reserve')}</div>
          <Chip tone="gold">{t('sc.soon.title')}</Chip>
        </div>
      </Card>
    </ScreenScroll>
  )
}
