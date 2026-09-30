import { useMemo, useState } from 'react'
import type { Action } from '../../../api/types'
import { toWesternDigits } from '../../../lib/persian'
import Icon from '../../../ui/Icon'
import BottomSheet from '../../../ui/BottomSheet'
import { t } from '../../../i18n'

/**
 * Renders a server answer's `actions` in the feature card language (shared
 * by the native war/military screens and the real friends/search screens):
 * grouped by row, primary/danger full-width, everything else a tile, with
 * the same input/confirm bottom sheets GenericScreen uses.
 */
export default function ActionButtons({ actions, onAction }: { actions: Action[] | undefined; onAction: (a: Action) => void }) {
  const [pendingInput, setPendingInput] = useState<Action | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [inputValue, setInputValue] = useState('')

  const rows = useMemo(() => {
    const byRow = new Map<number, Action[]>()
    for (const a of actions ?? []) {
      const list = byRow.get(a.row) ?? []
      list.push(a)
      byRow.set(a.row, list)
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0])
  }, [actions])

  const lead = rows.flatMap(([, list]) => list).find((a) => a.kind === 'primary')

  if (rows.length === 0) return null

  function handleClick(a: Action) {
    if (a.url) { window.open(a.url, '_blank', 'noopener'); return }
    if (a.input) { setInputValue(''); setPendingInput(a); return }
    if (a.kind === 'danger' || a.kind === 'confirm') { setPendingConfirm(a); return }
    onAction(a)
  }

  function submitInput() {
    if (!pendingInput) return
    const value = toWesternDigits(inputValue).trim()
    if (!value) return
    onAction({ ...pendingInput, args: { ...(pendingInput.args ?? {}), [pendingInput.input!.field]: value } })
    setPendingInput(null)
  }

  return (
    <>
      {rows.map(([row, rowActions]) => (
        <div className="ft-btn-row" key={row} style={{ flexWrap: 'wrap' }}>
          {rowActions.map((a, i) => <OneButton key={`${row}-${i}`} action={a} lead={a === lead} onClick={() => handleClick(a)} />)}
        </div>
      ))}

      <BottomSheet open={!!pendingInput} onClose={() => setPendingInput(null)} title={pendingInput?.label}>
        <input
          className="ft-sheet-input"
          value={inputValue}
          onChange={(e) => setInputValue(pendingInput?.input?.text ? e.target.value : toWesternDigits(e.target.value))}
          inputMode={pendingInput?.input?.text ? 'text' : 'numeric'}
          autoFocus
          dir={pendingInput?.input?.text ? 'rtl' : 'ltr'}
        />
        <button className="ft-sheet-primary-btn display" onClick={submitInput}>{t('f.ActionButtons.244')}</button>
      </BottomSheet>

      <BottomSheet open={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title={t('f.ActionButtons.245')}>
        <p className="ft-confirm-label">{pendingConfirm?.label}</p>
        <div className="ft-confirm-buttons">
          <button className="ft-confirm-yes display" onClick={() => { onAction(pendingConfirm!); setPendingConfirm(null) }}>{t('f.ActionButtons.244')}</button>
          <button className="ft-confirm-no display" onClick={() => setPendingConfirm(null)}>{t('f.ActionButtons.246')}</button>
        </div>
      </BottomSheet>
    </>
  )
}

/** Only the lead primary is a gold slab; a second or third primary on the
 * same screen steps down to an outlined button — the same rule the native
 * screens use (src/screens/native/kit/Actions.tsx). Back is a plain arrow
 * and label, never an icon (a server "back" action carries no icon key of
 * its own — configs/actions.yml has no dedicated back entry). */
function OneButton({ action, lead, onClick }: { action: Action; lead: boolean; onClick: () => void }) {
  const icon = action.icon ?? 'box'
  if (action.kind === 'primary') {
    return (
      <button className={`ft-btn ${lead ? 'ft-btn-gold' : 'ft-btn-outline'} display`} style={{ flex: '1 1 100%' }} onClick={onClick}>
        <Icon name={icon} palette={lead ? 'cream' : 'gold'} size={18} /><span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="ft-btn ft-btn-red display" style={{ flex: '1 1 100%' }} onClick={onClick}>
        <Icon name={icon} palette="cream" size={18} /><span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'back') {
    return (
      <button className="ft-btn ft-btn-back display" style={{ flex: '1 1 100%' }} onClick={onClick}>
        <span className="ft-btn-back-arrow" aria-hidden>›</span>
        <span>{action.label}</span>
      </button>
    )
  }
  return (
    <button className="ft-btn ft-btn-tile display" style={{ flex: '1 1 calc(50% - 5px)' }} onClick={onClick}>
      <Icon name={icon} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={18} />
      <span>{action.label}</span>
    </button>
  )
}
