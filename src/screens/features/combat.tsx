import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  Chip, ChipRow, StatBar, SoonBtn, Plate,
} from './kit/parts'
import { t } from '../../i18n'

// Training, attacking, the fight report and bounties (torncity-client/proto
// features_proto.gd: _s_gym, _s_attack, _s_fight, _s_bounty). Not on the
// server — previews only.

const BSTATS = [
  { icon: 'x_biceps', palette: 'ruby' as const, name: t('f.combat.66'), value: 1240 },
  { icon: 'x_sprint', palette: 'sapphire' as const, name: t('f.combat.67'), value: 980 },
  { icon: 'x_shield', palette: 'steel' as const, name: t('f.combat.68'), value: 1105 },
  { icon: 'x_dodge', palette: 'emerald' as const, name: t('f.combat.69'), value: 860 },
]

const Gym: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="x_lift" title={t('f.combat.70')} sub={t('f.combat.71')} stat={{ label: t('f.combat.72'), value: '4,185' }} />
    <Card><StatBar label={t('f.combat.73')} value={t('f.combat.74')} fraction={0.85} color="var(--saffron)" /></Card>
    <TileGrid cols={2}>
      {BSTATS.map((b) => (
        <div className="ft-card" key={b.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Plate icon={b.icon} palette={b.palette} size={56} />
          <div className="display" style={{ fontSize: 16 }}>{b.name}</div>
          <div className="display" style={{ fontSize: 22, color: 'var(--gold)' }}>{b.value.toLocaleString('en-US')}</div>
          <div style={{ fontSize: 12, color: 'var(--leaf)' }}>{t('f.combat.75')}</div>
          <div style={{ width: '100%' }}><SoonBtn kind="blue">{t('f.combat.76')}</SoonBtn></div>
        </div>
      ))}
    </TileGrid>
    <Card><div className="screen-text">{t('f.combat.77')}</div></Card>
  </Scroll>
)

const Attack: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="swords" title={t('f.combat.78')} sub={t('f.combat.79')} />
    <Card>
      {BSTATS.map((b, i) => {
        const theirs = [1380, 1020, 1210, 700][i]
        const mine = b.value
        const hi = Math.max(mine, theirs)
        return (
          <div key={b.name} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 4 }}>{b.name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, textAlign: 'left', fontSize: 12 }}>{theirs.toLocaleString('en-US')}</div>
              <div style={{ flex: 3, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 6, display: 'flex', flexDirection: 'row-reverse', overflow: 'hidden' }}>
                <div style={{ width: `${(mine / hi) * 50}%`, background: 'var(--anar)' }} />
                <div style={{ width: `${(theirs / hi) * 50}%` }} />
              </div>
              <div style={{ flex: 1, textAlign: 'right', fontSize: 12 }}>{mine.toLocaleString('en-US')}</div>
            </div>
          </div>
        )
      })}
      <ChipRow><Chip text={t('f.combat.80')} color="var(--saffron)" /></ChipRow>
    </Card>
    <Section title={t('f.combat.81')}>
      <TileGrid>
        <Tile icon="rifle" palette="steel" title={t('f.combat.82')} sub={t('f.combat.83')} />
        <Tile icon="x_knife" palette="steel" title={t('f.combat.84')} sub={t('f.combat.85')} />
        <Tile icon="x_vest" palette="emerald" title={t('f.combat.86')} sub={t('f.combat.87')} />
      </TileGrid>
    </Section>
    <Card>
      <StatBar label={t('f.combat.88')} value="62%" fraction={0.62} color="var(--saffron)" />
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gold)' }}>{t('f.combat.89')}</div>
      <div style={{ fontSize: 13, color: 'var(--anar)' }}>{t('f.combat.90')}</div>
    </Card>
    <SoonBtn kind="red">{t('f.combat.91')}</SoonBtn>
  </Scroll>
)

const Fight: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.combat.92')} />
    <Hero tint="gold" icon="x_laurel" title={t('f.combat.93')} sub={t('f.combat.94')} />
    <Card>
      <StatBar label={t('f.casino.24')} value={t('f.combat.95')} fraction={0.74} color="var(--leaf)" />
      <div style={{ height: 8 }} />
      <StatBar label={t('f.casino.30')} value={t('f.combat.96')} fraction={0} color="var(--anar)" />
    </Card>
    <Section title={t('f.combat.97')}>
      <Row icon="rifle" palette="steel" title={t('f.combat.98')} sub="" right={t('f.combat.99')} rightColor="var(--leaf)" />
      <Row icon="x_fist" palette="ruby" title={t('f.combat.100')} sub="" right={t('f.combat.101')} rightColor="var(--anar)" />
      <Row icon="x_dodge" palette="emerald" title={t('f.combat.102')} sub="" right={t('f.combat.103')} />
      <Row icon="x_knife" palette="steel" title={t('f.combat.104')} sub="" right={t('f.combat.105')} rightColor="var(--leaf)" />
      <Row icon="rifle" palette="steel" title={t('f.combat.106')} sub="" right={t('f.combat.107')} rightColor="var(--gold)" />
    </Section>
    <Section title={t('f.combat.108')}>
      <TileGrid>
        <Tile icon="x_cash" palette="gold" title={t('f.combat.109')} sub={t('f.combat.110')} />
        <Tile icon="x_hosp" palette="ruby" title={t('f.combat.111')} sub={t('f.combat.112')} />
        <Tile icon="f_dove" palette="steel" title={t('f.combat.113')} sub={t('f.combat.114')} />
      </TileGrid>
    </Section>
    <ChipRow><Chip text={t('f.combat.115')} color="var(--leaf)" /></ChipRow>
  </Scroll>
)

const WANTED = [
  { name: t('f.casino.30'), icon: 'lion', palette: 'gold' as const, level: 12, reward: '5,000', by: t('f.combat.116'), state: '' },
  { name: t('f.combat.117'), icon: 'a_wolf', palette: 'steel' as const, level: 18, reward: '22,000', by: t('f.combat.118'), state: '' },
  { name: t('f.combat.119'), icon: 'a_raccoon', palette: 'cream' as const, level: 9, reward: '1,500', by: t('f.casino.27'), state: t('f.combat.120') },
  { name: t('f.combat.121'), icon: 'x_ninja', palette: 'steel' as const, level: 21, reward: '40,000', by: t('f.combat.122'), state: t('f.combat.123') },
]

const Bounty: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="x_wanted" title={t('f.combat.124')} sub={t('f.combat.125')} />
    <SoonBtn>{t('f.combat.126')}</SoonBtn>
    <TileGrid cols={2}>
      {WANTED.map((w) => (
        <div className="ft-poster" key={w.name}>
          <div className="display" style={{ fontSize: 18 }}>{t('f.combat.124')}</div>
          <Plate icon={w.icon} palette={w.palette} size={60} />
          <div className="display" style={{ fontSize: 15 }}>{w.name}  {t('f.combat.127')} {w.level}</div>
          <div className="display" style={{ fontSize: 20, color: '#b06a00' }}>{w.reward} {t('f.combat.128')}</div>
          <div style={{ fontSize: 12 }}>{t('f.combat.129')} {w.by}</div>
          {w.state ? <Chip text={w.state} color="var(--steel)" /> : <SoonBtn kind="red">{t('f.combat.91')}</SoonBtn>}
        </div>
      ))}
    </TileGrid>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { attack: Attack, fight: Fight, bounty: Bounty } as Record<string, ScreenComponent>,
}
