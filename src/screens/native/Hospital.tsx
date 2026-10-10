import type { ScreenProps } from '../types'
import { Empty, Header, ListRow, Notice, Ring, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money, roughDuration } from './kit/format'
import Icon from '../../ui/Icon'
import { t, type Key } from '../../i18n'
import { useContentNames } from '../../village/useVillage'
import { careWord, useCare } from '../../support/care'

interface Named { code?: string; name?: string }
interface Clinic { provider?: string; clinic?: Named; price?: number; doctor?: number; open?: boolean; stock?: number; saves_seconds?: number; can_treat?: boolean }
interface HospitalView {
  health?: number; max?: number; full_in_seconds?: number; city?: string
  city_code?: string; in_hospital?: boolean; cause?: string; remaining_seconds?: number
  treated?: boolean; treated_by?: Clinic | null; city_hospital?: Clinic | null; clinics?: Clinic[] | null
}

const CAUSES = ['crime', 'mugged', 'shift', 'fight']
const causeText = (c: string) => (CAUSES.includes(c) ? t(`hospital.cause.${c}` as Key) : c)

export default function Hospital({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as HospitalView
  const names = useContentNames()
  // «بیمارستان» is the name only in a city or the central city; a founded village's care place is «خانهٔ بهداشت»
  const care = useCare()
  const inCity = !!v.city_code && names.name('city', v.city_code, '') !== ''
  const title = inCity || !v.city_code ? t('hospital.title') : t('ac.health.village_title')
  if (loading && !response) return <ScreenScroll><Header title={title} tone="ruby" /></ScreenScroll>
  const treat = (code: string) => (response?.actions ?? []).find((a) => a.id === 'health.treat' && a.args?.provider === code)

  const frac = v.max ? clamp01((v.health ?? 0) / v.max) : 1

  return (
    <ScreenScroll>
      <Header title={title} tone="ruby" onRefresh={() => run('health.hospital')} />

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
            {!!v.full_in_seconds && ` – ${t('hospital.full_in', { t: hms(v.full_in_seconds) })}`}
          </div>
        )}
      </div>

      {!v.in_hospital && !(v.clinics ?? []).length && <Empty>{t('ac.health.out_hint')}</Empty>}
      {v.treated && <Notice>{t('hospital.treated')}</Notice>}

      {v.city_hospital && treat('city') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nx-sec">{t('ac.health.treat_title')}</div>
          <ListRow icon="hospital" palette="ruby" title={t(({ hospital: 'ac.health.city_hospital', house: 'ac.health.health_house', plain: 'ac.health.care_plain' } as const)[careWord(care)])}
            sub={v.city_hospital.saves_seconds ? t('hospital.saves', { t: roughDuration(v.city_hospital.saves_seconds) }) : undefined}
            right={v.city_hospital.price ? money(v.city_hospital.price) : t('common.free')}
            onClick={() => onAction(treat('city')!)} />
        </div>
      )}

      {!!(v.clinics && v.clinics.length) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nx-sec">{t('hospital.clinics')}</div>
          {v.clinics!.map((c, i) => (
            <ListRow key={i} icon="stetho" palette={c.can_treat ? 'emerald' : 'steel'}
              title={c.clinic?.name ?? '—'}
              sub={c.open ? `${t('hospital.doctor', { n: formatNumber(c.doctor ?? 0) })}${c.saves_seconds ? ` – ${t('hospital.saves', { t: roughDuration(c.saves_seconds) })}` : ''}` : t('hospital.closed')}
              right={c.price ? money(c.price) : undefined}
              onClick={c.clinic?.code && treat(c.clinic.code) ? () => onAction(treat(c.clinic!.code!)!) : undefined} />
          ))}
        </div>
      )}

      <Actions response={response} onAction={onAction} only={(a) => a.id !== 'health.treat'} refreshCommand="health.hospital" />
    </ScreenScroll>
  )
}
