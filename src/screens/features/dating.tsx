import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, Ladder, LockedRow, SoonBtn, BtnRow,
} from './kit/parts'
import { RELATIONSHIP_LADDER } from './kit/theme'

// Meeting, courting and dating (torncity-client/proto features/screens_proto:
// _s_meet, _s_relationship, _s_date). Not on the server — previews only.

const PEOPLE = [
  { name: 'آرش', icon: 'a_wolf', palette: 'steel' as const, line: 'سطح 9  ·  مهندس ارشد', tag: 'هم‌کلاس اقتصاد', state: 'known' },
  { name: 'مهتاب', icon: 'a_raccoon', palette: 'cream' as const, line: 'سطح 6  ·  پرستار', tag: 'هم‌جناح', state: 'new' },
  { name: 'بردیا', icon: 'lion', palette: 'gold' as const, line: 'سطح 12  ·  وکیل', tag: '', state: 'pending' },
  { name: 'نگار', icon: 'eagle', palette: 'sapphire' as const, line: 'سطح 4  ·  دانشجو', tag: 'تازه‌وارد', state: 'new' },
]

const Meet: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_heartplus" title="آشنایی" sub="فقط کسانی که این را روشن کرده‌اند دیده می‌شوند" />
    <Card>
      <Row icon="walk" palette="steel" title="مرکز شهر فنویک" sub="14 نفر پذیرای آشنایی" right="سلام امروز: 3 از 5" />
    </Card>
    <Section title="این‌جا">
      {PEOPLE.map((p) => (
        <Row
          key={p.name}
          icon={p.icon}
          palette={p.palette}
          title={p.name}
          sub={p.line}
          right={p.tag ? <Chip text={p.tag} color="var(--violet)" /> : (p.state === 'pending' ? 'منتظر پاسخ' : 'سلام بده')}
        />
      ))}
    </Section>
    <SoonBtn>سلام بده</SoonBtn>
  </Scroll>
)

const Relationship: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_hearts" title="آرش" sub="12 روز آشنایی  ·  از کلاس اقتصاد" />
    <Card>
      <div className="display" style={{ textAlign: 'center', fontSize: 26, marginBottom: 10 }}>{RELATIONSHIP_LADDER[3]}</div>
      <Ladder steps={RELATIONSHIP_LADDER} at={3} />
      <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--rose)', fontSize: 13 }}>تا «دلداده»: 64%</div>
    </Card>
    <TileGrid>
      <Tile icon="m_chat" palette="sapphire" title="34" sub="پیام" />
      <Tile icon="f_rose" palette="ruby" title="3" sub="هدیه" />
      <Tile icon="m_coffee" palette="amber" title="2" sub="قرار" />
    </TileGrid>
    <BtnRow>
      <SoonBtn kind="blue" icon="m_chat">پیام</SoonBtn>
      <SoonBtn kind="steel" icon="f_rose">هدیه</SoonBtn>
      <SoonBtn kind="gold" icon="m_coffee">قرار</SoonBtn>
    </BtnRow>
    <Section title="خواستگاری">
      <LockedRow ok text="هر دو مجرد" />
      <LockedRow ok text="دست‌کم 7 روز آشنایی (12 روز)" />
      <LockedRow ok text="هر دو سطح 5 یا بالاتر" />
      <LockedRow ok={false} text="رابطه در «دلداده» (الان: صمیمی)" />
    </Section>
  </Scroll>
)

const Date_: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="m_meal" title="دعوت از آرش" sub="هر دو در فنویک هستید" stat={{ label: 'وضعیت رابطه', value: 'صمیمی' }} />
    <Section title="کجا؟">
      <TileGrid>
        <Tile icon="m_coffee" palette="amber" title="کافه" sub="200 ساپ  ·  1 انرژی  ·  صمیمیت +6" />
        <Tile icon="m_meal" palette="gold" title="رستوران" sub="800 ساپ  ·  1 انرژی  ·  صمیمیت +12" glow />
        <Tile icon="m_popcorn" palette="ruby" title="سینما" sub="400 ساپ  ·  2 انرژی  ·  صمیمیت +9" />
        <Tile icon="m_bench" palette="emerald" title="پارک" sub="رایگان  ·  2 انرژی  ·  صمیمیت +4" />
      </TileGrid>
    </Section>
    <Section title="کی؟">
      <ChipRow>
        <Chip text="الان" color="var(--steel)" />
        <Chip text="امشب 20:00" color="var(--rose)" />
        <Chip text="فردا" color="var(--steel)" />
      </ChipRow>
    </Section>
    <Card><div className="screen-text">آرش باید دعوت را بپذیرد  ·  هزینه با دعوت‌کننده  ·  روزی یک قرار</div></Card>
    <SoonBtn>فرستادن دعوت  ·  800 ساپ</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { meet: Meet, relationship: Relationship, date: Date_ } as Record<string, ScreenComponent>,
}
