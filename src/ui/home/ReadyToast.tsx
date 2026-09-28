import { Frame, Emboss, GLabel, Slab } from '../../kit'

interface ReadyToastProps {
  title: string
  subtitle: string
  cta: string
  onTap: () => void
}

/** The bottom CTA card over the dock (home_proto.gd `_ready_toast`, Rect2(14,
 * 950, 692, 100)): a teal glowing frame nearly full width and a fixed
 * height, a big energy glyph (104/720) overlapping its top-right corner, a
 * big gold slab button inset at its top-left, and the title/subtitle
 * filling the gap between them. CityView only mounts this when there is a
 * real reason to show it (energy near full and a shift to start) — never a
 * fixed "always on" banner. */
export default function ReadyToast({ title, subtitle, cta, onTap }: ReadyToastProps) {
  return (
    <div className="ready-toast">
      <Frame radius="calc(30 * var(--u))" top="#0f3a3e" bottom="#04121a" trim="var(--gold)" trimWidth="calc(2.5 * var(--u))" glow="rgba(43,196,178,0.5)" patternSize="calc(46 * var(--u))" className="ready-toast-frame">
        <Slab tone="gold" radius="calc(22 * var(--u))" lip="calc(8 * var(--u))" onClick={onTap} className="ready-toast-cta">
          <GLabel top="#5a2a00" bottom="#3a1600" stroke={0}>{cta}</GLabel>
        </Slab>
        <div className="ready-toast-title"><GLabel top="#ffffff" bottom="#cff7f1" stroke={1.2}>{title}</GLabel></div>
        <div className="ready-toast-sub">{subtitle}</div>
      </Frame>
      <span className="ready-toast-icon"><Emboss name="energy" palette="amber" size="calc(104 * var(--u))" /></span>
      <ReadyToastStyles />
    </div>
  )
}

function ReadyToastStyles() {
  return (
    <style>{`
      /* the bottom ready-toast CTA card over the dock (home_proto.gd
         _ready_toast): the card spans 692/720 of the width at a fixed
         100/720-tall, and every child below sits at that Rect2's own local
         offset (canvas x/y minus the card's own 14,950 origin) rather than
         flowing in a row, since the icon, button and text overlap it in
         ways plain flex can't reproduce. */
      .ready-toast { position: absolute; left: calc(14 * var(--u)); right: calc(14 * var(--u)); bottom: calc(14 * var(--u)); z-index: 6; height: calc(100 * var(--u)); }
      .ready-toast-frame { position: absolute; inset: 0; }
      /* physical left (16,16,182,70): the button sits inset at the card's
         own top-left corner, regardless of the page's RTL flow. */
      .ready-toast-cta { position: absolute; left: calc(16 * var(--u)); top: calc(16 * var(--u)); width: calc(182 * var(--u)); height: calc(70 * var(--u)); font-size: calc(23 * var(--u)); }
      /* physical left (212,10,364) and (192,52,384): the title/subtitle
         block, right-aligned within its own box so the text still hugs the
         reading edge. */
      .ready-toast-title { position: absolute; left: calc(212 * var(--u)); top: calc(10 * var(--u)); width: calc(364 * var(--u)); text-align: right; font-size: calc(26 * var(--u)); line-height: 1.25; }
      .ready-toast-sub { position: absolute; left: calc(192 * var(--u)); top: calc(52 * var(--u)); width: calc(384 * var(--u)); text-align: right; font-size: calc(16 * var(--u)); color: #bfe9e3; line-height: 1.3; }
      /* physical right, not inline-end: home_proto.gd _ready_toast embosses
         the icon near the card's own right edge (x=598-702 of a 14-706
         card, i.e. 4/720 in from the card's own right edge), poking above
         the card's top by 10/720, regardless of the page's RTL flow. */
      .ready-toast-icon { position: absolute; top: calc(-10 * var(--u)); right: calc(4 * var(--u)); z-index: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
    `}</style>
  )
}
