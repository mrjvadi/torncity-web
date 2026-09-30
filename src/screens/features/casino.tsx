import type { ScreenComponent } from '../types'
import { Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile, StatBar, SoonBtn, BtnRow, Plate } from './kit/parts'
import { t } from '../../i18n'

// The casino, slots and street racing (torncity-client/proto features_proto:
// _s_casino, _s_slots, _s_race). Not on the server — previews only.

const Casino: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="violet" icon="coins" title={t('f.casino.1')} stat={{ label: t('f.casino.2'), value: '2,400' }}>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SoonBtn kind="gold">{t('f.casino.3')}</SoonBtn>
        <SoonBtn kind="steel">{t('f.casino.4')}</SoonBtn>
      </div>
    </Hero>
    <Card><StatBar label={t('f.casino.5')} value={t('f.casino.6')} fraction={0.24} color="var(--saffron)" /></Card>
    <TileGrid>
      <Tile icon="x_slot" palette="amber" title={t('f.casino.7')} sub={t('f.casino.8')} glow />
      <Tile icon="x_cards" palette="ruby" title={t('f.casino.9')} sub={t('f.casino.10')} />
      <Tile icon="x_dice" palette="emerald" title={t('f.casino.11')} sub={t('f.casino.12')} />
      <Tile icon="x_ticket" palette="violet" title={t('f.casino.13')} sub={t('f.casino.14')} glow />
    </TileGrid>
    <Card>
      <Row icon="x_ticket" palette="violet" title={t('f.casino.15')} sub={t('f.casino.16')} right="1,240,000" rightColor="var(--gold)" />
    </Card>
    <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
      {t('f.casino.17')}
    </div>
  </Scroll>
)

const Slots: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="violet" icon="x_slot" title={t('f.casino.18')} />
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
      <div className="display" style={{ fontSize: 22 }}>{t('f.casino.19')}</div>
    </div>
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t('f.casino.20')}</span>
        <span className="display" style={{ fontSize: 28, color: 'var(--gold)' }}>100</span>
      </div>
    </Card>
    <SoonBtn>{t('f.casino.21')}</SoonBtn>
  </Scroll>
)

const ORDER = [
  { pos: 1, name: t('f.casino.22'), car: t('f.casino.23'), gap: '—', color: '#3f7be8' },
  { pos: 2, name: t('f.casino.24'), car: t('f.casino.25'), gap: t('f.casino.26'), color: 'var(--firouzeh)' },
  { pos: 3, name: t('f.casino.27'), car: t('f.casino.28'), gap: t('f.casino.29'), color: 'var(--saffron)' },
  { pos: 4, name: t('f.casino.30'), car: t('f.casino.31'), gap: t('f.casino.32'), color: 'var(--anar)' },
]

const Race: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="x_flag" title={t('f.casino.33')} sub={t('f.casino.34')} />
    <Section title={t('f.casino.35')}>
      {ORDER.map((o) => (
        <Row key={o.pos} icon="x_car" palette="steel" title={`${o.pos}. ${o.name}`} sub={o.car} right={o.gap} rightColor={o.color} />
      ))}
    </Section>
    <Card>
      <Row icon="x_car" palette="ruby" title={t('f.casino.25')} sub={t('f.casino.36')} right={t('f.casino.37')} />
    </Card>
    <BtnRow>
      <SoonBtn kind="red" icon="x_flame">{t('f.casino.38')}</SoonBtn>
    </BtnRow>
  </Scroll>
)

export default { SERVER: {}, LOCAL: { casino: Casino, slots: Slots, race: Race } as Record<string, ScreenComponent> }
