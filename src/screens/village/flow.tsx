// The village's server screens, drawn from `view` alone (docs/adr/0039-presentation-split.md).
// The server sends a screen name, a typed view and the actions the player may take by
// meaning (`id`, `command`, named `args`, `kind`, `subject`); the words are this client's.
//
// One host serves every village screen that has no layout of its own file (screens.tsx):
// it keeps the answer on show, turns an action into a read (opens the screen the command
// answers, through the shell, so back works) or a write (runs it here, with an idempotency
// key, and shows the answer: the result, or the refusal with what is missing).

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import * as api from '../../api/client'
import type { Action, CommandResponse } from '../../api/types'
import type { ScreenComponent, ScreenProps } from '../types'
import { Card, Header, ScreenScroll, type Tone } from '../native/kit/Parts'
import { Slab } from '../../kit'
import Popup, { ActionButton } from '../../ui/Popup'
import { toWesternDigits } from '../../lib/persian'
import Skeleton from '../../ui/Skeleton'
import { noticeText, refusalText, t } from '../../i18n'
import { useNav } from '../../state/NavContext'
import { useToast } from '../../state/ToastContext'
import { useSession } from '../../state/SessionContext'
import { buildingName, useBuildingCatalogue, useContentNames, type ContentNames } from '../../village/useVillage'
import type { CatalogueBuilding } from '../../api/types'
import { actionLabel } from './wording'
import './flow.css'

/** What every village screen gets. */
export interface FlowCtx {
  res: CommandResponse
  acts: Action[]
  names: ContentNames
  cat: Map<string, CatalogueBuilding>
  busy: boolean
  /** Runs an action: a read opens its screen, a write runs here. */
  go: (a: Action) => void
  /** Opens a client-only screen. */
  openLocal: ScreenProps['openLocal']
  run: ScreenProps['run']
  label: (a: Action) => string
  /** A settlement building's name, from the catalogue. */
  bname: (code: string, authored?: string) => string
  /** The actions with this id (or command), in the server's order. */
  by: (id: string) => Action[]
}

export type FlowScreen = ComponentType<{ view: unknown; ctx: FlowCtx }>

/** Types a screen by its view (the generated type of the screen's name). */
export function flow<V>(fn: (p: { view: V; ctx: FlowCtx }) => ReactNode): FlowScreen {
  return fn as unknown as FlowScreen
}

/** Commands that change the world: the host runs them itself, with an idempotency key, and shows their answer.
 * An area adds its own (registerWrites); `when` narrows it to the calls that really write (a departure is a read
 * until a way to pay is chosen). */
const WRITES = new Map<string, ((a: Action) => boolean) | undefined>([
  ['settlement.home.rest', undefined], ['settlement.tax.pay', undefined], ['settlement.terms', undefined],
  ['settlement.work', (a) => !!a.args?.id],
])

export function registerWrites(commands: string[], when?: (a: Action) => boolean): void {
  for (const c of commands) WRITES.set(c, when)
}

let keySeq = 0

/** Other screen areas that run through the host say which of their actions change the world. */
const WRITE_TESTS: ((a: Action) => boolean)[] = []

export function registerWrite(test: (a: Action) => boolean): void {
  WRITE_TESTS.push(test)
}

/** A write changes the world: it asks for the screen's answer itself (never twice). */
export function isWrite(a: Action): boolean {
  if (a.kind === 'confirm' || a.id === 'confirm' || a.args?.confirm) return true
  if (WRITE_TESTS.some((test) => test(a))) return true
  if (!a.command || !WRITES.has(a.command)) return false
  const when = WRITES.get(a.command)
  return !when || when(a)
}

export const isBack = (a: Action) => a.kind === 'back' || a.id === 'back'
export const isRefresh = (a: Action) => a.id === 'refresh'

const TONE: Record<string, 'gold' | 'green' | 'red' | 'blue' | 'steel'> = { primary: 'gold', confirm: 'green', danger: 'red', secondary: 'steel', navigation: 'steel', back: 'steel' }

/** Buttons for a list of actions. */
export function Btns({ ctx, list, row, yes, tone }: { ctx: FlowCtx; list: Action[]; row?: boolean; yes?: string; tone?: 'gold' | 'green' | 'red' | 'blue' | 'steel' }) {
  if (!list.length) return null
  return (
    <div className={`vf-btns${row ? ' row' : ''}`}>
      {list.map((a, i) => (
        <Slab key={`${a.id}-${a.command}-${i}`} tone={tone ?? TONE[a.kind] ?? 'steel'} radius={14} lip={4} disabled={ctx.busy} onClick={() => ctx.go(a)}>
          {a.id === 'confirm' && yes ? yes : ctx.label(a)}
        </Slab>
      ))}
    </div>
  )
}

/** The buttons of a screen that are not its back/refresh and were not already drawn. */
export function Rest({ ctx, skip, yes }: { ctx: FlowCtx; skip?: (a: Action) => boolean; yes?: string }) {
  return <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a) && !(skip && skip(a)))} yes={yes} />
}

/** Cancel on a confirm page: the server's back, worded as saying no. */
export function Cancel({ ctx }: { ctx: FlowCtx }) {
  const b = ctx.acts.find(isBack)
  if (!b) return null
  return <button className="vf-cancel" onClick={() => ctx.go(b)} disabled={ctx.busy}>{t('vx.cancel')}</button>
}

export function Facts({ rows }: { rows: { label: string; value: ReactNode; gold?: boolean }[] }) {
  return (
    <div className="vf-facts">
      {rows.map((r, i) => (
        <div key={i} className="vf-fact"><span>{r.label}</span><b className={r.gold ? 'gold' : undefined}>{r.value}</b></div>
      ))}
    </div>
  )
}

