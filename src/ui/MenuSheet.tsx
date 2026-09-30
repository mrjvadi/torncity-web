import Popup from './Popup'
import Icon from './Icon'
import { t, type Key } from '../i18n'

/** What the village adds to the menu: its own screens, and the services that
 * are a journey away in Support. */
export interface MenuVillage { name: string; isHead: boolean; support: { code: string; name: string } }

const VILLAGE_ITEMS: { key: string; icon: string; palette: 'gold' | 'emerald' | 'violet' | 'sapphire' | 'amber'; label: Key; local: string; args?: Record<string, string>; head?: boolean }[] = [
  { key: 'overview', icon: 'chart', palette: 'sapphire', label: 'village.btn.overview', local: 'village_overview' },
  { key: 'who', icon: 'society', palette: 'emerald', label: 'village.btn.who', local: 'village_who' },
  { key: 'knowledge', icon: 'book', palette: 'violet', label: 'village.btn.knowledge', local: 'village_knowledge' },
  { key: 'storage', icon: 'box', palette: 'sapphire', label: 'storage.open', local: 'village_storage' },
  { key: 'progress', icon: 'clock', palette: 'amber', label: 'village.btn.progress', local: 'village_progress' },
  { key: 'build', icon: 'house', palette: 'gold', label: 'village.btn.build', local: 'village_home', args: { build: '1' }, head: true },
  { key: 'donate', icon: 'gift', palette: 'gold', label: 'village.btn.donate', local: 'village_overview', args: { donate: '1' } },
]

const SUPPORT_ITEMS: { key: string; icon: string; label: Key }[] = [
  { key: 'bank', icon: 'bank', label: 'village.menu.support_bank' },
  { key: 'market', icon: 'market', label: 'village.menu.support_market' },
  { key: 'jobs', icon: 'work', label: 'village.menu.support_jobs' },
  { key: 'knowledge', icon: 'book', label: 'village.menu.support_knowledge' },
  { key: 'hospital', icon: 'hospital', label: 'village.menu.support_hospital' },
  { key: 'jail', icon: 'crime', label: 'village.menu.support_jail' },
]

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  village?: MenuVillage
  onVillage?: (local: string, args?: Record<string, string>) => void
  onTravel?: (cityCode: string) => void
}

export default function MenuSheet({ open, onClose, village, onVillage, onTravel }: MenuSheetProps) {
  return (
    <Popup open={open} onClose={onClose} title={village ? village.name : t('village.menu.title')} tone="navy">
      {village && (
        <>
          <div className="menu-sec">{t('village.title')} · {village.name}</div>
          <div className="menu-grid">
            {VILLAGE_ITEMS.filter((i) => !i.head || village.isHead).map((i) => (
              <button key={i.key} className="menu-item" onClick={() => { onVillage?.(i.local, i.args); onClose() }}>
                <Icon name={i.icon} palette={i.palette} size={22} />
                <span>{t(i.label)}</span>
              </button>
            ))}
          </div>
          <div className="menu-sec">{t('village.menu.support', { city: village.support.name })}</div>
          <div className="menu-grid">
            {SUPPORT_ITEMS.map((i) => (
              <button key={i.key} className="menu-item" onClick={() => { onTravel?.(village.support.code); onClose() }}>
                <Icon name={i.icon} palette="steel" size={22} />
                <span>{t(i.label)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <style>{`
        .menu-sec { font-size: 13px; color: var(--gold); margin: 4px 2px 8px; }
        .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .menu-item { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid rgba(242,194,85,0.18); border-radius: 14px; padding: 14px 6px; font-size: 12px; color: var(--text-dim); }
                      `}</style>
    </Popup>
  )
}
