// A good in the market or a shop, as a card (storage and market audit F13): built on the grid pass's `PCard`
// inside a `CardGrid` (2 per row on a phone, 3 to 4 on desktop), so it looks like every other list of choices.
// The server's `shelf` words the group tabs and the source says whose it is; the price is the card's own line.

import { rich } from './rich'
import type { ReactNode } from 'react'
import { PCard } from './panel'
import { itemIconName } from './ItemGrid'
import Icon from '../Icon'

export interface GoodsCardProps {
  code: string
  name: string
  /** the shelf group (food, bags...) for the fallback icon */
  group?: string
  price?: ReactNode
  /** a second price line: the best bid, the reference */
  price2?: ReactNode
  /** stock left, a quantity held */
  badge?: ReactNode
  /** whose it is: «از دکان», «از اهالی» */
  source?: ReactNode
  tone?: 'busy' | 'off' | 'danger' | 'good'
  off?: boolean
  foot?: ReactNode
  onClick?: () => void
}

export default function GoodsCard({ code, name, group, price, price2, badge, source, tone, off, foot, onClick }: GoodsCardProps) {
  return (
    <PCard
      lead={<Icon name={itemIconName(code, group)} palette="gold" size={40} />}
      title={name}
      sub={source}
      facts={(price != null || price2 != null) ? <>{price != null && <b className="gc-price">{rich(price)}</b>}{price2 != null && <span>{rich(price2)}</span>}</> : undefined}
      badge={badge}
      tone={tone}
      off={off}
      foot={foot}
      onClick={onClick}
    />
  )
}
