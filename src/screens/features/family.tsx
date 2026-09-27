import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, StatBar, SoonBtn, BtnRow,
} from './kit/parts'

// Marriage, children and divorce (torncity-client/proto screens_proto.gd:
// _s_family, _s_proposal, _s_child, _s_divorce, _s_wedding). None of these
// exist on the server yet (no family.*/marriage.* command in
// configs/actions.yml) — previews only, sample content, every action inert.

const KIDS = [
  { name: 'نیلا', icon: 'a_foxkid', palette: 'fox' as const, age: 9, note: 'کلاس سوم', needs: [0.82, 0.64, 0.71], heir: '' },
  { name: 'کیان', icon: 'a_rabbit', palette: 'cream' as const, age: 3, note: '', needs: [0.9, 0.7, 0], heir: 'نیازمند مراقبت' },
  { name: 'نوزاد', icon: 'f_baby', palette: 'amber' as const, age: 0, note: '12 روزه', needs: [0.95, 0.6, 0], heir: 'نیازمند مراقبت' },
]

const Family: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_rings" title="خانواده" sub="سارا و آرش  ·  متأهل از 42 روز پیش" />
    <Card>
      <StatBar label="صمیمیت" value="78%" fraction={0.78} color="var(--rose)" />
      <div style={{ height: 10 }} />
      <ChipRow>
        <Chip text="+10% شادی" color="var(--leaf)" />
        <Chip text="خانه‌ی مشترک" color="var(--saffron)" />
        <Chip text="حساب مشترک 24,000" color="var(--lapis)" />
      </ChipRow>
    </Card>
    <TileGrid>
      <Tile icon="f_rose" palette="ruby" title="هدیه" />
      <Tile icon="f_letter" palette="fox" title="قرار عاشقانه" />
      <Tile icon="bank" palette="sapphire" title="حساب مشترک" />
      <Tile icon="f_house" palette="amber" title="خانه" />
    </TileGrid>
    <Section title="فرزندان  ·  ظرفیت خانه: 3 از 4">
      <TileGrid>
        {KIDS.map((k) => (
          <div className="ft-card" key={k.name} style={{ flex: '1 1 calc(50% - 5px)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div className="ft-plate" style={{ width: 72, height: 72 }}>
              <span className="icon" />
            </div>
            <div className="display" style={{ fontSize: 18 }}>{k.name}</div>
            <div className="ft-tile-sub">{k.age > 0 ? `${k.age} سال` : 'نوزاد'}{k.note && `  ·  ${k.note}`}</div>
            {k.heir && <Chip text={k.heir} color="var(--anar)" />}
          </div>
        ))}
      </TileGrid>
    </Section>
    <BtnRow>
      <SoonBtn kind="green">بچه‌دار شدن</SoonBtn>
      <SoonBtn kind="steel" icon="f_broken">طلاق</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Proposal: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_heartplus" title="خواستگاری از آرش" sub="سطح 9  ·  مهندس ارشد  ·  فنویک" stat={{ label: 'وضعیت', value: 'مجرد' }} />
    <Card><div className="screen-text">آشنایی: 12 روز  ·  34 پیام  ·  2 قرار</div></Card>
    <Section title="انگشتر">
      <TileGrid>
        <Tile icon="f_diamond" palette="steel" title="نقره" sub="500 نیل  ·  +5 صمیمیت" />
        <Tile icon="f_diamond" palette="gold" title="طلا" sub="2,500 نیل  ·  +15 صمیمیت" glow />
        <Tile icon="f_diamond" palette="sapphire" title="الماس" sub="12,000 نیل  ·  +40 صمیمیت" />
      </TileGrid>
    </Section>
    <Section title="مهریه">
      <Row icon="coins" palette="gold" title="1,000 نیل" sub="اگر همسر در طلاق بخواهد، پرداخت می‌شود" />
    </Section>
    <Card>
      <div className="screen-text">«از روزی که در بازار آزور دیدمت، هر روزم بهتر شده. با من ازدواج می‌کنی؟»</div>
    </Card>
    <SoonBtn>خواستگاری  ·  2,500 نیل</SoonBtn>
  </Scroll>
)

const Child: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="f_baby" title="نیلا" sub="9 سال  ·  فرزند سارا و آرش" stat={{ label: 'تولد بعدی', value: '4 روز' }} />
    <Card>
      <ChipRow>
        <Chip text="وارث اول" color="var(--gold)" />
        <Chip text="کلاس سوم" color="var(--lapis)" />
      </ChipRow>
    </Card>
    <Section title="حال نیلا">
      <StatBar label="سلامت" value="82%" fraction={0.82} color="var(--leaf)" />
      <StatBar label="شادی" value="64%" fraction={0.64} color="var(--saffron)" />
      <StatBar label="تحصیل" value="71%" fraction={0.71} color="var(--lapis)" />
    </Section>
    <Section title="کارها">
      <Row icon="f_school" palette="sapphire" title="مدرسه" sub="هر روز  ·  120 نیل  ·  تحصیل +" right={<Chip text="ثبت‌نام شده" color="var(--steel)" />} />
      <Row icon="f_slide" palette="emerald" title="بازی در پارک" sub="شادی +15  ·  1 انرژی" />
      <Row icon="f_grad" palette="violet" title="کلاس زبان" sub="تحصیل +10  ·  300 نیل" />
    </Section>
  </Scroll>
)

