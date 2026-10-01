// The founding form (client-api.md section 4.4): before a village exists, the
// player who asked for it in the group chooses its name, emblem, motto and the
// national currency it reserves. Submitting the form founds the village; a
// draft that waits too long founds nothing. Anyone else who opens the link
// reads it, and only the founder can submit. Built on the native kit like the
// other screens; the emblem is drawn from four catalogue codes (lib/emblem).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScreenProps } from '../types'
import * as api from '../../api/client'
import type {
  EmblemCodes, FoundingChoice, FoundingField, FoundingFormView, FoundingLimits, FoundingProblem, FoundingSubmitArgs,
} from '../../api/types'
import { Card, Chip, Empty, Header, PrimaryButton, ScreenScroll, SectionTitle } from '../native/kit/Parts'
import Emblem, { Glyph } from '../../lib/emblem'
import Popup, { ActionButton, Note } from '../../ui/Popup'
import { t, hasKey, refusalText, type Key } from '../../i18n'
import { friendlyError } from '../../lib/errors'
import { useSession } from '../../state/SessionContext'
import { useToast, type ToastOptions } from '../../state/ToastContext'
import { useNow } from '../../village/useVillage'
import { shade } from '../../kit/color'
import './founding.css'

interface FormState {
  name: string
  motto: string
  currencyName: string
  currencyCode: string
  currencySymbol: string
  emblem: EmblemCodes
}

const FIELDS: FoundingField[] = ['name', 'emblem', 'motto', 'currency_name', 'currency_code', 'currency_symbol']

