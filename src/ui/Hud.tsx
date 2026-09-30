import { useMemo, type CSSProperties } from 'react'
import type { ProfileView } from '../api/types'
import { formatNumber } from '../lib/persian'
import { clockIn } from '../lib/time'
import { GLabel, Chip, Emboss, Plate, Count } from '../kit'
import type { IconPalette } from '../kit'
import { t } from '../i18n'

interface HudProps {
  profile: ProfileView | null
  unread: number
  onBank: () => void
  onBell: () => void
  onMenu: () => void
  onAvatar: () => void
}

/** The top bar and stat row exactly as game_hud.gd/home_proto.gd draw them
 * (`_top_bar`/`_stat_row`): every size below is the prototype's own Rect2
 * number turned into `calc(N * var(--u))`, so this sits at the prototype's
 * proportions on a phone. The prototype has no menu/bell button in the top
 * bar at all — game_hud.gd draws them as plates at the stat row's far end
 * (`_plate_button`), which is where they live below. */
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
  const hasNerve = nerve !== null && maxNerve !== null

  // _stat_row's two bars are 176/720 wide with a 62/720 gap between them
  // (game_hud.gd) and fill the row alongside the bell/menu plates; a third
  // (nerve) bar has no such reference layout, so it shares the same space
  // at a proportionally smaller width instead of overflowing the row.
  const barW = hasNerve ? 122 : 176
  const barGap = hasNerve ? 22 : 62
  const barVars = { '--bar-w': `calc(${barW} * var(--u))`, '--bar-gap': `calc(${barGap} * var(--u))` } as CSSProperties

  return (
    <div className="hud">
      <div className="hud-panel">
        <div className="hud-top">
          <button className="hud-avatar" onClick={onAvatar} aria-label={t('shell.profile')}>
            <svg className="hud-ring" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="ring-track" />
              <circle
                cx="50" cy="50" r="44" className="ring-value"
                style={{ strokeDasharray: `${xpFrac * 276.5} 276.5` }}
              />
            </svg>
            <span className="hud-avatar-plate"><Emboss name="fox" palette="fox" size="calc(88 * var(--u))" /></span>
            <span className="hud-level"><GLabel top="#ffffff" bottom="#ffd66b" stroke={1}>{profile ? formatNumber(profile.level) : '–'}</GLabel></span>
          </button>

          <div className="hud-id">
            <div className="hud-name"><GLabel top="#ffffff" bottom="#bfefff" stroke={1.2}>{profile?.name ?? '…'}</GLabel></div>
            <div className="hud-rank">{profile?.rank?.name ?? ''}</div>
            <div className="hud-xpbar"><div className="hud-xpbar-fill" style={{ width: `${xpFrac * 100}%` }} /></div>
          </div>

          <div className="hud-money">
            <button className="hud-pill hud-cash" onClick={onBank}>
              <Emboss name="coins" palette="gold" size="calc(90 * var(--u))" className="hud-pill-coin" />
              <span className="hud-pill-value"><GLabel top="#fff6c8" bottom="#ffb21f" stroke={1}>{profile ? formatNumber(profile.cash) : '–'}</GLabel></span>
              <span className="hud-pill-plus">+</span>
            </button>
            <button className="hud-pill hud-bank" onClick={onBank}>
              <Emboss name="bank" palette="sapphire" size="calc(68 * var(--u))" className="hud-pill-coin hud-pill-coin-bank" />
              <span className="hud-pill-value"><GLabel top="#eaf1ff" bottom="#8fb0ff" stroke={0.8}>{profile ? formatNumber(profile.bank) : '–'}</GLabel></span>
            </button>
          </div>
        </div>
      </div>

      {/* game_hud.gd _stat_row: two short bars on the reading side, the
          bell and the menu each on a plate at the row's far end — never in
          the top bar itself. */}
      <div className="hud-stat-row">
        <div className="hud-bars" style={barVars}>
          <StatBar icon="energy" palette="amber" color="#f5a623" value={profile?.energy ?? 0} max={profile?.max_energy ?? 100} frac={energyFrac} full={energyFull} fullIn={profile?.energy_full_in_seconds ?? 0} />
          {hasNerve && (
            <StatBar icon="nerve" palette="ruby" color="#e5484d" value={nerve} max={maxNerve} frac={nerveFrac} full={nerveFull} fullIn={nerveFullIn} />
          )}
          <StatBar icon="health" palette="emerald" color="#4cc47e" value={profile?.health ?? 0} max={profile?.max_health ?? 100} frac={healthFrac} full={healthFull} fullIn={0} />
        </div>
        <div className="hud-corner-plates">
          <button className="hud-corner-plate" onClick={onBell} aria-label={t('shell.bell')}>
            <Plate size="calc(76 * var(--u))" rimWidth="calc(2.5 * var(--u))" light="#232c58" dark="#10142b">
              <Emboss name="inbox" palette="sapphire" size="calc(52 * var(--u))" />
            </Plate>
            {unread > 0 && <Count n={unread} size="calc(30 * var(--u))" className="hud-corner-count" />}
          </button>
          <button className="hud-corner-plate" onClick={onMenu} aria-label={t('shell.menu')}>
            <Plate size="calc(76 * var(--u))" rimWidth="calc(2.5 * var(--u))" light="#232c58" dark="#10142b">
              <Emboss name="menu" palette="steel" size="calc(52 * var(--u))" />
            </Plate>
          </button>
        </div>
      </div>
      <HudStyles />
    </div>
  )
}

