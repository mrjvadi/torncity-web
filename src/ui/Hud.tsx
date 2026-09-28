import { useMemo } from 'react'
import type { ProfileView } from '../api/types'
import { formatNumber } from '../lib/persian'
import { clockIn } from '../lib/time'
import Icon from './Icon'
import { GLabel, Chip } from '../kit'

interface HudProps {
  profile: ProfileView | null
  unread: number
  onBank: () => void
  onBell: () => void
  onMenu: () => void
  onAvatar: () => void
}

/** The top bar and stat row exactly as home_proto.gd draws them
 * (`_top_bar`/`_stat_row`): every size below is the prototype's own Rect2
 * number turned into `calc(N * var(--u))`, so this sits at the prototype's
 * proportions on a phone. */
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
          <span className="hud-avatar-plate"><Icon name="fox" palette="fox" size="calc(38 * var(--u))" /></span>
          <span className="hud-level"><GLabel top="#ffffff" bottom="#ffd66b" stroke={1}>{profile ? formatNumber(profile.level) : '–'}</GLabel></span>
        </button>

        <div className="hud-id">
          <div className="hud-name"><GLabel top="#ffffff" bottom="#bfefff" stroke={1.2}>{profile?.name ?? '…'}</GLabel></div>
          <div className="hud-rank">{profile?.rank?.name ?? ''}</div>
          <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: `${xpFrac * 100}%` }} /></div>
        </div>

        <div className="hud-money">
          <button className="hud-pill hud-cash" onClick={onBank}>
            <Icon name="coins" palette="gold" size="calc(34 * var(--u))" className="hud-pill-coin" />
            <span className="hud-pill-value"><GLabel top="#fff6c8" bottom="#ffb21f" stroke={1}>{profile ? formatNumber(profile.cash) : '–'}</GLabel></span>
            <span className="hud-pill-plus">+</span>
          </button>
          <button className="hud-pill hud-bank" onClick={onBank}>
            <Icon name="bank" palette="sapphire" size="calc(26 * var(--u))" className="hud-pill-coin" />
            <span className="hud-pill-value"><GLabel top="#eaf1ff" bottom="#8fb0ff" stroke={0.8}>{profile ? formatNumber(profile.bank) : '–'}</GLabel></span>
          </button>
        </div>

        <button className="hud-corner" onClick={onBell} aria-label="اعلان‌ها">
          <Icon name="inbox" palette="sapphire" size="calc(18 * var(--u))" />
          {unread > 0 && <span className="hud-count">{unread < 100 ? unread : '99+'}</span>}
        </button>
        <button className="hud-corner" onClick={onMenu} aria-label="منو">
          <Icon name="menu" palette="steel" size="calc(18 * var(--u))" />
        </button>
      </div>

      <div className="hud-stat-row">
        <div className="hud-bars">
          <StatBar icon="health" palette="emerald" color="#4cc47e" value={profile?.health ?? 0} max={profile?.max_health ?? 100} frac={healthFrac} full={healthFull} fullIn={0} />
          {nerve !== null && maxNerve !== null && (
            <StatBar icon="nerve" palette="ruby" color="#e5484d" value={nerve} max={maxNerve} frac={nerveFrac} full={nerveFull} fullIn={nerveFullIn} />
          )}
          <StatBar icon="energy" palette="amber" color="#f5a623" value={profile?.energy ?? 0} max={profile?.max_energy ?? 100} frac={energyFrac} full={energyFull} fullIn={profile?.energy_full_in_seconds ?? 0} />
        </div>
      </div>
      <HudStyles />
    </div>
  )
}

/** Each stat: an icon overlapping the bar's end, the value inside the fill
 * (home_proto.gd `_stat_row`), and a "full at" time chip underneath. */
