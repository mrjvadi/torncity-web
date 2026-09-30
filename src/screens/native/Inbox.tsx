import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { ago, formatNumber } from './kit/format'
import { t, type Key } from '../../i18n'

const CAT_ICON: Record<string, string> = {
  finance: 'bank', faction: 'lion', work: 'work', crime: 'crime', social: 'society', politics: 'vote', property: 'house', trade: 'cart',
}
function catMeta(c: string | undefined): { label: string; icon: string } {
  const k = c ?? ''
  return k in CAT_ICON ? { label: t(`inbox.cat.${k}` as Key), icon: CAT_ICON[k] } : { label: k || t('inbox.title'), icon: 'inbox' }
}

interface InboxCategoryCount { category?: string; count?: number }
interface InboxHubView { total?: number; categories?: InboxCategoryCount[] | null }

export function InboxHub({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as InboxHubView
  if (loading && !response) return <ScreenScroll><Header title={t('inbox.title')} tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('inbox.title')} tone="sapphire" onRefresh={() => run('inbox.show')} />
      {!v.total && <Notice>{t('inbox.empty')}</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.categories ?? []).map((c, i) => {
          const meta = catMeta(c.category)
          return (
            <ListRow key={i} icon={meta.icon} palette="sapphire" title={meta.label}
              sub={t('inbox.count', { n: formatNumber(c.count ?? 0) })}
              onClick={() => c.category && run('inbox.category', { category: c.category })} />
          )
        })}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="inbox.show" />
    </ScreenScroll>
  )
}

interface InboxItemLine { ago_seconds?: number; link_addr?: string; text?: string }
interface InboxCategoryView { category?: string; items?: InboxItemLine[] | null; page?: number; total_pages?: number }

export function InboxCategory({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as InboxCategoryView
  const meta = catMeta(v.category)
  if (loading && !response) return <ScreenScroll><Header title={t('inbox.title')} tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={meta.label} tone="sapphire" onBack={() => run('inbox.show')}
        onRefresh={() => v.category && run('inbox.category', { category: v.category })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.items ?? []).map((it, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid rgba(242,194,85,0.18)', borderRadius: 14, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{ago(it.ago_seconds)}</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>{it.text}</div>
          </div>
        ))}
        {!(v.items && v.items.length) && <Notice>{t('inbox.empty_cat')}</Notice>}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="inbox.category" />
    </ScreenScroll>
  )
}
