// «مدیریت قطعهٔ من» (ADR 0045 B1): the owner of a lot chooses the building's FUNCTION and what is INSIDE; the game builds it by the hiring
// board's shifts and draws it from the generated look. A centred popup (never a sheet) with tabs; every act is ask, then confirm.
// Nothing here changes by itself: the server answers `lot_manage` with the stages menu, detail, ask and done.

import { useEffect, useState } from 'react'
import type { LotManageView, LotLook, LotQuote, WorkItemLine } from '../../api/views.gen'
import type { LocalOffer } from '../../api/types'
import Popup, { ActionButton, ActionRow, Note, ProgressRow, Section, StatCard, StatGrid } from '../../ui/Popup'
import { Segmented } from '../native/kit/Parts'
import { CardGrid, PCard } from '../../ui/v6/panel'
import { formatNumber, money } from '../native/kit/format'
import { t, hasKey, type Key } from '../../i18n'
import { useVillageCommand, useContentNames } from '../../village/useVillage'
import { OfferBox } from './Offer'
import { NeedLine } from './screens'
import { flow, isBack, Hint, Page, type FlowCtx } from './flow'

type Tab = 'function' | 'rooms' | 'staff' | 'store' | 'look' | 'state'
const sup = (n: number) => `${formatNumber(n)} ${t('unit.money')}`

/** The building's look drawn as a small picture: walls, roof, windows, door side, chimney, awning and prop, from the descriptor alone. */
export function LookPreview({ look }: { look: LotLook }) {
  const stone = look.material === 'stone'
  const hue = look.hue ?? 0
  const wall = stone ? `hsl(${40 + hue} 6% 70%)` : `hsl(${34 + hue} 38% 66%)`
  const roofC = stone ? '#5d5f66' : '#8a4a35'
  const H = 28 + look.storeys * 24
  const bw = 78, x0 = 21, yb = 24 + H
  const wins = Math.max(1, Math.min(4, look.windows || 2))
  return (
    <svg className="lm-look" viewBox={`0 0 160 ${H + 52}`} role="img" aria-label={t('lm.look')}>
      <rect x="0" y={yb} width="160" height="6" fill="#7a8a5a" opacity=".5" />
      <rect x={x0} y={yb - H + 6} width={bw} height={H - 6} fill={wall} stroke="#00000030" />
      {look.roof === 'flat'
        ? <rect x={x0 - 3} y={yb - H} width={bw + 6} height="8" fill={roofC} />
        : look.roof === 'shed'
          ? <polygon points={`${x0 - 4},${yb - H + 6} ${x0 + bw + 4},${yb - H - 10} ${x0 + bw + 4},${yb - H + 6}`} fill={roofC} />
          : look.roof === 'hip'
            ? <polygon points={`${x0 - 5},${yb - H + 6} ${x0 + 14},${yb - H - 14} ${x0 + bw - 14},${yb - H - 14} ${x0 + bw + 5},${yb - H + 6}`} fill={roofC} />
            : <polygon points={`${x0 - 5},${yb - H + 6} ${x0 + bw / 2},${yb - H - 20} ${x0 + bw + 5},${yb - H + 6}`} fill={roofC} />}
      {look.chimney && <rect x={x0 + bw - 20} y={yb - H - 18} width="8" height="16" fill="#8a5a48" />}
      {Array.from({ length: look.storeys }, (_, f) => Array.from({ length: wins }, (_, i) => (
        <rect key={`${f}-${i}`} x={x0 + 8 + i * ((bw - 16) / wins) + 3} y={yb - H + 14 + f * 24} width="10" height="12" fill="#9fcdf0" stroke="#4a5b6e" />
      )))}
      <rect x={look.door === 'w' ? x0 - 2 : look.door === 'e' ? x0 + bw - 4 : x0 + bw / 2 - 6} y={yb - 22} width={look.door === 'w' || look.door === 'e' ? 6 : 12} height="22" fill="#5a3a26" />
      {look.awning && <path d={`M${x0 + 6} ${yb - 26} h${bw - 12} l6 8 h-${bw} z`} fill="#b8452f" />}
      {look.prop === 'woodpile' && <rect x="130" y={yb - 10} width="22" height="10" fill="#7a5a36" />}
      {look.prop === 'barrels' && <><ellipse cx="136" cy={yb - 6} rx="6" ry="7" fill="#6a4a2c" /><ellipse cx="148" cy={yb - 6} rx="6" ry="7" fill="#8a6a3c" /></>}
      {look.prop === 'cart' && <><rect x="128" y={yb - 12} width="26" height="6" fill="#7a5a36" /><circle cx="134" cy={yb - 4} r="4" fill="#4a3a26" /><circle cx="148" cy={yb - 4} r="4" fill="#4a3a26" /></>}
      {look.prop === 'crates' && <><rect x="130" y={yb - 10} width="10" height="10" fill="#8a6a3c" /><rect x="141" y={yb - 8} width="8" height="8" fill="#6a4a2c" /></>}
      {look.prop === 'bench' && <rect x="128" y={yb - 8} width="24" height="4" fill="#7a5a36" />}
    </svg>
  )
}

