import type { ScreenProps } from '../types'
import { Bar, Card, Header, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import { t } from '../../i18n'

interface DashboardView {
  name?: string; city?: string; place?: { name?: string }
  level?: number; energy?: number; max_energy?: number
  travelling?: boolean; cash?: number; bank?: number
  jail?: { city?: string; remaining_seconds?: number } | null
}

export default function Dashboard({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as DashboardView
  if (loading && !response) return <ScreenScroll><Header title="…" tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.name ?? t('dashboard.title')} tone="gold" onRefresh={() => run('player.profile.get')} />

      {v.jail && <Notice alert>{t('dashboard.jail', { city: v.jail.city ?? '', t: hms(v.jail.remaining_seconds) })}</Notice>}

      <Card>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 8 }}>
          {v.travelling ? t('dashboard.travelling') : [v.city, v.place?.name].filter(Boolean).join(' · ')}
        </div>
        <Bar frac={v.max_energy ? clamp01((v.energy ?? 0) / v.max_energy) : 0} color="var(--saffron)"
          label={`${formatNumber(v.energy ?? 0)}/${formatNumber(v.max_energy ?? 0)}`} />
      </Card>

      <StatPair
        left={<Stat icon="coins" palette="gold" label={t('bank.cash')} value={money(v.cash)} />}
        right={<Stat icon="bank" palette="sapphire" label={t('bank.title')} value={money(v.bank)} />}
      />

      <Actions response={response} onAction={onAction} refreshCommand="player.profile.get" />
    </ScreenScroll>
  )
}
