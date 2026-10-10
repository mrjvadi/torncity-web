// The blocks a farm, a water work, a mill and a pasture add to a building's work panel (ADR 0067): the crop with its times and factors and the
// order to sow; the master on duty and the farms a water work serves; the toll and a citizen's own grinding; the grazing land. Data and commands
// come from `BuildingView.work`; the words are ours.

import type { FarmLine, GrazingLine, MillLine, WaterWork } from '../../api/views.gen'
import { ActionButton, EffectChip, EffectRow, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import { formatNumber } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'

type Act = ((command: string, args: Record<string, string>) => void) | undefined
const pct = (bps: number, dec = 0) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: dec }).format(bps / 100)}٪`
const word = (key: string, fallback: string) => (hasKey(key) ? t(key as Key) : fallback)
const tone = (stage: string) => (stage === 'ripe' || stage === 'harvest' ? 'good' : stage === 'overripe' || stage === 'rotted' ? 'bad' : 'neutral')

export function FarmBlock({ f, id, act, manage }: { f: FarmLine; id: string; act: Act; manage: boolean }) {
  const now = Date.now()
  const ripe = f.ripe_at ? Date.parse(f.ripe_at) : NaN
  const spoil = f.spoil_at ? Date.parse(f.spoil_at) : NaN
  const growing = f.stage === 'growing'
  const waiting = f.stage === 'ripe' || f.stage === 'overripe' || f.stage === 'harvest'
  const fac = f.factors
  const w = f.water
  return (
    <div className="wk-farm">
      <Section>{t('farm.title')}</Section>
      {f.legacy ? (
        <Note>{t('farm.legacy', { until: f.legacy_until ? atText(f.legacy_until, now) : '—' })}</Note>
      ) : (
        <>
          <EffectRow>
            <EffectChip tone={tone(f.stage)}>{word(`farm.stage.${f.stage}`, f.stage)}</EffectChip>
            {f.rainfed && <EffectChip tone="neutral">{t('farm.rainfed')}</EffectChip>}
          </EffectRow>
          <StatGrid>
            <StatCard icon="hammer" palette="amber" label={t('farm.sow_shifts')} value={t('farm.of', { a: formatNumber(f.sow_done), b: formatNumber(f.sow_need) })} />
            <StatCard icon="f_tree" palette="emerald" label={t('farm.tend_shifts')} value={t('farm.of', { a: formatNumber(f.tended), b: formatNumber(f.tend_max) })} />
            <StatCard icon="bread" palette="gold" label={t('farm.harvest_shifts')} value={t('farm.of', { a: formatNumber(f.harvest_done), b: formatNumber(f.harvest_need) })} />
            <StatCard icon="chest" palette="sapphire" label={t('farm.expected')} value={formatNumber(f.expected)} />
          </StatGrid>
          {growing && Number.isFinite(ripe) && <Note>{t('farm.ripe_at', { at: atText(ripe, now) })}</Note>}
          {waiting && Number.isFinite(spoil) && (
            <Note tone={f.stage === 'overripe' ? 'bad' : undefined}>{f.stage === 'overripe' ? t('farm.spoiling', { at: atText(spoil, now) }) : t('farm.spoil_from', { at: atText(spoil, now) })}</Note>
          )}
          {f.stage === 'rotted' && <Note tone="bad">{t('farm.rotted')}</Note>}
          <Section>{t('farm.factors')}</Section>
          <div className="vf-list">
            <div className="vf-line"><span>{t('farm.f.soil')}</span><b>{pct(fac.soil)}</b></div>
            <div className="vf-line"><span>{t('farm.f.water')}</span><b className={fac.water < 10000 ? 'bad' : ''}>{pct(fac.water)}</b></div>
            <div className="vf-line"><span>{t('farm.f.tending')}</span><b>{pct(fac.tending)}</b></div>
            {fac.loss > 0 && <div className="vf-line"><span>{t('farm.f.loss')}</span><b className="bad">{pct(fac.loss)}</b></div>}
          </div>
          {!f.rainfed && w && (
            <div className="gc-note">{w.served && w.work ? t('farm.water_from', { name: w.work.name }) : word(`farm.water.${w.reason}`, t('farm.water.other'))}</div>
          )}
          {f.rainfed && <div className="gc-note">{t('farm.rain_note')}</div>}
          {f.seed > 0 && <div className="gc-note">{t('farm.seed', { have: formatNumber(f.seed_have), need: formatNumber(f.seed) })}</div>}
          {f.can_sow && manage && act && <ActionButton tone="gold" small onClick={() => act('settlement.farm.sow', { id })}>{t('farm.sow')}</ActionButton>}
          {f.can_sow && !manage && <div className="gc-note">{t('farm.sow_head')}</div>}
        </>
      )}
    </div>
  )
}

export function WaterBlock({ w }: { w: WaterWork }) {
  const serves = w.serves ?? []
  return (
    <div className="wk-water">
      <Section>{t('water.title')}</Section>
      <EffectRow>
        <EffectChip tone={w.open ? 'good' : 'bad'}>{w.open ? t('water.on_duty') : t('water.off_duty')}</EffectChip>
        <EffectChip tone={w.condition_bps >= 5000 ? 'neutral' : 'bad'}>{t('water.condition', { p: pct(w.condition_bps) })}</EffectChip>
      </EffectRow>
      {!w.open && <Note tone="bad">{t('water.off_note')}</Note>}
      {w.condition_bps < 5000 && <Note tone="bad">{t('water.worn_note')}</Note>}
      <div className="gc-note">{serves.length ? t('water.serves', { list: serves.map((s) => s.name).join('، ') }) : t('water.serves_none')}</div>
    </div>
  )
}

const STEP = 50
export function MillBlock({ m, id, act }: { m: MillLine; id: string; act: Act }) {
  const can = m.have >= m.batch && m.batch > 0
  return (
    <div className="wk-mill">
      <Section>{t('mill.title')}</Section>
      <StatGrid>
        <StatCard icon="coins" palette="gold" label={t('mill.toll')} value={pct(m.toll_bps, 1)} />
        <StatCard icon="bread" palette="amber" label={t('mill.range')} value={`${pct(m.min_bps, 1)} ${t('mill.to')} ${pct(m.max_bps, 1)}`} />
      </StatGrid>
      {m.can_set && act && (
        <div className="lm-keeper-step">
          <button type="button" className="lm-keeper-pm" aria-label={t('mill.less')} disabled={m.toll_bps - STEP < m.min_bps} onClick={() => act('settlement.mill.toll', { bps: String(Math.max(m.min_bps, m.toll_bps - STEP)) })}>−</button>
          <div className="lm-keeper-val">{t('mill.toll_is', { p: pct(m.toll_bps, 1) })}</div>
          <button type="button" className="lm-keeper-pm" aria-label={t('mill.more')} disabled={m.toll_bps + STEP > m.max_bps} onClick={() => act('settlement.mill.toll', { bps: String(Math.min(m.max_bps, m.toll_bps + STEP)) })}>+</button>
        </div>
      )}
      <Section>{t('mill.own')}</Section>
      <div className="gc-note">{t('mill.own_note', { batch: formatNumber(m.batch), have: formatNumber(m.have), toll: formatNumber(m.toll_units) })}</div>
      {act && <ActionButton tone="green" small disabled={!can} onClick={() => act('settlement.mill.grind', { id })}>{t('mill.grind')}</ActionButton>}
      {!can && <div className="gc-note">{t('mill.no_grain')}</div>}
    </div>
  )
}

export function GrazingBlock({ g }: { g: GrazingLine }) {
  const ok = g.open >= g.need
  return (
    <div className="wk-grazing">
      <Section>{t('graze.title')}</Section>
      <Note tone={ok ? undefined : 'bad'}>{t(ok ? 'graze.ok' : 'graze.short', { open: formatNumber(g.open), need: formatNumber(g.need), radius: formatNumber(g.radius) })}</Note>
    </div>
  )
}