/** Each stat: a big embossed icon overlapping the bar's end, a bold value
 * inside the fill, and a "full at" time chip underneath
 * (game_hud.gd `_stat_row`). */
function StatBar({ icon, palette, color, value, max, frac, full, fullIn }: {
  icon: string; palette: IconPalette; color: string; value: number; max: number
  frac: number; full: boolean; fullIn: number
}) {
  return (
    <div className="stat">
      <div className="stat-bar" style={{ borderColor: color }}>
        <div className="stat-fill" style={{ width: `${frac * 100}%`, background: color }} />
        <span className="stat-value">{formatNumber(value)}<span className="stat-max">/{formatNumber(max)}</span></span>
      </div>
      <Emboss name={icon} palette={palette} size="calc(76 * var(--u))" className="stat-icon" />
      {!full && fullIn > 0 && <Chip fontSize="calc(15 * var(--u))" className="stat-chip">{clockIn(fullIn)}</Chip>}
    </div>
  )
}

function HudStyles() {
  return (
    <style>{`
      /* game_hud.gd _top_bar/_stat_row, converted to calc(N * var(--u)) —
         the prototype's own 720-canvas Rect2 numbers, so this sits at the
         prototype's exact proportions on a phone. */
      .hud { position: relative; z-index: 5; padding-top: var(--safe-t); }
      /* game_hud.gd _top_bar: one lit frame panel behind the top bar only
         (Rect2(-24, -40, 768, 188), radius 44, gold trim, a lapis glow) —
         the stat row below it has no border of its own, just a soft fade
         (Kit.fade) into the city. Its top edge bleeds off past the canvas
         (-40 to 0), so only the bottom corners round off, and the bleed
         width (768 vs 720) shrinks the visible radius from 44 to 20. */
      .hud-panel {
        position: relative;
        background: linear-gradient(180deg, rgba(26,31,71,0.97), rgba(10,13,31,0.97));
        border: calc(2 * var(--u)) solid var(--gold);
        border-top: none;
        border-radius: 0 0 calc(20 * var(--u)) calc(20 * var(--u));
        box-shadow:
          inset 0 1.5px 0 rgba(255,255,255,0.18),
          inset 0 calc(-16 * var(--u)) calc(20 * var(--u)) calc(-16 * var(--u)) rgba(0,0,0,0.6),
          0 0 calc(22 * var(--u)) rgba(53,82,200,0.4),
          0 calc(8 * var(--u)) calc(20 * var(--u)) rgba(0,0,0,0.5);
        overflow: hidden;
      }
      .hud-panel::before {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background-image: var(--girih); background-size: calc(46 * var(--u)) calc(46 * var(--u));
        opacity: 0.12; mix-blend-mode: overlay;
      }
      /* avatar (582,8) is the ring's own local origin below; cash (22,22)
         is 10u left of it (720 - (582+128) = 10) and id/name sit between —
         padding on the row reproduces both edge gaps exactly. */
      .hud-top { position: relative; display: flex; align-items: flex-start; padding: 0 calc(10 * var(--u)) calc(10 * var(--u)) calc(22 * var(--u)); }

      /* the avatar: XP ring (582,8,128,128) as the local origin; the teal
         plate (592,18,108,108) is (10,10) inside it, the fox (14,12) more,
         and the level gem (566,96,50,44) hangs off its bottom-left. */
      .hud-avatar { position: relative; width: calc(128 * var(--u)); height: calc(128 * var(--u)); flex: none; margin-top: calc(8 * var(--u)); }
      .hud-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
      .ring-track { fill: none; stroke: rgba(255,255,255,0.14); stroke-width: 8; }
      .ring-value { fill: none; stroke: var(--firouzeh); stroke-width: 8; stroke-linecap: round; transition: stroke-dasharray 0.4s; filter: drop-shadow(0 0 3px rgba(43,196,178,0.7)); }
      .hud-avatar-plate {
        position: absolute; left: calc(10 * var(--u)); top: calc(10 * var(--u));
        width: calc(108 * var(--u)); height: calc(108 * var(--u));
        border-radius: 50%;
        background: radial-gradient(circle at 38% 28%, #14655f, #062825);
        border: calc(2.5 * var(--u)) solid var(--gold);
        display: flex; align-items: center; justify-content: center;
        box-shadow: inset 0 calc(3 * var(--u)) calc(6 * var(--u)) rgba(0,0,0,0.5), inset 0 calc(-2 * var(--u)) 0 rgba(255,255,255,0.08);
      }
      .hud-level {
        position: absolute; left: calc(-16 * var(--u)); top: calc(88 * var(--u));
        width: calc(50 * var(--u)); height: calc(44 * var(--u));
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(180deg, #3a2a8a, #1a1050);
        border: calc(2 * var(--u)) solid var(--gold); border-radius: calc(13 * var(--u));
        font-size: calc(26 * var(--u));
        box-shadow: 0 calc(3 * var(--u)) calc(6 * var(--u)) rgba(0,0,0,0.5);
      }

      .hud-id { flex: 1; min-width: 0; text-align: right; padding-top: calc(18 * var(--u)); padding-inline-end: calc(6 * var(--u)); }
      .hud-name { font-size: calc(36 * var(--u)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2; }
      .hud-rank { font-size: calc(17 * var(--u)); color: var(--text-dim); margin-top: calc(2 * var(--u)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* the xp bar is a fixed 170/720-wide strip under the name, not a
         full-width one (Rect2(386, 100, 170, 14)) — width is explicit and
         it hugs the name's own trailing (right) edge instead of
         stretching across the id column. */
      .hud-xpbar { width: calc(170 * var(--u)); margin-left: auto; height: calc(14 * var(--u)); border-radius: calc(7 * var(--u)); background: rgba(0,0,0,0.6); margin-top: calc(8 * var(--u)); overflow: hidden; border: 1.5px solid rgba(43,196,178,0.55); }
      .hud-xpbar-fill { height: 100%; background: linear-gradient(180deg, #7cf0e2, var(--firouzeh)); transition: width 0.4s; }

      /* money: cash (22,22,236,56) then bank (22,88,236,44) — a 10u gap
         between them (88 - (22+56)). */
      .hud-money { display: flex; flex-direction: column; gap: calc(10 * var(--u)); flex: none; margin-top: calc(22 * var(--u)); }
      .hud-pill {
        position: relative; display: flex; align-items: center; justify-content: flex-end;
        background: linear-gradient(180deg, #0d1024, #05070f);
        border: calc(2.5 * var(--u)) solid var(--gold-soft); border-radius: calc(28 * var(--u));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0,0,0,0.4);
      }
      .hud-cash { border-color: var(--gold); width: calc(236 * var(--u)); height: calc(56 * var(--u)); padding: 0 calc(60 * var(--u)) 0 calc(56 * var(--u)); }
      .hud-bank { width: calc(236 * var(--u)); height: calc(44 * var(--u)); border-radius: calc(22 * var(--u)); padding: 0 calc(52 * var(--u)) 0 calc(10 * var(--u)); }
      /* physical right (not inline-end): the coin/bank glyphs poke past
         their own pill's edge in fixed canvas coordinates, vertically
         centred on it — coins (198,4,90,90) against the cash pill
         (22,22,236,56), bank glyph (206,76,68,68) against the bank pill
         (22,88,236,44). */
      .hud-pill-coin { position: absolute; top: 50%; right: calc(-30 * var(--u)); transform: translateY(-50%); z-index: 2; }
      .hud-pill-coin-bank { right: calc(-16 * var(--u)); }
      .hud-pill-value { font-size: calc(30 * var(--u)); min-width: 0; white-space: nowrap; }
      .hud-bank .hud-pill-value { font-size: calc(24 * var(--u)); }
      .hud-pill-plus {
        /* physical, not logical: game_hud.gd puts this inset (8,8) into
           the cash frame's own top-left corner in fixed canvas
           coordinates, regardless of the page's RTL flow. */
        position: absolute; left: calc(8 * var(--u)); top: calc(8 * var(--u));
        width: calc(40 * var(--u)); height: calc(40 * var(--u)); border-radius: 50%;
        background: linear-gradient(180deg, #7ee0a0, #2f9a55); border: 1.5px solid #1a5a30;
        color: #fff; font-size: calc(24 * var(--u)); line-height: calc(38 * var(--u)); text-align: center;
        box-shadow: 0 calc(2 * var(--u)) calc(4 * var(--u)) rgba(0,0,0,0.4);
      }

      /* the stat row sits below the framed panel with no border of its
         own — a soft dark fade into the city, matching game_hud.gd's
         separate Kit.fade shade (not part of the top bar's frame). Two
         bars on the reading side; the bell and menu plates at the row's
         far end (26,162,76,76)/(118,162,76,76) — never in the top bar. */
      .hud-stat-row {
        position: relative; display: flex; align-items: flex-start;
        padding: calc(10 * var(--u)) calc(44 * var(--u)) calc(14 * var(--u)) calc(26 * var(--u));
        gap: calc(68 * var(--u));
        background: linear-gradient(180deg, rgba(7,10,20,0.55), rgba(7,10,20,0.15) 70%, transparent);
      }
      .hud-bars { flex: 1; display: flex; gap: var(--bar-gap); min-width: 0; justify-content: flex-end; }
      .stat { position: relative; flex: 0 0 var(--bar-w); min-width: 0; }
      .stat-bar {
        position: relative; width: 100%; height: calc(32 * var(--u));
        border-radius: 999px; background: rgba(0,0,0,0.7); border: calc(2 * var(--u)) solid;
        overflow: hidden; display: flex; align-items: center; justify-content: center;
      }
      .stat-fill { position: absolute; inset: 2px; right: 2px; border-radius: 999px; transition: width 0.4s; overflow: hidden; box-shadow: inset 0 2px 3px rgba(255,255,255,0.35); }
      /* bold, high-contrast digits — a stack of 1px shadows around the
         glyphs, not -webkit-text-stroke (see kit.css .k-glabel: WebKit
         strokes each Arabic glyph separately and breaks letter joins;
         these are Western digits over a busy fill, so the same risk
         applies to any joined text near it, and shadows read identically
         without it). */
      .stat-value {
        position: relative; z-index: 1; font-family: 'Lalezar', 'Vazirmatn', sans-serif; font-size: calc(24 * var(--u));
        line-height: 1; color: #fff; white-space: nowrap;
        text-shadow: 1px 0 0 rgba(0,0,0,0.9), -1px 0 0 rgba(0,0,0,0.9), 0 1px 0 rgba(0,0,0,0.9), 0 -1px 0 rgba(0,0,0,0.9), 0 2px 3px rgba(0,0,0,0.7);
      }
      .stat-max { font-size: calc(18 * var(--u)); color: rgba(255,255,255,0.8); }
      /* physical right, not inline-end: game_hud.gd embosses each bar's
         icon past its own right edge (x + 138 of a 176-wide bar), roughly
         centred on the bar's height (76 tall vs the bar's 32). */
      .stat-icon { position: absolute; right: calc(-38 * var(--u)); top: calc(-22 * var(--u)); z-index: 2; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.5)); }
      /* physical left, not inline-start: the chip sits (22,214) inside the
         bar's own box (176 wide, 178 top), not centred under it. */
      .stat-chip { position: absolute; left: calc(22 * var(--u)); top: calc(36 * var(--u)); width: calc(110 * var(--u)); text-align: center; box-sizing: border-box; }

      .hud-corner-plates { flex: none; display: flex; gap: calc(16 * var(--u)); align-items: flex-start; margin-top: calc(0 * var(--u)); }
      .hud-corner-plate { position: relative; display: flex; padding: 0; width: calc(76 * var(--u)); height: calc(76 * var(--u)); flex: none; }
      .hud-corner-count { position: absolute; top: calc(-4 * var(--u)); left: calc(-4 * var(--u)); }

      /* the rare 3-bar (nerve) case has no menu/bell fallback layout of
         its own in either source file — the plates stay put and the bars
         share the same space at --bar-w/--bar-gap instead. */
    `}</style>
  )
}
