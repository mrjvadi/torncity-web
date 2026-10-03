// Persian digits everywhere in the Persian UI (owner, v6 P26). The helpers (t() numbers, formatNumber, money, hms)
// write them themselves; this is the safety net for a number a screen prints straight into the page, a server text,
// the ticker or a toast. It rewrites the digits of text nodes only, never of inputs, codes or what a screen marks
// `data-latin` (the link code, a player code), and it stops when the UI language is not Persian.

import { isRtl } from '../../i18n'

const FD = '۰۱۲۳۴۵۶۷۸۹'
const SKIP = new Set(['INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'CODE', 'PRE', 'CANVAS', 'SELECT', 'OPTION'])

function skipped(n: Node): boolean {
  for (let e: Node | null = n.parentNode; e && e.nodeType === 1; e = e.parentNode) {
    const el = e as Element
    if (SKIP.has(el.tagName) || el.hasAttribute('data-latin') || (el as HTMLElement).isContentEditable) return true
  }
  return false
}

function convert(n: Text) {
  const v = n.nodeValue
  if (!v || !/\d/.test(v) || skipped(n)) return
  // a token that holds a Latin letter next to digits is a code or an id (KAV4E7Z, a player code): copied and typed in Latin, so left alone
  const out = v.replace(/[A-Za-z0-9]+/g, (tok) => (/[A-Za-z]/.test(tok) ? tok : tok.replace(/\d/g, (d) => FD[+d])))
  if (out !== v) n.nodeValue = out // never write the same text back: a write is a mutation the observer would see again
}

function sweep(root: Node) {
  if (root.nodeType === 3) { convert(root as Text); return }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) convert(n as Text)
}

export function installPersianDigits(): void {
  if (!isRtl()) return
  sweep(document.body)
  new MutationObserver((list) => {
    if (!isRtl()) return
    for (const m of list) {
      if (m.type === 'characterData') convert(m.target as Text)
      else m.addedNodes.forEach((n) => sweep(n))
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
