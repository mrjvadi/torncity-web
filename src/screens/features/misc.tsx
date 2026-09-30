import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, StatBar, SoonBtn, BtnRow, Plate,
} from './kit/parts'
import { t } from '../../i18n'

// Land plots, a will, cosmetics, a seasonal event and levelling up
// (torncity-client/proto features_proto: _s_plot, _s_will, _s_cosmetics,
// _s_event; screens_proto: _s_levelup). None on the server — previews.

const Plot: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.misc.291')} />
    <Hero tint="emerald" icon="x_field" title={t('f.misc.292')} sub={t('f.misc.293')} />
    <ChipRow>
      <Chip text={t('f.misc.294')} color="var(--firouzeh)" />
      <Chip text={t('f.misc.295')} color="var(--saffron)" />
      <Chip text={t('f.misc.296')} color="var(--steel)" />
      <Chip text={t('f.misc.297')} color="var(--leaf)" />
    </ChipRow>
    <Card>
      <Row icon="x_field" palette="emerald" title={t('f.misc.298')} sub={t('f.misc.299')} right="240,000" rightColor="var(--gold)" />
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>{t('f.misc.300')}</div>
    </Card>
    <Section title={t('f.misc.301')}>
      <TileGrid>
        <Tile icon="house" palette="amber" title={t('f.family.186')} sub={t('f.misc.302')} />
        <Tile icon="f_house" palette="gold" title={t('f.family.229')} sub={t('f.misc.303')} />
        <Tile icon="city" palette="sapphire" title={t('f.misc.304')} sub={t('f.misc.305')} />
      </TileGrid>
    </Section>
    <BtnRow>
      <SoonBtn>{t('f.misc.306')}</SoonBtn>
      <SoonBtn kind="steel">{t('f.misc.307')}</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Will: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <div className="ft-newspaper">
      <div className="display" style={{ fontSize: 22 }}>{t('f.misc.308')}</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>{t('f.misc.309')}</div>
    </div>
    <Section title={t('f.misc.310')}>
      <TileGrid>
        <Tile icon="bank" palette="sapphire" title={t('f.misc.311')} sub="98,750" />
        <Tile icon="f_house" palette="amber" title={t('f.misc.312')} sub="90,000" />
        <Tile icon="chart" palette="emerald" title={t('f.misc.313')} sub="63,000" />
        <Tile icon="factory" palette="steel" title={t('f.misc.314')} sub="160,000" />
      </TileGrid>
    </Section>
    <Section title={t('f.misc.315')}>
      <Row icon="a_wolf" palette="steel" title={t('f.chats.39')} sub={t('f.theme.290')} right="25%" />
      <Row icon="a_foxkid" palette="fox" title={t('f.family.173')} sub={t('f.misc.316')} right="35%" />
      <Row icon="a_rabbit" palette="cream" title={t('f.family.175')} sub={t('f.misc.317')} right="25%" />
      <Row icon="f_baby" palette="amber" title={t('f.family.177')} sub={t('f.misc.318')} right="15%" />
    </Section>
    <SoonBtn>{t('f.misc.319')}</SoonBtn>
  </Scroll>
)

const Cosmetics: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.misc.320')} />
    <Hero tint="violet" icon="x_crown" title={t('f.casino.24')} sub={t('f.misc.321')} />
    <ChipRow>
      <Chip text={t('f.misc.322')} color="var(--violet)" />
      <Chip text={t('f.misc.323')} color="var(--steel)" />
      <Chip text={t('f.misc.324')} color="var(--steel)" />
      <Chip text={t('f.misc.325')} color="var(--steel)" />
    </ChipRow>
    <TileGrid>
      <Tile icon="x_crown" palette="gold" title={t('f.misc.326')} sub={t('f.misc.327')} glow />
      <Tile icon="fox" palette="teal" title={t('f.misc.328')} sub={t('f.misc.329')} />
      <Tile icon="x_flame" palette="amber" title={t('f.misc.330')} sub="⭐ 50" />
      <Tile icon="x_flower" palette="gold" title={t('f.misc.331')} sub={t('f.misc.332')} />
      <Tile icon="x_gem" palette="sapphire" title={t('f.family.201')} sub="⭐ 120" />
      <Tile icon="x_star" palette="gold" title={t('f.misc.333')} sub={t('f.misc.334')} />
    </TileGrid>
  </Scroll>
)

const Event: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.misc.335')} />
    <Hero tint="emerald" icon="x_flower" title={t('f.misc.336')} sub={t('f.misc.337')} stat={{ label: t('f.misc.338'), value: t('f.misc.339') }} />
    <Section title={t('f.misc.340')}>
      <SoonBtn kind="gold">{t('f.misc.341')}</SoonBtn>
      <TileGrid>
        {[
          { icon: 'coins', reward: 'x_gem', done: true },
          { icon: 'energy', reward: 'x_chest', done: true },
          { icon: 'pill', reward: 'x_crown', done: true },
          { icon: 'coins', reward: 'x_car', done: false },
          { icon: 'x_chest', reward: 'x_flower', done: false },
        ].map((st, i) => (
          <div className="ft-card" key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Plate icon={st.icon} palette="gold" size={38} />
            <div style={{ fontSize: 12 }}>{t('f.misc.342')} {i + 1}</div>
            <Plate icon={st.reward} palette={st.done ? 'gold' : 'steel'} size={38} />
          </div>
        ))}
      </TileGrid>
    </Section>
    <Section title={t('f.misc.343')}>
      <Row icon="x_flower" palette="gold" title={t('f.misc.344')} sub={t('f.misc.345')} right="+80" />
      <Row icon="x_flame" palette="amber" title={t('f.misc.346')} sub={t('f.misc.347')} right="+50" />
      <Row icon="x_present" palette="ruby" title={t('f.misc.348')} sub={t('f.misc.349')} right="+40" />
    </Section>
  </Scroll>
)

const Levelup: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.misc.350')} />
    <Hero tint="gold" icon="x_star" title={t('f.misc.351')} sub={t('f.misc.352')} />
    <Card><StatBar label={t('f.misc.353')} value={t('f.misc.354')} fraction={0} color="var(--gold)" /></Card>
    <Section title={t('f.misc.355')}>
      <TileGrid>
        <Tile icon="crime" palette="steel" title={t('f.misc.356')} />
        <Tile icon="market" palette="sapphire" title={t('f.misc.357')} />
        <Tile icon="x_star" palette="gold" title={t('f.misc.358')} />
      </TileGrid>
    </Section>
    <SoonBtn>{t('f.misc.359')}</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { plot: Plot, will: Will, cosmetics: Cosmetics, event: Event, levelup: Levelup } as Record<string, ScreenComponent>,
}
