// The player's own life, drawn from the neutral views (docs/adr/0039-presentation-split.md): the story of a
// life, the choice of an avatar, a night to pay for, a refused request of life, the linked devices and the
// code that links one. Words are the web's own; names of content come from the catalogue.

import type { AvatarsView, DeviceLinkView, DevicesView, HistoryView, LifeRefusalView, SleepPayView } from '../../api/views.gen'
import { Empty, ListRow } from '../native/kit/Parts'
import { hms, money } from '../native/kit/format'
import { formatNumber } from '../../lib/persian'
import Popup, { ActionButton, ActionRow, Note, StatCard, StatGrid } from '../../ui/Popup'
import { hasKey, refusalText, t } from '../../i18n'
import { Btns, Facts, Hint, Lead, Page, Panel, Rest, flow, isBack, isRefresh } from '../village/flow'
import { cityName, clockText, dateText, nameOf, tf, tx } from './common'

// -- the story of a life ------------------------------------------------------------------------------

/** What an entry of the story is about: a content name by the table its kind belongs to. */
const HISTORY_TABLE: Record<string, string | string[]> = {
  course: 'course', certificate: 'course', property_bought: 'property_type', property_sold: 'property_type', achievement: 'achievement',
  rank_up: 'life_rank', rank_down: 'life_rank', big_trade: 'item',
}

export const History = flow<HistoryView>(({ view: v, ctx }) => {
  const lines = v.lines ?? []
  const prev = ctx.by('page.prev')[0]
  const next = ctx.by('page.next')[0]
  return (
    <Page title={v.self ? t('lf.history.mine') : t('lf.history.of', { name: v.name })} tone="violet">
      {lines.length === 0 && <Empty>{t('lf.history.empty')}</Empty>}
      <div className="vf-list">
        {lines.map((l, i) => {
          const table = HISTORY_TABLE[l.kind]
          const what = table ? ctx.names.name(table, l.code, l.name) : l.name
          const where = l.place.code || l.place.name ? (l.place_kind && l.place_kind !== 'city' ? l.place.name : cityName(ctx, l.place.code, l.place.name)) : ''
          const base = `lf.history.${l.kind}`
          const text = tf(!where && hasKey(`${base}_nowhere`) ? `${base}_nowhere` : base, 'lf.history.other', { what, place: where, amount: money(l.amount), number: formatNumber(l.number) })
          const sub = [dateText(l.at), l.backfilled ? t('lf.history.old') : '', l.private ? t('lf.history.private') : ''].filter(Boolean).join(' · ')
          return <ListRow key={i} icon="book" palette="violet" title={text} sub={sub} />
        })}
      </div>
      {(prev || next) && <div className="vf-btns row">{prev && <Btns ctx={ctx} list={[prev]} row />}{next && <Btns ctx={ctx} list={[next]} row />}</div>}
      {v.pages > 1 && <Hint>{t('lf.page', { page: formatNumber(v.page), pages: formatNumber(v.pages) })}</Hint>}
      {v.self && <Hint>{t('lf.history.hint')}</Hint>}
    </Page>
  )
})

// -- the choice of an avatar -----------------------------------------------------------------------------

export const Avatars = flow<AvatarsView>(({ view: v, ctx }) => {
  const current = v.current.photo ? t('lf.avatar.photo') : v.current.emoji || t('lf.avatar.none')
  return (
    <Page title={t('screen.avatars')} tone="violet">
      <Panel tone="violet">
        <Lead>{t('lf.avatar.current', { avatar: current })}</Lead>
        <Hint>{t('lf.avatar.hint')}</Hint>
      </Panel>
      <div className="lf-avatars">
        {(v.avatars ?? []).map((a) => {
          const act = ctx.acts.find((x) => x.id === 'avatar.choice' && x.subject === a.code)
          return (
            <button key={a.code} className={`lf-avatar${v.current.code === a.code ? ' on' : ''}`} disabled={ctx.busy || !act} onClick={() => act && ctx.go(act)}>
              <span className="lf-avatar-emoji">{a.emoji}</span>
              <span className="lf-avatar-name">{ctx.names.name('avatar', a.code, a.name)}</span>
            </button>
          )
        })}
      </div>
      <Btns ctx={ctx} list={[...ctx.by('avatar.photo'), ...ctx.by('avatar.none')]} row />
    </Page>
  )
})

// -- a night to pay for (a popup with the price and the ways to pay) ------------------------------------------

