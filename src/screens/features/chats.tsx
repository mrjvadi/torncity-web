import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, Chip } from './kit/parts'

// Direct messages and group chat (torncity-client/proto features_proto.gd:
// _s_chats, _s_chat). Not on the server — previews only.

const DMS = [
  { name: 'آرش', icon: 'a_wolf', palette: 'steel' as const, line: 'امشب ساعت 8 رستوران؟', time: '20:14', unread: 2, online: true },
  { name: 'نگار', icon: 'eagle', palette: 'sapphire' as const, line: 'در حال نوشتن…', time: '20:02', unread: 0, online: true },
  { name: 'مهتاب', icon: 'a_raccoon', palette: 'cream' as const, line: 'مرسی بابت کمک توی بیمارستان', time: '18:40', unread: 0, online: true },
  { name: 'بردیا', icon: 'lion', palette: 'gold' as const, line: 'قرارداد رو امضا کردی؟', time: 'دیروز', unread: 1, online: false },
]

const Chats: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="m_chat" title="گفتگوها" sub="جستجوی بازیکن یا گروه…" />
    <Section title="کانال‌ها">
      <TileGrid>
        <Tile icon="x_mega" palette="gold" title="شهر فنویک" sub="1,240 آنلاین" glow />
        <Tile icon="lion" palette="gold" title="شیرهای البرز" sub="جناح  ·  38 عضو" />
        <Tile icon="study" palette="violet" title="کلاس اقتصاد" sub="همکلاسی‌ها" />
      </TileGrid>
    </Section>
    <Section title="پیام‌های خصوصی">
      {DMS.map((d) => (
        <Row key={d.name} icon={d.icon} palette={d.palette} title={d.name} sub={d.line} online={d.online} badge={d.unread} right={d.time} />
      ))}
    </Section>
  </Scroll>
)

const Chat: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="a_wolf" title="آرش" sub="آنلاین  ·  در مرکز شهر" stat={{ label: 'صمیمیت', value: 'صمیمی' }} />
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="ft-row" style={{ alignSelf: 'flex-start', maxWidth: '80%', background: 'rgba(42,51,102,0.6)' }}>
          <div className="ft-row-body"><div className="ft-row-title">سلام! امروز کلاس اقتصاد خیلی خوب بود</div></div>
        </div>
        <div className="ft-row" style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'rgba(30,122,106,0.5)' }}>
          <div className="ft-row-body"><div className="ft-row-title">آره، مخصوصاً بحث بورس. سهم آراز رو خریدی؟</div></div>
        </div>
        <div className="ft-row" style={{ alignSelf: 'flex-start', maxWidth: '80%', background: 'rgba(42,51,102,0.6)' }}>
          <div className="ft-row-body"><div className="ft-row-title">هنوز نه، منتظرم عرضه‌ی اولیه تموم بشه</div></div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}><Chip text="آرش یک شاخه گل رز فرستاد  ·  صمیمیت +3" color="var(--rose)" /></div>
    </Card>
    <Card>
      <div className="screen-text"><b>دعوت به قرار</b><br />رستوران  ·  امشب 20:00  ·  صمیمیت +12</div>
    </Card>
    <div className="ft-row">
      <input
        style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 15, padding: 8 }}
        placeholder="پیام بنویسید…"
        disabled
      />
    </div>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { chats: Chats, chat: Chat } as Record<string, ScreenComponent> }
