// The village's status screens, built on the same native kit as every other
// screen (ribbon header, cards, rows, bars): overview, construction progress
// with live timers, knowledge (research / buy) and the roster with online
// dots. Each keeps its command answer fresh and re-reads it when the
// settlement channel reports a change.

import { useEffect, useState } from 'react'
import type { ScreenProps } from '../types'
import { Bar, Card, Chip, Empty, Header, ListRow, Notice, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import BottomSheet from '../../ui/BottomSheet'
import { hms, money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { t, type Key } from '../../i18n'
import type {
  ConstructionProgressView, KnowledgeLineView, KnowledgeListView, VillageOverviewView,
} from '../../api/types'
import { buildingName, useBuildingCatalogue, useNow, useSettlementId, useVillage, useVillageCommand } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import { countdown, durationText, iconForRole, RowCard, ROLE_TONE, useVillageView } from './common'
import { useToast } from '../../state/ToastContext'
import './village.css'

const back = (openLocal: ScreenProps['openLocal']) => () => openLocal('village_home')

// -- overview ----------------------------------------------------------------------------------

export function Overview({ response, openLocal }: ScreenProps) {
  const cat = useBuildingCatalogue()
  const { view: v, loading, refresh } = useVillageView<VillageOverviewView>('settlement.overview', response)
  if (loading && !v) return <ScreenScroll><Header title={t('overview.title')} tone="emerald" onBack={back(openLocal)} /></ScreenScroll>
  const bars: { key: Key; frac: number; color: string }[] = v ? [
    { key: 'overview.food', frac: v.food_percent / 100, color: '#4cc47e' },
    { key: 'overview.job', frac: v.job_percent / 100, color: '#f2c255' },
    { key: 'overview.service', frac: v.service_percent / 100, color: '#5aa0f0' },
    { key: 'overview.happiness', frac: v.happiness_percent / 100, color: '#e8709a' },
    { key: 'overview.security', frac: v.security_percent / 100, color: '#e5484d' },
    { key: 'overview.literacy', frac: v.literacy_percent / 100, color: '#8e6cf0' },
  ] : []
  return (
    <ScreenScroll>
      <Header title={v?.name ?? t('overview.title')} tone="emerald" onBack={back(openLocal)} onRefresh={() => void refresh()} />
      {v && (
        <>
          <Card tone="emerald">
            <div className="vs-grid">
              <div><div className="nx-stat-label">{t('overview.population')}</div><div className="display" style={{ fontSize: 20 }}><span className="vs-ltr">{formatNumber(v.population)} / {formatNumber(v.population_cap)}</span></div></div>
              <div><div className="nx-stat-label">{t('overview.treasury')}</div><div className="display" style={{ fontSize: 20, color: 'var(--gold)' }}>{money(v.treasury)}</div></div>
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bars.map((b) => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 54, fontSize: 12.5, color: 'var(--text-dim)' }}>{t(b.key)}</span>
                  <div style={{ flex: 1 }}><Bar frac={b.frac} color={b.color} label={`${Math.round(b.frac * 100)}%`} /></div>
                </div>
              ))}
            </div>
          </Card>
          <SectionTitle>{t('overview.buildings')}</SectionTitle>
          {(v.buildings ?? []).length === 0 && <Empty>{t('overview.no_buildings')}</Empty>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(v.buildings ?? []).map((b, i) => {
              const { icon, palette } = iconForRole(b.role)
              return <ListRow key={i} icon={icon} palette={palette} tone={ROLE_TONE[b.role]} title={buildingName(cat, b.building.code, b.building.name)} sub={t(`role.${b.role}` as Key)} />
            })}
          </div>
        </>
      )}
    </ScreenScroll>
  )
}

// -- construction progress -------------------------------------------------------------------------

