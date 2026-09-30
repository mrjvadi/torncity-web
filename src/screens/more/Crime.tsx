// Crime, past the hub and the list (src/screens/native/CrimeHub.tsx):
// one crime's detail before committing to it, the result right after, and
// the started notice for a timed one. Real fields only — internal/telegram/
// screens/crime.go (CrimeDetailView, CrimeResultView, CrimeStartedView).

import type { ScreenProps } from '../types'
import { Bar, Card, Chip, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { clamp01, formatNumber, hms, money, pct } from '../native/kit/format'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }

// crime.go's requirement kinds (job.go's work kinds plus crime_tier, venue,
// facility, tool) — a stable contract, not content: crimeRequirementLine.
interface ReqView {
  kind?: string; met?: boolean
  need?: number; have?: number; skill?: string
  course_code?: string; course_name?: string
  city_code?: string; city?: string
  wait_seconds?: number
  tier?: Named; have_tier?: Named
  venues?: Named[] | null; here?: Named
  facility?: string; tool?: Named
}

function reqLabel(r: ReqView): string {
  const have = (h: string) => (!r.met ? ` ${t('req.have', { have: h })}` : '')
  switch (r.kind) {
    case 'level': return t('req.level', { need: formatNumber(r.need ?? 0) }) + have(formatNumber(r.have ?? 0))
    case 'skill': return t('req.skill', { skill: r.skill ?? '', need: formatNumber(r.need ?? 0) }) + have(formatNumber(r.have ?? 0))
    case 'certificate': return t('req.certificate', { name: r.course_name ?? r.course_code ?? '—' })
    case 'residence': return t('req.residence', { city: r.city ?? '—' })
    case 'performance': return t('req.performance', { need: formatNumber(r.need ?? 0) }) + have(formatNumber(r.have ?? 0))
    case 'time': return t('req.time', { t: hms(r.wait_seconds) })
    case 'shifts': return t('req.shifts_have', { n: formatNumber(r.need ?? 0), have: have(formatNumber(r.have ?? 0)) })
    case 'top': return t('req.top')
    case 'crime_tier': return t('req.crime_tier', { name: r.tier?.name ?? '—', have: have(r.have_tier?.name ?? '—') })
    case 'venue': return r.met ? t('req.venue_ok', { names: (r.venues ?? []).map((v) => v.name).filter(Boolean).join(`${t('common.sep')} `) }) : t('req.venue_here', { name: r.here?.name ?? '—' })
    case 'facility': return t('req.facility', { name: r.facility ?? '—' })
    case 'tool': return t('req.tool', { name: r.tool?.name ?? '—' })
    default: return '—'
  }
}

const BLOCKED = ['jail', 'hospital', 'busy', 'work', 'travelling', 'walking', 'cooldown', 'nerve', 'nowhere']
const blockedText = (b: string) => t((BLOCKED.includes(b) ? `crime.blocked.${b}` : 'crime.blocked.default') as Key)

interface CrimeDetailView {
  crime?: Named; category?: Named
  nerve?: number; duration_seconds?: number
  chance_bps?: number
  hits_players?: boolean; hits_np_cs?: boolean
  min_take?: number; max_take?: number
  jail_min_seconds?: number; jail_max_seconds?: number
  fine_min?: number; fine_max?: number
  requirements?: ReqView[] | null
  blocked?: string; need?: number; have?: number; wait_seconds?: number
  can_commit?: boolean
  odds?: { base?: number; skill?: number; awareness?: number; heat?: number; gear?: number }
}

