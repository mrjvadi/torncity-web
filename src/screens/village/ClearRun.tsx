// The clearing order of a lot, sent from the lot ring (ADR 0065): the command goes out once with the idempotency key made at the tap (so a
// refresh or a second mount sends the same key and never a second order), then the answer is drawn by the flow host like the one that comes from
// the refusal page, where the cancel is a write in place.

import { useEffect, useState } from 'react'
import * as api from '../../api/client'
import type { CommandResponse } from '../../api/types'
import type { ScreenComponent } from '../types'
import { FlowHost } from './flow'

const ClearRun: ScreenComponent = (props) => {
  const a = props.localArgs ?? {}
  const [res, setRes] = useState<CommandResponse | null>(null)
  const command = a.command === 'settlement.clear.cancel' ? 'settlement.clear.cancel' : 'settlement.clear.order'
  useEffect(() => {
    let on = true
    const args: Record<string, string> = { x: a.x ?? '', y: a.y ?? '' }
    if (command === 'settlement.clear.order') args.what = a.what ?? 'all'
    api.runCommand(command, args, a.key || undefined)
      .then((r) => { if (on) setRes(r) })
      .catch(() => { if (on) setRes({ ok: false, request_id: '', screen: '', error: { code: 'network' } } as CommandResponse) })
    return () => { on = false }
  }, [command, a.x, a.y, a.what, a.key])
  return <FlowHost {...props} response={res} loading={!res} />
}

export default ClearRun
