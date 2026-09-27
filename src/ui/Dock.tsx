import Icon from './Icon'

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
                  <Icon name={t.icon} palette="gold" size={26} />
                  <span className="dock-tile-label display">{t.label}</span>
                </span>
              ) : (
                <>
                  <span className="dock-icon-wrap">
                    <Icon name={t.icon} palette="steel" size={22} />
                    {count > 0 && <span className="dock-count">{count < 100 ? count : '99+'}</span>}
                  </span>
                  <span className="dock-label display">{t.label}</span>
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
      /* ~32% shorter than the first pass, per the owner: the dock ate too
         much of the screen on a phone. Tap targets stay >=40px even so —
         each tab is a flex-1 slice of the full width, comfortably over
         that at any normal phone size, and the bar itself is >=48px tall. */
      .dock { padding-bottom: var(--safe-b); background: linear-gradient(0deg, rgba(7,10,20,0.95), rgba(7,10,20,0.5) 80%, transparent); }
      .dock-bar {
        display: flex; align-items: flex-end; justify-content: space-between;
        background: linear-gradient(180deg, #171b38, #0a0c1c);
        border-top: 1px solid var(--gold-soft);
        box-shadow: 0 -8px 24px rgba(0,0,0,0.5);
        padding: 4px 4px 5px;
        min-height: 48px;
      }
      .dock-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 2px; position: relative; min-height: 40px; justify-content: center; }
      .dock-icon-wrap { position: relative; display: flex; }
      .dock-label { font-size: 9.5px; color: var(--text-faint); }
      .dock-count { position: absolute; top: -5px; left: -7px; background: var(--anar); color: #fff; font-size: 9px; min-width: 13px; height: 13px; border-radius: 7px; display: flex; align-items: center; justify-content: center; padding: 0 2px; }
      .dock-tab.active { transform: translateY(-9px); }
      .dock-tile {
        display: flex; flex-direction: column; align-items: center; gap: 1px;
        background: linear-gradient(180deg, #3a63d0, #15286a);
        border: 1.5px solid var(--gold);
        border-radius: 15px;
        padding: 6px 13px 5px;
        box-shadow: 0 6px 14px rgba(58,99,208,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
      }
      .dock-tile-label { font-size: 11.5px; color: #ffd66b; }
    `}</style>
  )
}