export const SleepPay = flow<SleepPayView>(({ view: v, ctx }) => {
  const pays = ctx.acts.filter((a) => a.id?.startsWith('pay.'))
  const back = ctx.acts.find(isBack)
  const afford = (v.payment.usable ?? []).length > 0
  return (
    <Page title={t('screen.sleep_pay')} tone="violet">
      <Popup
        open onClose={() => back && ctx.go(back)} tone="violet" dismissible={!ctx.busy}
        title={t('lf.sleep.title', { spot: nameOf(ctx, 'sleep_spot', v.spot) })}
        footer={<ActionRow>{pays.map((a) => <ActionButton key={a.id} tone="gold" cost={money(v.payment.amount)} costIcon="coins" costPalette="gold" busy={ctx.busy} onClick={() => ctx.go(a)}>{tx(`lf.pay.${a.id!.slice(4)}`)}</ActionButton>)}</ActionRow>}
      >
        <StatGrid>
          <StatCard icon="coins" palette="gold" label={t('lf.fare')} value={v.payment.amount > 0 ? money(v.payment.amount) : t('common.free')} />
          <StatCard icon="moon" palette="violet" label={t('lf.sleep.rest')} value={formatNumber(v.rest)} />
          {v.relief > 0 && <StatCard icon="sun" palette="emerald" label={t('lf.sleep.relief')} value={formatNumber(v.relief)} />}
        </StatGrid>
        {afford
          ? <Note>{t('lf.pay.balances', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>
          : <Note tone="bad">{t('lf.pay.cannot', { cash: money(v.payment.cash), bank: money(v.payment.bank) })}</Note>}
      </Popup>
    </Page>
  )
})

// -- a refused request of life -----------------------------------------------------------------------------------

export const LifeRefusal = flow<LifeRefusalView>(({ view: v, ctx }) => (
  <Page title={t('msg.refusal')} tone="ruby">
    <Panel tone="ruby">
      <Lead tone="bad">{refusalText(ctx.res.error?.code ?? `life_${v.kind}`, undefined, { ...(ctx.res.error?.args ?? {}), min: v.min, max: v.max, wait_seconds: v.wait_seconds })}</Lead>
    </Panel>
    <Rest ctx={ctx} />
    <Btns ctx={ctx} list={ctx.acts.filter(isBack)} />
  </Page>
))

// -- the linked devices -------------------------------------------------------------------------------------------

export const Devices = flow<DevicesView>(({ view: v, ctx }) => {
  const list = v.devices ?? []
  return (
    <Page title={t('screen.devices')} tone="teal">
      {v.notice && <Hint tone={v.notice === 'revoked' ? 'good' : undefined}>{tx(`lf.devices.notice.${v.notice}`)}</Hint>}
      {list.length === 0 && <Empty>{t('lf.devices.empty')}</Empty>}
      <div className="vf-list">
        {list.map((d) => {
          const out = ctx.acts.find((a) => a.id === 'device.revoke' && a.args?.device === d.id)
          return (
            <ListRow
              key={d.id} icon="phone" palette="sapphire" title={d.name}
              sub={[tx(`lf.devices.via.${d.via}`), t('lf.devices.since', { date: dateText(d.created_at) }), t('lf.devices.seen', { date: dateText(d.last_seen_at) })].join(' · ')}
              right={out ? <button className="vf-cancel" onClick={() => ctx.go(out)} disabled={ctx.busy}>{t('lf.devices.revoke')}</button> : undefined}
            />
          )
        })}
      </div>
      <Btns ctx={ctx} list={ctx.by('device.link')} />
    </Page>
  )
})

export const DeviceLink = flow<DeviceLinkView>(({ view: v, ctx }) => (
  <Page title={t('screen.device_link')} tone="teal">
    <Panel tone="teal">
      <Lead>{t('lf.link.lead')}</Lead>
      <div className="display" dir="ltr" style={{ fontSize: 30, textAlign: 'center', letterSpacing: 3, userSelect: 'all' }}>{v.code}</div>
      <Facts rows={[
        { label: t('lf.link.valid'), value: hms(v.valid_seconds) },
        { label: t('lf.link.until'), value: clockText(v.expires_at) },
      ]} />
      <Hint>{t('lf.link.help')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={ctx.acts.filter((a) => !isBack(a) && !isRefresh(a))} />
  </Page>
))

export const PERSON_SCREENS = {
  history: History, avatars: Avatars, sleep_pay: SleepPay, life_refusal: LifeRefusal, devices: Devices, device_link: DeviceLink,
}
