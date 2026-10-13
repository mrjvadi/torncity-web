// Health and training in the new UI: the health home (rest, sleep, the places of care), the hospital and its
// treatments, the answer of a treatment, the training ground and a finished session.

import type { NScreenProps } from '../../registry'
import type { HealthHomeView, HospitalView, TrainedView, TrainingHomeView, TreatConfirmView, TreatedView, TreatOption } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Card, Chip, Empty, Icon, KV, List, Meter, Note, Now, Row, Rows, Section, Tile, Tiles } from '../../ui'
import { t } from '../../../i18n'
import { hms, roughDuration } from '../../../screens/native/kit/format'
import { atText } from '../../../lib/duration'
import { careOf, careWord, useCare } from '../../../support/care'
import { buildingName, useBuildingCatalogue } from '../../../village/useVillage'
import { useSession } from '../../../state/SessionContext'
import { ActPage, cash, plus, MoreActs, NoView, PayBox, ResultHero, ThingHero, cityName, idOf, n, tk, useActs } from './common'

/** Who treats: the city's hospital (worded by the care the place has), a clinic by its name, the town's health house. */
function providerName(o: TreatOption, care: ReturnType<typeof careWord>): string {
  switch (o.provider) {
    case 'city': return t(({ hospital: 'ac.health.city_hospital', house: 'ac.health.health_house', plain: 'ac.health.care_plain' } as const)[care])
    case 'health_house': return t('ac.health.health_house')
    case 'village_clinic': return t('hc.clinic')
    default: return o.clinic?.name ? t('ac.health.clinic_name', { name: o.clinic.name }) : t('hc.clinic')
  }
}
const providerIcon = (o: TreatOption) => (o.provider === 'city' ? 'hospital' : o.provider === 'health_house' ? 'health' : 'stetho')
const causeText = (c: string) => tk(`hospital.cause.${c}`, c)

// -- the hospital ----------------------------------------------------------------------------------------------