function StatBar({ icon, palette, color, value, max, frac, full, fullIn }: {
  icon: string; palette: 'emerald' | 'amber' | 'ruby'; color: string; value: number; max: number
  frac: number; full: boolean; fullIn: number
}) {
  return (
    <div className="stat">
      <div className="stat-bar" style={{ borderColor: color }}>
        <div className="stat-fill" style={{ width: `${frac * 100}%`, background: color }} />
        <span className="stat-value">{formatNumber(value)}<span className="stat-max">/{formatNumber(max)}</span></span>
        <Icon name={icon} palette={palette} size="calc(38 * var(--u))" className="stat-icon" />
      </div>
      {!full && fullIn > 0 && <Chip fontSize="calc(15 * var(--u))" className="stat-chip">{clockIn(fullIn)}</Chip>}
    </div>
  )
}

function HudStyles() {
  return (
    <style>{`
      /* home_proto.gd _top_bar/_stat_row, converted to calc(N * var(--u)) —
         the prototype's own 720-canvas Rect2 numbers, so this sits at the
         prototype's exact proportions on a phone (owner's "smaller" HUD ask
         already comes out true once it's built at 1/720 scale). */
      .hud { position: relative; z-index: 5; padding-top: var(--safe-t); background: linear-gradient(180deg, rgba(7,10,20,0.94), rgba(7,10,20,0.8) 70%, transparent); }
      .hud-top { display: flex; align-items: flex-start; gap: calc(6 * var(--u)); padding: calc(8 * var(--u)) calc(10 * var(--u)) calc(2 * var(--u)); }

      .hud-avatar { position: relative; width: calc(112 * var(--u)); height: calc(112 * var(--u)); flex: none; }
      .hud-ring { position: absolute; inset: calc(-6 * var(--u)); width: calc(100% + 12 * var(--u)); height: calc(100% + 12 * var(--u)); transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: rgba(255,255,255,0.14); stroke-width: 8; }
      .ring-value { fill: none; stroke: var(--firouzeh); stroke-width: 8; stroke-linecap: round; transition: stroke-dasharray 0.4s; filter: drop-shadow(0 0 3px rgba(43,196,178,0.7)); }
      .hud-avatar-plate {
        position: absolute; inset: calc(8 * var(--u));
        border-radius: 50%;
        background: radial-gradient(circle at 38% 28%, #14655f, #062825);
        border: calc(2 * var(--u)) solid var(--gold);
        display: flex; align-items: center; justify-content: center;
        box-shadow: inset 0 calc(3 * var(--u)) calc(6 * var(--u)) rgba(0,0,0,0.5), inset 0 calc(-2 * var(--u)) 0 rgba(255,255,255,0.08);
      }
      .hud-level {
        position: absolute; bottom: calc(-8 * var(--u)); left: 50%; transform: translateX(-50%);
        background: linear-gradient(180deg, #3a2a8a, #1a1050);
        border: calc(2 * var(--u)) solid var(--gold); border-radius: calc(7 * var(--u));
        font-size: calc(22 * var(--u)); line-height: calc(30 * var(--u));
        padding: 0 calc(7 * var(--u)); min-width: calc(30 * var(--u)); text-align: center;
        box-shadow: 0 calc(3 * var(--u)) calc(6 * var(--u)) rgba(0,0,0,0.5);
      }

      .hud-id { flex: 1; min-width: 0; text-align: right; padding-top: calc(6 * var(--u)); }
      .hud-name { font-size: calc(28 * var(--u)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }
      .hud-rank { font-size: calc(15 * var(--u)); color: var(--text-dim); margin-top: calc(1 * var(--u)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hud-xpbar { height: calc(11 * var(--u)); border-radius: calc(6 * var(--u)); background: rgba(0,0,0,0.6); margin-top: calc(5 * var(--u)); overflow: hidden; border: 1.5px solid rgba(43,196,178,0.55); }
      .hud-xpbar-fill { height: 100%; background: linear-gradient(180deg, #7cf0e2, var(--firouzeh)); transition: width 0.4s; }

      .hud-money { display: flex; flex-direction: column; gap: calc(4 * var(--u)); flex: none; padding-top: calc(2 * var(--u)); }
      .hud-pill {
        position: relative; display: flex; align-items: center; gap: calc(4 * var(--u));
        background: linear-gradient(180deg, #0d1024, #05070f);
        border: calc(2 * var(--u)) solid var(--gold-soft); border-radius: calc(20 * var(--u));
        padding: calc(4 * var(--u)) calc(8 * var(--u));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0,0,0,0.4);
      }
      .hud-cash { border-color: var(--gold); padding-inline-start: calc(20 * var(--u)); }
      .hud-pill-coin { flex: none; }
      .hud-pill-value { font-size: calc(20 * var(--u)); min-width: 0; white-space: nowrap; }
      .hud-bank .hud-pill-value { font-size: calc(17 * var(--u)); }
      .hud-pill-plus {
        position: absolute; inset-inline-start: calc(-6 * var(--u)); top: 50%; transform: translateY(-50%);
        width: calc(20 * var(--u)); height: calc(20 * var(--u)); border-radius: 50%;
        background: linear-gradient(180deg, #7ee0a0, #2f9a55); border: 1.5px solid #1a5a30;
        color: #fff; font-size: calc(15 * var(--u)); line-height: calc(18 * var(--u)); text-align: center; flex: none;
        box-shadow: 0 calc(2 * var(--u)) calc(4 * var(--u)) rgba(0,0,0,0.4);
      }

      .hud-corner {
        position: relative; width: calc(46 * var(--u)); height: calc(46 * var(--u)); border-radius: 50%;
        background: radial-gradient(circle at 38% 28%, #232c58, #10142b);
        border: calc(2 * var(--u)) solid var(--gold-soft);
        display: flex; align-items: center; justify-content: center; flex: none;
        box-shadow: 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0,0,0,0.4);
      }
      .hud-count {
        position: absolute; top: calc(-5 * var(--u)); left: calc(-5 * var(--u));
        background: linear-gradient(180deg, #ff9a9e, var(--anar)); color: #fff; font-size: calc(15 * var(--u));
        border-radius: 999px; min-width: calc(19 * var(--u)); height: calc(19 * var(--u));
        display: flex; align-items: center; justify-content: center; padding: 0 calc(3 * var(--u));
        border: 1px solid #6e1216;
      }

      /* the stat row: value text and the "full at" chip sit outside the
         fill (never on top of it) so both stay readable at any fraction —
         the icon overlaps the bar's own end, as in the prototype. */
      .hud-stat-row { display: flex; align-items: center; padding: calc(2 * var(--u)) calc(10 * var(--u)) calc(6 * var(--u)); }
      .hud-bars { flex: 1; display: flex; gap: calc(8 * var(--u)); min-width: 0; }
      .stat { display: flex; flex-direction: column; align-items: center; gap: calc(4 * var(--u)); flex: 1 1 0; min-width: 0; }
      .stat-bar {
        position: relative; width: 100%; min-width: 0; height: calc(32 * var(--u));
        border-radius: 999px; background: rgba(0,0,0,0.7); border: calc(2 * var(--u)) solid;
        overflow: visible; display: flex; align-items: center; justify-content: center;
      }
      .stat-fill { position: absolute; inset: 2px; right: 2px; border-radius: 999px; transition: width 0.4s; overflow: hidden; box-shadow: inset 0 2px 3px rgba(255,255,255,0.35); }
      .stat-value { position: relative; z-index: 1; font-size: calc(18 * var(--u)); line-height: 1; color: #fff; white-space: nowrap; text-shadow: 0 2px 2px rgba(0,0,0,0.6); }
      .stat-max { font-size: calc(15 * var(--u)); color: rgba(255,255,255,0.75); }
      .stat-icon { position: absolute; inset-inline-end: calc(-10 * var(--u)); top: 50%; transform: translateY(-50%); z-index: 2; }
      .stat-chip { font-size: calc(13 * var(--u)); }
    `}</style>
  )
}
