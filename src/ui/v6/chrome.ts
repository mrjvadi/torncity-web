// What the shell tells the village view about the chrome that floats over (or beside) the world, so the 3D scene
// frames the village in the free part and the ring stays inside the safe rectangle (P12). Rects are read when
// asked (never cached): the chrome moves with the window.
import { createContext, useContext } from 'react'

export interface Chrome {
  /** the HUD, when it floats over the world (a phone) */
  hud(): DOMRect | null
  /** whatever covers the bottom of the world: the quest strip and the dock (a phone) */
  bottom(): DOMRect | null
  /** the side columns the ring's name plate steps around */
  sides(): DOMRect[]
  desktop: boolean
  /** called when the chrome's size changes (the quest strip appears, the window resizes) */
  subscribe(cb: () => void): () => void
}

export const ChromeCtx = createContext<Chrome | null>(null)
export const useChrome = (): Chrome | null => useContext(ChromeCtx)
