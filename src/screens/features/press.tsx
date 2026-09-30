import type { ScreenComponent } from '../types'
import { Scroll, Hero, ComingSoonBanner, Section, Row, ChipRow, Chip, SoonBtn } from './kit/parts'

// The city's newspaper and inviting friends (torncity-client/proto
// features_proto.gd: _s_news, _s_invite). Not on the server — previews.

const News: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <div className="ft-newspaper" style={{ textAlign: 'center' }}>
      <div className="display" style={{ fontSize: 30 }}>فنویک امروز</div>
      <div style={{ fontSize: 13, marginTop: 6, borderTop: '1px solid #8a6a3a', paddingTop: 8 }}>یکشنبه 12 مهر  ·  شماره‌ی 214  ·  روز 3 جنگ</div>
    </div>
    <ChipRow>
      {['همه', 'جنگ', 'سیاست', 'اقتصاد', 'جامعه', 'جرم'].map((c, i) => (
        <Chip key={c} text={c} color={i === 0 ? '#8a6a3a' : 'var(--steel)'} />
      ))}
    </ChipRow>
    <div className="ft-newspaper">
      <Chip text="جنگ" color="var(--anar)" />
      <div className="display" style={{ fontSize: 21, marginTop: 8 }}>موشک‌های فنویک پایگاه هوایی کالدریس را هدف گرفتند</div>
      <div style={{ fontSize: 14, marginTop: 8, color: '#4a3a20' }}>ستاد کل: 7 موشک از پدافند گذشت و باند فرودگاه آسیب سنگین دید. کالدریس هنوز واکنشی نشان نداده است.</div>
      <div style={{ fontSize: 12, marginTop: 8, color: '#6a5a40' }}>12 دقیقه پیش</div>
    </div>
    <Section title="بقیه‌ی روزنامه">
      <Row icon="vote" palette="violet" title="آرش کمالی با 54% رأی شهردار فنویک شد" sub="سیاست" right="1 ساعت" />
      <Row icon="chart" palette="emerald" title="سهام صنایع آراز امروز 12% بالا رفت" sub="اقتصاد" right="2 ساعت" />
      <Row icon="f_rings" palette="gold" title="سارا و آرش در تالار آزور ازدواج کردند" sub="جامعه" right="3 ساعت" />
      <Row icon="handcuffs" palette="steel" title="سرقت از بانک مرکزی؛ 3 نفر در زندان" sub="جرم" right="5 ساعت" />
      <Row icon="gavel" palette="steel" title="لایحه‌ی مالیات بازار با 31 رأی تصویب شد" sub="مجلس" right="دیروز" />
    </Section>
  </Scroll>
)

const STEPS = [
  { n: 1, icon: 'coins', reward: '1,000 ساپ', done: true },
  { n: 3, icon: 'x_chest', reward: 'صندوق طلایی', done: true },
  { n: 5, icon: 'x_crown', reward: 'قاب ویژه', done: false },
  { n: 10, icon: 'x_car', reward: 'ماشین مسابقه', done: false },
  { n: 25, icon: 'x_laurel', reward: 'لقب «سفیر»', done: false },
]

const Invite: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="x_present" title="دوستانت را بیاور" sub="وقتی دوستت به سطح 5 برسد، هر دو جایزه می‌گیرید." />
    <Row icon="m_search" palette="steel" title="t.me/torncity_bot?start=ref_S4R4" />
    <SoonBtn kind="blue" icon="x_send">اشتراک در تلگرام</SoonBtn>
    <Section title="جایزه‌های دعوت  ·  4 نفر">
      <ChipRow>
        {STEPS.map((s) => <Chip key={s.n} text={`${s.n}  ·  ${s.reward}`} color={s.done ? 'var(--lapis)' : 'var(--steel)'} />)}
      </ChipRow>
    </Section>
    <Section title="دعوت‌شده‌ها">
      <Row icon="eagle" palette="sapphire" title="نگار" sub="به سطح 5 رسید  ·  جایزه گرفتید" right="✓" rightColor="var(--leaf)" />
      <Row icon="a_foxkid" palette="fox" title="سینا" sub="سطح 3 از 5" />
      <Row icon="a_raccoon" palette="cream" title="دنیا" sub="سطح 1 از 5" />
    </Section>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { news: News, invite: Invite } as Record<string, ScreenComponent> }
