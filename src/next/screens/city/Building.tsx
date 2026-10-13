// One building of the town (`settlement.building.view` -> `settlement_building_view`), opened by a tap on it in the
// game view: the hero with its 3D icon, name, level and state (built, or going up with its percent), what it does
// (the web's sentence for its kind, its effects on the town, its work, its store, the hall's figures), then its
// actions as the server lists them: one orange lead, the rest as rows, the dangerous ones in red.

import type { NScreenProps } from '../../registry'
import type { Action } from '../../../api/types'
import type { BuildingView, WorkItemLine, WorkNode } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Card, Chip, Empty, Hero, KV, List, Loading, Meter, Note, Page, Row, Section } from '../../ui'
import { icon3d } from '../../icons'
import { buildingName, useBuildingCatalogue, useContentNames, useNow, type ContentNames } from '../../../village/useVillage'
import { actionLabel, buildingBlurb } from '../../../screens/village/wording'
import { formatNumber, money } from '../../../screens/native/kit/format'
import { buildText, words } from '../../../lib/duration'
import { fa } from '../../../ui/v6/format'
import { noticeText, refusalText, t } from '../../../i18n'
import { roleIcon, roleName, word } from './shared'
import './city.css'

const EFFECTS = ['local_security_bps', 'food_coverage_bps', 'job_coverage_bps', 'service_coverage_bps', 'happiness_bps', 'housing_capacity']
const isBack = (a: Action) => a.kind === 'back' || a.id === 'back'
const isRefresh = (a: Action) => a.id === 'refresh'

const itemName = (names: ContentNames, l: WorkItemLine) => `${formatNumber(l.qty)} ${names.name(['component', 'item'], l.item.code, l.item.name)}`

function Work({ w, names }: { w: WorkNode; names: ContentNames }) {
  const tone = w.status === 'working' ? 'ok' : w.status === 'paused' || w.status === 'closed' ? 'warn' : undefined
  const outs = (w.outputs ?? []).map((l) => itemName(names, l)).join('، ')
  const ins = (w.inputs ?? []).map((l) => itemName(names, l)).join('، ')
  const reasons = (w.reasons ?? []).map((r) => word(`work.reason.${r.code}`, {
    have: r.have, need: r.need, item: r.item ? names.name(['component', 'item'], r.item.code, r.item.name) : '', class: word(`work.class.${r.class}`) || t('work.class.other'),
  }) || t('work.reason.other'))
  const cond = w.condition
  return (
    <>
      <Section title={t('work.title')} end={word(`work.status.${w.status}`) ? <Chip tone={tone}>{word(`work.status.${w.status}`)}</Chip> : undefined} />
      <Card>
        <div className="n-city-facts">
          {w.max > 0 && <Meter frac={w.filled / w.max} tone="cyan" label={word(`work.kind.${w.kind}`) || t('work.kind.other')} value={t('work.seats', { filled: formatNumber(w.filled), max: formatNumber(w.max) })} />}
          {outs && <KV label={t('n.city.b.makes')} value={outs} />}
          {ins && <KV label={t('n.city.b.uses')} value={ins} />}
          {w.wage > 0 && <KV label={t('work.wage_set')} value={money(w.wage)} />}
          {w.shift_seconds > 0 && <KV label={t('n.city.b.shift')} value={fa(words(w.shift_seconds))} />}
          {cond && <Meter frac={cond.bps / 10000} tone={cond.closed ? 'bad' : cond.bps < 5000 ? 'warn' : undefined} label={t('work.cond')} value={`${fa(Math.round(cond.bps / 100))}٪`} />}
        </div>
      </Card>
      {reasons.map((r, i) => <Note key={i} tone="bad" icon="m_stop">{r}</Note>)}
    </>
  )
}

