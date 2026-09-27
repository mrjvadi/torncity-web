import type { ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}

export default function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && <div className="sheet-title display">{title}</div>}
        {children}
      </div>
      <SheetStyles />
    </div>
  )
}

function SheetStyles() {
  return (
    <style>{`
      .sheet-backdrop {
        position: fixed; inset: 0; background: rgba(3,4,10,0.65);
        display: flex; align-items: flex-end; justify-content: center;
        z-index: 900; backdrop-filter: blur(2px);
      }
      .sheet-panel {
        width: 100%; max-width: 520px;
        background: linear-gradient(180deg, #141833, #0a0c1c);
        border: 1px solid var(--gold-soft);
        border-bottom: none;
        border-radius: 24px 24px 0 0;
        padding: 10px 18px calc(20px + var(--safe-b));
        max-height: 78vh;
        overflow-y: auto;
        box-shadow: 0 -20px 60px rgba(0,0,0,0.6);
        animation: sheet-up 0.22s ease-out;
      }
      @keyframes sheet-up { from { transform: translateY(24px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
      .sheet-grip { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); margin: 4px auto 14px; }
      .sheet-title { font-size: 20px; color: var(--gold); margin-bottom: 12px; text-align: center; }
    `}</style>
  )
}
