// The backpack (storage and market audit F12, F13; ADR 0046 section 4, ADR 0040 section 6): what the player carries as a
// grid of goods (3-4 to a row on a phone, 6-8 on desktop), the fill of their bags above it, the two bag slots, the
// holding slot («در امانت»: what arrived when there was no room) and «انبار من» (what they keep at home) as a tab. A tap on
// a good opens its popup: use, sell, put in my store, throw away, put a bag on or take it off. Facts are the
// `inventory` view; the quantities follow the state sync so a used or bought good shows at once.

import { useEffect, useMemo, useState } from 'react'
import type { ScreenProps } from '../types'
import type { InventoryLine, InventoryView, ItemDetailView, BagSlotLine } from '../../api/views.gen'
import { Header, Notice, ScreenScroll, SectionTitle } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, money } from './kit/format'
import Popup, { ActionButton, ActionRow, EffectChip, EffectRow, Note } from '../../ui/Popup'
import { PStats, PTabs } from '../../ui/v6/panel'
import { FillBar, ItemGrid, itemIconName, type GridCell } from '../../ui/v6/ItemGrid'
import { GoodsTools, useGoodsFilter } from '../../ui/v6/goodsFilter'
import { t, type Key } from '../../i18n'
import { useContentNames, useVillageCommand } from '../../village/useVillage'
import { useSession } from '../../state/SessionContext'
import { useStoreView } from '../../state/useSync'
import { entitiesOf } from '../../state/store'
import type { InventoryData } from '../../state/syncTypes'

/** The view's lines with the store's quantities: a line whose item the store no longer holds goes, an item the view did
 * not list yet is added (named from the catalogue by its code). A unique piece keeps its own line. */
function fromStore(lines: InventoryLine[], held: [string, InventoryData][]): InventoryLine[] {
  const byCode = new Map(held)
  const out: InventoryLine[] = []
  const seen = new Set<string>()
  for (const l of lines) {
    const code = l.item?.code ?? ''
    const inv = byCode.get(code)
    if (!inv) continue
    seen.add(code)
    if (l.serial || inv.pieces.length > 0) {
      if (!l.serial || inv.pieces.some((p) => p.id === l.serial)) out.push(l)
      else if (!seen.has(code + '#')) { seen.add(code + '#'); out.push({ ...l, serial: '', qty: inv.qty }) }
      continue
    }
    out.push({ ...l, qty: inv.qty })
  }
  for (const [code, inv] of held) if (!seen.has(code)) out.push({ item: { code, name: '' }, category: '', shelf: { code: '', group: '', label: '', group_label: '' }, qty: inv.qty, serial: '', quality: 0, uses_left: 0, durability: 0, design: '' })
  return out
}

type Tab = 'carried' | 'home'
/** What a popup is about: a line, and which holding it sits in. */
interface Open { line: InventoryLine; where: 'carried' | 'claim' | 'home' }