function Items({ list, names }: { list: WorkItemLine[] | null; names: ReturnType<typeof useContentNames> }) {
  const l = list ?? []
  if (!l.length) return <>—</>
  return <>{l.map((x) => `${formatNumber(x.qty)} ${names.name(['component', 'item'], x.item.code, x.item.name)}`).join('، ')}</>
}

function QuoteBlock({ q, names, ctx }: { q: LotQuote; names: ReturnType<typeof useContentNames>; ctx: FlowCtx }) {
  return (
    <>
      <StatGrid>
        {q.shifts > 0 && <StatCard icon="hammer" palette="amber" label={t('lm.q.shifts')} value={formatNumber(q.shifts)} />}
        {q.wages > 0 && <StatCard icon="coins" palette="gold" label={t('lm.q.wages')} value={money(q.wages)} />}
        {q.money > 0 && <StatCard icon="coins" palette="gold" label={t('lm.q.money')} value={money(q.money)} />}
        {q.fee_sup > 0 && <StatCard icon="coins" palette="ruby" label={t('lm.q.fee')} value={money(q.fee_sup)} />}
      </StatGrid>
      {(q.materials ?? []).length > 0 && (
        <>
          <Section>{t('lm.q.materials')}</Section>
          <div className="vf-list">
            {(q.materials ?? []).map((m) => (
              <div key={m.item.code} className="vf-line"><span>{names.name(['component', 'item'], m.item.code, m.item.name)}</span><b className={m.have < m.need ? 'bad' : ''}>{formatNumber(m.have)} / {formatNumber(m.need)}</b></div>
            ))}
          </div>
          <Hint>{t('lm.q.from_store')}</Hint>
        </>
      )}
      {(q.salvage ?? []).length > 0 && <Note>{t('lm.q.salvage', { list: (q.salvage ?? []).map((x) => `${formatNumber(x.qty)} ${names.name(['component', 'item'], x.item.code, x.item.name)}`).join('، ') })}</Note>}
      {(q.skipped ?? []).length > 0 && <Note>{t('lm.q.skipped', { list: (q.skipped ?? []).map((x) => x.name).join('، ') })}</Note>}
      {void ctx}
    </>
  )
}

