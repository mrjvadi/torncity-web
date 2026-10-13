// «شهر»: the player's town as a whole, opened from the city tag over the game view and from the dock's long press.
// The town's hero (its name; residents, buildings and knowledge as three figures), what is going up and being
// researched now, the service buildings it has, then the town's affairs in four groups as big tiles. The figures are
// the development readout's (`settlement.development.view`); what runs now is the village layout's sites and the
// settlement's research from the state-sync store. Which affairs a viewer sees is cityItemsFor's rule (server flags).

import { useState } from 'react'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Chip, Empty, Hero, Icon, Loading, Note, Now, Page, Row, List, Section, Segmented, Strip, Tile, Tiles } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { entitiesOf, entityOf } from '../../../state/store'
import { useStoreView } from '../../../state/useSync'
import { buildingName, useBuildingCatalogue, useContentNames, useNow, useSettlementId, useVillage } from '../../../village/useVillage'
import { constructionProgress } from '../../../village/progress'
import { useCan } from '../../../lib/permissions'
import { cityItemsFor, CITY_GROUPS, type CityGroup, type CityItem } from '../../../screens/village/cityItems'
import type { DevelopmentView } from '../../../api/views.gen'
import { fa, waitText } from '../../../ui/v6/format'
import { formatNumber } from '../../../screens/native/kit/format'
import { words } from '../../../lib/duration'
import { t } from '../../../i18n'
import { ITEM_ICON, roleIcon, roleName, useCommand } from './shared'
import './city.css'

/** The settlement entity of the player's own town in the state-sync store (its research runs there). */
function useResearch(): { code: string; finish_at: string } | null {
  const view = useStoreView()
  const mine = entityOf(view, 'residence', 'self')?.settlement
  const st = (mine ? entityOf(view, 'settlement', mine) : undefined) ?? entitiesOf(view, 'settlement').find(([, d]) => d.viewer !== 'public')?.[1]
  return st?.research ?? null
}

