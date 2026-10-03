// Achievements (internal/telegram/screens/achievements.go,
// AchievementsView): earned first, then open ones with a progress bar.

import type { ScreenProps } from '../types'
import { Bar, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import { CardGrid } from '../../ui/v6/panel'
import Actions from '../native/kit/Actions'
import { clamp01, formatNumber, money } from '../native/kit/format'
import { t } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

interface Named { code?: string; name?: string }
interface AchievementLine { achievement?: Named; count?: number; done?: number; reward?: number; earned?: boolean; cash?: number }
interface AchievementsView { lines?: AchievementLine[] | null }

export default function Achievements({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as AchievementsView
  const names = useContentNames()
  const nameOf = (a?: Named) => (a?.code ? names.name('achievement', a.code, a.name) : a?.name ?? '—')
  const lines = v.lines ?? []
  const earned = lines.filter((l) => l.earned)
  const open = lines.filter((l) => !l.earned)
  if (loading && !response) return <ScreenScroll><Header title={t('achievements.title')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('achievements.title')} tone="gold" onBack={() => run('player.profile.get')} onRefresh={() => run('achievement.list')} />

      {lines.length === 0 && <Notice>{t('achievements.none')}</Notice>}

      {!!earned.length && (
        <CardGrid>
          {earned.map((l, i) => (
            <ListRow key={i} icon="trophy" palette="gold" tone="gold" title={nameOf(l.achievement)}
              sub={l.cash ? t('achievements.rewarded', { n: money(l.cash) }) : undefined} />
          ))}
        </CardGrid>
      )}

      {!!open.length && (
        <CardGrid>
          {open.map((l, i) => (
            <div key={i} className="nx-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="display" style={{ fontSize: 14, color: '#fff' }}>{nameOf(l.achievement)}</span>
                {!!l.reward && <span className="nx-chip nx-chip-gold">{money(l.reward)}</span>}
              </div>
              <Bar frac={clamp01((l.done ?? 0) / Math.max(1, l.count ?? 1))} color="var(--gold)"
                label={`${formatNumber(l.done ?? 0)}/${formatNumber(l.count ?? 0)}`} />
            </div>
          ))}
        </CardGrid>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
