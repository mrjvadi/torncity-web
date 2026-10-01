import { useMemo, type CSSProperties } from 'react'
import type { ProfileView } from '../api/types'
import { formatNumber } from '../lib/persian'
import { GLabel, Emboss } from '../kit'
import type { IconPalette } from '../kit'
import { t } from '../i18n'
import { useContentNames } from '../village/useVillage'

interface HudProps {
  profile: ProfileView | null
  onBank: () => void
  onAvatar: () => void
}

/** The top bar and stat row exactly as game_hud.gd/home_proto.gd draw them
 * (`_top_bar`/`_stat_row`): every size below is the prototype's own Rect2
 * number turned into `calc(N * var(--u))`, so this sits at the prototype's
 * proportions on a phone. The prototype has no menu/bell button in the top
 * bar at all — game_hud.gd draws them as plates at the stat row's far end
 * (`_plate_button`), which is where they live below. */
export default function Hud({ profile, onBank, onAvatar }: HudProps) {
  const names = useContentNames()
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
            <div className="hud-rank">{profile?.rank ? names.name('life_rank', profile.rank.code, profile.rank.name) : ''}</div>
            <div className="hud-vitals">
              <VBar icon="health" palette="emerald" color="#4cc47e" value={profile?.health ?? 0} max={profile?.max_health ?? 100} frac={healthFrac} />
              <VBar icon="energy" palette="amber" color="#f5a623" value={profile?.energy ?? 0} max={profile?.max_energy ?? 100} frac={energyFrac} />
              {hasNerve && <VBar icon="nerve" palette="ruby" color="#e5484d" value={nerve} max={maxNerve} frac={nerveFrac} />}
            </div>
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

      <HudStyles />
    </div>
  )
}

/** A vital (health, energy, nerve) as a thin bar with its small embossed
 * icon and the number inside — the identity block's compact replacement for
 * the old XP line and the second row of big bars. */
function VBar({ icon, palette, color, value, max, frac }: {
  icon: string; palette: IconPalette; color: string; value: number; max: number; frac: number
}) {
  return (
    <div className="vbar">
      <Emboss name={icon} palette={palette} size="max(16px, calc(30 * var(--u)))" className="vbar-icon" />
      <div className="vbar-track" style={{ borderColor: color }}>
        <div className="vbar-fill" style={{ width: `${frac * 100}%`, background: color }} />
        <span className="vbar-value">{formatNumber(value)}<span className="vbar-max">/{formatNumber(max)}</span></span>
      </div>
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
      /* the vitals under the name (health, energy): thin bars, small icons */
      .hud-vitals { width: calc(200 * var(--u)); min-width: 118px; margin-left: auto; margin-top: calc(6 * var(--u)); display: flex; flex-direction: column; gap: max(2px, calc(4 * var(--u))); }
      .vbar { display: flex; align-items: center; gap: calc(6 * var(--u)); }
      .vbar-icon { flex: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
      .vbar-track { position: relative; flex: 1; min-width: 0; height: max(12px, calc(22 * var(--u))); border-radius: 999px; background: rgba(0,0,0,0.7); border: 1.5px solid; overflow: hidden; display: flex; align-items: center; justify-content: center; }
      .vbar-fill { position: absolute; inset: 1px; inset-inline-end: auto; border-radius: 999px; transition: width 0.4s; box-shadow: inset 0 1px 2px rgba(255,255,255,0.35); }
      .vbar-value { position: relative; z-index: 1; font-family: 'Lalezar', 'Vazirmatn', sans-serif; font-size: max(9px, calc(17 * var(--u))); line-height: 1; color: #fff; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
      .vbar-max { color: rgba(255,255,255,0.75); }

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

    `}</style>
  )
}
