// «ارتقا» everywhere: ONE centred card per upgrade with everything the player needs before pressing the button: the cost (money, materials,
// shifts), the time, what it gives, and EVERY prerequisite as its own line marked met or missing, with how to get it (research it, build it,
// buy the material, fill the treasury, or «اینجا نیست»). The button is greyed out, with its reason, while anything is missing. A locked upgrade
// is never hidden. The card takes a neutral model; the adapters below fill it from the building's upgrade line and from the lot's level-up.
// Fields the server does not send yet (materials, shifts, the effect gained, staff, upkeep, missing buildings with codes) light up when it does:
// see torncity-lab/handoff/ui-to-backend.md (2026-10-10 upgrade details).

import Popup, { ActionButton, ActionRow, Note, Section, StatCard, StatGrid } from '../../ui/Popup'
import type { BuildingUpgradeLine, LotUpgradeLine, Named, Prerequisite, VillageNeed } from '../../api/views.gen'
import { buildText } from '../../lib/duration'
import { formatNumber, money } from '../native/kit/format'
import { hasKey, t, type Key } from '../../i18n'
import type { ContentNames } from '../../village/useVillage'

/** a requirement as the server sends it: `Prerequisite` (building and knowledge lists) or the older `VillageNeed` (a lot's level-up) */
export type Need = Omit<Prerequisite, 'how' | 'where' | 'role' | 'tier'> & Partial<Pick<Prerequisite, 'how' | 'where' | 'role' | 'tier'>>

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
  /** a course or a place that teaches (literacy, a skill) */
  openLearn: () => void
  /** a trip to the place that has it */
  openTravel: () => void
  go: (code: string) => void
}

const kn = (h: UpgradeHandlers, n: Named) => h.names.name('knowledge', n.code, n.name)
const item = (h: UpgradeHandlers, n: Named) => h.names.name(['component', 'item'], n.code, n.name)
const pctBps = (b: number) => `\u2066${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(b / 100)}٪\u2069`

/** Each requirement as a line: met or missing, and the button the server's `how` points to (research, build, train, buy, travel, donate). */
export function needRows(h: UpgradeHandlers, needs: Need[] | null | undefined): ReqRow[] {
  const rows: ReqRow[] = []
  for (const [i, n] of (needs ?? []).entries()) {
    const key = `n${i}`
    const met = n.have >= n.need
    const where = n.where ? t('ug.where', { where: n.where }) : undefined
    switch (n.kind) {
      case 'knowledge': {
        const opts = (n.options ?? []).map((o) => kn(h, o))
        const label = opts.length > 1 ? t('ug.know_any', { list: opts.join('، ') }) : t('ug.know', { name: opts[0] ?? kn(h, n.item) })
        rows.push({ key, ok: met, label, here: where, fix: met ? undefined : howFix(h, n.how ?? 'research', n) })
        break
      }
      case 'building': {
        const opts = (n.options ?? []).map((o) => h.bname(o.code, o.name))
        const label = t('ug.build_req', { names: (opts.length ? opts : [h.bname(n.item.code, n.item.name)]).join('، ') })
        rows.push({ key, ok: met, label, here: where, fix: met ? undefined : howFix(h, n.how ?? 'build', n) })
        break
      }
      case 'item': {
        rows.push({ key, ok: met, label: t('ug.mat', { name: item(h, n.item) }), detail: `${formatNumber(n.have)} / ${formatNumber(n.need)}`, fix: met ? undefined : howFix(h, n.how ?? 'buy', n),
          here: (n.makers ?? []).length ? t('ug.made_in', { list: (n.makers ?? []).map((m) => h.bname(m.building.code, m.building.name) + (m.built ? '' : ` (${t('ug.not_built')})`)).join('، ') }) : where })
        break
      }
      case 'money':
        rows.push({ key, ok: met, label: met ? t('ug.money_ok', { n: money(n.need) }) : t('ug.money', { n: money(n.need - n.have) }), fix: met ? undefined : howFix(h, n.how ?? 'donate', n) })
        break
      case 'literacy':
        rows.push({ key, ok: met, label: t('ug.literacy', { n: pctBps(n.need) }), detail: pctBps(n.have), fix: met ? undefined : howFix(h, n.how ?? 'train', n), here: where })
        break
      case 'terrain':
        rows.push({ key, ok: met, label: t('ug.terrain', { name: item(h, n.item) }), here: where ?? (met ? undefined : t('ug.terrain_here')), fix: met ? undefined : howFix(h, n.how ?? 'travel', n) })
        break
      default:
        rows.push({ key, ok: met, label: n.item.name || n.kind, here: where })
    }
  }
  return rows
}

function howFix(h: UpgradeHandlers, how: string, n: Need): { label: string; onClick: () => void } | undefined {
  switch (how) {
    case 'research': return { label: t('ug.fix.research'), onClick: h.openKnowledge }
    case 'build': return { label: t('ug.fix.build'), onClick: () => h.openBuild((n.options ?? [])[0]?.code ?? n.item.code) }
    case 'train': return { label: t('ug.fix.train'), onClick: h.openLearn }
    case 'buy': return { label: n.price > 0 ? t('ug.fix.buy', { price: money(n.price) }) : t('ug.fix.store'), onClick: h.openStorage }
    case 'travel': return { label: t('ug.fix.travel'), onClick: h.openTravel }
    case 'donate': return { label: t('ug.fix.treasury'), onClick: h.openTreasury }
    default: return undefined
  }
}

