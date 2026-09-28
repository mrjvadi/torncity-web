import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, StatBar, SoonBtn, BtnRow, Plate,
} from './kit/parts'

// Land plots, a will, cosmetics, a seasonal event and levelling up
// (torncity-client/proto features_proto: _s_plot, _s_will, _s_cosmetics,
// _s_event; screens_proto: _s_levelup). None on the server — previews.

const Plot: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="زمین‌های شهر هنوز خرید و فروش نمی‌شوند." />
    <Hero tint="emerald" icon="x_field" title="محله‌ی باغ‌ها" sub="مسکونی  ·  20 قطعه" />
    <ChipRow>
      <Chip text="مال من" color="var(--firouzeh)" />
      <Chip text="فروشی" color="var(--saffron)" />
      <Chip text="دیگران" color="var(--steel)" />
      <Chip text="فضای سبز" color="var(--leaf)" />
    </ChipRow>
    <Card>
      <Row icon="x_field" palette="emerald" title="قطعه‌ی V-15" sub="600 متر  ·  کاربری مسکونی  ·  نبش" right="240,000" rightColor="var(--gold)" />
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>همسایه‌ها: آرش و مهتاب  ·  نزدیک پارک  ·  مالیات سالانه 1%</div>
    </Card>
    <Section title="چه می‌توان ساخت؟">
      <TileGrid>
        <Tile icon="house" palette="amber" title="خانه" sub="60,000  ·  4 روز" />
        <Tile icon="f_house" palette="gold" title="خانه‌ی خانوادگی" sub="140,000  ·  7 روز" />
        <Tile icon="city" palette="sapphire" title="ویلا با استخر" sub="320,000  ·  12 روز" />
      </TileGrid>
    </Section>
    <BtnRow>
      <SoonBtn>خرید زمین</SoonBtn>
      <SoonBtn kind="steel">پیشنهاد قیمت</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Will: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <div className="ft-newspaper">
      <div className="display" style={{ fontSize: 22 }}>وصیت‌نامه‌ی سارا</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>ثبت‌شده در محضر فنویک  ·  آخرین تغییر: 3 روز پیش  ·  وصی: آرش</div>
    </div>
    <Section title="دارایی‌ها  ·  حدود 412,000 نیل">
      <TileGrid>
        <Tile icon="bank" palette="sapphire" title="نقد و بانک" sub="98,750" />
        <Tile icon="f_house" palette="amber" title="نیمی از خانه‌ی خانوادگی" sub="90,000" />
        <Tile icon="chart" palette="emerald" title="1,200 سهم صنایع آراز" sub="63,000" />
        <Tile icon="factory" palette="steel" title="کافه‌ی سارا  ·  100%" sub="160,000" />
      </TileGrid>
    </Section>
    <Section title="وارث‌ها  ·  جمع 100%">
      <Row icon="a_wolf" palette="steel" title="آرش" sub="همسر" right="25%" />
      <Row icon="a_foxkid" palette="fox" title="نیلا" sub="9 سال  ·  تا 18 سالگی نزد قیم" right="35%" />
      <Row icon="a_rabbit" palette="cream" title="کیان" sub="3 سال  ·  تا 18 سالگی نزد قیم" right="25%" />
      <Row icon="f_baby" palette="amber" title="نوزاد" sub="12 روزه  ·  تا 18 سالگی نزد قیم" right="15%" />
    </Section>
    <SoonBtn>ثبت در محضر  ·  500 نیل</SoonBtn>
  </Scroll>
)

const Cosmetics: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="ظاهر فقط زیبایی است؛ قدرتی نمی‌دهد." />
    <Hero tint="violet" icon="x_crown" title="سارا" sub="«سلطان بازار»" />
    <ChipRow>
      <Chip text="قاب" color="var(--violet)" />
      <Chip text="لقب" color="var(--steel)" />
      <Chip text="رنگ نام" color="var(--steel)" />
      <Chip text="پس‌زمینه" color="var(--steel)" />
    </ChipRow>
    <TileGrid>
      <Tile icon="x_crown" palette="gold" title="طلایی" sub="در حال استفاده" glow />
      <Tile icon="fox" palette="teal" title="فیروزه" sub="مالکِ آن" />
      <Tile icon="x_flame" palette="amber" title="آتش" sub="⭐ 50" />
      <Tile icon="x_flower" palette="gold" title="بهار" sub="فقط در نوروز" />
      <Tile icon="x_gem" palette="sapphire" title="الماس" sub="⭐ 120" />
      <Tile icon="x_star" palette="gold" title="شاهی" sub="40 طلا" />
    </TileGrid>
  </Scroll>
)

const Event: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="جشن فصلی هنوز در بازی فعال نیست." />
    <Hero tint="emerald" icon="x_flower" title="بهار آمد!" sub="12 روز تا پایان جشن" stat={{ label: 'دارایی جشن', value: '340 سکه‌ی بهار' }} />
    <Section title="مسیر جایزه  ·  مرحله 4">
      <SoonBtn kind="gold">پاس ویژه  ⭐ 150</SoonBtn>
      <TileGrid>
        {[
          { icon: 'coins', reward: 'x_gem', done: true },
          { icon: 'energy', reward: 'x_chest', done: true },
          { icon: 'pill', reward: 'x_crown', done: true },
          { icon: 'coins', reward: 'x_car', done: false },
          { icon: 'x_chest', reward: 'x_flower', done: false },
        ].map((t, i) => (
          <div className="ft-card" key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Plate icon={t.icon} palette="gold" size={38} />
            <div style={{ fontSize: 12 }}>مرحله {i + 1}</div>
            <Plate icon={t.reward} palette={t.done ? 'gold' : 'steel'} size={38} />
          </div>
        ))}
      </TileGrid>
    </Section>
    <Section title="کارهای جشن">
      <Row icon="x_flower" palette="gold" title="هفت‌سین را کامل کن" sub="5 از 7 سین در شهر پیدا شد" right="+80" />
      <Row icon="x_flame" palette="amber" title="چهارشنبه‌سوری" sub="سه‌شنبه شب در پارک" right="+50" />
      <Row icon="x_present" palette="ruby" title="به 3 دوست عیدی بده" sub="1 از 3" right="+40" />
    </Section>
  </Scroll>
)

const Levelup: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="جشن ارتقای سطح نمونه است؛ سطح از سرورهای واقعی می‌آید." />
    <Hero tint="gold" icon="x_star" title="سطح 8!" sub="به سطح جدید رسیدی" />
    <Card><StatBar label="تجربه" value="0 از 7,200" fraction={0} color="var(--gold)" /></Card>
    <Section title="چیزهایی که باز شد">
      <TileGrid>
        <Tile icon="crime" palette="steel" title="جرم درجه 4" />
        <Tile icon="market" palette="sapphire" title="بازار سهام" />
        <Tile icon="x_star" palette="gold" title="+1 امتیاز مهارت" />
      </TileGrid>
    </Section>
    <SoonBtn>ادامه</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { plot: Plot, will: Will, cosmetics: Cosmetics, event: Event, levelup: Levelup } as Record<string, ScreenComponent>,
}
