// کارت بازیکن (screen `card`, command life.card): my public card, or another player's. The face, the name, the
// stage and age, the wealth rank and the code as the hero; the bio; the level, medals and memories as three figures;
// then what the server lets me do with it (my bio as the one orange button, the rest as rows).

import type { NScreenProps } from '../../registry'
import type { CardView } from '../../../api/views.gen'
import { useNav } from '../../nav'
import { Button, Chip, Empty, Hero, Icon, KV, Loading, Note, Page, Strip } from '../../ui'
import { useContentNames } from '../../../village/useVillage'
import { ago, formatNumber } from '../../../screens/native/kit/format'
import { actionLabel } from '../../../screens/village/wording'
import { t } from '../../../i18n'
import { Avatar } from './Profile'
import { MoreActions, useBack, word } from './parts'
import './me.css'

const ICONS: Record<string, string> = { 'life.history': 'x_scroll', 'life.their_history': 'x_scroll', 'life.avatar': 'a_foxkid', 'life.bio_clear': 'close', 'life.bio_again': 'x_quill' }

function joinedAgo(iso?: string | null): string | undefined {
  if (!iso) return undefined
  const ms = Date.now() - Date.parse(iso)
  if (!isFinite(ms) || ms < 0) return undefined
  return ago(Math.floor(ms / 1000))
}

export default function Card({ response, loading }: NScreenProps) {
  const nav = useNav()
  const back = useBack()
  const names = useContentNames()
  if (!response) return <Page title={t('card.title')} onBack={back}>{loading ? <Loading blocks={[190, 80, 90]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const v = (response.view ?? {}) as Partial<CardView>
  const stage = v.stage?.name ? names.name('life_stage', v.stage.code ?? '', v.stage.name) : ''
  const rank = v.rank?.name ? names.name('life_rank', v.rank.code ?? '', v.rank.name) : ''
  const line = [stage, v.age ? t('common.years_old', { n: formatNumber(v.age) }) : ''].filter(Boolean).join(' · ')
  const joined = joinedAgo(v.joined_at)
  const notice = v.notice ? word(`lf.life.notice.${v.notice}`) : ''
  // my bio is the card's one orange action; the server lists it by meaning
  const lead = (response.actions ?? []).find((a) => a.id === 'life.bio' || a.id === 'life.bio_again')

  return (
    <Page title={v.self ? t('card.mine') : t('card.title')} onBack={back}>
      {notice && <Note tone="ok" icon="m_check">{notice}</Note>}

      <Hero>
        <div className="n-me-card">
          <Avatar emoji={v.avatar?.emoji} level={v.level} big />
          <h2>{v.name || '…'}</h2>
          {line && <p>{line}</p>}
          <div className="n-me-chips center">
            {rank && <Chip tone="accent">{v.rank?.emoji ? `${v.rank.emoji} ` : ''}{rank}</Chip>}
            {v.code && <Chip><span className="n-ltr">{v.code}</span></Chip>}
          </div>
        </div>
      </Hero>

      {(v.bio || v.self) && (
        <div className="n-card n-me-bio">
          <Icon name="x_quill" />
          <div>
            <small>{t('n.me.card.bio')}</small>
            <p className={v.bio ? '' : 'none'}>{v.bio || t('card.no_bio')}</p>
          </div>
        </div>
      )}

      <Strip items={[
        { label: t('card.level'), value: formatNumber(v.level ?? 0) },
        { label: t('card.achievements'), value: formatNumber(v.achievements ?? 0) },
        { label: t('card.entries'), value: formatNumber(v.entries ?? 0) },
      ]} />
      {joined && <KV label={t('card.joined')} value={joined} />}

      {lead && <Button block icon="x_quill" onClick={() => nav.act(lead)}>{actionLabel(lead)}</Button>}
      <MoreActions response={response} skip={(a) => a === lead} icons={ICONS} />
    </Page>
  )
}
