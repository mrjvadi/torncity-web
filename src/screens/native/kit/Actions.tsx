// The shared actions renderer: every native screen ends with one of these,
// fed the server answer's `actions`. The server sends them as Telegram
// keyboard rows; here they become native controls:
//   * back and refresh buttons are dropped (the header's back button and the
//     app's navigation do that job),
//   * page buttons (‹ ›, page=N) become one small pager,
//   * the one lead primary is a prominent slab, other primaries an outlined
//     slab, danger/confirm a red slab (asks first),
//   * a row of several actions becomes a row of small chips,
//   * a single navigation/secondary action is a list row with a chevron.
// Input actions open a sheet for the value.

import { useMemo, useState } from 'react'
import type { Action, CommandResponse } from '../../../api/types'
import { toWesternDigits } from '../../../lib/persian'
import { cleanLabel } from './format'
import { actionLabel } from '../../village/wording'
import Icon from '../../../ui/Icon'
import Popup, { ActionButton as PopupAction, ActionRow, Note } from '../../../ui/Popup'
import { isRtl, t } from '../../../i18n'
import './actions.css'

/** The text of an action: Telegram's label while the server still sends one, else the web's wording of its id. */
const L = (a: Action) => a.label ?? actionLabel(a)
const REFRESH = /(تازه‌سازی|refresh)\s*$/i
const PREV = /^[\s\p{Extended_Pictographic}️]*[‹«◀⬅←]|^(\S*\s)?(قبلی|prev)/iu
const NEXT = /^[\s\p{Extended_Pictographic}️]*[›»▶➡→]|^(\S*\s)?(بعدی|next)/iu
const PAGE_ARROW = /^[\s\p{Extended_Pictographic}️]*[‹›«»◀▶⬅➡←→]/u

/** A "previous page" / "next page" button of the server's keyboard. */
export function pagerDir(a: Action): 'prev' | 'next' | null {
  if (a.id === 'page.prev') return 'prev'
  if (a.id === 'page.next') return 'next'
  if (a.kind === 'primary' || a.kind === 'danger' || a.kind === 'confirm') return null
  const paged = a.args && a.args.page !== undefined
  if (!paged && !PAGE_ARROW.test(L(a))) return null
  if (PREV.test(L(a))) return 'prev'
  if (NEXT.test(L(a))) return 'next'
  return null
}

export default function Actions({ response, onAction, only, refreshCommand }: {
  response: CommandResponse | null
  onAction: (a: Action) => void
  /** Render only these actions (e.g. skip ones a screen already drew itself). */
  only?: (a: Action) => boolean
  /** Kept for older callers; refresh buttons are always dropped now. */
  refreshCommand?: string
}) {
  const [pendingInput, setPendingInput] = useState<Action | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Action | null>(null)
  const [inputValue, setInputValue] = useState('')
  void refreshCommand

  const { rows, pager } = useMemo(() => {
    const all = (response?.actions ?? [])
      .filter((a) => !only || only(a))
      .filter((a) => a.kind !== 'back' && !(a.kind === 'navigation' && (a.id === 'refresh' || REFRESH.test(L(a)))))
    const pager: { prev?: Action; next?: Action } = {}
    const byRow = new Map<number, Action[]>()
    for (const a of all) {
      const d = pagerDir(a)
      if (d) { pager[d] = a; continue }
      const list = byRow.get(a.row ?? 0) ?? []
      list.push(a)
      byRow.set(a.row ?? 0, list)
    }
    return { rows: [...byRow.entries()].sort((x, y) => x[0] - y[0]), pager }
  }, [response, only])

  const lead = rows.flatMap(([, list]) => list).find((a) => a.kind === 'primary')

  if (rows.length === 0 && !pager.prev && !pager.next) return null

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
    <div className="nx-actions">
      {rows.map(([row, list]) => (
        list.length > 1 && list.every((a) => a.kind !== 'danger' && a.kind !== 'confirm')
          ? (
            <div className="ax-chips" key={row}>
              {list.map((a, i) => (
                <button key={i} className={`ax-chip${a.kind === 'primary' ? ' ax-chip-primary' : ''}`} onClick={() => handleClick(a)}>
                  {a.icon && <Icon name={a.icon} palette={a.kind === 'primary' ? 'gold' : 'steel'} size={16} />}
                  <span>{cleanLabel(L(a))}</span>
                </button>
              ))}
            </div>
          )
          : list.map((a, i) => <ActionButton key={`${row}-${i}`} action={a} lead={a === lead} onClick={() => handleClick(a)} />)
      ))}

      {(pager.prev || pager.next) && (
        <div className="ax-pager">
          {pager.prev ? <button className="ax-page" onClick={() => onAction(pager.prev!)}>{isRtl() ? '›' : '‹'} {t('common.prev')}</button> : <span />}
          {pager.next ? <button className="ax-page" onClick={() => onAction(pager.next!)}>{t('common.next')} {isRtl() ? '‹' : '›'}</button> : <span />}
        </div>
      )}

      <Popup
        open={!!pendingInput} onClose={() => setPendingInput(null)} title={pendingInput ? cleanLabel(L(pendingInput)) : undefined} tone="navy"
        footer={<PopupAction tone="green" onClick={submitInput}>{t('common.confirm')}</PopupAction>}
      >
        <input
          className="nx-sheet-input"
          value={inputValue}
          onChange={(e) => setInputValue(pendingInput?.input?.text ? e.target.value : toWesternDigits(e.target.value))}
          inputMode={pendingInput?.input?.text ? 'text' : 'numeric'}
          autoFocus
          dir={pendingInput?.input?.text ? 'auto' : 'ltr'}
        />
      </Popup>

      <Popup
        open={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title={t('common.sure')} tone="red"
        footer={(
          <ActionRow>
            <PopupAction tone="steel" small onClick={() => setPendingConfirm(null)}>{t('common.cancel')}</PopupAction>
            <PopupAction tone="green" onClick={() => { onAction(pendingConfirm!); setPendingConfirm(null) }}>{t('common.confirm')}</PopupAction>
          </ActionRow>
        )}
      >
        <Note>{pendingConfirm ? cleanLabel(L(pendingConfirm)) : ''}</Note>
      </Popup>
    </div>
  )
}

/** One action that has its row to itself. Only the lead primary is a gold
 * slab; a second primary steps down to an outlined slab. */
function ActionButton({ action, lead, onClick }: { action: Action; lead: boolean; onClick: () => void }) {
  const label = cleanLabel(L(action))
  if (action.kind === 'primary') {
    return (
      <button className={`nx-primary${lead ? '' : ' nx-primary-alt'} display`} onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette={lead ? 'cream' : 'gold'} size={18} />
        <span>{label}</span>
      </button>
    )
  }
  if (action.kind === 'danger' || action.kind === 'confirm') {
    return (
      <button className="nx-action-danger display" onClick={onClick}>
        <Icon name={action.icon ?? 'box'} palette="ruby" size={18} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button className="ax-row" onClick={onClick}>
      <span className="ax-row-plate"><Icon name={action.icon ?? 'box'} palette={action.kind === 'navigation' ? 'sapphire' : 'steel'} size={18} /></span>
      <span className="ax-row-label">{label}</span>
      <span className="ax-row-chev" aria-hidden>{isRtl() ? '‹' : '›'}</span>
    </button>
  )
}
