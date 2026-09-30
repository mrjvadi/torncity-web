// The server's `text` is a Telegram rendering: HTML-ish, emoji-led lines,
// "label: value" rows. The fallback screens do not print it as one blob;
// they read it into a headline, facts and paragraphs and draw those with
// the kit. Nothing here trusts the markup: it is reduced to plain text.

export interface Fact { label: string; value: string }
export type Block = { kind: 'fact'; fact: Fact } | { kind: 'para'; text: string } | { kind: 'gap' }
export interface ParsedText { title: string; blocks: Block[] }

const EMOJI = /[\p{Extended_Pictographic}‍️⃣]/gu

function plain(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|i|u|s|code|pre|a|blockquote|span|tg-spoiler)[^>]*>/gi, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

export function stripEmoji(line: string): string {
  return line.replace(EMOJI, '').replace(/^[\s•·\-–—]+/, (m) => (m.includes('•') ? '• ' : '')).trim()
}

export function parseText(text: string | undefined): ParsedText {
  const lines = plain(text ?? '').split('\n')
  let title = ''
  const blocks: Block[] = []
  for (const raw of lines) {
    const line = stripEmoji(raw.trim())
    if (!raw.trim()) {
      if (blocks.length && blocks[blocks.length - 1].kind !== 'gap') blocks.push({ kind: 'gap' })
      continue
    }
    if (!line) continue
    if (!title) { title = line.replace(/[:：]$/, ''); continue }
    const m = line.match(/^([^:：]{1,34})[:：]\s+(.+)$/)
    if (m && !/^https?/i.test(m[1])) blocks.push({ kind: 'fact', fact: { label: m[1].trim(), value: m[2].trim() } })
    else blocks.push({ kind: 'para', text: line })
  }
  while (blocks.length && blocks[blocks.length - 1].kind === 'gap') blocks.pop()
  return { title, blocks }
}
