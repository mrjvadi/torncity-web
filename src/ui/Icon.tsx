import { iconUrl } from '../lib/icons'

export type IconPalette =
  | 'gold' | 'amber' | 'ruby' | 'emerald' | 'sapphire' | 'violet' | 'steel' | 'fox' | 'teal' | 'cream'

export interface IconProps {
  name: string
  palette?: IconPalette
  /** px, or any CSS length (e.g. `calc(76 * var(--u))` for the chrome). */
  size?: number | string
  className?: string
}

/** An "embossed" glyph: a CSS mask of a white SVG, filled with the
 * palette's lit-to-dark gradient and a matching (not plain black) outline
 * shadow — see the `.icon` rules in global.css and PAL in
 * proto/home_proto.gd. */
export default function Icon({ name, palette = 'steel', size = 24, className }: IconProps) {
  const url = iconUrl(name)
  return (
    <span
      className={`icon pal-${palette}${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
      }}
      aria-hidden
    />
  )
}
