import type { ScreenProps } from '../types'
import { Bar, Card, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms } from './kit/format'
import { Slab } from '../../kit'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface CrimeHubView {
  city?: string; venue?: Named
  nerve?: { nerve?: number; max?: number; full_in_seconds?: number }
  heat?: { heat?: number; max?: number; wanted?: number; stars?: number }
  tier?: { tier?: Named; xp?: number; next?: Named; next_xp?: number }
  travelling?: boolean
  jail?: { remaining_seconds?: number } | null
  busy?: { remaining_seconds?: number } | null
  categories?: Named[] | null
  /** why crime has nothing to offer now: level_too_low, no_venue or no_targets (ADR 0038 4.4) */
  empty?: string
  min_level?: number
}

export default function CrimeHub({ response, loading, onAction, run, openLocal }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeHubView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('crime.title')} tone="ruby" onRefresh={() => run('crime.hub')} />

      {v.jail && <Notice alert>{t('crime.in_jail', { t: hms(v.jail.remaining_seconds) })}</Notice>}
      {v.busy && <Notice>{t('crime.busy', { t: hms(v.busy.remaining_seconds) })}</Notice>}
      {v.travelling && <Notice alert>{t('crime.travelling')}</Notice>}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {v.heat && (
            <Bar frac={v.heat.max ? clamp01((v.heat.heat ?? 0) / v.heat.max) : 0} color="var(--saffron)"
              label={t('crime.heat', { n: formatNumber(v.heat.heat ?? 0) })}
              sub={v.heat.wanted ? t('crime.wanted', { n: formatNumber(v.heat.wanted) }) : undefined} />
          )}
          {v.nerve && (
            <Bar frac={v.nerve.max ? clamp01((v.nerve.nerve ?? 0) / v.nerve.max) : 0} color="var(--anar)"
              label={t('crime.nerve', { a: formatNumber(v.nerve.nerve ?? 0), b: formatNumber(v.nerve.max ?? 0) })}
              sub={!v.nerve.max || (v.nerve.nerve ?? 0) < v.nerve.max ? t('crime.full_in', { t: hms(v.nerve.full_in_seconds) }) : undefined} />
          )}
        </div>
        {v.venue?.name && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>{t('crime.venue', { name: v.venue.name })}</div>}
        {v.tier?.tier?.name && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {t('crime.tier', { name: v.tier.tier.name })} {v.tier.next?.name ? `· ${t('crime.tier_next', { name: v.tier.next.name, a: formatNumber(v.tier.xp ?? 0), b: formatNumber(v.tier.next_xp ?? 0) })}` : ''}
          </div>
        )}
      </Card>

      {v.empty && (
        <Card>
          <div style={{ fontSize: 14, marginBottom: 10 }}>{t(`crime.empty.${v.empty}` as Key, { n: v.min_level ?? 0 })}</div>
          {v.empty === 'level_too_low'
            ? <Slab tone="gold" radius={14} lip={4} onClick={() => run('work.home')}>{t('crime.empty.go_work')}</Slab>
            : <Slab tone="steel" radius={14} lip={4} onClick={() => openLocal('activity_hub')}>{t('crime.empty.go_back')}</Slab>}
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.empty === 'level_too_low' || v.empty === 'no_venue' ? [] : v.categories ?? []).map((c) => (
          <ListRow key={c.code} icon="crime" palette="ruby" title={c.name ?? c.code ?? '—'}
            onClick={() => c.code && run('crime.list', { category: c.code })} />
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="crime.hub" />
    </ScreenScroll>
  )
}

interface CrimeLine { crime?: Named; duration_seconds?: number; eligible?: boolean; nerve?: number }
interface CrimeListView { category?: Named; crimes?: CrimeLine[] | null; page?: number; pages?: number }

export function CrimeList({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeListView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.category?.name ?? t('crime.title')} tone="ruby" onBack={() => run('crime.hub')} onRefresh={() => v.category?.code && run('crime.list', { category: v.category.code })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.crimes ?? []).map((c, i) => (
          <ListRow
            key={i}
            icon={c.eligible ? 'crime' : 'm_lock'}
            palette={c.eligible ? 'ruby' : 'steel'}
            title={c.crime?.name ?? c.crime?.code ?? '—'}
            sub={`${t('crime.nerve_cost', { n: formatNumber(c.nerve ?? 0) })}${c.duration_seconds ? ` · ${hms(c.duration_seconds)}` : ''}`}
            onClick={() => c.eligible && c.crime?.code && run('crime.view', { crime: c.crime.code })}
          />
        ))}
      </div>
      <Actions response={response} onAction={onAction} refreshCommand="crime.list" />
    </ScreenScroll>
  )
}
