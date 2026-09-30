import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, Chip } from './kit/parts'
import { t } from '../../i18n'

// Direct messages and group chat (torncity-client/proto features_proto.gd:
// _s_chats, _s_chat). Not on the server — previews only.

const DMS = [
  { name: t('f.chats.39'), icon: 'a_wolf', palette: 'steel' as const, line: t('f.chats.40'), time: '20:14', unread: 2, online: true },
  { name: t('f.casino.22'), icon: 'eagle', palette: 'sapphire' as const, line: t('f.chats.41'), time: '20:02', unread: 0, online: true },
  { name: t('f.chats.42'), icon: 'a_raccoon', palette: 'cream' as const, line: t('f.chats.43'), time: '18:40', unread: 0, online: true },
  { name: t('f.casino.30'), icon: 'lion', palette: 'gold' as const, line: t('f.chats.44'), time: t('f.chats.45'), unread: 1, online: false },
]

const Chats: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="m_chat" title={t('f.chats.46')} sub={t('f.chats.47')} />
    <Section title={t('f.chats.48')}>
      <TileGrid>
        <Tile icon="x_mega" palette="gold" title={t('f.chats.49')} sub={t('f.chats.50')} glow />
        <Tile icon="lion" palette="gold" title={t('f.chats.51')} sub={t('f.chats.52')} />
        <Tile icon="study" palette="violet" title={t('f.chats.53')} sub={t('f.chats.54')} />
      </TileGrid>
    </Section>
    <Section title={t('f.chats.55')}>
      {DMS.map((d) => (
        <Row key={d.name} icon={d.icon} palette={d.palette} title={d.name} sub={d.line} online={d.online} badge={d.unread} right={d.time} />
      ))}
    </Section>
  </Scroll>
)

const Chat: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="sapphire" icon="a_wolf" title={t('f.chats.39')} sub={t('f.chats.56')} stat={{ label: t('f.chats.57'), value: t('f.chats.58') }} />
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="ft-row" style={{ alignSelf: 'flex-start', maxWidth: '80%', background: 'rgba(42,51,102,0.6)' }}>
          <div className="ft-row-body"><div className="ft-row-title">{t('f.chats.59')}</div></div>
        </div>
        <div className="ft-row" style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'rgba(30,122,106,0.5)' }}>
          <div className="ft-row-body"><div className="ft-row-title">{t('f.chats.60')}</div></div>
        </div>
        <div className="ft-row" style={{ alignSelf: 'flex-start', maxWidth: '80%', background: 'rgba(42,51,102,0.6)' }}>
          <div className="ft-row-body"><div className="ft-row-title">{t('f.chats.61')}</div></div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}><Chip text={t('f.chats.62')} color="var(--rose)" /></div>
    </Card>
    <Card>
      <div className="screen-text"><b>{t('f.chats.63')}</b><br />{t('f.chats.64')}</div>
    </Card>
    <div className="ft-row">
      <input
        style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 15, padding: 8 }}
        placeholder={t('f.chats.65')}
        disabled
      />
    </div>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { chats: Chats, chat: Chat } as Record<string, ScreenComponent> }
