import type { ScreenComponent } from '../types'
import { Scroll, Hero, ComingSoonBanner, Section, Row, ChipRow, Chip, SoonBtn } from './kit/parts'
import { t } from '../../i18n'

// The city's newspaper and inviting friends (torncity-client/proto
// features_proto.gd: _s_news, _s_invite). Not on the server — previews.

const News: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <div className="ft-newspaper" style={{ textAlign: 'center' }}>
      <div className="display" style={{ fontSize: 30 }}>{t('f.press.388')}</div>
      <div style={{ fontSize: 13, marginTop: 6, borderTop: '1px solid #8a6a3a', paddingTop: 8 }}>{t('f.press.389')}</div>
    </div>
    <ChipRow>
      {[t('f.press.390'), t('f.theme.259'), t('f.press.391'), t('f.press.392'), t('f.press.393'), t('f.press.394')].map((c, i) => (
        <Chip key={c} text={c} color={i === 0 ? '#8a6a3a' : 'var(--steel)'} />
      ))}
    </ChipRow>
    <div className="ft-newspaper">
      <Chip text={t('f.theme.259')} color="var(--anar)" />
      <div className="display" style={{ fontSize: 21, marginTop: 8 }}>{t('f.press.395')}</div>
      <div style={{ fontSize: 14, marginTop: 8, color: '#4a3a20' }}>{t('f.press.396')}</div>
      <div style={{ fontSize: 12, marginTop: 8, color: '#6a5a40' }}>{t('f.press.397')}</div>
    </div>
    <Section title={t('f.press.398')}>
      <Row icon="vote" palette="violet" title={t('f.press.399')} sub={t('f.press.391')} right={t('f.press.400')} />
      <Row icon="chart" palette="emerald" title={t('f.press.401')} sub={t('f.press.392')} right={t('f.combat.112')} />
      <Row icon="f_rings" palette="gold" title={t('f.press.402')} sub={t('f.press.393')} right={t('f.press.403')} />
      <Row icon="handcuffs" palette="steel" title={t('f.press.404')} sub={t('f.press.394')} right={t('f.press.405')} />
      <Row icon="gavel" palette="steel" title={t('f.press.406')} sub={t('f.press.407')} right={t('f.chats.45')} />
    </Section>
  </Scroll>
)

const STEPS = [
  { n: 1, icon: 'coins', reward: t('f.family.204'), done: true },
  { n: 3, icon: 'x_chest', reward: t('f.press.408'), done: true },
  { n: 5, icon: 'x_crown', reward: t('f.press.409'), done: false },
  { n: 10, icon: 'x_car', reward: t('f.press.410'), done: false },
  { n: 25, icon: 'x_laurel', reward: t('f.press.411'), done: false },
]

const Invite: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="x_present" title={t('f.press.412')} sub={t('f.press.413')} />
    <Row icon="m_search" palette="steel" title="t.me/torncity_bot?start=ref_S4R4" />
    <SoonBtn kind="blue" icon="x_send">{t('f.press.414')}</SoonBtn>
    <Section title={t('f.press.415')}>
      <ChipRow>
        {STEPS.map((s) => <Chip key={s.n} text={`${s.n}  –  ${s.reward}`} color={s.done ? 'var(--lapis)' : 'var(--steel)'} />)}
      </ChipRow>
    </Section>
    <Section title={t('f.press.416')}>
      <Row icon="eagle" palette="sapphire" title={t('f.casino.22')} sub={t('f.press.417')} right="✓" rightColor="var(--leaf)" />
      <Row icon="a_foxkid" palette="fox" title={t('f.press.418')} sub={t('f.press.419')} />
      <Row icon="a_raccoon" palette="cream" title={t('f.press.420')} sub={t('f.press.421')} />
    </Section>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { news: News, invite: Invite } as Record<string, ScreenComponent> }