export function CrimeDetail({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeDetailView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>

  const backTo = () => (v.category?.code ? run('crime.list', { category: v.category.code }) : run('crime.hub'))

  return (
    <ScreenScroll>
      <Header title={v.crime?.name ?? t('crime.title')} tone="ruby" onBack={backTo}
        onRefresh={() => v.crime?.code && run('crime.view', { crime: v.crime.code })} />

      {v.blocked && <Notice alert>{blockedText(v.blocked)}{v.blocked === 'nerve' ? ` · ${formatNumber(v.have ?? 0)}/${formatNumber(v.need ?? 0)}` : ''}</Notice>}

      <Card tone="ruby">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Bar frac={clamp01((v.chance_bps ?? 0) / 10000)} color="var(--anar)" label={t('crime.chance', { p: pct((v.chance_bps ?? 0) / 10000) })} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Chip>{t('crime.chip_nerve', { n: formatNumber(v.nerve ?? 0) })}</Chip>
          {!!v.duration_seconds && <Chip>{t('crime.chip_duration', { t: hms(v.duration_seconds) })}</Chip>}
          {v.hits_np_cs && v.max_take ? <Chip tone="emerald">{t('crime.chip_take', { a: money(v.min_take), b: money(v.max_take) })}</Chip> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {!!v.jail_max_seconds && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('crime.if_caught', { a: hms(v.jail_min_seconds), b: hms(v.jail_max_seconds) })}</span>}
          {!!v.fine_max && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('crime.fine', { a: money(v.fine_min), b: money(v.fine_max) })}</span>}
        </div>
      </Card>

      {!!(v.requirements && v.requirements.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.requirements!.map((r, i) => (
            <ListRow key={i} icon={r.met ? 'check' : 'm_lock'} palette={r.met ? 'emerald' : 'steel'} title={reqLabel(r)} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface CrimeResultView {
  crime?: Named; venue?: Named; city?: string
  result?: 'succeeded' | 'escaped' | 'caught' | string
  victim_player?: boolean
  take?: number; dry_spell?: boolean
  xp?: number; criminal_xp?: number
  skills?: { skill?: string; xp?: number; level?: number }[] | null
  level?: number
  jail?: { remaining_seconds?: number } | null
  fine?: number; fine_paid?: number
  loot?: Named[] | null
}

const RESULT_TONE: Record<string, { label: Key; palette: 'emerald' | 'ruby' | 'steel'; card: 'emerald' | 'ruby' | 'gold'; icon: string }> = {
  succeeded: { label: 'crime.result.succeeded', palette: 'emerald', card: 'emerald', icon: 'check' },
  escaped: { label: 'crime.result.escaped', palette: 'steel', card: 'gold', icon: 'walk' },
  caught: { label: 'crime.result.caught', palette: 'ruby', card: 'ruby', icon: 'handcuffs' },
}

export function CrimeResult({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeResultView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.result')} tone="ruby" /></ScreenScroll>
  const tone = RESULT_TONE[v.result ?? ''] ?? RESULT_TONE.succeeded

  return (
    <ScreenScroll>
      <Header title={v.crime?.name ?? t('crime.result_title')} tone="ruby" onBack={() => run('crime.hub')} />

      <Card tone={tone.card}>
        <ListRow icon={tone.icon} palette={tone.palette} title={t(tone.label)} sub={v.venue?.name} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {!!v.take && <Chip tone="gold">{t('crime.earned', { n: money(v.take) })}</Chip>}
          {v.dry_spell && <Chip>{t('crime.dry')}</Chip>}
          {!!v.xp && <Chip>{t('crime.xp', { n: formatNumber(v.xp) })}</Chip>}
          {!!v.criminal_xp && <Chip tone="ruby">{t('crime.criminal_xp', { n: formatNumber(v.criminal_xp) })}</Chip>}
          {!!v.level && <Chip tone="emerald">{t('crime.level_up', { n: formatNumber(v.level) })}</Chip>}
        </div>
      </Card>

      {v.jail && <Notice alert>{t('crime.jailed', { t: hms(v.jail.remaining_seconds) })}</Notice>}
      {!!v.fine && <Notice alert>{t('crime.fine_line', { a: money(v.fine) })}{v.fine_paid ? ` · ${t('crime.fine_paid', { a: money(v.fine_paid) })}` : ''}</Notice>}

      {!!(v.loot && v.loot.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{t('crime.loot')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {v.loot!.map((l, i) => <span key={i} className="nx-chip nx-chip-gold">{l.name ?? l.code}</span>)}
          </div>
        </Card>
      )}

      {!!(v.skills && v.skills.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.skills!.map((s, i) => (
            <ListRow key={i} icon="chart" palette="violet" title={s.skill ?? '—'}
              sub={`${t('crime.skill_xp', { n: formatNumber(s.xp ?? 0) })}${s.level ? ` · ${t('crime.skill_level', { n: formatNumber(s.level) })}` : ''}`} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

interface CrimeStartedView {
  crime?: Named; venue?: Named; duration_seconds?: number
  nerve?: { nerve?: number; max?: number }
}

export function CrimeStarted({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeStartedView
  if (loading && !response) return <ScreenScroll><Header title={t('crime.title')} tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('crime.started')} tone="ruby" onBack={() => run('crime.hub')} />
      <Card tone="ruby">
        <ListRow icon="clock" palette="ruby" title={v.crime?.name ?? '—'} sub={v.venue?.name} />
        <div style={{ marginTop: 10 }}>
          <Bar frac={0} color="var(--anar)" label={t('crime.until_end', { t: hms(v.duration_seconds) })} />
        </div>
        {v.nerve && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            {t('crime.nerve_left', { a: formatNumber(v.nerve.nerve ?? 0), b: formatNumber(v.nerve.max ?? 0) })}
          </div>
        )}
      </Card>
      <Notice>{t('crime.result_later')}</Notice>
      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
