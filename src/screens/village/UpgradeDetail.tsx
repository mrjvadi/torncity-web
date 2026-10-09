// «ارتقا» everywhere: ONE centred card per upgrade with everything the player needs before pressing the button: the cost (money, materials,
// shifts), the time, what it gives, and EVERY prerequisite as its own line marked met or missing, with how to get it (research it, build it,
// buy the material, fill the treasury, or «اینجا نیست»). The button is greyed out, with its reason, while anything is missing. A locked upgrade
// is never hidden. The card takes a neutral model; the adapters below fill it from the building's upgrade line and from the lot's level-up.
// Fields the server does not send yet (materials, shifts, the effect gained, staff, upkeep, missing buildings with codes) light up when it does:
// see torncity-lab/handoff/ui-to-backend.md (2026-10-10 upgrade details).

import Popup, { ActionButton, ActionRow, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import type { BuildingUpgradeLine, LotUpgradeLine, Named, VillageNeed, WorkItemLine } from '../../api/views.gen'
import { buildText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { t } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'

/** The fields the server may add to BuildingUpgradeLine; all optional until it sends them. */
export type UpgradeX = BuildingUpgradeLine & {
  materials?: { item: Named; need: number; have: number }[] | null
  shifts?: number
  adds?: Named[] | null
  gives?: { target: string; value: number }[] | null
  needs?: VillageNeed[] | null
  missing_buildings?: Named[] | null
  staff?: { role: string; slots: number }[] | null
  upkeep?: number
  treasury?: number
}

export interface ReqRow { key: string; ok: boolean; label: string; detail?: string; fix?: { label: string; onClick: () => void }; here?: string }
export interface UpgradeModel {
  title: string
  level?: number
  money: number
  moneyHave?: number
  materials: { item: Named; need: number; have: number }[]
  shifts: number
  time: string
  gives: string[]
  extra: { label: string; value: string }[]
  reqs: ReqRow[]
  available: boolean
  blockedReason: string
  go: () => void
}

export interface UpgradeHandlers {
  names: ContentNames
  bname: (code: string, name?: string) => string
  openKnowledge: () => void
  openBuild: (code?: string) => void
  openStorage: () => void
  openTreasury: () => void
  go: (code: string) => void
}

const kn = (h: UpgradeHandlers, n: Named) => h.names.name('knowledge', n.code, n.name)
const item = (h: UpgradeHandlers, n: Named) => h.names.name(['component', 'item'], n.code, n.name)

function needRows(h: UpgradeHandlers, needs: VillageNeed[] | null | undefined): ReqRow[] {
  const rows: ReqRow[] = []
  for (const [i, n] of (needs ?? []).entries()) {
    if (n.kind === 'material') {
      const ok = n.have >= n.need
      rows.push({ key: `n${i}`, ok, label: t('ug.mat', { name: item(h, n.item) }), detail: `${formatNumber(n.have)} / ${formatNumber(n.need)}`, fix: ok ? undefined : { label: n.price > 0 ? t('ug.fix.buy', { price: money(n.price) }) : t('ug.fix.store'), onClick: h.openStorage },
        here: (n.makers ?? []).length ? t('ug.made_in', { list: (n.makers ?? []).map((m) => h.bname(m.building.code, m.building.name) + (m.built ? '' : ` (${t('ug.not_built')})`)).join('، ') }) : undefined })
    } else if (n.kind === 'knowledge') {
      const opts = (n.options ?? []).map((o) => kn(h, o))
      rows.push({ key: `n${i}`, ok: false, label: opts.length > 1 ? t('ug.know_any', { list: opts.join('، ') }) : t('ug.know', { name: opts[0] ?? kn(h, n.item) }), fix: { label: t('ug.fix.research'), onClick: h.openKnowledge } })
    } else {
      const opts = (n.options ?? []).map((o) => h.bname(o.code, o.name))
      rows.push({ key: `n${i}`, ok: false, label: t('ug.build_req', { names: opts.join('، ') }), fix: { label: t('ug.fix.build'), onClick: () => h.openBuild((n.options ?? [])[0]?.code) } })
    }
  }
  return rows
}

export function fromBuildingUpgrade(u: UpgradeX, h: UpgradeHandlers, have: { treasury?: number } = {}): UpgradeModel {
  const reqs: ReqRow[] = []
  // each missing knowledge is its own line, with the way to research it
  for (const m of u.missing ?? []) reqs.push({ key: `k${m.code}`, ok: false, label: t('ug.know', { name: kn(h, m) }), fix: { label: t('ug.fix.research'), onClick: h.openKnowledge } })
  for (const m of u.missing_buildings ?? []) reqs.push({ key: `b${m.code}`, ok: false, label: t('ug.build_req', { names: h.bname(m.code, m.name) }), fix: { label: t('ug.fix.build'), onClick: () => h.openBuild(m.code) } })
  reqs.push(...needRows(h, u.needs))
  const mats = u.materials ?? []
  for (const m of mats) if (m.have < m.need) reqs.push({ key: `m${m.item.code}`, ok: false, label: t('ug.mat', { name: item(h, m.item) }), detail: `${formatNumber(m.have)} / ${formatNumber(m.need)}`, fix: { label: t('ug.fix.store'), onClick: h.openStorage } })
  const treasury = have.treasury ?? u.treasury
  if (treasury !== undefined && treasury < u.cost_money) reqs.push({ key: 'money', ok: false, label: t('ug.money', { n: money(u.cost_money - treasury) }), fix: { label: t('ug.fix.treasury'), onClick: h.openTreasury } })
  const missingCount = reqs.length
  // a locked upgrade the server did not explain: say so, never an empty list
  if (!u.available && missingCount === 0) reqs.push({ key: 'unknown', ok: false, label: t('ug.unknown') })
  const gives = [...(u.adds ?? []).map((a) => t('ug.gives_add', { name: a.name })), ...(u.gives ?? []).map((g) => (hasEffect(g.target) ? t(`building.effect.${g.target}` as never, { v: formatNumber(g.value) }) : '')).filter(Boolean)]
  const extra: UpgradeModel['extra'] = []
  if (u.upkeep !== undefined) extra.push({ label: t('ug.upkeep'), value: money(u.upkeep) })
  for (const s of u.staff ?? []) extra.push({ label: t('ug.staff'), value: `${s.role} × ${formatNumber(s.slots)}` })
  return {
    title: h.bname(u.building.code, u.building.name), level: u.tier, money: u.cost_money, moneyHave: treasury, materials: mats, shifts: u.shifts ?? 0, time: buildText(u), gives, extra, reqs,
    available: u.available && reqs.every((r) => r.ok), blockedReason: reqs.some((r) => !r.ok) ? t('ug.blocked', { n: formatNumber(reqs.filter((r) => !r.ok).length) }) : '', go: () => h.go(u.building.code),
  }
}

function hasEffect(target: string): boolean { return /_bps$|housing_capacity$/.test(target) }

export function fromLotUpgrade(u: LotUpgradeLine, h: UpgradeHandlers, cash?: number, go?: () => void): UpgradeModel {
  const reqs: ReqRow[] = needRows(h, u.needs)
  for (const m of u.materials ?? []) reqs.push({ key: `m${m.item.code}`, ok: true, label: t('ug.mat', { name: item(h, m.item) }), detail: formatNumber(m.qty) })
  if (!u.can && reqs.every((r) => r.ok)) reqs.push({ key: 'reason', ok: false, label: t(`lm.reason.${u.reason}` as never) })
  if (cash !== undefined && cash < u.cost_money) reqs.push({ key: 'money', ok: false, label: t('ug.money', { n: money(u.cost_money - cash) }), fix: { label: t('ug.fix.treasury'), onClick: h.openTreasury } })
  return {
    title: t('lm.upgrade', { n: formatNumber(u.to) }), level: u.to, money: u.cost_money, moneyHave: cash,
    materials: (u.materials ?? []).map((m) => ({ item: m.item, need: m.qty, have: m.qty })), shifts: u.shifts, time: '', gives: (u.adds ?? []).map((a) => t('ug.gives_add', { name: a.name })), extra: [], reqs,
    available: u.can && reqs.every((r) => r.ok), blockedReason: reqs.some((r) => !r.ok) ? t('ug.blocked', { n: formatNumber(reqs.filter((r) => !r.ok).length) }) : '', go: go ?? (() => undefined),
  }
}

export function UpgradeCard({ m, onClose, busy }: { m: UpgradeModel; onClose: () => void; busy?: boolean }) {
  const matList = (list: WorkItemLine[]) => list
  void matList
  return (
    <Popup open onClose={onClose} tone="gold" title={t('ug.title', { name: m.title })} dismissible={!busy}
      footer={<ActionRow>
        <ActionButton tone="steel" small onClick={onClose}>{t('common.close')}</ActionButton>
        <ActionButton tone="gold" busy={busy} disabled={!m.available} reason={!m.available ? m.blockedReason : undefined} onClick={() => { onClose(); m.go() }}>{t('v6.up.go')}</ActionButton>
      </ActionRow>}>
      <StatGrid>
        <StatCard icon="coin" palette="gold" label={t('v6.up.cost')} value={money(m.money)} />
        {m.time && <StatCard icon="hammer" palette="amber" label={t('v6.up.time')} value={m.time} />}
        {m.shifts > 0 && <StatCard icon="tool" palette="steel" label={t('lm.q.shifts')} value={formatNumber(m.shifts)} />}
        {m.extra.map((e) => <StatCard key={e.label + e.value} icon="scroll" palette="sapphire" label={e.label} value={e.value} />)}
      </StatGrid>
      {m.materials.length > 0 && (
        <>
          <Section>{t('ug.materials')}</Section>
          <div className="vf-list">{m.materials.map((x) => <div key={x.item.code} className="vf-line"><span>{x.item.name}</span><b className={x.have < x.need ? 'bad' : ''}>{formatNumber(x.have)} / {formatNumber(x.need)}</b></div>)}</div>
        </>
      )}
      {m.gives.length > 0 && (
        <>
          <Section>{t('ug.gives')}</Section>
          <ul className="ug-gives">{m.gives.map((g) => <li key={g}>{g}</li>)}</ul>
        </>
      )}
      <Section>{t('ug.reqs')}</Section>
      {m.reqs.length === 0 && <Note tone="good">{t('v6.up.ready')}</Note>}
      <div className="ug-reqs">
        {m.reqs.map((r) => (
          <div key={r.key} className={`ug-req ${r.ok ? 'ok' : 'bad'}`}>
            <span className="ug-mark" aria-label={r.ok ? t('v6.have') : t('ug.missing')}>{r.ok ? '✓' : '✗'}</span>
            <span className="ug-txt"><b>{r.label}</b>{r.detail && <small dir="ltr"> {r.detail}</small>}{r.here && <small>{r.here}</small>}</span>
            {r.fix && <button type="button" className="dk-chip" onClick={() => { onClose(); r.fix!.onClick() }}>{r.fix.label}</button>}
          </div>
        ))}
      </div>
      {!m.available && <Note tone="bad">{m.blockedReason || t('v6.up.blocked')}</Note>}
    </Popup>
  )
}
