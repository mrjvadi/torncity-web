// A player's public card (internal/telegram/screens/life.go, CardView) —
// your own, or another player's found through search or a leaderboard.

import type { ScreenProps } from '../types'
import { Card as Panel, Header, Notice, ScreenScroll, Stat, StatPair } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { ago, formatNumber } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

interface Named { code?: string; name?: string; emoji?: string }

interface CardView {
  name?: string; code?: string
  avatar?: { code?: string; emoji?: string; photo?: boolean }
  bio?: string
  rank?: Named | null
  age?: number
  stage?: Named
  level?: number
  achievements?: number
  entries?: number
  joined_at?: string | null
  self?: boolean
  notice?: string
}

function joinedAgo(iso?: string | null): string | undefined {
  if (!iso) return undefined
  const ms = Date.now() - Date.parse(iso)
  if (!isFinite(ms) || ms < 0) return undefined
  return ago(Math.floor(ms / 1000))
}

export default function PlayerCard({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CardView
  const names = useContentNames()
  const stage = v.stage?.name ? names.name('life_stage', v.stage.code ?? '', v.stage.name) : undefined
  const rank = v.rank?.name ? names.name('life_rank', v.rank.code ?? '', v.rank.name) : undefined
  if (loading && !response) return <ScreenScroll><Header title={t('card.title')} tone="violet" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.self ? t('card.mine') : (v.name ?? t('card.title'))} tone="violet"
        onBack={() => run('player.profile.get')} onRefresh={() => run('life.card', v.code ? { code: v.code } : undefined)} />

      {v.notice && hasKey(`lf.life.notice.${v.notice}`) && <Notice>{t(`lf.life.notice.${v.notice}` as Key)}</Notice>}

      <Panel tone="violet">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{v.avatar?.emoji ?? '🙂'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 18, color: '#fff' }}>{v.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {[stage, v.age ? t('common.years_old', { n: formatNumber(v.age) }) : undefined, v.code ? t('card.code', { code: v.code }) : undefined].filter(Boolean).join(' · ')}
            </div>
            {rank && <span className="nx-chip nx-chip-gold" style={{ marginTop: 6, display: 'inline-block' }}>{rank}</span>}
          </div>
        </div>
        {v.self && v.bio && <div className="mx-bio" style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>{v.bio}</div>}
        {v.self && !v.bio && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>{t('card.no_bio')}</div>}
      </Panel>

      <StatPair
        left={<Stat icon="x_crown" palette="gold" label={t('card.level')} value={formatNumber(v.level ?? 0)} />}
        right={<Stat icon="trophy" palette="gold" label={t('card.achievements')} value={formatNumber(v.achievements ?? 0)} />}
      />
      <StatPair
        left={<Stat icon="book" palette="violet" label={t('card.entries')} value={formatNumber(v.entries ?? 0)} />}
        right={<Stat icon="clock" palette="steel" label={t('card.joined')} value={joinedAgo(v.joined_at) ?? '—'} />}
      />

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
