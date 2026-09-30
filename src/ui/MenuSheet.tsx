import BottomSheet from './BottomSheet'
import { BUILD_ID } from '../lib/freshness'
import Icon from './Icon'
import { t, type Key } from '../i18n'

const USEFUL_COMMANDS: { command: string; label: Key; icon: string }[] = [
  { command: 'player.profile.get', label: 'shell.menu.profile', icon: 'person' },
  { command: 'bank.show', label: 'shell.menu.bank', icon: 'bank' },
  { command: 'inventory.show', label: 'shell.menu.inventory', icon: 'box' },
  { command: 'job.status', label: 'shell.menu.job', icon: 'work' },
  { command: 'life.me', label: 'shell.menu.life', icon: 'f_house' },
  { command: 'map.list', label: 'shell.menu.map', icon: 'x_map' },
  { command: 'map.cities', label: 'shell.menu.cities', icon: 'plane' },
  { command: 'player.settings', label: 'shell.menu.settings', icon: 'gears' },
  { command: 'device.list', label: 'shell.menu.devices', icon: 'phone' },
]

/** What the village adds to the menu: its own screens, and the services that
 * are a journey away in Support. */
export interface MenuVillage { name: string; isHead: boolean; support: { code: string; name: string } }

const VILLAGE_ITEMS: { key: string; icon: string; palette: 'gold' | 'emerald' | 'violet' | 'sapphire' | 'amber'; label: Key; local: string; args?: Record<string, string>; head?: boolean }[] = [
  { key: 'overview', icon: 'chart', palette: 'sapphire', label: 'village.btn.overview', local: 'village_overview' },
  { key: 'who', icon: 'society', palette: 'emerald', label: 'village.btn.who', local: 'village_who' },
  { key: 'knowledge', icon: 'book', palette: 'violet', label: 'village.btn.knowledge', local: 'village_knowledge' },
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
  onPick: (command: string) => void
  onSignOut: () => void
  village?: MenuVillage
  onVillage?: (local: string, args?: Record<string, string>) => void
  onTravel?: (cityCode: string) => void
}

export default function MenuSheet({ open, onClose, onPick, onSignOut, village, onVillage, onTravel }: MenuSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={t('shell.menu')}>
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
      <div className="menu-grid">
        {USEFUL_COMMANDS.map((c) => (
          <button key={c.command} className="menu-item" onClick={() => { onPick(c.command); onClose() }}>
            <Icon name={c.icon} palette="sapphire" size={22} />
            <span>{t(c.label)}</span>
          </button>
        ))}
      </div>
      <button className="menu-signout display" onClick={onSignOut}>{t('shell.menu.sign_out')}</button>
      <div className="menu-build">{t('shell.menu.version')} <span dir="ltr">{BUILD_ID}</span></div>
      <style>{`
        .menu-sec { font-size: 13px; color: var(--gold); margin: 4px 2px 8px; }
        .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .menu-item { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid rgba(242,194,85,0.18); border-radius: 14px; padding: 14px 6px; font-size: 12px; color: var(--text-dim); }
        .menu-build { margin-top: 10px; text-align: center; font-size: 11px; color: var(--text-dim); opacity: 0.7; }
        .menu-signout { width: 100%; background: rgba(229,72,77,0.12); color: #ff9aa0; border: 1px solid rgba(229,72,77,0.4); padding: 12px; border-radius: 14px; font-size: 15px; }
      `}</style>
    </BottomSheet>
  )
}
