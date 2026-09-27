import { useEffect, useRef, useState } from 'react'
import * as api from '../api/client'
import type { CommandResponse } from '../api/types'

/** Fetches and caches a command's screen, refetching when the command/args change. */
export function useScreen(command: string | null, args?: Record<string, string>) {
  const [response, setResponse] = useState<CommandResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const argsKey = args ? JSON.stringify(args) : ''
  const cache = useRef(new Map<string, CommandResponse>())

  useEffect(() => {
    if (!command) return
    const key = `${command}:${argsKey}`
    const cached = cache.current.get(key)
    if (cached) {
      setResponse(cached)
      setLoading(false)
    } else {
      setResponse(null)
      setLoading(true)
    }
    let cancelled = false
    api.runCommand(command, args ?? {}).then((res) => {
      if (cancelled) return
      cache.current.set(key, res)
      setResponse(res)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, argsKey])

  return { response, loading }
}
