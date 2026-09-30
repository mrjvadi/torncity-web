// Keeps the player's language the same in the web and the bot: a change here
// goes to the server (`player.language.set`), and a sign-in adopts whatever
// the server has (the player may have switched in the bot meanwhile).

import * as api from '../api/client'
import { setLang, getLang, type Lang } from './index'

function asLang(v: unknown): Lang | null {
  return v === 'fa' || v === 'en' ? v : null
}

/** Switches the web to `lang` at once, then tells the server. A failed call
 * is not an error for the player: the local choice stands and is sent again
 * on the next change. */
export async function changeLanguage(lang: Lang): Promise<void> {
  const before = getLang()
  setLang(lang)
  if (before === lang) return
  try {
    await api.runCommand('player.language.set', { lang })
  } catch { /* offline: the local choice stays */ }
}

/** Called with the bootstrap's player language: the server wins, so the bot
 * and the web agree after a sign-in. */
export function adoptServerLanguage(serverLang: unknown): void {
  const l = asLang(serverLang)
  if (l && l !== getLang()) setLang(l)
}