export function Progress({ response, openLocal }: ScreenProps) {
  const id = useSettlementId()
  const { layout, store } = useVillage(id)
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const { view: v, loading, refresh } = useVillageView<ConstructionProgressView>('settlement.build.progress', response)
  const [ask, setAsk] = useState<string | null>(null)
  // a finished build drops out of the list the moment its timer ends and the
  // server confirms (channel event -> re-read); until then it shows "finishing"
  const lines = v?.lines ?? []
  const canPlace = !!layout?.viewer.can_place

  async function cancel(bid: string) {
    const r = await cmd('settlement.build.cancel', { id: bid }, { write: true })
    setAsk(null)
    if (r.ok) {
      toast.push(t('building.cancelled'))
      void store?.refetchLayout()
      void refresh()
    }
  }

  return (
    <ScreenScroll>
      <Header title={t('progress.title')} tone="gold" onBack={back(openLocal)} onRefresh={() => void refresh()} />
      {loading && !v && <Empty>…</Empty>}
      {!loading && lines.length === 0 && <Empty>{t('progress.empty')}</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((l, i) => {
          // the layout knows when it started; the view only when it ends
          const lb = layout?.buildings.find((b) => b.x === l.lot_x && b.y === l.lot_y && b.type === l.building.code)
          const finish = l.finish_at ?? lb?.finish_at ?? null
          const p = lb ? constructionProgress({ ...lb, finish_at: finish ?? lb.finish_at }, now) : null
          const leftS = finish ? (Date.parse(finish) - now) / 1000 : l.left_seconds
          const catRole = cat.get(l.building.code)?.category
          const { icon, palette } = iconForRole(catRole)
          return (
            <RowCard
              key={`${l.lot_x}-${l.lot_y}-${i}`}
              tone={ROLE_TONE[catRole ?? ''] === 'gold' ? undefined : ROLE_TONE[catRole ?? '']}
              icon={icon} palette={palette}
              title={buildingName(cat, l.building.code, l.building.name)}
              sub={`${t('building.at', { x: l.lot_x + 1, y: l.lot_y + 1 })} · ${l.state === 'queued' ? t('progress.queued') : t('progress.building')}`}
              right={<span className="vs-timer">{leftS > 0 ? hms(leftS) : t('progress.done_soon')}</span>}
            >
              {p !== null && <Bar frac={p} color="#f5a11f" label={t('progress.percent', { p: Math.round(p * 100) })} />}
              {canPlace && lb?.id && (
                <div className="vs-btns">
                  {ask === lb.id
                    ? <>
                      <Slab tone="steel" radius={12} lip={3} onClick={() => setAsk(null)}>{t('building.no')}</Slab>
                      <Slab tone="red" radius={12} lip={3} onClick={() => void cancel(lb.id!)}>{t('building.yes')}</Slab>
                    </>
                    : <Slab tone="red" radius={12} lip={3} onClick={() => setAsk(lb.id!)}>{t('building.cancel')}</Slab>}
                </div>
              )}
              {ask === lb?.id && <div className="vh-confirm">{t('building.confirm_cancel')}</div>}
            </RowCard>
          )
        })}
      </div>
    </ScreenScroll>
  )
}

// -- knowledge -----------------------------------------------------------------------------------------

/** How far the running research is: its total time is the list line's own. */
function runFrac(v: KnowledgeListView, now: number): number {
  const run = v.running
  if (!run?.finish_at) return 0
  const total = (v.lines ?? []).find((l) => l.knowledge.code === run.knowledge.code)?.research_time_seconds ?? 0
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, 1 - (Date.parse(run.finish_at) - now) / 1000 / total))
}

const STATE_TONE: Record<string, 'emerald' | 'gold' | 'ruby' | undefined> = { held: 'emerald', researching: 'gold', locked: undefined, available: undefined }

