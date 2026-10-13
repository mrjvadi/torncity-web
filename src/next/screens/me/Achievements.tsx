// دستاوردها (screen `achievements`, command achievement.list): how many I have earned of all as the hero, with the
// rewards they paid; then the medals I hold, then the ones on the way with how far I am and what they pay.

import type { NScreenProps } from '../../registry'
import type { AchievementLine, AchievementsView } from '../../../api/views.gen'
import { Chip, Empty, Hero, Icon, Loading, Meter, Page, Section } from '../../ui'
import { useContentNames } from '../../../village/useVillage'
import { clamp01, formatNumber, money } from '../../../screens/native/kit/format'
import { t } from '../../../i18n'
import { medalOf, MoreActions, of, useBack } from './parts'
import './me.css'

export default function Achievements({ response, loading }: NScreenProps) {
  const back = useBack()
  const names = useContentNames()
  if (!response) return <Page title={t('achievements.title')} onBack={back}>{loading ? <Loading blocks={[170, 120, 80, 80]} /> : <Empty icon="x_wanted">{t('common.load_failed')}</Empty>}</Page>

  const lines = ((response.view ?? {}) as Partial<AchievementsView>).lines ?? []
  const nameOf = (l: AchievementLine) => (l.achievement?.code ? names.name('achievement', l.achievement.code, l.achievement.name) : l.achievement?.name ?? '')
  const earned = lines.filter((l) => l.earned)
  const open = lines.filter((l) => !l.earned).sort((a, b) => (b.done / Math.max(1, b.count)) - (a.done / Math.max(1, a.count)))
  const paid = earned.reduce((s, l) => s + (l.cash ?? 0), 0)

  return (
    <Page title={t('achievements.title')} onBack={back}>
      {lines.length === 0 ? <Empty icon="medal">{t('achievements.none')}</Empty> : (
        <Hero art="trophy">
          <p className="n-label">{t('n.me.ach.earned')}</p>
          <p className="n-big">{of(earned.length, lines.length)}</p>
          <div className="n-me-ach-meter"><Meter frac={clamp01(earned.length / Math.max(1, lines.length))} tone="accent" thick /></div>
          {paid > 0 && <p className="n-hero-line"><Chip><Icon name="coins" size={18} />{t('n.me.ach.rewards', { n: money(paid) })}</Chip></p>}
        </Hero>
      )}

      {earned.length > 0 && (
        <>
          <Section title={t('n.me.ach.earned')} note={formatNumber(earned.length)} />
          <div className="n-me-awards">
            {earned.map((l, i) => (
              <div key={i} className="n-me-award">
                <span className="n-me-medal-well"><Icon name={medalOf(l.achievement?.code ?? nameOf(l))} /></span>
                <b>{nameOf(l)}</b>
                {l.cash > 0 && <Chip tone="ok">+{money(l.cash)}</Chip>}
              </div>
            ))}
          </div>
        </>
      )}

      {open.length > 0 && (
        <>
          <Section title={t('n.me.ach.open')} note={formatNumber(open.length)} />
          <div className="n-list">
            {open.map((l, i) => (
              <div key={i} className="n-me-goal">
                <span className="n-me-goal-well"><Icon name={medalOf(l.achievement?.code ?? nameOf(l))} /></span>
                <div className="n-me-goal-body">
                  <div className="n-me-goal-head"><b>{nameOf(l)}</b>{l.reward > 0 && <Chip tone="accent">{t('n.me.ach.reward', { n: money(l.reward) })}</Chip>}</div>
                  <Meter frac={clamp01(l.done / Math.max(1, l.count))} tone="cyan" />
                  <span className="n-me-goal-fig">{of(l.done, l.count)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <MoreActions response={response} title={t('next.actions')} />
    </Page>
  )
}
