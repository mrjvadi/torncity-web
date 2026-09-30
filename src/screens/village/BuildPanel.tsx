// The build panel: the catalogue, then the lot step (rotate, hint), then the
// price. Pure view over useBuildMode's state; chrome is the kit's frame,
// slabs, plates and chips.

import { Frame, Slab, Plate, Emboss, GLabel } from '../../kit'
import type { CatalogueBuilding } from '../../api/types'
import { t } from '../../i18n'
import { formatNumber, money } from '../native/kit/format'
import { blockReason, type BuildState } from './useBuildMode'
import { buildingName } from '../../village/useVillage'
import { durationText, iconForRole } from './common'

interface Props {
  state: BuildState
  fits: boolean
  footprint: { w: number; h: number }
  cat: Map<string, CatalogueBuilding>
  onExit: () => void
  onChoose: (code: string) => void
  onRotate: () => void
  onNext: () => void
  onConfirm: () => void
  onBack: () => void
}

const OK = '#40d96b', BAD = '#eb4a40', TAKEN = '#9aa0b4'

export default function BuildPanel({ state: s, fits, footprint: fp, cat, onExit, onChoose, onRotate, onNext, onConfirm, onBack }: Props) {
  const name = s.code ? buildingName(cat, s.code, s.lots?.building.name ?? s.confirm?.building.name) : ''
  return (
    <Frame radius={20}>
      <div className="vh-panel">
        <div className="vh-panel-head">
          {s.step !== 'menu' ? <button className="vh-x" onClick={onBack} aria-label={t('build.back')}>›</button> : <span style={{ width: 34 }} />}
          <GLabel className="vh-panel-title" top="#fff6c8" bottom="#ffb21f" stroke={1}>
            {s.step === 'menu' ? t('build.choose') : name}
          </GLabel>
          <button className="vh-x" onClick={onExit} aria-label={t('build.exit')}>✕</button>
        </div>

        {s.step === 'menu' && (
          <>
            <div className="vh-legend">
              <span><i className="vh-dot" style={{ background: OK }} />{t('build.legend.ok')}</span>
              <span><i className="vh-dot" style={{ background: BAD }} />{t('build.legend.bad')}</span>
              <span><i className="vh-dot" style={{ background: TAKEN }} />{t('build.legend.taken')}</span>
              {s.menu && <span style={{ marginInlineStart: 'auto' }}>{t('build.queue', { n: s.menu.running_builds, cap: s.menu.concurrent_cap })}</span>}
            </div>
            <div className="vh-cards">
              {(s.menu?.lines ?? []).map((l) => {
                const locked = l.state !== 'available'
                const { icon, palette } = iconForRole(l.role)
                const fpc = cat.get(l.building.code)?.footprint
                return (
                  <button key={l.building.code} className={`vh-card${locked ? ' locked' : ''}`} disabled={locked || s.busy} onClick={() => onChoose(l.building.code)}>
                    <Plate size={38} square><Emboss name={icon} palette={locked ? 'steel' : palette} size={24} /></Plate>
                    <span className="vh-card-name">{buildingName(cat, l.building.code, l.building.name)}</span>
                    {locked
                      ? <span className="vh-card-meta">{t('build.needs', { list: (l.missing ?? []).map((m) => m.name).join('، ') })}</span>
                      : <>
                        <span className="vh-card-cost">{money(l.cost_money)}</span>
                        <span className="vh-card-meta">{durationText(l.build_time_seconds)}{fpc ? ` · ${fpc[0]}×${fpc[1]}` : ''}</span>
                      </>}
                  </button>
                )
              })}
              {!s.menu && <div className="vh-hint" style={{ width: '100%' }}>…</div>}
              {s.menu && !(s.menu.lines ?? []).length && <div className="vh-hint" style={{ width: '100%' }}>{t('build.empty')}</div>}
            </div>
          </>
        )}

        {s.step === 'lot' && s.lots && (
          <>
            <div className="vh-legend">
              <span><i className="vh-dot" style={{ background: OK }} />{t('build.legend.ok')}</span>
              <span><i className="vh-dot" style={{ background: BAD }} />{t('build.legend.bad')}</span>
              <span><i className="vh-dot" style={{ background: TAKEN }} />{t('build.legend.taken')}</span>
              <span style={{ marginInlineStart: 'auto' }}>{t('build.footprint', { w: fp.w, h: fp.h })}</span>
            </div>
            {s.anchor
              ? <div className={`vh-hint ${fits ? 'good' : 'bad'}`}>
                {t('build.lot', { x: s.anchor.x + 1, y: s.anchor.y + 1 })} · {fits ? t('build.fits') : (blockReason(s.lots, s.anchor, fp.w, fp.h) ?? t('build.no_fit'))}
              </div>
              : <div className="vh-hint">{t('build.choose_lot')}</div>}
            <div className="vh-row">
              {s.lots.can_rotate && <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onRotate} disabled={s.busy}>↻ {t('build.rotate')}</Slab>}
              <Slab tone="gold" radius={14} lip={4} onClick={onNext} disabled={!fits || s.busy}>{t('build.next')}</Slab>
            </div>
          </>
        )}

        {s.step === 'confirm' && s.confirm && (
          <>
            <div className="vh-facts">
              <span>{t('build.cost')}: <b>{money(s.confirm.cost_money)}</b></span>
              <span>{t('build.time')}: <b>{durationText(s.confirm.build_time_seconds)}</b></span>
              <span>{t('build.lot', { x: s.confirm.x + 1, y: s.confirm.y + 1 })}</span>
              <span>{t('build.footprint', { w: fp.w, h: fp.h })}</span>
              {(s.confirm.materials ?? []).map((m) => (
                <span key={m.component.code} style={{ gridColumn: '1 / -1' }}>{t('build.materials')}: <b>{m.component.name} × {formatNumber(m.quantity)}</b></span>
              ))}
            </div>
            <div className="vh-row">
              <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onBack} disabled={s.busy}>{t('build.back')}</Slab>
              <Slab tone="green" radius={14} lip={4} onClick={onConfirm} disabled={s.busy}>{t('build.start')}</Slab>
            </div>
          </>
        )}
      </div>
    </Frame>
  )
}
