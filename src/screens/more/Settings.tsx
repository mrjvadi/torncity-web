// The settings screen (internal/telegram/screens/settings.go, SettingsView).
// The language is the one server-side setting: the switch here changes the
// web at once and sends `player.language.set`, so the bot follows. The rest
// is the client's own: linked devices, sign out, the build.

import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Segmented } from '../native/kit/Parts'
import { CardGrid } from '../../ui/v6/panel'
import LangSwitch from '../native/kit/LangSwitch'
import { useSession } from '../../state/SessionContext'
import { APP_VERSION, BUILD_ID } from '../../lib/freshness'
import { t, type Key } from '../../i18n'

interface SettingsView {
  language?: string
  languages?: string[] | null
  language_changed?: boolean
  presence_visibility?: string
  presence_changed?: boolean
}

const VISIBILITY = ['everyone', 'contacts', 'nobody'] as const

export default function Settings({ response, loading, run }: ScreenProps) {
  const { signOut } = useSession()
  const v = (response?.view ?? {}) as SettingsView
  if (loading && !response) return <ScreenScroll><Header title={t('settings.title')} tone="teal" /></ScreenScroll>

  return (
    <ScreenScroll>
      <Header title={t('settings.title')} tone="teal" onBack={() => run('player.profile.get')} onRefresh={() => run('player.settings')} />

      {v.language_changed && <Notice>{t('settings.saved')}</Notice>}

      <Card>
        <div className="nx-sec" style={{ marginBottom: 10 }}>{t('settings.language')}</div>
        <LangSwitch />
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{t('settings.language_hint')}</div>
      </Card>

      {v.presence_changed && <Notice>{t('lf.presence.saved')}</Notice>}
      {v.presence_visibility && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 10 }}>{t('lf.presence.title')}</div>
          <Segmented
            value={v.presence_visibility}
            options={VISIBILITY.map((k) => ({ key: k, label: t(`lf.presence.${k}` as Key) }))}
            onChange={(k) => k !== v.presence_visibility && run('player.presence.set', { visibility: k })}
          />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{t(v.presence_visibility === 'nobody' ? 'lf.presence.nobody_hint' : 'lf.presence.hint')}</div>
        </Card>
      )}

      <div className="nx-sec">{t('settings.account')}</div>
      <CardGrid>
      <ListRow icon="phone" palette="sapphire" title={t('settings.devices')} onClick={() => run('device.list')} />
      <ListRow icon="close" palette="ruby" tone="ruby" title={t('settings.sign_out')} onClick={signOut} />
      </CardGrid>

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', opacity: 0.75, marginTop: 6 }}>
        <div title={`#${BUILD_ID}`}>{t('settings.version', { v: APP_VERSION })}</div>
        <div>{t('settings.credits')}</div>
      </div>

    </ScreenScroll>
  )
}
