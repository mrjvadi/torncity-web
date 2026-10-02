import { useCallback, useEffect, useState } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, PrimaryButton, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { ACTIVITY_ENTRIES } from './kit/hubs'
import * as api from '../../api/client'
import type { ActivitiesHubView } from '../../api/views.gen'
import { t } from '../../i18n'
import { careWord, useCare } from '../../support/care'

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; view: ActivitiesHubView }

/** The Activities hub: the entries the server lists for where the player stands (`activities.hub`, ADR 0038 3.3).
 * An activity that is not listed is not mentioned; the client holds no rule about which are. */
export default function ActivityHub({ run }: ScreenProps) {
  const care = useCare()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const fetchHub = useCallback(() => {
    setLoad({ state: 'loading' })
    api.runCommand('activities.hub', {})
      .then((r) => setLoad(r.ok !== false && r.view ? { state: 'ready', view: r.view as unknown as ActivitiesHubView } : { state: 'failed' }))
      .catch(() => setLoad({ state: 'failed' }))
  }, [])
  useEffect(fetchHub, [fetchHub])

  return (
    <ScreenScroll>
      <Header title={t('hub.activity')} tone="violet" />
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
              const look = ACTIVITY_ENTRIES[e.code]
              if (!look) return null
              // «بیمارستان» is the name only where the place has a hospital; otherwise it is «سلامت»
              const title = e.code === 'health' && careWord(care) === 'hospital' ? t('hub.hospital') : t(look.title)
              return <Tile key={e.code} icon={look.icon} palette={look.palette} title={title} onClick={() => run(e.command)} />
            })}
          </TileGrid>
        )}
      </div>
    </ScreenScroll>
  )
}
