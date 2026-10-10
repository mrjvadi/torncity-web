// The way between places, drawn from the neutral views (docs/adr/0039-presentation-split.md): the map of
// the player's own place (a village's own buildings, or a city's places), the cities a journey goes to, the
// choice and price of a journey, its start and its arrival, a walk, and «not here» with the walk to the
// right place. Words are the web's own; content names come from the catalogue.

import { useMemo } from 'react'
import type {
  CityMapView, MapView, NotHereView, TravelArrivedView, TravelCheckoutView, TravelHereView, TravelOptionsView, TravelStartedView, TravelStatusView, WalkStartedView,
} from '../../api/views.gen'
import { Empty, ListRow, SectionTitle } from '../native/kit/Parts'
import { hms, money, roughDuration } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import { atText, thereText } from '../../lib/duration'
import Popup, { ActionButton, ActionRow, Note, StatCard, StatGrid } from '../../ui/Popup'
import { t } from '../../i18n'
import { useSession } from '../../state/SessionContext'
import { homeScreen } from '../../support/location'
import { useVillage } from '../../village/useVillage'
import { iconForRole } from '../village/common'
import { Btns, Facts, Hint, Lead, Page, Panel, flow, isBack, isRefresh } from '../village/flow'
import { bps, cityName, clockText, nameOf, tx } from './common'
import { CardGrid } from '../../ui/v6/panel'

/** The name of a city place by its code. */
const tx2 = (ctx: Parameters<Parameters<typeof flow>[0]>[0]['ctx'], code?: string): string => (code ? ctx.names.name('place', code, code) : '')

const MODE_ICON: Record<string, string> = { bus: 'bus', car: 'x_car', train: 'train', flight: 'plane', bicycle: 'x_car', walk: 'walk', cart: 'cart', ship: 'x_car' }

// -- the map of where the player is ---------------------------------------------------------------

/** What a city place holds, as a line: its services, the transport that leaves from it, its shops. */
function PlaceRow({ l, ctx, walking }: { l: NonNullable<CityMapView['places']>[number]; ctx: Parameters<Parameters<typeof flow>[0]>[0]['ctx']; walking: boolean }) {
  const what = [
    ...(l.services ?? []).map((s) => tx(`lf.service.${s}`)),
    ...((l.departures ?? []).length ? [t('lf.map.departures', { modes: (l.departures ?? []).map((m) => ctx.names.name('mode', m, m)).join(' و ') })] : []),
    ...(l.shops ?? []).map((s) => ctx.names.name('shop', s.code, s.name)),
  ].join('، ')
  const go = ctx.acts.find((a) => a.id === 'walk' && a.subject === l.place.code)
  return (
    <ListRow
      icon="x_map" palette={l.here ? 'gold' : 'teal'} tone={l.here ? 'gold' : undefined}
      title={nameOf(ctx, 'place', l.place)}
      sub={[l.here && !walking ? t('lf.map.you_here') : t('lf.map.walk', { t: hms(l.walk_seconds) }), what].filter(Boolean).join(' – ')}
      onClick={go && !walking ? () => ctx.go(go) : undefined}
    />
  )
}