export default function Inventory({ response, loading, run }: ScreenProps) {
  const names = useContentNames()
  const cmd = useVillageCommand()
  const [tab, setTab] = useState<Tab>('carried')
  const [fresh, setFresh] = useState<InventoryView | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const served = (response?.view ?? {}) as Partial<InventoryView>
  // an answer the shell brings wins over one this screen fetched itself
  useEffect(() => { setFresh(null) }, [response])
  const v = (fresh ?? served) as Partial<InventoryView>
  const { synced } = useSession()
  const view = useStoreView()

  const lines = useMemo(() => {
    const base = v.lines ?? []
    return synced && view.ready && !fresh ? fromStore(base, entitiesOf(view, 'inventory')) : base
  }, [v.lines, synced, view, fresh])

  const nameOf = (l: InventoryLine) => (l.item?.code ? names.name(['item', 'component'], l.item.code, l.item.name) : '—')
  const rows = useMemo(() => lines.map((l) => ({ item: l, name: nameOf(l), category: l.category ?? '', qty: l.qty, shelf: l.shelf })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, names])
  const f = useGoodsFilter(rows, ['name', 'qty'])

  async function refresh() {
    const r = await cmd('inventory.show', {}, { silent: true })
    if (r.ok && r.res?.view) setFresh(r.res.view as unknown as InventoryView)
  }

  if (loading && !response) return <ScreenScroll><Header title={t('inventory.title')} tone="gold" /></ScreenScroll>

  const carry = v.carry
  const cell = (l: InventoryLine, where: Open['where'], i: number): GridCell => ({
    key: `${where}:${l.serial || l.item?.code}:${i}`,
    name: nameOf(l),
    icon: itemIconName(l.item?.code ?? '', l.shelf?.group, l.category),
    qty: l.qty,
    sub: l.durability || l.uses_left ? t('sm.slot.wear', { w: formatNumber(l.uses_left || 0), m: formatNumber(l.durability || 0) }) : undefined,
    tone: where === 'claim' ? 'warn' : undefined,
    onClick: () => setOpen({ line: l, where }),
  })
  const claims = v.claims ?? []
  const home = v.home
  const full = !!carry && carry.capacity > 0 && carry.used + carry.reserved >= carry.capacity

  return (
    <ScreenScroll>
      <Header title={t('inventory.title')} tone="gold" onRefresh={() => run('inventory.show')} />

      <PTabs tabs={[{ key: 'carried', label: t('sm.tab.carried') }, { key: 'home', label: t('sm.tab.home') }]} value={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === 'carried' && (
        <>
          {carry && carry.capacity > 0 && (
            <>
              <FillBar used={carry.used} reserved={carry.reserved} capacity={carry.capacity} label={t('sm.fill.space')}
                figures={`${formatNumber(carry.used + carry.reserved)} / ${formatNumber(carry.capacity)}`} />
              <div className="gc-note">
                {t('sm.fill.load', { w: formatNumber(Math.round(carry.load_g / 1000)), c: formatNumber(Math.round(carry.comfort_g / 1000)), h: formatNumber(Math.round(carry.hard_g / 1000)) })}
                {carry.reserved > 0 && <>{'، '}{t('sm.fill.reserved', { n: formatNumber(carry.reserved) })}</>}
              </div>
              {full && <Notice>{t('sm.fill.full')}</Notice>}
            </>
          )}

          {(v.bags ?? []).length > 0 && (
            <>
              <SectionTitle>{t('sm.bags.title')}</SectionTitle>
              <div className="ig-slots">
                {(v.bags ?? []).map((s) => <BagSlot key={s.slot} s={s} names={names} onOff={async () => { await cmd('inventory.bag.off', { slot: s.slot }, { write: true }); await refresh() }} />)}
              </div>
            </>
          )}

          {claims.length > 0 && (
            <>
              <SectionTitle>{t('sm.claims.title')}</SectionTitle>
              <Note>{t('sm.claims.hint')}</Note>
              <ItemGrid cells={claims.map((l, i) => cell(l, 'claim', i))} label={t('sm.claims.title')} />
            </>
          )}

          {lines.length === 0 && <Notice>{t('inventory.empty')}</Notice>}
          {lines.length > 0 && (
            <>
              <GoodsTools f={f as never} />
              {f.shown.length === 0 && <p className="pn-hint">{t('goods.none')}</p>}
              <ItemGrid cells={f.shown.map((r, i) => cell(r.item as InventoryLine, 'carried', i))} label={t('inventory.title')} />
            </>
          )}
          {!!v.in_escrow && <Notice>{t('inventory.escrow', { n: formatNumber(v.in_escrow) })}</Notice>}
        </>
      )}

      {tab === 'home' && (
        <>
          {!home && <Notice>{t('sm.home.none')}</Notice>}
          {home && (
            <>
              <FillBar used={home.used} capacity={home.capacity} label={t('sm.home.title')} figures={`${formatNumber(home.used)} / ${formatNumber(home.capacity)}`} />
              {!home.here && <Notice>{t('sm.home.away')}</Notice>}
              {(home.lines ?? []).length === 0 ? <Note>{t('sm.home.empty')}</Note>
                : <ItemGrid cells={(home.lines ?? []).map((l, i) => cell(l, 'home', i))} label={t('sm.home.title')} />}
            </>
          )}
        </>
      )}

      <Actions response={response} onAction={() => undefined} refreshCommand="inventory.show" />

      {open && (
        <ItemPopup
          open={open} name={nameOf(open.line)} canFetch={!!home?.here}
          onClose={() => setOpen(null)}
          onDone={async () => { setOpen(null); await refresh() }}
          onSell={(code) => { setOpen(null); run('market.book', { item: code }) }}
        />
      )}
    </ScreenScroll>
  )
}

/** One of the two bag slots: the bag on it, its space and wear, and the button that takes it off. */
function BagSlot({ s, names, onOff }: { s: BagSlotLine; names: ReturnType<typeof useContentNames>; onOff: () => void }) {
  const slot = t(`sm.slot.${s.slot}` as Key)
  const b = s.bag
  if (!b) return <div className="ig-slot"><span>{slot}</span><b>{t('sm.slot.empty')}</b></div>
  return (
    <div className={`ig-slot on${b.torn ? ' torn' : ''}`}>
      <span>{slot}</span>
      <b>{names.name('item', b.item.code, b.item.name)}</b>
      <span>{b.torn ? t('sm.slot.torn', { s: formatNumber(b.space), f: formatNumber(b.full_space) }) : t('sm.slot.space', { n: formatNumber(b.space) })}</span>
      <span>{t('sm.slot.wear', { w: formatNumber(b.wear), m: formatNumber(b.wear_max) })}</span>
      <ActionButton tone="steel" small onClick={onOff}>{t('sm.slot.off')}</ActionButton>
    </div>
  )
}