const Divorce: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="f_broken" title="جدایی از آرش" sub="42 روز ازدواج  ·  صمیمیت 18%" />
    <Card><div className="screen-text">پس از درخواست، 3 روز مهلت آشتی هست. اگر هیچ‌کدام پس نگیرید، طلاق ثبت می‌شود.</div></Card>
    <Section title="تقسیم دارایی">
      <Row icon="bank" palette="sapphire" title="حساب مشترک" sub="24,000 نیل  ·  نصف به نصف" right="12,000" rightColor="#8fb0ff" />
      <Row icon="f_house" palette="amber" title="خانه‌ی خانوادگی" sub="ارزش 180,000 نیل" />
      <ChipRow>
        <Chip text="به سارا" color="var(--steel)" />
        <Chip text="به آرش" color="var(--steel)" />
        <Chip text="فروش و تقسیم" color="var(--leaf)" />
      </ChipRow>
      <Row icon="coins" palette="gold" title="مهریه" sub="آرش خواسته پرداخت شود" right="1,000" rightColor="var(--anar)" />
    </Section>
    <Section title="حضانت فرزندان">
      {KIDS.map((k) => (
        <Row key={k.name} icon={k.icon} palette={k.palette} title={k.name} sub={k.age > 0 ? `${k.age} سال` : 'نوزاد'} right={<Chip text="سارا" color="var(--leaf)" />} />
      ))}
    </Section>
    <BtnRow>
      <SoonBtn kind="blue">مشاوره‌ی خانواده</SoonBtn>
      <SoonBtn kind="red">درخواست طلاق</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Wedding: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note="مراسم ازدواج هنوز در بازی فعال نیست؛ این‌طور جشن گرفته می‌شود." />
    <Hero tint="rose" icon="f_rings" title="مبارک باشد!" sub="سارا و آرش ازدواج کردند" />
    <Section title="جایزه‌های عروسی">
      <TileGrid>
        <Tile icon="f_house" palette="amber" title="خانه‌ی مشترک" />
        <Tile icon="f_hearts" palette="ruby" title="شادی +20" />
        <Tile icon="bank" palette="sapphire" title="حساب مشترک" />
      </TileGrid>
    </Section>
    <SoonBtn>به خانه برویم</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { family: Family, proposal: Proposal, child: Child, divorce: Divorce, wedding: Wedding } as Record<string, ScreenComponent>,
}
