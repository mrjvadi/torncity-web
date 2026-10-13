// The town's own screens in the new design: its status and treasury (`settlement.overview` -> `village_overview`), its
// development readout (`settlement.development.view` -> `village_development`), its knowledge
// (`settlement.knowledge` -> `settlement_knowledge_list`), who is in town (`settlement.who` -> `settlement_who`) and
// what is going up (`settlement.build.progress` -> `settlement_construction_progress`). The city panel's local entries
// (village_overview, village_knowledge, village_who, village_progress) open the same screens by reading the command.

import { useState, type ComponentType } from 'react'
import type { NScreenProps } from '../../registry'
import type { Action, CommandResponse } from '../../../api/types'
import type { ConstructionProgressView, DevelopmentView, KnowledgeListView, KnowledgeLine, SettlementWhoView, VillageOverviewView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Card, Chip, Confirm, Empty, Hero, Icon, KV, List, Loading, Meter, Note, Now, Page, Row, Section, Strip, hueOf, letterOf } from '../../ui'
import { icon3d } from '../../icons'
import { buildingName, useBuildingCatalogue, useContentNames, useNow } from '../../../village/useVillage'
import { actionLabel } from '../../../screens/village/wording'
import { formatNumber, money, splitMoney } from '../../../screens/native/kit/format'
import { atText, words } from '../../../lib/duration'
import { clock, fa, waitText } from '../../../ui/v6/format'
import { noticeText, refusalText, t } from '../../../i18n'
import { roleIcon, roleName, useCommand, word } from './shared'
import './city.css'

const isBack = (a: Action) => a.kind === 'back' || a.id === 'back' || a.id === 'refresh'
const pct = (n: number) => `${fa(Math.round(n))}٪`

/** The top of a town screen when the answer is a refusal or carries a notice. */
function Answer({ r }: { r: CommandResponse }) {
  return (
    <>
      {r.ok === false && r.error && <Note tone="bad" icon="x_wanted">{refusalText(r.error.code, r.error.message, r.error.args)}</Note>}
      {r.notice && <Note tone={r.notice.alert ? 'bad' : 'ok'} icon={r.notice.alert ? 'x_wanted' : 'm_check'}>{noticeText(r.notice)}</Note>}
    </>
  )
}

