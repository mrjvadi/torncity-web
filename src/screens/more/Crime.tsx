// Crime, past the hub and the list (src/screens/native/CrimeHub.tsx):
// one crime's detail before committing to it, the result right after, and
// the started notice for a timed one. Real fields only — internal/telegram/
// screens/crime.go (CrimeDetailView, CrimeResultView, CrimeStartedView).

import type { ScreenProps } from '../types'
import { Bar, Card, Chip, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import { clamp01, formatNumber, hms, money, pct } from '../native/kit/format'

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
  switch (r.kind) {
    case 'level': return `سطح ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'skill': return `مهارت ${r.skill ?? ''} سطح ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'certificate': return `مدرک ${r.course_name ?? r.course_code ?? '—'}`
    case 'residence': return `اقامت در ${r.city ?? '—'}`
    case 'performance': return `عملکرد ${formatNumber(r.need ?? 0)}${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'time': return `${hms(r.wait_seconds)} دیگر`
    case 'shifts': return `${formatNumber(r.need ?? 0)} شیفت${!r.met ? ` (فعلاً ${formatNumber(r.have ?? 0)})` : ''}`
    case 'top': return 'بالاترین درجه'
    case 'crime_tier': return `رتبه‌ی جنایی ${r.tier?.name ?? '—'}${!r.met ? ` (فعلاً ${r.have_tier?.name ?? '—'})` : ''}`
    case 'venue': return r.met ? `مکان: ${(r.venues ?? []).map((v) => v.name).filter(Boolean).join('، ')}` : `اینجا: ${r.here?.name ?? '—'}`
    case 'facility': return `امکانات: ${r.facility ?? '—'}`
    case 'tool': return `ابزار لازم: ${r.tool?.name ?? '—'}`
    default: return '—'
  }
}

const BLOCKED_LABEL: Record<string, string> = {
  jail: 'در زندان هستی', hospital: 'در بیمارستان بستری هستی', busy: 'مشغول جرم دیگری هستی',
  work: 'سر کار هستی', travelling: 'در سفر هستی', walking: 'در حال پیاده‌روی هستی',
  cooldown: 'هنوز باید استراحت کنی', nerve: 'عصب کافی نداری', nowhere: 'اول باید در یک شهر باشی',
}

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
  if (loading && !response) return <ScreenScroll><Header title="جرم" tone="ruby" /></ScreenScroll>

  const backTo = () => (v.category?.code ? run('crime.list', { category: v.category.code }) : run('crime.hub'))

  return (
    <ScreenScroll>
      <Header title={v.crime?.name ?? 'جرم'} tone="ruby" onBack={backTo}
        onRefresh={() => v.crime?.code && run('crime.view', { crime: v.crime.code })} />

      {v.blocked && <Notice alert>{BLOCKED_LABEL[v.blocked] ?? 'در حال حاضر ممکن نیست'}{v.blocked === 'nerve' ? ` · ${formatNumber(v.have ?? 0)}/${formatNumber(v.need ?? 0)}` : ''}</Notice>}

      <Card tone="ruby">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Bar frac={clamp01((v.chance_bps ?? 0) / 10000)} color="var(--anar)" label={`شانس موفقیت ${pct((v.chance_bps ?? 0) / 10000)}`} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Chip>عصب {formatNumber(v.nerve ?? 0)}</Chip>
          {!!v.duration_seconds && <Chip>مدت {hms(v.duration_seconds)}</Chip>}
          {v.hits_np_cs && v.max_take ? <Chip tone="emerald">غنیمت {money(v.min_take)} تا {money(v.max_take)}</Chip> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {!!v.jail_max_seconds && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>در صورت دستگیری: {hms(v.jail_min_seconds)}–{hms(v.jail_max_seconds)} زندان</span>}
          {!!v.fine_max && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>جریمه {money(v.fine_min)}–{money(v.fine_max)}</span>}
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

const RESULT_TONE: Record<string, { label: string; palette: 'emerald' | 'ruby' | 'steel'; card: 'emerald' | 'ruby' | 'gold'; icon: string }> = {
  succeeded: { label: 'موفق شدی', palette: 'emerald', card: 'emerald', icon: 'check' },
  escaped: { label: 'فرار کردی', palette: 'steel', card: 'gold', icon: 'walk' },
  caught: { label: 'دستگیر شدی', palette: 'ruby', card: 'ruby', icon: 'handcuffs' },
}

export function CrimeResult({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CrimeResultView
  if (loading && !response) return <ScreenScroll><Header title="نتیجه" tone="ruby" /></ScreenScroll>
  const tone = RESULT_TONE[v.result ?? ''] ?? RESULT_TONE.succeeded

  return (
    <ScreenScroll>
      <Header title={v.crime?.name ?? 'نتیجه‌ی جرم'} tone="ruby" onBack={() => run('crime.hub')} />

      <Card tone={tone.card}>
        <ListRow icon={tone.icon} palette={tone.palette} title={tone.label} sub={v.venue?.name} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {!!v.take && <Chip tone="gold">{money(v.take)} به دست آوردی</Chip>}
          {v.dry_spell && <Chip>سهمیه‌ی امروز پر شده بود</Chip>}
          {!!v.xp && <Chip>{formatNumber(v.xp)} تجربه</Chip>}
          {!!v.criminal_xp && <Chip tone="ruby">{formatNumber(v.criminal_xp)} تجربه‌ی جنایی</Chip>}
          {!!v.level && <Chip tone="emerald">رسیدی به سطح {formatNumber(v.level)}</Chip>}
        </div>
      </Card>

      {v.jail && <Notice alert>دستگیر شدی · {hms(v.jail.remaining_seconds)} حبس</Notice>}
      {!!v.fine && <Notice alert>جریمه {money(v.fine)}{v.fine_paid ? ` · ${money(v.fine_paid)} پرداخت شد` : ''}</Notice>}

      {!!(v.loot && v.loot.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>غنیمت</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {v.loot!.map((l, i) => <span key={i} className="nx-chip nx-chip-gold">{l.name ?? l.code}</span>)}
          </div>
        </Card>
      )}

      {!!(v.skills && v.skills.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.skills!.map((s, i) => (
            <ListRow key={i} icon="chart" palette="violet" title={s.skill ?? '—'}
              sub={`${formatNumber(s.xp ?? 0)} تجربه${s.level ? ` · رسید به سطح ${formatNumber(s.level)}` : ''}`} />
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
  if (loading && !response) return <ScreenScroll><Header title="جرم" tone="ruby" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="جرم آغاز شد" tone="ruby" onBack={() => run('crime.hub')} />
      <Card tone="ruby">
        <ListRow icon="clock" palette="ruby" title={v.crime?.name ?? '—'} sub={v.venue?.name} />
        <div style={{ marginTop: 10 }}>
          <Bar frac={0} color="var(--anar)" label={`${hms(v.duration_seconds)} تا پایان`} />
        </div>
        {v.nerve && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            عصب باقی‌مانده: {formatNumber(v.nerve.nerve ?? 0)}/{formatNumber(v.nerve.max ?? 0)}
          </div>
        )}
      </Card>
      <Notice>نتیجه وقتی جرم تمام شد، در همین‌جا اعلام می‌شود.</Notice>
      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
