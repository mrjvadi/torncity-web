import type { ScreenProps } from '../types'
import { Card, Header, Notice, ScreenScroll, Stat, StatPair } from './kit/Parts'
import Actions from './kit/Actions'
import { clamp01, formatNumber, hms, money } from './kit/format'
import Icon from '../../ui/Icon'

interface ProfileView {
  name?: string; code?: string; avatar?: string; city?: string
  place?: { name?: string }
  level?: number; xp?: number; next_level_xp?: number
  cash?: number; bank?: number
  rank?: { name?: string; emoji?: string }
  age?: number; stage?: { name?: string }
  achievements?: number
  needs?: { hunger?: number; sleep?: number; stress?: number; happiness?: number }
  jail?: { city?: string; remaining_seconds?: number } | null
  hospital?: { city?: string; remaining_seconds?: number } | null
}

export default function Profile({ response, loading, onAction, run }: ScreenProps) {
  const v = (response?.view ?? {}) as ProfileView
  if (loading && !response) return <ScreenScroll><Header title="پروفایل" tone="violet" /></ScreenScroll>

  const xpFrac = v.next_level_xp ? clamp01((v.xp ?? 0) / v.next_level_xp) : 0
  const needs = v.needs

  return (
    <ScreenScroll>
      <Header title="پروفایل" tone="violet" onRefresh={() => run('player.profile.get')} />

      <Card tone="violet">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 22, color: '#fff' }}>{v.name ?? '…'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
              {[v.rank?.name, v.stage?.name && v.age ? `${v.age} ساله` : null].filter(Boolean).join(' · ')}
            </div>
            <div className="nx-bar-wrap" style={{ marginTop: 6 }}>
              <div className="nx-bar" style={{ borderColor: 'var(--firouzeh)', height: 22 }}>
                <div className="nx-bar-fill" style={{ width: `${xpFrac * 100}%`, background: 'var(--firouzeh)' }} />
                <span className="nx-bar-label display" style={{ lineHeight: '18px', fontSize: 13 }}>
                  <span dir="ltr">{formatNumber(v.xp ?? 0)} / {formatNumber(v.next_level_xp ?? 0)}</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span className="nx-chip nx-chip-gold">سطح {formatNumber(v.level ?? 0)}</span>
              {v.code && <span className="nx-chip">{v.code}</span>}
            </div>
          </div>
          <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'radial-gradient(circle at 40% 30%, #14655f, #0a2a27)', border: '2px solid var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon name="person" palette="teal" size={36} />
          </div>
        </div>
      </Card>

      {v.jail && (
        <Notice alert>در زندان {v.jail.city ?? ''} · {hms(v.jail.remaining_seconds)} مانده</Notice>
      )}
      {v.hospital && (
        <Notice alert>در بیمارستان {v.hospital.city ?? ''} · {hms(v.hospital.remaining_seconds)} مانده</Notice>
      )}

      <StatPair
        left={<Stat icon="coins" palette="gold" label="پول نقد" value={money(v.cash)} />}
        right={<Stat icon="bank" palette="sapphire" label="موجودی بانک" value={money(v.bank)} />}
      />
      <StatPair
        left={<Stat icon="city" palette="steel" label="شهر" value={v.city ?? '—'} />}
        right={<Stat icon="trophy" palette="gold" label="دستاوردها" value={formatNumber(v.achievements ?? 0)} />}
      />

      {needs && (
        <Card>
          <div className="nx-sec" style={{ marginBottom: 8 }}>نیازها</div>
          <NeedsGrid needs={needs} />
        </Card>
      )}

      <Actions response={response} onAction={onAction} />
    </ScreenScroll>
  )
}

function NeedsGrid({ needs }: { needs: NonNullable<ProfileView['needs']> }) {
  const items: { key: keyof typeof needs; label: string; color: string; icon: string }[] = [
    { key: 'sleep', label: 'خواب', color: 'var(--violet)', icon: 'moon' },
    { key: 'hunger', label: 'گرسنگی', color: 'var(--saffron)', icon: 'bread' },
    { key: 'happiness', label: 'شادی', color: 'var(--leaf)', icon: 'sun' },
    { key: 'stress', label: 'استرس', color: 'var(--anar)', icon: 'x_flame' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {items.filter((i) => needs[i.key] !== undefined).map((i) => (
        <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="nx-bar-wrap" style={{ flex: 1 }}>
            <div className="nx-bar" style={{ borderColor: i.color, height: 22 }}>
              <div className="nx-bar-fill" style={{ width: `${clamp01((needs[i.key] as number) / 100) * 100}%`, background: i.color }} />
              <span className="nx-bar-label display" style={{ lineHeight: '18px', fontSize: 12 }}>{formatNumber(needs[i.key] as number)}</span>
            </div>
          </div>
          <Icon name={i.icon} palette="steel" size={18} />
        </div>
      ))}
    </div>
  )
}
