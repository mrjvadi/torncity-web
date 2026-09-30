// Keeps the player's language the same in the web and the bot.
//
// * A change made here goes to the server (`player.language.set`).
// * A change made where the server cannot be told (the login screen, an
//   offline moment) is remembered as pending and sent right after the next
//   sign-in, so the choice is not lost.
// * Otherwise the server wins at sign-in: the player may have switched in
//   the bot meanwhile.

import * as api from '../api/client'
import { setLang, getLang, type Lang } from './index'

const LS_PENDING = 'tc.lang.pending'

function asLang(v: unknown): Lang | null {
  return v === 'fa' || v === 'en' ? v : null
}

function pending(set?: boolean): boolean {
  try {
    if (set === true) localStorage.setItem(LS_PENDING, '1')
    else if (set === false) localStorage.removeItem(LS_PENDING)
    return localStorage.getItem(LS_PENDING) === '1'
  } catch {
    return false
  }
}

async function send(lang: Lang): Promise<boolean> {
  try {
    const r = await api.runCommand('player.language.set', { lang })
    return r.ok !== false
  } catch {
    return false
  }
}

/** Switches the web to `lang` at once, then tells the server. */
export async function changeLanguage(lang: Lang): Promise<void> {
  if (getLang() === lang) return
  setLang(lang)
  pending(!(api.isLoggedIn() && (await send(lang))))
}

/** Called with the bootstrap's player language after a sign-in. */
export async function adoptServerLanguage(serverLang: unknown): Promise<void> {
  const l = asLang(serverLang)
  if (!l || l === getLang()) { pending(false); return }
  if (pending()) {
    if (await send(getLang())) pending(false)
    return
  }
  setLang(l)
}
