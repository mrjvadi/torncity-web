import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, Chip, SoonBtn } from './kit/parts'
import { t } from '../../i18n'

// The first-session guide and the daily reward (torncity-client/proto
// features_proto.gd: _s_tutorial, _s_daily). Not on the server — previews.

const Tutorial: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.onboarding.360')} />
    <Hero tint="gold" icon="fox" title={t('f.onboarding.361')} sub={t('f.onboarding.362')} />
    <Card>
      <div className="screen-text">{t('f.onboarding.363')}</div>
    </Card>
    <div className="ft-chip-row" style={{ justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="ft-dot" style={{ position: 'static', width: 10, height: 10, background: i <= 1 ? 'var(--gold)' : 'rgba(255,255,255,0.15)' }} />)}
    </div>
    <Chip text={t('f.onboarding.364')} color="var(--saffron)" />
    <SoonBtn kind="steel">{t('f.onboarding.365')}</SoonBtn>
  </Scroll>
)

const DAYS = [
  { icon: 'coins', palette: 'gold' as const, reward: t('f.onboarding.366'), claimed: true },
  { icon: 'energy', palette: 'amber' as const, reward: t('f.onboarding.367'), claimed: true },
  { icon: 'coins', palette: 'gold' as const, reward: t('f.onboarding.368'), claimed: true },
  { icon: 'pill', palette: 'ruby' as const, reward: t('f.onboarding.369'), claimed: true },
  { icon: 'x_gem', palette: 'sapphire' as const, reward: t('f.onboarding.370'), claimed: false, today: true },
  { icon: 'coins', palette: 'gold' as const, reward: t('f.onboarding.371'), claimed: false },
  { icon: 'x_chest', palette: 'gold' as const, reward: t('f.onboarding.372'), claimed: false },
]

const TASKS = [
  { icon: 'crime', palette: 'steel' as const, label: t('f.onboarding.373'), have: 2, need: 3, reward: t('f.onboarding.374') },
  { icon: 'x_lift', palette: 'amber' as const, label: t('f.onboarding.375'), have: 1, need: 1, reward: t('f.onboarding.376') },
  { icon: 'm_chat', palette: 'sapphire' as const, label: t('f.onboarding.377'), have: 0, need: 1, reward: t('f.onboarding.378') },
  { icon: 'work', palette: 'teal' as const, label: t('f.onboarding.379'), have: 1, need: 1, reward: t('f.onboarding.380') },
]

const Daily: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="x_flame" title={t('f.onboarding.381')} sub={t('f.onboarding.382')} stat={{ label: t('f.onboarding.383'), value: '07:42:10' }} />
    <TileGrid>
      {DAYS.map((d, i) => (
        <Tile key={i} icon={d.icon} palette={d.palette} title={t('f.onboarding.384', { p0: i + 1 })} sub={d.reward} glow={!!d.today} />
      ))}
    </TileGrid>
    <SoonBtn>{t('f.onboarding.385')}</SoonBtn>
    <Section title={t('f.onboarding.386')}>
      {TASKS.map((task, i) => (
        <Row
          key={i}
          icon={task.icon}
          palette={task.palette}
          title={task.label}
          sub={`${task.have}/${task.need}`}
          right={task.have >= task.need ? <Chip text={t('f.onboarding.387', { p0: task.reward })} color="var(--leaf)" /> : task.reward}
        />
      ))}
    </Section>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { tutorial: Tutorial, daily: Daily } as Record<string, ScreenComponent> }
