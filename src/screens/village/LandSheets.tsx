// The citizen loop's sheets (contract 1.4): buying a free lot and building a
// private house on one's own lot (one's own property and work are sections of
// the village menu: settlement_mine, labor_board). They speak the
// server's own two-step commands (settlement.lot.buy, settlement.private.place
// each answer a bill first and only pay when sent `confirm`), so nothing is
// spent by opening a sheet. All render at the document body (BottomSheet).

import { useEffect, useState } from 'react'
import Popup, { ActionButton, ActionRow, CostSummary, Hero, RequirementList, Medallion, Note, Section, type RequirementLine } from '../../ui/Popup'
import { Emboss } from '../../kit'
import { t, type Key } from '../../i18n'
import { money } from '../native/kit/format'
import { useToast } from '../../state/ToastContext'
import { buildingName, useContentNames, useVillageCommand, type ContentNames } from '../../village/useVillage'
import type { VillageStore } from '../../village/villageStore'
import type {
  CatalogueBuilding, LotAccessView, LotBuyView, PrivateConfirmView, PrivateMenuView, PrivateMaterialView, PrivateLineView,
} from '../../api/types'
import type { LotAccess, LotNearby } from '../../api/views.gen'
import { durationText } from './common'
import './village.css'

type Lot = { x: number; y: number }

function materialLine(m: PrivateMaterialView, names: ContentNames): string {
  return t('citizen.build.material', { name: names.name(['component', 'item'], m.component.code, m.component.name), need: m.need, have: m.have, buy: m.buy })
}

// -- how a lot is served by road (docs/adr/0043) ----------------------------------------------

/** The line of a requirements block that says how a road reaches the lot. */
function roadLine(a: LotAccess): RequirementLine {
  const base = { icon: 'road', palette: 'amber' as const, label: t('citizen.access.req') }
  switch (a.kind) {
    case 'road':
      return { ...base, state: 'met', detail: t('citizen.access.road') }
    case 'needs_road':
      return { ...base, state: 'info', detail: t('citizen.access.needs_road', { n: a.roads }), price: money(a.cost) }
    case 'needs_bridge':
      return { ...base, state: 'info', detail: t('citizen.access.needs_bridge', { n: a.roads - a.crossings, c: a.crossings }), price: money(a.cost) }
    default:
      return { ...base, state: 'missing', detail: t('citizen.access.none') }
  }
}

/** The nearest lots that have a road, each a button that opens that lot's own buy popup. */
function NearbyLots({ lots, onPick, busy }: { lots: LotNearby[] | null; onPick: (l: Lot) => void; busy?: boolean }) {
  const list = lots ?? []
  return (
    <>
      <Section>{t('citizen.access.nearby')}</Section>
      {list.length === 0 ? <Note>{t('citizen.access.nearby_none')}</Note> : <Note>{t('citizen.access.nearby_hint')}</Note>}
      <div className="vc-list">
        {list.map((n) => (
          <button key={`${n.x}-${n.y}`} className="vc-line" disabled={busy} onClick={() => onPick({ x: n.x, y: n.y })}>
            <Emboss name="x_field" palette="emerald" size={34} />
            <span className="vc-line-text">
              <span className="vc-line-name">{t('citizen.buy.lot', { x: n.x + 1, y: n.y + 1 })}</span>
              <span className="vc-line-sub">{n.access.kind === 'road' ? t('citizen.access.road') : t('citizen.access.needs_road', { n: n.access.roads })}</span>
            </span>
            {n.access.cost > 0 && <span className="vc-line-price">{money(n.access.cost)}</span>}
            <span className="vc-chev" aria-hidden="true">‹</span>
          </button>
        ))}
      </div>
    </>
  )
}

// -- buy a free lot ---------------------------------------------------------------------

