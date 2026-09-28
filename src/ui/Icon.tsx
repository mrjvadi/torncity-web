import { useState } from 'react'
import { iconUrl, resolveIconName } from '../lib/icons'

export type IconPalette =
  | 'gold' | 'amber' | 'ruby' | 'emerald' | 'sapphire' | 'violet' | 'steel' | 'fox' | 'teal' | 'cream'

export interface IconProps {
  name: string
  palette?: IconPalette
  /** px, or any CSS length (e.g. `calc(76 * var(--u))` for the chrome). */
  size?: number | string
  className?: string
}

/** The prototype's emboss.gdshader (proto/ui/emboss.gdshader), baked once
 * per icon per palette into public/icons3d/<palette>/<name>.webp by
 * tools/bake_icons.gd in the Godot client repo — see that script for how
 * to re-bake. The shader insets the glyph by its own `pad` uniform (0.1 on
 * each side), so the glyph fills ~80% of the square baked image; this
 * scales the rendered <img> up by 1/(1 - 2*pad) so the glyph itself still
 * fills the `size` box the way the old CSS mask glyph did (the transform
 * doesn't change layout, only what bleeds past the box, the same way the
 * mask version already bled a couple of px via its drop-shadow). */
const GLYPH_SCALE = 1 / 0.8

/** Falls back to the old CSS-mask emboss (a mask of the white SVG, filled
 * with the palette's gradient and a matching drop-shadow outline) if the
 * baked image 404s or fails to decode — see the `.icon` rules in
 * global.css and PAL in src/ui/kit/kit.gd. */
function IconFallback({ name, palette, size, className }: Required<Pick<IconProps, 'name' | 'palette' | 'size'>> & { className?: string }) {
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

export default function Icon({ name, palette = 'steel', size = 24, className }: IconProps) {
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)
  const resolved = resolveIconName(name)
  const src = `${import.meta.env.BASE_URL}icons3d/${palette}/${resolved}.webp`

  if (erroredSrc === src) {
    return <IconFallback name={name} palette={palette} size={size} className={className} />
  }

  const numSize = typeof size === 'number' ? size : undefined
  return (
    <img
      src={src}
      width={numSize}
      height={numSize}
      alt=""
      draggable={false}
      decoding="async"
      className={`icon-img${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, scale: String(GLYPH_SCALE) }}
      onError={() => setErroredSrc(src)}
      aria-hidden
    />
  )
}
