// Learning in the new UI: what this place teaches (education.list), one course, enrolling and finishing.

import type { NScreenProps } from '../../registry'
import type { CourseCompletedView, CourseDetailView, CourseRef, EducationView, EnrolledView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Card, Chip, Empty, Icon, KV, List, Meter, Note, Now, Row, Rows, Section, Stat, Stats, Tile, Tiles } from '../../ui'
import { t } from '../../../i18n'
import { hms, roughDuration } from '../../../screens/native/kit/format'
import { atText } from '../../../lib/duration'
import { buildingName, useBuildingCatalogue } from '../../../village/useVillage'
import { ActPage, cash, Conds, MoreActs, NoView, Pager, PayBox, ResultHero, ThingHero, cityName, n, tk, tripText, useActs, type ContentNames } from './common'
import { Gains, needText, reqCond } from './work'

const courseName = (names: ContentNames, c: CourseRef) => names.name('course', c.code, c.name)
const feeText = (fee: number) => (fee > 0 ? cash(fee) : t('common.free'))

// -- what is taught here ---------------------------------------------------------------------------------------

export function Education({ response, loading }: NScreenProps) {
  const nav = useNav()
  const cat = useBuildingCatalogue()
  const acts = useActs(response)
  const v = response?.view as EducationView | undefined
  if (!v) return <NoView title={t('education.title')} loading={loading} />
  const { names } = acts
  const place = v.place?.name ?? ''
  const courses = v.courses ?? []
  const gaps = v.elsewhere ?? []
  const certs = v.certificates ?? []
  const cur = v.current
  return (
    <ActPage title={t('education.title')} sub={place || undefined} response={response}>
      {cur && (
        <Now icon="study" lit title={courseName(names, cur.course)} sub={cur.paused ? t('education.paused') : t('education.current')}
          time={cur.paused ? undefined : hms(cur.remaining_seconds)} frac={cur.percent / 100} />
      )}

      <Tiles>
        <Tile icon="f_hands" title={t('tc.entry_apprentice')} sub={t('tc.entry_apprentice_sub')} onClick={() => nav.run('settlement.apprentice.mine')} />
        <Tile icon="f_school" title={t('tc.entry_teachers')} sub={t('tc.entry_teachers_sub')} onClick={() => nav.run('education.teachers')} />
      </Tiles>

      {v.literacy && (
        <Card>
          <div className="n-act-next">
            <Icon name="book" size={44} />
            <div><p className="n-act-next-title">{t('education.literacy.title')}</p><p className="n-label">{t('education.literacy.first')}</p></div>
          </div>
          <div className="n-act-gap"><Meter tone="cyan" frac={v.literacy.share_bps / 10000} label={t('education.literacy.share', { p: n(Math.round(v.literacy.share_bps / 100)), place })} /></div>
        </Card>
      )}

      {v.empty === 'no_class' && (
        <Note icon="f_school">{t('education.empty.no_class')}{v.build?.code && <><br />{t('education.empty.build', { name: buildingName(cat, v.build.code, v.build.name) })}</>}</Note>
      )}
      {v.empty === 'nothing_taught' && <Empty icon="study">{t('education.empty.nothing', { place })}</Empty>}

      {courses.length > 0 && (
        <>
          <Section title={t('education.here_title', { place })} />
          <Rows>
            {courses.map((c) => {
              const go = acts.of('education.course', c.course.code)
              return (
                <Row key={c.course.code} icon={c.eligible ? 'study' : 'm_lock'} title={courseName(names, c.course)}
                  sub={`${roughDuration(c.duration_seconds)}${c.eligible ? '' : ` – ${t('common.of_level', { n: n(c.min_level) })}`}`}
                  end={<Chip tone={c.eligible ? 'accent' : undefined}>{feeText(c.fee)}</Chip>}
                  onClick={go ? () => nav.act(go) : () => nav.run('education.view', { course: c.course.code })} />
              )
            })}
          </Rows>
        </>
      )}

      {gaps.length > 0 && (
        <>
          <Section title={t('education.not_here_title')} />
          <Rows>
            {gaps.map((g) => {
              const near = g.nearest?.name ? cityName(names, g.nearest.code, g.nearest.name) : ''
              const needs = (g.needs ?? []).map((x) => needText(names, x)).filter(Boolean)
              return (
                <Row key={g.course.code} icon="x_map" title={courseName(names, g.course)}
                  sub={[`${feeText(g.fee)} – ${roughDuration(g.duration_seconds)}`, near ? t('education.gap.taught_in', { place: near }) : '', tripText(g.nearest_trip, roughDuration), ...needs].filter(Boolean).join(' – ')}
                  end={near && g.nearest?.code ? <Button kind="ghost" small onClick={() => nav.run('travel.options', { city: g.nearest!.code })}>{t('n.act.go')}</Button> : undefined} />
              )
            })}
          </Rows>
        </>
      )}

      {certs.length > 0 && (
        <>
          <Section title={t('education.certificates')} note={n(certs.length)} />
          <List>
            {certs.map((c) => (
              <Row key={c.code} icon="ribbon" title={courseName(names, c)}
                sub={[c.issued_by?.name ? t('edu.cert.by', { name: c.issued_by.name }) : '', tk(`edu.cert.route.${c.route}`)].filter(Boolean).join(' – ') || undefined} />
            ))}
          </List>
        </>
      )}
      <Pager acts={acts} page={v.page} pages={v.pages} />
      <MoreActs acts={acts} list={acts.rest(['education.course', 'page.prev', 'page.next'])} />
    </ActPage>
  )
}