export default function Building({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const names = useContentNames()
  const now = useNow(1000)
  const v = response?.view as BuildingView | undefined
  if (!response || !v || !v.building) {
    return (
      <Page title={t('n.city.b.title')}>
        {loading ? <Loading /> : response?.ok === false && response.error
          ? <Note tone="bad" icon="x_wanted">{refusalText(response.error.code, response.error.message, response.error.args)}</Note>
          : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}
      </Page>
    )
  }

  const name = buildingName(cat, v.building.code, v.building.name)
  const going = v.state === 'building'
  // the countdown runs on the server's clock; the view's percent is the floor until the times are known
  const s0 = v.started_at ? Date.parse(v.started_at) : NaN, f0 = v.finish_at ? Date.parse(v.finish_at) : NaN
  const frac = going ? (f0 > s0 ? Math.max(0, Math.min(1, (now - s0) / (f0 - s0))) : v.progress_percent / 100) : 1
  const left = going && f0 ? Math.max(0, (f0 - now) / 1000) : 0
  const effects = (v.effects ?? []).filter((e) => EFFECTS.includes(e.target))
  const confirming = v.mode === 'dm' || v.mode === 'cx'

  const actions = (response.actions ?? []).filter((a) => !isBack(a) && !isRefresh(a))
  const danger = actions.filter((a) => a.kind === 'danger')
  const town = actions.filter((a) => (a.id ?? '').startsWith('village.'))
  const rest = actions.filter((a) => !danger.includes(a) && !town.includes(a))
  const lead = rest.find((a) => a.kind === 'primary' || a.kind === 'confirm') ?? rest.find((a) => a.id === 'building.upgrade' || a.id === 'build.place') ?? rest[0]
  const others = rest.filter((a) => a !== lead)
  const ACT_ICON: Record<string, string> = { 'building.upgrade': 'rank', 'build.place': 'factory', 'village.overview': 'city', 'village.knowledge': 'study', 'village.build': 'factory', 'village.progress': 'clock', 'construction.site': 'work' }
  const actIcon = (a: Action) => ACT_ICON[a.id ?? ''] ?? icon3d(a.icon, 'eye')

  return (
    <Page title={t('n.city.b.title')}>
      {response.ok === false && response.error && <Note tone="bad" icon="x_wanted">{refusalText(response.error.code, response.error.message, response.error.args)}</Note>}
      {response.notice && <Note tone={response.notice.alert ? 'bad' : 'ok'} icon={response.notice.alert ? 'x_wanted' : 'm_check'}>{noticeText(response.notice)}</Note>}

      <Hero art={roleIcon(v.role, v.kind)}>
        <p className="n-label">{roleName(v.role)}</p>
        <p className="n-big n-city-name">{name}</p>
        <div className="n-chips n-hero-line">
          {v.tier > 0 && v.kind !== 'road' && <Chip tone="accent">{t('common.level', { n: formatNumber(v.tier) })}</Chip>}
          <Chip tone={going ? 'warn' : 'ok'}>{t(going ? 'building.state.under_construction' : 'building.state.built')}</Chip>
        </div>
        {going && (
          <div className="n-hero-foot">
            <Meter frac={frac} tone="accent" thick label={left > 0 ? t('vx.bld.left', { t: fa(words(left)) }) : t('progress.done_soon')} value={`${fa(Math.round(frac * 100))}٪`} />
          </div>
        )}
      </Hero>

      {confirming && <Note tone="bad" icon="x_wanted">{t(v.mode === 'dm' ? 'building.confirm_demolish' : 'building.confirm_cancel')}</Note>}

      <Section title={t('n.city.b.does')} />
      <Card flat><p className="n-text">{buildingBlurb(v)}</p></Card>
      {effects.length > 0 && (
        <div className="n-chips">
          {effects.map((e) => <Chip key={e.target} tone="cyan">{word(`building.effect.${e.target}`, { v: e.target === 'housing_capacity' ? e.value : Math.round(e.value / 100) })}</Chip>)}
        </div>
      )}

      {!going && v.kind === 'civic_hall' && (
        <div className="n-rows">
          <KV label={t('building.civic.population')} value={formatNumber(v.population)} />
          <KV label={t('building.civic.treasury')} value={money(v.treasury)} />
          {v.research && <KV label={t('vx.bld.research')} value={`${names.name('knowledge', v.research.knowledge.code, v.research.knowledge.name)} – ${fa(words(v.research.left_seconds))}`} />}
        </div>
      )}
      {!going && v.kind === 'school' && <Note tone="info" icon="study">{v.teaching ? t('building.school.teaching') : t('building.school.idle')}</Note>}
      {!going && v.kind === 'storage' && (
        <>
          <Section title={t('n.city.b.stock')} />
          {v.stock_capacity > 0 && <Meter frac={v.stock_used / v.stock_capacity} tone="cyan" label={t('n.city.b.room')} value={t('city.dim.of', { load: formatNumber(v.stock_used), cap: formatNumber(v.stock_capacity) })} />}
          {(v.stock ?? []).length === 0 ? <Note tone="info" icon="box">{t('building.storage.empty')}</Note> : (
            <List>
              {(v.stock ?? []).map((s) => <Row key={s.item.code} icon="box" title={names.name(['component', 'item'], s.item.code, s.item.name)} end={formatNumber(s.qty)} />)}
            </List>
          )}
        </>
      )}
      {!going && v.work && <Work w={v.work} names={names} />}

      {v.mode === 'up' && (
        <>
          <Section title={t('building.upgrade.intro')} />
          {(v.upgrades ?? []).length === 0 && <Note tone="info" icon="rank">{t('building.upgrade.none')}</Note>}
          {(v.upgrades ?? []).map((u) => {
            const short = (u.needs ?? []).filter((n) => n.have < n.need).length
            return (
              <Card key={u.building.code} tone={u.available ? 'lit' : undefined}>
                <div className="n-city-up-head">
                  <b>{t('v6.up.title', { name: buildingName(cat, u.building.code, u.building.name) })}</b>
                  <Chip tone={u.available ? 'ok' : 'warn'}>{u.available ? t('v6.up.ready') : t('n.city.b.short', { n: formatNumber(short) })}</Chip>
                </div>
                <div className="n-city-facts">
                  <KV label={t('v6.up.cost')} value={money(u.cost_money)} />
                  <KV label={t('v6.up.time')} value={fa(buildText(u))} />
                </div>
              </Card>
            )
          })}
        </>
      )}

      <div className="n-city-facts">
        {v.kind !== 'road' && <KV label={t('building.stat.spot')} value={t('building.at', { x: v.x + 1, y: v.y + 1 })} />}
        {v.upkeep > 0 && <KV label={t('building.stat.upkeep')} value={money(v.upkeep)} />}
      </div>

      {town.length > 0 && (
        <>
          <Section title={t('n.city.b.town')} />
          <List>{town.map((a, i) => <Row key={i} icon={actIcon(a)} title={actionLabel(a, names)} onClick={() => nav.act(a)} />)}</List>
        </>
      )}
      {others.length > 0 && (
        <>
          <Section title={t('next.actions')} />
          <List>{others.map((a, i) => <Row key={i} icon={actIcon(a)} title={actionLabel(a, names)} onClick={() => nav.act(a)} />)}</List>
        </>
      )}
      {(lead || danger.length > 0) && (
        <div className="n-city-acts">
          {lead && <Button block icon={actIcon(lead)} onClick={() => nav.act(lead)}>{actionLabel(lead, names)}</Button>}
          {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{actionLabel(a, names)}</Button>)}
        </div>
      )}
    </Page>
  )
}
