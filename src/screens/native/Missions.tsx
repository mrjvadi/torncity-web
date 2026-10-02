import { useEffect } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, ListRow, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { moneyIn, roughDuration, type PlaceCurrency } from './kit/format'
import { useContentNames, type ContentNames } from '../../village/useVillage'
import { hasKey, t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface Target { kind?: string; code?: string; name?: string }
interface Objective { kind?: string; target?: Target; count?: number; done?: number }
interface Reward { cash?: number; xp?: number; items?: { item?: Named; qty?: number }[] | null }
interface MissionLine { mission?: Named; blocked?: string; repeatable?: boolean; reward?: Reward; wait_seconds?: number; objectives?: Objective[] | null }
interface Board { code?: string; name?: string; place?: Named; open?: number }
interface MissionBoardView {
  city?: string; tier?: string; currency?: PlaceCurrency | null
  boards?: Board[] | null; board?: Board | null; here?: boolean; missions?: MissionLine[] | null
}

const BLOCKED = ['requires', 'cooldown', 'active']
const blockedText = (b: string) => (BLOCKED.includes(b) ? t(`missions.blocked.${b}` as Key) : b)

/** The catalogue table each kind of objective target is named from. */
const TARGET_TABLE: Record<string, string> = { city: 'city', career: 'career', course: 'course', item: 'item', crime: 'crime' }

/** One objective in everyday words («۳ باند به تابلو تحویل بده»), the target named from the catalogue. */
function objectiveText(o: Objective, names: ContentNames): string {
  const kind = o.kind ?? ''
  const table = TARGET_TABLE[o.target?.kind ?? '']
  const target = o.target?.code && table ? names.name(table, o.target.code, o.target.name) : o.target?.name ?? ''
  const count = o.count ?? 1
  const keys = [kind === 'work_shift' && target ? 'missions.obj.work_shift_t' : '', target ? `missions.obj.${kind}` : '', `missions.obj.${kind}_any`, `missions.obj.${kind}`]
  const key = keys.find((k) => k && hasKey(k))
  return key ? t(key as Key, { target, count }) : kind
}

export default function Missions({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as MissionBoardView
  const names = useContentNames()
  const boards = v.boards ?? []

  // a place with a single board opens it at once: there is nothing to choose
  useEffect(() => {
    if (!loading && response && !v.board && boards.length === 1 && boards[0].code) run('mission.board', { board: boards[0].code })
  }, [loading, response, v.board, boards.length, run]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !response) return <ScreenScroll><Header title={t('missions.title')} tone="violet" /></ScreenScroll>

  const boardName = (b?: Board | null) => (b?.code ? names.name('mission_board', b.code, b.name) : b?.name ?? '—')
  const rewardText = (r?: Reward): string => {
    const parts: string[] = []
    if (r?.cash) parts.push(moneyIn(r.cash, v.currency))
    if (r?.xp) parts.push(t('missions.xp', { n: r.xp }))
    for (const it of r?.items ?? []) if (it.item) parts.push(t('missions.reward_item', { qty: it.qty ?? 1, item: names.name('item', it.item.code ?? '', it.item.name) }))
    return parts.join(' · ')
  }

  return (
    <ScreenScroll>
      <Header title={v.board ? boardName(v.board) : t('missions.title')} tone="violet" onRefresh={() => run('mission.board', v.board?.code ? { board: v.board.code } : {})} />

      {!v.board && boards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {boards.map((b, i) => (
            <ListRow key={b.code ?? i} icon="missions" palette="violet" title={boardName(b)}
              sub={[b.open ? t('missions.open', { n: b.open }) : '', b.place?.name ?? ''].filter(Boolean).join(' · ') || undefined}
              onClick={() => b.code && run('mission.board', { board: b.code })} />
          ))}
        </div>
      )}
      {!v.board && boards.length === 0 && <Empty>{t(v.tier === 'village' ? 'missions.no_boards_village' : 'missions.no_boards')}</Empty>}

      {v.board && !v.here && <Notice>{t('missions.need_board')}</Notice>}
      {v.board && (v.missions ?? []).length === 0 && <Empty>{t('missions.empty')}</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.missions ?? []).map((m, i) => {
          const objectives = (m.objectives ?? []).map((o) => `• ${objectiveText(o, names)}`)
          const reward = rewardText(m.reward)
          return (
            <ListRow
              key={m.mission?.code ?? i}
              icon={m.blocked ? 'm_lock' : 'missions'}
              palette={m.blocked ? 'steel' : 'violet'}
              title={m.mission?.code ? names.name('mission', m.mission.code, m.mission.name) : m.mission?.name ?? '—'}
              sub={(
                <>
                  {objectives.map((o) => <span key={o} style={{ display: 'block' }}>{o}</span>)}
                  {reward && <span style={{ display: 'block' }}>{t('missions.reward', { r: reward })}</span>}
                  {m.repeatable && !m.blocked && <span style={{ display: 'block' }}>{t('missions.repeat')}</span>}
                  {m.blocked && <span style={{ display: 'block' }}>{blockedText(m.blocked)}{m.wait_seconds ? ` · ${t('missions.wait', { t: roughDuration(m.wait_seconds) })}` : ''}</span>}
                </>
              )}
              onClick={() => !m.blocked && m.mission?.code && run('mission.view', { mission: m.mission.code })}
            />
          )
        })}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="mission.board" />
    </ScreenScroll>
  )
}