export function BuyLotSheet({ lot, price, onClose, store, onOther }: {
  lot: Lot | null; price?: number; onClose: () => void; store: VillageStore | null; onOther?: (l: Lot) => void
}) {
  const cmd = useVillageCommand()
  const toast = useToast()
  const [view, setView] = useState<LotBuyView | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [done, setDone] = useState(false)
  const [carve, setCarve] = useState(false)

  useEffect(() => {
    setView(null); setNote(null); setDone(false); setCarve(false)
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

  /** Asks again with the buyer's own land as the road (the buyer's consent is the second press). */
  async function askCarve() {
    if (!lot) return
    setBusy(true)
    const r = await cmd('settlement.lot.buy', { x: lot.x, y: lot.y, road: 'carve' }, { silent: true })
    setBusy(false)
    if (r.ok && r.res?.view) { setView(r.res.view as unknown as LotBuyView); setCarve(true) }
    else setNote({ tone: 'bad', text: r.message })
  }

  async function buy() {
    if (!lot) return
    setBusy(true)
    const r = await cmd('settlement.lot.buy', { x: lot.x, y: lot.y, confirm: 'confirm', ...(carve ? { road: 'carve' } : {}) }, { write: true })
    setBusy(false)
    if (r.ok) {
      if (r.res?.view) setView(r.res.view as unknown as LotBuyView)
      setDone(true)
      toast.push(t('citizen.buy.done'), { kind: 'success' })
      void store?.refetchLayout()
    }
  }

  const access = view?.access
  const none = access?.kind === 'none'
  const total = view?.total ?? price ?? 0
  const short = !!view && view.cash < total
  const carved = view?.carve?.carved?.length ?? 0

  return (
    <Popup
      open={!!lot} onClose={onClose} title={t('citizen.buy.title')} tone="green" dismissible={!busy}
      footer={lot && (done
        ? <ActionButton tone="gold" onClick={onClose}>{t('common.close')}</ActionButton>
        : (
          <ActionRow>
            <ActionButton tone="steel" small onClick={onClose} disabled={busy}>{t('common.cancel')}</ActionButton>
            {!none && (
              <ActionButton tone="green" onClick={() => void buy()} disabled={busy || !view || short} reason={short ? t('citizen.buy.no_cash') : undefined}>
                {access && access.cost > 0 ? t('citizen.buy.confirm_road', { p: money(total) }) : t('citizen.buy.confirm', { p: money(total) })}
              </ActionButton>
            )}
          </ActionRow>
        ))}
    >
      {lot && (
        <>
          <Hero><Medallion icon="x_field" palette={none ? 'ruby' : 'emerald'} ring={none ? '#d1443b' : '#2f9d5b'} chip={t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} /></Hero>
          {view && !done && (
            <RequirementList lines={[
              { icon: 'money', palette: 'emerald', label: t('citizen.buy.cash'), state: view.cash >= total ? 'met' : 'missing', detail: t('citizen.buy.need_d', { have: money(view.cash), need: money(total) }) },
              ...(access ? [roadLine(access)] : []),
            ]} />
          )}
          {!none && (
            <CostSummary
              lines={[
                { label: t('citizen.buy.price'), amount: money(view?.price ?? price ?? 0) },
                ...(access && access.cost > 0 ? [{ label: t('citizen.access.cost'), amount: money(access.cost) }] : []),
              ]}
              total={{ label: view && !done ? t('citizen.buy.after') : undefined, amount: view && !done ? money(view.cash - total) : money(total) }}
            />
          )}
          {!done && access && access.cost > 0 && !none && <Note>{carve ? t('citizen.access.carve_chosen', { n: view?.access.carved?.length ?? carved }) : t('citizen.access.road_note')}</Note>}
          {!done && !none && !(access && access.cost > 0) && <Note>{t('citizen.buy.note')}</Note>}
          {!done && none && (
            <>
              <Note tone="bad">{t('citizen.access.none_note')}</Note>
              {view?.carve && (
                <>
                  <Note>{t('citizen.access.carve_note', { n: carved })}</Note>
                  <ActionButton tone="gold" small onClick={() => void askCarve()} disabled={busy}>{t('citizen.access.carve_btn', { p: money(view.carve.cost) })}</ActionButton>
                </>
              )}
              <NearbyLots lots={view?.nearby ?? null} busy={busy} onPick={(l) => onOther?.(l)} />
            </>
          )}
          {note && <Note tone={note.tone}>{note.text}</Note>}
          {done && <Note tone="good">{t('citizen.buy.done')}</Note>}
        </>
      )}
    </Popup>
  )
}

// -- put right a lot of one's own that no road reaches ------------------------------------------

/** The three ways out for a lot no road touches: the road at its price, the road through one's own
 * land, or the sale rescinded. Opened from the land map, «دارایی من», or from a building refused
 * for want of a road (`initial` is that refusal's own answer, so nothing is asked twice). */
export function LotAccessSheet({ lot, initial, onClose, store, onDone }: {
  lot: Lot | null; initial?: LotAccessView | null; onClose: () => void; store: VillageStore | null; onDone?: () => void
}) {
  const cmd = useVillageCommand()
  const toast = useToast()
  const [view, setView] = useState<LotAccessView | null>(null)
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState<'connect' | 'carve' | 'refund' | null>(null)

  useEffect(() => {
    setAsk(null)
    if (!lot) { setView(null); return }
    if (initial && initial.x === lot.x && initial.y === lot.y) { setView(initial); return }
    setView(null)
    let cancelled = false
    void cmd('settlement.lot.access', { x: lot.x, y: lot.y }, { silent: true }).then((r) => {
      if (cancelled) return
      if (r.ok && r.res?.view) setView(r.res.view as unknown as LotAccessView)
      else onClose()
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot?.x, lot?.y, initial])

  async function run(option: 'connect' | 'carve' | 'refund') {
    if (!lot) return
    setBusy(true)
    const r = await cmd('settlement.lot.repair', { x: lot.x, y: lot.y, option, confirm: 'confirm' }, { write: true })
    setBusy(false)
    if (r.ok) {
      toast.push(t(`citizen.fix.done_${option}` as Key), { kind: 'success' })
      void store?.refetchLayout()
      onDone?.()
      onClose()
    }
  }

  const a = view?.access
  const canConnect = a && (a.kind === 'needs_road' || a.kind === 'needs_bridge')
  const carved = view?.carve?.carved?.length ?? 0
  const choices: { id: 'connect' | 'carve' | 'refund'; label: string; note: string; tone: 'green' | 'gold' | 'red'; short: boolean }[] = []
  if (view && a && a.kind !== 'road') {
    if (canConnect) choices.push({ id: 'connect', label: t('citizen.fix.connect', { p: money(a.cost) }), note: t('citizen.access.road_note'), tone: 'green', short: view.cash < a.cost })
    if (view.carve) choices.push({ id: 'carve', label: t('citizen.fix.carve', { n: carved, p: money(view.carve.cost) }), note: t('citizen.access.carve_note', { n: carved }), tone: 'gold', short: view.cash < view.carve.cost })
    if (view.refund > 0) choices.push({ id: 'refund', label: t('citizen.fix.refund', { p: money(view.refund) }), note: t('citizen.fix.refund_note', { p: money(view.refund) }), tone: 'red', short: false })
  }
  const chosen = choices.find((c) => c.id === ask)

  return (
    <Popup
      open={!!lot} onClose={onClose} title={t('citizen.fix.title')} tone="gold" dismissible={!busy}
      footer={lot && (chosen
        ? (
          <ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)} disabled={busy}>{t('citizen.build.back')}</ActionButton>
            <ActionButton tone={chosen.tone === 'red' ? 'red' : 'green'} onClick={() => void run(chosen.id)} disabled={busy || chosen.short} reason={chosen.short ? t('citizen.buy.no_cash') : undefined}>{chosen.id === 'connect' ? t('citizen.fix.sure') : t(`citizen.fix.sure_${chosen.id}` as Key)}</ActionButton>
          </ActionRow>
        )
        : <ActionButton tone="steel" onClick={onClose}>{t('common.close')}</ActionButton>)}
    >
      {lot && (
        <>
          <Hero><Medallion icon="x_field" palette={a?.kind === 'road' ? 'emerald' : 'amber'} ring={a?.kind === 'road' ? '#2f9d5b' : '#d99a1f'} chip={t('citizen.buy.lot', { x: lot.x + 1, y: lot.y + 1 })} /></Hero>
          {!view && <Note>…</Note>}
          {view && (
            <>
              {view.building?.code && <Note tone="bad">{t('citizen.access.refused', { name: view.building.name || view.building.code })}</Note>}
              {ask !== 'refund' && <RequirementList lines={a ? [roadLine(a)] : []} />}
              {a?.kind === 'road' && <Note tone="good">{t('citizen.fix.ok')}</Note>}
              {a?.kind === 'none' && <Note tone="bad">{t('citizen.fix.none')}</Note>}
              {!chosen && choices.length > 0 && (
                <div className="vc-list">
                  {choices.map((c) => (
                    <button key={c.id} className="vc-line" disabled={busy} onClick={() => setAsk(c.id)}>
                      <Emboss name={c.id === 'refund' ? 'money' : 'road'} palette={c.id === 'refund' ? 'ruby' : 'gold'} size={34} />
                      <span className="vc-line-text"><span className="vc-line-name">{c.label}</span></span>
                    </button>
                  ))}
                </div>
              )}
              {chosen && (
                <>
                  <Note>{chosen.note}</Note>
                  <CostSummary
                    lines={[]}
                    total={{
                      label: chosen.id === 'refund' ? t('citizen.fix.refund_total') : t('citizen.access.cost'),
                      amount: money(chosen.id === 'refund' ? view.refund : chosen.id === 'carve' ? (view.carve?.cost ?? 0) : (a?.cost ?? 0)),
                    }}
                  />
                </>
              )}
            </>
          )}
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

export function HouseSheet({ lot, cat, onClose, store, onNoRoad }: {
  lot: Lot | null; cat: Map<string, CatalogueBuilding>; onClose: () => void; store: VillageStore | null; onNoRoad?: (v: LotAccessView) => void
}) {
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
    // no road reaches the lot: the answer is the lot's own fixes (docs/adr/0043), never a dead end
    if (r.ok && r.res?.screen === 'settlement_lot_access' && r.res.view) onNoRoad?.(r.res.view as unknown as LotAccessView)
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
