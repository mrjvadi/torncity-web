// Inside a button or a chip only the local amount is shown: «شروع شیفت (+۱۸۰ مارک پولو)». The SUP amount that `money()` appends
// («… مارک پولو (۱۸ ساپ)») belongs to info lines and cards, so this strips it from a label (strings, and strings nested in elements).

import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import { SUP_MARK } from '../../lib/money'

const SUP_PART = new RegExp(`${SUP_MARK} \\([^()]*\\)`, 'g')

export function short(node: ReactNode): ReactNode {
  if (typeof node === 'string') return node.includes(SUP_MARK) ? node.replace(SUP_PART, '') : node
  if (Array.isArray(node)) return Children.map(node, short)
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children !== undefined) return cloneElement(node, undefined, short(node.props.children))
  return node
}
