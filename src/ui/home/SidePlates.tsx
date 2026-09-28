import type { CSSProperties } from 'react'
import { Plate, Emboss, Count, GLabel } from '../../kit'
import type { IconPalette } from '../../kit'

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
 * round plate with a gold rim (80/720 wide), an embossed glyph, a caption
 * ribbon under it, and — only when there is a real count to show — a red
 * badge. */
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
      {right.map((p, i) => <SidePlate key={p.id} {...p} side="right" top={topFor(i, right.length)} />)}
      {left.map((p, i) => <SidePlate key={p.id} {...p} side="left" top={topFor(i, left.length)} />)}
      <SidePlateStyles />
    </div>
  )
}

/** Even centre offsets within the city view's own height: the first plate
 * clears the HUD above it, the last stays above the ready card at the foot. */
function topFor(i: number, count: number): string {
  const frac = count > 1 ? i / (count - 1) : 0
  return `calc(44px + (100% - 44px - 160px) * ${frac.toFixed(3)})`
}

function SidePlate({ icon, palette, label, count, onTap, side, top }: PlateDef & { side: 'left' | 'right'; top: string }) {
  return (
    <button className="plate" style={{ top, [side]: '4%' } as CSSProperties} onClick={onTap}>
      <Plate size="calc(80 * var(--u))" rimWidth="calc(3 * var(--u))">
        <Emboss name={icon} palette={palette} size="calc(50 * var(--u))" />
        {!!count && count > 0 && <Count n={count} size="calc(26 * var(--u))" className="plate-count" />}
      </Plate>
      <span className="plate-cap"><GLabel top="#ffffff" bottom="#e8ecff" stroke={0.8}>{label}</GLabel></span>
    </button>
  )
}

function SidePlateStyles() {
  return (
    <style>{`
      /* the side plate buttons over the city (home_proto.gd _side_buttons):
         positions are physical (left/right), not logical, on purpose — the
         prototype itself lays this HUD out unmirrored, so a right-hand
         button stays on the screen's right whether the page is RTL or not. */
      .side-plates { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
      .plate { position: absolute; display: flex; flex-direction: column; align-items: center; gap: calc(3 * var(--u)); pointer-events: auto; padding: 0; transform: translateY(-50%); }
      .plate-count { position: absolute; top: calc(-8 * var(--u)); inset-inline-end: calc(-6 * var(--u)); }
      .plate-cap {
        background: linear-gradient(180deg, #14183a, #05070f);
        border: 1.5px solid var(--gold-soft); border-radius: calc(10 * var(--u));
        padding: calc(3 * var(--u)) calc(9 * var(--u)); font-size: calc(17 * var(--u)); white-space: nowrap;
        box-shadow: 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.4);
      }
    `}</style>
  )
}
