/** Small color helpers so kit pieces can reproduce the prototype's
 * `Color.lightened()`/`darkened()` calls (screens_proto.gd `_hdr`, `_chip`)
 * without a CSS color-mix() dependency — some in-app webviews on older
 * Android are still Chrome <111 and don't have it. */

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** `amount` in [-1, 1]: positive mixes toward white (lighten), negative
 * toward black (darken) — the same shape as Godot's Color.lightened/darkened. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  const target = amount > 0 ? 255 : 0
  const w = Math.abs(amount)
  const mix = (c: number) => clamp255(c + (target - c) * w)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
