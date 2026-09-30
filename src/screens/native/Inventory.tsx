import type { ScreenProps } from '../types'
import { Header, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber } from './kit/format'
import Icon from '../../ui/Icon'
import { t } from '../../i18n'

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
  if (loading && !response) return <ScreenScroll><Header title={t('inventory.title')} tone="gold" /></ScreenScroll>

  const lines = v.lines ?? []

  return (
    <ScreenScroll>
      <Header title={t('inventory.title')} tone="gold" onRefresh={() => run('inventory.show')} />

      {lines.length === 0 && <Notice>{t('inventory.empty')}</Notice>}
      {!!v.in_escrow && <Notice>{t('inventory.escrow', { n: formatNumber(v.in_escrow) })}</Notice>}

      <div className="nx-tilegrid">
        {lines.map((l, i) => (
          <button
            key={i}
            className="nx-tile"
            onClick={() => l.item?.code && run('inventory.item', { item: l.item.code })}
          >
            {!!(l.qty && l.qty > 1) && <span className="nx-tile-badge">{formatNumber(l.qty)}×</span>}
            <Icon name="box" palette="gold" size={28} />
            <span className="nx-tile-title display">{l.item?.name ?? l.item?.code ?? '—'}</span>
            {(l.durability !== undefined || l.uses_left !== undefined) && (
              <span className="nx-tile-sub">
                {l.durability !== undefined ? t('inventory.durability', { n: formatNumber(l.durability) }) : t('inventory.uses', { n: formatNumber(l.uses_left ?? 0) })}
              </span>
            )}
          </button>
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="inventory.show" />
    </ScreenScroll>
  )
}
