import { useEffect, useRef, useState } from 'react'
import * as api from '../api/client'
import type { CommandResponse } from '../api/types'

/** Answers already in hand (the answer of an action the player just ran): the screen it opens shows them
 * instead of running the command a second time. Each is used once. */
const seeds = new Map<string, CommandResponse>()
const seedKey = (command: string, args?: Record<string, string>) => `${command}:${args ? JSON.stringify(args) : ''}`

export function seedScreen(command: string, args: Record<string, string> | undefined, res: CommandResponse): void {
  seeds.set(seedKey(command, args), res)
}

/** Fetches and caches a command's screen, refetching when the command/args (or `again`) change. */
export function useScreen(command: string | null, args?: Record<string, string>, again = 0) {
  const [response, setResponse] = useState<CommandResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const argsKey = args ? JSON.stringify(args) : ''
  const cache = useRef(new Map<string, CommandResponse>())

  useEffect(() => {
    if (!command) return
    const key = `${command}:${argsKey}`
    const seeded = seeds.get(seedKey(command, args))
    if (seeded) {
      seeds.delete(seedKey(command, args))
      cache.current.set(key, seeded)
      setResponse(seeded)
      setLoading(false)
      return
    }
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
  }, [command, argsKey, again])

  return { response, loading }
}
