import type { CSSProperties } from 'react'
import Icon from '../Icon'
import type { IconPalette } from '../Icon'

interface PlateDef {
  id: string
  icon: string
  palette: IconPalette
  label: string
  count?: number
  onTap: () => void
}

interface SidePlatesProps {
  onMissions: () => void
  onGift: () => void
  onRank: () => void
  onInbox: () => void
  onFaction: () => void
}

/** The two columns of plate buttons that float over the city, either side of
 * the world bubbles (home_proto.gd `_side_buttons`/`_plate_icon`): a dark
 * round plate with a gold rim, an embossed glyph, a caption ribbon under it,
 * and — only when there is a real count to show — a red badge. */
export default function SidePlates({ onMissions, onGift, onRank, onInbox, onFaction }: SidePlatesProps) {
  const right: PlateDef[] = [
    { id: 'missions', icon: 'missions', palette: 'violet', label: 'مأموریت', onTap: onMissions },
    { id: 'gift', icon: 'gift', palette: 'ruby', label: 'جایزه‌ی روز', onTap: onGift },
    { id: 'rank', icon: 'trophy', palette: 'gold', label: 'رتبه', onTap: onRank },
  ]
  const left: PlateDef[] = [
    { id: 'inbox', icon: 'inbox', palette: 'sapphire', label: 'پیام‌ها', onTap: onInbox },
    { id: 'faction', icon: 'society', palette: 'teal', label: 'جناح', onTap: onFaction },
  ]

  return (
    <div className="side-plates" aria-hidden={false}>
      {right.map((p, i) => <Plate key={p.id} {...p} side="right" top={topFor(i, right.length)} />)}
      {left.map((p, i) => <Plate key={p.id} {...p} side="left" top={topFor(i, left.length)} />)}
    </div>
  )
}

/** Even top offsets within the city view's own height, not the viewport's —
 * the column starts a little below the HUD and never crowds the dock. */
function topFor(i: number, count: number): string {
  const start = 6
  const span = 46
  return `${start + (i * span) / Math.max(1, count - 1 || 1)}%`
}

function Plate({ icon, palette, label, count, onTap, side, top }: PlateDef & { side: 'left' | 'right'; top: string }) {
  return (
    <button className="plate" style={{ top, [side]: '4%' } as CSSProperties} onClick={onTap}>
      <span className="plate-ring">
        <Icon name={icon} palette={palette} size={34} />
      </span>
      <span className="plate-cap display">{label}</span>
      {!!count && count > 0 && <span className="plate-count">{count < 100 ? count : '99+'}</span>}
    </button>
  )
}
