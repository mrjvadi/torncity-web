import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, Ring, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import Icon from '../../ui/Icon'

interface Named { code?: string; name?: string }
interface Clinic { clinic?: Named; price?: number; doctor?: number; open?: boolean; stock?: number; saves_seconds?: number; can_treat?: boolean }
interface HospitalView {
  health?: number; max?: number; full_in_seconds?: number; city?: string
  in_hospital?: boolean; cause?: string; remaining_seconds?: number
  treated?: boolean; clinics?: Clinic[] | null
}

const CAUSE_FA: Record<string, string> = { crime: 'در جیب‌بری', mugged: 'مورد سرقت', shift: 'حادثه‌ی کاری', fight: 'درگیری' }

export default function Hospital({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as HospitalView
  if (loading && !response) return <ScreenScroll><Header title="بیمارستان" tone="ruby" /></ScreenScroll>

  const frac = v.max ? clamp01((v.health ?? 0) / v.max) : 1

  return (
    <ScreenScroll>
      <Header title="بیمارستان" tone="ruby" onRefresh={() => run('health.hospital')} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        {v.in_hospital && v.cause && <span className="nx-chip nx-chip-ruby">{CAUSE_FA[v.cause] ?? v.cause}</span>}
        <Ring frac={frac} color={v.in_hospital ? 'var(--anar)' : 'var(--leaf)'} size={110}>
          <Icon name="health" palette={v.in_hospital ? 'ruby' : 'emerald'} size={32} />
        </Ring>
        {v.in_hospital ? (
          <>
            <div className="display" style={{ fontSize: 22, color: '#ff9a9e' }}>مرخص: {hms(v.remaining_seconds)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>سلامت {formatNumber(v.health ?? 0)} از {formatNumber(v.max ?? 0)}</div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            سلامت {formatNumber(v.health ?? 0)}/{formatNumber(v.max ?? 0)}
            {!!v.full_in_seconds && ` · پر در ${hms(v.full_in_seconds)}`}
          </div>
        )}
      </div>

      {v.treated && <Notice>این بستری قبلاً درمان شده.</Notice>}

      {!!(v.clinics && v.clinics.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nx-sec">درمانگاه‌ها</div>
          {v.clinics!.map((c, i) => (
            <ListRow key={i} icon="stetho" palette={c.can_treat ? 'emerald' : 'steel'}
              title={c.clinic?.name ?? '—'}
              sub={c.open ? `پزشک ${formatNumber(c.doctor ?? 0)}${c.saves_seconds ? ` · ${hms(c.saves_seconds)} کمتر` : ''}` : 'تعطیل'}
              right={c.price ? money(c.price) : undefined} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="health.hospital" />
    </ScreenScroll>
  )
}