/** The popup of a good: what it is, and what can be done with it where it sits. A centred popup, never a sheet. */
function ItemPopup({ open, name, canFetch, onClose, onDone, onSell }: {
  open: Open
  name: string
  canFetch: boolean
  onClose: () => void
  onDone: () => void | Promise<void>
  onSell: (code: string) => void
}) {
  const cmd = useVillageCommand()
  const [d, setD] = useState<ItemDetailView | null>(null)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const l = open.line
  const ref = l.serial || l.item.code
  const names = useContentNames()

  useEffect(() => {
    let live = true
    if (open.where === 'carried') void cmd('inventory.item', { item: ref }, { silent: true }).then((r) => { if (live && r.ok && r.res?.view) setD(r.res.view as unknown as ItemDetailView) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, open.where])

  async function act(command: string, args: Record<string, string>) {
    setBusy(true)
    const r = await cmd(command, args, { write: true })
    setBusy(false)
    if (r.ok) await onDone()
  }

  const qty = String(l.qty || 1)
  const stats = [
    { label: t('sm.pop.qty', { n: '' }).trim(), value: formatNumber(l.qty) },
    ...(d?.worth ? [{ label: t('sm.pop.worth', { p: '' }).trim(), value: money(d.worth) }] : []),
    ...(l.quality ? [{ label: t('sm.pop.quality', { q: '' }).trim(), value: formatNumber(l.quality) }] : []),
  ]

  return (
    <Popup open onClose={onClose} title={name} tone="gold" dismissible={!busy}>
      <PStats items={stats} />
      {d && (d.effects ?? []).length > 0 && (
        <EffectRow>
          {(d.effects ?? []).map((e) => <EffectChip key={e.target} tone="good">{`${e.target} ${e.op === 'add' ? '+' : ''}${formatNumber(e.value)}`}</EffectChip>)}
        </EffectRow>
      )}
      {d?.bag && (
        <Note>
          {t('sm.pop.bag', { space: formatNumber(d.bag.space), comfort: formatNumber(d.bag.comfort_kg), hard: formatNumber(d.bag.hard_kg) })}
          {d.bag.repair_cost > 0 && <> {t('sm.pop.bag_repair', { cost: money(d.bag.repair_cost) })}</>}
        </Note>
      )}
      {sure ? (
        <>
          <Note tone="bad">{t('sm.pop.drop_sure', { name })}</Note>
          <ActionRow>
            <ActionButton tone="steel" small onClick={() => setSure(false)} disabled={busy}>{t('building.no')}</ActionButton>
            <ActionButton tone="red" busy={busy} onClick={() => void act('inventory.drop', { item: ref, confirm: 'yes', nonce: d?.nonce ?? '' })}>{t('sm.pop.drop')}</ActionButton>
          </ActionRow>
        </>
      ) : (
        <ActionRow>
          {open.where === 'claim' && <ActionButton tone="green" busy={busy} onClick={() => void act('inventory.claim', { item: ref, qty })}>{t('sm.claims.take')}</ActionButton>}
          {open.where === 'home' && <ActionButton tone="green" busy={busy} disabled={!canFetch} reason={!canFetch ? t('sm.home.away') : undefined} onClick={() => void act('inventory.fetch', { item: ref, qty })}>{t('sm.home.take')}</ActionButton>}
          {open.where === 'carried' && d && (
            <>
              {d.usable && d.cooling_for_seconds <= 0 && <ActionButton tone="green" busy={busy} onClick={() => void act('inventory.use', { item: ref, nonce: d.nonce })}>{t('sm.pop.use')}</ActionButton>}
              {d.bag && (d.bag.worn
                ? <ActionButton tone="steel" busy={busy} onClick={() => void act('inventory.bag.off', { slot: d.bag!.slot })}>{t('sm.pop.bag_off')}</ActionButton>
                : <ActionButton tone="gold" busy={busy} onClick={() => void act('inventory.bag.wear', { item: ref })}>{t('sm.pop.wear')}</ActionButton>)}
              {d.tradeable && !d.piece && <ActionButton tone="gold" onClick={() => onSell(l.item.code)}>{t('sm.pop.sell')}</ActionButton>}
              {d.can_store && <ActionButton tone="steel" busy={busy} onClick={() => void act('inventory.store', { item: ref, qty })}>{t('sm.pop.store')}</ActionButton>}
              {(d.give_to ?? []).map((f) => <ActionButton key={f.code} tone="steel" small busy={busy} onClick={() => void act('inventory.give', { item: ref, nonce: d.nonce, to: f.code })}>{t('sm.pop.give', { name: names.name('player', f.code, f.name) })}</ActionButton>)}
              <ActionButton tone="red" small onClick={() => setSure(true)}>{t('sm.pop.drop')}</ActionButton>
            </>
          )}
        </ActionRow>
      )}
    </Popup>
  )
}
