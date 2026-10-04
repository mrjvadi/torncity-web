// What the viewer may do in their settlement: the charter's permission codes from the bootstrap (owner rule P28: an act the
// viewer cannot use is not shown). The server decides every act again; this only hides what would be refused.

import { useSession } from '../state/SessionContext'

/** True when the permission list holds the code (a scoped code such as `fiscal.set:sales_tax` also counts for `fiscal.set`). */
export function holds(list: readonly string[] | undefined, code: string): boolean {
  if (!list) return false
  return list.includes(code) || (!code.includes(':') && list.some((p) => p.startsWith(code + ':')))
}

/** `can('public.build')`: whether the signed-in player holds the permission in their settlement. */
export function useCan(): (code: string) => boolean {
  const { bootstrap } = useSession()
  const list = bootstrap?.settlement?.permissions
  return (code) => holds(list, code)
}
