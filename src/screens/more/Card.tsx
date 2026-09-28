// A player's public card (internal/telegram/screens/life.go, CardView) —
// your own, or another player's found through search or a leaderboard.

import type { ScreenProps } from '../types'
import { Card as Panel, Header, Notice, ScreenScroll, Stat, StatPair } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { ago, formatNumber } from '../native/kit/format'

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
  if (loading && !response) return <ScreenScroll><Header title="کارت بازیکن" tone="violet" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.self ? 'کارت من' : (v.name ?? 'کارت بازیکن')} tone="violet"
        onBack={() => run('player.profile.get')} onRefresh={() => run('life.card', v.code ? { code: v.code } : undefined)} />

      {v.notice && <Notice>{v.notice}</Notice>}

      <Panel tone="violet">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{v.avatar?.emoji ?? '🙂'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 18, color: '#fff' }}>{v.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {[v.stage?.name, v.age ? `${formatNumber(v.age)} ساله` : undefined, v.code ? `کد: ${v.code}` : undefined].filter(Boolean).join(' · ')}
            </div>
            {v.rank?.name && <span className="nx-chip nx-chip-gold" style={{ marginTop: 6, display: 'inline-block' }}>{v.rank.emoji} {v.rank.name}</span>}
          </div>
        </div>
        {v.self && v.bio && <div className="mx-bio" style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>{v.bio}</div>}
        {v.self && !v.bio && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>هنوز بیوگرافی ننوشته‌ای.</div>}
      </Panel>

      <StatPair
        left={<Stat icon="x_crown" palette="gold" label="سطح" value={formatNumber(v.level ?? 0)} />}
        right={<Stat icon="trophy" palette="gold" label="دستاورد" value={formatNumber(v.achievements ?? 0)} />}
      />
      <StatPair
        left={<Stat icon="book" palette="violet" label="خاطرات" value={formatNumber(v.entries ?? 0)} />}
        right={<Stat icon="clock" palette="steel" label="عضویت" value={joinedAgo(v.joined_at) ?? '—'} />}
      />

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
