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

  // nerve is not in every realm's profile view (client-api.md §3): only a
  // number here means the server actually sent one
  const nerve = typeof profile?.nerve === 'number' ? profile.nerve : null
  const maxNerve = typeof profile?.max_nerve === 'number' ? profile.max_nerve : null
  const nerveFullIn = typeof profile?.nerve_full_in_seconds === 'number' ? profile.nerve_full_in_seconds : 0
  const nerveFrac = nerve !== null && maxNerve ? Math.min(1, nerve / maxNerve) : 0
  const nerveFull = nerve !== null && maxNerve !== null && nerve >= maxNerve

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
          <span className="hud-avatar-plate"><Icon name="person" palette="teal" size={24} /></span>
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
            <Icon name="coins" palette="gold" size={17} />
          </button>
          <button className="hud-pill hud-bank" onClick={onBank}>
            <span className="hud-pill-value display">{profile ? formatNumber(profile.bank) : '–'}</span>
            <Icon name="bank" palette="sapphire" size={14} />
          </button>
        </div>

        <button className="hud-corner" onClick={onBell} aria-label="اعلان‌ها">
          <Icon name="inbox" palette="sapphire" size={16} />
          {unread > 0 && <span className="hud-count">{unread < 100 ? unread : '99+'}</span>}
        </button>
        <button className="hud-corner" onClick={onMenu} aria-label="منو">
          <Icon name="menu" palette="steel" size={16} />
        </button>
      </div>

      <div className="hud-stat-row">
        <div className="hud-bars">
          <StatBar icon="energy" palette="amber" color="#f5a623" value={profile?.energy ?? 0} max={profile?.max_energy ?? 100} frac={energyFrac} full={energyFull} fullIn={profile?.energy_full_in_seconds ?? 0} />
          {nerve !== null && maxNerve !== null && (
            <StatBar icon="nerve" palette="ruby" color="#e5484d" value={nerve} max={maxNerve} frac={nerveFrac} full={nerveFull} fullIn={nerveFullIn} />
          )}
          <StatBar icon="health" palette="emerald" color="#4cc47e" value={profile?.health ?? 0} max={profile?.max_health ?? 100} frac={healthFrac} full={healthFull} fullIn={0} />
        </div>
      </div>
      <HudStyles />
    </div>
  )
}

/* the value/time text lives above the bar, never on top of the fill: at
   low fractions the old inline layout put the "full at" time so close to
   the value that they crowded each other, and a value pinned to the bar's
   edge would straddle the fill/track boundary and lose contrast on
   whichever half had no color under it. A plain bar underneath has no such
   failure mode at any width or fraction. */
function StatBar({ icon, palette, color, value, max, frac, full, fullIn }: {
  icon: string; palette: 'emerald' | 'amber' | 'ruby'; color: string; value: number; max: number
  frac: number; full: boolean; fullIn: number
}) {
  return (
    <div className="stat">
      <div className="stat-head">
        <Icon name={icon} palette={palette} size={13} className="stat-icon" />
        <span className="stat-value display">{formatNumber(value)}<span className="stat-max">/{formatNumber(max)}</span></span>
        {!full && fullIn > 0 && <span className="stat-chip">{clockIn(fullIn)}</span>}
      </div>
      <div className="stat-bar" style={{ borderColor: color }}>
        <div className="stat-fill" style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function HudStyles() {
  return (
    <style>{`
      /* ~32% shorter than the first pass: the owner flagged the HUD/dock as
         too tall on a phone, especially inside Telegram's full-screen mode
         where --safe-t already eats the top for its own button bar. */
      .hud { position: relative; z-index: 5; padding-top: var(--safe-t); background: linear-gradient(180deg, rgba(7,10,20,0.92), rgba(7,10,20,0.75) 70%, transparent); }
      .hud-top { display: flex; align-items: center; gap: 6px; padding: 5px 8px 1px; }
      .hud-avatar { position: relative; width: 38px; height: 38px; flex: none; }
      .hud-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 7; }
      .ring-value { fill: none; stroke: var(--firouzeh); stroke-width: 7; stroke-linecap: round; transition: stroke-dasharray 0.4s; }
      .hud-avatar-plate { position: absolute; inset: 5px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #14655f, #0a2a27); border: 1px solid var(--gold-soft); display: flex; align-items: center; justify-content: center; }
      .hud-level { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: linear-gradient(180deg, #3a2a8a, #1a1050); border: 1px solid var(--gold); border-radius: 6px; font-size: 11px; padding: 0 4px; color: #ffd66b; min-width: 16px; text-align: center; line-height: 14px; }
      .hud-id { flex: 1; min-width: 0; text-align: right; }
      .hud-name { font-size: 15px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }
      .hud-rank { font-size: 10px; color: var(--text-dim); margin-top: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hud-xpbar { height: 5px; border-radius: 3px; background: rgba(0,0,0,0.5); margin-top: 3px; overflow: hidden; border: 1px solid rgba(43,196,178,0.4); }
      .hud-xpbar-fill { height: 100%; background: var(--firouzeh); }
      .hud-money { display: flex; flex-direction: column; gap: 3px; flex: none; }
      .hud-pill { display: flex; align-items: center; gap: 4px; background: linear-gradient(180deg, #0d1024, #05070f); border: 1px solid var(--gold-soft); border-radius: 13px; padding: 3px 7px; }
      .hud-cash { border-color: var(--gold); }
      .hud-pill-plus { width: 13px; height: 13px; border-radius: 50%; background: linear-gradient(180deg, #7ee0a0, #2f9a55); color: #fff; font-size: 11px; line-height: 13px; text-align: center; flex: none; }
      .hud-pill-value { font-size: 11.5px; color: var(--gold); min-width: 0; }
      .hud-bank .hud-pill-value { color: #8fb0ff; font-size: 10px; }

      .hud-corner { position: relative; width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #232c58, #10142b); border: 1px solid var(--gold-soft); display: flex; align-items: center; justify-content: center; flex: none; }
      .hud-count { position: absolute; top: -4px; left: -4px; background: var(--anar); color: #fff; font-size: 9px; border-radius: 7px; min-width: 13px; height: 13px; display: flex; align-items: center; justify-content: center; padding: 0 2px; border: 1px solid #2a0a0a; }

      /* each stat: icon + value + "full at" time on one text line, then a
         plain colored bar underneath. Text never sits on top of the fill,
         so it stays fully readable at any fraction and any of the widths
         we support (320-430px), even with three bars up when nerve is
         sent by the realm. */
      .hud-stat-row { display: flex; align-items: center; padding: 1px 8px 5px; }
      .hud-bars { flex: 1; display: flex; gap: 6px; min-width: 0; }
      .stat { display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; min-width: 0; }
      .stat-head { display: flex; align-items: baseline; gap: 3px; min-width: 0; }
      .stat-icon { flex: none; align-self: center; }
      .stat-value { font-size: 10.5px; line-height: 1; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .stat-max { font-size: 9px; color: rgba(255,255,255,0.6); }
      .stat-chip { font-size: 9px; line-height: 1; color: #ffd66b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; margin-inline-start: auto; padding-inline-start: 3px; }
      .stat-bar { position: relative; min-width: 0; height: 7px; border-radius: 4px; background: rgba(0,0,0,0.55); border: 1.5px solid; overflow: hidden; }
      .stat-fill { position: absolute; top: 0; bottom: 0; right: 0; border-radius: 4px; transition: width 0.4s; }
    `}</style>
  )
}