// -- one course ------------------------------------------------------------------------------------------------

const INSTITUTION = ['training_center', 'university', 'company']

export function CourseDetail({ response, loading }: NScreenProps) {
  const nav = useNav()
  const acts = useActs(response)
  const v = response?.view as CourseDetailView | undefined
  if (!v) return <NoView title={t('screen.course_detail')} loading={loading} />
  const { names } = acts
  const name = courseName(names, v.course)
  const away = (v.requirements ?? []).find((r) => r.kind === 'course_city' && !r.met)
  const reqs = (v.requirements ?? []).filter((r) => r !== away).map((r) => reqCond(names, r))
  const enrol = acts.find('education.enrol')
  const teach = ['education.hire', 'education.teach_school', 'education.teach_home'].map((id) => acts.find(id)).filter((a) => !!a)
  const staff = v.staff ?? []
  return (
    <ActPage title={name} response={response}>
      <ThingHero art="study" kicker={INSTITUTION.includes(v.institution) ? tk(`ac.work.inst.${v.institution}`) : undefined} title={name}
        chips={<>
          <Chip tone="accent"><Icon name="coins" size={18} />{feeText(v.fee)}</Chip>
          <Chip><Icon name="clock" size={18} />{roughDuration(v.duration_seconds)}</Chip>
          {v.certifies && <Chip tone="ok"><Icon name="ribbon" size={18} />{t('ac.work.course.certificate')}</Chip>}
        </>} />

      {v.limited && (
        <Stats>
          <Stat icon="m_bench" label={t('ac.work.course.seats')} value={n(v.seats_left)} tone={v.seats_left > 0 ? undefined : 'bad'} />
          <Stat icon="ribbon" label={t('ac.work.course.certificate')} value={v.certifies ? t('ac.work.course.yes') : t('ac.work.course.no')} />
        </Stats>
      )}

      {(v.skills ?? []).length > 0 && (
        <>
          <Section title={t('ac.work.course.rewards')} />
          <div className="n-chips">{(v.skills ?? []).map((g) => <Chip key={g.skill} tone="cyan">{t('ac.work.course.reward', { skill: names.name('skill', g.skill, g.skill), xp: n(g.xp) })}</Chip>)}</div>
        </>
      )}

      {v.city && !away && <Note tone="info" icon="x_map">{t('ac.work.course.where', { city: cityName(names, v.city_code, v.city) })}</Note>}
      {away && (
        <Note tone="bad" icon="x_map">
          <b>{t('ac.work.course.not_here')}</b> {t('ac.work.course.taught_in', { place: cityName(names, away.city_code, away.city) })} {tripText(away.trip, roughDuration)}
          <div className="n-act-gap"><Button kind="ghost" small onClick={() => nav.run('travel.options', { city: away.city_code })}>{t('ac.work.course.go')}</Button></div>
        </Note>
      )}

      <Conds title={t('ac.work.detail.reqs')} items={reqs} />

      {staff.length > 0 && (
        <>
          <Section title={t('ac.work.course.staff')} />
          <List>
            {staff.map((s) => {
              const end = acts.find('education.unteach', (a) => a.args?.id === s.id)
              return <Row key={s.id} icon={s.kind === 'npc' ? 'f_school' : 'person'} title={tk(`ac.work.teacher.${s.kind}`, s.name, { name: s.name, n: n(s.students), max: n(s.max) })}
                end={end ? <Button kind="ghost" small onClick={() => nav.act(end)}>{t('ac.work.teacher.end')}</Button> : undefined} />
            })}
          </List>
        </>
      )}
      {v.teaching && teach.length > 0 && <Note tone="info" icon="f_school">{t('ac.work.teacher.wage', { wage: cash(v.teaching.school_wage) })}</Note>}
      {v.teaching?.no_pool && <Note tone="bad" icon="society">{t('ac.work.teacher.no_pool')}</Note>}
      {teach.length > 0 && <List>{teach.map((a) => <Row key={a!.id} icon="f_school" title={acts.label(a!)} onClick={() => nav.act(a!)} />)}</List>}

      {v.can_enrol && v.payment && <PayBox payment={v.payment} acts={acts} title={t('ac.work.course.fee')} />}
      {v.can_enrol && !v.payment && enrol && <Button block icon="study" onClick={() => nav.act(enrol)}>{t('ac.work.course.enrol')}</Button>}
      <MoreActs acts={acts} list={acts.rest(['education.enrol', 'education.unteach', 'education.hire', 'education.teach_school', 'education.teach_home', 'bank'], (a) => (a.id ?? '').startsWith('pay.'))} />
    </ActPage>
  )
}