export function Hospital({ response, loading }: NScreenProps) {
  const nav = useNav()
  const { bootstrap } = useSession()
  const care = careWord(useCare())
  const acts = useActs(response)
  const v = response?.view as HospitalView | undefined
  if (!v) return <NoView title={t('hospital.title')} loading={loading} />
  const { names } = acts
  // «بیمارستان» only where there is one; a founded town's place of care is its health house
  const title = v.founded ? t('ac.health.village_title') : t('hospital.title')
  const canBuild = !!bootstrap?.settlement?.permissions?.includes('public.build')
  const treatFor = (code: string) => acts.find('health.treat', (a) => a.args?.provider === code)
  const frac = v.max ? v.health / v.max : 1
  const village = v.village ?? []
  const clinics = v.clinics ?? []

  const option = (o: TreatOption, code: string) => {
    const a = treatFor(code)
    const med = o.medicine ? names.name(['component', 'item'], o.medicine, o.medicine) : ''
    const sub = o.open
      ? [o.doctor ? t('hospital.doctor', { n: n(o.doctor) }) : '', o.saves_seconds ? t('hospital.saves', { t: roughDuration(o.saves_seconds) }) : '', med ? t('hc.uses', { name: med }) : ''].filter(Boolean).join(' – ')
      : tk(`hc.idle.${o.idle}`, t('hospital.closed'))
    return (
      <Row key={code} icon={providerIcon(o)} title={providerName(o, care)} sub={sub || undefined}
        end={o.open ? <Chip tone={a ? 'accent' : undefined}>{o.price ? cash(o.price) : t('common.free')}</Chip> : <Chip tone="bad">{t('hospital.closed')}</Chip>}
        onClick={a ? () => nav.act(a) : undefined} />
    )
  }

  return (
    <ActPage title={title} sub={cityName(names, v.city_code, v.city) || undefined} response={response}>
      <div className={`n-act-result ${v.in_hospital ? 'loss' : 'plain'}`}>
        <span className="n-act-result-glow" aria-hidden="true" />
        <Icon name={v.in_hospital ? 'x_hosp' : 'health'} className="n-act-result-art" />
        {v.in_hospital && v.cause && <p className="n-act-result-kicker"><Chip tone="bad">{causeText(v.cause)}</Chip></p>}
        <p className="n-act-result-big">{v.in_hospital ? hms(v.remaining_seconds) : t('hospital.health', { a: n(v.health), b: n(v.max) })}</p>
        <p className="n-act-result-sub">{v.in_hospital ? (v.ends_at ? `${t('ac.health.ends_at')} ${atText(v.ends_at)}` : t('n.act.health.until_out')) : v.full_in_seconds ? t('hospital.full_in', { t: hms(v.full_in_seconds) }) : t('n.act.health.full')}</p>
        {v.in_hospital && <div className="n-act-result-meter"><Meter thick tone={v.in_hospital ? 'bad' : undefined} frac={frac} label={t('ac.work.injury.health')} value={t('ac.work.of', { a: n(v.health), b: n(v.max) })} /></div>}
      </div>

      {!v.in_hospital && !clinics.length && !v.founded && <Note tone="info" icon="health">{t('ac.health.out_hint')}</Note>}
      {v.treated && <Note tone="ok" icon="m_check">{t('hospital.treated')}{v.treated_by?.provider ? ` – ${providerName(v.treated_by, care)}` : ''}</Note>}

      {v.city_hospital && (
        <>
          <Section title={t('ac.health.treat_title')} />
          <List>{option(v.city_hospital, 'city')}</List>
        </>
      )}

      {village.length > 0 && (
        <>
          <Section title={t('hc.offers')} />
          <List>{village.map((o) => option(o, o.provider))}</List>
        </>
      )}

      {v.care && (() => {
        const c = v.care
        const lines = [
          c.house && !c.house.present ? t(canBuild ? 'hc.build_house_head' : 'hc.build_house', { name: c.house.building?.name || t('ac.health.health_house') }) : '',
          c.clinic && !c.clinic.present ? t(canBuild ? 'hc.build_clinic_head' : 'hc.build_clinic', { name: c.clinic.building?.name || t('hc.clinic') }) : '',
          c.no_medicine ? t('hc.no_medicine', { name: c.apothecary?.name || t('hc.apothecary') }) : '',
        ].filter(Boolean)
        return (
          <>
            {(lines.length > 0 || !village.length) && <Section title={village.length ? t('hc.missing') : t('hc.none_title')} />}
            {!village.length && <Note icon="x_hosp">{t('hc.none_lead')}</Note>}
            {lines.length > 0 && <List>{lines.map((l, i) => <Row key={i} icon="m_lock" title={l} />)}</List>}
            {canBuild && lines.length > 0 && <Button kind="ghost" block icon="x_lift" onClick={() => nav.open('game', { build: '1' })}>{t('hc.go_build')}</Button>}
            {c.refer?.name && <List><Row icon="bus" title={t('hc.refer', { name: c.refer.name })} end={<Button kind="ghost" small onClick={() => nav.run('travel.destinations')}>{t('n.act.go')}</Button>} /></List>}
          </>
        )
      })()}

      {clinics.length > 0 && (
        <>
          <Section title={t('hospital.clinics')} note={n(clinics.length)} />
          <List>{clinics.map((o) => option(o, o.clinic.code))}</List>
        </>
      )}
      <MoreActs acts={acts} list={acts.rest(['health.treat'])} />
    </ActPage>
  )
}

// -- a treatment -----------------------------------------------------------------------------------------------

export function TreatConfirm({ response, loading }: NScreenProps) {
  const nav = useNav()
  const care = careWord(useCare())
  const acts = useActs(response)
  const v = response?.view as TreatConfirmView | undefined
  if (!v) return <NoView title={t('ac.health.treat_title')} loading={loading} />
  const who = providerName(v.option, care)
  const free = acts.find('health.confirm_free')
  return (
    <ActPage title={t('ac.health.confirm_title', { who })} response={response}>
      <ThingHero art={providerIcon(v.option)} kicker={t('ac.health.treat_title')} title={who}
        chips={<>
          {v.option.saves_seconds > 0 && <Chip tone="ok"><Icon name="stopwatch" size={18} />{t('hospital.saves', { t: roughDuration(v.option.saves_seconds) })}</Chip>}
          {v.option.doctor > 0 && <Chip>{t('hospital.doctor', { n: n(v.option.doctor) })}</Chip>}
        </>} />
      <div className="n-rows">
        <KV label={t('ac.health.remaining')} value={hms(v.remaining_seconds)} />
        {v.ends_at && <KV label={t('ac.health.ends_at')} value={atText(v.ends_at)} />}
      </div>
      {v.ends_at && <Note tone="info" icon="clock">{t('ac.health.new_end', { at: atText(v.ends_at) })}</Note>}
      {v.payment && <PayBox payment={v.payment} acts={acts} title={t('ac.health.price')} />}
      {!v.payment && free && <Button block icon="health" onClick={() => nav.act(free)}>{t('ac.health.confirm_free')}</Button>}
      <MoreActs acts={acts} list={acts.rest(['health.confirm_free', 'bank'], (a) => idOf(a).startsWith('pay.'))} />
    </ActPage>
  )
}

