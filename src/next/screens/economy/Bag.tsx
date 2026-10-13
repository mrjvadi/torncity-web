// The backpack in the new UI: a capacity hero (the space used of the whole, the load), the two bag slots, what waits
// for room, then the goods as a grid of cells (3D picture, name, ×count) filtered by shelf; a tap opens the good's
// sheet with what the server allows on it (use, sell, give, throw away). «My store» (home) is the second tab. The
// good's own page, and the pages after using, giving or throwing one away.

import { useEffect, useMemo, useState } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import type { BagSlotLine, InventoryLine, InventoryView, ItemDetailView, ItemDroppedView, ItemGivenView, ItemUsedView } from '../../../api/views.gen'
import * as api from '../../../api/client'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, Loading, Meter, Note, Page, Pills, Section, Segmented, Sheet } from '../../ui'
import { formatNumber, hms, money } from '../../../screens/native/kit/format'
import { actionLabel } from '../../../screens/village/wording'
import { hasKey, t } from '../../../i18n'
import {
  Done, More, NoAnswer, Said, actsOf, find, groupWord, idOf, isBack, itemIcon, key, moneyMain, useNames, withArgs,
} from './eco'

/** A good's place in the bag: carried, waiting for room (a claim), or kept at home. */
type Where = 'carried' | 'claim' | 'home'
interface Open { line: InventoryLine; where: Where }

/** Vitals that are better low: a good that takes hunger away is a good one. */
const LOWER_IS_GOOD = new Set(['hunger', 'thirst', 'stress', 'sleep'])

const kg = (g: number) => formatNumber(Math.round(g / 100) / 10)

/** The name of a vital an item changes (hunger, energy...). */
function vitalWord(target: string): string {
  if (hasKey(`lf.vital.${target}`)) return t(key(`lf.vital.${target}`))
  if (hasKey(`need.${target}`)) return t(key(`need.${target}`))
  return target
}

