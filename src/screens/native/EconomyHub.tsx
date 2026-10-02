import type { ScreenProps } from '../types'
import ServerHub from './ServerHub'
import { ECONOMY_ENTRIES } from './kit/hubs'

/** The Economy hub: the entries the server lists for where the player stands (`economy.hub`). */
export default function EconomyHub({ run }: ScreenProps) {
  return <ServerHub command="economy.hub" title="hub.economy" tone="emerald" look={ECONOMY_ENTRIES} run={run} />
}
