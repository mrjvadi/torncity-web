// The build panel: the catalogue, then the lot step (rotate, hint), then the
// price. Pure view over useBuildMode's state; chrome is the kit's frame,
// slabs, plates and chips.

import { Frame, Slab, Plate, Emboss, GLabel } from '../../kit'
import type { CatalogueBuilding } from '../../api/types'
import { t } from '../../i18n'
import { formatNumber, money } from '../native/kit/format'
import { blockReason, isMulti, type BuildState } from './useBuildMode'
import { buildingName, useContentNames } from '../../village/useVillage'
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
  onUndo: () => void
  onClear: () => void
  onPathMode: (on: boolean) => void
  onGrowAsk: () => void
  onGrowConfirm: () => void
}

const OK = '#40d96b', BAD = '#eb4a40', TAKEN = '#9aa0b4'

export default function BuildPanel({ state: s, fits, footprint: fp, cat, onExit, onChoose, onRotate, onNext, onConfirm, onBack, onUndo, onClear, onPathMode, onGrowAsk, onGrowConfirm }: Props) {
  const names = useContentNames()
  const name = s.code ? buildingName(cat, s.code, s.lots?.building.name ?? s.confirm?.building.name ?? s.batch?.building.name) : ''
  const multi = isMulti(cat, s.code)
  const unit = s.menu?.lines?.find((l) => l.building.code === s.code)
  const total = (unit?.cost_money ?? 0) * s.picks.length
  return (
    <Frame radius={20}>
      <div className="vh-panel">
        <div className="vh-panel-head">
          {s.step !== 'menu' ? <button className="vh-x" onClick={onBack} aria-label={t('build.back')}>›</button> : <span style={{ width: 34 }} />}
          <GLabel className="vh-panel-title" top="#fff6c8" bottom="#ffb21f" stroke={1}>
            {s.step === 'menu' ? t('build.choose') : s.step === 'grow' ? t('grow.title') : name}
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
                      ? <span className="vh-card-meta">{t('build.needs', { list: (l.missing ?? []).map((m) => names.name('knowledge', m.code, m.name)).join('، ') })}</span>
                      : <>
                        <span className="vh-card-cost">{money(l.cost_money)}</span>
                        <span className="vh-card-meta">{durationText(l.build_time_seconds)}{fpc ? ` · ${fpc[0]}×${fpc[1]}` : ''}</span>
                      </>}
                  </button>
                )
              })}
              {s.menu && (
                <button className="vh-card" disabled={s.busy} onClick={onGrowAsk}>
                  <Plate size={38} square><Emboss name="world" palette="emerald" size={24} /></Plate>
                  <span className="vh-card-name">{t('grow.button')}</span>
                  <span className="vh-card-meta">{t('grow.card_hint')}</span>
                </button>
              )}
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
            {multi ? (
              <>
                <div className="vh-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="vh-modes">
                    <button className={`vh-mode${!s.pathMode ? ' on' : ''}`} onClick={() => onPathMode(false)}>{t('build.multi.mode_tap')}</button>
                    <button className={`vh-mode${s.pathMode ? ' on' : ''}`} onClick={() => onPathMode(true)}>{t('build.multi.mode_path')}</button>
                  </span>
                  <span className="vh-multi-total">
                    <span>{t('build.multi.count', { n: s.picks.length })}</span>
                  </span>
                </div>
                <div className="vh-hint">{s.picks.length ? '' : t(s.pathMode ? 'build.multi.path_hint' : 'build.multi.hint')}</div>
                {s.badLots.length > 0 && <div className="vh-bad-lots">{t('build.batch.refused', { n: s.badLots.length })}</div>}
                <div className="vh-multi-total"><span>{t('build.multi.total')}</span><b>{money(total)}</b></div>
                <div className="vh-row">
                  <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onUndo} disabled={!s.picks.length || s.busy}>↶ {t('build.multi.undo')}</Slab>
                  <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onClear} disabled={!s.picks.length || s.busy}>{t('build.multi.clear')}</Slab>
                  <Slab tone="gold" radius={14} lip={4} onClick={onNext} disabled={!s.picks.length || s.busy}>{t('build.next')}</Slab>
                </div>
              </>
            ) : (
              <>
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
          </>
        )}

        {s.step === 'confirm' && s.batch && (
          <>
            <div className="vh-facts">
              <span>{t('build.multi.count', { n: s.batch.count })}</span>
              <span>{t('build.cost')}: <b>{money(s.batch.cost_money)}</b></span>
              <span style={{ gridColumn: '1 / -1' }}>{t('build.time')}: <b>{durationText(s.batch.build_time_seconds)}</b> · {t('build.batch.together')}</span>
            </div>
            <div className="vh-row">
              <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onBack} disabled={s.busy}>{t('build.back')}</Slab>
              <Slab tone="green" radius={14} lip={4} onClick={onConfirm} disabled={s.busy}>{t('build.multi.start')}</Slab>
            </div>
          </>
        )}

        {s.step === 'grow' && s.grow && (
          <>
            <div className="vh-facts">
              <span>{t('grow.side', { a: s.grow.side, b: s.grow.new_side })}</span>
              <span>{t('grow.lots', { n: s.grow.lots_gained, m: s.grow.buildable_gained })}</span>
              <span>{t('build.cost')}: <b>{money(s.grow.price)}</b></span>
              <span>{t('build.treasury')}: <b>{money(s.grow.treasury)}</b></span>
            </div>
            <div className="vh-hint">{t('grow.note')}</div>
            <div className="vh-row">
              <Slab tone="steel" radius={14} lip={4} className="narrow" onClick={onBack} disabled={s.busy}>{t('build.back')}</Slab>
              <Slab tone="green" radius={14} lip={4} onClick={onGrowConfirm} disabled={s.busy || s.grow.treasury < s.grow.price}>{t('grow.confirm')}</Slab>
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
              {(s.confirm.auto_roads ?? 0) > 0 && (
                <span style={{ gridColumn: '1 / -1' }}>{t('build.auto_roads', { n: s.confirm.auto_roads ?? 0 })}</span>
              )}
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
