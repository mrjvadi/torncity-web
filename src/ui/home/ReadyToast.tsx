import Icon from '../Icon'

interface ReadyToastProps {
  title: string
  subtitle: string
  cta: string
  onTap: () => void
}

/** The bottom CTA card over the dock (home_proto.gd `_ready_toast`): a teal
 * glowing frame, an energy glyph, and one button. CityView only mounts this
 * when there is a real reason to show it (energy near full and a shift to
 * start) — never a fixed "always on" banner. */
export default function ReadyToast({ title, subtitle, cta, onTap }: ReadyToastProps) {
  return (
    <div className="ready-toast">
      <span className="ready-toast-icon"><Icon name="energy" palette="amber" size={32} /></span>
      <div className="ready-toast-copy">
        <div className="ready-toast-title display">{title}</div>
        <div className="ready-toast-sub">{subtitle}</div>
      </div>
      <button className="ready-toast-cta display" onClick={onTap}>{cta}</button>
    </div>
  )
}
