// A money string made by `money()` («۲۵۰ مارک پولو (۲۵ ساپ)») drawn with the SUP part small and muted, beside the local figure.
// Any other node passes through unchanged. Used by the shared cards, so every card shows prices the same way.

import type { ReactNode } from 'react'
import { splitMoney } from '../../screens/native/kit/format'

export function rich(node: ReactNode): ReactNode {
  if (typeof node !== 'string') return node
  const parts = splitMoney(node)
  if (!parts) return node
  return <>{parts[0]} <small className="m-sup">{parts[1]}</small></>
}
