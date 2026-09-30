import type { ScreenProps } from '../types'
import { Header, ListRow, ScreenScroll, Segmented } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber } from './kit/format'
import { t } from '../../i18n'

interface Named { code?: string; name?: string }
interface BoardLine { position?: number; name?: string; city?: Named; tag_name?: string; value?: number; mine?: boolean }
interface BoardView { board?: string; lines?: BoardLine[] | null }

const boards = () => [
  { key: 'companies', label: t('board.companies') },
  { key: 'workers', label: t('board.workers') },
  { key: 'investors', label: t('board.investors') },
  { key: 'cities', label: t('board.cities') },
]

export default function Leaderboard({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as BoardView
  if (loading && !response) return <ScreenScroll><Header title={t('board.title')} tone="gold" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('board.title')} tone="gold" onRefresh={() => v.board && run('life.top', { board: v.board })} />
      <Segmented options={boards()} value={v.board ?? 'companies'} onChange={(b) => run('life.top', { board: b })} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(v.lines ?? []).map((l, i) => (
          <ListRow
            key={i}
            icon="trophy"
            palette={l.mine ? 'gold' : 'steel'}
            tone={l.mine ? 'gold' : undefined}
            title={`${formatNumber(l.position ?? i + 1)}. ${l.name ?? '—'}`}
            sub={[l.tag_name, l.city?.name].filter(Boolean).join(' · ')}
            right={formatNumber(l.value ?? 0)}
          />
        ))}
      </div>

      <Actions response={response} onAction={onAction} refreshCommand="life.top" />
    </ScreenScroll>
  )
}
