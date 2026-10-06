// The profile: the "me" tab's home, after the prototype's profile screen
// (torncity-client proto/screens_proto.gd `_s_profile`): the identity card
// with the XP ring, the wealth grid, the needs bars and the achievement
// medals; below them the doors to everything that is about the player.
// Facts come from the `profile` view; the net worth (life.me) and the medals
// (achievement.list) are read from their own views.

import { useContentNames } from '../../village/useVillage'
import type { CSSProperties } from 'react'
import type { ScreenProps } from '../types'
import { Header, ScreenScroll } from './kit/Parts'
import LangSwitch from './kit/LangSwitch'
import { useView } from './kit/useView'
import { clamp01, formatNumber, hms, money } from './kit/format'
import { Ic } from '../../ui/v6/parts'
import { CardGrid, PBar, PBtn, PRow, PSec, PTile, PWhy } from '../../ui/v6/panel'
import { t } from '../../i18n'
import { locationOf } from '../../support/location'
import { useSession } from '../../state/SessionContext'
import { useEntity } from '../../state/useSync'
import './profile.css'

interface Named { code?: string; name?: string; emoji?: string }
interface ProfileView {
  name?: string; code?: string; avatar?: string; city_code?: string; city?: string
  place?: { code?: string; name?: string }
  walk?: { to?: Named; remaining_seconds?: number } | null
  level?: number; xp?: number; next_level_xp?: number
  energy?: number; max_energy?: number; health?: number; max_health?: number
  cash?: number; bank?: number
  travelling?: boolean; travel_to_code?: string; travel_to?: string; travel_remaining_seconds?: number
  rank?: Named | null
  age?: number; stage?: Named
  achievements?: number
  needs?: { hunger?: number; sleep?: number; stress?: number; happiness?: number } | null
  work?: {
    job?: { job?: { career_code?: string; rank?: string; title?: string }; pay?: number; shift_ends_in_seconds?: number } | null
    course?: { course?: Named; remaining_seconds?: number; paused?: boolean } | null
    certificates?: number
  } | null
  jail?: { city_code?: string; city?: string; remaining_seconds?: number } | null
  hospital?: { city_code?: string; city?: string; remaining_seconds?: number } | null
}
interface LifeView { worth?: { total?: number } }
interface AchievementsView { lines?: { achievement?: Named; earned?: boolean }[] | null }


