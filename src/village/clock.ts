// The server's clock, as far as the client can tell: bootstrap.server_time
// against this device's clock at the moment it arrived. Construction
// progress is counted down from started_at / finish_at (client-api.md
// section 4.3), so a device whose clock is minutes off must still agree with
// the server about what time it is.

let skewMs = 0

export function setServerTime(iso: string | undefined): void {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isFinite(t)) { skewMs = t - Date.now(); bestRtt = Infinity }
}

let bestRtt = Infinity

/** A later reading of the server's time with the round trip it took: the server stamped it somewhere in the middle of
 * the trip, so half the trip is added to it. The reading with the shortest trip so far wins (the least uncertainty);
 * a long gap since the last reading lets a longer one replace it, so the offset follows a drifting device clock. */
export function observeServerTime(iso: string | undefined, sentAt: number, receivedAt: number): void {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return
  const rtt = Math.max(0, receivedAt - sentAt)
  if (rtt > bestRtt * 1.5 && bestRtt !== Infinity && rtt > 400) return
  bestRtt = Math.min(rtt, bestRtt * 1.2 + 50)
  skewMs = t + rtt / 2 - receivedAt
}

export function clockSkewMs(): number { return skewMs }

export function serverNow(): number { return Date.now() + skewMs }