// -- results ---------------------------------------------------------------------------------------------------

export function Enrolled({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as EnrolledView | undefined
  if (!v) return <NoView title={t('ac.work.enrolled.title')} loading={loading} />
  const name = courseName(acts.names, v.course)
  return (
    <ActPage title={t('ac.work.enrolled.title')} response={response}>
      <ResultHero art="study" kicker={t('ac.work.enrolled.title')} big={name} sub={t('ac.work.enrolled.lead', { course: name })}
        chips={<><Chip><Icon name="clock" size={18} />{roughDuration(v.duration_seconds)}</Chip><Chip tone="accent">{feeText(v.fee)}</Chip></>} />
      <div className="n-rows">
        {v.ends_at && <KV label={t('ac.work.enrolled.ends')} value={atText(v.ends_at)} />}
        {v.method && <KV label={t('ac.work.enrolled.method')} value={tk(`ac.work.method.${v.method}`, v.method)} />}
      </div>
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export function CourseCompleted({ response, loading }: NScreenProps) {
  const acts = useActs(response)
  const v = response?.view as CourseCompletedView | undefined
  if (!v) return <NoView title={t('ac.work.completed.title')} loading={loading} />
  const name = courseName(acts.names, v.course)
  return (
    <ActPage title={t('ac.work.completed.title')} response={response}>
      <ResultHero art="f_grad" kicker={t('ac.work.completed.title')} big={name} sub={t('ac.work.completed.lead', { course: name })}
        chips={v.certified ? <Chip tone="ok"><Icon name="ribbon" size={18} />{t('ac.work.completed.certified', { course: name })}</Chip> : undefined} />
      <Gains names={acts.names} list={v.skills} />
      <MoreActs acts={acts} list={acts.all} />
    </ActPage>
  )
}

export const STUDY = { education: Education, course_detail: CourseDetail, enrolled: Enrolled, course_completed: CourseCompleted }