/** One good as a cell of the grid: its picture in a lit well, ×count in the corner, its name under it. */
function Cell({ l, name, tone, onOpen }: { l: InventoryLine; name: string; tone?: 'warn'; onOpen: () => void }) {
  const worn = l.durability > 0 ? l.uses_left / l.durability : undefined
  return (
    <button className={`n-eco-cell${tone ? ' ' + tone : ''}`} onClick={onOpen} aria-label={`${name} ×${formatNumber(l.qty)}`}>
      {l.qty > 1 && <span className="n-eco-cell-qty">×{formatNumber(l.qty)}</span>}
      <Icon name={itemIcon(l.item?.code, l.shelf?.group, l.category)} className="n-eco-cell-ic" />
      <span className="n-eco-cell-name">{name}</span>
      {worn !== undefined && <span className="n-eco-cell-wear"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, worn)) * 100)}%` }} /></span>}
    </button>
  )
}

/** One of the bag slots: the bag on it (its space and wear) or an empty dashed place. */
function Slot({ s, name }: { s: BagSlotLine; name: string }) {
  const word = hasKey(`sm.slot.${s.slot}`) ? t(key(`sm.slot.${s.slot}`)) : s.slot
  const b = s.bag
  if (!b) {
    return (
      <div className="n-eco-slot off">
        <Icon name="m_backpack" size={40} />
        <div><span>{word}</span><b>{t('sm.slot.empty')}</b></div>
      </div>
    )
  }
  return (
    <div className={`n-eco-slot${b.torn ? ' torn' : ''}`}>
      <Icon name={itemIcon(b.item.code, 'bags')} size={40} />
      <div>
        <span>{word}</span>
        <b>{name}</b>
        <small>{b.torn ? t('sm.slot.torn', { s: formatNumber(b.space), f: formatNumber(b.full_space) }) : t('sm.slot.space', { n: formatNumber(b.space) })}</small>
        {b.wear_max > 0 && <Meter frac={b.wear / b.wear_max} tone={b.torn ? 'bad' : b.wear / b.wear_max < 0.3 ? 'warn' : 'cyan'} />}
      </div>
    </div>
  )
}

/** A grid of goods with shelf pills above it when there are two shelves or more. */
function Goods({ lines, where, onOpen }: { lines: InventoryLine[]; where: Where; onOpen: (o: Open) => void }) {
  const n = useNames()
  const [group, setGroup] = useState('all')
  const groups = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of lines) { const g = l.shelf?.group || l.category || 'other'; if (!seen.has(g)) seen.set(g, groupWord(g, l.shelf?.label)) }
    return [...seen.entries()]
  }, [lines])
  const shown = group === 'all' ? lines : lines.filter((l) => (l.shelf?.group || l.category || 'other') === group)
  return (
    <>
      {groups.length > 1 && (
        <Pills items={[{ key: 'all', label: t('goods.cat.all') }, ...groups.map(([k, label]) => ({ key: k, label }))]} value={groups.some(([k]) => k === group) ? group : 'all'} onChange={setGroup} />
      )}
      <div className="n-eco-grid">
        {shown.map((l, i) => <Cell key={`${l.serial || l.item?.code}:${i}`} l={l} name={n.item(l.item) || '—'} tone={where === 'claim' ? 'warn' : undefined} onOpen={() => onOpen({ line: l, where })} />)}
      </div>
    </>
  )
}

export function Inventory({ response, loading }: NScreenProps) {
  const n = useNames()
  const [tab, setTab] = useState<'carried' | 'home'>('carried')
  const [open, setOpen] = useState<Open | null>(null)
  if (!response) return <NoAnswer loading={loading} title={t('inventory.title')} />
  const v = response.view as unknown as InventoryView
  const acts = actsOf(response)

  // a worn bag sits in its slot, it is not a good that is carried: never listed in the goods too
  const worn = (v.bags ?? []).flatMap((s) => (s.bag ? [s.bag] : []))
  const serials = new Set(worn.map((b) => b.serial).filter(Boolean))
  const lines = (v.lines ?? []).filter((l) => !(l.serial && serials.has(l.serial)))
  const claims = v.claims ?? []
  const home = v.home
  const c = v.carry
  const used = c ? c.used + c.reserved : 0
  const frac = c && c.capacity > 0 ? used / c.capacity : 0
  const full = !!c && c.capacity > 0 && used >= c.capacity
  const kinds = lines.length
  const count = lines.reduce((s, l) => s + l.qty, 0)

  return (
    <Page title={t('inventory.title')} sub={kinds ? t('inventory.total', { n: formatNumber(kinds), m: formatNumber(count) }) : undefined}>
      <Said r={response} />
      {home && <Segmented items={[{ key: 'carried', label: t('sm.tab.carried') }, { key: 'home', label: t('sm.tab.home') }]} value={tab} onChange={setTab} />}

      {tab === 'carried' && (
        <>
          {c && c.capacity > 0 && (
            <Hero art="m_backpack">
              <p className="n-label">{t('sm.fill.space')}</p>
              <p className="n-big n-eco-big"><span dir="ltr">{formatNumber(used)}</span><small> / {formatNumber(c.capacity)}</small></p>
              <div className="n-eco-cap"><Meter frac={frac} thick tone={full ? 'bad' : frac >= 0.8 ? 'warn' : 'accent'} /></div>
              <div className="n-hero-line n-chips">
                {c.hard_g > 0 && <Chip><Icon name="x_muscle" size={18} />{t('n.eco.load', { w: kg(c.load_g), h: kg(c.hard_g) })}</Chip>}
                {c.reserved > 0 && <Chip tone="cyan">{t('n.eco.reserved', { n: formatNumber(c.reserved) })}</Chip>}
              </div>
            </Hero>
          )}
          {c && c.comfort_g > 0 && c.load_g > c.comfort_g && <Note tone="bad" icon="x_muscle">{t('sm.fill.load', { w: kg(c.load_g), c: kg(c.comfort_g), h: kg(c.hard_g) })}</Note>}
          {full && <Note tone="bad" icon="m_backpack">{t('sm.fill.full')}</Note>}

          {(v.bags ?? []).length > 0 && (
            <>
              <Section title={t('sm.bags.title')} />
              <div className="n-eco-slots">{(v.bags ?? []).map((s) => <Slot key={s.slot} s={s} name={s.bag ? n.item(s.bag.item) : ''} />)}</div>
            </>
          )}

          {claims.length > 0 && (
            <>
              <Section title={t('sm.claims.title')} />
              <Note tone="info" icon="x_chest">{t('sm.claims.hint')}</Note>
              <Goods lines={claims} where="claim" onOpen={setOpen} />
            </>
          )}

          <Section title={t('n.eco.goods')} note={kinds ? formatNumber(kinds) : undefined} />
          {lines.length === 0 ? <Empty icon="m_backpack">{t('inventory.empty')}</Empty> : <Goods lines={lines} where="carried" onOpen={setOpen} />}
          {!!v.in_escrow && <Note tone="info" icon="m_lock">{t('inventory.escrow', { n: formatNumber(v.in_escrow) })}</Note>}
        </>
      )}

      {tab === 'home' && home && (
        <>
          <Hero art="house">
            <p className="n-label">{t('sm.home.title')}</p>
            <p className="n-big n-eco-big"><span dir="ltr">{formatNumber(home.used)}</span><small> / {formatNumber(home.capacity)}</small></p>
            <div className="n-eco-cap"><Meter frac={home.capacity ? home.used / home.capacity : 0} thick tone="cyan" /></div>
          </Hero>
          {!home.here && <Note tone="info" icon="walk">{t('sm.home.away')}</Note>}
          {(home.lines ?? []).length === 0 ? <Empty icon="house">{t('sm.home.empty')}</Empty> : <Goods lines={home.lines ?? []} where="home" onOpen={setOpen} />}
        </>
      )}

      <More acts={acts} skip={(a) => idOf(a) === 'item.open'} />

      {open && <ItemSheet open={open} canFetch={!!home?.here} acts={acts} onClose={() => setOpen(null)} />}
    </Page>
  )
}

// -- a good's sheet ----------------------------------------------------------------------------------------

/** The sheet of a good: its facts read from the server (inventory.item), then what can be done with it. A good that
 * waits for room is claimed; one at home is brought to the bag. */
function ItemSheet({ open, canFetch, acts, onClose }: { open: Open; canFetch: boolean; acts: Action[]; onClose: () => void }) {
  const nav = useNav()
  const n = useNames()
  const l = open.line
  const ref = l.serial || l.item.code
  const [res, setRes] = useState<CommandResponse | null>(null)
  const [failed, setFailed] = useState(false)
  // the server's own way to open this good (its action), else the read the old screens made
  const openAct = find(acts, 'item.open', { item: ref })
  useEffect(() => {
    if (open.where !== 'carried') return
    let live = true
    api.runCommand(openAct?.command ?? 'inventory.item', { ...(openAct?.args ?? { item: ref }) })
      .then((r) => { if (live) { if (r.ok !== false) setRes(r); else setFailed(true) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, open.where])

  const name = n.item(l.item) || '—'
  const icon = itemIcon(l.item.code, l.shelf?.group, l.category)
  const run = (a: Action) => { onClose(); nav.act(a) }
  const qty = String(l.qty || 1)

  return (
    <Sheet title={name} icon={icon} onClose={onClose}>
      {open.where === 'claim' && (
        <>
          <p className="n-eco-hint">{t('sm.claims.hint')}</p>
          <Button block onClick={() => run({ command: 'inventory.claim', args: { item: ref, qty }, kind: 'primary' })}>{t('sm.claims.take')}</Button>
        </>
      )}
      {open.where === 'home' && (
        <Button block disabled={!canFetch} reason={t('sm.home.away')} onClick={() => run({ command: 'inventory.fetch', args: { item: ref, qty }, kind: 'primary' })}>{t('sm.home.take')}</Button>
      )}
      {open.where === 'carried' && (
        res ? <ItemBody d={res.view as unknown as ItemDetailView} acts={actsOf(res)} onAct={run} />
          : failed ? <Empty icon="x_wanted">{t('common.load_failed')}</Empty> : <Loading blocks={[64, 48, 48]} />
      )}
    </Sheet>
  )
}

/** A good's facts and what can be done with it: use (the orange button), sell, give, throw away. */
function ItemBody({ d, acts, onAct }: { d: ItemDetailView; acts: Action[]; onAct: (a: Action) => void }) {
  const n = useNames()
  const use = find(acts, 'item.use')
  const sell = acts.filter((a) => idOf(a).startsWith('item.sell'))
  const give = acts.filter((a) => idOf(a) === 'item.give')
  const drop = find(acts, 'item.drop')
  const cooling = d.cooling_for_seconds > 0
  const drawn = new Set<Action>([...(use ? [use] : []), ...sell, ...give, ...(drop ? [drop] : [])])
  const giveName = (a: Action) => {
    const to = a.args?.to ?? a.subject ?? ''
    const f = (d.give_to ?? []).find((x) => x.code === to)
    return f ? n.names.name('player', f.code, f.name) : to
  }
  const figures = [
    { label: t('eco.market.qty'), value: formatNumber(d.qty) },
    ...(d.worth ? [{ label: t('n.eco.worth'), value: moneyMain(d.worth) }] : []),
    ...(d.quality ? [{ label: t('n.eco.quality'), value: formatNumber(d.quality) }] : []),
    ...(d.durability ? [{ label: t('n.eco.uses'), value: `${formatNumber(d.uses_left)} / ${formatNumber(d.durability)}` }] : []),
  ]
  return (
    <>
      <div className="n-eco-figs">{figures.map((f, i) => <div key={i}><span>{f.label}</span><b>{f.value}</b></div>)}</div>
      {(d.effects ?? []).length > 0 && (
        <div className="n-chips">
          {(d.effects ?? []).map((e, i) => (
            <Chip key={i} tone={(LOWER_IS_GOOD.has(e.target) ? e.value <= 0 : e.value >= 0) ? 'ok' : 'bad'}>
              {vitalWord(e.target)} <span dir="ltr">{e.value > 0 ? '+' : ''}{formatNumber(e.value)}</span>
            </Chip>
          ))}
        </div>
      )}
      {d.bag && <p className="n-eco-hint">{t('sm.pop.bag', { space: formatNumber(d.bag.space), comfort: formatNumber(d.bag.comfort_kg), hard: formatNumber(d.bag.hard_kg) })}</p>}
      {d.gear && (d.gear.categories ?? []).length > 0 && (
        <div className="n-chips">{(d.gear.categories ?? []).map((c) => <Chip key={c.code} tone="cyan">{n.names.name(['crime_category', 'crime'], c.code, c.name)}</Chip>)}</div>
      )}
      {cooling && <Note tone="info" icon="stopwatch">{t('sm.pop.cooling', { t: hms(d.cooling_for_seconds) })}</Note>}
      {use && <Button block icon="m_check" disabled={cooling} onClick={() => onAct(withArgs(use, {}))}>{t('sm.pop.use')}</Button>}
      {(sell.length > 0 || give.length > 0) && (
        <div className="n-eco-acts">
          {sell.map((a, i) => <Button key={i} kind="ghost" icon={idOf(a) === 'item.sell_shop' ? 'market' : 'trade'} onClick={() => onAct(a)}>{idOf(a) === 'item.sell_market' ? t('sm.pop.sell') : actionLabel(a)}</Button>)}
          {give.map((a, i) => <Button key={`g${i}`} kind="cyan" icon="gift" onClick={() => onAct(withArgs(a, {}, 'navigation'))}>{t('sm.pop.give', { name: giveName(a) })}</Button>)}
        </div>
      )}
      <More acts={acts} skip={(a) => drawn.has(a)} title="" />
      {drop && <Button block kind="danger" onClick={() => onAct(withArgs(drop, {}, 'navigation'))}>{t('sm.pop.drop')}</Button>}
    </>
  )
}

/** The good's own page (inventory.item opened as a screen). */
export function ItemDetail({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const d = response.view as unknown as ItemDetailView
  return (
    <Page title={n.item(d.item)}>
      <Said r={response} />
      <div className="n-eco-itemhead">
        <span className="n-eco-itemwell"><Icon name={itemIcon(d.item.code, undefined, d.category)} /></span>
        {d.category && <Chip>{groupWord(d.category)}</Chip>}
      </div>
      <ItemBody d={d} acts={actsOf(response)} onAct={(a) => nav.act(a)} />
    </Page>
  )
}

// -- after using, giving, throwing away ---------------------------------------------------------------------

export function ItemUsed({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ItemUsedView
  return (
    <Done title={t('n.eco.used_title')} icon={itemIcon(v.item.code)} lead={t('n.eco.used', { item: n.item(v.item) })} acts={actsOf(response)}>
      {(v.changes ?? []).length > 0 && (
        <div className="n-card n-eco-changes">
          {(v.changes ?? []).map((c, i) => (
            <Meter key={i} frac={c.max ? c.after / c.max : 0} tone={LOWER_IS_GOOD.has(c.target) ? 'warn' : 'cyan'}
              label={vitalWord(c.target)} value={<span dir="ltr">{formatNumber(c.before)} → {formatNumber(c.after)}</span>} />
          ))}
        </div>
      )}
      <div className="n-chips n-eco-center">
        <Chip>{t('sm.pop.qty', { n: formatNumber(v.left) })}</Chip>
        {v.cooldown_seconds > 0 && <Chip tone="cyan">{t('sm.pop.cooling', { t: hms(v.cooldown_seconds) })}</Chip>}
      </div>
    </Done>
  )
}

export function ItemGiven({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ItemGivenView
  return <Done title={t('n.eco.given_title')} icon="gift" lead={t('n.eco.given', { item: n.item(v.item), name: n.names.name('player', v.to.code, v.to.name) })} acts={actsOf(response)} />
}

export function ItemDropped({ response, loading }: NScreenProps) {
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ItemDroppedView
  return <Done title={t('n.eco.dropped_title')} icon={itemIcon(v.item.code)} tone="info" lead={t('n.eco.dropped', { item: n.item(v.item) })} acts={actsOf(response)} />
}

/** The server asks before a good is thrown away: the good, the question, a red yes and the way back. */
export function DropConfirm({ response, loading }: NScreenProps) {
  const nav = useNav()
  const n = useNames()
  if (!response) return <NoAnswer loading={loading} />
  const v = response.view as unknown as ItemDroppedView
  const acts = actsOf(response)
  const yes = acts.find((a) => !isBack(a) && (a.kind === 'confirm' || a.kind === 'danger' || idOf(a) === 'confirm'))
  const no = acts.find(isBack)
  const name = n.item(v.item)
  return (
    <Page title={t('sm.pop.drop')}>
      <Said r={response} />
      <section className="n-eco-done bad">
        <span className="n-eco-done-glow" aria-hidden="true" />
        <Icon name={itemIcon(v.item.code)} className="n-eco-done-ic" />
        <p className="n-eco-done-lead">{t('sm.pop.drop_sure', { name })}</p>
      </section>
      <Buttons lead>
        {yes && <Button kind="danger" onClick={() => nav.act(withArgs(yes, {}))}>{t('sm.pop.drop')}</Button>}
        {no && <Button kind="ghost" onClick={() => nav.act(no)}>{actionLabel(no)}</Button>}
      </Buttons>
    </Page>
  )
}