export function Lead({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' }) {
  return <p className={`vf-lead${tone ? ` ${tone}` : ''}`}>{children}</p>
}

export function Hint({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' }) {
  return <div className={`vh-hint${tone ? ` ${tone}` : ''}`}>{children}</div>
}

/** The frame of a screen: ribbon, one card, then whatever the screen adds. */
export function Page({ title, tone, children }: { title: string; tone?: Tone; children: ReactNode }) {
  return (
    <ScreenScroll>
      <Header title={title} tone={tone ?? 'emerald'} />
      {children}
    </ScreenScroll>
  )
}

export function Panel({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return <Card tone={tone}><div className="vf-panel">{children}</div></Card>
}

// -- the host --------------------------------------------------------------------------------

export function useFlowCtx(res: CommandResponse, go: FlowCtx['go'], busy: boolean, props: Pick<ScreenProps, 'openLocal' | 'run'>): FlowCtx {
  const names = useContentNames()
  const cat = useBuildingCatalogue()
  const acts = res.actions ?? []
  return {
    res, acts, names, cat, busy, go, openLocal: props.openLocal, run: props.run,
    label: (a) => actionLabel(a, names),
    bname: (code, authored) => buildingName(cat, code, authored),
    by: (id) => acts.filter((a) => (a.id || a.command) === id),
  }
}

/** The screens of the village area that draw from a view only, by the server's screen name. */
export const FLOW: Record<string, FlowScreen> = {}

export function registerFlow(screens: Record<string, FlowScreen>): void {
  Object.assign(FLOW, screens)
}

/** The component the shell mounts for each of these screen names. */
/** Village screens that have a layout file of their own (status, queue, knowledge, store, labour): a write that
 * answers one of them hands the answer over, so the player lands on that screen. */
export const NATIVE: Record<string, ScreenComponent> = {}

export const FlowHost: ScreenComponent = (props: ScreenProps) => {
  const { response, loading, run, openLocal } = props
  const nav = useNav()
  const toast = useToast()
  const { refreshProfile } = useSession()
  const [res, setRes] = useState<CommandResponse | null>(response)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<Action | null>(null)
  useEffect(() => setRes(response), [response])

  const go = useCallback(async (a: Action) => {
    if (a.url) { window.open(a.url, '_blank', 'noopener'); return }
    if (a.input && !a.args?.[a.input.field]) { setAsking(a); return }
    if (a.id === 'village.found') { openLocal('founding_form'); return }
    if (!a.command) return
    if (isBack(a)) { if (nav?.back) nav.back(); else run(a.command, a.args); return }
    if (!isWrite(a)) { run(a.command, a.args); return }
    setBusy(true)
    try {
      const r = await api.runCommand(a.command, a.args ?? {}, `web-v-${Date.now().toString(36)}-${++keySeq}`)
      // a refusal that has a screen of its own (what is missing, the way on) is shown; any other is a toast
      if (r.ok === false && !FLOW[r.screen] && !NATIVE[r.screen]) toast.push(refusalText(r.error?.code, r.error?.message, r.error?.args), { kind: 'error' })
      else {
        setRes(r)
        const note = r.notice ? noticeText(r.notice) : ''
        if (note) toast.push(note, { kind: r.notice?.alert ? 'warning' : 'success', user: true })
      }
    } catch (e) {
      toast.push(refusalText((e as { code?: string })?.code ?? 'network'), { kind: 'error' })
    } finally {
      setBusy(false)
      void refreshProfile()
    }
  }, [nav, run, openLocal, toast, refreshProfile])

  const safe: CommandResponse = res ?? { ok: true, screen: '' }
  const ctx = useFlowCtx(safe, go, busy, { run, openLocal })
  if (!res) {
    return <ScreenScroll><Header title={t('vx.loading')} /><Card>{loading ? <Skeleton lines={3} /> : null}</Card></ScreenScroll>
  }
  const Screen = FLOW[res.screen]
  const Own = NATIVE[res.screen]
  const asked = asking && (
    <AskPopup action={asking} ctx={ctx} onClose={() => setAsking(null)}
      onSubmit={(value) => { const a = asking; setAsking(null); void go({ ...a, args: { ...(a.args ?? {}), [a.input!.field]: value } }) }} />
  )
  if (!Screen && Own) return <Own {...props} response={res} />
  if (!Screen) {
    return (
      <Page title={t('vx.unknown.title')} tone="sapphire">
        <Panel><Lead>{t('vx.unknown.body')}</Lead><Rest ctx={ctx} /></Panel>
      </Page>
    )
  }
  return <><Screen key={res.screen} view={res.view} ctx={ctx} />{asked}</>
}

/** The value an action asks the player to type (an amount, a name), over the screen. */
function AskPopup({ action, ctx, onClose, onSubmit }: { action: Action; ctx: FlowCtx; onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('')
  const text = !!action.input?.text
  const clean = text ? value.trim() : toWesternDigits(value).replace(/[^0-9]/g, '')
  return (
    <Popup open onClose={onClose} title={ctx.label(action)} tone="navy"
      footer={<ActionButton tone="green" disabled={!clean} onClick={() => onSubmit(clean)}>{t('common.confirm')}</ActionButton>}>
      <input className="vd-input" inputMode={text ? 'text' : 'numeric'} dir={text ? 'auto' : 'ltr'} autoFocus value={value}
        onChange={(e) => setValue(e.target.value)} aria-label={ctx.label(action)}
        onKeyDown={(e) => { if (e.key === 'Enter' && clean) onSubmit(clean) }} />
    </Popup>
  )
}
