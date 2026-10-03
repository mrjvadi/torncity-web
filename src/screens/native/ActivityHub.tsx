import { useCallback, useEffect, useState } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, PrimaryButton, ScreenScroll } from './kit/Parts'
import { PTile } from '../../ui/v6/panel'
import { useWip } from '../../ui/v6/hooks'
import { ACTIVITY_ENTRIES, HUB_ICON } from './kit/hubs'
import * as api from '../../api/client'
import type { ActivitiesHubView } from '../../api/views.gen'
import { t } from '../../i18n'
import { careWord, useCare } from '../../support/care'

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; view: ActivitiesHubView }

/** The Activities hub: the entries the server lists for where the player stands (`activities.hub`, ADR 0038 3.3).
 * An activity that is not listed is not mentioned; the client holds no rule about which are. */
export default function ActivityHub({ run }: ScreenProps) {
  const care = useCare()
  // what I am busy with right now (a running shift, a running study): from the state-sync timers, not from this view
  const busy = useWip(null, false).filter((s) => !s.idle && s.key !== 'build')
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
          <>
            {/* health, energy and nerve are on the HUD already: no second copy here (owner 2026-10-03) */}
            <div className="hub-grid">
              {busy.map((b) => <PTile key={b.key} icon={b.icon} title={b.label} badge={b.time} tone="busy" onClick={() => run(b.key === 'shift' ? 'job.status' : 'education.list')} />)}
              {(load.view.entries ?? []).map((e) => {
                const look = ACTIVITY_ENTRIES[e.code]
                if (!look) return null
                // «بیمارستان» is the name only where the place has a hospital; otherwise it is «سلامت»
                const title = e.code === 'health' && careWord(care) === 'hospital' ? t('hub.hospital') : t(look.title)
                return <PTile key={e.code} icon={HUB_ICON[e.code] ?? 'info'} title={title} onClick={() => run(e.command)} />
              })}
            </div>
          </>
        )}
      </div>
    </ScreenScroll>
  )
}
