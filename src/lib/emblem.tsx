// A village's emblem: a heraldic badge built from four codes of the server's
// catalogue (configs/content/founding.yml) - an outline (`shape`), two colours
// and an `icon` - and drawn here as an SVG. Nothing is uploaded and nothing
// is stored as an image: the server keeps the four codes and writes the same
// emblem as emoji in Telegram. The palette's hex values come with the
// founding form (a `palette` entry), so a new colour needs no new build; a
// new shape or icon needs its drawing below (an unknown one is drawn as a
// plain disc / a star, never as nothing).

import { useId } from 'react'
import { shade } from '../kit/color'

/** Outlines in a 100 x 120 box. */
const SHAPES: Record<string, string> = {
  shield: 'M50 4 L92 16 V58 C92 88 70 108 50 116 C30 108 8 88 8 58 V16 Z',
  circle: 'M50 60 m-46 0 a46 46 0 1 0 92 0 a46 46 0 1 0 -92 0 Z',
  banner: 'M14 6 H86 V106 L50 90 L14 106 Z',
  diamond: 'M50 4 L94 60 L50 116 L6 60 Z',
  hexagon: 'M50 4 L92 30 V90 L50 116 L8 90 V30 Z',
}

/** The outline shrunk about the centre, for the inner border. */
const INSET = 'translate(50 60) scale(0.84) translate(-50 -60)'

type Glyph = { d?: string; rule?: 'evenodd'; rot?: number; rays?: boolean }

/** Icons in a 24 x 24 box, filled shapes only (they are outlined in a dark tint of their colour). */
const GLYPHS: Record<string, Glyph[]> = {
  wheat: [
    { d: 'M11 10 H13 V23 H11 Z' },
    { d: 'M12 1 C13.6 3 13.6 6 12 8.5 C10.4 6 10.4 3 12 1 Z' },
    { d: 'M11 10 C7 9.5 5.5 6.5 5.5 4 C9 4 11 6.5 11 10 Z' },
    { d: 'M13 10 C17 9.5 18.5 6.5 18.5 4 C15 4 13 6.5 13 10 Z' },
    { d: 'M11 16 C7 15.5 5.5 12.5 5.5 10 C9 10 11 12.5 11 16 Z' },
    { d: 'M13 16 C17 15.5 18.5 12.5 18.5 10 C15 10 13 12.5 13 16 Z' },
  ],
  tree: [
    { d: 'M12 1.5 C17 1.5 20 5.5 19 9.5 C21.5 10.5 21.5 15 17.5 16 H6.5 C2.5 15 2.5 10.5 5 9.5 C4 5.5 7 1.5 12 1.5 Z' },
    { d: 'M10.5 15 H13.5 V22.5 H10.5 Z' },
  ],
  mountain: [{ d: 'M1 21 L9 5 L13 12.5 L15.5 9 L23 21 Z' }],
  wave: [
    { d: 'M1 8 C4 4 7 4 10 8 C13 12 16 12 19 8 C20.5 6 22 5.5 23 6 V10 C21.5 9.6 20.5 10.5 19 12.5 C16 16.5 13 16.5 10 12.5 C7 8.5 4 8.5 1 12.5 Z' },
    { d: 'M1 15 C4 11 7 11 10 15 C13 19 16 19 19 15 C20.5 13 22 12.5 23 13 V17 C21.5 16.6 20.5 17.5 19 19.5 C16 23.5 13 23.5 10 19.5 C7 15.5 4 15.5 1 19.5 Z' },
  ],
  sun: [
    { d: 'M12 6.5 a5.5 5.5 0 1 0 0.01 0 Z' },
    { rays: true },
  ],
  moon: [{ d: 'M15 2.5 A9.5 9.5 0 1 0 21.5 15 A7.5 7.5 0 1 1 15 2.5 Z' }],
  star: [{ d: 'M12 1.5 L14.9 8.6 L22.5 9.2 L16.7 14.2 L18.5 21.7 L12 17.7 L5.5 21.7 L7.3 14.2 L1.5 9.2 L9.1 8.6 Z' }],
  tower: [{ d: 'M5 22.5 V7.5 H8 V4.5 H10.2 V7.5 H13.8 V4.5 H16 V7.5 H19 V22.5 Z M10.5 22.5 V16.5 A1.5 1.5 0 0 1 13.5 16.5 V22.5 Z', rule: 'evenodd' }],
  anchor: [
    { d: 'M12 1.5 a3 3 0 1 0 0.01 0 Z M12 4 a0.9 0.9 0 1 1 -0.01 0 Z', rule: 'evenodd' },
    { d: 'M11 6 H13 V20 H11 Z' },
    { d: 'M7 9 H17 V11 H7 Z' },
    { d: 'M2.5 14 L6 16.5 C6.8 18.5 9 20 12 20 C15 20 17.2 18.5 18 16.5 L21.5 14 C21.5 19.5 17.5 22.5 12 22.5 C6.5 22.5 2.5 19.5 2.5 14 Z' },
  ],
  hammer: [
    { d: 'M10.6 9 H13.4 V22.5 H10.6 Z' },
    { d: 'M4 2.5 H19 C20.5 2.5 21 4 21 5.5 C21 7 20.5 8.5 19 8.5 H4 C3 8.5 2.5 7.5 2.5 5.5 C2.5 3.5 3 2.5 4 2.5 Z' },
  ],
  flame: [{ d: 'M12 1.5 C13 6 18.5 8 18.5 14.5 C18.5 19 15.5 22.5 12 22.5 C8.5 22.5 5.5 19 5.5 14.5 C5.5 11 7.5 9 9 6.5 C9.5 8.5 10.5 9.8 11.7 10 C11 7 10.8 4 12 1.5 Z' }],
  crown: [{ d: 'M2.5 19.5 V7.5 L8 12.5 L12 4.5 L16 12.5 L21.5 7.5 V19.5 Z' }, { d: 'M2.5 21 H21.5 V22.6 H2.5 Z' }],
  key: [
    { d: 'M12 1.5 a5 5 0 1 0 0.01 0 Z M12 5 a1.7 1.7 0 1 1 -0.01 0 Z', rule: 'evenodd', rot: 35 },
    { d: 'M11 10 H13 V22.5 H11 Z', rot: 35 },
    { d: 'M13 16.5 H16.5 V18.6 H13 Z', rot: 35 },
    { d: 'M13 20 H15.6 V22 H13 Z', rot: 35 },
  ],
  book: [
    { d: 'M1.5 5 C6 3.8 10 4.3 12 6.5 V21 C10 19.3 6 18.8 1.5 20 Z' },
    { d: 'M22.5 5 C18 3.8 14 4.3 12 6.5 V21 C14 19.3 18 18.8 22.5 20 Z' },
  ],
  horse: [{ d: 'M6 22.5 L7 15.5 C7 11.5 9 7.5 12 5.5 L11 1.5 L14.5 4 C19.5 5 20.5 10 19.5 14 L15.5 12 L16.5 15 C14.5 16 13.5 18 13.5 22.5 Z' }],
  fish: [
    { d: 'M1.5 12 C5.5 5.5 13 5.5 17 12 C13 18.5 5.5 18.5 1.5 12 Z M5.6 10.6 a1.1 1.1 0 1 0 0.01 0 Z', rule: 'evenodd' },
    { d: 'M16 12 L22.5 6.5 V17.5 Z' },
  ],
}