export function Knowledge({ response, openLocal }: ScreenProps) {
  const id = useSettlementId()
  const { layout } = useVillage(id)
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const { view: v, loading, refresh } = useVillageView<KnowledgeListView>('settlement.knowledge', response)
  const [ask, setAsk] = useState<{ kind: 'buy' | 'research'; line: KnowledgeLineView } | null>(null)
  const [busy, setBusy] = useState(false)
  const canAct = !!layout?.viewer.can_place

  async function go() {
    if (!ask) return
    setBusy(true)
    const r = await cmd(ask.kind === 'buy' ? 'settlement.knowledge.buy' : 'settlement.knowledge.research', { code: ask.line.knowledge.code }, { write: true })
    setBusy(false)
    setAsk(null)
    if (r.ok) { toast.push(t('know.done')); void refresh() }
  }

  useEffect(() => {
    // a finished research flips state on the server; the channel event re-reads
    // it, and this covers a missed one
    const run = v?.running
    if (!run?.finish_at) return
    const wait = Date.parse(run.finish_at) - now
    if (wait < -2000 && wait > -60_000) void refresh()
  }, [v?.running, now, refresh])

  return (
    <ScreenScroll>
      <Header title={t('know.title')} tone="violet" onBack={back(openLocal)} onRefresh={() => void refresh()} />
      {loading && !v && <Empty>…</Empty>}
      {v && (
        <>
          <Card tone="violet">
            <div className="vs-grid">
              <div><div className="nx-stat-label">{t('know.treasury')}</div><div className="display" style={{ fontSize: 18, color: 'var(--gold)' }}>{money(v.treasury)}</div></div>
              <div><div className="nx-stat-label">{t('know.literacy')}</div><div className="display" style={{ fontSize: 18 }}>{v.literacy_percent}%</div></div>
            </div>
            {v.running && (
              <div style={{ marginTop: 10 }}>
                <div className="nx-stat-label">{t('know.running')}: {v.running.knowledge.name}</div>
                <Bar frac={runFrac(v, now)} color="#8e6cf0" label={countdown(v.running.finish_at, now)} />
              </div>
            )}
          </Card>
          {!canAct && <Notice>{t('know.only_head')}</Notice>}
          {(v.lines ?? []).length === 0 && <Empty>{t('know.empty')}</Empty>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(v.lines ?? []).map((l) => {
              const held = l.state === 'held'
              const locked = l.state === 'locked'
              const missing = (l.missing ?? []).map((m) => m.name).join('، ')
              const sub = held ? t('know.state.held')
                : locked ? (!l.terrain_ok ? t('know.terrain') : missing ? t('know.missing', { list: missing }) : t('know.state.locked'))
                  : `${t('know.cost', { n: formatNumber(l.research_cost) })} · ${t('know.time', { t: durationText(l.research_time_seconds) })}`
              return (
                <RowCard
                  key={l.knowledge.code} tone={STATE_TONE[l.state]}
                  icon={held ? 'check' : locked ? 'm_lock' : l.state === 'researching' ? 'clock' : 'book'}
                  palette={held ? 'emerald' : locked ? 'steel' : l.state === 'researching' ? 'gold' : 'violet'}
                  title={l.knowledge.name} sub={sub}
                  right={<Chip tone={held ? 'emerald' : l.state === 'researching' ? 'gold' : undefined}>{t(`know.state.${l.state}` as Key)}</Chip>}
                >
                  {canAct && l.state === 'available' && (
                    <div className="vs-btns">
                      <Slab tone="gold" radius={12} lip={3} onClick={() => setAsk({ kind: 'research', line: l })}>{t('know.research')}</Slab>
                      {l.buy_price > 0 && <Slab tone="blue" radius={12} lip={3} onClick={() => setAsk({ kind: 'buy', line: l })}>{t('know.buy')} · {formatNumber(l.buy_price)}</Slab>}
                    </div>
                  )}
                </RowCard>
              )
            })}
          </div>
          {v.hidden > 0 && <div className="nx-bar-sub" style={{ textAlign: 'center' }}>{t('know.hidden', { n: formatNumber(v.hidden) })}</div>}
        </>
      )}
      <BottomSheet open={!!ask} onClose={() => setAsk(null)} title={ask?.line.knowledge.name}>
        {ask && (
          <>
            <div className="vh-confirm">
              {ask.kind === 'buy'
                ? t('know.confirm_buy', { name: ask.line.knowledge.name, price: money(ask.line.buy_price) })
                : t('know.confirm_research', { name: ask.line.knowledge.name, cost: money(ask.line.research_cost) })}
            </div>
            <div className="vh-sheet-actions">
              <Slab tone="steel" radius={14} lip={4} onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</Slab>
              <Slab tone="green" radius={14} lip={4} onClick={() => void go()} disabled={busy}>{t('building.yes')}</Slab>
            </div>
          </>
        )}
      </BottomSheet>
    </ScreenScroll>
  )
}

// -- roster ---------------------------------------------------------------------------------------------

export function Who({ openLocal }: ScreenProps) {
  const id = useSettlementId()
  const { players, playersError, store, status } = useVillage(id)
  useEffect(() => { void store?.refetchPlayers() }, [store, status])
  const list = [...(players?.players ?? [])].sort((a, b) => Number(!!b.online) - Number(!!a.online) || (a.name ?? '').localeCompare(b.name ?? '', 'fa'))
  return (
    <ScreenScroll>
      <Header title={t('who.title')} tone="teal" onBack={back(openLocal)} onRefresh={() => void store?.refetchPlayers()} />
      {playersError === 'forbidden' && <Notice>{t('who.forbidden')}</Notice>}
      {players?.hidden && <Notice>{t('who.hidden')}</Notice>}
      {players && !players.hidden && <div className="nx-bar-sub" style={{ textAlign: 'center' }}>{t('who.count', { n: players.online, total: list.length })}</div>}
      {players && list.length === 0 && <Empty>{t('who.empty')}</Empty>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((p) => {
          const known = p.visible && !players?.hidden
          const label = p.activity_label || (p.activity ? t(`activity.${p.activity}` as Key) : '')
          return (
            <ListRow
              key={p.id}
              icon={known && p.online ? 'person' : 'person'}
              palette={known && p.online ? 'emerald' : 'steel'}
              title={<span><i className={`vs-dot${known && p.online ? ' on' : ''}`} />{p.name ?? t('who.unknown')}</span>}
              sub={known ? [label, p.code].filter(Boolean).join(' · ') : t('who.unknown')}
              right={known ? (p.online ? t('who.online') : t('who.offline')) : undefined}
            />
          )
        })}
      </div>
    </ScreenScroll>
  )
}
