// The politics and society screens, drawn from `view` alone (docs/adr/0039-presentation-split.md).
// The server sends a screen name, a typed view and the actions the player may take by meaning
// (`id`, `command`, named `args`, `kind`, `subject`); the words are this client's.
//
// One host serves every screen of the area: it keeps the answer on show, turns an action into
// a read (opens the screen the command answers, through the shell, so back works), a write (runs
// it here, with an idempotency key, and shows the answer: the result, or the refusal) or a typed
// value (asks for it in a centred popup first).

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import * as api from '../../api/client'
import type { Action, CommandResponse } from '../../api/types'
import type { ScreenComponent, ScreenProps } from '../types'
import { ScreenScroll, Header, Card } from '../native/kit/Parts'
import Skeleton from '../../ui/Skeleton'
import Popup, { ActionButton, Note } from '../../ui/Popup'
import { noticeText, refusalText, t } from '../../i18n'
import { useNav } from '../../state/NavContext'
import { useToast } from '../../state/ToastContext'
import { useFlowCtx, Page, Panel, Lead, Rest, isBack, isRefresh, type FlowCtx } from '../village/flow'
import { actionLabel } from './common'
import './society.css'

export type SocScreen = ComponentType<{ view: unknown; ctx: FlowCtx }>

/** Types a screen by its view (the generated type of the screen's name). */
export function screen<V>(fn: (p: { view: V; ctx: FlowCtx }) => ReactNode): SocScreen {
  return fn as unknown as SocScreen
}

/** The screens of the area that draw from a view only, by the server's screen name. */
export const SOC: Record<string, SocScreen> = {}

export function registerSociety(screens: Record<string, SocScreen>): void {
  Object.assign(SOC, screens)
}

/** Commands that change the world and answer with the screen of the result: run here, in place. */
const WRITES = new Set([
  'gov.set', 'gov.seat', 'gov.unseat', 'gov.allocset', 'election.stand', 'election.vote', 'faction.apply', 'faction.answer',
  'faction.join', 'faction.launch', 'faction.calloff', 'faction.plan', 'faction.link', 'law.vote', 'social.friend.add',
  'social.friend.accept', 'diplomacy.answer', 'faction.invite', 'faction.deposit', 'faction.withdraw', 'gov.appoint',
])

/** Typed values: the action's id, the field its command takes it in, and whether it is words. */
const ASKS: Record<string, { field: string; text: boolean }> = {
  'gov.appoint': { field: 'to', text: true },
  'faction.found.pay': { field: 'name', text: true },
  'faction.invite': { field: 'to', text: true },
  'faction.deposit.cash': { field: 'amount', text: false },
  'faction.deposit.card': { field: 'amount', text: false },
  'faction.withdraw': { field: 'amount', text: false },
}

export const isAsk = (a: Action) => !!ASKS[a.id ?? '']

/** A write changes the world: it asks for the screen's answer itself (never twice). */
export function isWrite(a: Action): boolean {
  if (a.kind === 'confirm' || a.id === 'confirm') return true
  return !!a.command && WRITES.has(a.command) && !isAsk(a)
}

let keySeq = 0

/** The popup that asks for the one value a typed action needs. */
function Ask({ action, ctx, onClose, onSend }: { action: Action; ctx: FlowCtx; onClose: () => void; onSend: (value: string) => void }) {
  const spec = ASKS[action.id ?? '']
  const [value, setValue] = useState('')
  const label = actionLabel(action, ctx.names)
  const ok = spec.text ? value.trim().length > 0 : Number(value.replace(/[^0-9]/g, '')) > 0
  return (
    <Popup onClose={onClose} title={label} tone="gold" footer={<ActionButton tone="gold" disabled={!ok || ctx.busy} onClick={() => onSend(spec.text ? value.trim() : String(Number(value.replace(/[^0-9]/g, ''))))}>{t('soc.ask.send')}</ActionButton>}>
      <Note>{t(spec.text ? 'soc.ask.text_hint' : 'soc.ask.amount_hint')}</Note>
      <input className="sc-input" dir={spec.text ? undefined : 'ltr'} inputMode={spec.text ? 'text' : 'numeric'} autoFocus value={value} onChange={(e) => setValue(e.target.value)}
        aria-label={label} onKeyDown={(e) => { if (e.key === 'Enter' && ok) onSend(spec.text ? value.trim() : String(Number(value.replace(/[^0-9]/g, '')))) }} />
    </Popup>
  )
}

export const SocietyHost: ScreenComponent = (props: ScreenProps) => {
  const { response, loading, run } = props
  const nav = useNav()
  const toast = useToast()
  const [res, setRes] = useState<CommandResponse | null>(response)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<Action | null>(null)
  useEffect(() => setRes(response), [response])

  const exec = useCallback(async (a: Action, extra: Record<string, string> = {}) => {
    setBusy(true)
    try {
      const r = await api.runCommand(a.command ?? '', { ...(a.args ?? {}), ...extra }, `web-s-${Date.now().toString(36)}-${++keySeq}`)
      if (r.ok === false && !SOC[r.screen ?? '']) toast.push(refusalText(r.error?.code, r.error?.message, r.error?.args), { kind: 'error', user: true })
      else {
        setRes(r)
        const note = r.notice ? noticeText(r.notice) : ''
        if (note) toast.push(note, { kind: r.notice?.alert ? 'warning' : undefined, user: true })
      }
    } catch (e) {
      toast.push(refusalText((e as { code?: string })?.code ?? 'network'), { kind: 'error', user: true })
    } finally {
      setBusy(false)
    }
  }, [toast])

  const go = useCallback(async (a: Action) => {
    if (a.url) { window.open(a.url, '_blank', 'noopener'); return }
    if (!a.command) return
    if (isBack(a)) { if (nav?.back) nav.back(); else run(a.command, a.args); return }
    if (isAsk(a)) { setAsking(a); return }
    if (isRefresh(a)) { run(a.command, a.args); return }
    if (!isWrite(a)) { run(a.command, a.args); return }
    await exec(a)
  }, [nav, run, exec])

  const safe: CommandResponse = res ?? { ok: true, screen: '' }
  const ctx0 = useFlowCtx(safe, go, busy, { run, openLocal: props.openLocal })
  const ctx: FlowCtx = { ...ctx0, label: (a) => actionLabel(a, ctx0.names) }

  if (!res) {
    return <ScreenScroll><Header title={t('soc.loading')} /><Card>{loading ? <Skeleton lines={3} /> : null}</Card></ScreenScroll>
  }
  const Screen = SOC[res.screen]
  if (!Screen) {
    return (
      <Page title={t('soc.unknown.title')} tone="sapphire">
        <Panel><Lead>{t('soc.unknown.body')}</Lead><Rest ctx={ctx} /></Panel>
      </Page>
    )
  }
  return (
    <>
      <Screen key={res.screen} view={res.view} ctx={ctx} />
      {asking && (
        <Ask action={asking} ctx={ctx} onClose={() => setAsking(null)}
          onSend={(value) => { const a = asking; setAsking(null); void exec(a, { [ASKS[a.id ?? ''].field]: value }) }} />
      )}
    </>
  )
}
