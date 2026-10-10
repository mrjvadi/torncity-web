// «ساختن در خانه» (ADR 0068), on the «کارکنان» tab of «مدیریت قطعهٔ من»: what the home's stations can make (inputs, outputs, minutes), the batches
// (1 to the most), the jobs running (two at most) with their time left, and the start through a centred confirm. The goods leave the owner's home
// store at the start and come back at the home yield when the job ends.

import { useEffect, useState } from 'react'
import type { LotCraftLine, MaterialLine } from '../../api/views.gen'
import { ActionButton, Note, Section } from '../../ui/Popup'
import Popup from '../../ui/Popup'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { formatNumber } from '../native/kit/format'
import { durationText } from './common'
import { hasKey, t, type Key } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'

/** The stations the recipes stand at, in the card's own order (stations first, then any recipe with none named). */
function stationsOf(c: LotCraftLine): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of c.recipes ?? []) { const k = r.station || ''; if (!seen.has(k)) { seen.add(k); out.push(k) } }
  const order = c.stations ?? []
  return out.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
}

export default function LotCraft({ c, buildingId, manage, busy, names, onStart }: {
  c: LotCraftLine; buildingId: string; manage: boolean; busy: boolean; names: ContentNames
  /** sends settlement.craft through the host (a write; the answer is the craft_started page) */
  onStart: (recipe: string, batches: number) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [n, setN] = useState(1)
  const [, tick] = useState(0)
  useEffect(() => { const id = window.setInterval(() => tick((x) => x + 1), 20000); return () => window.clearInterval(id) }, [])
  void buildingId
  const gname = (m: MaterialLine) => names.name(['component', 'item'], m.component.code, m.component.name)
  const line = (l: MaterialLine[] | null, k = 1, yieldBps = 10000) => (l ?? []).map((m) => `${formatNumber(Math.floor((m.quantity * k * yieldBps) / 10000))} ${gname(m)}`).join('، ')
  const rec = (c.recipes ?? []).find((r) => r.code === pick) ?? null
  const full = (c.jobs ?? []).length >= c.max_jobs
  const have = (code: string) => (c.have ?? []).find((h) => h.component.code === code)?.quantity ?? 0
  const lacking = rec ? (rec.inputs ?? []).filter((i) => have(i.component.code) < i.quantity * n) : []
  return (
    <div className="lm-keeper lm-craft">
      <Section>{t('craft.title')}</Section>
      {(c.stations ?? []).length > 0 && <div className="gc-note">{t('craft.stations', { list: (c.stations ?? []).map((s) => (hasKey(`craft.station.${s}`) ? t(`craft.station.${s}` as Key) : s)).join('، ') })}</div>}
      {(c.jobs ?? []).length > 0 && (
        <div className="vf-list">
          {(c.jobs ?? []).map((j) => {
            const left = j.finish_at ? Math.max(0, Math.round((Date.parse(j.finish_at) - Date.now()) / 1000)) : j.left_seconds
            return <div key={j.id} className="vf-line"><span>{t('craft.job', { name: j.recipe.name, n: formatNumber(j.batches) })}</span><b>{left > 0 ? t('craft.left', { t: durationText(left) }) : t('craft.done')}</b></div>
          })}
        </div>
      )}
      {full && <Note>{t('craft.full', { n: formatNumber(c.max_jobs) })}</Note>}
      {(c.recipes ?? []).length === 0 && <Note>{t('craft.none')}</Note>}
      {stationsOf(c).map((st) => {
        const group = (c.recipes ?? []).filter((r) => (r.station || '') === st)
        return (
          <div key={st || 'any'} className="lm-craft-st">
            {st && <div className="lm-craft-sth">{hasKey(`craft.station.${st}`) ? t(`craft.station.${st}` as Key) : st}</div>}
            <CardGrid>
        {group.map((r) => (
                <PCard key={r.code} icon="tool" title={r.name.name} tone={r.available ? 'busy' : 'off'} off={!r.available}
                  sub={t('craft.minutes', { n: formatNumber(r.minutes) })}
                  facts={r.available ? <><span>{t('rc.in', { list: line(r.inputs) })}</span><br /><span>{t('rc.out', { list: line(r.outputs, 1, c.yield_bps) })}</span></> : <span className="dk-why">{t('rc.locked', { list: (r.missing ?? []).map((m) => m.name).join('، ') || '—' })}</span>}
                  onClick={manage && r.available && !full ? () => { setPick(r.code); setN(1) } : undefined} />
              ))}
            </CardGrid>
          </div>
        )
      })}
      {rec && (
        <Popup open onClose={() => setPick(null)} tone="gold" title={t('craft.confirm_title', { name: rec.name.name })}
          footer={<div className="lm-craft-foot">
            <ActionButton tone="steel" small onClick={() => setPick(null)} disabled={busy}>{t('building.no')}</ActionButton>
            <ActionButton tone="gold" disabled={busy || lacking.length > 0} onClick={() => { const r = rec.code; setPick(null); onStart(r, n) }}>{t('craft.start')}</ActionButton>
          </div>}>
          <div className="lm-keeper-step">
            <button type="button" className="lm-keeper-pm" aria-label={t('craft.less')} disabled={n <= 1} onClick={() => setN(n - 1)}>−</button>
            <div className="lm-keeper-val">{t('craft.batches', { n: formatNumber(n) })}</div>
            <button type="button" className="lm-keeper-pm" aria-label={t('craft.more')} disabled={n >= c.max_batches} onClick={() => setN(n + 1)}>+</button>
          </div>
          <div className="vf-list">
            <div className="vf-line"><span>{t('craft.takes')}</span><b>{line(rec.inputs, n)}</b></div>
            <div className="vf-line"><span>{t('craft.makes')}</span><b>{line(rec.outputs, n, c.yield_bps)}</b></div>
            <div className="vf-line"><span>{t('craft.time')}</span><b>{durationText(rec.minutes * n * 60)}</b></div>
          </div>
          <div className="gc-note">{t('craft.yield', { p: `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(c.yield_bps / 100)}٪` })}</div>
          {lacking.length > 0 && <Note tone="bad">{t('craft.lacking', { list: lacking.map((i) => `${gname(i)} (${formatNumber(have(i.component.code))} ${t('wp.of')} ${formatNumber(i.quantity * n)})`).join('، ') })}</Note>}
        </Popup>
      )}
    </div>
  )
}
