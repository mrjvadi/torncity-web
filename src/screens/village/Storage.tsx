// «انبار و بازار»: the village's shared storage. Capacity used/total, what the
// stock holds, and Support's market: the materials the village can buy, at a
// unit price, with a quantity-preset and confirm flow for whoever the server
// lets spend the treasury (`can_buy`). Reachable from the village menu and
// from the civic hall and the granary, so a village with no granary can still
// see its stock. Also the server screen `village_materials`.

import { useEffect, useMemo, useState } from 'react'
import { GoodsTools, useGoodsFilter } from '../../ui/v6/goodsFilter'
import { FillBar, ItemGrid, itemIconName } from '../../ui/v6/ItemGrid'
import GoodsCard from '../../ui/v6/GoodsCard'
import { CardGrid, PCard, PTabs } from '../../ui/v6/panel'
import type { InventoryView } from '../../api/views.gen'
import Popup, { ActionButton, ActionRow, CostSummary, Hero, Medallion, RequirementList } from '../../ui/Popup'
import { Slab } from '../../kit'
import { Note } from '../../ui/Popup'
import { Card, Empty, Header, Notice, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import { money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { t, type Key } from '../../i18n'
import type { ScreenProps } from '../types'
import type { MaterialBuyConfirmView, MaterialMarketLineView, VillageMaterialsView } from '../../api/types'
import { useContentNames, useVillageCommand } from '../../village/useVillage'
import { useVillageView } from './common'
import { dateText } from '../life/common'
import './village.css'

/** A share in basis points as a percentage with its real decimals (5 bps is «۰٫۰۵٪», never a rounded «۰٪»). */
function bpsText(bps: number): string {
  const s = (bps / 100).toFixed(2).replace(/\.?0+$/, '')
  return `${s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]).replace('.', '٫')}٪`
}

export default function Storage({ response, openLocal, run }: ScreenProps) {
  const names = useContentNames()
  const city = names.name('city', 'support', 'support')
  const goods = (i: { code: string; name: string }) => names.name(['component', 'item'], i.code, i.name)
  const cmd = useVillageCommand()
  const { view: fetched, loading, refresh } = useVillageView<VillageMaterialsView>('settlement.materials', response?.screen === 'village_materials' ? response : null)
  const [local, setLocal] = useState<{ view: VillageMaterialsView; base: VillageMaterialsView | null } | null>(null)
  const [ask, setAsk] = useState<MaterialBuyConfirmView | null>(null)
  const [busy, setBusy] = useState(false)
  // a fresh answer from the server wins over a purchase result kept here
  const v = local && local.base === fetched ? local.view : fetched
  const back = () => openLocal('village_home')

  async function prepare(line: MaterialMarketLineView, qty: number) {
    setBusy(true)
    const r = await cmd('settlement.materials.buy', { item: line.item.code, qty: String(qty) })
    setBusy(false)
    if (r.ok && r.res?.view) setAsk(r.res.view as unknown as MaterialBuyConfirmView)
  }

  async function confirm(a: MaterialBuyConfirmView) {
    setBusy(true)
    const r = await cmd('settlement.materials.buy', { item: a.item.code, qty: String(a.qty), confirm: 'confirm' }, { write: true })
    setBusy(false)
    setAsk(null)
    if (r.ok && r.res?.view) setLocal({ view: r.res.view as unknown as VillageMaterialsView, base: fetched })
    else void refresh()
  }

  const stock = v?.stock ?? []
  // the store's goods: search, the shelf groups, sorting (the market is a screen of its own)
  const rows = useMemo(() => stock.map((s) => ({ item: s.item, name: goods(s.item), category: names.category(['component', 'item'], s.item.code), qty: s.qty })), [stock, names]) // eslint-disable-line react-hooks/exhaustive-deps
  const f = useGoodsFilter(rows, ['name', 'qty'])
  const [tab, setTab] = useState<'city' | 'mine'>('city')
  const [mine, setMine] = useState<InventoryView | null>(null)
  useEffect(() => {
    if (tab !== 'mine') return
    void cmd('inventory.show', {}, { silent: true }).then((r) => { if (r.ok && r.res?.view) setMine(r.res.view as unknown as InventoryView) })
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState<{ code: string; name: string; qty: number } | null>(null)
  if (loading && !v) return <ScreenScroll><Header title={t('storage.title')} tone="sapphire" onBack={back} /></ScreenScroll>
  const market = v?.market ?? []
  const reserved = (v?.classes ?? []).reduce((n, c) => n + c.reserved, 0)

  async function move(command: 'settlement.stock.donate' | 'settlement.stock.take', qty: number) {
    if (!pick) return
    setBusy(true)
    const r = await cmd(command, { item: pick.code, qty: String(qty) }, { write: true })
    setBusy(false)
    setPick(null)
    if (r.ok && r.res?.view) setLocal({ view: r.res.view as unknown as VillageMaterialsView, base: fetched })
    else void refresh()
  }

  return (
    <ScreenScroll>
      <Header title={t('storage.title')} tone="sapphire" onBack={back} onRefresh={() => { setLocal(null); void refresh() }} />
      <PTabs tabs={[{ key: 'city', label: t('sm.tab.city') }, { key: 'mine', label: t('sm.tab.home') }]} value={tab} onChange={(k) => setTab(k as 'city' | 'mine')} />

      {tab === 'mine' && (
        <>
          {!mine?.home && <Notice>{t('sm.home.none')}</Notice>}
          {mine?.home && (
            <>
              <FillBar used={mine.home.used} capacity={mine.home.capacity} label={t('sm.home.title')} figures={`${formatNumber(mine.home.used)} / ${formatNumber(mine.home.capacity)}`} />
              {!mine.home.here && <Notice>{t('sm.home.away')}</Notice>}
              {(mine.home.lines ?? []).length === 0 ? <Note>{t('sm.home.empty')}</Note>
                : <ItemGrid cells={(mine.home.lines ?? []).map((l, i) => ({ key: `${l.item.code}${i}`, name: goods(l.item), icon: itemIconName(l.item.code, l.shelf?.group), qty: l.qty }))} label={t('sm.home.title')} />}
            </>
          )}
        </>
      )}

      {tab === 'city' && v && (
        <>
          <div className="tr-door"><ActionButton tone="gold" small onClick={() => run('settlement.trade')}>{t('tr.door')}</ActionButton></div>
          {v.bought && (
            <Notice>{t('storage.bought', { qty: formatNumber(v.bought.qty), name: goods(v.bought.item), total: money(v.bought.total) })}</Notice>
          )}
          {v.transition?.until && <Notice>{t('sm.st.transition', { date: dateText(v.transition.until) })}</Notice>}
          {(v.classes ?? []).map((c) => (
            <div key={c.class} className="st-class">
              <FillBar over={c.over} used={c.used} reserved={c.reserved} capacity={c.capacity} label={t(`sm.st.class.${c.class}` as Key)}
                figures={`${formatNumber(c.used + c.reserved)} / ${formatNumber(c.capacity)}`} />
              {c.borrowed > 0 && <div className="gc-note">{t('sm.st.borrowed', { n: formatNumber(c.borrowed) })}</div>}
              {c.over > 0 && (
                <Notice alert>
                  {t('sm.st.class_over', { n: formatNumber(c.over) })}
                  {(c.build ?? []).length > 0 && <> {t('sm.st.class_build', { names: (c.build ?? []).map((b) => names.name('settlement_building', b.code, b.name)).join('، ') })}</>}
                </Notice>
              )}
            </div>
          ))}
          <div className="gc-note">{t('sm.st.total', { used: formatNumber(v.used + reserved), cap: formatNumber(v.capacity) })}</div>
          {(v.stores ?? []).length > 0 && (
            <>
              <SectionTitle>{t('sm.st.stores')}</SectionTitle>
              <CardGrid>
                {(v.stores ?? []).map((st, i) => (
                  <PCard key={i} icon="chest" title={names.name('settlement_building', st.building.code, st.building.name)}
                    sub={st.kept ? t('sm.st.kept', { wage: money(v.wage) }) : st.communal_room > 0 ? t('sm.st.communal', { n: formatNumber(st.communal_room) }) : st.grace_until ? t('sm.st.grace', { date: dateText(st.grace_until) }) : t('sm.st.unkept')} tone={st.kept ? 'good' : st.communal_room > 0 || st.grace_until ? 'busy' : 'danger'}
                    facts={st.kept ? undefined : st.communal_room > 0 ? t('sm.st.communal_why') : t('sm.st.unkept_why')} />
                ))}
              </CardGrid>
            </>
          )}
          {v.spoil_bps > 0 && <div className="gc-note">{t('sm.st.spoil', { p: bpsText(v.spoil_bps) })}</div>}

          <SectionTitle>{t('storage.stock')}</SectionTitle>
          {stock.length === 0
            ? <Empty>{t('storage.stock_empty')}</Empty>
            : (
              <>
                <GoodsTools f={f as never} />
                {f.shown.length === 0 && <p className="pn-hint">{t('goods.none')}</p>}
                <ItemGrid label={t('storage.stock')}
                  cells={f.shown.map((r) => ({ key: r.item.code, name: r.name, icon: itemIconName(r.item.code, r.category), qty: r.qty, onClick: () => setPick({ code: r.item.code, name: r.name, qty: r.qty ?? 0 }) }))} />
              </>
            )}

          <SectionTitle>{t('sm.st.procure')}</SectionTitle>
          <div className="vh-hint" style={{ textAlign: 'start' }}>{t('sm.st.procure_hint', { city })}</div>
          {market.length === 0 && <Empty>{t('storage.market_empty')}</Empty>}
          <CardGrid>
            {market.map((m) => (
              <GoodsCard key={m.item.code} code={m.item.code} name={goods(m.item)} price={t('storage.unit_price', { p: money(m.price) })} source={t('storage.source', { city })}
                foot={v.can_buy ? (
                  <span className="ig-src">
                    {(v.presets ?? []).map((q) => <Slab key={q} tone="gold" radius={12} lip={3} disabled={busy} onClick={() => void prepare(m, q)}>{formatNumber(q)}</Slab>)}
                  </span>
                ) : undefined} />
            ))}
          </CardGrid>
          {!v.can_buy && market.length > 0 && <div className="vh-hint">{t('storage.head_only')}</div>}
        </>
      )}

      <Popup open={!!pick} onClose={() => setPick(null)} title={pick?.name} tone="gold" dismissible={!busy}>
        {pick && (
          <>
            <Note>{t('sm.pop.qty', { n: formatNumber(pick.qty) })}</Note>
            <Note>{t('sm.st.donate_hint')}</Note>
            <ActionRow>
              {[1, 5, 10].map((q) => <ActionButton key={q} tone="green" small busy={busy} onClick={() => void move('settlement.stock.donate', q)}>{t('sm.st.donate')} {formatNumber(q)}</ActionButton>)}
            </ActionRow>
            {v?.can_buy
              ? <ActionRow>{[1, 5, 10].map((q) => <ActionButton key={q} tone="steel" small busy={busy} disabled={pick.qty < q} onClick={() => void move('settlement.stock.take', q)}>{t('sm.st.take')} {formatNumber(q)}</ActionButton>)}</ActionRow>
              : <Note>{t('sm.st.take_head')}</Note>}
          </>
        )}
      </Popup>

      <Popup
        open={!!ask} onClose={() => setAsk(null)} title={t('storage.confirm.title')} tone="green" dismissible={!busy}
        footer={ask && (
          <ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</ActionButton>
            <ActionButton tone="green" onClick={() => void confirm(ask)} busy={busy} disabled={ask.treasury < ask.total || ask.free < ask.qty} reason={ask.treasury < ask.total ? t('storage.need.funds_short') : ask.free < ask.qty ? t('storage.need.space_short') : undefined}>{t('storage.confirm.yes', { total: money(ask.total) })}</ActionButton>
          </ActionRow>
        )}
      >
        {ask && (
          <>
            <Hero><Medallion icon="box" palette="amber" ring="#2f9d5b" chip={goods(ask.item)} /></Hero>
            <RequirementList
              lines={[
                { icon: 'coins', palette: 'gold', label: t('storage.need.funds'), state: ask.treasury >= ask.total ? 'met' : 'missing', detail: t('storage.need.funds_d', { have: money(ask.treasury), need: money(ask.total) }) },
                { icon: 'box', palette: 'amber', label: t('storage.need.space'), state: ask.free >= ask.qty ? 'met' : 'missing', detail: t('storage.need.space_d', { free: formatNumber(ask.free), need: formatNumber(ask.qty) }) },
              ]}
            />
            <CostSummary
              lines={[{ label: t('storage.cost.line', { qty: formatNumber(ask.qty), name: goods(ask.item), unit: money(ask.unit) }), amount: money(ask.total) }]}
              total={{ amount: money(ask.total) }}
            />
          </>
        )}
      </Popup>
    </ScreenScroll>
  )
}
