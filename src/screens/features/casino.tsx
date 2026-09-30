import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, StatBar, SoonBtn, BtnRow, Plate } from './kit/parts'

// The casino, slots and street racing (torncity-client/proto features_proto:
// _s_casino, _s_slots, _s_race). Not on the server — previews only.

const Casino: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="violet" icon="coins" title="ژتون‌ها" stat={{ label: 'موجودی', value: '2,400' }}>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SoonBtn kind="gold">خرید ژتون</SoonBtn>
        <SoonBtn kind="steel">فروش</SoonBtn>
      </div>
    </Hero>
    <Card><StatBar label="سقف باخت امروز" value="1,200 از 5,000" fraction={0.24} color="var(--saffron)" /></Card>
    <TileGrid>
      <Tile icon="x_slot" palette="amber" title="اسلات" sub="برد تا x500" glow />
      <Tile icon="x_cards" palette="ruby" title="بلک‌جک" sub="در برابر دیلر" />
      <Tile icon="x_dice" palette="emerald" title="تاس" sub="بیشتر یا کمتر از 7" />
      <Tile icon="x_ticket" palette="violet" title="بخت‌آزمایی" sub="قرعه‌کشی جمعه" glow />
    </TileGrid>
    <Card>
      <Row icon="x_ticket" palette="violet" title="جایزه‌ی بزرگ جمعه" sub="بلیت: 100 ساپ  ·  2 روز و 4 ساعت" right="1,240,000" rightColor="var(--gold)" />
    </Card>
    <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
      بازی مسئولانه: سقف روزانه را خودت تعیین می‌کنی و از آن بیشتر نمی‌شود.
    </div>
  </Scroll>
)

const Slots: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="violet" icon="x_slot" title="گنج پارسی" />
    <Card>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {[['x_star', 'x_crown', 'f_hearts'], ['x_gem', 'x_crown', 'coins'], ['x_flame', 'x_crown', 'x_star']].map((reel, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#fff8e8', borderRadius: 12, padding: 8 }}>
            {reel.map((ic, j) => <Plate key={j} icon={ic} palette={j === 1 ? 'gold' : 'steel'} size={56} bg="transparent" />)}
          </div>
        ))}
      </div>
    </Card>
    <div className="ft-card" style={{ textAlign: 'center', background: 'linear-gradient(180deg, #ffe680, #f5a11f)', color: '#5a2a00' }}>
      <div className="display" style={{ fontSize: 22 }}>برد!  3 تاج  ·  5,000</div>
    </div>
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>شرط هر چرخش</span>
        <span className="display" style={{ fontSize: 28, color: 'var(--gold)' }}>100</span>
      </div>
    </Card>
    <SoonBtn>بچرخان!</SoonBtn>
  </Scroll>
)

const ORDER = [
  { pos: 1, name: 'نگار', car: 'تندباد GT', gap: '—', color: '#3f7be8' },
  { pos: 2, name: 'سارا', car: 'شاهین R', gap: '+0.8 ثانیه', color: 'var(--firouzeh)' },
  { pos: 3, name: 'کاوه', car: 'کویر 4x4', gap: '+2.1 ثانیه', color: 'var(--saffron)' },
  { pos: 4, name: 'بردیا', car: 'پلنگ S', gap: '+4.5 ثانیه', color: 'var(--anar)' },
]

const Race: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="x_flag" title="جاده‌ی ساحلی آزور" sub="دور 2 از 3  ·  زنده" />
    <Section title="رتبه‌بندی">
      {ORDER.map((o) => (
        <Row key={o.pos} icon="x_car" palette="steel" title={`${o.pos}. ${o.name}`} sub={o.car} right={o.gap} rightColor={o.color} />
      ))}
    </Section>
    <Card>
      <Row icon="x_car" palette="ruby" title="شاهین R" sub="سرعت 220  ·  شتاب 7.1  ·  کنترل 68" right="جایزه‌ی نفر اول: 12,000 ساپ" />
    </Card>
    <BtnRow>
      <SoonBtn kind="red" icon="x_flame">نیترو x2</SoonBtn>
    </BtnRow>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { casino: Casino, slots: Slots, race: Race } as Record<string, ScreenComponent> }
