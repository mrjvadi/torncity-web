// The village's status screens, built on the same native kit as every other
// screen (ribbon header, cards, rows, bars): overview, construction progress
// with live timers, knowledge (research / buy) and the roster with online
// dots. Each keeps its command answer fresh and re-reads it when the
// settlement channel reports a change.

import { useEffect, useState } from 'react'
import DonateSheet from './Donate'
import type { ScreenProps } from '../types'
import { Bar, Card, Chip, Empty, Header, ListRow, Notice, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import { Slab } from '../../kit'
import Popup, { ActionButton, ActionRow, Hero, Medallion, Note, StatCard, StatGrid } from '../../ui/Popup'
import { hms, money, moneyIn } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { hasKey, t, type Key } from '../../i18n'
import type {
  ConstructionProgressView, KnowledgeLineView, KnowledgeListView, VillageOverviewView,
} from '../../api/types'
import { buildingName, useBuildingCatalogue, useContentNames, useNow, useSettlementId, useVillage, useVillageCommand } from '../../village/useVillage'
import { constructionProgress } from '../../village/progress'
import { countdown, durationText, iconForRole, RowCard, ROLE_TONE, useVillageView } from './common'
import { useToast } from '../../state/ToastContext'
import './village.css'

const back = (openLocal: ScreenProps['openLocal']) => () => openLocal('village_home')

// -- overview ----------------------------------------------------------------------------------

export function Overview({ response, run, openLocal, localArgs }: ScreenProps) {
  const cat = useBuildingCatalogue()
  const id = useSettlementId()
  const { players, store, status } = useVillage(id)
  const { res, view: v, loading, refresh } = useVillageView<VillageOverviewView>('settlement.overview', response)
  const [donate, setDonate] = useState(!!localArgs?.donate)
  useEffect(() => { void store?.refetchPlayers() }, [store, status])
  if (loading && !v) return <ScreenScroll><Header title={t('overview.title')} tone="emerald" onBack={back(openLocal)} /></ScreenScroll>
  const bars: { key: Key; frac: number; color: string }[] = v ? [
    { key: 'overview.food', frac: v.food_percent / 100, color: '#4cc47e' },
    { key: 'overview.job', frac: v.job_percent / 100, color: '#f2c255' },
    { key: 'overview.service', frac: v.service_percent / 100, color: '#5aa0f0' },
    { key: 'overview.happiness', frac: v.happiness_percent / 100, color: '#e8709a' },
    { key: 'overview.security', frac: v.security_percent / 100, color: '#e5484d' },
    { key: 'overview.literacy', frac: v.literacy_percent / 100, color: '#8e6cf0' },
  ] : []
  const promo = v?.promotion ?? null
  const done = promo ? (promo.criteria ?? []).filter((c) => c.met).length : 0
  const promoteAct = (res?.actions ?? []).find((a) => a.id === 'village.promote')
  const detailAct = (res?.actions ?? []).find((a) => a.id === 'village.promotion')
  const role = v?.is_head ? t('village.head') : v?.resident ? t('village.member') : t('village.visitor')
  return (
    <ScreenScroll>
      <Header title={v?.name ?? t('overview.title')} tone="emerald" onBack={back(openLocal)} onRefresh={() => void refresh()} />
      {v && (
        <>
          <Card tone="emerald">
            <div className="vs-grid">
              <div>
                <div className="nx-stat-label">{t('overview.population')}</div>
                <div className="display" style={{ fontSize: 20 }}>{t('vx.ov.people', { n: formatNumber(v.population) })}</div>
                {v.population_cap > 0 && <div className="nx-bar-sub">{t('vx.ov.cap', { n: formatNumber(v.population_cap) })}</div>}
              </div>
              <div><div className="nx-stat-label">{t('overview.treasury')}</div><div className="display" style={{ fontSize: 20, color: 'var(--gold)' }}>{money(v.treasury)}</div></div>
            </div>
            <div className="vs-grid" style={{ marginTop: 10 }}>
              <div><div className="nx-stat-label">{t('village.sheet.tier')}</div><div>{tierText(v.tier)}</div></div>
              <div><div className="nx-stat-label">{t('village.sheet.role')}</div><div>{role}</div></div>
              {players && !players.hidden && <div><div className="nx-stat-label">{t('village.sheet.online')}</div><div>{formatNumber(players.online)}</div></div>}
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
          {promo && (
            <Card tone="violet">
              <SectionTitle>{t('vx.promo.title', { tier: tierText(promo.to) })}</SectionTitle>
              <div className="vh-hint" style={{ textAlign: 'start' }}>{t('vx.ov.steps', { done, total: (promo.criteria ?? []).length })}</div>
              <div className="vs-btns">
                {detailAct?.command && <Slab tone="steel" radius={12} lip={3} onClick={() => run(detailAct.command!, detailAct.args)}>{t('vx.ov.steps_open')}</Slab>}
                {promoteAct?.command && <Slab tone="gold" radius={12} lip={3} onClick={() => run(promoteAct.command!, promoteAct.args)}>{t('vx.ov.promote', { tier: tierText(promo.to) })}</Slab>}
              </div>
            </Card>
          )}
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
      <DonateSheet open={donate} onClose={() => setDonate(false)} onDone={() => void refresh()} />
    </ScreenScroll>
  )
}

const tierText = (tier: string) => t(`village.tier.${tier}` as Key)

// -- construction progress -------------------------------------------------------------------------

export function Progress({ response, openLocal, run }: ScreenProps) {
  const id = useSettlementId()
  const { layout, store } = useVillage(id)
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const cmd = useVillageCommand()
  const toast = useToast()
  const { res, view: v, loading, refresh } = useVillageView<ConstructionProgressView>('settlement.build.progress', response)
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
          if (l.by_work) {
            // raised by work: no timer, it moves only as workers put hours in
            const siteAct = (res?.actions ?? []).find((a) => a.id === 'construction.site' && a.args?.id === l.id)
            const hours = (m: number) => (Math.max(0, m) / 60).toFixed(1)
            return (
              <RowCard
                key={`${l.lot_x}-${l.lot_y}-${i}`} icon={icon} palette={palette}
                title={buildingName(cat, l.building.code, l.building.name)}
                sub={`${t('building.at', { x: l.lot_x + 1, y: l.lot_y + 1 })} · ${t('vx.prog.by_work')}`}
                right={<span className="vs-timer">{t('progress.percent', { p: Math.floor(l.progress_bps / 100) })}</span>}
              >
                <Bar frac={l.progress_bps / 10000} color="#f5a11f" label={`${Math.floor(l.progress_bps / 100)}%`} />
                <div className="vh-hint">{t('vx.prog.hours', { done: hours(l.done_minutes), total: hours(l.required_minutes) })}</div>
                <div className="vs-btns">
                  <Slab tone="gold" radius={12} lip={3} onClick={() => run(siteAct?.command ?? 'settlement.labor.site', siteAct?.args ?? { id: l.id })}>{t('act.construction.site')}</Slab>
                </div>
              </RowCard>
            )
          }
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
  const names = useContentNames()
  const cat = useBuildingCatalogue()
  const kname = (n: { code: string; name: string }) => names.name('knowledge', n.code, n.name)
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
              <div><div className="nx-stat-label">{t('know.treasury')}</div><div className="display" style={{ fontSize: 18, color: 'var(--gold)' }}>{moneyIn(v.treasury, v.currency)}</div></div>
              <div><div className="nx-stat-label">{t('know.literacy')}</div><div className="display" style={{ fontSize: 18 }}>{v.literacy_percent}%</div></div>
            </div>
            {v.running && (
              <div style={{ marginTop: 10 }}>
                <div className="nx-stat-label">{t('know.running')}: {kname(v.running.knowledge)}</div>
                <Bar frac={runFrac(v, now)} color="#8e6cf0" label={countdown(v.running.finish_at, now)} />
              </div>
            )}
          </Card>
          {!canAct && <Notice>{t('know.only_head')}</Notice>}
          {(v.lines ?? []).some((l) => l.state === 'available') && <div className="nx-bar-sub">{t('know.explain')}</div>}
          {(v.lines ?? []).length === 0 && <Empty>{t('know.empty')}</Empty>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(v.lines ?? []).map((l) => {
              const held = l.state === 'held'
              const locked = l.state === 'locked'
              const missing = (l.missing ?? []).map(kname).join('، ')
              const cur = v.currency
              const short = l.research_cost - v.treasury
              const buyShort = l.buy_price - v.treasury
              const sub = held ? t('know.state.held')
                : locked ? (missing ? t('know.missing', { list: missing }) : t('know.state.locked'))
                  : `${t('know.cost', { n: moneyIn(l.research_cost, cur) })} · ${t('know.time', { t: durationText(l.research_time_seconds) })}`
              const opens = (l.unlocks ?? []).map((u) => t(`know.unlock.${u.kind}` as Key, {
                name: u.kind === 'building' ? buildingName(cat, u.item.code, u.item.name) : u.kind === 'course' ? names.name('course', u.item.code, u.item.name) : kname(u.item),
              }))
              return (
                <RowCard
                  key={l.knowledge.code} tone={STATE_TONE[l.state]}
                  icon={held ? 'check' : locked ? 'm_lock' : l.state === 'researching' ? 'clock' : 'book'}
                  palette={held ? 'emerald' : locked ? 'steel' : l.state === 'researching' ? 'gold' : 'violet'}
                  title={kname(l.knowledge)} sub={sub}
                  right={<Chip tone={held ? 'emerald' : l.state === 'researching' ? 'gold' : undefined}>{t(`know.state.${l.state}` as Key)}</Chip>}
                >
                  {!held && opens.length > 0 && <div className="nx-bar-sub">{t('know.unlocks', { list: opens.join('، ') })}</div>}
                  {l.state === 'available' && short > 0 && <div className="nx-bar-sub">{t('know.short', { n: moneyIn(short, cur) })}</div>}
                  {canAct && l.state === 'available' && (
                    <div className="vs-btns">
                      <Slab tone="gold" radius={12} lip={3} disabled={short > 0} onClick={() => setAsk({ kind: 'research', line: l })}>{t('know.research')}</Slab>
                      {l.buy_price > 0 && <Slab tone="blue" radius={12} lip={3} disabled={buyShort > 0} onClick={() => setAsk({ kind: 'buy', line: l })}>{t('know.buy')} · {moneyIn(l.buy_price, cur)}</Slab>}
                    </div>
                  )}
                </RowCard>
              )
            })}
          </div>
          {v.hidden > 0 && <div className="nx-bar-sub" style={{ textAlign: 'center' }}>{t('know.hidden', { n: formatNumber(v.hidden) })}</div>}
        </>
      )}
      <Popup
        open={!!ask} onClose={() => setAsk(null)} title={ask ? kname(ask.line.knowledge) : undefined} tone="violet" dismissible={!busy}
        footer={ask && (
          <ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</ActionButton>
            <ActionButton tone={ask.kind === 'buy' ? 'gold' : 'green'} onClick={() => void go()} busy={busy}>{t('building.yes')}</ActionButton>
          </ActionRow>
        )}
      >
        {ask && (
          <>
            <Hero><Medallion icon="book" palette="violet" ring="#8e6cf0" /></Hero>
            <StatGrid>
              <StatCard icon="coins" palette="gold" label={t(ask.kind === 'buy' ? 'know.stat.buy' : 'know.stat.research')} value={moneyIn(ask.kind === 'buy' ? ask.line.buy_price : ask.line.research_cost, v?.currency)} />
            </StatGrid>
            <Note>
              {ask.kind === 'buy'
                ? t('know.confirm_buy', { name: kname(ask.line.knowledge), price: moneyIn(ask.line.buy_price, v?.currency) })
                : t('know.confirm_research', { name: kname(ask.line.knowledge), cost: moneyIn(ask.line.research_cost, v?.currency) })}
            </Note>
          </>
        )}
      </Popup>
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
          const label = p.activity && hasKey(`activity.${p.activity}`) ? t(`activity.${p.activity}` as Key) : (p.activity_label ?? '')
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
