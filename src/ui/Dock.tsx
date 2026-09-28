import Icon from './Icon'
import { GLabel, Count } from '../kit'

export type TabKey = 'profile' | 'activity' | 'city' | 'market' | 'society'

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'profile', icon: 'person', label: 'من' },
  { key: 'activity', icon: 'activity', label: 'فعالیت' },
  { key: 'city', icon: 'city', label: 'شهر' },
  { key: 'market', icon: 'market', label: 'اقتصاد' },
  { key: 'society', icon: 'society', label: 'جامعه' },
]

interface DockProps {
  active: TabKey
  onSelect: (tab: TabKey) => void
  badge?: Partial<Record<TabKey, number>>
}

/** The dock, one solid bar of five tabs with the active one raised on a lit
 * tile (home_proto.gd `_dock`): sizes are the prototype's own Rect2 numbers
 * as `calc(N * var(--u))` — the active tile widens to 208/720 of the bar
 * and rises 38/1280 above it, exactly as drawn there. */
export default function Dock({ active, onSelect, badge }: DockProps) {
  return (
    <nav className="dock">
      <div className="dock-bar">
        {TABS.map((t) => {
          const isActive = t.key === active
          const count = badge?.[t.key] ?? 0
          return (
            <button
              key={t.key}
              className={`dock-tab${isActive ? ' active' : ''}`}
              onClick={() => onSelect(t.key)}
            >
              {isActive ? (
                <span className="dock-tile">
                  <Icon name={t.icon} palette="gold" size="calc(54 * var(--u))" />
                  <span className="dock-tile-label"><GLabel top="#ffffff" bottom="#ffd66b" stroke={1}>{t.label}</GLabel></span>
                </span>
              ) : (
                <>
                  <span className="dock-icon-wrap">
                    <Icon name={t.icon} palette="steel" size="calc(40 * var(--u))" />
                    {count > 0 && <Count n={count} size="calc(24 * var(--u))" className="dock-count" />}
                  </span>
                  <span className="dock-label">{t.label}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <DockStyles />
    </nav>
  )
}

function DockStyles() {
  return (
    <style>{`
      /* home_proto.gd _dock: bar height and the active tile's rise/width
         are the prototype's own numbers at 1/720 scale. Tap targets stay
         comfortably >=40px at any phone width the app supports (320-430px)
         even so, since --u only shrinks below that at widths far under any
         real device. */
      .dock { padding-bottom: var(--safe-b); background: linear-gradient(0deg, rgba(7,10,20,0.97), rgba(7,10,20,0.6) 85%, transparent); }
      .dock-bar {
        position: relative;
        display: flex; align-items: flex-end; justify-content: space-between;
        background-image: var(--girih), linear-gradient(180deg, #171b38, #0a0c1c);
        background-size: calc(46 * var(--u)) calc(46 * var(--u)), auto;
        background-blend-mode: overlay, normal;
        border-top: calc(2 * var(--u)) solid var(--gold-soft);
        box-shadow: 0 calc(-8 * var(--u)) calc(24 * var(--u)) rgba(0,0,0,0.55);
        padding: calc(6 * var(--u)) calc(4 * var(--u)) calc(8 * var(--u));
        min-height: calc(118 * var(--u));
      }
      .dock-tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: calc(2 * var(--u)); padding: calc(4 * var(--u)) calc(2 * var(--u)); position: relative; min-height: calc(44 * var(--u)); }
      .dock-icon-wrap { position: relative; display: flex; }
      .dock-label { font-size: calc(17 * var(--u)); color: var(--text-faint); }
      .dock-count { position: absolute; top: calc(-6 * var(--u)); left: calc(-8 * var(--u)); }
      .dock-tab.active { flex: 1.5; transform: translateY(calc(-30 * var(--u))); }
      .dock-tile {
        display: flex; flex-direction: column; align-items: center; gap: calc(2 * var(--u));
        width: 100%;
        background: linear-gradient(180deg, #3a63d0, #15286a);
        border: calc(3 * var(--u)) solid var(--gold);
        border-radius: calc(20 * var(--u));
        padding: calc(8 * var(--u)) calc(10 * var(--u)) calc(6 * var(--u));
        box-shadow: 0 calc(8 * var(--u)) calc(18 * var(--u)) rgba(58,99,208,0.55), inset 0 calc(2 * var(--u)) 0 rgba(255,255,255,0.18);
      }
      .dock-tile-label { font-size: calc(23 * var(--u)); }
    `}</style>
  )
}
