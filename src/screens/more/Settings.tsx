// The settings screen (internal/telegram/screens/settings.go, SettingsView):
// every setting that exists — today, only the language — each a field here
// and a row of buttons the server already sends as actions.

import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'

const LANGUAGE_LABEL: Record<string, string> = { fa: 'فارسی', en: 'English' }

interface SettingsView {
  language?: string
  languages?: string[] | null
  language_changed?: boolean
}

export default function Settings({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as SettingsView
  if (loading && !response) return <ScreenScroll><Header title="تنظیمات" tone="teal" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title="تنظیمات" tone="teal" onBack={() => run('player.profile.get')} onRefresh={() => run('player.settings')} />

      {v.language_changed && <Notice>زبان با موفقیت تغییر کرد.</Notice>}

      <Card>
        <ListRow icon="world" palette="steel" title="زبان بازی" sub={LANGUAGE_LABEL[v.language ?? ''] ?? v.language} />
      </Card>

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}
