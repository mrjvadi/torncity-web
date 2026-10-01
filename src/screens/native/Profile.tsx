// The profile: the "me" tab's home, after the prototype's profile screen
// (torncity-client proto/screens_proto.gd `_s_profile`): the identity card
// with the XP ring, the wealth grid, the needs bars and the achievement
// medals; below them the doors to everything that is about the player.
// Facts come from the `profile` view; the net worth (life.me) and the medals
// (achievement.list) are read from their own views.

import { useContentNames } from '../../village/useVillage'
import type { CSSProperties } from 'react'
import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair, Tile, TileGrid } from './kit/Parts'
import LangSwitch from './kit/LangSwitch'
import { useView } from './kit/useView'
import { clamp01, formatNumber, hms, money } from './kit/format'
import Icon from '../../ui/Icon'
import { GLabel } from '../../kit'
import { t } from '../../i18n'
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
  const v = (response?.view ?? {}) as ProfileView
  const names = useContentNames()
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
      <Header title={t('profile.title')} tone="teal" onRefresh={() => run('player.profile.get')} />

      <Card tone="teal" className="pf-card">
        <div className="pf-id">
          <div className="pf-avatar" style={{ '--pf-xp': `${xpFrac * 360}deg` } as CSSProperties}>
            <span className="pf-avatar-in">{v.avatar ? <span className="pf-emoji">{v.avatar}</span> : <Icon name="fox" palette="fox" size={54} />}</span>
            <span className="pf-level display">{formatNumber(v.level ?? 0)}</span>
          </div>
          <div className="pf-id-text">
            <GLabel className="pf-name" top="#ffffff" bottom="#ffe6b8" stroke={1.4}>{v.name || '…'}</GLabel>
            {subline && <div className="pf-sub">{subline}</div>}
            <div className="pf-xp">
              <div className="pf-xp-bar">
                <div className="pf-xp-fill" style={{ width: `${xpFrac * 100}%` }} />
                <span className="pf-xp-label display" dir="ltr">{formatNumber(v.xp ?? 0)} / {formatNumber(v.next_level_xp ?? 0)}</span>
              </div>
              <span className="nx-chip nx-chip-gold">{t('common.level', { n: formatNumber(v.level ?? 0) })}</span>
            </div>
          </div>
        </div>
        {v.code && (
          <div className="pf-code"><span>{t('profile.code')}</span><b dir="ltr">{v.code}</b></div>
        )}
        <div className="pf-btns">
          <button className="pf-btn" onClick={() => run('player.settings')}><Icon name="gears" palette="steel" size={20} />{t('profile.settings')}</button>
          <button className="pf-btn pf-btn-violet" onClick={() => run('life.avatar')}><Icon name="fox" palette="violet" size={20} />{t('profile.avatar')}</button>
        </div>
        <LangSwitch compact />
      </Card>

      {v.jail && <Notice alert>{t('dashboard.jail', { city: city(v.jail.city_code, v.jail.city), t: hms(v.jail.remaining_seconds) })}</Notice>}
      {v.hospital && <Notice alert>{t('dashboard.hospital', { city: city(v.hospital.city_code, v.hospital.city), t: hms(v.hospital.remaining_seconds) })}</Notice>}
      {v.travelling && <Notice>{t('profile.travelling', { city: city(v.travel_to_code, v.travel_to), t: hms(v.travel_remaining_seconds) })}</Notice>}
      {v.walk && <Notice>{t('profile.walking', { place: names.name('place', v.walk.to?.code ?? '', v.walk.to?.name), t: hms(v.walk.remaining_seconds) })}</Notice>}

      <StatPair
        left={<Stat icon="coins" palette="gold" label={t('profile.cash')} value={money(v.cash)} />}
        right={<Stat icon="bank" palette="sapphire" label={t('profile.bank')} value={money(v.bank)} />}
      />
      <StatPair
        left={<Stat icon="crowncoin" palette="emerald" label={t('profile.net_worth')} value={life?.worth?.total !== undefined ? money(life.worth.total) : '—'} />}
        right={<Stat icon="rank" palette="gold" label={t('profile.wealth_rank')} value={rankName || '—'} />}
      />
      <StatPair
        left={<Stat icon="city" palette="steel" label={t('profile.city')} value={city(v.city_code, v.city) || '—'} />}
        right={<Stat icon="x_map" palette="steel" label={t('profile.place')} value={v.place?.name ? names.name('place', v.place.code ?? '', v.place.name) : '—'} />}
      />

      <div className="pf-sec display">{t('profile.needs')}</div>
      <Card>
        <div className="pf-needs">
          <NeedBar icon="energy" palette="amber" color="var(--saffron)" label={t('profile.energy')} value={v.energy} max={v.max_energy} />
          <NeedBar icon="health" palette="ruby" color="var(--anar)" label={t('profile.health')} value={v.health} max={v.max_health} />
          {needs && <>
            <NeedBar icon="sleepy" palette="violet" color="var(--violet)" label={t('need.sleep')} value={needs.sleep} />
            <NeedBar icon="bread" palette="amber" color="var(--saffron)" label={t('need.hunger')} value={needs.hunger} />
            <NeedBar icon="sun" palette="emerald" color="var(--leaf)" label={t('need.happiness')} value={needs.happiness} />
            <NeedBar icon="x_flame" palette="ruby" color="var(--anar)" label={t('need.stress')} value={needs.stress} />
          </>}
        </div>
      </Card>

      {(v.work?.job || v.work?.course) && (
        <div className="pf-list">
          {v.work?.job && (
            <ListRow icon="work" palette="emerald" title={v.work.job.job?.title ? names.name('career_tier', `${v.work.job.job.career_code ?? ''}.${v.work.job.job.rank ?? ''}`, v.work.job.job.title) : t('profile.work')}
              sub={v.work.job.shift_ends_in_seconds ? t('profile.shift_ends', { t: hms(v.work.job.shift_ends_in_seconds) }) : t('profile.per_shift', { pay: money(v.work.job.pay) })}
              onClick={() => run('job.status')} />
          )}
          {v.work?.course && (
            <ListRow icon="study" palette="violet" title={v.work.course.course?.name ? names.name('course', v.work.course.course.code ?? '', v.work.course.course.name) : t('profile.study')}
              sub={v.work.course.paused ? t('education.paused') : t('profile.course_left', { t: hms(v.work.course.remaining_seconds) })}
              onClick={() => run('education.list')} />
          )}
        </div>
      )}

      <button className="pf-sec pf-sec-link display" onClick={() => run('achievement.list')}>
        {ach ? t('profile.achievements', { a: formatNumber(earned), b: formatNumber(lines.length) })
          : t('profile.achievements_n', { a: formatNumber(v.achievements ?? 0) })}
      </button>
      {medals.length > 0 ? (
        <div className="pf-medals">
          {medals.map((m, i) => (
            <button key={i} className={`pf-medal${m.earned ? '' : ' pf-medal-off'}`} title={m.achievement?.name ? names.name('achievement', m.achievement.code ?? '', m.achievement.name) : undefined} onClick={() => run('achievement.list')}>
              <Icon name={['trophy', 'medal', 'ribbon', 'x_star', 'x_laurel', 'x_crown', 'x_gem', 'shield'][i % 8]} palette={m.earned ? 'gold' : 'steel'} size={30} />
            </button>
          ))}
        </div>
      ) : ach ? <Notice>{t('profile.no_achievements')}</Notice> : null}

      <div className="pf-sec display">{t('profile.more')}</div>
      <TileGrid>
        <Tile icon="chart" palette="violet" title={t('profile.skills')} onClick={() => run('skills.list')} />
        <Tile icon="f_house" palette="emerald" title={t('profile.life')} onClick={() => run('life.me')} />
        <Tile icon="person" palette="gold" title={t('profile.card')} onClick={() => run('life.card')} />
        <Tile icon="x_map" palette="teal" title={t('profile.map')} onClick={() => run('map.list')} />
        <Tile icon="plane" palette="sapphire" title={t('profile.travel')} onClick={() => run('map.cities')} />
        <Tile icon="phone" palette="sapphire" title={t('profile.devices')} onClick={() => run('device.list')} />
      </TileGrid>

    </ScreenScroll>
  )
}

function NeedBar({ icon, palette, color, label, value, max = 100 }: {
  icon: string; palette: 'amber' | 'ruby' | 'violet' | 'emerald'; color: string; label: string; value?: number; max?: number
}) {
  if (value === undefined) return null
  return (
    <div className="pf-need">
      <span className="pf-need-icon"><Icon name={icon} palette={palette} size={22} /></span>
      <div className="pf-need-main">
        <span className="pf-need-label">{label}</span>
        <div className="nx-bar" style={{ borderColor: color, height: 20 }}>
          <div className="nx-bar-fill" style={{ width: `${clamp01(value / (max || 100)) * 100}%`, background: color }} />
          <span className="nx-bar-label display" style={{ lineHeight: '16px', fontSize: 12 }}>{formatNumber(value)}{max !== 100 ? ` / ${formatNumber(max)}` : ''}</span>
        </div>
      </div>
    </div>
  )
}
