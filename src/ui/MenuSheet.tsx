import BottomSheet from './BottomSheet'
import Icon from './Icon'

const USEFUL_COMMANDS: { command: string; label: string; icon: string }[] = [
  { command: 'player.profile.get', label: 'پروفایل', icon: 'person' },
  { command: 'bank.show', label: 'بانک', icon: 'bank' },
  { command: 'inventory.show', label: 'کوله‌پشتی', icon: 'box' },
  { command: 'job.status', label: 'وضعیت شغل', icon: 'work' },
  { command: 'life.me', label: 'زندگی', icon: 'f_house' },
  { command: 'map.list', label: 'نقشه‌ی شهر', icon: 'x_map' },
  { command: 'map.cities', label: 'سفر بین‌شهری', icon: 'plane' },
  { command: 'player.settings', label: 'تنظیمات', icon: 'gears' },
  { command: 'device.list', label: 'دستگاه‌های متصل', icon: 'phone' },
]

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  onPick: (command: string) => void
  onSignOut: () => void
}

export default function MenuSheet({ open, onClose, onPick, onSignOut }: MenuSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="منو">
      <div className="menu-grid">
        {USEFUL_COMMANDS.map((c) => (
          <button key={c.command} className="menu-item" onClick={() => { onPick(c.command); onClose() }}>
            <Icon name={c.icon} palette="sapphire" size={26} />
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <button className="menu-signout display" onClick={onSignOut}>خروج از حساب</button>
      <style>{`
        .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .menu-item { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid rgba(242,194,85,0.18); border-radius: 14px; padding: 14px 6px; font-size: 12px; color: var(--text-dim); }
        .menu-signout { width: 100%; background: rgba(229,72,77,0.12); color: #ff9aa0; border: 1px solid rgba(229,72,77,0.4); padding: 12px; border-radius: 14px; font-size: 15px; }
      `}</style>
    </BottomSheet>
  )
}
