// The desktop docked panel, offered to a world screen (the village) so that ONE object's panel (a building's) docks
// beside the world instead of floating over it (web map 6.4). The screen mounts its own panel content where its state
// lives and portals it into `el`; `claim` tells the shell to open the dock with a crumb title and what closing does.

import { createContext, useContext } from 'react'

export interface Side {
  /** where to portal the panel's content: null on a phone or while no dock is open */
  el: HTMLElement | null
  /** is the desktop dock available at all */
  desktop: boolean
  /** open the dock for this panel; returns the release */
  claim: (title: string, onClose: () => void) => () => void
}

export const SideCtx = createContext<Side | null>(null)
export const useSide = (): Side | null => useContext(SideCtx)
