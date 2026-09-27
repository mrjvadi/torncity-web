// Renders the safe subset of Telegram-HTML the server sends in `text`:
// <b>, <i>, <code>, and <blockquote expandable> as a native <details>.
// Everything else is escaped first, so nothing else can ever execute.

const ALLOWED_SIMPLE = new Set(['b', 'i', 'code'])

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Turn Telegram-HTML text into safe HTML: escape everything, then re-open
 * only the allowed tags found in the original, and rewrite an expandable
 * blockquote into <details><summary>.
 */
export function sanitizeTelegramHtml(input: string): string {
  const escaped = escapeHtml(input).replace(/\n/g, '<br/>')
  // Re-allow the simple tags (b, i, code), open and close.
  let out = escaped.replace(
    /&lt;(\/?)(b|i|code)&gt;/gi,
    (_m, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`,
  )
  // Expandable blockquote: <blockquote expandable>...</blockquote>
  out = out.replace(
    /&lt;blockquote expandable&gt;([\s\S]*?)&lt;\/blockquote&gt;/gi,
    (_m, inner: string) => `<details class="tg-quote"><summary></summary>${inner}</details>`,
  )
  // Plain blockquote, not expandable.
  out = out.replace(
    /&lt;blockquote&gt;([\s\S]*?)&lt;\/blockquote&gt;/gi,
    (_m, inner: string) => `<blockquote class="tg-quote">${inner}</blockquote>`,
  )
  return out
}
