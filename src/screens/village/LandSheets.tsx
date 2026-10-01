// The citizen loop's sheets (contract 1.4): buying a free lot and building a
// private house on one's own lot (one's own property and work are sections of
// the village menu: settlement_mine, labor_board). They speak the
// server's own two-step commands (settlement.lot.buy, settlement.private.place
// each answer a bill first and only pay when sent `confirm`), so nothing is
// spent by opening a sheet. All render at the document body (BottomSheet).

import { useEffect, useState } from 'react'
import Popup, { ActionButton, ActionRow, CostSummary, Hero, RequirementList, Medallion, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import { Emboss } from '../../kit'
import { t } from '../../i18n'
import { money } from '../native/kit/format'
import { useToast } from '../../state/ToastContext'
import { buildingName, useContentNames, useVillageCommand, type ContentNames } from '../../village/useVillage'
import type { VillageStore } from '../../village/villageStore'
import type {
  CatalogueBuilding, LotBuyView, PrivateConfirmView, PrivateMenuView, PrivateMaterialView, PrivateLineView,
} from '../../api/types'
import { durationText } from './common'
import './village.css'

type Lot = { x: number; y: number }

function materialLine(m: PrivateMaterialView, names: ContentNames): string {
  return t('citizen.build.material', { name: names.name(['component', 'item'], m.component.code, m.component.name), need: m.need, have: m.have, buy: m.buy })
}

// -- buy a free lot ---------------------------------------------------------------------

export function BuyLotSheet({ lot, price, onClose, store }: { lot: Lot | null; price?: number; onClose: () => void; store: VillageStore | null }) {
  const cmd = useVillageCommand()
  const toast = useToast()
  const [view, setView] = useState<LotBuyView | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setView(null); setNote(null); setDone(false)
    if (!lot) return
    let cancelled = false
    void cmd('settlement.lot.buy', { x: lot.x, y: lot.y }, { silent: true }).then((r) => {
      if (cancelled) return
      if (r.ok && r.res?.view) setView(r.res.view as unknown as LotBuyView)
      else setNote({ tone: 'bad', text: r.code === 'village_citizen_no_cash' ? t('citizen.buy.no_cash') : r.message })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot?.x, lot?.y])

  async function buy() {
    if (!lot) return
    setBusy(true)
    const r = await cmd('settlement.lot.buy', { x: lot.x, y: lot.y, confirm: 'confirm' }, { write: true })
    setBusy(false)
    if (r.ok) {
      if (r.res?.view) setView(r.res.view as unknown as LotBuyView)
      setDone(true)
      toast.push(t('citizen.buy.done'), { kind: 'success' })
      void store?.refetchLayout()
    }
  }

  return (
    <Popup
      open={!!lot} onClose={onClose} title={t('citizen.buy.title')} tone="green" dismissible={!busy}
      footer={lot && (done
        ? <ActionButton tone="gold" onClick={onClose}>{t('common.close')}</ActionButton>
        : (
          <ActionRow>
            <ActionButton tone="steel" small onClick={onClose} disabled={busy}>{t('common.cancel')}</ActionButton>
            <ActionButton tone="green" onClick={() => void buy()} disabled={busy || !view || (!!view && view.cash < view.price)} reason={view && view.cash < view.price ? t('citizen.buy.no_cash') : undefined}>{t('citizen.buy.confirm', { p: money(view?.price ?? price ?? 0) })}</ActionButton>
          </ActionRow>
        ))}
    >
      {lot && (
        <>
          <Hero><Medallion icon="x_field" palette="emerald" ring="#2f9d5b" chip={t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} /></Hero>
          {view && !done && (
            <RequirementList lines={[
              { icon: 'money', palette: 'emerald', label: t('citizen.buy.cash'), state: view.cash >= view.price ? 'met' : 'missing', detail: t('citizen.buy.need_d', { have: money(view.cash), need: money(view.price) }) },
            ]} />
          )}
          <CostSummary
            lines={[{ label: t('citizen.buy.price'), amount: money(view?.price ?? price ?? 0) }]}
            total={{ label: view && !done ? t('citizen.buy.after') : undefined, amount: view && !done ? money(view.cash - view.price) : money(view?.price ?? price ?? 0) }}
          />
          {!done && <Note>{t('citizen.buy.note')}</Note>}
          {note && <Note tone={note.tone}>{note.text}</Note>}
          {done && <Note tone="good">{t('citizen.buy.done')}</Note>}
        </>
      )}
    </Popup>
  )
}

// -- someone else's lot -------------------------------------------------------------------

export function TakenLotSheet({ lot, owner, onClose }: { lot: Lot | null; owner?: string; onClose: () => void }) {
  return (
    <Popup
      open={!!lot} onClose={onClose} title={owner ? t('citizen.taken_by', { name: owner }) : t('citizen.taken')} tone="navy"
      footer={<ActionButton tone="steel" onClick={onClose}>{t('common.close')}</ActionButton>}
    >
      {lot && (
        <>
          <Hero><Medallion icon="m_lock" palette="steel" ring="#8e97b4" chip={t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} /></Hero>
          <Note>{t('citizen.taken_note')}</Note>
        </>
      )}
    </Popup>
  )
}

// -- build a private house on one's own lot ------------------------------------------------

export function HouseSheet({ lot, cat, onClose, store }: { lot: Lot | null; cat: Map<string, CatalogueBuilding>; onClose: () => void; store: VillageStore | null }) {
  const names = useContentNames()
  const cmd = useVillageCommand()
  const toast = useToast()
  const [menu, setMenu] = useState<PrivateMenuView | null>(null)
  const [bill, setBill] = useState<PrivateConfirmView | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMenu(null); setBill(null)
    if (!lot) return
    let cancelled = false
    void cmd('settlement.private', {}, { silent: true }).then((r) => {
      if (cancelled) return
      if (r.ok && r.res?.view) setMenu(r.res.view as unknown as PrivateMenuView)
      else onClose()
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot?.x, lot?.y])

  async function pick(l: PrivateLineView) {
    if (!lot) return
    setBusy(true)
    const r = await cmd('settlement.private.place', { code: l.building.code, x: lot.x, y: lot.y })
    setBusy(false)
    if (r.ok && r.res?.screen === 'settlement_private_confirm' && r.res.view) setBill(r.res.view as unknown as PrivateConfirmView)
  }

  async function build() {
    if (!lot || !bill) return
    setBusy(true)
    const r = await cmd('settlement.private.place', { code: bill.building.code, x: lot.x, y: lot.y, confirm: 'confirm' }, { write: true })
    setBusy(false)
    if (r.ok) {
      toast.push(t('citizen.build.started'), { kind: 'success' })
      void store?.refetchLayout()
      onClose()
    }
  }

  return (
    <Popup
      open={!!lot} onClose={onClose} title={t('citizen.build.title')} tone="gold" dismissible={!busy}
      footer={lot && bill && (
        <ActionRow>
          <ActionButton tone="steel" small onClick={() => setBill(null)} disabled={busy}>{t('citizen.build.back')}</ActionButton>
          <ActionButton tone="green" onClick={() => void build()} disabled={busy || bill.cash < bill.total} reason={bill.cash < bill.total ? t('citizen.build.short') : undefined}>{t('citizen.build.start', { p: money(bill.total) })}</ActionButton>
        </ActionRow>
      )}
    >
      {lot && !bill && (
        <>
          <Hero><Medallion icon="house" palette="gold" ring="#d99a1f" chip={t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} /></Hero>
          <Section>{t('citizen.build.pick')}</Section>
          {menu && (menu.lines ?? []).length === 0 && <Note>{t('citizen.build.empty')}</Note>}
          <div className="vc-list">
            {(menu?.lines ?? []).map((l) => (
              <button key={l.building.code} className={`vc-line${l.affordable ? '' : ' locked'}`} disabled={busy} onClick={() => void pick(l)}>
                <Emboss name="house" palette={l.home ? 'gold' : 'amber'} size={34} />
                <span className="vc-line-text">
                  <span className="vc-line-name">{buildingName(cat, l.building.code, l.building.name)}</span>
                  <span className="vc-line-sub">{durationText(l.build_time_seconds)} · {l.footprint_w}×{l.footprint_h}</span>
                  {!l.affordable && <span className="vc-line-sub bad">{t('citizen.build.short')}</span>}
                </span>
                <span className="vc-line-price">{money(l.total)}</span>
              </button>
            ))}
          </div>
          {!menu && <Note>…</Note>}
          <Note>{t('citizen.build.pay_note')}</Note>
        </>
      )}
      {lot && bill && (
        <>
          <Hero><Medallion icon="house" palette="gold" ring="#d99a1f" chip={buildingName(cat, bill.building.code, bill.building.name)} /></Hero>
          <RequirementList lines={[
            { icon: 'money', palette: 'emerald', label: t('citizen.buy.cash'), state: bill.cash >= bill.total ? 'met' : 'missing', detail: t('citizen.buy.need_d', { have: money(bill.cash), need: money(bill.total) }) },
            { icon: 'stopwatch', palette: 'sapphire', label: t('citizen.build.time'), state: 'info', price: durationText(bill.build_time_seconds) },
          ]} />
          <CostSummary
            lines={[
              { label: t('citizen.build.cost'), amount: money(bill.cost_money) },
              { label: t('citizen.build.permit'), amount: money(bill.permit_fee) },
              ...(bill.materials_cost > 0 ? [{ label: t('citizen.build.materials'), amount: money(bill.materials_cost) }] : []),
            ]}
            total={{ label: t('citizen.build.total'), amount: money(bill.total) }}
          />
          {(bill.materials ?? []).map((m) => <Note key={m.component.code}>{materialLine(m, names)}</Note>)}
        </>
      )}
    </Popup>
  )
}
