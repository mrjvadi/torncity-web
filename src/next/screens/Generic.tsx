// The new UI's generic screen: any server screen that has no screen of its own yet. It draws what the answer holds
// with the new parts: a refusal or a notice first, the figures (from the server's text, or the view's known facts),
// the lists in the view as rows, then the actions: the lead primary as the orange button, other choices as rows,
// danger in red, the pager as two small buttons. It holds no rule about any one screen.

import type { Action } from '../../api/types'
import type { NScreenProps } from '../registry'
import { useNav } from '../nav'
import { Button, Buttons, Empty, KV, List, Loading, Note, Page, Row, Section } from '../ui'
import { icon3d } from '../icons'
import { hasKey, noticeText, refusalText, t, type Key } from '../../i18n'
import { parseText } from '../../screens/basic/text'
import { factsFor } from '../../screens/basic/facts'
import { actionLabel } from '../../screens/village/wording'
import { formatNumber, money } from '../../screens/native/kit/format'

type Obj = Record<string, unknown>

/** The screen's title: the web's own word for it, else the first line of the server's text, else a quiet default. */
export function screenTitle(screen: string, text?: string): string {
  const k = `screen.${screen}`
  if (hasKey(k)) return t(k as Key)
  const p = parseText(text)
  return p.title || t('next.facts')
}

/** The name of one thing in a list: a content name ({ code, name }), a name, a title, a label. */
function nameOf(o: Obj): string {
  for (const k of ['name', 'title', 'label', 'item', 'building', 'player', 'offence', 'company', 'city']) {
    const v = o[k]
    if (typeof v === 'string' && v) return v
    if (v && typeof v === 'object' && typeof (v as Obj).name === 'string' && (v as Obj).name) return (v as Obj).name as string
  }
  return typeof o.code === 'string' ? o.code : ''
}

/** One or two figures of a thing, for the row's end: a quantity, a price, a level. */
function endOf(o: Obj): string | undefined {
  if (typeof o.price === 'number') return money(o.price)
  if (typeof o.amount === 'number') return money(o.amount)
  if (typeof o.qty === 'number') return `×${formatNumber(o.qty)}`
  if (typeof o.level === 'number') return t('common.level', { n: formatNumber(o.level) })
  return undefined
}

/** The lists the view holds: each array of objects with a nameable first item, up to three lists. */
function listsOf(view: unknown): { key: string; items: Obj[] }[] {
  if (!view || typeof view !== 'object') return []
  const out: { key: string; items: Obj[] }[] = []
  for (const [k, v] of Object.entries(view as Obj)) {
    if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object' || v[0] === null) continue
    if (!nameOf(v[0] as Obj)) continue
    out.push({ key: k, items: v as Obj[] })
    if (out.length === 3) break
  }
  return out
}

const isPager = (a: Action) => a.id === 'page.prev' || a.id === 'page.next'

export default function Generic({ response, loading }: NScreenProps) {
  const nav = useNav()
  if (!response) return <Page title="">{loading ? <Loading /> : <Empty>{t('common.load_failed')}</Empty>}</Page>
  const parsed = parseText(response.text)
  const title = screenTitle(response.screen, response.text)
  const facts = response.text
    ? parsed.blocks.flatMap((b) => (b.kind === 'fact' ? [b.fact] : []))
    : factsFor(response.screen, response.view)
  const paras = parsed.blocks.flatMap((b) => (b.kind === 'para' ? [b.text] : []))
  const lists = response.text ? [] : listsOf(response.view)
  const actions = (response.actions ?? []).filter((a) => a.kind !== 'back' && a.id !== 'back' && a.id !== 'refresh')
  const lead = actions.find((a) => a.kind === 'primary' || a.kind === 'confirm')
  const danger = actions.filter((a) => a.kind === 'danger')
  const pager = actions.filter(isPager)
  const rest = actions.filter((a) => a !== lead && !danger.includes(a) && !isPager(a))

  return (
    <Page title={title}>
      {response.ok === false && response.error && <Note tone="bad" icon="x_wanted">{refusalText(response.error.code, response.error.message, response.error.args)}</Note>}
      {response.notice && <Note tone={response.notice.alert ? 'bad' : 'ok'} icon={response.notice.alert ? 'x_wanted' : 'm_check'}>{noticeText(response.notice)}</Note>}

      {facts.length > 0 && <div className="n-rows">{facts.map((f, i) => <KV key={i} label={f.label} value={f.value} />)}</div>}
      {paras.length > 0 && <div className="n-card flat"><p className="n-text">{paras.join('\n')}</p></div>}

      {lists.map((l) => (
        <div key={l.key} style={{ display: 'contents' }}>
          <Section title={t('next.list')} note={formatNumber(l.items.length)} />
          <List>
            {l.items.slice(0, 30).map((o, i) => <Row key={i} icon={icon3d(typeof o.icon === 'string' ? o.icon : undefined, 'box')} title={nameOf(o)} end={endOf(o)} />)}
          </List>
        </div>
      ))}

      {!facts.length && !paras.length && !lists.length && response.ok !== false && !response.notice && <Empty icon="eye">{t('common.none')}</Empty>}

      {rest.length > 0 && (
        <>
          <Section title={t('next.actions')} />
          <List>{rest.map((a, i) => <Row key={i} icon={icon3d(a.icon, 'eye')} title={actionLabel(a)} onClick={() => nav.act(a)} />)}</List>
        </>
      )}
      {pager.length > 0 && <Buttons>{pager.map((a, i) => <Button key={i} kind="ghost" small onClick={() => nav.act(a)}>{actionLabel(a)}</Button>)}</Buttons>}
      {lead && <Button block onClick={() => nav.act(lead)}>{actionLabel(lead)}</Button>}
      {danger.map((a, i) => <Button key={i} kind="danger" block onClick={() => nav.act(a)}>{actionLabel(a)}</Button>)}
    </Page>
  )
}
