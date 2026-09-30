// The language switch: Persian / English. A tap switches the web at once
// and tells the server (i18n/sync.ts), so the bot follows.

import { LANGS, LANG_NAME, useLang, type Lang } from '../../../i18n'
import { changeLanguage } from '../../../i18n/sync'
import Icon from '../../../ui/Icon'

export default function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang()
  return (
    <div className="lang-switch" role="group">
      {LANGS.map((l: Lang) => (
        <button key={l} className={`lang-opt${l === lang ? ' active' : ''}`} aria-pressed={l === lang} lang={l}
          onClick={() => { if (l !== lang) void changeLanguage(l) }}>
          {!compact && <Icon name="world" palette={l === lang ? 'gold' : 'steel'} size={20} />}
          <span className="lang-name">{LANG_NAME[l]}</span>
        </button>
      ))}
    </div>
  )
}
