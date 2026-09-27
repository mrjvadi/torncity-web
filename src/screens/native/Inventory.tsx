import type { ScreenProps } from '../types'
import { Header, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber } from './kit/format'
import Icon from '../../ui/Icon'

interface InventoryLine {
  item?: { code?: string; name?: string }
  category?: string
  qty?: number
  quality?: number
  uses_left?: number
  durability?: number
}
interface InventoryView { lines?: InventoryLine[] | null; page?: number; pages?: number; total?: number; in_escrow?: number }

export default function Inventory({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as InventoryView
  if (loading && !response) return <ScreenScroll><Header title="کوله‌پشتی" tone="gold" /></ScreenScroll>

  const lines = v.lines ?? []

  return (
    <ScreenScroll>
      <Header title="کوله‌پشتی" tone="gold" onRefresh={() => run('inventory.show')} />

      {lines.length === 0 && <Notice>کوله‌پشتی‌ات خالی است.</Notice>}
      {!!v.in_escrow && <Notice>{formatNumber(v.in_escrow)} در امانت (سفارش‌های باز)</Notice>}

      <div className="nx-tilegrid">
        {lines.map((l, i) => (
          <button
            key={i}
            className="nx-tile"
            onClick={() => l.item?.code && run('inventory.item', { item: l.item.code })}
          >
            {!!(l.qty && l.qty > 1) && <span className="nx-tile-badge">{formatNumber(l.qty)}×</span>}
            <Icon name="box" palette="gold" size={36} />
            <span className="nx-tile-title display">{l.item?.name ?? l.item?.code ?? '—'}</span>
            {(l.durability !== undefined || l.uses_left !== undefined) && (
              <span className="nx-tile-sub">
                {l.durability !== undefined ? `دوام ${formatNumber(l.durability)}%` : `${formatNumber(l.uses_left ?? 0)} بار مصرف`}
              </span>
            )}
          </button>
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
