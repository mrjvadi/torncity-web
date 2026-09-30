import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, money, pct } from './kit/format'
import { t, type Key } from '../../i18n'

interface Named { code?: string; name?: string }
interface Office { code?: string; holders?: Named[] | null; seats?: number }
interface Lever { code?: string; type?: string; value?: number; held_by?: string; vote?: boolean }
interface Section { place?: Named; offices?: Office[] | null; levers?: Lever[] | null }
interface CityGovView { city?: Named; holds_office?: boolean; no_city?: boolean; sections?: Section[] | null }

const OFFICES = ['mayor', 'deputy_mayor', 'city_council', 'president']
const LEVERS = ['city.tax_rate', 'city.minimum_wage', 'city.shift_window_hours']
const officeText = (o?: string) => (o && OFFICES.includes(o) ? t(`office.${o}` as Key) : o ?? '')
const leverText = (l?: string) => (l && LEVERS.includes(l) ? t(`gov.lever.${l}` as Key) : l ?? '')

function leverValue(l: Lever): string {
  if (l.value === undefined) return '—'
  if (l.type === 'bps') return pct(l.value / 10000)
  if (l.type === 'money') return money(l.value)
  return formatNumber(l.value)
}

export default function Governance({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CityGovView
  if (loading && !response) return <ScreenScroll><Header title={t('gov.title')} tone="gold" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title={t('gov.title')} tone="gold" /><Notice>{t('property.no_city')}</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('gov.title')} tone="gold" onRefresh={() => run('gov.city')} />
      {v.holds_office && <Notice>{t('gov.holds')}</Notice>}

      {(v.sections ?? []).map((s, si) => (
        <Card key={si}>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{s.place?.name ?? '—'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: s.levers?.length ? 12 : 0 }}>
            {(s.offices ?? []).map((o, oi) => (
              <div key={oi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--text-dim)' }}>{officeText(o.code)}</span>
                <span style={{ color: 'var(--text)' }}>{o.holders?.length ? o.holders.map((h) => h.name).join(`${t('common.sep')} `) : t('gov.empty_seat')}</span>
              </div>
            ))}
          </div>

          {!!(s.levers && s.levers.length) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.levers!.map((l, li) => (
                <div key={li} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{leverText(l.code)}</span>
                  <span className="display" style={{ fontSize: 14, color: 'var(--gold)' }}>{leverValue(l)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Actions response={response} onAction={onAction} refreshCommand="gov.city" />
    </ScreenScroll>
  )
}
