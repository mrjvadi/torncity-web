import type { Action, CommandResponse } from '../../../api/types'
import Actions from '../../native/kit/Actions'

/** The feature screens' actions: the same native controls as everywhere
 * (native/kit/Actions.tsx): lead slab, chips, list rows, a pager; back and
 * refresh come from the header and the app's navigation. */
export default function ActionButtons({ actions, onAction }: { actions: Action[] | undefined; onAction: (a: Action) => void }) {
  const response = { ok: true, screen: '', text: '', actions: actions ?? [] } as unknown as CommandResponse
  return <Actions response={response} onAction={onAction} />
}
