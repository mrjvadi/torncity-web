import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { ago, formatNumber } from './kit/format'

const CAT_FA: Record<string, { label: string; icon: string }> = {
  finance: { label: 'مالی', icon: 'bank' },
  faction: { label: 'جناح', icon: 'lion' },
  work: { label: 'کار', icon: 'work' },
  crime: { label: 'جرم', icon: 'crime' },
  social: { label: 'اجتماعی', icon: 'society' },
  politics: { label: 'سیاست', icon: 'vote' },
  property: { label: 'ملک', icon: 'house' },
  trade: { label: 'بازار', icon: 'cart' },
}

interface InboxCategoryCount { category?: string; count?: number }
interface InboxHubView { total?: number; categories?: InboxCategoryCount[] | null }

export function InboxHub({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as InboxHubView
  if (loading && !response) return <ScreenScroll><Header title="پیام‌ها" tone="sapphire" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="پیام‌ها" tone="sapphire" onRefresh={() => run('inbox.show')} />
      {!v.total && <Notice>پیامی نداری.</Notice>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.categories ?? []).map((c, i) => {
          const meta = CAT_FA[c.category ?? ''] ?? { label: c.category ?? '—', icon: 'inbox' }
          return (
            <ListRow key={i} icon={meta.icon} palette="sapphire" title={meta.label}
              sub={`${formatNumber(c.count ?? 0)} پیام`}
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
  const meta = CAT_FA[v.category ?? ''] ?? { label: v.category ?? 'پیام‌ها', icon: 'inbox' }
  if (loading && !response) return <ScreenScroll><Header title="پیام‌ها" tone="sapphire" /></ScreenScroll>

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
        {!(v.items && v.items.length) && <Notice>پیامی در این دسته نیست.</Notice>}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="inbox.category" />
    </ScreenScroll>
  )
}