const effectText = (target: string, value: number): string => (hasKey(`building.effect.${target}`) ? t(`building.effect.${target}` as Key, { v: formatNumber(/_bps$/.test(target) ? Math.round(value / 100) : value) }) : '')
const capText = (kind: string, code: string, value: number): string => (hasKey(`ug.cap.${kind}`) ? t(`ug.cap.${kind}` as Key, { code, n: formatNumber(value) }) : `${code} ${formatNumber(value)}`)

export function fromBuildingUpgrade(u: BuildingUpgradeLine, h: UpgradeHandlers): UpgradeModel {
  const reqs = needRows(h, u.needs)
  // an older answer without needs[]: the missing knowledge, one line each
  if (!(u.needs ?? []).length) for (const m of u.missing ?? []) reqs.push({ key: `k${m.code}`, ok: false, label: t('ug.know', { name: kn(h, m) }), fix: { label: t('ug.fix.research'), onClick: h.openKnowledge } })
  // a locked upgrade the server did not explain: say so, never an empty list
  if (!u.available && !reqs.some((r) => !r.ok)) reqs.push({ key: 'unknown', ok: false, label: t('ug.unknown') })
  const have = new Map((u.needs ?? []).filter((n) => n.kind === 'item').map((n) => [n.item.code, n.have]))
  const mats = (u.materials ?? []).map((m) => ({ item: { code: m.item.code, name: item(h, m.item) }, need: m.qty, have: have.get(m.item.code) ?? m.qty }))
  const gives = [
    ...(u.effects ?? []).map((e) => effectText(e.target, e.value)).filter(Boolean),
    ...(u.capacity ?? []).map((c) => capText(c.kind, c.code, c.value)),
  ]
  const extra: UpgradeModel['extra'] = []
  if (u.upkeep_money > 0) extra.push({ label: t('ug.upkeep'), value: money(u.upkeep_money) })
  for (const c of u.consumes ?? []) extra.push({ label: t('ug.consumes'), value: `${formatNumber(c.qty)} ${item(h, c.item)}` })
  for (const s of u.staff ?? []) extra.push({ label: t('ug.staff'), value: `${h.names.name(['staff_role'], s.role.code, s.role.name)} × ${formatNumber(s.slots)}` })
  const bad = reqs.filter((r) => !r.ok).length
  return {
    title: h.bname(u.building.code, u.building.name), level: u.tier, money: u.cost_money, materials: mats, shifts: u.shifts, time: buildText(u), gives, extra, reqs,
    available: (u.ready ?? u.available) && bad === 0, blockedReason: bad ? t('ug.blocked', { n: formatNumber(bad) }) : '', go: () => h.go(u.building.code),
  }
}

export function fromLotUpgrade(u: LotUpgradeLine, h: UpgradeHandlers, cash?: number, go?: () => void): UpgradeModel {
  const reqs: ReqRow[] = needRows(h, u.needs as VillageNeed[] | null)
  for (const m of u.materials ?? []) reqs.push({ key: `m${m.item.code}`, ok: true, label: t('ug.mat', { name: item(h, m.item) }), detail: formatNumber(m.qty) })
  if (!u.can && reqs.every((r) => r.ok)) reqs.push({ key: 'reason', ok: false, label: hasKey(`lm.reason.${u.reason}`) ? t(`lm.reason.${u.reason}` as Key) : t('lm.reason.other') })
  if (cash !== undefined && cash < u.cost_money) reqs.push({ key: 'money', ok: false, label: t('ug.money', { n: money(u.cost_money - cash) }), fix: { label: t('ug.fix.treasury'), onClick: h.openTreasury } })
  const bad = reqs.filter((r) => !r.ok).length
  return {
    title: t('lm.upgrade', { n: formatNumber(u.to) }), level: u.to, money: u.cost_money, moneyHave: cash,
    materials: (u.materials ?? []).map((m) => ({ item: { code: m.item.code, name: item(h, m.item) }, need: m.qty, have: m.qty })), shifts: u.shifts, time: '',
    gives: (u.adds ?? []).map((a) => t('ug.gives_add', { name: h.names.name(['component', 'item', 'module'], a.code, a.name) })), extra: [], reqs,
    available: u.can && !!go && bad === 0, blockedReason: bad ? t('ug.blocked', { n: formatNumber(bad) }) : !go ? t('ug.not_now') : '', go: go ?? (() => undefined),
  }
}

/** The requirement lines alone (✓ or ✗, each with its fix): the same rows as the upgrade card, for a knowledge card. */
export function ReqList({ rows, onFix }: { rows: ReqRow[]; onFix?: () => void }) {
  return (
    <div className="ug-reqs">
      {rows.map((r) => (
        <div key={r.key} className={`ug-req ${r.ok ? 'ok' : 'bad'}`}>
          <span className="ug-mark" aria-label={r.ok ? t('v6.have') : t('ug.missing')}>{r.ok ? '✓' : '✗'}</span>
          <span className="ug-txt"><b>{r.label}</b>{r.detail && <small dir="ltr"> {r.detail}</small>}{r.here && <small>{r.here}</small>}</span>
          {r.fix && <button type="button" className="dk-chip" onClick={() => { onFix?.(); r.fix!.onClick() }}>{r.fix.label}</button>}
        </div>
      ))}
    </div>
  )
}

export function UpgradeCard({ m, onClose, busy }: { m: UpgradeModel; onClose: () => void; busy?: boolean }) {
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
    </Popup>
  )
}