export function Treated({ response, loading }: NScreenProps) {
  const care = careWord(useCare())
  const acts = useActs(response)
  const v = response?.view as TreatedView | undefined
  if (!v) return <NoView title={t('ac.health.treated_title')} loading={loading} />
  const who = providerName(v.option, care)
  return (
    <ActPage title={t('ac.health.treated_title')} response={response}>
      <ResultHero art="stetho" kicker={t('ac.health.treated_title')} big={t('hospital.saves', { t: roughDuration(v.saved_seconds) })}
        sub={t('ac.health.treated_lead', { who, saved: roughDuration(v.saved_seconds) })}
        chips={<>
          <Chip tone="accent"><Icon name="coins" size={18} />{v.paid > 0 ? cash(v.paid) : t('common.free')}</Chip>
          {v.method && v.method !== 'free' && <Chip>{tk(`ac.work.method.${v.method}`, v.method)}</Chip>}
        </>} />
      <div className="n-rows">
        {v.remaining_seconds > 0
          ? <KV label={t('ac.health.remaining')} value={hms(v.remaining_seconds)} />
          : <KV label={t('ac.health.remaining')} value={t('ac.health.none_left')} />}
        {v.ends_at && v.remaining_seconds > 0 && <KV label={t('ac.health.ends_at')} value={atText(v.ends_at)} />}
      </div>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

// -- the health home -------------------------------------------------------------------------------------------

export function HealthHome({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const acts = useActs(response)
  const v = response?.view as HealthHomeView | undefined
  if (!v) return <NoView title={t('hub.health')} loading={loading} />
  const { names } = acts
  const isCity = careOf(v) === 'hospital'
  const refer = v.refer ? cityName(names, v.refer.code, v.refer.name) : ''
  const facilities = v.facilities ?? []
  const rest = v.rest
  return (
    <ActPage title={isCity ? t('hub.hospital') : t('hub.health')} sub={v.place?.name} response={response}>
      {v.admitted && <Now icon="x_hosp" lit title={t('n.act.health.admitted')} sub={t('health.hospital_open')} time={hms(v.admitted.remaining_seconds)} onClick={() => nav.run('health.hospital')} />}

      <Tiles>
        <Tile icon="house" title={t('health.rest')} off={!rest.has}
          sub={!rest.has ? t('health.no_home') : !rest.can_rest ? t('health.rest_wait', { t: hms(rest.wait_seconds) }) : t('health.rest_home')}
          onClick={() => nav.run('settlement.home.rest')} />
        <Tile icon="bed" title={t('health.sleep')} sub={t('health.sleep_open')} onClick={() => nav.run('life.me')} />
        {!isCity && <Tile icon="soda" title={t('hub.survival')} sub={t('health.survival_sub')} onClick={() => nav.run('health.survival')} />}
        {(isCity || v.admitted) && <Tile icon="hospital" title={t('hub.hospital')} sub={t('health.hospital_open')} onClick={() => nav.run('health.hospital')} />}
      </Tiles>

      {(facilities.length > 0 || refer) && <Section title={t('health.care')} />}
      {facilities.length > 0 && (
        <List>{facilities.map((f, i) => <Row key={i} icon={f.kind === 'clinic' ? 'stetho' : 'health'} title={buildingName(cat, f.building.code, f.building.name)} sub={t('health.facility.sub')} />)}</List>
      )}
      {refer && v.refer && (
        <Rows><Row icon="bus" title={t('education.here_not')} sub={t('health.refer', { city: refer })}
          end={<Button kind="ghost" small onClick={() => nav.open('support_travel', { to: v.refer!.code, service: 'hospital' })}>{t('n.act.go')}</Button>} /></Rows>
      )}
      {v.empty && <Empty icon="health">{tk(`health.empty.${v.empty}`, v.empty)}</Empty>}
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

// -- training --------------------------------------------------------------------------------------------------

export function TrainingHome({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const acts = useActs(response)
  const v = response?.view as TrainingHomeView | undefined
  if (!v) return <NoView title={t('training.title')} loading={loading} />
  const venues = v.venues ?? []
  const best = venues.filter((x) => x.available).sort((a, b) => b.efficiency_bps - a.efficiency_bps)[0]
  const bonus = Math.max(0, v.stamina - 100)
  return (
    <ActPage title={t('training.title')} sub={v.place?.name} response={response}>
      <ThingHero art="x_muscle" kicker={t('training.strength')} title={t('common.level', { n: n(v.strength_level) })}
        chips={<>
          <Chip tone="cyan"><Icon name="x_sprint" size={18} />{t('training.stamina')} {n(v.stamina)}</Chip>
          <Chip tone="accent"><Icon name="energy" size={18} />{t('training.session_cost')}: {t('training.energy_n', { n: n(v.energy_cost) })}</Chip>
        </>} />

      <Section title={t('training.venues')} />
      <div className="n-act-cards">
        {venues.map((x) => (
          <Card key={x.code} tone={x === best ? 'lit' : undefined} className={x.available ? undefined : 'n-act-off'}>
            <div className="n-act-next">
              <Icon name={x.code === 'gym' ? 'x_lift' : x.code === 'ground' ? 'x_field' : 'x_sprint'} size={48} />
              <div>
                <p className="n-act-next-title">{tk(`training.venue.${x.code}`, x.code)}</p>
                <p className="n-label">{x.unkept ? t('training.unkept') : x.fee > 0 ? t('training.fee', { fee: cash(x.fee) }) : t('training.free')}</p>
              </div>
              <Chip tone={x === best ? 'accent' : 'cyan'}>{t('training.efficiency', { p: n(Math.round(x.efficiency_bps / 100)) })}</Chip>
            </div>
            {!x.available && x.missing && <p className="n-why n-act-start">{t('training.missing', { name: buildingName(cat, x.missing.code, x.missing.name) })}</p>}
            {x.available && <div className="n-act-gap"><Button block small={x !== best} kind={x === best ? 'primary' : 'ghost'} icon="x_muscle" onClick={() => nav.run('training.start', { venue: x.code })}>{t('training.start')}</Button></div>}
          </Card>
        ))}
      </div>
      {bonus > 0 && <Note tone="info" icon="energy">{t('training.bonus', { n: n(Math.min(v.max_energy_cap, Math.floor(bonus / 50))), cap: n(v.max_energy_cap) })}</Note>}
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export function Trained({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as TrainedView | undefined
  if (!v) return <NoView title={t('training.done_title')} loading={loading} />
  return (
    <ActPage title={t('training.done_title')} response={response}>
      <ResultHero art="x_biceps" kicker={tk(`training.venue.${v.venue}`, t('training.done_title'))} big={`${plus(n(v.stamina))} ${t('training.stamina')}`}
        chips={<>
          {v.strength_xp > 0 && <Chip tone="cyan">{t('training.strength')}: {t('training.xp', { n: n(v.strength_xp) })}</Chip>}
          {v.max_energy_added > 0 && <Chip tone="accent">{t('training.max_energy')} {plus(n(v.max_energy_added))}</Chip>}
          {v.strength_level > 0 && <Chip tone="solid">{t('training.level_up', { n: n(v.strength_level) })}</Chip>}
          <Chip><Icon name="coins" size={16} />{t('training.paid')}: {v.fee > 0 ? cash(v.fee) : t('training.free')}</Chip>
        </>} />
      <Button block icon="x_muscle" onClick={() => nav.run('training.home')}>{t('training.again')}</Button>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export const HEALTH = {
  hospital: Hospital, treat_confirm: TreatConfirm, treated: Treated, health_home: HealthHome, training_home: TrainingHome, trained: Trained,
}
