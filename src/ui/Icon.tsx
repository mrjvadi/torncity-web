import { iconUrl } from '../lib/icons'

export type IconPalette =
  | 'gold' | 'amber' | 'ruby' | 'emerald' | 'sapphire' | 'violet' | 'steel' | 'fox' | 'teal' | 'cream'

interface IconProps {
  name: string
  palette?: IconPalette
  size?: number
  className?: string
}

/** An "embossed" glyph: a CSS mask of a white SVG filled with a gradient. */
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
