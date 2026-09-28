import { Plate, Emboss, GLabel } from '../../kit'
import type { IconPalette } from '../../kit'
import { shade } from '../../kit/color'
import type { BubbleScreenPoint } from '../../three/cityEngine'

export interface WorldBubbleDef {
  id: string
  text: string
  icon: string
  palette: IconPalette
  tint: 'teal' | 'sapphire' | 'violet' | 'amber'
  /** 0..1, hides the ring when omitted — home_proto.gd `_bubble` only rings
   * a bubble that is actually counting down (e.g. the factory shift). */
  progress?: number
  onTap?: () => void
}

interface WorldBubblesProps {
  bubbles: WorldBubbleDef[]
  points: BubbleScreenPoint[]
}

const TINT: Record<WorldBubbleDef['tint'], string> = {
  teal: '#2bc4b2', sapphire: '#3552c8', violet: '#8e6cf0', amber: '#f5a623',
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
        const tint = TINT[b.tint]
        const hasRing = typeof b.progress === 'number'
        const frac = Math.max(0, Math.min(1, b.progress ?? 0))
        const circ = 2 * Math.PI * 44
        return (
          <button key={b.id} className="bubble" style={{ left: p.x, top: p.y }} onClick={b.onTap}>
            <span className="bubble-plate-wrap">
              {hasRing && (
                <svg className="bubble-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" className="bubble-ring-track" />
                  <circle
                    cx="50" cy="50" r="44" className="bubble-ring-value" style={{ stroke: tint, strokeDasharray: `${frac * circ} ${circ}` }}
                  />
                </svg>
              )}
              <Plate size="calc(64 * var(--u))" light={shade(tint, 0.25)} dark={shade(tint, -0.6)} rim="var(--gold)">
                <Emboss name={b.icon} palette={b.palette} size="calc(42 * var(--u))" />
              </Plate>
            </span>
            <span className="bubble-chip" style={{ background: `linear-gradient(180deg, ${shade(tint, -0.45)}, ${shade(tint, -0.72)})` }}>
              <GLabel top="#ffffff" bottom="#f0f4ff" stroke={0.8}>{b.text}</GLabel>
            </span>
            <span className="bubble-pin" />
          </button>
        )
      })}
      <WorldBubbleStyles />
    </div>
  )
}

function WorldBubbleStyles() {
  return (
    <style>{`
      /* world bubbles: a ready-state pinned over the building it belongs to
         (home_proto.gd _bubble), anchored by the city engine's own
         projection so it tracks a pan/zoom exactly like the buildings
         under it. Sizes are the prototype's own Rect2 numbers (box 150x140,
         plate 76px) as calc(N * var(--u)). */
      .world-bubbles { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
      .bubble {
        position: absolute; transform: translate(-50%, -100%);
        display: flex; flex-direction: column; align-items: center;
        pointer-events: auto; padding: 0; background: none; border: none;
        animation: bubble-float 2.6s ease-in-out infinite;
      }
      .bubble-plate-wrap { position: relative; width: calc(64 * var(--u)); height: calc(64 * var(--u)); }
      .bubble-ring { position: absolute; inset: calc(-9 * var(--u)); width: calc(100% + 18 * var(--u)); height: calc(100% + 18 * var(--u)); transform: rotate(-90deg); }
      .bubble-ring-track { fill: none; stroke: rgba(0,0,0,0.5); stroke-width: 7; }
      .bubble-ring-value { fill: none; stroke-width: 7; stroke-linecap: round; }
      .bubble-chip {
        position: relative; margin-top: calc(4 * var(--u)); z-index: 1;
        padding: calc(4 * var(--u)) calc(14 * var(--u)); border-radius: calc(19 * var(--u));
        font-size: calc(20 * var(--u)); white-space: nowrap;
        border: calc(2.5 * var(--u)) solid var(--gold);
        box-shadow: 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.4);
      }
      .bubble-pin {
        width: 0; height: 0; margin-top: calc(-2 * var(--u));
        border-left: calc(9 * var(--u)) solid transparent; border-right: calc(9 * var(--u)) solid transparent;
        border-top: calc(13 * var(--u)) solid var(--gold);
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4));
      }
      @keyframes bubble-float { 0%, 100% { margin-top: 0; } 50% { margin-top: calc(-6 * var(--u)); } }
    `}</style>
  )
}
