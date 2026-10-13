import type { ScreenProps } from '../types'
import ServerHub from './ServerHub'
import { SOCIETY_ENTRIES } from './kit/hubs'
import { useSession } from '../../state/SessionContext'
import { faNum } from '../../ui/v6/format'

/** The Society hub: the entries the server lists for where the player stands (`society.hub`); the messages tile carries
 * the unread count the dock's dot already shows, so the player sees where it leads. */
export default function SocietyHub({ run }: ScreenProps) {
  const { unread } = useSession()
  return (
    <ServerHub
      command="society.hub" title="hub.society" look={SOCIETY_ENTRIES} run={run}
      badge={(code) => (code === 'inbox' && unread > 0 ? faNum(unread) : undefined)}
    />
  )
}
