import { useMemo, useState } from 'react'
import type { Action } from '../../../api/types'
import { toWesternDigits } from '../../../lib/persian'
import Icon from '../../../ui/Icon'
import BottomSheet from '../../../ui/BottomSheet'
import { resolveActionIcon } from './theme'

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
          {rowActions.map((a, i) => <OneButton key={`${row}-${i}`} action={a} onClick={() => handleClick(a)} />)}
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
        <button className="ft-sheet-primary-btn display" onClick={submitInput}>تأیید</button>
      </BottomSheet>

      <BottomSheet open={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title="مطمئن هستید؟">
        <p className="ft-confirm-label">{pendingConfirm?.label}</p>
        <div className="ft-confirm-buttons">
          <button className="ft-confirm-yes display" onClick={() => { onAction(pendingConfirm!); setPendingConfirm(null) }}>تأیید</button>
          <button className="ft-confirm-no display" onClick={() => setPendingConfirm(null)}>انصراف</button>
        </div>
      </BottomSheet>
    </>
  )
}

function OneButton({ action, onClick }: { action: Action; onClick: () => void }) {
  const icon = resolveActionIcon(action.icon) ?? 'box'
  if (action.kind === 'primary') {
    return (
      <button className="ft-btn ft-btn-gold display" style={{ flex: '1 1 100%' }} onClick={onClick}>
        <Icon name={icon} palette="cream" size={20} /><span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="ft-btn ft-btn-red display" style={{ flex: '1 1 100%' }} onClick={onClick}>
        <Icon name={icon} palette="cream" size={20} /><span>{action.label}</span>
      </button>
    )
  }
  return (
    <button
      className="ft-btn display"
      style={{
        flex: '1 1 calc(50% - 5px)',
        background: action.kind === 'back' ? 'rgba(255,255,255,0.06)' : 'linear-gradient(180deg, var(--panel), var(--panel-2))',
        border: '1px solid rgba(242,194,85,0.22)', boxShadow: 'none', color: 'var(--text)',
      }}
      onClick={onClick}
    >
      <Icon name={icon} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={20} />
      <span>{action.label}</span>
    </button>
  )
}
