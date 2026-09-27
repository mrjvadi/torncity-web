import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { hms, money } from './kit/format'

interface Named { code?: string; name?: string }
interface Reward { cash?: number; xp?: number; items?: { item?: Named; qty?: number }[] | null }
interface MissionLine { mission?: Named; blocked?: string; repeatable?: boolean; reward?: Reward; wait_seconds?: number }
interface Board { code?: string; name?: string; place?: Named }
interface MissionBoardView { city?: string; boards?: Board[] | null; board?: Board | null; here?: boolean; missions?: MissionLine[] | null }

const BLOCKED_FA: Record<string, string> = { requires: 'نیازمندی‌ها را نداری', cooldown: 'در استراحت', active: 'در حال انجام' }

export default function Missions({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as MissionBoardView
  if (loading && !response) return <ScreenScroll><Header title="مأموریت‌ها" tone="violet" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={v.board?.name ?? 'مأموریت‌ها'} tone="violet" onRefresh={() => run('mission.board')} />

      {!v.board && !!(v.boards && v.boards.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.boards!.map((b, i) => (
            <ListRow key={i} icon="missions" palette="violet" title={b.name ?? '—'} sub={b.place?.name}
              onClick={() => b.code && run('mission.board', { board: b.code })} />
          ))}
        </div>
      )}

      {v.board && !v.here && <Notice>باید سر تابلوی مأموریت باشی تا مأموریت بگیری.</Notice>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.missions ?? []).map((m, i) => (
          <ListRow
            key={i}
            icon={m.blocked ? 'm_lock' : 'missions'}
            palette={m.blocked ? 'steel' : 'violet'}
            title={m.mission?.name ?? '—'}
            sub={m.blocked
              ? `${BLOCKED_FA[m.blocked] ?? m.blocked}${m.wait_seconds ? ` · ${hms(m.wait_seconds)}` : ''}`
              : `${m.reward?.cash ? money(m.reward.cash) : ''}${m.reward?.xp ? ` · ${m.reward.xp} XP` : ''}`}
            onClick={() => !m.blocked && m.mission?.code && run('mission.view', { mission: m.mission.code })}
          />
        ))}
      </div>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
