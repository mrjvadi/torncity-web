// Missions and the rankings in the new UI: the boards and their missions, one mission, my missions (with what the
// last step paid), and the leaderboards with a podium for the first three.

import type { NScreenProps } from '../../registry'
import type { BoardLine, BoardView, MissionBoardView, MissionObjective, MissionReward, MissionsMineView, MissionView, Named } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Buttons, Card, Chip, Empty, Icon, KV, List, Meter, Note, Row, Section, Segmented, Tile, Tiles, hueOf, letterOf } from '../../ui'
import { t } from '../../../i18n'
import { hms, roughDuration } from '../../../screens/native/kit/format'
import { ActPage, MoneyBig, TapCard, cash, MoreActs, NoView, ResultHero, idOf, n, tk, useActs, type ContentNames } from './common'

// -- words -----------------------------------------------------------------------------------------------------

const missionName = (names: ContentNames, m: Named) => names.name('mission', m.code, m.name)
const boardName = (names: ContentNames, b: Named) => names.name('mission_board', b.code, b.name)

const TARGET_TABLE: Record<string, string> = { city: 'city', career: 'career', course: 'course', item: 'item', crime: 'crime', crime_category: 'crime_category', item_category: 'item_category', career_category: 'career_category' }
const OBJ_ICON: Record<string, string> = { travel: 'plane', work_shift: 'work', course: 'study', buy_item: 'cart', sell_item: 'tag', crime: 'crime', use_item: 'm_backpack', deliver: 'box' }

/** One objective in everyday words («تحویل ۳ باند به تابلو»), the target named from the catalogue. */
function objectiveText(o: MissionObjective, names: ContentNames): string {
  const table = TARGET_TABLE[o.target?.kind ?? '']
  const target = o.target?.code && table ? names.name(table, o.target.code, o.target.name) : o.target?.name ?? ''
  const keys = [o.kind === 'work_shift' && target ? 'missions.obj.work_shift_t' : '', target ? `missions.obj.${o.kind}` : '', `missions.obj.${o.kind}_any`, `missions.obj.${o.kind}`]
  for (const k of keys) if (k) { const s = tk(k, '', { target, count: n(o.count) }); if (s) return s }
  return o.kind
}

/** A reward as chips: cash, experience, goods. */
function RewardChips({ r, names }: { r: MissionReward; names: ContentNames }) {
  return (
    <>
      {r.cash > 0 && <Chip tone="accent"><Icon name="coins" size={16} />{cash(r.cash)}</Chip>}
      {r.xp > 0 && <Chip tone="cyan"><Icon name="x_star" size={16} />{t('missions.xp', { n: n(r.xp) })}</Chip>}
      {(r.items ?? []).map((i) => <Chip key={i.item.code}><Icon name="x_present" size={16} />{t('missions.reward_item', { qty: n(i.qty), item: names.name('item', i.item.code, i.item.name) })}</Chip>)}
    </>
  )
}

const blockedChip = (b: string, wait: number) => (b === 'cooldown' && wait > 0 ? t('missions.wait', { t: hms(wait) }) : tk(`missions.blocked.${b}`, b))

// -- the boards ------------------------------------------------------------------------------------------------

