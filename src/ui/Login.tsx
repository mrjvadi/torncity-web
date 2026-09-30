import { useState, type ClipboardEvent, type FormEvent } from 'react'
import { useSession } from '../state/SessionContext'
import { extractLinkCode, typedLinkCode } from '../lib/persian'
import Icon from './Icon'
import LangSwitch from '../screens/native/kit/LangSwitch'
import { t } from '../i18n'

export default function Login() {
  const { loginWithCode, status, error, inTelegram } = useSession()
  const [code, setCode] = useState('')
  const busy = status === 'signing_in'

  if (inTelegram) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-badge"><Icon name="city" palette="gold" size={44} /></div>
          <h1 className="display">{t('login.signing_in')}</h1>
          <p className="login-hint">{t('login.via_telegram')}</p>
        </div>
        <LoginStyles />
      </div>
    )
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (!text) return
    e.preventDefault()
    setCode(extractLinkCode(text))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.length !== 8 || busy) return
    try {
      await loginWithCode(code)
    } catch {
      // error already surfaced via session state
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge"><Icon name="city" palette="gold" size={44} /></div>
        <h1 className="display">{t('login.title')}</h1>
        <p className="login-hint">
          {t('login.hint')}
        </p>
        <form onSubmit={onSubmit} className="login-form">
          <input
            className="login-input display"
            value={code}
            onChange={(e) => {
              // a long value is a paste the browser did not report as one
              const v = e.target.value
              setCode(v.length > 12 ? extractLinkCode(v) || typedLinkCode(v) : typedLinkCode(v))
            }}
            onPaste={onPaste}
            placeholder="XXXXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            dir="ltr"
          />
          <button className="login-submit display" type="submit" disabled={code.length !== 8 || busy}>
            {busy ? t('login.signing_in') : t('login.submit')}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
        <div style={{ marginTop: 14 }}><LangSwitch compact /></div>
      </div>
      <LoginStyles />
    </div>
  )
}

function LoginStyles() {
  return (
    <style>{`
      .login-screen {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        padding-top: calc(24px + var(--safe-t));
        padding-bottom: calc(24px + var(--safe-b));
      }
      .login-card {
        width: 100%;
        max-width: 380px;
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid var(--gold-soft);
        border-radius: 28px;
        padding: 32px 24px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .login-badge {
        width: 84px; height: 84px; margin: 0 auto 16px;
        border-radius: 24px;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 50% 30%, #1c2550, #0a0d1e);
        border: 1px solid var(--gold-soft);
      }
      .login-card h1 { font-size: 30px; margin: 0 0 8px; color: var(--text); }
      .login-hint { color: var(--text-dim); font-size: 14px; line-height: 1.9; margin: 0 0 24px; }
      .login-form { display: flex; flex-direction: column; gap: 12px; }
      .login-input {
        background: var(--panel-deep);
        border: 1px solid rgba(242,194,85,0.3);
        border-radius: 16px;
        padding: 16px;
        font-size: 26px;
        letter-spacing: 6px;
        text-align: center;
        color: var(--gold);
        text-transform: uppercase;
      }
      .login-input:focus { outline: none; border-color: var(--gold); }
      .login-submit {
        background: linear-gradient(180deg, #ffe680, #f5a11f);
        color: #4a2600;
        font-size: 20px;
        padding: 14px;
        border-radius: 16px;
        box-shadow: 0 6px 0 #9a4e06, 0 10px 20px rgba(0,0,0,0.35);
      }
      .login-submit:active { transform: translateY(3px); box-shadow: 0 3px 0 #9a4e06; }
      .login-submit:disabled { opacity: 0.5; box-shadow: none; }
      .login-error { color: #ff9aa0; font-size: 13px; margin-top: 14px; }
    `}</style>
  )
}