/** The village's own places: its buildings, from the village layout, standing ones first. */
function VillagePlaces({ ctx, id }: { ctx: Parameters<Parameters<typeof flow>[0]>[0]['ctx']; id: string | undefined }) {
  const { layout } = useVillage(id)
  const rows = useMemo(() => {
    const seen = new Set<string>()
    const list = (layout?.buildings ?? []).filter((b) => b.type !== 'road' && b.state !== 'ruin').filter((b) => {
      const k = b.id ?? `${b.type}@${b.x},${b.y}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    const stand = list.filter((b) => b.state === 'built' || b.state === 'damaged')
    const going = list.filter((b) => b.state === 'planned' || b.state === 'under_construction')
    return { stand, going }
  }, [layout])
  if (!layout) return <Empty>{t('common.load_failed')}</Empty>
  if (!rows.stand.length && !rows.going.length) return <Empty>{t('lf.map.village_empty')}</Empty>
  const row = (b: (typeof rows.stand)[number], i: number) => {
    const role = ctx.cat.get(b.type)?.category
    const { icon, palette } = iconForRole(role)
    return (
      <ListRow
        key={b.id ?? `${b.type}-${i}`} icon={icon} palette={palette}
        title={ctx.bname(b.type)}
        sub={b.state === 'planned' || b.state === 'under_construction' ? t('lf.map.going_up') : b.private ? (b.mine ? t('lf.map.mine') : b.owner ?? '') : undefined}
        onClick={b.id ? () => ctx.run('settlement.building.view', { building_id: b.id! }) : undefined}
      />
    )
  }
  return (
    <>
      {rows.stand.length > 0 && <><SectionTitle>{t('lf.map.village_standing')}</SectionTitle><CardGrid>{rows.stand.map(row)}</CardGrid></>}
      {rows.going.length > 0 && <><SectionTitle>{t('lf.map.village_going')}</SectionTitle><CardGrid>{rows.going.map(row)}</CardGrid></>}
    </>
  )
}

export const CityMap = flow<CityMapView>(({ view: v, ctx }) => {
  const { bootstrap } = useSession()
  const home = homeScreen(bootstrap)
  // in a village the map is the village's own places (docs/ui/web-structure.md D-P4), never a big city's
  const inVillage = !v.travelling && !v.no_city && (home.local === 'village_home' || home.local === 'village_visit')
  const villageId = home.local === 'village_visit' ? home.args?.id : bootstrap?.settlement?.id
  const places = v.places ?? []
  const walking = !!v.walking
  const journey = ctx.by('map.journey')
  return (
    <Page title={t('screen.city_map')} tone="teal">
      {v.travelling && (
        <Panel tone="sapphire">
          <Lead>{t('lf.map.travelling', { city: cityName(ctx, v.travelling_to_code, v.travelling_to) })}</Lead>
          <Btns ctx={ctx} list={journey} />
        </Panel>
      )}
      {v.no_city && <Panel><Lead>{t('lf.map.no_city')}</Lead></Panel>}
      {!v.travelling && !v.no_city && (
        <>
          <Panel tone="teal">
            <Lead>{inVillage ? t('lf.map.village_title') : t('lf.map.city_title', { city: cityName(ctx, v.city_code, v.city) })}</Lead>
            {!inVillage && v.walking && <Hint>{t('lf.map.walking', { place: nameOf(ctx, 'place', v.walking.to), t: hms(v.walking.remaining_seconds), at: clockText(v.walking.arrives_at) })}</Hint>}
            {!inVillage && !v.walking && v.here.code && <Hint>{t('lf.map.here', { place: nameOf(ctx, 'place', v.here) })}{v.others > 0 ? ` – ${t('lf.map.others', { n: formatNumber(v.others) })}` : ''}</Hint>}
          </Panel>
          {inVillage
            ? <VillagePlaces ctx={ctx} id={villageId} />
            : places.length
              ? <CardGrid>{places.map((l) => <PlaceRow key={l.place.code} l={l} ctx={ctx} walking={walking} />)}</CardGrid>
              : <Empty>{t('lf.map.no_places')}</Empty>}
          {!inVillage && [...ctx.by('shops.here'), ...ctx.by('shops.at')].map((a) => (
            <ListRow key={`${a.id}-${a.subject}`} icon="cart" palette="amber" title={t('lf.map.shops_at', { place: tx2(ctx, a.subject) })} onClick={() => ctx.go(a)} />
          ))}
          {!inVillage && <Btns ctx={ctx} list={[...ctx.by('map.cities'), ...ctx.by('city.gov')]} />}
        </>
      )}
    </Page>
  )
})

// -- the cities a journey goes to --------------------------------------------------------------------

export const Cities = flow<MapView>(({ view: v, ctx }) => {
  const dests = v.destinations ?? []
  const prev = ctx.by('page.prev')[0]
  const next = ctx.by('page.next')[0]
  return (
    <Page title={t('screen.cities')} tone="teal">
      {v.travelling && (
        <Panel tone="sapphire">
          <Lead>{t('lf.map.travelling', { city: cityName(ctx, v.travelling_to_code, v.travelling_to) })}</Lead>
          <Btns ctx={ctx} list={ctx.by('map.journey')} />
        </Panel>
      )}
      {!v.travelling && !v.origin_code && !v.origin && <Panel><Lead>{t('lf.map.no_city')}</Lead></Panel>}
      {!v.travelling && (v.origin_code || v.origin) && (
        <>
          <Panel tone="teal"><Lead>{t('lf.cities.origin', { city: cityName(ctx, v.origin_code, v.origin) })}</Lead></Panel>
          {dests.length === 0 && <Empty>{t('lf.cities.none')}</Empty>}
          <CardGrid>
            {dests.map((d) => {
              const go = ctx.acts.find((a) => a.id === 'travel.to' && a.subject === d.code)
              return (
                <ListRow
                  key={d.code} icon={d.village ? 'house' : 'city'} palette={d.village ? 'emerald' : 'gold'}
                  title={cityName(ctx, d.code, d.name)}
                  sub={[t('sc.dest.km', { n: formatNumber(d.distance_km) }), d.wait_seconds > 0 ? roughDuration(d.wait_seconds) : ''].filter(Boolean).join(' – ')}
                  right={d.wait_seconds > 0 ? (d.fare > 0 ? money(d.fare) : t('common.free')) : undefined}
                  onClick={go ? () => ctx.go(go) : undefined}
                />
              )
            })}
          </CardGrid>
          {(prev || next) && (
            <div className="vf-btns row">
              {prev && <Btns ctx={ctx} list={[prev]} row />}
              {next && <Btns ctx={ctx} list={[next]} row />}
            </div>
          )}
          {v.pages > 1 && <Hint>{t('lf.page', { page: formatNumber(v.page), pages: formatNumber(v.pages) })}</Hint>}
        </>
      )}
    </Page>
  )
})

// -- the choice of transport --------------------------------------------------------------------------------------

export const TravelOptions = flow<TravelOptionsView>(({ view: v, ctx }) => {
  const options = v.options ?? []
  return (
    <Page title={t('travel.to', { city: cityName(ctx, v.to_code, v.to) })} tone="teal">
      {v.requoted && <Hint tone="bad">{t('lf.options.requoted')}</Hint>}
      <Panel tone="teal">
        <Lead>{t('lf.options.lead', { from: cityName(ctx, v.from_code, v.from), to: cityName(ctx, v.to_code, v.to) })}</Lead>
      </Panel>
      {options.length === 0 && <Empty>{t('lf.options.none')}</Empty>}
      <CardGrid>
        {options.map((o) => {
          const go = ctx.acts.find((a) => a.id === 'travel.go' && a.subject === o.mode_code)
          const own = o.vehicle ? nameOf(ctx, 'item', o.vehicle) : ''
          return (
            <ListRow
              key={o.mode_code} icon={MODE_ICON[o.mode_code] ?? 'plane'} palette="teal"
              title={own || ctx.names.name('mode', o.mode_code, o.mode_name)}
              sub={[roughDuration(o.wait_seconds), o.wait_seconds >= 3600 ? t('sc.confirm.arrive_at', { at: atText(Date.now() + o.wait_seconds * 1000) }) : '', t('lf.options.energy', { n: formatNumber(o.energy) }), o.busy ? t('travel.busy') : '', o.vehicle ? t('lf.options.condition', { n: bps(o.condition) }) : ''].filter(Boolean).join(' – ')}
              right={o.fare > 0 ? (o.vehicle ? t('lf.options.fuel', { n: money(o.fare) }) : money(o.fare)) : t('common.free')}
              onClick={go ? () => ctx.go(go) : undefined}
            />
          )
        })}
      </CardGrid>
      {(v.licence ?? []).map((l) => {
        const mode = ctx.names.name('mode', l.mode_code, l.mode_code)
        const course = ctx.names.name('course', l.course.code, l.course.name)
        return (
          <Panel key={l.mode_code} tone="gold">
            <Hint>{l.until ? t('lf.options.licence_soon', { mode, course, at: atText(l.until) }) : t('lf.options.licence_out', { mode, course })}</Hint>
            <ActionButton tone="steel" small onClick={() => ctx.run('education.list')}>{t('lf.options.licence_go')}</ActionButton>
          </Panel>
        )
      })}
      <Hint>{t('lf.options.cash', { cash: money(v.cash) })}</Hint>
    </Page>
  )
})

// -- the price of a journey: a popup with what it costs and the ways to pay -------------------------------

export const TravelCheckout = flow<TravelCheckoutView>(({ view: v, ctx }) => {
  const to = cityName(ctx, v.to_code, v.to)
  const from = cityName(ctx, v.from_code, v.from)
  const mode = ctx.names.name('mode', v.mode_code, v.mode_name)
  const pays = ctx.acts.filter((a) => a.id?.startsWith('pay.'))
  const back = ctx.acts.find(isBack)
  const afford = (v.payment.usable ?? []).length > 0
  return (
    <Page title={t('travel.title')} tone="teal">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="navy" dismissible={!ctx.busy}
        title={t('lf.checkout.title', { to })}
        footer={(
          <>
            <ActionRow>
              {pays.map((a) => (
                <ActionButton key={a.id} tone="gold" busy={ctx.busy} onClick={() => ctx.go(a)}>{tx(`lf.pay.${a.id!.slice(4)}`)}</ActionButton>
              ))}
            </ActionRow>
            {!afford && ctx.by('bank')[0] && <ActionButton tone="steel" small onClick={() => ctx.go(ctx.by('bank')[0])}>{t('lf.checkout.bank')}</ActionButton>}
            {ctx.by('travel.options')[0] && <ActionButton tone="steel" small onClick={() => ctx.go(ctx.by('travel.options')[0])}>{t('lf.checkout.other_mode')}</ActionButton>}
          </>
        )}
      >
        <StatGrid>
          <StatCard icon={MODE_ICON[v.mode_code] ?? 'plane'} palette="teal" label={t('lf.checkout.by')} value={mode} />
          <StatCard icon="coins" palette="gold" label={t('lf.fare')} value={v.fare > 0 ? money(v.fare) : t('common.free')} />
          <StatCard icon="stopwatch" palette="amber" label={t('lf.time')} value={roughDuration(v.wait_seconds)} />
          {v.wait_seconds > 0 && <StatCard icon="clock" palette="emerald" label={t('sc.confirm.arrive')} value={atText(Date.now() + v.wait_seconds * 1000)} />}
          <StatCard icon="energy" palette="emerald" label={t('lf.energy')} value={formatNumber(v.energy)} />
        </StatGrid>
        <Note>{t('lf.checkout.route', { from, to })}{v.busy ? ` – ${t('lf.checkout.busy')}` : ''}</Note>
        {afford
          ? <Note>{t('lf.pay.balances', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>
          : <Note tone="bad">{t('lf.pay.cannot', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>}
      </Popup>
    </Page>
  )
})

// -- a journey begun, under way, ended -------------------------------------------------------------------

export const TravelStarted = flow<TravelStartedView>(({ view: v, ctx }) => {
  const journey = ctx.acts.find(isRefresh)
  return (
    <Page title={t('travel.on_way')} tone="teal">
      <Panel tone="emerald">
        <Lead tone="good">{t('lf.started.lead', { to: cityName(ctx, v.to_code, v.to), mode: ctx.names.name('mode', v.mode_code, v.mode_name) })}</Lead>
        <Facts rows={[
          { label: t('lf.checkout.route_label'), value: `${cityName(ctx, v.from_code, v.from)} ← ${cityName(ctx, v.to_code, v.to)}` },
          { label: t('lf.time'), value: roughDuration(v.duration_seconds) },
          ...(v.arrives_at ? [{ label: t('lf.arrives_at'), value: clockText(v.arrives_at) }] : []),
          ...(thereText(v.arrives_at, v.zone_minutes) ? [{ label: t('lf.arrives_there'), value: thereText(v.arrives_at, v.zone_minutes) }] : []),
          { label: t('lf.energy'), value: formatNumber(v.energy) },
          ...(v.fare > 0 ? [{ label: t('lf.fare'), value: money(v.fare), gold: true }] : []),
        ]} />
      </Panel>
      {journey && <Btns ctx={ctx} list={[{ ...journey, id: 'journey' }]} />}
    </Page>
  )
})

export const TravelStatus = flow<TravelStatusView>(({ view: v, ctx }) => (
  <Page title={t('travel.on_way')} tone="teal">
    <Panel tone="sapphire">
      <Lead>{t('lf.status.lead', { from: cityName(ctx, v.from_code, v.from), to: cityName(ctx, v.to_code, v.to) })}</Lead>
      <div className="display" style={{ fontSize: 34, textAlign: 'center', color: 'var(--firouzeh)' }}>{v.remaining_seconds >= 60 ? hms(v.remaining_seconds) : t('lf.status.arriving')}</div>
      <Facts rows={[
        ...(v.mode_code || v.mode_name ? [{ label: t('lf.checkout.by'), value: ctx.names.name('mode', v.mode_code, v.mode_name) }] : []),
        ...(v.remaining_seconds >= 60 && v.arrives_at ? [{ label: t('lf.arrives_at'), value: clockText(v.arrives_at) }] : []),
        ...(v.remaining_seconds >= 60 && thereText(v.arrives_at, v.zone_minutes) ? [{ label: t('lf.arrives_there'), value: thereText(v.arrives_at, v.zone_minutes) }] : []),
      ]} />
      <Hint>{t('sc.journey.rules')}</Hint>
    </Panel>
  </Page>
))

export const TravelArrived = flow<TravelArrivedView>(({ view: v, ctx }) => (
  <Page title={t('lf.arrived.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('lf.arrived.lead', { city: cityName(ctx, v.city_code, v.city) })}</Lead>
      {v.xp > 0 && <Hint tone="good">{t('lf.arrived.xp', { n: formatNumber(v.xp) })}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a))} />
  </Page>
))

export const TravelHere = flow<TravelHereView>(({ view: v, ctx }) => (
  <Page title={t('travel.title')} tone="teal">
    <Panel>
      <Lead>{tx(`lf.here.${v.reason || 'no_village'}`, { village: v.village })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a))} />
  </Page>
))

// -- a walk, and a request made at the wrong place --------------------------------------------------------

export const WalkStarted = flow<WalkStartedView>(({ view: v, ctx }) => (
  <Page title={t('lf.walk.title')} tone="teal">
    <Panel tone="emerald">
      <Lead tone="good">{t('lf.walk.lead', { place: nameOf(ctx, 'place', v.to) })}</Lead>
      <Facts rows={[
        { label: t('lf.time'), value: hms(v.duration_seconds) },
        ...(v.arrives_at ? [{ label: t('lf.arrives_at'), value: clockText(v.arrives_at) }] : []),
        ...(v.energy > 0 ? [{ label: t('lf.energy'), value: formatNumber(v.energy) }] : []),
      ]} />
      {v.then && <Hint>{tx(`lf.walk.then.${v.then}`)}</Hint>}
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a))} />
  </Page>
))

export const NotHere = flow<NotHereView>(({ view: v, ctx }) => {
  const place = nameOf(ctx, 'place', v.place)
  const args = {
    place, here: nameOf(ctx, 'place', v.here), mode: ctx.names.name('mode', v.mode, v.mode),
    crime: nameOf(ctx, 'crime', v.crime), shop: nameOf(ctx, 'shop', v.shop), board: String((v.need_args as { board?: unknown } | null)?.board ?? ''),
    walk: hms(v.walk_seconds),
  }
  return (
    <Page title={t('lf.nothere.title')} tone="sapphire">
      <Panel tone="sapphire">
        {v.walking
          ? <><Lead>{t('lf.nothere.walking', { place, t: hms(v.remaining_seconds) })}</Lead>{v.arrives_at && <Hint>{t('lf.arrives_at')}: {clockText(v.arrives_at)}</Hint>}</>
          : (
            <>
              <Lead>{tx(`lf.need.${v.need}`, args)}</Lead>
              {v.here.code && <Hint>{t('lf.nothere.you_at', { place: args.here })}</Hint>}
              {v.then && <Hint>{t('lf.nothere.then_hint', { place, walk: args.walk })}</Hint>}
            </>
          )}
      </Panel>
      <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a)).map((a) => (a.id === 'walk' ? { ...a, kind: 'primary' } : a))} />
    </Page>
  )
})

export const TRAVEL_SCREENS = {
  city_map: CityMap, cities: Cities, travel_options: TravelOptions, travel_checkout: TravelCheckout, travel_started: TravelStarted, travel_status: TravelStatus,
  travel_arrived: TravelArrived, travel_here: TravelHere, walk_started: WalkStarted, not_here: NotHere,
}

