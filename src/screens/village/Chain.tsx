// «زنجیرهٔ ساخت» (ADR 0075): the chain calculator (a target and a rate; the chain upstream with the starved links red and «+N», the raw goods, the sentence for the
// first starved link) and the «نسبت‌ها» block of a workplace panel (what one building makes and uses an hour, and a need/have bar per input).

import { useEffect, useState } from 'react'
import * as api from '../../api/client'
import type { ChainNodeLine, ChainView } from '../../api/views.gen'
import { Hint, Lead, Page, Panel, flow, type FlowCtx } from './flow'
import { SectionTitle } from '../native/kit/Parts'
import { ActionButton, EffectChip, Note, Section } from '../../ui/Popup'
import { formatNumber } from '../native/kit/format'
import { t } from '../../i18n'
import { useContentNames } from '../../village/useVillage'

/** Thousandths of a unit an hour as a readable number: ۱٫۵. */
export const perHour = (milli: number): string => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(milli / 1000)

function Bar({ need, have }: { need: number; have: number }) {
  const f = need <= 0 ? 1 : Math.min(1, have / need)
  return <div className="mn-bar"><i className={have < need ? 'bad' : ''} style={{ width: `${f * 100}%` }} /></div>
}

/** The ratio block of one kind of workplace (the node whose code is the building's). */
export function RatioBlock({ node, names }: { node: ChainNodeLine; names: ReturnType<typeof useContentNames> }) {
  const g = (i: { code: string; name: string }) => names.name(['component', 'item'], i.code, i.name)
  return (
    <div className="mn-ratio">
      <Section>{t('ch.ratios')}</Section>
      <div className="gc-note">{t('ch.built', { b: formatNumber(node.built), r: formatNumber(node.running) })}</div>
      {(node.out ?? []).length > 0 && <div className="vf-line"><span>{t('ch.makes')}</span><b>{(node.out ?? []).map((o) => `${perHour(o.milli)} ${g(o.item)}`).join('، ')} {t('ch.per_hour')}</b></div>}
      {(node.in ?? []).length > 0 && <div className="vf-line"><span>{t('ch.uses')}</span><b>{(node.in ?? []).map((o) => `${perHour(o.milli)} ${g(o.item)}`).join('، ')} {t('ch.per_hour')}</b></div>}
      {(node.feeds ?? []).map((f) => (
        <div key={f.item.code} className="mn-feed">
          <div className="vf-line"><span>{g(f.item)}</span><b className={f.have_milli < f.need_milli ? 'bad' : ''}>{t('ch.need_have', { a: perHour(f.need_milli), b: perHour(f.have_milli) })}</b></div>
          <Bar need={f.need_milli} have={f.have_milli} />
          {(f.makers ?? []).length > 0 && <div className="mn-sub">{t('ch.makers', { list: (f.makers ?? []).map((m) => m.name).join('، ') })}{f.stock > 0 ? ` – ${t('ch.stock', { n: formatNumber(f.stock) })}` : ''}</div>}
        </div>
      ))}
    </div>
  )
}

/** Reads the chain's nodes once (when a workplace panel opens) and hands the one whose code is `code`. */
export function useNode(code: string | undefined): ChainNodeLine | null {
  const [node, setNode] = useState<ChainNodeLine | null>(null)
  useEffect(() => {
    if (!code) return
    let on = true
    api.runCommand('settlement.chain', {}).then((r) => {
      const v = r.ok === false ? null : (r.view as unknown as ChainView)
      if (on) setNode((v?.nodes ?? []).find((n) => n.node.code === code) ?? null)
    }).catch(() => undefined)
    return () => { on = false }
  }, [code])
  return node
}

export const Chain = flow<ChainView>(({ view: v, ctx }) => {
  const [rate, setRate] = useState(perHour(v.per_hour_milli || 1000).replace(/[٫]/g, '.'))
  const g = (i: { code: string; name: string }) => ctx.names.name(['component', 'item'], i.code, i.name)
  const n = Number(rate.replace(/[^0-9.]/g, '')) || 1
  if (!v.open) return <Page title={t('ch.title')} tone="sapphire"><Panel><Lead>{t('ch.off')}</Lead><Hint>{t('mn.off_hint')}</Hint></Panel></Page>
  return (
    <Page title={t('ch.title')} tone="sapphire">
      <Panel>
        <Hint>{t('ch.intro')}</Hint>
        <div className="tc-f"><span>{t('ch.target')}</span>
          <div className="rc-chips" role="radiogroup">{(v.targets ?? []).map((x) => <button key={x.code} type="button" role="radio" aria-checked={x.code === v.target.code} className={`dk-chip${x.code === v.target.code ? ' all' : ''}`} onClick={() => ctx.run('settlement.chain', { code: x.code, n: String(Math.round(n)) })}>{g(x)}</button>)}</div>
        </div>
        <label className="tc-f"><span>{t('ch.rate')}</span><input className="fx-field-input" dir="ltr" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label={t('ch.rate')} /></label>
        <ActionButton tone="gold" small disabled={ctx.busy || !v.target.code} onClick={() => ctx.run('settlement.chain', { code: v.target.code, n: String(Math.max(1, Math.round(n))) })}>{t('ch.calc')}</ActionButton>
      </Panel>
      {v.first && <Panel tone="ruby"><Lead tone="bad">{t('ch.first', { node: v.first.node.name, n: formatNumber(v.first.add), item: g(v.first.item) })}</Lead></Panel>}
      {(v.lines ?? []).length > 0 && (
        <>
          <SectionTitle>{t('ch.lines')}</SectionTitle>
          <Panel>
            <div className="mn-list">{(v.lines ?? []).map((l, i) => (
              <div key={i} className={`mn-card${l.starved ? ' starved' : ''}`} style={{ marginInlineStart: l.depth * 12 }}>
                <div className="mn-head"><b>{g(l.item)}</b>{l.starved ? <EffectChip tone="bad">{t('ch.add', { n: formatNumber(l.add) })}</EffectChip> : <EffectChip tone="good">{t('ch.enough')}</EffectChip>}</div>
                <div className="mn-sub">{t('ch.line', { node: l.node.name, a: perHour(l.need_milli), b: perHour(l.have_milli), c: formatNumber(l.count), r: formatNumber(l.running) })}</div>
                <Bar need={l.need_milli} have={l.have_milli} />
              </div>
            ))}</div>
          </Panel>
        </>
      )}
      {(v.raw ?? []).length > 0 && (
        <>
          <SectionTitle>{t('ch.raw')}</SectionTitle>
          <Panel><div className="vf-list">{(v.raw ?? []).map((r) => <div key={r.item.code} className="vf-line"><span>{g(r.item)}</span><b>{t('ch.raw_line', { a: perHour(r.need_milli), s: formatNumber(r.stock) })}</b></div>)}</div><Note>{t('ch.raw_hint')}</Note></Panel>
        </>
      )}
    </Page>
  )
})
void ({} as FlowCtx)
