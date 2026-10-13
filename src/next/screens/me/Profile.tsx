// «من»: the Me tab's root (screen `profile`, command player.profile.get). Who I am on top (the face in its XP ring,
// the level, the rank, the player code), then my money and standing, my needs, what I am doing now, my medals, and
// the doors to everything about me. The money, the vitals, the level and where I stand are the live store's once
// state sync is on; the rest is the command's own view. The net worth (life.me), the medals (achievement.list),
// thirst and cold (health.survival) and an apprenticeship (settlement.apprentice.mine) are read from their views.

import type { CSSProperties } from 'react'
import type { NScreenProps } from '../../registry'
import type { AchievementsView, ApprenticesView, LifeView, ProfileView, SurvivalView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Chip, Empty, Hero, Icon, List, Loading, Meter, Note, Page, Row, Section, SectionLink, Stat, Stats, Tile, Tiles } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { useToast } from '../../../state/ToastContext'
import { useEntity } from '../../../state/useSync'
import { locationOf } from '../../../support/location'
import { useContentNames } from '../../../village/useVillage'
import { clamp01, formatNumber, hms, money } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { figure, medalOf, NeedsCard, of, useSideView } from './parts'
import './me.css'

type PV = Partial<ProfileView>


/** The face in a ring that fills with the XP to the next level, the level on a cyan badge. */
export function Avatar({ emoji, frac, level, big }: { emoji?: string; frac?: number; level?: number; big?: boolean }) {
  return (
    <div className={`n-me-av${big ? ' big' : ''}${frac === undefined ? ' plain' : ''}`} style={{ '--p': clamp01(frac ?? 0) } as CSSProperties}>
      <span className="n-me-av-face">{emoji ? <span className="n-me-av-emoji">{emoji}</span> : <Icon name="person" />}</span>
      {level !== undefined && <b className="n-me-av-lvl">{formatNumber(level)}</b>}
    </div>
  )
}