export default function Profile({ response, loading, run }: ScreenProps) {
  const own = (response?.view ?? {}) as ProfileView
  // state sync: the money, the vitals, the level and where the player is are
  // the store's (live, no refresh); the rest is the command's view
  const { profile: live, synced, bootstrap } = useSession()
  const loc = useEntity('location', synced ? 'self' : undefined)
  const v: ProfileView = synced && live ? {
    ...own, name: live.name || own.name, level: live.level, xp: live.xp, next_level_xp: live.next_level_xp,
    energy: live.energy, max_energy: live.max_energy, health: live.health, max_health: live.max_health,
    cash: live.cash, bank: live.bank,
    ...(loc ? { city_code: loc.city || own.city_code, place: loc.place ? { code: loc.place, name: own.place?.code === loc.place ? own.place.name : undefined } : own.place } : {}),
  } : own
  const names = useContentNames()
  // in a village there is no «مکان» of a city to name: the village is the place
  const inVillage = locationOf(bootstrap)?.kind === 'settlement' || !!loc?.settlement
  const life = useView<LifeView>('life.me')
  const ach = useView<AchievementsView>('achievement.list')
  if (loading && !response) return <ScreenScroll><Header title={t('profile.title')} tone="teal" /></ScreenScroll>

  const xpFrac = v.next_level_xp ? clamp01((v.xp ?? 0) / v.next_level_xp) : 0
  const needs = v.needs
  const lines = ach?.lines ?? []
  const medals = [...lines].sort((a, b) => Number(!!b.earned) - Number(!!a.earned)).slice(0, 8)
  const earned = lines.filter((l) => l.earned).length
  const rankName = v.rank?.name ? names.name('life_rank', v.rank.code ?? '', v.rank.name) : ''
  const stageName = v.stage?.name ? names.name('life_stage', v.stage.code ?? '', v.stage.name) : ''
  const subline = [rankName, stageName && v.age ? `${stageName} · ${t('common.years_old', { n: v.age })}` : null].filter(Boolean).join(' · ')
  const city = (code?: string, name?: string) => (name || code ? names.name('city', code ?? '', name) : '')

  return (
    <ScreenScroll>
      <Header title={t('profile.title')} />

      {/* who I am: identity, level and progress (P6: the profile is the player, nothing about a place's services) */}
      <section className="pf2-id">
        <div className="pf2-avatar" style={{ '--p': xpFrac } as CSSProperties}>
          <i className="pf2-ring" />
          <span className="pf2-face">{v.avatar ? <span className="pf2-emoji">{v.avatar}</span> : <Ic name="portrait" />}</span>
          <b className="pf2-lvl v6-otl">{formatNumber(v.level ?? 0)}</b>
        </div>
        <div className="pf2-who">
          <h2>{v.name || '…'}</h2>
          {subline && <p>{subline}</p>}
          <div className="pf2-xp" dir="ltr" aria-label={t('common.level', { n: formatNumber(v.level ?? 0) })}>
            <i style={{ width: `${xpFrac * 100}%` }} />
            <span>{formatNumber(v.xp ?? 0)} / {formatNumber(v.next_level_xp ?? 0)}</span>
          </div>
        </div>
        {v.code && <div className="pf2-code"><span>{t('profile.code')}</span><b dir="ltr" data-latin>{v.code}</b></div>}
      </section>

      {v.jail && <PWhy title={t('dashboard.jail', { city: city(v.jail.city_code, v.jail.city), t: hms(v.jail.remaining_seconds) })} />}
      {v.hospital && <PWhy title={t('dashboard.hospital', { city: city(v.hospital.city_code, v.hospital.city), t: hms(v.hospital.remaining_seconds) })} />}
      {v.travelling && <PWhy ok title={t('profile.travelling', { city: city(v.travel_to_code, v.travel_to), t: hms(v.travel_remaining_seconds) })} />}
      {v.walk && <PWhy ok title={t('profile.walking', { place: names.name('place', v.walk.to?.code ?? '', v.walk.to?.name), t: hms(v.walk.remaining_seconds) })} />}

      <PSec>{t('profile.wealth')}</PSec>
      <div className="pf2-grid">
        <Fig icon="bank" label={t('profile.bank')} value={money(v.bank)} />
        <Fig icon="chest" label={t('profile.net_worth')} value={life?.worth?.total !== undefined ? money(life.worth.total) : '—'} />
        <Fig icon="trophy" label={t('profile.wealth_rank')} value={rankName || '—'} />
        <Fig icon="house" label={t(inVillage ? 'profile.village' : 'profile.city')} value={city(v.city_code, v.city) || '—'} />
        {!inVillage && <Fig icon="road" label={t('profile.place')} value={v.place?.name ? names.name('place', v.place.code ?? '', v.place.name) : '—'} />}
      </div>

      {/* health and energy live on the HUD; only the needs the HUD does not show are here (owner 2026-10-03) */}
      {needs && <>
      <PSec>{t('profile.needs')}</PSec>
      <div className="pf2-needs">
          {(['sleep', 'hunger', 'happiness', 'stress'] as const).map((k) => <NeedBar key={k} {...NEED_SPEC[k]} label={t(`need.${k}`)} value={needs[k]} />)}
      </div>
      </>}

      {(v.work?.job || v.work?.course) && (
        <>
          <PSec>{t('profile.doing')}</PSec>
          <CardGrid>
            {v.work?.job && (
              <PRow icon="tool" title={v.work.job.job?.title ? names.name('career_tier', `${v.work.job.job.career_code ?? ''}.${v.work.job.job.rank ?? ''}`, v.work.job.job.title) : t('profile.work')}
                sub={v.work.job.shift_ends_in_seconds ? t('profile.shift_ends', { t: hms(v.work.job.shift_ends_in_seconds) }) : t('profile.per_shift', { pay: money(v.work.job.pay) })}
                onClick={() => run('job.status')} />
            )}
            {v.work?.course && (
              <PRow icon="book" title={v.work.course.course?.name ? names.name('course', v.work.course.course.code ?? '', v.work.course.course.name) : t('profile.study')}
                sub={v.work.course.paused ? t('education.paused') : t('profile.course_left', { t: hms(v.work.course.remaining_seconds) })}
                onClick={() => run('education.list')} />
            )}
          </CardGrid>
        </>
      )}

      <PSec>{ach ? t('profile.achievements', { a: formatNumber(earned), b: formatNumber(lines.length) }) : t('profile.achievements_n', { a: formatNumber(v.achievements ?? 0) })}</PSec>
      {medals.length > 0 ? (
        <div className="pf2-medals">
          {medals.map((m, i) => (
            <button key={i} className={`pf2-medal${m.earned ? '' : ' off'}`} title={m.achievement?.name ? names.name('achievement', m.achievement.code ?? '', m.achievement.name) : undefined} onClick={() => run('achievement.list')}>
              <Ic name={['trophy', 'banner', 'scroll', 'gem', 'crime', 'house', 'coin', 'health'][i % 8]} />
            </button>
          ))}
        </div>
      ) : ach ? <p className="pn-hint">{t('profile.no_achievements')}</p> : null}
      <PBtn kind="sec" onClick={() => run('achievement.list')}>{t('profile.all_achievements')}</PBtn>

      <PSec>{t('profile.more')}</PSec>
      <div className="hub-grid">
        <PTile icon="pick" title={t('profile.skills')} onClick={() => run('skills.list')} />
        <PTile icon="house" title={t('profile.life')} onClick={() => run('life.me')} />
        <PTile icon="user" title={t('profile.card')} onClick={() => run('life.card')} />
        <PTile icon="globe" title={t('profile.map')} onClick={() => run('map.list')} />
        <PTile icon="road" title={t('profile.travel')} onClick={() => run('map.cities')} />
        <PTile icon="tool" title={t('profile.devices')} onClick={() => run('device.list')} />
      </div>

      {/* settings are a separate, quiet area below what the player does often (research: settings apart from product actions) */}
      <PSec>{t('profile.settings_area')}</PSec>
      <div className="hub-grid">
        <PTile icon="person" title={t('profile.avatar')} onClick={() => run('life.avatar')} />
        <PTile icon="tool" title={t('profile.settings')} onClick={() => run('player.settings')} />
      </div>
      <LangSwitch compact />
    </ScreenScroll>
  )
}

