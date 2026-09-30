// Reads another command's view once, for a screen that shows more than the
// view it was opened with (the profile also wants the net worth and the
// achievements). A failure just leaves the extra part out.

import { useEffect, useState } from 'react'
import * as api from '../../../api/client'

export function useView<T>(command: string, args?: Record<string, string>): T | null {
  const [view, setView] = useState<T | null>(null)
  const key = command + JSON.stringify(args ?? {})
  useEffect(() => {
    let live = true
    api.runCommand(command, args ?? {})
      .then((r) => { if (live && r.ok && r.view) setView(r.view as unknown as T) })
      .catch(() => undefined)
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return view
}