export default function Profile({ response, loading }: NScreenProps) {
  const nav = useNav()
  const toast = useToast()
  const names = useContentNames()
  const { profile: live, synced, bootstrap } = useSession()
  const loc = useEntity('location', synced ? 'self' : undefined)
  const life = useSideView<LifeView>('life.me')
  const ach = useSideView<AchievementsView>('achievement.list')
  const survival = useSideView<SurvivalView>('health.survival')
  const appr = useSideView<ApprenticesView>('settlement.apprentice.mine')

  if (!response) return <Page title={t('profile.title')}>{loading ? <Loading blocks={[230, 120, 180]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const own = (response.view ?? {}) as PV
  // state sync: the money, the level and where I stand are the store's (live); the rest is the command's view
  const v: PV = synced && live ? {
    ...own, name: live.name || own.name, level: live.level, xp: live.xp, next_level_xp: live.next_level_xp, cash: live.cash, bank: live.bank,
    ...(loc ? { city_code: loc.city || own.city_code, place: loc.place ? { code: loc.place, name: own.place?.code === loc.place ? own.place.name : '' } : own.place } : {}),
  } : own
  const inVillage = locationOf(bootstrap)?.kind === 'settlement' || !!loc?.settlement
  const city = (code?: string, name?: string) => (name || code ? names.name('city', code ?? '', name) : '')

  const xpFrac = v.next_level_xp ? clamp01((v.xp ?? 0) / v.next_level_xp) : 0
  const rankName = v.rank?.name ? names.name('life_rank', v.rank.code ?? '', v.rank.name) : ''
  const stageName = v.stage?.name ? names.name('life_stage', v.stage.code ?? '', v.stage.name) : ''
  const line = [stageName, v.age ? t('common.years_old', { n: formatNumber(v.age) }) : ''].filter(Boolean).join(' · ')
  const placeName = v.place?.code ? names.name('place', v.place.code, v.place.name) : ''
  const cityName = city(v.city_code, v.city)

  const lines = ach?.lines ?? []
  const earned = lines.filter((l) => l.earned).length
  const medals = [...lines].sort((a, b) => Number(b.earned) - Number(a.earned)).slice(0, 8)
  const job = v.work?.job
  const course = v.work?.course
  const apprentice = (appr?.lines ?? []).find((l) => l.status === 'active')

  const copy = () => {
    const code = v.code ?? ''
    const done = () => toast.push(t('profile.copied'), { kind: 'success', user: true })
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(code).then(done).catch(() => undefined)
  }

  const standing = [
    rankName ? <Stat key="r" icon="rank" label={t('profile.wealth_rank')} value={<>{v.rank?.emoji ? `${v.rank.emoji} ` : ''}{rankName}</>} /> : null,
    cityName ? <Stat key="c" icon="city" label={t(inVillage ? 'profile.village' : 'profile.city')} value={cityName} /> : null,
    !inVillage && placeName ? <Stat key="p" icon="x_map" label={t('profile.place')} value={placeName} /> : null,
  ].filter(Boolean)

  return (
    <Page title={t('profile.title')}>
      {/* who I am */}
      <Hero>
        <div className="n-me-id">
          <Avatar emoji={v.avatar} frac={xpFrac} level={v.level} />
          <div className="n-me-who">
            <h2>{v.name || '…'}</h2>
            {line && <p>{line}</p>}
            {rankName && <div className="n-me-chips"><Chip tone="accent">{v.rank?.emoji ? `${v.rank.emoji} ` : ''}{rankName}</Chip></div>}
          </div>
        </div>
        {!!v.next_level_xp && (
          <div className="n-me-xp">
            <Meter frac={xpFrac} tone="accent" thick label={<>{t('n.me.xp')} · {t('common.level', { n: formatNumber((v.level ?? 0) + 1) })}</>} value={of(v.xp ?? 0, v.next_level_xp)} />
          </div>
        )}
        {v.code && (
          <div className="n-me-code">
            <span className="n-me-code-text"><small>{t('profile.code')}</small><b className="n-ltr">{v.code}</b></span>
            <Button kind="cyan" small icon="x_share" onClick={copy}>{t('profile.copy')}</Button>
          </div>
        )}
      </Hero>

      {v.jail && <Note tone="bad" icon="handcuffs">{t('dashboard.jail', { city: city(v.jail.city_code, v.jail.city), t: hms(v.jail.remaining_seconds) })}</Note>}
      {v.hospital && <Note tone="bad" icon="hospital">{t('dashboard.hospital', { city: city(v.hospital.city_code, v.hospital.city), t: hms(v.hospital.remaining_seconds) })}</Note>}
      {v.travelling && <Note tone="info" icon="plane">{t('profile.travelling', { city: city(v.travel_to_code, v.travel_to), t: hms(v.travel_remaining_seconds) })}</Note>}
      {v.walk && <Note tone="info" icon="walk">{t('profile.walking', { place: names.name('place', v.walk.to?.code ?? '', v.walk.to?.name), t: hms(v.walk.remaining_seconds) })}</Note>}

      {/* my money and standing */}
      <Section title={t('profile.wealth')} />
      <Stats>
        <Stat icon="bank" label={t('profile.bank')} {...figure(v.bank)} />
        {life?.worth && <Stat icon="x_chest" label={t('profile.net_worth')} {...figure(life.worth.total)} tone="lit" />}
      </Stats>
      {standing.length > 0 && <Stats three={standing.length === 3}>{standing}</Stats>}

      {/* my needs (health and energy are on the HUD) */}
      {v.needs && (
        <>
          <Section title={t('profile.needs')} end={<SectionLink onClick={() => nav.run('life.me')}>{t('profile.life')}</SectionLink>} />
          <NeedsCard needs={v.needs} survival={survival} />
        </>
      )}

      {/* what I am doing */}
      {(job || course || apprentice) && (
        <>
          <Section title={t('profile.doing')} />
          <List>
            {job && (
              <Row icon="work"
                title={job.job?.title ? names.name('career_tier', `${job.job.career_code ?? ''}.${job.job.rank ?? ''}`, job.job.title) : t('profile.work')}
                sub={job.shift_ends_in_seconds ? t('profile.shift_ends', { t: hms(job.shift_ends_in_seconds) }) : t('profile.per_shift', { pay: money(job.pay) })}
                end={job.shift_ends_in_seconds ? <b className="n-me-time">{hms(job.shift_ends_in_seconds)}</b> : undefined}
                onClick={() => nav.run('job.status')} />
            )}
            {course && (
              <Row icon="study"
                title={course.course?.name ? names.name('course', course.course.code ?? '', course.course.name) : t('profile.study')}
                sub={course.paused ? t('education.paused') : t('profile.course_left', { t: hms(course.remaining_seconds) })}
                end={course.paused ? <Chip tone="warn">{t('education.paused')}</Chip> : <b className="n-me-time">{hms(course.remaining_seconds)}</b>}
                onClick={() => nav.run('education.list')} />
            )}
            {apprentice && (
              <Row icon="m_hand"
                title={t(apprentice.role === 'master' ? 'tc.profile_master' : 'tc.profile_apprentice', { who: apprentice.with?.name || t('tc.npc_master') })}
                sub={of(apprentice.shifts, apprentice.exam_shifts)}
                onClick={() => nav.run('settlement.apprentice.mine')} />
            )}
          </List>
        </>
      )}

      {/* my medals */}
      <Section title={t('achievements.title')} note={ach ? of(earned, lines.length) : v.achievements ? formatNumber(v.achievements) : undefined}
        end={<SectionLink onClick={() => nav.run('achievement.list')}>{t('n.me.all')}</SectionLink>} />
      {medals.length > 0 ? (
        <div className="n-card n-me-medals">
          {medals.map((m, i) => {
            const name = m.achievement?.code ? names.name('achievement', m.achievement.code, m.achievement.name) : m.achievement?.name ?? ''
            return (
              <button key={i} className={`n-me-medal${m.earned ? ' on' : ''}`} onClick={() => nav.run('achievement.list')} aria-label={name}>
                <span className="n-me-medal-well"><Icon name={m.earned ? medalOf(m.achievement?.code ?? name) : 'm_lock'} /></span>
                <span className="n-me-medal-name">{name}</span>
              </button>
            )
          })}
        </div>
      ) : ach ? <Empty icon="medal">{t('profile.no_achievements')}</Empty> : null}

      {/* everything about me */}
      <Section title={t('profile.more')} />
      <Tiles three>
        <Tile icon="x_biceps" title={t('profile.skills')} onClick={() => nav.run('skills.list')} />
        <Tile icon="f_tree" title={t('profile.life')} onClick={() => nav.run('life.me')} />
        <Tile icon="x_cards" title={t('profile.card')} onClick={() => nav.run('life.card')} />
        <Tile icon="x_map" title={t('profile.map')} onClick={() => nav.run('map.list')} />
        <Tile icon="train" title={t('profile.travel')} onClick={() => nav.run('map.cities')} />
        <Tile icon="phone" title={t('profile.devices')} onClick={() => nav.run('device.list')} />
      </Tiles>

      <Section title={t('profile.settings_area')} />
      <Tiles>
        <Tile icon="a_foxkid" title={t('profile.avatar')} sub={v.avatar ? <span className="n-me-tile-emoji">{v.avatar}</span> : undefined} onClick={() => nav.run('life.avatar')} />
        <Tile icon="gears" title={t('profile.settings')} sub={t('n.me.settings_sub')} onClick={() => nav.run('player.settings')} />
      </Tiles>
    </Page>
  )
}
