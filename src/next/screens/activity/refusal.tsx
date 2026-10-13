// The refusals of this area (work and study, crime, missions, health): a calm «نشد» card that says why in the web's
// own words, what is still missing, and the one step the server offers next.

import type { NScreenProps } from '../../registry'
import type { CommandResponse } from '../../../api/types'
import type { CrimeRefusalView, HealthRefusalView, MissionRefusalView, RefusalView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, KV } from '../../ui'
import { refusalText, t } from '../../../i18n'
import { hms } from '../../../screens/native/kit/format'
import { atText } from '../../../lib/duration'
import { ActPage, cash, Conds, MoreActs, ResultHero, n, tk, useActs, type Acts, type Cond } from './common'
import { reqCond } from './work'
import { crimeCond } from './crime'

const ICON: Record<string, string> = {
  jail: 'handcuffs', hospital: 'hospital', nerve: 'nerve', cooldown: 'sleepy', busy: 'stopwatch', work: 'work', travelling: 'plane', walking: 'walk',
  cannot_afford: 'x_cash', not_at_workplace: 'x_map', shift_in_progress: 'stopwatch', requirements: 'm_lock', job_requirements: 'm_lock', course_requirements: 'm_lock',
}

function Frame({ response, why, sub, conds, facts }: { response: CommandResponse; why: string; sub?: string; conds?: Cond[]; facts?: { label: string; value: string }[] }) {
  const nav = useNav()
  const acts: Acts = useActs(response)
  const kind = (response.view as { kind?: string } | undefined)?.kind ?? ''
  const lead = acts.all[0]
  return (
    <ActPage title={t('ac.crime.refusal.title')}>
      <ResultHero tone="loss" art={ICON[kind] ?? 'm_stop'} kicker={t('ac.crime.refusal.title')} big={why} sub={sub} />
      {(facts ?? []).length > 0 && <div className="n-rows">{facts!.map((f, i) => <KV key={i} label={f.label} value={f.value} />)}</div>}
      <Conds title={t('ac.work.detail.reqs')} items={conds ?? []} />
      {lead && <Button block onClick={() => nav.act(lead)}>{acts.label(lead)}</Button>}
      <MoreActs acts={acts} list={acts.all.slice(1)} />
    </ActPage>
  )
}

/** Work and study («refusal»): the server's code worded by the web, the conditions still missing, the fee. */
export function WorkRefusal({ response }: NScreenProps) {
  const names = useActs(response).names
  if (!response) return null
  const v = (response.view ?? {}) as Partial<RefusalView>
  const facts = [
    v.fee ? { label: t('ac.work.course.fee'), value: cash(v.fee) } : null,
    v.cash || v.fee ? { label: t('ac.crime.pay.cash'), value: cash(v.cash ?? 0) } : null,
    v.wait_seconds ? { label: t('n.act.wait'), value: hms(v.wait_seconds) } : null,
    v.ends_at ? { label: t('ac.work.started.ends'), value: atText(v.ends_at) } : null,
    v.city ? { label: t('ac.work.detail.city'), value: v.city_code ? names.name('city', v.city_code, v.city) : v.city } : null,
  ].filter((x): x is { label: string; value: string } => !!x)
  return <Frame response={response} why={refusalText(response.error?.code, response.error?.message, response.error?.args)} facts={facts} conds={(v.missing ?? []).map((r) => reqCond(names, r))} />
}

export function CrimeRefusal({ response }: NScreenProps) {
  const names = useActs(response).names
  if (!response) return null
  const v = (response.view ?? {}) as Partial<CrimeRefusalView>
  const kind = v.kind ?? ''
  const time = hms(v.remaining_seconds || v.wait_seconds || 0)
  const p = { need: n(v.need ?? 0), have: n(v.have ?? 0), time, amount: cash(v.amount ?? 0), cash: cash(v.cash ?? 0) }
  const why = kind === 'nerve' && !v.wait_seconds ? t('ac.crime.refused.nerve_now', p) : tk(`ac.crime.refused.${kind}`, t('ac.crime.refused.unknown'), p)
  const crime = v.crime?.code ? t('ac.crime.refusal.for', { crime: names.name('crime', v.crime.code, v.crime.name) }) : undefined
  const conds = (v.missing ?? []).map((r) => crimeCond(names, r))
  return <Frame response={response} why={why} sub={crime} conds={conds} />
}

export function MissionRefusal({ response }: NScreenProps) {
  if (!response) return null
  const v = (response.view ?? {}) as Partial<MissionRefusalView>
  const kind = v.kind ?? ''
  const why = tk(`ac.mission.refused.${kind}`, refusalText(response.error?.code, response.error?.message, response.error?.args))
  const sub = v.blocked ? tk(`ac.mission.blocked.${v.blocked}`, '', { level: n(v.level ?? 0), max: n(v.max ?? 0), t: hms(v.wait_seconds ?? 0) }) : undefined
  return <Frame response={response} why={why} sub={sub || undefined} />
}

export function HealthRefusal({ response }: NScreenProps) {
  if (!response) return null
  const v = (response.view ?? {}) as Partial<HealthRefusalView>
  const kind = v.kind ?? ''
  const why = tk(`ac.health.refused.${kind}`, refusalText(response.error?.code, response.error?.message, response.error?.args))
  return <Frame response={response} why={why} sub={tk(`ac.health.refused_hint.${kind}`) || undefined} />
}

export const REFUSALS = { refusal: WorkRefusal, crime_refusal: CrimeRefusal, mission_refusal: MissionRefusal, health_refusal: HealthRefusal }
