// Kept as the name every screen already imports: it is the centred Popup now
// (nothing slides up from the bottom any more). Same props as before.
import type { ReactNode } from 'react'
import Popup, { type PopupTone } from './Popup'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  footer?: ReactNode
  tone?: PopupTone
  dismissible?: boolean
}

export default function BottomSheet({ open, onClose, children, title, footer, tone, dismissible }: BottomSheetProps) {
  return <Popup open={open} onClose={onClose} title={title} footer={footer} tone={tone} dismissible={dismissible}>{children}</Popup>
}
