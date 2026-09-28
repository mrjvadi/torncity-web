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

export const screensReady: Promise<void> = Promise.all([import('./native'), import('./features')]).then(
  ([native, features]) => {
    Object.assign(SERVER_SCREENS, features.default.SERVER, native.default.SERVER)
    Object.assign(LOCAL_SCREENS, features.default.LOCAL, native.default.LOCAL)
  },
)
