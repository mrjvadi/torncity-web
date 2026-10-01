// «انبار و بازار»: the village's shared storage. Capacity used/total, what the
// stock holds, and Support's market: the materials the village can buy, at a
// unit price, with a quantity-preset and confirm flow for whoever the server
// lets spend the treasury (`can_buy`). Reachable from the village menu and
// from the civic hall and the granary, so a village with no granary can still
// see its stock. Also the server screen `village_materials`.

import { useState } from 'react'
import Popup, { ActionButton, ActionRow, CostSummary, Hero, Medallion, RequirementList } from '../../ui/Popup'
import { Slab } from '../../kit'
import { Bar, Card, Chip, Empty, Header, ListRow, Notice, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import { money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { t } from '../../i18n'
import type { ScreenProps } from '../types'
import type { MaterialBuyConfirmView, MaterialMarketLineView, VillageMaterialsView } from '../../api/types'
import { useContentNames, useVillageCommand } from '../../village/useVillage'
import { useVillageView } from './common'
import './village.css'

export default function Storage({ response, openLocal }: ScreenProps) {
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

  if (loading && !v) return <ScreenScroll><Header title={t('storage.title')} tone="sapphire" onBack={back} /></ScreenScroll>
  const stock = v?.stock ?? []
  const market = v?.market ?? []
  const frac = v && v.capacity > 0 ? Math.min(1, v.used / v.capacity) : 0
  const full = !!v && v.capacity > 0 && v.used >= v.capacity

  return (
    <ScreenScroll>
      <Header title={t('storage.title')} tone="sapphire" onBack={back} onRefresh={() => { setLocal(null); void refresh() }} />
      {v && (
        <>
          {v.bought && (
            <Notice>{t('storage.bought', { qty: formatNumber(v.bought.qty), name: goods(v.bought.item), total: money(v.bought.total) })}</Notice>
          )}
          <Card tone="sapphire">
            <div className="vs-grid">
              <div>
                <div className="nx-stat-label">{t('storage.capacity')}</div>
                <div className="display" style={{ fontSize: 20 }}><span className="vs-ltr">{formatNumber(v.used)} / {formatNumber(v.capacity)}</span></div>
              </div>
              <div>
                <div className="nx-stat-label">{t('storage.treasury')}</div>
                <div className="display" style={{ fontSize: 20, color: 'var(--gold)' }}>{money(v.treasury)}</div>
              </div>
            </div>
            <Bar frac={frac} color={full ? '#e5484d' : '#5aa0f0'} label={t('storage.used', { p: Math.round(frac * 100) })} />
            {full && <div className="vh-hint">{t('storage.full')}</div>}
          </Card>

          <SectionTitle>{t('storage.stock')}</SectionTitle>
          {stock.length === 0
            ? <Empty>{t('storage.stock_empty')}</Empty>
            : (
              <div className="vh-stock">
                {stock.map((s) => (
                  <div key={s.item.code} className="vh-stockrow"><span>{goods(s.item)}</span><b>{formatNumber(s.qty)}</b></div>
                ))}
              </div>
            )}

          <SectionTitle>{t('storage.market')}</SectionTitle>
          <div className="vh-hint" style={{ textAlign: 'start' }}>{t('storage.market_hint', { city })}</div>
          {market.length === 0 && <Empty>{t('storage.market_empty')}</Empty>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {market.map((m) => (
              <Card key={m.item.code}>
                <ListRow icon="box" palette="steel" title={goods(m.item)} sub={t('storage.unit_price', { p: money(m.price) })} right={<Chip>{t('storage.source', { city })}</Chip>} />
                {v.can_buy && (
                  <div className="vd-presets">
                    {(v.presets ?? []).map((q) => (
                      <Slab key={q} tone="gold" radius={12} lip={3} disabled={busy} onClick={() => void prepare(m, q)}>{t('storage.buy_qty', { q: formatNumber(q) })}</Slab>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
          {!v.can_buy && market.length > 0 && <div className="vh-hint">{t('storage.head_only')}</div>}
        </>
      )}

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
