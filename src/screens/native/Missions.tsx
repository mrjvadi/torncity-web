import { useEffect } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, Notice, ScreenScroll } from './kit/Parts'
import { PCard, PGrid, PTile } from '../../ui/v6/panel'
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

const BLOCKED = ['requires', 'cooldown', 'active', 'level', 'done', 'too_many']
const blockedText = (b: string) => (BLOCKED.includes(b) ? t(`missions.blocked.${b}` as Key) : b)

/** The catalogue table each kind of objective target is named from. */
const TARGET_TABLE: Record<string, string> = { city: 'city', career: 'career', course: 'course', item: 'item', crime: 'crime', crime_category: 'crime_category', item_category: 'item_category', career_category: 'career_category' }

/** One objective in everyday words («۳ باند به تابلو تحویل بده»), the target named from the catalogue. */
export function objectiveText(o: Objective, names: ContentNames): string {
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
        <div className="hub-grid">
          {boards.map((b, i) => (
            <PTile key={b.code ?? i} icon="scroll" title={boardName(b)} badge={b.open ? t('missions.open', { n: b.open }) : undefined}
              onClick={() => b.code && run('mission.board', { board: b.code })} />
          ))}
        </div>
      )}
      {!v.board && boards.length === 0 && <Empty>{t(v.tier === 'village' ? 'missions.no_boards_village' : 'missions.no_boards')}</Empty>}

      {v.board && !v.here && <Notice>{t('missions.need_board')}</Notice>}
      {v.board && (v.missions ?? []).length === 0 && <Empty>{t('missions.empty')}</Empty>}

      <PGrid>
        {(v.missions ?? []).map((m, i) => {
          const reward = rewardText(m.reward)
          return (
            <PCard
              key={m.mission?.code ?? i}
              icon={m.blocked ? 'lock' : 'scroll'}
              off={!!m.blocked}
              title={m.mission?.code ? names.name('mission', m.mission.code, m.mission.name) : m.mission?.name ?? '—'}
              chip={m.blocked ? blockedText(m.blocked) : m.repeatable ? t('missions.repeat') : undefined}
              chipTone="off"
              lines={[
                ...(m.objectives ?? []).map((o) => `• ${objectiveText(o, names)}`),
                reward && t('missions.reward', { r: reward }),
                m.blocked && m.wait_seconds ? t('missions.wait', { t: roughDuration(m.wait_seconds) }) : '',
              ]}
              onClick={!m.blocked && m.mission?.code ? () => run('mission.view', { mission: m.mission!.code! }) : undefined}
            />
          )
        })}
      </PGrid>

      <Actions response={response} onAction={onAction} only={(a) => a.id !== 'mission.board' && a.id !== 'mission.view'} refreshCommand="mission.board" />
    </ScreenScroll>
  )
}