function Waiting({ title, loading }: { title: string; loading: boolean }) {
  return <Page title={title}>{loading ? <Loading /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>
}

// -- status and treasury -----------------------------------------------------------------------------

const SERVICE_ICON: Record<string, string> = { local_security: 'shield', primary_care: 'hospital', lodging_and_tea: 'bed' }
const ACT_ICON: Record<string, string> = {
  'citizen.land': 'x_map', 'citizen.build_house': 'house', 'citizen.mine': 'ore', 'village.work': 'work', 'village.donate': 'coins', 'village.who': 'society',
  'village.knowledge': 'study', 'village.progress': 'factory', 'village.materials': 'box', 'village.build': 'factory', 'village.terms': 'quill',
}

export function Overview({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  const v = response?.view as VillageOverviewView | undefined
  if (!response || !v || typeof v.population !== 'number') return <Waiting title={t('overview.title')} loading={loading} />
  const [main, sup] = splitMoney(money(v.treasury)) ?? [money(v.treasury), '']
  const bars: [string, number][] = [
    ['overview.food', v.food_percent], ['overview.job', v.job_percent], ['overview.service', v.service_percent],
    ['overview.happiness', v.happiness_percent], ['overview.security', v.security_percent], ['overview.literacy', v.literacy_percent],
  ]
  const acts = (response.actions ?? []).filter((a) => !isBack(a) && !(a.id ?? '').startsWith('support.'))
  const donate = acts.find((a) => a.id === 'village.donate')
  const danger = acts.filter((a) => a.kind === 'danger')
  const rest = acts.filter((a) => a !== donate && !danger.includes(a))
  const role = v.is_head ? t('village.head') : v.resident ? t('village.member') : t('village.visitor')
  return (
    <Page title={v.name || t('overview.title')} sub={role}>
      <Answer r={response} />
      <Hero art="coins">
        <p className="n-label">{t('overview.treasury')}</p>
        <p className="n-big">{main}</p>
        {sup && <p className="n-label">{sup}</p>}
        {donate && <div className="n-hero-foot"><Button block onClick={() => nav.act(donate)}>{actionLabel(donate)}</Button></div>}
      </Hero>
      <Strip items={[
        { label: t('overview.population'), value: v.population_cap > 0 ? t('city.dim.of', { load: formatNumber(v.population), cap: formatNumber(v.population_cap) }) : formatNumber(v.population) },
        { label: t('overview.happiness'), value: pct(v.happiness_percent) },
        { label: t('overview.literacy'), value: pct(v.literacy_percent) },
      ]} />
      <Section title={t('overview.title')} />
      <Card>
        <div className="n-city-facts">
          {bars.map(([k, p]) => <Meter key={k} frac={p / 100} tone={p < 35 ? 'bad' : p < 60 ? 'warn' : undefined} label={word(k)} value={pct(p)} />)}
        </div>
      </Card>

      {(v.services ?? []).length > 0 && (
        <>
          <Section title={t('vx.svc.title')} />
          <List>
            {(v.services ?? []).map((sv, i) => {
              const why = !sv.held && sv.idle ? word(`vx.svc.idle.${sv.idle}`) : ''
              const needs = (sv.needs ?? []).map((m) => `${formatNumber(m.quantity)} ${names.name(['component', 'item'], m.component.code, m.component.name)}`).join('، ')
              const sub = why || (sv.grace && sv.grace_until && needs ? t('vx.svc.grace', { at: atText(sv.grace_until), needs }) : word(`vx.svc.kind.${sv.service}`))
              return <Row key={i} icon={SERVICE_ICON[sv.service] ?? 'house'} title={buildingName(cat, sv.building.code, sv.building.name)} sub={sub}
                end={<Chip tone={sv.held ? 'ok' : 'bad'}>{sv.held ? t('vx.svc.open') : t('vx.svc.closed')}</Chip>} />
            })}
          </List>
        </>
      )}

      <Section title={t('overview.buildings')} note={formatNumber((v.buildings ?? []).length)} />
      {(v.buildings ?? []).length === 0 ? <Empty icon="factory">{t('overview.no_buildings')}</Empty> : (
        <List>
          {(v.buildings ?? []).map((b, i) => <Row key={i} icon={roleIcon(b.role)} title={buildingName(cat, b.building.code, b.building.name)} sub={roleName(b.role)} end={b.tier > 0 ? <small>{t('common.level', { n: formatNumber(b.tier) })}</small> : undefined} />)}
        </List>
      )}

      {rest.length > 0 && (
        <>
          <Section title={t('next.actions')} />
          <List>{rest.map((a, i) => <Row key={i} icon={ACT_ICON[a.id ?? ''] ?? icon3d(a.icon, 'eye')} title={actionLabel(a)} onClick={() => nav.act(a)} />)}</List>
        </>
      )}
      {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{actionLabel(a)}</Button>)}
    </Page>
  )
}

// -- the development readout -------------------------------------------------------------------------

const DIM: Record<string, string> = { people: 'city.dim.people', buildings: 'city.dim.buildings', knowledge: 'city.dim.knowledge' }

export function Development({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useContentNames()
  const v = response?.view as DevelopmentView | undefined
  if (!response || !v || !('dimensions' in v)) return <Waiting title={t('city.status')} loading={loading} />
  return (
    <Page title={v.village || t('city.status')} sub={t('city.status')}>
      <Answer r={response} />
      <Card>
        <div className="n-city-facts">
          {(v.dimensions ?? []).filter((d) => DIM[d.code]).map((d) => d.capacity > 0
            ? <Meter key={d.code} frac={d.load / d.capacity} tone={d.load > d.capacity ? 'bad' : d.load / d.capacity >= 0.85 ? 'warn' : undefined} label={word(DIM[d.code])} value={t('city.dim.of', { load: formatNumber(d.load), cap: formatNumber(d.capacity) })} />
            : <KV key={d.code} label={word(DIM[d.code])} value={formatNumber(d.load)} />)}
        </div>
      </Card>
      {(v.dimensions ?? []).some((d) => d.capacity > 0 && d.load > d.capacity) && <Note tone="bad" icon="x_wanted">{t('city.dim.over')}</Note>}
      <Section title={t('city.roles')} />
      {(v.roles ?? []).length === 0 ? <p className="n-city-quiet">{t('n.city.roles_none')}</p> : (
        <div className="n-chips">{(v.roles ?? []).map((r) => <Chip key={r.role}><Icon name={roleIcon(r.role)} size={20} />{t('city.role.level', { role: roleName(r.role), n: r.level })}</Chip>)}</div>
      )}
      <Section title={t('city.next.title')} />
      {(v.next ?? []).length === 0 ? <p className="n-city-quiet">{t('city.next.none')}</p> : (
        <List>
          {(v.next ?? []).map((c) => {
            const research = c.kind === 'research'
            return <Row key={`${c.kind}:${c.code}`} icon={research ? 'study' : 'factory'} title={research ? names.name('knowledge', c.code, c.name) : names.name('settlement_building', c.code, c.name)}
              sub={t(research ? 'city.next.research' : 'city.next.build')} onClick={() => nav.run(research ? 'settlement.knowledge' : 'settlement.build')} />
          })}
        </List>
      )}
    </Page>
  )
}

// -- knowledge ---------------------------------------------------------------------------------------

/** A knowledge verb's button: the command's own words with the catalogue's name of the knowledge. */
const knowLabel = (a: Action, name: string) => (a.command?.endsWith('.buy') ? t('cmd.settlement.knowledge.buy', { name }) : a.command?.endsWith('.research') ? t('cmd.settlement.knowledge.research', { name }) : actionLabel(a))

const KNOW_TONE: Record<string, 'ok' | 'cyan' | 'accent' | undefined> = { held: 'ok', researching: 'accent', available: 'cyan' }

function KnowRow({ l, acts, onAct }: { l: KnowledgeLine; acts: Action[]; onAct: (a: Action, l: KnowledgeLine) => void }) {
  const names = useContentNames()
  const name = names.name('knowledge', l.knowledge.code, l.knowledge.name)
  const mine = acts.filter((a) => a.args?.code === l.knowledge.code)
  const sub = l.state === 'available' ? [l.research_cost > 0 ? t('know.cost', { n: money(l.research_cost) }) : '', l.research_time_seconds > 0 ? t('know.time', { t: fa(words(l.research_time_seconds)) }) : ''].filter(Boolean).join(' – ')
    : l.state === 'locked' && (l.missing ?? []).length ? t('know.missing', { list: (l.missing ?? []).map((m) => names.name('knowledge', m.code, m.name)).join('، ') })
    : !l.terrain_ok ? t('know.terrain') : ''
  return (
    <Card flat>
      <div className="n-city-know">
        <Icon name="study" size={40} />
        <div className="n-city-know-body">
          <b>{name}</b>
          {sub && <small>{sub}</small>}
        </div>
        <Chip tone={KNOW_TONE[l.state]}>{word(`know.state.${l.state}`) || t('lw.other')}</Chip>
      </div>
      {mine.length > 0 && (
        <div className="n-btns n-city-gap">
          {mine.map((a, i) => <Button key={i} kind={a.command?.endsWith('.research') ? 'cyan' : 'ghost'} small onClick={() => onAct(a, l)}>{knowLabel(a, name)}</Button>)}
        </div>
      )}
    </Card>
  )
}

export function Knowledge({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useContentNames()
  const now = useNow(1000)
  const [ask, setAsk] = useState<{ a: Action; l: KnowledgeLine } | null>(null)
  const v = response?.view as KnowledgeListView | undefined
  if (!response || !v || !('lines' in v)) return <Waiting title={t('know.title')} loading={loading} />
  const acts = (response.actions ?? []).filter((a) => !isBack(a))
  const running = v.projects?.length ? v.projects : v.running ? [v.running] : []
  const order = ['researching', 'available', 'locked', 'held']
  const lines = [...(v.lines ?? [])].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
  return (
    <Page title={t('know.title')} sub={v.name || undefined}>
      <Answer r={response} />
      <Strip items={[
        { label: t('know.state.held'), value: formatNumber(lines.filter((l) => l.state === 'held').length) },
        { label: t('know.literacy'), value: pct(v.literacy_percent) },
        { label: t('know.projects'), value: v.capacity > 0 ? t('city.dim.of', { load: formatNumber(running.length), cap: formatNumber(v.capacity) }) : formatNumber(running.length) },
      ]} />
      <div className="n-rows"><KV label={t('know.treasury')} value={money(v.treasury)} /></div>
      {running.length > 0 && (
        <>
          <Section title={t('know.running')} />
          {running.map((r, i) => {
            const left = r.finish_at ? Math.max(0, (Date.parse(r.finish_at) - now) / 1000) : r.left_seconds
            return <Now key={i} icon="study" lit={i === 0} title={names.name('knowledge', r.knowledge.code, r.knowledge.name)} sub={t('v6.ev.research')} time={waitText(left, t('v6.day'))} />
          })}
        </>
      )}
      <Section title={t('city.dim.knowledge')} note={formatNumber(lines.length)} />
      {lines.length === 0 ? <Empty icon="study">{t('know.empty')}</Empty> : lines.map((l) => <KnowRow key={l.knowledge.code} l={l} acts={acts} onAct={(a, line) => setAsk({ a, l: line })} />)}
      {v.hidden > 0 && <p className="n-city-quiet">{t('know.hidden', { n: formatNumber(v.hidden) })}</p>}
      {ask && (() => {
        const name = names.name('knowledge', ask.l.knowledge.code, ask.l.knowledge.name)
        const buy = ask.a.command?.endsWith('.buy')
        return (
          <Confirm title={knowLabel(ask.a, name)} icon="study" confirm={knowLabel(ask.a, name)} onConfirm={() => { const a = ask.a; setAsk(null); nav.act(a) }} onClose={() => setAsk(null)}>
            <p className="n-text">{buy ? t('know.confirm_buy', { name, price: money(ask.l.buy_price) }) : t('know.confirm_research', { name, cost: money(ask.l.research_cost) })}</p>
          </Confirm>
        )
      })()}
    </Page>
  )
}

// -- who is in town ----------------------------------------------------------------------------------

export function Who({ response, loading }: NScreenProps) {
  const nav = useNav()
  const names = useContentNames()
  const v = response?.view as SettlementWhoView | undefined
  if (!response || !v || !('offline' in v)) return <Waiting title={t('who.title')} loading={loading} />
  const online = v.online ?? []
  const acts = (response.actions ?? []).filter((a) => !isBack(a))
  return (
    <Page title={t('who.title')} sub={v.name || undefined}>
      <Answer r={response} />
      <Strip items={[
        { label: t('who.online'), value: formatNumber(online.length) },
        { label: t('who.offline'), value: formatNumber(v.offline) },
        { label: t('city.dim.people'), value: formatNumber(online.length + v.offline) },
      ]} />
      <Section title={t('who.online')} />
      {online.length === 0 ? <Empty icon="society">{t('vx.who.nobody')}</Empty> : (
        <List>
          {online.map((p, i) => (
            <Row key={i} avatar={{ letter: letterOf(p.name), hue: hueOf(p.name) }} title={p.name || t('who.unknown')}
              sub={[word(`activity.${p.activity}`), p.place ? names.name(['venue', 'place'], p.place) : ''].filter(Boolean).join(' – ') || undefined} />
          ))}
        </List>
      )}
      {v.offline > 0 && <p className="n-city-quiet">{t('vx.who.offline', { n: formatNumber(v.offline) })}</p>}
      {acts.length > 0 && <List>{acts.map((a, i) => <Row key={i} icon={a.id === 'village.households' ? 'f_house' : icon3d(a.icon, 'house')} title={actionLabel(a)} onClick={() => nav.act(a)} />)}</List>}
    </Page>
  )
}

// -- what is going up --------------------------------------------------------------------------------

export function Progress({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const v = response?.view as ConstructionProgressView | undefined
  if (!response || !v || !('standing' in v)) return <Waiting title={t('progress.title')} loading={loading} />
  const acts = response.actions ?? []
  const actFor = (id: string) => acts.find((a) => a.args?.building_id === id || a.args?.id === id)
  const lines = v.lines ?? []
  const standing = v.standing ?? []
  return (
    <Page title={t('progress.title')} sub={v.name || undefined}>
      <Answer r={response} />
      {lines.length === 0 ? <Note tone="info" icon="factory">{t('progress.empty')}</Note> : lines.map((l, i) => {
        const a = actFor(l.id)
        const name = buildingName(cat, l.building.code, l.building.name)
        if (l.by_work) {
          return <Now key={l.id} icon="work" lit={i === 0} title={name} sub={t('vx.prog.hours', { done: formatNumber(Math.round(l.done_minutes / 60)), total: formatNumber(Math.round(l.required_minutes / 60)) })}
            frac={l.progress_bps / 10000} time={`${fa(Math.round(l.progress_bps / 100))}٪`} onClick={a ? () => nav.act(a) : undefined} />
        }
        const left = l.finish_at ? Math.max(0, (Date.parse(l.finish_at) - now) / 1000) : l.left_seconds
        return <Now key={l.id} icon={roleIcon(cat.get(l.building.code)?.category)} lit={i === 0} title={name} sub={l.state === 'queued' ? t('progress.queued') : t('progress.building')}
          time={l.state === 'queued' ? undefined : clock(left)} onClick={a ? () => nav.act(a) : undefined} />
      })}
      {standing.length > 0 && (
        <>
          <Section title={t('overview.buildings')} note={formatNumber(standing.length)} />
          <List>
            {standing.map((b) => {
              const a = actFor(b.id)
              return <Row key={b.id} icon={roleIcon(cat.get(b.building.code)?.category)} title={buildingName(cat, b.building.code, b.building.name)} sub={t('building.at', { x: b.lot_x + 1, y: b.lot_y + 1 })}
                onClick={() => (a ? nav.act(a) : nav.run('settlement.building.view', { building_id: b.id }))} />
            })}
          </List>
        </>
      )}
    </Page>
  )
}

// -- the city panel's local entries: the same screens, read by their command -------------------------

function fromCommand(command: string, Screen: ComponentType<NScreenProps>, title: string) {
  return function Local(props: NScreenProps) {
    const { res, loading } = useCommand(command)
    if (!res) return <Waiting title={t(title as 'city.title')} loading={loading} />
    return <Screen {...props} response={res} loading={loading} />
  }
}

export const LocalOverview = fromCommand('settlement.overview', Overview, 'overview.title')
export const LocalKnowledge = fromCommand('settlement.knowledge', Knowledge, 'know.title')
export const LocalWho = fromCommand('settlement.who', Who, 'who.title')
export const LocalProgress = fromCommand('settlement.build.progress', Progress, 'progress.title')
