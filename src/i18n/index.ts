// The client's one place for user-facing text. Only Persian exists; a key
// missing from the table is shown as itself so a gap is visible, never blank.

import { fa, type Key } from './fa'

export type { Key }

export function t(key: Key, params?: Record<string, string | number>): string {
  let s: string = fa[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** The text for a server refusal by its `error.code`, falling back to the
 * server's own sentence (already in the player's language) and then a
 * generic line. */
export function refusalText(code: string | undefined, serverMessage?: string): string {
  const key = `refusal.${code ?? ''}` as Key
  if (code && key in fa) return fa[key]
  return serverMessage && serverMessage.trim() ? serverMessage : fa['refusal.unknown']
}