function LotManageBody({ init, ctx }: { init: LotManageView; ctx: FlowCtx }) {
  const cmd = useVillageCommand()
  const names = useContentNames()
  const [v, setV] = useState<LotManageView>(init)
  const [ask, setAsk] = useState<{ v: LotManageView; offer: LocalOffer | null; args: Record<string, string> } | null>(null)
  const [tab, setTab] = useState<Tab>('function')
  const [busy, setBusy] = useState(false)
  const [tplName, setTplName] = useState('')
  const [shareCode, setShareCode] = useState('')
  useEffect(() => setV(init), [init])
  const back = ctx.acts.find(isBack)
  const close = () => { if (back) ctx.go(back); else ctx.openLocal('village_home') }

  async function open(building: string) {
    setBusy(true)
    const r = await cmd('settlement.lot.manage', { building })
    setBusy(false)
    if (r.ok && r.res?.view) setV(r.res.view as unknown as LotManageView)
  }
  async function quote(args: Record<string, string>) {
    setBusy(true)
    const r = await cmd('settlement.lot.manage', { building: v.id, ...args })
    setBusy(false)
    if (r.ok && r.res?.view) setAsk({ v: r.res.view as unknown as LotManageView, offer: (r.res as { offer?: LocalOffer | null }).offer ?? null, args })
  }
  async function confirm(convert?: LocalOffer) {
    if (!ask) return
    setBusy(true)
    const extra: Record<string, string> = convert ? { convert: '1', max_sup: String(convert.convert_sup) } : {}
    const r = await cmd('settlement.lot.manage', { building: v.id, ...ask.args, confirm: 'confirm', ...extra }, { write: true })
    setBusy(false)
    if (r.ok && r.res?.view) {
      const nv = r.res.view as unknown as LotManageView
      setV(nv); setAsk(null)
      if (nv.share_code) setShareCode(nv.share_code)
    }
  }

  // -- the menu of several buildings --------------------------------------------------------------------------------
  if (v.stage === 'menu') {
    return (
      <Popup open onClose={close} tone="gold" title={t('lm.title')}>
        <Note>{t('lm.menu_lead')}</Note>
        <CardGrid>
          {(v.buildings ?? []).map((b) => (
            <PCard key={b.id} icon="house" title={ctx.bname(b.building.code, b.building.name)} sub={t('lm.menu_sub', { fn: b.function_name, lvl: formatNumber(b.level), st: formatNumber(b.storeys) })}
              badge={b.has_order ? t('lm.has_order') : undefined} tone={b.built ? 'busy' : 'off'} onClick={() => void open(b.id)} />
          ))}
        </CardGrid>
      </Popup>
    )
  }

  const manage = v.can_manage && v.built
  const why = (reason: string, needs: LotManageView['needs']) => (
    <>
      <Note tone="bad">{hasKey(`lm.reason.${reason}`) ? t(`lm.reason.${reason}` as Key) : t('lm.reason.other')}</Note>
      {(needs ?? []).map((n, i) => <NeedLine key={i} ctx={ctx} n={n} />)}
    </>
  )
  const order = v.work
  const f = v.function
  const tabs: { key: Tab; label: string }[] = [
    { key: 'function', label: t('lm.tab.function') }, { key: 'rooms', label: t('lm.tab.rooms') }, { key: 'staff', label: t('lm.tab.staff') },
    { key: 'store', label: t('lm.tab.store') }, { key: 'look', label: t('lm.tab.look') }, { key: 'state', label: t('lm.tab.state') },
  ]

  return (
    <>
      <Popup open={!ask} onClose={close} tone="gold" dismissible={!busy} title={`${t('lm.title')} · ${ctx.bname(v.building.code, v.building.name)}`}>
        {v.stage === 'done' && <Note tone="good">{t('lm.done')}{v.share_code ? ` ${t('lm.share_code', { code: v.share_code })}` : ''}</Note>}
        {!v.built && <Note>{t('lm.not_built')}</Note>}
        <StatGrid>
          <StatCard icon="house" palette="gold" label={t('lm.function')} value={`${f.name} · ${t('lm.level', { n: formatNumber(f.level) })}`} />
          <StatCard icon="box" palette="sapphire" label={t('lm.storeys')} value={<span dir="ltr">{formatNumber(v.storeys)} / {formatNumber(v.max_storeys)}</span>} />
          <StatCard icon="chart" palette="emerald" label={t('lm.area')} value={<span dir="ltr">{formatNumber(v.area_used)} / {formatNumber(v.area_capacity)}</span>} />
        </StatGrid>
        {order && (
          <div className="lm-order">
            <Section>{t('lm.order')}</Section>
            <ProgressRow frac={order.progress_bps / 10000} label={`${formatNumber(Math.round(order.progress_bps / 100))}٪`} caption={t('lm.order_shifts', { a: formatNumber(order.work_done), b: formatNumber(order.work_needed) })} icon="hammer" />
            {order.paused && <Note tone="bad">{hasKey(`work.reason.${order.paused}`) ? t(`work.reason.${order.paused}` as Key, { have: '', need: '', item: '', class: '' }) : order.paused}</Note>}
            <ActionRow>
              <ActionButton tone="gold" small onClick={() => ctx.run('settlement.labor.board', {})}>{t('lm.work_shift')}</ActionButton>
              {!order.job_open && v.can_manage && <ActionButton tone="steel" small onClick={() => ctx.run('settlement.labor.post', { id: v.id })}>{t('lm.repost')}</ActionButton>}
            </ActionRow>
          </div>
        )}
        <Segmented wrap options={tabs} value={tab} onChange={(k) => setTab(k as Tab)} />

        {tab === 'function' && (
          <>
            {v.upgrade && (
              <PCard icon="hammer" title={t('lm.upgrade', { n: formatNumber(v.upgrade.to) })} tone={v.upgrade.can ? 'busy' : 'off'} off={!v.upgrade.can}
                sub={`${money(v.upgrade.cost_money)} · ${t('lm.q.shifts')}: ${formatNumber(v.upgrade.shifts)}`}
                facts={!v.upgrade.can ? t(`lm.reason.${v.upgrade.reason}` as Key) : (v.upgrade.adds ?? []).map((a) => a.name).join('، ')}
                onClick={manage && v.upgrade.can ? () => void quote({ action: 'level' }) : undefined} />
            )}
            {(v.functions ?? []).length > 0 && <Section>{t('lm.change_use')}</Section>}
            <CardGrid>
              {(v.functions ?? []).filter((c) => !c.current).map((c) => (
                <PCard key={c.function.code} icon="tool" title={c.function.name} tone={c.available ? 'busy' : 'off'} off={!c.available}
                  sub={t('lm.fn_sub', { cost: money(c.cost_money), fee: money(c.fee_sup) })}
                  facts={c.available ? (c.effects ?? []).join('، ') : <span className="dk-why">{t('lm.not_here')}</span>}
                  onClick={manage && c.available ? () => void quote({ action: 'function', code: c.function.code }) : undefined} />
              ))}
            </CardGrid>
            {(v.functions ?? []).filter((c) => !c.current && !c.available).flatMap((c) => c.needs ?? []).slice(0, 4).map((n, i) => <NeedLine key={i} ctx={ctx} n={n} />)}
          </>
        )}

        {tab === 'rooms' && (
          <>
            <Section>{t('lm.rooms')}</Section>
            <CardGrid>
              {(v.modules ?? []).map((m) => (
                <PCard key={m.module.code} icon="box" title={`${m.module.name} × ${formatNumber(m.count)}`} tone="busy"
                  sub={m.effect ? (hasKey(`lm.effect.${m.effect}`) ? t(`lm.effect.${m.effect}` as Key, { n: formatNumber(m.housing_capacity || m.personal_storage || m.stall_slots) }) : m.effect) : undefined}
                  facts={t('lm.slots', { a: formatNumber(m.count), b: formatNumber(m.max) })}
                  foot={manage && m.removable && m.count > m.included ? <button type="button" className="dk-chip" onClick={() => void quote({ action: 'remove', code: m.module.code, n: '1' })}>{t('lm.remove')}</button> : undefined} />
              ))}
            </CardGrid>
            <Section>{t('lm.add_room')}</Section>
            <CardGrid>
              {(v.additions ?? []).map((a) => (
                <PCard key={a.module.code} icon="plus" title={a.module.name} tone={a.can ? 'busy' : 'off'} off={!a.can}
                  sub={`${t('lm.q.shifts')}: ${formatNumber(a.shifts)} · ${t('lm.area_each', { n: formatNumber(a.area_each) })}`}
                  facts={a.can ? <Items list={a.materials} names={names} /> : <span className="dk-why">{hasKey(`lm.reason.${a.reason}`) ? t(`lm.reason.${a.reason}` as Key) : t('lm.not_here')}</span>}
                  onClick={manage && a.can ? () => void quote({ action: 'add', code: a.module.code, n: '1' }) : undefined} />
              ))}
            </CardGrid>
            {(v.additions ?? []).filter((a) => !a.can).flatMap((a) => a.needs ?? []).slice(0, 3).map((n, i) => <NeedLine key={i} ctx={ctx} n={n} />)}
            {v.storey_up && (
              <PCard icon="hammer" title={t('lm.storey_up', { n: formatNumber(v.storey_up.to) })} tone={v.storey_up.can ? 'busy' : 'off'} off={!v.storey_up.can}
                sub={`${t('lm.q.shifts')}: ${formatNumber(v.storey_up.shifts)}`}
                facts={v.storey_up.can ? <Items list={v.storey_up.materials} names={names} /> : <span className="dk-why">{hasKey(`lm.reason.${v.storey_up.reason}`) ? t(`lm.reason.${v.storey_up.reason}` as Key) : t('lm.not_here')}</span>}
                onClick={manage && v.storey_up.can ? () => void quote({ action: 'storey' }) : undefined} />
            )}
            <ProgressRow frac={1 - v.stability_bps / 10000} label={t('lm.stability', { p: formatNumber(Math.round(v.stability_bps / 100)) })} color={v.stability_bps > 6000 ? '#56d447' : v.stability_bps > 3000 ? '#ffb02e' : '#ff5a47'} />
          </>
        )}

        {tab === 'staff' && (
          <>
            {(v.staff ?? []).length === 0 ? <Note>{t('lm.staff_none')}</Note> : (
              <CardGrid>{(v.staff ?? []).map((s) => <PCard key={s.role} icon="people" title={hasKey(`work.role.${s.role}`) ? t(`work.role.${s.role}` as Key) : s.role} facts={t('lm.posts', { n: formatNumber(s.slots) })} tone="busy" />)}</CardGrid>
            )}
            {v.if_unstaffed && hasKey(`work.unstaffed.${v.if_unstaffed}`) && <Hint>{t(`work.unstaffed.${v.if_unstaffed}` as Key)}</Hint>}
          </>
        )}

        {tab === 'store' && (
          <StatGrid>
            <StatCard icon="people" palette="emerald" label={t('lm.housing')} value={formatNumber(v.housing_capacity)} />
            <StatCard icon="chest" palette="amber" label={t('lm.personal_storage')} value={formatNumber(v.personal_storage)} />
            <StatCard icon="cart" palette="gold" label={t('lm.stall_slots')} value={formatNumber(v.stall_slots)} />
          </StatGrid>
        )}

        {tab === 'look' && (
          <>
            {v.look ? <div className="lm-lookbox"><LookPreview look={v.look} /></div> : <Note>{t('lm.look_none')}</Note>}
            <Hint>{t('lm.look_hint')}</Hint>
          </>
        )}

        {tab === 'state' && (
          <>
            <ProgressRow frac={v.condition_bps / 10000} label={t('lm.condition', { p: formatNumber(Math.round(v.condition_bps / 100)) })} color="#56d447" />
            <Section>{t('lm.templates')}</Section>
            {manage && (
              <div className="lm-tpl">
                <input className="fx-field-input" dir="auto" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t('lm.tpl_name')} maxLength={60} aria-label={t('lm.tpl_name')} />
                <ActionButton tone="steel" small disabled={busy} onClick={() => void quote({ action: 'template_save', name: tplName })}>{t('lm.tpl_save')}</ActionButton>
              </div>
            )}
            <CardGrid>
              {(v.templates ?? []).map((tp) => (
                <PCard key={tp.id} icon="scroll" title={tp.name} sub={`${tp.function.name} · ${t('lm.level', { n: formatNumber(tp.level) })} · ${formatNumber(tp.storeys)}`} tone={tp.applicable ? 'busy' : 'off'} off={!tp.applicable}
                  facts={tp.applicable ? (tp.modules ?? []).map((m) => `${m.module.name} × ${formatNumber(m.count)}`).join('، ') : <span className="dk-why">{hasKey(`lm.reason.${tp.reason}`) ? t(`lm.reason.${tp.reason}` as Key) : t('lm.not_here')}</span>}
                  foot={manage ? (
                    <span className="dk-chips">
                      {tp.applicable && <button type="button" className="dk-chip all" onClick={() => void quote({ action: 'template_apply', code: tp.id })}>{t('lm.tpl_apply')}</button>}
                      {tp.mine && <button type="button" className="dk-chip" onClick={() => void quote({ action: 'template_delete', code: tp.id })}>{t('lm.tpl_delete')}</button>}
                    </span>
                  ) : undefined} />
              ))}
            </CardGrid>
            {manage && (
              <div className="lm-tpl">
                <input className="fx-field-input" dir="ltr" value={shareCode} onChange={(e) => setShareCode(e.target.value.trim())} placeholder={t('lm.share_ph')} aria-label={t('lm.share_ph')} />
                <ActionButton tone="steel" small disabled={busy || !shareCode} onClick={() => void quote({ action: 'template_apply', code: shareCode })}>{t('lm.tpl_apply_code')}</ActionButton>
              </div>
            )}
          </>
        )}
        {!manage && v.built && <Note>{v.mine || v.public ? t('lm.busy_now') : t('lm.not_yours')}</Note>}
      </Popup>

      {ask && (
        <Popup open onClose={() => setAsk(null)} tone="gold" dismissible={!busy} title={t(`lm.act.${ask.args.action}` as Key)}
          footer={<ActionRow>
            <ActionButton tone="steel" small onClick={() => setAsk(null)} disabled={busy}>{t('building.no')}</ActionButton>
            {!ask.v.reason && <ActionButton tone="gold" busy={busy} onClick={() => void confirm()}>{t('lm.confirm')}</ActionButton>}
          </ActionRow>}>
          {ask.v.quote && <QuoteBlock q={ask.v.quote} names={names} ctx={ctx} />}
          {ask.v.reason ? why(ask.v.reason, ask.v.needs) : <Note>{t('lm.ask_note')}</Note>}
          {!ask.v.reason && ask.args.action === 'function' && <Note>{t('lm.use_fee_note')}</Note>}
          {!ask.v.reason && <OfferBox offer={ask.offer} busy={busy} onConvert={() => ask.offer && void confirm(ask.offer)} />}
        </Popup>
      )}
    </>
  )
}

export const LotManage = flow<LotManageView>(({ view, ctx }) => (
  <Page title={t('lm.title')} tone="gold"><LotManageBody init={view} ctx={ctx} /></Page>
))
