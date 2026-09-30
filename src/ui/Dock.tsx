import Icon from './Icon'
import { GLabel, Count } from '../kit'
import { t as tr, type Key } from '../i18n'

export type TabKey = 'profile' | 'activity' | 'city' | 'market' | 'society'

const TABS: { key: TabKey; icon: string; label: Key }[] = [
  { key: 'profile', icon: 'person', label: 'shell.tab.profile' },
  { key: 'activity', icon: 'activity', label: 'shell.tab.activity' },
  { key: 'city', icon: 'city', label: 'shell.tab.city' },
  { key: 'market', icon: 'market', label: 'shell.tab.market' },
  { key: 'society', icon: 'society', label: 'shell.tab.society' },
]

interface DockProps {
  active: TabKey
  onSelect: (tab: TabKey) => void
  badge?: Partial<Record<TabKey, number>>
}

/** The dock, one solid bar of five tabs with the active one raised on a lit
 * tile (game_dock.gd `_dock`): sizes are the prototype's own Rect2 numbers
 * as `calc(N * var(--u))`. The five slots (128/720 each, 208/720 for the
 * active one) sum to exactly 720, so a plain flex-basis per tab reproduces
 * the layout with no gap or rounding slack; the active tile then rises out
 * of the bar on its own, taller than the bar's own background. */
export default function Dock({ active, onSelect, badge }: DockProps) {
  const activeIndex = TABS.findIndex((t) => t.key === active)
  return (
    <nav className="dock">
      <div className="dock-canvas dock-bar">
        <div className="dock-bg" />
        <div className="dock-row">
          {TABS.map((t, i) => {
            const isActive = t.key === active
            const count = badge?.[t.key] ?? 0
            // the groove between neighbours is skipped beside the raised
            // tile (game_dock.gd _dock)
            const groove = i > 0 && !isActive && i - 1 !== activeIndex
            return (
              <button
                key={t.key}
                className={`dock-tab${isActive ? ' active' : ''}${groove ? ' groove' : ''}`}
                onClick={() => onSelect(t.key)}
              >
                {isActive ? (
                  <span className="dock-tile">
                    <Icon name={t.icon} palette="gold" size="calc(108 * var(--u))" />
                    <span className="dock-tile-label"><GLabel top="#ffffff" bottom="#ffd66b" stroke={1}>{tr(t.label)}</GLabel></span>
                  </span>
                ) : (
                  <>
                    <span className="dock-icon-wrap">
                      <Icon name={t.icon} palette="steel" size="calc(80 * var(--u))" />
                      {count > 0 && <Count n={count} size="calc(32 * var(--u))" className="dock-count" />}
                    </span>
                    <span className="dock-label">{tr(t.label)}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <DockStyles />
    </nav>
  )
}

function DockStyles() {
  return (
    <style>{`
      /* game_dock.gd _dock: the canvas is 720 wide, 208 tall including the
         tile's own rise above the bar (tile: y 0-176; bar: y 38-208). */
      .dock { padding-bottom: var(--safe-b); }
      .dock-canvas { position: relative; height: calc(208 * var(--u)); }
      /* the bar background starts 38/720 below the canvas top — the raised
         tile's own top (y=0) is what "rises out of" it. Its 768-wide bleed
         (like the top bar's own frame) shrinks the visible corner radius
         from 10 to roughly nothing at this width, so the top corners are
         left square. */
      .dock-bg {
        position: absolute; left: 0; right: 0; top: calc(38 * var(--u)); bottom: 0;
        background-image: var(--girih), linear-gradient(180deg, #171b38, #0a0c1c);
        background-size: calc(46 * var(--u)) calc(46 * var(--u)), auto;
        background-blend-mode: overlay, normal;
        border-top: calc(2 * var(--u)) solid var(--gold-soft);
        box-shadow: 0 calc(-8 * var(--u)) calc(24 * var(--u)) rgba(0,0,0,0.55);
      }
      .dock-row { position: relative; display: flex; height: 100%; }
      .dock-tab { position: relative; flex: 0 0 calc(128 * var(--u)); display: flex; flex-direction: column; align-items: center; padding: 0; }
      .dock-tab.active { flex-basis: calc(208 * var(--u)); }
      /* the groove between two inactive neighbours (game_dock.gd: a 2-wide,
         92-tall bar at y=60, skipped beside the raised tile) — physical
         left, the boundary with this tab's next-more-left neighbour. */
      .dock-tab.groove::before {
        content: ''; position: absolute; left: 0; top: calc(60 * var(--u));
        width: calc(2 * var(--u)); height: calc(92 * var(--u)); background: rgba(0,0,0,0.45);
      }
      .dock-icon-wrap { position: absolute; left: 50%; top: calc(50 * var(--u)); transform: translateX(-50%); width: calc(80 * var(--u)); height: calc(80 * var(--u)); display: flex; align-items: center; justify-content: center; }
      .dock-label { position: absolute; left: 0; right: 0; top: calc(124 * var(--u)); text-align: center; font-size: calc(19 * var(--u)); color: #9ea8cc; }
      /* physical, not logical: game_dock.gd's count sits at (cx+14, 48)
         against an 80-wide icon centred on cx — 6/720 past the icon's own
         right edge, 2/720 above its top. */
      .dock-count { position: absolute; top: calc(-2 * var(--u)); right: calc(-6 * var(--u)); }
      .dock-tile {
        position: absolute; left: calc(6 * var(--u)); right: calc(6 * var(--u)); top: 0; height: calc(176 * var(--u));
        display: flex; flex-direction: column; align-items: center;
        background: linear-gradient(180deg, #3a63d0, #15286a);
        border: calc(3 * var(--u)) solid var(--gold);
        border-radius: calc(24 * var(--u));
        box-shadow: 0 calc(8 * var(--u)) calc(18 * var(--u)) rgba(58,99,208,0.55), inset 0 calc(2 * var(--u)) 0 rgba(255,255,255,0.18);
      }
      .dock-tile .icon { margin-top: 0; }
      .dock-tile-label { position: absolute; left: 0; right: 0; top: calc(102 * var(--u)); text-align: center; font-size: calc(28 * var(--u)); }
    `}</style>
  )
}
