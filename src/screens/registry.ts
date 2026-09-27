import native from './native'
import features from './features'
import type { ScreenComponent } from './types'

/** Native layouts for server screens, by the server's `screen` name; any
 * screen not here falls back to GenericScreen. */
export const SERVER_SCREENS: Record<string, ScreenComponent> = { ...features.SERVER, ...native.SERVER }

/** Client-only screens: hubs, previews of features the server has not
 * built yet. */
export const LOCAL_SCREENS: Record<string, ScreenComponent> = { ...features.LOCAL, ...native.LOCAL }
