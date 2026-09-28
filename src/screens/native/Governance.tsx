import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll } from './kit/Parts'
import Actions from './kit/Actions'
import { formatNumber, money, pct } from './kit/format'

interface Named { code?: string; name?: string }
interface Office { code?: string; holders?: Named[] | null; seats?: number }
interface Lever { code?: string; type?: string; value?: number; held_by?: string; vote?: boolean }
interface Section { place?: Named; offices?: Office[] | null; levers?: Lever[] | null }
interface CityGovView { city?: Named; holds_office?: boolean; no_city?: boolean; sections?: Section[] | null }

const OFFICE_FA: Record<string, string> = {
  mayor: 'شهردار', deputy_mayor: 'معاون شهردار', city_council: 'عضو شورای شهر', president: 'رئیس‌جمهور',
}

function leverValue(l: Lever): string {
  if (l.value === undefined) return '—'
  if (l.type === 'bps') return pct(l.value / 10000)
  if (l.type === 'money') return money(l.value)
  return formatNumber(l.value)
}

export default function Governance({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as CityGovView
  if (loading && !response) return <ScreenScroll><Header title="دولت شهر" tone="gold" /></ScreenScroll>
  if (v.no_city) return <ScreenScroll><Header title="دولت شهر" tone="gold" /><Notice>در هیچ شهری نیستی.</Notice></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="دولت شهر" tone="gold" onRefresh={() => run('gov.city')} />
      {v.holds_office && <Notice>تو در یکی از این مقام‌ها هستی.</Notice>}

      {(v.sections ?? []).map((s, si) => (
        <Card key={si}>
          <div className="nx-sec" style={{ marginBottom: 8 }}>{s.place?.name ?? '—'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: s.levers?.length ? 12 : 0 }}>
            {(s.offices ?? []).map((o, oi) => (
              <div key={oi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: 'var(--text-dim)' }}>{OFFICE_FA[o.code ?? ''] ?? o.code}</span>
                <span style={{ color: 'var(--text)' }}>{o.holders?.length ? o.holders.map((h) => h.name).join('، ') : 'خالی'}</span>
              </div>
            ))}
          </div>

          {!!(s.levers && s.levers.length) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.levers!.map((l, li) => (
                <div key={li} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{l.code}</span>
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
