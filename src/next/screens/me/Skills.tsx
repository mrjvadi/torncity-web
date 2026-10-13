// مهارت‌ها (screen `skills`, command skills.list): my best skill as the hero with the figures of all of them, then
// each skill I have put XP into with its level and the way to the next, then the ones not started yet as quiet chips.

import type { NScreenProps } from '../../registry'
import type { SkillLine, SkillsView } from '../../../api/views.gen'
import { Chip, Empty, Hero, Icon, Loading, Meter, Page, Section, Strip } from '../../ui'
import { useContentNames } from '../../../village/useVillage'
import { clamp01, formatNumber } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { MoreActions, of, useBack } from './parts'
import './me.css'

/** A skill's icon by its code; a skill this table lacks gets the arm. */
const SKILL_ICON: Record<string, string> = {
  management: 'm_brief', finance: 'chart', cooking: 'm_meal', driving: 'x_car', medicine: 'stetho', programming: 'x_phone',
  forestry: 'f_tree', herding: 'x_field', farming: 'x_sprout', weaving: 'x_vest', pottery: 'ore', milling: 'gears', baking: 'bread',
  teaching: 'study', mining: 'ore', building: 'factory', carpentry: 'box', trading: 'trade', law: 'f_scales', crime: 'crime',
}
const iconOf = (code: string) => SKILL_ICON[code] ?? 'x_biceps'

const frac = (l: SkillLine) => (l.max ? 1 : clamp01((l.percent ?? 0) / 100))

function SkillCard({ l, name }: { l: SkillLine; name: string }) {
  const into = Math.max(0, (l.xp ?? 0) - (l.from ?? 0))
  const span = Math.max(0, (l.next ?? 0) - (l.from ?? 0))
  return (
    <div className={`n-me-skill${l.max ? ' max' : ''}`}>
      <span className="n-me-skill-well"><Icon name={iconOf(l.code)} /></span>
      <div className="n-me-skill-body">
        <div className="n-me-skill-head">
          <b>{name}</b>
          {l.max ? <Chip tone="ok">{t('skills.maxed')}</Chip> : <small>{t('n.me.skills.to_next', { n: formatNumber(Math.max(0, span - into)) })}</small>}
        </div>
        <Meter frac={frac(l)} tone={l.max ? undefined : 'cyan'} />
        {!l.max && span > 0 && <span className="n-me-skill-fig">{of(into, span)}</span>}
      </div>
      <span className="n-me-skill-lvl" aria-label={t('common.level', { n: formatNumber(l.level ?? 0) })}>
        <small>{t('card.level')}</small><b>{formatNumber(l.level ?? 0)}</b>
      </span>
    </div>
  )
}

export default function Skills({ response, loading }: NScreenProps) {
  const back = useBack()
  const names = useContentNames()
  if (!response) return <Page title={t('skills.title')} onBack={back}>{loading ? <Loading blocks={[170, 96, 96, 96]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const lines = ((response.view ?? {}) as Partial<SkillsView>).lines ?? []
  const nameOf = (code: string) => names.name('skill', code, code)
  const trained = lines.filter((l) => (l.level ?? 0) > 0 || (l.xp ?? 0) > 0).sort((a, b) => (b.level - a.level) || (b.xp - a.xp))
  const fresh = lines.filter((l) => !trained.includes(l))
  const best = trained[0]
  const levels = trained.reduce((s, l) => s + (l.level ?? 0), 0)
  const mastered = trained.filter((l) => l.max).length

  return (
    <Page title={t('skills.title')} onBack={back}>
      {best ? (
        <Hero art={iconOf(best.code)}>
          <p className="n-label">{t('n.me.skills.best')}</p>
          <p className="n-big">{nameOf(best.code)}</p>
          <p className="n-hero-line"><Chip tone="cyan">{t('common.level', { n: formatNumber(best.level) })}</Chip>{best.max && <> <Chip tone="ok">{t('skills.maxed')}</Chip></>}</p>
        </Hero>
      ) : <Empty icon="x_biceps">{t('skills.none')}</Empty>}
      {best && (
        <Strip items={[
          { label: t('n.me.skills.trained'), value: of(trained.length, lines.length) },
          { label: t('n.me.skills.levels'), value: formatNumber(levels) },
          { label: t('n.me.skills.mastered'), value: formatNumber(mastered) },
        ]} />
      )}

      {trained.length > 0 && (
        <>
          <Section title={t('n.me.skills.learned')} note={formatNumber(trained.length)} />
          <div className="n-me-skills">{trained.map((l) => <SkillCard key={l.code} l={l} name={nameOf(l.code)} />)}</div>
        </>
      )}

      {fresh.length > 0 && (
        <>
          <Section title={t('n.me.skills.untrained')} note={formatNumber(fresh.length)} />
          <div className="n-card flat n-me-fresh">
            <div className="n-chips">{fresh.map((l) => <span key={l.code} className="n-me-fresh-chip"><Icon name={iconOf(l.code)} size={20} />{nameOf(l.code)}</span>)}</div>
            <p className="n-me-hint">{t('n.me.skills.untrained_hint')}</p>
          </div>
        </>
      )}

      <MoreActions response={response} title={t('next.actions')} />
    </Page>
  )
}
