// Skills (internal/telegram/screens/skills.go, SkillsView): only skills the
// player has put XP into — the rest is one line saying how they are earned.

import type { ScreenProps } from '../types'
import { Bar, Card, Header, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { clamp01, formatNumber } from '../native/kit/format'
import { t } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

interface SkillLine { code?: string; level?: number; xp?: number; from?: number; next?: number; percent?: number; max?: boolean }
interface SkillsView { lines?: SkillLine[] | null }

export default function Skills({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as SkillsView
  const names = useContentNames()
  const trained = (v.lines ?? []).filter((l) => (l.level ?? 0) > 0 || (l.xp ?? 0) > 0)
  if (loading && !response) return <ScreenScroll><Header title={t('skills.title')} tone="violet" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('skills.title')} tone="violet" onBack={() => run('player.profile.get')} onRefresh={() => run('skills.list')} />

      {trained.length === 0 && <Notice>{t('skills.none')}</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {trained.map((l, i) => (
          <Card key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="display" style={{ fontSize: 15, color: '#fff' }}>{names.name('skill', l.code ?? '', '')}</span>
              <span className="nx-chip nx-chip-violet">{t('common.level', { n: formatNumber(l.level ?? 0) })}</span>
            </div>
            {l.max ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('skills.maxed')}</div>
            ) : (
              <Bar frac={clamp01((l.percent ?? 0) / 100)} color="var(--violet)"
                label={`${formatNumber(Math.max(0, (l.xp ?? 0) - (l.from ?? 0)))}/${formatNumber((l.next ?? 0) - (l.from ?? 0))}`} />
            )}
          </Card>
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