/** "MM:SS" left until an instant, "0:00" once it has passed. */
function timeLeft(expiresAt: string, now: number): string {
  const s = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The sentence for a coded problem: the client's own text with the limits filled in. */
export function problemText(p: FoundingProblem, limits: FoundingLimits): string {
  return t(`founding.problem.${p.code}` as Key, limits as unknown as Record<string, number>)
}

/** A shape, colour or icon by its code, in the player's language (the server sends no names). */
function choiceName(kind: 'shape' | 'color' | 'icon', code: string): string {
  const key = `founding.${kind}.${code}`
  return hasKey(key) ? t(key as Key) : code
}

function hexOf(list: FoundingChoice[], code: string): string {
  return list.find((c) => c.code === code)?.hex ?? '#8a93b8'
}

function toArgs(draft: string, f: FormState, check: boolean): FoundingSubmitArgs {
  return {
    draft, name: f.name.trim(), motto: f.motto.trim(), currency_name: f.currencyName.trim(),
    currency_code: f.currencyCode, currency_symbol: f.currencySymbol.trim(),
    shape: f.emblem.shape, color_a: f.emblem.color_a, color_b: f.emblem.color_b, icon: f.emblem.icon,
    ...(check ? { check: '1' } : {}),
  }
}

export default function FoundingForm({ localArgs, openLocal }: ScreenProps) {
  const { bootstrap, refreshBootstrap } = useSession()
  const toast = useToast()
  const [view, setView] = useState<FoundingFormView | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const draftArg = localArgs?.draft ?? ''

  const load = useCallback(async () => {
    try {
      const r = await api.runCommand('settlement.found.draft', draftArg ? { draft: draftArg } : {})
      if (r.ok && r.view) {
        setView(r.view as unknown as FoundingFormView)
        setMissing(null)
      } else {
        setMissing(r.error?.code ?? 'founding_no_draft')
      }
      setError(null)
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [draftArg])
  useEffect(() => { void load() }, [load])

  // A read-only or finished form is polled slowly: the founder may finish it while we look.
  const state = view?.state
  useEffect(() => {
    if (state !== 'other') return
    const id = window.setInterval(() => { void load() }, 8000)
    return () => clearInterval(id)
  }, [state, load])

  const goHome = useCallback(async () => {
    await refreshBootstrap()
    openLocal('village_home')
  }, [refreshBootstrap, openLocal])

  const back = () => openLocal('village_home')

  if (error && !view) {
    return (
      <ScreenScroll>
        <Header title={t('founding.title')} tone="emerald" onBack={back} onRefresh={() => void load()} />
        <Empty>{error}</Empty>
      </ScreenScroll>
    )
  }
  if (!view && missing) {
    return (
      <ScreenScroll>
        <Header title={t('founding.title')} tone="emerald" onBack={back} onRefresh={() => void load()} />
        <Card>
          <div className="ff-msg">
            <div className="ff-msg-icon">📝</div>
            <div className="ff-msg-title">{t('founding.none.title')}</div>
            <div className="ff-msg-body">{t('founding.none.body')}</div>
          </div>
        </Card>
      </ScreenScroll>
    )
  }
  if (!view) {
    return (
      <ScreenScroll>
        <Header title={t('founding.title')} tone="emerald" />
        <Empty>{t('founding.loading')}</Empty>
      </ScreenScroll>
    )
  }

  if (view.state === 'mine') {
    return <Editor view={view} onDone={goHome} onBack={back} toast={toast.push} />
  }

  return (
    <ScreenScroll>
      <Header title={t('founding.title')} tone="emerald" onBack={back} onRefresh={() => void load()} />
      <Card tone={view.state === 'expired' ? 'ruby' : 'emerald'}>
        <div className="ff-msg">
          {view.state === 'other' && (
            <>
              <Emblem {...emblemProps(view, view.default_emblem)} size={96} />
              <div className="ff-msg-title">{t('founding.other.title', { founder: view.founder || t('pn.someone') })}</div>
              <div className="ff-msg-body">{t('founding.other.body')}</div>
              <Chip tone="gold">{t('founding.time_left', { time: timeLeft(view.expires_at, Date.now()) })}</Chip>
            </>
          )}
          {view.state === 'expired' && (
            <>
              <div className="ff-msg-icon">⏳</div>
              <div className="ff-msg-title">{t('founding.expired.title')}</div>
              <div className="ff-msg-body">{t('founding.expired.body')}</div>
            </>
          )}
          {view.state === 'founded' && (
            <>
              <div className="ff-msg-icon">🏡</div>
              <div className="ff-msg-title">{t('founding.founded.title', { name: view.settlement_name ?? '' })}</div>
              <div className="ff-msg-body">{t('founding.founded.body')}</div>
              {bootstrap?.settlement?.id === view.settlement_id || view.settlement_id
                ? <PrimaryButton onClick={() => void goHome()}>{t('founding.founded.go')}</PrimaryButton>
                : null}
            </>
          )}
        </div>
      </Card>
    </ScreenScroll>
  )
}

function emblemProps(view: FoundingFormView, e: EmblemCodes) {
  return { shape: e.shape, colorA: hexOf(view.palette, e.color_a), colorB: hexOf(view.palette, e.color_b), icon: e.icon }
}

// -- the editor (the founder) ---------------------------------------------------------------------

function Editor({ view, onDone, onBack, toast }: {
  view: FoundingFormView
  onDone: () => Promise<void>
  onBack: () => void
  toast: (text: string, opts?: ToastOptions) => void
}) {
  const lim = view.limits
  const [f, setF] = useState<FormState>({
    name: view.suggested_name, motto: '', currencyName: '', currencyCode: '', currencySymbol: '', emblem: view.default_emblem,
  })
  const [touched, setTouched] = useState<Partial<Record<FoundingField, boolean>>>({})
  const [problems, setProblems] = useState<FoundingProblem[]>([])
  const [checking, setChecking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const now = useNow(1000)
  const seq = useRef(0)
  const fieldRefs = useRef<Partial<Record<FoundingField, HTMLElement | null>>>({})

  const set = <K extends keyof FormState>(k: K, v: FormState[K], field: FoundingField) => {
    setF((p) => ({ ...p, [k]: v }))
    setTouched((p) => ({ ...p, [field]: true }))
  }

  // Ask the server to check the form (nothing is founded) shortly after the last edit.
  const runCheck = useCallback(async (form: FormState): Promise<FoundingProblem[]> => {
    const mine = ++seq.current
    setChecking(true)
    try {
      const r = await api.runCommand('settlement.found.submit', toArgs(view.draft, form, true) as unknown as Record<string, string>)
      if (mine !== seq.current) return []
      const list = r.ok ? [] : ((r.view as { problems?: FoundingProblem[] } | undefined)?.problems ?? [])
      setProblems(list)
      if (!r.ok && !list.length) toast(refusalText(r.error?.code, r.error?.message, r.error?.args), { kind: 'error', user: true })
      return list
    } catch (e) {
      if (mine === seq.current) toast(friendlyError(e), { kind: 'error', user: true })
      return []
    } finally {
      if (mine === seq.current) setChecking(false)
    }
  }, [view.draft, toast])

  useEffect(() => {
    if (!Object.keys(touched).length) return
    const id = window.setTimeout(() => { void runCheck(f) }, 450)
    return () => clearTimeout(id)
  }, [f, touched, runCheck])

  const visible = (field: FoundingField) => problems.filter((p) => p.field === field && touched[field])
  const firstError = (field: FoundingField) => visible(field)[0]

  const submitClicked = async () => {
    const all: Partial<Record<FoundingField, boolean>> = {}
    for (const k of FIELDS) all[k] = true
    setTouched(all)
    const list = await runCheck(f)
    if (list.length) {
      const first = FIELDS.find((k) => list.some((p) => p.field === k))
      if (first) fieldRefs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast(t('founding.fix_first'), { kind: 'warning', user: true })
      return
    }
    setConfirm(true)
  }

  const found = async () => {
    setBusy(true)
    try {
      const r = await api.runCommand('settlement.found.submit', toArgs(view.draft, f, false) as unknown as Record<string, string>, `found-${view.draft}`)
      if (r.ok) {
        toast(t('founding.done_toast'), { kind: 'success', user: true })
        setConfirm(false)
        await onDone()
        return
      }
      setConfirm(false)
      const list = (r.view as { problems?: FoundingProblem[] } | undefined)?.problems ?? []
      if (list.length) {
        setProblems(list)
        const all: Partial<Record<FoundingField, boolean>> = {}
        for (const k of FIELDS) all[k] = true
        setTouched(all)
      } else {
        toast(refusalText(r.error?.code, r.error?.message, r.error?.args), { kind: 'error', user: true })
      }
    } catch (e) {
      toast(friendlyError(e), { kind: 'error', user: true })
    } finally {
      setBusy(false)
    }
  }

  const colorA = hexOf(view.palette, f.emblem.color_a)
  const colorB = hexOf(view.palette, f.emblem.color_b)
  const setEmblem = (patch: Partial<EmblemCodes>) => {
    setF((p) => ({ ...p, emblem: { ...p.emblem, ...patch } }))
    setTouched((p) => ({ ...p, emblem: true }))
  }
  const pickColor = (which: 'color_a' | 'color_b', code: string) => {
    const other = which === 'color_a' ? 'color_b' : 'color_a'
    // choosing the colour the other slot holds swaps the two: they must differ
    if (f.emblem[other] === code) setEmblem({ [which]: code, [other]: f.emblem[which] })
    else setEmblem({ [which]: code })
  }

  const timeText = timeLeft(view.expires_at, now)
  const symbolShown = f.currencySymbol.trim() || f.currencyCode

  return (
    <ScreenScroll>
      <Header title={t('founding.title')} tone="emerald" onBack={onBack} />
      <div className="ff-intro">
        {t('founding.intro')} <span className="ff-timer">{t('founding.time_left', { time: timeText })}</span>
      </div>

      <Card tone="emerald" className="ff-preview">
        <div className="ff-preview-tag">{t('founding.preview')}</div>
        <Emblem shape={f.emblem.shape} colorA={colorA} colorB={colorB} icon={f.emblem.icon} size={76} />
        <div className="ff-preview-name display">{f.name.trim() || t('founding.preview_name_empty')}</div>
        {f.motto.trim() && <div className="ff-preview-motto">«{f.motto.trim()}»</div>}
        {(f.currencyName.trim() || f.currencyCode) && (
          <div className="ff-preview-cur">
            <span className="ff-preview-cur-tag">{t('founding.reserved_currency')}</span>
            <span>{f.currencyName.trim() || '…'}</span>
            <span className="ff-ltr ff-code">{f.currencyCode || '---'}</span>
            {symbolShown && <span className="ff-ltr ff-sym">{symbolShown}</span>}
          </div>
        )}
      </Card>

      <SectionTitle>{t('founding.section.name')}</SectionTitle>
      <Card>
        <Field
          label={t('founding.field.name')} hint={t('founding.field.name_hint')} err={firstError('name')} lim={lim}
          counter={`${[...f.name.trim()].length}/${lim.name_max}`} refFor={(el) => { fieldRefs.current.name = el }}
        >
          <input
            className="ff-input" dir="auto" value={f.name} maxLength={lim.name_max + 6} autoComplete="off"
            aria-invalid={!!firstError('name')} onChange={(e) => set('name', e.target.value, 'name')}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          />
        </Field>
      </Card>

      <SectionTitle>{t('founding.section.emblem')}</SectionTitle>
      <Card>
        <div ref={(el) => { fieldRefs.current.emblem = el }} className="ff-emblem">
          <div className="ff-lab">{t('founding.emblem.shape')}</div>
          <div className="ff-shapes">
            {view.shapes.map((s) => (
              <button key={s.code} className={`ff-shape${f.emblem.shape === s.code ? ' on' : ''}`} onClick={() => setEmblem({ shape: s.code })} aria-label={choiceName('shape', s.code)} aria-pressed={f.emblem.shape === s.code}>
                <Emblem shape={s.code} colorA={colorA} colorB={colorB} icon={f.emblem.icon} size={36} bare />
                <span>{choiceName('shape', s.code)}</span>
              </button>
            ))}
          </div>

          <div className="ff-lab">{t('founding.emblem.icon')}</div>
          <div className="ff-icons">
            {view.icons.map((ic) => (
              <button key={ic.code} className={`ff-icon${f.emblem.icon === ic.code ? ' on' : ''}`} onClick={() => setEmblem({ icon: ic.code })} aria-label={choiceName('icon', ic.code)} aria-pressed={f.emblem.icon === ic.code}>
                <svg viewBox="0 0 24 24" width="24" height="24"><Glyph icon={ic.code} fill={f.emblem.icon === ic.code ? '#ffe9a8' : '#c5cbe6'} line="rgba(0,0,0,0.55)" /></svg>
              </button>
            ))}
          </div>

          {(['color_a', 'color_b'] as const).map((which) => (
            <div key={which}>
              <div className="ff-lab">{t(`founding.emblem.${which}`)}</div>
              <div className="ff-colors">
                {view.palette.map((c) => (
                  <button
                    key={c.code} className={`ff-color${f.emblem[which] === c.code ? ' on' : ''}${f.emblem[which === 'color_a' ? 'color_b' : 'color_a'] === c.code ? ' used' : ''}`}
                    style={{ background: `linear-gradient(180deg, ${shade(c.hex ?? '#888', 0.25)}, ${c.hex})` }}
                    onClick={() => pickColor(which, c.code)} aria-label={choiceName('color', c.code)} aria-pressed={f.emblem[which] === c.code}
                  />
                ))}
              </div>
            </div>
          ))}
          {firstError('emblem') && <div className="ff-err">{problemText(firstError('emblem')!, lim)}</div>}
        </div>
      </Card>

      <SectionTitle>{t('founding.section.motto')}</SectionTitle>
      <Card>
        <Field
          label={t('founding.field.motto')} err={firstError('motto')} lim={lim}
          counter={`${[...f.motto.trim()].length}/${lim.motto_max}`} refFor={(el) => { fieldRefs.current.motto = el }}
        >
          <input
            className="ff-input" dir="auto" value={f.motto} maxLength={lim.motto_max + 10} autoComplete="off"
            placeholder={t('founding.field.motto_placeholder')} aria-invalid={!!firstError('motto')}
            onChange={(e) => set('motto', e.target.value, 'motto')}
          />
        </Field>
      </Card>

      <SectionTitle>{t('founding.section.currency')}</SectionTitle>
      <Card>
        <div className="ff-note">{t('founding.currency_note', { neutral: t('unit.money') })}</div>
        <Field
          label={t('founding.field.currency_name')} err={firstError('currency_name')} lim={lim}
          counter={`${[...f.currencyName.trim()].length}/${lim.currency_name_max}`} refFor={(el) => { fieldRefs.current.currency_name = el }}
        >
          <input
            className="ff-input" dir="auto" value={f.currencyName} maxLength={lim.currency_name_max + 6} autoComplete="off"
            placeholder={t('founding.field.currency_name_placeholder')} aria-invalid={!!firstError('currency_name')}
            onChange={(e) => set('currencyName', e.target.value, 'currency_name')}
          />
        </Field>
        <div className="ff-two">
          <Field
            label={t('founding.field.currency_code')} hint={t('founding.field.currency_code_hint', { n: lim.currency_code_len })}
            err={firstError('currency_code')} lim={lim} refFor={(el) => { fieldRefs.current.currency_code = el }}
          >
            <input
              className="ff-input ff-ltr ff-mono" dir="ltr" value={f.currencyCode} maxLength={lim.currency_code_len} autoComplete="off"
              autoCapitalize="characters" spellCheck={false} placeholder="KRD" aria-invalid={!!firstError('currency_code')}
              onChange={(e) => set('currencyCode', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, lim.currency_code_len), 'currency_code')}
            />
          </Field>
          <Field
            label={t('founding.field.currency_symbol')} hint={t('founding.field.currency_symbol_hint')}
            err={firstError('currency_symbol')} lim={lim} refFor={(el) => { fieldRefs.current.currency_symbol = el }}
          >
            <input
              className="ff-input ff-ltr" dir="auto" value={f.currencySymbol} maxLength={lim.currency_symbol_max} autoComplete="off"
              placeholder={f.currencyCode || 'K'} aria-invalid={!!firstError('currency_symbol')}
              onChange={(e) => set('currencySymbol', e.target.value.replace(/\s/g, ''), 'currency_symbol')}
            />
          </Field>
        </div>
      </Card>

      <div className="ff-submit">
        <PrimaryButton onClick={() => void submitClicked()} disabled={checking || busy}>
          {checking ? t('founding.checking') : t('founding.submit')}
        </PrimaryButton>
      </div>

      <Popup
        open={confirm} onClose={() => setConfirm(false)} title={t('founding.confirm_title')} tone="gold" dismissible={!busy}
        footer={(
          <>
            <ActionButton tone="green" onClick={() => void found()} busy={busy}>{busy ? t('founding.founding') : t('founding.confirm_yes')}</ActionButton>
            <button className="ff-link" onClick={() => setConfirm(false)} disabled={busy}>{t('founding.confirm_edit')}</button>
          </>
        )}
      >
        <div className="ff-confirm">
          <Emblem shape={f.emblem.shape} colorA={colorA} colorB={colorB} icon={f.emblem.icon} size={92} />
          <div className="ff-preview-name display">{f.name.trim()}</div>
          {f.motto.trim() && <div className="ff-preview-motto">«{f.motto.trim()}»</div>}
          <div className="ff-preview-cur">
            <span className="ff-preview-cur-tag">{t('founding.reserved_currency')}</span>
            <span>{f.currencyName.trim()}</span>
            <span className="ff-ltr ff-code">{f.currencyCode}</span>
            <span className="ff-ltr ff-sym">{symbolShown}</span>
          </div>
          <Note>{t('founding.currency_note', { neutral: t('unit.money') })}</Note>
          <Note>{t('founding.confirm_body')}</Note>
        </div>
      </Popup>
    </ScreenScroll>
  )
}

function Field({ label, hint, err, lim, counter, refFor, children }: {
  label: string
  hint?: string
  err?: FoundingProblem
  lim: FoundingLimits
  counter?: string
  refFor: (el: HTMLElement | null) => void
  children: React.ReactNode
}) {
  return (
    <label className={`ff-field${err ? ' bad' : ''}`} ref={refFor}>
      <span className="ff-label">
        <span>{label}</span>
        {counter && <span className="ff-counter ff-ltr">{counter}</span>}
      </span>
      {children}
      {err ? <span className="ff-err">{problemText(err, lim)}</span> : hint ? <span className="ff-hint">{hint}</span> : null}
    </label>
  )
}

// exported for the mock and tests
export { useMemo }
