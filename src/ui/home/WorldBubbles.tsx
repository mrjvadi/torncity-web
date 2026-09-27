import Icon from '../Icon'
import type { IconPalette } from '../Icon'
import type { BubbleScreenPoint } from '../../three/cityEngine'

export interface WorldBubbleDef {
  id: string
  text: string
  icon: string
  palette: IconPalette
  tint: 'teal' | 'sapphire' | 'violet' | 'amber'
  onTap?: () => void
}

interface WorldBubblesProps {
  bubbles: WorldBubbleDef[]
  points: BubbleScreenPoint[]
}

/** A "ready" callout hanging over the building it belongs to (home_proto.gd
 * `_bubble`, the Hay Day pattern): a pin, a plated icon, and a chip naming
 * what is ready. Only rendered for a bubble whose anchor is on-screen and
 * whose data the caller actually has — there is no placeholder bubble. */
export default function WorldBubbles({ bubbles, points }: WorldBubblesProps) {
  const byId = new Map(points.map((p) => [p.id, p]))
  return (
    <div className="world-bubbles">
      {bubbles.map((b) => {
        const p = byId.get(b.id)
        if (!p || !p.visible) return null
        return (
          <button
            key={b.id}
            className={`bubble bubble-${b.tint}`}
            style={{ left: p.x, top: p.y }}
            onClick={b.onTap}
          >
            <span className="bubble-plate"><Icon name={b.icon} palette={b.palette} size={22} /></span>
            <span className="bubble-chip display">{b.text}</span>
            <span className="bubble-pin" />
          </button>
        )
      })}
    </div>
  )
}
