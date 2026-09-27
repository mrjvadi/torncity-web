// The shared actions renderer: every native screen ends with one of these,
// fed the server answer's `actions`. Same interaction rules as
// ui/GenericScreen.tsx (primary pinned CTA, danger/confirm asks first, an
// input opens a sheet) so the two feel identical to the player — kept as
// our own copy since we may not edit ui/*.

import { useMemo, useState } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import { toWesternDigits } from '../../../lib/persian'
import Icon from '../../../ui/Icon'
import BottomSheet from '../../../ui/BottomSheet'

export default function Actions({ response, onAction, only }: {
  response: CommandResponse | null
  onAction: (a: Action) => void
  /** Render only these rows (e.g. skip row 0 when a screen already drew
   * its own primary CTA from the view). */
  only?: (a: Action) => boolean
}) {
  const [pendingInput, setPendingInput] = useState<Action | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [inputValue, setInputValue] = useState('')

  const rows = useMemo(() => {
    const actions = (response?.actions ?? []).filter((a) => !only || only(a))
    const byRow = new Map<number, Action[]>()
    for (const a of actions) {
      const list = byRow.get(a.row) ?? []
      list.push(a)
      byRow.set(a.row, list)
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0])
  }, [response, only])

  const lead = rows.flatMap(([, list]) => list).find((a) => a.kind === 'primary')

  if (rows.length === 0) return null

  function handleClick(a: Action) {
    if (a.url) {
      window.open(a.url, '_blank', 'noopener')
      return
    }
    if (a.input) {
      setInputValue('')
      setPendingInput(a)
      return
    }
    if (a.kind === 'danger' || a.kind === 'confirm') {
      setPendingConfirm(a)
      return
    }
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
    <div className="nx-actions">
      {rows.map(([row, actions]) => (
        <div className="nx-action-row" key={row}>
          {actions.map((a, i) => <ActionButton key={`${row}-${i}`} action={a} lead={a === lead} onClick={() => handleClick(a)} />)}
        </div>
      ))}

      <BottomSheet open={!!pendingInput} onClose={() => setPendingInput(null)} title={pendingInput?.label}>
        <input
          className="nx-sheet-input"
          value={inputValue}
          onChange={(e) => setInputValue(pendingInput?.input?.text ? e.target.value : toWesternDigits(e.target.value))}
          inputMode={pendingInput?.input?.text ? 'text' : 'numeric'}
          autoFocus
          dir={pendingInput?.input?.text ? 'rtl' : 'ltr'}
        />
        <button className="nx-sheet-primary display" onClick={submitInput}>تأیید</button>
      </BottomSheet>

      <BottomSheet open={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title="مطمئن هستید؟">
        <p className="nx-confirm-label">{pendingConfirm?.label}</p>
        <div className="nx-confirm-buttons">
          <button className="nx-confirm-yes display" onClick={() => { onAction(pendingConfirm!); setPendingConfirm(null) }}>تأیید</button>
          <button className="nx-confirm-no display" onClick={() => setPendingConfirm(null)}>انصراف</button>
        </div>
      </BottomSheet>
    </div>
  )
}

/** Only the lead primary is a gold slab; a second or third primary on the
 * same screen steps down to an outlined button, so one choice leads. */
function ActionButton({ action, lead, onClick }: { action: Action; lead: boolean; onClick: () => void }) {
  if (action.kind === 'primary') {
    return (
      <button className={`nx-primary${lead ? '' : ' nx-primary-alt'} display`} onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette={lead ? 'cream' : 'gold'} size={18} />
        <span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="nx-action-danger display" onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette="ruby" size={18} />
        <span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'back') {
    return (
      <button className="nx-action-tile nx-action-back" onClick={onClick}>
        <span className="nx-action-back-arrow" aria-hidden>›</span>
        <span className="nx-action-tile-label">{action.label}</span>
      </button>
    )
  }
  return (
    <button className="nx-action-tile" onClick={onClick}>
      <Icon name={action.icon ?? 'box'} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={20} />
      <span className="nx-action-tile-label">{action.label}</span>
    </button>
  )
}
