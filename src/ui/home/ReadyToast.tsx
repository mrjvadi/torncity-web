import { Frame, Emboss, GLabel, Slab } from '../../kit'

interface ReadyToastProps {
  title: string
  subtitle: string
  cta: string
  onTap: () => void
}

/** The bottom CTA card over the dock (home_proto.gd `_ready_toast`): a teal
 * glowing frame nearly full width, an energy glyph overlapping its top
 * corner, and one gold slab button. CityView only mounts this when there is
 * a real reason to show it (energy near full and a shift to start) — never
 * a fixed "always on" banner. */
export default function ReadyToast({ title, subtitle, cta, onTap }: ReadyToastProps) {
  return (
    <div className="ready-toast">
      <Frame radius="calc(30 * var(--u))" top="#0f3a3e" bottom="#04121a" trim="var(--gold)" trimWidth="calc(2.5 * var(--u))" glow="rgba(43,196,178,0.5)" patternSize="calc(46 * var(--u))">
        <div className="ready-toast-row">
          <div className="ready-toast-copy">
            <div className="ready-toast-title"><GLabel top="#ffffff" bottom="#cff7f1" stroke={1}>{title}</GLabel></div>
            <div className="ready-toast-sub">{subtitle}</div>
          </div>
          <Slab tone="gold" radius="calc(22 * var(--u))" lip="calc(8 * var(--u))" onClick={onTap} className="ready-toast-cta">
            <GLabel top="#5a2a00" bottom="#3a1600" stroke={0}>{cta}</GLabel>
          </Slab>
        </div>
      </Frame>
      <span className="ready-toast-icon"><Emboss name="energy" palette="amber" size="calc(72 * var(--u))" /></span>
      <ReadyToastStyles />
    </div>
  )
}

function ReadyToastStyles() {
  return (
    <style>{`
      /* the bottom ready-toast CTA card over the dock (home_proto.gd
         _ready_toast): the card spans 692/720 of the width, its icon
         overlaps the card's top-right corner at 104/720 across. */
      .ready-toast { position: absolute; left: calc(14 * var(--u)); right: calc(14 * var(--u)); bottom: calc(14 * var(--u)); z-index: 6; }
      .ready-toast-row { display: flex; align-items: center; gap: calc(10 * var(--u)); padding: calc(4 * var(--u)) calc(70 * var(--u)) calc(4 * var(--u)) calc(4 * var(--u)); }
      /* physical right, not inline-end: home_proto.gd _ready_toast embosses
         the icon near the card's own right edge (x=598-702 of a 14-706
         card) in fixed canvas coordinates, regardless of the page's RTL
         flow — the row's own right padding above already reserves the
         space for it. */
      .ready-toast-icon { position: absolute; top: calc(-14 * var(--u)); right: calc(4 * var(--u)); z-index: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
      .ready-toast-copy { flex: 1; min-width: 0; text-align: right; }
      .ready-toast-title { font-size: calc(24 * var(--u)); line-height: 1.3; }
      .ready-toast-sub { font-size: calc(15 * var(--u)); color: #bfe9e3; margin-top: calc(2 * var(--u)); line-height: 1.3; }
      .ready-toast-cta { flex: none; padding: calc(6 * var(--u)) calc(20 * var(--u)); font-size: calc(21 * var(--u)); }
    `}</style>
  )
}
