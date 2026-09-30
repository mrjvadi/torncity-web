// «کمک به خزانه»: a resident gives from their own cash to the village
// treasury. Three steps as the server has them (settlement.donate): the
// amounts, the confirm, the result. A bottom sheet, opened from the village's
// overview and from the menu; it renders at the document body (BottomSheet),
// so it and its buttons are above every menu.

import { useEffect, useState } from 'react'
import BottomSheet from '../../ui/BottomSheet'
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
    <BottomSheet open={open} onClose={onClose} title={t('donate.title')}>
      {v && step?.kind === 'menu' && (
        <>
          <div className="vh-confirm">{t('donate.body', { treasury: money(v.treasury), cash: money(v.cash) })}</div>
          <div className="vh-hint">{t('donate.range', { min: money(v.min), max: money(v.max) })}</div>
          <div className="vd-presets">
            {(v.presets ?? []).map((p) => (
              <Slab key={p} tone="gold" radius={14} lip={4} disabled={busy || p > v.cash} onClick={() => void ask(p)}>{money(p)}</Slab>
            ))}
          </div>
          <div className="vd-custom">
            <input
              className="vd-input" inputMode="numeric" dir="ltr" placeholder={t('donate.custom')}
              value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('donate.custom')}
            />
            <Slab tone="blue" radius={14} lip={4} disabled={busy || !valid} onClick={() => void ask(typedAmount)}>{t('donate.next')}</Slab>
          </div>
        </>
      )}
      {v && step?.kind === 'ask' && (
        <>
          <div className="vh-confirm">{t('donate.ask', { amount: money(v.amount) })}</div>
          <div className="vh-hint">{t('donate.ask_hint')}</div>
          <div className="vh-sheet-actions">
            <Slab tone="steel" radius={14} lip={4} onClick={() => setStep({ kind: 'menu', view: v })} disabled={busy}>{t('building.no')}</Slab>
            <Slab tone="green" radius={14} lip={4} onClick={() => void give(v.amount)} disabled={busy}>{t('donate.yes')}</Slab>
          </div>
        </>
      )}
      {v && step?.kind === 'done' && (
        <>
          <div className="vh-confirm">{t('donate.done', { amount: money(v.amount) })}</div>
          <div className="vh-hint good">{t('donate.done_body', { treasury: money(v.treasury) })}</div>
          <div className="vh-sheet-actions">
            <Slab tone="gold" radius={14} lip={4} onClick={onClose}>{t('donate.close')}</Slab>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