export default function CityPanel(_: NScreenProps) {
  const nav = useNav()
  const can = useCan()
  const names = useContentNames()
  const cat = useBuildingCatalogue()
  const now = useNow(1000)
  const { bootstrap } = useSession()
  const s = bootstrap?.settlement
  const id = useSettlementId()
  const { layout } = useVillage(id)
  const { res, loading } = useCommand('settlement.development.view')
  const v = res?.ok !== false ? (res?.view as DevelopmentView | undefined) : undefined
  const research = useResearch()
  const items = cityItemsFor(s ?? {}).filter((it) => it.key !== 'status')
  const groups = CITY_GROUPS.filter((g) => items.some((it) => it.group === g.key))
  const [group, setGroup] = useState<CityGroup>('town')
  const on = groups.some((g) => g.key === group) ? group : groups[0]?.key

  if (!s && !id) return <Page title={t('city.title')}><Empty icon="city">{t('next.no_city')}</Empty></Page>

  const name = v?.village || layout?.settlement.name || s?.name || t('city.title')
  const dim = (code: string) => (v?.dimensions ?? []).find((d) => d.code === code)
  const people = dim('people'), blds = dim('buildings'), know = dim('knowledge')
  const over = !!people && people.capacity > 0 && people.load > people.capacity
  const strip = [
    people && { label: t('city.dim.people'), value: people.capacity > 0 ? t('city.dim.of', { load: formatNumber(people.load), cap: formatNumber(people.capacity) }) : formatNumber(people.load) },
    blds && { label: t('city.dim.buildings'), value: formatNumber(blds.load) },
    know && { label: t('city.dim.knowledge'), value: formatNumber(know.load) },
  ].filter(Boolean) as { label: string; value: string }[]

  // what is going up now: the layout's sites with a finish time still ahead
  const sites = (layout?.buildings ?? []).filter((b) => b.id && b.state === 'under_construction' && b.finish_at && Date.parse(b.finish_at) > now)
    .sort((a, b) => Date.parse(a.finish_at!) - Date.parse(b.finish_at!))
  const resLeft = research?.finish_at ? (Date.parse(research.finish_at) - now) / 1000 : 0
  const roles = v?.roles ?? []
  const next = v?.next ?? []
  const role = s?.is_head ? t('village.head') : s?.resident ? t('village.member') : t('village.visitor')

  const openItem = (it: CityItem) => (it.command ? nav.run(it.command, it.args) : it.local ? nav.open(it.local, it.args) : undefined)

  return (
    <Page title={t('city.title')} sub={t('next.city_work')}>
      <Hero art="city">
        <p className="n-label">{role}</p>
        <p className="n-big">{name}</p>
      </Hero>
      {strip.length > 0 ? <Strip items={strip} /> : loading && <Loading blocks={[64]} />}
      {over && <Note tone="bad" icon="x_wanted">{t('city.dim.over')}</Note>}

      <Section title={t('next.now')} />
      {sites.length === 0 && resLeft <= 0 && <Note tone="info" icon="clock">{t('n.city.now_none')}</Note>}
      {sites.map((b, i) => {
        const frac = constructionProgress(b, now)
        const left = (Date.parse(b.finish_at!) - now) / 1000
        return (
          <Now key={b.id} icon={roleIcon(cat.get(b.type)?.category)} lit={i === 0} frac={frac} time={`${fa(Math.round(frac * 100))}٪`}
            title={buildingName(cat, b.type)} sub={`${t('building.state.under_construction')} – ${t('common.left', { t: fa(words(left)) })}`}
            onClick={() => nav.run('settlement.building.view', { building_id: b.id! })} />
        )
      })}
      {research && resLeft > 0 && (
        <Now icon="study" lit={sites.length === 0} time={waitText(resLeft, t('v6.day'))} title={names.name('knowledge', research.code)} sub={t('v6.ev.research')}
          onClick={() => nav.run('settlement.knowledge')} />
      )}

      {next.length > 0 && (
        <>
          <Section title={t('city.next.title')} />
          <List>
            {next.map((c) => {
              const isResearch = c.kind === 'research'
              const what = isResearch ? names.name('knowledge', c.code, c.name) : names.name('settlement_building', c.code, c.name)
              // only the holder of the permission gets the door (P28); others read the suggestion
              const ok = isResearch ? can('research.start') : can('public.build')
              return (
                <Row key={`${c.kind}:${c.code}`} icon={isResearch ? 'study' : 'factory'} title={what} sub={t(isResearch ? 'city.next.research' : 'city.next.build')}
                  onClick={ok ? () => nav.run(isResearch ? 'settlement.knowledge' : 'settlement.build') : undefined} />
              )
            })}
          </List>
        </>
      )}

      <Section title={t('city.roles')} />
      {loading && !v ? <Loading blocks={[40]} /> : roles.length === 0 ? <p className="n-city-quiet">{t('n.city.roles_none')}</p> : (
        <div className="n-chips">
          {roles.map((r) => (
            <Chip key={r.role}><Icon name={roleIcon(r.role)} size={20} />{t('city.role.level', { role: roleName(r.role), n: r.level })}</Chip>
          ))}
        </div>
      )}

      {groups.length > 0 && on && (
        <>
          <Section title={t('city.affairs')} />
          <div className="n-city-seg"><Segmented items={groups.map((g) => ({ key: g.key, label: t(g.label) }))} value={on} onChange={setGroup} /></div>
          <Tiles>
            {items.filter((it) => it.group === on).map((it) => (
              <Tile key={it.key} icon={ITEM_ICON[it.key] ?? 'eye'} title={t(it.label)} tone={it.key === 'leave' ? 'bad' : undefined} onClick={() => openItem(it)} />
            ))}
          </Tiles>
        </>
      )}
    </Page>
  )
}
