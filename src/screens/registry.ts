import type { ScreenComponent } from './types'

/** Native layouts for server screens, by the server's `screen` name; any
 * screen not here falls back to GenericScreen. Native and feature screens
 * are the bulk of the app's code, so they load as their own chunks instead
 * of the login/shell bundle — both start fetching immediately (in parallel
 * with the login screen), so they are normally ready well before a real
 * screen is requested. Shell reads these two objects fresh on every
 * render, so filling them in once the chunks land is enough; nothing needs
 * to await this module. */
export const SERVER_SCREENS: Record<string, ScreenComponent> = {}

/** Client-only screens: hubs, previews of features the server has not
 * built yet. */
export const LOCAL_SCREENS: Record<string, ScreenComponent> = {}

/** A chunk that fails on a flaky link is fetched again a few times; if it
 * still fails the shell opens anyway, with GenericScreen for every screen,
 * rather than leaving the player on a blank page. */
async function retry<T>(load: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await load()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 800 * i))
    }
  }
}

export const screensReady: Promise<void> = Promise.all([
  retry(() => import('./native')), retry(() => import('./features')), retry(() => import('./more')), retry(() => import('./village')), retry(() => import('./founding')), retry(() => import('./basic')), retry(() => import('./support')), retry(() => import('./life')),
]).then(
  ([native, features, more, village, founding, basic, support, life]) => {
    // basic goes first: the bespoke screens of every other area override it
    Object.assign(SERVER_SCREENS, basic.default.SERVER, features.default.SERVER, native.default.SERVER, more.default.SERVER, village.default.SERVER, founding.default.SERVER, support.default.SERVER, life.default.SERVER)
    Object.assign(LOCAL_SCREENS, basic.default.LOCAL, features.default.LOCAL, native.default.LOCAL, more.default.LOCAL, village.default.LOCAL, founding.default.LOCAL, support.default.LOCAL, life.default.LOCAL)
  },
  () => undefined,
)
