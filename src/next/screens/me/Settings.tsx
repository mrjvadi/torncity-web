// تنظیمات (screen `settings`, command player.settings): the game's language (a tap switches the web at once and tells
// the server, so the bot follows), who sees that I am online, then my account: the linked devices and signing out
// (asked first), and the build at the foot.

import { useState } from 'react'
import type { NScreenProps } from '../../registry'
import type { SettingsView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Confirm, Empty, Icon, List, Loading, Note, Page, Row, Section, Segmented } from '../../ui'
import { useSession } from '../../../state/SessionContext'
import { APP_VERSION, BUILD_ID } from '../../../lib/freshness'
import { changeLanguage } from '../../../i18n/sync'
import { LANGS, LANG_NAME, t, useLang, type Key, type Lang } from '../../../i18n'
import { MoreActions, useBack } from './parts'
import './me.css'

const VISIBILITY = ['everyone', 'contacts', 'nobody'] as const

export default function Settings({ response, loading }: NScreenProps) {
  const nav = useNav()
  const back = useBack()
  const lang = useLang()
  const { signOut } = useSession()
  const [leaving, setLeaving] = useState(false)
  if (!response) return <Page title={t('settings.title')} onBack={back}>{loading ? <Loading blocks={[150, 120, 130]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const v = (response.view ?? {}) as Partial<SettingsView>
  const langs = LANGS.filter((l) => !v.languages?.length || v.languages.includes(l))

  return (
    <Page title={t('settings.title')} onBack={back}>
      {v.language_changed && <Note tone="ok" icon="m_check">{t('settings.saved')}</Note>}
      {v.presence_changed && <Note tone="ok" icon="m_check">{t('lf.presence.saved')}</Note>}

      <Section title={t('settings.language')} />
      <div className="n-card n-me-set">
        <div className="n-me-langs" role="group" aria-label={t('settings.language')}>
          {langs.map((l: Lang) => (
            <button key={l} lang={l} aria-pressed={l === lang} onClick={() => { if (l !== lang) void changeLanguage(l) }}>
              <Icon name="world" size={30} />
              <span>{LANG_NAME[l]}</span>
            </button>
          ))}
        </div>
        <p className="n-me-hint">{t('settings.language_hint')}</p>
      </div>

      {v.presence_visibility && (
        <>
          <Section title={t('lf.presence.title')} />
          <div className="n-card n-me-set">
            <Segmented items={VISIBILITY.map((k) => ({ key: k, label: t(`lf.presence.${k}` as Key) }))} value={v.presence_visibility as (typeof VISIBILITY)[number]}
              onChange={(k) => nav.run('player.presence.set', { visibility: k })} />
            <p className="n-me-hint">{t(v.presence_visibility === 'nobody' ? 'lf.presence.nobody_hint' : 'lf.presence.hint')}</p>
          </div>
        </>
      )}

      <Section title={t('settings.account')} />
      <List>
        <Row icon="phone" title={t('settings.devices')} onClick={() => nav.run('device.list')} />
        <Row icon="close" title={<span className="n-me-bad">{t('settings.sign_out')}</span>} onClick={() => setLeaving(true)} />
      </List>

      <MoreActions response={response} title={t('next.actions')} skip={(a) => a.id === 'settings.language' || a.id === 'settings.presence' || a.command === 'player.language.set' || a.command === 'player.presence.set'} />

      <div className="n-me-foot">
        <span title={`#${BUILD_ID}`}>{t('settings.version', { v: APP_VERSION })}</span>
        <span>{t('settings.credits')}</span>
      </div>

      {leaving && (
        <Confirm title={t('n.me.settings.sign_out_q')} icon="close" danger confirm={t('settings.sign_out')} onConfirm={() => { setLeaving(false); signOut() }} onClose={() => setLeaving(false)}>
          <p className="n-text">{t('n.me.settings.sign_out_hint')}</p>
        </Confirm>
      )}
    </Page>
  )
}
