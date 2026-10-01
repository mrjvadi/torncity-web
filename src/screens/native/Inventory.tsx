// The backpack, after the prototype's inventory (screens_proto.gd
// `_s_inventory`): a summary banner, category chips and a grid of item
// tiles with their own glyph and a quantity badge. Facts from the
// `inventory` view; the item's own page is `inventory.item`.

import { useState } from 'react'
import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll, Segmented } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber } from './kit/format'
import Icon from '../../ui/Icon'
import { t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

interface InventoryLine {
  item?: { code?: string; name?: string }
  category?: string
  qty?: number
  quality?: number
  uses_left?: number
  serial?: string
  durability?: number
}
interface InventoryView { lines?: InventoryLine[] | null; page?: number; pages?: number; total?: number; in_escrow?: number }

const CATEGORY_ICON: Record<string, string> = {
  food: 'bread', medicine: 'pill', gear: 'gears', electronics: 'phone', defence: 'shield',
  mineral: 'ore', metal_ore: 'ore', vehicles: 'x_car', wood: 'x_field',
}
const ITEM_ICON: Record<string, string> = { bread: 'bread', bandage: 'pill', phone: 'phone', lockpick_set: 'keys' }
const KNOWN_CATEGORIES = ['food', 'medicine', 'gear', 'electronics', 'defence', 'mineral', 'metal_ore', 'vehicles']

const itemIcon = (l: InventoryLine) => ITEM_ICON[l.item?.code ?? ''] ?? CATEGORY_ICON[l.category ?? ''] ?? 'box'
const catLabel = (c: string) => (KNOWN_CATEGORIES.includes(c) ? t(`inventory.cat.${c}` as Key) : c.replace(/_/g, ' '))

export default function Inventory({ response, loading, onAction, run }: ScreenProps) {
  const [cat, setCat] = useState('')
  const names = useContentNames()
  const v = (response?.view ?? {}) as InventoryView
  if (loading && !response) return <ScreenScroll><Header title={t('inventory.title')} tone="gold" /></ScreenScroll>

  const all = v.lines ?? []
  const cats = [...new Set(all.map((l) => l.category).filter((c): c is string => !!c))]
  const lines = cat ? all.filter((l) => l.category === cat) : all
  const pieces = all.reduce((s, l) => s + (l.qty ?? 1), 0)

  return (
    <ScreenScroll>
      <Header title={t('inventory.title')} tone="gold" onRefresh={() => run('inventory.show')} />

      {all.length === 0 && <Notice>{t('inventory.empty')}</Notice>}
      {all.length > 0 && (
        <Card>
          <div className="inv-banner">
            <Icon name="m_backpack" palette="gold" size={30} />
            <span>{t('inventory.total', { n: formatNumber(v.total ?? all.length), m: formatNumber(pieces) })}</span>
          </div>
        </Card>
      )}
      {!!v.in_escrow && <Notice>{t('inventory.escrow', { n: formatNumber(v.in_escrow) })}</Notice>}

      {cats.length > 1 && (
        <Segmented value={cat} onChange={setCat}
          options={[{ key: '', label: t('inventory.all') }, ...cats.map((c) => ({ key: c, label: catLabel(c) }))]} />
      )}

      <div className="nx-tilegrid">
        {lines.map((l, i) => (
          <button
            key={i}
            className="nx-tile"
            onClick={() => l.item?.code && run('inventory.item', { item: l.serial || l.item.code })}
          >
            {!!(l.qty && l.qty > 1) && <span className="nx-tile-badge inv-badge">{formatNumber(l.qty)}×</span>}
            <Icon name={itemIcon(l)} palette="gold" size={34} />
            <span className="nx-tile-title display">{l.item?.code ? names.name('item', l.item.code, l.item.name) : '—'}</span>
            {(l.durability || l.uses_left) ? (
              <span className="nx-tile-sub">
                {l.durability ? t('inventory.durability', { n: formatNumber(l.durability) }) : t('inventory.uses', { n: formatNumber(l.uses_left ?? 0) })}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="inventory.show" />
    </ScreenScroll>
  )
}
