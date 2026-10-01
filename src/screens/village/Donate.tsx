// «کمک به خزانه»: a resident gives from their own cash to the village
// treasury. Three steps as the server has them (settlement.donate): the
// amounts, the confirm, the result. A bottom sheet, opened from the village's
// overview and from the menu; it renders at the document body (BottomSheet),
// so it and its buttons are above every menu.

import { useEffect, useState } from 'react'
import Popup, { ActionButton, ActionRow, Hero, Medallion, Note, StatCard, StatGrid } from '../../ui/Popup'
import { Slab } from '../../kit'
import { t } from '../../i18n'
import { money } from '../native/kit/format'
import { useVillageCommand } from '../../village/useVillage'
import type { DonateView } from '../../api/types'
import './village.css'

type Step = { kind: 'menu' | 'ask' | 'done'; view: DonateView }

export default function DonateSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const cmd = useVillageCommand()
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) { setStep(null); setTyped(''); return }
    let cancelled = false
    void cmd('settlement.donate', {}, { silent: true }).then((r) => {
      if (cancelled) return
      if (r.ok && r.res?.view) setStep({ kind: 'menu', view: r.res.view as unknown as DonateView })
      else onClose()
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function ask(amount: number) {
    setBusy(true)
    const r = await cmd('settlement.donate', { amount: String(amount) })
    setBusy(false)
    if (r.ok && r.res?.view) setStep({ kind: 'ask', view: r.res.view as unknown as DonateView })
  }

  async function give(amount: number) {
    setBusy(true)
    const r = await cmd('settlement.donate', { amount: String(amount), confirm: 'confirm' }, { write: true })
    setBusy(false)
    if (r.ok && r.res?.view) { setStep({ kind: 'done', view: r.res.view as unknown as DonateView }); onDone?.() }
    else setStep((s) => (s ? { kind: 'menu', view: s.view } : s))
  }

  const v = step?.view
  const typedAmount = Number(typed.replace(/[^0-9]/g, '')) || 0
  const valid = !!v && typedAmount >= v.min && typedAmount <= v.max

  return (
    <Popup
      open={open} onClose={onClose} title={t('donate.title')} tone="gold" dismissible={!busy}
      footer={v && step?.kind === 'menu' ? (
        <>
          <input
            className="vd-input" inputMode="numeric" dir="ltr" placeholder={t('donate.custom')}
            value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('donate.custom')}
          />
          <ActionButton tone="green" disabled={busy || !valid} onClick={() => void ask(typedAmount)}>{t('donate.next')}</ActionButton>
        </>
      ) : v && step?.kind === 'ask' ? (
        <ActionRow>
          <ActionButton tone="steel" small onClick={() => setStep({ kind: 'menu', view: v })} disabled={busy}>{t('building.no')}</ActionButton>
          <ActionButton tone="green" onClick={() => void give(v.amount)} busy={busy}>{t('donate.yes')}</ActionButton>
        </ActionRow>
      ) : v && step?.kind === 'done' ? (
        <ActionButton tone="gold" onClick={onClose}>{t('donate.close')}</ActionButton>
      ) : undefined}
    >
      {v && step?.kind === 'menu' && (
        <>
          <Hero><Medallion icon="gift" palette="gold" ring="#d99a1f" /></Hero>
          <StatGrid>
            <StatCard icon="coins" palette="gold" label={t('donate.stat.treasury')} value={money(v.treasury)} />
            <StatCard icon="money" palette="emerald" label={t('donate.stat.cash')} value={money(v.cash)} />
          </StatGrid>
          <Note>{t('donate.range', { min: money(v.min), max: money(v.max) })}</Note>
          <div className="vd-presets">
            {(v.presets ?? []).map((p) => (
              <ActionButton key={p} tone="gold" small disabled={busy || p > v.cash} onClick={() => void ask(p)}>{money(p)}</ActionButton>
            ))}
          </div>
        </>
      )}
      {v && step?.kind === 'ask' && (
        <>
          <Hero><Medallion icon="gift" palette="gold" ring="#d99a1f" /></Hero>
          <Note>{t('donate.ask', { amount: money(v.amount) })}</Note>
          <Note>{t('donate.ask_hint')}</Note>
        </>
      )}
      {v && step?.kind === 'done' && (
        <>
          <Hero><Medallion icon="check" palette="emerald" ring="#2f9d5b" /></Hero>
          <Note tone="good">{t('donate.done', { amount: money(v.amount) })}</Note>
          <Note>{t('donate.done_body', { treasury: money(v.treasury) })}</Note>
        </>
      )}
    </Popup>
  )
}