function Fig({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="pf2-fig">
      <Ic name={icon} />
      <span><em>{label}</em><b>{value}</b></span>
    </div>
  )
}

/** One meaning and one colour per need, everywhere (Me and Life): sleepiness, hunger and stress rise when it is WORSE
 * (0 is fine, 100 is the worst, so a full hunger bar is red); happiness is better when higher. */
export const NEED_SPEC = {
  sleep: { icon: 'timer', color: 'blue', bad: true },
  hunger: { icon: 'bread', color: 'green', bad: true },
  happiness: { icon: 'people', color: 'green', bad: false },
  stress: { icon: 'nerve', color: 'orange', bad: true },
} as const

/** A need or a vital as a thin bar: green is fine, amber low, red blocked; energy is blue, nerve orange (owner). `bad` marks a
 * need that is worse when HIGHER (sleepiness, hunger, stress). */
export function NeedBar({ icon, color, label, value, max = 100, bad }: { icon: string; color: 'blue' | 'green' | 'orange'; label: string; value?: number; max?: number; bad?: boolean }) {
  if (value === undefined) return null
  const f = clamp01(value / (max || 100))
  const level = (bad ? 1 - f : f)
  const tone = level < 0.2 ? 'bad' : level < 0.4 ? 'low' : color
  return (
    <div className="pf2-need">
      <Ic name={icon} />
      <div>
        <span><em>{label}</em><b>{formatNumber(value)}{max !== 100 ? ` / ${formatNumber(max)}` : ''}</b></span>
        <PBar frac={f} tone={tone === 'bad' || tone === 'low' ? tone : undefined} cls={tone} />
      </div>
    </div>
  )
}
