// The one grid of goods the storage screens share (storage and market audit F12, F13; owner 2026-10-03): the backpack,
// the settlement store, «انبار من» and the holding slot all draw their goods as cells in this grid, 3 to 4 to a row on a
// phone (390 px) and 6 to 8 on a desktop (1440 px); the market and the shop draw theirs as `GoodsCard`s instead.
// A cell is an icon, a short name and a quantity badge; a tap opens the good's popup. `FillBar` is the storage's
// fill above the grid: what is held, what is reserved, and the room (theme tokens, never hex).

import type { ReactNode } from 'react'
import Icon from '../Icon'
import { PBar } from './panel'

/** The icon of a good: its own glyph when it has one, else its shelf's or category's, else a box. */
// the village goods of ADR 0050 use the closest icon of the kit: firewood = logs, clay = stone, pots = flask, hide = bag, rag = cloth, paper = scroll, tools = tool
const ITEM_ICON: Record<string, string> = { bread: 'bread', bandage: 'pill', phone: 'phone', lockpick_set: 'keys', firewood: 'logs', clay: 'stone', pots: 'flask', hide: 'bag', rag: 'cloth', paper: 'scroll', tools: 'tool', timber: 'wood', plank: 'plank', stone: 'stone', cloth: 'cloth', wheat: 'wheat' }
const GROUP_ICON: Record<string, string> = {
  food: 'bread', medicine: 'pill', gear: 'gears', electronics: 'phone', defence: 'shield',
  mineral: 'ore', metal_ore: 'ore', vehicles: 'x_car', wood: 'x_field', bags: 'm_backpack', clothing: 'box', tools: 'gears',
}

export function itemIconName(code: string, ...groups: (string | undefined)[]): string {
  if (ITEM_ICON[code]) return ITEM_ICON[code]
  for (const g of groups) if (g && GROUP_ICON[g]) return GROUP_ICON[g]
  return 'box'
}

export interface GridCell {
  key: string
  name: string
  icon?: string
  qty?: number
  /** a small line under the name: wear, quality, a class */
  sub?: ReactNode
  tone?: 'warn' | 'bad' | 'good'
  onClick?: () => void
}

export function ItemGrid({ cells, label }: { cells: GridCell[]; label?: string }) {
  return (
    <div className="ig-wrap">
      <div className="ig-grid" role="list" aria-label={label}>
        {cells.map((c) => {
          const body = (
            <>
              {c.qty != null && c.qty > 1 && <span className="ig-qty">{c.qty}×</span>}
              <Icon name={c.icon ?? 'box'} palette="gold" size={34} />
              <span className="ig-name">{c.name}</span>
              {c.sub && <span className="ig-sub">{c.sub}</span>}
            </>
          )
          const cls = `ig-cell${c.tone ? ' ' + c.tone : ''}`
          return c.onClick
            ? <button key={c.key} role="listitem" className={cls} onClick={c.onClick}>{body}</button>
            : <div key={c.key} role="listitem" className={cls}>{body}</div>
        })}
      </div>
    </div>
  )
}

/** The fill of a storage above its grid: the share held (green; amber near full, red full), the share reserved
 * for running shifts and open bids (a darker part), and the figures. */
export function FillBar({ used, capacity, reserved = 0, label, figures, over }: {
  /** per-class bars: red only when something is held beyond the room; a full bar that fits is amber */
  over?: number
  used: number
  capacity: number
  reserved?: number
  label: ReactNode
  figures: ReactNode
}) {
  const frac = capacity > 0 ? (used + reserved) / capacity : 0
  const tone = over !== undefined ? (over > 0 ? 'bad' : frac >= 0.9 ? 'low' : undefined) : frac >= 1 ? 'bad' : frac >= 0.85 ? 'low' : undefined
  return (
    <div className="ig-fill">
      <div className="ig-fill-head"><span>{label}</span><b>{figures}</b></div>
      <PBar frac={frac} tone={tone} />
    </div>
  )
}
