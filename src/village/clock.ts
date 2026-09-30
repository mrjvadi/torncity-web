// The server's clock, as far as the client can tell: bootstrap.server_time
// against this device's clock at the moment it arrived. Construction
// progress is counted down from started_at / finish_at (client-api.md
// section 4.3), so a device whose clock is minutes off must still agree with
// the server about what time it is.

let skewMs = 0

export function setServerTime(iso: string | undefined): void {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isFinite(t)) skewMs = t - Date.now()
}

export function clockSkewMs(): number { return skewMs }

export function serverNow(): number { return Date.now() + skewMs }
