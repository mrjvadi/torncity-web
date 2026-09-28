import type { ScreenProps } from '../types'
import { Card, Header, ListRow, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'

interface Named { code?: string; name?: string; emoji?: string }
interface Needs { hunger?: number; sleep?: number; stress?: number; happiness?: number }
interface Worth { cash?: number; bank?: number; property?: number; goods?: number; debts?: number; savings?: number; gold?: number; loans?: number; total?: number }
interface SleepSpot { spot?: Named; place?: Named; price?: number; rest?: number; relief?: number }
interface LifeView {
  needs?: Needs; age?: number; stage?: Named
  rank?: Named | null; next?: Named | null; next_need?: number
  worth?: Worth
  spots?: SleepSpot[] | null; sleep_in_seconds?: number; home?: boolean
  notice?: string
}

export default function Life({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as LifeView
  if (loading && !response) return <ScreenScroll><Header title="زندگی" tone="violet" /></ScreenScroll>

  const needs = v.needs
  const items: { key: keyof Needs; label: string; color: string; icon: string }[] = [
    { key: 'sleep', label: 'خواب', color: 'var(--violet)', icon: 'moon' },
    { key: 'hunger', label: 'گرسنگی', color: 'var(--saffron)', icon: 'bread' },
    { key: 'happiness', label: 'شادی', color: 'var(--leaf)', icon: 'sun' },
    { key: 'stress', label: 'استرس', color: 'var(--anar)', icon: 'x_flame' },
  ]

  return (
    <ScreenScroll>
      <Header title="زندگی" tone="violet" onRefresh={() => run('life.me')} />

      {v.notice && <Notice>{v.notice}</Notice>}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="nx-chip nx-chip-gold">{v.stage?.name ?? '—'} · {formatNumber(v.age ?? 0)} ساله</span>
          {v.rank?.name && <span className="nx-chip">{v.rank.emoji} {v.rank.name}</span>}
        </div>
        {needs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {items.filter((i) => needs[i.key] !== undefined).map((i) => (
              <div key={i.key} className="nx-bar-wrap">
                <div className="nx-bar" style={{ borderColor: i.color, height: 22 }}>
                  <div className="nx-bar-fill" style={{ width: `${clamp01((needs[i.key] as number) / 100) * 100}%`, background: i.color }} />
                  <span className="nx-bar-label display" style={{ lineHeight: '18px', fontSize: 12 }}>{i.label} {formatNumber(needs[i.key] as number)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {v.worth && (
        <>
          <Stat icon="crowncoin" palette="gold" label="ارزش خالص" value={money(v.worth.total)} />
          <StatPair
            left={<Stat icon="coins" palette="gold" label="نقد + بانک" value={money((v.worth.cash ?? 0) + (v.worth.bank ?? 0))} />}
            right={<Stat icon="house" palette="emerald" label="ملک" value={money(v.worth.property)} />}
          />
        </>
      )}

      {!!(v.spots && v.spots.length) && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>جای خواب</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.spots!.map((s, i) => (
              <ListRow key={i} icon="bed" palette="violet" title={s.spot?.name ?? '—'}
                sub={`${s.place?.name ?? ''} · +${formatNumber(s.rest ?? 0)} انرژی${s.price ? ` · ${money(s.price)}` : ''}`} />
            ))}
          </div>
          {!!v.sleep_in_seconds && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>دوباره می‌توانی بخوابی: {hms(v.sleep_in_seconds)} دیگر</div>}
        </Card>
      )}

      <Actions response={response} onAction={onAction} refreshCommand="life.me" />
    </ScreenScroll>
  )
}
