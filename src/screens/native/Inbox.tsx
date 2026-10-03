import type { ScreenProps } from '../types'
import type { InboxCategoryView, InboxHubView, StoredNotice } from '../../api/views.gen'
import { Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { ago, formatNumber } from './kit/format'
import { t, hasKey, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'
import { genericLine, noticeLine, type Namer } from '../../notices/wording'
import { CardGrid } from '../../ui/v6/panel'

// The inbox: the notices the server kept for the player, each as data (the notice's screen and
// its view) that this client words itself. A notice of a screen not carried as data yet has only
// the sentence its producer wrote.

const CAT_ICON: Record<string, string> = {
  finance: 'bank', faction: 'lion', work: 'work', jobs: 'work', crime: 'crime', social: 'society', politics: 'vote', government: 'vote',
  property: 'house', trade: 'cart', market: 'cart', companies: 'work', war: 'crime', health: 'society', travel: 'society',
  education: 'society', achievements: 'society', missions: 'society', life: 'society',
}
function catMeta(c: string | undefined): { label: string; icon: string } {
  const k = c ?? ''
  const key = `inbox.cat.${k}`
  return hasKey(key) ? { label: t(key as Key), icon: CAT_ICON[k] ?? 'inbox' } : { label: k || t('inbox.title'), icon: 'inbox' }
}

/** One stored notice as the line the player reads. */
export function storedLine(n: StoredNotice, names: Namer): string {
  if (n.screen && n.view) return (noticeLine(n.screen, n.view, names) ?? genericLine()).text
  return n.text || t('inbox.legacy_text')
}

export function InboxHub({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as Partial<InboxHubView>
  if (loading && !response) return <ScreenScroll><Header title={t('inbox.title')} tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('inbox.title')} tone="sapphire" onRefresh={() => run('inbox.show')} />
      {!v.total && <Notice>{t('inbox.empty')}</Notice>}
      <CardGrid>
        {(v.categories ?? []).map((c, i) => {
          const meta = catMeta(c.category)
          return (
            <ListRow key={i} icon={meta.icon} palette="sapphire" title={meta.label}
              sub={t('inbox.count', { n: formatNumber(c.count ?? 0) })}
              onClick={() => c.category && run('inbox.category', { category: c.category })} />
          )
        })}
      </CardGrid>
      <Actions response={response} onAction={onAction} refreshCommand="inbox.show" />
    </ScreenScroll>
  )
}

export function InboxCategory({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as Partial<InboxCategoryView>
  const meta = catMeta(v.category)
  const names = useContentNames()
  if (loading && !response) return <ScreenScroll><Header title={t('inbox.title')} tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={meta.label} tone="sapphire" onBack={() => run('inbox.show')}
        onRefresh={() => v.category && run('inbox.category', { category: v.category })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.items ?? []).map((it, i) => {
          // Opening a new notice reads that notice only: the others stay listed and the next one opens as usual.
          const fresh = !it.read && !!it.id
          const open = () => run('inbox.read', { id: it.id, page: String(v.page || 1) })
          return (
            <div key={it.id || i} className={fresh ? 'inbox-item inbox-item-new' : 'inbox-item'}
              role={fresh ? 'button' : undefined} tabIndex={fresh ? 0 : undefined}
              onClick={fresh ? open : undefined} onKeyDown={fresh ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } } : undefined}
              style={{ background: 'var(--panel)', border: fresh ? '1px solid rgba(242,194,85,0.6)' : '1px solid rgba(242,194,85,0.18)', borderRadius: 14, padding: '10px 12px', cursor: fresh ? 'pointer' : 'default', minHeight: 44 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                {fresh && <span style={{ color: 'var(--gold, #f2c255)', fontWeight: 700 }}>{t('inbox.new')}</span>}
                <span>{ago(it.ago_seconds)}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: fresh ? 600 : 400 }}>{storedLine(it.notice, names.name)}</div>
              {fresh && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{t('inbox.tap_to_read')}</div>}
            </div>
          )
        })}
        {!(v.items && v.items.length) && <Notice>{t('inbox.empty_cat')}</Notice>}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="inbox.category" only={(a) => a.command !== 'inbox.read'} />
    </ScreenScroll>
  )
}
