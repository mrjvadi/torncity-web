// پیام‌ها: the notices the server kept for the player. The hub is the categories that still hold unread notices, as
// tiles with their counts; a category is its notices as message rows (who or what it is from, the line, how long
// ago, a dot while unread). Opening one reads it and shows it whole in a sheet, with a way to where it points.

import { useState } from 'react'
import type { NScreenProps } from '../../registry'
import type { InboxCategoryView, InboxHubView, InboxItemLine, StoredNotice } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Chip, Empty, Hero, Icon, List, Loading, Page, Section, Sheet, Tile, Tiles } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { genericLine, noticeLine, type NoticeTone } from '../../../notices/wording'
import { ago, formatNumber } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { avatar, Said, useNames, word, type Names } from './common'

const CAT_ICON: Record<string, string> = {
  finance: 'bank', faction: 'x_flag', work: 'work', jobs: 'work', crime: 'crime', social: 'society', politics: 'vote', government: 'gavel',
  property: 'house', trade: 'market', market: 'market', companies: 'factory', war: 'swords', health: 'health', travel: 'plane',
  education: 'study', achievements: 'trophy', missions: 'missions', life: 'mood',
}
const catIcon = (c: string) => CAT_ICON[c] ?? 'inbox'
const catName = (c: string) => word(`inbox.cat.${c}`, c || t('inbox.title'))

/** The line a stored notice reads as, and how loud it is. */
function lineOf(n: StoredNotice, names: Names): { text: string; tone: NoticeTone } {
  if (n.screen && n.view) return noticeLine(n.screen, n.view, names.name) ?? genericLine()
  return { text: n.text || t('inbox.legacy_text'), tone: 'info' }
}

/** The person a notice is from or about, when its facts name one: the avatar shows their letter. */
function personOf(n: StoredNotice): string {
  const v = (n.view ?? {}) as Record<string, unknown>
  const nameOf = (x: unknown) => (x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string' ? (x as { name: string }).name : '')
  if (typeof v.payer_name === 'string' && v.payer_name) return v.payer_name
  return nameOf(v.player) || nameOf(v.by) || nameOf(v.owner) || ''
}

export function InboxHub({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <Page title={t('inbox.title')}>{loading ? <Loading blocks={[110, 128, 128]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const v = (response.view ?? {}) as Partial<InboxHubView>
  const cats = (v.categories ?? []).filter((c) => c.count > 0)
  const total = v.total ?? 0
  return (
    <Page title={t('inbox.title')}>
      <Said r={response} />
      <Hero art="inbox">
        <p className="n-label">{t('n.soc.inbox.unread')}</p>
        <p className="n-big">{formatNumber(total)}</p>
        {total === 0 && <p className="n-label">{t('inbox.empty')}</p>}
        {total > 0 && (
          <div className="n-hero-foot">
            <Button kind="ghost" small icon="m_check" onClick={() => nav.run('inbox.read_all')}>{t('act.inbox.read_all')}</Button>
          </div>
        )}
      </Hero>
      {cats.length > 0 && (
        <>
          <Section title={t('n.soc.inbox.cats')} note={formatNumber(cats.length)} />
          <Tiles>
            {cats.map((c) => (
              <Tile key={c.category} icon={catIcon(c.category)} title={catName(c.category)}
                badge={formatNumber(c.count)} onClick={() => nav.run('inbox.category', { category: c.category })} />
            ))}
          </Tiles>
        </>
      )}
      {cats.length === 0 && <Empty icon="inbox">{t('n.soc.inbox.all_read')}</Empty>}
    </Page>
  )
}

export function InboxCategory({ response, loading, args }: NScreenProps) {
  const nav = useNav()
  const { exec } = useSession()
  const names = useNames()
  const [read, setRead] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState<InboxItemLine | null>(null)
  const v = (response?.view ?? {}) as Partial<InboxCategoryView>
  const cat = v.category ?? args?.category ?? ''
  if (!response) return <Page title={catName(cat)}>{loading ? <Loading blocks={[64, 64, 64, 64]} /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const items = v.items ?? []
  const unread = items.filter((it) => !it.read && !read.has(it.id)).length

  const show = (it: InboxItemLine) => {
    setOpen(it)
    // opening a new notice reads that one only; the dot goes now, the server is told in the background
    if (!it.read && it.id && !read.has(it.id)) {
      setRead((s) => new Set(s).add(it.id))
      void exec('inbox.read', { id: it.id, page: String(v.page || 1) })
    }
  }
  const pages = (response.actions ?? []).filter((a) => a.id === 'page.prev' || a.id === 'page.next')

  return (
    <Page title={catName(cat)} sub={unread > 0 ? t('n.soc.inbox.new_n', { n: formatNumber(unread) }) : undefined}>
      <Said r={response} />
      {items.length === 0 ? <Empty icon="inbox">{t('inbox.empty_cat')}</Empty> : (
        <List>
          {items.map((it, i) => {
            const fresh = !it.read && !read.has(it.id)
            const line = lineOf(it.notice, names)
            const who = personOf(it.notice)
            const av = who ? avatar(who) : null
            return (
              <button key={it.id || i} className={`n-row n-soc-msg${fresh ? ' fresh' : ''}`} onClick={() => show(it)}>
                {av ? <span className="n-row-av" style={{ background: `hsl(${av.hue} 42% 38%)` }}>{av.letter}</span>
                  : <span className="n-row-well"><Icon name={catIcon(cat)} /></span>}
                <span className="n-row-body">
                  <span className="n-row-title n-soc-clamp">{line.text}</span>
                  <span className="n-row-sub">{ago(it.ago_seconds)}</span>
                </span>
                <span className="n-soc-dot" aria-label={fresh ? t('inbox.new') : undefined} role={fresh ? 'img' : undefined} data-on={fresh || undefined} />
              </button>
            )
          })}
        </List>
      )}
      {pages.length > 0 && <div className="n-btns">{pages.map((a, i) => <Button key={i} kind="ghost" small onClick={() => nav.act(a)}>{word(`soc.act.${a.id}`, '')}</Button>)}</div>}

      {open && (() => {
        const line = lineOf(open.notice, names)
        const who = personOf(open.notice)
        // a link with positional arguments has no named form to run here yet: only a plain command is offered
        const link = open.link?.command && !(open.link.args ?? []).length ? open.link : null
        return (
          <Sheet title={catName(cat)} icon={catIcon(cat)} onClose={() => setOpen(null)}>
            <div className="n-soc-letter">
              <div className="n-soc-letter-head">
                {who && <span className="n-soc-av" style={{ background: `hsl(${avatar(who).hue} 42% 38%)` }}>{avatar(who).letter}</span>}
                <span className="n-label">{who ? `${who} · ` : ''}{ago(open.ago_seconds)}</span>
                <Chip tone={line.tone === 'success' ? 'ok' : line.tone === 'warning' ? 'warn' : 'cyan'}>{catName(cat)}</Chip>
              </div>
              <p className="n-text">{line.text}</p>
            </div>
            {link && <Button block onClick={() => { setOpen(null); nav.run(link.command) }}>{t('inbox.item_link')}</Button>}
            <Button kind="ghost" block onClick={() => setOpen(null)}>{t('common.close')}</Button>
          </Sheet>
        )
      })()}
    </Page>
  )
}
