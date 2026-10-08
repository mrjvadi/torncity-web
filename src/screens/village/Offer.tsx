// The confirm of an obligation to a settlement with its own money (response.offer): paid in the money when the payer holds the units,
// otherwise the confirm settles in SUP as before and, when the village desk can fill the gap, offers to convert and pay in the same
// step. Nothing converts silently; the price is protected (max_sup), and a desk refusal asks again calmly.

import type { Action, LocalOffer } from '../../api/types'
import { Note } from '../../ui/Popup'
import { ActionButton } from '../../ui/Popup'
import { formatNumber } from '../native/kit/format'
import { t } from '../../i18n'
import { registerWrite, type FlowCtx } from './flow'

// the converting confirm changes the world: the host runs it with an idempotency key
registerWrite((a) => a.id === 'convert')

const units = (n: number, o: LocalOffer) => `${formatNumber(n)} ${o.name}`
const sup = (n: number) => `${formatNumber(n)} ${t('unit.money')}`

/** The action the button sends: the confirm's own command with convert=1 and max_sup. */
export function convertAction(o: LocalOffer): Action | null {
  const c = o.convert
  if (!c || !c.command) return null
  return { ...c, id: 'convert', args: { ...(Array.isArray(c.args) ? {} : c.args ?? {}), ...(c.params ?? {}) } } as Action
}

export function OfferBox({ offer: o, onConvert, busy }: { offer: LocalOffer | null | undefined; onConvert: () => void; busy?: boolean }) {
  if (!o) return null
  if (o.local) return <Note tone="good">{t('offer.local', { name: o.name, n: units(o.units, o) })}</Note>
  if (!o.can_convert) return null
  return (
    <div className="of-box">
      <p className="of-line">{t('offer.line', { have: units(o.holds, o), gap: units(o.convert_units, o), sup: sup(o.convert_sup), fee: sup(o.convert_fee) })}</p>
      <ActionButton tone="gold" small busy={busy} onClick={onConvert}>{t('offer.convert')}</ActionButton>
    </div>
  )
}

/** For the flow screens: reads the offer from the response and sends the convert action through the host. */
export function FlowOffer({ ctx }: { ctx: FlowCtx }) {
  const o = (ctx.res as { offer?: LocalOffer | null }).offer
  const a = o ? convertAction(o) : null
  return <OfferBox offer={o} busy={ctx.busy} onConvert={() => a && ctx.go(a)} />
}
