import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  Chip, ChipRow, StatBar, SoonBtn, Plate,
} from './kit/parts'

// Training, attacking, the fight report and bounties (torncity-client/proto
// features_proto.gd: _s_gym, _s_attack, _s_fight, _s_bounty). Not on the
// server — previews only.

const BSTATS = [
  { icon: 'x_biceps', palette: 'ruby' as const, name: 'قدرت', value: 1240 },
  { icon: 'x_sprint', palette: 'sapphire' as const, name: 'سرعت', value: 980 },
  { icon: 'x_shield', palette: 'steel' as const, name: 'دفاع', value: 1105 },
  { icon: 'x_dodge', palette: 'emerald' as const, name: 'چالاکی', value: 860 },
]

const Gym: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="x_lift" title="باشگاه آهنین" sub="رده 3 از 8  ·  هر تمرین 20% بیشتر" stat={{ label: 'قدرت نبرد', value: '4,185' }} />
    <Card><StatBar label="انرژی" value="85 از 100" fraction={0.85} color="var(--saffron)" /></Card>
    <TileGrid>
      {BSTATS.map((b) => (
        <div className="ft-card" key={b.name} style={{ flex: '1 1 calc(50% - 5px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Plate icon={b.icon} palette={b.palette} size={56} />
          <div className="display" style={{ fontSize: 16 }}>{b.name}</div>
          <div className="display" style={{ fontSize: 22, color: 'var(--gold)' }}>{b.value.toLocaleString('en-US')}</div>
          <div style={{ fontSize: 12, color: 'var(--leaf)' }}>+12 در هر تمرین</div>
          <div style={{ width: '100%' }}><SoonBtn kind="blue">تمرین  ·  5 انرژی</SoonBtn></div>
        </div>
      ))}
    </TileGrid>
    <Card><div className="screen-text">شادی تو 78 است: هرچه شادتر باشی تمرین اثر بیشتری دارد. خواب و غذا را فراموش نکن.</div></Card>
  </Scroll>
)

const Attack: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="swords" title="بردیا  در برابر  سارا" sub="سطح 12  ·  مرکز شهر" />
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
      <ChipRow><Chip text="جایزه روی سرش: 5,000 نیل" color="var(--saffron)" /></ChipRow>
    </Card>
    <Section title="تجهیزات">
      <TileGrid>
        <Tile icon="rifle" palette="steel" title="تفنگ شکاری" sub="آسیب 62  ·  دقت 70%" />
        <Tile icon="x_knife" palette="steel" title="چاقوی ضامن‌دار" sub="آسیب 28" />
        <Tile icon="x_vest" palette="emerald" title="جلیقه‌ی ضدگلوله" sub="زره 45" />
      </TileGrid>
    </Section>
    <Card>
      <StatBar label="احتمال پیروزی" value="62%" fraction={0.62} color="var(--saffron)" />
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gold)' }}>هزینه: 25 انرژی</div>
      <div style={{ fontSize: 13, color: 'var(--anar)' }}>اگر ببازی: حدود 40 دقیقه بیمارستان</div>
    </Card>
    <SoonBtn kind="red">حمله</SoonBtn>
  </Scroll>
)

const Fight: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="گزارش نبرد نمونه است." />
    <Hero tint="gold" icon="x_laurel" title="پیروز شدی!" sub="بردیا در 4 دور از پا درآمد" />
    <Card>
      <StatBar label="سارا" value="740 از 1,000" fraction={0.74} color="var(--leaf)" />
      <div style={{ height: 8 }} />
      <StatBar label="بردیا" value="0 از 1,200" fraction={0} color="var(--anar)" />
    </Card>
    <Section title="گزارش نبرد">
      <Row icon="rifle" palette="steel" title="دور 1: با تفنگ شلیک کردی" sub="" right="186 آسیب" rightColor="var(--leaf)" />
      <Row icon="x_fist" palette="ruby" title="دور 1: بردیا با مشت زد" sub="" right="92 آسیب" rightColor="var(--anar)" />
      <Row icon="x_dodge" palette="emerald" title="دور 2: از ضربه‌ی چاقو جاخالی دادی" sub="" right="بدون آسیب" />
      <Row icon="x_knife" palette="steel" title="دور 3: با چاقو زدی" sub="" right="310 آسیب" rightColor="var(--leaf)" />
      <Row icon="rifle" palette="steel" title="دور 4: شلیک آخر" sub="" right="464 آسیب" rightColor="var(--gold)" />
    </Section>
    <Section title="با بردیا چه کنی؟">
      <TileGrid>
        <Tile icon="x_cash" palette="gold" title="جیبش را بزن" sub="3,200 نیل" />
        <Tile icon="x_hosp" palette="ruby" title="بیمارستان" sub="2 ساعت" />
        <Tile icon="f_dove" palette="steel" title="رهایش کن" sub="تجربه +50" />
      </TileGrid>
    </Section>
    <ChipRow><Chip text="جایزه‌ی سر: 5,000 نیل به حسابت آمد" color="var(--leaf)" /></ChipRow>
  </Scroll>
)

const WANTED = [
  { name: 'بردیا', icon: 'lion', palette: 'gold' as const, level: 12, reward: '5,000', by: 'ناشناس', state: '' },
  { name: 'رضا گرگه', icon: 'a_wolf', palette: 'steel' as const, level: 18, reward: '22,000', by: 'جناح شیرها', state: '' },
  { name: 'مینا', icon: 'a_raccoon', palette: 'cream' as const, level: 9, reward: '1,500', by: 'کاوه', state: 'در بیمارستان' },
  { name: 'سامان', icon: 'x_ninja', palette: 'steel' as const, level: 21, reward: '40,000', by: 'دولت شهر', state: 'در سفر' },
]

const Bounty: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="x_wanted" title="تحت تعقیب" sub="هر کس هدف را به بیمارستان بفرستد جایزه را می‌برد" />
    <SoonBtn>+ گذاشتن جایزه</SoonBtn>
    <TileGrid>
      {WANTED.map((w) => (
        <div className="ft-poster" key={w.name} style={{ flex: '1 1 calc(50% - 5px)' }}>
          <div className="display" style={{ fontSize: 18 }}>تحت تعقیب</div>
          <Plate icon={w.icon} palette={w.palette} size={60} />
          <div className="display" style={{ fontSize: 15 }}>{w.name}  ·  سطح {w.level}</div>
          <div className="display" style={{ fontSize: 20, color: '#b06a00' }}>{w.reward} نیل</div>
          <div style={{ fontSize: 12 }}>از طرف: {w.by}</div>
          {w.state ? <Chip text={w.state} color="var(--steel)" /> : <SoonBtn kind="red">حمله</SoonBtn>}
        </div>
      ))}
    </TileGrid>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { gym: Gym, attack: Attack, fight: Fight, bounty: Bounty } as Record<string, ScreenComponent>,
}
