// What the compact screen header needs from the shell: a way back. `back` is
// null on a tab's root screen (nothing to go back to); anywhere else it
// returns to the previous screen, or to the tab's root when the screen was
// opened straight from a menu or link with no history.

import { createContext, useContext } from 'react'

export interface Nav { back: (() => void) | null }

export const NavCtx = createContext<Nav | null>(null)
export const useNav = (): Nav | null => useContext(NavCtx)
