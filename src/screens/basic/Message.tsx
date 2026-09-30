// Native layout for every server screen that has no bespoke screen yet
// (about 140 of them: results, refusals, confirmations, pushed notices and
// the long tail of content screens). It replaces the raw Telegram-text card:
// the answer's text is read into a headline, facts and paragraphs (text.ts),
// simple views add exact facts (facts.ts), and the actions are the kit's.

import { useMemo } from 'react'
import type { ScreenComponent, ScreenProps } from '../types'
import { Card, Header, ListRow, ScreenScroll, type Tone } from '../native/kit/Parts'
import Actions from '../native/kit/Actions'
import Icon from '../../ui/Icon'
import Skeleton from '../../ui/Skeleton'
import { t, type Key } from '../../i18n'
import { factsFor } from './facts'
import { parseText, type Block } from './text'
import './basic.css'

export type Kind = 'result' | 'notice' | 'refusal' | 'confirm' | 'page'

const KIND: Record<Kind, { tone: Tone; icon: string; palette: 'emerald' | 'sapphire' | 'ruby' | 'gold' | 'violet'; title: Key }> = {
  result: { tone: 'emerald', icon: 'check', palette: 'emerald', title: 'msg.result' },
  notice: { tone: 'sapphire', icon: 'inbox', palette: 'sapphire', title: 'msg.notice' },
  refusal: { tone: 'ruby', icon: 'm_stop', palette: 'ruby', title: 'msg.refusal' },
  confirm: { tone: 'gold', icon: 'gavel', palette: 'gold', title: 'msg.confirm' },
  page: { tone: 'violet', icon: 'book', palette: 'violet', title: 'msg.page' },
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="bs-blocks">
      {blocks.map((b, i) => {
        if (b.kind === 'gap') return <div key={i} className="bs-gap" />
        if (b.kind === 'fact') {
          return (
            <div key={i} className="bs-fact">
              <span className="bs-fact-l">{b.fact.label}</span>
              <span className="bs-fact-v" dir="auto">{b.fact.value}</span>
            </div>
          )
        }
        return <p key={i} className="bs-para" dir="auto">{b.text}</p>
      })}
    </div>
  )
}

export function makeMessage(kind: Kind, name: string): ScreenComponent {
  const k = KIND[kind]
  const Screen = ({ response, loading, onAction, run }: ScreenProps) => {
    const parsed = useMemo(() => parseText(response?.text), [response?.text])
    const known = `screen.${name}` as Key
    const title = kind === 'page' ? t(known) : t(k.title)
    const headTitle = title === known ? (parsed.title || t(k.title)) : title
    const facts = useMemo(() => factsFor(name, response?.view), [response?.view])
    const back = (response?.actions ?? []).find((a) => a.kind === 'back')
    const refresh = (response?.actions ?? []).find((a) => a.kind === 'navigation' && /(تازه‌سازی|refresh)\s*$/i.test(a.label))

    if (loading && !response) {
      return <ScreenScroll><Header title={headTitle} tone={k.tone} /><Card><Skeleton lines={3} /></Card></ScreenScroll>
    }
    // a fact list read from the text repeats the exact facts of the view: keep one
    const textBlocks = facts.length ? parsed.blocks.filter((b) => b.kind !== 'fact') : parsed.blocks
    const showTitle = parsed.title && parsed.title !== headTitle

    return (
      <ScreenScroll>
        <Header title={headTitle} tone={k.tone} onBack={back ? () => onAction(back) : undefined}
          onRefresh={refresh?.command ? () => run(refresh.command!, refresh.args) : undefined} />

        <Card tone={k.tone}>
          <div className="bs-head">
            <span className={`bs-badge bs-badge-${kind}`}><Icon name={k.icon} palette={k.palette} size={26} /></span>
            <div className="bs-head-text">
              {showTitle && <div className="bs-title display" dir="auto">{parsed.title}</div>}
            </div>
          </div>
          {facts.length > 0 && (
            <div className="bs-blocks">
              {facts.map((f, i) => (
                <div key={i} className="bs-fact">
                  <span className="bs-fact-l">{f.label}</span>
                  <span className="bs-fact-v" dir="auto">{f.value}</span>
                </div>
              ))}
            </div>
          )}
          {textBlocks.length > 0 && <Blocks blocks={textBlocks} />}
          {!facts.length && !textBlocks.length && !showTitle && <ListRow icon={k.icon} palette={k.palette} title={t('msg.empty')} />}
        </Card>

        <Actions response={response} onAction={onAction} only={(a) => a.kind !== 'back'} />
      </ScreenScroll>
    )
  }
  return Screen
}
