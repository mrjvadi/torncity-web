// The three hubs of the dock (activity, economy, society), in the new UI. Each starts with what matters now (what is
// running, the wallet), then the entries the server lists as big 3D tiles.

import type { ReactNode } from 'react'
import type { NScreenProps } from '../../registry'
import { useNav } from '../../nav'
import { Button, Buttons, Chip, Empty, Hero, Icon, Loading, Now, Page, Section, Tile, Tiles } from '../../ui'
import { icon3d } from '../../icons'
import { useSession } from '../../../state/SessionContext'
import { useWip } from '../../../ui/v6/hooks'
import { careWord, useCare } from '../../../support/care'
import { money, splitMoney } from '../../../screens/native/kit/format'
import { faNum } from '../../../ui/v6/format'
import { t } from '../../../i18n'
import { ENTRY, useHub } from './useHub'

function Entries({ command, badge, title, rename }: { command: string; badge?: (code: string) => ReactNode; title: string; rename?: (code: string) => string | undefined }) {
  const nav = useNav()
  const { load, retry } = useHub(command)
  if (load.state === 'loading') return <Loading blocks={[128, 128]} />
  if (load.state === 'failed') return <><Empty icon="x_wanted">{t('common.load_failed')}</Empty><Button kind="ghost" block onClick={retry}>{t('common.refresh')}</Button></>
  return (
    <>
      <Section title={title} />
      <Tiles>
        {load.entries.map((e) => {
          const look = ENTRY[e.code]
          if (!look) return null
          return <Tile key={e.code} icon={look.icon} title={rename?.(e.code) ?? t(look.title)} badge={badge?.(e.code)} tone={e.code === 'crime' ? 'bad' : undefined} onClick={() => nav.run(e.command)} />
        })}
      </Tiles>
    </>
  )
}

/** فعالیت: what runs for me now (a shift, a course) with the time left, then what I can do. Health, energy and nerve
 * are on the HUD: no second copy here. */
export function ActivityHub(_: NScreenProps) {
  const nav = useNav()
  const care = useCare()
  const busy = useWip(null, false).filter((s) => !s.idle && s.key !== 'build')
  return (
    <Page title={t('hub.activity')}>
      {busy.length > 0 && (
        <>
          <Section title={t('next.now')} />
          {busy.map((b, i) => <Now key={b.key} icon={icon3d(b.icon)} title={b.label} time={b.time} lit={i === 0} onClick={() => nav.run(b.key === 'shift' ? 'job.status' : 'education.list')} />)}
        </>
      )}
      <Entries command="activities.hub" title={t('next.choose')} rename={(c) => (c === 'health' && careWord(care) === 'hospital' ? t('hub.hospital') : undefined)} />
    </Page>
  )
}

/** اقتصاد: the wallet on top (bank balance large, cash on hand, the bank and a payment one tap away), then the rest. */
export function EconomyHub(_: NScreenProps) {
  const nav = useNav()
  const { profile } = useSession()
  const bank = money(profile?.bank)
  const [main, sup] = splitMoney(bank) ?? [bank, '']
  return (
    <Page title={t('hub.economy')}>
      {profile && (
        <Hero art="bank">
          <p className="n-label">{t('bank.balance')}</p>
          <p className="n-big">{main}</p>
          {sup && <p className="n-label">{sup}</p>}
          <p className="n-hero-line"><Chip><Icon name="coins" size={18} />{t('next.wallet.cash')}: {money(profile.cash)}</Chip></p>
          <div className="n-hero-foot">
            <Buttons>
              <Button onClick={() => nav.run('bank.show')}>{t('next.wallet.bank')}</Button>
              <Button kind="cyan" onClick={() => nav.run('bank.pay')}>{t('next.wallet.pay')}</Button>
            </Buttons>
          </div>
        </Hero>
      )}
      <Entries command="economy.hub" title={t('next.sections')} />
    </Page>
  )
}

/** جامعه: the entries, the messages tile carrying the unread count the dock's dot shows. */
export function SocietyHub(_: NScreenProps) {
  const { unread } = useSession()
  return (
    <Page title={t('hub.society')}>
      <Entries command="society.hub" title={t('next.sections')} badge={(c) => (c === 'inbox' && unread > 0 ? faNum(unread) : undefined)} />
    </Page>
  )
}
