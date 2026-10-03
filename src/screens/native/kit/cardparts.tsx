import type { ReactNode } from 'react'

/** Fact lines inside a `PCard` (`facts`): one short line each, empty ones dropped. */
export function Lines({ lines }: { lines: ReactNode[] }) {
  return <>{lines.filter(Boolean).map((l, i) => <span key={i} className="pc-line">{l}</span>)}</>
}

/** What a place still lacks (research, a building, a teacher), red, one line each. */
export function Need({ lines }: { lines: string[] }) {
  return <>{lines.map((x) => <span key={x} className="pc-line pc-need">{x}</span>)}</>
}
