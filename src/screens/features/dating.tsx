import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, Ladder, LockedRow, SoonBtn, BtnRow,
} from './kit/parts'
import { RELATIONSHIP_LADDER } from './kit/theme'
import { t } from '../../i18n'

// Meeting, courting and dating (torncity-client/proto features/screens_proto:
// _s_meet, _s_relationship, _s_date). Not on the server — previews only.

const PEOPLE = [
  { name: t('f.chats.39'), icon: 'a_wolf', palette: 'steel' as const, line: t('f.dating.130'), tag: t('f.dating.131'), state: 'known' },
  { name: t('f.chats.42'), icon: 'a_raccoon', palette: 'cream' as const, line: t('f.dating.132'), tag: t('f.dating.133'), state: 'new' },
  { name: t('f.casino.30'), icon: 'lion', palette: 'gold' as const, line: t('f.dating.134'), tag: '', state: 'pending' },
  { name: t('f.casino.22'), icon: 'eagle', palette: 'sapphire' as const, line: t('f.dating.135'), tag: t('f.dating.136'), state: 'new' },
]

const Meet: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_heartplus" title={t('f.dating.137')} sub={t('f.dating.138')} />
    <Card>
      <Row icon="walk" palette="steel" title={t('f.dating.139')} sub={t('f.dating.140')} right={t('f.dating.141')} />
    </Card>
    <Section title={t('f.dating.142')}>
      {PEOPLE.map((p) => (
        <Row
          key={p.name}
          icon={p.icon}
          palette={p.palette}
          title={p.name}
          sub={p.line}
          right={p.tag ? <Chip text={p.tag} color="var(--violet)" /> : (p.state === 'pending' ? t('f.dating.143') : t('f.dating.144'))}
        />
      ))}
    </Section>
    <SoonBtn>{t('f.dating.144')}</SoonBtn>
  </Scroll>
)

const Relationship: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_hearts" title={t('f.chats.39')} sub={t('f.dating.145')} />
    <Card>
      <div className="display" style={{ textAlign: 'center', fontSize: 26, marginBottom: 10 }}>{RELATIONSHIP_LADDER[3]}</div>
      <Ladder steps={RELATIONSHIP_LADDER} at={3} />
      <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--rose)', fontSize: 13 }}>{t('f.dating.146')}</div>
    </Card>
    <TileGrid>
      <Tile icon="m_chat" palette="sapphire" title="34" sub={t('f.dating.147')} />
      <Tile icon="f_rose" palette="ruby" title="3" sub={t('f.dating.148')} />
      <Tile icon="m_coffee" palette="amber" title="2" sub={t('f.dating.149')} />
    </TileGrid>
    <BtnRow>
      <SoonBtn kind="blue" icon="m_chat">{t('f.dating.147')}</SoonBtn>
      <SoonBtn kind="steel" icon="f_rose">{t('f.dating.148')}</SoonBtn>
      <SoonBtn kind="gold" icon="m_coffee">{t('f.dating.149')}</SoonBtn>
    </BtnRow>
    <Section title={t('f.dating.150')}>
      <LockedRow ok text={t('f.dating.151')} />
      <LockedRow ok text={t('f.dating.152')} />
      <LockedRow ok text={t('f.dating.153')} />
      <LockedRow ok={false} text={t('f.dating.154')} />
    </Section>
  </Scroll>
)

const Date_: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="m_meal" title={t('f.dating.155')} sub={t('f.dating.156')} stat={{ label: t('f.dating.157'), value: t('f.chats.58') }} />
    <Section title={t('f.dating.158')}>
      <TileGrid>
        <Tile icon="m_coffee" palette="amber" title={t('f.dating.159')} sub={t('f.dating.160')} />
        <Tile icon="m_meal" palette="gold" title={t('f.dating.161')} sub={t('f.dating.162')} glow />
        <Tile icon="m_popcorn" palette="ruby" title={t('f.dating.163')} sub={t('f.dating.164')} />
        <Tile icon="m_bench" palette="emerald" title={t('f.dating.165')} sub={t('f.dating.166')} />
      </TileGrid>
    </Section>
    <Section title={t('f.dating.167')}>
      <ChipRow>
        <Chip text={t('f.dating.168')} color="var(--steel)" />
        <Chip text={t('f.dating.169')} color="var(--rose)" />
        <Chip text={t('f.dating.170')} color="var(--steel)" />
      </ChipRow>
    </Section>
    <Card><div className="screen-text">{t('f.dating.171')}</div></Card>
    <SoonBtn>{t('f.dating.172')}</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: { meet: Meet, relationship: Relationship, date: Date_ } as Record<string, ScreenComponent>,
}