const FALLBACK_HEX = '#8a93b8'

export interface EmblemProps {
  shape: string
  colorA: string
  colorB: string
  icon: string
  /** Width in px; the height follows (1.2 x). */
  size?: number
  /** Draw only the outline (the shape picker's thumbnails). */
  bare?: boolean
  className?: string
  title?: string
}

/** Draws a glyph in a 24 x 24 box, filled with `fill` and outlined in `line`. */
export function Glyph({ icon, fill, line }: { icon: string; fill: string; line: string }) {
  const parts = GLYPHS[icon] ?? GLYPHS.star
  return (
    <g fill={fill} stroke={line} strokeWidth={1} strokeLinejoin="round">
      {parts.map((p, i) => {
        if (p.rays) {
          return (
            <g key={i}>
              {Array.from({ length: 8 }, (_, k) => (
                <rect key={k} x="11.1" y="0.8" width="1.8" height="4" rx="0.6" transform={`rotate(${k * 45} 12 12)`} />
              ))}
            </g>
          )
        }
        return <path key={i} d={p.d} fillRule={p.rule} transform={p.rot ? `rotate(${p.rot} 12 12)` : undefined} />
      })}
    </g>
  )
}

/** The badge. `colorA`/`colorB` are #rrggbb values (the palette entries' hex). */
export default function Emblem({ shape, colorA, colorB, icon, size = 96, bare, className, title }: EmblemProps) {
  const uid = useId().replace(/:/g, '')
  const a = colorA || FALLBACK_HEX
  const b = colorB || '#f4ead0'
  const path = SHAPES[shape] ?? SHAPES.circle
  const dark = shade(a, -0.55)
  return (
    <svg
      className={className}
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      role="img"
      aria-label={title}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`f${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(a, 0.28)} />
          <stop offset="0.55" stopColor={a} />
          <stop offset="1" stopColor={shade(a, -0.32)} />
        </linearGradient>
        <clipPath id={`c${uid}`}><path d={path} /></clipPath>
      </defs>
      {/* the drop shadow, then the field */}
      <path d={path} transform="translate(0 3)" fill="rgba(0,0,0,0.38)" />
      <path d={path} fill={`url(#f${uid})`} stroke={dark} strokeWidth={3} strokeLinejoin="round" />
      {!bare && (
        <>
          {/* the second colour: an inner border and a chief band, clipped to the field */}
          <g clipPath={`url(#c${uid})`}>
            <path d={path} transform={INSET} fill="none" stroke={b} strokeWidth={3.2} strokeLinejoin="round" opacity={0.95} />
            <path d="M0 0 H100 V13 H0 Z" fill={b} opacity={0.16} />
            <ellipse cx="34" cy="26" rx="26" ry="12" fill="#fff" opacity={0.13} transform="rotate(-18 34 26)" />
          </g>
          <g transform="translate(25.5 33) scale(2.05)">
            <Glyph icon={icon} fill={b} line={shade(b, -0.6)} />
          </g>
        </>
      )}
      {bare && (
        <g clipPath={`url(#c${uid})`}>
          <path d={path} transform={INSET} fill="none" stroke={b} strokeWidth={3.2} strokeLinejoin="round" opacity={0.95} />
          <ellipse cx="34" cy="26" rx="26" ry="12" fill="#fff" opacity={0.13} transform="rotate(-18 34 26)" />
        </g>
      )}
    </svg>
  )
}
