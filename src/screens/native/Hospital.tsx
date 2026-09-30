import type { ScreenProps } from '../types'
import { Header, ListRow, Notice, Ring, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import Icon from '../../ui/Icon'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface Clinic { clinic?: Named; price?: number; doctor?: number; open?: boolean; stock?: number; saves_seconds?: number; can_treat?: boolean }
interface HospitalView {
  health?: number; max?: number; full_in_seconds?: number; city?: string
  in_hospital?: boolean; cause?: string; remaining_seconds?: number
  treated?: boolean; clinics?: Clinic[] | null
}

const CAUSES = ['crime', 'mugged', 'shift', 'fight']
const causeText = (c: string) => (CAUSES.includes(c) ? t(`hospital.cause.${c}` as Key) : c)

export default function Hospital({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as HospitalView
  if (loading && !response) return <ScreenScroll><Header title={t('hospital.title')} tone="ruby" /></ScreenScroll>

  const frac = v.max ? clamp01((v.health ?? 0) / v.max) : 1

  return (
    <ScreenScroll>
      <Header title={t('hospital.title')} tone="ruby" onRefresh={() => run('health.hospital')} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        {v.in_hospital && v.cause && <span className="nx-chip nx-chip-ruby">{causeText(v.cause)}</span>}
        <Ring frac={frac} color={v.in_hospital ? 'var(--anar)' : 'var(--leaf)'} size={110}>
          <Icon name="health" palette={v.in_hospital ? 'ruby' : 'emerald'} size={32} />
        </Ring>
        {v.in_hospital ? (
          <>
            <div className="display" style={{ fontSize: 22, color: '#ff9a9e' }}>{t('hospital.discharge', { t: hms(v.remaining_seconds) })}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('hospital.health_of', { a: formatNumber(v.health ?? 0), b: formatNumber(v.max ?? 0) })}</div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {t('hospital.health', { a: formatNumber(v.health ?? 0), b: formatNumber(v.max ?? 0) })}
            {!!v.full_in_seconds && ` · ${t('hospital.full_in', { t: hms(v.full_in_seconds) })}`}
          </div>
        )}
      </div>

      {v.treated && <Notice>{t('hospital.treated')}</Notice>}

      {!!(v.clinics && v.clinics.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nx-sec">{t('hospital.clinics')}</div>
          {v.clinics!.map((c, i) => (
            <ListRow key={i} icon="stetho" palette={c.can_treat ? 'emerald' : 'steel'}
              title={c.clinic?.name ?? '—'}
              sub={c.open ? `${t('hospital.doctor', { n: formatNumber(c.doctor ?? 0) })}${c.saves_seconds ? ` · ${t('hospital.saves', { t: hms(c.saves_seconds) })}` : ''}` : t('hospital.closed')}
              right={c.price ? money(c.price) : undefined} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="health.hospital" />
    </ScreenScroll>
  )
}
