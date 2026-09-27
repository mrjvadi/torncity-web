import { useMemo, useState } from 'react'
import type { Action, CommandResponse } from '../api/types'
import { sanitizeTelegramHtml } from '../lib/sanitizeHtml'
import { toWesternDigits } from '../lib/persian'
import Icon from './Icon'
import BottomSheet from './BottomSheet'
import Skeleton from './Skeleton'

interface GenericScreenProps {
  response: CommandResponse | null
  loading: boolean
  onAction: (action: Action) => void
}

export default function GenericScreen({ response, loading, onAction }: GenericScreenProps) {
  const [pendingInput, setPendingInput] = useState<Action | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [inputValue, setInputValue] = useState('')

  const rows = useMemo(() => {
    const actions = response?.actions ?? []
    const byRow = new Map<number, Action[]>()
    for (const a of actions) {
      const list = byRow.get(a.row) ?? []
      list.push(a)
      byRow.set(a.row, list)
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0])
  }, [response])

  if (loading && !response) {
    return (
      <div className="screen-scroll">
        <div className="screen-card"><Skeleton lines={4} /></div>
        <div className="tile-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      </div>
    )
  }

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
    <div className="screen-scroll">
      {response?.text && (
        <div className="screen-card">
          <div
            className="screen-text"
            dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(response.text) }}
          />
        </div>
      )}

      {rows.map(([row, actions]) => (
        <div className="action-row" key={row}>
          {actions.map((a, i) => (
            <ActionButton key={`${row}-${i}`} action={a} onClick={() => handleClick(a)} />
          ))}
        </div>
      ))}

      <BottomSheet open={!!pendingInput} onClose={() => setPendingInput(null)} title={pendingInput?.label}>
        <input
          className="sheet-input"
          value={inputValue}
          onChange={(e) => setInputValue(pendingInput?.input?.text ? e.target.value : toWesternDigits(e.target.value))}
          inputMode={pendingInput?.input?.text ? 'text' : 'numeric'}
          autoFocus
          dir={pendingInput?.input?.text ? 'rtl' : 'ltr'}
        />
        <button className="sheet-primary-btn display" onClick={submitInput}>تأیید</button>
      </BottomSheet>

      <BottomSheet open={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title="مطمئن هستید؟">
        <p className="confirm-label">{pendingConfirm?.label}</p>
        <div className="confirm-buttons">
          <button className="confirm-yes display" onClick={() => { onAction(pendingConfirm!); setPendingConfirm(null) }}>تأیید</button>
          <button className="confirm-no display" onClick={() => setPendingConfirm(null)}>انصراف</button>
        </div>
      </BottomSheet>

      <GenericStyles />
    </div>
  )
}

function ActionButton({ action, onClick }: { action: Action; onClick: () => void }) {
  if (action.kind === 'primary') {
    return (
      <button className="action-primary display" onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette="cream" size={22} />
        <span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="action-danger display" onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette="ruby" size={20} />
        <span>{action.label}</span>
      </button>
    )
  }
  return (
    <button className={`action-tile${action.kind === 'back' ? ' action-back' : ''}`} onClick={onClick}>
      <Icon name={action.icon ?? 'box'} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={24} />
      <span className="action-tile-label">{action.label}</span>
    </button>
  )
}

function GenericStyles() {
  return (
    <style>{`
      .screen-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px 14px calc(24px + var(--safe-b)); display: flex; flex-direction: column; gap: 12px; }
      .screen-card {
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid rgba(242,194,85,0.22);
        border-radius: 18px;
        padding: 16px;
      }
      .screen-text { font-size: 15px; line-height: 2; color: var(--text); white-space: normal; }
      .screen-text b { color: var(--gold); }
      .screen-text code { background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 6px; direction: ltr; display: inline-block; }
      .screen-text .tg-quote { border-inline-start: 3px solid var(--gold-soft); padding: 4px 10px; margin: 8px 0; background: rgba(255,255,255,0.03); border-radius: 8px; }
      .screen-text .tg-quote summary { cursor: pointer; color: var(--gold); list-style: none; }
      .screen-text .tg-quote summary::-webkit-details-marker { display: none; }
      .screen-text .tg-quote summary::before { content: '▸ بیشتر'; }
      .screen-text .tg-quote[open] summary::before { content: '▾ کمتر'; }

      .action-row { display: flex; flex-wrap: wrap; gap: 10px; }
      .action-primary {
        flex: 1 1 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(180deg, #ffe680, #f5a11f); color: #4a2600;
        font-size: 17px; padding: 14px; border-radius: 16px;
        box-shadow: 0 6px 0 #9a4e06, 0 10px 20px rgba(0,0,0,0.3);
      }
      .action-primary:active { transform: translateY(3px); box-shadow: 0 3px 0 #9a4e06; }
      .action-danger {
        flex: 1 1 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(180deg, #4a1418, #2a0a0c); color: #ffd9db;
        border: 1px solid var(--anar); font-size: 16px; padding: 13px; border-radius: 16px;
      }
      .action-tile {
        flex: 1 1 calc(50% - 5px); min-width: 140px; display: flex; align-items: center; gap: 10px;
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid rgba(242,194,85,0.18);
        border-radius: 14px; padding: 12px;
      }
      .action-tile-label { font-size: 14px; color: var(--text); text-align: right; }
      .action-back { border-color: rgba(255,255,255,0.15); }

      .sheet-input {
        width: 100%; background: var(--panel-deep); border: 1px solid var(--gold-soft);
        border-radius: 14px; padding: 14px; font-size: 20px; text-align: center; color: var(--gold); margin-bottom: 14px;
      }
      .sheet-primary-btn {
        width: 100%; background: linear-gradient(180deg, #ffe680, #f5a11f); color: #4a2600;
        font-size: 17px; padding: 14px; border-radius: 14px;
      }
      .confirm-label { text-align: center; color: var(--text-dim); margin-bottom: 18px; }
      .confirm-buttons { display: flex; gap: 10px; }
      .confirm-yes { flex: 1; background: var(--anar); color: #fff; padding: 13px; border-radius: 14px; font-size: 16px; }
      .confirm-no { flex: 1; background: rgba(255,255,255,0.08); color: var(--text); padding: 13px; border-radius: 14px; font-size: 16px; }
    `}</style>
  )
}
