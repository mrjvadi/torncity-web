import { useCallback, useEffect, useState } from 'react'
import type { ScreenProps } from '../types'
import { Empty, Header, PrimaryButton, ScreenScroll } from './kit/Parts'
import { PNow, PSec, PTile } from '../../ui/v6/panel'
import { useWip } from '../../ui/v6/hooks'
import { ACTIVITY_ENTRIES, HUB_ICON } from './kit/hubs'
import * as api from '../../api/client'
import type { ActivitiesHubView } from '../../api/views.gen'
import { t } from '../../i18n'
import { careWord, useCare } from '../../support/care'

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; view: ActivitiesHubView }

/** The Activities hub: first what the player is busy with right now (a running shift, a running course, from the
 * state-sync timers), as wide cards with the time left; then the activities the server lists for where the player
 * stands (`activities.hub`, ADR 0038 3.3) as big tiles. An activity that is not listed is not mentioned; the client
 * holds no rule about which are. Health, energy and nerve are on the HUD already: no second copy here. */
export default function ActivityHub({ run }: ScreenProps) {
  const care = useCare()
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
      <Header title={t('hub.activity')} />
      <div className="nx-hub-body">
        {busy.length > 0 && (
          <>
            <PSec>{t('hub.now')}</PSec>
            {busy.map((b, i) => (
              <PNow key={b.key} icon={b.icon} title={b.label} time={b.time} tone={i === 0 ? 'accent' : 'cyan'}
                onClick={() => run(b.key === 'shift' ? 'job.status' : 'education.list')} />
            ))}
          </>
        )}
        {load.state === 'loading' && <Empty>{t('common.loading')}</Empty>}
        {load.state === 'failed' && (
          <>
            <Empty>{t('common.load_failed')}</Empty>
            <PrimaryButton onClick={fetchHub}>{t('common.refresh')}</PrimaryButton>
          </>
        )}
        {load.state === 'ready' && (
          <>
            <PSec>{t('hub.choose')}</PSec>
            <div className="hub-grid">
              {(load.view.entries ?? []).map((e) => {
                const look = ACTIVITY_ENTRIES[e.code]
                if (!look) return null
                // «بیمارستان» is the name only where the place has a hospital; otherwise it is «سلامت»
                const title = e.code === 'health' && careWord(care) === 'hospital' ? t('hub.hospital') : t(look.title)
                return <PTile key={e.code} icon={HUB_ICON[e.code] ?? 'info'} title={title} tone={e.code === 'crime' ? 'danger' : undefined} onClick={() => run(e.command)} />
              })}
            </div>
          </>
        )}
      </div>
    </ScreenScroll>
  )
}