export function MissionBoard({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as MissionBoardView | undefined
  if (!v) return <NoView title={t('missions.title')} loading={loading} />
  const { names } = acts
  const boards = v.boards ?? []
  const mine = acts.find('mission.mine')

  if (!v.board) {
    return (
      <ActPage title={t('missions.title')} sub={v.city || undefined} response={response}>
        {boards.length === 0 && <Empty icon="missions">{t('missions.no_boards')}</Empty>}
        <Tiles>
          {boards.map((b) => {
            const go = acts.of('mission.board', b.code)
            return <Tile key={b.code} icon={b.code === 'police' ? 'shield' : 'x_scroll'} title={boardName(names, b)} sub={b.place?.name ? names.name('place', b.place.code, b.place.name) : undefined}
              badge={b.open ? n(b.open) : undefined} tone={b.open ? 'lit' : undefined} onClick={() => (go ? nav.act(go) : nav.run('mission.board', { board: b.code }))} />
          })}
          {mine && <Tile icon="checklist" title={acts.label(mine)} onClick={() => nav.act(mine)} />}
        </Tiles>
        <MoreActs acts={acts} list={acts.rest(['mission.board', 'mission.mine'])} />
      </ActPage>
    )
  }

  const missions = v.missions ?? []
  return (
    <ActPage title={boardName(names, v.board)} sub={[v.board.place?.name ? names.name('place', v.board.place.code, v.board.place.name) : '', v.city].filter(Boolean).join(' – ') || undefined} response={response}>
      {!v.here && <Note tone="info" icon="walk">{t('missions.need_board')}</Note>}
      {missions.length === 0 && <Empty icon="missions">{t('missions.empty')}</Empty>}
      <div className="n-act-cards">
        {missions.map((m) => {
          const go = acts.of('mission.view', m.mission.code)
          return (
            <TapCard key={m.mission.code} onClick={go ? () => nav.act(go) : () => nav.run('mission.view', { mission: m.mission.code })} dim={!!m.blocked}>
              <div className="n-act-mission-head">
                <Icon name="missions" size={44} />
                <div>
                  <p className="n-act-next-title">{missionName(names, m.mission)}</p>
                  {m.repeatable && <p className="n-label">{t('missions.repeat')}</p>}
                </div>
                {m.blocked && <Chip tone={m.blocked === 'active' ? 'cyan' : 'warn'}>{blockedChip(m.blocked, m.wait_seconds)}</Chip>}
              </div>
              <ul className="n-act-objs">
                {(m.objectives ?? []).map((o, i) => <li key={i}><Icon name={OBJ_ICON[o.kind] ?? 'm_check'} size={22} />{objectiveText(o, names)}</li>)}
              </ul>
              <div className="n-chips"><RewardChips r={m.reward} names={names} /></div>
            </TapCard>
          )
        })}
      </div>
      {mine && <Button kind="ghost" block icon="checklist" onClick={() => nav.act(mine)}>{acts.label(mine)}</Button>}
      <MoreActs acts={acts} list={acts.rest(['mission.view', 'mission.mine'])} />
    </ActPage>
  )
}

// -- one mission -----------------------------------------------------------------------------------------------

export function Mission({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as MissionView | undefined
  if (!v) return <NoView title={t('screen.mission')} loading={loading} />
  const { names } = acts
  const name = missionName(names, v.mission)
  const accept = acts.find('mission.accept')
  const give = acts.find('mission.abandon_confirm')
  const blocked = v.blocked ? tk(`ac.mission.blocked.${v.blocked}`, blockedChip(v.blocked, v.wait_seconds), { level: n(v.min_level), max: n(v.max), t: hms(v.wait_seconds) }) : ''
  return (
    <ActPage title={v.abandoning ? t('ac.mission.abandon_title') : name} response={response}>
      {v.abandoning ? (
        <ResultHero tone="loss" art="m_stop" kicker={t('ac.mission.abandon_title')} big={name} sub={t('ac.mission.abandon_ask', { mission: name })} />
      ) : (
        <div className="n-hero has-art">
          <Icon name="missions" className="n-hero-art" />
          <div className="n-hero-body">
            <p className="n-label">{boardName(names, v.board)}</p>
            <p className="n-big n-act-name">{name}</p>
            <div className="n-chips n-hero-line"><RewardChips r={v.reward} names={names} /></div>
          </div>
        </div>
      )}

      <Section title={t('ac.mission.goals')} />
      <List>{(v.objectives ?? []).map((o, i) => <Row key={i} icon={OBJ_ICON[o.kind] ?? 'm_check'} title={objectiveText(o, names)} />)}</List>

      <div className="n-rows">
        {v.min_level > 0 && <KV label={t('ac.mission.min_level')} value={n(v.min_level)} />}
        {(v.requires ?? []).length > 0 && <KV label={t('ac.mission.requires')} value={(v.requires ?? []).map((r) => missionName(names, r)).join(`${t('common.sep')} `)} />}
        {v.time_limit_seconds > 0 && <KV label={t('ac.mission.time_limit')} value={roughDuration(v.time_limit_seconds)} />}
        <KV label={t('ac.mission.repeatable')} value={v.repeatable ? (v.cooldown_seconds > 0 ? t('ac.mission.repeat_after', { t: roughDuration(v.cooldown_seconds) }) : t('ac.mission.repeat_any')) : t('common.no')} />
        {v.max > 0 && <KV label={t('ac.mission.at_most')} value={n(v.max)} />}
      </div>
      {!v.abandoning && <Note tone="info" icon="x_scroll">{t('ac.mission.where', { board: boardName(names, v.board) })}</Note>}
      {blocked && <Note tone="bad" icon="m_lock">{blocked}</Note>}

      {accept && <Button block icon="m_check" onClick={() => nav.act(accept)}>{acts.label(accept)}</Button>}
      {v.abandoning && (
        <Buttons lead>
          {give && <Button kind="danger" onClick={() => nav.act({ ...give, kind: 'secondary' })}>{t('ac.mission.abandon_yes')}</Button>}
          <Button kind="ghost" onClick={nav.back}>{t('common.cancel')}</Button>
        </Buttons>
      )}
      <MoreActs acts={acts} list={acts.rest(['mission.accept', 'mission.abandon_confirm'])} />
    </ActPage>
  )
}

// -- my missions -----------------------------------------------------------------------------------------------

export function MissionsMine({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as MissionsMineView | undefined
  if (!v) return <NoView title={t('ac.mission.mine_title')} loading={loading} />
  const { names } = acts
  const active = v.active ?? []
  const recent = v.recent ?? []
  const nt = v.notice
  const boards = acts.find('mission.boards')
  const firstDeliver = active.map((m) => acts.find('mission.deliver', (a) => a.args?.no === String(m.no))).find(Boolean)
  return (
    <ActPage title={t('ac.mission.mine_title')} sub={t('ac.mission.mine_count', { n: n(active.length), max: n(v.max) })} response={response}>
      {nt && nt.kind === 'completed' && (
        <ResultHero art="trophy" kicker={t('ac.mission.notice.completed', { mission: missionName(names, nt.mission) })} big={nt.cash > 0 ? <MoneyBig amount={nt.cash} sign="+" /> : missionName(names, nt.mission)}
          sub={nt.withheld > 0 ? t('ac.mission.withheld', { n: cash(nt.withheld) }) : undefined}
          chips={nt.xp > 0 ? <Chip tone="cyan"><Icon name="x_star" size={16} />{t('missions.xp', { n: n(nt.xp) })}</Chip> : undefined} />
      )}
      {nt && nt.kind !== 'completed' && (
        <Note tone={nt.kind === 'abandoned' ? 'bad' : 'ok'} icon={nt.kind === 'abandoned' ? 'm_stop' : 'm_check'}>
          {tk(`ac.mission.notice.${nt.kind}`, '', { mission: missionName(names, nt.mission), qty: n(nt.qty) })}
        </Note>
      )}

      {active.length === 0 && <Empty icon="missions">{t('ac.mission.mine_none')}</Empty>}
      <div className="n-act-cards">
        {active.map((m) => {
          const deliver = acts.find('mission.deliver', (a) => a.args?.no === String(m.no))
          const give = acts.find('mission.abandon', (a) => a.args?.no === String(m.no))
          return (
            <Card key={m.no} tone={deliver === firstDeliver && deliver ? 'lit' : undefined}>
              <div className="n-act-mission-head">
                <Icon name="missions" size={44} />
                <div><p className="n-act-next-title">{missionName(names, m.mission)}</p></div>
                {m.left_seconds > 0 && <Chip tone="warn"><Icon name="stopwatch" size={16} />{t('ac.mission.left', { t: hms(m.left_seconds) })}</Chip>}
              </div>
              <div className="n-act-objs-m">
                {(m.objectives ?? []).map((o, i) => (
                  <Meter key={i} tone={o.done >= o.count ? undefined : 'accent'} frac={o.count ? o.done / o.count : 0}
                    label={<><Icon name={OBJ_ICON[o.kind] ?? 'm_check'} size={20} />{objectiveText(o, names)}</>} value={t('ac.mission.progress', { done: n(o.done), count: n(o.count) })} />
                ))}
              </div>
              {(deliver || give) && (
                <Buttons>
                  {deliver && <Button kind={deliver === firstDeliver ? 'primary' : 'cyan'} small icon="box" onClick={() => nav.act(deliver)}>{t('ac.mission.deliver')}</Button>}
                  {give && <Button kind="danger" small onClick={() => nav.act({ ...give, kind: 'secondary' })}>{t('ac.mission.abandon')}</Button>}
                </Buttons>
              )}
            </Card>
          )
        })}
      </div>

      {recent.length > 0 && (
        <>
          <Section title={t('ac.mission.recent_title')} />
          <List>
            {recent.map((m) => (
              <Row key={m.no} icon={m.status === 'completed' ? 'm_check' : m.status === 'abandoned' ? 'm_stop' : 'clock'}
                title={tk(`ac.mission.recent.${m.status}`, missionName(names, m.mission), { mission: missionName(names, m.mission), cash: cash(m.cash) })}
                sub={m.withheld > 0 ? t('ac.mission.withheld_short') : undefined} />
            ))}
          </List>
        </>
      )}
      {boards && <Button kind="ghost" block icon="x_scroll" onClick={() => nav.act(boards)}>{acts.label(boards)}</Button>}
      <MoreActs acts={acts} list={acts.rest(['mission.deliver', 'mission.abandon', 'mission.boards'])} />
    </ActPage>
  )
}

// -- the leaderboards ------------------------------------------------------------------------------------------

const BOARDS = ['richest', 'companies', 'cities', 'workers', 'investors']

export function Leaderboard({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as BoardView | undefined
  if (!v) return <NoView title={t('hub.leaderboard')} loading={loading} />
  const { names } = acts
  const boards = v.village ? ['village', ...BOARDS] : BOARDS
  const lines = v.lines ?? []
  const label = (l: BoardLine) => (v.board === 'cities' ? names.name('city', l.code, l.name) : l.name || t('soc.unknown_player'))
  const tag = (l: BoardLine): string => {
    switch (v.board) {
      case 'village': case 'richest': return v.ranks?.[l.tag] ? names.name('rank', l.tag, v.ranks[l.tag].name) : ''
      case 'companies': return [names.name('company_type', l.tag, l.tag_name), l.city?.code ? names.name('city', l.city.code, l.city.name) : ''].filter(Boolean).join(' – ')
      case 'workers': return l.tag ? names.name('career', l.tag, l.tag_name) : t('soc.board.no_job')
      default: return l.tag_name
    }
  }
  const value = (l: BoardLine) => (v.board === 'richest' || v.board === 'village' || v.board === 'companies' ? cash(l.value) : n(l.value))
  const top = lines.filter((l) => l.position <= 3).sort((a, b) => a.position - b.position)
  const podium = top.length >= 2 ? [top[1], top[0], top[2]].filter(Boolean) : []
  const rest = podium.length ? lines.filter((l) => !podium.includes(l)) : lines
  const title = v.board === 'village' ? t('soc.board.village', { place: v.village?.name ?? '' }) : tk(`soc.board.${v.board}`, t('hub.leaderboard'))
  return (
    <ActPage title={title} response={response}>
      <Segmented items={boards.map((b) => ({ key: b, label: tk(`soc.board.tab.${b}`, b) }))} value={v.board} onChange={(b) => nav.run('life.top', { board: b })} />
      {lines.length === 0 && <Empty icon="podium">{t('soc.board.empty')}</Empty>}
      {podium.length > 0 && (
        <div className="n-act-podium">
          {podium.map((l) => (
            <div key={l.position} className={`n-act-podium-col p${l.position}${l.mine ? ' mine' : ''}`}>
              {l.position === 1 && <Icon name="x_crown" className="n-act-crown" />}
              <span className="n-act-podium-av" style={{ background: `hsl(${hueOf(label(l))} 42% 38%)` }}>{letterOf(label(l))}</span>
              <b className="n-act-podium-name">{label(l)}</b>
              <span className="n-act-podium-val">{value(l)}</span>
              <span className="n-act-podium-step"><Icon name={l.position === 1 ? 'trophy' : 'medal'} size={30} />{n(l.position)}</span>
            </div>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="n-act-lb">
          {rest.map((l) => (
            <div key={`${l.position}-${l.code}`} className={l.mine ? 'mine' : undefined}>
              <Row avatar={{ letter: n(l.position), hue: l.mine ? 24 : 215 }} title={`${label(l)}${l.mine ? ` ${t('soc.you')}` : ''}`} sub={tag(l) || undefined}
                end={<Chip tone={l.mine ? 'accent' : undefined}>{value(l)}</Chip>} />
            </div>
          ))}
        </div>
      )}
      <Note tone="info" icon="chart">{tk(`soc.board.hint.${v.board}`, '')}</Note>
      <MoreActs acts={acts} list={acts.all.filter((a) => idOf(a) !== 'board.tab' && a.command !== 'life.top')} />
    </ActPage>
  )
}

export const MISSIONS = { mission_board: MissionBoard, mission: Mission, missions_mine: MissionsMine, leaderboard: Leaderboard }
