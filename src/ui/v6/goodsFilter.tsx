// Search, category tabs and sorting for a list of goods (the market, the storehouse). The three tools of a listing page,
// each doing its own job: SEARCH finds a good by name, the CATEGORY tabs narrow by the catalogue's own category of the
// good (general first, concrete words, only the categories that have goods in this list), SORT reorders what is left.
// Research (read): NN/g "Helpful Filter Categories and Values" - appropriate, predictable, jargon-free, prioritised
// categories with the most general first; NN/g "UX Guidelines for Ecommerce ... Listing Pages" - concise names and
// the price on every row; the WoW Auction House redesign (MMO-Champion, patch 8.3) - categories on one side, a search
// box, lowest price first, the buying and the selling side apart. The catalogue's categories are the server's
// (`items.yml: category`); this file only words them and groups the many fine ones into a few general tabs.
// Shelves (ADR 0046, storage and market audit F11): a good that carries the server's `shelf` is grouped by its
// `shelf.group` and the tab is worded by the server's `group_label`; the client's table below is only the fallback
// for a list whose goods carry no shelf (an older answer, the mock).

import { useMemo, useState } from 'react'
import { t, hasKey, type Key } from '../../i18n'

/** The catalogue's fine categories grouped into a few general tabs a player understands. Anything unlisted is «سایر». */
const GROUP: Record<string, string> = {
  food: 'food', drink: 'drink', grain: 'farm', crop: 'farm', seed: 'farm', fibre: 'materials',
  medicine: 'medicine', gear: 'gear', electronics: 'electronics', circuit: 'electronics', battery: 'electronics', board: 'electronics', casing: 'electronics', wire: 'electronics',
  valuables: 'valuables', gem: 'valuables', vehicles: 'vehicles', fuel: 'fuel', oil: 'fuel',
  wood: 'materials', mineral: 'materials', ore: 'materials', metal: 'materials', steel: 'materials', resin: 'materials', binder: 'materials', salt: 'materials', water: 'materials', leavening: 'food', flavouring: 'food', alkaloid: 'medicine',
}
const ORDER = ['food', 'drink', 'farm', 'medicine', 'gear', 'electronics', 'materials', 'fuel', 'vehicles', 'valuables', 'other']

export type SortKey = 'name' | 'low' | 'high' | 'qty'

/** The server's shelf of a good: the leaf and its top-level group, each worded by the server. */
export interface ShelfInfo { code?: string; group?: string; label?: string; group_label?: string }

export interface GoodsRow<T> { item: T; name: string; category: string; price?: number; qty?: number; shelf?: ShelfInfo }

/** The tab a catalogue category belongs to. */
export function groupOf(category: string): string { return GROUP[category] ?? 'other' }

/** The tab of a row: its shelf group when the server sent one, else the category's. */
const rowGroup = <T,>(r: GoodsRow<T>): string => (r.shelf?.group ? `shelf:${r.shelf.group}` : groupOf(r.category))

export function useGoodsFilter<T>(rows: GoodsRow<T>[], sorts: SortKey[]) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState<SortKey>(sorts[0] ?? 'name')
  const groups = useMemo(() => {
    const have = new Set(rows.map(rowGroup))
    const shelves = [...have].filter((g) => g.startsWith('shelf:')).sort()
    return [...shelves, ...ORDER.filter((g) => have.has(g))]
  }, [rows])
  // the server's own words for its shelf groups
  const labels = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) if (r.shelf?.group && r.shelf.group_label) m.set(`shelf:${r.shelf.group}`, r.shelf.group_label)
    return m
  }, [rows])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = rows.filter((r) => (cat === 'all' || rowGroup(r) === cat) && (!needle || r.name.toLowerCase().includes(needle)))
    out = [...out].sort((a, b) => {
      if (sort === 'low') return (a.price ?? Infinity) - (b.price ?? Infinity) || a.name.localeCompare(b.name, 'fa')
      if (sort === 'high') return (b.price ?? -1) - (a.price ?? -1) || a.name.localeCompare(b.name, 'fa')
      if (sort === 'qty') return (b.qty ?? 0) - (a.qty ?? 0) || a.name.localeCompare(b.name, 'fa')
      return a.name.localeCompare(b.name, 'fa')
    })
    return out
  }, [rows, q, cat, sort])
  // a tab that no longer has goods (the list changed) falls back to «همه»
  const catNow = cat === 'all' || groups.includes(cat) ? cat : 'all'
  return { q, setQ, cat: catNow, setCat, sort, setSort, groups, labels, shown, sorts }
}

const catLabel = (g: string, labels?: Map<string, string>) =>
  labels?.get(g) ?? (hasKey(`goods.cat.${g}`) ? t(`goods.cat.${g}` as Key) : t('goods.cat.other'))

export function GoodsTools({ f }: { f: ReturnType<typeof useGoodsFilter<unknown>> }) {
  return (
    <div className="gf">
      <div className="gf-search">
        <input type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder={t('goods.search')} aria-label={t('goods.search')} enterKeyHint="search" />
        {f.q && <button className="gf-clear" onClick={() => f.setQ('')} aria-label={t('goods.clear')}>×</button>}
      </div>
      {f.groups.length > 1 && (
        <div className="gf-cats" role="tablist">
          {['all', ...f.groups].map((g) => (
            <button key={g} role="tab" aria-selected={f.cat === g} className={f.cat === g ? 'on' : ''} onClick={() => f.setCat(g)}>{g === 'all' ? t('goods.cat.all') : catLabel(g, f.labels)}</button>
          ))}
        </div>
      )}
      <div className="gf-sort">
        <span>{t('goods.sort.label')}</span>
        {f.sorts.map((s) => <button key={s} className={f.sort === s ? 'on' : ''} onClick={() => f.setSort(s)}>{t(`goods.sort.${s}` as Key)}</button>)}
        <em>{t('goods.count', { n: f.shown.length })}</em>
      </div>
    </div>
  )
}
