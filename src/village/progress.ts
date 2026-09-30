import type { LayoutBuilding } from '../api/types'

/** Progress 0..1 of a building from its timestamps and the server's clock
 * (a build has no intermediate state on the wire, client-api.md 4.3). */
export function constructionProgress(b: Pick<LayoutBuilding, 'started_at' | 'finish_at' | 'state'>, nowMs: number): number {
  if (b.state === 'built' || b.state === 'damaged') return 1
  if (b.state === 'planned' || !b.started_at || !b.finish_at) return 0.05
  const s = Date.parse(b.started_at), f = Date.parse(b.finish_at)
  if (!(f > s)) return 1
  return Math.max(0, Math.min(1, (nowMs - s) / (f - s)))
}
