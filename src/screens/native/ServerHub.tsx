import { useCallback, useEffect, useState } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, PrimaryButton, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import * as api from '../../api/client'
import type { HubView } from '../../api/views.gen'
import type { IconPalette } from '../../ui/Icon'
import { t, type Key } from '../../i18n'

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; view: HubView }
type Look = Record<string, { icon: string; palette: IconPalette; title: Key }>

/** A hub whose entries the server lists for where the player stands (`economy.hub`, `society.hub`): an entry the
 * server does not list is not mentioned, and the client holds no rule about which exist. It only dresses them. */
export default function ServerHub({ command, title, tone, look, run, rename }: Pick<ScreenProps, 'run'> & {
  command: string
  title: Key
  tone: 'emerald' | 'violet'
  look: Look
  /** the name of an entry where a place needs another word for it (a village's «دهیاری»), else the entry's own */
  rename?: (code: string, place: HubView['place']) => Key | undefined
}) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const fetchHub = useCallback(() => {
    setLoad({ state: 'loading' })
    api.runCommand(command, {})
      .then((r) => setLoad(r.ok !== false && r.view ? { state: 'ready', view: r.view as unknown as HubView } : { state: 'failed' }))
      .catch(() => setLoad({ state: 'failed' }))
  }, [command])
  useEffect(fetchHub, [fetchHub])

  return (
    <ScreenScroll>
      <Header title={t(title)} tone={tone} />
      <div className="nx-hub-body">
        {load.state === 'loading' && <Empty>{t('common.loading')}</Empty>}
        {load.state === 'failed' && (
          <>
            <Empty>{t('common.load_failed')}</Empty>
            <PrimaryButton onClick={fetchHub}>{t('common.refresh')}</PrimaryButton>
          </>
        )}
        {load.state === 'ready' && (
          <TileGrid>
            {(load.view.entries ?? []).map((e) => {
              const entry = look[e.code]
              if (!entry) return null
              return <Tile key={e.code} icon={entry.icon} palette={entry.palette} title={t(rename?.(e.code, load.view.place) ?? entry.title)} onClick={() => run(e.command)} />
            })}
          </TileGrid>
        )}
      </div>
    </ScreenScroll>
  )
}
