// The citizen loop's sheets (contract 1.4): buying a free lot and building a
// private house on one's own lot (one's own property and work are sections of
// the village menu: settlement_mine, labor_board). They speak the
// server's own two-step commands (settlement.lot.buy, settlement.private.place
// each answer a bill first and only pay when sent `confirm`), so nothing is
// spent by opening a sheet. All render at the document body (BottomSheet).

import { useEffect, useState } from 'react'
import BottomSheet from '../../ui/BottomSheet'
import { Emboss, Plate, Slab } from '../../kit'
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

function Fact({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return <div className="vh-info-row"><span>{label}</span><b style={gold ? { color: 'var(--gold)' } : undefined}>{value}</b></div>
}

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
      toast.push(t('citizen.buy.done'))
      void store?.refetchLayout()
    }
  }

  return (
    <BottomSheet open={!!lot} onClose={onClose} title={t('citizen.buy.title')}>
      {lot && (
        <>
          <div className="vh-sheet-row">
            <Plate size={52} square><Emboss name="x_field" palette="emerald" size={32} /></Plate>
            <div>
              <div className="vh-sheet-meta">{t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })}</div>
              <div className="vh-sheet-meta">{t('citizen.buy.price')}: <b style={{ color: 'var(--gold)' }}>{money(view?.price ?? price ?? 0)}</b></div>
            </div>
          </div>
          {view && (
            <div className="vh-info">
              <Fact label={t('citizen.buy.cash')} value={money(done ? view.cash : view.cash)} />
              {!done && <Fact label={t('citizen.buy.after')} value={money(view.cash - view.price)} gold />}
            </div>
          )}
          {!done && <div className="vh-hint">{t('citizen.buy.note')}</div>}
          {note && <div className={`vh-hint ${note.tone}`}>{note.text}</div>}
          {done && <div className="vh-hint good">{t('citizen.buy.done')}</div>}
          <div className="vh-sheet-actions">
            {done
              ? <Slab tone="gold" radius={14} lip={4} onClick={onClose}>{t('common.close')}</Slab>
              : <>
                <Slab tone="steel" radius={14} lip={4} onClick={onClose} disabled={busy}>{t('common.cancel')}</Slab>
                <Slab tone="green" radius={14} lip={4} onClick={() => void buy()} disabled={busy || !view}>{t('citizen.buy.confirm', { p: money(view?.price ?? price ?? 0) })}</Slab>
              </>}
          </div>
        </>
      )}
    </BottomSheet>
  )
}

// -- someone else's lot -------------------------------------------------------------------

export function TakenLotSheet({ lot, owner, onClose }: { lot: Lot | null; owner?: string; onClose: () => void }) {
  return (
    <BottomSheet open={!!lot} onClose={onClose} title={owner ? t('citizen.taken_by', { name: owner }) : t('citizen.taken')}>
      {lot && (
        <>
          <div className="vh-sheet-row">
            <Plate size={52} square><Emboss name="m_lock" palette="steel" size={30} /></Plate>
            <div>
              <div className="vh-sheet-meta">{t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })}</div>
              <div className="vh-sheet-meta">{t('citizen.taken_note')}</div>
            </div>
          </div>
          <div className="vh-sheet-actions"><Slab tone="steel" radius={14} lip={4} onClick={onClose}>{t('common.close')}</Slab></div>
        </>
      )}
    </BottomSheet>
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
      toast.push(t('citizen.build.started'))
      void store?.refetchLayout()
      onClose()
    }
  }

  return (
    <BottomSheet open={!!lot} onClose={onClose} title={t('citizen.build.title')}>
      {lot && !bill && (
        <>
          <div className="vh-confirm" style={{ margin: '0 0 6px' }}>{t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} · {t('citizen.build.pick')}</div>
          {menu && (menu.lines ?? []).length === 0 && <div className="vh-hint">{t('citizen.build.empty')}</div>}
          <div className="vc-list">
            {(menu?.lines ?? []).map((l) => (
              <button key={l.building.code} className={`vc-line${l.affordable ? '' : ' locked'}`} disabled={busy} onClick={() => void pick(l)}>
                <Plate size={40} square><Emboss name="house" palette={l.home ? 'gold' : 'amber'} size={26} /></Plate>
                <span className="vc-line-text">
                  <span className="vc-line-name">{buildingName(cat, l.building.code, l.building.name)}</span>
                  <span className="vc-line-sub">{durationText(l.build_time_seconds)} · {l.footprint_w}×{l.footprint_h}</span>
                  {!l.affordable && <span className="vc-line-sub bad">{t('citizen.build.short')}</span>}
                </span>
                <span className="vc-line-price">{money(l.total)}</span>
              </button>
            ))}
          </div>
          {!menu && <div className="vh-hint">…</div>}
          <div className="vh-hint">{t('citizen.build.pay_note')}</div>
        </>
      )}
      {lot && bill && (
        <>
          <div className="vh-sheet-row">
            <Plate size={52} square><Emboss name="house" palette="gold" size={32} /></Plate>
            <div>
              <div className="vh-sheet-meta" style={{ color: 'var(--text)' }}>{buildingName(cat, bill.building.code, bill.building.name)}</div>
              <div className="vh-sheet-meta">{t('citizen.buy.lot', { x: bill.x + 1, y: bill.y + 1 })}</div>
            </div>
          </div>
          <div className="vh-info">
            <Fact label={t('citizen.build.cost')} value={money(bill.cost_money)} />
            <Fact label={t('citizen.build.permit')} value={money(bill.permit_fee)} />
            {bill.materials_cost > 0 && <Fact label={t('citizen.build.materials')} value={money(bill.materials_cost)} />}
            <Fact label={t('citizen.build.total')} value={money(bill.total)} gold />
            <Fact label={t('citizen.build.time')} value={durationText(bill.build_time_seconds)} />
          </div>
          {(bill.materials ?? []).map((m) => <div key={m.component.code} className="vh-hint">{materialLine(m, names)}</div>)}
          <div className="vh-sheet-actions">
            <Slab tone="steel" radius={14} lip={4} onClick={() => setBill(null)} disabled={busy}>{t('citizen.build.back')}</Slab>
            <Slab tone="green" radius={14} lip={4} onClick={() => void build()} disabled={busy || bill.cash < bill.total}>{t('citizen.build.start', { p: money(bill.total) })}</Slab>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
