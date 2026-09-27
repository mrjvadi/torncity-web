import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, Chip, SoonBtn } from './kit/parts'

// The first-session guide and the daily reward (torncity-client/proto
// features_proto.gd: _s_tutorial, _s_daily). Not on the server — previews.

const Tutorial: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="راهنمای قدم‌به‌قدم هنوز در بازی فعال نیست." />
    <Hero tint="gold" icon="fox" title="اول یک شغل پیدا کن!" sub="مرحله 2 از 6" />
    <Card>
      <div className="screen-text">با شغل هر شیفت پول می‌گیری و مهارتت بالا می‌رود. روی «کار» بزن تا شغل‌های شهر را ببینی.</div>
    </Card>
    <div className="ft-chip-row" style={{ justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="ft-dot" style={{ position: 'static', width: 10, height: 10, background: i <= 1 ? 'var(--gold)' : 'rgba(255,255,255,0.15)' }} />)}
    </div>
    <Chip text="جایزه‌ی پایان: 1,000 نیل" color="var(--saffron)" />
    <SoonBtn kind="steel">رد کردن</SoonBtn>
  </Scroll>
)

const DAYS = [
  { icon: 'coins', palette: 'gold' as const, reward: '500 نیل', claimed: true },
  { icon: 'energy', palette: 'amber' as const, reward: 'انرژی +10', claimed: true },
  { icon: 'coins', palette: 'gold' as const, reward: '800 نیل', claimed: true },
  { icon: 'pill', palette: 'ruby' as const, reward: 'دارو ×2', claimed: true },
  { icon: 'x_gem', palette: 'sapphire' as const, reward: '5 طلا', claimed: false, today: true },
  { icon: 'coins', palette: 'gold' as const, reward: '1,500 نیل', claimed: false },
  { icon: 'x_chest', palette: 'gold' as const, reward: 'صندوق هفته', claimed: false },
]

const TASKS = [
  { icon: 'crime', palette: 'steel' as const, label: '3 جرم انجام بده', have: 2, need: 3, reward: '300 نیل' },
  { icon: 'x_lift', palette: 'amber' as const, label: 'در باشگاه تمرین کن', have: 1, need: 1, reward: 'انرژی +5' },
  { icon: 'm_chat', palette: 'sapphire' as const, label: 'به یک دوست پیام بده', have: 0, need: 1, reward: '100 نیل' },
  { icon: 'work', palette: 'teal' as const, label: 'یک شیفت کار کن', have: 1, need: 1, reward: 'تجربه +20' },
]

const Daily: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="x_flame" title="5 روز پشت‌سرهم" sub="اگر یک روز نیایی، از روز 1 شروع می‌شود" stat={{ label: 'روز بعد تا', value: '07:42:10' }} />
    <TileGrid>
      {DAYS.map((d, i) => (
        <Tile key={i} icon={d.icon} palette={d.palette} title={`روز ${i + 1}`} sub={d.reward} glow={!!d.today} />
      ))}
    </TileGrid>
    <SoonBtn>گرفتن جایزه‌ی روز 5</SoonBtn>
    <Section title="کارهای امروز">
      {TASKS.map((t, i) => (
        <Row
          key={i}
          icon={t.icon}
          palette={t.palette}
          title={t.label}
          sub={`${t.have}/${t.need}`}
          right={t.have >= t.need ? <Chip text={`بگیر  ·  ${t.reward}`} color="var(--leaf)" /> : t.reward}
        />
      ))}
    </Section>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { tutorial: Tutorial, daily: Daily } as Record<string, ScreenComponent> }
