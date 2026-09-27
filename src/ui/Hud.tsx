import { useMemo } from 'react'
import type { ProfileView } from '../api/types'
import { formatNumber } from '../lib/persian'
import { clockIn } from '../lib/time'
import Icon from './Icon'

interface HudProps {
  profile: ProfileView | null
  unread: number
  onBank: () => void
  onBell: () => void
  onMenu: () => void
  onAvatar: () => void
}

export default function Hud({ profile, unread, onBank, onBell, onMenu, onAvatar }: HudProps) {
  const xpFrac = useMemo(() => {
    if (!profile || !profile.next_level_xp) return 0
    return Math.min(1, profile.xp / profile.next_level_xp)
  }, [profile])

  const energyFrac = profile && profile.max_energy ? Math.min(1, profile.energy / profile.max_energy) : 0
  const healthFrac = profile && profile.max_health ? Math.min(1, profile.health / profile.max_health) : 0
  const energyFull = !!profile && profile.energy >= profile.max_energy
  const healthFull = !!profile && profile.health >= profile.max_health

  return (
    <div className="hud">
      <div className="hud-top">
        <button className="hud-avatar" onClick={onAvatar} aria-label="پروفایل">
          <svg className="hud-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" className="ring-track" />
            <circle
              cx="50" cy="50" r="44" className="ring-value"
              style={{ strokeDasharray: `${xpFrac * 276.5} 276.5` }}
            />
          </svg>
          <span className="hud-avatar-plate"><Icon name="person" palette="teal" size={40} /></span>
          <span className="hud-level display">{profile ? formatNumber(profile.level) : '–'}</span>
        </button>

        <div className="hud-id">
          <div className="hud-name display">{profile?.name ?? '…'}</div>
          <div className="hud-rank">{profile?.rank?.name ?? ''}</div>
          <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: `${xpFrac * 100}%` }} /></div>
        </div>

        <div className="hud-money">
          <button className="hud-pill hud-cash" onClick={onBank}>
            <span className="hud-pill-plus">+</span>
            <span className="hud-pill-value display">{profile ? formatNumber(profile.cash) : '–'}</span>
            <Icon name="coins" palette="gold" size={26} />
          </button>
          <button className="hud-pill hud-bank" onClick={onBank}>
            <span className="hud-pill-value display">{profile ? formatNumber(profile.bank) : '–'}</span>
            <Icon name="bank" palette="sapphire" size={22} />
          </button>
        </div>
      </div>

      <div className="hud-stat-row">
        <div className="hud-bars">
          <StatBar icon="energy" palette="amber" color="#f5a623" value={profile?.energy ?? 0} max={profile?.max_energy ?? 100} frac={energyFrac} full={energyFull} fullIn={profile?.energy_full_in_seconds ?? 0} />
          <StatBar icon="health" palette="emerald" color="#4cc47e" value={profile?.health ?? 0} max={profile?.max_health ?? 100} frac={healthFrac} full={healthFull} fullIn={0} />
        </div>

        <button className="hud-corner" onClick={onBell} aria-label="اعلان‌ها">
          <Icon name="inbox" palette="sapphire" size={26} />
          {unread > 0 && <span className="hud-count">{unread < 100 ? unread : '99+'}</span>}
        </button>
        <button className="hud-corner" onClick={onMenu} aria-label="منو">
          <Icon name="menu" palette="steel" size={26} />
        </button>
      </div>
      <HudStyles />
    </div>
  )
}

function StatBar({ icon, palette, color, value, max, frac, full, fullIn }: {
  icon: string; palette: 'emerald' | 'amber'; color: string; value: number; max: number
  frac: number; full: boolean; fullIn: number
}) {
  return (
    <div className="stat">
      <div className="stat-bar" style={{ borderColor: color }}>
        <div className="stat-fill" style={{ width: `${frac * 100}%`, background: color }} />
        <span className="stat-label display">{formatNumber(value)}/{formatNumber(max)}</span>
      </div>
      <Icon name={icon} palette={palette} size={30} className="stat-icon" />
      {!full && fullIn > 0 && <span className="stat-chip">پر {clockIn(fullIn)}</span>}
    </div>
  )
}

function HudStyles() {
  return (
    <style>{`
      .hud { position: relative; padding-top: var(--safe-t); background: linear-gradient(180deg, rgba(7,10,20,0.92), rgba(7,10,20,0.75) 70%, transparent); }
      .hud-top { display: flex; align-items: center; gap: 10px; padding: 10px 12px 4px; }
      .hud-avatar { position: relative; width: 64px; height: 64px; flex: none; }
      .hud-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 6; }
      .ring-value { fill: none; stroke: var(--firouzeh); stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.4s; }
      .hud-avatar-plate { position: absolute; inset: 7px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #14655f, #0a2a27); border: 1px solid var(--gold-soft); display: flex; align-items: center; justify-content: center; }
      .hud-level { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: linear-gradient(180deg, #3a2a8a, #1a1050); border: 1px solid var(--gold); border-radius: 8px; font-size: 15px; padding: 0 6px; color: #ffd66b; min-width: 22px; text-align: center; }
      .hud-id { flex: 1; min-width: 0; text-align: right; }
      .hud-name { font-size: 20px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hud-rank { font-size: 12px; color: var(--text-dim); margin-top: 1px; }
      .hud-xpbar { height: 7px; border-radius: 4px; background: rgba(0,0,0,0.5); margin-top: 6px; overflow: hidden; border: 1px solid rgba(43,196,178,0.4); }
      .hud-xpbar-fill { height: 100%; background: var(--firouzeh); }
      .hud-money { display: flex; flex-direction: column; gap: 6px; flex: none; }
      .hud-pill { display: flex; align-items: center; gap: 6px; background: linear-gradient(180deg, #0d1024, #05070f); border: 1px solid var(--gold-soft); border-radius: 20px; padding: 6px 10px; }
      .hud-cash { border-color: var(--gold); }
      .hud-pill-plus { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(180deg, #7ee0a0, #2f9a55); color: #fff; font-size: 15px; line-height: 20px; text-align: center; }
      .hud-pill-value { font-size: 16px; color: var(--gold); min-width: 0; }
      .hud-bank .hud-pill-value { color: #8fb0ff; font-size: 14px; }

      .hud-stat-row { display: flex; align-items: center; gap: 8px; padding: 2px 12px 10px; }
      .hud-corner { position: relative; width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #232c58, #10142b); border: 1px solid var(--gold-soft); display: flex; align-items: center; justify-content: center; flex: none; }
      .hud-count { position: absolute; top: -4px; left: -4px; background: var(--anar); color: #fff; font-size: 10px; border-radius: 8px; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; padding: 0 3px; border: 1px solid #2a0a0a; }
      .hud-bars { flex: 1; display: flex; gap: 20px; justify-content: flex-end; padding-inline-start: 8px; }
      .stat { position: relative; width: 122px; }
      .stat-bar { position: relative; height: 26px; border-radius: 13px; background: rgba(0,0,0,0.55); border: 2px solid; overflow: hidden; }
      .stat-fill { position: absolute; inset: 0; right: auto; border-radius: 13px; transition: width 0.4s; opacity: 0.85; }
      .stat-label { position: relative; z-index: 1; display: block; text-align: center; font-size: 14px; line-height: 22px; color: #fff; }
      .stat-icon { position: absolute; top: -7px; left: -6px; }
      .stat-chip { position: absolute; bottom: -16px; left: 8px; right: 8px; text-align: center; font-size: 10px; color: #ffd66b; background: rgba(0,0,0,0.6); border-radius: 6px; padding: 1px 4px; }
    `}</style>
  )
}
