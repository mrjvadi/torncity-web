import { useEffect, useState } from 'react'
import * as api from '../api/client'
import Popup from './Popup'
import Icon from './Icon'
import { t, type Key } from '../i18n'
import { useContentNames } from '../village/useVillage'

/** What the village adds to the menu: its own screens, and the services that
 * are a journey away in Support. */
export interface MenuVillage { name: string; isHead: boolean; resident?: boolean; support: { code: string; name: string } }

type Palette = 'gold' | 'emerald' | 'violet' | 'sapphire' | 'amber'
interface VillageItem {
  key: string; icon: string; palette: Palette; label: Key
  /** a local screen of the village... */
  local?: string
  args?: Record<string, string>
  /** ...or a server command whose screen opens */
  command?: string
  head?: boolean
  /** not for the head: the head cannot leave while holding the office */
  notHead?: boolean
  resident?: boolean
}

/** The village menu is sections, never actions (docs/ui/web-structure.md 5.3): «زندگی من»
 * first, then the village itself. The build button is on the village page, not here. */
const MY_LIFE: VillageItem[] = [
  { key: 'land', icon: 'x_field', palette: 'emerald', label: 'menu.land', local: 'village_home', args: { land: '1' }, resident: true },
  { key: 'house', icon: 'house', palette: 'gold', label: 'menu.house', command: 'settlement.private', resident: true },
  { key: 'mine', icon: 'box', palette: 'amber', label: 'menu.mine', command: 'settlement.mine', resident: true },
  { key: 'work', icon: 'gears', palette: 'sapphire', label: 'menu.work', local: 'village_labor', resident: true },
]

const THE_VILLAGE: VillageItem[] = [
  { key: 'storage', icon: 'box', palette: 'sapphire', label: 'storage.open', local: 'village_storage' },
  { key: 'overview', icon: 'chart', palette: 'sapphire', label: 'menu.status', local: 'village_overview' },
  { key: 'who', icon: 'society', palette: 'emerald', label: 'village.btn.who', local: 'village_who' },
  { key: 'knowledge', icon: 'book', palette: 'violet', label: 'village.btn.knowledge', local: 'village_knowledge' },
  { key: 'progress', icon: 'clock', palette: 'amber', label: 'village.btn.progress', local: 'village_progress' },
  { key: 'donate', icon: 'gift', palette: 'gold', label: 'village.btn.donate', local: 'village_overview', args: { donate: '1' }, resident: true },
  { key: 'terms', icon: 'gavel', palette: 'gold', label: 'menu.terms', command: 'settlement.terms', head: true },
  { key: 'leave', icon: 'walk', palette: 'amber', label: 'menu.leave', command: 'settlement.leave', resident: true, notHead: true },
]

/** The services of the central city a village may lack: each is shown only while the village lacks it (the server says
 * which, in the village overview), and opens the journey to that city with the service named. The village's own «کار»
 * is in the menu already and the jail is never a shortcut. */
const SUPPORT_ITEMS: { key: string; icon: string; label: Key }[] = [
  { key: 'bank', icon: 'bank', label: 'village.menu.support_bank' },
  { key: 'market', icon: 'market', label: 'village.menu.support_market' },
  { key: 'knowledge', icon: 'book', label: 'village.menu.support_knowledge' },
  { key: 'hospital', icon: 'hospital', label: 'village.menu.support_hospital' },
]

/** The services of the central city this village does not have, read from the village overview when the menu opens. */
function useLackedServices(open: boolean, enabled: boolean): string[] {
  const [lacked, setLacked] = useState<string[]>([])
  useEffect(() => {
    if (!open || !enabled) return
    let cancelled = false
    api.runCommand('settlement.overview', {}).then((r) => {
      const services = (r.view as { support?: { services?: string[] | null } | null } | undefined)?.support?.services
      if (!cancelled) setLacked(services ?? [])
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [open, enabled])
  return lacked
}

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  village?: MenuVillage
  onVillage?: (local: string, args?: Record<string, string>) => void
  /** Opens the screen a server command answers with. */
  onCommand?: (command: string, args?: Record<string, string>) => void
  /** Opens the journey to the central city, with the service the player wants named. */
  onTravel?: (cityCode: string, service: string) => void
}

export default function MenuSheet({ open, onClose, village, onVillage, onCommand, onTravel }: MenuSheetProps) {
  const names = useContentNames()
  const lacked = useLackedServices(open, !!village)
  const shortcuts = SUPPORT_ITEMS.filter((i) => lacked.includes(i.key))
  return (
    <Popup open={open} onClose={onClose} title={village ? village.name : t('village.menu.title')} tone="navy">
      {village && (
        <>
          {[
            { title: t('menu.my_life'), items: MY_LIFE },
            { title: t('village.title') + ' · ' + village.name, items: THE_VILLAGE },
          ].map((g) => {
            const items = g.items.filter((i) => (!i.head || village.isHead) && !(i.notHead && village.isHead) && (!i.resident || village.resident !== false))
            if (!items.length) return null
            return (
              <div key={g.title}>
                <div className="menu-sec">{g.title}</div>
                <div className="menu-grid">
                  {items.map((i) => (
                    <button key={i.key} className="menu-item" onClick={() => { if (i.command) onCommand?.(i.command); else onVillage?.(i.local!, i.args); onClose() }}>
                      <Icon name={i.icon} palette={i.palette} size={22} />
                      <span>{t(i.label)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {shortcuts.length > 0 && (
            <>
              <div className="menu-sec">{t('village.menu.support', { city: names.name('city', village.support.code, village.support.name) })}</div>
              <div className="menu-grid">
                {shortcuts.map((i) => (
                  <button key={i.key} className="menu-item" onClick={() => { onTravel?.(village.support.code, i.key); onClose() }}>
                    <Icon name={i.icon} palette="steel" size={22} />
                    <span>{t(i.label)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
