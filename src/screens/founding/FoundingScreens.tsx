// The server's other founding screens, drawn from their views alone (docs/adr/0039-presentation-split.md):
// the draft a group's founding request opened, a checked form, the refusals, and the village just founded.
// The form itself is FoundingForm.tsx.

import type { ReactNode } from 'react'
import type { ScreenProps } from '../types'
import type { FoundDraftView, FoundingCheckedView, SettlementFoundedView } from '../../api/views.gen'
import { Card, Header, PrimaryButton, ScreenScroll } from '../native/kit/Parts'
import { refusalText, t } from '../../i18n'
import { useSession } from '../../state/SessionContext'
import './founding.css'

function Message({ icon, title, body, children }: { icon: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <ScreenScroll>
      <Header title={t('founding.title')} tone="emerald" />
      <Card>
        <div className="ff-msg">
          <div className="ff-msg-icon">{icon}</div>
          <div className="ff-msg-title">{title}</div>
          {body && <div className="ff-msg-body">{body}</div>}
          {children}
        </div>
      </Card>
    </ScreenScroll>
  )
}

/** The founding request a group made: where the form is, and who is filling it in. */
export function FoundDraft({ response, openLocal }: ScreenProps) {
  const v = (response?.view ?? {}) as Partial<FoundDraftView>
  return (
    <Message icon="📝" title={t('founding.draft.title')}
      body={v.pending ? t('founding.draft.pending', { founder: v.founder || t('pn.someone') }) : t('founding.draft.body')}>
      <PrimaryButton onClick={() => openLocal('founding_form', v.draft_id ? { draft: v.draft_id } : undefined)}>{t('founding.draft.open')}</PrimaryButton>
    </Message>
  )
}

/** A form the server would accept. */
export function FoundingChecked({ response }: ScreenProps) {
  const v = (response?.view ?? {}) as Partial<FoundingCheckedView>
  return <Message icon="✅" title={t('founding.title')} body={t('founding.checked.body', { name: v.name ?? '' })} />
}

/** A refused founding command or form: the code is worded here. */
export function FoundingRefusal({ response, openLocal }: ScreenProps) {
  const e = response?.error
  return (
    <Message icon="📝" title={t('founding.refusal.title')} body={refusalText(e?.code, e?.message, e?.args)}>
      <PrimaryButton onClick={() => openLocal('village_home')}>{t('common.back')}</PrimaryButton>
    </Message>
  )
}

/** The village just founded. */
export function Founded({ response, openLocal }: ScreenProps) {
  const { refreshBootstrap } = useSession()
  const v = (response?.view ?? {}) as Partial<SettlementFoundedView>
  return (
    <Message icon="🏡" title={t('founded.title', { name: v.name ?? '' })} body={t('founded.body')}>
      <PrimaryButton onClick={() => { void refreshBootstrap().then(() => openLocal('village_home')) }}>{t('founding.founded.go')}</PrimaryButton>
    </Message>
  )
}
