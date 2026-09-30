// The palette codes of configs/content/founding.yml as colours, for drawing a
// village's emblem where only its four codes are known (the bootstrap carries
// codes, the founding form carries the palette). The server's file is the
// source; an unknown code falls back to a neutral colour, never to nothing.
export const EMBLEM_HEX: Record<string, string> = {
  crimson: '#b3261e', orange: '#d9731a', gold: '#e2b53c', green: '#2f8f4e', azure: '#2b6fc4',
  violet: '#7a4fc0', brown: '#7a5236', ivory: '#efe7d2', slate: '#2a3140',
}
export const emblemHex = (code: string | undefined) => EMBLEM_HEX[code ?? ''] ?? '#8a93b8'
