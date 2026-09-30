import { useMemo, useState } from 'react'
import type { Action, CommandResponse } from '../api/types'
import { sanitizeTelegramHtml } from '../lib/sanitizeHtml'
import { toWesternDigits } from '../lib/persian'
import Icon from './Icon'
import Skeleton from './Skeleton'
import Actions from '../screens/native/kit/Actions'
import { t } from '../i18n'

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

  const lead = rows.flatMap(([, list]) => list).find((a) => a.kind === 'primary')

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

      <Actions response={response} onAction={onAction} />

      <GenericStyles />
    </div>
  )
}

/** Only the lead primary is a gold slab; a second or third primary on the
 * same screen steps down to an outlined button, so one choice leads. */
function ActionButton({ action, lead, onClick }: { action: Action; lead: boolean; onClick: () => void }) {
  if (action.kind === 'primary') {
    return (
      <button className={`action-primary${lead ? '' : ' action-primary-alt'} display`} onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette={lead ? 'cream' : 'gold'} size={18} />
        <span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="action-danger display" onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette="ruby" size={18} />
        <span>{action.label}</span>
      </button>
    )
  }
  if (action.kind === 'back') {
    return (
      <button className="action-tile action-back" onClick={onClick}>
        <span className="action-back-arrow" aria-hidden>›</span>
        <span className="action-tile-label">{action.label}</span>
      </button>
    )
  }
  return (
    <button className="action-tile" onClick={onClick}>
      <Icon name={action.icon ?? 'box'} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={20} />
      <span className="action-tile-label">{action.label}</span>
    </button>
  )
}

function GenericStyles() {
  return (
    <style>{`
      .screen-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 10px 12px calc(20px + var(--safe-b)); display: flex; flex-direction: column; gap: 10px; }
      .screen-card {
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid rgba(242,194,85,0.22);
        border-radius: 14px;
        padding: 12px;
      }

      .action-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .action-primary {
        flex: 1 1 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(180deg, #ffe680, #f5a11f); color: #4a2600;
        font-size: 15px; padding: 10px 12px; border-radius: 14px;
        box-shadow: 0 4px 0 #9a4e06, 0 6px 14px rgba(0,0,0,0.3);
      }
      .action-primary:active { transform: translateY(2px); box-shadow: 0 2px 0 #9a4e06; }
      .action-primary-alt { background: linear-gradient(180deg, rgba(242,194,85,0.16), rgba(242,194,85,0.05)); color: var(--gold); border: 1px solid var(--gold-soft); box-shadow: none; }
      .action-primary-alt:active { box-shadow: none; }
      .action-danger {
        flex: 1 1 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(180deg, #4a1418, #2a0a0c); color: #ffd9db;
        border: 1px solid var(--anar); font-size: 14px; padding: 10px; border-radius: 14px;
      }
      .action-tile {
        flex: 1 1 calc(50% - 4px); min-width: 130px; display: flex; align-items: center; gap: 8px;
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid rgba(242,194,85,0.18);
        border-radius: 12px; padding: 9px 10px;
      }
      .action-tile-label { font-size: 13px; color: var(--text); text-align: start; }
      .action-back { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); justify-content: center; }
      .action-back .action-tile-label { color: var(--text-dim); }
      .action-back-arrow { font-size: 18px; line-height: 1; color: var(--text-dim); }

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
