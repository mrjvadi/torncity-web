import type { ScreenProps } from '../types'
import { Bar, Card, Empty, Header, Notice, ScreenScroll } from './kit/Parts'
import { PCard, PGrid, PTile } from '../../ui/v6/panel'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms } from './kit/format'
import { Slab } from '../../kit'
import { buildingName, useBuildingCatalogue } from '../../village/useVillage'
import { t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

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
  need_code?: string; need_role?: string; need_tier?: number
}

const TIERS = ['novice', 'hustler', 'professional']
const CATEGORIES = ['petty_theft', 'street_crime', 'burglary', 'fraud', 'smuggling']
/** The rank's and the category's Persian name by code; the server's authored (English) name only as a last resort. */
const tierName = (n?: Named) => (n?.code && TIERS.includes(n.code) ? t(`crime.tier_name.${n.code}` as Key) : n?.name ?? '')
const categoryName = (n: Named) => (n.code && CATEGORIES.includes(n.code) ? t(`crime.category.${n.code}` as Key) : n.name ?? n.code ?? '—')

export default function CrimeHub({ response, loading, onAction, run, openLocal }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeHubView
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>
  const need = v.need_code ? buildingName(cat, v.need_code) : v.need_role ? t(`crime.role.${v.need_role}` as Key) : ''

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
        </div>
        {v.venue?.code && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>{t('crime.venue', { name: names.name('venue', v.venue.code, v.venue.name) })}</div>}
        {v.tier?.tier?.name && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {t('crime.tier', { name: tierName(v.tier.tier) })} {v.tier.next?.name ? `· ${t('crime.tier_next', { name: tierName(v.tier.next), a: formatNumber(v.tier.xp ?? 0), b: formatNumber(v.tier.next_xp ?? 0) })}` : ''}
          </div>
        )}
      </Card>

      {v.empty && (
        <Card>
          <div style={{ fontSize: 14, marginBottom: 10 }}>{t(`crime.empty.${v.empty}` as Key, { n: v.min_level ?? 0 })}</div>
          {v.empty === 'no_venue' && need && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>{t('crime.empty.need_building', { name: need })}</div>}
          {v.empty === 'level_too_low'
            ? <Slab tone="gold" radius={14} lip={4} onClick={() => run('work.home')}>{t('crime.empty.go_work')}</Slab>
            : <Slab tone="steel" radius={14} lip={4} onClick={() => openLocal('activity_hub')}>{t('crime.empty.go_back')}</Slab>}
        </Card>
      )}

      <div className="hub-grid">
        {(v.empty === 'level_too_low' || v.empty === 'no_venue' ? [] : v.categories ?? []).map((c) => (
          <PTile key={c.code} icon="crime" title={categoryName(c)} onClick={() => c.code && run('crime.list', { category: c.code })} />
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="crime.hub" only={(a) => a.id !== 'crime.category'} />
    </ScreenScroll>
  )
}

interface CrimeLine { crime?: Named; duration_seconds?: number; eligible?: boolean; nerve?: number }
interface CrimeListView { category?: Named; crimes?: CrimeLine[] | null; page?: number; pages?: number }

export function CrimeList({ response, loading, onAction, run }: ScreenProps) {
  const names = useContentNames()
  const v = (response?.view ?? {}) as CrimeListView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.category ? categoryName(v.category) : t('crime.title')} tone="ruby" onBack={() => run('crime.hub')} onRefresh={() => v.category?.code && run('crime.list', { category: v.category.code })} />
      {(v.crimes ?? []).length === 0 && <Empty>{t('crime.list.empty')}</Empty>}
      <PGrid>
        {(v.crimes ?? []).map((c, i) => (
          <PCard
            key={i}
            icon={c.eligible ? 'crime' : 'lock'}
            title={c.crime?.code ? names.name('crime', c.crime.code, c.crime.name) : '—'}
            chip={c.eligible ? undefined : t('ac.crime.list.locked')} chipTone="off"
            lines={[t('crime.nerve_cost', { n: formatNumber(c.nerve ?? 0) }), c.duration_seconds ? hms(c.duration_seconds) : '']}
            onClick={() => c.crime?.code && run('crime.view', { crime: c.crime.code })}
          />
        ))}
      </PGrid>
      <Actions response={response} onAction={onAction} refreshCommand="crime.list" only={(a) => a.id !== 'crime.view'} />
    </ScreenScroll>
  )
}
