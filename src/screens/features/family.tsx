import type { ScreenComponent } from '../types'
import {
  Scroll, Card, Hero, ComingSoonBanner, Section, Row, TileGrid, Tile,
  ChipRow, Chip, StatBar, SoonBtn, BtnRow,
} from './kit/parts'
import { t } from '../../i18n'

// Marriage, children and divorce (torncity-client/proto screens_proto.gd:
// _s_family, _s_proposal, _s_child, _s_divorce, _s_wedding). None of these
// exist on the server yet (no family.*/marriage.* command in
// configs/actions.yml) — previews only, sample content, every action inert.

const KIDS = [
  { name: t('f.family.173'), icon: 'a_foxkid', palette: 'fox' as const, age: 9, note: t('f.family.174'), needs: [0.82, 0.64, 0.71], heir: '' },
  { name: t('f.family.175'), icon: 'a_rabbit', palette: 'cream' as const, age: 3, note: '', needs: [0.9, 0.7, 0], heir: t('f.family.176') },
  { name: t('f.family.177'), icon: 'f_baby', palette: 'amber' as const, age: 0, note: t('f.family.178'), needs: [0.95, 0.6, 0], heir: t('f.family.176') },
]

const Family: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_rings" title={t('f.family.179')} sub={t('f.family.180')} />
    <Card>
      <StatBar label={t('f.chats.57')} value="78%" fraction={0.78} color="var(--rose)" />
      <div style={{ height: 10 }} />
      <ChipRow>
        <Chip text={t('f.family.181')} color="var(--leaf)" />
        <Chip text={t('f.family.182')} color="var(--saffron)" />
        <Chip text={t('f.family.183')} color="var(--lapis)" />
      </ChipRow>
    </Card>
    <TileGrid>
      <Tile icon="f_rose" palette="ruby" title={t('f.dating.148')} />
      <Tile icon="f_letter" palette="fox" title={t('f.family.184')} />
      <Tile icon="bank" palette="sapphire" title={t('f.family.185')} />
      <Tile icon="f_house" palette="amber" title={t('f.family.186')} />
    </TileGrid>
    <Section title={t('f.family.187')}>
      <TileGrid>
        {KIDS.map((k) => (
          <div className="ft-card" key={k.name} style={{ flex: '1 1 calc(50% - 5px)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div className="ft-plate" style={{ width: 72, height: 72 }}>
              <span className="icon" />
            </div>
            <div className="display" style={{ fontSize: 18 }}>{k.name}</div>
            <div className="ft-tile-sub">{k.age > 0 ? t('f.family.188', { p0: k.age }) : t('f.family.177')}{k.note && `  –  ${k.note}`}</div>
            {k.heir && <Chip text={k.heir} color="var(--anar)" />}
          </div>
        ))}
      </TileGrid>
    </Section>
    <BtnRow>
      <SoonBtn kind="green">{t('f.family.189')}</SoonBtn>
      <SoonBtn kind="steel" icon="f_broken">{t('f.family.190')}</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Proposal: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="rose" icon="f_heartplus" title={t('f.family.191')} sub={t('f.family.192')} stat={{ label: t('f.family.193'), value: t('f.family.194') }} />
    <Card><div className="screen-text">{t('f.family.195')}</div></Card>
    <Section title={t('f.family.196')}>
      <TileGrid>
        <Tile icon="f_diamond" palette="steel" title={t('f.family.197')} sub={t('f.family.198')} />
        <Tile icon="f_diamond" palette="gold" title={t('f.family.199')} sub={t('f.family.200')} glow />
        <Tile icon="f_diamond" palette="sapphire" title={t('f.family.201')} sub={t('f.family.202')} />
      </TileGrid>
    </Section>
    <Section title={t('f.family.203')}>
      <Row icon="coins" palette="gold" title={t('f.family.204')} sub={t('f.family.205')} />
    </Section>
    <Card>
      <div className="screen-text">{t('f.family.206')}</div>
    </Card>
    <SoonBtn>{t('f.family.207')}</SoonBtn>
  </Scroll>
)

const Child: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="saffron" icon="f_baby" title={t('f.family.173')} sub={t('f.family.208')} stat={{ label: t('f.family.209'), value: t('f.family.210') }} />
    <Card>
      <ChipRow>
        <Chip text={t('f.family.211')} color="var(--gold)" />
        <Chip text={t('f.family.174')} color="var(--lapis)" />
      </ChipRow>
    </Card>
    <Section title={t('f.family.212')}>
      <StatBar label={t('f.family.213')} value="82%" fraction={0.82} color="var(--leaf)" />
      <StatBar label={t('f.family.214')} value="64%" fraction={0.64} color="var(--saffron)" />
      <StatBar label={t('f.family.215')} value="71%" fraction={0.71} color="var(--lapis)" />
    </Section>
    <Section title={t('f.family.216')}>
      <Row icon="f_school" palette="sapphire" title={t('f.family.217')} sub={t('f.family.218')} right={<Chip text={t('f.family.219')} color="var(--steel)" />} />
      <Row icon="f_slide" palette="emerald" title={t('f.family.220')} sub={t('f.family.221')} />
      <Row icon="f_grad" palette="violet" title={t('f.family.222')} sub={t('f.family.223')} />
    </Section>
  </Scroll>
)

const Divorce: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner />
    <Hero tint="ruby" icon="f_broken" title={t('f.family.224')} sub={t('f.family.225')} />
    <Card><div className="screen-text">{t('f.family.226')}</div></Card>
    <Section title={t('f.family.227')}>
      <Row icon="bank" palette="sapphire" title={t('f.family.185')} sub={t('f.family.228')} right="12,000" rightColor="#8fb0ff" />
      <Row icon="f_house" palette="amber" title={t('f.family.229')} sub={t('f.family.230')} />
      <ChipRow>
        <Chip text={t('f.family.231')} color="var(--steel)" />
        <Chip text={t('f.family.232')} color="var(--steel)" />
        <Chip text={t('f.family.233')} color="var(--leaf)" />
      </ChipRow>
      <Row icon="coins" palette="gold" title={t('f.family.203')} sub={t('f.family.234')} right="1,000" rightColor="var(--anar)" />
    </Section>
    <Section title={t('f.family.235')}>
      {KIDS.map((k) => (
        <Row key={k.name} icon={k.icon} palette={k.palette} title={k.name} sub={k.age > 0 ? t('f.family.188', { p0: k.age }) : t('f.family.177')} right={<Chip text={t('f.casino.24')} color="var(--leaf)" />} />
      ))}
    </Section>
    <BtnRow>
      <SoonBtn kind="blue">{t('f.family.236')}</SoonBtn>
      <SoonBtn kind="red">{t('f.family.237')}</SoonBtn>
    </BtnRow>
  </Scroll>
)

const Wedding: ScreenComponent = () => (
  <Scroll>
    <ComingSoonBanner note={t('f.family.238')} />
    <Hero tint="rose" icon="f_rings" title={t('f.family.239')} sub={t('f.family.240')} />
    <Section title={t('f.family.241')}>
      <TileGrid>
        <Tile icon="f_house" palette="amber" title={t('f.family.182')} />
        <Tile icon="f_hearts" palette="ruby" title={t('f.family.242')} />
        <Tile icon="bank" palette="sapphire" title={t('f.family.185')} />
      </TileGrid>
    </Section>
    <SoonBtn>{t('f.family.243')}</SoonBtn>
  </Scroll>
)

export default {
  SERVER: {},
  LOCAL: {} as Record<string, ScreenComponent>,
}
