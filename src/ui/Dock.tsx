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
                  <Icon name={t.icon} palette="gold" size={38} />
                  <span className="dock-tile-label display">{t.label}</span>
                </span>
              ) : (
                <>
                  <span className="dock-icon-wrap">
                    <Icon name={t.icon} palette="steel" size={30} />
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
      .dock { padding-bottom: var(--safe-b); background: linear-gradient(0deg, rgba(7,10,20,0.95), rgba(7,10,20,0.5) 80%, transparent); }
      .dock-bar {
        display: flex; align-items: flex-end; justify-content: space-between;
        background: linear-gradient(180deg, #171b38, #0a0c1c);
        border-top: 1px solid var(--gold-soft);
        box-shadow: 0 -8px 24px rgba(0,0,0,0.5);
        padding: 6px 6px 8px;
        min-height: 68px;
      }
      .dock-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; position: relative; }
      .dock-icon-wrap { position: relative; display: flex; }
      .dock-label { font-size: 12px; color: var(--text-faint); }
      .dock-count { position: absolute; top: -6px; left: -8px; background: var(--anar); color: #fff; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
      .dock-tab.active { transform: translateY(-14px); }
      .dock-tile {
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        background: linear-gradient(180deg, #3a63d0, #15286a);
        border: 2px solid var(--gold);
        border-radius: 20px;
        padding: 10px 18px 8px;
        box-shadow: 0 8px 20px rgba(58,99,208,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
      }
      .dock-tile-label { font-size: 15px; color: #ffd66b; }
    `}</style>
  )
}
